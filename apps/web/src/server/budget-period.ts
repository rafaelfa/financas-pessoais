import { addMonths } from '@repo/shared';

/**
 * O período de um orçamento.
 *
 * O utilizador define o **dia de início do mês** (1 a 28) — quem recebe ao dia 5
 * pensa em meses que começam ao dia 5, e um orçamento preso ao dia 1 mostra-lhe
 * um saldo que não corresponde à vida dele. Todo o cálculo vive aqui, para o
 * painel, o orçamento e os relatórios medirem o mesmo intervalo.
 *
 * ## Duas datas de fim, e é esta a distinção que faltava
 *
 * O motor trata `FinancePeriod.end` como **exclusivo** (`date >= end` fica de
 * fora), enquanto um utilizador lê o fim de um período como o **último dia
 * incluído**. A primeira versão deste ficheiro devolvia o dia incluído e passava-o
 * ao motor como se fosse exclusivo: o **último dia do mês deixava de contar para
 * todos os limites do orçamento**. Com o mês a começar ao dia 5, faltava o dia 4;
 * com o início ao dia 1, faltavam os gastos de 31 de outubro, 30 de novembro e
 * por aí — e o ecrã mostrava 130 € onde devia mostrar 170 €.
 *
 * Por isso há agora dois campos, com nomes que não se confundem:
 * - `end` — **exclusivo**, para o motor;
 * - `displayEnd` — **inclusivo**, o último dia, para mostrar a uma pessoa.
 *
 * Foi a verificação adversarial das Fases 5 e 6 que encontrou isto, com o valor
 * medido em cada lado. Um nome ambíguo custou um dia de consumo por mês.
 */

export interface BudgetPeriod {
  /** Primeiro dia, inclusive. */
  readonly start: string;
  /** **Exclusivo**: primeiro dia do período seguinte. Para o motor. */
  readonly end: string;
  /** **Inclusive**: último dia do período. Para mostrar. */
  readonly displayEnd: string;
  /** Chave estável, `AAAA-MM` do mês de início. */
  readonly key: string;
}

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

/** Constrói o período a partir do primeiro dia. */
function periodFromStart(start: string): BudgetPeriod {
  const nextStart = addMonths(start, 1);

  return { start, end: nextStart, displayEnd: dayBefore(nextStart), key: start.slice(0, 7) };
}

/** Período do mês de competência que contém a data indicada. */
export function monthPeriodFor(args: {
  readonly user: { readonly monthStartDay: number };
  readonly today: string;
}): BudgetPeriod {
  return periodFromStart(periodStartFor(args.today, args.user.monthStartDay));
}

/** Período de um mês concreto, a partir do primeiro dia. */
export function singleMonthPeriod(periodStart: string): BudgetPeriod {
  return periodFromStart(periodStart);
}

/**
 * Período efetivo de um orçamento, e a data que se guarda na base.
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
}): BudgetPeriod & { readonly storedStart: Date } {
  if (args.scope === 'monthly_default') {
    return {
      storedStart: new Date('1970-01-01T00:00:00.000Z'),
      ...monthPeriodFor({ user: args.user, today: args.today }),
    };
  }

  const period = singleMonthPeriod(
    args.periodStart ?? periodStartFor(args.today, args.user.monthStartDay),
  );

  return { storedStart: new Date(`${period.start}T00:00:00.000Z`), ...period };
}

/**
 * Resolve um mês de competência pela chave `AAAA-MM`.
 *
 * **Não** se pode fazer `periodOf(\`${key}-01\`)`: quando o mês começa depois do
 * dia 1, o dia 1 pertence ao mês anterior e o motor recua um mês — era assim que
 * `closeMonth({ periodKey: '2026-10' })` gravava setembro e o mês nunca aparecia
 * como fechado. Procura-se o período cuja chave coincide, que é o que o
 * utilizador quer dizer com "outubro".
 */
export function periodByKey(args: {
  readonly key: string;
  readonly user: { readonly monthStartDay: number };
  readonly today: string;
  readonly monthsBack?: number;
}): BudgetPeriod | null {
  const monthsBack = args.monthsBack ?? 36;
  const today = args.today;

  for (let offset = 0; offset <= monthsBack; offset += 1) {
    const cursor = addMonths(today, -offset);
    const period = monthPeriodFor({ user: args.user, today: cursor });

    if (period.key === args.key) {
      return period;
    }
  }

  return null;
}
