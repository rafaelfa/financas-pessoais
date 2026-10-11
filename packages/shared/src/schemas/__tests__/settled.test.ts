import { describe, expect, it } from 'vitest';

import { createTransactionSchema, createTransferSchema } from '../domain/transactions';

/**
 * A flag que decide se um movimento mexe no saldo.
 *
 * Regressão de um defeito real: `createTransactionSchema` tinha
 * `settled: default(false)` enquanto `createTransferSchema` tinha
 * `default(true)`. Um ganho de 50 € escrito à mão nascia por liquidar, o motor
 * — que só conta o que está liquidado — ignorava-o, e a conta mostrava −25 € onde
 * o utilizador esperava +25 €. Nenhum teste apanhava isto porque nenhum olhava
 * para o valor por omissão.
 *
 * A regra: quem escreve à mão está a registar algo que **já aconteceu**.
 */
describe('valor por omissão de `settled`', () => {
  it('um gasto escrito à mão nasce liquidado', () => {
    const parsed = createTransactionSchema.parse({
      kind: 'expense',
      amountInCents: -2_500,
      date: '2026-10-11',
      accountId: 'acc-1',
      categoryId: 'cat-1',
    });

    expect(parsed.settled).toBe(true);
  });

  it('um ganho escrito à mão nasce liquidado', () => {
    const parsed = createTransactionSchema.parse({
      kind: 'income',
      amountInCents: 5_000,
      date: '2026-10-11',
      accountId: 'acc-1',
      categoryId: 'cat-1',
    });

    expect(parsed.settled).toBe(true);
  });

  it('uma transferência nasce liquidada — as duas formas têm de concordar', () => {
    const parsed = createTransferSchema.parse({
      fromAccountId: 'acc-1',
      toAccountId: 'acc-2',
      amountInCents: 2_500,
      date: '2026-10-11',
    });

    expect(parsed.settled).toBe(true);
  });

  it('quem quiser marcar como por liquidar di-lo explicitamente', () => {
    const parsed = createTransactionSchema.parse({
      kind: 'expense',
      amountInCents: -2_500,
      date: '2026-10-11',
      accountId: 'acc-1',
      categoryId: 'cat-1',
      settled: false,
    });

    expect(parsed.settled).toBe(false);
  });
});
