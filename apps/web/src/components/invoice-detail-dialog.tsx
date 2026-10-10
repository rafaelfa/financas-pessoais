'use client';

import { CircleAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Amount } from '@/components/amount';
import { InvoiceStatusBadge } from '@/components/invoice-status';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

/**
 * Detalhe de uma fatura: o que a compõe e o que já foi pago.
 *
 * Existe para responder à pergunta que o total sozinho não responde — “porque é
 * que esta fatura é maior do que aquilo que gastei este mês?”. A resposta está na
 * primeira linha da conta: parte do total **transitou** da fatura anterior.
 *
 * Os dados chegam já resolvidos do servidor (`getInvoiceDetail`); este
 * componente não consulta nada, porque uma consulta de servidor não pode ser
 * chamada a partir do browser.
 */

/** Compra afeta a uma fatura, como o servidor a devolve. */
export interface InvoiceDetailPurchase {
  readonly id: string;
  readonly date: string;
  readonly description: string | null;
  readonly amountInCents: number;
  readonly installmentNumber: number | null;
  readonly installmentCount: number | null;
}

/** Pagamento aplicado a uma fatura. */
export interface InvoiceDetailPayment {
  readonly id: string;
  readonly amountInCents: number;
  readonly date: string;
  readonly accountName: string | null;
  readonly note: string | null;
}

/** Tudo o que o detalhe mostra. */
export interface InvoiceDetailData {
  readonly id: string;
  readonly cardName: string;
  readonly status: string;
  readonly closingDate: string;
  readonly dueDate: string;
  readonly purchasesInCents: number;
  readonly carriedOverInCents: number;
  readonly totalInCents: number;
  readonly paidInCents: number;
  readonly outstandingInCents: number;
  readonly purchases: readonly InvoiceDetailPurchase[];
  readonly payments: readonly InvoiceDetailPayment[];
  readonly nextInvoice: {
    readonly id: string;
    readonly closingDate: string;
    readonly dueDate: string;
  } | null;
}

export function InvoiceDetailDialog({ detail }: { readonly detail: InvoiceDetailData | null }) {
  const router = useRouter();

  function close() {
    router.push('/cartoes');
  }

  if (detail === null) {
    return (
      <Dialog open onOpenChange={close}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Fatura não encontrada</DialogTitle>
            <DialogDescription>
              A fatura que tentaste abrir já não existe. Fecha esta janela e volta à lista.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button type="button" className="min-h-11 sm:min-h-8" onClick={close}>
              Voltar aos cartões
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={close}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Fatura de {detail.cardName} — fecha a {formatDay(detail.closingDate)}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            <InvoiceStatusBadge status={detail.status} />
            <span>Vence a {formatDay(detail.dueDate)}.</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 rounded-lg border bg-muted/40 p-3 text-sm">
          <Line label="Compras do período" amountInCents={detail.purchasesInCents} />
          {detail.carriedOverInCents > 0 ? (
            <Line
              label="Transitado da fatura anterior"
              amountInCents={detail.carriedOverInCents}
              hint="É o que ficou por pagar na fatura anterior e passou para esta."
            />
          ) : null}
          <Line label="Total da fatura" amountInCents={detail.totalInCents} strong />
          <Line label="Já pago" amountInCents={detail.paidInCents} />
          <Line label="Por pagar" amountInCents={detail.outstandingInCents} strong />
        </div>

        <p className="text-sm text-muted-foreground">
          {detail.outstandingInCents === 0
            ? 'Esta fatura está liquidada: não contribui para o passivo.'
            : detail.nextInvoice === null
              ? 'O que ficar por pagar não tem ainda fatura seguinte para onde transitar.'
              : `O que ficar por pagar transita para a fatura que fecha a ${formatDay(detail.nextInvoice.closingDate)} (vence a ${formatDay(detail.nextInvoice.dueDate)}).`}
        </p>

        <section aria-labelledby="detalhe-compras" className="space-y-2">
          <h3 id="detalhe-compras" className="font-heading text-sm font-medium">
            Compras ({detail.purchases.length})
          </h3>

          {detail.purchases.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
              Sem compras nesta fatura.
            </p>
          ) : (
            <div className="max-h-64 overflow-y-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="w-28">Parcela</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.purchases.map((purchase) => (
                    <TableRow key={purchase.id}>
                      <TableCell className="font-numeric text-muted-foreground tabular-nums">
                        {formatDay(purchase.date)}
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        {displayDescription(purchase.description)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {purchase.installmentNumber === null || purchase.installmentCount === null
                          ? '—'
                          : `${purchase.installmentNumber} de ${purchase.installmentCount}`}
                      </TableCell>
                      <TableCell className="text-right">
                        <Amount amountInCents={purchase.amountInCents} tone="neutral" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        <section aria-labelledby="detalhe-pagamentos" className="space-y-2">
          <h3 id="detalhe-pagamentos" className="font-heading text-sm font-medium">
            Pagamentos ({detail.payments.length})
          </h3>

          {detail.payments.length === 0 ? (
            <p className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
              <CircleAlert className="size-4" aria-hidden />
              Ainda não há pagamentos registados nesta fatura.
            </p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {detail.payments.map((payment) => (
                <li
                  key={payment.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <span className="text-muted-foreground">
                    {formatDay(payment.date)}
                    {payment.accountName === null ? null : <> · {payment.accountName}</>}
                    {payment.note === null || payment.note.trim() === '' ? null : (
                      <> · {payment.note}</>
                    )}
                  </span>
                  <Amount amountInCents={payment.amountInCents} tone="neutral" />
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex justify-end">
          <Button type="button" variant="outline" className="min-h-11 sm:min-h-8" onClick={close}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Line({
  label,
  amountInCents,
  hint,
  strong = false,
}: {
  readonly label: string;
  readonly amountInCents: number;
  readonly hint?: string;
  readonly strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={strong ? 'font-medium' : 'text-muted-foreground'}>
        {label}
        {hint === undefined ? null : (
          <span className="block text-xs font-normal text-muted-foreground">{hint}</span>
        )}
      </span>
      <span className={strong ? 'font-medium' : undefined}>
        <Amount amountInCents={amountInCents} tone="neutral" />
      </span>
    </div>
  );
}

/** Descrição legível, mesmo quando o campo está vazio. */
function displayDescription(description: string | null): string {
  return description === null || description.trim() === '' ? 'Sem descrição' : description;
}

/** Data de calendário em formato curto, sem deslocação de fuso. */
function formatDay(date: string): string {
  return new Intl.DateTimeFormat('pt-PT', { timeZone: 'UTC', dateStyle: 'short' }).format(
    new Date(`${date}T00:00:00Z`),
  );
}
