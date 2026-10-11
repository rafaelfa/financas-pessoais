import { CalendarClock, Info } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Amount } from '@/components/amount';
import { CashflowChart, type CashflowPoint } from '@/components/cashflow-chart';
import { CategoryDonut, type DonutSlice } from '@/components/category-donut';
import { ChartCard } from '@/components/chart-card';
import { DashboardForecast } from '@/components/dashboard-forecast';
import { DashboardForecastAlert } from '@/components/dashboard-forecast-alert';
import { DashboardScopeSwitch } from '@/components/dashboard-scope-switch';
import { EmptyState } from '@/components/empty-state';
import { InvoiceStatusBadge, INVOICE_STATUS_LABELS } from '@/components/invoice-status';
import { KpiCard } from '@/components/kpi-card';
import { MonthCloseChecklist } from '@/components/month-close-checklist';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getDashboard, type DashboardData } from '@/server/dashboard';
import { getMonthClose } from '@/server/month-close';

export const metadata: Metadata = { title: 'Painel' };

type SearchParams = Record<string, string | string[] | undefined>;

/** Um parâmetro de URL só conta quando é exatamente um valor não vazio. */
function stringParam(value: string | string[] | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed === '' ? undefined : trimmed;
}

/** Título do painel, muda conforme o âmbito ativo. */
  function pageTitle(): string {
    if (hasScope && scopeName) {
      return `Painel — ${scopeName}`;
    }
    return 'Painel';
  }

  /** Área de KPIs principais — sempre visível, com rótulo adaptativo. */
  function KpiSection() {
    return (
      <section
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6"
        aria-label="Indicadores principais"
      >
        <KpiCard label={firstKpiLabel()} hint={firstKpiHint()}>
          {isCardScope ? (
            <Amount amountInCents={card?.outstandingInCents ?? 0} tone="expense" />
          ) : data.balanceInCents !== null ? (
            <Amount amountInCents={data.balanceInCents} />
          ) : (
            <Amount amountInCents={data.patrimonyInCents} />
          )}
        </KpiCard>

        <KpiCard
          label={accrualFirst ? 'Compras do mês' : 'Entradas do mês'}
          hint={
            accrualFirst
              ? 'Por competência: contam na data da compra, e não quando a fatura é paga.'
              : `Por competência: ${euro.format(data.accrual.incomeInCents / 100)}`
          }
        >
          {accrualFirst ? (
            <Amount amountInCents={data.accrual.expenseInCents} tone="expense" />
          ) : (
            <Amount amountInCents={data.cash.incomeInCents} tone="income" />
          )}
        </KpiCard>

        <KpiCard
          label={accrualFirst ? 'Já liquidado' : 'Saídas do mês'}
          hint={
            accrualFirst
              ? 'Só o que foi marcado como pago; uma compra a crédito liquida-se quando pagas a fatura.'
              : `Por competência: ${euro.format(data.accrual.expenseInCents / 100)}`
          }
        >
          <Amount amountInCents={data.cash.expenseInCents} tone="expense" />
        </KpiCard>

        <KpiCard label="Sobra do mês" hint={accrualFirst ? 'Visão de competência' : 'Entradas menos saídas, em caixa'}>
          <Amount
            amountInCents={accrualFirst ? data.accrual.netInCents : data.cash.netInCents}
            withSign
          />
        </KpiCard>
      </section>
    );
  }

  /** Texto de contexto que explica qual o âmbito ativo. */
  function scopeContext(): string | null {
    if (!hasScope) return null;
    if (isCardScope) {
      return `Apreensivo ao cartão ${scopedLabel ?? ''}: o que foi comprado com ele e a fatura em aberto. O resto da carteira não entra nestas contas.`;
    }
    if (isAccountScope) {
      return `Apreensivo à conta ${scopedLabel ?? ''}: o saldo dela e só o que por lá passou. O resto da carteira não entra nestas contas.`;
    }
    return null;
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

/** Identificador do aviso de âmbito recusado, ligado à secção que ele explica. */
const SCOPE_NOTICE_ID = 'painel-ambito-aviso';

/**
 * Painel.
 *
 * A ordem dos blocos é uma decisão de produto, não de estética: **primeiro o que
 * pode correr mal**. Se a previsão diz que o saldo fica negativo antes do próximo
 * ordenado, esse aviso é a primeira coisa que o utilizador vê — com a data e o
 * valor. A seguir vem o presente (património, entradas e saídas do mês), depois o
 * que aí vem (previsão de saldo e próximos dias) e, no fim, o fecho do mês.
 *
 * Desde a vista por âmbito, o painel pode mostrar a carteira toda, uma conta ou
 * um cartão. **A vista vive no URL** (`?vista=conta&id=<uuid>`), é o servidor
 * que a valida e é `getDashboard` que devolve os números já calculados para esse
 * âmbito: a interface não soma nada. O que não faz sentido por âmbito — a
 * previsão de saldo e o fecho do mês, que são da carteira toda — continua
 * visível e di-lo por palavras, em vez de desaparecer sem explicação.
 */
export default async function PainelPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  /*
   * As duas consultas arrancam juntas e só depois se espera por elas, pela ordem
   * em que são usadas: o painel não paga duas idas à base de dados em série.
   */
  const dashboardPromise = getDashboard({
    view: stringParam(params.vista),
    id: stringParam(params.id),
  });
  const monthClosePromise = getMonthClose();

  const data = await dashboardPromise;
  const monthClose = await monthClosePromise;
  const { scope } = data;

  /*
   * `vista=cartao` sem `id`, ou com um `id` recusado pelo servidor, é o mesmo
   * caminho: não há âmbito aplicado e as legendas voltam a ser as da carteira
   * toda. As funções abaixo existem para a página não repetir a mesma condição
   * em cada bloco.
   */
  const hasScope = scope.kind !== 'tudo';
  const scopeName = scope.name;
  const scopedLabel = hasScope && scopeName !== null ? scopeName : null;
  const isAccountScope = scope.kind === 'conta' && scopedLabel !== null;
  const isCardScope = scope.kind === 'cartao' && scopedLabel !== null;
  const card = isCardScope ? data.card : null;
  /*
   * Num cartão só há dívida a nascer: a conta que paga a fatura é a conta, não o
   * cartão. Por isso competência é a leitura principal e caixa passa a
   * «liquidado».
   */
  const accrualFirst = isCardScope;

  const cashflow: CashflowPoint[] = data.series.map((item) => ({
    mes: shortMonth(item.key),
    entradas: item.incomeInCents / 100,
    saidas: item.expenseInCents / 100,
  }));

  const donut: DonutSlice[] = data.expensesByCategory.map((item) => ({
    categoria: item.name,
    valor: item.amountInCents / 100,
  }));

  /** Título do que só existe por âmbito (fluxo e despesas por categoria). */
  function scopedTitle(plural: string): string {
    if (isCardScope) {
      return `${plural} do cartão ${scopedLabel ?? ''}`.trim();
    }

    if (isAccountScope) {
      return `${plural} de ${scopedLabel ?? ''}`.trim();
    }

    return plural;
  }

  function scopeDescription(): string {
    if (isCardScope) {
      return 'Estás a ver o cartão escolhido: o que foi comprado com ele e a fatura em aberto. O resto da carteira não entra nestas contas.';
    }

    if (isAccountScope) {
      return 'Estás a ver a conta escolhida: o saldo dela e só o que por lá passou. O resto da carteira não entra nestas contas.';
    }

    return 'Onde está o teu dinheiro este mês e o que aí vem nos próximos dias.';
  }

  /** Rótulo do primeiro indicador, que muda com o âmbito. */
  function firstKpiLabel(): string {
    if (isCardScope) {
      return 'Em dívida no cartão';
    }

    return isAccountScope ? 'Saldo da conta' : 'Património líquido';
  }

  /** Rótulo da nota do primeiro indicador, que muda com o âmbito. */
  function firstKpiHint(): string {
    if (isCardScope) {
      if (card === null) {
        return 'Dívida do cartão';
      }

      return card.creditLimitInCents === null || card.availableLimitInCents === null
        ? 'Faturas por pagar deste cartão'
        : `Limite disponível: ${euro.format(card.availableLimitInCents / 100)}`;
    }

    if (isAccountScope) {
      return 'Saldo à data de hoje';
    }

    return 'Saldos das contas ativas';
  }

  /*
   * Aviso de âmbito recusado. O servidor não distingue «não existe» de «não é
   * teu»: essa diferença diria a quem tentasse um id alheio se ele existe. O
   * texto é o mesmo para os dois casos.
   */
  const scopeNotice =
    scope.notice === null ? null : (
      <p
        id={SCOPE_NOTICE_ID}
        role="status"
        className="mb-6 flex items-start gap-2 rounded-xl border border-dashed px-3 py-2 text-sm text-muted-foreground"
      >
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>{scope.notice}</span>
      </p>
    );

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
        description={scopeDescription()}
        actions={
          <Button asChild size="sm">
            <Link href="/transacoes">Registar um lançamento</Link>
          </Button>
        }
      />

      <DashboardScopeSwitch
        scope={{ kind: scope.kind, id: scope.id }}
        accounts={data.scopeChoices.accounts}
        cards={data.scopeChoices.cards}
      />

      {scopeNotice}

      {/* Primeiro o que pode correr mal: o saldo a ficar negativo. */}
      <DashboardForecastAlert forecast={data.forecast} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={firstKpiLabel()} hint={firstKpiHint()}>
          {isCardScope ? (
            <Amount amountInCents={card?.outstandingInCents ?? 0} tone="expense" />
          ) : data.balanceInCents !== null ? (
            <Amount amountInCents={data.balanceInCents} />
          ) : (
            <Amount amountInCents={data.patrimonyInCents} />
          )}
        </KpiCard>

        <KpiCard
          label={accrualFirst ? 'Compras do mês' : 'Entradas do mês'}
          hint={
            accrualFirst
              ? 'Por competência: contam na data da compra, e não quando a fatura é paga.'
              : `Por competência: ${euro.format(data.accrual.incomeInCents / 100)}`
          }
        >
          {accrualFirst ? (
            <Amount amountInCents={data.accrual.expenseInCents} tone="expense" />
          ) : (
            <Amount amountInCents={data.cash.incomeInCents} tone="income" />
          )}
        </KpiCard>

        <KpiCard
          label={accrualFirst ? 'Já liquidado' : 'Saídas do mês'}
          hint={
            accrualFirst
              ? 'Só o que foi marcado como pago; uma compra a crédito liquida-se quando pagas a fatura.'
              : `Por competência: ${euro.format(data.accrual.expenseInCents / 100)}`
          }
        >
          <Amount amountInCents={data.cash.expenseInCents} tone="expense" />
        </KpiCard>

        <KpiCard
          label="Sobra do mês"
          hint={
            accrualFirst
              ? 'Compras e entradas do cartão, em visão de competência'
              : 'Entradas menos saídas, em visão de caixa'
          }
        >
          <Amount
            amountInCents={accrualFirst ? data.accrual.netInCents : data.cash.netInCents}
            withSign
          />
        </KpiCard>
      </section>

      {card === null ? null : <CardInvoice card={card} />}

      <section
        aria-label="Previsão de saldo e fecho do mês"
        aria-describedby={scope.notice === null ? undefined : SCOPE_NOTICE_ID}
        className="mt-6 space-y-4"
      >
        <p className="rounded-xl border border-dashed px-3 py-2 text-sm text-muted-foreground">
          {hasScope
            ? 'A previsão de saldo e o fecho do mês são sempre da carteira toda: prever o saldo de um cartão — que não guarda dinheiro — não diria nada, e o fecho é uma tarefa global. O que está acima é que segue o âmbito escolhido.'
            : 'A previsão de saldo e o fecho do mês são da carteira toda: contam todas as contas, as recorrências ativas e as faturas por pagar.'}
        </p>

        <div className="grid gap-4 xl:grid-cols-5">
          <DashboardForecast
            forecast={data.forecast}
            description={
              hasScope
                ? 'Da carteira toda — todas as contas, as recorrências ativas e as faturas por pagar — e não apenas do âmbito escolhido.'
                : undefined
            }
            className="xl:col-span-3"
          />

          <div className="xl:col-span-2">
            <MonthCloseChecklist monthClose={monthClose} />
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-5">
        <ChartCard
          title={scopedTitle('Fluxo dos últimos 6 meses')}
          description={
            hasScope
              ? 'Entradas e saídas, mês a mês, no regime que escolheste — só do âmbito que estás a ver.'
              : 'Entradas e saídas, mês a mês, no regime que escolheste.'
          }
          isEmpty={data.series.every(
            (item) => item.incomeInCents === 0 && item.expenseInCents === 0,
          )}
          className="lg:col-span-3"
        >
          <CashflowChart data={cashflow} />
        </ChartCard>

        <ChartCard
          title={scopedTitle('Despesas por categoria')}
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
            <CardTitle className="text-base">
              {hasScope ? `Próximos 7 dias · ${scopeName ?? ''}`.trim() : 'Próximos 7 dias'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.upcoming.length === 0 ? (
              <EmptyState
                icon={CalendarClock}
                title="Nada por pagar nos próximos 7 dias"
                description={
                  hasScope
                    ? 'Não há lançamentos por liquidar com data próxima dentro do âmbito que estás a ver. O detalhe do que a previsão de saldo conta por dia está no bloco da previsão, que é da carteira toda.'
                    : 'Os lançamentos por liquidar com data próxima aparecem aqui, para não haver surpresas. É o detalhe do que a previsão de saldo conta por dia.'
                }
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

/**
 * Fatura em aberto do cartão escolhido.
 *
 * Quem escolhe um cartão no painel quer saber **quanto tem a pagar e quando** —
 * é a informação que a vista unificada diluía no património. O cartão de fecho e
 * o de vencimento vêm separados, como manda o glossário («fatura» com fecho e
 * vencimento), e o valor por pagar é o que resta depois dos pagamentos já feitos.
 */
function CardInvoice({ card }: { readonly card: NonNullable<DashboardData['card']> }) {
  const invoice = card.openInvoice;

  if (invoice === null) {
    return (
      <section className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fatura de {card.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Este cartão ainda não tem faturas: a primeira nasce com a primeira compra a crédito.
            </p>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="mt-6">
      <Card>
        <CardHeader className="gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">Fatura em aberto</CardTitle>
            <span className="text-xs text-muted-foreground">{card.name}</span>
            <InvoiceStatusBadge status={invoice.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <dl className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-0.5">
              <dt className="text-xs text-muted-foreground">Por pagar</dt>
              <dd className="text-base font-medium">
                <Amount amountInCents={invoice.outstandingInCents} tone="expense" />
              </dd>
            </div>
            <div className="space-y-0.5">
              <dt className="text-xs text-muted-foreground">Total da fatura</dt>
              <dd className="text-base font-medium">
                <Amount amountInCents={invoice.totalInCents} tone="neutral" />
              </dd>
            </div>
            <div className="space-y-0.5">
              <dt className="text-xs text-muted-foreground">Fecho</dt>
              <dd className="text-base">{formatDay(invoice.closingDate)}</dd>
            </div>
            <div className="space-y-0.5">
              <dt className="text-xs text-muted-foreground">Vencimento</dt>
              <dd className="text-base">{formatDay(invoice.dueDate)}</dd>
            </div>
          </dl>

          <p className="text-xs text-muted-foreground">
            {INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status}
            {' · '}
            {invoice.purchaseCount === 1
              ? '1 compra nesta fatura'
              : `${invoice.purchaseCount} compras nesta fatura`}
            {card.nextDueDate === null ? '' : ` · vence a ${formatDay(card.nextDueDate)}`}
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
