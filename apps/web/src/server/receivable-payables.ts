'use server';

import { prisma } from '@repo/db/client';
import { requireUser } from './session';

/**
 * Consultas de contas a pagar/receber.
 */

/** Lista todas as contas a pagar/receber do usuário. */
export async function listReceivablePayables() {
  const user = await requireUser();

  const items = await prisma.receivablePayable.findMany({
    where: { userId: user.id },
    include: {
      category: true,
      financialAccount: true,
    },
    orderBy: { dueDate: 'asc' },
  });

  return items;
}

/** Lista contas a pagar pendentes. */
export async function listPendingPayables() {
  const user = await requireUser();

  const items = await prisma.receivablePayable.findMany({
    where: {
      userId: user.id,
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
  const user = await requireUser();

  const items = await prisma.receivablePayable.findMany({
    where: {
      userId: user.id,
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
  const user = await requireUser();

  const item = await prisma.receivablePayable.findFirst({
    where: { id, userId: user.id },
    include: {
      category: true,
      financialAccount: true,
    },
  });

  return item;
}

/** Obtem o total de contas pendentes por tipo. */
export async function getReceivablePayableSummary() {
  const user = await requireUser();

  const summary = await prisma.receivablePayable.groupBy({
    by: ['type', 'status'],
    where: { userId: user.id },
    _sum: { amountInCents: true },
  });

  return summary;
}
