'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Amount } from '@/components/amount';
import { MoneyInput } from '@/components/money-input';
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
import { addGoalMovement } from '@/server/goals-actions';
import type { AccountView } from '@/server/accounts';
import { toFieldErrors } from '@/server/result';
import { addGoalMovementSchema } from '@repo/shared/schemas/domain';
import { cn } from '@/lib/utils';

/**
 * Depósito ou levantamento num objetivo.
 *
 * A **conta é opcional, e a diferença importa**, por isso é explicada no sítio
 * certo:
 * - com conta, o dinheiro move-se mesmo — sai do saldo da conta e passa a estar
 *   no objetivo (o lançamento é um aporte/resgate, nunca um gasto ou um ganho);
 * - sem conta, o movimento é só uma marca de progresso: nenhum saldo se move.
 *
 * Um levantamento maior do que o acumulado é permitido (o motor admite acumulado
 * negativo), mas avisamos antes de gravar.
 */

/** Valor sentinela: o Radix Select reserva a string vazia. */
const NO_ACCOUNT = '__sem_conta__';

/** Alvo de toque: 44 px em telemóvel, denso a partir de `sm`. */
const TOUCH = 'min-h-11 sm:min-h-8';

export function GoalMovementDialog({
  goal,
  defaultType,
  accounts,
  today,
  open,
  onOpenChange,
}: {
  readonly goal: {
    readonly id: string;
    readonly name: string;
    readonly accumulatedInCents: number;
  };
  readonly defaultType?: 'deposit' | 'withdrawal';
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
          <DialogTitle>Movimento em «{goal.name}»</DialogTitle>
          <DialogDescription>
            O que já tens no objetivo:{' '}
            <Amount amountInCents={goal.accumulatedInCents} tone="neutral" />.
          </DialogDescription>
        </DialogHeader>

        <GoalMovementForm
          goal={goal}
          defaultType={defaultType ?? 'deposit'}
          accounts={accounts}
          today={today}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function GoalMovementForm({
  goal,
  defaultType,
  accounts,
  today,
  onDone,
}: {
  readonly goal: {
    readonly id: string;
    readonly name: string;
    readonly accumulatedInCents: number;
  };
  readonly defaultType: 'deposit' | 'withdrawal';
  readonly accounts: readonly AccountView[];
  readonly today: string;
  readonly onDone: () => void;
}) {
  const activeAccounts = accounts.filter((account) => !account.archived);
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<'deposit' | 'withdrawal'>(defaultType);
  const [amountInCents, setAmountInCents] = useState<number | null>(null);
  const [date, setDate] = useState(today);
  const [accountId, setAccountId] = useState('');
  const [note, setNote] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function errorFor(field: string): string | undefined {
    return fieldErrors[field]?.[0];
  }

  const amount = amountInCents ?? 0;
  const exceedsAccumulated = type === 'withdrawal' && amount > goal.accumulatedInCents;
  const movingMoney = accountId !== '';

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const parsed = addGoalMovementSchema.safeParse({
      goalId: goal.id,
      type,
      amountInCents: amount,
      date,
      note: note.trim() === '' ? null : note.trim(),
      accountId: accountId === '' ? null : accountId,
    });

    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      return;
    }

    startTransition(async () => {
      const result = await addGoalMovement(parsed.data);

      if (!result.ok) {
        setFormError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }

      const isDeposit = type === 'deposit';

      toast.success(
        movingMoney
          ? isDeposit
            ? 'Depósito registado. O saldo da conta foi atualizado.'
            : 'Levantamento registado. O dinheiro voltou para a conta.'
          : isDeposit
            ? 'Depósito registado no objetivo.'
            : 'Levantamento registado no objetivo.',
      );
      onDone();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-1">
        <span id="movimento-tipo" className="text-sm font-medium">
          Tipo de movimento
        </span>
        <div role="radiogroup" aria-labelledby="movimento-tipo" className="flex flex-wrap gap-2">
          {MOVEMENT_TYPES.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={type === option.value}
              onClick={() => setType(option.value)}
              className={cn(
                'inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border px-3 text-sm font-medium transition-colors sm:min-h-8',
                type === option.value
                  ? 'border-transparent bg-primary text-primary-foreground'
                  : 'border-border bg-background hover:bg-muted',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <Field data-invalid={errorFor('amountInCents') !== undefined || exceedsAccumulated}>
        <FieldLabel htmlFor="movimento-valor">Valor</FieldLabel>
        <div
          role="group"
          aria-describedby={
            errorFor('amountInCents') === undefined && !exceedsAccumulated
              ? undefined
              : 'movimento-valor-erro'
          }
        >
          <MoneyInput
            id="movimento-valor"
            valueInCents={amountInCents}
            onValueChange={setAmountInCents}
            autoFocus
          />
        </div>
        <FieldError id="movimento-valor-erro">
          {errorFor('amountInCents') ??
            (exceedsAccumulated
              ? 'Estás a levantar mais do que tens no objetivo: o acumulado fica negativo.'
              : undefined)}
        </FieldError>
      </Field>

      <Field data-invalid={errorFor('date') !== undefined}>
        <FieldLabel htmlFor="movimento-data">Data</FieldLabel>
        <Input
          id="movimento-data"
          type="date"
          value={date}
          required
          className={TOUCH}
          aria-invalid={errorFor('date') !== undefined}
          aria-describedby={errorFor('date') === undefined ? undefined : 'movimento-data-erro'}
          onChange={(event) => setDate(event.target.value)}
        />
        <FieldError id="movimento-data-erro">{errorFor('date')}</FieldError>
      </Field>

      <div className="space-y-1">
        <FieldLabel htmlFor="movimento-conta">Conta (opcional)</FieldLabel>
        <Select
          value={accountId === '' ? NO_ACCOUNT : accountId}
          onValueChange={(next) => setAccountId(next === NO_ACCOUNT ? '' : next)}
          disabled={activeAccounts.length === 0}
        >
          <SelectTrigger id="movimento-conta" className={`w-full ${TOUCH}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_ACCOUNT}>Sem conta</SelectItem>
            {activeAccounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          {activeAccounts.length === 0
            ? 'Não tens contas ativas: o movimento fica só como marca de progresso.'
            : movingMoney
              ? type === 'deposit'
                ? 'O dinheiro sai do saldo da conta e passa a contar no objetivo. O lançamento é um aporte, não uma despesa.'
                : 'O dinheiro volta para o saldo da conta e deixa de contar no objetivo. Não é um ganho.'
              : 'Sem conta, é só uma marca de progresso: nenhum saldo se move.'}
        </p>
      </div>

      <Field data-invalid={errorFor('note') !== undefined}>
        <FieldLabel htmlFor="movimento-nota">Nota</FieldLabel>
        <Input
          id="movimento-nota"
          value={note}
          placeholder="Opcional — ex.: transferência do ordenado"
          className={TOUCH}
          aria-invalid={errorFor('note') !== undefined}
          aria-describedby={errorFor('note') === undefined ? undefined : 'movimento-nota-erro'}
          onChange={(event) => setNote(event.target.value)}
        />
        <FieldDescription>Fica no histórico do objetivo.</FieldDescription>
        <FieldError id="movimento-nota-erro">{errorFor('note')}</FieldError>
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
        <Button type="submit" className={TOUCH} disabled={pending || amount <= 0}>
          {pending
            ? 'A registar…'
            : type === 'deposit'
              ? 'Registar depósito'
              : 'Registar levantamento'}
        </Button>
      </div>
    </form>
  );
}

const MOVEMENT_TYPES: readonly { value: 'deposit' | 'withdrawal'; label: string }[] = [
  { value: 'deposit', label: 'Depositar' },
  { value: 'withdrawal', label: 'Levantar' },
];
