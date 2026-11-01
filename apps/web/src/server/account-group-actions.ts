'use server';

import { prisma } from '@repo/db/client';
import {
  createAccountGroupSchema,
  updateAccountGroupSchema,
  deleteAccountGroupSchema,
  addAccountToGroupSchema,
  removeAccountFromGroupSchema,
} from '@repo/shared';
import { revalidatePath } from 'next/cache';

import { failFromWriteError } from './errors';
import { fail, fromZodError, ok, type ActionResult } from './result';
import { requireUser } from './session';

/**
 * Ações de consolidação de contas (Account Groups).
 *
 * Todas confirmam a propriedade do grupo contra a sessão antes de escrever
 * nada: o identificador vem do cliente e não é de confiança.
 */

function revalidateAccountGroupViews() {
  revalidatePath('/consolidacao-contas');
  revalidatePath('/contas');
  revalidatePath('/');
}

/**
 * Confirma que todas as contas são do utilizador.
 *
 * Corre antes de qualquer escrita: apagar os itens e só depois descobrir que
 * uma conta é alheia deixaria o grupo mutilado.
 */
async function allAccountsOwned(userId: string, accountIds: string[]): Promise<boolean> {
  if (accountIds.length === 0) {
    return true;
  }

  const owned = await prisma.financialAccount.findMany({
    where: { id: { in: accountIds }, userId },
    select: { id: true },
  });
  const ownedIds = new Set(owned.map((account) => account.id));

  return accountIds.every((accountId) => ownedIds.has(accountId));
}

/** Cria um grupo de contas. */
export async function createAccountGroup(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = createAccountGroupSchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const value = parsed.data;
  const duplicate = await prisma.accountGroup.findFirst({
    where: { userId: user.id, name: value.name },
    select: { id: true },
  });

  if (duplicate) {
    return fail('Já tens um grupo com esse nome.', {
      name: ['Já tens um grupo com esse nome.'],
    });
  }

  /*
   * O identificador vem do cliente: uma conta que não seja deste utilizador não
   * entra no grupo. Falha antes da transação, para não deixar grupo vazio.
   */
  // O cliente pode repetir o mesmo id; repetido não é um grupo diferente.
  const accountIds = [...new Set(value.accountIds ?? [])];

  if (!(await allAccountsOwned(user.id, accountIds))) {
    return fail('Uma ou mais contas não foram encontradas.', {
      accountIds: ['Uma ou mais contas não foram encontradas.'],
    });
  }

  let created: { id: string } | undefined;

  try {
    created = await prisma.$transaction(async (tx) => {
      const group = await tx.accountGroup.create({
        data: {
          userId: user.id,
          name: value.name,
          description: value.description ?? null,
        },
        select: { id: true },
      });

      // Adiciona as contas ao grupo se fornecidas
      if (accountIds.length > 0) {
        await tx.accountGroupItem.createMany({
          data: accountIds.map((accountId) => ({
            accountGroupId: group.id,
            financialAccountId: accountId,
          })),
        });
      }

      return group;
    });
  } catch (error) {
    return failFromWriteError(error, {
      fallback: 'Não consegui criar o grupo de contas. Tenta outra vez.',
      unique: 'Já tens um grupo com esse nome.',
    });
  }

  if (!created) {
    return fail('Não consegui criar o grupo de contas. Tenta outra vez.');
  }

  revalidateAccountGroupViews();

  return ok({ id: created.id });
}

/** Altera os dados de um grupo de contas. */
export async function updateAccountGroup(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = updateAccountGroupSchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const value = parsed.data;
  const existing = await prisma.accountGroup.findFirst({
    where: { id: value.id, userId: user.id },
    select: { id: true },
  });

  if (!existing) {
    return fail('Grupo de contas não encontrado.');
  }

  if (value.name !== undefined) {
    const duplicate = await prisma.accountGroup.findFirst({
      where: { userId: user.id, name: value.name, NOT: { id: value.id } },
      select: { id: true },
    });

    if (duplicate) {
      return fail('Já tens um grupo com esse nome.', {
        name: ['Já tens um grupo com esse nome.'],
      });
    }
  }

  const accountIds = value.accountIds;

  if (accountIds !== undefined && !(await allAccountsOwned(user.id, accountIds))) {
    return fail('Uma ou mais contas não foram encontradas.', {
      accountIds: ['Uma ou mais contas não foram encontradas.'],
    });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.accountGroup.update({
        where: { id: value.id },
        data: {
          ...(value.name !== undefined ? { name: value.name } : {}),
          ...(value.description !== undefined ? { description: value.description } : {}),
        },
      });

      // Só se mexem nos itens quando o cliente os manda: `undefined` é "não tocar".
      if (accountIds !== undefined) {
        const unique = [...new Set(accountIds)];

        await tx.accountGroupItem.deleteMany({ where: { accountGroupId: value.id } });
        await tx.accountGroupItem.createMany({
          data: unique.map((accountId) => ({
            accountGroupId: value.id,
            financialAccountId: accountId,
          })),
        });
      }
    });
  } catch (error) {
    return failFromWriteError(error, {
      fallback: 'Não consegui alterar o grupo de contas. Tenta outra vez.',
    });
  }

  revalidateAccountGroupViews();

  return ok({ id: value.id });
}

/** Apaga um grupo de contas. */
export async function deleteAccountGroup(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = deleteAccountGroupSchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const value = parsed.data;
  const existing = await prisma.accountGroup.findFirst({
    where: { id: value.id, userId: user.id },
    select: { id: true },
  });

  if (!existing) {
    return fail('Grupo de contas não encontrado.');
  }

  try {
    await prisma.accountGroup.delete({
      where: { id: value.id },
    });
  } catch (error) {
    return failFromWriteError(error, {
      fallback: 'Não consegui apagar o grupo de contas. Tenta outra vez.',
    });
  }

  revalidateAccountGroupViews();

  return ok(undefined);
}

/** Adiciona uma conta a um grupo. */
export async function addAccountToGroup(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = addAccountToGroupSchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const value = parsed.data;
  const existingGroup = await prisma.accountGroup.findFirst({
    where: { id: value.groupId, userId: user.id },
    select: { id: true },
  });

  if (!existingGroup) {
    return fail('Grupo de contas não encontrado.');
  }

  const existingAccount = await prisma.financialAccount.findFirst({
    where: { id: value.accountId, userId: user.id },
    select: { id: true },
  });

  if (!existingAccount) {
    return fail('Conta não encontrada.');
  }

  // Verifica se já está no grupo
  const existingItem = await prisma.accountGroupItem.findFirst({
    where: {
      accountGroupId: value.groupId,
      financialAccountId: value.accountId,
    },
    select: { id: true },
  });

  if (existingItem) {
    return fail('Esta conta já está neste grupo.');
  }

  try {
    await prisma.accountGroupItem.create({
      data: {
        accountGroupId: value.groupId,
        financialAccountId: value.accountId,
      },
    });
  } catch (error) {
    return failFromWriteError(error, {
      fallback: 'Não consegui adicionar a conta ao grupo. Tenta outra vez.',
      unique: 'Esta conta já está neste grupo.',
    });
  }

  revalidateAccountGroupViews();

  return ok(undefined);
}

/** Remove uma conta de um grupo. */
export async function removeAccountFromGroup(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = removeAccountFromGroupSchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const value = parsed.data;
  const existingGroup = await prisma.accountGroup.findFirst({
    where: { id: value.groupId, userId: user.id },
    select: { id: true },
  });

  if (!existingGroup) {
    return fail('Grupo de contas não encontrado.');
  }

  try {
    await prisma.accountGroupItem.delete({
      where: {
        accountGroupId_financialAccountId: {
          accountGroupId: value.groupId,
          financialAccountId: value.accountId,
        },
      },
    });
  } catch (error) {
    return failFromWriteError(error, {
      fallback: 'Não consegui remover a conta do grupo. Tenta outra vez.',
    });
  }

  revalidateAccountGroupViews();

  return ok(undefined);
}

/** Obtem um grupo de contas com todas as contas associadas. */
export async function getAccountGroup(id: string) {
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
