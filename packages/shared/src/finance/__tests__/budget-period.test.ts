import { describe, expect, it } from 'vitest';

import { budgetPeriodFor, periodDateBounds } from '../budget-period';
import { exceededLimits, type FinanceBudgetPlan } from '../budget';
import { periodOf } from '../period';
import type { FinanceCategory, FinanceTransaction } from '../types';

/**
 * Fronteiras de período na camada que fala com a base de dados.
 *
 * Três defeitos da verificação adversarial das Fases 5 e 6 viviam exatamente
 * aqui, e nenhum deles era alcançável por um teste enquanto a decisão estivesse
 * escrita à mão dentro de `apps/web/src/server` (que não tem testes):
 *
 * 1. o fim **exclusivo** do motor entregue a um `lte`/`<=` incluía o primeiro dia
 *    do mês seguinte (fecho de mês) e somava um dia à contagem do relatório;
 * 2. o fecho de mês avaliava todos os orçamentos contra o mês em curso, e um
 *    orçamento de setembro aparecia com o consumo de outubro;
 * 3. `budgetPeriodFor(scope)`, na camada de servidor, só recebia o `scope` e por
 *    isso não tinha como acertar num `single_month` — era código morto.
 *
 * As decisões passaram para o domínio para poderem ser fixadas aqui.
 */

const FOOD: FinanceCategory = { id: 'cat-food', kind: 'expense' };
const USER = { monthStartDay: 5 };
const TODAY = '2026-10-11';

function expense(id: string, date: string, amountInCents: number): FinanceTransaction {
  return {
    id,
    kind: 'expense',
    status: 'confirmed',
    amountInCents: -amountInCents,
    date,
    accountId: 'acc-1',
    categoryId: FOOD.id,
    settled: true,
  };
}

function plan(overrides: Partial<FinanceBudgetPlan> = {}): FinanceBudgetPlan {
  return {
    id: 'budget-1',
    scope: 'single_month',
    periodStart: '2026-09-05',
    limits: [{ categoryId: FOOD.id, amountInCents: 10_000 }],
    ...overrides,
  };
}

describe('limites de data de um período', () => {
  it('devolve o primeiro dia e o fim exclusivo, sem incluir o dia de fronteira', () => {
    const period = periodOf(TODAY, 5);
    const bounds = periodDateBounds(period);

    expect(period).toEqual({ start: '2026-10-05', end: '2026-11-05', key: '2026-10' });
    expect(bounds).toEqual({ from: '2026-10-05', untilExclusive: '2026-11-05' });

    // O último dia do mês de competência entra; o primeiro do mês seguinte não.
    expect('2026-11-04' >= bounds.from && '2026-11-04' < bounds.untilExclusive).toBe(true);
    expect('2026-11-05' < bounds.untilExclusive).toBe(false);
  });

  it('funciona com o mês a começar ao dia 1', () => {
    const bounds = periodDateBounds(periodOf('2026-10-15', 1));

    expect(bounds).toEqual({ from: '2026-10-01', untilExclusive: '2026-11-01' });
  });
});

describe('período próprio de um orçamento', () => {
  it('um orçamento de setembro é medido em setembro, não no mês em curso', () => {
    const period = budgetPeriodFor({
      budget: { scope: 'single_month', periodStart: '2026-09-05' },
      user: USER,
      today: TODAY,
    });

    expect(period.start).toBe('2026-09-05');
    expect(period.end).toBe('2026-10-05');
    expect(period.displayEnd).toBe('2026-10-04');
    expect(period.key).toBe('2026-09');
  });

  it('um orçamento mensal padrão é medido no mês em curso', () => {
    const period = budgetPeriodFor({
      budget: { scope: 'monthly_default', periodStart: '1970-01-01' },
      user: USER,
      today: TODAY,
    });

    expect(period.start).toBe('2026-10-05');
    expect(period.displayEnd).toBe('2026-11-04');
  });

  it('um orçamento de setembro criado ao dia 1 também é medido em setembro', () => {
    const period = budgetPeriodFor({
      budget: { scope: 'single_month', periodStart: '2026-09-01' },
      user: { monthStartDay: 1 },
      today: '2026-10-15',
    });

    expect(period.start).toBe('2026-09-01');
    expect(period.displayEnd).toBe('2026-09-30');
  });
});

describe('orçamentos excedidos', () => {
  it('não conta, no fecho de outubro, um orçamento de setembro', () => {
    /*
     * O cenário medido no relatório T5.6 §B3: orçamento `single_month` de
     * setembro com limite de 100,00 €, e 170,00 € de gasto em outubro. Avaliado
     * contra o mês em curso dava "excedido" (170 %); contra o seu próprio mês
     * — onde nada foi gasto — não. O ecrã do orçamento dizia 0.
     */
    const exceeded = exceededLimits({
      budgets: [
        plan({
          id: 'setembro',
          scope: 'single_month',
          periodStart: '2026-09-05',
          limits: [{ categoryId: FOOD.id, amountInCents: 10_000 }],
        }),
      ],
      transactions: [expense('t-outubro', '2026-10-08', 17_000)],
      user: USER,
      today: TODAY,
      categories: [FOOD],
    });

    expect(exceeded).toBe(0);
  });

  it('conta o orçamento do próprio mês quando o consumo passa o limite', () => {
    const exceeded = exceededLimits({
      budgets: [
        plan({
          id: 'proprio',
          scope: 'single_month',
          periodStart: '2026-10-05',
          limits: [{ categoryId: FOOD.id, amountInCents: 10_000 }],
        }),
      ],
      transactions: [expense('t-outubro', '2026-10-08', 17_000)],
      user: USER,
      today: TODAY,
      categories: [FOOD],
    });

    expect(exceeded).toBe(1);
  });

  it('avalia cada orçamento no seu período, numa lista mista', () => {
    const exceeded = exceededLimits({
      budgets: [
        plan({
          id: 'setembro',
          scope: 'single_month',
          periodStart: '2026-09-05',
          limits: [{ categoryId: FOOD.id, amountInCents: 10_000 }],
        }),
        plan({
          id: 'padrao',
          scope: 'monthly_default',
          periodStart: '1970-01-01',
          limits: [{ categoryId: FOOD.id, amountInCents: 10_000 }],
        }),
      ],
      transactions: [expense('t-outubro', '2026-10-08', 17_000)],
      user: USER,
      today: TODAY,
      categories: [FOOD],
    });

    // Só o padrão (medido em outubro) está excedido; o de setembro não.
    expect(exceeded).toBe(1);
  });

  it('quando o orçamento de setembro é excedido em setembro, conta', () => {
    const exceeded = exceededLimits({
      budgets: [
        plan({
          id: 'setembro',
          scope: 'single_month',
          periodStart: '2026-09-05',
          limits: [{ categoryId: FOOD.id, amountInCents: 10_000 }],
        }),
      ],
      transactions: [expense('t-setembro', '2026-09-20', 17_000)],
      user: USER,
      today: TODAY,
      categories: [FOOD],
    });

    expect(exceeded).toBe(1);
  });
});
