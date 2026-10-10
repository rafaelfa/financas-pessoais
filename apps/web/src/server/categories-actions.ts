'use server';

import { CategoryKind, prisma } from '@repo/db/client';
import { createCategorySchema, slugify, updateCategorySchema } from '@repo/shared';
import { revalidatePath } from 'next/cache';

import { fail, fromZodError, ok, type ActionResult } from './result';
import { requireUser } from './session';

/**
 * Ações de categorias.
 *
 * As categorias de **sistema** não se editam nem se apagam: são a base
 * partilhada de orçamentos e relatórios, e renomeá-las tornaria os relatórios
 * de meses anteriores incomparáveis. O utilizador cria as suas ao lado.
 */

/** Identificador estável único dentro do tipo: acrescenta sufixo se já existir. */
async function uniqueSlug(userId: string, kind: CategoryKind, name: string): Promise<string> {
  const base = slugify(name) || 'categoria';
  let candidate = base;

  for (let suffix = 2; suffix <= 50; suffix += 1) {
    const existing = await prisma.category.findFirst({
      where: { userId, kind, slug: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }

    candidate = `${base}-${suffix}`;
  }

  throw new Error('Não consegui gerar um identificador único para a categoria.');
}

/** Cria uma categoria ou subcategoria. */
export async function createCategory(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = createCategorySchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const value = parsed.data;
  const kind: CategoryKind = value.kind === 'income' ? CategoryKind.INCOME : CategoryKind.EXPENSE;

  // Uma subcategoria tem de pertencer ao mesmo tipo e ao mesmo utilizador.
  if (value.parentId != null) {
    const parent = await prisma.category.findFirst({
      where: { id: value.parentId, userId: user.id },
      select: { id: true, kind: true },
    });

    if (!parent || parent.kind !== kind) {
      return fail('A categoria-mãe não existe ou é de outro tipo.', {
        parentId: ['Escolhe uma categoria-mãe do mesmo tipo.'],
      });
    }
  }

  const duplicate = await prisma.category.findFirst({
    where: { userId: user.id, kind, name: value.name },
    select: { id: true },
  });

  if (duplicate) {
    return fail('Já tens uma categoria com esse nome.', {
      name: ['Já tens uma categoria com esse nome.'],
    });
  }

  const created = await prisma.category.create({
    data: {
      userId: user.id,
      name: value.name,
      slug: await uniqueSlug(user.id, kind, value.name),
      kind,
      parentId: value.parentId ?? null,
      color: value.color ?? null,
      icon: value.icon ?? null,
      sortOrder: value.sortOrder ?? 0,
      isInternal: false,
      isSystem: false,
    },
    select: { id: true },
  });

  revalidatePath('/categorias');
  revalidatePath('/transacoes');

  return ok({ id: created.id });
}

/** Altera uma categoria do utilizador. */
export async function updateCategory(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = updateCategorySchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const value = parsed.data;
  const existing = await prisma.category.findFirst({
    where: { id: value.id, userId: user.id },
    select: { id: true, isSystem: true },
  });

  if (!existing) {
    return fail('Categoria não encontrada.');
  }

  if (existing.isSystem) {
    return fail('As categorias de sistema não se editam. Cria uma tua ao lado desta.');
  }

  if (value.parentId != null) {
    if (value.parentId === value.id) {
      return fail('Uma categoria não pode ser mãe de si própria.', {
        parentId: ['Escolhe outra categoria-mãe.'],
      });
    }

    const parent = await prisma.category.findFirst({
      where: { id: value.parentId, userId: user.id },
      select: { id: true },
    });

    if (!parent) {
      return fail('A categoria-mãe não existe.', { parentId: ['Escolhe outra categoria-mãe.'] });
    }
  }

  await prisma.category.update({
    where: { id: value.id },
    data: {
      ...(value.name !== undefined ? { name: value.name } : {}),
      ...(value.color !== undefined ? { color: value.color } : {}),
      ...(value.icon !== undefined ? { icon: value.icon } : {}),
      ...(value.sortOrder !== undefined ? { sortOrder: value.sortOrder } : {}),
      ...(value.parentId !== undefined ? { parentId: value.parentId } : {}),
    },
  });

  revalidatePath('/categorias');
  revalidatePath('/transacoes');
  revalidatePath('/');

  return ok({ id: value.id });
}

/**
 * Apaga uma categoria do utilizador.
 *
 * Recusa-se a apagar se houver movimentos ou subcategorias: apagar em cascata
 * perderia classificação de história, e desclassificar em silêncio estragaria
 * relatórios de meses anteriores.
 */
export async function deleteCategory(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const id = typeof input === 'object' && input !== null && 'id' in input ? String(input.id) : '';

  if (id === '') {
    return fail('Falta o identificador da categoria.');
  }

  const existing = await prisma.category.findFirst({
    where: { id, userId: user.id },
    select: { id: true, isSystem: true, name: true },
  });

  if (!existing) {
    return fail('Categoria não encontrada.');
  }

  if (existing.isSystem) {
    return fail('As categorias de sistema não se apagam.');
  }

  const [transactionCount, childCount] = await Promise.all([
    prisma.transaction.count({ where: { userId: user.id, categoryId: id } }),
    prisma.category.count({ where: { userId: user.id, parentId: id } }),
  ]);

  if (transactionCount > 0) {
    return fail(
      `Esta categoria tem ${transactionCount} ${transactionCount === 1 ? 'movimento' : 'movimentos'}. Muda-lhes a categoria antes de a apagar.`,
    );
  }

  if (childCount > 0) {
    return fail('Esta categoria tem subcategorias. Apaga ou move-as primeiro.');
  }

  await prisma.category.delete({ where: { id } });

  revalidatePath('/categorias');
  revalidatePath('/transacoes');

  return ok(undefined);
}
