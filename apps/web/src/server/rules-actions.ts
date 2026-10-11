'use server';

import { prisma } from '@repo/db/client';
import {
  createRuleSchema,
  deleteByIdSchema,
  previewClassification,
  setEnabledSchema,
  updateRuleSchema,
} from '@repo/shared';
import { revalidatePath } from 'next/cache';

import { TRANSACTION_SELECT } from './accounts';
import { failFromWriteError } from './errors';
import { toFinanceTransaction } from './mapping';
import { fail, fromZodError, ok, type ActionResult } from './result';
import { requireUser } from './session';

/**
 * Ações sobre regras de categorização.
 *
 * Nota sobre âmbito: o modelo e o schema aceitam quatro ações
 * (`set_category`, `set_tags`, `set_description`, `mark_ignored`), mas **só
 * `set_category` está implementada**. As outras são recusadas com uma mensagem
 * honesta em vez de gravadas e ignoradas em silêncio — uma regra que parece
 * fazer algo e não faz é pior do que uma regra que não existe.
 */

function revalidateRuleViews(): void {
  revalidatePath('/regras');
  revalidatePath('/transacoes');
  revalidatePath('/');
}

/** Texto vazio ou só espaços passa a `null`: limpar um campo é uma operação. */
function blankToNull(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  return value === null || value.trim() === '' ? null : value;
}

const FREQUENCY_KIND = { expense: 'EXPENSE', income: 'INCOME' } as const;

async function ownsCategory(userId: string, categoryId: string): Promise<boolean> {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId },
    select: { id: true },
  });

  return category !== null;
}

async function ownsAccount(userId: string, accountId: string): Promise<boolean> {
  const account = await prisma.financialAccount.findFirst({
    where: { id: accountId, userId },
    select: { id: true },
  });

  return account !== null;
}

const UNSUPPORTED_ACTION =
  'Nesta fase só se categoriza automaticamente. As outras ações chegam mais tarde — a regra não foi guardada para a interface não prometer o que não faz.';

export async function createRule(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = createRuleSchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const value = parsed.data;

  if (value.action !== 'set_category') {
    return fail(UNSUPPORTED_ACTION, { action: [UNSUPPORTED_ACTION] });
  }

  if (!(await ownsCategory(user.id, value.targetCategoryId))) {
    return fail('Categoria não encontrada.', {
      targetCategoryId: ['Escolhe uma categoria tua.'],
    });
  }

  if (value.accountId != null && !(await ownsAccount(user.id, value.accountId))) {
    return fail('Conta não encontrada.', { accountId: ['Escolhe uma conta tua.'] });
  }

  try {
    const created = await prisma.transactionRule.create({
      data: {
        userId: user.id,
        name: value.name,
        kind: FREQUENCY_KIND[value.kind],
        priority: value.priority,
        enabled: value.enabled,
        descriptionContains: blankToNull(value.descriptionContains) ?? null,
        counterparty: blankToNull(value.counterparty) ?? null,
        amountMinInCents: value.amountMinInCents ?? null,
        amountMaxInCents: value.amountMaxInCents ?? null,
        dayMin: value.dayMin ?? null,
        dayMax: value.dayMax ?? null,
        financialAccountId: value.accountId ?? null,
        cardId: value.cardId ?? null,
        action: 'SET_CATEGORY',
        targetCategoryId: value.targetCategoryId,
      },
      select: { id: true },
    });

    revalidateRuleViews();

    return ok({ id: created.id });
  } catch (error) {
    return failFromWriteError(error, {
      fallback: 'Não consegui criar a regra. Tenta outra vez.',
      unique: 'Já tens uma regra com esse nome.',
    });
  }
}

export async function updateRule(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = updateRuleSchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const value = parsed.data;
  const existing = await prisma.transactionRule.findFirst({
    where: { id: value.id, userId: user.id },
    select: { id: true },
  });

  if (!existing) {
    return fail('Regra não encontrada.');
  }

  if (value.action !== undefined && value.action !== 'set_category') {
    return fail(UNSUPPORTED_ACTION, { action: [UNSUPPORTED_ACTION] });
  }

  if (
    value.targetCategoryId !== undefined &&
    !(await ownsCategory(user.id, value.targetCategoryId))
  ) {
    return fail('Categoria não encontrada.', {
      targetCategoryId: ['Escolhe uma categoria tua.'],
    });
  }

  if (value.accountId != null && !(await ownsAccount(user.id, value.accountId))) {
    return fail('Conta não encontrada.', { accountId: ['Escolhe uma conta tua.'] });
  }

  try {
    await prisma.transactionRule.update({
      where: { id: value.id },
      data: {
        ...(value.name !== undefined ? { name: value.name } : {}),
        ...(value.kind !== undefined ? { kind: FREQUENCY_KIND[value.kind] } : {}),
        // A prioridade é editável: é assim que o utilizador reordena as regras.
        ...(value.priority !== undefined ? { priority: value.priority } : {}),
        ...(value.enabled !== undefined ? { enabled: value.enabled } : {}),
        ...(value.descriptionContains !== undefined
          ? { descriptionContains: blankToNull(value.descriptionContains) ?? null }
          : {}),
        ...(value.counterparty !== undefined
          ? { counterparty: blankToNull(value.counterparty) ?? null }
          : {}),
        ...(value.amountMinInCents !== undefined
          ? { amountMinInCents: value.amountMinInCents ?? null }
          : {}),
        ...(value.amountMaxInCents !== undefined
          ? { amountMaxInCents: value.amountMaxInCents ?? null }
          : {}),
        ...(value.dayMin !== undefined ? { dayMin: value.dayMin ?? null } : {}),
        ...(value.dayMax !== undefined ? { dayMax: value.dayMax ?? null } : {}),
        ...(value.accountId !== undefined ? { financialAccountId: value.accountId ?? null } : {}),
        ...(value.cardId !== undefined ? { cardId: value.cardId ?? null } : {}),
        ...(value.targetCategoryId !== undefined
          ? { targetCategoryId: value.targetCategoryId }
          : {}),
      },
    });

    revalidateRuleViews();

    return ok({ id: value.id });
  } catch (error) {
    return failFromWriteError(error, {
      fallback: 'Não consegui guardar a regra. Tenta outra vez.',
      unique: 'Já tens uma regra com esse nome.',
    });
  }
}

/** Liga ou desliga uma regra. */
export async function setRuleEnabled(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = setEnabledSchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const existing = await prisma.transactionRule.findFirst({
    where: { id: parsed.data.id, userId: user.id },
    select: { id: true },
  });

  if (!existing) {
    return fail('Regra não encontrada.');
  }

  await prisma.transactionRule.update({
    where: { id: parsed.data.id },
    data: { enabled: parsed.data.enabled },
  });

  revalidateRuleViews();

  return ok({ id: parsed.data.id });
}

export async function deleteRule(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = deleteByIdSchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const existing = await prisma.transactionRule.findFirst({
    where: { id: parsed.data.id, userId: user.id },
    select: { id: true },
  });

  if (!existing) {
    return fail('Regra não encontrada.');
  }

  await prisma.transactionRule.delete({ where: { id: parsed.data.id } });
  revalidateRuleViews();

  return ok({ id: parsed.data.id });
}

/**
 * Aplica as regras ativas aos lançamentos sem categoria.
 *
 * Só toca no que não tem categoria: uma classificação feita à mão nunca é
 * substituída por uma regra — quem já decidiu não precisa que a aplicação decida
 * por ele. A contagem de utilizações de cada regra é atualizada no fim, para a
 * interface poder mostrar que uma regra está a trabalhar (ou a não fazer nada).
 */
export async function applyRules(): Promise<ActionResult<{ applied: number }>> {
  const user = await requireUser();

  const [rules, transactions] = await Promise.all([
    prisma.transactionRule.findMany({
      where: {
        userId: user.id,
        enabled: true,
        action: 'SET_CATEGORY',
        targetCategoryId: { not: null },
      },
      orderBy: [{ priority: 'asc' }],
    }),
    prisma.transaction.findMany({
      where: {
        userId: user.id,
        categoryId: null,
        status: { not: 'IGNORED' },
        kind: { in: ['EXPENSE', 'INCOME'] },
      },
      select: TRANSACTION_SELECT,
      orderBy: [{ date: 'desc' }],
      take: 500,
    }),
  ]);

  if (rules.length === 0 || transactions.length === 0) {
    return ok({ applied: 0 });
  }

  const matches = previewClassification(
    transactions.map(toFinanceTransaction),
    rules.map((rule) => ({
      id: rule.id,
      name: rule.name,
      kind: rule.kind === 'INCOME' ? ('income' as const) : ('expense' as const),
      priority: rule.priority,
      targetCategoryId: rule.targetCategoryId ?? '',
      descriptionContains: rule.descriptionContains ?? undefined,
      counterparty: rule.counterparty ?? undefined,
      amountMinInCents: rule.amountMinInCents ?? undefined,
      amountMaxInCents: rule.amountMaxInCents ?? undefined,
      dayMin: rule.dayMin ?? undefined,
      dayMax: rule.dayMax ?? undefined,
      accountId: rule.financialAccountId ?? undefined,
    })),
  );

  if (matches.length === 0) {
    return ok({ applied: 0 });
  }

  const usageByRule = new Map<string, number>();

  try {
    await prisma.$transaction(async (tx) => {
      for (const match of matches) {
        await tx.transaction.updateMany({
          // O `userId` no filtro é a garantia de que uma regra nunca toca em
          // dados de outra conta, mesmo que um identificador venha trocado.
          where: { id: match.transactionId, userId: user.id, categoryId: null },
          data: { categoryId: match.categoryId },
        });

        usageByRule.set(match.ruleId, (usageByRule.get(match.ruleId) ?? 0) + 1);
      }

      for (const [ruleId, count] of usageByRule) {
        await tx.transactionRule.update({
          where: { id: ruleId },
          data: { appliedCount: { increment: count }, lastAppliedAt: new Date() },
        });
      }
    });
  } catch (error) {
    return failFromWriteError(error, {
      fallback: 'Não consegui aplicar as regras. Nada foi alterado.',
    });
  }

  revalidateRuleViews();

  return ok({ applied: matches.length });
}
