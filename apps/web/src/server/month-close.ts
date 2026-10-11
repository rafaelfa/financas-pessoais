import { prisma } from '@repo/db/client';
import { exceededLimits, periodDateBounds, periodOf } from '@repo/shared';

import { todayInLisbon } from '@/lib/today';

import { TRANSACTION_SELECT } from './accounts';
import { loadInvoiceContext } from './invoice-context';
import { toFinanceCategory, toFinanceTransaction } from './mapping';
import { requireUser } from './session';

/**
 * Fecho de mês.
 *
 * O sistema de referência recomenda uma rotina manual de fim de mês e não a
 * automatiza. Aqui ela é um **assistente**: uma lista do que ficou por resolver,
 * com contagem e ligação para o ecrã onde se resolve, e um marco de "conferido"
 * quando nada bloqueia.
 *
 * Dois passos merecem explicação, porque não são óbvios:
 *
 * - **"Por liquidar" ignora as compras de cartão.** Uma compra a crédito nasce
 *   por liquidar de propósito (liquida-se quando a fatura é paga) e por isso
 *   apareceria sempre como pendente. Quem trata dessas é o passo das faturas;
 *   aqui só contam os lançamentos manuais que o utilizador ainda não deu por
 *   pagos.
 * - **"Saldos por travar" não bloqueia o fecho.** É uma recomendação
 *   (`saldo = inicial + ganhos − gastos` só é verificável contra o banco), não um
 *   erro: um mês pode ser dado por conferido sem ninguém ter travado saldo
 *   nenhum. Bloquear seria inventar uma regra.
 */

export type MonthCloseStepId =
  'pending' | 'unsettled' | 'invoices' | 'balances' | 'budget' | 'uncategorized';

export interface MonthCloseStep {
  readonly id: MonthCloseStepId;
  readonly title: string;
  readonly description: string;
  readonly done: boolean;
  readonly count: number;
  readonly amountInCents: number | null;
  readonly href: string;
  /**
   * `true` quando este passo impede fechar o mês.
   *
   * Existe para a interface poder marcar a diferença sem inventar texto: passar o
   * saldo é uma **recomendação** (confirma-o contra o banco), não uma condição.
   * Sem este campo, quem mostra a lista tem de explicar por palavras porque é que
   * há passos por resolver e o botão continua ativo — e acaba a escrever uma
   * frase que o servidor não sabe garantir.
   */
  readonly blocking: boolean;
}

export interface MonthCloseView {
  readonly period: { key: string; start: string; end: string; label: string };
  readonly steps: readonly MonthCloseStep[];
  readonly completedCount: number;
  readonly totalCount: number;
  readonly readyToClose: boolean;
  readonly closedAt: string | null;
}

const MONTH_NAMES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const;

function labelFor(start: string): string {
  const [year, month] = start.split('-');
  const index = Number(month) - 1;
  const name = MONTH_NAMES[index] ?? month ?? '';

  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year ?? ''}`.trim();
}

/** Passos que **bloqueiam** o fecho. Os restantes são recomendações. */
const BLOCKING_STEPS: readonly MonthCloseStepId[] = [
  'pending',
  'unsettled',
  'invoices',
  'budget',
  'uncategorized',
];

/** O assistente de fecho do mês de competência em curso. */
export async function getMonthClose(): Promise<MonthCloseView> {
  const user = await requireUser();
  const today = todayInLisbon();
  const period = periodOf(today, user.monthStartDay);
  const start = period.start;
  const end = period.end;
  /*
   * `period.end` é **exclusivo**. O `to` anterior era `end` a `T23:59:59.999Z`
   * com um `lte`, o que metia o primeiro dia do mês seguinte no fecho: com o mês
   * a começar ao dia 1, um pendente de 1 de novembro bloqueava o fecho de
   * outubro. `periodDateBounds` dá a convenção certa, num sítio só.
   */
  const bounds = periodDateBounds(period);
  const from = new Date(`${bounds.from}T00:00:00.000Z`);
  const untilExclusive = new Date(`${bounds.untilExclusive}T00:00:00.000Z`);

  const [
    pending,
    unsettled,
    uncategorized,
    accounts,
    locked,
    budgets,
    transactions,
    categories,
    context,
    close,
  ] = await Promise.all([
    prisma.transaction.count({
      where: { userId: user.id, status: 'PENDING', date: { gte: from, lt: untilExclusive } },
    }),
    prisma.transaction.findMany({
      where: {
        userId: user.id,
        settled: false,
        // As compras de cartão liquidam-se com a fatura: quem as trata é o passo
        // das faturas, senão este passo nunca ficaria concluído.
        cardId: null,
        kind: { in: ['EXPENSE', 'INCOME'] },
        status: { not: 'IGNORED' },
        date: { gte: from, lt: untilExclusive },
      },
      select: { amountInCents: true },
    }),
    prisma.transaction.count({
      where: {
        userId: user.id,
        categoryId: null,
        status: { not: 'IGNORED' },
        kind: { in: ['EXPENSE', 'INCOME'] },
        date: { gte: from, lt: untilExclusive },
      },
    }),
    prisma.financialAccount.count({ where: { userId: user.id, archivedAt: null } }),
    prisma.lockedBalance.count({
      where: { userId: user.id, referenceDate: { gte: from, lt: untilExclusive } },
    }),
    prisma.budget.findMany({
      where: { userId: user.id },
      include: { limits: { select: { id: true, categoryId: true, amountInCents: true } } },
    }),
    prisma.transaction.findMany({ where: { userId: user.id }, select: TRANSACTION_SELECT }),
    prisma.category.findMany({ where: { userId: user.id } }),
    loadInvoiceContext(user.id, today),
    prisma.monthClose.findUnique({
      where: { userId_periodStart: { userId: user.id, periodStart: from } },
      select: { closedAt: true },
    }),
  ]);

  const unpaid = context.summaries.filter((invoice) => invoice.outstandingInCents > 0);
  const unpaidTotal = unpaid.reduce((total, invoice) => total + invoice.outstandingInCents, 0);
  const financeTransactions = transactions.map(toFinanceTransaction);
  const financeCategories = categories.map(toFinanceCategory);

  /*
   * Orçamentos excedidos: medidos pelo motor, em competência, exatamente como em
   * /orcamento — e **cada orçamento contra o seu próprio período**. Avaliar todos
   * contra o mês em curso punha um orçamento de setembro com o consumo de
   * outubro (170,00 € onde o ecrã do orçamento mostrava 0) e bloqueava o fecho
   * por um motivo que não existia. A resolução do período vive agora no domínio
   * (`budgetPeriodFor`), que é também o que `/orcamento` usa: uma conta paralela
   * aqui era a forma mais rápida de o assistente de fecho dizer uma coisa e o
   * ecrã do orçamento outra.
   */
  const exceeded = exceededLimits({
    budgets: budgets.map((budget) => ({
      id: budget.id,
      scope: budget.scope === 'MONTHLY_DEFAULT' ? 'monthly_default' : 'single_month',
      periodStart: budget.periodStart.toISOString().slice(0, 10),
      limits: budget.limits.map((limit) => ({
        id: limit.id,
        categoryId: limit.categoryId,
        amountInCents: limit.amountInCents,
      })),
    })),
    transactions: financeTransactions,
    user,
    today,
    // As categorias internas (fatura, ajuste, objetivo) nunca contam para o
    // orçamento — é o motor que o decide, desde que as conheça.
    categories: financeCategories,
  });

  // `blocking` é acrescentado no fim, a partir de `BLOCKING_STEPS`: assim a lista
  // de bloqueios existe num sítio só, e não repetida em seis objetos.
  const steps: Omit<MonthCloseStep, 'blocking'>[] = [
    {
      id: 'pending',
      title: 'Lançamentos por confirmar',
      description: 'Movimentos que ficaram por confirmar neste mês.',
      done: pending === 0,
      count: pending,
      amountInCents: null,
      href: '/transacoes?status=pending',
    },
    {
      id: 'unsettled',
      title: 'Lançamentos por liquidar',
      description: 'Gastos e ganhos que ainda não marcaste como pagos ou recebidos.',
      done: unsettled.length === 0,
      count: unsettled.length,
      amountInCents: unsettled.reduce(
        (total, transaction) => total + Math.abs(transaction.amountInCents),
        0,
      ),
      href: '/transacoes',
    },
    {
      id: 'invoices',
      title: 'Faturas por pagar',
      description: 'Faturas de cartão com valor em dívida vencido ou a vencer.',
      done: unpaid.length === 0,
      count: unpaid.length,
      amountInCents: unpaidTotal,
      href: '/cartoes',
    },
    {
      id: 'balances',
      title: 'Saldos por travar',
      description:
        'Recomendado, não obrigatório: travar o saldo confirma-o contra o banco e cria o ajuste se houver diferença.',
      done: accounts === 0 || locked > 0,
      count: locked,
      amountInCents: null,
      href: '/contas',
    },
    {
      id: 'budget',
      title: 'Orçamentos excedidos',
      description: 'Categorias que passaram do limite definido para o mês.',
      done: exceeded === 0,
      count: exceeded,
      amountInCents: null,
      href: '/orcamento',
    },
    {
      id: 'uncategorized',
      title: 'Lançamentos sem categoria',
      description: 'Sem categoria, não entram nos relatórios por categoria.',
      done: uncategorized === 0,
      count: uncategorized,
      amountInCents: null,
      href: '/regras',
    },
  ];

  const blocking = steps.filter((step) => BLOCKING_STEPS.includes(step.id));
  const completedCount = steps.filter((step) => step.done).length;

  return {
    period: { key: period.key, start, end, label: labelFor(start) },
    steps: steps.map((step) => ({ ...step, blocking: BLOCKING_STEPS.includes(step.id) })),
    completedCount,
    totalCount: steps.length,
    readyToClose: blocking.every((step) => step.done),
    closedAt: close === null ? null : close.closedAt.toISOString().slice(0, 10),
  };
}

/** Resumo do fecho, para o painel não ter de carregar a lista completa. */
export async function monthCloseSummary(): Promise<{
  completedCount: number;
  totalCount: number;
  readyToClose: boolean;
  closedAt: string | null;
}> {
  const view = await getMonthClose();

  return {
    completedCount: view.completedCount,
    totalCount: view.totalCount,
    readyToClose: view.readyToClose,
    closedAt: view.closedAt,
  };
}
