import type { RecurrenceFrequency } from './types';

/**
 * Recorrências.
 *
 * A regra que faz isto funcionar é uma só: **gerar nunca pode duplicar**. O
 * gerador cria as ocorrências que faltam até hoje e avança `nextRunDate` na mesma
 * transação de base de dados em que as cria; se correr duas vezes, a segunda não
 * encontra nada por gerar. Sem isso, abrir a aplicação duas vezes num dia criava
 * duas vezes a renda.
 *
 * Toda a aritmética de datas é feita em UTC e devolve datas de calendário
 * (`YYYY-MM-DD`), como o resto do domínio.
 */

/** Último dia do mês, com o mês em 1-12. */
function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function formatDate(year: number, month: number, day: number): string {
  const shiftedYear = year + Math.floor((month - 1) / 12);
  const normalizedMonth = ((((month - 1) % 12) + 12) % 12) + 1;
  const clampedDay = Math.min(day, lastDayOfMonth(shiftedYear, normalizedMonth));

  return `${String(shiftedYear).padStart(4, '0')}-${String(normalizedMonth).padStart(2, '0')}-${String(
    clampedDay,
  ).padStart(2, '0')}`;
}

function parseDate(isoDate: string): { year: number; month: number; day: number } {
  const [year, month, day] = isoDate.split('-').map(Number);

  if (year === undefined || month === undefined || day === undefined) {
    throw new RangeError(`Data de calendário inválida: ${isoDate}.`);
  }

  return { year, month, day };
}

/**
 * Quantos meses avança cada frequência (a semanal é tratada em dias).
 *
 * A frequência anual existe no tipo do motor (`RecurrenceFrequency`) mesmo sem
 * coluna correspondente na base de dados. Antes, caía na cauda `default` e
 * avançava **um mês** — uma série anual teria gerado doze ocorrências por ano em
 * silêncio. Um valor desconhecido tem de avançar o que promete, ou falhar alto.
 */
function monthsPerStep(frequency: RecurrenceFrequency): number {
  switch (frequency) {
    case 'weekly':
      return 1;
    case 'monthly':
      return 1;
    case 'quarterly':
      return 3;
    case 'yearly':
      return 12;
    default:
      return 1;
  }
}

/**
 * Próxima ocorrência de uma série, a partir de uma data.
 *
 * - `weekly` avança 7 dias por passo;
 * - `monthly` e `quarterly` avançam pelo dia alvo no mês (`dayOfMonth`), com
 *   ajuste para o último dia quando o mês é mais curto — 31 num mês de 30 dias
 *   cai a 30, e em fevereiro cai a 28 ou 29. O dia alvo **não** se perde: a
 *   ocorrência seguinte volta ao 31 se o mês o tiver;
 * - o ajuste é calculado a partir do dia alvo original, e não da data ajustada,
 *   precisamente para não haver deriva (31 → 28 → 28 seria o erro clássico).
 *
 * Atenção: sem `dayOfMonth`, o dia alvo é o **dia de `from`**. Quem percorre uma
 * série tem de resolver o dia uma só vez (`seriesTargetDay`) e passá-lo em todas
 * as iterações; caso contrário, a deriva regressa assim que o cursor passa por um
 * mês curto.
 */
export function nextOccurrence(args: {
  readonly from: string;
  readonly frequency: RecurrenceFrequency;
  readonly interval?: number;
  readonly dayOfMonth?: number;
}): string {
  const interval = Math.max(1, Math.trunc(args.interval ?? 1));
  const { year, month, day } = parseDate(args.from);

  if (args.frequency === 'weekly') {
    const base = new Date(Date.UTC(year, month - 1, day));
    base.setUTCDate(base.getUTCDate() + 7 * interval);

    return base.toISOString().slice(0, 10);
  }

  const step = monthsPerStep(args.frequency) * interval;
  const targetDay = args.dayOfMonth ?? day;

  return formatDate(year, month + step, targetDay);
}

/** Uma ocorrência gerada, com a data em que foi (ou será) criada. */
export interface RecurrenceOccurrence {
  readonly date: string;
}

/**
 * Dia-alvo fixo de uma série.
 *
 * A coluna `dayOfMonth` é nullable. Quando é nula, o dia alvo tem de ser lido
 * **uma só vez**, da primeira data conhecida da série — e não do cursor, que já
 * vem ajustado: 31/01 → 28/02 e, a partir daí, o cursor estava no 28, o que dava
 * **28/03, 28/04, … para sempre**. É o mesmo cuidado que o `dayOfMonth` dado já
 * tinha, e tem de valer também para o caminho por omissão, que é o mais usado.
 */
export function seriesTargetDay(args: {
  readonly nextRunDate: string;
  readonly dayOfMonth?: number;
}): number {
  return args.dayOfMonth ?? Number(args.nextRunDate.slice(8, 10));
}

/**
 * Todas as ocorrências em atraso, até `today` inclusive.
 *
 * Devolve também a próxima data por gerar, para o chamador a gravar. O limite de
 * segurança existe para uma série antiga com uma data de início errada não gerar
 * dez mil lançamentos de uma vez: a partir do limite, para e deixa o utilizador
 * decidir.
 */
export function dueOccurrences(args: {
  readonly nextRunDate: string;
  readonly frequency: RecurrenceFrequency;
  readonly interval?: number;
  readonly dayOfMonth?: number;
  readonly endDate?: string;
  readonly today: string;
  readonly limit?: number;
}): { dates: string[]; nextRunDate: string; truncated: boolean } {
  const limit = args.limit ?? 240;
  const dates: string[] = [];
  let cursor = args.nextRunDate;
  let truncated = false;

  // O dia alvo resolve-se uma vez, a partir da data de partida: sem isto, uma
  // série do dia 31 sem `dayOfMonth` ficava presa no 28 depois de fevereiro.
  const targetDay = seriesTargetDay({
    nextRunDate: args.nextRunDate,
    dayOfMonth: args.dayOfMonth,
  });

  // Guarda contra séries sem fim: um ano de mensalidades é 12; o limite é folgado.
  for (let guard = 0; guard <= limit; guard += 1) {
    if (cursor > args.today) {
      break;
    }

    if (args.endDate !== undefined && cursor > args.endDate) {
      break;
    }

    dates.push(cursor);

    const next = nextOccurrence({
      from: cursor,
      frequency: args.frequency,
      interval: args.interval,
      dayOfMonth: targetDay,
    });

    // Uma série que não avança seria um ciclo infinito a criar o mesmo dia.
    if (next <= cursor) {
      break;
    }

    /*
     * Avançar **antes** de verificar o limite é o que mantém a idempotência: se
     * parássemos com `cursor` na última data já gerada, a corrida seguinte
     * voltaria a criá-la. O avanço tem de acontecer sempre que a ocorrência é
     * aceite, mesmo que a lista vá parar aqui.
     */
    cursor = next;

    if (dates.length >= limit) {
      truncated = true;
      break;
    }
  }

  return { dates, nextRunDate: cursor, truncated };
}

/** Frequência por extenso, para a interface e para os registos. */
export function describeFrequency(args: {
  readonly frequency: RecurrenceFrequency;
  readonly interval?: number;
  readonly dayOfMonth?: number;
}): string {
  const interval = Math.max(1, Math.trunc(args.interval ?? 1));
  const every = interval === 1 ? '' : `a cada ${interval} `;

  switch (args.frequency) {
    case 'weekly':
      return interval === 1 ? 'todas as semanas' : `${every}semanas`;
    case 'monthly': {
      const base = interval === 1 ? 'todos os meses' : `${every}meses`;

      return args.dayOfMonth === undefined ? base : `${base}, dia ${args.dayOfMonth}`;
    }
    case 'quarterly': {
      const base = interval === 1 ? 'todos os trimestres' : `${every}trimestres`;

      return args.dayOfMonth === undefined ? base : `${base}, dia ${args.dayOfMonth}`;
    }
    case 'yearly': {
      const base = interval === 1 ? 'todos os anos' : `${every}anos`;

      return args.dayOfMonth === undefined ? base : `${base}, dia ${args.dayOfMonth}`;
    }
    default:
      return 'periodicamente';
  }
}
