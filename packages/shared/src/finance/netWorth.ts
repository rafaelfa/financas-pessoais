import { balanceByAccount } from './balance';
import { totalOutstandingByCard } from './invoice';
import { movementEffectInCents } from './goal';
import type {
  FinanceAccount,
  FinanceAsset,
  FinanceGoal,
  FinanceGoalMovement,
  FinanceInvoice,
  FinanceInvoicePayment,
  FinanceLiability,
  FinanceTransaction,
} from './types';

/**
 * Património líquido.
 *
 * Fórmula oficial do sistema de referência: `ativos − passivos`, com
 * `ativos = saldos em conta + investimentos + bens` e
 * `passivos = faturas abertas + dívidas formais` (documento 01, §5.6).
 *
 * Duas decisões nossas, documentadas porque o original não as toma:
 * - **bens são valorizados manualmente** e não se depreciam sozinhos: uma
 *   depreciação automática exigiria uma tabela de mercado que o produto não tem;
 * - o **valor acumulado em objetivos conta como ativo**, porque o dinheiro
 *   reservado saiu da conta mas continua a ser do utilizador. Sem isto, cada
 *   depósito num objetivo faria o património cair artificialmente.
 */

export interface NetWorthBreakdown {
  readonly accountsInCents: number;
  readonly goalsInCents: number;
  readonly assetsInCents: number;
  readonly invoicesInCents: number;
  readonly liabilitiesInCents: number;
}

export interface NetWorth {
  readonly assetsInCents: number;
  readonly liabilitiesInCents: number;
  readonly netInCents: number;
  readonly breakdown: NetWorthBreakdown;
}

/** Valor acumulado nos objetivos até à data de referência. */
export function goalsAccumulatedInCents(args: {
  readonly goals: readonly FinanceGoal[];
  readonly movements: readonly FinanceGoalMovement[];
  readonly upTo?: string;
}): number {
  return args.goals.reduce((total, goal) => {
    const movements = args.movements
      .filter((movement) => movement.goalId === goal.id)
      .filter((movement) => args.upTo === undefined || movement.date <= args.upTo)
      .reduce((sum, movement) => sum + movementEffectInCents(movement), 0);

    return total + (goal.initialReservedInCents ?? 0) + movements;
  }, 0);
}

/** Património líquido à data indicada. */
export function netWorth(args: {
  readonly accounts: readonly FinanceAccount[];
  readonly transactions: readonly FinanceTransaction[];
  readonly assets?: readonly FinanceAsset[];
  readonly liabilities?: readonly FinanceLiability[];
  readonly invoices?: readonly FinanceInvoice[];
  readonly invoicePayments?: readonly FinanceInvoicePayment[];
  readonly goals?: readonly FinanceGoal[];
  readonly goalMovements?: readonly FinanceGoalMovement[];
  /** Data de referência; sem valor, considera-se tudo o que existe. */
  readonly upTo?: string;
}): NetWorth {
  const accountsInCents = balanceByAccount(args.accounts, args.transactions, {
    upTo: args.upTo,
  }).reduce((total, account) => total + account.balanceInCents, 0);

  const assetsInCents = (args.assets ?? []).reduce((total, asset) => total + asset.valueInCents, 0);

  const goalsInCents = goalsAccumulatedInCents({
    goals: args.goals ?? [],
    movements: args.goalMovements ?? [],
    upTo: args.upTo,
  });

  const referenceDate = args.upTo ?? '9999-12-31';

  /*
   * O passivo das faturas sai da **cadeia** de cada cartão (a última fatura
   * carrega o que ficou por pagar das anteriores), e não de uma coluna guardada.
   * Um valor transitado guardado à mão fica desatualizado no dia em que alguém
   * paga parcialmente uma fatura antiga — e o património passa a mentir.
   *
   * Entram **todas** as faturas, incluindo a que ainda está aberta: a fórmula do
   * sistema de referência é `passivos = faturas abertas + dívidas formais`, e as
   * compras do período em curso já são uma dívida. Excluí-las por ainda não
   * estarem fechadas mostraria um património maior do que a realidade.
   *
   * Nota para a Fase 6: o património **histórico** exige filtrar também os
   * movimentos pela data de referência, e não só as faturas.
   */
  const outstandingByCard = totalOutstandingByCard({
    invoices: args.invoices ?? [],
    transactions: args.transactions,
    payments: args.invoicePayments ?? [],
    today: referenceDate,
  });
  const invoicesInCents = [...outstandingByCard.values()].reduce(
    (total, outstanding) => total + outstanding,
    0,
  );

  const liabilitiesInCents = (args.liabilities ?? []).reduce(
    (total, liability) => total + liability.outstandingInCents,
    0,
  );

  const totalAssets = accountsInCents + goalsInCents + assetsInCents;
  const totalLiabilities = invoicesInCents + liabilitiesInCents;

  return {
    assetsInCents: totalAssets,
    liabilitiesInCents: totalLiabilities,
    netInCents: totalAssets - totalLiabilities,
    breakdown: {
      accountsInCents,
      goalsInCents,
      assetsInCents,
      invoicesInCents,
      liabilitiesInCents,
    },
  };
}
