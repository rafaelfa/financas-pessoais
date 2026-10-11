'use server';

import { prisma } from '@repo/db/client';
import { toIsoDate } from '@repo/shared';
import { z } from 'zod';

import { buildTransactionsCsv, transactionsFilename, type ExportFile } from './export';
import { listGoals } from './goals';
import { fromZodError, ok, type ActionResult } from './result';
import { requireUser } from './session';

/**
 * Exportação de dados.
 *
 * Duas saídas, com propósitos diferentes:
 *
 * 1. **CSV de lançamentos** — para abrir no Excel e para voltar a entrar na
 *    aplicação. O formato é exatamente o que o importador aceita (`Data`,
 *    `Descrição`, `Valor`, `Saldo`, `Id`), e é isso que fecha o ciclo: exportar e
 *    reimportar não duplica nada, porque o `Id` viaja como `fitId`.
 * 2. **Backup JSON completo** — para não depender de um fornecedor. Um backup que
 *    só se lê com o esquema da base de dados à frente não serve de nada a quem o
 *    guarda, por isso as referências vão resolvidas em nomes.
 *
 * O dinheiro sai sempre em **cêntimos inteiros** e as datas em `YYYY-MM-DD`: é o
 * formato do domínio, e é o que torna a reimportação exata.
 */

const exportSchema = z
  .object({
    from: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inicial inválida.')
      .optional(),
    to: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data final inválida.')
      .optional(),
    accountId: z.string().trim().min(1).optional(),
  })
  .optional();

/** CSV dos lançamentos, com o mesmo cabeçalho que o importador reconhece. */
export async function exportTransactionsCsv(input: unknown): Promise<ActionResult<ExportFile>> {
  const user = await requireUser();
  const parsed = exportSchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const filters = parsed.data ?? {};
  const transactions = await prisma.transaction.findMany({
    where: {
      userId: user.id,
      ...(filters.accountId !== undefined ? { financialAccountId: filters.accountId } : {}),
      ...(filters.from !== undefined || filters.to !== undefined
        ? {
            date: {
              ...(filters.from !== undefined
                ? { gte: new Date(`${filters.from}T00:00:00.000Z`) }
                : {}),
              ...(filters.to !== undefined ? { lte: new Date(`${filters.to}T00:00:00.000Z`) } : {}),
            },
          }
        : {}),
    },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    select: {
      date: true,
      description: true,
      amountInCents: true,
      fitId: true,
      kind: true,
      category: { select: { name: true } },
      financialAccount: { select: { name: true } },
    },
  });

  return ok({
    filename: transactionsFilename(filters),
    content: buildTransactionsCsv(
      transactions.map((transaction) => ({
        date: transaction.date,
        description: transaction.description,
        amountInCents: transaction.amountInCents,
        fitId: transaction.fitId,
        kind: transaction.kind,
        accountName: transaction.financialAccount?.name ?? null,
        categoryName: transaction.category?.name ?? null,
      })),
    ),
  });
}

/**
 * Backup JSON completo do utilizador.
 *
 * Inclui tudo o que é dele e nada que não seja: contas, categorias, etiquetas,
 * lançamentos, cartões, faturas e pagamentos, objetivos e movimentos, orçamentos
 * e limites, recorrências, regras, bens e passivos.
 *
 * A versão do formato vai no topo, para que um restauro futuro saiba o que está a
 * ler.
 */
export async function exportBackupJson(): Promise<ActionResult<ExportFile>> {
  const user = await requireUser();

  const [
    accounts,
    categories,
    tags,
    transactions,
    cards,
    invoices,
    invoicePayments,
    goals,
    goalMovements,
    budgets,
    recurrences,
    rules,
    assets,
    liabilities,
  ] = await Promise.all([
    prisma.financialAccount.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } }),
    prisma.category.findMany({ where: { userId: user.id }, orderBy: { sortOrder: 'asc' } }),
    prisma.tag.findMany({ where: { userId: user.id }, orderBy: { name: 'asc' } }),
    prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      include: { tags: { select: { name: true } } },
    }),
    prisma.creditCard.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } }),
    prisma.invoice.findMany({ where: { userId: user.id }, orderBy: { closingDate: 'asc' } }),
    prisma.invoicePayment.findMany({ where: { userId: user.id }, orderBy: { date: 'asc' } }),
    prisma.goal.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } }),
    prisma.goalMovement.findMany({ where: { userId: user.id }, orderBy: { date: 'asc' } }),
    prisma.budget.findMany({
      where: { userId: user.id },
      orderBy: { periodStart: 'asc' },
      include: { limits: true },
    }),
    prisma.recurrence.findMany({ where: { userId: user.id }, orderBy: { startDate: 'asc' } }),
    prisma.transactionRule.findMany({
      where: { userId: user.id },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.asset.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } }),
    prisma.liability.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } }),
  ]);

  /*
   * O acumulado de cada objetivo VEM DO MOTOR, não de uma soma feita aqui.
   *
   * `Goal.accumulatedInCents` deixou de existir como coluna: era uma cache escrita
   * apenas na criação, e um campo que mente na base é pior do que um campo a
   * menos. O valor de hoje deriva de `inicial + depósitos + rendimentos −
   * resgates`, e é isso que `goalProgress` calcula. `listGoals` já o faz para o
   * ecrã, pela mesma função — somar `goalMovement` aqui outra vez seria a segunda
   * implementação da mesma regra, e as duas divergiriam.
   *
   * O backup leva o acumulado (para quem o lê saber o progresso à data) **e** os
   * movimentos (que são a fonte de verdade para um restauro): assim recalcula-se
   * sem depender do campo derivado.
   */
  const goalsWithProgress = await listGoals();
  const accumulatedByGoal = new Map(
    goalsWithProgress.map((goal) => [goal.id, goal.accumulatedInCents]),
  );

  const backup = {
    format: 'financas-pessoais/backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    user: { id: user.id, email: user.email, name: user.name, currency: 'EUR' },
    notes: [
      'Os montantes estão em cêntimos inteiros e as datas em YYYY-MM-DD.',
      'goal.accumulatedInCents é DERIVADO (inicial + depósitos + rendimentos − resgates) e calculado pelo motor à data da exportação; para o restaurar, usa-se goalMovements, que é a fonte de verdade.',
    ],
    counts: {
      accounts: accounts.length,
      categories: categories.length,
      tags: tags.length,
      transactions: transactions.length,
      cards: cards.length,
      invoices: invoices.length,
      invoicePayments: invoicePayments.length,
      goals: goals.length,
      goalMovements: goalMovements.length,
      budgets: budgets.length,
      recurrences: recurrences.length,
      rules: rules.length,
      assets: assets.length,
      liabilities: liabilities.length,
    },
    accounts: accounts.map((account) => ({
      id: account.id,
      name: account.name,
      institution: account.institution,
      type: account.type,
      openingBalanceInCents: account.openingBalanceInCents,
      balanceInCents: account.balanceInCents,
      currency: account.currency,
      origin: account.origin,
      archived: account.archivedAt !== null,
    })),
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      kind: category.kind,
      parentId: category.parentId,
      isInternal: category.isInternal,
      isSystem: category.isSystem,
      sortOrder: category.sortOrder,
      icon: category.icon,
      color: category.color,
    })),
    tags: tags.map((tag) => ({ id: tag.id, name: tag.name, color: tag.color })),
    transactions: transactions.map((transaction) => ({
      id: transaction.id,
      kind: transaction.kind,
      status: transaction.status,
      amountInCents: transaction.amountInCents,
      date: toIsoDate(transaction.date),
      description: transaction.description,
      accountId: transaction.financialAccountId,
      categoryId: transaction.categoryId,
      cardId: transaction.cardId,
      invoiceId: transaction.invoiceId,
      goalId: transaction.goalId,
      transferGroupId: transaction.transferGroupId,
      counterpartTransactionId: transaction.counterpartTransactionId,
      settled: transaction.settled,
      settledOn: transaction.settledOn === null ? null : toIsoDate(transaction.settledOn),
      paymentMethod: transaction.paymentMethod,
      paymentCondition: transaction.paymentCondition,
      installmentPlanId: transaction.installmentPlanId,
      installmentNumber: transaction.installmentNumber,
      installmentCount: transaction.installmentCount,
      recurrenceId: transaction.recurrenceId,
      fitId: transaction.fitId,
      origin: transaction.origin,
      tags: transaction.tags.map((tag) => tag.name),
    })),
    cards: cards.map((card) => ({
      id: card.id,
      name: card.name,
      brand: card.brand,
      paymentAccountId: card.paymentAccountId,
      closingDay: card.closingDay,
      dueDay: card.dueDay,
      creditLimitInCents: card.creditLimitInCents,
      annualFeeInCents: card.annualFeeInCents,
      archived: card.archivedAt !== null,
    })),
    invoices: invoices.map((invoice) => ({
      id: invoice.id,
      cardId: invoice.cardId,
      closingDate: toIsoDate(invoice.closingDate),
      dueDate: toIsoDate(invoice.dueDate),
      totalAmountInCents: invoice.totalAmountInCents,
      paidAmountInCents: invoice.paidAmountInCents,
      carriedOverInCents: invoice.carriedOverInCents,
      status: invoice.status,
    })),
    invoicePayments: invoicePayments.map((payment) => ({
      id: payment.id,
      invoiceId: payment.invoiceId,
      accountId: payment.financialAccountId,
      amountInCents: payment.amountInCents,
      date: toIsoDate(payment.date),
      transactionId: payment.transactionId,
    })),
    goals: goals.map((goal) => ({
      id: goal.id,
      name: goal.name,
      targetAmountInCents: goal.targetAmountInCents,
      initialReservedInCents: goal.initialReservedInCents,
      // Derivado, calculado pelo motor (`goalProgress`) à data da exportação.
      // Não é uma coluna, e não se recalcula aqui.
      accumulatedInCents: accumulatedByGoal.get(goal.id) ?? goal.initialReservedInCents,
      targetDate: toIsoDate(goal.targetDate),
      contributionFrequency: goal.contributionFrequency,
      state: goal.state,
    })),
    goalMovements: goalMovements.map((movement) => ({
      id: movement.id,
      goalId: movement.goalId,
      type: movement.type,
      amountInCents: movement.amountInCents,
      date: toIsoDate(movement.date),
      transactionId: movement.transactionId,
    })),
    budgets: budgets.map((budget) => ({
      id: budget.id,
      name: budget.name,
      scope: budget.scope,
      periodStart: toIsoDate(budget.periodStart),
      periodEnd: budget.periodEnd === null ? null : toIsoDate(budget.periodEnd),
      totalAmountInCents: budget.totalAmountInCents,
      limits: budget.limits.map((limit) => ({
        categoryId: limit.categoryId,
        amountInCents: limit.amountInCents,
        alertThresholdPct: limit.alertThresholdPct,
        alertsEnabled: limit.alertsEnabled,
      })),
    })),
    recurrences: recurrences.map((recurrence) => ({
      id: recurrence.id,
      name: recurrence.name,
      kind: recurrence.kind,
      amountInCents: recurrence.amountInCents,
      description: recurrence.description,
      frequency: recurrence.frequency,
      interval: recurrence.interval,
      dayOfMonth: recurrence.dayOfMonth,
      startDate: toIsoDate(recurrence.startDate),
      endDate: recurrence.endDate === null ? null : toIsoDate(recurrence.endDate),
      nextRunDate: toIsoDate(recurrence.nextRunDate),
      isActive: recurrence.isActive,
      accountId: recurrence.financialAccountId,
      categoryId: recurrence.categoryId,
    })),
    rules: rules.map((rule) => ({
      id: rule.id,
      name: rule.name,
      kind: rule.kind,
      priority: rule.priority,
      enabled: rule.enabled,
      descriptionContains: rule.descriptionContains,
      counterparty: rule.counterparty,
      amountMinInCents: rule.amountMinInCents,
      amountMaxInCents: rule.amountMaxInCents,
      dayMin: rule.dayMin,
      dayMax: rule.dayMax,
      accountId: rule.financialAccountId,
      cardId: rule.cardId,
      action: rule.action,
      targetCategoryId: rule.targetCategoryId,
      targetTagNames: rule.targetTagNames,
    })),
    assets: assets.map((asset) => ({
      id: asset.id,
      type: asset.type,
      name: asset.name,
      valueInCents: asset.valueInCents,
      acquiredOn: asset.acquiredOn === null ? null : toIsoDate(asset.acquiredOn),
      archived: asset.archivedAt !== null,
    })),
    liabilities: liabilities.map((liability) => ({
      id: liability.id,
      type: liability.type,
      name: liability.name,
      creditor: liability.creditor,
      principalInCents: liability.principalInCents,
      outstandingInCents: liability.outstandingInCents,
      interestRateBasisPoints: liability.interestRateBasisPoints,
      totalInstallments: liability.totalInstallments,
      remainingInstallments: liability.remainingInstallments,
      installmentAmountInCents: liability.installmentAmountInCents,
      startDate: liability.startDate === null ? null : toIsoDate(liability.startDate),
      endDate: liability.endDate === null ? null : toIsoDate(liability.endDate),
      archived: liability.archivedAt !== null,
    })),
  };

  return ok({
    filename: `copia-de-seguranca-${toIsoDate(new Date())}.json`,
    content: `${JSON.stringify(backup, null, 2)}\n`,
  });
}
