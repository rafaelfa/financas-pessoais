'use server';

import { prisma } from '@repo/db/client';
import {
  addGoalMovementSchema,
  createGoalSchema,
  deleteByIdSchema,
  setGoalCompletedSchema,
  updateGoalSchema,
} from '@repo/shared';
import { revalidatePath } from 'next/cache';

import { failFromWriteError } from './errors';
import { fail, fromZodError, ok, type ActionResult } from './result';
import { requireUser } from './session';

/**
 * Ações sobre objetivos.
 *
 * Um depósito **com conta** move mesmo o dinheiro: sai do saldo da conta e passa
 * a estar reservado no objetivo. Sem conta, é só uma marca de progresso — e isso
 * é dito ao utilizador, porque as duas coisas parecem iguais no ecrã e não são.
 * Nos dois casos o património líquido não muda (o dinheiro troca de sítio), que é
 * a razão de ser de um objetivo.
 */

function revalidateGoalViews(): void {
  revalidatePath('/objetivos');
  revalidatePath('/contas');
  revalidatePath('/transacoes');
  revalidatePath('/');
}

const FREQUENCY_BY_INPUT = {
  weekly: 'WEEKLY',
  monthly: 'MONTHLY',
  quarterly: 'QUARTERLY',
} as const;

function asDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export async function createGoal(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = createGoalSchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const value = parsed.data;

  try {
    const created = await prisma.goal.create({
      data: {
        userId: user.id,
        name: value.name,
        description: value.description ?? null,
        isPreset: value.isPreset,
        targetAmountInCents: value.targetAmountInCents,
        initialReservedInCents: value.initialReservedInCents,
        accumulatedInCents: value.initialReservedInCents,
        targetDate: asDate(value.targetDate),
        contributionFrequency: FREQUENCY_BY_INPUT[value.contributionFrequency],
        state: 'ACTIVE',
      },
      select: { id: true },
    });

    revalidateGoalViews();

    return ok({ id: created.id });
  } catch (error) {
    return failFromWriteError(error, {
      fallback: 'Não consegui criar o objetivo. Tenta outra vez.',
    });
  }
}

export async function updateGoal(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = updateGoalSchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const value = parsed.data;
  const existing = await prisma.goal.findFirst({
    where: { id: value.id, userId: user.id },
    select: { id: true },
  });

  if (!existing) {
    return fail('Objetivo não encontrado.');
  }

  try {
    await prisma.goal.update({
      where: { id: value.id },
      data: {
        ...(value.name !== undefined ? { name: value.name } : {}),
        ...(value.description !== undefined ? { description: value.description } : {}),
        ...(value.targetAmountInCents !== undefined
          ? { targetAmountInCents: value.targetAmountInCents }
          : {}),
        ...(value.targetDate !== undefined ? { targetDate: asDate(value.targetDate) } : {}),
        ...(value.contributionFrequency !== undefined
          ? { contributionFrequency: FREQUENCY_BY_INPUT[value.contributionFrequency] }
          : {}),
        // Alterar o valor já reservado muda o ponto de partida do progresso —
        // não é um depósito, e a interface avisa disso.
        ...(value.initialReservedInCents !== undefined
          ? { initialReservedInCents: value.initialReservedInCents }
          : {}),
      },
    });

    revalidateGoalViews();

    return ok({ id: value.id });
  } catch (error) {
    return failFromWriteError(error, {
      fallback: 'Não consegui guardar o objetivo. Tenta outra vez.',
    });
  }
}

/** Apaga o objetivo. Os movimentos vão atrás; os lançamentos ficam. */
export async function deleteGoal(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = deleteByIdSchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const existing = await prisma.goal.findFirst({
    where: { id: parsed.data.id, userId: user.id },
    select: { id: true },
  });

  if (!existing) {
    return fail('Objetivo não encontrado.');
  }

  await prisma.goal.delete({ where: { id: parsed.data.id } });
  revalidateGoalViews();

  return ok({ id: parsed.data.id });
}

/** Marca o objetivo como concluído, ou reabre-o. */
export async function setGoalCompleted(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = setGoalCompletedSchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const value = parsed.data;
  const existing = await prisma.goal.findFirst({
    where: { id: value.id, userId: user.id },
    select: { id: true },
  });

  if (!existing) {
    return fail('Objetivo não encontrado.');
  }

  await prisma.goal.update({
    where: { id: value.id },
    data: {
      state: value.completed ? 'COMPLETED' : 'ACTIVE',
      completedAt: value.completed ? new Date() : null,
    },
  });

  revalidateGoalViews();

  return ok({ id: value.id });
}

/**
 * Regista um depósito ou um levantamento.
 *
 * Com `accountId`, cria também o lançamento que move o dinheiro da conta — e é o
 * `transactionId` que liga os dois, para que apagar o lançamento no extrato não
 * deixe o objetivo a mentir sobre o que está reservado.
 */
export async function addGoalMovement(
  input: unknown,
): Promise<ActionResult<{ id: string; createdTransaction: boolean }>> {
  const user = await requireUser();
  const parsed = addGoalMovementSchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const value = parsed.data;
  const goal = await prisma.goal.findFirst({
    where: { id: value.goalId, userId: user.id },
    select: { id: true, name: true },
  });

  if (!goal) {
    return fail('Objetivo não encontrado.');
  }

  let account: { id: string; name: string } | null = null;

  if (value.accountId != null) {
    account = await prisma.financialAccount.findFirst({
      where: { id: value.accountId, userId: user.id },
      select: { id: true, name: true },
    });

    if (account === null) {
      return fail('Conta não encontrada.', { accountId: ['Escolhe uma conta tua.'] });
    }
  }

  const isDeposit = value.type === 'deposit';
  const date = asDate(value.date);

  try {
    await prisma.$transaction(async (tx) => {
      let transactionId: string | null = null;

      if (account !== null) {
        const transaction = await tx.transaction.create({
          data: {
            userId: user.id,
            kind: isDeposit ? 'GOAL_DEPOSIT' : 'GOAL_WITHDRAWAL',
            status: 'CONFIRMED',
            // Depositar tira dinheiro da conta; levantar devolve-o.
            amountInCents: isDeposit ? -value.amountInCents : value.amountInCents,
            date,
            description: value.note ?? `${isDeposit ? 'Depósito' : 'Levantamento'} — ${goal.name}`,
            financialAccountId: account.id,
            goalId: goal.id,
            settled: true,
            settledOn: date,
          },
          select: { id: true },
        });

        transactionId = transaction.id;
      }

      await tx.goalMovement.create({
        data: {
          userId: user.id,
          goalId: goal.id,
          type: isDeposit ? 'DEPOSIT' : 'WITHDRAWAL',
          // A coluna guarda sempre a magnitude: a direção está no `type`.
          amountInCents: value.amountInCents,
          date,
          transactionId,
          note: value.note ?? null,
        },
      });
    });
  } catch (error) {
    return failFromWriteError(error, {
      fallback: 'Não consegui registar o movimento. Tenta outra vez.',
    });
  }

  revalidateGoalViews();

  return ok({ id: goal.id, createdTransaction: account !== null });
}
