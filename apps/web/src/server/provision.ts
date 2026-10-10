import { prisma, AccountType, CategoryKind } from '@repo/db/client';
import { DEFAULT_CATEGORIES, DEFAULT_PRIMARY_ACCOUNT_NAME, slugify } from '@repo/shared';

/**
 * Aprovisionamento de um utilizador novo.
 *
 * Quem se regista tem de encontrar uma aplicação utilizável, não um espaço
 * vazio: cria-se a carteira principal e o catálogo de categorias de Portugal.
 * Sem isto, o primeiro ecrã pediria para escolher uma categoria que não existe.
 *
 * É idempotente (`upsert`): correr duas vezes não duplica nada, o que importa
 * porque é chamado a partir de um gancho de criação de utilizador e pode ser
 * repetido se algo falhar a meio.
 */

/** Campos de uma categoria do catálogo que não se atualizam numa segunda passagem. */
export async function provisionUser(userId: string): Promise<void> {
  const slugCounters = new Map<string, number>();

  await prisma.$transaction(async (tx) => {
    const existingAccounts = await tx.financialAccount.count({ where: { userId } });

    if (existingAccounts === 0) {
      await tx.financialAccount.create({
        data: {
          userId,
          name: DEFAULT_PRIMARY_ACCOUNT_NAME,
          type: AccountType.WALLET,
          openingBalanceInCents: 0,
          currency: 'EUR',
          origin: 'MANUAL',
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          primaryAccountId:
            (
              await tx.financialAccount.findFirst({
                where: { userId, name: DEFAULT_PRIMARY_ACCOUNT_NAME },
                select: { id: true },
              })
            )?.id ?? null,
        },
      });
    }

    // As categorias-mãe têm de existir antes das filhas.
    const ordered = [...DEFAULT_CATEGORIES].sort((a, b) =>
      a.parent === undefined && b.parent !== undefined
        ? -1
        : a.parent !== undefined && b.parent === undefined
          ? 1
          : 0,
    );

    const idBySlug = new Map<string, string>();

    for (const [index, category] of ordered.entries()) {
      const base = slugify(category.name) || 'categoria';
      const key = `${category.kind}:${base}`;
      const seen = slugCounters.get(key) ?? 0;
      slugCounters.set(key, seen + 1);
      const slug = seen === 0 ? base : `${base}-${seen + 1}`;

      const parentId =
        category.parent !== undefined
          ? (idBySlug.get(`${category.kind}:${slugify(category.parent)}`) ?? null)
          : null;

      const created = await tx.category.upsert({
        where: {
          userId_kind_slug: {
            userId,
            kind: category.kind === 'income' ? CategoryKind.INCOME : CategoryKind.EXPENSE,
            slug,
          },
        },
        update: {},
        create: {
          userId,
          name: category.name,
          slug,
          kind: category.kind === 'income' ? CategoryKind.INCOME : CategoryKind.EXPENSE,
          parentId,
          isInternal: category.internal ?? false,
          isSystem: true,
          color: category.color ?? null,
          sortOrder: index,
        },
        select: { id: true },
      });

      idBySlug.set(key, created.id);
    }
  });
}
