import { addMonths } from '@repo/shared';

/**
 * O período de um orçamento.
 *
 * O utilizador define o **dia de início do mês** (1 a 28) — quem recebe ao dia 5
 * pensa em meses que começam ao dia 5, e um orçamento preso ao dia 1 mostra-lhe
 * um saldo que não corresponde à vida dele. Todo o cálculo vive aqui, para o
 * painel, o orçamento e os relatórios medirem o mesmo intervalo.
 */

/** Data de calendário do dia anterior a uma data `YYYY-MM-DD`. */
export function dayBefore(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));

  date.setUTCDate(date.getUTCDate() - 1);

  return date.toISOString().slice(0, 10);
}

/** Primeiro dia do mês de competência que contém a data indicada. */
export function periodStartFor(today: string, monthStartDay: number): string {
  const monthPrefix = today.slice(0, 7);
  const day = Number(today.slice(8, 10));
  const padded = String(Math.min(Math.max(monthStartDay, 1), 28)).padStart(2, '0');
  const startOfCalendarMonth = `${monthPrefix}-${padded}`;

  // Antes do dia de início, ainda estamos no mês de competência anterior.
  return day >= Number(padded) ? startOfCalendarMonth : addMonths(startOfCalendarMonth, -1);
}

/** Período do mês de competência que contém a data indicada. */
export function monthPeriodFor(args: {
  readonly user: { readonly monthStartDay: number };
  readonly today: string;
}): { start: string; end: string; key: string } {
  const start = periodStartFor(args.today, args.user.monthStartDay);

  return { start, end: dayBefore(addMonths(start, 1)), key: start.slice(0, 7) };
}

/** Período de um mês concreto, a partir do primeiro dia. */
export function singleMonthPeriod(periodStart: string): {
  start: string;
  end: string;
  key: string;
} {
  return {
    start: periodStart,
    end: dayBefore(addMonths(periodStart, 1)),
    key: periodStart.slice(0, 7),
  };
}

/**
 * O período efetivo de um orçamento, e o que se guarda na base de dados.
 *
 * Um orçamento `monthly_default` guarda uma data sentinela (1970-01-01) porque
 * não pertence a nenhum mês: vale para todos. A data que o utilizador vê é
 * sempre a do mês em curso.
 */
export function currentPeriod(args: {
  readonly scope: 'monthly_default' | 'single_month';
  readonly periodStart?: string | undefined;
  readonly user: { readonly monthStartDay: number };
  readonly today: string;
}): { storedStart: Date; start: string; end: string; key: string } {
  if (args.scope === 'monthly_default') {
    const period = monthPeriodFor({ user: args.user, today: args.today });

    return { storedStart: new Date('1970-01-01T00:00:00.000Z'), ...period };
  }

  const start = args.periodStart ?? periodStartFor(args.today, args.user.monthStartDay);
  const period = singleMonthPeriod(start);

  return { storedStart: new Date(`${period.start}T00:00:00.000Z`), ...period };
}
