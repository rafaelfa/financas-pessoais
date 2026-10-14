'use server';

import { prisma } from '@repo/db/client';
import {
  createReceivablePayableSchema,
  updateReceivablePayableSchema,
  payReceivablePayableSchema,
  deleteReceivablePayableSchema,
} from '@repo/shared';
import { revalidatePath } from 'next/cache';

import { failFromWriteError } from './errors';
import { fail, fromZodError, ok, type ActionResult } from './result';
import { requireUser } from './session';

/**
 * Ações de contas a pagar/receber.
 *
 * Todas confirmam a propriedade da conta contra a sessão antes de escrever
 * nada: o identificador vem do cliente e não é de confiança.
 */

function revalidateReceivablePayableViews() {
  revalidatePath('/contas-pagar-receber');
  revalidatePath('/');
}

/** Cria uma conta a pagar ou receber. */
export async function createReceivablePayable(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = createReceivablePayableSchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const value = parsed.data;
  const duplicate = await prisma.receivablePayable.findFirst({
    where: { userId: user.id, description: value.description },
    select: { id: true },
  });

  if (duplicate) {
    return fail('Já tens uma conta com essa descrição.', {
      description: ['Já tens uma conta com essa descrição.'],
    });
  }

  let created: { id: string } | undefined;

  try {
    created = await prisma.$transaction(async (tx) => {
      const receivablePayable = await tx.receivablePayable.create({
        data: {
          userId: user.id,
          type: value.type,
          description: value.description,
          amountInCents: value.amountInCents,
          dueDate: new Date(value.dueDate),
          categoryId: value.categoryId ?? null,
          financialAccountId: value.financialAccountId ?? null,
          tags: value.tags ?? [],
          note: value.note ?? null,
          status: value.status ?? 'OPEN',
        },
        select: { id: true },
      });

      return receivablePayable;
    });
  } catch (error) {
    return failFromWriteError(error, {
      fallback: 'Não consegui criar a conta. Tenta outra vez.',
      unique: 'Já tens uma conta com essa descrição.',
    });
  }

  if (!created) {
    return fail('Não consegui criar a conta. Tenta outra vez.');
  }

  revalidateReceivablePayableViews();

  return ok({ id: created.id });
}

/** Altera os dados de uma conta a pagar/receber. */
export async function updateReceivablePayable(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = updateReceivablePayableSchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const value = parsed.data;
  const existing = await prisma.receivablePayable.findFirst({
    where: { id: value.id, userId: user.id },
    select: { id: true },
  });

  if (!existing) {
    return fail('Conta não encontrada.');
  }

  if (value.description !== undefined) {
    const duplicate = await prisma.receivablePayable.findFirst({
      where: {
        userId: user.id,
        description: value.description,
        NOT: { id: value.id },
      },
      select: { id: true },
    });

    if (duplicate) {
      return fail('Já tens uma conta com essa descrição.', {
        description: ['Já tens uma conta com essa descrição.'],
      });
    }
  }

  await prisma.receivablePayable.update({
    where: { id: value.id },
    data: {
      ...(value.description !== undefined ? { description: value.description } : {}),
      ...(value.amountInCents !== undefined ? { amountInCents: value.amountInCents } : {}),
      ...(value.dueDate !== undefined ? { dueDate: new Date(value.dueDate) } : {}),
      ...(value.categoryId !== undefined ? { categoryId: value.categoryId } : {}),
      ...(value.financialAccountId !== undefined
        ? { financialAccountId: value.financialAccountId }
        : {}),
      ...(value.tags !== undefined ? { tags: value.tags } : {}),
      ...(value.note !== undefined ? { note: value.note } : {}),
    },
  });

  revalidateReceivablePayableViews();

  return ok({ id: value.id });
}

/** Registra o pagamento de uma conta a pagar ou o recebimento de uma conta a receber. */
export async function payReceivablePayable(
  input: unknown,
): Promise<ActionResult<{ paymentId: string }>> {
  const user = await requireUser();
  const parsed = payReceivablePayableSchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const value = parsed.data;
  const existing = await prisma.receivablePayable.findFirst({
    where: { id: value.id, userId: user.id },
  });

  if (!existing) {
    return fail('Conta não encontrada.');
  }

  if (existing.status === 'PAID') {
    return fail('Esta conta já está paga.');
  }

  const paymentAccount = await prisma.financialAccount.findFirst({
    where: { id: value.financialAccountId, userId: user.id },
    select: { id: true },
  });

  if (!paymentAccount) {
    return fail('Conta de pagamento não encontrada.');
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Atualiza o status da conta
      await tx.receivablePayable.update({
        where: { id: value.id },
        data: {
          status: 'PAID',
          paidAt: new Date(value.paymentDate),
          paidAmountInCents: existing.amountInCents,
        },
      });

      // Registra o pagamento
      await tx.receivablePayablePayment.create({
        data: {
          userId: user.id,
          receivablePayableId: value.id,
          financialAccountId: value.financialAccountId,
          amountInCents: existing.amountInCents,
          paymentDate: new Date(value.paymentDate),
          note: value.note ?? null,
        },
      });

      // Se houver conta de pagamento, cria a transação correspondente
      if (value.createTransaction && value.financialAccountId) {
        const category = await tx.category.findUnique({
          where: { id: existing.categoryId },
        });

        const kind =
          existing.type === 'PAYABLE'
            ? 'EXPENSE'
            : existing.type === 'RECEIVABLE'
              ? 'INCOME'
              : 'TRANSFER';

        await tx.transaction.create({
          data: {
            userId: user.id,
            kind,
            status: 'CONFIRMED',
            amountInCents: existing.amountInCents * (kind === 'EXPENSE' ? -1 : 1),
            date: new Date(value.paymentDate),
            description: existing.description,
            financialAccountId: value.financialAccountId,
            categoryId: existing.categoryId ?? null,
            settled: true,
          },
        });
      }
    });
  } catch (error) {
    return failFromWriteError(error, {
      fallback: 'Não consegui registrar o pagamento. Tenta outra vez.',
    });
  }

  revalidateReceivablePayableViews();

  return ok({ paymentId: 'payment-created' });
}

/** Cancela ou apaga uma conta a pagar/receber. */
export async function deleteReceivablePayable(
  input: unknown,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = deleteReceivablePayableSchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const value = parsed.data;
  const existing = await prisma.receivablePayable.findFirst({
    where: { id: value.id, userId: user.id },
    select: { id: true },
  });

  if (!existing) {
    return fail('Conta não encontrada.');
  }

  if (existing.status === 'PAID') {
    return fail('Não pode apagar uma conta já paga. Marque como cancelada primeiro.');
  }

  try {
    await prisma.receivablePayable.delete({
      where: { id: value.id },
    });
  } catch (error) {
    return failFromWriteError(error, {
      fallback: 'Não consegui apagar a conta. Tenta outra vez.',
    });
  }

  revalidateReceivablePayableViews();

  return ok(undefined);
}

/** Altera o status de uma conta a pagar/receber. */
export async function updateReceivablePayableStatus(
  input: unknown,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = updateReceivablePayableSchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const value = parsed.data;
  const existing = await prisma.receivablePayable.findFirst({
    where: { id: value.id, userId: user.id },
    select: { id: true },
  });

  if (!existing) {
    return fail('Conta não encontrada.');
  }

  if (existing.status === 'PAID' && value.status !== 'PAID') {
    return fail('Uma conta paga não pode ser revertida para aberta.');
  }

  await prisma.receivablePayable.update({
    where: { id: value.id },
    data: { status: value.status },
  });

  revalidateReceivablePayableViews();

  return ok(undefined);
}
