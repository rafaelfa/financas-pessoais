import { prisma } from '@repo/db/client';
import {
  accountBalanceInCents,
  addDays,
  addMonths,
  cashFlowForecast,
  expenseByCategory,
  monthlyResult,
  netWorth,
  periodOf,
  resultSeries,
  toRecurrenceFrequency,
  type InvoiceStatus,
} from '@repo/shared';

import { todayInLisbon } from '@/lib/today';

import { TRANSACTION_SELECT } from './accounts';
import {
  dashboardViewFromParam,
  resolveDashboardScope,
  type DashboardScope,
  type DashboardScopeChoices,
} from './dashboard-scope';
import { loadInvoiceContext } from './invoice-context';
import {
  toFinanceAccount,
  toFinanceCategory,
  toFinanceInvoice,
  toFinancePayment,
  toFinanceTransaction,
} from './mapping';
import { requireUser } from './session';

export type { DashboardScope, DashboardView } from './dashboard-scope';

/**
 * Dados do painel.
 *
 * Uma consulta só, e todos os números calculados pelo **mesmo** motor que o
 * resto da aplicação usa. Se o painel fizesse as suas próprias somas, os totais
 * acabariam por divergir do extrato — e é isso que faz perder a confiança numa
 * aplicação de finanças.
 *
 * Com um âmbito escolhido (uma conta ou um cartão), as **mesmas** funções do
 * motor correm sobre um subconjunto de lançamentos, em vez de existir uma conta
 * paralela para cada vista. O que resta é o que faz sentido só na carteira toda
 * — a previsão de saldo e o fecho do mês — e `cardView` diz à interface que os
 * dois regimes se leem ao contrário num cartão.
 */

/** Fatura de um cartão, resumida para o painel. */
export interface DashboardScopeInvoice {
  readonly id: string;
  readonly status: InvoiceStatus;
  readonly closingDate: string;
  readonly dueDate: string;
  readonly totalInCents: number;
  readonly outstandingInCents: number;
  readonly purchaseCount: number;
}

/** O cartão escolhido, com a fatura em curso e o limite disponível. */
export interface DashboardScopeCard {
  readonly id: string;
  readonly name: string;
  readonly brand: string;
  readonly creditLimitInCents: number | null;
  readonly availableLimitInCents: number | null;
  readonly outstandingInCents: number;
  readonly nextDueDate: string | null;
  readonly openInvoice: DashboardScopeInvoice | null;
}

export interface DashboardData {
  readonly patrimonyInCents: number;
  /**
   * Saldo da conta escolhida à data de hoje, ou `null`.
   *
   * Só existe no âmbito de conta: um cartão não guarda dinheiro, tem dívida, e
   * no âmbito unificado o número da carteira é o património. `null` faz a
   * interface mostrar «—» em vez de inventar um zero.
   */
  readonly balanceInCents: number | null;
  /** Âmbito efetivo: os números abaixo estão calculados sobre ele. */
  readonly scope: DashboardScope;
  /** Contas e cartões que o seletor pode oferecer — só os do utilizador. */
  readonly scopeChoices: DashboardScopeChoices;
  /**
   * `true` quando o âmbito é um **cartão**.
   *
   * Num cartão só há dívida a nascer (a compra) e nada a ser liquidado por ele:
   * a conta que paga a fatura é a conta, não o cartão. Por isso a leitura
   * natural inverte-se — competência em primeiro, caixa («já liquidado») como
   * nota — e a interface precisa de saber isso para não trocar as legendas.
   */
  readonly cardView: boolean;
  /** Detalhe do cartão escolhido: a fatura em aberto é o que interessa ver. */
  readonly card: DashboardScopeCard | null;
  readonly cash: {
    readonly incomeInCents: number;
    readonly expenseInCents: number;
    readonly netInCents: number;
  };
  readonly accrual: {
    readonly incomeInCents: number;
    readonly expenseInCents: number;
    readonly netInCents: number;
  };
  readonly series: ReadonlyArray<{
    readonly key: string;
    readonly incomeInCents: number;
    readonly expenseInCents: number;
  }>;
  readonly expensesByCategory: ReadonlyArray<{
    readonly categoryId: string;
    readonly name: string;
    readonly amountInCents: number;
  }>;
  readonly upcoming: ReadonlyArray<{
    readonly id: string;
    readonly date: string;
    readonly description: string;
    readonly amountInCents: number;
    readonly categoryName: string | null;
  }>;
  readonly lastTransactionDate: string | null;
  readonly hasData: boolean;
  /**
   * Previsão de saldo para os próximos 45 dias.
   *
   * Inclui os **itens** de cada dia (recorrências e faturas), para a interface
   * poder dizer *o que* muda o saldo — «Renda · −800,00 €» — e não apenas quanto.
   * `firstNegativeDate` é a data em que fica negativo, que pode não ser a do
   * ponto mais baixo: o que interessa avisar é o primeiro dia em que não há
   * dinheiro suficiente, não o pior dia.
   */
  readonly forecast: {
    readonly days: ReadonlyArray<{
      readonly date: string;
      readonly balanceInCents: number;
      readonly items: ReadonlyArray<{ label: string; amountInCents: number }>;
    }>;
    readonly lowestBalanceInCents: number;
    readonly lowestDate: string | null;
    readonly goesNegative: boolean;
    readonly firstNegativeDate: string | null;
  };
}

/**
 * Reúne tudo o que o painel mostra, num único passo.
 *
 * `scopeParams` são os parâmetros do URL (`vista` e `id`); sem eles, o painel é
 * a carteira toda, como sempre foi. Um `id` que não seja do utilizador **não**
 * chega ao motor: cai no âmbito unificado com uma nota.
 */
export async function getDashboard(scopeParams?: {
  readonly view?: string;
  readonly id?: string;
}): Promise<DashboardData> {
  const user = await requireUser();
  const today = todayInLisbon();
  const period = periodOf(today, user.monthStartDay);
  const requestedView = dashboardViewFromParam(scopeParams?.view);
  const requestedId = scopeParams?.id ?? null;

  const [
    accounts,
    transactions,
    categories,
    lastTransaction,
    recurrences,
    invoiceContext,
    assets,
    liabilities,
    invoices,
    invoicePayments,
    goals,
    goalMovements,
  ] = await Promise.all([
    prisma.financialAccount.findMany({ where: { userId: user.id } }),
    prisma.transaction.findMany({ where: { userId: user.id }, select: TRANSACTION_SELECT }),
    prisma.category.findMany({
      where: { userId: user.id, archivedAt: null },
      select: { id: true, name: true, kind: true, parentId: true, isInternal: true },
    }),
    prisma.transaction.findFirst({
      where: { userId: user.id },
      orderBy: { date: 'desc' },
      select: { date: true },
    }),
    prisma.recurrence.findMany({ where: { userId: user.id, isActive: true } }),
    loadInvoiceContext(user.id, today),
    /*
     * Bens e dívidas entram no património líquido. Sem estas duas consultas o
     * `netWorth` recebia `undefined` e o número do Painel era, na prática, só
     * contas menos cartões — mesmo com a fórmula correta do lado do motor.
     */
    prisma.asset.findMany({
      where: { userId: user.id, archivedAt: null },
      select: { id: true, valueInCents: true },
    }),
    prisma.liability.findMany({
      where: { userId: user.id, archivedAt: null },
      select: { id: true, outstandingInCents: true },
    }),
    /*
     * As duas parcelas que faltavam ao património: faturas de cartão (passivo) e
     * valor acumulado nos objetivos (ativo). O motor já as sabe somar; o Painel
     * é que não lhas dava.
     */
    prisma.invoice.findMany({ where: { userId: user.id } }),
    prisma.invoicePayment.findMany({ where: { userId: user.id } }),
    prisma.goal.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        targetAmountInCents: true,
        initialReservedInCents: true,
        targetDate: true,
        contributionFrequency: true,
      },
    }),
    /*
     * `date` é `@db.Date`: a comparação é de calendário, não de instante. O motor
     * voltaria a descartar o que passa de `today`, mas os dados não precisam de
     * viajar para serem ignorados.
     */
    prisma.goalMovement.findMany({
      where: { userId: user.id, date: { lte: new Date(today) } },
      select: { goalId: true, type: true, amountInCents: true, date: true },
    }),
  ]);

  const financeAccounts = accounts.map(toFinanceAccount);
  const financeTransactions = transactions.map(toFinanceTransaction);
  const financeCategories = categories.map(toFinanceCategory);
  const options = { categories: financeCategories, monthStartDay: user.monthStartDay };

  /*
   * O âmbito é resolvido **depois** de a base responder, e contra listas que já
   * vêm filtradas por utilizador. É por isso que um id alheio não revela nada:
   * não é encontrado na lista dele, logo não há consulta nenhuma que o mencione,
   * nem 404 nem 500 — o painel responde com a carteira toda e diz porquê.
   */
  const scopeChoices: DashboardScopeChoices = {
    accounts: accounts.map((account) => ({ id: account.id, name: account.name })),
    cards: invoiceContext.cards.map((card) => ({ id: card.id, name: card.name })),
  };
  const scope = resolveDashboardScope({
    view: requestedView,
    id: requestedId,
    choices: scopeChoices,
  });

  /*
   * Os números por âmbito saem do **mesmo motor**, sobre um subconjunto de
   * lançamentos. Um cartão agrega pelo `cardId` do próprio lançamento (é o
   * cartão que o utilizador escolheu, mesmo quando o movimento ainda não caiu em
   * fatura nenhuma); o pagamento da fatura fica de fora de propósito, porque
   * essa saída é da conta que paga, não uma despesa do cartão.
   */
  const scopeWhere =
    scope.id === null
      ? null
      : scope.kind === 'conta'
        ? { financialAccountId: scope.id }
        : { cardId: scope.id };

  const scopedTransactions =
    scopeWhere === null
      ? transactions
      : await prisma.transaction.findMany({
          where: { userId: user.id, ...scopeWhere },
          select: TRANSACTION_SELECT,
        });
  const scopedFinanceTransactions = scopedTransactions.map(toFinanceTransaction);

  const cash = monthlyResult(scopedFinanceTransactions, period, { ...options, basis: 'cash' });
  const accrual = monthlyResult(scopedFinanceTransactions, period, {
    ...options,
    basis: 'accrual',
  });
  const patrimony = netWorth({
    accounts: financeAccounts,
    transactions: financeTransactions,
    assets,
    liabilities,
    invoices: invoices.map(toFinanceInvoice),
    invoicePayments: invoicePayments.map(toFinancePayment),
    goals: goals.map((goal) => ({
      id: goal.id,
      targetAmountInCents: goal.targetAmountInCents,
      initialReservedInCents: goal.initialReservedInCents,
      targetDate: goal.targetDate.toISOString().slice(0, 10),
      contributionFrequency: toRecurrenceFrequency(goal.contributionFrequency),
    })),
    goalMovements: goalMovements.map((movement) => ({
      goalId: movement.goalId,
      type: movement.type === 'WITHDRAWAL' ? 'withdrawal' : 'deposit',
      amountInCents: movement.amountInCents,
      date: movement.date.toISOString().slice(0, 10),
    })),
    upTo: today,
  });

  /*
   * O saldo da conta escolhida sai do motor de saldos, com as mesmas regras do
   * ecrã das contas (só o que está liquidado move o saldo) e não de uma soma
   * escrita aqui.
   */
  const scopedAccount =
    scope.kind === 'conta' && scope.id !== null
      ? financeAccounts.find((account) => account.id === scope.id)
      : undefined;
  const scopedAccountBalance =
    scopedAccount === undefined
      ? null
      : accountBalanceInCents(scopedAccount, financeTransactions, { upTo: today });

  /*
   * Previsão de saldo: o painel mostrava o presente e não avisava do futuro.
   * Entra só o que já está contratado — as ocorrências futuras das recorrências
   * ativas (pelas mesmas datas que o gerador vai usar) e as faturas por pagar no
   * dia do vencimento. Gastos variáveis não se preveem. É sempre da carteira
   * toda: prever o saldo de um cartão — que não guarda dinheiro — não diria nada.
   */
  const forecast = cashFlowForecast({
    accounts: financeAccounts,
    transactions: financeTransactions,
    recurrences: recurrences.map((recurrence) => ({
      id: recurrence.id,
      name: recurrence.name,
      kind: recurrence.kind === 'INCOME' ? ('income' as const) : ('expense' as const),
      amountInCents: recurrence.amountInCents,
      // A conversão vive no motor: uma frequência que ele não sabe cumprir falha
      // alto em vez de aparecer como mensal na previsão (12× as ocorrências).
      frequency: toRecurrenceFrequency(recurrence.frequency),
      interval: recurrence.interval,
      dayOfMonth: recurrence.dayOfMonth ?? undefined,
      nextRunDate: recurrence.nextRunDate.toISOString().slice(0, 10),
      endDate:
        recurrence.endDate === null ? undefined : recurrence.endDate.toISOString().slice(0, 10),
      isActive: recurrence.isActive,
    })),
    unpaidInvoices: invoiceContext.summaries
      .filter((invoice) => invoice.outstandingInCents > 0)
      .map((invoice) => ({
        id: invoice.id,
        cardName: invoice.cardName,
        dueDate: invoice.dueDate,
        outstandingInCents: invoice.outstandingInCents,
      })),
    from: today,
    days: 45,
  });
  const series = resultSeries(scopedFinanceTransactions, addMonths(period.start, -5), today, {
    ...options,
    basis: user.accountingBasis,
  });
  const expenses = expenseByCategory(scopedFinanceTransactions, period, {
    ...options,
    basis: 'accrual',
  });

  const nameById = new Map(categories.map((category) => [category.id, category.name]));

  const expensesByCategory = [...expenses.entries()]
    .map(([categoryId, amountInCents]) => ({
      categoryId,
      name: nameById.get(categoryId) ?? 'Sem categoria',
      amountInCents,
    }))
    .sort((a, b) => b.amountInCents - a.amountInCents);

  const upcoming = scopedFinanceTransactions
    .filter((transaction) => !transaction.settled && transaction.date >= today)
    .filter((transaction) => transaction.date <= addDays(today, 7))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(0, 5)
    .map((transaction) => ({
      id: transaction.id,
      date: transaction.date,
      description: transaction.description ?? 'Sem descrição',
      amountInCents: transaction.amountInCents,
      categoryName:
        transaction.categoryId !== undefined
          ? (nameById.get(transaction.categoryId) ?? null)
          : null,
    }));

  return {
    patrimonyInCents: patrimony.netInCents,
    balanceInCents: scopedAccountBalance,
    scope,
    scopeChoices,
    cardView: scope.kind === 'cartao',
    card:
      scope.kind === 'cartao' && scope.id !== null
        ? buildScopedCard(invoiceContext, scope.id)
        : null,
    cash: {
      incomeInCents: cash.incomeInCents,
      expenseInCents: cash.expenseInCents,
      netInCents: cash.netInCents,
    },
    accrual: {
      incomeInCents: accrual.incomeInCents,
      expenseInCents: accrual.expenseInCents,
      netInCents: accrual.netInCents,
    },
    series: series.map((item) => ({
      key: item.period.key,
      incomeInCents: item.incomeInCents,
      expenseInCents: item.expenseInCents,
    })),
    expensesByCategory,
    upcoming,
    forecast: {
      days: forecast.days.map((day) => ({
        date: day.date,
        balanceInCents: day.balanceInCents,
        items: day.items.map((item) => ({
          label: item.label,
          amountInCents: item.amountInCents,
        })),
      })),
      lowestBalanceInCents: forecast.lowestBalanceInCents,
      lowestDate: forecast.lowestDate,
      goesNegative: forecast.goesNegative,
      firstNegativeDate: forecast.firstNegativeDate,
    },
    lastTransactionDate: lastTransaction?.date.toISOString().slice(0, 10) ?? null,
    hasData: transactions.length > 0,
  };
}

/**
 * Cartão escolhido, a partir do contexto de faturas já carregado.
 *
 * A fatura em aberto é a que está a acumular compras; quando o ciclo fechou sem
 * fatura aberta, mostra-se a última emitida, que é a que tem valor por pagar. A
 * mesma escolha que o ecrã dos cartões faz — a diferença é que aqui não se
 * repetem as contas: os totais vêm dos resumos que a cadeia de faturas produziu.
 */
function buildScopedCard(
  context: Awaited<ReturnType<typeof loadInvoiceContext>>,
  cardId: string,
): DashboardScopeCard | null {
  const card = context.cards.find((candidate) => candidate.id === cardId);

  if (card === undefined) {
    return null;
  }

  const invoices = context.byCard.get(cardId) ?? [];
  const outstandingInCents = invoices[invoices.length - 1]?.outstandingInCents ?? 0;
  const openInvoice =
    [...invoices].reverse().find((invoice) => invoice.status === 'open') ??
    invoices[invoices.length - 1] ??
    null;
  const nextDue = invoices.find((invoice) => invoice.outstandingInCents > 0) ?? openInvoice;

  return {
    id: card.id,
    name: card.name,
    brand: card.brand,
    creditLimitInCents: card.creditLimitInCents,
    availableLimitInCents:
      card.creditLimitInCents === null
        ? card.availableLimitInCents
        : Math.max(0, card.creditLimitInCents - outstandingInCents),
    outstandingInCents,
    nextDueDate: nextDue?.dueDate ?? null,
    openInvoice:
      openInvoice === null
        ? null
        : {
            id: openInvoice.id,
            status: openInvoice.status,
            closingDate: openInvoice.closingDate,
            dueDate: openInvoice.dueDate,
            totalInCents: openInvoice.totalInCents,
            outstandingInCents: openInvoice.outstandingInCents,
            purchaseCount: openInvoice.purchaseCount,
          },
  };
}
