import { prisma } from '@repo/db/client';
import {
  addDays,
  addMonths,
  expenseByCategory,
  monthlyResult,
  netWorth,
  periodOf,
  resultSeries,
} from '@repo/shared';

import { todayInLisbon } from '@/lib/today';

import { TRANSACTION_SELECT } from './accounts';
import { toFinanceAccount, toFinanceCategory, toFinanceTransaction } from './mapping';
import { requireUser } from './session';

/**
 * Dados do painel.
 *
 * Uma consulta só, e todos os números calculados pelo **mesmo** motor que o
 * resto da aplicação usa. Se o painel fizesse as suas próprias somas, os totais
 * acabariam por divergir do extrato — e é isso que faz perder a confiança numa
 * aplicação de finanças.
 */

export interface DashboardData {
  readonly patrimonyInCents: number;
  readonly cash: {
    readonly incomeInCents: number;
    readonly expenseInCents: number;
    readonly netInCents: number;
  };
  readonly accrual: {
    readonly incomeInCents: number;
    readonly expenseInCents: number;
    readonly netInCents: number;
  };
  readonly series: ReadonlyArray<{
    readonly key: string;
    readonly incomeInCents: number;
    readonly expenseInCents: number;
  }>;
  readonly expensesByCategory: ReadonlyArray<{
    readonly categoryId: string;
    readonly name: string;
    readonly amountInCents: number;
  }>;
  readonly upcoming: ReadonlyArray<{
    readonly id: string;
    readonly date: string;
    readonly description: string;
    readonly amountInCents: number;
    readonly categoryName: string | null;
  }>;
  readonly lastTransactionDate: string | null;
  readonly hasData: boolean;
}

/** Reúne tudo o que o painel mostra, num único passo. */
export async function getDashboard(): Promise<DashboardData> {
  const user = await requireUser();
  const today = todayInLisbon();
  const period = periodOf(today, user.monthStartDay);

  const [accounts, transactions, categories, lastTransaction] = await Promise.all([
    prisma.financialAccount.findMany({ where: { userId: user.id } }),
    prisma.transaction.findMany({ where: { userId: user.id }, select: TRANSACTION_SELECT }),
    prisma.category.findMany({
      where: { userId: user.id, archivedAt: null },
      select: { id: true, name: true, kind: true, parentId: true, isInternal: true },
    }),
    prisma.transaction.findFirst({
      where: { userId: user.id },
      orderBy: { date: 'desc' },
      select: { date: true },
    }),
  ]);

  const financeAccounts = accounts.map(toFinanceAccount);
  const financeTransactions = transactions.map(toFinanceTransaction);
  const financeCategories = categories.map(toFinanceCategory);
  const options = { categories: financeCategories, monthStartDay: user.monthStartDay };

  const cash = monthlyResult(financeTransactions, period, { ...options, basis: 'cash' });
  const accrual = monthlyResult(financeTransactions, period, { ...options, basis: 'accrual' });
  const patrimony = netWorth({
    accounts: financeAccounts,
    transactions: financeTransactions,
    upTo: today,
  });
  const series = resultSeries(financeTransactions, addMonths(period.start, -5), today, {
    ...options,
    basis: user.accountingBasis,
  });
  const expenses = expenseByCategory(financeTransactions, period, {
    ...options,
    basis: 'accrual',
  });

  const nameById = new Map(categories.map((category) => [category.id, category.name]));

  const expensesByCategory = [...expenses.entries()]
    .map(([categoryId, amountInCents]) => ({
      categoryId,
      name: nameById.get(categoryId) ?? 'Sem categoria',
      amountInCents,
    }))
    .sort((a, b) => b.amountInCents - a.amountInCents);

  const upcoming = financeTransactions
    .filter((transaction) => !transaction.settled && transaction.date >= today)
    .filter((transaction) => transaction.date <= addDays(today, 7))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(0, 5)
    .map((transaction) => ({
      id: transaction.id,
      date: transaction.date,
      description: transaction.description ?? 'Sem descrição',
      amountInCents: transaction.amountInCents,
      categoryName:
        transaction.categoryId !== undefined
          ? (nameById.get(transaction.categoryId) ?? null)
          : null,
    }));

  return {
    patrimonyInCents: patrimony.netInCents,
    cash: {
      incomeInCents: cash.incomeInCents,
      expenseInCents: cash.expenseInCents,
      netInCents: cash.netInCents,
    },
    accrual: {
      incomeInCents: accrual.incomeInCents,
      expenseInCents: accrual.expenseInCents,
      netInCents: accrual.netInCents,
    },
    series: series.map((item) => ({
      key: item.period.key,
      incomeInCents: item.incomeInCents,
      expenseInCents: item.expenseInCents,
    })),
    expensesByCategory,
    upcoming,
    lastTransactionDate: lastTransaction?.date.toISOString().slice(0, 10) ?? null,
    hasData: transactions.length > 0,
  };
}
