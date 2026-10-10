import { prisma } from '@repo/db/client';

import { todayInLisbon } from '@/lib/today';

import { loadInvoiceContext, type InvoiceContext, type InvoiceSummary } from './invoice-context';
import { requireUser } from './session';

export type { InvoiceSummary };

/**
 * Cartões de crédito.
 *
 * O saldo em dívida de um cartão não é a soma das faturas: é o que ficou por
 * pagar **na última fatura da cadeia**, porque o resto já transitou para lá.
 * Somar as faturas todas contaria a mesma dívida várias vezes.
 */
export interface CardView {
  readonly id: string;
  readonly name: string;
  readonly brand: string;
  readonly paymentAccountId: string | null;
  readonly paymentAccountName: string | null;
  readonly closingDay: number;
  readonly dueDay: number;
  readonly creditLimitInCents: number | null;
  /** Limite disponível: calculado a partir do limite, ou o valor informado. */
  readonly availableLimitInCents: number | null;
  readonly annualFeeInCents: number | null;
  readonly archived: boolean;
  /** Fatura em curso (a que está a acumular compras) ou a última emitida. */
  readonly openInvoice: InvoiceSummary | null;
  /** Data de vencimento da próxima fatura por pagar. */
  readonly nextDueDate: string | null;
  /** Total em dívida no cartão, já sem duplicar o valor transitado. */
  readonly outstandingInCents: number;
  readonly activeInstallmentPlanCount: number;
}

/**
 * Escolhe a fatura a destacar no cartão.
 *
 * Preferimos a fatura em curso — é a que o utilizador está a construir com as
 * compras do dia a dia. Se o ciclo já fechou sem fatura aberta, mostramos a
 * última emitida, que é a que tem valor por pagar.
 */
function pickOpenInvoice(invoices: readonly InvoiceSummary[]): InvoiceSummary | null {
  if (invoices.length === 0) {
    return null;
  }

  const open = [...invoices].reverse().find((invoice) => invoice.status === 'open');

  if (open !== undefined) {
    return open;
  }

  return invoices[invoices.length - 1] ?? null;
}

/** Constrói as vistas dos cartões a partir do contexto já carregado. */
export function buildCardViews(
  context: InvoiceContext,
  accountNames: ReadonlyMap<string, string>,
): CardView[] {
  return context.cards.map((card) => {
    const invoices = context.byCard.get(card.id) ?? [];
    const openInvoice = pickOpenInvoice(invoices);
    const lastInvoice = invoices[invoices.length - 1];
    const outstandingInCents = lastInvoice?.outstandingInCents ?? 0;

    const nextDueDate =
      invoices.find((invoice) => invoice.outstandingInCents > 0)?.dueDate ??
      openInvoice?.dueDate ??
      null;

    const availableLimitInCents =
      card.creditLimitInCents !== null
        ? Math.max(0, card.creditLimitInCents - outstandingInCents)
        : card.availableLimitInCents;

    const activeInstallmentPlanCount = context.activePlanCountByCard.get(card.id) ?? 0;

    return {
      id: card.id,
      name: card.name,
      brand: card.brand,
      paymentAccountId: card.paymentAccountId,
      paymentAccountName:
        card.paymentAccountId === null ? null : (accountNames.get(card.paymentAccountId) ?? null),
      closingDay: card.closingDay,
      dueDay: card.dueDay,
      creditLimitInCents: card.creditLimitInCents,
      availableLimitInCents,
      annualFeeInCents: card.annualFeeInCents,
      archived: card.archived,
      openInvoice,
      nextDueDate,
      outstandingInCents,
      activeInstallmentPlanCount,
    };
  });
}

/** Cartões do utilizador, com a fatura em curso e o limite disponível. */
export async function listCards(): Promise<CardView[]> {
  const user = await requireUser();

  const [context, accounts] = await Promise.all([
    loadInvoiceContext(user.id, todayInLisbon()),
    prisma.financialAccount.findMany({
      where: { userId: user.id },
      select: { id: true, name: true },
    }),
  ]);

  const accountNames = new Map(accounts.map((account) => [account.id, account.name]));

  return buildCardViews(context, accountNames);
}

/** Cartão isolado, para o cabeçalho de uma página de faturas. */
export async function getCard(cardId: string): Promise<CardView | null> {
  const cards = await listCards();

  return cards.find((card) => card.id === cardId) ?? null;
}
