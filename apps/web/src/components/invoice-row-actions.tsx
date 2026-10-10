'use client';

import { Eye, Receipt } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { InvoicePayDialog, type PayableInvoice } from '@/components/invoice-pay-dialog';
import { Button } from '@/components/ui/button';
import type { AccountView } from '@/server/accounts';

/**
 * Ações de uma linha de fatura.
 *
 * O detalhe abre por **URL** (`?fatura=<id>`) e não por estado local: assim a
 * consulta que junta as compras da fatura corre no servidor, onde o Prisma vive,
 * e o link pode ser guardado ou reenviado.
 */

/** Alvo de toque: 44 px em telemóvel, denso a partir de `sm`. */
const TOUCH = 'min-h-11 sm:min-h-8';

export function InvoiceRowActions({
  invoice,
  nextInvoice,
  accounts,
  today,
}: {
  readonly invoice: PayableInvoice;
  readonly nextInvoice: { closingDate: string; dueDate: string } | null;
  readonly accounts: readonly AccountView[];
  readonly today: string;
}) {
  const [payOpen, setPayOpen] = useState(false);
  const isSettled = invoice.outstandingInCents === 0;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button asChild variant="ghost" size="sm" className={TOUCH}>
        <Link href={`/cartoes?fatura=${encodeURIComponent(invoice.id)}`}>
          <Eye className="size-3.5" aria-hidden />
          Detalhe
          <span className="sr-only"> da fatura que fecha a {formatDay(invoice.closingDate)}</span>
        </Link>
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className={TOUCH}
        disabled={isSettled}
        onClick={() => setPayOpen(true)}
        aria-label={
          isSettled
            ? `Fatura de ${invoice.cardName} já paga`
            : `Pagar a fatura de ${invoice.cardName}`
        }
      >
        <Receipt className="size-3.5" aria-hidden />
        {isSettled ? 'Paga' : 'Pagar'}
      </Button>

      {payOpen ? (
        <InvoicePayDialog
          invoice={invoice}
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
    </div>
  );
}

/** Data de calendário em formato curto, sem deslocação de fuso. */
function formatDay(date: string): string {
  return new Intl.DateTimeFormat('pt-PT', { timeZone: 'UTC', dateStyle: 'short' }).format(
    new Date(`${date}T00:00:00Z`),
  );
}
