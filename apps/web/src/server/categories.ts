import { prisma } from '@repo/db/client';
import { toCategoryKind } from './mapping';
import { requireUser } from './session';

/**
 * Consultas de categorias.
 *
 * As categorias são por utilizador porque incluem as que ele criou. As de
 * sistema vêm do seed, com nomes portugueses, e são a base partilhada dos
 * orçamentos e dos relatórios.
 */

export interface CategoryView {
  readonly id: string;
  readonly name: string;
  readonly kind: 'expense' | 'income';
  readonly parentId: string | null;
  readonly internal: boolean;
  readonly isSystem: boolean;
  readonly color: string | null;
  readonly icon: string | null;
  readonly sortOrder: number;
  readonly transactionCount: number;
}

/** Todas as categorias do utilizador, com o número de movimentos associados. */
export async function listCategories(): Promise<CategoryView[]> {
  const user = await requireUser();

  const [categories, grouped] = await Promise.all([
    prisma.category.findMany({
      where: { userId: user.id, archivedAt: null },
      orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    }),
    prisma.transaction.groupBy({
      by: ['categoryId'],
      where: { userId: user.id },
      _count: { _all: true },
    }),
  ]);

  const countByCategory = new Map<string, number>();

  for (const entry of grouped) {
    if (entry.categoryId !== null) {
      countByCategory.set(entry.categoryId, entry._count._all);
    }
  }

  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    kind: toCategoryKind(category.kind),
    parentId: category.parentId,
    internal: category.isInternal,
    isSystem: category.isSystem,
    color: category.color,
    icon: category.icon,
    sortOrder: category.sortOrder,
    transactionCount: countByCategory.get(category.id) ?? 0,
  }));
}

/** Categorias de gasto, para os formulários. */
export async function listExpenseCategories(): Promise<CategoryView[]> {
  const categories = await listCategories();

  return categories.filter((category) => category.kind === 'expense');
}

/** Categorias de ganho, para os formulários. */
export async function listIncomeCategories(): Promise<CategoryView[]> {
  const categories = await listCategories();

  return categories.filter((category) => category.kind === 'income');
}
