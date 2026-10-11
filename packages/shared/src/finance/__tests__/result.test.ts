import { describe, expect, it } from 'vitest';

import { periodOf } from '../period';
import { monthPeriodFor } from '../budget-period';
import {
  countsInResult,
  expenseByCategory,
  incomeByCategory,
  monthlyResult,
  resultOfDate,
  resultSeries,
  resultSeriesForPeriod,
} from '../result';
import type { FinanceCategory, FinanceTransaction } from '../types';

const FOOD: FinanceCategory = { id: 'cat-food', kind: 'expense' };
const SALARY: FinanceCategory = { id: 'cat-salary', kind: 'income' };
const TRANSFER: FinanceCategory = { id: 'cat-transfer', kind: 'expense', internal: true };
const CATEGORIES = [FOOD, SALARY, TRANSFER];

const OCTOBER = periodOf('2026-10-15');

function transaction(overrides: Partial<FinanceTransaction> & { id: string }): FinanceTransaction {
  return {
    kind: 'expense',
    status: 'confirmed',
    amountInCents: -1_000,
    date: '2026-10-05',
    accountId: 'acc',
    settled: true,
    ...overrides,
  };
}

const TRANSACTIONS: FinanceTransaction[] = [
  transaction({
    id: 'debit-food',
    amountInCents: -5_000,
    date: '2026-10-05',
    categoryId: FOOD.id,
  }),
  transaction({
    id: 'card-food',
    amountInCents: -12_000,
    date: '2026-10-08',
    categoryId: FOOD.id,
    invoiceId: 'inv-1',
    settled: true,
  }),
  transaction({
    id: 'invoice-payment',
    kind: 'invoice_payment',
    amountInCents: -12_000,
    date: '2026-11-05',
    categoryId: TRANSFER.id,
  }),
  transaction({
    id: 'salary',
    kind: 'income',
    amountInCents: 200_000,
    date: '2026-10-01',
    categoryId: SALARY.id,
  }),
  transaction({
    id: 'salary-pending',
    kind: 'income',
    amountInCents: 50_000,
    date: '2026-10-20',
    categoryId: SALARY.id,
    settled: false,
  }),
  transaction({
    id: 'transfer-out',
    kind: 'transfer',
    amountInCents: -30_000,
    categoryId: TRANSFER.id,
  }),
  transaction({ id: 'goal-deposit', kind: 'goal_deposit', amountInCents: -20_000 }),
  transaction({ id: 'adjust', kind: 'balance_adjust', amountInCents: 1_500 }),
  transaction({
    id: 'internal-expense',
    amountInCents: -1_000,
    categoryId: TRANSFER.id,
  }),
];

describe('resultado em visão de caixa', () => {
  const result = monthlyResult(TRANSACTIONS, OCTOBER, { basis: 'cash', categories: CATEGORIES });

  it('conta só o que foi recebido e pago', () => {
    expect(result.incomeInCents).toBe(200_000);
    expect(result.expenseInCents).toBe(5_000);
    expect(result.netInCents).toBe(195_000);
  });

  it('não conta o gasto do cartão antes de a fatura ser paga', () => {
    expect(
      countsInResult(
        TRANSACTIONS.find((t) => t.id === 'card-food') as FinanceTransaction,
        'cash',
        new Set(),
      ),
    ).toBe(false);
  });

  it('conta o pagamento da fatura como saída, no mês do pagamento', () => {
    const november = monthlyResult(TRANSACTIONS, periodOf('2026-11-15'), {
      basis: 'cash',
      categories: CATEGORIES,
    });

    expect(november.expenseInCents).toBe(12_000);
    expect(november.incomeInCents).toBe(0);
    expect(november.netInCents).toBe(-12_000);
  });

  it('nunca conta transferências, objetivos, ajustes nem categorias internas', () => {
    for (const id of ['transfer-out', 'goal-deposit', 'adjust', 'internal-expense']) {
      const found = TRANSACTIONS.find((t) => t.id === id) as FinanceTransaction;

      expect(countsInResult(found, 'cash', new Set([TRANSFER.id]))).toBe(false);
    }
  });

  it('ignora transações marcadas como ignoradas em qualquer regime', () => {
    const ignored = transaction({ id: 'x', status: 'ignored', categoryId: FOOD.id });

    expect(countsInResult(ignored, 'cash', new Set())).toBe(false);
    expect(countsInResult(ignored, 'accrual', new Set())).toBe(false);
  });
});

describe('resultado em visão de competência', () => {
  const result = monthlyResult(TRANSACTIONS, OCTOBER, {
    basis: 'accrual',
    categories: CATEGORIES,
  });

  it('conta o gasto do cartão na data da compra e o ganho ainda não recebido', () => {
    expect(result.incomeInCents).toBe(250_000);
    expect(result.expenseInCents).toBe(17_000);
    expect(result.netInCents).toBe(233_000);
  });

  it('trata o pagamento da fatura como neutro, porque só liquida um passivo', () => {
    const november = monthlyResult(TRANSACTIONS, periodOf('2026-11-15'), {
      basis: 'accrual',
      categories: CATEGORIES,
    });

    expect(november.incomeInCents).toBe(0);
    expect(november.expenseInCents).toBe(0);
    expect(november.netInCents).toBe(0);
  });
});

describe('resultado por data e em série', () => {
  it('resolve o período a partir de uma data', () => {
    const result = resultOfDate(TRANSACTIONS, '2026-10-31', { categories: CATEGORIES });

    expect(result.period.key).toBe('2026-10');
    expect(result.netInCents).toBe(195_000);
  });

  it('produz uma série por período, com os meses sem movimento a zero', () => {
    const series = resultSeries(TRANSACTIONS, '2026-10-01', '2026-12-31', {
      categories: CATEGORIES,
    });

    expect(series.map((item) => item.period.key)).toEqual(['2026-10', '2026-11', '2026-12']);
    expect(series.map((item) => item.netInCents)).toEqual([195_000, -12_000, 0]);
  });

  it('respeita o início de mês configurável', () => {
    const result = resultOfDate(TRANSACTIONS, '2026-10-24', {
      categories: CATEGORIES,
      monthStartDay: 25,
    });

    // O período com início a 25 vai de 25/09 a 25/10, por isso ainda inclui
    // os movimentos de outubro — é exatamente o que quem recebe a 25 espera.
    expect(result.period).toEqual({
      start: '2026-09-25',
      end: '2026-10-25',
      key: '2026-09',
    });
    expect(result.netInCents).toBe(195_000);

    // Já um movimento a 26/10 pertence ao período seguinte.
    const next = resultOfDate(
      [transaction({ id: 'late', amountInCents: -1_000, date: '2026-10-26', categoryId: FOOD.id })],
      '2026-10-26',
      { categories: CATEGORIES, monthStartDay: 25 },
    );

    expect(next.period.key).toBe('2026-10');
    expect(next.expenseInCents).toBe(1_000);
  });

  /**
   * A série de um período tem de ter exatamente os meses do período.
   *
   * `resultSeries` recebe as duas pontas **incluídas**; o `end` do motor é
   * **exclusivo**. Passá-lo tal e qual somava um mês inteiro: o relatório de
   * outubro mostrava uma barra de novembro (300,00 € de soma contra 220,00 € de
   * total), medido pela verificação adversarial das Fases 5 e 6.
   */
  it('a série de um período não soma o mês seguinte', () => {
    const period = periodOf('2026-10-15');
    const series = resultSeriesForPeriod(TRANSACTIONS, period, { categories: CATEGORIES });

    expect(period.end).toBe('2026-11-01');
    expect(series.map((item) => item.period.key)).toEqual(['2026-10']);
    expect(series[0]?.netInCents).toBe(195_000);
  });

  it('a série de um período com início ao dia 5 não soma o mês seguinte', () => {
    const period = monthPeriodFor({ user: { monthStartDay: 5 }, today: '2026-10-11' });
    const series = resultSeriesForPeriod(TRANSACTIONS, period, {
      categories: CATEGORIES,
      monthStartDay: 5,
    });

    expect(period.end).toBe('2026-11-05');
    expect(series.map((item) => item.period.key)).toEqual(['2026-10']);
  });
});

describe('totais por categoria', () => {
  it('agrega as saídas por categoria em visão de caixa', () => {
    const totals = expenseByCategory(TRANSACTIONS, OCTOBER, {
      basis: 'cash',
      categories: CATEGORIES,
    });

    expect(totals.get(FOOD.id)).toBe(5_000);
    expect(totals.size).toBe(1);
  });

  it('agrega as saídas por categoria em competência, incluindo o cartão', () => {
    const totals = expenseByCategory(TRANSACTIONS, OCTOBER, {
      basis: 'accrual',
      categories: CATEGORIES,
    });

    expect(totals.get(FOOD.id)).toBe(17_000);
  });

  it('agrega as entradas por categoria', () => {
    const totals = incomeByCategory(TRANSACTIONS, OCTOBER, {
      basis: 'cash',
      categories: CATEGORIES,
    });

    expect(totals.get(SALARY.id)).toBe(200_000);
  });
});
