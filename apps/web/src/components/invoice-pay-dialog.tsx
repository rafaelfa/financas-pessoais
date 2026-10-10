'use client';

import { Info } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Amount } from '@/components/amount';
import { MoneyInput } from '@/components/money-input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { payInvoice } from '@/server/invoices-actions';
import type { AccountView } from '@/server/accounts';
import { toFieldErrors } from '@/server/result';
import { payInvoiceSchema } from '@repo/shared/schemas/domain';

/**
 * Pagamento de uma fatura.
 *
 * Duas ideias que este diálogo tem de deixar claras:
 *
 * 1. **Pagar a fatura não é uma despesa nova.** É a liquidação de compras que já
 *    estão registadas. Em competência não volta a contar; em caixa é a saída que
 *    materializa essas compras (docs/spec/F1, regra 7).
 * 2. **Um pagamento parcial não desaparece**: o que ficar por pagar transita
 *    para a fatura seguinte (regra 14). O valor que transita aparece antes de
 *    confirmar, não depois.
 */

/** Campos que o diálogo lê de uma fatura. */
export interface PayableInvoice {
  readonly id: string;
  readonly cardName: string;
  readonly closingDate: string;
  readonly dueDate: string;
  readonly carriedOverInCents: number;
  readonly totalInCents: number;
  readonly paidInCents: number;
  readonly outstandingInCents: number;
}

/** Alvo de toque: 44 px em telemóvel, denso a partir de `sm`. */
const TOUCH = 'min-h-11 sm:min-h-8';

export function InvoicePayDialog({
  invoice,
  nextInvoice,
  accounts,
  today,
  open,
  onOpenChange,
}: {
  readonly invoice: PayableInvoice;
  /** Fatura seguinte, para onde transita o que ficar por pagar. */
  readonly nextInvoice: { closingDate: string; dueDate: string } | null;
  readonly accounts: readonly AccountView[];
  /** Data de hoje em Portugal, como `YYYY-MM-DD`. */
  readonly today: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pagar a fatura de {invoice.cardName}</DialogTitle>
          <DialogDescription>
            Fatura que fecha a {formatDay(invoice.closingDate)} e vence a{' '}
            {formatDay(invoice.dueDate)}.
          </DialogDescription>
        </DialogHeader>

        <PayInvoiceForm
          invoice={invoice}
          nextInvoice={nextInvoice}
          accounts={accounts}
          today={today}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function PayInvoiceForm({
  invoice,
  nextInvoice,
  accounts,
  today,
  onDone,
}: {
  readonly invoice: PayableInvoice;
  readonly nextInvoice: { closingDate: string; dueDate: string } | null;
  readonly accounts: readonly AccountView[];
  readonly today: string;
  readonly onDone: () => void;
}) {
  const activeAccounts = accounts.filter((account) => !account.archived);
  const [pending, startTransition] = useTransition();
  const [amountInCents, setAmountInCents] = useState<number | null>(invoice.outstandingInCents);
  const [accountId, setAccountId] = useState(() => activeAccounts[0]?.id ?? '');
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function errorFor(field: string): string | undefined {
    return fieldErrors[field]?.[0];
  }

  const paid = amountInCents ?? 0;
  const exceedsOutstanding = paid > invoice.outstandingInCents;
  const remainingAfter = Math.max(0, invoice.outstandingInCents - paid);
  const isPartial = remainingAfter > 0 && paid > 0;
  const nothingToPay = invoice.outstandingInCents === 0;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const parsed = payInvoiceSchema.safeParse({
      invoiceId: invoice.id,
      amountInCents: paid,
      date,
      accountId,
      // `notes` (plural) é o campo canónico do schema; a coluna chama-se `note`.
      notes: notes.trim() === '' ? undefined : notes.trim(),
    });

    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      return;
    }

    if (exceedsOutstanding) {
      setFormError(
        `O valor é maior do que o que falta pagar (${formatCents(invoice.outstandingInCents)}). Ajusta o valor.`,
      );
      return;
    }

    startTransition(async () => {
      const result = await payInvoice(parsed.data);

      if (!result.ok) {
        setFormError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }

      /*
       * O valor que transita é o que o **servidor** calculou, não a estimativa
       * que o diálogo mostrou: entre abrir e confirmar pode ter entrado outro
       * pagamento, e o toast não pode contradizer a base de dados.
       */
      const carriedToNextInCents = result.data.carriedToNextInCents;

      toast.success(
        carriedToNextInCents > 0
          ? `Pagamento registado. ${formatCents(carriedToNextInCents)} transitam para a fatura seguinte.`
          : 'Fatura paga. Não transita nada para a fatura seguinte.',
      );
      onDone();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Alert>
        <Info aria-hidden />
        <AlertTitle>Pagar a fatura não é uma despesa nova</AlertTitle>
        <AlertDescription>
          É a liquidação das compras que já registaste no cartão: em competência não volta a contar
          e em caixa é a saída que materializa essas compras.
        </AlertDescription>
      </Alert>

      <div className="space-y-2 rounded-lg border bg-muted/40 p-3 text-sm">
        <Line
          label="Compras do período"
          amountInCents={invoice.totalInCents - invoice.carriedOverInCents}
        />
        {invoice.carriedOverInCents > 0 ? (
          <Line label="Transitado da fatura anterior" amountInCents={invoice.carriedOverInCents} />
        ) : null}
        <Line label="Total da fatura" amountInCents={invoice.totalInCents} strong />
        <Line label="Já pago" amountInCents={invoice.paidInCents} />
        <Line label="Por pagar" amountInCents={invoice.outstandingInCents} strong />
      </div>

      <Field data-invalid={errorFor('amountInCents') !== undefined || exceedsOutstanding}>
        <FieldLabel htmlFor="pagar-valor">Valor a pagar</FieldLabel>
        <div className="flex items-start gap-2">
          <div
            role="group"
            className="flex-1"
            aria-describedby={
              errorFor('amountInCents') === undefined && !exceedsOutstanding
                ? undefined
                : 'pagar-valor-erro'
            }
          >
            <MoneyInput
              id="pagar-valor"
              valueInCents={amountInCents}
              onValueChange={setAmountInCents}
              autoFocus
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className={TOUCH}
            onClick={() => setAmountInCents(invoice.outstandingInCents)}
          >
            Pagar tudo
          </Button>
        </div>
        <FieldDescription>
          Podes pagar menos do que o total: o que ficar por pagar passa para a fatura seguinte.
        </FieldDescription>
        <FieldError id="pagar-valor-erro">
          {errorFor('amountInCents') ??
            (exceedsOutstanding
              ? `O valor é maior do que o que falta pagar (${formatCents(invoice.outstandingInCents)}).`
              : undefined)}
        </FieldError>
      </Field>

      {nothingToPay ? (
        <p role="alert" className="text-sm text-muted-foreground">
          Esta fatura já não tem nada por pagar.
        </p>
      ) : (
        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm" aria-live="polite">
          {remainingAfter === 0 ? (
            <>
              Com este valor, a fatura fica <strong>paga</strong> e não transita nada.
            </>
          ) : nextInvoice === null ? (
            <>
              Com este valor, ficam <Amount amountInCents={remainingAfter} tone="neutral" /> por
              pagar. Ainda não existe fatura seguinte para os receber.
            </>
          ) : (
            <>
              Com este valor, ficam <Amount amountInCents={remainingAfter} tone="neutral" /> por
              pagar, que{' '}
              <strong>
                transitam para a fatura que fecha a {formatDay(nextInvoice.closingDate)}
              </strong>{' '}
              (vence a {formatDay(nextInvoice.dueDate)}).
            </>
          )}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <FieldLabel htmlFor="pagar-conta">Conta de pagamento</FieldLabel>
          <Select
            value={accountId}
            onValueChange={setAccountId}
            disabled={activeAccounts.length === 0}
          >
            <SelectTrigger
              id="pagar-conta"
              aria-required
              className={`w-full ${TOUCH}`}
              aria-invalid={errorFor('accountId') !== undefined}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {activeAccounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError>{errorFor('accountId')}</FieldError>
        </div>

        <Field data-invalid={errorFor('date') !== undefined}>
          <FieldLabel htmlFor="pagar-data">Data do pagamento</FieldLabel>
          <Input
            id="pagar-data"
            type="date"
            value={date}
            required
            className={TOUCH}
            aria-invalid={errorFor('date') !== undefined}
            aria-describedby={errorFor('date') === undefined ? undefined : 'pagar-data-erro'}
            onChange={(event) => setDate(event.target.value)}
          />
          <FieldError id="pagar-data-erro">{errorFor('date')}</FieldError>
        </Field>
      </div>

      <Field data-invalid={errorFor('notes') !== undefined}>
        <FieldLabel htmlFor="pagar-nota">Nota</FieldLabel>
        <Input
          id="pagar-nota"
          value={notes}
          placeholder="Opcional — ex.: pagamento parcial por acordo"
          className={TOUCH}
          aria-invalid={errorFor('notes') !== undefined}
          aria-describedby={errorFor('notes') === undefined ? undefined : 'pagar-nota-erro'}
          onChange={(event) => setNotes(event.target.value)}
        />
        <FieldError id="pagar-nota-erro">{errorFor('notes')}</FieldError>
      </Field>

      {formError === null ? null : (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          className={TOUCH}
          disabled={pending}
          onClick={onDone}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          className={TOUCH}
          disabled={
            pending ||
            nothingToPay ||
            exceedsOutstanding ||
            paid <= 0 ||
            activeAccounts.length === 0
          }
        >
          {pending ? 'A pagar…' : isPartial ? 'Registar pagamento parcial' : 'Pagar fatura'}
        </Button>
      </div>
    </form>
  );
}

function Line({
  label,
  amountInCents,
  strong = false,
}: {
  readonly label: string;
  readonly amountInCents: number;
  readonly strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={strong ? 'font-medium' : 'text-muted-foreground'}>{label}</span>
      <span className={strong ? 'font-medium' : undefined}>
        <Amount amountInCents={amountInCents} tone="neutral" />
      </span>
    </div>
  );
}

/** Data de calendário em formato curto, sem deslocação de fuso. */
function formatDay(date: string): string {
  return new Intl.DateTimeFormat('pt-PT', { timeZone: 'UTC', dateStyle: 'short' }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

/** Montante em euros, para texto corrido. */
function formatCents(amountInCents: number): string {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(
    amountInCents / 100,
  );
}
