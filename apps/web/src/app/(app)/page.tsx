import { CalendarClock } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Amount } from '@/components/amount';
import { CashflowChart, type CashflowPoint } from '@/components/cashflow-chart';
import { CategoryDonut, type DonutSlice } from '@/components/category-donut';
import { ChartCard } from '@/components/chart-card';
import { DashboardForecast } from '@/components/dashboard-forecast';
import { DashboardForecastAlert } from '@/components/dashboard-forecast-alert';
import { EmptyState } from '@/components/empty-state';
import { KpiCard } from '@/components/kpi-card';
import { MonthCloseChecklist } from '@/components/month-close-checklist';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getDashboard } from '@/server/dashboard';
import { getMonthClose } from '@/server/month-close';

export const metadata: Metadata = { title: 'Painel' };

/** Rótulo curto de um mês a partir de `YYYY-MM`. */
function shortMonth(key: string): string {
  const [year, month] = key.split('-').map(Number) as [number, number];

  return new Intl.DateTimeFormat('pt-PT', { month: 'short' }).format(
    new Date(Date.UTC(year, month - 1, 15)),
  );
}

/**
 * Data de calendário em formato português, sem deslocação de fuso.
 *
 * O domínio usa datas `YYYY-MM-DD` sem hora; formatá-las com o fuso de Lisboa
 * mostraria o dia anterior às 23h. O `UTC` explícito evita isso.
 */
function formatDay(date: string): string {
  return new Intl.DateTimeFormat('pt-PT', { timeZone: 'UTC', dateStyle: 'short' }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

const euro = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' });

/**
 * Painel.
 *
 * A ordem dos blocos é uma decisão de produto, não de estética: **primeiro o que
 * pode correr mal**. Se a previsão diz que o saldo fica negativo antes do próximo
 * ordenado, esse aviso é a primeira coisa que o utilizador vê — com a data e o
 * valor. A seguir vem o presente (património, entradas e saídas do mês), depois o
 * que aí vem (previsão de saldo e próximos dias) e, no fim, o fecho do mês.
 */
export default async function PainelPage() {
  /*
   * As duas consultas arrancam juntas e só depois se espera por elas, pela ordem
   * em que são usadas: o painel não paga duas idas à base de dados em série.
   */
  const dashboardPromise = getDashboard();
  const monthClosePromise = getMonthClose();

  const data = await dashboardPromise;
  const monthClose = await monthClosePromise;

  const cashflow: CashflowPoint[] = data.series.map((item) => ({
    mes: shortMonth(item.key),
    entradas: item.incomeInCents / 100,
    saidas: item.expenseInCents / 100,
  }));

  const donut: DonutSlice[] = data.expensesByCategory.map((item) => ({
    categoria: item.name,
    valor: item.amountInCents / 100,
  }));

  if (!data.hasData) {
    return (
      <>
        <PageHeader
          title="Painel"
          description="Onde está o teu dinheiro este mês e o que aí vem nos próximos dias."
        />
        <EmptyState
          icon={CalendarClock}
          title="Ainda não há nada para mostrar"
          description="Começa por criar uma conta e registar os primeiros movimentos. A partir daí este painel mostra o teu património, o que entrou e saiu no mês, a previsão de saldo e o que falta conferir para fechar o mês."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild size="sm">
                <Link href="/contas">Criar a primeira conta</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/transacoes">Registar um lançamento</Link>
              </Button>
            </div>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Painel"
        description="Onde está o teu dinheiro este mês e o que aí vem nos próximos dias."
        actions={
          <Button asChild size="sm">
            <Link href="/transacoes">Registar um lançamento</Link>
          </Button>
        }
      />

      {/* Primeiro o que pode correr mal: o saldo a ficar negativo. */}
      <DashboardForecastAlert forecast={data.forecast} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Património líquido" hint="Saldos das contas ativas">
          <Amount amountInCents={data.patrimonyInCents} />
        </KpiCard>
        <KpiCard
          label="Entradas do mês"
          hint={`Por competência: ${euro.format(data.accrual.incomeInCents / 100)}`}
        >
          <Amount amountInCents={data.cash.incomeInCents} tone="income" />
        </KpiCard>
        <KpiCard
          label="Saídas do mês"
          hint={`Por competência: ${euro.format(data.accrual.expenseInCents / 100)}`}
        >
          <Amount amountInCents={data.cash.expenseInCents} tone="expense" />
        </KpiCard>
        <KpiCard label="Sobra do mês" hint="Entradas menos saídas, em visão de caixa">
          <Amount amountInCents={data.cash.netInCents} withSign />
        </KpiCard>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-5">
        <DashboardForecast forecast={data.forecast} className="xl:col-span-3" />

        <div className="xl:col-span-2">
          <MonthCloseChecklist monthClose={monthClose} />
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-5">
        <ChartCard
          title="Fluxo dos últimos 6 meses"
          description="Entradas e saídas, mês a mês, no regime que escolheste."
          isEmpty={data.series.every(
            (item) => item.incomeInCents === 0 && item.expenseInCents === 0,
          )}
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

      <section className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Próximos 7 dias</CardTitle>
          </CardHeader>
          <CardContent>
            {data.upcoming.length === 0 ? (
              <EmptyState
                icon={CalendarClock}
                title="Nada por pagar nos próximos 7 dias"
                description="Os lançamentos por liquidar com data próxima aparecem aqui, para não haver surpresas. É o detalhe do que a previsão de saldo conta por dia."
              />
            ) : (
              <ul className="divide-y">
                {data.upcoming.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm"
                  >
                    <span className="flex flex-col">
                      <span className="font-medium">{item.description}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDay(item.date)}
                        {item.categoryName !== null ? ` · ${item.categoryName}` : ''}
                      </span>
                    </span>
                    <Amount amountInCents={item.amountInCents} withSign />
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
