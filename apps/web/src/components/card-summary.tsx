'use client';

import {
  Archive,
  ArchiveRestore,
  CreditCard,
  EllipsisVertical,
  Pencil,
  Receipt,
  ShoppingCart,
} from 'lucide-react';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Amount } from '@/components/amount';
import { CARD_BRAND_LABELS, CardDialog } from '@/components/card-dialog';
import { InvoicePayDialog } from '@/components/invoice-pay-dialog';
import { InvoiceStatusBadge } from '@/components/invoice-status';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { setCardArchived } from '@/server/cards-actions';
import type { AccountView } from '@/server/accounts';
import type { CardView } from '@/server/cards';
import { cn } from '@/lib/utils';

/**
 * Cartão de crédito, com a fatura que interessa à frente.
 *
 * Mostra a fatura aberta (ou a próxima a fechar) em vez de uma lista: é o número
 * que o utilizador quer ver. E, quando existe, diz explicitamente que parte do
 * total **transitou** da fatura anterior — sem isso, o total parece não bater
 * certo com as compras do mês.
 */

/** Alvo de toque: 44 px em telemóvel, denso a partir de `sm`. */
const TOUCH = 'min-h-11 sm:min-h-8';
const ICON_TOUCH = 'min-h-11 min-w-11 sm:min-h-7 sm:min-w-7';

export function CardSummary({
  card,
  accounts,
  today,
  nextInvoice,
}: {
  readonly card: CardView;
  readonly accounts: readonly AccountView[];
  /** Data de hoje em Portugal, como `YYYY-MM-DD`. */
  readonly today: string;
  /** Fatura seguinte à aberta, para onde transita o que ficar por pagar. */
  readonly nextInvoice: { closingDate: string; dueDate: string } | null;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const invoice = card.openInvoice;
  const isSettled = invoice !== null && invoice.outstandingInCents === 0;

  function confirmArchive() {
    startTransition(async () => {
      const result = await setCardArchived({ id: card.id, archived: !card.archived });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(card.archived ? 'Cartão reativado.' : 'Cartão arquivado.');
      setArchiveOpen(false);
    });
  }

  return (
    <Card data-archived={card.archived} className={cn(card.archived && 'opacity-70')}>
      <CardHeader>
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
          >
            <CreditCard className="size-4" />
          </span>

          <div className="min-w-0 flex-1 space-y-1">
            <CardTitle className="truncate">{card.name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {CARD_BRAND_LABELS[card.brand] ?? card.brand} · fecho ao dia {card.closingDay} ·
              vencimento ao dia {card.dueDay}
            </p>
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {card.archived ? <Badge variant="outline">Arquivado</Badge> : null}
              {card.activeInstallmentPlanCount > 0 ? (
                <Badge variant="secondary">
                  {card.activeInstallmentPlanCount === 1
                    ? '1 parcelamento ativo'
                    : `${card.activeInstallmentPlanCount} parcelamentos ativos`}
                </Badge>
              ) : null}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className={ICON_TOUCH}
                aria-label={`Ações do cartão ${card.name}`}
              >
                <EllipsisVertical className="size-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                <Pencil className="size-4" aria-hidden />
                Editar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setArchiveOpen(true)}>
                {card.archived ? (
                  <ArchiveRestore className="size-4" aria-hidden />
                ) : (
                  <Archive className="size-4" aria-hidden />
                )}
                {card.archived ? 'Reativar' : 'Arquivar'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {invoice === null ? (
          <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
            Ainda não há faturas neste cartão. A primeira é criada automaticamente com a primeira
            compra.
          </p>
        ) : (
          <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">
                Fatura que fecha a {formatDay(invoice.closingDate)}
              </span>
              <InvoiceStatusBadge status={invoice.status} />
            </div>

            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Vencimento</dt>
                <dd className="font-numeric tabular-nums">{formatDay(invoice.dueDate)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Compras</dt>
                <dd>
                  <Amount amountInCents={invoice.purchasesInCents} tone="neutral" />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Total</dt>
                <dd className="font-medium">
                  <Amount amountInCents={invoice.totalInCents} tone="neutral" />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Por pagar</dt>
                <dd className="font-medium">
                  <Amount amountInCents={invoice.outstandingInCents} tone="neutral" />
                </dd>
              </div>
            </dl>

            {invoice.carriedOverInCents > 0 ? (
              <p className="flex flex-wrap items-baseline gap-1 border-t pt-2 text-xs text-muted-foreground">
                <span aria-hidden>+</span>
                <Amount
                  amountInCents={invoice.carriedOverInCents}
                  tone="neutral"
                  className="text-xs"
                />
                <span>
                  transitados da fatura anterior — por isso o total é maior do que as compras.
                </span>
              </p>
            ) : null}
          </div>
        )}

        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>
            {/* Total em dívida no cartão: o servidor dá-o já calculado como a
                última fatura da cadeia, sem somar o valor transitado duas vezes. */}
            Em dívida: <Amount amountInCents={card.outstandingInCents} tone="neutral" />.
          </li>
          <li>
            <LimitLine card={card} />
          </li>
          <li>
            {card.activeInstallmentPlanCount === 0
              ? 'Sem parcelamentos ativos.'
              : card.activeInstallmentPlanCount === 1
                ? '1 parcelamento ativo.'
                : `${card.activeInstallmentPlanCount} parcelamentos ativos.`}
          </li>
        </ul>
      </CardContent>

      <div className="flex flex-wrap gap-2 px-(--card-spacing)">
        <Button asChild size="sm" className={TOUCH} disabled={card.archived}>
          <Link href={`/transacoes?cartao=${card.id}`}>
            <ShoppingCart className="size-3.5" aria-hidden />
            Registar compra
          </Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={TOUCH}
          disabled={invoice === null || isSettled || card.archived}
          onClick={() => setPayOpen(true)}
        >
          <Receipt className="size-3.5" aria-hidden />
          {isSettled ? 'Fatura paga' : 'Pagar fatura'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={TOUCH}
          onClick={() => setEditOpen(true)}
        >
          <Pencil className="size-3.5" aria-hidden />
          Editar
        </Button>
      </div>

      <CardDialog
        mode="edit"
        card={card}
        accounts={accounts}
        today={today}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      {payOpen && invoice !== null ? (
        <InvoicePayDialog
          invoice={{
            id: invoice.id,
            cardName: card.name,
            closingDate: invoice.closingDate,
            dueDate: invoice.dueDate,
            carriedOverInCents: invoice.carriedOverInCents,
            totalInCents: invoice.totalInCents,
            paidInCents: invoice.paidInCents,
            outstandingInCents: invoice.outstandingInCents,
          }}
          nextInvoice={nextInvoice}
          accounts={accounts}
          today={today}
          open
          onOpenChange={(open) => {
            if (!open) {
              setPayOpen(false);
            }
          }}
        />
      ) : null}

      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              {card.archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
            </AlertDialogMedia>
            <AlertDialogTitle>
              {card.archived ? `Reativar «${card.name}»?` : `Arquivar «${card.name}»?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {card.archived
                ? 'O cartão volta à lista e as faturas continuam a contar para o passivo.'
                : 'O cartão sai da lista, mas as faturas e os movimentos ficam guardados. Podes reativá-lo quando quiseres.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant={card.archived ? 'default' : 'destructive'}
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                confirmArchive();
              }}
            >
              {pending ? 'A guardar…' : card.archived ? 'Reativar' : 'Arquivar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

/**
 * Linha do limite.
 *
 * O limite disponível pode vir calculado pelo servidor ou não existir; quando há
 * os dois números, mostram-se os dois — “disponível: 800 € de 1 500 €” diz mais
 * do que “limite: 1 500 €”.
 */
function LimitLine({ card }: { readonly card: CardView }) {
  const available = card.availableLimitInCents;
  const limit = card.creditLimitInCents;

  if (available === null && limit === null) {
    return <>Sem limite definido.</>;
  }

  if (available !== null && limit !== null) {
    return (
      <>
        Limite disponível: <Amount amountInCents={available} tone="neutral" /> de{' '}
        <Amount amountInCents={limit} tone="neutral" />.
      </>
    );
  }

  if (available !== null) {
    return (
      <>
        Limite disponível: <Amount amountInCents={available} tone="neutral" />.
      </>
    );
  }

  return (
    <>
      Limite definido: <Amount amountInCents={limit ?? 0} tone="neutral" />.
    </>
  );
}

/** Data de calendário em formato curto, sem deslocação de fuso. */
function formatDay(date: string): string {
  return new Intl.DateTimeFormat('pt-PT', { timeZone: 'UTC', dateStyle: 'short' }).format(
    new Date(`${date}T00:00:00Z`),
  );
}
