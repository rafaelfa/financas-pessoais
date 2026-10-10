import type { FinancePeriod } from './types';

/**
 * Aritmética de períodos mensais com **início configurável**.
 *
 * O sistema de referência fixa o mês no dia 1 e não permite alterá-lo, o que
 * não serve quem recebe a meio do mês (melhoria M2 do plano). Aqui o início é
 * configurável entre 1 e 28 — o limite superior existe para que todos os meses
 * tenham o dia de início.
 *
 * Todas as datas são strings `YYYY-MM-DD` e toda a aritmética é feita em UTC,
 * para que o resultado não dependa do fuso de quem executa.
 */

/** Dia do mês em que o período começa. 1 equivale ao mês de calendário. */
export const DEFAULT_MONTH_START_DAY = 1;

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

interface DateParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

/** Valida o dia de início. Valores acima de 28 deixariam meses sem esse dia. */
export function assertMonthStartDay(monthStartDay: number): void {
  if (!Number.isInteger(monthStartDay) || monthStartDay < 1 || monthStartDay > 28) {
    throw new RangeError(
      `O início do mês tem de ser um inteiro entre 1 e 28; recebido: ${monthStartDay}.`,
    );
  }
}

function parseDateParts(isoDate: string): DateParts {
  const match = ISO_DATE_PATTERN.exec(isoDate);

  if (!match) {
    throw new TypeError(`Data inválida: "${isoDate}". Esperado o formato YYYY-MM-DD.`);
  }

  const [, year, month, day] = match;
  const parts: DateParts = { year: Number(year), month: Number(month), day: Number(day) };

  if (parts.month < 1 || parts.month > 12) {
    throw new RangeError(`Mês inválido em "${isoDate}": ${parts.month}.`);
  }

  // O dia 0 do mês seguinte é o último dia deste mês.
  const lastDay = new Date(Date.UTC(parts.year, parts.month, 0)).getUTCDate();

  if (parts.day < 1 || parts.day > lastDay) {
    throw new RangeError(`Dia inválido em "${isoDate}": ${parts.day}.`);
  }

  return parts;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Soma (ou subtrai) dias a uma data de calendário, sem depender do fuso. */
export function addDays(isoDate: string, days: number): string {
  const { year, month, day } = parseDateParts(isoDate);

  return toIsoDate(new Date(Date.UTC(year, month - 1, day + days)));
}

/**
 * Soma (ou subtrai) meses a uma data de calendário.
 *
 * Quando o dia não existe no mês de destino, é **limitado ao último dia desse
 * mês** (31 de janeiro + 1 mês = 28 de fevereiro), e não "transbordado" para
 * março como a aritmética nativa de `Date` faria. Em datas financeiras,
 * transbordar silenciosamente para o mês seguinte é um erro caro.
 */
export function addMonths(isoDate: string, months: number): string {
  const { year, month, day } = parseDateParts(isoDate);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const targetYear = target.getUTCFullYear();
  const targetMonth = target.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();

  return toIsoDate(new Date(Date.UTC(targetYear, targetMonth - 1, Math.min(day, lastDay))));
}

/** Número de dias entre duas datas (`to` menos `from`), positivo ou negativo. */
export function daysBetween(from: string, to: string): number {
  const start = parseDateParts(from);
  const end = parseDateParts(to);
  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  return Math.round(
    (Date.UTC(end.year, end.month - 1, end.day) -
      Date.UTC(start.year, start.month - 1, start.day)) /
      millisecondsPerDay,
  );
}

/** Ano e mês (1-12) a que uma data de calendário pertence. */
export function monthKey(isoDate: string): string {
  const { year, month } = parseDateParts(isoDate);

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}

/**
 * Período mensal que contém `isoDate`.
 *
 * Com início no dia 1 devolve o mês de calendário. Com início no dia 25, uma
 * data de 24 de outubro pertence ao período que começa a 25 de setembro.
 */
export function periodOf(
  isoDate: string,
  monthStartDay: number = DEFAULT_MONTH_START_DAY,
): FinancePeriod {
  assertMonthStartDay(monthStartDay);

  const { year, month, day } = parseDateParts(isoDate);
  // `month` é 1-12; se a data vem antes do início, pertence ao mês anterior.
  const startMonth = day >= monthStartDay ? month : month - 1;
  const start = toIsoDate(new Date(Date.UTC(year, startMonth - 1, monthStartDay)));
  const end = toIsoDate(new Date(Date.UTC(year, startMonth, monthStartDay)));

  return { start, end, key: start.slice(0, 7) };
}

/** Chave estável (`YYYY-MM` do início) do período que contém a data. */
export function periodKey(
  isoDate: string,
  monthStartDay: number = DEFAULT_MONTH_START_DAY,
): string {
  return periodOf(isoDate, monthStartDay).key;
}

/** `true` se a data cai dentro do período. `end` é exclusivo. */
export function isWithinPeriod(period: FinancePeriod, isoDate: string): boolean {
  return isoDate >= period.start && isoDate < period.end;
}

/**
 * Períodos consecutivos que cobrem de `from` a `to`, ambos inclusive.
 * Devolve uma lista vazia se `to` for anterior a `from`.
 */
export function periodRange(
  from: string,
  to: string,
  monthStartDay: number = DEFAULT_MONTH_START_DAY,
): FinancePeriod[] {
  if (to < from) {
    return [];
  }

  const periods: FinancePeriod[] = [];
  let current = periodOf(from, monthStartDay);
  const last = periodOf(to, monthStartDay);

  while (current.start <= last.start) {
    periods.push(current);
    // `end` é exatamente o início do período seguinte.
    current = periodOf(current.end, monthStartDay);
  }

  return periods;
}

/** Período imediatamente anterior ao indicado. */
export function previousPeriod(
  period: FinancePeriod,
  monthStartDay: number = DEFAULT_MONTH_START_DAY,
): FinancePeriod {
  const { year, month, day } = parseDateParts(period.start);

  return periodOf(toIsoDate(new Date(Date.UTC(year, month - 2, day))), monthStartDay);
}
