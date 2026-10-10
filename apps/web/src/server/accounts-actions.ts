'use server';

import { AccountType, prisma } from '@repo/db/client';
import {
  accountBalanceInCents,
  archiveAccountSchema,
  balanceAdjustmentInCents,
  createAccountSchema,
  hasMatchingAdjustment,
  lockBalanceSchema,
  updateAccountSchema,
} from '@repo/shared';
import { revalidatePath } from 'next/cache';

import { TRANSACTION_SELECT } from './accounts';
import { failFromWriteError } from './errors';
import { toFinanceAccount, toFinanceTransaction } from './mapping';
import { fail, fromZodError, ok, type ActionResult } from './result';
import { requireUser } from './session';

/**
 * Ações de contas.
 *
 * Todas confirmam a propriedade da conta contra a sessão antes de escrever
 * nada: o identificador vem do cliente e não é de confiança.
 */

type PrismaAccountType = (typeof AccountType)[keyof typeof AccountType];

const ACCOUNT_TYPE_BY_INPUT: Record<string, PrismaAccountType> = {
  checking: AccountType.CHECKING,
  savings: AccountType.SAVINGS,
  wallet: AccountType.WALLET,
  cash: AccountType.CASH,
  investment: AccountType.INVESTMENT,
};

/** Converte o tipo do formulário no enum do Prisma, sem adivinhar. */
function toAccountType(value: string): PrismaAccountType {
  const type = ACCOUNT_TYPE_BY_INPUT[value];

  if (type === undefined) {
    throw new Error(`Tipo de conta desconhecido: "${value}".`);
  }

  return type;
}

function revalidateAccountViews() {
  revalidatePath('/contas');
  revalidatePath('/transacoes');
  revalidatePath('/');
}

/** Cria uma conta. O nome é único por utilizador. */
export async function createAccount(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = createAccountSchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const value = parsed.data;
  const duplicate = await prisma.financialAccount.findFirst({
    where: { userId: user.id, name: value.name },
    select: { id: true },
  });

  if (duplicate) {
    return fail('Já tens uma conta com esse nome.', { name: ['Já tens uma conta com esse nome.'] });
  }

  // A verificação acima cobre o caso normal; entre ela e a escrita há uma janela
  // (duplo clique, pedido repetido) em que quem decide é a restrição única da
  // base de dados. Aqui essa violação vira uma mensagem, não um erro 500.
  let created: { id: string } | undefined;

  try {
    created = await prisma.$transaction(async (tx) => {
      const account = await tx.financialAccount.create({
        data: {
          userId: user.id,
          name: value.name,
          type: toAccountType(value.type),
          institution: value.institution ?? null,
          description: value.notes ?? null,
          openingBalanceInCents: value.openingBalanceInCents,
          currency: value.currency,
        },
        select: { id: true },
      });

      if (value.isPrimary) {
        await tx.user.update({
          where: { id: user.id },
          data: { primaryAccountId: account.id },
        });
      }

      return account;
    });
  } catch (error) {
    return failFromWriteError(error, {
      fallback: 'Não consegui criar a conta. Tenta outra vez.',
      unique: 'Já tens uma conta com esse nome.',
    });
  }

  if (!created) {
    return fail('Não consegui criar a conta. Tenta outra vez.');
  }

  revalidateAccountViews();

  return ok({ id: created.id });
}

/** Altera os dados de uma conta. */
export async function updateAccount(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = updateAccountSchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const value = parsed.data;
  const existing = await prisma.financialAccount.findFirst({
    where: { id: value.id, userId: user.id },
    select: { id: true },
  });

  if (!existing) {
    return fail('Conta não encontrada.');
  }

  if (value.name !== undefined) {
    const duplicate = await prisma.financialAccount.findFirst({
      where: { userId: user.id, name: value.name, NOT: { id: value.id } },
      select: { id: true },
    });

    if (duplicate) {
      return fail('Já tens uma conta com esse nome.', {
        name: ['Já tens uma conta com esse nome.'],
      });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.financialAccount.update({
      where: { id: value.id },
      data: {
        ...(value.name !== undefined ? { name: value.name } : {}),
        ...(value.institution !== undefined ? { institution: value.institution } : {}),
        ...(value.type !== undefined ? { type: toAccountType(value.type) } : {}),
        ...(value.openingBalanceInCents !== undefined
          ? { openingBalanceInCents: value.openingBalanceInCents }
          : {}),
        ...(value.notes !== undefined ? { description: value.notes } : {}),
      },
    });

    if (value.isPrimary === true) {
      await tx.user.update({ where: { id: user.id }, data: { primaryAccountId: value.id } });
    }
  });

  revalidateAccountViews();

  return ok({ id: value.id });
}

/** Arquiva ou reativa uma conta. Arquivada sai dos totais, mas a história fica. */
export async function setAccountArchived(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = archiveAccountSchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const existing = await prisma.financialAccount.findFirst({
    where: { id: parsed.data.id, userId: user.id },
    select: { id: true },
  });

  if (!existing) {
    return fail('Conta não encontrada.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.financialAccount.update({
      where: { id: parsed.data.id },
      data: { archivedAt: parsed.data.archived ? new Date() : null },
    });

    // Uma conta arquivada não pode continuar a ser a principal.
    if (parsed.data.archived && user.primaryAccountId === parsed.data.id) {
      await tx.user.update({ where: { id: user.id }, data: { primaryAccountId: null } });
    }
  });

  revalidateAccountViews();

  return ok(undefined);
}

/**
 * Trava o saldo: confere o saldo real numa data e cria o lançamento de ajuste.
 *
 * O histórico nunca é reescrito. O que muda é o presente: a diferença entre o
 * que o utilizador diz e o que o sistema calculou entra como um lançamento
 * próprio, datado e auditável.
 */
export async function lockAccountBalance(
  input: unknown,
): Promise<ActionResult<{ adjustmentInCents: number; computedBalanceInCents: number }>> {
  const user = await requireUser();
  const parsed = lockBalanceSchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const value = parsed.data;
  const account = await prisma.financialAccount.findFirst({
    where: { id: value.accountId, userId: user.id },
  });

  if (!account) {
    return fail('Conta não encontrada.');
  }

  const rows = await prisma.transaction.findMany({
    where: { userId: user.id },
    select: TRANSACTION_SELECT,
  });
  const transactions = rows.map(toFinanceTransaction);
  const computedBalanceInCents = accountBalanceInCents(toFinanceAccount(account), transactions, {
    upTo: value.referenceDate,
  });
  const adjustmentInCents = balanceAdjustmentInCents({
    reportedBalanceInCents: value.reportedBalanceInCents,
    computedBalanceInCents,
  });

  if (adjustmentInCents === 0) {
    return ok({ adjustmentInCents: 0, computedBalanceInCents });
  }

  if (
    hasMatchingAdjustment(transactions, {
      accountId: value.accountId,
      date: value.referenceDate,
      amountInCents: adjustmentInCents,
    })
  ) {
    return fail('Já existe um ajuste igual nesta data. Nada foi alterado.');
  }

  const adjustmentCategory = await prisma.category.findFirst({
    where: { userId: user.id, isInternal: true, slug: 'ajuste-de-saldo' },
    select: { id: true },
  });

  /*
   * O registo da conferência e o lançamento de ajuste nascem juntos, e a
   * restrição única `(financialAccountId, referenceDate)` é a última linha de
   * defesa: a verificação acima corre fora da transação, por isso dois pedidos
   * simultâneos passariam ambos por ela e criariam dois ajustes iguais.
   */
  try {
    await prisma.$transaction(async (tx) => {
      await tx.lockedBalance.create({
        data: {
          userId: user.id,
          financialAccountId: value.accountId,
          referenceDate: new Date(value.referenceDate),
          reportedBalanceInCents: value.reportedBalanceInCents,
          computedBalanceInCents,
          adjustmentInCents,
          note: value.reason ?? null,
        },
      });

      await tx.transaction.create({
        data: {
          userId: user.id,
          kind: 'BALANCE_ADJUST',
          status: 'CONFIRMED',
          amountInCents: adjustmentInCents,
          date: new Date(value.referenceDate),
          description: 'Ajuste de saldo',
          financialAccountId: value.accountId,
          categoryId: adjustmentCategory?.id ?? null,
          settled: true,
        },
      });
    });
  } catch (error) {
    return failFromWriteError(error, {
      fallback: 'Não consegui travar o saldo. Tenta outra vez.',
      unique: 'Já travaste o saldo desta conta nesta data. Nada foi alterado.',
    });
  }

  revalidateAccountViews();

  return ok({ adjustmentInCents, computedBalanceInCents });
}
