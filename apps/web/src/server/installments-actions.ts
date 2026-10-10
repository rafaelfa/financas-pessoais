'use server';

import { prisma } from '@repo/db/client';
import { addMonths, splitInstallments, toIsoDate, updateInstallmentPlanSchema } from '@repo/shared';

import { todayInLisbon } from '@/lib/today';

import { ensureInvoiceForDate, refreshInvoiceCache } from './invoice-writes';
import { loadInvoiceContext } from './invoice-context';
import { revalidateCardViews } from './revalidate';
import { fail, fromZodError, ok, type ActionResult } from './result';
import { requireUser } from './session';

/**
 * Edição de planos de parcelamento (melhoria M3).
 *
 * No sistema original, um parcelamento manual não se podia editar: mudar o
 * número de parcelas obrigava a apagar compras uma a uma. Aqui o plano **é** o
 * conjunto das suas parcelas, portanto editá-lo é substituí-las — dentro de uma
 * transação de base de dados, para nunca existir um instante com o plano a meio.
 *
 * Uma exceção deliberada: **não se reescreve história já paga**. Se alguma das
 * faturas do plano já recebeu dinheiro, a edição é recusada. Recalcular parcelas
 * que já foram pagas mudaria valores que o utilizador já confirmou e que podem
 * já ter sido conferidos com o extrato do banco.
 */

function asDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

const PLAN_ID_MAX = 100;

export async function updateInstallmentPlan(
  input: unknown,
): Promise<
  ActionResult<{ planId: string; installmentCount: number; affectedInvoiceIds: string[] }>
> {
  const user = await requireUser();
  const parsed = updateInstallmentPlanSchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const value = parsed.data;

  if (value.planId.length > PLAN_ID_MAX) {
    return fail('Parcelamento não encontrado.');
  }

  const rows = await prisma.transaction.findMany({
    where: { userId: user.id, installmentPlanId: value.planId },
    orderBy: [{ installmentNumber: 'asc' }],
  });
  const first = rows[0];

  if (first === undefined) {
    return fail('Parcelamento não encontrado.');
  }

  if (first.cardId === null) {
    return fail('Este parcelamento não está associado a um cartão.');
  }

  const cardId = first.cardId;
  const card = await prisma.creditCard.findFirst({
    where: { id: cardId, userId: user.id },
    select: { id: true, closingDay: true, dueDay: true, paymentAccountId: true },
  });

  if (card === null) {
    return fail('Cartão do parcelamento não encontrado.');
  }

  const today = todayInLisbon();
  const context = await loadInvoiceContext(user.id, today);
  const invoiceIds = rows.map((row) => row.invoiceId).filter((id): id is string => id !== null);
  const paidInvoices = context.summaries.filter(
    (invoice) => invoiceIds.includes(invoice.id) && invoice.paidInCents > 0,
  );

  if (paidInvoices.length > 0) {
    return fail(
      'Este parcelamento já tem faturas com pagamentos, e essas não se reescrevem. Elimina as parcelas e cria um plano novo.',
    );
  }

  const installmentCount = value.installmentCount ?? first.installmentCount ?? rows.length;
  const totalAmountInCents =
    value.totalAmountInCents ?? rows.reduce((total, row) => total + Math.abs(row.amountInCents), 0);
  const firstDate = value.firstDate ?? toIsoDate(first.date);
  const description = value.description ?? first.description ?? 'Compra parcelada';

  // Soma exata: as parcelas distribuem o resto pelos primeiros cêntimos.
  const amounts = splitInstallments(totalAmountInCents, installmentCount);
  const affectedInvoiceIds: string[] = [];

  await prisma.$transaction(async (tx) => {
    await tx.transaction.deleteMany({
      where: { userId: user.id, installmentPlanId: value.planId },
    });

    for (const [index, amount] of amounts.entries()) {
      // Cada parcela cai na fatura do mês respetivo, pela regra do cartão.
      const installmentDate = addMonths(firstDate, index);
      const invoice = await ensureInvoiceForDate({
        userId: user.id,
        cardId,
        purchaseDate: installmentDate,
        closingDay: card.closingDay,
        dueDay: card.dueDay,
        db: tx,
      });

      if (!affectedInvoiceIds.includes(invoice.id)) {
        affectedInvoiceIds.push(invoice.id);
      }

      await tx.transaction.create({
        data: {
          userId: user.id,
          kind: 'EXPENSE',
          status: 'CONFIRMED',
          amountInCents: -amount,
          date: asDate(installmentDate),
          description,
          // A compra a crédito não move a conta: fica por liquidar até a fatura
          // ser paga, e é a conta do cartão que a vai liquidar.
          financialAccountId: card.paymentAccountId,
          categoryId: first.categoryId,
          cardId,
          invoiceId: invoice.id,
          paymentMethod: 'CREDIT',
          paymentCondition: 'INSTALLMENT',
          settled: false,
          installmentPlanId: value.planId,
          installmentNumber: index + 1,
          installmentCount,
          installmentAmountInCents: amount,
        },
      });
    }
  });

  await refreshInvoiceCache({ userId: user.id, cardId, today });
  revalidateCardViews();

  return ok({ planId: value.planId, installmentCount, affectedInvoiceIds });
}
