import { balanceByAccount } from './balance';
import { invoiceTotals } from './invoice';
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
  const invoicesInCents = (args.invoices ?? []).reduce(
    (total, invoice) =>
      total +
      invoiceTotals({
        invoice,
        transactions: args.transactions,
        payments: args.invoicePayments ?? [],
        today: referenceDate,
      }).outstandingInCents,
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
