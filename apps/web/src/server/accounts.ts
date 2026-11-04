import { prisma } from '@repo/db/client';
import { accountBalanceInCents } from '@repo/shared';

import { toFinanceAccount, toFinanceTransaction, type TransactionRow } from './mapping';
import { requireUser } from './session';

/**
 * Consultas de contas.
 *
 * O saldo não é uma coluna: é calculado pelo motor financeiro a partir do saldo
 * inicial e dos movimentos liquidados. Guardar o saldo como número seria a
 * forma mais rápida de o ver divergir da soma dos lançamentos.
 */

export interface AccountView {
  readonly id: string;
  readonly name: string;
  readonly institution: string | null;
  readonly type: string;
  readonly openingBalanceInCents: number;
  readonly isPrimary: boolean;
  readonly archived: boolean;
  readonly balanceInCents: number;
  readonly transactionCount: number;
}

/** Campos de transação que o motor financeiro precisa — usado por todas as consultas. */
export const TRANSACTION_SELECT = {
  id: true,
  kind: true,
  status: true,
  amountInCents: true,
  date: true,
  description: true,
  financialAccountId: true,
  categoryId: true,
  invoiceId: true,
  cardId: true,
  goalId: true,
  transferGroupId: true,
  settled: true,
  installmentPlanId: true,
  installmentNumber: true,
  installmentCount: true,
  installmentAmountInCents: true,
} as const satisfies Record<keyof TransactionRow, true>;

/** Contas do utilizador, com saldo calculado. Arquivadas vêm no fim. */
export async function listAccounts(): Promise<AccountView[]> {
  const user = await requireUser();

  const [accounts, transactions] = await Promise.all([
    prisma.financialAccount.findMany({
      where: { userId: user.id },
      orderBy: [{ archivedAt: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.transaction.findMany({ where: { userId: user.id }, select: TRANSACTION_SELECT }),
  ]);

  const financeTransactions = transactions.map(toFinanceTransaction);
  const countByAccount = new Map<string, number>();

  for (const transaction of financeTransactions) {
    countByAccount.set(transaction.accountId, (countByAccount.get(transaction.accountId) ?? 0) + 1);
  }

  return accounts.map((account) => ({
    id: account.id,
    name: account.name,
    institution: account.institution,
    type: account.type,
    openingBalanceInCents: account.openingBalanceInCents,
    isPrimary: account.id === user.primaryAccountId,
    archived: account.archivedAt !== null,
    balanceInCents: accountBalanceInCents(toFinanceAccount(account), financeTransactions),
    transactionCount: countByAccount.get(account.id) ?? 0,
  }));
}

/** Soma dos saldos das contas ativas. Contas arquivadas ficam de fora. */
export async function getActiveTotalBalanceInCents(): Promise<number> {
  const accounts = await listAccounts();

  return accounts
    .filter((account) => !account.archived)
    .reduce((total, account) => total + account.balanceInCents, 0);
}

/**
 * Saldo calculado de uma conta **numa data concreta**.
 *
 * Serve para pré-visualizar o ajuste antes de o criar: quando o utilizador
 * trava o saldo com data de ontem, tem de ver o saldo *de ontem*, e não o de
 * hoje. Sem isto, a pré-visualização mentiria sempre que a data não fosse hoje.
 */
export async function getAccountBalanceAtDate(
  accountId: string,
  date: string,
): Promise<{ accountId: string; date: string; balanceInCents: number } | null> {
  const user = await requireUser();
  const account = await prisma.financialAccount.findFirst({
    where: { id: accountId, userId: user.id },
  });

  if (!account) {
    return null;
  }

  const rows = await prisma.transaction.findMany({
    where: { userId: user.id },
    select: TRANSACTION_SELECT,
  });

  return {
    accountId: account.id,
    date,
    balanceInCents: accountBalanceInCents(
      toFinanceAccount(account),
      rows.map(toFinanceTransaction),
      { upTo: date },
    ),
  };
}
