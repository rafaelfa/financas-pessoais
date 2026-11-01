'use server';

import { prisma } from '@repo/db/client';
import { requireUser } from './session';

/**
 * Consultas de consolidação de contas (Account Groups).
 */

/** Lista todos os grupos de contas do usuário. */
export async function listAccountGroups() {
  const user = await requireUser();

  const groups = await prisma.accountGroup.findMany({
    where: { userId: user.id },
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
  const user = await requireUser();

  const group = await prisma.accountGroup.findFirst({
    where: { id, userId: user.id },
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
  const user = await requireUser();

  const groups = await prisma.accountGroup.findMany({
    where: { userId: user.id },
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
      0,
    );
    return {
      ...group,
      totalBalance,
    };
  });

  return groupsWithSummary;
}
