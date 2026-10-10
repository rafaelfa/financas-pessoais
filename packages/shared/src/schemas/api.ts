import { z } from 'zod';

/**
 * Envelope schemas for the HTTP API routes exposed by `apps/web`.
 */

/** Machine readable error codes returned by the API. */
export const apiErrorCodeSchema = z.enum([
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'VALIDATION_ERROR',
  'INTERNAL_ERROR',
]);

export const apiErrorSchema = z.object({
  code: apiErrorCodeSchema,
  message: z.string().min(1),
  /** Field level validation issues, keyed by dotted field path. */
  fieldErrors: z.record(z.string(), z.array(z.string())).optional(),
});

/** Wraps any schema in a `{ data, error: null }` success envelope. */
export function apiResponseSchema<T extends z.ZodType>(data: T) {
  return z.object({
    data,
    error: z.null(),
  });
}

/** Wraps any schema in a `{ data: null, error }` failure envelope. */
export function apiErrorResponseSchema(error: z.ZodType = apiErrorSchema) {
  return z.object({
    data: z.null(),
    error,
  });
}

/** Payload returned by `GET /api/health`. */
export const healthCheckSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  service: z.string().min(1),
  version: z.string().min(1),
  timestamp: z.iso.datetime({ offset: true }),
  environment: z.enum(['development', 'test', 'production']),
  uptimeInSeconds: z.number().nonnegative(),
  dependencies: z.object({
    database: z.object({
      provider: z.literal('postgresql'),
      /** `DATABASE_URL` is present in the environment. */
      configured: z.boolean(),
      /** A `SELECT 1` probe succeeded. `null` when not probed. */
      reachable: z.boolean().nullable(),
    }),
  }),
});
