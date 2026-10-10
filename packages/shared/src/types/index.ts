import type { z } from 'zod';

import type {
  amountInCentsSchema,
  apiErrorCodeSchema,
  apiErrorSchema,
  currencySchema,
  emailSchema,
  healthCheckSchema,
  isoDateSchema,
  isoDateTimeSchema,
  moneySchema,
  paginationSchema,
  sortOrderSchema,
} from '../schemas';

/** ISO-4217 currency code supported by the application. */
export type Currency = z.infer<typeof currencySchema>;

/** Ascending or descending ordering. */
export type SortOrder = z.infer<typeof sortOrderSchema>;

/** Integer amount in minor units (cents). */
export type AmountInCents = z.infer<typeof amountInCentsSchema>;

/** A monetary amount plus its currency. */
export type Money = z.infer<typeof moneySchema>;

/** Validated e-mail address. */
export type Email = z.infer<typeof emailSchema>;

/** ISO-8601 calendar date string (`yyyy-MM-dd`). */
export type IsoDate = z.infer<typeof isoDateSchema>;

/** ISO-8601 date-time string with offset. */
export type IsoDateTime = z.infer<typeof isoDateTimeSchema>;

/** Normalized pagination input. */
export type Pagination = z.infer<typeof paginationSchema>;

/** Machine readable API error code. */
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

/** Serialized API error payload. */
export type ApiError = z.infer<typeof apiErrorSchema>;

/** Payload returned by the health check endpoint. */
export type HealthCheck = z.infer<typeof healthCheckSchema>;

/**
 * Generic success envelope. Mirrors `apiResponseSchema`.
 */
export interface ApiSuccess<T> {
  data: T;
  error: null;
}

/**
 * Generic failure envelope. Mirrors `apiErrorResponseSchema`.
 */
export interface ApiFailure {
  data: null;
  error: ApiError;
}

/** Result of any API call made by the frontend. */
export type ApiResult<T> = ApiSuccess<T> | ApiFailure;
