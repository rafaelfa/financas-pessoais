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
 * A frequência anual deixou de existir no tipo: a base de dados admitia `YEARLY`
 * e o motor não o sabia cumprir, por isso quatro sítios convertiam-no em mensal em
 * silêncio. O `default` fica como guarda de runtime (uma string que chegue por
 * uma linha antiga): avança um mês, que é o que a frequência mensal promete, e o
 * caminho normal é `toRecurrenceFrequency` falhar alto antes de cá chegar.
 */
function monthsPerStep(frequency: RecurrenceFrequency): number {
  switch (frequency) {
    case 'weekly':
      return 1;
    case 'monthly':
      return 1;
    case 'quarterly':
      return 3;
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
 * Dia do mês a **gravar** numa série.
 *
 * `dayOfMonth` é nullable e é a única memória do dia contratado. Sem ele, o motor
 * reconstrói o dia alvo a partir da última data gerada — e se essa data já passou
 * por um mês curto (31/01 → 28/02), o 31 perde-se para sempre: a série fica presa
 * no 28 e nenhuma correção posterior o recupera, porque a informação nunca foi
 * gravada. Gravar o dia na criação, a partir do dia do `startDate` quando o
 * utilizador não o indica, é o que torna a regra durável.
 *
 * Uma série **semanal** devolve `null`: o dia do mês não faz parte da regra dela,
 * e guardá-lo seria uma segunda verdade sobre a mesma série.
 */
export function seriesDayOfMonth(args: {
  readonly frequency: RecurrenceFrequency;
  readonly startDate: string;
  readonly dayOfMonth?: number | null;
}): number | null {
  if (args.frequency === 'weekly') {
    return null;
  }

  return args.dayOfMonth ?? Number(args.startDate.slice(8, 10));
}

/**
 * Traduz a frequência gravada (enum do Prisma, em maiúsculas) no tipo do motor.
 *
 * Existe porque quatro sítios liam a base de dados e cada um tinha a sua cauda
 * `else`: um `YEARLY` — valor que a base admitia e o motor não sabe cumprir —
 * caía nela e virava **mensal em silêncio**, e o gerador criava doze ocorrências
 * por ano. Um valor que o motor não conhece tem de falhar alto: adivinhar é o
 * defeito, não a tolerância.
 */
export function toRecurrenceFrequency(value: string): RecurrenceFrequency {
  switch (value) {
    case 'WEEKLY':
      return 'weekly';
    case 'MONTHLY':
      return 'monthly';
    case 'QUARTERLY':
      return 'quarterly';
    default:
      // Inclui o `YEARLY`, que a base admitia e o motor não sabe cumprir: assumir
      // mensal criava doze ocorrências por ano sem ninguém dar por isso.
      throw new RangeError(`Frequência desconhecida: "${value}".`);
  }
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
    default:
      return 'periodicamente';
  }
}
