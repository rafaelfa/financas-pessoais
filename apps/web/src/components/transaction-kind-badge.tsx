import { ArrowLeftRight, Ban, CircleCheck, CreditCard, Info, PiggyBank, Scale } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

/**
 * Distintivos de lançamento.
 *
 * Nenhum deles comunica só por cor: todos levam a palavra escrita. Quem não
 * distingue vermelho de verde continua a ler “Gasto” e “Ganho”, e quem lê num
 * leitor de ecrã ouve o mesmo.
 */

/** Nome legível de cada natureza de lançamento. */
export const TRANSACTION_KIND_LABELS: Readonly<Record<string, string>> = {
  expense: 'Gasto',
  income: 'Ganho',
  transfer: 'Transferência',
  invoice_payment: 'Pagamento de fatura',
  goal_deposit: 'Aporte em objetivo',
  goal_withdrawal: 'Resgate de objetivo',
  balance_adjust: 'Ajuste de saldo',
};

/** Nome legível de cada estado de confirmação. */
export const TRANSACTION_STATUS_LABELS: Readonly<Record<string, string>> = {
  pending: 'Por confirmar',
  confirmed: 'Confirmado',
  ignored: 'Ignorado',
};

/** Natureza do lançamento, com ícone onde ele acrescenta informação. */
export function TransactionKindBadge({ kind }: { readonly kind: string }) {
  const label = TRANSACTION_KIND_LABELS[kind] ?? kind;

  return (
    <Badge variant="outline" className="font-normal">
      <TransactionKindIcon kind={kind} />
      {label}
    </Badge>
  );
}

function TransactionKindIcon({ kind }: { readonly kind: string }) {
  switch (kind) {
    case 'transfer':
      return <ArrowLeftRight className="size-3" aria-hidden />;
    case 'invoice_payment':
      return <CreditCard className="size-3" aria-hidden />;
    case 'goal_deposit':
    case 'goal_withdrawal':
      return <PiggyBank className="size-3" aria-hidden />;
    case 'balance_adjust':
      return <Scale className="size-3" aria-hidden />;
    default:
      return null;
  }
}

/** Estado de confirmação. `ignored` é explicitamente cinzento, não silencioso. */
export function TransactionStatusBadge({ status }: { readonly status: string }) {
  const label = TRANSACTION_STATUS_LABELS[status] ?? status;

  if (status === 'confirmed') {
    return (
      <Badge variant="secondary" className="font-normal">
        <CircleCheck className="size-3" aria-hidden />
        {label}
      </Badge>
    );
  }

  if (status === 'ignored') {
    return (
      <Badge variant="outline" className="font-normal text-muted-foreground">
        <Ban className="size-3" aria-hidden />
        {label}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="border-warning/50 font-normal text-warning-foreground">
      <Info className="size-3" aria-hidden />
      {label}
    </Badge>
  );
}
