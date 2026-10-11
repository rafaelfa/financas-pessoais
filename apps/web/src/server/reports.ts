import { prisma } from '@repo/db/client';
import {
  expenseByCategory,
  monthlyResult,
  periodRange,
  previousPeriod,
  resultSeries,
  type AccountingBasis,
  type FinancePeriod,
} from '@repo/shared';

import { todayInLisbon } from '@/lib/today';

import { TRANSACTION_SELECT } from './accounts';
import { toFinanceCategory, toFinanceTransaction } from './mapping';
import { requireUser } from './session';

/**
 * Relatórios.
 *
 * O gate G6 desta fase é uma frase: **o painel, o orçamento e os relatórios têm
 * de dar os mesmos números para o mesmo período e o mesmo regime.** Por isso este
 * ficheiro não soma nada à mão — chama o motor (`monthlyResult`,
 * `expenseByCategory`, `resultSeries`) com o período e o regime pedidos. Uma soma
 * paralela aqui seria a forma mais rápida de o ecrã discordar do painel.
 *
 * Os dois regimes medem coisas diferentes e ambos estão certos:
 * - **caixa**: o dinheiro moveu-se (só o liquidado);
 * - **competência**: o dinheiro foi gasto, mesmo sem estar pago.
 */

export type ReportBasis = 'cash' | 'accrual';

export interface PeriodOption {
  readonly key: string;
  readonly start: string;
  readonly end: string;
  readonly label: string;
}

export interface ReportCategoryLine {
  readonly categoryId: string;
  readonly categoryName: string;
  readonly kind: 'expense' | 'income';
  readonly amountInCents: number;
  readonly sharePct: number;
  readonly transactionCount: number;
}

export interface ReportMonthLine {
  readonly key: string;
  readonly label: string;
  readonly incomeInCents: number;
  readonly expenseInCents: number;
  readonly netInCents: number;
}

export interface ReportView {
  readonly key: string;
  readonly start: string;
  readonly end: string;
  readonly label: string;
  readonly basis: ReportBasis;
  readonly incomeInCents: number;
  readonly expenseInCents: number;
  readonly netInCents: number;
  readonly transactionCount: number;
  readonly averageDailyExpenseInCents: number;
  readonly byCategory: readonly ReportCategoryLine[];
  readonly byMonth: readonly ReportMonthLine[];
}

export interface ReportDelta {
  readonly label: string;
  readonly currentInCents: number;
  readonly previousInCents: number;
  readonly changeInCents: number;
  readonly changePct: number | null;
}

export interface ReportComparison {
  readonly current: ReportView;
  readonly previous: ReportView;
  readonly deltas: readonly ReportDelta[];
  readonly topGrowth: readonly {
    categoryName: string;
    changeInCents: number;
    changePct: number | null;
  }[];
  readonly topDrop: readonly {
    categoryName: string;
    changeInCents: number;
    changePct: number | null;
  }[];
}

const MONTH_NAMES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const;

/** "Outubro 2026", a partir do primeiro dia do período. */
function labelFor(period: FinancePeriod): string {
  const [year, month] = period.start.split('-');
  const index = Number(month) - 1;
  const fallback = month ?? '';
  const name = MONTH_NAMES[index] ?? fallback;

  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year ?? ''}`.trim();
}

function toPeriodOption(period: FinancePeriod): PeriodOption {
  return { key: period.key, start: period.start, end: period.end, label: labelFor(period) };
}

/** Percentagem com uma casa decimal; zero quando não há total. */
function sharePct(part: number, total: number): number {
  return total <= 0 ? 0 : Math.round((part / total) * 1000) / 10;
}

/** Variação percentual, ou `null` quando não há base de comparação. */
function changePct(current: number, previous: number): number | null {
  if (previous === 0) {
    return null;
  }

  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

/** Os últimos meses disponíveis, do mais recente para o mais antigo. */
export async function listPeriods(months = 12): Promise<PeriodOption[]> {
  const user = await requireUser();
  const today = todayInLisbon();
  const from = `${today.slice(0, 4)}-01-01`;
  const periods = periodRange(from, today, user.monthStartDay);

  return periods
    .slice(-Math.max(1, months))
    .map(toPeriodOption)
    .reverse();
}

/** Contexto de leitura partilhado por todos os relatórios. */
async function loadContext() {
  const user = await requireUser();

  const [transactions, categories] = await Promise.all([
    prisma.transaction.findMany({ where: { userId: user.id }, select: TRANSACTION_SELECT }),
    prisma.category.findMany({ where: { userId: user.id } }),
  ]);

  return {
    user,
    today: todayInLisbon(),
    transactions,
    categories,
    financeTransactions: transactions.map(toFinanceTransaction),
    financeCategories: categories.map(toFinanceCategory),
  };
}

/** Resolve um período pelo identificador (`AAAA-MM`). */
function resolvePeriod(
  key: string | undefined,
  today: string,
  monthStartDay: number,
): FinancePeriod {
  const periods = periodRange(`${today.slice(0, 4)}-01-01`, today, monthStartDay);
  const current = periods[periods.length - 1];

  if (key === undefined || current === undefined) {
    return current ?? periodRange(today, today, monthStartDay)[0]!;
  }

  return periods.find((period) => period.key === key) ?? current;
}

/** Relatório de um período, num dos dois regimes. */
export async function getReport(args: {
  readonly periodKey?: string;
  readonly basis?: ReportBasis;
}): Promise<ReportView> {
  const context = await loadContext();
  const basis: ReportBasis = args.basis === 'cash' ? 'cash' : 'accrual';
  const period = resolvePeriod(args.periodKey, context.today, context.user.monthStartDay);

  return buildReport({ context, period, basis });
}

/** Relatório de um mês, com a lista de despesas por categoria. */
function buildReport(args: {
  readonly context: Awaited<ReturnType<typeof loadContext>>;
  readonly period: FinancePeriod;
  readonly basis: ReportBasis;
}): ReportView {
  const { context, period, basis } = args;
  const resultOptions = {
    basis: basis as AccountingBasis,
    categories: context.financeCategories,
    monthStartDay: context.user.monthStartDay,
  };

  const result = monthlyResult(context.financeTransactions, period, resultOptions);
  const totals = expenseByCategory(context.financeTransactions, period, resultOptions);
  const nameById = new Map(context.categories.map((category) => [category.id, category.name]));

  const countByCategory = new Map<string, number>();

  for (const transaction of context.transactions) {
    if (
      transaction.categoryId !== null &&
      transaction.kind === 'EXPENSE' &&
      transaction.date.toISOString().slice(0, 10) >= period.start &&
      transaction.date.toISOString().slice(0, 10) <= period.end
    ) {
      countByCategory.set(
        transaction.categoryId,
        (countByCategory.get(transaction.categoryId) ?? 0) + 1,
      );
    }
  }

  const byCategory: ReportCategoryLine[] = [...totals.entries()]
    .map(([categoryId, amountInCents]) => ({
      categoryId,
      categoryName: nameById.get(categoryId) ?? 'Sem categoria',
      kind: 'expense' as const,
      amountInCents,
      sharePct: sharePct(amountInCents, result.expenseInCents),
      transactionCount: countByCategory.get(categoryId) ?? 0,
    }))
    .sort((a, b) => b.amountInCents - a.amountInCents);

  // A evolução mensal usa o mesmo motor, com os mesmos parâmetros: o gráfico e o
  // resumo não podem discordar.
  const byMonth: ReportMonthLine[] = resultSeries(
    context.financeTransactions,
    period.start,
    period.end,
    resultOptions,
  ).map((month) => ({
    key: month.period.key,
    label: labelFor(month.period),
    incomeInCents: month.incomeInCents,
    expenseInCents: month.expenseInCents,
    netInCents: month.netInCents,
  }));

  const days = Math.max(
    1,
    Math.round(
      (new Date(`${period.end}T00:00:00.000Z`).getTime() -
        new Date(`${period.start}T00:00:00.000Z`).getTime()) /
        86_400_000,
    ) + 1,
  );

  return {
    key: period.key,
    start: period.start,
    end: period.end,
    label: labelFor(period),
    basis,
    incomeInCents: result.incomeInCents,
    expenseInCents: result.expenseInCents,
    netInCents: result.netInCents,
    transactionCount: context.transactions.filter((transaction) => {
      const date = transaction.date.toISOString().slice(0, 10);

      return date >= period.start && date <= period.end && transaction.kind !== 'TRANSFER';
    }).length,
    averageDailyExpenseInCents: Math.round(result.expenseInCents / days),
    byCategory,
    byMonth,
  };
}

/** Comparação com o mês anterior, incluindo o que mais subiu e o que mais desceu. */
export async function comparePeriods(args: {
  readonly periodKey?: string;
  readonly basis?: ReportBasis;
}): Promise<ReportComparison> {
  const context = await loadContext();
  const basis: ReportBasis = args.basis === 'cash' ? 'cash' : 'accrual';
  const period = resolvePeriod(args.periodKey, context.today, context.user.monthStartDay);
  const previous = previousPeriod(period, context.user.monthStartDay);

  const current = buildReport({ context, period, basis });
  const before = buildReport({ context, period: previous, basis });

  const deltas: ReportDelta[] = [
    { label: 'Entradas', current: current.incomeInCents, previous: before.incomeInCents },
    { label: 'Saídas', current: current.expenseInCents, previous: before.expenseInCents },
    { label: 'Resultado', current: current.netInCents, previous: before.netInCents },
  ].map((line) => ({
    label: line.label,
    currentInCents: line.current,
    previousInCents: line.previous,
    changeInCents: line.current - line.previous,
    changePct: changePct(line.current, line.previous),
  }));

  const beforeByCategory = new Map(
    before.byCategory.map((line) => [line.categoryId, line.amountInCents]),
  );
  const movements = current.byCategory
    .map((line) => {
      const previousAmount = beforeByCategory.get(line.categoryId) ?? 0;

      return {
        categoryName: line.categoryName,
        changeInCents: line.amountInCents - previousAmount,
        changePct: changePct(line.amountInCents, previousAmount),
      };
    })
    .filter((line) => line.changeInCents !== 0);

  const topGrowth = movements
    .filter((line) => line.changeInCents > 0)
    .sort((a, b) => b.changeInCents - a.changeInCents)
    .slice(0, 3);

  const topDrop = movements
    .filter((line) => line.changeInCents < 0)
    .sort((a, b) => a.changeInCents - b.changeInCents)
    .slice(0, 3);

  return { current, previous: before, deltas, topGrowth, topDrop };
}
