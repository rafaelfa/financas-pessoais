import { z } from 'zod';

import { entityIdSchema, shortNameSchema } from './primitives';

/**
 * Categorias e subcategorias.
 *
 * As categorias de **sistema** (as que vêm do seed, com nomes portugueses) não
 * se editam nem se apagam: são a base partilhada de relatórios e orçamentos.
 * As categorias **internas** aparecem no extrato mas nunca contam como ganho
 * nem gasto — é o que impede uma transferência de inflacionar o resultado.
 */

export const categoryKindSchema = z.enum(['expense', 'income']);

/** Identificador estável a partir de um nome: sem acentos, minúsculas, com hífenes. */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export const createCategorySchema = z.object({
  name: shortNameSchema,
  kind: categoryKindSchema,
  parentId: entityIdSchema.nullish(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Usa uma cor no formato #RRGGBB.')
    .nullish(),
  icon: z.string().trim().max(40).nullish(),
  sortOrder: z.number().int().min(0).max(9_999).optional(),
});

export const updateCategorySchema = z.object({
  id: entityIdSchema,
  name: shortNameSchema.optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Usa uma cor no formato #RRGGBB.')
    .nullish(),
  icon: z.string().trim().max(40).nullish(),
  sortOrder: z.number().int().min(0).max(9_999).optional(),
  parentId: entityIdSchema.nullish(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
