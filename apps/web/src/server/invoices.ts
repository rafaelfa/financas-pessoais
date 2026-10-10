import { prisma } from '@repo/db/client';
import { toIsoDate } from '@repo/shared';

import { todayInLisbon } from '@/lib/today';

import { loadInvoiceContext, type InvoiceSummary } from './invoice-context';
import { requireUser } from './session';

export type { InvoiceSummary };

/** Uma compra afeta a esta fatura. */
export interface InvoicePurchase {
  readonly id: string;
  readonly date: string;
  readonly description: string | null;
  readonly amountInCents: number;
  /** Posição no parcelamento, quando a compra foi parcelada. */
  readonly installmentNumber: number | null;
  readonly installmentCount: number | null;
}

/** Um pagamento aplicado a esta fatura. */
export interface InvoicePaymentView {
  readonly id: string;
  readonly amountInCents: number;
  readonly date: string;
  readonly accountName: string | null;
  readonly note: string | null;
}

export interface InvoiceDetail extends InvoiceSummary {
  readonly cardClosingDay: number;
  readonly cardDueDay: number;
  readonly purchases: readonly InvoicePurchase[];
  readonly payments: readonly InvoicePaymentView[];
  /** Fatura para onde transita o que ficar por pagar. */
  readonly nextInvoice: { id: string; closingDate: string; dueDate: string } | null;
}

/**
 * Faturas do utilizador, da mais recente para a mais antiga.
 *
 * A ordenação é por data de vencimento decrescente porque é assim que se lê um
 * extrato de cartão: o que está a acontecer agora em cima.
 */
export async function listInvoices(cardId?: string): Promise<InvoiceSummary[]> {
  const user = await requireUser();
  const context = await loadInvoiceContext(user.id, todayInLisbon());

  const filtered =
    cardId === undefined
      ? [...context.summaries]
      : context.summaries.filter((invoice) => invoice.cardId === cardId);

  return filtered.sort((a, b) => (a.dueDate < b.dueDate ? 1 : a.dueDate > b.dueDate ? -1 : 0));
}

/** Detalhe de uma fatura: compras, pagamentos e para onde transita o que resta. */
export async function getInvoiceDetail(invoiceId: string): Promise<InvoiceDetail | null> {
  const user = await requireUser();
  const context = await loadInvoiceContext(user.id, todayInLisbon());
  const summary = context.summaries.find((invoice) => invoice.id === invoiceId);

  if (summary === undefined) {
    return null;
  }

  const card = context.cards.find((entry) => entry.id === summary.cardId);

  const [transactions, payments, accountRows] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId: user.id, invoiceId, kind: 'EXPENSE', status: { not: 'IGNORED' } },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.invoicePayment.findMany({
      where: { userId: user.id, invoiceId },
      orderBy: [{ date: 'asc' }],
      include: { financialAccount: { select: { name: true } } },
    }),
    prisma.financialAccount.findMany({
      where: { userId: user.id },
      select: { id: true, name: true },
    }),
  ]);

  const accountNames = new Map(accountRows.map((account) => [account.id, account.name]));
  const linkedTransactionIds = new Set(
    payments.map((payment) => payment.transactionId).filter((id): id is string => id !== null),
  );

  /*
   * Os pagamentos vêm de dois sítios: o registo próprio (`InvoicePayment`) e o
   * lançamento gerado. Contamos os dois — mas um pagamento que tenha os dois
   * ligados por `transactionId` aparece **uma só vez**, pela mesma razão que o
   * motor não o conta duas vezes.
   */
  const paymentViews: InvoicePaymentView[] = payments.map((payment) => ({
    id: payment.id,
    amountInCents: payment.amountInCents,
    date: toIsoDate(payment.date),
    accountName:
      payment.financialAccount?.name ??
      (payment.financialAccountId === null
        ? null
        : (accountNames.get(payment.financialAccountId) ?? null)),
    note: payment.note,
  }));

  const orphanPayments = await prisma.transaction.findMany({
    where: {
      userId: user.id,
      invoiceId,
      kind: 'INVOICE_PAYMENT',
      id: { notIn: [...linkedTransactionIds] },
    },
    orderBy: [{ date: 'asc' }],
  });

  for (const orphan of orphanPayments) {
    paymentViews.push({
      id: orphan.id,
      amountInCents: Math.abs(orphan.amountInCents),
      date: toIsoDate(orphan.date),
      accountName:
        orphan.financialAccountId === null
          ? null
          : (accountNames.get(orphan.financialAccountId) ?? null),
      note: orphan.description,
    });
  }

  const siblings = context.summaries
    .filter((invoice) => invoice.cardId === summary.cardId)
    .sort((a, b) => (a.closingDate < b.closingDate ? -1 : 1));
  const position = siblings.findIndex((invoice) => invoice.id === summary.id);
  const next = position >= 0 ? siblings[position + 1] : undefined;

  return {
    ...summary,
    cardClosingDay: card?.closingDay ?? 0,
    cardDueDay: card?.dueDay ?? 0,
    purchases: transactions.map((transaction) => ({
      id: transaction.id,
      date: toIsoDate(transaction.date),
      description: transaction.description,
      amountInCents: Math.abs(transaction.amountInCents),
      installmentNumber: transaction.installmentNumber,
      installmentCount: transaction.installmentCount,
    })),
    payments: paymentViews.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
    nextInvoice:
      next === undefined
        ? null
        : { id: next.id, closingDate: next.closingDate, dueDate: next.dueDate },
  };
}
