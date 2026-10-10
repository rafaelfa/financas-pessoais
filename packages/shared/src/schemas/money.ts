import { z } from 'zod';

import { currencySchema } from './primitives';

/**
 * Monetary values.
 *
 * Money is always stored and transported as an integer number of cents to
 * avoid the floating point rounding errors that come with `number` decimals.
 */

/**
 * Integer amount in minor units (cents).
 *
 * O teto é o de um inteiro de 32 bits (21 474 836,47 €), que é o que a coluna da
 * base de dados suporta. Aceitar mais aqui só transformaria um erro de validação
 * num erro de escrita.
 */
export const amountInCentsSchema = z
  .int('O valor deve ser um número inteiro de centavos.')
  .min(-2_147_483_647, 'Valor acima do limite suportado.')
  .max(2_147_483_647, 'Valor acima do limite suportado.');

/** A monetary amount together with its currency. */
export const moneySchema = z.object({
  amountInCents: amountInCentsSchema,
  currency: currencySchema.default('EUR'),
});

/** A monetary amount that must be strictly positive (income, invoice, ...). */
export const positiveMoneySchema = moneySchema.extend({
  amountInCents: amountInCentsSchema.positive('O valor deve ser maior que zero.'),
});

/** A monetary amount that must be zero or negative (expense, ...). */
export const negativeMoneySchema = moneySchema.extend({
  amountInCents: amountInCentsSchema.negative('O valor deve ser menor que zero.'),
});
