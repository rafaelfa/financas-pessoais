import { describe, expect, it } from 'vitest';

import { goalsAccumulatedInCents, netWorth } from '../netWorth';
import type {
  FinanceAccount,
  FinanceAsset,
  FinanceGoal,
  FinanceGoalMovement,
  FinanceInvoice,
  FinanceLiability,
  FinanceTransaction,
} from '../types';

const CHECKING: FinanceAccount = { id: 'acc-checking', openingBalanceInCents: 200_000 };
const SAVINGS: FinanceAccount = { id: 'acc-savings', openingBalanceInCents: 500_000 };
const GOAL: FinanceGoal = {
  id: 'goal-trip',
  targetAmountInCents: 300_000,
  initialReservedInCents: 50_000,
  targetDate: '2027-04-01',
  contributionFrequency: 'monthly',
};
const INVOICE: FinanceInvoice = {
  id: 'inv-1',
  cardId: 'card-1',
  closingDate: '2026-10-20',
  dueDate: '2026-11-10',
};

const TRANSACTIONS: FinanceTransaction[] = [
  {
    id: 'salary',
    kind: 'income',
    status: 'confirmed',
    amountInCents: 50_000,
    date: '2026-10-01',
    accountId: CHECKING.id,
    categoryId: 'cat-salary',
    settled: true,
  },
  {
    id: 'transfer-out',
    kind: 'transfer',
    status: 'confirmed',
    amountInCents: -100_000,
    date: '2026-10-02',
    accountId: CHECKING.id,
    settled: true,
    transferGroupId: 'pair-1',
  },
  {
    id: 'transfer-in',
    kind: 'transfer',
    status: 'confirmed',
    amountInCents: 100_000,
    date: '2026-10-02',
    accountId: SAVINGS.id,
    settled: true,
    transferGroupId: 'pair-1',
  },
  {
    id: 'card-purchase',
    kind: 'expense',
    status: 'confirmed',
    amountInCents: -20_000,
    date: '2026-10-05',
    accountId: CHECKING.id,
    categoryId: 'cat-food',
    invoiceId: INVOICE.id,
    settled: false,
  },
];

const MOVEMENTS: FinanceGoalMovement[] = [
  { goalId: GOAL.id, type: 'deposit', amountInCents: 100_000, date: '2026-09-01' },
];

const ASSETS: FinanceAsset[] = [{ id: 'car', valueInCents: 1_500_000 }];
const LIABILITIES: FinanceLiability[] = [{ id: 'loan', outstandingInCents: 400_000 }];

describe('valor acumulado nos objetivos', () => {
  it('soma o reservado inicial e os movimentos até à data', () => {
    expect(
      goalsAccumulatedInCents({ goals: [GOAL], movements: MOVEMENTS, upTo: '2026-10-10' }),
    ).toBe(150_000);

    expect(
      goalsAccumulatedInCents({ goals: [GOAL], movements: MOVEMENTS, upTo: '2026-08-31' }),
    ).toBe(50_000);
  });
});

describe('património líquido', () => {
  const result = netWorth({
    accounts: [CHECKING, SAVINGS],
    transactions: TRANSACTIONS,
    assets: ASSETS,
    liabilities: LIABILITIES,
    invoices: [INVOICE],
    goals: [GOAL],
    goalMovements: MOVEMENTS,
    upTo: '2026-10-10',
  });

  it('soma contas, objetivos e bens nos ativos', () => {
    expect(result.breakdown.accountsInCents).toBe(750_000);
    expect(result.breakdown.goalsInCents).toBe(150_000);
    expect(result.breakdown.assetsInCents).toBe(1_500_000);
    expect(result.assetsInCents).toBe(2_400_000);
  });

  it('soma faturas por pagar e passivos manuais', () => {
    expect(result.breakdown.invoicesInCents).toBe(20_000);
    expect(result.breakdown.liabilitiesInCents).toBe(400_000);
    expect(result.liabilitiesInCents).toBe(420_000);
  });

  it('devolve ativos menos passivos', () => {
    expect(result.netInCents).toBe(1_980_000);
  });

  it('não perde o dinheiro reservado em objetivos', () => {
    const withoutGoals = netWorth({
      accounts: [CHECKING, SAVINGS],
      transactions: TRANSACTIONS,
      assets: ASSETS,
      liabilities: LIABILITIES,
      invoices: [INVOICE],
    });

    expect(withoutGoals.netInCents).toBe(1_830_000);
  });

  it('exclui faturas já pagas do passivo', () => {
    const paid = netWorth({
      accounts: [CHECKING, SAVINGS],
      transactions: TRANSACTIONS,
      invoices: [INVOICE],
      invoicePayments: [{ invoiceId: INVOICE.id, amountInCents: 20_000, date: '2026-10-30' }],
      upTo: '2026-10-10',
    });

    expect(paid.liabilitiesInCents).toBe(0);
  });

  it('trata uma carteira vazia como património zero', () => {
    const empty = netWorth({ accounts: [], transactions: [] });

    expect(empty.netInCents).toBe(0);
    expect(empty.breakdown).toEqual({
      accountsInCents: 0,
      goalsInCents: 0,
      assetsInCents: 0,
      invoicesInCents: 0,
      liabilitiesInCents: 0,
    });
  });
});
