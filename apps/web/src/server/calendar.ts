import { prisma } from '@repo/db/client';

import { todayInLisbon } from '@/lib/today';
import { lastInvoiceByCard, listInvoices } from '@/server/invoices';
import { requireUser } from '@/server/session';

/**
 * O mês de vencimentos e de movimentos previstos (T55).
 *
 * Quatro fontes, nenhuma tabela nova: contas a pagar/receber abertas, faturas de
 * cartão fechadas e por pagar, recorrências ativas e lançamentos por liquidar.
 * Tudo é **lido** — o calendário não cria, não paga e não apaga nada; cada item
 * leva ao ecrã onde a ação existe.
 *
 * Duas armadilhas que valeram um DEVE na T54 e que aqui se evitam de propósito:
 * o estado `OVERDUE` das contas **nunca é gravado** (vencida é `OPEN` com o
 * vencimento no passado) e o estado das faturas é **derivado** pela cadeia
 * (`listInvoices`), não lido da coluna. As faturas de 0,00 € ficam de fora: uma
 * fatura fechada sem nada por pagar não é dinheiro a sair.
 */

export type CalendarSource = 'conta' | 'fatura' | 'recorrencia' | 'lancamento';

export interface CalendarItem {
  readonly id: string;
  /** Dia do movimento, `YYYY-MM-DD`. */
  readonly date: string;
  readonly label: string;
  readonly detail: string;
  readonly source: CalendarSource;
  readonly href: string;
  /** Com sinal: negativo sai, positivo entra. */
  readonly amountInCents: number;
  readonly overdue: boolean;
}

export interface CalendarDay {
  readonly date: string;
  readonly items: readonly CalendarItem[];
  /**
   * Movimentos do dia **já liquidados**. Aparecem no painel do dia e ficam
   * fora de `items` de propósito: os totais do mês são o que falta pagar.
   */
  readonly settledItems: readonly CalendarItem[];
  /**
   * Compras do dia metidas numa fatura de cartão. Também fora de `items` e de
   * qualquer soma: neste dia não sai dinheiro da conta, sai na fatura.
   */
  readonly cardItems: readonly CalendarItem[];
  readonly inflowInCents: number;
  readonly outflowInCents: number;
  readonly balanceInCents: number;
}

export interface CalendarMonth {
  readonly month: string;
  readonly label: string;
  readonly today: string;
  readonly isCurrentMonth: boolean;
  readonly days: readonly CalendarDay[];
  /** Contas em atraso de meses anteriores, só quando o mês visto é o corrente. */
  readonly overdue: readonly CalendarItem[];
  /** Totais dos itens **do mês** (o atraso tem o seu próprio). */
  readonly toPayInCents: number;
  readonly toReceiveInCents: number;
  readonly balanceInCents: number;
}

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** `?mes=2026-11` válido, ou o mês corrente. `2026-13`, `abc`, datas completas caem no corrente. */
export function readMonth(value: string | undefined, today: string = todayInLisbon()): string {
  const match = value === undefined ? null : MONTH_PATTERN.exec(value.trim());
  /*
   * O padrão aceita `0000`–`0099`, mas `Date.UTC(99, …)` mapeia para 1999: sem
   * esta guarda, `?mes=0099-05` mostrava um mês vazio com o rótulo de 1999.
   */
  const year = match === null ? NaN : Number(match[1]);

  if (match === null || !Number.isFinite(year) || year < 1900 || year > 2999) {
    return today.slice(0, 7);
  }

  return `${match[1]}-${match[2]}`;
}

function monthBounds(month: string): { start: string; nextStart: string; dayCount: number } {
  const [yearText, monthText] = month.split('-');
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const next = new Date(Date.UTC(year, monthIndex + 1, 1));
  const dayCount = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

  return {
    start: `${month}-01`,
    nextStart: next.toISOString().slice(0, 10),
    dayCount,
  };
}

/** Primeiro dia do mês seguinte ao de uma data — usado para o mês em atraso. */
function shiftMonth(month: string, delta: number): string {
  const [yearText, monthText] = month.split('-');
  const shifted = new Date(Date.UTC(Number(yearText), Number(monthText) - 1 + delta, 1));

  return shifted.toISOString().slice(0, 7);
}

function monthLabel(month: string): string {
  return new Intl.DateTimeFormat('pt-PT', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${month}-01T00:00:00Z`));
}

const KIND_LABELS: Record<string, string> = {
  expense: 'Gasto',
  income: 'Ganho',
  transfer: 'Transferência',
  invoice_payment: 'Pagamento de fatura',
  goal_deposit: 'Aporte em objetivo',
  goal_withdrawal: 'Resgate de objetivo',
  balance_adjust: 'Ajuste de saldo',
};

export async function getMonthCalendar(mes?: string): Promise<CalendarMonth> {
  const user = await requireUser();
  const today = todayInLisbon();
  const month = readMonth(mes, today);
  const { start, nextStart, dayCount } = monthBounds(month);
  const isCurrentMonth = month === today.slice(0, 7);

  const [payables, invoices, recurrences, unsettled, movimentos] = await Promise.all([
    prisma.receivablePayable.findMany({
      where: {
        userId: user.id,
        /*
         * `OVERDUE` nunca é gravado pela aplicação: uma conta vencida continua
         * `OPEN` com o vencimento no passado. Ler o estado cru daria zero.
         */
        status: 'OPEN',
        dueDate: { gte: new Date(start), lt: new Date(nextStart) },
      },
      select: { id: true, type: true, description: true, amountInCents: true, dueDate: true },
      orderBy: { dueDate: 'asc' },
    }),

    // Faturas: estado derivado + valor por pagar (T54).
    listInvoices(),

    prisma.recurrence.findMany({
      where: {
        userId: user.id,
        isActive: true,
        nextRunDate: { gte: new Date(start), lt: new Date(nextStart) },
      },
      select: { id: true, name: true, kind: true, amountInCents: true, nextRunDate: true },
      orderBy: { nextRunDate: 'asc' },
    }),

    /*
     * Lançamentos por liquidar. Fica de fora o que já vem pela fatura do cartão
     * (`invoiceId`): a compra aparece na fatura, no dia do vencimento — mostrá-la
     * outra vez no dia da compra contava o mesmo dinheiro duas vezes.
     */
    prisma.transaction.findMany({
      where: {
        userId: user.id,
        settled: false,
        status: { not: 'IGNORED' },
        invoiceId: null,
        date: { gte: new Date(start), lt: new Date(nextStart) },
      },
      select: { id: true, description: true, kind: true, amountInCents: true, date: true },
      orderBy: { date: 'asc' },
    }),

    /*
     * Os dois grupos que o painel do dia mostra a mais, numa leitura só:
     * **já liquidados** (dinheiro que já saiu da conta — sem isto, lançar e não
     * ver nada) e **compras no cartão** (`invoiceId` não nulo: o dinheiro sai na
     * fatura, não neste dia). Nenhum deles entra nos totais nem nas somas do dia.
     */
    prisma.transaction.findMany({
      where: {
        userId: user.id,
        status: { not: 'IGNORED' },
        date: { gte: new Date(start), lt: new Date(nextStart) },
        OR: [{ settled: true, invoiceId: null }, { invoiceId: { not: null } }],
      },
      select: {
        id: true,
        description: true,
        kind: true,
        amountInCents: true,
        date: true,
        invoiceId: true,
        transferGroupId: true,
      },
      orderBy: { date: 'asc' },
    }),
  ]);

  /*
   * Só a **última fatura da cadeia de cada cartão** conta dinheiro, nos dias e na
   * faixa — a regra vive em `lastInvoiceByCard` (`server/invoices.ts`), partilhada
   * com a Revisão (T61). O que ficou por pagar de uma fatura transita para a
   * seguinte, por isso somar duas faturas do mesmo cartão conta o mesmo dinheiro
   * duas vezes.
   *
   * Consequência assumida: se a última fatura de um cartão estiver `open`, o que
   * veio transitado não aparece no calendário até essa fatura fechar — a data de
   * pagamento moveu-se para a frente, e é isso que o trânsito significa.
   */
  const billableInvoices = lastInvoiceByCard(invoices);

  const items: CalendarItem[] = [
    ...payables.map((payable): CalendarItem => {
      const date = payable.dueDate.toISOString().slice(0, 10);
      const out = payable.type === 'PAYABLE';

      return {
        id: payable.id,
        date,
        label: payable.description,
        detail: out ? 'Conta a pagar' : 'Conta a receber',
        source: 'conta',
        href: '/contas-pagar-receber',
        amountInCents: out ? -Math.abs(payable.amountInCents) : Math.abs(payable.amountInCents),
        overdue: date < today,
      };
    }),

    ...billableInvoices
      .filter(
        (invoice) =>
          invoice.status === 'closed' &&
          invoice.outstandingInCents > 0 &&
          invoice.dueDate >= start &&
          invoice.dueDate < nextStart,
      )
      .map((invoice): CalendarItem => ({
        id: invoice.id,
        date: invoice.dueDate,
        label: `Fatura ${invoice.cardName}`,
        detail: 'Fatura do cartão',
        source: 'fatura',
        href: '/cartoes',
        amountInCents: -invoice.outstandingInCents,
        overdue: invoice.dueDate < today,
      })),

    ...recurrences.map((recurrence): CalendarItem => {
      const date = recurrence.nextRunDate.toISOString().slice(0, 10);
      const out = recurrence.kind !== 'INCOME';

      return {
        id: recurrence.id,
        date,
        label: recurrence.name,
        detail: 'Recorrência',
        source: 'recorrencia',
        href: '/recorrencias',
        amountInCents: out
          ? -Math.abs(recurrence.amountInCents)
          : Math.abs(recurrence.amountInCents),
        overdue: false,
      };
    }),

    ...unsettled.map((transaction): CalendarItem => ({
      id: transaction.id,
      date: transaction.date.toISOString().slice(0, 10),
      label: transaction.description ?? 'Sem descrição',
      detail: `${KIND_LABELS[transaction.kind.toLowerCase()] ?? transaction.kind} por liquidar`,
      source: 'lancamento',
      href: '/transacoes',
      amountInCents: transaction.amountInCents,
      overdue: false,
    })),
  ].sort((a, b) =>
    a.date === b.date ? a.label.localeCompare(b.label, 'pt') : a.date < b.date ? -1 : 1,
  );

  const invoiceById = new Map(invoices.map((invoice) => [invoice.id, invoice]));

  /** Fora de `items`: ver os comentários de `CalendarDay`. */
  const settledItems: CalendarItem[] = [];
  const transferGroups = new Set<string>();

  for (const transaction of movimentos) {
    /*
     * Compras no cartão são do outro grupo. Pagar a fatura é outra coisa: é um
     * `INVOICE_PAYMENT` com `invoiceId` **e** `settled: true` — o dinheiro saiu
     * neste dia, portanto é liquidado (`docs/spec/F1`, regra 7).
     */
    if (transaction.invoiceId !== null && transaction.kind !== 'INVOICE_PAYMENT') {
      continue;
    }

    const date = transaction.date.toISOString().slice(0, 10);

    /*
     * Uma transferência são duas pernas, com sinais opostos, no mesmo dia. Duas
     * linhas iguais que se anulam não se explicam a ninguém: fica uma, a zero.
     */
    if (transaction.transferGroupId !== null) {
      if (transferGroups.has(transaction.transferGroupId)) {
        continue;
      }

      transferGroups.add(transaction.transferGroupId);
      settledItems.push({
        id: transaction.transferGroupId,
        date,
        label: 'Transferência',
        detail: transaction.description ?? 'Entre contas',
        source: 'lancamento',
        href: '/transacoes',
        amountInCents: 0,
        overdue: false,
      });
      continue;
    }

    settledItems.push({
      id: transaction.id,
      date,
      label: transaction.description ?? 'Sem descrição',
      detail: `${KIND_LABELS[transaction.kind.toLowerCase()] ?? transaction.kind} liquidado`,
      source: 'lancamento',
      href: '/transacoes',
      amountInCents: transaction.amountInCents,
      overdue: false,
    });
  }

  const cardItems: CalendarItem[] = movimentos
    .filter(
      (transaction) => transaction.invoiceId !== null && transaction.kind !== 'INVOICE_PAYMENT',
    )
    .map((transaction): CalendarItem => {
      const invoice = invoiceById.get(transaction.invoiceId ?? '');
      const when =
        invoice === undefined
          ? null
          : `${invoice.dueDate.slice(8, 10)}/${invoice.dueDate.slice(5, 7)}`;
      /* Fatura paga: o dinheiro já saiu, o rótulo diz isso em vez de prometer. */
      const verbo = invoice?.status === 'paid' ? 'saiu' : 'entra';

      return {
        id: transaction.id,
        date: transaction.date.toISOString().slice(0, 10),
        label: transaction.description ?? 'Compra no cartão',
        detail:
          when === null
            ? 'Compra no cartão — entra na fatura'
            : `Compra no cartão — ${verbo} na fatura de ${when}`,
        source: 'lancamento',
        href: '/cartoes',
        amountInCents: transaction.amountInCents,
        overdue: false,
      };
    });

  const days: CalendarDay[] = Array.from({ length: dayCount }, (_, index) => {
    const date = `${month}-${String(index + 1).padStart(2, '0')}`;
    const ofDay = items.filter((item) => item.date === date);
    const inflowInCents = ofDay.reduce(
      (total, item) => (item.amountInCents > 0 ? total + item.amountInCents : total),
      0,
    );
    const outflowInCents = ofDay.reduce(
      (total, item) => (item.amountInCents < 0 ? total + Math.abs(item.amountInCents) : total),
      0,
    );

    return {
      date,
      items: ofDay,
      settledItems: settledItems.filter((item) => item.date === date),
      cardItems: cardItems.filter((item) => item.date === date),
      inflowInCents,
      outflowInCents,
      balanceInCents: inflowInCents - outflowInCents,
    };
  });

  /*
   * Em atraso de meses anteriores, e só no mês corrente: é o que se perdia
   * quando o mês virava. São **itens** — contas e faturas —, não só contas: uma
   * fatura fechada com valor por pagar e vencimento em outubro também é dívida
   * deste mês, e sem isto o dinheiro só se encontrava em `/cartoes`.
   *
   * Não entram nos totais do mês — têm o seu — para a soma dos três totais
   * continuar a bater com os itens que estão nos dias.
   */
  const overdue: CalendarItem[] = isCurrentMonth
    ? [
        ...(
          await prisma.receivablePayable.findMany({
            where: { userId: user.id, status: 'OPEN', dueDate: { lt: new Date(start) } },
            select: { id: true, type: true, description: true, amountInCents: true, dueDate: true },
            orderBy: { dueDate: 'asc' },
          })
        ).map((payable): CalendarItem => {
          const out = payable.type === 'PAYABLE';

          return {
            id: payable.id,
            date: payable.dueDate.toISOString().slice(0, 10),
            label: payable.description,
            detail: out ? 'Conta a pagar' : 'Conta a receber',
            source: 'conta',
            href: '/contas-pagar-receber',
            amountInCents: out ? -Math.abs(payable.amountInCents) : Math.abs(payable.amountInCents),
            overdue: true,
          };
        }),

        // Faturas fechadas, por pagar e já vencidas: o mesmo mapeamento dos dias
        // e a mesma regra (só a última da cadeia de cada cartão).
        ...billableInvoices
          .filter(
            (invoice) =>
              invoice.status === 'closed' &&
              invoice.outstandingInCents > 0 &&
              invoice.dueDate < start,
          )
          .map((invoice): CalendarItem => ({
            id: invoice.id,
            date: invoice.dueDate,
            label: `Fatura ${invoice.cardName}`,
            detail: 'Fatura do cartão',
            source: 'fatura',
            href: '/cartoes',
            amountInCents: -invoice.outstandingInCents,
            overdue: true,
          })),
      ].sort((a, b) =>
        a.date === b.date ? a.label.localeCompare(b.label, 'pt') : a.date < b.date ? -1 : 1,
      )
    : [];

  const toPayInCents = items.reduce(
    (total, item) => (item.amountInCents < 0 ? total + Math.abs(item.amountInCents) : total),
    0,
  );
  const toReceiveInCents = items.reduce(
    (total, item) => (item.amountInCents > 0 ? total + item.amountInCents : total),
    0,
  );

  return {
    month,
    label: monthLabel(month),
    today,
    isCurrentMonth,
    days,
    overdue,
    toPayInCents,
    toReceiveInCents,
    balanceInCents: toReceiveInCents - toPayInCents,
  };
}

/** Mês anterior/seguinte, para os links de navegação. */
export function shiftCalendarMonth(month: string, delta: number): string {
  return shiftMonth(month, delta);
}
