import { describe, expect, it } from 'vitest';

import {
  BUDGET_EXCEEDED_PCT,
  BUDGET_WARNING_PCT,
  budgetStateFor,
  budgetStatus,
  budgetSummary,
  budgetUsedPct,
  categoriesWithoutLimit,
  projectedSpentInCents,
} from '../budget';
import { periodOf } from '../period';
import type { FinanceBudgetLimit, FinanceCategory, FinanceTransaction } from '../types';

const FOOD: FinanceCategory = { id: 'cat-food', kind: 'expense' };
const TRANSPORT: FinanceCategory = { id: 'cat-transport', kind: 'expense' };
const CATEGORIES = [FOOD, TRANSPORT];
const OCTOBER = periodOf('2026-10-15');

function expense(id: string, amountInCents: number, categoryId = FOOD.id): FinanceTransaction {
  return {
    id,
    kind: 'expense',
    status: 'confirmed',
    amountInCents: -amountInCents,
    date: '2026-10-05',
    accountId: 'acc',
    categoryId,
    settled: true,
  };
}

describe('percentagem e estados do orçamento', () => {
  it('calcula a percentagem consumida com uma casa decimal', () => {
    expect(budgetUsedPct(0, 60_000)).toBe(0);
    expect(budgetUsedPct(30_000, 60_000)).toBe(50);
    expect(budgetUsedPct(42_000, 60_000)).toBe(70);
    expect(budgetUsedPct(61_000, 60_000)).toBe(101.7);
  });

  it('classifica em três estados', () => {
    expect(budgetStateFor(0)).toBe('safe');
    expect(budgetStateFor(BUDGET_WARNING_PCT - 0.1)).toBe('safe');
    expect(budgetStateFor(BUDGET_WARNING_PCT)).toBe('warning');
    expect(budgetStateFor(99.9)).toBe('warning');
    expect(budgetStateFor(BUDGET_EXCEEDED_PCT)).toBe('exceeded');
    expect(budgetStateFor(150)).toBe('exceeded');
  });

  it('trata um limite de zero como excedido se houver gasto', () => {
    expect(budgetUsedPct(1_000, 0)).toBe(BUDGET_EXCEEDED_PCT);
    expect(budgetUsedPct(0, 0)).toBe(0);
  });
});

describe('consumo de um limite', () => {
  const limit: FinanceBudgetLimit = {
    categoryId: FOOD.id,
    amountInCents: 60_000,
    alertThresholdPct: 80,
    alertsEnabled: true,
  };
  const transactions = [expense('t1', 5_000), expense('t2', 12_000, FOOD.id)];

  it('soma o gasto da categoria e calcula o que resta', () => {
    const status = budgetStatus({
      limit,
      transactions,
      period: OCTOBER,
      resultOptions: { basis: 'accrual', categories: CATEGORIES },
    });

    expect(status.spentInCents).toBe(17_000);
    expect(status.remainingInCents).toBe(43_000);
    expect(status.usedPct).toBe(28.3);
    expect(status.state).toBe('safe');
    expect(status.alertTriggered).toBe(false);
  });

  it('dispara o alerta no limiar configurado', () => {
    const status = budgetStatus({
      limit,
      transactions: [expense('t1', 48_000)],
      period: OCTOBER,
      resultOptions: { categories: CATEGORIES },
    });

    expect(status.usedPct).toBe(80);
    expect(status.alertTriggered).toBe(true);
    expect(status.state).toBe('warning');
  });

  it('fica excedida a partir dos 100%', () => {
    const status = budgetStatus({
      limit,
      transactions: [expense('t1', 61_000)],
      period: OCTOBER,
      resultOptions: { categories: CATEGORIES },
    });

    expect(status.state).toBe('exceeded');
    expect(status.remainingInCents).toBe(-1_000);
  });

  it('não dispara alerta quando os alertas estão desligados', () => {
    const status = budgetStatus({
      limit: { ...limit, alertsEnabled: false },
      transactions: [expense('t1', 59_000)],
      period: OCTOBER,
      resultOptions: { categories: CATEGORIES },
    });

    expect(status.usedPct).toBeGreaterThan(80);
    expect(status.alertTriggered).toBe(false);
  });

  it('usa 80% como limiar por omissão', () => {
    const status = budgetStatus({
      limit: { categoryId: FOOD.id, amountInCents: 10_000 },
      transactions: [expense('t1', 8_000)],
      period: OCTOBER,
      resultOptions: { categories: CATEGORIES },
    });

    expect(status.alertTriggered).toBe(true);
  });
});

describe('projeção de fim de período', () => {
  it('extrapola o ritmo observado até ao fim do período', () => {
    const projected = projectedSpentInCents({
      spentInCents: 17_000,
      period: OCTOBER,
      referenceDate: '2026-10-11',
    });

    // 10 dias decorridos de 31: 1 700 cêntimos por dia × 31.
    expect(projected).toBe(52_700);
  });

  it('não projeta antes de haver um dia completo', () => {
    expect(
      projectedSpentInCents({
        spentInCents: 5_000,
        period: OCTOBER,
        referenceDate: '2026-10-01',
      }),
    ).toBe(5_000);
  });

  it('depois do fim do período a projeção é o valor real, sem extrapolar', () => {
    expect(
      projectedSpentInCents({
        spentInCents: 5_000,
        period: OCTOBER,
        referenceDate: '2026-12-01',
      }),
    ).toBe(5_000);
  });

  it('sem data de referência, não projeta', () => {
    const status = budgetStatus({
      limit: { categoryId: FOOD.id, amountInCents: 60_000 },
      transactions: [expense('t1', 17_000)],
      period: OCTOBER,
      resultOptions: { categories: CATEGORIES },
    });

    expect(status.projectedSpentInCents).toBe(17_000);
  });
});

describe('resumo do orçamento', () => {
  const limits: FinanceBudgetLimit[] = [
    { categoryId: FOOD.id, amountInCents: 60_000 },
    { categoryId: TRANSPORT.id, amountInCents: 15_000 },
  ];
  const transactions = [expense('t1', 17_000), expense('t2', 16_000, TRANSPORT.id)];

  it('soma limites, consumo e contagem por estado', () => {
    const statuses = limits.map((limit) =>
      budgetStatus({
        limit,
        transactions,
        period: OCTOBER,
        resultOptions: { categories: CATEGORIES },
      }),
    );
    const summary = budgetSummary({ statuses, period: OCTOBER });

    expect(summary.allocatedInCents).toBe(75_000);
    expect(summary.spentInCents).toBe(33_000);
    expect(summary.remainingInCents).toBe(42_000);
    // Transportes: 160,00 € de limite com 160,00 € gastos... 106,7% → excedido.
    expect(summary.overBudgetCategories).toBe(1);
    // Alimentação está a 28,3%, portanto nenhuma categoria em atenção.
    expect(summary.warningCategories).toBe(0);
  });

  it('respeita um total definido diferente da soma das partes', () => {
    const statuses = limits.map((limit) =>
      budgetStatus({
        limit,
        transactions,
        period: OCTOBER,
        resultOptions: { categories: CATEGORIES },
      }),
    );
    const summary = budgetSummary({ statuses, totalInCents: 100_000, period: OCTOBER });

    expect(summary.totalInCents).toBe(100_000);
    expect(summary.allocatedInCents).toBe(75_000);
    expect(summary.remainingInCents).toBe(67_000);
  });
});

describe('subcategorias somam para o limite da categoria-mãe', () => {
  it('agrega o consumo das subcategorias no limite da mãe', () => {
    const groceries: FinanceCategory = {
      id: 'cat-groceries',
      kind: 'expense',
      parentId: FOOD.id,
    };
    const status = budgetStatus({
      limit: { categoryId: FOOD.id, amountInCents: 60_000 },
      transactions: [expense('t1', 10_000), expense('t2', 15_000, groceries.id)],
      period: OCTOBER,
      resultOptions: { basis: 'accrual', categories: [...CATEGORIES, groceries] },
    });

    expect(status.spentInCents).toBe(25_000);
    expect(status.usedPct).toBe(41.7);
  });
});

describe('categorias sem limite', () => {
  it('sugere apenas categorias de gasto não internas e sem limite', () => {
    const internal: FinanceCategory = { id: 'cat-internal', kind: 'expense', internal: true };
    const withoutLimit = categoriesWithoutLimit(
      [FOOD, TRANSPORT, internal],
      [{ categoryId: FOOD.id, amountInCents: 1 }],
    );

    expect(withoutLimit.map((category) => category.id)).toEqual([TRANSPORT.id]);
  });
});
