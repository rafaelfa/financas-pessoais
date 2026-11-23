import { CalendarDays } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Amount } from '@/components/amount';
import {
  CalendarDayDataProvider,
  CalendarDayDialog,
  CALENDAR_SOURCE_LABELS,
} from '@/components/calendar-day-dialog';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@repo/shared';
import { listAccounts } from '@/server/accounts';
import {
  getMonthCalendar,
  shiftCalendarMonth,
  type CalendarDay,
  type CalendarItem,
  type CalendarMonth,
} from '@/server/calendar';
import { listCards } from '@/server/cards';
import { listCategories } from '@/server/categories';
import { descriptionSuggestions } from '@/server/transactions';

export const metadata: Metadata = { title: 'Calendário' };

const SOURCE_LABELS = CALENDAR_SOURCE_LABELS;

const WEEKDAYS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'] as const;

/** Data longa em pt-PT, sempre em UTC: as colunas são `@db.Date`. */
function longDate(date: string): string {
  return new Intl.DateTimeFormat('pt-PT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

/**
 * Um dia abre quando tem qualquer movimento — por liquidar, no cartão ou já
 * liquidado.
 */
function temMovimentos(day: CalendarDay): boolean {
  return day.items.length + day.cardItems.length + day.settledItems.length > 0;
}

/**
 * O saldo do dia conta **tudo** o que lá está (T104/D37).
 *
 * O motor devolve `balanceInCents` só com o que falta liquidar — é o que os
 * totais do mês usam. Para o dia, o número tem de incluir o que já foi pago:
 * senão a célula de um dia com o salário já liquidado dizia «0,00 €» ao lado de
 * um item de 2 200 €.
 */
function dayBalanceInCents(day: CalendarDay): number {
  return (
    day.balanceInCents + day.settledItems.reduce((total, item) => total + item.amountInCents, 0)
  );
}

/**
 * Nome acessível de um dia: data, itens (total e por liquidar) e saldo do dia.
 *
 * O total primeiro diz o que o dia tem; «por liquidar» diz o que ainda falta,
 * que é a distinção que faltava quando a célula mostrava zero num dia cheio.
 */
function dayLabel(day: CalendarDay): string {
  const total = day.items.length + day.settledItems.length + day.cardItems.length;
  const itens = total === 1 ? '1 item' : `${total} itens`;
  const pendentes = day.items.length === 1 ? '1 por liquidar' : `${day.items.length} por liquidar`;

  return `${longDate(day.date)}: ${itens} · ${pendentes}, saldo ${formatCurrency(dayBalanceInCents(day), 'EUR')}`;
}

/** A faixa «em atraso» diz o que lá está: conta, fatura ou as duas coisas. */
function overdueSentence(items: readonly CalendarItem[]): string {
  const contas = items.filter((item) => item.source === 'conta').length;
  const faturas = items.length - contas;

  if (faturas === 0) {
    return items.length === 1
      ? '1 conta venceu antes deste mês e continua em aberto.'
      : `${items.length} contas venceram antes deste mês e continuam em aberto.`;
  }

  if (contas === 0) {
    return faturas === 1
      ? '1 fatura venceu antes deste mês e continua por pagar.'
      : `${faturas} faturas venceram antes deste mês e continuam por pagar.`;
  }

  return `${items.length} ${items.length === 1 ? 'item venceu' : 'itens venceram'} antes deste mês e continuam em aberto.`;
}

function MonthLink({ month, children }: { readonly month: string; readonly children: string }) {
  return (
    <Button asChild variant="outline" size="sm" className="min-h-11 sm:min-h-0">
      <Link href={`/calendario?mes=${month}`} rel={children === 'Mês anterior' ? 'prev' : 'next'}>
        {children}
      </Link>
    </Button>
  );
}

function ItemRow({ item }: { readonly item: CalendarItem }) {
  return (
    <li className="flex items-start justify-between gap-2 py-1.5">
      <Link
        href={item.href}
        className="flex min-h-11 flex-1 flex-col rounded-md text-sm hover:underline sm:min-h-0"
      >
        <span className="font-medium">{item.label}</span>
        <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Badge variant="secondary" className="font-normal">
            {SOURCE_LABELS[item.source]}
          </Badge>
          <span>{item.detail}</span>
          {item.overdue ? (
            <Badge variant="outline" className="border-expense font-normal text-expense">
              Vencida
            </Badge>
          ) : null}
        </span>
      </Link>
      <Amount amountInCents={item.amountInCents} withSign className="text-sm" />
    </li>
  );
}

function Totals({ calendar }: { readonly calendar: CalendarMonth }) {
  return (
    <section className="grid gap-3 sm:grid-cols-3" aria-label="Totais do mês">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">A pagar</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Magnitude: «a pagar» já diz o sentido, o sinal só confundiria. */}
          <Amount amountInCents={calendar.toPayInCents} tone="expense" className="text-2xl" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">A receber</CardTitle>
        </CardHeader>
        <CardContent>
          <Amount amountInCents={calendar.toReceiveInCents} tone="income" className="text-2xl" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Saldo previsto
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Amount amountInCents={calendar.balanceInCents} withSign className="text-2xl" />
        </CardContent>
      </Card>
      {/*
        T104/D37: os três números do topo medem só o que falta. Sem esta linha,
        um dia com tudo pago aparecia a zero nos totais e cheio na célula — e a
        diferença não tinha nome em sítio nenhum.
      */}
      <p className="text-xs text-muted-foreground sm:col-span-3">
        Estes três números contam só o que falta pagar ou receber neste mês. Os dias contam tudo o
        que lá está, incluindo o que já foi liquidado.
      </p>
    </section>
  );
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const requested = params.mes;
  const [calendar, accounts, cards, categories, descriptions] = await Promise.all([
    getMonthCalendar(typeof requested === 'string' ? requested : undefined),
    // As mesmas leituras que `/transacoes` faz: o formulário do dia não inventa
    // consulta nenhuma, e a página só paga as que já existem.
    listAccounts(),
    listCards(),
    listCategories(),
    descriptionSuggestions(),
  ]);

  const previousMonth = shiftCalendarMonth(calendar.month, -1);
  const nextMonth = shiftCalendarMonth(calendar.month, 1);

  // Segunda-feira primeiro, como um calendário português.
  const firstWeekday = (new Date(`${calendar.month}-01T00:00:00Z`).getUTCDay() + 6) % 7;
  const leadingBlanks = calendar.days.length === 0 ? 0 : firstWeekday;
  const daysWithItems = calendar.days.filter(temMovimentos);
  const hasAnything = daysWithItems.length > 0 || calendar.overdue.length > 0;

  return (
    <>
      <PageHeader
        title="Calendário"
        description="O que sai e o que entra este mês, dia a dia. Só leitura: cada linha leva ao ecrã onde o movimento se trata."
      />

      <div className="space-y-6">
        <section
          className="flex flex-wrap items-center justify-between gap-3"
          aria-label="Mês do calendário"
        >
          <div className="flex items-center gap-2">
            <MonthLink month={previousMonth}>Mês anterior</MonthLink>
            <h2 className="text-lg font-semibold first-letter:uppercase">{calendar.label}</h2>
            <MonthLink month={nextMonth}>Mês seguinte</MonthLink>
          </div>
          {calendar.isCurrentMonth ? null : (
            <Button asChild variant="ghost" size="sm" className="min-h-11 sm:min-h-0">
              <Link href="/calendario">Voltar ao mês corrente</Link>
            </Button>
          )}
        </section>

        <Totals calendar={calendar} />

        {calendar.overdue.length === 0 ? null : (
          <section aria-label="Em atraso" className="rounded-xl border border-expense p-4">
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <CalendarDays className="size-4 text-expense" aria-hidden />
              Em atraso, de meses anteriores
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {overdueSentence(calendar.overdue)}
            </p>
            <ul className="mt-2 divide-y">
              {calendar.overdue.map((item) => (
                <ItemRow key={`atraso-${item.id}`} item={item} />
              ))}
            </ul>
          </section>
        )}

        {hasAnything ? null : (
          <EmptyState
            icon={CalendarDays}
            title="Nada marcado neste mês"
            description="Não há contas, faturas, recorrências nem lançamentos por liquidar neste mês. Muda de mês para ver o que está marcado noutro."
          />
        )}

        {/*
          A 360 mostra a lista por dia (uma grelha de sete colunas não cabe); a
          partir de `sm` mostra a grelha. As duas vistas nunca estão visíveis ao
          mesmo tempo (`hidden`), por isso não duplicam nada para o leitor de ecrã.
        */}
        <CalendarDayDataProvider
          data={{ accounts, cards, categories, descriptions, today: calendar.today }}
        >
          <section className="sm:hidden" aria-label="Dias do mês em lista">
            <ol className="space-y-3">
              {daysWithItems.map((day) => (
                <li key={day.date}>
                  <CalendarDayDialog
                    day={day}
                    title={longDate(day.date)}
                    label={dayLabel(day)}
                    variant="list"
                  />
                </li>
              ))}
            </ol>
          </section>

          <section className="hidden sm:block" aria-label="Grelha do mês">
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
              {WEEKDAYS.map((weekday) => (
                <span key={weekday} className="py-1">
                  {weekday}
                </span>
              ))}
            </div>
            <ol className="grid grid-cols-7 gap-1">
              {Array.from({ length: leadingBlanks }, (_, index) => (
                <li key={`vazio-${index}`} aria-hidden className="min-h-24 rounded-lg" />
              ))}
              {calendar.days.map((day) => (
                <li key={day.date}>
                  {temMovimentos(day) ? (
                    <CalendarDayDialog
                      day={day}
                      title={longDate(day.date)}
                      label={dayLabel(day)}
                      variant="grid"
                    />
                  ) : (
                    <div
                      className={`min-h-24 rounded-lg border p-1.5 ${
                        day.date === calendar.today ? 'ring-1 ring-primary' : ''
                      }`}
                    >
                      <span className="text-xs font-semibold tabular-nums">
                        {Number(day.date.slice(8))}
                      </span>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </section>
        </CalendarDayDataProvider>
      </div>
    </>
  );
}
