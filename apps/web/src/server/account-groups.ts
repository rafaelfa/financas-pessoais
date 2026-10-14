'use server';

import { prisma } from '@repo/db/client';

/**
 * Consultas de consolidação de contas (Account Groups).
 */

/** Lista todos os grupos de contas do usuário. */
export async function listAccountGroups() {
  const userId = 'user-id-placeholder'; // Substituir com requireUser() quando integrar

  const groups = await prisma.accountGroup.findMany({
    where: { userId },
    include: {
      accountGroupItems: {
        include: {
          financialAccount: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return groups;
}

/** Obtem um grupo específico pelo ID. */
export async function getAccountGroupById(id: string) {
  const userId = 'user-id-placeholder';

  const group = await prisma.accountGroup.findFirst({
    where: { id, userId },
    include: {
      accountGroupItems: {
        include: {
          financialAccount: true,
        },
      },
    },
  });

  return group;
}

/** Lista todos os grupos com resumo de saldos. */
export async function listAccountGroupsWithSummary() {
  const userId = 'user-id-placeholder';

  const groups = await prisma.accountGroup.findMany({
    where: { userId },
    include: {
      accountGroupItems: {
        include: {
          financialAccount: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Calcula o saldo total de cada grupo
  const groupsWithSummary = groups.map((group) => {
    const totalBalance = group.accountGroupItems.reduce(
      (sum, item) => sum + (item.financialAccount.balanceInCents || 0),
      0
    );
    return {
      ...group,
      totalBalance,
    };
  });

  return groupsWithSummary;
}
