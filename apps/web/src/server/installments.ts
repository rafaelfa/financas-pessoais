import { prisma } from '@repo/db/client';
import { toIsoDate } from '@repo/shared';

import { todayInLisbon } from '@/lib/today';

import { loadInvoiceContext } from './invoice-context';
import { requireUser } from './session';

/**
 * Planos de parcelamento.
 *
 * Um plano é um conjunto de lançamentos ligados pelo mesmo `installmentPlanId`,
 * um por fatura. Não há tabela de planos: o plano **é** o conjunto das suas
 * parcelas, e é por isso que editar um plano se faz substituindo as parcelas.
 */

export interface InstallmentPlanInvoice {
  readonly id: string;
  readonly closingDate: string;
  readonly dueDate: string;
  readonly amountInCents: number;
  readonly installmentNumber: number;
  readonly paid: boolean;
}

export interface InstallmentPlanView {
  readonly planId: string;
  readonly cardId: string;
  readonly cardName: string;
  readonly description: string;
  /** Soma real das parcelas — é o valor que o utilizador pagou a mais no cartão. */
  readonly totalAmountInCents: number;
  readonly installmentCount: number;
  /** Valor da primeira parcela; as outras podem diferir por um cêntimo. */
  readonly perInstallmentInCents: number;
  readonly firstDate: string;
  readonly nextInstallmentNumber: number;
  readonly nextInvoice: InstallmentPlanInvoice | null;
  /** Soma das parcelas cujas faturas ainda têm valor por pagar. */
  readonly remainingInCents: number;
  readonly invoices: readonly InstallmentPlanInvoice[];
}

/** Planos de parcelamento, opcionalmente de um só cartão. */
export async function listInstallmentPlans(cardId?: string): Promise<InstallmentPlanView[]> {
  const user = await requireUser();
  const context = await loadInvoiceContext(user.id, todayInLisbon());
  const summaryById = new Map(context.summaries.map((invoice) => [invoice.id, invoice]));

  const rows = await prisma.transaction.findMany({
    where: {
      userId: user.id,
      installmentPlanId: { not: null },
      ...(cardId !== undefined ? { cardId } : {}),
    },
    orderBy: [{ date: 'asc' }, { installmentNumber: 'asc' }],
  });

  const byPlan = new Map<string, typeof rows>();

  for (const row of rows) {
    const planId = row.installmentPlanId;

    if (planId === null) {
      continue;
    }

    byPlan.set(planId, [...(byPlan.get(planId) ?? []), row]);
  }

  const cardNameById = new Map(context.cards.map((card) => [card.id, card.name]));
  const plans: InstallmentPlanView[] = [];

  for (const [planId, installments] of byPlan) {
    const first = installments[0];

    if (first === undefined) {
      continue;
    }

    const invoices: InstallmentPlanInvoice[] = installments.map((installment) => {
      const summary =
        installment.invoiceId === null ? undefined : summaryById.get(installment.invoiceId);

      return {
        id: installment.invoiceId ?? '',
        closingDate: summary?.closingDate ?? '',
        dueDate: summary?.dueDate ?? '',
        amountInCents: Math.abs(installment.amountInCents),
        installmentNumber: installment.installmentNumber ?? 1,
        paid: summary !== undefined && summary.outstandingInCents === 0,
      };
    });

    const sortedInvoices = [...invoices].sort((a, b) =>
      a.installmentNumber < b.installmentNumber ? -1 : 1,
    );
    const next = sortedInvoices.find((invoice) => !invoice.paid) ?? null;

    plans.push({
      planId,
      cardId: first.cardId ?? '',
      cardName: cardNameById.get(first.cardId ?? '') ?? '',
      description: first.description ?? 'Compra parcelada',
      totalAmountInCents: installments.reduce(
        (total, installment) => total + Math.abs(installment.amountInCents),
        0,
      ),
      installmentCount: first.installmentCount ?? installments.length,
      perInstallmentInCents: Math.abs(first.amountInCents),
      firstDate: toIsoDate(first.date),
      nextInstallmentNumber:
        next?.installmentNumber ?? first.installmentCount ?? installments.length,
      nextInvoice: next,
      remainingInCents: sortedInvoices
        .filter((invoice) => !invoice.paid)
        .reduce((total, invoice) => total + invoice.amountInCents, 0),
      invoices: sortedInvoices,
    });
  }

  return plans.sort((a, b) => (a.firstDate < b.firstDate ? 1 : -1));
}

/** Um plano pelo identificador, já com as faturas calculadas. */
export async function getInstallmentPlan(planId: string): Promise<InstallmentPlanView | null> {
  const plans = await listInstallmentPlans();

  return plans.find((plan) => plan.planId === planId) ?? null;
}
