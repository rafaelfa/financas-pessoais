import { daysBetween } from './period';
import { expenseByCategory, type ResultOptions } from './result';
import type {
  FinanceBudgetLimit,
  FinanceCategory,
  FinancePeriod,
  FinanceTransaction,
} from './types';

/**
 * Orçamento mensal por categoria.
 *
 * O sistema de referência distribui um valor total por categorias, deixa definir
 * um limiar de alerta (o exemplo oficial é 80%) e acompanha o consumo "em tempo
 * real". Não documenta, porém, se o consumo é medido por caixa ou por
 * competência, nem o que acontece ao passar dos 100% (documento 01, §5.3).
 *
 * Decisões nossas, explícitas e testáveis:
 * - o regime é escolhido pelo chamador e é o **mesmo** do resultado mensal, para
 *   que o orçamento e o painel nunca discordem;
 * - o consumo por omissão é por **competência** (o dinheiro considera-se gasto
 *   quando se gasta), mas pode ser por caixa;
 * - há **três** estados: seguro abaixo de 70%, atenção entre 70% e 100%,
 *   excedido a partir de 100%;
 * - a projeção de fim de período assume o ritmo observado até à data de
 *   referência — é uma estimativa, e é apresentada como tal.
 */

/** Estado de consumo de um limite de orçamento. */
export type BudgetState = 'safe' | 'warning' | 'exceeded';

/** Fronteira, em percentagem, entre "seguro" e "atenção". */
export const BUDGET_WARNING_PCT = 70;

/** Fronteira, em percentagem, a partir da qual o orçamento está excedido. */
export const BUDGET_EXCEEDED_PCT = 100;

export interface BudgetStatus {
  readonly categoryId: string;
  readonly limitInCents: number;
  readonly spentInCents: number;
  /** Pode ser negativo quando o limite foi excedido. */
  readonly remainingInCents: number;
  /** Percentagem consumida, arredondada a uma casa decimal. */
  readonly usedPct: number;
  readonly state: BudgetState;
  /** Projeção de consumo até ao fim do período, ao ritmo observado. */
  readonly projectedSpentInCents: number;
  /** `true` quando a percentagem atingiu o limiar de alerta configurado. */
  readonly alertTriggered: boolean;
}

/** Percentagem consumida, arredondada a uma casa decimal. */
export function budgetUsedPct(spentInCents: number, limitInCents: number): number {
  if (limitInCents <= 0) {
    return spentInCents > 0 ? BUDGET_EXCEEDED_PCT : 0;
  }

  return Math.round((spentInCents / limitInCents) * 1000) / 10;
}

/** Estado correspondente a uma percentagem consumida. */
export function budgetStateFor(usedPct: number): BudgetState {
  if (usedPct >= BUDGET_EXCEEDED_PCT) {
    return 'exceeded';
  }

  return usedPct >= BUDGET_WARNING_PCT ? 'warning' : 'safe';
}

/**
 * Projeção de consumo até ao fim do período.
 *
 * `elapsedFraction` é a fração do período já decorrida (0 a 1). Com menos de um
 * dia decorrido não se projeta nada — extrapolar de um único dia produziria
 * números absurdos.
 */
export function projectedSpentInCents(args: {
  readonly spentInCents: number;
  readonly period: FinancePeriod;
  readonly referenceDate: string;
}): number {
  const totalDays = daysBetween(args.period.start, args.period.end);
  const elapsedDays = Math.min(
    Math.max(daysBetween(args.period.start, args.referenceDate), 0),
    totalDays,
  );

  if (totalDays <= 0 || elapsedDays < 1) {
    return args.spentInCents;
  }

  const averagePerDay = args.spentInCents / elapsedDays;

  return Math.round(averagePerDay * totalDays);
}

/**
 * Consumo de um limite, somando a própria categoria e as suas subcategorias.
 *
 * Os limites são definidos na categoria-mãe (é a decisão do esquema Prisma), por
 * isso um gasto lançado em "Alimentação → Supermercado" tem de contar para o
 * limite de "Alimentação". Sem esta soma, quem usa subcategorias veria sempre
 * 0% de consumo.
 */
function spentForLimit(args: {
  readonly categoryId: string;
  readonly transactions: readonly FinanceTransaction[];
  readonly period: FinancePeriod;
  readonly options: ResultOptions;
}): number {
  const totals = expenseByCategory(args.transactions, args.period, args.options);
  const childIds = new Set(
    (args.options.categories ?? [])
      .filter((category) => category.parentId === args.categoryId)
      .map((category) => category.id),
  );

  let spent = 0;

  for (const [categoryId, amount] of totals) {
    if (categoryId === args.categoryId || childIds.has(categoryId)) {
      spent += amount;
    }
  }

  return spent;
}

/** Consumo de um limite de orçamento num período. */
export function budgetStatus(args: {
  readonly limit: FinanceBudgetLimit;
  readonly transactions: readonly FinanceTransaction[];
  readonly period: FinancePeriod;
  /** Data usada para a projeção; por omissão, o fim do período (sem projeção). */
  readonly referenceDate?: string;
  readonly resultOptions?: ResultOptions;
}): BudgetStatus {
  const options: ResultOptions = args.resultOptions ?? {};
  const spentInCents = spentForLimit({
    categoryId: args.limit.categoryId,
    transactions: args.transactions,
    period: args.period,
    options,
  });
  const usedPct = budgetUsedPct(spentInCents, args.limit.amountInCents);
  const threshold = args.limit.alertThresholdPct ?? 80;

  return {
    categoryId: args.limit.categoryId,
    limitInCents: args.limit.amountInCents,
    spentInCents,
    remainingInCents: args.limit.amountInCents - spentInCents,
    usedPct,
    state: budgetStateFor(usedPct),
    projectedSpentInCents:
      args.referenceDate === undefined
        ? spentInCents
        : projectedSpentInCents({
            spentInCents,
            period: args.period,
            referenceDate: args.referenceDate,
          }),
    alertTriggered: args.limit.alertsEnabled !== false && usedPct >= threshold,
  };
}

/** Consumo de todos os limites de um orçamento. */
export function budgetStatusList(args: {
  readonly limits: readonly FinanceBudgetLimit[];
  readonly transactions: readonly FinanceTransaction[];
  readonly period: FinancePeriod;
  readonly referenceDate?: string;
  readonly resultOptions?: ResultOptions;
}): BudgetStatus[] {
  return args.limits.map((limit) =>
    budgetStatus({
      limit,
      transactions: args.transactions,
      period: args.period,
      referenceDate: args.referenceDate,
      resultOptions: args.resultOptions,
    }),
  );
}

/**
 * Soma dos limites e do consumo, para o cabeçalho do orçamento.
 * Distingue o que está distribuído por categorias do total definido pelo
 * utilizador, porque o original permite um total diferente da soma das partes.
 */
export function budgetSummary(args: {
  readonly statuses: readonly BudgetStatus[];
  readonly totalInCents?: number;
  readonly period: FinancePeriod;
  readonly referenceDate?: string;
}): {
  readonly totalInCents: number;
  readonly allocatedInCents: number;
  readonly spentInCents: number;
  readonly remainingInCents: number;
  readonly projectedSpentInCents: number;
  readonly overBudgetCategories: number;
  readonly warningCategories: number;
} {
  const allocatedInCents = args.statuses.reduce((total, status) => total + status.limitInCents, 0);
  const spentInCents = args.statuses.reduce((total, status) => total + status.spentInCents, 0);
  const totalInCents = args.totalInCents ?? allocatedInCents;

  return {
    totalInCents,
    allocatedInCents,
    spentInCents,
    remainingInCents: totalInCents - spentInCents,
    projectedSpentInCents: args.statuses.reduce(
      (total, status) => total + status.projectedSpentInCents,
      0,
    ),
    overBudgetCategories: args.statuses.filter((status) => status.state === 'exceeded').length,
    warningCategories: args.statuses.filter((status) => status.state === 'warning').length,
  };
}

/** Categorias sem limite definido, para sugerir o que falta orçamentar. */
export function categoriesWithoutLimit(
  categories: readonly FinanceCategory[],
  limits: readonly FinanceBudgetLimit[],
): FinanceCategory[] {
  const withLimit = new Set(limits.map((limit) => limit.categoryId));

  return categories.filter(
    (category) => category.kind === 'expense' && !category.internal && !withLimit.has(category.id),
  );
}
