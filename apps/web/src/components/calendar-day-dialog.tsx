'use client';

import { useEffect, useRef, useState, createContext, useContext } from 'react';
import Link from 'next/link';

import { Amount } from '@/components/amount';
import { TransactionQuickAdd } from '@/components/transaction-quick-add';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { AccountView } from '@/server/accounts';
import type { CalendarDay, CalendarItem } from '@/server/calendar';
import type { CardView } from '@/server/cards';
import type { CategoryView } from '@/server/categories';
import type { DescriptionUsage } from '@repo/shared';
import { formatCurrency } from '@repo/shared';

/**
 * O dia do calendário que se abre.
 *
 * Um diálogo, dois estados: o dia (os movimentos que a página já calculou) e o
 * lançamento, que é o `TransactionQuickAdd` com a data do dia. O formulário tem
 * 777 px a 390 px de largura e um diálogo com título visível dava 849 px num
 * ecrã de 844: por isso o estado a lançar usa um título só para leitura de ecrã
 * (o cartão já mostra «Lançamento rápido»), e é por isso que os dois estados
 * existem em vez de uma vista só com scroll.
 *
 * O `max-h-full` é o ecrã, não um valor inventado: quando a T72 puser o limite
 * na classe base do `DialogContent`, esta classe tem de sair para o da base
 * mandar.
 */

interface CalendarDayData {
  readonly accounts: readonly AccountView[];
  readonly cards: readonly CardView[];
  readonly categories: readonly CategoryView[];
  readonly descriptions: readonly DescriptionUsage[];
  readonly today: string;
}

const CalendarDayDataContext = createContext<CalendarDayData | null>(null);

/**
 * As leituras que o formulário precisa (as mesmas de `/transacoes`) são
 * partilhadas por todas as células: sem isto, cada dia levaria a sua cópia no
 * payload do servidor.
 */
export function CalendarDayDataProvider({
  data,
  children,
}: {
  readonly data: CalendarDayData;
  readonly children: React.ReactNode;
}) {
  return <CalendarDayDataContext.Provider value={data}>{children}</CalendarDayDataContext.Provider>;
}

function useCalendarDayData(): CalendarDayData {
  const data = useContext(CalendarDayDataContext);

  if (data === null) {
    throw new Error('CalendarDayDialog tem de estar dentro de CalendarDayDataProvider.');
  }

  return data;
}

export const CALENDAR_SOURCE_LABELS: Record<CalendarItem['source'], string> = {
  conta: 'Conta',
  fatura: 'Fatura',
  recorrencia: 'Recorrência',
  lancamento: 'Lançamento',
};

function DayItemRow({ item }: { readonly item: CalendarItem }) {
  return (
    <li className="flex items-start gap-3 py-2">
      <Link
        href={item.href}
        className="flex min-h-11 flex-1 flex-col justify-center rounded-md text-sm hover:underline"
      >
        <span className="font-medium">{item.label}</span>
        <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Badge variant="secondary" className="font-normal">
            {CALENDAR_SOURCE_LABELS[item.source]}
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

export function CalendarDayDialog({
  day,
  title,
  label,
  variant,
}: {
  readonly day: CalendarDay;
  /** Data longa do dia, sem contagens — o título do painel. */
  readonly title: string;
  /** Data, itens e saldo — o nome acessível que a grelha já usava. */
  readonly label: string;
  readonly variant: 'grid' | 'list';
}) {
  const data = useCalendarDayData();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'day' | 'form'>('day');
  const previousCount = useRef(day.items.length + day.settledItems.length + day.cardItems.length);

  /*
   * Depois de gravar, o `router.refresh()` do formulário traz o mês novo: o
   * movimento aparece no grupo «Já liquidado» e o diálogo volta sozinho ao dia.
   */
  useEffect(() => {
    const total = day.items.length + day.settledItems.length + day.cardItems.length;

    if (view === 'form' && total > previousCount.current) {
      setView('day');
    }

    previousCount.current = total;
  }, [day.items.length, day.settledItems.length, day.cardItems.length, view]);

  function onOpenChange(next: boolean) {
    setOpen(next);
    setView('day');
  }

  const count = day.items.length === 1 ? '1 item' : `${day.items.length} itens`;
  const dayNumber = Number(day.date.slice(8));

  const dialogo = (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {variant === 'grid' ? (
        <DialogTrigger asChild>
          <button
            type="button"
            aria-haspopup="dialog"
            aria-label={`${label}. Abrir o dia`}
            className="flex min-h-11 w-full items-baseline justify-between gap-1 rounded text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <span className="text-xs font-semibold tabular-nums">{dayNumber}</span>
            <span className="text-[0.7rem] text-muted-foreground tabular-nums">
              {day.items.length}
            </span>
          </button>
        </DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <button
            type="button"
            aria-haspopup="dialog"
            aria-label={`${label}. Abrir o dia`}
            className="flex min-h-11 w-full items-baseline justify-between gap-2 rounded text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <span className="text-sm font-semibold first-letter:uppercase">{label}</span>
            <Amount amountInCents={day.balanceInCents} withSign className="text-sm" />
          </button>
        </DialogTrigger>
      )}

      <DialogContent
        className={cn(
          'flex max-h-full flex-col',
          view === 'form' ? 'gap-2 p-3 sm:max-w-md' : 'sm:max-w-md',
        )}
      >
        {view === 'day' ? (
          <>
            <DialogHeader>
              <DialogTitle className="first-letter:uppercase">{title}</DialogTitle>
              <DialogDescription>
                {count} por liquidar
                {day.cardItems.length === 0
                  ? null
                  : ` · ${day.cardItems.length === 1 ? '1 no cartão' : `${day.cardItems.length} no cartão`}`}
                {day.settledItems.length === 0
                  ? null
                  : ` · ${day.settledItems.length === 1 ? '1 já liquidado' : `${day.settledItems.length} já liquidados`}`}
                {' · '}saldo{' '}
                <span className="tabular-nums">{formatCurrency(day.balanceInCents, 'EUR')}</span>
              </DialogDescription>
            </DialogHeader>

            <div className="-mx-1 min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-1">
              {day.items.length === 0 &&
              day.cardItems.length === 0 &&
              day.settledItems.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">Não há movimentos neste dia.</p>
              ) : null}

              {day.items.length === 0 ? null : (
                <section aria-label="Por liquidar">
                  <h3 className="pb-1 text-xs font-medium text-muted-foreground">Por liquidar</h3>
                  <ul className="divide-y">
                    {day.items.map((item) => (
                      <DayItemRow key={`${item.source}-${item.id}`} item={item} />
                    ))}
                  </ul>
                </section>
              )}

              {day.cardItems.length === 0 ? null : (
                <section aria-label="No cartão">
                  <h3 className="pb-1 text-xs font-medium text-muted-foreground">No cartão</h3>
                  <ul className="divide-y">
                    {day.cardItems.map((item) => (
                      <DayItemRow key={`${item.source}-${item.id}`} item={item} />
                    ))}
                  </ul>
                </section>
              )}

              {day.settledItems.length === 0 ? null : (
                <section aria-label="Já liquidado">
                  <h3 className="pb-1 text-xs font-medium text-muted-foreground">Já liquidado</h3>
                  <ul className="divide-y">
                    {day.settledItems.map((item) => (
                      <DayItemRow key={`${item.source}-${item.id}`} item={item} />
                    ))}
                  </ul>
                </section>
              )}
            </div>

            <DialogFooter>
              <Button type="button" onClick={() => setView('form')}>
                Lançar neste dia
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>Lançar em {title}</DialogTitle>
              <DialogDescription>O movimento fica com a data de {title}.</DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <TransactionQuickAdd
                accounts={data.accounts}
                cards={data.cards}
                categories={data.categories}
                descriptions={data.descriptions}
                today={data.today}
                initialDate={day.date}
              />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );

  /*
   * Toda a célula abre o dia: quem toca no canto inferior ou no espaço entre
   * linhas também espera que abra. As ligações dos itens são a exceção — nelas o
   * toque navega e não abre nada. O teclado continua a passar pelo botão do
   * topo (é ele que tem o nome acessível e o `aria-haspopup`).
   */
  function abrirDia(event: React.MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest('a') !== null) {
      return;
    }

    setOpen(true);
  }

  if (variant === 'list') {
    return (
      <div
        onClick={abrirDia}
        className="cursor-pointer rounded-xl border p-3 transition-colors hover:bg-muted/40 active:bg-muted/60"
      >
        {dialogo}
        <p className="text-xs text-muted-foreground">{count}</p>
        <ul className="mt-1 divide-y">
          {day.items.map((item) => (
            <li
              key={`${item.source}-${item.id}`}
              className="flex items-start justify-between gap-2 py-1.5"
            >
              <Link
                href={item.href}
                className="flex min-h-11 flex-1 flex-col rounded-md text-sm hover:underline sm:min-h-0"
              >
                <span className="font-medium">{item.label}</span>
                <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <Badge variant="secondary" className="font-normal">
                    {CALENDAR_SOURCE_LABELS[item.source]}
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
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div
      onClick={abrirDia}
      className={cn(
        'min-h-24 cursor-pointer rounded-lg border p-1.5 transition-colors hover:bg-muted/50 active:bg-muted',
        day.date === data.today ? 'ring-1 ring-primary' : '',
      )}
    >
      {dialogo}
      <p className="mt-1 text-[0.7rem] font-medium">
        <Amount amountInCents={day.balanceInCents} withSign />
      </p>
      <ul className="mt-1 max-h-28 space-y-1 overflow-y-auto">
        {day.items.map((item) => (
          <li key={`${item.source}-${item.id}`}>
            <Link
              href={item.href}
              className="block rounded text-[0.7rem] leading-tight hover:underline"
            >
              <span className="block truncate">{item.label}</span>
              <span className="flex items-baseline justify-between gap-1 text-[0.65rem] text-muted-foreground">
                <span className="truncate">
                  {CALENDAR_SOURCE_LABELS[item.source]}
                  {item.overdue ? ' · Vencida' : ''}
                </span>
                <Amount amountInCents={item.amountInCents} withSign />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
