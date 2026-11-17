import type { FinanceAccount, FinanceTransaction } from './types';

/**
 * Saldos de contas.
 *
 * Fórmula do sistema de referência, confirmada na documentação oficial:
 * `Saldo = saldo inicial + ganhos recebidos − gastos pagos`, em **visão caixa**.
 *
 * Regras transversais aplicadas aqui (documento 01, §5.1 e §5.8):
 * - transações `ignored` nunca contam;
 * - só o que está liquidado (`settled`) move o saldo — o que está por pagar não;
 * - contas arquivadas saem dos totais;
 * - transferências movem dinheiro entre contas, mas anulam-se no total
 *   (as duas linhas têm sinais opostos), por isso não precisam de ser excluídas
 *   de propósito: o sinal já resolve;
 * - operações internas (pagamento de fatura, depósito em objetivo, ajuste de
 *   saldo) movem o saldo da conta, mas **nunca** entram no resultado mensal —
 *   essa exclusão vive em `result.ts`, não aqui.
 */

export interface BalanceOptions {
  /** Data-limite, inclusive. Sem valor, consideram-se todas as transações. */
  readonly upTo?: string;
}

function isBeforeOrOn(transaction: FinanceTransaction, upTo: string | undefined): boolean {
  return upTo === undefined || transaction.date <= upTo;
}

function isIgnored(transaction: FinanceTransaction): boolean {
  return transaction.status === 'ignored';
}

/**
 * Saldo de uma conta, incluindo o saldo inicial.
 *
 * Contas arquivadas continuam a poder ser consultadas individualmente; quem as
 * exclui são as funções de total.
 */
export function accountBalanceInCents(
  account: FinanceAccount,
  transactions: readonly FinanceTransaction[],
  options: BalanceOptions = {},
): number {
  const movement = transactions
    .filter((transaction) => transaction.accountId === account.id)
    .filter((transaction) => !isIgnored(transaction))
    .filter((transaction) => transaction.settled)
    .filter((transaction) => isBeforeOrOn(transaction, options.upTo))
    .reduce((total, transaction) => total + transaction.amountInCents, 0);

  return account.openingBalanceInCents + movement;
}

/** Um ponto da série diária: o saldo ao fim desse dia. */
export interface AccountBalancePoint {
  /** Data de calendário `YYYY-MM-DD`. */
  readonly date: string;
  readonly balanceInCents: number;
}

/** Desloca uma data de calendário `YYYY-MM-DD` em dias, sem passar por fusos. */
function shiftDay(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];

  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/**
 * Série diária do saldo de uma conta: um ponto por dia, do `days`-1.º dia atrás
 * até `today`, inclusive.
 *
 * Cada ponto é o **motor**, com `upTo` nesse dia — não há aqui uma segunda
 * fórmula de saldo. O último ponto coincide com o saldo que o cartão mostra
 * **exceto** quando há lançamentos liquidados com data futura: esses ficam fora
 * da série, que acaba hoje, e o saldo do cartão soma-os. As duas metades estão
 * fixadas em teste; se um dia deixarem de bater, o problema é da data — não se
 * «corrige» a série para dar o número.
 *
 * Custo: `days × movimentos da conta`. A lista de transações é a mesma que a
 * página já carrega, por isso não há consultas novas.
 */
export function accountBalanceSeries(
  account: FinanceAccount,
  transactions: readonly FinanceTransaction[],
  args: { readonly today: string; readonly days?: number },
): AccountBalancePoint[] {
  const days = args.days ?? 30;
  const fromAccount = transactions.filter((transaction) => transaction.accountId === account.id);

  return Array.from({ length: days }, (_, index) => {
    const date = shiftDay(args.today, index - (days - 1));

    return { date, balanceInCents: accountBalanceInCents(account, fromAccount, { upTo: date }) };
  });
}

/** Saldo de cada conta não arquivada. */
export function balanceByAccount(
  accounts: readonly FinanceAccount[],
  transactions: readonly FinanceTransaction[],
  options: BalanceOptions = {},
): Array<{ accountId: string; balanceInCents: number }> {
  return accounts
    .filter((account) => !account.archived)
    .map((account) => ({
      accountId: account.id,
      balanceInCents: accountBalanceInCents(account, transactions, options),
    }));
}

/**
 * Saldo total da aplicação: soma das contas **não arquivadas**.
 *
 * Transferências não alteram este valor, porque cada par contribui com um valor
 * positivo e um negativo da mesma magnitude.
 */
export function totalBalanceInCents(
  accounts: readonly FinanceAccount[],
  transactions: readonly FinanceTransaction[],
  options: BalanceOptions = {},
): number {
  return balanceByAccount(accounts, transactions, options).reduce(
    (total, account) => total + account.balanceInCents,
    0,
  );
}

/**
 * Saldo **projetado** numa data futura: igual ao saldo, mas inclui também o que
 * está agendado e ainda não liquidado (transações recorrentes, faturas por
 * pagar). É a "projeção de saldo futuro" do sistema de referência.
 */
export function projectedBalanceInCents(
  account: FinanceAccount,
  transactions: readonly FinanceTransaction[],
  onDate: string,
): number {
  const movement = transactions
    .filter((transaction) => transaction.accountId === account.id)
    .filter((transaction) => !isIgnored(transaction))
    .filter((transaction) => isBeforeOrOn(transaction, onDate))
    .reduce((total, transaction) => total + transaction.amountInCents, 0);

  return account.openingBalanceInCents + movement;
}

/** Saldo projetado de todas as contas não arquivadas, numa data futura. */
export function projectedTotalBalanceInCents(
  accounts: readonly FinanceAccount[],
  transactions: readonly FinanceTransaction[],
  onDate: string,
): number {
  return accounts
    .filter((account) => !account.archived)
    .reduce((total, account) => total + projectedBalanceInCents(account, transactions, onDate), 0);
}

/**
 * Ajuste a criar quando o utilizador "trava" o saldo de uma conta.
 *
 * O utilizador diz qual é o saldo real numa data; o sistema calcula a diferença
 * para o saldo que tinha calculado e cria um lançamento de ajuste com esse
 * valor, em vez de reescrever o histórico (documento 01, §5.1).
 */
export function balanceAdjustmentInCents(args: {
  readonly reportedBalanceInCents: number;
  readonly computedBalanceInCents: number;
}): number {
  return args.reportedBalanceInCents - args.computedBalanceInCents;
}

/**
 * Saldo de uma conta imediatamente antes de um ajuste, para detetar ajustes
 * duplicados: se já existe um ajuste na mesma data com o mesmo valor, repetir a
 * operação criaria um lançamento a mais.
 */
export function hasMatchingAdjustment(
  transactions: readonly FinanceTransaction[],
  args: {
    readonly accountId: string;
    readonly date: string;
    readonly amountInCents: number;
  },
): boolean {
  return transactions.some(
    (transaction) =>
      transaction.kind === 'balance_adjust' &&
      transaction.accountId === args.accountId &&
      transaction.date === args.date &&
      transaction.amountInCents === args.amountInCents &&
      !isIgnored(transaction),
  );
}
