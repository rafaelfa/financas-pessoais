import { describe, expect, it } from 'vitest';

import { monthPeriodFor, periodByKey } from '../budget-period';
import { budgetStatusList } from '../budget';
import { expenseByCategory } from '../result';
import type { FinanceCategory, FinanceTransaction } from '../types';

/**
 * Gate G6 — as três superfícies concordam?
 *
 * O critério de aceitação da Fase 6 é uma frase: **o painel, o orçamento e os
 * relatórios têm de dar os mesmos números para o mesmo período e o mesmo
 * regime.** Eu declarei-o cumprido porque o `build`, o `typecheck` e os testes
 * passavam — e passavam todos com o orçamento a medir **um dia a menos por mês**:
 * o fim do período era construído como dia *incluído* e entregue ao motor, que o
 * lê como *excluído*.
 *
 * Este ficheiro existe para que essa afirmação deixe de ser uma opinião. Os três
 * ecrãs chamam `monthlyResult`, `expenseByCategory` e `budgetStatusList` com o
 * mesmo objecto de período; o que os podia separar era **construírem períodos
 * diferentes**, e é isso que se fixa aqui: a fronteira do último dia e do
 * primeiro dia do mês seguinte.
 */

const CATEGORY: FinanceCategory = { id: 'cat-food', kind: 'expense' };

/** Gasto à vista, liquidado, numa data — o caso mais simples. */
function expense(id: string, date: string, amountInCents: number): FinanceTransaction {
  return {
    id,
    kind: 'expense',
    status: 'confirmed',
    amountInCents: -amountInCents,
    date,
    accountId: 'acc-1',
    categoryId: CATEGORY.id,
    settled: true,
  };
}

/** Um utilizador com o mês a começar ao dia 5. */
const MID_MONTH_USER = { monthStartDay: 5 };

describe('gate G6 — o período é o mesmo nas três superfícies', () => {
  it('o último dia do mês de competência conta para o orçamento', () => {
    /*
     * O mês de competência de 11 de outubro (com início ao dia 5) é
     * 05/10 a 04/11. Um gasto a **4 de novembro** é do mês de outubro e tem de
     * contar. Era exactamente este o dia que se perdia: `/orcamento` mostrava
     * 130 € onde devia mostrar 170 €.
     */
    const period = monthPeriodFor({ user: MID_MONTH_USER, today: '2026-10-11' });

    expect(period.start).toBe('2026-10-05');
    expect(period.displayEnd).toBe('2026-11-04');
    expect(period.end).toBe('2026-11-05');

    const transactions = [
      expense('t-start', '2026-10-05', 100_000),
      expense('t-last', '2026-11-04', 70_000),
    ];

    // A fronteira do motor: `start` incluído, `end` excluído.
    const totals = expenseByCategory(transactions, period, { categories: [CATEGORY] });
    const limits = budgetStatusList({
      limits: [{ id: 'l1', categoryId: CATEGORY.id, amountInCents: 200_000 }],
      transactions,
      period,
      resultOptions: { categories: [CATEGORY] },
    });

    expect(totals.get(CATEGORY.id)).toBe(170_000);
    expect(limits[0]?.spentInCents).toBe(170_000);
  });

  it('o primeiro dia do mês seguinte fica de fora', () => {
    const period = monthPeriodFor({ user: MID_MONTH_USER, today: '2026-10-11' });

    const transactions = [
      expense('t-inside', '2026-11-04', 10_000),
      expense('t-outside', '2026-11-05', 999_900),
    ];

    const limits = budgetStatusList({
      limits: [{ id: 'l1', categoryId: CATEGORY.id, amountInCents: 200_000 }],
      transactions,
      period,
      resultOptions: { categories: [CATEGORY] },
    });

    expect(limits[0]?.spentInCents).toBe(10_000);
    expect(limits[0]?.state).toBe('safe');
  });

  it('o orçamento e o relatório concordam ao cêntimo no mesmo período', () => {
    const period = monthPeriodFor({ user: { monthStartDay: 1 }, today: '2026-10-15' });
    const transactions = [
      expense('t1', '2026-10-01', 33_333),
      expense('t2', '2026-10-31', 1),
      expense('t3', '2026-11-01', 500_000),
    ];

    const byCategory = expenseByCategory(transactions, period, { categories: [CATEGORY] });
    const viaBudget = budgetStatusList({
      limits: [{ id: 'l1', categoryId: CATEGORY.id, amountInCents: 1_000_000 }],
      transactions,
      period,
      resultOptions: { categories: [CATEGORY] },
    });

    const reportTotal = [...byCategory.values()].reduce((total, value) => total + value, 0);

    // 33 333 + 1 (o último dia, que se perdia) — e o de 1 de novembro fica fora.
    expect(reportTotal).toBe(33_334);
    expect(viaBudget[0]?.spentInCents).toBe(reportTotal);
  });

  it('antes do dia de início, ainda é o mês anterior', () => {
    const period = monthPeriodFor({ user: MID_MONTH_USER, today: '2026-10-04' });

    expect(period.start).toBe('2026-09-05');
    expect(period.displayEnd).toBe('2026-10-04');
  });
});

describe('gate G6 — resolver um mês pela chave', () => {
  it('outubro é outubro, e não setembro', () => {
    /*
     * `periodOf('2026-10-01', 5)` devolve **setembro**, porque o dia 1 pertence
     * ao mês de competência anterior. Era assim que fechar outubro gravava
     * setembro — e o mês nunca aparecia como fechado. Com o início ao dia 1
     * funcionava, e foi por isso que escapou.
     */
    const period = periodByKey({
      key: '2026-10',
      user: MID_MONTH_USER,
      today: '2026-10-11',
    });

    expect(period?.start).toBe('2026-10-05');
    expect(period?.displayEnd).toBe('2026-11-04');
  });

  it('funciona também com o mês a começar ao dia 28', () => {
    // O caso extremo: o dia 1 de outubro pertence ao mês que começou a 28 de
    // setembro, e o mês "de outubro" começa a 28 de outubro.
    const period = periodByKey({
      key: '2026-10',
      user: { monthStartDay: 28 },
      today: '2026-10-30',
    });

    expect(period?.start).toBe('2026-10-28');
    expect(period?.displayEnd).toBe('2026-11-27');
  });

  it('devolve null para uma chave que não existe no horizonte', () => {
    expect(periodByKey({ key: '1999-01', user: MID_MONTH_USER, today: '2026-10-11' })).toBeNull();
  });
});
