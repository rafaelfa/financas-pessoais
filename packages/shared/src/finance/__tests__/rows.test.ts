import { describe, expect, it } from 'vitest';

import {
  toAccountingBasis,
  toCategoryKind,
  toFinanceAccount,
  toFinanceCategory,
  toFinanceTransaction,
  toIsoDate,
  toTransactionKind,
  toTransactionStatus,
  type TransactionRow,
} from '../rows';

/**
 * Testes da fronteira de armazenamento.
 *
 * Esta é a camada onde um erro contamina tudo o resto: um sinal trocado, um
 * enum mal convertido ou uma data deslocada um dia aparecem depois como saldos
 * errados, e o utilizador deixa de confiar na aplicação.
 */

function row(overrides: Partial<TransactionRow> = {}): TransactionRow {
  return {
    id: 't1',
    kind: 'EXPENSE',
    status: 'CONFIRMED',
    amountInCents: -2_490,
    date: new Date(Date.UTC(2026, 9, 5)),
    description: 'Compra no Continente',
    financialAccountId: 'acc-1',
    categoryId: 'cat-food',
    invoiceId: null,
    goalId: null,
    transferGroupId: null,
    settled: true,
    ...overrides,
  };
}

describe('conversão de datas', () => {
  it('devolve a data de calendário sem deslocação de fuso', () => {
    // Meia-noite UTC: em Lisboa é a mesma data, e é isso que tem de sair.
    expect(toIsoDate(new Date(Date.UTC(2026, 9, 5)))).toBe('2026-10-05');
    expect(toIsoDate(new Date(Date.UTC(2026, 0, 1)))).toBe('2026-01-01');
    expect(toIsoDate(new Date(Date.UTC(2026, 11, 31)))).toBe('2026-12-31');
  });
});

describe('conversão de enums', () => {
  it('converte os tipos de transação', () => {
    expect(toTransactionKind('EXPENSE')).toBe('expense');
    expect(toTransactionKind('INCOME')).toBe('income');
    expect(toTransactionKind('TRANSFER')).toBe('transfer');
    expect(toTransactionKind('INVOICE_PAYMENT')).toBe('invoice_payment');
    expect(toTransactionKind('GOAL_DEPOSIT')).toBe('goal_deposit');
    expect(toTransactionKind('GOAL_WITHDRAWAL')).toBe('goal_withdrawal');
    expect(toTransactionKind('BALANCE_ADJUST')).toBe('balance_adjust');
  });

  it('lança num tipo desconhecido em vez de continuar com um valor por omissão', () => {
    // Continuar com 'expense' somaria dinheiro no sítio errado, em silêncio.
    expect(() => toTransactionKind('SOMETHING_NEW')).toThrow(/desconhecido/);
  });

  it('converte os estados e lança num estado desconhecido', () => {
    expect(toTransactionStatus('PENDING')).toBe('pending');
    expect(toTransactionStatus('CONFIRMED')).toBe('confirmed');
    expect(toTransactionStatus('IGNORED')).toBe('ignored');
    expect(() => toTransactionStatus('ARCHIVED')).toThrow(/desconhecido/);
  });

  it('converte o regime e o tipo de categoria', () => {
    expect(toAccountingBasis('ACCRUAL')).toBe('accrual');
    expect(toAccountingBasis('CASH')).toBe('cash');
    expect(toAccountingBasis('qualquer-coisa')).toBe('cash');
    expect(toCategoryKind('INCOME')).toBe('income');
    expect(toCategoryKind('EXPENSE')).toBe('expense');
  });
});

describe('conversão de uma transação', () => {
  it('preserva o sinal, que é a informação mais fácil de perder', () => {
    expect(toFinanceTransaction(row({ amountInCents: -2_490 })).amountInCents).toBe(-2_490);
    expect(toFinanceTransaction(row({ amountInCents: 125_000 })).amountInCents).toBe(125_000);
    expect(toFinanceTransaction(row({ amountInCents: 0 })).amountInCents).toBe(0);
  });

  it('converte os campos opcionais nulos em ausentes', () => {
    const transaction = toFinanceTransaction(
      row({
        description: null,
        categoryId: null,
        invoiceId: null,
        goalId: null,
        transferGroupId: null,
      }),
    );

    expect(transaction.description).toBeUndefined();
    expect(transaction.categoryId).toBeUndefined();
    expect(transaction.invoiceId).toBeUndefined();
    expect(transaction.goalId).toBeUndefined();
    expect(transaction.transferGroupId).toBeUndefined();
  });

  it('mantém o que existe, incluindo a ligação ao par de transferência', () => {
    const transaction = toFinanceTransaction(
      row({ kind: 'TRANSFER', transferGroupId: 'grupo-1', amountInCents: -10_000 }),
    );

    expect(transaction.kind).toBe('transfer');
    expect(transaction.transferGroupId).toBe('grupo-1');
    expect(transaction.id).toBe('t1');
    expect(transaction.date).toBe('2026-10-05');
    expect(transaction.settled).toBe(true);
  });

  it('dá conta vazia a uma transação órfã, sem inventar uma conta', () => {
    const transaction = toFinanceTransaction(row({ financialAccountId: null }));

    // A história mantém-se (conta para o resultado) mas não pertence a saldo nenhum.
    expect(transaction.accountId).toBe('');
    expect(transaction.amountInCents).toBe(-2_490);
  });
});

describe('conversão de categorias e contas', () => {
  it('converte uma categoria e a sua hierarquia', () => {
    expect(
      toFinanceCategory({ id: 'c1', kind: 'EXPENSE', parentId: null, isInternal: false }),
    ).toEqual({ id: 'c1', kind: 'expense', parentId: undefined, internal: false });

    expect(
      toFinanceCategory({ id: 'c2', kind: 'EXPENSE', parentId: 'c1', isInternal: true }),
    ).toEqual({ id: 'c2', kind: 'expense', parentId: 'c1', internal: true });
  });

  it('considera arquivada uma conta com data de arquivo', () => {
    expect(
      toFinanceAccount({ id: 'a1', openingBalanceInCents: 100_000, archivedAt: null }),
    ).toEqual({ id: 'a1', openingBalanceInCents: 100_000, archived: false });

    expect(
      toFinanceAccount({
        id: 'a2',
        openingBalanceInCents: 0,
        archivedAt: new Date(Date.UTC(2026, 9, 1)),
      }),
    ).toEqual({ id: 'a2', openingBalanceInCents: 0, archived: true });
  });
});
