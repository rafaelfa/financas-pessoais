import { prisma } from '@repo/db/client';
import { toCategoryKind } from './mapping';
import { provisionUser } from './provision';
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

  const first = await queryCategories(user.id);

  if (first.categories.length > 0) {
    return buildViews(first);
  }

  /*
   * Recuperação automática: se o aprovisionamento do registo falhou (um erro
   * momentâneo de rede, por exemplo), a aplicação fica sem categorias e o
   * utilizador não consegue lançar nada. Aqui corrige-se sozinha — **uma vez**.
   *
   * Relê em vez de se chamar a si própria: se o aprovisionamento falhar sempre,
   * uma chamada recursiva não teria fim e derrubaria o pedido com um estouro de
   * pilha em vez de mostrar um ecrã vazio.
   */
  await provisionUser(user.id);

  return buildViews(await queryCategories(user.id));
}

/** Consulta de categorias e contagens, para uma leitura. */
async function queryCategories(userId: string) {
  const [categories, grouped] = await Promise.all([
    prisma.category.findMany({
      where: { userId, archivedAt: null },
      orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    }),
    prisma.transaction.groupBy({
      by: ['categoryId'],
      where: { userId },
      _count: { _all: true },
    }),
  ]);

  return { categories, grouped };
}

/** Converte as linhas em vistas, com a contagem de movimentos por categoria. */
function buildViews(rows: Awaited<ReturnType<typeof queryCategories>>): CategoryView[] {
  const countByCategory = new Map<string, number>();

  for (const entry of rows.grouped) {
    if (entry.categoryId !== null) {
      countByCategory.set(entry.categoryId, entry._count._all);
    }
  }

  return rows.categories.map((category) => ({
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
