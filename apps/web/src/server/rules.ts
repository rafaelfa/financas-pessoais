import { prisma } from '@repo/db/client';
import { invalidRules, previewClassification, toIsoDate } from '@repo/shared';

import { TRANSACTION_SELECT } from './accounts';
import { toFinanceTransaction } from './mapping';
import { requireUser } from './session';

/**
 * Regras de categorização automática.
 *
 * A pré-visualização é o centro desta funcionalidade: nada é aplicado sem o
 * utilizador ver, transação a transação, o que *seria* feito e por que regra. Um
 * motor de regras que muda dados em silêncio é impossível de corrigir quando
 * categoriza mal.
 *
 * As regras desativadas não chegam ao motor: a decisão de ligar ou desligar é
 * desta camada, não do motor de correspondência.
 */

export type RuleAction = 'set_category' | 'set_tags' | 'set_description' | 'mark_ignored';

export interface RuleView {
  readonly id: string;
  readonly name: string;
  readonly kind: 'expense' | 'income';
  readonly priority: number;
  readonly enabled: boolean;
  readonly descriptionContains: string | null;
  readonly counterparty: string | null;
  readonly amountMinInCents: number | null;
  readonly amountMaxInCents: number | null;
  readonly dayMin: number | null;
  readonly dayMax: number | null;
  readonly accountId: string | null;
  readonly accountName: string | null;
  readonly cardId: string | null;
  readonly targetCategoryId: string | null;
  readonly targetCategoryName: string | null;
  readonly action: RuleAction;
  readonly appliedCount: number;
  readonly lastAppliedAt: string | null;
  /** Sem nenhuma condição, a regra não é aplicável — e é mostrada como tal. */
  readonly isValid: boolean;
}

export interface RulePreviewMatch {
  readonly transactionId: string;
  readonly transactionDate: string;
  readonly transactionDescription: string;
  readonly transactionAmountInCents: number;
  readonly ruleName: string;
  readonly categoryName: string;
  readonly reason: string;
}

function toAction(value: string): RuleAction {
  switch (value) {
    case 'SET_TAGS':
      return 'set_tags';
    case 'SET_DESCRIPTION':
      return 'set_description';
    case 'MARK_IGNORED':
      return 'mark_ignored';
    default:
      return 'set_category';
  }
}

/** Regras do utilizador, por ordem de prioridade. */
export async function listRules(): Promise<RuleView[]> {
  const user = await requireUser();

  const [rules, accounts, categories] = await Promise.all([
    prisma.transactionRule.findMany({
      where: { userId: user.id },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.financialAccount.findMany({
      where: { userId: user.id },
      select: { id: true, name: true },
    }),
    prisma.category.findMany({ where: { userId: user.id }, select: { id: true, name: true } }),
  ]);

  const accountName = new Map(accounts.map((account) => [account.id, account.name]));
  const categoryName = new Map(categories.map((category) => [category.id, category.name]));

  const invalid = new Set(
    invalidRules(
      rules.map((rule) => ({
        id: rule.id,
        name: rule.name,
        kind: rule.kind === 'INCOME' ? ('income' as const) : ('expense' as const),
        priority: rule.priority,
        targetCategoryId: rule.targetCategoryId ?? '',
        descriptionContains: rule.descriptionContains ?? undefined,
        counterparty: rule.counterparty ?? undefined,
        amountMinInCents: rule.amountMinInCents ?? undefined,
        amountMaxInCents: rule.amountMaxInCents ?? undefined,
        dayMin: rule.dayMin ?? undefined,
        dayMax: rule.dayMax ?? undefined,
        accountId: rule.financialAccountId ?? undefined,
        cardId: rule.cardId ?? undefined,
      })),
    ).map((rule) => rule.id),
  );

  return rules.map((rule) => ({
    id: rule.id,
    name: rule.name,
    kind: rule.kind === 'INCOME' ? 'income' : 'expense',
    priority: rule.priority,
    enabled: rule.enabled,
    descriptionContains: rule.descriptionContains,
    counterparty: rule.counterparty,
    amountMinInCents: rule.amountMinInCents,
    amountMaxInCents: rule.amountMaxInCents,
    dayMin: rule.dayMin,
    dayMax: rule.dayMax,
    accountId: rule.financialAccountId,
    accountName:
      rule.financialAccountId === null ? null : (accountName.get(rule.financialAccountId) ?? null),
    cardId: rule.cardId,
    targetCategoryId: rule.targetCategoryId,
    targetCategoryName:
      rule.targetCategoryId === null ? null : (categoryName.get(rule.targetCategoryId) ?? null),
    action: toAction(rule.action),
    appliedCount: rule.appliedCount,
    lastAppliedAt: rule.lastAppliedAt === null ? null : toIsoDate(rule.lastAppliedAt),
    isValid: !invalid.has(rule.id),
  }));
}

/**
 * Pré-visualização: o que as regras ativas fariam aos lançamentos sem categoria.
 *
 * Só entram gastos e ganhos não ignorados e **sem categoria**: uma regra nunca
 * reescreve uma classificação que o utilizador já fez à mão.
 */
export async function previewRules(): Promise<{
  readonly uncategorizedCount: number;
  readonly matches: readonly RulePreviewMatch[];
}> {
  const user = await requireUser();

  const [rules, transactions, categories] = await Promise.all([
    prisma.transactionRule.findMany({
      where: { userId: user.id, enabled: true },
      orderBy: [{ priority: 'asc' }],
    }),
    prisma.transaction.findMany({
      where: {
        userId: user.id,
        categoryId: null,
        status: { not: 'IGNORED' },
        kind: { in: ['EXPENSE', 'INCOME'] },
      },
      select: TRANSACTION_SELECT,
      orderBy: [{ date: 'desc' }],
      take: 500,
    }),
    prisma.category.findMany({ where: { userId: user.id }, select: { id: true, name: true } }),
  ]);

  const categoryName = new Map(categories.map((category) => [category.id, category.name]));
  const usable = rules.filter((rule) => rule.targetCategoryId !== null);

  const matches = previewClassification(
    transactions.map(toFinanceTransaction),
    usable.map((rule) => ({
      id: rule.id,
      name: rule.name,
      kind: rule.kind === 'INCOME' ? ('income' as const) : ('expense' as const),
      priority: rule.priority,
      targetCategoryId: rule.targetCategoryId ?? '',
      descriptionContains: rule.descriptionContains ?? undefined,
      counterparty: rule.counterparty ?? undefined,
      amountMinInCents: rule.amountMinInCents ?? undefined,
      amountMaxInCents: rule.amountMaxInCents ?? undefined,
      dayMin: rule.dayMin ?? undefined,
      dayMax: rule.dayMax ?? undefined,
      accountId: rule.financialAccountId ?? undefined,
      cardId: rule.cardId ?? undefined,
    })),
  );

  const byId = new Map(transactions.map((transaction) => [transaction.id, transaction]));

  return {
    uncategorizedCount: transactions.length,
    matches: matches.map((match) => {
      const transaction = byId.get(match.transactionId);

      return {
        transactionId: match.transactionId,
        transactionDate: transaction === undefined ? '' : toIsoDate(transaction.date),
        transactionDescription: transaction?.description ?? '(sem descrição)',
        transactionAmountInCents: transaction?.amountInCents ?? 0,
        ruleName: match.ruleName,
        categoryName: categoryName.get(match.categoryId) ?? 'Categoria',
        reason: match.reason,
      };
    }),
  };
}

/** Quantos lançamentos estão sem categoria — para o painel e para /regras. */
export async function uncategorizedCount(): Promise<number> {
  const user = await requireUser();

  return prisma.transaction.count({
    where: {
      userId: user.id,
      categoryId: null,
      status: { not: 'IGNORED' },
      kind: { in: ['EXPENSE', 'INCOME'] },
    },
  });
}
