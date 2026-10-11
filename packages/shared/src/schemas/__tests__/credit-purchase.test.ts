import { describe, expect, it } from 'vitest';

import { splitInstallments } from '../../finance/invoice';
import { createTransactionSchema } from '../domain/transactions';

/**
 * Compras a crédito e parceladas: o contrato que o lançamento rápido envia.
 *
 * Este teste existe porque o formulário e o servidor partilham o mesmo schema, e
 * o formulário só passou a enviar `paymentMethod`/`cardId`/`paymentCondition` na
 * Fase 4. Um erro aqui não aparece no ecrã: aparece como uma compra que não se
 * consegue registar, ou — pior — registada fora do cartão.
 */
describe('compra a crédito no lançamento rápido', () => {
  it('aceita uma compra à vista num cartão', () => {
    const parsed = createTransactionSchema.safeParse({
      kind: 'expense',
      amountInCents: -4_250,
      date: '2026-10-11',
      accountId: 'acc-1',
      categoryId: 'cat-1',
      paymentMethod: 'credit',
      cardId: 'card-1',
      paymentCondition: 'single',
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data?.paymentMethod).toBe('credit');
    expect(parsed.data?.cardId).toBe('card-1');
  });

  it('aceita uma compra em 12 parcelas', () => {
    const parsed = createTransactionSchema.safeParse({
      kind: 'expense',
      amountInCents: -600_000,
      date: '2026-10-11',
      accountId: 'acc-1',
      categoryId: 'cat-1',
      paymentMethod: 'credit',
      cardId: 'card-1',
      paymentCondition: 'installment',
      installmentCount: 12,
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data?.paymentCondition).toBe('installment');
    expect(parsed.data?.installmentCount).toBe(12);
  });

  it('recusa parcelamento num ganho: um estorno não se parcela', () => {
    const parsed = createTransactionSchema.safeParse({
      kind: 'income',
      amountInCents: 600_000,
      date: '2026-10-11',
      accountId: 'acc-1',
      categoryId: 'cat-income',
      paymentMethod: 'credit',
      cardId: 'card-1',
      paymentCondition: 'installment',
      installmentCount: 12,
    });

    expect(parsed.success).toBe(false);
  });

  it('recusa uma parcela única, porque "parcelado" implica duas ou mais', () => {
    expect(
      createTransactionSchema.safeParse({
        kind: 'expense',
        amountInCents: -600_000,
        date: '2026-10-11',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        paymentCondition: 'installment',
        installmentCount: 1,
      }).success,
    ).toBe(false);
  });

  it('recusa mais de 72 parcelas', () => {
    expect(
      createTransactionSchema.safeParse({
        kind: 'expense',
        amountInCents: -600_000,
        date: '2026-10-11',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        paymentCondition: 'installment',
        installmentCount: 73,
      }).success,
    ).toBe(false);
  });

  it('a soma das parcelas é exatamente o valor da compra, e o resto vai nas primeiras', () => {
    const parcels = splitInstallments(100_000, 3);

    expect(parcels).toEqual([33_334, 33_333, 33_333]);
    expect(parcels.reduce((total, value) => total + value, 0)).toBe(100_000);

    // Sem esta distribuição, o cêntimo do resto perder-se-ia e a soma das
    // parcelas não fecharia com o valor pago no cartão.
    const awkward = splitInstallments(10_000, 7);

    expect(awkward.reduce((total, value) => total + value, 0)).toBe(10_000);
  });
});
