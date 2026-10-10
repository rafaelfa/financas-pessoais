import { CalendarDays, CircleCheck, Lock } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

/**
 * Estado de uma fatura.
 *
 * Os três estados vêm do motor financeiro (docs/spec/F1, regra 13): **aberta**
 * enquanto aceita compras, **fechada** depois do fecho e antes de estar paga, e
 * **paga** quando não há nada em dívida. O rótulo está sempre escrito: a cor
 * sozinha não diz nada a quem não a distingue.
 */

/** Nome legível de cada estado. */
export const INVOICE_STATUS_LABELS: Readonly<Record<string, string>> = {
  open: 'Aberta',
  closed: 'Fechada',
  paid: 'Paga',
};

/** Explicação de cada estado, para o utilizador não ter de a deduzir. */
export const INVOICE_STATUS_DESCRIPTIONS: Readonly<Record<string, string>> = {
  open: 'Ainda recebe compras até ao dia de fecho.',
  closed: 'Já fechou e ainda não está paga.',
  paid: 'Está liquidada: não contribui para o passivo.',
};

export function InvoiceStatusBadge({ status }: { readonly status: string }) {
  const label = INVOICE_STATUS_LABELS[status] ?? status;

  if (status === 'paid') {
    return (
      <Badge variant="secondary" className="font-normal">
        <CircleCheck className="size-3" aria-hidden />
        {label}
      </Badge>
    );
  }

  if (status === 'closed') {
    return (
      <Badge variant="outline" className="font-normal text-warning-foreground">
        <Lock className="size-3" aria-hidden />
        {label}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="font-normal">
      <CalendarDays className="size-3" aria-hidden />
      {label}
    </Badge>
  );
}
