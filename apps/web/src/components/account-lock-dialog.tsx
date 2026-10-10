'use client';

import { Scale } from 'lucide-react';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { lockAccountBalance } from '@/server/accounts-actions';
import type { AccountView } from '@/server/accounts';
import { toFieldErrors } from '@/server/result';
import { lockBalanceSchema } from '@repo/shared/schemas/domain';

/**
 * “Travar saldo”.
 *
 * O utilizador diz quanto tem na conta a uma data e o sistema cria **um
 * lançamento de ajuste** com a diferença. Nada é reescrito: se um dia se
 * perguntar de onde veio o saldo, o ajuste está lá, datado e com motivo.
 *
 * A diferença mostrada antes de confirmar compara com o saldo calculado que o
 * servidor já enviou (à data de hoje). Quando a data escolhida é outra, o
 * servidor recalcula a diferença nessa data — e a interface di-lo, em vez de
 * fingir que sabe o mesmo que ele.
 */

const TOUCH = 'min-h-11 sm:min-h-8';

export function AccountLockDialog({
  account,
  today,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  readonly account: AccountView;
  /** Data de hoje em Portugal, como `YYYY-MM-DD`. */
  readonly today: string;
  readonly trigger?: React.ReactNode;
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger === undefined ? null : <DialogTrigger asChild>{trigger}</DialogTrigger>}

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Travar saldo</DialogTitle>
          <DialogDescription>
            Acerta o saldo de «{account.name}» sem apagar nem alterar o que já está registado.
          </DialogDescription>
        </DialogHeader>

        <LockBalanceForm account={account} today={today} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function LockBalanceForm({
  account,
  today,
  onDone,
}: {
  readonly account: AccountView;
  readonly today: string;
  readonly onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [referenceDate, setReferenceDate] = useState(today);
  const [reportedBalanceInCents, setReportedBalanceInCents] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function errorFor(field: string): string | undefined {
    return fieldErrors[field]?.[0];
  }

  const differenceInCents =
    reportedBalanceInCents === null ? null : reportedBalanceInCents - account.balanceInCents;

  const isOtherDate = referenceDate !== today;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const parsed = lockBalanceSchema.safeParse({
      accountId: account.id,
      referenceDate,
      reportedBalanceInCents: reportedBalanceInCents ?? 0,
      reason: reason.trim() === '' ? undefined : reason.trim(),
    });

    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      return;
    }

    startTransition(async () => {
      const result = await lockAccountBalance(parsed.data);

      if (!result.ok) {
        setFormError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }

      if (result.data.adjustmentInCents === 0) {
        toast.info('O saldo já batia certo. Não foi criado nenhum ajuste.');
      } else {
        toast.success(
          `Ajuste de ${formatSigned(result.data.adjustmentInCents)} criado em ${formatDay(referenceDate)}.`,
        );
      }

      onDone();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="text-muted-foreground">Saldo calculado (hoje)</span>
          <Amount amountInCents={account.balanceInCents} tone="neutral" />
        </div>
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="text-muted-foreground">Saldo que informas</span>
          {reportedBalanceInCents === null ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <Amount amountInCents={reportedBalanceInCents} tone="neutral" />
          )}
        </div>
        <div className="flex items-baseline justify-between gap-3 border-t pt-2 text-sm font-medium">
          <span>Diferença</span>
          {differenceInCents === null ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <Amount amountInCents={differenceInCents} withSign tone="neutral" />
          )}
        </div>
      </div>

      {differenceInCents === null ? null : (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {differenceInCents === 0
            ? 'O saldo que escreveste já é o saldo calculado. Não há nada a ajustar.'
            : differenceInCents > 0
              ? 'Vai ser criado um lançamento de ajuste positivo: o saldo real é maior do que o que o sistema calculou.'
              : 'Vai ser criado um lançamento de ajuste negativo: o saldo real é menor do que o que o sistema calculou.'}
        </p>
      )}

      <Field data-invalid={errorFor('reportedBalanceInCents') !== undefined}>
        <FieldLabel htmlFor="travar-saldo">Saldo real da conta</FieldLabel>
        {/* O `MoneyInput` não aceita `aria-invalid`; a mensagem segue por
            `aria-describedby` e o estado inválido veste o `Field`. */}
        <div
          role="group"
          aria-describedby={
            errorFor('reportedBalanceInCents') === undefined ? undefined : 'travar-saldo-erro'
          }
        >
          <MoneyInput
            id="travar-saldo"
            valueInCents={reportedBalanceInCents}
            onValueChange={setReportedBalanceInCents}
            autoFocus
          />
        </div>
        <FieldDescription>
          O que o homebanking ou o extrato dizem, à data indicada. Pode ser negativo.
        </FieldDescription>
        <FieldError id="travar-saldo-erro">{errorFor('reportedBalanceInCents')}</FieldError>
      </Field>

      <Field data-invalid={errorFor('referenceDate') !== undefined}>
        <FieldLabel htmlFor="travar-data">Data de referência</FieldLabel>
        <Input
          id="travar-data"
          type="date"
          value={referenceDate}
          required
          className={TOUCH}
          aria-invalid={errorFor('referenceDate') !== undefined}
          aria-describedby={
            errorFor('referenceDate') === undefined ? undefined : 'travar-data-erro'
          }
          onChange={(event) => setReferenceDate(event.target.value)}
        />
        <FieldError id="travar-data-erro">{errorFor('referenceDate')}</FieldError>
      </Field>

      {isOtherDate ? (
        <Alert>
          <Scale aria-hidden />
          <AlertTitle>Estás a travar o saldo noutra data</AlertTitle>
          <AlertDescription>
            A diferença acima compara com o saldo calculado de hoje. Ao confirmar, o sistema
            recalcula a diferença à data que escolheste e é essa que fica no ajuste.
          </AlertDescription>
        </Alert>
      ) : null}

      <Field data-invalid={errorFor('reason') !== undefined}>
        <FieldLabel htmlFor="travar-motivo">Motivo</FieldLabel>
        <Input
          id="travar-motivo"
          value={reason}
          placeholder="Opcional — ex.: conferência do extrato de setembro"
          className={TOUCH}
          aria-invalid={errorFor('reason') !== undefined}
          aria-describedby={errorFor('reason') === undefined ? undefined : 'travar-motivo-erro'}
          onChange={(event) => setReason(event.target.value)}
        />
        <FieldError id="travar-motivo-erro">{errorFor('reason')}</FieldError>
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
          disabled={pending || reportedBalanceInCents === null || differenceInCents === 0}
        >
          {pending ? 'A travar…' : 'Travar saldo'}
        </Button>
      </div>
    </form>
  );
}

/** Montante com sinal explícito, para o texto do toast. */
function formatSigned(amountInCents: number): string {
  const value = new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format(amountInCents / 100);

  return amountInCents > 0 ? `+${value}` : value;
}

/** Data de calendário em formato curto português, sem deslocação de fuso. */
function formatDay(date: string): string {
  return new Intl.DateTimeFormat('pt-PT', { timeZone: 'UTC', dateStyle: 'short' }).format(
    new Date(`${date}T00:00:00Z`),
  );
}
