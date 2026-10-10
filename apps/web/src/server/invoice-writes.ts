import { prisma, type Prisma } from '@repo/db/client';
import { invoiceChain, invoiceDatesFor, toIsoDate } from '@repo/shared';

import { TRANSACTION_SELECT } from './accounts';
import { toFinanceInvoice, toFinancePayment, toFinanceTransaction } from './mapping';

/**
 * Escrita de faturas.
 *
 * Duas operações que a criação de compras e o pagamento de faturas têm de
 * partilhar, para não haver duas versões da mesma regra:
 *
 * 1. **Encontrar ou criar a fatura de uma compra** — a regra de fecho e
 *    vencimento vive no motor (`invoiceDatesFor`), e a unicidade
 *    `(cardId, closingDate)` garante que duas compras do mesmo ciclo caem na
 *    mesma fatura em vez de criarem duas.
 * 2. **Recalcular a cache das faturas** de um cartão depois de qualquer
 *    alteração. As colunas `totalAmountInCents`, `paidAmountInCents`,
 *    `carriedOverInCents` e `status` existem para consulta rápida, mas quem manda
 *    é a cadeia calculada: deixá-las por atualizar seria ter dois números
 *    diferentes para a mesma dívida.
 */

/** Cliente de base de dados: a transação em curso, ou a ligação normal. */
export type Db = Prisma.TransactionClient | typeof prisma;

/** Data de calendário a partir de uma string `YYYY-MM-DD`. */
function asDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/** Fatura do ciclo que contém a data indicada, criada se ainda não existir. */
export async function ensureInvoiceForDate(args: {
  readonly userId: string;
  readonly cardId: string;
  readonly purchaseDate: string;
  readonly closingDay: number;
  readonly dueDay: number;
  readonly db?: Db;
}): Promise<{ id: string; closingDate: string; dueDate: string }> {
  const db = args.db ?? prisma;
  const { closingDate, dueDate } = invoiceDatesFor({
    purchaseDate: args.purchaseDate,
    closingDay: args.closingDay,
    dueDay: args.dueDay,
  });

  const invoice = await db.invoice.upsert({
    where: { cardId_closingDate: { cardId: args.cardId, closingDate: asDate(closingDate) } },
    // Compras do mesmo ciclo partilham a fatura: não se reescrevem as datas.
    update: {},
    create: {
      userId: args.userId,
      cardId: args.cardId,
      closingDate: asDate(closingDate),
      dueDate: asDate(dueDate),
    },
    select: { id: true },
  });

  return { id: invoice.id, closingDate, dueDate };
}

/**
 * Recalcula e persiste os totais das faturas de um cartão.
 *
 * A cadeia é a fonte de verdade; estas colunas são a sua cache. Chamar isto
 * depois de criar, alterar ou apagar compras e pagamentos mantém as duas
 * coerentes — e o custo é de três consultas por cartão afetado.
 */
export async function refreshInvoiceCache(args: {
  readonly userId: string;
  readonly cardId: string;
  readonly today: string;
}): Promise<void> {
  const [invoices, transactions, payments] = await Promise.all([
    prisma.invoice.findMany({
      where: { userId: args.userId, cardId: args.cardId },
      orderBy: { closingDate: 'asc' },
    }),
    prisma.transaction.findMany({ where: { userId: args.userId }, select: TRANSACTION_SELECT }),
    prisma.invoicePayment.findMany({ where: { userId: args.userId } }),
  ]);

  if (invoices.length === 0) {
    return;
  }

  const chain = invoiceChain({
    invoices: invoices.map(toFinanceInvoice),
    transactions: transactions.map(toFinanceTransaction),
    payments: payments.map(toFinancePayment),
    today: args.today,
  });

  const byId = new Map(invoices.map((invoice) => [invoice.id, invoice]));

  for (const entry of chain) {
    const current = byId.get(entry.invoiceId);

    if (current === undefined) {
      continue;
    }

    const paidAt = entry.status === 'paid' ? (current.paidAt ?? new Date()) : null;
    const closedAt =
      entry.status === 'open'
        ? null
        : (current.closedAt ?? new Date(`${entry.closingDate}T00:00:00.000Z`));

    await prisma.invoice.update({
      where: { id: entry.invoiceId },
      data: {
        totalAmountInCents: entry.totalInCents,
        paidAmountInCents: entry.paidInCents,
        carriedOverInCents: entry.carriedOverInCents,
        status: entry.status === 'paid' ? 'PAID' : entry.status === 'closed' ? 'CLOSED' : 'OPEN',
        paidAt,
        closedAt,
      },
    });
  }
}

/** Data de hoje em formato de calendário, para escrita explícita. */
export function calendarToday(): string {
  return toIsoDate(new Date());
}
