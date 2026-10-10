'use server';

import { prisma, TransactionKind, TransactionStatus } from '@repo/db/client';
import { createTransactionSchema, createTransferSchema } from '@repo/shared';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { fail, fromZodError, ok, type ActionResult } from './result';
import { requireUser } from './session';

/**
 * Ações de lançamentos.
 *
 * Todas confirmam que a conta e a categoria pertencem ao utilizador da sessão:
 * o formulário envia identificadores e nenhum deles é de confiança.
 */

const KIND_BY_INPUT: Record<string, TransactionKind> = {
  expense: TransactionKind.EXPENSE,
  income: TransactionKind.INCOME,
  transfer: TransactionKind.TRANSFER,
  invoice_payment: TransactionKind.INVOICE_PAYMENT,
  goal_deposit: TransactionKind.GOAL_DEPOSIT,
  goal_withdrawal: TransactionKind.GOAL_WITHDRAWAL,
  balance_adjust: TransactionKind.BALANCE_ADJUST,
};

const STATUS_BY_INPUT: Record<string, TransactionStatus> = {
  pending: TransactionStatus.PENDING,
  confirmed: TransactionStatus.CONFIRMED,
  ignored: TransactionStatus.IGNORED,
};

function revalidateTransactionViews() {
  revalidatePath('/transacoes');
  revalidatePath('/contas');
  revalidatePath('/');
}

/** Confirma que a conta existe e é do utilizador. */
async function ownsAccount(userId: string, accountId: string): Promise<boolean> {
  const account = await prisma.financialAccount.findFirst({
    where: { id: accountId, userId },
    select: { id: true },
  });

  return account !== null;
}

/** Confirma que a categoria existe e é do utilizador. */
async function ownsCategory(userId: string, categoryId: string): Promise<boolean> {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId },
    select: { id: true },
  });

  return category !== null;
}

/** Cria um lançamento simples (gasto, ganho, pagamento de fatura ou movimento de objetivo). */
export async function createTransaction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = createTransactionSchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const value = parsed.data;

  // Parcelamento e recorrência pertencem às fases 4 e 5: criar aqui um
  // parcelamento sem as faturas que o suportam deixaria dados meio-feitos.
  if (value.paymentCondition !== 'single') {
    return fail(
      'Parcelamento e recorrência chegam na fase seguinte. Por agora cria o lançamento simples.',
    );
  }

  if (value.kind === 'transfer') {
    return fail('Usa a transferência entre contas para mover dinheiro.');
  }

  if (!(await ownsAccount(user.id, value.accountId))) {
    return fail('Conta não encontrada.', { accountId: ['Escolhe uma conta tua.'] });
  }

  if (value.categoryId != null && !(await ownsCategory(user.id, value.categoryId))) {
    return fail('Categoria não encontrada.', { categoryId: ['Escolhe uma categoria tua.'] });
  }

  const created = await prisma.transaction.create({
    data: {
      userId: user.id,
      kind: KIND_BY_INPUT[value.kind] ?? TransactionKind.EXPENSE,
      status: STATUS_BY_INPUT[value.status] ?? TransactionStatus.CONFIRMED,
      amountInCents: value.amountInCents,
      date: new Date(value.date),
      description: value.description ?? null,
      financialAccountId: value.accountId,
      categoryId: value.categoryId ?? null,
      invoiceId: value.invoiceId ?? null,
      cardId: value.cardId ?? null,
      goalId: value.goalId ?? null,
      transferGroupId: value.transferGroupId ?? null,
      paymentMethod: value.paymentMethod === 'credit' ? 'CREDIT' : 'DEBIT',
      paymentCondition: 'SINGLE',
      settled: value.settled,
      settledOn: value.settled ? new Date(value.date) : null,
      fitId: value.fitId ?? null,
    },
    select: { id: true },
  });

  revalidateTransactionViews();

  return ok({ id: created.id });
}

/**
 * Cria uma transferência.
 *
 * As duas pernas nascem na mesma transação de base de dados e ficam ligadas
 * uma à outra: se uma falhar, não fica meia transferência a mexer num saldo.
 */
export async function createTransfer(
  input: unknown,
): Promise<ActionResult<{ transferGroupId: string }>> {
  const user = await requireUser();
  const parsed = createTransferSchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const value = parsed.data;

  const [ownsFrom, ownsTo] = await Promise.all([
    ownsAccount(user.id, value.fromAccountId),
    ownsAccount(user.id, value.toAccountId),
  ]);

  if (!ownsFrom) {
    return fail('Conta de origem não encontrada.', { fromAccountId: ['Escolhe uma conta tua.'] });
  }

  if (!ownsTo) {
    return fail('Conta de destino não encontrada.', { toAccountId: ['Escolhe uma conta tua.'] });
  }

  const transferGroupId = crypto.randomUUID();

  await prisma.$transaction(async (tx) => {
    const outgoing = await tx.transaction.create({
      data: {
        userId: user.id,
        kind: TransactionKind.TRANSFER,
        status: TransactionStatus.CONFIRMED,
        amountInCents: -Math.abs(value.amountInCents),
        date: new Date(value.date),
        description: value.description ?? 'Transferência',
        financialAccountId: value.fromAccountId,
        transferGroupId,
        settled: value.settled,
        settledOn: value.settled ? new Date(value.date) : null,
      },
      select: { id: true },
    });

    const incoming = await tx.transaction.create({
      data: {
        userId: user.id,
        kind: TransactionKind.TRANSFER,
        status: TransactionStatus.CONFIRMED,
        amountInCents: Math.abs(value.amountInCents),
        date: new Date(value.date),
        description: value.description ?? 'Transferência',
        financialAccountId: value.toAccountId,
        transferGroupId,
        counterpartTransactionId: outgoing.id,
        settled: value.settled,
        settledOn: value.settled ? new Date(value.date) : null,
      },
      select: { id: true },
    });

    await tx.transaction.update({
      where: { id: outgoing.id },
      data: { counterpartTransactionId: incoming.id },
    });
  });

  revalidateTransactionViews();

  return ok({ transferGroupId });
}

/** Altera um lançamento. Numa transferência, o valor é espelhado no par. */
export async function updateTransaction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = createTransactionSchema
    .partial()
    .extend({ id: z.string().min(1) })
    .safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const value = parsed.data;
  const existing = await prisma.transaction.findFirst({
    where: { id: value.id, userId: user.id },
    select: { id: true, kind: true, counterpartTransactionId: true },
  });

  if (!existing) {
    return fail('Lançamento não encontrado.');
  }

  if (value.accountId !== undefined && !(await ownsAccount(user.id, value.accountId))) {
    return fail('Conta não encontrada.', { accountId: ['Escolhe uma conta tua.'] });
  }

  if (value.categoryId != null && !(await ownsCategory(user.id, value.categoryId))) {
    return fail('Categoria não encontrada.', { categoryId: ['Escolhe uma categoria tua.'] });
  }

  await prisma.$transaction(async (tx) => {
    await tx.transaction.update({
      where: { id: value.id },
      data: {
        ...(value.amountInCents !== undefined ? { amountInCents: value.amountInCents } : {}),
        ...(value.date !== undefined ? { date: new Date(value.date) } : {}),
        ...(value.description !== undefined ? { description: value.description } : {}),
        ...(value.accountId !== undefined ? { financialAccountId: value.accountId } : {}),
        ...(value.categoryId !== undefined ? { categoryId: value.categoryId } : {}),
        ...(value.status !== undefined
          ? { status: STATUS_BY_INPUT[value.status] ?? TransactionStatus.CONFIRMED }
          : {}),
        ...(value.settled !== undefined
          ? {
              settled: value.settled,
              settledOn: value.settled ? new Date(value.date ?? new Date()) : null,
            }
          : {}),
      },
    });

    // O par de uma transferência tem de continuar a espelhar o valor.
    if (
      value.amountInCents !== undefined &&
      existing.kind === TransactionKind.TRANSFER &&
      existing.counterpartTransactionId !== null
    ) {
      await tx.transaction.update({
        where: { id: existing.counterpartTransactionId },
        data: { amountInCents: -value.amountInCents },
      });
    }
  });

  revalidateTransactionViews();

  return ok({ id: value.id });
}

/**
 * Marca um lançamento como confirmado, pendente ou ignorado.
 *
 * Numa transferência o estado aplica-se aos dois lados: ignorar só uma perna
 * faria o dinheiro desaparecer de uma conta e aparecer na outra.
 */
export async function setTransactionStatus(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const id = typeof input === 'object' && input !== null && 'id' in input ? String(input.id) : '';
  const statusInput =
    typeof input === 'object' && input !== null && 'status' in input ? String(input.status) : '';

  const status = STATUS_BY_INPUT[statusInput];

  if (id === '') {
    return fail('Falta o identificador do lançamento.');
  }

  if (status === undefined) {
    return fail('Estado inválido.');
  }

  const existing = await prisma.transaction.findFirst({
    where: { id, userId: user.id },
    select: { id: true, transferGroupId: true },
  });

  if (!existing) {
    return fail('Lançamento não encontrado.');
  }

  await prisma.$transaction(async (tx) => {
    if (existing.transferGroupId !== null) {
      await tx.transaction.updateMany({
        where: { userId: user.id, transferGroupId: existing.transferGroupId },
        data: { status },
      });

      return;
    }

    await tx.transaction.update({ where: { id }, data: { status } });
  });

  revalidateTransactionViews();

  return ok(undefined);
}

/** Apaga um lançamento. Numa transferência, apaga o par inteiro. */
export async function deleteTransaction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const id = typeof input === 'object' && input !== null && 'id' in input ? String(input.id) : '';

  if (id === '') {
    return fail('Falta o identificador do lançamento.');
  }

  const existing = await prisma.transaction.findFirst({
    where: { id, userId: user.id },
    select: { id: true, transferGroupId: true },
  });

  if (!existing) {
    return fail('Lançamento não encontrado.');
  }

  await prisma.$transaction(async (tx) => {
    if (existing.transferGroupId !== null) {
      await tx.transaction.deleteMany({
        where: { userId: user.id, transferGroupId: existing.transferGroupId },
      });

      return;
    }

    await tx.transaction.delete({ where: { id } });
  });

  revalidateTransactionViews();

  return ok(undefined);
}
