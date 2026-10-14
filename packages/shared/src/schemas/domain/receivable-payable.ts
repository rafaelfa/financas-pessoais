import { z } from 'zod';

import {
  entityIdSchema,
  calendarDateSchema,
  descriptionSchema,
  nonNegativeCentsSchema,
} from './primitives';

/**
 * Contas a Pagar / Contas a Receber.
 */

/** Tipo de conta: Pagar (despesa) ou Receber (receita). */
export const receivablePayableTypeSchema = z.enum(['PAYABLE', 'RECEIVABLE']);

/** Status de uma conta a pagar ou receber. */
export const receivablePayableStatusSchema = z.enum(['OPEN', 'PAID', 'OVERDUE', 'CANCELLED']);

/** Criação de uma conta a pagar ou receber. */
export const createReceivablePayableSchema = z.object({
  type: receivablePayableTypeSchema,
  description: descriptionSchema,
  amountInCents: nonNegativeCentsSchema,
  dueDate: calendarDateSchema,
  categoryId: entityIdSchema.optional(),
  financialAccountId: entityIdSchema.optional(),
  tags: z.array(z.string()).optional(),
  note: z.string().trim().max(500).optional(),
  status: receivablePayableStatusSchema.default('OPEN'),
});

/** Alteração de uma conta a pagar ou receber. */
export const updateReceivablePayableSchema = createReceivablePayableSchema
  .partial()
  .extend({
    id: entityIdSchema,
  });

/** Pagamento de uma conta a pagar ou receber. */
export const payReceivablePayableSchema = z.object({
  id: entityIdSchema,
  financialAccountId: entityIdSchema,
  paymentDate: calendarDateSchema,
  note: z.string().trim().max(280).optional(),
  createTransaction: z.boolean().default(true),
});

/** Apagar uma conta a pagar ou receber. */
export const deleteReceivablePayableSchema = z.object({
  id: entityIdSchema,
});

export type CreateReceivablePayableInput = z.infer<typeof createReceivablePayableSchema>;
export type UpdateReceivablePayableInput = z.infer<typeof updateReceivablePayableSchema>;
export type PayReceivablePayableInput = z.infer<typeof payReceivablePayableSchema>;
export type DeleteReceivablePayableInput = z.infer<typeof deleteReceivablePayableSchema>;

/**
 * Consolidação de Contas (Account Groups).
 */

/** Criação de um grupo de contas. */
export const createAccountGroupSchema = z.object({
  name: z.string().trim().min(1, 'O nome é obrigatório').max(100),
  description: z.string().trim().max(500).optional(),
  accountIds: z.array(entityIdSchema).optional(),
});

/** Alteração de um grupo de contas. */
export const updateAccountGroupSchema = createAccountGroupSchema.partial().extend({
  id: entityIdSchema,
});

/** Apagar um grupo de contas. */
export const deleteAccountGroupSchema = z.object({
  id: entityIdSchema,
});

/** Adicionar uma conta a um grupo. */
export const addAccountToGroupSchema = z.object({
  groupId: entityIdSchema,
  accountId: entityIdSchema,
});

/** Remover uma conta de um grupo. */
export const removeAccountFromGroupSchema = z.object({
  groupId: entityIdSchema,
  accountId: entityIdSchema,
});

export type CreateAccountGroupInput = z.infer<typeof createAccountGroupSchema>;
export type UpdateAccountGroupInput = z.infer<typeof updateAccountGroupSchema>;
export type DeleteAccountGroupInput = z.infer<typeof deleteAccountGroupSchema>;
export type AddAccountToGroupInput = z.infer<typeof addAccountToGroupSchema>;
export type RemoveAccountFromGroupInput = z.infer<typeof removeAccountFromGroupSchema>;
