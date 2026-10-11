'use server';

import { prisma } from '@repo/db/client';
import {
  createBudgetSchema,
  deleteByIdSchema,
  removeBudgetLimitSchema,
  setBudgetLimitSchema,
  updateBudgetSchema,
} from '@repo/shared';
import { revalidatePath } from 'next/cache';

import { failFromWriteError } from './errors';
import { currentPeriod, monthPeriodFor } from './budget-period';
import { fail, fromZodError, ok, type ActionResult } from './result';
import { requireUser } from './session';
import { todayInLisbon } from '@/lib/today';

/**
 * Ações de orçamento.
 *
 * O período é sempre derivado no servidor, a partir do dia de início do mês do
 * utilizador: um orçamento que não corresponde a um mês real não serve para
 * nada, e deixar o cliente escolhê-lo abria essa porta.
 */

function revalidateBudgetViews(): void {
  revalidatePath('/orcamento');
  revalidatePath('/');
  revalidatePath('/relatorios');
}

/** Confirma que a categoria existe, é do utilizador e é de gasto. */
async function ownsExpenseCategory(userId: string, categoryId: string): Promise<boolean> {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId, kind: 'EXPENSE' },
    select: { id: true },
  });

  return category !== null;
}

export async function createBudget(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = createBudgetSchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const value = parsed.data;
  const period = currentPeriod({
    scope: value.scope,
    periodStart: value.periodStart,
    user,
    today: todayInLisbon(),
  });

  try {
    const created = await prisma.budget.create({
      data: {
        userId: user.id,
        name: value.name,
        scope: value.scope === 'monthly_default' ? 'MONTHLY_DEFAULT' : 'SINGLE_MONTH',
        periodStart: period.storedStart,
        periodEnd: value.scope === 'monthly_default' ? null : new Date(period.displayEnd),
        totalAmountInCents: value.totalAmountInCents,
        alertsEnabled: value.alertsEnabled,
      },
      select: { id: true },
    });

    revalidateBudgetViews();

    return ok({ id: created.id });
  } catch (error) {
    return failFromWriteError(error, {
      fallback: 'Não consegui criar o orçamento. Tenta outra vez.',
      unique: 'Já tens um orçamento com esse nome e esse período.',
    });
  }
}

export async function updateBudget(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = updateBudgetSchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const value = parsed.data;
  const existing = await prisma.budget.findFirst({
    where: { id: value.id, userId: user.id },
    select: { id: true },
  });

  if (!existing) {
    return fail('Orçamento não encontrado.');
  }

  try {
    await prisma.budget.update({
      where: { id: value.id },
      data: {
        ...(value.name !== undefined ? { name: value.name } : {}),
        ...(value.totalAmountInCents !== undefined
          ? { totalAmountInCents: value.totalAmountInCents }
          : {}),
        ...(value.alertsEnabled !== undefined ? { alertsEnabled: value.alertsEnabled } : {}),
      },
    });

    revalidateBudgetViews();

    return ok({ id: value.id });
  } catch (error) {
    return failFromWriteError(error, {
      fallback: 'Não consegui guardar o orçamento. Tenta outra vez.',
      unique: 'Já tens um orçamento com esse nome e esse período.',
    });
  }
}

/**
 * Apaga um orçamento e os seus limites.
 *
 * Os limites vão atrás por cascata (é o esquema que o define): um limite sem
 * orçamento não tem significado, e não há nada de histórico a preservar — os
 * lançamentos a que se referem ficam onde estão.
 */
export async function deleteBudget(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = deleteByIdSchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const existing = await prisma.budget.findFirst({
    where: { id: parsed.data.id, userId: user.id },
    select: { id: true },
  });

  if (!existing) {
    return fail('Orçamento não encontrado.');
  }

  await prisma.budget.delete({ where: { id: parsed.data.id } });
  revalidateBudgetViews();

  return ok({ id: parsed.data.id });
}

/** Define ou altera o limite de uma categoria. É um `upsert` pelo par único. */
export async function setBudgetLimit(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = setBudgetLimitSchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const value = parsed.data;
  const budget = await prisma.budget.findFirst({
    where: { id: value.budgetId, userId: user.id },
    select: { id: true },
  });

  if (!budget) {
    return fail('Orçamento não encontrado.');
  }

  if (!(await ownsExpenseCategory(user.id, value.categoryId))) {
    return fail('Categoria não encontrada.', {
      categoryId: ['Só podes limitar categorias de gasto tuas.'],
    });
  }

  try {
    const limit = await prisma.budgetLimit.upsert({
      where: {
        budgetId_categoryId: { budgetId: value.budgetId, categoryId: value.categoryId },
      },
      update: {
        amountInCents: value.amountInCents,
        ...(value.alertThresholdPct !== undefined
          ? { alertThresholdPct: value.alertThresholdPct }
          : {}),
        ...(value.alertsEnabled !== undefined ? { alertsEnabled: value.alertsEnabled } : {}),
      },
      create: {
        budgetId: value.budgetId,
        userId: user.id,
        categoryId: value.categoryId,
        amountInCents: value.amountInCents,
        alertThresholdPct: value.alertThresholdPct ?? null,
        alertsEnabled: value.alertsEnabled ?? true,
      },
      select: { id: true },
    });

    revalidateBudgetViews();

    return ok({ id: limit.id });
  } catch (error) {
    return failFromWriteError(error, {
      fallback: 'Não consegui guardar o limite. Tenta outra vez.',
      unique: 'Já existe um limite para essa categoria neste orçamento.',
    });
  }
}

/** Remove o limite de uma categoria. */
export async function removeBudgetLimit(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = removeBudgetLimitSchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const value = parsed.data;
  const limit = await prisma.budgetLimit.findFirst({
    where: { budgetId: value.budgetId, categoryId: value.categoryId, userId: user.id },
    select: { id: true },
  });

  if (!limit) {
    return fail('Limite não encontrado.');
  }

  await prisma.budgetLimit.delete({ where: { id: limit.id } });
  revalidateBudgetViews();

  return ok({ id: limit.id });
}

/** O período em que um orçamento se aplica agora, para o cabeçalho do ecrã. */
export async function budgetPeriodFor(scope: 'monthly_default' | 'single_month'): Promise<{
  start: string;
  end: string;
}> {
  const user = await requireUser();

  void scope;

  return monthPeriodFor({ user, today: todayInLisbon() });
}
