'use server';

import { prisma } from '@repo/db/client';
import { formatCurrency, payInvoiceSchema } from '@repo/shared';

import { todayInLisbon } from '@/lib/today';

import { failFromWriteError } from './errors';
import { loadInvoiceContext } from './invoice-context';
import { refreshInvoiceCache } from './invoice-writes';
import { revalidateCardViews } from './revalidate';
import { fail, fromZodError, ok, type ActionResult } from './result';
import { requireUser } from './session';

/**
 * Pagamento de faturas.
 *
 * É uma operação de primeira classe e **nunca** um ganho (melhoria M4 do
 * original, onde um pagamento de fatura se registava como movimento e sujava os
 * totais). Grava-se duas vezes, de forma ligada: o registo `InvoicePayment` (que
 * é o que o motor lê para os totais da fatura) e o lançamento
 * `INVOICE_PAYMENT` (que é o que move o saldo da conta em visão de caixa).
 * O `transactionId` liga-os, e o motor recusa contá-los duas vezes.
 */

/** Pagamento, total ou parcial, de uma fatura. */
export async function payInvoice(
  input: unknown,
): Promise<ActionResult<{ outstandingInCents: number; carriedToNextInCents: number }>> {
  const user = await requireUser();
  const parsed = payInvoiceSchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const value = parsed.data;
  const today = todayInLisbon();
  const context = await loadInvoiceContext(user.id, today);
  const summary = context.summaries.find((invoice) => invoice.id === value.invoiceId);

  if (summary === undefined) {
    return fail('Fatura não encontrada.');
  }

  const account = await prisma.financialAccount.findFirst({
    where: { id: value.accountId, userId: user.id },
    select: { id: true },
  });

  if (account === null) {
    return fail('Conta não encontrada.', { accountId: ['Escolhe uma conta tua.'] });
  }

  /*
   * Regra dura: não se paga mais do que falta.
   *
   * O motor calcula `em dívida = max(0, total − pago)`. Um pagamento a mais sairia
   * da conta pelo valor todo e só abateria a dívida existente — o excedente não
   * tem representação nenhuma (não há crédito a favor no modelo) e desapareceria
   * dos totais. Recusar é a única resposta honesta enquanto não existir crédito
   * a favor.
   */
  if (value.amountInCents > summary.outstandingInCents) {
    return fail(`Esta fatura só tem ${formatCurrency(summary.outstandingInCents)} por pagar.`, {
      amountInCents: [
        `O valor máximo é ${formatCurrency(summary.outstandingInCents)}. Um pagamento a mais não abate dívida nenhuma.`,
      ],
    });
  }

  const paymentDate = new Date(`${value.date}T00:00:00.000Z`);

  try {
    await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          userId: user.id,
          kind: 'INVOICE_PAYMENT',
          status: 'CONFIRMED',
          // Saída de dinheiro da conta: sinal negativo.
          amountInCents: -value.amountInCents,
          date: paymentDate,
          description:
            value.notes ?? `Pagamento da fatura de ${summary.cardName} (${summary.dueDate})`,
          financialAccountId: value.accountId,
          cardId: summary.cardId,
          invoiceId: summary.id,
          settled: true,
          settledOn: paymentDate,
        },
        select: { id: true },
      });

      await tx.invoicePayment.create({
        data: {
          userId: user.id,
          invoiceId: summary.id,
          financialAccountId: value.accountId,
          amountInCents: value.amountInCents,
          date: paymentDate,
          transactionId: transaction.id,
          note: value.notes ?? null,
        },
      });
    });
  } catch (error) {
    return failFromWriteError(error, {
      fallback: 'Não consegui registar o pagamento. Tenta outra vez.',
      unique: 'Este pagamento já estava registado.',
    });
  }

  // A cache das faturas do cartão passa a refletir o pagamento — e é a cadeia
  // recalculada que decide o que transita para a fatura seguinte.
  await refreshInvoiceCache({ userId: user.id, cardId: summary.cardId, today });

  const refreshed = (await loadInvoiceContext(user.id, today)).summaries;
  const updated = refreshed.find((invoice) => invoice.id === summary.id);
  const next = refreshed
    .filter(
      (invoice) => invoice.cardId === summary.cardId && invoice.closingDate > summary.closingDate,
    )
    .sort((a, b) => (a.closingDate < b.closingDate ? -1 : 1))[0];

  revalidateCardViews();

  return ok({
    outstandingInCents: updated?.outstandingInCents ?? 0,
    carriedToNextInCents: next?.carriedOverInCents ?? updated?.outstandingInCents ?? 0,
  });
}
