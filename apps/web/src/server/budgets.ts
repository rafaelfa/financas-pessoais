import { prisma } from '@repo/db/client';
import {
  budgetPeriodFor,
  budgetStatusList,
  budgetSummary,
  categoriesWithoutLimit,
  type BudgetState,
} from '@repo/shared';

import { todayInLisbon } from '@/lib/today';

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
  /**
   * Âmbito do orçamento. Existe no view para a interface não ter de adivinhar:
   * um orçamento mensal padrão guarda uma data sentinela, e uma heurística sobre
   * essa data acabaria por mostrar 1970 em algum ecrã.
   */
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

/**
 * O estado do bloco é o **pior** das categorias com limite (T104/D37).
 *
 * Uma média que tranquiliza esconde a categoria que já passou do limiar: era o
 * que acontecia com «Tranquilo» ao lado de «Alimentação · Atenção 84 %».
 *
 * **Sem limites não há categorias para piorar** — e aí o estado vem do consumo
 * do mês contra o total do orçamento, por `stateFor`. Este ramo existe porque a
 * primeira versão da T104 devolvia `safe` sempre que `limits` estava vazio, e um
 * orçamento de 1 200 € com 1 300 € gastos dizia «0 % · Tranquilo».
 */
function worstState(limits: readonly BudgetLimitView[]): BudgetState {
  if (limits.some((limit) => limit.state === 'exceeded')) {
    return 'exceeded';
  }

  if (limits.some((limit) => limit.state === 'warning')) {
    return 'warning';
  }

  return 'safe';
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
    /*
     * O período é resolvido no domínio, pela mesma função que o fecho de mês usa:
     * um orçamento `single_month` pertence ao mês em que foi criado, um
     * `monthly_default` ao mês em curso. Duas cópias desta regra era a forma mais
     * rápida de o ecrã do orçamento e o assistente de fecho discordarem.
     */
    const period = budgetPeriodFor({
      budget: { scope, periodStart: budget.periodStart.toISOString().slice(0, 10) },
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
          transaction.date <= period.displayEnd &&
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

    /*
     * Sem limites de categoria, `summary.spentInCents` é 0 (é a soma dos status
     * das categorias com limite) e `allocatedInCents` também — medir contra eles
     * dava «0 % · Tranquilo» com o orçamento estourado. Nesse caso o consumo é o
     * **gasto do mês** (`spentAllInCents`) contra o total, que é sempre positivo.
     * Com limites, o caminho é o que o QA aprovou: 850 de 1 200 = 71 %.
     */
    const semLimites = limits.length === 0 || summary.allocatedInCents <= 0;
    const usadoPct = usedPctFor(
      semLimites ? spentAllInCents : summary.spentInCents,
      semLimites ? budget.totalAmountInCents : summary.allocatedInCents,
    );
    const estadoDoBloco = semLimites ? stateFor(usadoPct) : worstState(limits);

    return {
      id: budget.id,
      name: budget.name,
      scope,
      periodStart: period.start,
      periodEnd: period.displayEnd,
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
      /*
       * T104/D37: o consumo mede-se contra a **soma dos limites**, não contra o
       * total do orçamento — 129,35 de 310 é 42 %, e 129,35 de 1 500 é 9 % («e
       * está tudo tranquilo») com uma categoria a 84 %. O total continua a
       * aparecer, mas numa linha própria, ao lado do gasto do mês.
       */
      usedPct: usadoPct,
      state: estadoDoBloco,
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
