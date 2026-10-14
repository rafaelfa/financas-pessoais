'use server';

import { prisma } from '@repo/db/client';

/**
 * Consultas de contas a pagar/receber.
 */

/** Lista todas as contas a pagar/receber do usuário. */
export async function listReceivablePayables() {
  const userId = 'user-id-placeholder'; // Substituir com requireUser() quando integrar

  const items = await prisma.receivablePayable.findMany({
    where: { userId },
    include: {
      category: true,
      financialAccount: true,
      payments: true,
    },
    orderBy: { dueDate: 'asc' },
  });

  return items;
}

/** Lista contas a pagar pendentes. */
export async function listPendingPayables() {
  const userId = 'user-id-placeholder';

  const items = await prisma.receivablePayable.findMany({
    where: {
      userId,
      type: 'PAYABLE',
      status: 'OPEN',
    },
    include: {
      category: true,
      financialAccount: true,
    },
    orderBy: { dueDate: 'asc' },
  });

  return items;
}

/** Lista contas a receber pendentes. */
export async function listPendingReceivables() {
  const userId = 'user-id-placeholder';

  const items = await prisma.receivablePayable.findMany({
    where: {
      userId,
      type: 'RECEIVABLE',
      status: 'OPEN',
    },
    include: {
      category: true,
      financialAccount: true,
    },
    orderBy: { dueDate: 'asc' },
  });

  return items;
}

/** Obtem uma conta específica pelo ID. */
export async function getReceivablePayableById(id: string) {
  const userId = 'user-id-placeholder';

  const item = await prisma.receivablePayable.findFirst({
    where: { id, userId },
    include: {
      category: true,
      financialAccount: true,
      payments: true,
    },
  });

  return item;
}

/** Obtem o total de contas pendentes por tipo. */
export async function getReceivablePayableSummary() {
  const userId = 'user-id-placeholder';

  const summary = await prisma.receivablePayable.groupBy({
    by: ['type', 'status'],
    where: { userId },
    _sum: { amountInCents: true },
  });

  return summary;
}
