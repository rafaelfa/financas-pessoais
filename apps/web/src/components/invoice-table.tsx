import { Receipt } from 'lucide-react';

import { Amount } from '@/components/amount';
import { InvoiceRowActions } from '@/components/invoice-row-actions';
import { InvoiceStatusBadge } from '@/components/invoice-status';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { AccountView } from '@/server/accounts';
import type { InvoiceSummary } from '@/server/cards';

/**
 * Faturas de um cartão, da mais recente para a mais antiga.
 *
 * A fatura atual (a que ainda recebe compras) fica em destaque. O **valor
 * transitado** tem coluna própria e, em telemóvel, aparece por baixo da data —
 * é a informação que explica porque é que o total de uma fatura pode ser maior
 * do que a soma das compras do período.
 *
 * Componente de servidor: não tem estado. As ações de cada linha (que precisam
 * de diálogos) vivem em `InvoiceRowActions`.
 */

/** Fatura como a lista do servidor a devolve: resumo mais o nome do cartão. */
export type InvoiceListRow = InvoiceSummary & { readonly cardName: string };

export function InvoiceTable({
  cardName,
  invoices,
  highlightInvoiceId,
  accounts,
  today,
}: {
  readonly cardName: string;
  readonly invoices: readonly InvoiceListRow[];
  /** Fatura em destaque: a aberta/próxima do cartão. */
  readonly highlightInvoiceId: string | null;
  readonly accounts: readonly AccountView[];
  readonly today: string;
}) {
  const ordered = [...invoices].sort((left, right) =>
    left.closingDate < right.closingDate ? 1 : -1,
  );

  return (
    <section aria-label={`Faturas do cartão ${cardName}`} className="space-y-3">
      <div className="space-y-1">
        <h3 className="font-heading text-base font-medium">Faturas</h3>
        <p className="text-sm text-muted-foreground">
          O total de uma fatura é a soma das compras do período <strong>mais</strong> o que
          transitou da fatura anterior. O que ficar por pagar transita para a fatura seguinte — é
          assim que um pagamento parcial não desaparece.
        </p>
      </div>

      {ordered.length === 0 ? (
        <p className="flex items-center gap-2 rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
          <Receipt className="size-4" aria-hidden />
          Este cartão ainda não tem faturas. A primeira é criada automaticamente com a primeira
          compra.
        </p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Fecho</TableHead>
                  <TableHead className="hidden sm:table-cell">Vencimento</TableHead>
                  <TableHead className="hidden text-right lg:table-cell">Compras</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Transitado</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="hidden text-right lg:table-cell">Pago</TableHead>
                  <TableHead className="text-right">Por pagar</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {ordered.map((invoice) => {
                  const isCurrent = invoice.id === highlightInvoiceId;
                  const nextInvoice = nextInvoiceFor(ordered, invoice.closingDate);

                  return (
                    <TableRow
                      key={invoice.id}
                      data-current={isCurrent}
                      className={isCurrent ? 'bg-muted/40' : undefined}
                    >
                      <TableCell className="align-top">
                        <span className="font-numeric tabular-nums">
                          {formatDay(invoice.closingDate)}
                        </span>
                        {isCurrent ? (
                          <span className="mt-0.5 block text-xs font-medium text-primary">
                            Atual
                          </span>
                        ) : null}
                        {invoice.carriedOverInCents > 0 ? (
                          <span className="mt-0.5 block text-xs text-muted-foreground md:hidden">
                            Transitado:{' '}
                            <Amount
                              amountInCents={invoice.carriedOverInCents}
                              tone="neutral"
                              className="text-xs"
                            />
                          </span>
                        ) : null}
                      </TableCell>

                      <TableCell className="font-numeric hidden text-muted-foreground tabular-nums sm:table-cell">
                        {formatDay(invoice.dueDate)}
                      </TableCell>

                      <TableCell className="hidden text-right lg:table-cell">
                        <Amount
                          amountInCents={invoice.purchasesInCents}
                          tone="neutral"
                          className="text-muted-foreground"
                        />
                      </TableCell>

                      <TableCell className="hidden text-right md:table-cell">
                        {invoice.carriedOverInCents > 0 ? (
                          <span className="inline-flex items-baseline gap-1">
                            <span aria-hidden className="text-muted-foreground">
                              +
                            </span>
                            <Amount amountInCents={invoice.carriedOverInCents} tone="neutral" />
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      <TableCell className="text-right font-medium">
                        <Amount amountInCents={invoice.totalInCents} tone="neutral" />
                      </TableCell>

                      <TableCell className="hidden text-right lg:table-cell">
                        <Amount
                          amountInCents={invoice.paidInCents}
                          tone="neutral"
                          className="text-muted-foreground"
                        />
                      </TableCell>

                      <TableCell className="text-right">
                        <span className="flex flex-col items-end">
                          <Amount amountInCents={invoice.outstandingInCents} tone="neutral" />
                          {invoice.status !== 'paid' && invoice.outstandingInCents > 0 ? (
                            <span className="text-xs text-muted-foreground">
                              passa para a seguinte
                            </span>
                          ) : null}
                        </span>
                      </TableCell>

                      <TableCell>
                        <InvoiceStatusBadge status={invoice.status} />
                      </TableCell>

                      <TableCell className="text-right">
                        <InvoiceRowActions
                          invoice={{
                            id: invoice.id,
                            cardName: invoice.cardName,
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
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

/** A fatura seguinte na cadeia do cartão, ou `null` se esta for a última. */
function nextInvoiceFor(
  ordered: readonly InvoiceListRow[],
  closingDate: string,
): { closingDate: string; dueDate: string } | null {
  // `ordered` está da mais recente para a mais antiga: a seguinte é a última
  // entrada cuja data de fecho ainda é posterior a esta.
  const later = ordered.filter((invoice) => invoice.closingDate > closingDate);
  const next = later[later.length - 1];

  return next === undefined ? null : { closingDate: next.closingDate, dueDate: next.dueDate };
}

/** Data de calendário em formato curto, sem deslocação de fuso. */
function formatDay(date: string): string {
  return new Intl.DateTimeFormat('pt-PT', { timeZone: 'UTC', dateStyle: 'short' }).format(
    new Date(`${date}T00:00:00Z`),
  );
}
