import { z } from 'zod';

/**
 * Reusable primitive schemas shared across the monorepo.
 *
 * Everything exported from `@repo/shared` is the single source of truth for
 * runtime validation. Types are always derived from these schemas with
 * `z.infer` instead of being hand written.
 */

/** UUID v4 identifier. */
export const uuidSchema = z.uuid();

/** Prisma `cuid()` identifier. */
export const cuidSchema = z.string().startsWith('c').min(25).max(30);

/** Generic non-empty identifier string. */
export const idSchema = z.string().trim().min(1, 'Identificador é obrigatório.');

/** E-mail address. */
export const emailSchema = z.email('Informe um e-mail válido.');

/** ISO-8601 calendar date, e.g. `2026-10-08`. */
export const isoDateSchema = z.iso.date();

/** ISO-8601 date-time with timezone, e.g. `2026-10-08T12:00:00.000Z`. */
export const isoDateTimeSchema = z.iso.datetime({ offset: true });

/** Three-letter ISO-4217 currency code. */
export const currencySchema = z.enum(['BRL', 'USD', 'EUR']);

/** Sort direction used by list endpoints. */
export const sortOrderSchema = z.enum(['asc', 'desc']);

/** Standard pagination query schema. */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  order: sortOrderSchema.default('desc'),
});

/** Value that is either the parsed value or `null`. */
export const nullableStringSchema = z.string().trim().min(1).nullable();
