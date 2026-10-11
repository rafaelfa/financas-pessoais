import { prisma } from '@repo/db/client';
import {
  addDays,
  addMonths,
  cashFlowForecast,
  expenseByCategory,
  monthlyResult,
  netWorth,
  periodOf,
  resultSeries,
  toRecurrenceFrequency,
} from '@repo/shared';

import { todayInLisbon } from '@/lib/today';

import { TRANSACTION_SELECT } from './accounts';
import { loadInvoiceContext } from './invoice-context';
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
  /**
   * Previsão de saldo para os próximos 45 dias.
   *
   * Inclui os **itens** de cada dia (recorrências e faturas), para a interface
   * poder dizer *o que* muda o saldo — «Renda · −800,00 €» — e não apenas quanto.
   * `firstNegativeDate` é a data em que fica negativo, que pode não ser a do
   * ponto mais baixo: o que interessa avisar é o primeiro dia em que não há
   * dinheiro suficiente, não o pior dia.
   */
  readonly forecast: {
    readonly days: ReadonlyArray<{
      readonly date: string;
      readonly balanceInCents: number;
      readonly items: ReadonlyArray<{ label: string; amountInCents: number }>;
    }>;
    readonly lowestBalanceInCents: number;
    readonly lowestDate: string | null;
    readonly goesNegative: boolean;
    readonly firstNegativeDate: string | null;
  };
}

/** Reúne tudo o que o painel mostra, num único passo. */
export async function getDashboard(): Promise<DashboardData> {
  const user = await requireUser();
  const today = todayInLisbon();
  const period = periodOf(today, user.monthStartDay);

  const [accounts, transactions, categories, lastTransaction, recurrences, invoiceContext] =
    await Promise.all([
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
      prisma.recurrence.findMany({ where: { userId: user.id, isActive: true } }),
      loadInvoiceContext(user.id, today),
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

  /*
   * Previsão de saldo: o painel mostrava o presente e não avisava do futuro.
   * Entra só o que já está contratado — as ocorrências futuras das recorrências
   * ativas (pelas mesmas datas que o gerador vai usar) e as faturas por pagar no
   * dia do vencimento. Gastos variáveis não se preveem.
   */
  const forecast = cashFlowForecast({
    accounts: financeAccounts,
    transactions: financeTransactions,
    recurrences: recurrences.map((recurrence) => ({
      id: recurrence.id,
      name: recurrence.name,
      kind: recurrence.kind === 'INCOME' ? ('income' as const) : ('expense' as const),
      amountInCents: recurrence.amountInCents,
      // A conversão vive no motor: uma frequência que ele não sabe cumprir falha
      // alto em vez de aparecer como mensal na previsão (12× as ocorrências).
      frequency: toRecurrenceFrequency(recurrence.frequency),
      interval: recurrence.interval,
      dayOfMonth: recurrence.dayOfMonth ?? undefined,
      nextRunDate: recurrence.nextRunDate.toISOString().slice(0, 10),
      endDate:
        recurrence.endDate === null ? undefined : recurrence.endDate.toISOString().slice(0, 10),
      isActive: recurrence.isActive,
    })),
    unpaidInvoices: invoiceContext.summaries
      .filter((invoice) => invoice.outstandingInCents > 0)
      .map((invoice) => ({
        id: invoice.id,
        cardName: invoice.cardName,
        dueDate: invoice.dueDate,
        outstandingInCents: invoice.outstandingInCents,
      })),
    from: today,
    days: 45,
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
    forecast: {
      days: forecast.days.map((day) => ({
        date: day.date,
        balanceInCents: day.balanceInCents,
        items: day.items.map((item) => ({
          label: item.label,
          amountInCents: item.amountInCents,
        })),
      })),
      lowestBalanceInCents: forecast.lowestBalanceInCents,
      lowestDate: forecast.lowestDate,
      goesNegative: forecast.goesNegative,
      firstNegativeDate: forecast.firstNegativeDate,
    },
    lastTransactionDate: lastTransaction?.date.toISOString().slice(0, 10) ?? null,
    hasData: transactions.length > 0,
  };
}
