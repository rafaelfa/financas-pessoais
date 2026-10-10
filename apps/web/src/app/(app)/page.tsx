import {
  addDays,
  addMonths,
  budgetStatusList,
  expenseByCategory,
  goalOverview,
  monthlyResult,
  netWorth,
  periodOf,
  resultSeries,
} from '@repo/shared';
import { CalendarClock, PiggyBank, Scale, Target } from 'lucide-react';
import Link from 'next/link';

import { Amount } from '@/components/amount';
import { CashflowChart, type CashflowPoint } from '@/components/cashflow-chart';
import { CategoryDonut, type DonutSlice } from '@/components/category-donut';
import { ChartCard } from '@/components/chart-card';
import { EmptyState } from '@/components/empty-state';
import { KpiCard } from '@/components/kpi-card';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { buildDemoData, demoCategoryName } from '@/lib/demo-data';
import { todayInLisbon } from '@/lib/today';

/** Rótulo curto de um mês a partir de `YYYY-MM`. */
function shortMonth(key: string): string {
  const [year, month] = key.split('-').map(Number) as [number, number];

  return new Intl.DateTimeFormat('pt-PT', { month: 'short' }).format(
    new Date(Date.UTC(year, month - 1, 15)),
  );
}

export default async function PainelPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ demo?: string }>;
}) {
  const params = await searchParams;
  const withDemoData = params.demo !== '0';
  const today = todayInLisbon();

  const data = withDemoData
    ? buildDemoData(today)
    : {
        categories: [],
        accounts: [],
        transactions: [],
        budgetLimits: [],
        goals: [],
        goalMovements: [],
        invoiceId: '',
      };

  const period = periodOf(today);
  const cash = monthlyResult(data.transactions, period, {
    basis: 'cash',
    categories: data.categories,
  });
  const accrual = monthlyResult(data.transactions, period, {
    basis: 'accrual',
    categories: data.categories,
  });
  const patrimony = netWorth({
    accounts: data.accounts,
    transactions: data.transactions,
    goals: data.goals,
    goalMovements: data.goalMovements,
    upTo: today,
  });
  const budgets = budgetStatusList({
    limits: data.budgetLimits,
    transactions: data.transactions,
    period,
    referenceDate: today,
    resultOptions: { categories: data.categories },
  });
  const goals = goalOverview({ goals: data.goals, movements: data.goalMovements, today });

  const series = resultSeries(data.transactions, addMonths(period.start, -5), today, {
    basis: 'cash',
    categories: data.categories,
  });
  const cashflow: CashflowPoint[] = series.map((item) => ({
    mes: shortMonth(item.period.key),
    entradas: item.incomeInCents / 100,
    saidas: item.expenseInCents / 100,
  }));

  const expenses = expenseByCategory(data.transactions, period, {
    basis: 'accrual',
    categories: data.categories,
  });
  const donut: DonutSlice[] = [...expenses.entries()]
    .map(([categoryId, amountInCents]) => ({
      categoria: demoCategoryName(categoryId),
      valor: amountInCents / 100,
    }))
    .sort((a, b) => b.valor - a.valor);

  const upcoming = data.transactions
    .filter((transaction) => !transaction.settled && transaction.date >= today)
    .filter((transaction) => transaction.date <= addDays(today, 7))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(0, 5);

  const hasMovements = data.transactions.length > 0;

  return (
    <>
      <PageHeader
        title="Painel"
        description="Onde está o teu dinheiro este mês, o que falta pagar e como estão os objetivos."
        actions={
          <Button asChild size="sm">
            <Link href="/transacoes">Registar um lançamento</Link>
          </Button>
        }
      />

      {withDemoData ? (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Badge variant="secondary" className="mt-0.5 shrink-0">
              Dados de exemplo
            </Badge>
            <p className="text-sm">
              Estes números são inventados, para avaliares o aspeto da aplicação. A ligação às tuas
              contas verdadeiras entra na fase seguinte do plano.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link href="/?demo=0">Ver sem dados</Link>
          </Button>
        </div>
      ) : (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-dashed px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Ainda não há dados ligados. Podes voltar a ver a demonstração.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/">Ver com dados de exemplo</Link>
          </Button>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Património líquido"
          icon={Scale}
          hint="Contas, objetivos e bens menos dívidas"
        >
          <Amount amountInCents={patrimony.netInCents} />
        </KpiCard>
        <KpiCard
          label="Entradas do mês"
          icon={PiggyBank}
          hint={`Por competência: ${new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(accrual.incomeInCents / 100)}`}
        >
          <Amount amountInCents={cash.incomeInCents} tone="income" />
        </KpiCard>
        <KpiCard
          label="Saídas do mês"
          icon={Target}
          hint={`Por competência: ${new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(accrual.expenseInCents / 100)}`}
        >
          <Amount amountInCents={cash.expenseInCents} tone="expense" />
        </KpiCard>
        <KpiCard
          label="Sobra do mês"
          icon={CalendarClock}
          hint="Entradas menos saídas, em visão de caixa"
        >
          <Amount amountInCents={cash.netInCents} withSign />
        </KpiCard>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-5">
        <ChartCard
          title="Fluxo dos últimos 6 meses"
          description="Entradas e saídas em visão de caixa, mês a mês."
          isEmpty={!hasMovements}
          className="lg:col-span-3"
        >
          <CashflowChart data={cashflow} />
        </ChartCard>

        <ChartCard
          title="Despesas por categoria"
          description="O mês atual, por competência."
          isEmpty={donut.length === 0}
          className="lg:col-span-2"
        >
          <CategoryDonut data={donut} />
        </ChartCard>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Orçamento do mês</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {budgets.length === 0 ? (
              <EmptyState
                icon={PiggyBank}
                title="Ainda não definiste limites"
                description="Define um limite por categoria para saberes, a meio do mês, se ainda vais a tempo."
              />
            ) : (
              budgets.map((budget) => (
                <div key={budget.categoryId} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium">{demoCategoryName(budget.categoryId)}</span>
                    <span className="text-muted-foreground tabular-nums">
                      <Amount amountInCents={budget.spentInCents} tone="neutral" /> de{' '}
                      <Amount amountInCents={budget.limitInCents} tone="neutral" />
                    </span>
                  </div>
                  <Progress
                    value={Math.min(100, budget.usedPct)}
                    aria-label={`${demoCategoryName(budget.categoryId)}: ${budget.usedPct}% do limite`}
                  />
                  <p className="text-xs text-muted-foreground">
                    {budget.state === 'exceeded'
                      ? `Excedido em ${budget.usedPct - 100 > 0 ? budget.usedPct - 100 : 0}%`
                      : budget.state === 'warning'
                        ? `Atenção: ${budget.usedPct}% do limite`
                        : `${budget.usedPct}% do limite`}
                    {budget.projectedSpentInCents > budget.limitInCents
                      ? ' · ao ritmo atual vais passar do limite'
                      : ''}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Objetivos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {goals.goals.length === 0 ? (
              <EmptyState
                icon={Target}
                title="Sem objetivos definidos"
                description="Um objetivo transforma uma intenção numa data: quanto, até quando e quanto por mês."
              />
            ) : (
              goals.goals.map((goal) => (
                <div key={goal.goalId} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium">
                      {goal.goalId === 'goal-ferias' ? 'Férias' : 'Fundo de emergência'}
                    </span>
                    <span className="text-muted-foreground tabular-nums">{goal.progressPct}%</span>
                  </div>
                  <Progress value={Math.min(100, goal.progressPct)} />
                  <p className="text-xs text-muted-foreground">
                    Faltam <Amount amountInCents={goal.remainingInCents} tone="neutral" />
                    {goal.requiredPerPeriodInCents > 0
                      ? ` · guarda ${new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(goal.requiredPerPeriodInCents / 100)} por mês`
                      : ' · objetivo cumprido'}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <section className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Próximos 7 dias</CardTitle>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <EmptyState
                icon={CalendarClock}
                title="Nada por pagar nos próximos 7 dias"
                description="Contas a pagar, faturas a vencer e lançamentos agendados aparecem aqui."
              />
            ) : (
              <ul className="divide-y">
                {upcoming.map((transaction) => (
                  <li
                    key={transaction.id}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm"
                  >
                    <span className="flex flex-col">
                      <span className="font-medium">{transaction.description}</span>
                      <span className="text-xs text-muted-foreground">
                        {transaction.date} · {demoCategoryName(transaction.categoryId ?? '')}
                      </span>
                    </span>
                    <Amount amountInCents={transaction.amountInCents} withSign />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </>
  );
}
