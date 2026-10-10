import { z } from 'zod';

import {
  calendarDateSchema,
  descriptionSchema,
  entityIdSchema,
  positiveCentsSchema,
} from './primitives';

/**
 * Lançamentos.
 *
 * `amountInCents` é o **efeito assinado na conta**: negativo sai, positivo entra.
 * O sinal não se deduz do tipo — é validado contra ele, e é essa coerência que
 * impede um gasto de aparecer como entrada nos totais.
 */

export const transactionKindSchema = z.enum([
  'expense',
  'income',
  'transfer',
  'invoice_payment',
  'goal_deposit',
  'goal_withdrawal',
  'balance_adjust',
]);

export const transactionStatusSchema = z.enum(['pending', 'confirmed', 'ignored']);
export const paymentMethodSchema = z.enum(['debit', 'credit']);
export const paymentConditionSchema = z.enum(['single', 'installment', 'recurring']);

/** Tipos cujo valor tem de ser negativo (saídas). */
const OUTGOING_KINDS = new Set(['expense', 'invoice_payment', 'goal_deposit']);

/** Tipos cujo valor tem de ser positivo (entradas). */
const INCOMING_KINDS = new Set(['income', 'goal_withdrawal']);

const createTransactionShape = z.object({
  kind: transactionKindSchema,
  amountInCents: z
    .int('O valor tem de ser um número inteiro de cêntimos.')
    .refine((value) => value !== 0, 'O valor não pode ser zero.')
    .refine(
      (value) => value <= 999_999_999_99 && value >= -999_999_999_99,
      'Valor acima do limite suportado.',
    ),
  date: calendarDateSchema,
  description: descriptionSchema.optional(),
  counterparty: z.string().trim().max(120).optional(),
  accountId: entityIdSchema,
  categoryId: entityIdSchema.nullish(),
  invoiceId: entityIdSchema.nullish(),
  cardId: entityIdSchema.nullish(),
  goalId: entityIdSchema.nullish(),
  transferGroupId: z.string().trim().min(1).max(60).nullish(),
  status: transactionStatusSchema.default('confirmed'),
  settled: z.boolean().default(false),
  paymentMethod: paymentMethodSchema.default('debit'),
  paymentCondition: paymentConditionSchema.default('single'),
  installmentCount: z.number().int().min(2).max(72).nullish(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  fitId: z.string().trim().max(80).nullish(),
});

export const createTransactionSchema = createTransactionShape.superRefine((value, ctx) => {
  const { kind, amountInCents, categoryId, transferGroupId, goalId, invoiceId, installmentCount } =
    value;

  if (OUTGOING_KINDS.has(kind) && amountInCents > 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['amountInCents'],
      message: 'Uma saída tem de ter valor negativo.',
    });
  }

  if (INCOMING_KINDS.has(kind) && amountInCents < 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['amountInCents'],
      message: 'Uma entrada tem de ter valor positivo.',
    });
  }

  if ((kind === 'expense' || kind === 'income') && !categoryId) {
    ctx.addIssue({
      code: 'custom',
      path: ['categoryId'],
      message: 'Escolhe uma categoria.',
    });
  }

  // Operações internas: não têm categoria própria e cada uma exige o seu vínculo.
  if (kind === 'transfer' && !transferGroupId) {
    ctx.addIssue({
      code: 'custom',
      path: ['transferGroupId'],
      message: 'Uma transferência precisa do par que a identifica.',
    });
  }

  if (kind === 'goal_deposit' || kind === 'goal_withdrawal') {
    if (!goalId) {
      ctx.addIssue({
        code: 'custom',
        path: ['goalId'],
        message: 'Escolhe o objetivo.',
      });
    }
  }

  if (kind === 'invoice_payment' && !invoiceId) {
    ctx.addIssue({
      code: 'custom',
      path: ['invoiceId'],
      message: 'Escolhe a fatura que estás a pagar.',
    });
  }

  if (kind !== 'expense' && installmentCount != null) {
    ctx.addIssue({
      code: 'custom',
      path: ['installmentCount'],
      message: 'Só um gasto pode ser dividido em parcelas.',
    });
  }

  if (kind === 'transfer' && categoryId) {
    ctx.addIssue({
      code: 'custom',
      path: ['categoryId'],
      message: 'Uma transferência não leva categoria.',
    });
  }
});

export const updateTransactionSchema = z.object({
  id: entityIdSchema,
  amountInCents: createTransactionShape.shape.amountInCents.optional(),
  date: calendarDateSchema.optional(),
  description: descriptionSchema.optional(),
  counterparty: z.string().trim().max(120).optional(),
  accountId: entityIdSchema.optional(),
  categoryId: entityIdSchema.nullish(),
  status: transactionStatusSchema.optional(),
  settled: z.boolean().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
});

/** Filtros do extrato. `from` e `to` são inclusivos. */
export const transactionFiltersSchema = z.object({
  from: calendarDateSchema.optional(),
  to: calendarDateSchema.optional(),
  accountId: entityIdSchema.optional(),
  categoryId: entityIdSchema.optional(),
  kind: transactionKindSchema.optional(),
  status: transactionStatusSchema.optional(),
  search: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/** Criação de uma transferência: as duas pernas nascem juntas. */
export const createTransferSchema = z
  .object({
    fromAccountId: entityIdSchema,
    toAccountId: entityIdSchema,
    amountInCents: positiveCentsSchema,
    date: calendarDateSchema,
    description: descriptionSchema.optional(),
    settled: z.boolean().default(true),
  })
  .refine((value) => value.fromAccountId !== value.toAccountId, {
    path: ['toAccountId'],
    message: 'A conta de destino tem de ser diferente da de origem.',
  });

export type CreateTransactionInput = z.input<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type TransactionFiltersInput = z.input<typeof transactionFiltersSchema>;
export type CreateTransferInput = z.infer<typeof createTransferSchema>;
