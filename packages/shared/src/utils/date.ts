import { DEFAULT_LOCALE } from './currency';

/** A date input accepted by the helpers below. */
export type DateInput = Date | string | number;

const dateFormatter = new Intl.DateTimeFormat(DEFAULT_LOCALE, {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat(DEFAULT_LOCALE, {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const monthFormatter = new Intl.DateTimeFormat(DEFAULT_LOCALE, {
  month: 'long',
  year: 'numeric',
});

function toDate(input: DateInput): Date {
  return input instanceof Date ? input : new Date(input);
}

/** Format a date as `dd/MM/yyyy`. */
export function formatDate(input: DateInput): string {
  return dateFormatter.format(toDate(input));
}

/** Format a date as `dd/MM/yyyy HH:mm`. */
export function formatDateTime(input: DateInput): string {
  return dateTimeFormatter.format(toDate(input));
}

/** Format a date as `outubro de 2026`. */
export function formatMonth(input: DateInput): string {
  return monthFormatter.format(toDate(input));
}

/**
 * Convert a date to the `yyyy-MM-dd` string required by
 * `<input type="date">`.
 */
export function toDateInputValue(input: DateInput): string {
  return toDate(input).toISOString().slice(0, 10);
}

/** Exclusive upper bound of the month containing `input`. */
export function endOfMonth(input: DateInput): Date {
  const date = toDate(input);

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

/** Inclusive lower bound of the month containing `input`. */
export function startOfMonth(input: DateInput): Date {
  const date = toDate(input);

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}
