import { describe, expect, it } from 'vitest';

import {
  amountInCentsSchema,
  moneySchema,
  negativeMoneySchema,
  positiveMoneySchema,
} from '../money';

describe('amountInCentsSchema', () => {
  it('aceita inteiros dentro do intervalo suportado', () => {
    expect(amountInCentsSchema.parse(0)).toBe(0);
    expect(amountInCentsSchema.parse(-8_990)).toBe(-8_990);
    expect(amountInCentsSchema.parse(999_999_999_99)).toBe(999_999_999_99);
  });

  it('rejeita valores com casas decimais', () => {
    const result = amountInCentsSchema.safeParse(12.5);

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain('inteiro');
  });

  it('rejeita valores acima do limite', () => {
    expect(amountInCentsSchema.safeParse(1_000_000_000_00).success).toBe(false);
  });

  it('rejeita texto', () => {
    expect(amountInCentsSchema.safeParse('1234').success).toBe(false);
  });
});

describe('moneySchema', () => {
  it('aceita um montante com moeda', () => {
    expect(moneySchema.parse({ amountInCents: 123_456, currency: 'EUR' })).toEqual({
      amountInCents: 123_456,
      currency: 'EUR',
    });
  });

  it('preenche a moeda por omissão quando ausente', () => {
    expect(moneySchema.parse({ amountInCents: 100 })).toHaveProperty('currency');
  });
});

describe('positiveMoneySchema e negativeMoneySchema', () => {
  it('exigem o sinal correto', () => {
    expect(positiveMoneySchema.safeParse({ amountInCents: 100 }).success).toBe(true);
    expect(positiveMoneySchema.safeParse({ amountInCents: 0 }).success).toBe(false);
    expect(positiveMoneySchema.safeParse({ amountInCents: -100 }).success).toBe(false);

    expect(negativeMoneySchema.safeParse({ amountInCents: -100 }).success).toBe(true);
    expect(negativeMoneySchema.safeParse({ amountInCents: 0 }).success).toBe(false);
    expect(negativeMoneySchema.safeParse({ amountInCents: 100 }).success).toBe(false);
  });
});
