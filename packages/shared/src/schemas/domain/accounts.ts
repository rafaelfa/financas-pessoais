import { z } from 'zod';

import {
  calendarDateSchema,
  descriptionSchema,
  entityIdSchema,
  nonNegativeCentsSchema,
  positiveCentsSchema,
  shortNameSchema,
} from './primitives';

/**
 * Contas, cartões e faturas.
 *
 * Nota de modelo: no esquema Prisma, `Account` é a conta de **autenticação** do
 * better-auth; a conta financeira é `FinancialAccount`. Aqui falamos sempre de
 * contas financeiras, porque é isso que o utilizador vê.
 */

/** Tipo de conta financeira. */
export const accountTypeSchema = z.enum(['checking', 'savings', 'wallet', 'cash', 'investment']);

/** Origem de um registo: introduzido à mão ou importado de um ficheiro. */
export const accountOriginSchema = z.enum(['manual', 'imported']);

/** Criação de uma conta. */
export const createAccountSchema = z.object({
  name: shortNameSchema,
  institution: z.string().trim().max(80).optional(),
  type: accountTypeSchema,
  openingBalanceInCents: nonNegativeCentsSchema.default(0),
  isPrimary: z.boolean().default(false),
  currency: z.literal('EUR').default('EUR'),
  notes: z.string().trim().max(500).optional(),
});

/** Alteração de uma conta. */
export const updateAccountSchema = createAccountSchema.partial().extend({
  id: entityIdSchema,
});

/** Arquivar ou reativar uma conta. Contas arquivadas saem dos saldos. */
export const archiveAccountSchema = z.object({
  id: entityIdSchema,
  archived: z.boolean(),
});

/**
 * "Travar o saldo" de uma conta.
 *
 * O utilizador informa o saldo real numa data; o sistema calcula a diferença
 * para o saldo que tinha calculado e cria um lançamento de ajuste. Nunca reescreve
 * o histórico — é isso que torna a operação auditável.
 */
export const lockBalanceSchema = z.object({
  accountId: entityIdSchema,
  referenceDate: calendarDateSchema,
  reportedBalanceInCents: z
    .int('O saldo tem de ser um número inteiro de cêntimos.')
    .min(-999_999_999_99, 'Valor acima do limite suportado.')
    .max(999_999_999_99, 'Valor acima do limite suportado.'),
  reason: z.string().trim().max(280).optional(),
});

/** Bandeiras de cartão relevantes em Portugal. */
export const cardBrandSchema = z.enum([
  'visa',
  'mastercard',
  'maestro',
  'american_express',
  'multibanco',
  'other',
]);

const dayOfMonthSchema = z
  .number()
  .int('O dia tem de ser um número inteiro.')
  .min(1, 'O dia tem de estar entre 1 e 31.')
  .max(31, 'O dia tem de estar entre 1 e 31.');

/** Criação de um cartão de crédito gerido à mão. */
export const createCreditCardSchema = z.object({
  name: shortNameSchema,
  brand: cardBrandSchema,
  /** Conta de onde a fatura é paga. */
  paymentAccountId: entityIdSchema,
  closingDay: dayOfMonthSchema,
  dueDay: dayOfMonthSchema,
  monthlyLimitInCents: positiveCentsSchema.optional(),
  annualFeeInCents: nonNegativeCentsSchema.optional(),
});

/** Alteração de um cartão. */
export const updateCreditCardSchema = createCreditCardSchema.partial().extend({
  id: entityIdSchema,
});

/**
 * Pagamento de uma fatura.
 *
 * É uma operação de primeira classe e **não** um "ganho": em visão de caixa é a
 * saída que representa as compras feitas a crédito; em competência é neutra,
 * porque apenas liquida um passivo (melhoria M4).
 */
export const payInvoiceSchema = z.object({
  invoiceId: entityIdSchema,
  amountInCents: positiveCentsSchema,
  date: calendarDateSchema,
  accountId: entityIdSchema,
  notes: z.string().trim().max(280).optional(),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type LockBalanceInput = z.infer<typeof lockBalanceSchema>;
export type CreateCreditCardInput = z.infer<typeof createCreditCardSchema>;
export type PayInvoiceInput = z.infer<typeof payInvoiceSchema>;

/**
 * Alteração de um plano de parcelamento.
 *
 * Altera-se o plano como um todo — valor, número de parcelas, data da primeira e
 * descrição — e não parcela a parcela: um parcelamento é uma decisão única, e
 * mexer numa parcela isolada deixaria de corresponder ao que foi contratado.
 *
 * A ação recusa planos cujas faturas já tenham pagamentos: reescrever parcelas
 * que já foram pagas mudaria história que o utilizador já confirmou.
 */
export const updateInstallmentPlanSchema = z
  .object({
    planId: z.string().trim().min(1, 'Falta o identificador do plano.').max(100),
    totalAmountInCents: positiveCentsSchema.optional(),
    installmentCount: z
      .number()
      .int('O número de parcelas tem de ser inteiro.')
      .min(2, 'Um parcelamento tem pelo menos duas parcelas.')
      .max(72, 'Um parcelamento não pode passar de 72 parcelas.')
      .optional(),
    firstDate: calendarDateSchema.optional(),
    description: descriptionSchema.optional(),
  })
  .refine(
    (value) =>
      value.totalAmountInCents !== undefined ||
      value.installmentCount !== undefined ||
      value.firstDate !== undefined ||
      value.description !== undefined,
    { message: 'Não há nada para alterar neste parcelamento.' },
  );

/** Arquivo ou reativação de um cartão. */
export const setCardArchivedSchema = z.object({
  id: entityIdSchema,
  archived: z.boolean(),
});

export type UpdateInstallmentPlanInput = z.infer<typeof updateInstallmentPlanSchema>;
