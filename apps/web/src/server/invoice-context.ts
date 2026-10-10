import { prisma } from '@repo/db/client';
import { invoiceChain, type InvoiceStatus } from '@repo/shared';

import { TRANSACTION_SELECT } from './accounts';
import { toFinanceInvoice, toFinancePayment, toFinanceTransaction } from './mapping';

/**
 * Contexto de faturas.
 *
 * Cartões, faturas e parcelamentos precisam todos da mesma coisa: as faturas do
 * utilizador com os totais já calculados **pela cadeia** (o que ficou por pagar
 * de uma fatura transita para a seguinte). Carregar e calcular isso uma só vez,
 * aqui, evita três versões da mesma conta a divergir — que é a origem clássica
 * de "o ecrã dos cartões diz 120 € e a página das faturas diz 80 €".
 */

export interface InvoiceSummary {
  readonly id: string;
  readonly cardId: string;
  readonly cardName: string;
  readonly status: InvoiceStatus;
  readonly closingDate: string;
  readonly dueDate: string;
  readonly purchasesInCents: number;
  readonly carriedOverInCents: number;
  readonly totalInCents: number;
  readonly paidInCents: number;
  readonly outstandingInCents: number;
  readonly purchaseCount: number;
}

export interface InvoiceContext {
  readonly today: string;
  readonly cards: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly brand: string;
    readonly paymentAccountId: string | null;
    readonly closingDay: number;
    readonly dueDay: number;
    readonly creditLimitInCents: number | null;
    readonly availableLimitInCents: number | null;
    readonly annualFeeInCents: number | null;
    readonly archived: boolean;
  }>;
  /** Todas as faturas do utilizador, por ordem de fecho. */
  readonly summaries: readonly InvoiceSummary[];
  /** Faturas agrupadas por cartão, também por ordem de fecho. */
  readonly byCard: ReadonlyMap<string, readonly InvoiceSummary[]>;
  /** Planos de parcelamento ainda com faturas por pagar, por cartão. */
  readonly activePlanCountByCard: ReadonlyMap<string, number>;
}

/** Lê tudo o que é preciso para calcular faturas, numa só ronda de consultas. */
export async function loadInvoiceContext(userId: string, today: string): Promise<InvoiceContext> {
  const [cards, invoices, transactions, payments] = await Promise.all([
    prisma.creditCard.findMany({
      where: { userId },
      orderBy: [{ archivedAt: 'asc' }, { name: 'asc' }],
    }),
    prisma.invoice.findMany({ where: { userId }, orderBy: [{ closingDate: 'asc' }] }),
    prisma.transaction.findMany({ where: { userId }, select: TRANSACTION_SELECT }),
    prisma.invoicePayment.findMany({ where: { userId } }),
  ]);

  const financeTransactions = transactions.map(toFinanceTransaction);
  const financePayments = payments.map(toFinancePayment);
  const financeInvoices = invoices.map(toFinanceInvoice);

  const summaries: InvoiceSummary[] = [];
  const byCard = new Map<string, InvoiceSummary[]>();

  for (const card of cards) {
    const cardInvoices = financeInvoices.filter((invoice) => invoice.cardId === card.id);

    if (cardInvoices.length === 0) {
      byCard.set(card.id, []);
      continue;
    }

    const chain = invoiceChain({
      invoices: cardInvoices,
      transactions: financeTransactions,
      payments: financePayments,
      today,
    });

    const forCard: InvoiceSummary[] = chain.map((entry) => ({
      id: entry.invoiceId,
      cardId: card.id,
      cardName: card.name,
      status: entry.status,
      closingDate: entry.closingDate,
      dueDate: entry.dueDate,
      purchasesInCents: entry.purchasesInCents,
      carriedOverInCents: entry.carriedOverInCents,
      totalInCents: entry.totalInCents,
      paidInCents: entry.paidInCents,
      outstandingInCents: entry.outstandingInCents,
      purchaseCount: entry.purchaseCount,
    }));

    byCard.set(card.id, forCard);
    summaries.push(...forCard);
  }

  // Um plano está ativo enquanto alguma das suas parcelas pertencer a uma fatura
  // por pagar: é isso que o utilizador quer saber em /cartoes. A contagem é por
  // cartão, porque cada cartão mostra os seus próprios planos.
  const invoiceById = new Map(summaries.map((summary) => [summary.id, summary]));
  const planIdsByCard = new Map<string, Set<string>>();

  for (const transaction of financeTransactions) {
    const planId = transaction.installmentPlanId;

    if (planId === undefined || transaction.invoiceId === undefined) {
      continue;
    }

    const invoice = invoiceById.get(transaction.invoiceId);

    if (invoice === undefined || invoice.outstandingInCents <= 0) {
      continue;
    }

    const planIds = planIdsByCard.get(invoice.cardId) ?? new Set<string>();
    planIds.add(planId);
    planIdsByCard.set(invoice.cardId, planIds);
  }

  const activePlanCountByCard = new Map(
    [...planIdsByCard].map(([cardId, planIds]) => [cardId, planIds.size]),
  );

  return {
    today,
    cards: cards.map((card) => ({
      id: card.id,
      name: card.name,
      brand: card.brand,
      paymentAccountId: card.paymentAccountId,
      closingDay: card.closingDay,
      dueDay: card.dueDay,
      creditLimitInCents: card.creditLimitInCents,
      availableLimitInCents: card.availableLimitInCents,
      annualFeeInCents: card.annualFeeInCents,
      archived: card.archivedAt !== null,
    })),
    summaries,
    byCard,
    activePlanCountByCard,
  };
}
