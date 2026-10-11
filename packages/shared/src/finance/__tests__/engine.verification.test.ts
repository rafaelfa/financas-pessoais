/**
 * F1.4 — Verificação ADVERSARIAL do motor financeiro.
 *
 * Este ficheiro foi escrito a partir da ESPECIFICAÇÃO e não da implementação:
 *
 * - `docs/analise/01-funcionalidades-minhas-economias.md` §5.1 a §5.8 (fórmulas
 *   oficiais do sistema de referência e regras transversais);
 * - decisões nossas que alteram o original, documentadas nos comentários de topo
 *   de `packages/shared/src/finance/*.ts` (M2 caixa/competência, M4 pagamento de
 *   fatura como operação nativa, orçamento com três estados, conjunção nas
 *   regras, bens sem depreciação automática);
 * - `docs/plano/PLANO-EXECUCAO.md` §14 (melhorias M1–M5).
 *
 * Os caminhos felizes já estão nos testes do autor (148). Aqui só entram
 * fronteiras exatas, casos degenerados, dados incoerentes e invariantes de
 * propriedade — o objetivo é partir o motor, não confirmá-lo.
 *
 * Convenção: datas literais `YYYY-MM-DD`, dinheiro em cêntimos inteiros,
 * `amountInCents` é o efeito assinado na conta.
 */

import { describe, expect, it } from 'vitest';

import {
  accountBalanceInCents,
  addDays,
  addMonths,
  assertMonthStartDay,
  balanceAdjustmentInCents,
  balanceByAccount,
  budgetStateFor,
  budgetStatus,
  budgetStatusList,
  budgetSummary,
  budgetUsedPct,
  carriedOverToNextInvoice,
  categoriesWithoutLimit,
  classifyTransaction,
  daysBetween,
  expenseByCategory,
  goalOverview,
  goalProgress,
  goalsAccumulatedInCents,
  hasMatchingAdjustment,
  incomeByCategory,
  invalidRules,
  invoiceDatesFor,
  invoiceTotals,
  isWithinPeriod,
  matchesRule,
  monthlyResult,
  movementEffectInCents,
  netWorth,
  normalizeText,
  periodOf,
  periodRange,
  periodsBetween,
  previousPeriod,
  previewClassification,
  projectedBalanceInCents,
  projectedSpentInCents,
  projectedTotalBalanceInCents,
  resultOfDate,
  resultSeries,
  ruleHasCondition,
  splitInstallments,
  totalBalanceInCents,
  unpaidInvoices,
} from '../index';

import type {
  FinanceAccount,
  FinanceBudgetLimit,
  FinanceCategory,
  FinanceGoal,
  FinanceGoalMovement,
  FinanceInvoice,
  FinanceInvoicePayment,
  FinanceLiability,
  FinancePeriod,
  FinanceTransaction,
  FinanceTransactionRule,
} from '../types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const OCT: FinancePeriod = { start: '2026-10-01', end: '2026-11-01', key: '2026-10' };
const NOV: FinancePeriod = { start: '2026-11-01', end: '2026-12-01', key: '2026-11' };
const DEC: FinancePeriod = { start: '2026-12-01', end: '2027-01-01', key: '2026-12' };
/** Período com início no dia 25: 25 set → 25 out (fim exclusivo). */
const SALARY_PERIOD: FinancePeriod = {
  start: '2026-09-25',
  end: '2026-10-25',
  key: '2026-09',
};

function account(overrides: Partial<FinanceAccount> = {}): FinanceAccount {
  return { id: 'acc-1', openingBalanceInCents: 0, ...overrides };
}

type TxInput = Partial<FinanceTransaction> &
  Pick<FinanceTransaction, 'id' | 'kind' | 'amountInCents' | 'date' | 'accountId'>;

function tx(overrides: TxInput): FinanceTransaction {
  return { status: 'confirmed', settled: true, ...overrides };
}

function category(
  overrides: Partial<FinanceCategory> & Pick<FinanceCategory, 'id'>,
): FinanceCategory {
  return { kind: 'expense', ...overrides };
}

function limit(
  overrides: Partial<FinanceBudgetLimit> & Pick<FinanceBudgetLimit, 'categoryId'>,
): FinanceBudgetLimit {
  return { amountInCents: 0, ...overrides };
}

function rule(
  overrides: Partial<FinanceTransactionRule> & Pick<FinanceTransactionRule, 'id'>,
): FinanceTransactionRule {
  return {
    name: 'Regra',
    priority: 10,
    kind: 'expense',
    targetCategoryId: 'cat-destino',
    ...overrides,
  };
}

function goal(overrides: Partial<FinanceGoal> = {}): FinanceGoal {
  return {
    id: 'goal-1',
    targetAmountInCents: 100_000,
    targetDate: '2026-12-31',
    contributionFrequency: 'monthly',
    ...overrides,
  };
}

function movement(
  overrides: Partial<FinanceGoalMovement> &
    Pick<FinanceGoalMovement, 'type' | 'amountInCents' | 'date'>,
): FinanceGoalMovement {
  return { goalId: 'goal-1', ...overrides };
}

/** Gerador determinístico (LCG) para os testes de propriedade. */
function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function randomInt(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

// ===========================================================================
// 1. Período — fronteiras com início de mês configurável
// ===========================================================================

describe('1. período com início de mês diferente de 1', () => {
  it('isola as quatro fronteiras: véspera, dia do início, último dia e fim exclusivo', () => {
    expect(SALARY_PERIOD.start).toBe('2026-09-25');
    expect(SALARY_PERIOD.end).toBe('2026-10-25');

    // Véspera do início: pertence ao período anterior.
    expect(isWithinPeriod(SALARY_PERIOD, '2026-09-24')).toBe(false);
    // Dia do início: entra.
    expect(isWithinPeriod(SALARY_PERIOD, '2026-09-25')).toBe(true);
    // Último dia do período: entra.
    expect(isWithinPeriod(SALARY_PERIOD, '2026-10-24')).toBe(true);
    // Dia do fim: é exclusivo, não entra.
    expect(isWithinPeriod(SALARY_PERIOD, '2026-10-25')).toBe(false);
  });

  it('coloca a véspera do início no período anterior, não no atual', () => {
    expect(periodOf('2026-09-24', 25)).toEqual({
      start: '2026-08-25',
      end: '2026-09-25',
      key: '2026-08',
    });
  });

  it('atravessa a passagem de ano com início no dia 25', () => {
    expect(periodOf('2026-12-28', 25)).toEqual({
      start: '2026-12-25',
      end: '2027-01-25',
      key: '2026-12',
    });
    expect(periodOf('2026-12-24', 25)).toEqual({
      start: '2026-11-25',
      end: '2026-12-25',
      key: '2026-11',
    });
  });

  it('funciona no limite superior (dia 28) em fevereiro', () => {
    expect(periodOf('2026-02-27', 28)).toEqual({
      start: '2026-01-28',
      end: '2026-02-28',
      key: '2026-01',
    });
    expect(periodOf('2026-02-28', 28)).toEqual({
      start: '2026-02-28',
      end: '2026-03-28',
      key: '2026-02',
    });
  });

  it('recusa inícios fora de 1..28 sem os corrigir em silêncio', () => {
    expect(() => assertMonthStartDay(0)).toThrow(RangeError);
    expect(() => assertMonthStartDay(29)).toThrow(RangeError);
    expect(() => assertMonthStartDay(31)).toThrow(RangeError);
    expect(() => assertMonthStartDay(1.5)).toThrow(RangeError);
    expect(() => assertMonthStartDay(Number.NaN)).toThrow(RangeError);
    expect(() => assertMonthStartDay(1)).not.toThrow();
    expect(() => assertMonthStartDay(28)).not.toThrow();
  });

  it('previousPeriod mantém o início configurável ao recuar sobre o ano', () => {
    expect(previousPeriod(periodOf('2026-01-15', 25), 25)).toEqual({
      start: '2025-11-25',
      end: '2025-12-25',
      key: '2025-11',
    });
  });

  it('periodRange com início no dia 25 cobre cada data exatamente uma vez', () => {
    const periods = periodRange('2026-01-01', '2026-12-31', 25);

    expect(periods.length).toBe(13);
    expect(periods[0]).toEqual({ start: '2025-12-25', end: '2026-01-25', key: '2025-12' });
    expect(periods[periods.length - 1]).toEqual({
      start: '2026-12-25',
      end: '2027-01-25',
      key: '2026-12',
    });

    for (let date = '2026-01-01'; date <= '2026-12-31'; date = addDays(date, 1)) {
      const covering = periods.filter((period) => isWithinPeriod(period, date));
      expect(covering, `data ${date} devia estar num único período`).toHaveLength(1);
    }
  });

  it('periodRange devolve vazio quando o fim é anterior ao início, mesmo por um dia', () => {
    expect(periodRange('2026-10-02', '2026-10-01')).toEqual([]);
  });
});

// ===========================================================================
// 2. Saldo — o que conta, o que não conta e sensibilidade a um cêntimo
// ===========================================================================

describe('2. saldo de conta', () => {
  it('só move o saldo o que está liquidado; pendente e ignorado ficam de fora', () => {
    const acc = account({ openingBalanceInCents: 100_00 });
    const transactions: FinanceTransaction[] = [
      tx({
        id: 't1',
        kind: 'income',
        amountInCents: 500_00,
        date: '2026-10-05',
        accountId: 'acc-1',
      }),
      tx({
        id: 't2',
        kind: 'income',
        amountInCents: 900_00,
        date: '2026-10-06',
        accountId: 'acc-1',
        settled: false,
      }),
      tx({
        id: 't3',
        kind: 'expense',
        amountInCents: -200_00,
        date: '2026-10-07',
        accountId: 'acc-1',
        status: 'ignored',
      }),
    ];

    expect(accountBalanceInCents(acc, transactions)).toBe(600_00);
  });

  it('a data-limite é inclusiva ao cêntimo que cai exatamente nela', () => {
    const acc = account();
    const transactions = [
      tx({
        id: 't1',
        kind: 'expense',
        amountInCents: -100,
        date: '2026-10-05',
        accountId: 'acc-1',
      }),
      tx({
        id: 't2',
        kind: 'expense',
        amountInCents: -100,
        date: '2026-10-06',
        accountId: 'acc-1',
      }),
    ];

    expect(accountBalanceInCents(acc, transactions, { upTo: '2026-10-05' })).toBe(-100);
    expect(accountBalanceInCents(acc, transactions, { upTo: '2026-10-04' })).toBe(0);
  });

  it('distingue o saldo por um único cêntimo', () => {
    const acc = account({ openingBalanceInCents: 1_000 });
    const base = tx({
      id: 't1',
      kind: 'expense',
      amountInCents: -500,
      date: '2026-10-05',
      accountId: 'acc-1',
    });
    const plusOneCent = tx({
      id: 't2',
      kind: 'expense',
      amountInCents: -501,
      date: '2026-10-05',
      accountId: 'acc-1',
    });

    expect(accountBalanceInCents(acc, [base]) - accountBalanceInCents(acc, [plusOneCent])).toBe(1);
  });

  it('conta arquivada: o saldo individual continua calculável, mas sai dos totais', () => {
    const active = account({ id: 'acc-1', openingBalanceInCents: 1_000 });
    const archived = account({ id: 'acc-2', openingBalanceInCents: 5_000, archived: true });
    const transactions = [
      tx({ id: 't1', kind: 'income', amountInCents: 500, date: '2026-10-05', accountId: 'acc-2' }),
    ];

    // §5.1: "Contas arquivadas: excluídas do saldo". O motor documenta que só os
    // totais as excluem — divergência de leitura registada no relatório.
    expect(accountBalanceInCents(archived, transactions)).toBe(5_500);
    expect(balanceByAccount([active, archived], transactions)).toEqual([
      { accountId: 'acc-1', balanceInCents: 1_000 },
    ]);
    expect(totalBalanceInCents([active, archived], transactions)).toBe(1_000);
    expect(projectedTotalBalanceInCents([active, archived], transactions, '2026-12-31')).toBe(
      1_000,
    );
  });

  it('transferência: cada conta muda, o total não', () => {
    const from = account({ id: 'acc-1', openingBalanceInCents: 10_000 });
    const to = account({ id: 'acc-2', openingBalanceInCents: 0 });
    const transactions = [
      tx({
        id: 'tr-out',
        kind: 'transfer',
        amountInCents: -3_500,
        date: '2026-10-10',
        accountId: 'acc-1',
        transferGroupId: 'g1',
      }),
      tx({
        id: 'tr-in',
        kind: 'transfer',
        amountInCents: 3_500,
        date: '2026-10-10',
        accountId: 'acc-2',
        transferGroupId: 'g1',
      }),
    ];

    expect(accountBalanceInCents(from, transactions)).toBe(6_500);
    expect(accountBalanceInCents(to, transactions)).toBe(3_500);
    expect(totalBalanceInCents([from, to], transactions)).toBe(10_000);
  });

  it('transferência com apenas uma perna (dados incoerentes) altera o total', () => {
    // O motor não valida que o par de transferência fecha a zero: confia nos dados.
    const from = account({ id: 'acc-1', openingBalanceInCents: 10_000 });
    const to = account({ id: 'acc-2', openingBalanceInCents: 0 });
    const onlyLeg = tx({
      id: 'tr-out',
      kind: 'transfer',
      amountInCents: -3_500,
      date: '2026-10-10',
      accountId: 'acc-1',
      transferGroupId: 'g1',
    });

    expect(totalBalanceInCents([from, to], [onlyLeg])).toBe(6_500);
  });

  it('a projeção inclui o agendado por liquidar mas nunca o ignorado', () => {
    const acc = account({ openingBalanceInCents: 1_000 });
    const transactions = [
      tx({
        id: 't1',
        kind: 'expense',
        amountInCents: -400,
        date: '2026-10-20',
        accountId: 'acc-1',
        settled: false,
        status: 'pending',
      }),
      tx({
        id: 't2',
        kind: 'expense',
        amountInCents: -900,
        date: '2026-10-21',
        accountId: 'acc-1',
        status: 'ignored',
      }),
    ];

    expect(accountBalanceInCents(acc, transactions)).toBe(1_000);
    expect(projectedBalanceInCents(acc, transactions, '2026-10-31')).toBe(600);
  });

  it('a projeção respeita a data-limite e é inclusiva nessa data', () => {
    const acc = account();
    const transactions = [
      tx({
        id: 't1',
        kind: 'expense',
        amountInCents: -100,
        date: '2026-10-05',
        accountId: 'acc-1',
        settled: false,
      }),
      tx({
        id: 't2',
        kind: 'expense',
        amountInCents: -100,
        date: '2026-10-06',
        accountId: 'acc-1',
        settled: false,
      }),
    ];

    expect(projectedBalanceInCents(acc, transactions, '2026-10-05')).toBe(-100);
    expect(projectedBalanceInCents(acc, transactions, '2026-10-06')).toBe(-200);
  });

  it('ajuste de saldo: sinal correto nos dois sentidos', () => {
    expect(
      balanceAdjustmentInCents({ reportedBalanceInCents: 10_000, computedBalanceInCents: 9_500 }),
    ).toBe(500);
    expect(
      balanceAdjustmentInCents({ reportedBalanceInCents: 9_500, computedBalanceInCents: 10_000 }),
    ).toBe(-500);
    expect(
      balanceAdjustmentInCents({ reportedBalanceInCents: 10_000, computedBalanceInCents: 10_000 }),
    ).toBe(0);
  });

  it('deteção de ajuste duplicado exige data, valor, conta e tipo iguais', () => {
    const existing: FinanceTransaction[] = [
      tx({
        id: 'adj',
        kind: 'balance_adjust',
        amountInCents: 500,
        date: '2026-10-31',
        accountId: 'acc-1',
      }),
    ];

    expect(
      hasMatchingAdjustment(existing, {
        accountId: 'acc-1',
        date: '2026-10-31',
        amountInCents: 500,
      }),
    ).toBe(true);
    expect(
      hasMatchingAdjustment(existing, {
        accountId: 'acc-1',
        date: '2026-10-30',
        amountInCents: 500,
      }),
    ).toBe(false);
    expect(
      hasMatchingAdjustment(existing, {
        accountId: 'acc-1',
        date: '2026-10-31',
        amountInCents: -500,
      }),
    ).toBe(false);
    expect(
      hasMatchingAdjustment(existing, {
        accountId: 'acc-2',
        date: '2026-10-31',
        amountInCents: 500,
      }),
    ).toBe(false);
  });

  it('um ajuste com o mesmo valor mas tipo errado não conta como duplicado', () => {
    const notAnAdjustment: FinanceTransaction[] = [
      tx({ id: 'e1', kind: 'expense', amountInCents: 500, date: '2026-10-31', accountId: 'acc-1' }),
    ];

    expect(
      hasMatchingAdjustment(notAnAdjustment, {
        accountId: 'acc-1',
        date: '2026-10-31',
        amountInCents: 500,
      }),
    ).toBe(false);
  });

  it('um ajuste ignorado não impede criar o mesmo ajuste outra vez', () => {
    const ignored: FinanceTransaction[] = [
      tx({
        id: 'adj',
        kind: 'balance_adjust',
        amountInCents: 500,
        date: '2026-10-31',
        accountId: 'acc-1',
        status: 'ignored',
      }),
    ];

    expect(
      hasMatchingAdjustment(ignored, {
        accountId: 'acc-1',
        date: '2026-10-31',
        amountInCents: 500,
      }),
    ).toBe(false);
  });
});

// ===========================================================================
// 3. Resultado mensal — caixa vs competência
// ===========================================================================

describe('3. resultado mensal: as mesmas transações nos dois regimes', () => {
  const cardPurchase = tx({
    id: 'card-buy',
    kind: 'expense',
    amountInCents: -10_000,
    date: '2026-11-05',
    accountId: 'acc-1',
    categoryId: 'cat-food',
    invoiceId: 'inv-1',
    settled: false,
  });
  const invoicePayment = tx({
    id: 'card-pay',
    kind: 'invoice_payment',
    amountInCents: -10_000,
    date: '2026-12-10',
    accountId: 'acc-1',
    invoiceId: 'inv-1',
    settled: true,
  });
  const transactions = [cardPurchase, invoicePayment];

  it('em caixa o gasto do cartão não conta; conta só o pagamento da fatura, no mês do pagamento', () => {
    const november = monthlyResult(transactions, NOV, { basis: 'cash' });
    const december = monthlyResult(transactions, DEC, { basis: 'cash' });

    expect(november.expenseInCents).toBe(0);
    expect(december.expenseInCents).toBe(10_000);
    expect(november.netInCents).toBe(0);
    expect(december.netInCents).toBe(-10_000);
  });

  it('em competência conta a compra na data e o pagamento da fatura é neutro', () => {
    const november = monthlyResult(transactions, NOV, { basis: 'accrual' });
    const december = monthlyResult(transactions, DEC, { basis: 'accrual' });

    expect(november.expenseInCents).toBe(10_000);
    expect(december.expenseInCents).toBe(0);
    expect(december.netInCents).toBe(0);
  });

  it('o mesmo gasto entra exatamente uma vez em cada regime', () => {
    const cashTotal =
      monthlyResult(transactions, NOV, { basis: 'cash' }).expenseInCents +
      monthlyResult(transactions, DEC, { basis: 'cash' }).expenseInCents;
    const accrualTotal =
      monthlyResult(transactions, NOV, { basis: 'accrual' }).expenseInCents +
      monthlyResult(transactions, DEC, { basis: 'accrual' }).expenseInCents;

    expect(cashTotal).toBe(10_000);
    expect(accrualTotal).toBe(10_000);
    expect(cashTotal).toBe(accrualTotal);
  });

  it('gasto de cartão conta em competência quer esteja liquidado quer não', () => {
    const pending = monthlyResult([{ ...cardPurchase, id: 'p1', settled: false }], NOV, {
      basis: 'accrual',
    });
    const settled = monthlyResult([{ ...cardPurchase, id: 'p2', settled: true }], NOV, {
      basis: 'accrual',
    });

    expect(pending.expenseInCents).toBe(10_000);
    expect(settled.expenseInCents).toBe(10_000);
  });

  it('gasto de cartão nunca conta em caixa, esteja liquidado ou não', () => {
    const pending = monthlyResult([{ ...cardPurchase, id: 'p1', settled: false }], NOV, {
      basis: 'cash',
    });
    const settled = monthlyResult([{ ...cardPurchase, id: 'p2', settled: true }], NOV, {
      basis: 'cash',
    });

    expect(pending.expenseInCents).toBe(0);
    expect(settled.expenseInCents).toBe(0);
  });

  it('um pagamento de fatura não liquidado não conta em caixa', () => {
    const result = monthlyResult([{ ...invoicePayment, settled: false }], DEC, { basis: 'cash' });

    expect(result.expenseInCents).toBe(0);
  });

  it('ganho pendente: fora em caixa, dentro em competência', () => {
    const pendingIncome = tx({
      id: 'inc',
      kind: 'income',
      amountInCents: 200_000,
      date: '2026-10-05',
      accountId: 'acc-1',
      settled: false,
    });

    expect(monthlyResult([pendingIncome], OCT, { basis: 'cash' }).incomeInCents).toBe(0);
    expect(monthlyResult([pendingIncome], OCT, { basis: 'accrual' }).incomeInCents).toBe(200_000);
  });

  it('despesa em dinheiro não liquidada: fora em caixa, dentro em competência', () => {
    const pendingExpense = tx({
      id: 'exp',
      kind: 'expense',
      amountInCents: -1_500,
      date: '2026-10-05',
      accountId: 'acc-1',
      settled: false,
    });

    expect(monthlyResult([pendingExpense], OCT, { basis: 'cash' }).expenseInCents).toBe(0);
    expect(monthlyResult([pendingExpense], OCT, { basis: 'accrual' }).expenseInCents).toBe(1_500);
  });

  it('operações internas e transferências nunca entram, em nenhum regime', () => {
    const operations = [
      tx({
        id: 'o1',
        kind: 'transfer',
        amountInCents: -5_000,
        date: '2026-10-05',
        accountId: 'acc-1',
      }),
      tx({
        id: 'o2',
        kind: 'goal_deposit',
        amountInCents: -5_000,
        date: '2026-10-06',
        accountId: 'acc-1',
      }),
      tx({
        id: 'o3',
        kind: 'goal_withdrawal',
        amountInCents: 5_000,
        date: '2026-10-07',
        accountId: 'acc-1',
      }),
      tx({
        id: 'o4',
        kind: 'balance_adjust',
        amountInCents: 5_000,
        date: '2026-10-08',
        accountId: 'acc-1',
      }),
    ];

    for (const basis of ['cash', 'accrual'] as const) {
      const result = monthlyResult(operations, OCT, { basis });
      expect(result.incomeInCents, `entradas em ${basis}`).toBe(0);
      expect(result.expenseInCents, `saídas em ${basis}`).toBe(0);
      expect(result.netInCents, `líquido em ${basis}`).toBe(0);
    }
  });

  it('categoria interna: despesa e ganho categorizados ficam de fora nos dois regimes', () => {
    const categories = [category({ id: 'cat-internal', kind: 'expense', internal: true })];
    const transactions = [
      tx({
        id: 'i1',
        kind: 'expense',
        amountInCents: -1_000,
        date: '2026-10-05',
        accountId: 'acc-1',
        categoryId: 'cat-internal',
      }),
      tx({
        id: 'i2',
        kind: 'income',
        amountInCents: 1_000,
        date: '2026-10-06',
        accountId: 'acc-1',
        categoryId: 'cat-internal',
      }),
    ];

    for (const basis of ['cash', 'accrual'] as const) {
      const result = monthlyResult(transactions, OCT, { basis, categories });
      expect(result.incomeInCents, `entradas em ${basis}`).toBe(0);
      expect(result.expenseInCents, `saídas em ${basis}`).toBe(0);
    }
  });

  it('o pagamento de fatura com categoria interna continua a contar em caixa (M4)', () => {
    // Contradição documental: §5.8 diz "categorias internas nunca entram em
    // ganhos/gastos", mas o comentário de `result.ts` exclui o pagamento de
    // fatura dessa regra, porque em caixa é ele que representa a compra.
    const categories = [category({ id: 'cat-internal', kind: 'expense', internal: true })];
    const payment = tx({
      id: 'pay',
      kind: 'invoice_payment',
      amountInCents: -7_000,
      date: '2026-10-10',
      accountId: 'acc-1',
      categoryId: 'cat-internal',
    });

    expect(monthlyResult([payment], OCT, { basis: 'cash', categories }).expenseInCents).toBe(7_000);
    expect(monthlyResult([payment], OCT, { basis: 'accrual', categories }).expenseInCents).toBe(0);
  });

  it('fronteiras do período: início entra, fim é exclusivo (início no dia 25)', () => {
    const transactions = [
      tx({
        id: 'b0',
        kind: 'expense',
        amountInCents: -100,
        date: '2026-09-24',
        accountId: 'acc-1',
      }),
      tx({
        id: 'b1',
        kind: 'expense',
        amountInCents: -200,
        date: '2026-09-25',
        accountId: 'acc-1',
      }),
      tx({
        id: 'b2',
        kind: 'expense',
        amountInCents: -400,
        date: '2026-10-24',
        accountId: 'acc-1',
      }),
      tx({
        id: 'b3',
        kind: 'expense',
        amountInCents: -800,
        date: '2026-10-25',
        accountId: 'acc-1',
      }),
    ];

    const result = monthlyResult(transactions, SALARY_PERIOD, { basis: 'cash' });

    expect(result.expenseInCents).toBe(600);
  });

  it('as fronteiras somam 100%: nenhuma data do intervalo é contada duas vezes', () => {
    const transactions = Array.from({ length: 5 }, (_, index) =>
      tx({
        id: `t${index}`,
        kind: 'expense',
        amountInCents: -(index + 1) * 100,
        date: addDays('2026-09-20', index),
        accountId: 'acc-1',
      }),
    );

    const totals = periodRange('2026-09-20', '2026-10-27', 25).map(
      (period) => monthlyResult(transactions, period, { basis: 'cash' }).expenseInCents,
    );

    expect(totals.reduce((sum, value) => sum + value, 0)).toBe(1_500);
  });

  it('resultOfDate respeita o início de mês configurável', () => {
    const transaction = tx({
      id: 't1',
      kind: 'expense',
      amountInCents: -300,
      date: '2026-10-24',
      accountId: 'acc-1',
    });

    expect(resultOfDate([transaction], '2026-10-24', { monthStartDay: 25 }).expenseInCents).toBe(
      300,
    );
    expect(resultOfDate([transaction], '2026-10-25', { monthStartDay: 25 }).expenseInCents).toBe(0);
    expect(resultOfDate([transaction], '2026-10-24').expenseInCents).toBe(300);
  });

  it('resultSeries com início no dia 25 produz um período por mês, sem sobreposição', () => {
    const series = resultSeries([], '2026-01-01', '2026-12-31', { monthStartDay: 25 });

    expect(series).toHaveLength(13);
    for (let index = 1; index < series.length; index += 1) {
      expect(series[index - 1]!.period.end).toBe(series[index]!.period.start);
    }
  });

  it('totais por categoria: a interna não aparece e o cartão só aparece em competência', () => {
    const categories = [category({ id: 'cat-internal', kind: 'expense', internal: true })];
    const transactions = [
      tx({
        id: 'card',
        kind: 'expense',
        amountInCents: -2_000,
        date: '2026-10-05',
        accountId: 'acc-1',
        categoryId: 'cat-food',
        invoiceId: 'inv-1',
      }),
      tx({
        id: 'cash',
        kind: 'expense',
        amountInCents: -300,
        date: '2026-10-06',
        accountId: 'acc-1',
        categoryId: 'cat-food',
      }),
      tx({
        id: 'internal',
        kind: 'expense',
        amountInCents: -900,
        date: '2026-10-07',
        accountId: 'acc-1',
        categoryId: 'cat-internal',
      }),
    ];

    expect(expenseByCategory(transactions, OCT, { basis: 'cash', categories })).toEqual(
      new Map([['cat-food', 300]]),
    );
    expect(expenseByCategory(transactions, OCT, { basis: 'accrual', categories })).toEqual(
      new Map([['cat-food', 2_300]]),
    );
  });

  it('entradas por categoria ignoram ganhos pendentes em caixa', () => {
    const transactions = [
      tx({
        id: 'i1',
        kind: 'income',
        amountInCents: 1_000,
        date: '2026-10-05',
        accountId: 'acc-1',
        categoryId: 'cat-salary',
        settled: false,
      }),
    ];

    expect(incomeByCategory(transactions, OCT, { basis: 'cash' })).toEqual(new Map());
    expect(incomeByCategory(transactions, OCT, { basis: 'accrual' })).toEqual(
      new Map([['cat-salary', 1_000]]),
    );
  });

  it('o líquido reage a um único cêntimo', () => {
    const base = tx({
      id: 't1',
      kind: 'income',
      amountInCents: 1_000,
      date: '2026-10-05',
      accountId: 'acc-1',
    });
    const plusOne = tx({
      id: 't2',
      kind: 'income',
      amountInCents: 1_001,
      date: '2026-10-05',
      accountId: 'acc-1',
    });

    expect(monthlyResult([plusOne], OCT).netInCents - monthlyResult([base], OCT).netInCents).toBe(
      1,
    );
  });

  it('transação com data no fim exclusivo não entra, nem na série', () => {
    const transaction = tx({
      id: 't1',
      kind: 'expense',
      amountInCents: -100,
      date: '2026-11-01',
      accountId: 'acc-1',
    });

    expect(monthlyResult([transaction], OCT).expenseInCents).toBe(0);
    expect(monthlyResult([transaction], NOV).expenseInCents).toBe(100);
  });
});

// ===========================================================================
// 4. Orçamento — fronteiras exatas dos estados
// ===========================================================================

describe('4. orçamento: percentagens e estados', () => {
  it('as fronteiras 69,9 / 70 / 99,9 / 100 caem nos estados certos', () => {
    expect(budgetUsedPct(699, 1_000)).toBe(69.9);
    expect(budgetStateFor(budgetUsedPct(699, 1_000))).toBe('safe');

    expect(budgetUsedPct(700, 1_000)).toBe(70);
    expect(budgetStateFor(budgetUsedPct(700, 1_000))).toBe('warning');

    expect(budgetUsedPct(999, 1_000)).toBe(99.9);
    expect(budgetStateFor(budgetUsedPct(999, 1_000))).toBe('warning');

    expect(budgetUsedPct(1_000, 1_000)).toBe(100);
    expect(budgetStateFor(budgetUsedPct(1_000, 1_000))).toBe('exceeded');

    expect(budgetStateFor(budgetUsedPct(1_001, 1_000))).toBe('exceeded');
  });

  it('um arredondamento de 69,95% sobe para 70% e passa a atenção', () => {
    expect(budgetUsedPct(1_399, 2_000)).toBe(70);
    expect(budgetStateFor(budgetUsedPct(1_399, 2_000))).toBe('warning');
  });

  it('percentagem negativa (dados incoerentes) não inventa estado excedido', () => {
    expect(budgetUsedPct(-500, 1_000)).toBe(-50);
    expect(budgetStateFor(-50)).toBe('safe');
  });

  it('limite zero: sem gasto é seguro; com um cêntimo já está excedido', () => {
    const limitZero = limit({ categoryId: 'cat-food', amountInCents: 0 });
    const noSpend = budgetStatus({ limit: limitZero, transactions: [], period: OCT });

    expect(noSpend.usedPct).toBe(0);
    expect(noSpend.state).toBe('safe');
    expect(noSpend.remainingInCents).toBe(0);
    expect(noSpend.alertTriggered).toBe(false);

    const oneCent = budgetStatus({
      limit: limitZero,
      transactions: [
        tx({
          id: 't1',
          kind: 'expense',
          amountInCents: -1,
          date: '2026-10-05',
          accountId: 'acc-1',
          categoryId: 'cat-food',
        }),
      ],
      period: OCT,
    });

    expect(oneCent.usedPct).toBe(100);
    expect(oneCent.state).toBe('exceeded');
    expect(oneCent.remainingInCents).toBe(-1);
  });

  it('limite excedido: o que falta fica negativo e o estado é excedido', () => {
    const status = budgetStatus({
      limit: limit({ categoryId: 'cat-food', amountInCents: 5_000 }),
      transactions: [
        tx({
          id: 't1',
          kind: 'expense',
          amountInCents: -7_000,
          date: '2026-10-05',
          accountId: 'acc-1',
          categoryId: 'cat-food',
        }),
      ],
      period: OCT,
    });

    expect(status.spentInCents).toBe(7_000);
    expect(status.usedPct).toBe(140);
    expect(status.state).toBe('exceeded');
    expect(status.remainingInCents).toBe(-2_000);
  });

  it('o alerta dispara exatamente no limiar e não um cêntimo antes', () => {
    const transactions = (amount: number) => [
      tx({
        id: 't1',
        kind: 'expense',
        amountInCents: -amount,
        date: '2026-10-05',
        accountId: 'acc-1',
        categoryId: 'cat-food',
      }),
    ];

    const atThreshold = budgetStatus({
      limit: limit({ categoryId: 'cat-food', amountInCents: 1_000, alertThresholdPct: 80 }),
      transactions: transactions(800),
      period: OCT,
    });
    const oneUnder = budgetStatus({
      limit: limit({ categoryId: 'cat-food', amountInCents: 1_000, alertThresholdPct: 80 }),
      transactions: transactions(799),
      period: OCT,
    });

    expect(atThreshold.alertTriggered).toBe(true);
    expect(oneUnder.alertTriggered).toBe(false);
  });

  it('alerta desligado nunca dispara, mesmo a 100% ou acima', () => {
    const status = budgetStatus({
      limit: limit({ categoryId: 'cat-food', amountInCents: 1_000, alertsEnabled: false }),
      transactions: [
        tx({
          id: 't1',
          kind: 'expense',
          amountInCents: -5_000,
          date: '2026-10-05',
          accountId: 'acc-1',
          categoryId: 'cat-food',
        }),
      ],
      period: OCT,
    });

    expect(status.usedPct).toBe(500);
    expect(status.state).toBe('exceeded');
    expect(status.alertTriggered).toBe(false);
  });

  it('projeção: no primeiro dia não extrapola, no último dia extrapola o ritmo', () => {
    expect(
      projectedSpentInCents({ spentInCents: 3_000, period: OCT, referenceDate: '2026-10-01' }),
    ).toBe(3_000);
    expect(
      projectedSpentInCents({ spentInCents: 3_000, period: OCT, referenceDate: '2026-10-31' }),
    ).toBe(3_100);
  });

  it('projeção: um dia depois do fim não extrapola para além do período', () => {
    expect(
      projectedSpentInCents({ spentInCents: 3_000, period: OCT, referenceDate: '2026-11-02' }),
    ).toBe(3_000);
    expect(
      projectedSpentInCents({ spentInCents: 3_000, period: OCT, referenceDate: '2026-11-01' }),
    ).toBe(3_000);
  });

  it('projeção com gasto zero é zero, em qualquer dia', () => {
    expect(
      projectedSpentInCents({ spentInCents: 0, period: OCT, referenceDate: '2026-10-15' }),
    ).toBe(0);
  });

  it('budgetStatus sem data de referência devolve o gasto real, sem projetar', () => {
    const status = budgetStatus({
      limit: limit({ categoryId: 'cat-food', amountInCents: 10_000 }),
      transactions: [
        tx({
          id: 't1',
          kind: 'expense',
          amountInCents: -3_000,
          date: '2026-10-15',
          accountId: 'acc-1',
          categoryId: 'cat-food',
        }),
      ],
      period: OCT,
    });

    expect(status.projectedSpentInCents).toBe(3_000);
  });

  it('budgetStatus com data de referência projeta usando o ritmo do período', () => {
    const status = budgetStatus({
      limit: limit({ categoryId: 'cat-food', amountInCents: 10_000 }),
      transactions: [
        tx({
          id: 't1',
          kind: 'expense',
          amountInCents: -3_000,
          date: '2026-10-15',
          accountId: 'acc-1',
          categoryId: 'cat-food',
        }),
      ],
      period: OCT,
      referenceDate: '2026-10-31',
    });

    expect(status.projectedSpentInCents).toBe(3_100);
  });

  it('a subcategoria soma para o limite da mãe', () => {
    const categories = [
      category({ id: 'cat-food' }),
      category({ id: 'cat-market', parentId: 'cat-food' }),
    ];
    const status = budgetStatus({
      limit: limit({ categoryId: 'cat-food', amountInCents: 10_000 }),
      transactions: [
        tx({
          id: 't1',
          kind: 'expense',
          amountInCents: -2_000,
          date: '2026-10-05',
          accountId: 'acc-1',
          categoryId: 'cat-food',
        }),
        tx({
          id: 't2',
          kind: 'expense',
          amountInCents: -3_000,
          date: '2026-10-06',
          accountId: 'acc-1',
          categoryId: 'cat-market',
        }),
        tx({
          id: 't3',
          kind: 'expense',
          amountInCents: -9_000,
          date: '2026-10-07',
          accountId: 'acc-1',
          categoryId: 'cat-other',
        }),
      ],
      period: OCT,
      resultOptions: { categories },
    });

    expect(status.spentInCents).toBe(5_000);
    expect(status.usedPct).toBe(50);
  });

  it('o consumo do orçamento é por COMPETÊNCIA quando o regime não é indicado', () => {
    // Decisão documentada no topo de `budget.ts`: "o consumo por omissão é por
    // competência". Uma compra no cartão (não liquidada) deve contar.
    const status = budgetStatus({
      limit: limit({ categoryId: 'cat-food', amountInCents: 10_000 }),
      transactions: [
        tx({
          id: 'card',
          kind: 'expense',
          amountInCents: -10_000,
          date: '2026-10-05',
          accountId: 'acc-1',
          categoryId: 'cat-food',
          invoiceId: 'inv-1',
          settled: false,
        }),
      ],
      period: OCT,
    });

    expect(status.spentInCents).toBe(10_000);
    expect(status.usedPct).toBe(100);
    expect(status.state).toBe('exceeded');
  });

  it('budgetStatusList e budgetSummary agregam e contam os estados', () => {
    const limits = [
      limit({ categoryId: 'cat-a', amountInCents: 1_000 }),
      limit({ categoryId: 'cat-b', amountInCents: 1_000 }),
      limit({ categoryId: 'cat-c', amountInCents: 1_000 }),
    ];
    const transactions = [
      tx({
        id: 'a',
        kind: 'expense',
        amountInCents: -500,
        date: '2026-10-05',
        accountId: 'acc-1',
        categoryId: 'cat-a',
      }),
      tx({
        id: 'b',
        kind: 'expense',
        amountInCents: -800,
        date: '2026-10-05',
        accountId: 'acc-1',
        categoryId: 'cat-b',
      }),
      tx({
        id: 'c',
        kind: 'expense',
        amountInCents: -1_200,
        date: '2026-10-05',
        accountId: 'acc-1',
        categoryId: 'cat-c',
      }),
    ];

    const statuses = budgetStatusList({ limits, transactions, period: OCT });
    const summary = budgetSummary({ statuses, period: OCT });

    expect(statuses.map((status) => status.state)).toEqual(['safe', 'warning', 'exceeded']);
    expect(summary.totalInCents).toBe(3_000);
    expect(summary.allocatedInCents).toBe(3_000);
    expect(summary.spentInCents).toBe(2_500);
    expect(summary.remainingInCents).toBe(500);
    expect(summary.overBudgetCategories).toBe(1);
    expect(summary.warningCategories).toBe(1);
  });

  it('budgetSummary com total definido distinto da soma das partes fica negativo se gastar mais', () => {
    const statuses = budgetStatusList({
      limits: [limit({ categoryId: 'cat-a', amountInCents: 10_000 })],
      transactions: [
        tx({
          id: 'a',
          kind: 'expense',
          amountInCents: -4_000,
          date: '2026-10-05',
          accountId: 'acc-1',
          categoryId: 'cat-a',
        }),
      ],
      period: OCT,
    });

    const summary = budgetSummary({ statuses, totalInCents: 3_000, period: OCT });

    expect(summary.allocatedInCents).toBe(10_000);
    expect(summary.totalInCents).toBe(3_000);
    expect(summary.remainingInCents).toBe(-1_000);
  });

  it('categorias sem limite excluem ganhos, internas e as que já têm limite', () => {
    const categories = [
      category({ id: 'cat-a' }),
      category({ id: 'cat-b' }),
      category({ id: 'cat-internal', internal: true }),
      category({ id: 'cat-income', kind: 'income' }),
    ];

    expect(categoriesWithoutLimit(categories, [limit({ categoryId: 'cat-a' })])).toEqual([
      category({ id: 'cat-b' }),
    ]);
  });
});

// ===========================================================================
// 5. Faturas
// ===========================================================================

describe('5. faturas: datas de fecho e vencimento', () => {
  it('a compra no próprio dia de fecho fica na fatura desse mês', () => {
    expect(invoiceDatesFor({ purchaseDate: '2026-10-20', closingDay: 20, dueDay: 10 })).toEqual({
      closingDate: '2026-10-20',
      dueDate: '2026-11-10',
    });
  });

  it('a compra no dia seguinte ao fecho passa para a fatura do mês seguinte', () => {
    expect(invoiceDatesFor({ purchaseDate: '2026-10-21', closingDay: 20, dueDay: 10 })).toEqual({
      closingDate: '2026-11-20',
      dueDate: '2026-12-10',
    });
  });

  it('fecho no dia 31 em fevereiro é limitado ao último dia do mês', () => {
    expect(invoiceDatesFor({ purchaseDate: '2026-02-28', closingDay: 31, dueDay: 10 })).toEqual({
      closingDate: '2026-02-28',
      dueDate: '2026-03-10',
    });
  });

  it('em fevereiro, uma compra no dia 28 com fecho 30 também cai no fecho (limite do mês)', () => {
    expect(invoiceDatesFor({ purchaseDate: '2026-02-28', closingDay: 30, dueDay: 15 })).toEqual({
      closingDate: '2026-02-28',
      dueDate: '2026-03-15',
    });
  });

  it('fecho no dia 31 num mês de 30 dias usa o dia 30 como fecho', () => {
    expect(invoiceDatesFor({ purchaseDate: '2026-04-30', closingDay: 31, dueDay: 10 })).toEqual({
      closingDate: '2026-04-30',
      dueDate: '2026-05-10',
    });
  });

  it('vencimento no mesmo mês do fecho quando o dia de vencimento é posterior', () => {
    expect(invoiceDatesFor({ purchaseDate: '2026-10-05', closingDay: 20, dueDay: 25 })).toEqual({
      closingDate: '2026-10-20',
      dueDate: '2026-10-25',
    });
  });

  it('vencimento igual ao dia de fecho transita para o mês seguinte', () => {
    expect(invoiceDatesFor({ purchaseDate: '2026-10-05', closingDay: 20, dueDay: 20 })).toEqual({
      closingDate: '2026-10-20',
      dueDate: '2026-11-20',
    });
  });

  it('fecho em dezembro com vencimento no mês seguinte atravessa o ano', () => {
    expect(invoiceDatesFor({ purchaseDate: '2026-12-15', closingDay: 20, dueDay: 10 })).toEqual({
      closingDate: '2026-12-20',
      dueDate: '2027-01-10',
    });
  });
});

describe('5. faturas: totais e pagamentos', () => {
  const invoice: FinanceInvoice = {
    id: 'inv-1',
    cardId: 'card-1',
    closingDate: '2026-10-20',
    dueDate: '2026-11-10',
  };
  const purchase = tx({
    id: 'buy',
    kind: 'expense',
    amountInCents: -1_000,
    date: '2026-10-05',
    accountId: 'acc-1',
    invoiceId: 'inv-1',
  });

  it('pagamento a mais: por pagar nunca é negativo e a fatura fica paga', () => {
    const totals = invoiceTotals({
      invoice,
      transactions: [purchase],
      payments: [{ invoiceId: 'inv-1', amountInCents: 1_500, date: '2026-11-05' }],
      today: '2026-11-05',
    });

    expect(totals.totalInCents).toBe(1_000);
    expect(totals.paidInCents).toBe(1_500);
    expect(totals.outstandingInCents).toBe(0);
    expect(totals.status).toBe('paid');
    expect(carriedOverToNextInvoice(totals)).toBe(0);
  });

  it('o crédito de um pagamento a mais não transita (fica perdido)', () => {
    // Comportamento observado: os 500 cêntimos pagos a mais não aparecem em
    // lado nenhum. O documento 01 §5.5 não define crédito de pagamento — lacuna.
    const totals = invoiceTotals({
      invoice,
      transactions: [purchase],
      payments: [{ invoiceId: 'inv-1', amountInCents: 1_500, date: '2026-11-05' }],
      today: '2026-11-05',
    });

    expect(carriedOverToNextInvoice(totals)).not.toBe(-500);
    expect(totals.paidInCents - totals.totalInCents).toBe(500);
  });

  it('pagamentos parciais repetidos somam-se e o restante transita', () => {
    const totals = invoiceTotals({
      invoice,
      transactions: [purchase],
      payments: [
        { invoiceId: 'inv-1', amountInCents: 300, date: '2026-10-10' },
        { invoiceId: 'inv-1', amountInCents: 300, date: '2026-10-12' },
      ],
      today: '2026-10-15',
    });

    expect(totals.paidInCents).toBe(600);
    expect(totals.outstandingInCents).toBe(400);
    expect(carriedOverToNextInvoice(totals)).toBe(400);
    expect(totals.status).toBe('open');
  });

  it('pagamento parcial de 1 cêntimo deixa a fatura em aberto', () => {
    const totals = invoiceTotals({
      invoice,
      transactions: [purchase],
      payments: [{ invoiceId: 'inv-1', amountInCents: 1, date: '2026-10-05' }],
      today: '2026-10-10',
    });

    expect(totals.outstandingInCents).toBe(999);
    expect(totals.status).toBe('open');
  });

  it('fatura sem compras: total zero, nada por pagar, e o estado segue o fecho', () => {
    const beforeClosing = invoiceTotals({
      invoice,
      transactions: [],
      payments: [],
      today: '2026-10-19',
    });
    const onClosing = invoiceTotals({
      invoice,
      transactions: [],
      payments: [],
      today: '2026-10-20',
    });

    expect(beforeClosing.totalInCents).toBe(0);
    expect(beforeClosing.outstandingInCents).toBe(0);
    expect(beforeClosing.status).toBe('open');
    expect(onClosing.status).toBe('closed');
  });

  it('fatura só com valor transitado e sem compras', () => {
    const carried: FinanceInvoice = { ...invoice, carriedOverInCents: 2_500 };
    const totals = invoiceTotals({
      invoice: carried,
      transactions: [],
      payments: [],
      today: '2026-10-05',
    });

    expect(totals.purchasesInCents).toBe(0);
    expect(totals.carriedOverInCents).toBe(2_500);
    expect(totals.totalInCents).toBe(2_500);
    expect(totals.outstandingInCents).toBe(2_500);
    expect(totals.status).toBe('open');
  });

  it('o total nunca perde o valor transitado da fatura anterior', () => {
    const carried: FinanceInvoice = { ...invoice, carriedOverInCents: 400 };
    const totals = invoiceTotals({
      invoice: carried,
      transactions: [purchase],
      payments: [{ invoiceId: 'inv-1', amountInCents: 1_400, date: '2026-11-05' }],
      today: '2026-11-05',
    });

    expect(totals.carriedOverInCents).toBe(400);
    expect(totals.purchasesInCents).toBe(1_000);
    expect(totals.totalInCents).toBe(1_400);
    expect(totals.status).toBe('paid');
  });

  it('compra ignorada e compra de outra fatura não entram no total', () => {
    const totals = invoiceTotals({
      invoice,
      transactions: [
        purchase,
        { ...purchase, id: 'ignored', status: 'ignored' },
        { ...purchase, id: 'other', invoiceId: 'inv-2' },
      ],
      payments: [],
      today: '2026-10-05',
    });

    expect(totals.purchasesInCents).toBe(1_000);
  });

  it('uma receita com o mesmo invoiceId não é tratada como compra', () => {
    const totals = invoiceTotals({
      invoice,
      transactions: [purchase, { ...purchase, id: 'inc', kind: 'income', amountInCents: 500 }],
      payments: [],
      today: '2026-10-05',
    });

    expect(totals.purchasesInCents).toBe(1_000);
  });

  it('o estado só passa a pago quando o total é positivo e nada falta', () => {
    const totals = invoiceTotals({
      invoice,
      transactions: [purchase],
      payments: [{ invoiceId: 'inv-1', amountInCents: 1_000, date: '2026-11-05' }],
      today: '2026-11-05',
    });

    expect(totals.outstandingInCents).toBe(0);
    expect(totals.status).toBe('paid');
  });

  it('unpaidInvoices ordena por vencimento e exclui as liquidadas', () => {
    const early: FinanceInvoice = { ...invoice, id: 'inv-early', dueDate: '2026-11-05' };
    const late: FinanceInvoice = { ...invoice, id: 'inv-late', dueDate: '2026-12-05' };

    const result = unpaidInvoices({
      invoices: [late, early],
      transactions: [
        { ...purchase, id: 'p1', invoiceId: 'inv-early' },
        { ...purchase, id: 'p2', invoiceId: 'inv-late' },
      ],
      payments: [{ invoiceId: 'inv-early', amountInCents: 1_000, date: '2026-11-05' }],
      today: '2026-11-01',
    });

    expect(result.map((totals) => totals.invoiceId)).toEqual(['inv-late']);
  });
});

describe('5. faturas: repartição de parcelas', () => {
  it('um cêntimo repartido em 24 parcelas dá uma parcela de 1 e 23 de zero', () => {
    const parcels = splitInstallments(1, 24);

    expect(parcels).toHaveLength(24);
    expect(parcels[0]).toBe(1);
    expect(parcels.reduce((sum, value) => sum + value, 0)).toBe(1);
  });

  it('24 parcelas de um valor indivisível preservam a soma ao cêntimo', () => {
    const parcels = splitInstallments(1_000, 24);

    expect(parcels).toHaveLength(24);
    expect(parcels.reduce((sum, value) => sum + value, 0)).toBe(1_000);
    expect(Math.max(...parcels) - Math.min(...parcels)).toBeLessThanOrEqual(1);
  });

  it('zero repartido por N dá N zeros', () => {
    expect(splitInstallments(0, 5)).toEqual([0, 0, 0, 0, 0]);
  });

  it('uma única parcela devolve o valor total', () => {
    expect(splitInstallments(12_345, 1)).toEqual([12_345]);
  });

  it('recusa contagens inválidas em vez de devolver lixo', () => {
    expect(() => splitInstallments(1_000, 0)).toThrow(RangeError);
    expect(() => splitInstallments(1_000, -3)).toThrow(RangeError);
    expect(() => splitInstallments(1_000, 2.5)).toThrow(RangeError);
  });
});

// ===========================================================================
// 6. Objetivos
// ===========================================================================

describe('6. objetivos: casos limite', () => {
  it('objetivo sem movimentos: acumulado zero, progresso zero, sem projeção', () => {
    const progress = goalProgress({ goal: goal(), movements: [], today: '2026-10-10' });

    expect(progress.accumulatedInCents).toBe(0);
    expect(progress.progressPct).toBe(0);
    expect(progress.remainingInCents).toBe(100_000);
    expect(progress.periodsRemaining).toBe(3);
    expect(progress.requiredPerPeriodInCents).toBe(33_334);
    expect(progress.projectedCompletionDate).toBeNull();
    expect(progress.onTrack).toBe(false);
  });

  it('resgate maior do que os depósitos deixa o acumulado negativo', () => {
    const progress = goalProgress({
      goal: goal({ initialReservedInCents: 50_000 }),
      movements: [movement({ type: 'withdrawal', amountInCents: 60_000, date: '2026-09-01' })],
      today: '2026-10-10',
    });

    expect(progress.accumulatedInCents).toBe(-10_000);
    expect(progress.progressPct).toBe(-10);
    expect(progress.remainingInCents).toBe(110_000);
    expect(progress.projectedCompletionDate).toBeNull();
    expect(progress.onTrack).toBe(false);
  });

  it('um resgate que deixa o saldo exatamente a zero não é acumulado negativo', () => {
    const progress = goalProgress({
      goal: goal({ initialReservedInCents: 50_000 }),
      movements: [movement({ type: 'withdrawal', amountInCents: 50_000, date: '2026-09-01' })],
      today: '2026-10-10',
    });

    expect(progress.accumulatedInCents).toBe(0);
    expect(progress.progressPct).toBe(0);
    expect(progress.remainingInCents).toBe(100_000);
    expect(progress.onTrack).toBe(false);
  });

  it('objetivo já cumprido: 100%, nada a guardar, no prazo', () => {
    const progress = goalProgress({
      goal: goal({ initialReservedInCents: 100_000 }),
      movements: [],
      today: '2026-10-10',
    });

    expect(progress.accumulatedInCents).toBe(100_000);
    expect(progress.progressPct).toBe(100);
    expect(progress.remainingInCents).toBe(0);
    expect(progress.requiredPerPeriodInCents).toBe(0);
    expect(progress.onTrack).toBe(true);
  });

  it('objetivo sobrefinanciado: progresso acima de 100% e nada a guardar', () => {
    const progress = goalProgress({
      goal: goal({ initialReservedInCents: 150_000 }),
      movements: [],
      today: '2026-10-10',
    });

    expect(progress.progressPct).toBe(150);
    expect(progress.remainingInCents).toBe(0);
    expect(progress.requiredPerPeriodInCents).toBe(0);
    expect(progress.onTrack).toBe(true);
  });

  it('data-limite no passado: nada a guardar por período e nunca no prazo', () => {
    const progress = goalProgress({
      goal: goal({ targetDate: '2025-12-31' }),
      movements: [],
      today: '2026-10-10',
    });

    expect(progress.periodsRemaining).toBe(0);
    expect(progress.requiredPerPeriodInCents).toBe(0);
    expect(progress.remainingInCents).toBe(100_000);
    expect(progress.onTrack).toBe(false);
  });

  it('data-limite no passado com reserva parcial continua a não pedir esforço', () => {
    const progress = goalProgress({
      goal: goal({ targetDate: '2025-12-31', initialReservedInCents: 50_000 }),
      movements: [],
      today: '2026-10-10',
    });

    expect(progress.remainingInCents).toBe(50_000);
    expect(progress.requiredPerPeriodInCents).toBe(0);
    expect(progress.projectedCompletionDate).toBeNull();
  });

  it('o esforço por período arredonda sempre para cima', () => {
    const progress = goalProgress({ goal: goal(), movements: [], today: '2026-10-10' });

    // 100 000 / 3 = 33 333,33 → 33 334 (nunca a menos).
    expect(progress.requiredPerPeriodInCents).toBe(33_334);
    expect(progress.requiredPerPeriodInCents * progress.periodsRemaining).toBeGreaterThanOrEqual(
      progress.remainingInCents,
    );
  });

  it('movimentos futuros não contam para o acumulado', () => {
    const progress = goalProgress({
      goal: goal(),
      movements: [
        movement({ type: 'deposit', amountInCents: 10_000, date: '2026-10-09' }),
        movement({ type: 'deposit', amountInCents: 90_000, date: '2026-10-11' }),
      ],
      today: '2026-10-10',
    });

    expect(progress.accumulatedInCents).toBe(10_000);
  });

  it('movimentos de outro objetivo não contaminam o acumulado', () => {
    const progress = goalProgress({
      goal: goal(),
      movements: [
        movement({ goalId: 'other', type: 'deposit', amountInCents: 50_000, date: '2026-10-01' }),
      ],
      today: '2026-10-10',
    });

    expect(progress.accumulatedInCents).toBe(0);
  });

  it('rendimentos somam e resgates subtraem, sempre pela magnitude', () => {
    expect(
      movementEffectInCents({
        goalId: 'g',
        type: 'deposit',
        amountInCents: 100,
        date: '2026-01-01',
      }),
    ).toBe(100);
    expect(
      movementEffectInCents({ goalId: 'g', type: 'yield', amountInCents: 100, date: '2026-01-01' }),
    ).toBe(100);
    expect(
      movementEffectInCents({
        goalId: 'g',
        type: 'withdrawal',
        amountInCents: 100,
        date: '2026-01-01',
      }),
    ).toBe(-100);
    // Mesmo com o sinal errado nos dados, um resgate subtrai.
    expect(
      movementEffectInCents({
        goalId: 'g',
        type: 'withdrawal',
        amountInCents: -100,
        date: '2026-01-01',
      }),
    ).toBe(-100);
  });

  it('um objetivo financiado apenas com reserva inicial nunca projeta conclusão', () => {
    // `projectCompletion` exige um movimento datado para medir o ritmo; a reserva
    // inicial não é um movimento. Comportamento observado, documentado no relatório.
    const progress = goalProgress({
      goal: goal({ initialReservedInCents: 99_000 }),
      movements: [],
      today: '2026-10-10',
    });

    expect(progress.accumulatedInCents).toBe(99_000);
    expect(progress.remainingInCents).toBe(1_000);
    expect(progress.projectedCompletionDate).toBeNull();
  });

  it('meta zero é tratada como 100% e não como divisão por zero', () => {
    const progress = goalProgress({
      goal: goal({ targetAmountInCents: 0 }),
      movements: [],
      today: '2026-10-10',
    });

    expect(progress.progressPct).toBe(100);
    expect(progress.remainingInCents).toBe(0);
    expect(progress.onTrack).toBe(true);
  });

  it('periodsBetween: zero quando a data-limite é hoje ou já passou', () => {
    expect(periodsBetween('2026-10-10', '2026-10-10', 'monthly')).toBe(0);
    expect(periodsBetween('2026-10-10', '2026-10-09', 'monthly')).toBe(0);
    expect(periodsBetween('2026-10-10', '2026-10-16', 'weekly')).toBe(1);
    expect(periodsBetween('2026-10-10', '2026-10-17', 'weekly')).toBe(1);
    expect(periodsBetween('2026-10-10', '2026-10-18', 'weekly')).toBe(2);
  });

  it('periodsBetween arredonda para cima em trimestres', () => {
    expect(periodsBetween('2026-10-01', '2026-10-15', 'quarterly')).toBe(1);
    expect(periodsBetween('2026-10-01', '2027-04-01', 'quarterly')).toBe(2);
    /*
     * T7.4 — as duas asserções de `yearly` que aqui estavam
     * (`'2026-10-01' → '2027-01-01'` = 1 e `→ '2028-10-01'` = 2) foram removidas
     * com a frequência anual: verificavam apenas um valor que deixou de existir no
     * tipo, e o próprio `it` chamava-se «…em trimestres e anos». A regra que lhes
     * dava sentido — arredondar o número de períodos para cima — continua coberta
     * pelas duas asserções de trimestres, que ficaram intactas.
     */
  });

  it('goalOverview soma metas e acumulados, incluindo os negativos', () => {
    const goals = [goal({ id: 'g1' }), goal({ id: 'g2', targetAmountInCents: 50_000 })];
    const movements = [
      movement({ goalId: 'g1', type: 'deposit', amountInCents: 20_000, date: '2026-09-01' }),
      movement({ goalId: 'g2', type: 'withdrawal', amountInCents: 10_000, date: '2026-09-01' }),
    ];

    const overview = goalOverview({ goals, movements, today: '2026-10-10' });

    expect(overview.targetInCents).toBe(150_000);
    expect(overview.accumulatedInCents).toBe(10_000);
    expect(overview.goals).toHaveLength(2);
    expect(overview.onTrackCount).toBe(0);
  });
});

// ===========================================================================
// 7. Património líquido
// ===========================================================================

describe('7. património líquido: casos limite', () => {
  it('passivos maiores do que ativos dão património negativo', () => {
    const result = netWorth({
      accounts: [account({ openingBalanceInCents: 10_000 })],
      transactions: [],
      liabilities: [{ id: 'l1', outstandingInCents: 25_000 }],
    });

    expect(result.assetsInCents).toBe(10_000);
    expect(result.liabilitiesInCents).toBe(25_000);
    expect(result.netInCents).toBe(-15_000);
  });

  it('uma fatura paga sai do passivo e o património sobe', () => {
    const invoice: FinanceInvoice = {
      id: 'inv-1',
      cardId: 'card-1',
      closingDate: '2026-10-20',
      dueDate: '2026-11-10',
    };
    const purchase = tx({
      id: 'buy',
      kind: 'expense',
      amountInCents: -5_000,
      date: '2026-10-05',
      accountId: 'acc-1',
      invoiceId: 'inv-1',
      settled: false,
    });
    const accounts = [account({ openingBalanceInCents: 10_000 })];

    const unpaid = netWorth({ accounts, transactions: [purchase], invoices: [invoice] });
    const paid = netWorth({
      accounts,
      transactions: [purchase],
      invoices: [invoice],
      invoicePayments: [{ invoiceId: 'inv-1', amountInCents: 5_000, date: '2026-11-05' }],
      upTo: '2026-11-06',
    });

    expect(unpaid.liabilitiesInCents).toBe(5_000);
    expect(unpaid.netInCents).toBe(5_000);
    expect(paid.breakdown.invoicesInCents).toBe(0);
    expect(paid.netInCents).toBe(10_000);
  });

  it('pagamento parcial deixa a parte em dívida no passivo', () => {
    const invoice: FinanceInvoice = {
      id: 'inv-1',
      cardId: 'card-1',
      closingDate: '2026-10-20',
      dueDate: '2026-11-10',
    };
    const purchase = tx({
      id: 'buy',
      kind: 'expense',
      amountInCents: -5_000,
      date: '2026-10-05',
      accountId: 'acc-1',
      invoiceId: 'inv-1',
      settled: false,
    });

    const result = netWorth({
      accounts: [account()],
      transactions: [purchase],
      invoices: [invoice],
      invoicePayments: [{ invoiceId: 'inv-1', amountInCents: 2_000, date: '2026-11-05' }],
      upTo: '2026-11-06',
    });

    expect(result.breakdown.invoicesInCents).toBe(3_000);
  });

  it('o dinheiro reservado em objetivos continua a ser do utilizador (ativo)', () => {
    const withGoal = netWorth({
      accounts: [account({ openingBalanceInCents: 1_000 })],
      transactions: [],
      goals: [goal({ initialReservedInCents: 400 })],
      goalMovements: [movement({ type: 'deposit', amountInCents: 100, date: '2026-10-01' })],
    });

    expect(withGoal.breakdown.goalsInCents).toBe(500);
    expect(withGoal.netInCents).toBe(1_500);
  });

  it('um movimento futuro de objetivo não entra no acumulado com data-limite', () => {
    expect(
      goalsAccumulatedInCents({
        goals: [goal({ initialReservedInCents: 100 })],
        movements: [movement({ type: 'deposit', amountInCents: 900, date: '2026-12-01' })],
        upTo: '2026-10-31',
      }),
    ).toBe(100);
  });

  it('um passivo sem data entra no património mesmo com data-limite no passado', () => {
    // O tipo `FinanceLiability` não tem data: não há forma de o filtrar. Lacuna
    // de modelação registada no relatório.
    const result = netWorth({
      accounts: [account({ openingBalanceInCents: 1_000 })],
      transactions: [],
      liabilities: [{ id: 'l1', outstandingInCents: 400 }],
      upTo: '2000-01-01',
    });

    expect(result.liabilitiesInCents).toBe(400);
    expect(result.netInCents).toBe(600);
  });

  it('um bem sem data entra nos ativos mesmo com data-limite no passado', () => {
    const result = netWorth({
      accounts: [],
      transactions: [],
      assets: [{ id: 'a1', valueInCents: 900 }],
      upTo: '2000-01-01',
    });

    expect(result.assetsInCents).toBe(900);
  });

  it('conta arquivada sai dos ativos', () => {
    const result = netWorth({
      accounts: [
        account({ id: 'a1', openingBalanceInCents: 1_000 }),
        account({ id: 'a2', openingBalanceInCents: 9_000, archived: true }),
      ],
      transactions: [],
    });

    expect(result.breakdown.accountsInCents).toBe(1_000);
  });

  it('a data-limite filtra os movimentos das contas', () => {
    const transactions = [
      tx({
        id: 't1',
        kind: 'expense',
        amountInCents: -300,
        date: '2026-10-05',
        accountId: 'acc-1',
      }),
    ];

    expect(
      netWorth({
        accounts: [account({ openingBalanceInCents: 1_000 })],
        transactions,
        upTo: '2026-10-04',
      }).breakdown.accountsInCents,
    ).toBe(1_000);
    expect(
      netWorth({
        accounts: [account({ openingBalanceInCents: 1_000 })],
        transactions,
        upTo: '2026-10-05',
      }).breakdown.accountsInCents,
    ).toBe(700);
  });

  it('um pagamento de fatura por transação liquida o passivo (defeito corrigido)', () => {
    // A verificação adversarial encontrou aqui uma subvalorização do património:
    // a transação `invoice_payment` mexia no saldo mas não reduzia a dívida, e o
    // mesmo pagamento contava duas vezes (saldo a menos, dívida a mais). O motor
    // passou a contar também as transações de pagamento, sem duplicar as que
    // estejam ligadas a um registo por `transactionId`.
    const invoice: FinanceInvoice = {
      id: 'inv-1',
      cardId: 'card-1',
      closingDate: '2026-10-20',
      dueDate: '2026-11-10',
    };
    const purchaseTx = tx({
      id: 'buy',
      kind: 'expense',
      amountInCents: -5_000,
      date: '2026-10-05',
      accountId: 'acc-1',
      invoiceId: 'inv-1',
      settled: false,
    });
    const paymentTx = tx({
      id: 'pay',
      kind: 'invoice_payment',
      amountInCents: -5_000,
      date: '2026-11-05',
      accountId: 'acc-1',
      invoiceId: 'inv-1',
    });

    const result = netWorth({
      accounts: [account({ openingBalanceInCents: 5_000 })],
      transactions: [purchaseTx, paymentTx],
      invoices: [invoice],
      upTo: '2026-11-30',
    });

    expect(result.breakdown.accountsInCents).toBe(0);
    // Defeito corrigido: a transação de pagamento passou a liquidar a fatura.
    expect(result.breakdown.invoicesInCents).toBe(0);
    expect(result.netInCents).toBe(0);
  });

  it('a carteira vazia não inventa componentes', () => {
    const result = netWorth({ accounts: [], transactions: [] });

    expect(result.assetsInCents).toBe(0);
    expect(result.liabilitiesInCents).toBe(0);
    expect(result.netInCents).toBe(0);
    expect(result.breakdown).toEqual({
      accountsInCents: 0,
      goalsInCents: 0,
      assetsInCents: 0,
      invoicesInCents: 0,
      liabilitiesInCents: 0,
    });
  });

  it('o detalhe soma exatamente o total de ativos', () => {
    const result = netWorth({
      accounts: [account({ openingBalanceInCents: 1_000 })],
      transactions: [],
      assets: [{ id: 'a1', valueInCents: 300 }],
      goals: [goal({ initialReservedInCents: 200 })],
      liabilities: [{ id: 'l1', outstandingInCents: 700 }],
    });

    const { breakdown } = result;
    expect(breakdown.accountsInCents + breakdown.goalsInCents + breakdown.assetsInCents).toBe(
      result.assetsInCents,
    );
    expect(breakdown.invoicesInCents + breakdown.liabilitiesInCents).toBe(
      result.liabilitiesInCents,
    );
    expect(result.netInCents).toBe(result.assetsInCents - result.liabilitiesInCents);
  });
});

// ===========================================================================
// 8. Regras de categorização
// ===========================================================================

describe('8. regras: condições e validade', () => {
  it('uma regra sem nenhuma condição é inválida e nunca corresponde', () => {
    const empty = rule({ id: 'r-empty' });
    const transaction = tx({
      id: 't1',
      kind: 'expense',
      amountInCents: -1_000,
      date: '2026-10-05',
      accountId: 'acc-1',
      description: 'Supermercado',
    });

    expect(ruleHasCondition(empty)).toBe(false);
    expect(invalidRules([empty])).toEqual([empty]);
    expect(matchesRule(transaction, empty)).toBe(false);
    expect(classifyTransaction(transaction, [empty])).toBeNull();
  });

  // -------------------------------------------------------------------------
  // DIVERGÊNCIAS CONFIRMADAS (2 testes vermelhos)
  //
  // `ruleHasCondition` aceita `descriptionContains: ''` e `counterparty: ''`
  // como condições, mas `matchesRule` trata a descrição vazia como "sem
  // restrição" (`needle.length > 0`) e a contraparte vazia como igual a "sem
  // contraparte". Resultado: uma regra que devia ser inválida passa a
  // `catch-all` e categoriza tudo o que seja do mesmo tipo — e
  // `invalidRules`/a interface nunca a assinalam.
  //
  // §5.7 (documento 01): "O sistema de referência exige pelo menos uma condição"
  // e o comentário de `rules.ts` repete-o. Uma condição que não restringe nada
  // não é uma condição. Estas duas expectativas ficam vermelhas de propósito:
  // são BUG DO MOTOR, não arredondar para verde.
  // -------------------------------------------------------------------------

  it('[BUG] texto de condição vazio não é uma condição válida', () => {
    const blankDescription = rule({ id: 'r-blank', descriptionContains: '' });

    expect(ruleHasCondition(blankDescription)).toBe(false);
  });

  it('[BUG] contraparte vazia não é uma condição válida', () => {
    const blankCounterparty = rule({ id: 'r-blank', counterparty: '' });

    expect(ruleHasCondition(blankCounterparty)).toBe(false);
  });

  it('texto de condição vazio não é condição válida (defeito corrigido)', () => {
    const blankDescription = rule({ id: 'r-blank', descriptionContains: '' });
    const anything = tx({
      id: 't1',
      kind: 'expense',
      amountInCents: -777,
      date: '2026-10-05',
      accountId: 'acc-1',
      description: 'Seja o que for',
    });

    expect(ruleHasCondition(blankDescription)).toBe(false);
    expect(invalidRules([blankDescription])).toEqual([blankDescription]);
    expect(matchesRule(anything, blankDescription)).toBe(false);
    expect(classifyTransaction(anything, [blankDescription])).toBeNull();
  });

  it('contraparte vazia não captura o que não tem contraparte (defeito corrigido)', () => {
    const blankCounterparty = rule({ id: 'r-blank', counterparty: '' });
    const withoutCounterparty = tx({
      id: 't1',
      kind: 'expense',
      amountInCents: -777,
      date: '2026-10-05',
      accountId: 'acc-1',
      description: 'Sem contraparte',
    });
    const withCounterparty = { ...withoutCounterparty, id: 't2', counterparty: 'PT500123456' };

    expect(ruleHasCondition(blankCounterparty)).toBe(false);
    expect(matchesRule(withoutCounterparty, blankCounterparty)).toBe(false);
    expect(matchesRule(withCounterparty, blankCounterparty)).toBe(false);
  });

  it('condições contraditórias (mínimo > máximo) tornam a regra insatisfazível', () => {
    const contradictory = rule({
      id: 'r-contradictory',
      amountMinInCents: 1_000,
      amountMaxInCents: 100,
    });

    // Tem condições (não é "sem condição"), mas nenhum montante as satisfaz.
    expect(ruleHasCondition(contradictory)).toBe(true);
    expect(invalidRules([contradictory])).toEqual([]);

    for (const magnitude of [0, 50, 100, 500, 1_000, 5_000]) {
      const transaction = tx({
        id: 't',
        kind: 'expense',
        amountInCents: -magnitude,
        date: '2026-10-05',
        accountId: 'acc-1',
      });
      expect(matchesRule(transaction, contradictory)).toBe(false);
    }
  });

  it('dia mínimo maior que o dia máximo também nunca corresponde', () => {
    const contradictory = rule({ id: 'r-days', dayMin: 20, dayMax: 5 });
    const transactions = ['01', '10', '20', '28'].map((day) =>
      tx({
        id: `t${day}`,
        kind: 'expense',
        amountInCents: -100,
        date: `2026-10-${day}`,
        accountId: 'acc-1',
      }),
    );

    for (const transaction of transactions) {
      expect(matchesRule(transaction, contradictory)).toBe(false);
    }
  });

  it('duas regras com a mesma prioridade são resolvidas pela ordem declarada', () => {
    const first = rule({
      id: 'r-first',
      priority: 5,
      targetCategoryId: 'cat-1',
      descriptionContains: 'luz',
    });
    const second = rule({
      id: 'r-second',
      priority: 5,
      targetCategoryId: 'cat-2',
      descriptionContains: 'luz',
    });
    const transaction = tx({
      id: 't1',
      kind: 'expense',
      amountInCents: -100,
      date: '2026-10-05',
      accountId: 'acc-1',
      description: 'Luz',
    });

    expect(classifyTransaction(transaction, [first, second])?.ruleId).toBe('r-first');
    expect(classifyTransaction(transaction, [second, first])?.ruleId).toBe('r-second');
  });

  it('a prioridade mais baixa ganha mesmo declarada depois', () => {
    const high = rule({
      id: 'r-10',
      priority: 10,
      descriptionContains: 'luz',
      targetCategoryId: 'cat-10',
    });
    const low = rule({
      id: 'r-1',
      priority: 1,
      descriptionContains: 'luz',
      targetCategoryId: 'cat-1',
    });
    const transaction = tx({
      id: 't1',
      kind: 'expense',
      amountInCents: -100,
      date: '2026-10-05',
      accountId: 'acc-1',
      description: 'Luz',
    });

    expect(classifyTransaction(transaction, [high, low])?.ruleId).toBe('r-1');
  });

  it('prioridades negativas são respeitadas', () => {
    const negative = rule({
      id: 'r-neg',
      priority: -1,
      descriptionContains: 'luz',
      targetCategoryId: 'cat-neg',
    });
    const zero = rule({
      id: 'r-zero',
      priority: 0,
      descriptionContains: 'luz',
      targetCategoryId: 'cat-zero',
    });
    const transaction = tx({
      id: 't1',
      kind: 'expense',
      amountInCents: -100,
      date: '2026-10-05',
      accountId: 'acc-1',
      description: 'Luz',
    });

    expect(classifyTransaction(transaction, [zero, negative])?.ruleId).toBe('r-neg');
  });

  it('a ordenação das regras não altera o array recebido (pré-visualização pura)', () => {
    const rules = [
      rule({ id: 'r-10', priority: 10, descriptionContains: 'luz' }),
      rule({ id: 'r-1', priority: 1, descriptionContains: 'luz' }),
    ];
    const snapshot = rules.map((item) => item.id);

    previewClassification(
      [
        tx({
          id: 't1',
          kind: 'expense',
          amountInCents: -100,
          date: '2026-10-05',
          accountId: 'acc-1',
          description: 'Luz',
        }),
      ],
      rules,
    );

    expect(rules.map((item) => item.id)).toEqual(snapshot);
  });
});

describe('8. regras: correspondência de texto', () => {
  const transaction = (overrides: Partial<FinanceTransaction> = {}): FinanceTransaction =>
    tx({
      id: 't1',
      kind: 'expense',
      amountInCents: -100,
      date: '2026-10-05',
      accountId: 'acc-1',
      ...overrides,
    });

  it('normaliza acentos, maiúsculas e espaços nas pontas', () => {
    const luz = rule({ id: 'r1', descriptionContains: '  PAGAMENTO SERVIÇOS  ' });

    expect(normalizeText('  PAGAMENTO SERVIÇOS  ')).toBe('pagamento servicos');
    expect(matchesRule(transaction({ description: 'pagamento servicos mensalidade' }), luz)).toBe(
      true,
    );
    expect(matchesRule(transaction({ description: 'PAGAMENTO SERVIÇOS' }), luz)).toBe(true);
  });

  it('encontra o texto no meio da descrição', () => {
    const rule1 = rule({ id: 'r1', descriptionContains: 'continente' });

    expect(matchesRule(transaction({ description: 'COMPRA CONTINENTE MATOSINHOS' }), rule1)).toBe(
      true,
    );
    expect(matchesRule(transaction({ description: 'COMPRA PINGO DOCE' }), rule1)).toBe(false);
  });

  it('uma transação sem descrição não corresponde a um filtro de texto', () => {
    const rule1 = rule({ id: 'r1', descriptionContains: 'luz' });

    expect(matchesRule(transaction({ description: undefined }), rule1)).toBe(false);
    expect(matchesRule(transaction({}), rule1)).toBe(false);
  });

  it('uma transação sem descrição ainda corresponde por outras condições', () => {
    const byAccount = rule({ id: 'r1', accountId: 'acc-1' });
    const byRange = rule({ id: 'r2', amountMinInCents: 50, amountMaxInCents: 150 });
    const noDescription = transaction({ description: undefined });

    expect(matchesRule(noDescription, byAccount)).toBe(true);
    expect(matchesRule(noDescription, byRange)).toBe(true);
  });

  it('a contraparte também é normalizada', () => {
    const rule1 = rule({ id: 'r1', counterparty: ' PT500123456 ' });

    expect(matchesRule(transaction({ counterparty: 'pt500123456' }), rule1)).toBe(true);
    expect(matchesRule(transaction({ counterparty: 'PT999999999' }), rule1)).toBe(false);
    expect(matchesRule(transaction({ counterparty: undefined }), rule1)).toBe(false);
  });

  it('a faixa de valores usa a magnitude, não o sinal', () => {
    const rule1 = rule({ id: 'r1', amountMinInCents: 4_000, amountMaxInCents: 6_000 });

    expect(matchesRule(transaction({ amountInCents: -5_000 }), rule1)).toBe(true);
    expect(matchesRule(transaction({ amountInCents: 5_000 }), rule1)).toBe(true);
    expect(matchesRule(transaction({ amountInCents: -3_999 }), rule1)).toBe(false);
    expect(matchesRule(transaction({ amountInCents: -6_001 }), rule1)).toBe(false);
  });

  it('os limites de valor são inclusivos nas duas pontas', () => {
    const rule1 = rule({ id: 'r1', amountMinInCents: 4_000, amountMaxInCents: 6_000 });

    expect(matchesRule(transaction({ amountInCents: -4_000 }), rule1)).toBe(true);
    expect(matchesRule(transaction({ amountInCents: -6_000 }), rule1)).toBe(true);
  });

  it('o intervalo de dias é inclusivo e o dia vem da data de calendário', () => {
    const rule1 = rule({ id: 'r1', dayMin: 1, dayMax: 5 });

    expect(matchesRule(transaction({ date: '2026-10-01' }), rule1)).toBe(true);
    expect(matchesRule(transaction({ date: '2026-10-05' }), rule1)).toBe(true);
    expect(matchesRule(transaction({ date: '2026-10-06' }), rule1)).toBe(false);
  });

  it('uma regra sem condições de texto mas com conta corresponde só nessa conta', () => {
    const rule1 = rule({ id: 'r1', accountId: 'acc-1' });

    expect(matchesRule(transaction({ accountId: 'acc-1' }), rule1)).toBe(true);
    expect(matchesRule(transaction({ accountId: 'acc-2' }), rule1)).toBe(false);
  });

  it('condições combinam-se por conjunção: uma falha derruba tudo', () => {
    const rule1 = rule({
      id: 'r1',
      descriptionContains: 'luz',
      amountMinInCents: 5_000,
      accountId: 'acc-1',
    });

    expect(matchesRule(transaction({ description: 'Luz', amountInCents: -6_000 }), rule1)).toBe(
      true,
    );
    expect(matchesRule(transaction({ description: 'Luz', amountInCents: -4_000 }), rule1)).toBe(
      false,
    );
    expect(matchesRule(transaction({ description: 'Água', amountInCents: -6_000 }), rule1)).toBe(
      false,
    );
  });
});

describe('8. regras: tipos e estados', () => {
  const base = tx({
    id: 't1',
    kind: 'expense',
    amountInCents: -100,
    date: '2026-10-05',
    accountId: 'acc-1',
    description: 'Supermercado',
  });
  const catchAll = rule({ id: 'r-all', accountId: 'acc-1' });

  it('transferências, pagamentos de fatura, objetivos e ajustes nunca são categorizados', () => {
    for (const kind of [
      'transfer',
      'invoice_payment',
      'goal_deposit',
      'goal_withdrawal',
      'balance_adjust',
    ] as const) {
      expect(matchesRule({ ...base, kind }, catchAll), `tipo ${kind}`).toBe(false);
    }
  });

  it('uma regra de gasto não categoriza um ganho e vice-versa', () => {
    const expenseRule = rule({ id: 'r-e', kind: 'expense', accountId: 'acc-1' });
    const incomeRule = rule({ id: 'r-i', kind: 'income', accountId: 'acc-1' });

    expect(matchesRule({ ...base, kind: 'income' }, expenseRule)).toBe(false);
    expect(matchesRule(base, incomeRule)).toBe(false);
  });

  it('uma transação ignorada nunca é categorizada', () => {
    expect(matchesRule({ ...base, status: 'ignored' }, catchAll)).toBe(false);
    expect(matchesRule({ ...base, status: 'pending' }, catchAll)).toBe(true);
  });

  it('a razão devolvida identifica a regra e a prioridade', () => {
    const match = classifyTransaction(base, [
      rule({ id: 'r1', name: 'Mercado', priority: 7, accountId: 'acc-1' }),
    ]);

    expect(match).toEqual({
      transactionId: 't1',
      ruleId: 'r1',
      ruleName: 'Mercado',
      categoryId: 'cat-destino',
      reason: 'Regra "Mercado" (prioridade 7)',
    });
  });

  it('previewClassification devolve só o que corresponde, pela ordem das transações', () => {
    const rules = [rule({ id: 'r1', descriptionContains: 'luz' })];
    const preview = previewClassification(
      [
        tx({
          id: 't1',
          kind: 'expense',
          amountInCents: -100,
          date: '2026-10-05',
          accountId: 'acc-1',
          description: 'Luz',
        }),
        tx({
          id: 't2',
          kind: 'expense',
          amountInCents: -100,
          date: '2026-10-06',
          accountId: 'acc-1',
          description: 'Água',
        }),
        tx({
          id: 't3',
          kind: 'expense',
          amountInCents: -100,
          date: '2026-10-07',
          accountId: 'acc-1',
          description: 'Luz do vizinho',
        }),
      ],
      rules,
    );

    expect(preview.map((match) => match.transactionId)).toEqual(['t1', 't3']);
  });
});

// ===========================================================================
// 9. Invariantes e propriedades (loops determinísticos)
// ===========================================================================

describe('9. invariantes', () => {
  it('a soma das parcelas é sempre exatamente o total (500 combinações)', () => {
    const random = makeRandom(20_261_010);

    for (let index = 0; index < 500; index += 1) {
      const amount = randomInt(random, 0, 1_000_000);
      const count = randomInt(random, 1, 24);

      const parcels = splitInstallments(amount, count);

      expect(parcels, `valor ${amount} em ${count} parcelas`).toHaveLength(count);
      expect(
        parcels.reduce((sum, value) => sum + value, 0),
        `valor ${amount} em ${count} parcelas`,
      ).toBe(amount);
      expect(parcels.every((value) => Number.isInteger(value) && value >= 0)).toBe(true);
      expect(parcels.every((value) => Math.abs(value - amount / count) <= 1)).toBe(true);
    }
  });

  it('entradas − saídas é sempre igual ao líquido (300 conjuntos aleatórios, nos dois regimes)', () => {
    const random = makeRandom(772_311);
    const categories = [category({ id: 'cat-internal', kind: 'expense', internal: true })];

    for (let index = 0; index < 300; index += 1) {
      const transactions: FinanceTransaction[] = Array.from(
        { length: randomInt(random, 0, 12) },
        (_, position) => {
          const kind = (
            ['expense', 'income', 'transfer', 'invoice_payment', 'balance_adjust'] as const
          )[randomInt(random, 0, 4)]!;
          const magnitude = randomInt(random, 1, 50_000);
          const outflow = randomInt(random, 0, 1) === 0;
          const day = String(randomInt(random, 1, 28)).padStart(2, '0');

          return tx({
            id: `t${index}-${position}`,
            kind,
            amountInCents: outflow ? -magnitude : magnitude,
            date: `2026-10-${day}`,
            accountId: 'acc-1',
            categoryId: randomInt(random, 0, 1) === 0 ? 'cat-internal' : 'cat-other',
            invoiceId: randomInt(random, 0, 1) === 0 ? 'inv-1' : undefined,
            settled: randomInt(random, 0, 1) === 0,
            status: (['confirmed', 'pending', 'ignored'] as const)[randomInt(random, 0, 2)]!,
          });
        },
      );

      for (const basis of ['cash', 'accrual'] as const) {
        const result = monthlyResult(transactions, OCT, { basis, categories });
        expect(result.netInCents).toBe(result.incomeInCents - result.expenseInCents);
        expect(Number.isInteger(result.incomeInCents)).toBe(true);
        expect(Number.isInteger(result.expenseInCents)).toBe(true);
        expect(result.incomeInCents).toBeGreaterThanOrEqual(0);
        expect(result.expenseInCents).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('a soma dos saldos por conta é sempre igual ao saldo total (300 datas-limite aleatórias)', () => {
    const random = makeRandom(1_234_567);
    const accounts = [
      account({ id: 'a1', openingBalanceInCents: 10_000 }),
      account({ id: 'a2', openingBalanceInCents: -3_000 }),
      account({ id: 'a3', openingBalanceInCents: 0, archived: true }),
    ];

    for (let index = 0; index < 300; index += 1) {
      const transactions: FinanceTransaction[] = Array.from(
        { length: randomInt(random, 0, 10) },
        (_, position) =>
          tx({
            id: `t${index}-${position}`,
            kind: 'expense',
            amountInCents: -randomInt(random, 1, 9_999),
            date: `2026-10-${String(randomInt(random, 1, 28)).padStart(2, '0')}`,
            accountId: accounts[randomInt(random, 0, 2)]!.id,
            settled: randomInt(random, 0, 1) === 0,
            status: randomInt(random, 0, 4) === 0 ? 'ignored' : 'confirmed',
          }),
      );
      const upTo = `2026-10-${String(randomInt(random, 1, 28)).padStart(2, '0')}`;

      const perAccount = balanceByAccount(accounts, transactions, { upTo });
      const sum = perAccount.reduce((total, item) => total + item.balanceInCents, 0);

      expect(sum).toBe(totalBalanceInCents(accounts, transactions, { upTo }));
    }
  });

  it('o saldo de uma conta é sempre a soma das linhas elegíveis (referência independente)', () => {
    const random = makeRandom(9_999);
    const acc = account({ id: 'a1', openingBalanceInCents: 4_242 });

    for (let index = 0; index < 300; index += 1) {
      const transactions: FinanceTransaction[] = Array.from(
        { length: randomInt(random, 0, 8) },
        (_, position) =>
          tx({
            id: `t${index}-${position}`,
            kind: 'expense',
            amountInCents: -randomInt(random, 1, 5_000),
            date: `2026-10-${String(randomInt(random, 1, 28)).padStart(2, '0')}`,
            accountId: randomInt(random, 0, 1) === 0 ? 'a1' : 'a2',
            settled: randomInt(random, 0, 1) === 0,
            status: randomInt(random, 0, 4) === 0 ? 'ignored' : 'confirmed',
          }),
      );
      const upTo = `2026-10-${String(randomInt(random, 1, 28)).padStart(2, '0')}`;

      const expected =
        4_242 +
        transactions
          .filter(
            (item) =>
              item.accountId === 'a1' &&
              item.settled &&
              item.status !== 'ignored' &&
              item.date <= upTo,
          )
          .reduce((total, item) => total + item.amountInCents, 0);

      expect(accountBalanceInCents(acc, transactions, { upTo })).toBe(expected);
    }
  });

  it('o total da fatura é sempre compras + transitado, e o que falta nunca excede o total', () => {
    const random = makeRandom(555_555);

    for (let index = 0; index < 200; index += 1) {
      const invoice: FinanceInvoice = {
        id: 'inv-1',
        cardId: 'card-1',
        closingDate: '2026-10-20',
        dueDate: '2026-11-10',
        carriedOverInCents: randomInt(random, 0, 5_000),
      };
      const purchaseCount = randomInt(random, 0, 6);
      const transactions: FinanceTransaction[] = Array.from(
        { length: purchaseCount },
        (_, position) =>
          tx({
            id: `t${position}`,
            kind: 'expense',
            amountInCents: -randomInt(random, 1, 10_000),
            date: '2026-10-05',
            accountId: 'acc-1',
            invoiceId: 'inv-1',
          }),
      );
      const payments: FinanceInvoicePayment[] = Array.from(
        { length: randomInt(random, 0, 3) },
        (_, position) => ({
          invoiceId: 'inv-1',
          amountInCents: randomInt(random, 0, 8_000),
          date: `2026-11-0${position + 1}`,
        }),
      );

      const totals = invoiceTotals({ invoice, transactions, payments, today: '2026-11-15' });

      expect(totals.totalInCents).toBe(totals.purchasesInCents + totals.carriedOverInCents);
      expect(totals.purchasesInCents).toBeGreaterThanOrEqual(0);
      expect(totals.outstandingInCents).toBeGreaterThanOrEqual(0);
      expect(totals.outstandingInCents).toBeLessThanOrEqual(totals.totalInCents);
      // O pago passou a incluir também as transações de pagamento, por isso a
      // soma dos registos é um limite inferior, não uma igualdade.
      expect(totals.paidInCents).toBeGreaterThanOrEqual(
        payments.reduce((sum, payment) => sum + payment.amountInCents, 0),
      );
      expect(carriedOverToNextInvoice(totals)).toBe(totals.outstandingInCents);
    }
  });

  it('o acumulado dos objetivos é sempre o reservado inicial mais o efeito dos movimentos', () => {
    const random = makeRandom(31_337);

    for (let index = 0; index < 200; index += 1) {
      const goals = [goal({ id: 'g1' }), goal({ id: 'g2' })];
      const movements: FinanceGoalMovement[] = Array.from(
        { length: randomInt(random, 0, 8) },
        (_, _position) => ({
          goalId: randomInt(random, 0, 1) === 0 ? 'g1' : 'g2',
          type: (['deposit', 'withdrawal', 'yield'] as const)[randomInt(random, 0, 2)]!,
          amountInCents: randomInt(random, 1, 20_000),
          date: `2026-10-${String(randomInt(random, 1, 28)).padStart(2, '0')}`,
        }),
      );
      const upTo = `2026-10-${String(randomInt(random, 1, 28)).padStart(2, '0')}`;

      const expected = movements
        .filter((item) => item.date <= upTo)
        .reduce((sum, item) => sum + movementEffectInCents(item), 0);

      expect(
        goalsAccumulatedInCents({
          goals: goals.map((item) => ({ ...item, initialReservedInCents: 0 })),
          movements,
          upTo,
        }),
      ).toBe(expected);
    }
  });

  it('as propriedades do património líquido fecham em conjuntos aleatórios', () => {
    const random = makeRandom(2_024_1010);

    for (let index = 0; index < 200; index += 1) {
      const accounts = [
        account({ id: 'a1', openingBalanceInCents: randomInt(random, 0, 100_000) }),
      ];
      const transactions: FinanceTransaction[] = Array.from(
        { length: randomInt(random, 0, 6) },
        (_, position) =>
          tx({
            id: `t${position}`,
            kind: 'expense',
            amountInCents: -randomInt(random, 1, 10_000),
            date: `2026-10-${String(randomInt(random, 1, 28)).padStart(2, '0')}`,
            accountId: 'a1',
          }),
      );
      const liabilities: FinanceLiability[] = Array.from(
        { length: randomInt(random, 0, 2) },
        (_, position) => ({
          id: `l${position}`,
          outstandingInCents: randomInt(random, 0, 30_000),
        }),
      );

      const result = netWorth({ accounts, transactions, liabilities });

      expect(result.netInCents).toBe(result.assetsInCents - result.liabilitiesInCents);
      expect(result.breakdown.accountsInCents).toBe(
        accountBalanceInCents(accounts[0]!, transactions),
      );
      expect(result.breakdown.liabilitiesInCents).toBe(
        liabilities.reduce((sum, item) => sum + item.outstandingInCents, 0),
      );
    }
  });

  it('a série mensal cobre exatamente o intervalo, sem sobreposições nem buracos', () => {
    const random = makeRandom(424_242);
    const transactions: FinanceTransaction[] = Array.from({ length: 200 }, (_, position) =>
      tx({
        id: `t${position}`,
        kind: 'expense',
        amountInCents: -100,
        date: addDays('2026-01-01', randomInt(random, 0, 364)),
        accountId: 'acc-1',
      }),
    );

    for (const monthStartDay of [1, 15, 25, 28]) {
      const series = resultSeries(transactions, '2026-01-01', '2026-12-31', { monthStartDay });
      const total = series.reduce((sum, period) => sum + period.expenseInCents, 0);

      const insideRange = transactions.filter(
        (transaction) => transaction.date >= '2026-01-01' && transaction.date <= '2026-12-31',
      ).length;

      expect(total, `início no dia ${monthStartDay}`).toBe(insideRange * 100);
    }
  });

  it('a aritmética de datas continua coerente em meses de 28 a 31 dias', () => {
    const cases: Array<[string, string, number]> = [
      ['2026-01-31', '2026-02-01', 1],
      ['2026-02-28', '2026-03-01', 1],
      ['2026-04-30', '2026-05-01', 1],
      ['2026-12-31', '2027-01-01', 1],
    ];

    for (const [from, to, expected] of cases) {
      expect(daysBetween(from, to), `${from} → ${to}`).toBe(expected);
      expect(addDays(from, 1)).toBe(to);
    }

    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-03-31', 1)).toBe('2026-04-30');
    expect(addMonths('2026-01-31', 13)).toBe('2027-02-28');
  });
});
