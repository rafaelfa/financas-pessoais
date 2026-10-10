import { AccountType, CategoryKind, prisma } from '@repo/db/client';
import { DEFAULT_CATEGORIES, DEFAULT_PRIMARY_ACCOUNT_NAME, slugify } from '@repo/shared';

/**
 * Aprovisionamento de um utilizador novo.
 *
 * Quem se regista tem de encontrar uma aplicação utilizável: a carteira
 * principal e o catálogo de categorias de Portugal. Sem isto, o primeiro
 * lançamento pede uma categoria que não existe.
 *
 * Duas decisões aprendidas com um utilizador real:
 *
 * 1. **É rápido.** A primeira versão fazia um `upsert` por categoria dentro de
 *    uma transação interativa: ~29 idas e voltas ao Neon, 3,6 segundos no
 *    arranque a frio — perigosamente perto do limite de 5 s de uma transação
 *    interativa, e a atrasar o registo. Agora são três operações em lote.
 * 2. **Nunca faz falhar o registo.** Corre num gancho de criação de utilizador:
 *    se rebentar, quem se registou tem de conseguir entrar na mesma. O erro é
 *    registado e a aplicação recupera sozinha na primeira consulta de
 *    categorias (ver `listCategories`).
 */

interface PreparedCategory {
  readonly name: string;
  readonly slug: string;
  readonly kind: CategoryKind;
  readonly internal: boolean;
  readonly parentSlug: string | null;
  readonly color: string | null;
  readonly sortOrder: number;
}

/** Prepara o catálogo em memória: identificadores estáveis e ligação aos pais. */
function prepareCatalogue(): PreparedCategory[] {
  return DEFAULT_CATEGORIES.map((category, index) => ({
    name: category.name,
    slug: slugify(category.name) || `categoria-${index}`,
    kind: category.kind === 'income' ? CategoryKind.INCOME : CategoryKind.EXPENSE,
    internal: category.internal ?? false,
    parentSlug: category.parent === undefined ? null : slugify(category.parent),
    color: category.color ?? null,
    sortOrder: index,
  }));
}

function categoryKey(kind: CategoryKind, slug: string): string {
  return `${kind}:${slug}`;
}

/**
 * Cria a carteira principal e o catálogo de categorias de um utilizador.
 *
 * Idempotente: só cria o que falta, portanto é seguro chamá-la em cada consulta.
 */
export async function provisionUser(userId: string): Promise<void> {
  try {
    const [categoryCount, accountCount] = await Promise.all([
      prisma.category.count({ where: { userId } }),
      prisma.financialAccount.count({ where: { userId } }),
    ]);

    if (accountCount === 0) {
      const wallet = await prisma.financialAccount.create({
        data: {
          userId,
          name: DEFAULT_PRIMARY_ACCOUNT_NAME,
          type: AccountType.WALLET,
          openingBalanceInCents: 0,
          currency: 'EUR',
          origin: 'MANUAL',
        },
        select: { id: true },
      });

      await prisma.user.update({
        where: { id: userId },
        data: { primaryAccountId: wallet.id },
      });
    }

    if (categoryCount > 0) {
      // Não basta "já tem categorias": pode ter um catálogo **parcial** (uma
      // interrupção a meio do aprovisionamento, uma categoria de sistema
      // apagada à mão). Compara-se por identificador e criam-se só as que faltam,
      // para que a reparação seja possível e idempotente.
      const existingRows = await prisma.category.findMany({
        where: { userId },
        select: { slug: true, kind: true },
      });

      const existingKeys = new Set(existingRows.map((row) => categoryKey(row.kind, row.slug)));

      const catalogue = prepareCatalogue();
      const missing = catalogue.filter(
        (category) => !existingKeys.has(categoryKey(category.kind, category.slug)),
      );

      if (missing.length === 0) {
        return;
      }

      await createMissingCategories(userId, missing);

      return;
    }

    await createMissingCategories(userId, prepareCatalogue());
  } catch (error) {
    // Nunca propagar: falhar aqui não pode impedir alguém de entrar na conta.
    console.error(`[aprovisionamento] falhou para o utilizador ${userId}:`, error);
  }
}

/** Cria as categorias indicadas, ligando as subcategorias às mães já existentes. */
async function createMissingCategories(
  userId: string,
  missing: readonly PreparedCategory[],
): Promise<void> {
  const roots = missing.filter((category) => category.parentSlug === null);
  const children = missing.filter((category) => category.parentSlug !== null);

  // 1. As categorias de topo de uma só vez.
  if (roots.length > 0) {
    await prisma.category.createMany({
      data: roots.map((category) => ({
        userId,
        name: category.name,
        slug: category.slug,
        kind: category.kind,
        isInternal: category.internal,
        isSystem: true,
        color: category.color,
        sortOrder: category.sortOrder,
      })),
    });
  }

  if (children.length === 0) {
    return;
  }

  // 2. Ler todos os identificadores (novos e antigos) para ligar as filhas.
  const created = await prisma.category.findMany({
    where: { userId },
    select: { id: true, slug: true, kind: true },
  });
  const idByKey = new Map(created.map((row) => [categoryKey(row.kind, row.slug), row.id]));

  // 3. As subcategorias, também de uma só vez.
  await prisma.category.createMany({
    data: children.map((category) => ({
      userId,
      name: category.name,
      slug: category.slug,
      kind: category.kind,
      parentId:
        category.parentSlug === null
          ? null
          : (idByKey.get(categoryKey(category.kind, category.parentSlug)) ?? null),
      isInternal: category.internal,
      isSystem: true,
      color: category.color,
      sortOrder: category.sortOrder,
    })),
  });
}
