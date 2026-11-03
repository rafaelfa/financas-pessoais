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
 * Bens e dívidas (património).
 *
 * Duas decisões de forma:
 * - **dinheiro em cêntimos inteiros**, como em todo o projeto;
 * - **taxa em pontos base** (`interestRateBasisPoints`, 350 = 3,50 %), para não
 *   haver percentagens decimais a viajar em `Float`.
 *
 * As datas são opcionais e validadas só no formato; a coerência entre início e
 * fim é verificada num `superRefine` **depois** de o schema estar completo, e
 * nunca com `.partial()` sobre um schema refinado — no Zod 4 isso lança na
 * construção e foi o que deixou a edição de lançamentos a responder 500 (T26).
 */

export const assetTypeSchema = z.enum(['VEHICLE', 'PROPERTY', 'OTHER']);

export const liabilityTypeSchema = z.enum(['LOAN', 'MORTGAGE', 'CREDIT_LINE', 'OTHER']);

/** Nome de um bem ou de uma dívida. */
const patrimonyNameSchema = shortNameSchema;

const assetShape = z.object({
  type: assetTypeSchema,
  name: patrimonyNameSchema,
  description: descriptionSchema.optional(),
  // Zero é um estado legítimo: um bem sem valor de mercado e uma dívida paga.
  valueInCents: nonNegativeCentsSchema,
  acquiredOn: calendarDateSchema.optional(),
  valuedOn: calendarDateSchema.optional(),
});

const liabilityShape = z.object({
  type: liabilityTypeSchema,
  name: patrimonyNameSchema,
  creditor: z.string().trim().max(120, 'O credor não pode ter mais de 120 caracteres.').optional(),
  principalInCents: positiveCentsSchema,
  // Saldo em dívida a zero = crédito liquidado, que é um estado normal.
  outstandingInCents: nonNegativeCentsSchema,
  interestRateBasisPoints: z
    .number()
    .int('A taxa tem de ser um número inteiro de pontos base.')
    .min(0, 'A taxa não pode ser negativa.')
    .max(10_000, 'A taxa não pode passar de 100 %.')
    .optional(),
  totalInstallments: z.number().int().min(1).max(600).optional(),
  remainingInstallments: z.number().int().min(0).max(600).optional(),
  installmentAmountInCents: nonNegativeCentsSchema.optional(),
  startDate: calendarDateSchema.optional(),
  endDate: calendarDateSchema.optional(),
});

/** `fim` antes de `início` é um dado trocado, não uma escolha. */
function datasCoerentes(
  value: { startDate?: string; endDate?: string },
  ctx: z.RefinementCtx,
): void {
  if (
    value.startDate !== undefined &&
    value.endDate !== undefined &&
    value.endDate < value.startDate
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['endDate'],
      message: 'O fim não pode ser antes do início.',
    });
  }
}

export const createAssetSchema = assetShape;

export const updateAssetSchema = assetShape.partial().extend({ id: entityIdSchema });

export const createLiabilitySchema = liabilityShape.superRefine(datasCoerentes);

export const updateLiabilitySchema = liabilityShape
  .partial()
  .extend({ id: entityIdSchema })
  .superRefine(datasCoerentes);

/** Arquivar ou reativar. Não se apaga: o histórico do património é dado, não lixo. */
export const archivePatrimonySchema = z.object({
  id: entityIdSchema,
  archived: z.boolean(),
});

export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;
export type CreateLiabilityInput = z.infer<typeof createLiabilitySchema>;
export type UpdateLiabilityInput = z.infer<typeof updateLiabilitySchema>;
