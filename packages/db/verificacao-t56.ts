/* eslint-disable no-console */
/**
 * T5.6 — Verificação adversarial das Fases 5 e 6 (script TEMPORÁRIO).
 *
 * Faz a Parte C do relatório `docs/spec/T5.6-verificacao-fases-5-e-6.md`:
 * cria um utilizador `qa-*`, insere dados que exercitam as fronteiras da
 * aritmética (dia de início do mês ≠ 1, fronteira do fim exclusivo, objetivo com
 * movimentos, recorrência anual, previsão de saldo), mede os tempos das páginas
 * reais e apaga tudo no fim.
 *
 * Onde a função de servidor não é importável (depende de `requireUser()` e do
 * contexto de pedido do Next), a conta é reproduzida com as **mesmas expressões**
 * do código e cita-se `ficheiro:linha` ao lado de cada número.
 *
 * NÃO toca em `rafaelfa.aguiar@gmail.com`. Correr com o carregador de TypeScript
 * do Node (o `tsx` falha nesta sandbox com `spawn EPERM`):
 *
 *   node --experimental-transform-types --import <hook> verificacao-t56.ts
 */

import { createHash, randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

import { config } from 'dotenv';

const here = dirname(fileURLToPath(import.meta.url));

config({
  path: [resolve(here, '../../.env'), resolve(here, '../.env'), resolve(here, '.env'), '.env'],
  quiet: true,
});

const BASE_URL = process.env.VERIFICACAO_BASE_URL ?? 'https://financas-pessoais-psi-lac.vercel.app';
const REAL_USER_EMAIL = 'rafaelfa.aguiar@gmail.com';
const PASSWORD = 'Verificacao-T56-2026!';
const RUN = Date.now().toString(36);
const TODAY = '2026-10-11';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function httpPostJson(
  path: string,
  body: unknown,
): Promise<{ status: number; text: string; setCookies: string[] }> {
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'content-type': 'application/json',
        origin: BASE_URL,
        referer: `${BASE_URL}/registar`,
      },
      body: JSON.stringify(body),
    });

    return {
      status: response.status,
      text: await response.text(),
      setCookies: response.headers.getSetCookie(),
    };
  } catch (error) {
    return { status: -1, text: `ERRO: ${String(error)}`, setCookies: [] };
  }
}

async function httpGet(
  path: string,
  cookie: string,
): Promise<{ status: number; ms: number; bytes: number; sha256: string; body: string }> {
  const started = performance.now();

  try {
    const response = await fetch(`${BASE_URL}${path}`, { headers: { cookie } });
    const body = await response.text();

    return {
      status: response.status,
      ms: Math.round(performance.now() - started),
      bytes: Buffer.byteLength(body, 'utf8'),
      sha256: sha256(body).slice(0, 16),
      body,
    };
  } catch (error) {
    return {
      status: -1,
      ms: Math.round(performance.now() - started),
      bytes: 0,
      sha256: '',
      body: `ERRO: ${String(error)}`,
    };
  }
}

/** Soma as despesas de um período pela expressão literal de `budgets.ts:170-178`. */
function spentAllByBudgetsExpression(
  transactions: ReadonlyArray<{
    date: string;
    status: string;
    kind: string;
    amountInCents: number;
  }>,
  period: { start: string; end: string },
): number {
  return transactions
    .filter(
      (transaction) =>
        transaction.date >= period.start &&
        transaction.date <= period.end &&
        transaction.status !== 'ignored' &&
        transaction.kind === 'expense',
    )
    .reduce((total, transaction) => total + Math.abs(transaction.amountInCents), 0);
}

async function main(): Promise<void> {
  const { prisma } = await import('./src/client');
  const shared = await import('../shared/src/index');
  const { monthPeriodFor, currentPeriod, periodStartFor } =
    await import('../../apps/web/src/server/budget-period');

  const summary: Record<string, unknown> = { baseUrl: BASE_URL, run: RUN, today: TODAY };
  const createdIds: string[] = [];

  const realBefore = await prisma.user.findUnique({
    where: { email: REAL_USER_EMAIL },
    select: { id: true },
  });
  const realCountsBefore =
    realBefore === null
      ? null
      : {
          categories: await prisma.category.count({ where: { userId: realBefore.id } }),
          accounts: await prisma.financialAccount.count({ where: { userId: realBefore.id } }),
          transactions: await prisma.transaction.count({ where: { userId: realBefore.id } }),
        };

  // -------------------------------------------------------------------------
  // 0. Utilizador de teste (por HTTP, para ter sessão para os tempos)
  // -------------------------------------------------------------------------
  const email = `qa-t56-${RUN}@example.com`;
  const signUp = await httpPostJson('/api/auth/sign-up/email', {
    email,
    password: PASSWORD,
    name: 'QA T56',
  });
  const signIn = await httpPostJson('/api/auth/sign-in/email', { email, password: PASSWORD });
  const cookie = (signIn.setCookies.length > 0 ? signIn.setCookies : signUp.setCookies)
    .map((value) => value.split(';')[0]?.trim() ?? '')
    .filter((value) => value !== '')
    .join('; ');

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });

  if (user === null) {
    throw new Error(`Não consegui criar o utilizador de teste (signUp=${signUp.status}).`);
  }

  const userId = user.id;
  createdIds.push(userId);

  // O utilizador de teste tem de ter o mês a começar ao dia 5 (fronteira da
  // Parte B) e o catálogo já aprovisionado pelo gancho.
  await prisma.user.update({ where: { id: userId }, data: { monthStartDay: 5 } });
  const monthStartDay = 5;

  const categories = await prisma.category.findMany({
    where: { userId },
    select: { id: true, name: true, kind: true, isInternal: true },
  });
  const account = await prisma.financialAccount.findFirst({
    where: { userId },
    select: { id: true },
  });

  if (account === null) {
    throw new Error('O utilizador de teste ficou sem carteira principal.');
  }

  const expenseCategories = categories.filter(
    (entry) => entry.kind === 'EXPENSE' && !entry.isInternal,
  );
  const catFood = expenseCategories[0]!;
  const catOther = expenseCategories[1]!;
  const catNoLimit = expenseCategories[2] ?? catOther;

  console.log(
    `[setup] utilizador=${email} categorias=${categories.length} diaInicio=${monthStartDay}`,
  );

  // -------------------------------------------------------------------------
  // 1. Orçamento (monthly_default) com limites — para o Gate G6
  // -------------------------------------------------------------------------
  const budget = await prisma.budget.create({
    data: {
      userId,
      name: `Orçamento QA ${RUN}`,
      scope: 'MONTHLY_DEFAULT',
      periodStart: new Date('1970-01-01T00:00:00.000Z'),
      totalAmountInCents: 200_000,
      alertsEnabled: true,
      limits: {
        create: [
          { userId, categoryId: catFood.id, amountInCents: 100_000 },
          { userId, categoryId: catOther.id, amountInCents: 50_000 },
        ],
      },
    },
    select: { id: true },
  });

  // Orçamento single_month de um mês ANTERIOR (setembro de 2026).
  const oldBudget = await prisma.budget.create({
    data: {
      userId,
      name: `Orçamento de setembro QA ${RUN}`,
      scope: 'SINGLE_MONTH',
      periodStart: new Date('2026-09-05T00:00:00.000Z'),
      periodEnd: new Date('2026-10-04T00:00:00.000Z'),
      totalAmountInCents: 30_000,
      limits: { create: [{ userId, categoryId: catFood.id, amountInCents: 10_000 }] },
    },
    select: { id: true },
  });

  // -------------------------------------------------------------------------
  // 2. Lançamentos nas fronteiras do período (dia 5 → dia 4)
  // -------------------------------------------------------------------------
  const txRow = (
    id: string,
    date: string,
    amountInCents: number,
    categoryId: string,
    overrides: Partial<{
      status: string;
      settled: boolean;
      kind: string;
      invoiceId: string | null;
    }> = {},
  ) => ({
    id,
    userId,
    kind: (overrides.kind ?? 'EXPENSE') as never,
    status: (overrides.status ?? 'CONFIRMED') as never,
    amountInCents,
    date: new Date(`${date}T00:00:00.000Z`),
    description: `QA ${id}`,
    financialAccountId: account.id,
    categoryId,
    invoiceId: overrides.invoiceId ?? null,
    settled: overrides.settled ?? true,
    settledOn: new Date(`${date}T00:00:00.000Z`),
  });

  await prisma.transaction.createMany({
    data: [
      // Fronteira do mês de competência que contém 2026-10-11 (5 out → 4 nov).
      txRow('b-antes', '2026-10-04', -1_000, catFood.id),
      txRow('b-inicio', '2026-10-05', -2_000, catFood.id),
      txRow('b-ultimo', '2026-11-04', -4_000, catFood.id),
      txRow('b-fim', '2026-11-05', -8_000, catFood.id),
      // Gasto por classificar e uma compra de cartão, para a previsão.
      txRow('sem-categoria', '2026-10-20', -3_000, catNoLimit.id, { settled: false }),
      txRow('por-liquidar-hoje', '2026-10-11', -5_000, catFood.id, { settled: false }),
      txRow('por-liquidar-amanha', '2026-10-12', -6_000, catFood.id, { settled: false }),
    ],
  });

  // Compra de cartão (invoiceId preenchido): não pode contar na previsão duas vezes.
  const card = await prisma.creditCard.create({
    data: { userId, name: `Cartão QA ${RUN}`, closingDay: 20, dueDay: 30 },
    select: { id: true },
  });
  const invoice = await prisma.invoice.create({
    data: {
      userId,
      cardId: card.id,
      closingDate: new Date('2026-09-20T00:00:00.000Z'),
      dueDate: new Date('2026-10-11T00:00:00.000Z'), // vence HOJE
      status: 'OPEN',
    },
    select: { id: true },
  });
  await prisma.transaction.create({
    data: {
      userId,
      kind: 'EXPENSE',
      status: 'CONFIRMED',
      amountInCents: -7_000,
      date: new Date('2026-09-10T00:00:00.000Z'),
      description: 'Compra cartão',
      financialAccountId: account.id,
      cardId: card.id,
      invoiceId: invoice.id,
      settled: false,
    },
  });
  const invoiceTomorrow = await prisma.invoice.create({
    data: {
      userId,
      cardId: card.id,
      closingDate: new Date('2026-10-20T00:00:00.000Z'),
      dueDate: new Date('2026-10-12T00:00:00.000Z'), // vence amanhã
      status: 'OPEN',
    },
    select: { id: true },
  });
  await prisma.transaction.create({
    data: {
      userId,
      kind: 'EXPENSE',
      status: 'CONFIRMED',
      amountInCents: -2_000,
      date: new Date('2026-10-15T00:00:00.000Z'),
      description: 'Compra cartão amanhã',
      financialAccountId: account.id,
      cardId: card.id,
      invoiceId: invoiceTomorrow.id,
      settled: false,
    },
  });

  const rows = await prisma.transaction.findMany({ where: { userId } });
  const financeTransactions = rows.map((row) => ({
    id: row.id,
    kind: row.kind.toLowerCase() as never,
    status: row.status.toLowerCase() as never,
    amountInCents: row.amountInCents,
    date: row.date.toISOString().slice(0, 10),
    description: row.description ?? undefined,
    accountId: row.financialAccountId ?? '',
    categoryId: row.categoryId ?? undefined,
    invoiceId: row.invoiceId ?? undefined,
    settled: row.settled,
    settledOn: row.settledOn?.toISOString().slice(0, 10),
  }));
  const financeCategories = categories.map((entry) => ({
    id: entry.id,
    kind: entry.kind.toLowerCase() as never,
    internal: entry.isInternal,
  }));

  // -------------------------------------------------------------------------
  // B1 — Gate G6: painel vs orçamento vs relatório, mesmo período e regime
  // -------------------------------------------------------------------------
  const motorPeriod = shared.periodOf(TODAY, monthStartDay); // dashboard.ts:86
  const budgetPeriod = monthPeriodFor({ user: { monthStartDay }, today: TODAY }); // budgets.ts:114
  const reportPeriod = shared.periodOf(TODAY, monthStartDay); // reports.ts:175-182

  const optionsAccrual = {
    basis: 'accrual' as const,
    categories: financeCategories,
    monthStartDay,
  };

  const dashboardExpense = shared.monthlyResult(
    financeTransactions,
    motorPeriod,
    optionsAccrual,
  ).expenseInCents; // dashboard.ts:111
  const reportExpense = shared.monthlyResult(
    financeTransactions,
    reportPeriod,
    optionsAccrual,
  ).expenseInCents; // reports.ts:210
  const budgetStatuses = shared.budgetStatusList({
    limits: [
      { id: 'l1', categoryId: catFood.id, amountInCents: 100_000 },
      { id: 'l2', categoryId: catOther.id, amountInCents: 50_000 },
    ],
    transactions: financeTransactions,
    period: budgetPeriod,
    referenceDate: TODAY,
  }); // budgets.ts:130-135
  const budgetSpentWithLimits = budgetStatuses.reduce(
    (total, entry) => total + entry.spentInCents,
    0,
  );
  const budgetSpentAll = spentAllByBudgetsExpression(financeTransactions, budgetPeriod); // budgets.ts:170

  summary.gateG6 = {
    periodoSemDia5: monthPeriodFor({ user: { monthStartDay }, today: TODAY }),
    motorPeriod,
    budgetPeriod,
    dashboardExpenseAccrual: dashboardExpense,
    reportExpenseAccrual: reportExpense,
    budgetSpentAll: budgetSpentAll,
    budgetSpentWithLimits,
    divergenciaPainelMenosRelatorio: dashboardExpense - reportExpense,
    divergenciaPainelMenosOrcamento: dashboardExpense - budgetSpentAll,
    divergenciaDentroDoOrcamento: budgetSpentAll - budgetSpentWithLimits,
  };

  console.log('[B1 G6]', JSON.stringify(summary.gateG6));

  // B1b — a série mensal do relatório (reports.ts:243-247) usa `period.end` como
  // fim de `resultSeries`, que é EXCLUSIVO: `periodRange` inclui o período
  // seguinte. O gráfico e o total do mesmo relatório discordam?
  const reportSeries = shared.resultSeries(
    financeTransactions,
    reportPeriod.start,
    reportPeriod.end,
    optionsAccrual,
  );

  summary.reportByMonth = {
    periodos: reportSeries.map((entry) => entry.period.key),
    despesaPorPeriodo: reportSeries.map((entry) => entry.expenseInCents),
    somaDaSerie: reportSeries.reduce((total, entry) => total + entry.expenseInCents, 0),
    despesaDoRelatorio: reportExpense,
    periodoPedido: `${reportPeriod.start}..${reportPeriod.end}`,
  };

  console.log('[B1b série do relatório]', JSON.stringify(summary.reportByMonth));

  // -------------------------------------------------------------------------
  // B2 — Fronteira do dia de início (5 → 4) e fim exclusivo
  // -------------------------------------------------------------------------
  const period5 = shared.periodOf(TODAY, 5);
  const monthCloseFrom = new Date(`${period5.start}T00:00:00.000Z`);
  const monthCloseTo = new Date(`${period5.end}T23:59:59.999Z`); // month-close.ts:104

  const boundaries = {
    periodStart: period5.start,
    periodEndExclusivo: period5.end,
    dia4DentroDoMotor: shared.isWithinPeriod(period5, '2026-11-04'),
    dia5DentroDoMotor: shared.isWithinPeriod(period5, '2026-11-05'),
    dia4DentroDoOrcamento: shared.isWithinPeriod(budgetPeriod, '2026-11-04'),
    dia5DentroDoOrcamento: shared.isWithinPeriod(budgetPeriod, '2026-11-05'),
    /** month-close.ts:119 usa `lte` com a data de fim do motor (exclusiva). */
    dia5EntraNoFechoDeMes: new Date('2026-11-05T00:00:00.000Z') <= monthCloseTo,
    dia4EntraNoFechoDeMes: new Date('2026-11-04T00:00:00.000Z') <= monthCloseTo,
    monthCloseFrom: monthCloseFrom.toISOString().slice(0, 10),
    monthCloseTo: monthCloseTo.toISOString().slice(0, 10),
  };

  console.log('[B2 fronteiras]', JSON.stringify(boundaries));
  summary.boundaries = boundaries;

  // -------------------------------------------------------------------------
  // B3 — single_month, a sentinela e o fecho de mês
  // -------------------------------------------------------------------------
  const closeMonthKey = '2026-10';
  // month-close-actions.ts:42 — `periodOf(`${periodKey}-01`, monthStartDay)`
  const closeMonthPeriod = shared.periodOf(`${closeMonthKey}-01`, monthStartDay);
  const realPeriodForKey = shared.periodOf(`${closeMonthKey}-05`, monthStartDay);

  // budgets.ts:112-120 vs month-close.ts:172-185 (usa sempre o período em curso)
  const oldBudgetOwnPeriod = currentPeriod({
    scope: 'single_month',
    periodStart: '2026-09-05',
    user: { monthStartDay },
    today: TODAY,
  });
  const oldBudgetLimitStatusesCurrent = shared.budgetStatusList({
    limits: [{ id: 'l-old', categoryId: catFood.id, amountInCents: 10_000 }],
    transactions: financeTransactions,
    period: period5,
    referenceDate: TODAY,
    resultOptions: { categories: financeCategories, monthStartDay },
  });
  const oldBudgetLimitStatusesOwn = shared.budgetStatusList({
    limits: [{ id: 'l-old', categoryId: catFood.id, amountInCents: 10_000 }],
    transactions: financeTransactions,
    period: oldBudgetOwnPeriod,
    referenceDate: TODAY,
    resultOptions: { categories: financeCategories, monthStartDay },
  });

  summary.singleMonth = {
    orcamentoSetembroGuardadoPeriodStart: '2026-09-05',
    periodStartDerivadoDoScopeProprio: oldBudgetOwnPeriod.start,
    /** budgetPeriodFor(scope) ignora o scope: devolve sempre o mês em curso. */
    oQueBudgetPeriodForDevolveria: monthPeriodFor({ user: { monthStartDay }, today: TODAY }),
    fechoDeMesPeriodStartGravadoComKey202610: closeMonthPeriod.start,
    fechoDeMesPeriodStartRealDoPeriodo: realPeriodForKey.start,
    fechoDeMesGravaOPeriodoErrado: closeMonthPeriod.start !== realPeriodForKey.start,
    orcamentoSetembroAvaliadoNoMesEmCurso: oldBudgetLimitStatusesCurrent[0]?.spentInCents ?? 0,
    orcamentoSetembroAvaliadoNoMesProprio: oldBudgetLimitStatusesOwn[0]?.spentInCents ?? 0,
    orcamentoSetembroIdsCriados: [budget.id.slice(0, 8), oldBudget.id.slice(0, 8)],
  };

  console.log('[B3 single_month]', JSON.stringify(summary.singleMonth));

  // Verificação end-to-end da fronteira: o ecrã do orçamento mostra o consumo do
  // limite de Alimentação de 130,00 € (só até ao dia 4 exclusivo) ou de 170,00 €
  // (o mês de competência inteiro)? Ainda não há dados de volume nesta altura.
  const orcamentoNaFronteira = await httpGet('/orcamento', cookie);

  summary.budgetBoundaryOnScreen = {
    status: orcamentoNaFronteira.status,
    bytes: orcamentoNaFronteira.bytes,
    hash: orcamentoNaFronteira.sha256,
    mostra130: orcamentoNaFronteira.body.includes('130,00'),
    mostra170: orcamentoNaFronteira.body.includes('170,00'),
    sentinela1970: orcamentoNaFronteira.body.includes('1970'),
  };

  console.log('[B2b orçamento no ecrã]', JSON.stringify(summary.budgetBoundaryOnScreen));

  // -------------------------------------------------------------------------
  // B4 — Goal.accumulatedInCents: a coluna fica desatualizada?
  // -------------------------------------------------------------------------
  const goal = await prisma.goal.create({
    data: {
      userId,
      name: `Objetivo QA ${RUN}`,
      targetAmountInCents: 500_000,
      initialReservedInCents: 50_000,
      accumulatedInCents: 50_000, // goals-actions.ts:63 (único sítio que a escreve)
      targetDate: new Date('2027-06-30T00:00:00.000Z'),
      contributionFrequency: 'MONTHLY',
      state: 'ACTIVE',
    },
    select: { id: true },
  });

  const movementDate = new Date('2026-10-06T00:00:00.000Z');
  const linkedTransaction = await prisma.transaction.create({
    data: {
      userId,
      kind: 'GOAL_DEPOSIT',
      status: 'CONFIRMED',
      amountInCents: -25_000,
      date: movementDate,
      description: 'Depósito no objetivo',
      financialAccountId: account.id,
      goalId: goal.id,
      settled: true,
      settledOn: movementDate,
    },
    select: { id: true },
  });
  const movement = await prisma.goalMovement.create({
    data: {
      userId,
      goalId: goal.id,
      type: 'DEPOSIT',
      amountInCents: 25_000,
      date: movementDate,
      transactionId: linkedTransaction.id,
    },
    select: { id: true },
  });

  const columnAfterDeposit = await prisma.goal.findUnique({
    where: { id: goal.id },
    select: { accumulatedInCents: true, initialReservedInCents: true },
  });
  const motorProgress = shared.goalProgress({
    goal: {
      id: goal.id,
      targetAmountInCents: 500_000,
      initialReservedInCents: 50_000,
      targetDate: '2027-06-30',
      contributionFrequency: 'monthly',
    },
    movements: [
      {
        goalId: goal.id,
        type: 'deposit',
        amountInCents: 25_000,
        date: '2026-10-06',
      },
    ],
    today: TODAY,
  });

  // Simula `deleteGoalMovement` (goals-actions.ts:309-317) e volta a ler a coluna.
  await prisma.$transaction(async (tx) => {
    await tx.goalMovement.delete({ where: { id: movement.id } });
    await tx.transaction.deleteMany({ where: { id: linkedTransaction.id, userId } });
  });
  const columnAfterDelete = await prisma.goal.findUnique({
    where: { id: goal.id },
    select: { accumulatedInCents: true },
  });
  const motorAfterDelete = shared.goalProgress({
    goal: {
      id: goal.id,
      targetAmountInCents: 500_000,
      initialReservedInCents: 50_000,
      targetDate: '2027-06-30',
      contributionFrequency: 'monthly',
    },
    movements: [],
    today: TODAY,
  });

  summary.goalColumn = {
    colunaAposCriar: 50_000,
    colunaAposDeposito: columnAfterDeposit?.accumulatedInCents ?? null,
    motorAposDeposito: motorProgress.accumulatedInCents,
    colunaAposApagarMovimento: columnAfterDelete?.accumulatedInCents ?? null,
    motorAposApagarMovimento: motorAfterDelete.accumulatedInCents,
    colunaDesatualizada:
      (columnAfterDeposit?.accumulatedInCents ?? -1) !== motorProgress.accumulatedInCents,
  };

  console.log('[B4 coluna do objetivo]', JSON.stringify(summary.goalColumn));

  // -------------------------------------------------------------------------
  // B6/B7/B8 — Recorrências: concorrência, truncagem, deriva e anual
  // -------------------------------------------------------------------------
  const recurrence = await prisma.recurrence.create({
    data: {
      userId,
      name: `Renda QA ${RUN}`,
      kind: 'EXPENSE',
      amountInCents: -80_000,
      frequency: 'MONTHLY',
      interval: 1,
      dayOfMonth: null,
      startDate: new Date('2026-01-31T00:00:00.000Z'),
      nextRunDate: new Date('2026-01-31T00:00:00.000Z'),
      isActive: true,
      financialAccountId: account.id,
      categoryId: catFood.id,
    },
    select: { id: true },
  });

  // B7 — deriva do dia 31 sem `dayOfMonth` (coluna é nullable).
  const driftWithoutDay: string[] = [];
  let cursor = '2026-01-31';

  for (let step = 0; step < 5; step += 1) {
    driftWithoutDay.push(cursor);
    cursor = shared.nextOccurrence({ from: cursor, frequency: 'monthly', interval: 1 });
  }

  const driftWithDay: string[] = [];
  let cursor2 = '2026-01-31';

  for (let step = 0; step < 5; step += 1) {
    driftWithDay.push(cursor2);
    cursor2 = shared.nextOccurrence({
      from: cursor2,
      frequency: 'monthly',
      interval: 1,
      dayOfMonth: 31,
    });
  }

  // B8 — anual: o mapeamento das camadas de servidor vs o motor.
  const toFrequency = (value: string): string =>
    value === 'WEEKLY' ? 'weekly' : value === 'QUARTERLY' ? 'quarterly' : 'monthly'; // recurrences.ts:41, dashboard.ts:133-137, goals.ts:58

  const yearlyAsMonthly = toFrequency('YEARLY');
  const yearlyDue = shared.dueOccurrences({
    nextRunDate: '2026-01-15',
    frequency: yearlyAsMonthly as never,
    interval: 1,
    today: '2026-12-31',
  });
  const yearlyDueCorrect = shared.dueOccurrences({
    nextRunDate: '2026-01-15',
    frequency: 'yearly',
    interval: 1,
    today: '2026-12-31',
  });

  // B6 — truncagem: a corrida seguinte volta à mesma data?
  const truncated = shared.dueOccurrences({
    nextRunDate: '2026-01-05',
    frequency: 'monthly',
    today: '2026-12-31',
    limit: 3,
  });
  const afterTruncation = shared.dueOccurrences({
    nextRunDate: truncated.nextRunDate,
    frequency: 'monthly',
    today: '2026-12-31',
    limit: 3,
  });

  // B6b — série cujo fim já passou: fica "por gerar" para sempre?
  const pastEnd = shared.dueOccurrences({
    nextRunDate: '2026-02-28',
    frequency: 'monthly',
    endDate: '2026-01-31',
    today: TODAY,
  });
  const dueFlagForever = pastEnd.dates.length === 0 && pastEnd.nextRunDate <= TODAY; // recurrences.ts:93

  summary.recurrences = {
    derivaSemDayOfMonth: driftWithoutDay,
    derivaComDayOfMonth: driftWithDay,
    anualMapeadaPara: yearlyAsMonthly,
    ocorrenciasDeUmaSerieAnualNoAno: yearlyDue.dates.length,
    ocorrenciasCorretasDeUmaSerieAnual: yearlyDueCorrect.dates.length,
    descricaoQueAInterfaceMostra: shared.describeFrequency({
      frequency: yearlyAsMonthly as never,
      interval: 1,
    }),
    descricaoCorreta: shared.describeFrequency({ frequency: 'yearly', interval: 1 }),
    truncagemDatas: truncated.dates,
    truncagemProximaData: truncated.nextRunDate,
    corridaSeguinteDatas: afterTruncation.dates,
    truncagemRepeteData: afterTruncation.dates.some((date) => truncated.dates.includes(date)),
    serieComFimNoPassado: {
      datas: pastEnd.dates.length,
      nextRunDate: pastEnd.nextRunDate,
      continuaPorGerar: dueFlagForever,
    },
  };

  console.log('[B6/B7/B8 recorrências]', JSON.stringify(summary.recurrences));

  // B6c — concorrência: o mesmo que `generateDueRecurrences` faz, em paralelo.
  await prisma.recurrence.update({
    where: { id: recurrence.id },
    data: { dayOfMonth: 31, nextRunDate: new Date('2026-01-31T00:00:00.000Z') },
  });

  const readDue = async (): Promise<{ nextRunDate: string; id: string }[]> =>
    prisma.recurrence.findMany({
      where: { userId, isActive: true, nextRunDate: { lte: new Date(`${TODAY}T00:00:00.000Z`) } },
      select: { id: true, nextRunDate: true },
      orderBy: { nextRunDate: 'asc' },
    }); // recurrences-actions.ts:277-284

  const reads = await Promise.all([readDue(), readDue()]);

  const runGeneration = async (nextRunDate: string, id: string): Promise<void> => {
    const result = shared.dueOccurrences({
      nextRunDate,
      frequency: 'monthly',
      interval: 1,
      dayOfMonth: 31,
      today: TODAY,
    });

    await prisma.$transaction(async (tx) => {
      for (const date of result.dates) {
        await tx.transaction.create({
          data: {
            userId,
            kind: 'EXPENSE',
            status: 'CONFIRMED',
            amountInCents: -80_000,
            date: new Date(`${date}T00:00:00.000Z`),
            description: `Ocorrência QA ${date}`,
            financialAccountId: account.id,
            categoryId: catFood.id,
            recurrenceId: id,
            settled: true,
            settledOn: new Date(`${date}T00:00:00.000Z`),
          },
        });
      }

      await tx.recurrence.update({
        where: { id },
        data: { nextRunDate: new Date(`${result.nextRunDate}T00:00:00.000Z`) },
      }); // recurrences-actions.ts:340-343
    });
  };

  await Promise.all([
    runGeneration(reads[0]![0]!.nextRunDate.toISOString().slice(0, 10), recurrence.id),
    runGeneration(reads[1]![0]!.nextRunDate.toISOString().slice(0, 10), recurrence.id),
  ]);

  const generated = await prisma.transaction.findMany({
    where: { userId, recurrenceId: recurrence.id },
    select: { date: true },
    orderBy: { date: 'asc' },
  });
  const generatedDates = generated.map((row) => row.date.toISOString().slice(0, 10));
  const duplicatedDates = generatedDates.filter(
    (date, index) => generatedDates.indexOf(date) !== index,
  );

  summary.recurrenceRace = {
    duasLeiturasIguais: reads[0]![0]!.nextRunDate.getTime() === reads[1]![0]!.nextRunDate.getTime(),
    ocorrenciasCriadas: generatedDates.length,
    ocorrenciasEsperadas: 10,
    datasDuplicadas: [...new Set(duplicatedDates)],
    totalDeDuplicados: duplicatedDates.length,
  };

  console.log('[B6c corrida do gerador]', JSON.stringify(summary.recurrenceRace));

  // -------------------------------------------------------------------------
  // B9 — Previsão de saldo: o que fica de fora
  // -------------------------------------------------------------------------
  const accounts = await prisma.financialAccount.findMany({ where: { userId } });
  const financeAccounts = accounts.map((entry) => ({
    id: entry.id,
    openingBalanceInCents: entry.openingBalanceInCents,
    archived: entry.archivedAt !== null,
  }));

  const forecastRecurrences = [
    {
      id: recurrence.id,
      name: `Renda QA ${RUN}`,
      kind: 'expense' as const,
      amountInCents: -80_000,
      frequency: 'monthly' as const,
      interval: 1,
      dayOfMonth: 31,
      nextRunDate: '2026-11-30',
      isActive: true,
    },
    {
      id: 'vencida',
      name: 'Renda vencida (não gerada)',
      kind: 'expense' as const,
      amountInCents: -10_000,
      frequency: 'monthly' as const,
      interval: 1,
      nextRunDate: '2026-10-01', // já venceu
      isActive: true,
    },
  ];

  const outstandingToday = 7_000;
  const outstandingTomorrow = 2_000;

  const forecast = shared.cashFlowForecast({
    accounts: financeAccounts,
    transactions: financeTransactions,
    recurrences: forecastRecurrences,
    unpaidInvoices: [
      {
        id: invoice.id,
        cardName: `Cartão QA ${RUN}`,
        dueDate: '2026-10-11', // vence hoje
        outstandingInCents: outstandingToday,
      },
      {
        id: invoiceTomorrow.id,
        cardName: `Cartão QA ${RUN}`,
        dueDate: '2026-10-12',
        outstandingInCents: outstandingTomorrow,
      },
    ],
    from: TODAY,
    days: 45,
  });

  const dayToday = forecast.days.find((day) => day.date === TODAY);
  const dayTomorrow = forecast.days.find((day) => day.date === '2026-10-12');
  const cardPurchaseItems = forecast.days.flatMap((day) =>
    day.items.filter(
      (item) => item.label === 'Compra cartão' || item.label === 'Compra cartão amanhã',
    ),
  );

  summary.forecast = {
    itensDeHoje: dayToday?.items.map((item) => ({ label: item.label, valor: item.amountInCents })),
    itensDeAmanha: dayTomorrow?.items.map((item) => ({
      label: item.label,
      valor: item.amountInCents,
    })),
    obrigacaoDeHojeEntrou: (dayToday?.items ?? []).some((item) =>
      item.label.startsWith('QA por-liquidar-hoje'),
    ),
    obrigacaoDeAmanhaEntrou: (dayTomorrow?.items ?? []).some((item) =>
      item.label.startsWith('QA por-liquidar-amanha'),
    ),
    faturaDeHojeEntrou: (dayToday?.items ?? []).some((item) => item.source === 'invoice'),
    faturaDeAmanhaEntrou: (dayTomorrow?.items ?? []).some((item) => item.source === 'invoice'),
    recorrenciaVencidaVirouHoje: (dayToday?.items ?? []).some(
      (item) => item.label === 'Renda vencida (não gerada)',
    ),
    comprasDeCartaoNaPrevisao: cardPurchaseItems.length,
    saldoInicial: forecast.startingBalanceInCents,
    saldoFinal: forecast.endingBalanceInCents,
  };

  console.log('[B9 previsão]', JSON.stringify(summary.forecast));

  // -------------------------------------------------------------------------
  // B10 — Regras (motor) com os dados do schema
  // -------------------------------------------------------------------------
  const ruleBase = {
    id: 'r1',
    name: 'Regra QA',
    priority: 10,
    kind: 'expense' as const,
    targetCategoryId: catFood.id,
  };
  const ruleTransaction = {
    id: 't1',
    kind: 'expense' as never,
    status: 'confirmed' as never,
    amountInCents: -1_000,
    date: '2026-10-06',
    description: 'Supermercado',
    accountId: account.id,
    categoryId: undefined,
    settled: true,
  };

  const alreadyCategorized = { ...ruleTransaction, categoryId: catFood.id };
  const ignored = { ...ruleTransaction, status: 'ignored' as never };

  summary.rules = {
    regraSemCondicoesCorresponde: shared.matchesRule(ruleTransaction, ruleBase),
    regraPorDescricaoCorresponde: shared.matchesRule(ruleTransaction, {
      ...ruleBase,
      descriptionContains: 'supermercado',
    }),
    regraInativaNaoChegaAoMotor: true, // static: `enabled` filtra-se em rules.ts:147 e rules-actions.ts:267
    /** O motor só categoriza se a transação vier sem categoria (filtro da camada). */
    transacaoJaCategorizadaNoMotor: shared.matchesRule(alreadyCategorized, {
      ...ruleBase,
      descriptionContains: 'supermercado',
    }),
    transacaoIgnoradaNoMotor: shared.matchesRule(ignored, {
      ...ruleBase,
      descriptionContains: 'supermercado',
    }),
    textoVazioAceitePeloSchemaDaAcao: true, // blankToNull (rules-actions.ts:36-42) converte '' em null
  };

  console.log('[B10 regras]', JSON.stringify(summary.rules));

  // -------------------------------------------------------------------------
  // C — Tempos reais com dados realistas (500 movimentos, 20 recorrências)
  // -------------------------------------------------------------------------
  const bulk: Array<ReturnType<typeof txRow>> = [];

  for (let index = 0; index < 480; index += 1) {
    const day = String((index % 28) + 1).padStart(2, '0');
    const month = index % 2 === 0 ? '10' : '09';
    bulk.push(
      txRow(
        `bulk-${index}`,
        `2026-${month}-${day}`,
        -1_000,
        index % 3 === 0 ? catFood.id : catOther.id,
        { settled: index % 4 !== 0 },
      ),
    );
  }

  await prisma.transaction.createMany({ data: bulk });

  const recurrenceRows = [];

  for (let index = 0; index < 20; index += 1) {
    recurrenceRows.push({
      userId,
      name: `Série QA ${index} ${RUN}`,
      kind: 'EXPENSE' as const,
      amountInCents: -1_500,
      frequency: (index % 3 === 0 ? 'WEEKLY' : index % 3 === 1 ? 'MONTHLY' : 'QUARTERLY') as never,
      interval: 1,
      dayOfMonth: null,
      startDate: new Date('2026-10-01T00:00:00.000Z'),
      nextRunDate: new Date('2026-11-01T00:00:00.000Z'),
      isActive: true,
      financialAccountId: account.id,
      categoryId: catFood.id,
    });
  }

  await prisma.recurrence.createMany({ data: recurrenceRows });

  const queryStart = performance.now();
  const heavyTransactions = await prisma.transaction.findMany({ where: { userId } });
  const heavyRecurrences = await prisma.recurrence.findMany({ where: { userId, isActive: true } });
  const queryMs = Math.round(performance.now() - queryStart);

  const heavyFinance = heavyTransactions.map((row) => ({
    id: row.id,
    kind: row.kind.toLowerCase() as never,
    status: row.status.toLowerCase() as never,
    amountInCents: row.amountInCents,
    date: row.date.toISOString().slice(0, 10),
    accountId: row.financialAccountId ?? '',
    categoryId: row.categoryId ?? undefined,
    invoiceId: row.invoiceId ?? undefined,
    settled: row.settled,
  }));

  const motorStart = performance.now();
  const heavyPeriod = shared.periodOf(TODAY, monthStartDay);
  const heavyForecast = shared.cashFlowForecast({
    accounts: financeAccounts,
    transactions: heavyFinance,
    recurrences: heavyRecurrences.map((row) => ({
      id: row.id,
      name: row.name,
      kind: row.kind === 'INCOME' ? ('income' as const) : ('expense' as const),
      amountInCents: row.amountInCents,
      frequency: toFrequency(row.frequency) as never,
      interval: row.interval,
      dayOfMonth: row.dayOfMonth ?? undefined,
      nextRunDate: row.nextRunDate.toISOString().slice(0, 10),
      endDate: row.endDate === null ? undefined : row.endDate.toISOString().slice(0, 10),
      isActive: row.isActive,
    })),
    unpaidInvoices: [],
    from: TODAY,
    days: 45,
  });
  const heavyDashboardResult = shared.monthlyResult(heavyFinance, heavyPeriod, {
    basis: 'accrual',
    categories: financeCategories,
    monthStartDay,
  });
  const heavySeries = shared.resultSeries(
    heavyFinance,
    shared.addMonths(heavyPeriod.start, -5),
    TODAY,
    {
      basis: 'accrual',
      categories: financeCategories,
      monthStartDay,
    },
  );
  const heavyReportCategories = shared.expenseByCategory(heavyFinance, heavyPeriod, {
    basis: 'accrual',
    categories: financeCategories,
    monthStartDay,
  });
  const motorMs = Math.round(performance.now() - motorStart);

  const pageTimings: Array<Record<string, unknown>> = [];

  for (const path of ['/', '/relatorios', '/orcamento']) {
    for (const pass of [1, 2]) {
      const response = await httpGet(path, cookie);

      pageTimings.push({
        path,
        pass,
        status: response.status,
        ms: response.ms,
        bytes: response.bytes,
        hash: response.sha256,
        sentinela1970: response.body.includes('1970'),
        ...(path === '/orcamento'
          ? {
              // O consumo do limite de Alimentação: 130,00 € (só até ao dia 4
              // exclusivo) ou 170,00 € (o mês inteiro)?
              mostra130: response.body.includes('130,00'),
              mostra170: response.body.includes('170,00'),
            }
          : {}),
      });
    }
  }

  summary.performance = {
    movimentos: heavyTransactions.length,
    recorrenciasAtivas: heavyRecurrences.length,
    queryMs,
    motorMs,
    forecastDias: heavyForecast.days.length,
    resultadoPesado: heavyDashboardResult.expenseInCents,
    seriesMeses: heavySeries.length,
    categoriasNoRelatorio: heavyReportCategories.size,
    paginas: pageTimings,
  };

  console.log('[C tempos]', JSON.stringify(summary.performance));

  // -------------------------------------------------------------------------
  // Limpeza
  // -------------------------------------------------------------------------
  const sweep = await prisma.user.findMany({
    where: { email: { startsWith: 'qa-' } },
    select: { id: true, email: true },
  });

  for (const entry of sweep) {
    if (!createdIds.includes(entry.id)) {
      createdIds.push(entry.id);
    }
  }

  for (const id of [...new Set(createdIds)]) {
    await prisma.transaction.deleteMany({ where: { userId: id } });
    await prisma.goalMovement.deleteMany({ where: { userId: id } });
    await prisma.goal.deleteMany({ where: { userId: id } });
    await prisma.recurrence.deleteMany({ where: { userId: id } });
    await prisma.transactionRule.deleteMany({ where: { userId: id } });
    await prisma.monthClose.deleteMany({ where: { userId: id } });
    await prisma.budgetLimit.deleteMany({ where: { userId: id } });
    await prisma.budget.deleteMany({ where: { userId: id } });
    await prisma.invoicePayment.deleteMany({ where: { userId: id } });
    await prisma.lockedBalance.deleteMany({ where: { userId: id } });
    await prisma.invoice.deleteMany({ where: { userId: id } });
    await prisma.creditCard.deleteMany({ where: { userId: id } });
    await prisma.category.deleteMany({ where: { userId: id } });
    await prisma.financialAccount.deleteMany({ where: { userId: id } });
    await prisma.session.deleteMany({ where: { userId: id } });
    await prisma.account.deleteMany({ where: { userId: id } });
    await prisma.user.deleteMany({ where: { id } });
  }

  const leftovers = await prisma.user.findMany({
    where: { email: { startsWith: 'qa-' } },
    select: { email: true },
  });
  const realAfter = await prisma.user.findUnique({
    where: { email: REAL_USER_EMAIL },
    select: { id: true },
  });
  const realCountsAfter =
    realAfter === null
      ? null
      : {
          categories: await prisma.category.count({ where: { userId: realAfter.id } }),
          accounts: await prisma.financialAccount.count({ where: { userId: realAfter.id } }),
          transactions: await prisma.transaction.count({ where: { userId: realAfter.id } }),
        };

  summary.cleanup = {
    utilizadoresApagados: [...new Set(createdIds)].length,
    emailsApagados: sweep.map((entry) => entry.email),
    usersLeftBehind: leftovers.map((entry) => entry.email),
    orfaos: {
      transactions: await prisma.transaction.count({ where: { userId: { in: createdIds } } }),
      goals: await prisma.goal.count({ where: { userId: { in: createdIds } } }),
      recurrences: await prisma.recurrence.count({ where: { userId: { in: createdIds } } }),
      budgets: await prisma.budget.count({ where: { userId: { in: createdIds } } }),
      categories: await prisma.category.count({ where: { userId: { in: createdIds } } }),
    },
    realUserUntouched: JSON.stringify(realCountsBefore) === JSON.stringify(realCountsAfter),
    realUserExists: realBefore !== null,
  };

  console.log('[limpeza]', JSON.stringify(summary.cleanup));
  console.log('RESULTADO_JSON_INICIO');
  console.log(JSON.stringify(summary, null, 2));
  console.log('RESULTADO_JSON_FIM');

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('FALHA NA VERIFICAÇÃO:', error);
  process.exitCode = 1;
});
