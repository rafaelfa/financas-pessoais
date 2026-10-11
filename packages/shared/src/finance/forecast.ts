import { totalBalanceInCents } from './balance';
import { nextOccurrence } from './recurrence';
import type {
  FinanceAccount,
  FinanceTransaction,
  RecurrenceFrequency,
  TransactionKind,
} from './types';

/**
 * Previsão de saldo.
 *
 * O painel mostrava o presente e não avisava do futuro. Quem tem a renda ao dia 8
 * e o ordenado ao dia 5 precisa de saber, **antes**, se o saldo fica negativo
 * pelo caminho — e é isso que esta função responde.
 *
 * O que entra na previsão é só o que já está contratado:
 * - as **ocorrências futuras das recorrências ativas**, pelas mesmas datas que o
 *   gerador usaria (a mesma função `nextOccurrence`, para a previsão não divergir
 *   do que vai ser realmente criado);
 * - as **faturas de cartão por pagar**, na respetiva data de vencimento.
 *
 * Não entra nada que dependa de adivinhação: gastos variáveis do dia a dia não se
 * preveem, e uma previsão que inventa valores é pior do que não existir.
 */

/** Uma série recorrente, tal como a previsão precisa de a ver. */
export interface ForecastRecurrence {
  readonly id: string;
  readonly name: string;
  readonly kind: TransactionKind;
  /** Efeito assinado na conta (um gasto é negativo). */
  readonly amountInCents: number;
  readonly frequency: RecurrenceFrequency;
  readonly interval?: number;
  readonly dayOfMonth?: number;
  readonly nextRunDate: string;
  readonly endDate?: string;
  readonly isActive: boolean;
}

/** Uma fatura por pagar, com o valor em dívida e o vencimento. */
export interface ForecastInvoice {
  readonly id: string;
  readonly cardName: string;
  readonly dueDate: string;
  readonly outstandingInCents: number;
}

export interface ForecastItem {
  readonly label: string;
  readonly amountInCents: number;
  readonly source: 'recurrence' | 'invoice';
}

export interface ForecastDay {
  readonly date: string;
  /** Saldo no fim deste dia. */
  readonly balanceInCents: number;
  readonly inflowInCents: number;
  readonly outflowInCents: number;
  readonly items: readonly ForecastItem[];
}

export interface ForecastResult {
  readonly startingBalanceInCents: number;
  readonly days: readonly ForecastDay[];
  readonly lowestBalanceInCents: number;
  readonly lowestDate: string | null;
  readonly goesNegative: boolean;
  readonly firstNegativeDate: string | null;
  readonly totalInflowInCents: number;
  readonly totalOutflowInCents: number;
  readonly endingBalanceInCents: number;
}

/** Soma `days` dias a uma data de calendário. */
function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

/** Todas as ocorrências de uma série entre duas datas (exclusive no início). */
function occurrencesBetween(args: {
  readonly recurrence: ForecastRecurrence;
  readonly after: string;
  readonly until: string;
}): string[] {
  const dates: string[] = [];
  let cursor = args.recurrence.nextRunDate;

  // Uma série parada no passado pode ter muitas ocorrências em atraso; o limite
  // existe para a previsão não se transformar num ciclo sobre anos de história.
  for (let guard = 0; guard < 400; guard += 1) {
    if (cursor > args.until) {
      break;
    }

    if (args.recurrence.endDate !== undefined && cursor > args.recurrence.endDate) {
      break;
    }

    if (cursor >= args.after) {
      dates.push(cursor);
    } else {
      /*
       * Já venceu e ainda não foi gerada: é uma obrigação de **hoje**, não uma
       * data passada. Contá-la no passado seria ignorá-la (o passado não se
       * prevê) e deixaria a previsão a prometer um saldo que já não existe.
       */
      dates.push(args.after);
    }

    const next = nextOccurrence({
      from: cursor,
      frequency: args.recurrence.frequency,
      interval: args.recurrence.interval,
      dayOfMonth: args.recurrence.dayOfMonth,
    });

    if (next <= cursor) {
      break;
    }

    cursor = next;
  }

  return dates;
}

/** Previsão do saldo total, dia a dia, a partir de hoje. */
export function cashFlowForecast(input: {
  readonly accounts: readonly FinanceAccount[];
  readonly transactions: readonly FinanceTransaction[];
  readonly recurrences: readonly ForecastRecurrence[];
  readonly unpaidInvoices: readonly ForecastInvoice[];
  /** Data de referência (normalmente hoje). */
  readonly from: string;
  readonly days: number;
}): ForecastResult {
  const startingBalanceInCents = totalBalanceInCents(input.accounts, input.transactions);
  const horizonEnd = addDays(input.from, Math.max(0, input.days));

  // Agenda: que movimentos contratados caem em cada dia.
  const scheduled = new Map<string, ForecastItem[]>();

  function schedule(date: string, item: ForecastItem): void {
    scheduled.set(date, [...(scheduled.get(date) ?? []), item]);
  }

  for (const recurrence of input.recurrences) {
    if (!recurrence.isActive) {
      continue;
    }

    for (const date of occurrencesBetween({
      recurrence,
      after: input.from,
      until: horizonEnd,
    })) {
      schedule(date, {
        label: recurrence.name,
        amountInCents: recurrence.amountInCents,
        source: 'recurrence',
      });
    }
  }

  for (const invoice of input.unpaidInvoices) {
    if (
      invoice.outstandingInCents <= 0 ||
      invoice.dueDate <= input.from ||
      invoice.dueDate > horizonEnd
    ) {
      continue;
    }

    schedule(invoice.dueDate, {
      label: `Fatura ${invoice.cardName}`,
      // Pagar uma fatura tira dinheiro da conta.
      amountInCents: -invoice.outstandingInCents,
      source: 'invoice',
    });
  }

  const days: ForecastDay[] = [];
  let balance = startingBalanceInCents;
  let totalInflow = 0;
  let totalOutflow = 0;
  let lowest = startingBalanceInCents;
  let lowestDate: string | null = null;
  let firstNegativeDate: string | null = null;

  for (let offset = 0; offset <= Math.max(0, input.days); offset += 1) {
    const date = addDays(input.from, offset);
    const items = scheduled.get(date) ?? [];
    let inflow = 0;
    let outflow = 0;

    for (const item of items) {
      if (item.amountInCents >= 0) {
        inflow += item.amountInCents;
      } else {
        outflow += Math.abs(item.amountInCents);
      }
    }

    balance += inflow - outflow;
    totalInflow += inflow;
    totalOutflow += outflow;

    if (balance < lowest) {
      lowest = balance;
      lowestDate = date;
    }

    if (balance < 0 && firstNegativeDate === null) {
      firstNegativeDate = date;
    }

    days.push({
      date,
      balanceInCents: balance,
      inflowInCents: inflow,
      outflowInCents: outflow,
      items,
    });
  }

  return {
    startingBalanceInCents,
    days,
    lowestBalanceInCents: lowest,
    lowestDate,
    goesNegative: firstNegativeDate !== null,
    firstNegativeDate,
    totalInflowInCents: totalInflow,
    totalOutflowInCents: totalOutflow,
    endingBalanceInCents: balance,
  };
}
