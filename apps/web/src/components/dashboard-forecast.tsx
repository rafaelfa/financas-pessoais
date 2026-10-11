import { CalendarClock, TrendingDown, TrendingUp } from 'lucide-react';

import { Amount } from '@/components/amount';
import { ChartCard } from '@/components/chart-card';
import { DashboardForecastChart, type ForecastPoint } from '@/components/dashboard-forecast-chart';
import { Badge } from '@/components/ui/badge';

/**
 * Previsão de saldo.
 *
 * O painel mostrava o presente e não avisava do futuro: saber o saldo de hoje
 * não evita um descoberto na semana que vem. Este bloco mostra o saldo previsto
 * dia a dia — já com as recorrências ativas e as faturas por pagar nas
 * respetivas datas de vencimento — e, sobretudo, **o ponto mais baixo**, que é a
 * informação que interessa a quem tem contas a cair antes do próximo ordenado.
 *
 * O gráfico não é a única leitura: ao lado estão os três números que resumem a
 * previsão e a lista dos dias em que o saldo muda, para quem lê no telemóvel ou
 * com leitor de ecrã.
 */

/** Um movimento agendado num dia, quando o servidor o envia. */
export interface DashboardForecastItem {
  readonly label: string;
  readonly amountInCents: number;
}

/** Previsão como `getDashboard()` a devolve. */
export interface DashboardForecastData {
  readonly days: ReadonlyArray<{
    readonly date: string;
    readonly balanceInCents: number;
    /**
     * Opcional: o que está agendado neste dia (recorrência ou fatura).
     *
     * O contrato só garante `date` e `balanceInCents`; quando o servidor envia
     * também os movimentos, a lista diz **o que** muda o saldo em vez de só que
     * ele muda. Sem eles, a lista continua correta — só menos detalhada.
     */
    readonly items?: readonly DashboardForecastItem[];
  }>;
  readonly lowestBalanceInCents: number;
  readonly lowestDate: string | null;
  readonly goesNegative: boolean;
  /**
   * Opcional: primeiro dia em que o saldo fica negativo, já calculado pelo
   * servidor. Sem ele, a data é derivada da série — os dois coincidem, mas o
   * valor do servidor é o autoritativo.
   */
  readonly firstNegativeDate?: string | null;
}

/** Um dia em que o saldo previsto muda, com o que muda. */
interface BalanceChange {
  readonly date: string;
  readonly deltaInCents: number;
  readonly balanceInCents: number;
  readonly items: readonly DashboardForecastItem[];
}

/** Quantos dias com alterações se listam antes de resumir o resto. */
const MAX_LISTED_CHANGES = 10;

export function DashboardForecast({
  forecast,
  className,
  description,
}: {
  readonly forecast: DashboardForecastData;
  readonly className?: string;
  /** Substitui a descrição da moldura quando há algo a explicar (ex.: âmbito). */
  readonly description?: string;
}) {
  const start = forecast.days[0] ?? null;
  const last = forecast.days[forecast.days.length - 1] ?? null;
  const changes = balanceChanges(forecast.days);
  const listed = changes.slice(0, MAX_LISTED_CHANGES);
  const remaining = changes.length - listed.length;
  /*
   * A série nunca vem vazia (o primeiro dia é hoje), por isso o estado vazio não
   * se pode medir pelo comprimento: mede-se por **haver ou não o que prever** —
   * saldo diferente de zero ou algo agendado. Sem isso, um utilizador sem contas
   * via um gráfico plano a zero em vez de uma explicação.
   */
  const hasAnythingToForecast = forecast.days.some(
    (day) => day.balanceInCents !== 0 || (day.items?.length ?? 0) > 0,
  );
  /*
   * O primeiro dia negativo não é assumido igual ao ponto mais baixo: o saldo
   * pode ficar negativo no dia 5 e só atingir o mínimo no dia 8, e um aviso que
   * aponta o dia errado é pior do que não avisar. Vem do servidor quando ele o
   * envia e, sem isso, é derivado da série.
   */
  const negativeSince = firstNegativeDay(forecast);

  const points: ForecastPoint[] = forecast.days.map((day) => ({
    data: axisLabel(day.date),
    saldo: day.balanceInCents / 100,
  }));

  return (
    <ChartCard
      title="Previsão de saldo"
      description={
        description ??
        (last === null
          ? undefined
          : `De hoje até ${formatDayLong(last.date)}: o saldo previsto conta com as recorrências ativas e as faturas por pagar nas respetivas datas de vencimento.`)
      }
      isEmpty={!hasAnythingToForecast}
      emptyMessage="Ainda não há saldo nem movimentos agendados para prever. Assim que houver uma conta com movimentos, uma recorrência ativa ou uma fatura por pagar, a previsão aparece aqui."
      className={className}
    >
      <div className="space-y-4">
        <dl className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-0.5">
            <dt className="text-xs text-muted-foreground">Saldo hoje</dt>
            <dd className="text-base font-medium">
              {start === null ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                <Amount amountInCents={start.balanceInCents} tone="neutral" />
              )}
            </dd>
          </div>

          <div className="space-y-0.5">
            <dt className="text-xs text-muted-foreground">Ponto mais baixo</dt>
            <dd className="text-base font-medium">
              <Amount
                amountInCents={forecast.lowestBalanceInCents}
                tone={forecast.lowestBalanceInCents < 0 ? 'expense' : 'neutral'}
              />
              {forecast.lowestDate === null ? null : (
                <span className="block text-xs font-normal text-muted-foreground">
                  a {formatDayLong(forecast.lowestDate)}
                </span>
              )}
            </dd>
          </div>

          <div className="space-y-0.5">
            <dt className="text-xs text-muted-foreground">Fica negativo?</dt>
            <dd>
              {forecast.goesNegative ? (
                <Badge variant="destructive">
                  <TrendingDown className="size-3" aria-hidden />
                  Sim
                  {negativeSince === null ? '' : `, a ${formatDayLong(negativeSince)}`}
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <TrendingUp className="size-3" aria-hidden />
                  Não
                </Badge>
              )}
            </dd>
          </div>
        </dl>

        <DashboardForecastChart data={points} />

        <div className="space-y-2">
          <h3 className="text-sm font-medium">Dias em que o saldo muda</h3>

          {listed.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
              Não há nada agendado neste período: o saldo mantém-se em{' '}
              <Amount
                amountInCents={forecast.lowestBalanceInCents}
                tone="neutral"
                className="text-foreground"
              />
              . As recorrências e as faturas por pagar aparecem aqui assim que existirem.
            </p>
          ) : (
            <>
              <ul className="divide-y rounded-lg border">
                {listed.map((change) => (
                  <li
                    key={change.date}
                    className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2 text-sm"
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="font-medium">{formatDayLong(change.date)}</span>
                      {change.items.length === 0 ? (
                        <span className="text-xs text-muted-foreground">
                          {change.deltaInCents < 0
                            ? 'O saldo desce neste dia.'
                            : 'O saldo sobe neste dia.'}
                        </span>
                      ) : (
                        <ul className="mt-0.5 space-y-0.5 text-xs text-muted-foreground">
                          {change.items.map((item, index) => (
                            <li key={`${item.label}-${String(index)}`}>
                              {item.label} · <Amount amountInCents={item.amountInCents} withSign />
                            </li>
                          ))}
                        </ul>
                      )}
                      {change.balanceInCents < 0 ? (
                        <Badge variant="destructive" className="mt-1 w-fit">
                          Saldo negativo
                        </Badge>
                      ) : null}
                    </div>

                    <div className="text-right">
                      <Amount amountInCents={change.deltaInCents} withSign />
                      <span className="block text-xs text-muted-foreground">
                        fica em <Amount amountInCents={change.balanceInCents} tone="neutral" />
                      </span>
                    </div>
                  </li>
                ))}
              </ul>

              {remaining > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {remaining === 1
                    ? 'Há mais 1 dia com alterações neste período.'
                    : `Há mais ${remaining} dias com alterações neste período.`}
                </p>
              ) : null}
            </>
          )}
        </div>

        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <CalendarClock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            A previsão só inclui o que está agendado (recorrências ativas e faturas por pagar) e o
            saldo atual das contas. Gastos que ainda não registaste não aparecem aqui.
          </span>
        </p>
      </div>
    </ChartCard>
  );
}

/**
 * Dias em que o saldo previsto muda de um dia para o outro.
 *
 * O primeiro dia é o ponto de partida (o saldo de hoje), por isso o ciclo começa
 * no segundo: a diferença entre o dia 0 e o dia 1 é o que está agendado para o
 * dia 1.
 */
function balanceChanges(days: DashboardForecastData['days']): BalanceChange[] {
  const changes: BalanceChange[] = [];

  for (let index = 1; index < days.length; index += 1) {
    const previous = days[index - 1];
    const current = days[index];

    if (previous === undefined || current === undefined) {
      continue;
    }

    const items = current.items ?? [];

    // Um dia conta quando o saldo muda — ou quando tem movimentos agendados que
    // se anulam (uma entrada e uma saída iguais): nesse caso o saldo não muda,
    // mas há coisas a acontecer e o utilizador tem de as ver.
    if (current.balanceInCents === previous.balanceInCents && items.length === 0) {
      continue;
    }

    changes.push({
      date: current.date,
      deltaInCents: current.balanceInCents - previous.balanceInCents,
      balanceInCents: current.balanceInCents,
      items,
    });
  }

  return changes;
}

/** Rótulo curto e numérico para o eixo: `28/10`, sem ambiguidade de idioma. */
function axisLabel(date: string): string {
  return new Intl.DateTimeFormat('pt-PT', {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(`${date}T00:00:00Z`));
}

/**
 * Primeiro dia em que o saldo previsto fica negativo.
 *
 * Não é o ponto mais baixo: são datas diferentes quando o saldo continua a
 * descer depois de passar o zero, e o `lowestDate` do servidor é o mínimo, não o
 * primeiro dia negativo. Usa o valor do servidor quando existe e, sem ele,
 * deriva-o da série — nunca devolve `null` enquanto houver um dia negativo.
 */
export function firstNegativeDay(forecast: DashboardForecastData): string | null {
  if (forecast.firstNegativeDate !== undefined && forecast.firstNegativeDate !== null) {
    return forecast.firstNegativeDate;
  }

  const day = forecast.days.find((candidate) => candidate.balanceInCents < 0);

  return day?.date ?? null;
}

/** Data de calendário por extenso, sem deslocação de fuso. */
export function formatDayLong(date: string): string {
  return new Intl.DateTimeFormat('pt-PT', { timeZone: 'UTC', dateStyle: 'long' }).format(
    new Date(`${date}T00:00:00Z`),
  );
}
