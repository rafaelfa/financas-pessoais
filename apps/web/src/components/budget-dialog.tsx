'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { MoneyInput } from '@/components/money-input';
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
import { Switch } from '@/components/ui/switch';
import { createBudget, updateBudget } from '@/server/budgets-actions';
import { toFieldErrors } from '@/server/result';
import { createBudgetSchema, updateBudgetSchema } from '@repo/shared/schemas/domain';
import { cn } from '@/lib/utils';

/**
 * Criação e edição do orçamento.
 *
 * O **período não é escolhido aqui**: a ação deriva-o do dia de início do mês do
 * utilizador (que está na sessão). Deixar o formulário escolher as datas
 * permitiria um orçamento que não corresponde a nenhum mês real — o browser não
 * conhece essa preferência.
 *
 * O âmbito **não se altera na edição**: só o servidor o pode mudar com segurança,
 * e um descuido aqui transformaria um orçamento de um mês num orçamento de todos
 * os meses. O diálogo mostra-o, para o utilizador saber em que âmbito está, e a
 * escolha faz-se uma única vez, na criação.
 */

/** Campos que o formulário lê de um orçamento existente. */
export interface EditableBudget {
  readonly id: string;
  readonly name: string;
  readonly totalAmountInCents: number;
  readonly alertsEnabled: boolean;
  readonly scope: string;
}

/** Âmbitos, com a explicação que o utilizador precisa de ler. */
const SCOPE_OPTIONS = [
  {
    value: 'monthly_default',
    label: 'Todos os meses',
    hint: 'O orçamento do dia a dia: defines uma vez e vale para todos os meses.',
  },
  {
    value: 'single_month',
    label: 'Só este mês',
    hint: 'Para um mês concreto — férias, um mês atípico. Fica preso a este período.',
  },
] as const;

/** Alvo de toque: 44 px em telemóvel, denso a partir de `sm`. */
const TOUCH = 'min-h-11 sm:min-h-8';

export function BudgetDialog({
  mode,
  budget,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  readonly mode: 'create' | 'edit';
  readonly budget?: EditableBudget;
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
          <DialogTitle>{mode === 'create' ? 'Novo orçamento' : 'Editar orçamento'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'O total que queres gastar no mês. Depois distribuis por categorias, se quiseres.'
              : 'Muda o nome, o total ou os alertas. As datas do período são as do mês definido nas preferências.'}
          </DialogDescription>
        </DialogHeader>

        <BudgetForm mode={mode} budget={budget} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function BudgetForm({
  mode,
  budget,
  onDone,
}: {
  readonly mode: 'create' | 'edit';
  readonly budget?: EditableBudget;
  readonly onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(budget?.name ?? '');
  const [totalAmountInCents, setTotalAmountInCents] = useState<number | null>(
    budget?.totalAmountInCents ?? null,
  );
  const [scope, setScope] = useState<'monthly_default' | 'single_month'>(
    budget?.scope === 'single_month' ? 'single_month' : 'monthly_default',
  );
  const [alertsEnabled, setAlertsEnabled] = useState(budget?.alertsEnabled ?? true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function errorFor(field: string): string | undefined {
    return fieldErrors[field]?.[0];
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const base = {
      name: name.trim(),
      totalAmountInCents: totalAmountInCents ?? 0,
      alertsEnabled,
      // Na edição não se envia o âmbito: a listagem não o devolve e enviá-lo às
      // cegas mudaria o âmbito de um orçamento de um mês.
      ...(mode === 'create' ? { scope } : {}),
    };

    const payload = mode === 'create' ? base : { ...base, id: budget?.id ?? '' };

    const parsed =
      mode === 'create'
        ? createBudgetSchema.safeParse(payload)
        : updateBudgetSchema.safeParse(payload);

    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      return;
    }

    startTransition(async () => {
      const result =
        mode === 'create' ? await createBudget(parsed.data) : await updateBudget(parsed.data);

      if (!result.ok) {
        setFormError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }

      toast.success(mode === 'create' ? 'Orçamento criado.' : 'Orçamento atualizado.');
      onDone();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field data-invalid={errorFor('name') !== undefined}>
        <FieldLabel htmlFor="orcamento-nome">Nome</FieldLabel>
        <Input
          id="orcamento-nome"
          value={name}
          required
          autoComplete="off"
          placeholder="ex.: Orçamento do dia a dia"
          className={TOUCH}
          aria-invalid={errorFor('name') !== undefined}
          aria-describedby={errorFor('name') === undefined ? undefined : 'orcamento-nome-erro'}
          onChange={(event) => setName(event.target.value)}
        />
        <FieldError id="orcamento-nome-erro">{errorFor('name')}</FieldError>
      </Field>

      <Field data-invalid={errorFor('totalAmountInCents') !== undefined}>
        <FieldLabel htmlFor="orcamento-total">Total do orçamento</FieldLabel>
        <div
          role="group"
          aria-describedby={
            errorFor('totalAmountInCents') === undefined ? undefined : 'orcamento-total-erro'
          }
        >
          <MoneyInput
            id="orcamento-total"
            valueInCents={totalAmountInCents}
            onValueChange={setTotalAmountInCents}
          />
        </div>
        <FieldDescription>
          A soma dos limites das categorias pode passar deste valor: avisamos, mas não bloqueamos.
        </FieldDescription>
        <FieldError id="orcamento-total-erro">{errorFor('totalAmountInCents')}</FieldError>
      </Field>

      {mode === 'create' ? (
        <div className="space-y-2">
          <span id="orcamento-ambito" className="text-sm font-medium">
            Âmbito
          </span>
          <div
            role="radiogroup"
            aria-labelledby="orcamento-ambito"
            className="flex flex-wrap gap-2"
          >
            {SCOPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={scope === option.value}
                onClick={() => setScope(option.value)}
                className={cn(
                  'inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border px-3 text-sm font-medium transition-colors sm:min-h-8',
                  scope === option.value
                    ? 'border-transparent bg-primary text-primary-foreground'
                    : 'border-border bg-background hover:bg-muted',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            {SCOPE_OPTIONS.find((option) => option.value === scope)?.hint}
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          <span className="text-sm font-medium">Âmbito</span>
          <p className="text-sm text-muted-foreground">
            {SCOPE_OPTIONS.find((option) => option.value === scope)?.label} —{' '}
            {SCOPE_OPTIONS.find((option) => option.value === scope)?.hint} O âmbito de um orçamento
            já criado não se altera: se precisares de outro, cria um novo.
          </p>
        </div>
      )}

      <Field>
        <FieldLabel htmlFor="orcamento-alertas">Alertas do orçamento</FieldLabel>
        <div className="flex min-h-11 items-center gap-3 sm:min-h-0">
          <Switch
            id="orcamento-alertas"
            checked={alertsEnabled}
            onCheckedChange={setAlertsEnabled}
          />
          <span className="text-sm text-muted-foreground">
            Ligar os avisos quando um limite se aproxima do limiar definido.
          </span>
        </div>
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
        <Button type="submit" className={TOUCH} disabled={pending}>
          {pending ? 'A guardar…' : mode === 'create' ? 'Criar orçamento' : 'Guardar alterações'}
        </Button>
      </div>
    </form>
  );
}
