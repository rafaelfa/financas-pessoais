import { periodOf, periodRange } from './period';
import type { AccountingBasis, FinanceCategory, FinancePeriod, FinanceTransaction } from './types';

/**
 * Resultado mensal: `entradas − saídas`.
 *
 * O sistema de referência implementa **apenas** a visão de caixa, e nela o gasto
 * do cartão só conta quando a fatura é paga (documento 01, §5.2). Aqui os dois
 * regimes coexistem (melhoria M2):
 *
 * | Operação | Caixa | Competência |
 * |---|---|---|
 * | Gasto em débito/dinheiro | conta quando liquidado | conta na data |
 * | Gasto em cartão (`invoiceId`) | **não** conta — conta o pagamento da fatura | conta na data da compra |
 * | Pagamento de fatura | conta como saída na data do pagamento | **não** conta (liquida um passivo) |
 * | Ganho | conta quando recebido | conta na data |
 *
 * Nunca entram no resultado: transferências, depósitos e resgates de objetivos,
 * ajustes de saldo, transações ignoradas e categorias internas.
 */

export interface ResultOptions {
  readonly basis?: AccountingBasis;
  readonly monthStartDay?: number;
  /** Categorias, para excluir as internas. Sem lista, nenhuma é considerada interna. */
  readonly categories?: readonly FinanceCategory[];
}

export interface MonthlyResult {
  readonly period: FinancePeriod;
  /** Entradas, em cêntimos (positivo). */
  readonly incomeInCents: number;
  /** Saídas, em cêntimos (positivo — é uma magnitude). */
  readonly expenseInCents: number;
  /** `entradas − saídas`; negativo significa gastar mais do que se ganha. */
  readonly netInCents: number;
}

const DEFAULT_BASIS: AccountingBasis = 'cash';

function internalCategoryIds(categories: readonly FinanceCategory[]): ReadonlySet<string> {
  return new Set(categories.filter((category) => category.internal).map((category) => category.id));
}

/**
 * Decide se um lançamento entra no resultado.
 *
 * Exportada porque o orçamento e os relatórios têm de usar exatamente a mesma
 * regra — se divergirem, os números do painel deixam de bater certo com os do
 * extrato.
 */
export function countsInResult(
  transaction: FinanceTransaction,
  basis: AccountingBasis,
  internalCategories: ReadonlySet<string>,
): boolean {
  if (transaction.status === 'ignored') {
    return false;
  }

  // Categorias internas (transferência, fatura, investimento) nunca são ganho
  // nem gasto real. Isto aplica-se a gastos e ganhos categorizados — **não** ao
  // pagamento de fatura, que em visão de caixa é precisamente a saída que
  // representa a compra feita a crédito (melhoria M4 do plano).
  const isCategorized = transaction.kind === 'expense' || transaction.kind === 'income';

  if (
    isCategorized &&
    transaction.categoryId !== undefined &&
    internalCategories.has(transaction.categoryId)
  ) {
    return false;
  }

  const isCash = basis === 'cash';

  switch (transaction.kind) {
    case 'income':
      return isCash ? transaction.settled : true;

    case 'expense':
      // Em caixa, um gasto no cartão não é saída: a saída é o pagamento da fatura.
      if (isCash && transaction.invoiceId !== undefined) {
        return false;
      }

      return isCash ? transaction.settled : true;

    case 'invoice_payment':
      // Em competência o pagamento da fatura é neutro: só liquida um passivo.
      return isCash && transaction.settled;

    case 'transfer':
    case 'goal_deposit':
    case 'goal_withdrawal':
    case 'balance_adjust':
      return false;
  }
}

/** Resultado de um período concreto. */
export function monthlyResult(
  transactions: readonly FinanceTransaction[],
  period: FinancePeriod,
  options: ResultOptions = {},
): MonthlyResult {
  const basis = options.basis ?? DEFAULT_BASIS;
  const internal = internalCategoryIds(options.categories ?? []);

  let incomeInCents = 0;
  let expenseInCents = 0;

  for (const transaction of transactions) {
    if (transaction.date < period.start || transaction.date >= period.end) {
      continue;
    }

    if (!countsInResult(transaction, basis, internal)) {
      continue;
    }

    if (transaction.kind === 'income') {
      incomeInCents += Math.abs(transaction.amountInCents);
    } else {
      expenseInCents += Math.abs(transaction.amountInCents);
    }
  }

  return {
    period,
    incomeInCents,
    expenseInCents,
    netInCents: incomeInCents - expenseInCents,
  };
}

/** Resultado do período que contém `isoDate`. */
export function resultOfDate(
  transactions: readonly FinanceTransaction[],
  isoDate: string,
  options: ResultOptions = {},
): MonthlyResult {
  const period = periodOf(isoDate, options.monthStartDay);

  return monthlyResult(transactions, period, options);
}

/** Resultado de cada período entre `from` e `to`, para séries e gráficos. */
export function resultSeries(
  transactions: readonly FinanceTransaction[],
  from: string,
  to: string,
  options: ResultOptions = {},
): MonthlyResult[] {
  return periodRange(from, to, options.monthStartDay).map((period) =>
    monthlyResult(transactions, period, options),
  );
}

/**
 * Saídas por categoria num período — a base do orçamento e do relatório por
 * categoria. Devolve apenas categorias com movimento.
 */
export function expenseByCategory(
  transactions: readonly FinanceTransaction[],
  period: FinancePeriod,
  options: ResultOptions = {},
): Map<string, number> {
  const basis = options.basis ?? DEFAULT_BASIS;
  const internal = internalCategoryIds(options.categories ?? []);
  const totals = new Map<string, number>();

  for (const transaction of transactions) {
    if (transaction.kind !== 'expense') {
      continue;
    }

    if (transaction.date < period.start || transaction.date >= period.end) {
      continue;
    }

    if (!countsInResult(transaction, basis, internal) || transaction.categoryId === undefined) {
      continue;
    }

    totals.set(
      transaction.categoryId,
      (totals.get(transaction.categoryId) ?? 0) + Math.abs(transaction.amountInCents),
    );
  }

  return totals;
}

/** Entradas por categoria num período. */
export function incomeByCategory(
  transactions: readonly FinanceTransaction[],
  period: FinancePeriod,
  options: ResultOptions = {},
): Map<string, number> {
  const basis = options.basis ?? DEFAULT_BASIS;
  const internal = internalCategoryIds(options.categories ?? []);
  const totals = new Map<string, number>();

  for (const transaction of transactions) {
    if (transaction.kind !== 'income') {
      continue;
    }

    if (transaction.date < period.start || transaction.date >= period.end) {
      continue;
    }

    if (!countsInResult(transaction, basis, internal) || transaction.categoryId === undefined) {
      continue;
    }

    totals.set(
      transaction.categoryId,
      (totals.get(transaction.categoryId) ?? 0) + Math.abs(transaction.amountInCents),
    );
  }

  return totals;
}
