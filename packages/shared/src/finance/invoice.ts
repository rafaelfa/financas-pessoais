import type { FinanceInvoice, FinanceInvoicePayment, FinanceTransaction } from './types';

/**
 * Faturas de cartão de crédito.
 *
 * Regras do sistema de referência (documento 01, §5.5):
 * - o total da fatura é a soma dos gastos do cartão no período, mais o que
 *   transitou da fatura anterior;
 * - um pagamento parcial faz transitar o restante para a fatura seguinte;
 * - o pagamento total deixa a fatura seguinte a zero;
 * - a competência (mês da compra) pode ser diferente do mês do vencimento;
 * - a primeira fatura é criada automaticamente com o primeiro gasto.
 *
 * O que **não** replicamos: o pagamento da fatura entrar no extrato como
 * "ganho". Aqui é uma operação própria (`invoice_payment`) que liquida um
 * passivo e nunca contamina entradas ou saídas (melhoria M4).
 */

export type InvoiceStatus = 'open' | 'closed' | 'paid';

export interface InvoiceTotals {
  readonly invoiceId: string;
  /** Compras do cartão afetas a esta fatura. */
  readonly purchasesInCents: number;
  /** Valor transitado da fatura anterior. */
  readonly carriedOverInCents: number;
  readonly totalInCents: number;
  readonly paidInCents: number;
  /** Por pagar; nunca negativo. */
  readonly outstandingInCents: number;
  readonly status: InvoiceStatus;
  readonly closingDate: string;
  readonly dueDate: string;
}

function lastDayOfMonth(year: number, month: number): number {
  // `month` é 1-12; o dia 0 do mês seguinte é o último dia deste mês.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function dateInMonth(year: number, month: number, day: number): string {
  const parts = month;
  const yearShift = Math.floor((parts - 1) / 12);
  const normalizedMonth = ((((parts - 1) % 12) + 12) % 12) + 1;
  const normalizedYear = year + yearShift;
  const clampedDay = Math.min(day, lastDayOfMonth(normalizedYear, normalizedMonth));

  return new Date(Date.UTC(normalizedYear, normalizedMonth - 1, clampedDay))
    .toISOString()
    .slice(0, 10);
}

/**
 * Datas de fecho e de vencimento da fatura que recebe uma compra.
 *
 * Uma compra até ao dia de fecho pertence à fatura desse mês; depois do fecho,
 * passa para a seguinte. O vencimento cai no mesmo mês do fecho se o dia de
 * vencimento for posterior ao de fecho; caso contrário, no mês seguinte.
 */
export function invoiceDatesFor(args: {
  readonly purchaseDate: string;
  readonly closingDay: number;
  readonly dueDay: number;
}): { closingDate: string; dueDate: string } {
  const [year, month, day] = args.purchaseDate.split('-').map(Number) as [number, number, number];

  const closingMonth = day <= args.closingDay ? month : month + 1;
  const dueMonth = args.dueDay > args.closingDay ? closingMonth : closingMonth + 1;

  return {
    closingDate: dateInMonth(year, closingMonth, args.closingDay),
    dueDate: dateInMonth(year, dueMonth, args.dueDay),
  };
}

/** Totais e estado de uma fatura. */
export function invoiceTotals(args: {
  readonly invoice: FinanceInvoice;
  readonly transactions: readonly FinanceTransaction[];
  readonly payments: readonly FinanceInvoicePayment[];
  /** Data de referência para decidir se a fatura já fechou. */
  readonly today: string;
}): InvoiceTotals {
  const purchasesInCents = args.transactions
    .filter((transaction) => transaction.invoiceId === args.invoice.id)
    .filter((transaction) => transaction.kind === 'expense')
    .filter((transaction) => transaction.status !== 'ignored')
    .reduce((total, transaction) => total + Math.abs(transaction.amountInCents), 0);

  const carriedOverInCents = args.invoice.carriedOverInCents ?? 0;
  const totalInCents = carriedOverInCents + purchasesInCents;
  const paidInCents = args.payments
    .filter((payment) => payment.invoiceId === args.invoice.id)
    .reduce((total, payment) => total + payment.amountInCents, 0);
  const outstandingInCents = Math.max(0, totalInCents - paidInCents);

  let status: InvoiceStatus = 'open';

  if (totalInCents > 0 && outstandingInCents === 0) {
    status = 'paid';
  } else if (args.today >= args.invoice.closingDate) {
    status = 'closed';
  }

  return {
    invoiceId: args.invoice.id,
    purchasesInCents,
    carriedOverInCents,
    totalInCents,
    paidInCents,
    outstandingInCents,
    status,
    closingDate: args.invoice.closingDate,
    dueDate: args.invoice.dueDate,
  };
}

/** Valor a transitar para a fatura seguinte depois de um pagamento parcial. */
export function carriedOverToNextInvoice(totals: InvoiceTotals): number {
  return totals.outstandingInCents;
}

/**
 * Reparte um valor por N parcelas **sem perder nem inventar cêntimos**.
 *
 * A sobra da divisão inteira é distribuída uma unidade de cêntimo pelas
 * primeiras parcelas, para que a soma seja exatamente o valor original. Num
 * parcelamento de 100,00 € em 3 vezes dá 33,34 + 33,33 + 33,33.
 */
export function splitInstallments(amountInCents: number, count: number): number[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError(
      `O número de parcelas tem de ser um inteiro positivo; recebido: ${count}.`,
    );
  }

  const magnitude = Math.abs(Math.round(amountInCents));
  const base = Math.floor(magnitude / count);
  const remainder = magnitude - base * count;

  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

/**
 * Pagamentos que faltam para liquidar uma fatura, com o valor em dívida.
 * Alimenta o assistente de fecho de mês e os alertas de fatura a vencer.
 */
export function unpaidInvoices(args: {
  readonly invoices: readonly FinanceInvoice[];
  readonly transactions: readonly FinanceTransaction[];
  readonly payments: readonly FinanceInvoicePayment[];
  readonly today: string;
}): InvoiceTotals[] {
  return args.invoices
    .map((invoice) =>
      invoiceTotals({
        invoice,
        transactions: args.transactions,
        payments: args.payments,
        today: args.today,
      }),
    )
    .filter((totals) => totals.outstandingInCents > 0)
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
}
