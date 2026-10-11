import { prisma } from '@repo/db/client';
import {
  budgetStatusList,
  budgetSummary,
  categoriesWithoutLimit,
  type BudgetState,
} from '@repo/shared';

import { todayInLisbon } from '@/lib/today';

import { currentPeriod, monthPeriodFor } from './budget-period';
import { TRANSACTION_SELECT } from './accounts';
import { toFinanceCategory, toFinanceTransaction } from './mapping';
import { requireUser } from './session';

/**
 * Orçamento do mês.
 *
 * O consumo é medido pelo motor, em regime de **competência**: o dinheiro conta
 * como gasto quando se gasta, não quando a fatura do cartão é paga. Com o regime
 * de caixa, quem paga tudo com cartão veria 0 % de consumo — e o orçamento
 * diria uma coisa e o painel outra.
 *
 * `spentInCents` é o consumo das categorias **com limite** (é o que o motor soma
 * nos estados dos limites). O total de despesas do período vai em
 * `spentAllInCents`, para o cabeçalho poder comparar o mês inteiro com o total
 * do orçamento sem mentir.
 */

export interface BudgetLimitView {
  readonly id: string;
  readonly categoryId: string;
  readonly categoryName: string;
  readonly amountInCents: number;
  readonly spentInCents: number;
  readonly remainingInCents: number;
  readonly usedPct: number;
  readonly state: BudgetState;
  readonly projectedSpentInCents: number;
  readonly alertThresholdPct: number | null;
  readonly alertsEnabled: boolean;
}

export interface BudgetView {
  readonly id: string;
  readonly name: string;
  readonly scope: 'single_month' | 'monthly_default';
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly totalAmountInCents: number;
  readonly limits: readonly BudgetLimitView[];
  readonly withoutLimit: readonly {
    categoryId: string;
    categoryName: string;
    /** Gasto do período nesta categoria (inclui subcategorias). */
    spentInCents: number;
  }[];
  readonly spentInCents: number;
  readonly spentAllInCents: number;
  readonly allocatedInCents: number;
  readonly remainingInCents: number;
  readonly projectedInCents: number;
  readonly usedPct: number;
  readonly state: BudgetState;
  readonly overBudgetCategories: number;
  readonly warningCategories: number;
  readonly alertsEnabled: boolean;
}

/** Percentagem de consumo de um total, arredondada e sem estourar no zero. */
function usedPctFor(spentInCents: number, totalInCents: number): number {
  return totalInCents <= 0 ? 0 : Math.round((spentInCents / totalInCents) * 100);
}

function stateFor(usedPct: number): BudgetState {
  if (usedPct >= 100) {
    return 'exceeded';
  }

  return usedPct >= 70 ? 'warning' : 'safe';
}

/** Orçamentos do utilizador, com o consumo do período em curso já calculado. */
export async function listBudgets(): Promise<BudgetView[]> {
  const user = await requireUser();
  const today = todayInLisbon();

  const [budgets, categories, transactions] = await Promise.all([
    prisma.budget.findMany({
      where: { userId: user.id },
      orderBy: [{ periodStart: 'desc' }, { name: 'asc' }],
      include: { limits: { orderBy: { amountInCents: 'desc' } } },
    }),
    prisma.category.findMany({
      where: { userId: user.id, archivedAt: null },
      orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    }),
    prisma.transaction.findMany({ where: { userId: user.id }, select: TRANSACTION_SELECT }),
  ]);

  const financeTransactions = transactions.map(toFinanceTransaction);
  const financeCategories = categories.map(toFinanceCategory);
  const nameById = new Map(categories.map((category) => [category.id, category.name]));

  return budgets.map((budget) => {
    const scope = budget.scope === 'MONTHLY_DEFAULT' ? 'monthly_default' : 'single_month';
    const period =
      scope === 'monthly_default'
        ? monthPeriodFor({ user, today })
        : currentPeriod({
            scope,
            periodStart: budget.periodStart.toISOString().slice(0, 10),
            user,
            today,
          });

    const financeLimits = budget.limits.map((limit) => ({
      id: limit.id,
      categoryId: limit.categoryId,
      amountInCents: limit.amountInCents,
      alertThresholdPct: limit.alertThresholdPct ?? undefined,
      alertsEnabled: limit.alertsEnabled,
    }));

    const statuses = budgetStatusList({
      limits: financeLimits,
      transactions: financeTransactions,
      period,
      referenceDate: today,
    });

    const statusById = new Map(statuses.map((status) => [status.categoryId, status]));

    const limits: BudgetLimitView[] = budget.limits.map((limit) => {
      const status = statusById.get(limit.categoryId);
      const spentInCents = status?.spentInCents ?? 0;

      return {
        id: limit.id,
        categoryId: limit.categoryId,
        categoryName: nameById.get(limit.categoryId) ?? 'Categoria',
        amountInCents: limit.amountInCents,
        spentInCents,
        remainingInCents: limit.amountInCents - spentInCents,
        usedPct: usedPctFor(spentInCents, limit.amountInCents),
        state: status?.state ?? stateFor(usedPctFor(spentInCents, limit.amountInCents)),
        projectedSpentInCents: status?.projectedSpentInCents ?? spentInCents,
        alertThresholdPct: limit.alertThresholdPct,
        alertsEnabled: limit.alertsEnabled,
      };
    });

    const summary = budgetSummary({
      statuses,
      totalInCents: budget.totalAmountInCents,
      period,
      referenceDate: today,
    });

    /*
     * Total de despesas do período, para o cabeçalho. Exclui transferências e
     * operações internas (pagamento de fatura, ajustes): nenhuma delas é consumo,
     * e incluí-las faria o orçamento parecer estourado sem ninguém ter gasto.
     */
    const spentAllInCents = financeTransactions
      .filter(
        (transaction) =>
          transaction.date >= period.start &&
          transaction.date <= period.end &&
          transaction.status !== 'ignored' &&
          transaction.kind === 'expense',
      )
      .reduce((total, transaction) => total + Math.abs(transaction.amountInCents), 0);

    /*
     * Categorias sem limite, com o gasto do mês. Sem o valor, a lista não serve
     * para decidir onde apertar. O consumo vem do mesmo motor (inclui
     * subcategorias); o limite é simbólico porque só se lê o gasto dele.
     */
    const noLimit = categoriesWithoutLimit(financeCategories, financeLimits);
    const noLimitStatuses = budgetStatusList({
      limits: noLimit.map((category) => ({
        id: category.id,
        categoryId: category.id,
        amountInCents: 1,
        alertsEnabled: false,
      })),
      transactions: financeTransactions,
      period,
      referenceDate: today,
    });
    const noLimitSpent = new Map(
      noLimitStatuses.map((status) => [status.categoryId, status.spentInCents]),
    );

    return {
      id: budget.id,
      name: budget.name,
      scope,
      periodStart: period.start,
      periodEnd: period.end,
      totalAmountInCents: budget.totalAmountInCents,
      limits,
      withoutLimit: noLimit.map((category) => ({
        categoryId: category.id,
        categoryName: nameById.get(category.id) ?? 'Categoria',
        spentInCents: noLimitSpent.get(category.id) ?? 0,
      })),
      spentInCents: summary.spentInCents,
      spentAllInCents,
      allocatedInCents: summary.allocatedInCents,
      remainingInCents: summary.remainingInCents,
      projectedInCents: summary.projectedSpentInCents,
      usedPct: usedPctFor(summary.spentInCents, budget.totalAmountInCents),
      state: stateFor(usedPctFor(summary.spentInCents, budget.totalAmountInCents)),
      overBudgetCategories: summary.overBudgetCategories,
      warningCategories: summary.warningCategories,
      alertsEnabled: budget.alertsEnabled,
    };
  });
}

/** Um orçamento pelo identificador, já calculado. */
export async function getBudget(budgetId: string): Promise<BudgetView | null> {
  const budgets = await listBudgets();

  return budgets.find((budget) => budget.id === budgetId) ?? null;
}
