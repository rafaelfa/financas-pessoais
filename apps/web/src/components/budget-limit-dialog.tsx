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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { setBudgetLimit } from '@/server/budgets-actions';
import { toFieldErrors } from '@/server/result';
import { setBudgetLimitSchema } from '@repo/shared/schemas/domain';

/**
 * Definir ou alterar o limite de uma categoria.
 *
 * É um `upsert` por `(orçamento, categoria)`: a mesma ação serve para acrescentar
 * um limite novo e para corrigir um existente, sem a interface ter de saber se
 * ele já lá estava.
 *
 * Sem limiar definido, o motor avisa aos 80% — é o valor que o sistema de
 * referência usa no exemplo oficial, e é isso que o campo vazio significa.
 */

/** Campos que o diálogo lê de um limite existente. */
export interface EditableBudgetLimit {
  readonly categoryId: string;
  readonly categoryName: string;
  readonly amountInCents: number;
  readonly alertThresholdPct: number | null;
  readonly alertsEnabled: boolean;
}

/** Limiar por omissão do motor, quando o limite não define nenhum. */
const DEFAULT_THRESHOLD_PCT = 80;

/** Sentinela: o Radix Select reserva a string vazia. */
const NO_CATEGORY = '__sem_categoria__';

/** Alvo de toque: 44 px em telemóvel, denso a partir de `sm`. */
const TOUCH = 'min-h-11 sm:min-h-8';

export function BudgetLimitDialog({
  budgetId,
  limit,
  categoryOptions,
  defaultCategoryId,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  readonly budgetId: string;
  /** Limite existente: a categoria fica fixa. */
  readonly limit?: EditableBudgetLimit;
  /** Categorias disponíveis para um limite novo. */
  readonly categoryOptions: readonly { value: string; label: string }[];
  /** Categoria já escolhida fora do diálogo (ao clicar numa categoria sem limite). */
  readonly defaultCategoryId?: string;
  readonly trigger?: React.ReactNode;
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const isEdit = limit !== undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger === undefined ? null : <DialogTrigger asChild>{trigger}</DialogTrigger>}

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar limite' : 'Novo limite'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? `Quanto queres gastar em «${limit.categoryName}» neste período.`
              : 'Escolhe a categoria e o valor. Podes voltar aqui para ajustar quando quiseres.'}
          </DialogDescription>
        </DialogHeader>

        <BudgetLimitForm
          budgetId={budgetId}
          limit={limit}
          categoryOptions={categoryOptions}
          defaultCategoryId={defaultCategoryId}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function BudgetLimitForm({
  budgetId,
  limit,
  categoryOptions,
  defaultCategoryId,
  onDone,
}: {
  readonly budgetId: string;
  readonly limit?: EditableBudgetLimit;
  readonly categoryOptions: readonly { value: string; label: string }[];
  readonly defaultCategoryId?: string;
  readonly onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [categoryId, setCategoryId] = useState(limit?.categoryId ?? defaultCategoryId ?? '');
  const [amountInCents, setAmountInCents] = useState<number | null>(limit?.amountInCents ?? null);
  const [threshold, setThreshold] = useState(
    limit?.alertThresholdPct === null || limit?.alertThresholdPct === undefined
      ? ''
      : String(limit.alertThresholdPct),
  );
  const [alertsEnabled, setAlertsEnabled] = useState(limit?.alertsEnabled ?? true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function errorFor(field: string): string | undefined {
    return fieldErrors[field]?.[0];
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const parsed = setBudgetLimitSchema.safeParse({
      budgetId,
      categoryId,
      amountInCents: amountInCents ?? 0,
      alertThresholdPct: threshold.trim() === '' ? null : Number(threshold),
      alertsEnabled,
    });

    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      return;
    }

    startTransition(async () => {
      const result = await setBudgetLimit(parsed.data);

      if (!result.ok) {
        setFormError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }

      toast.success(limit === undefined ? 'Limite definido.' : 'Limite atualizado.');
      onDone();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {limit === undefined ? (
        <div className="space-y-1">
          <Label htmlFor="limite-categoria">Categoria</Label>
          <Select
            value={categoryId === '' ? NO_CATEGORY : categoryId}
            onValueChange={(next) => setCategoryId(next === NO_CATEGORY ? '' : next)}
          >
            <SelectTrigger
              id="limite-categoria"
              aria-required
              className={`w-full ${TOUCH}`}
              aria-invalid={errorFor('categoryId') !== undefined}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_CATEGORY}>Escolhe uma categoria</SelectItem>
              {categoryOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            Limites definem-se na categoria principal: o consumo das subcategorias conta para lá.
          </p>
          <FieldError>{errorFor('categoryId')}</FieldError>
        </div>
      ) : (
        <div className="space-y-1">
          <span className="text-sm font-medium">Categoria</span>
          <p className="text-sm text-muted-foreground">
            {limit.categoryName} — para mudar de categoria, cria um limite na nova e remove este.
          </p>
        </div>
      )}

      <Field data-invalid={errorFor('amountInCents') !== undefined}>
        <FieldLabel htmlFor="limite-valor">Limite</FieldLabel>
        <div
          role="group"
          aria-describedby={
            errorFor('amountInCents') === undefined ? undefined : 'limite-valor-erro'
          }
        >
          <MoneyInput
            id="limite-valor"
            valueInCents={amountInCents}
            onValueChange={setAmountInCents}
          />
        </div>
        <FieldError id="limite-valor-erro">{errorFor('amountInCents')}</FieldError>
      </Field>

      <Field data-invalid={errorFor('alertThresholdPct') !== undefined}>
        <FieldLabel htmlFor="limite-limiar">Avisar a partir de (%)</FieldLabel>
        <Input
          id="limite-limiar"
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          value={threshold}
          placeholder={String(DEFAULT_THRESHOLD_PCT)}
          className={TOUCH}
          aria-invalid={errorFor('alertThresholdPct') !== undefined}
          aria-describedby={
            errorFor('alertThresholdPct') === undefined ? undefined : 'limite-limiar-erro'
          }
          onChange={(event) => setThreshold(event.target.value)}
        />
        <FieldDescription>
          Em branco significa {DEFAULT_THRESHOLD_PCT}%, o valor por omissão.
        </FieldDescription>
        <FieldError id="limite-limiar-erro">{errorFor('alertThresholdPct')}</FieldError>
      </Field>

      <Field>
        <FieldLabel htmlFor="limite-alertas">Alertas deste limite</FieldLabel>
        <div className="flex min-h-11 items-center gap-3 sm:min-h-0">
          <Switch id="limite-alertas" checked={alertsEnabled} onCheckedChange={setAlertsEnabled} />
          <span className="text-sm text-muted-foreground">
            Desliga para acompanhares o limite sem avisos.
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
          {pending ? 'A guardar…' : limit === undefined ? 'Definir limite' : 'Guardar limite'}
        </Button>
      </div>
    </form>
  );
}
