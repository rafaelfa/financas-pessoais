import type { Currency } from '../types';

/** Default currency used by the application. */
export const DEFAULT_CURRENCY: Currency = 'BRL';

/** Locale used for number and date formatting. */
export const DEFAULT_LOCALE = 'pt-BR';

const CURRENCY_LOCALE: Record<Currency, string> = {
  BRL: 'pt-BR',
  USD: 'en-US',
  EUR: 'de-DE',
};

const currencyFormatters = new Map<string, Intl.NumberFormat>();

function getCurrencyFormatter(currency: Currency): Intl.NumberFormat {
  const locale = CURRENCY_LOCALE[currency];
  const cacheKey = `${locale}:${currency}`;
  const cached = currencyFormatters.get(cacheKey);

  if (cached) {
    return cached;
  }

  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  });

  currencyFormatters.set(cacheKey, formatter);

  return formatter;
}

/**
 * Format an integer amount of cents as a localized currency string.
 *
 * @example formatCurrency(123456) // "R$ 1.234,56"
 */
export function formatCurrency(
  amountInCents: number,
  currency: Currency = DEFAULT_CURRENCY,
): string {
  return getCurrencyFormatter(currency).format(amountInCents / 100);
}

/**
 * Convert a localized user input such as `"1.234,56"` or `"1234.56"` into an
 * integer amount of cents. Returns `null` when the input is not a finite number.
 */
export function parseCurrencyToCents(value: string): number | null {
  const normalized = value
    .trim()
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');

  if (normalized === '' || normalized === '-') {
    return null;
  }

  const parsed = Number.parseFloat(normalized);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.round(parsed * 100);
}

/** Convert an amount of cents into its decimal representation. */
export function centsToDecimal(amountInCents: number): number {
  return amountInCents / 100;
}

/** Convert a decimal amount into the canonical integer cent representation. */
export function decimalToCents(amount: number): number {
  return Math.round(amount * 100);
}

/** Sum a list of amounts in cents without floating point drift. */
export function sumCents(amounts: readonly number[]): number {
  return amounts.reduce((total, amount) => total + amount, 0);
}
