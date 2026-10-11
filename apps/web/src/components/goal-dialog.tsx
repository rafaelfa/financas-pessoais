'use client';

import { Info } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { createGoal, updateGoal } from '@/server/goals-actions';
import { toFieldErrors } from '@/server/result';
import { createGoalSchema, updateGoalSchema } from '@repo/shared/schemas/domain';

/**
 * Criação e edição de um objetivo.
 *
 * O “valor já reservado” é o **ponto de partida** do progresso, não um depósito:
 * conta como se já lá estivesse desde o início. Na criação é natural (uma
 * poupança que já existia); na edição avisamos, porque mexer nele muda o
 * acumulado sem criar movimento nenhum no histórico.
 *
 * A listagem já devolve este valor, por isso na edição o campo aparece com o que
 * está guardado. **Deixá-lo em branco significa “não mexer”**, nunca zero: é a
 * diferença entre corrigir o ponto de partida e apagá-lo.
 */

/** Campos que o formulário lê de um objetivo existente. */
export interface EditableGoal {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly targetAmountInCents: number;
  readonly targetDate: string;
  readonly contributionFrequency: string;
  readonly initialReservedInCents: number;
}

/** Frequências aceites pelo schema (o anual não faz parte deste contrato). */
const FREQUENCY_OPTIONS = [
  { value: 'monthly', label: 'Todos os meses' },
  { value: 'weekly', label: 'Todas as semanas' },
  { value: 'quarterly', label: 'Todos os trimestres' },
] as const;

/** Alvo de toque: 44 px em telemóvel, denso a partir de `sm`. */
const TOUCH = 'min-h-11 sm:min-h-8';

export function GoalDialog({
  mode,
  goal,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  readonly mode: 'create' | 'edit';
  readonly goal?: EditableGoal;
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
          <DialogTitle>{mode === 'create' ? 'Novo objetivo' : 'Editar objetivo'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Quanto queres juntar e até quando. Com a data, calculamos o esforço necessário em cada período.'
              : 'Muda o alvo, o prazo ou a frequência. O que já está guardado não se perde.'}
          </DialogDescription>
        </DialogHeader>

        <GoalForm mode={mode} goal={goal} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function GoalForm({
  mode,
  goal,
  onDone,
}: {
  readonly mode: 'create' | 'edit';
  readonly goal?: EditableGoal;
  readonly onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(goal?.name ?? '');
  const [description, setDescription] = useState(goal?.description ?? '');
  const [targetAmountInCents, setTargetAmountInCents] = useState<number | null>(
    goal?.targetAmountInCents ?? null,
  );
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? '');
  const [contributionFrequency, setContributionFrequency] = useState(
    goal?.contributionFrequency ?? 'monthly',
  );
  const [initialReservedInCents, setInitialReservedInCents] = useState<number | null>(
    goal?.initialReservedInCents ?? null,
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function errorFor(field: string): string | undefined {
    return fieldErrors[field]?.[0];
  }

  const isEdit = mode === 'edit';

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const trimmed = description.trim();

    const base = {
      name: name.trim(),
      // A descrição vazia é enviada de propósito: é a forma de a limpar.
      description: trimmed,
      targetAmountInCents: targetAmountInCents ?? 0,
      targetDate,
      contributionFrequency,
      ...(initialReservedInCents === null ? {} : { initialReservedInCents }),
    };

    const payload = mode === 'create' ? base : { ...base, id: goal?.id ?? '' };

    const parsed =
      mode === 'create' ? createGoalSchema.safeParse(payload) : updateGoalSchema.safeParse(payload);

    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      return;
    }

    startTransition(async () => {
      const result =
        mode === 'create' ? await createGoal(parsed.data) : await updateGoal(parsed.data);

      if (!result.ok) {
        setFormError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }

      toast.success(mode === 'create' ? 'Objetivo criado.' : 'Objetivo atualizado.');
      onDone();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field data-invalid={errorFor('name') !== undefined}>
        <FieldLabel htmlFor="objetivo-nome">Nome</FieldLabel>
        <Input
          id="objetivo-nome"
          value={name}
          required
          autoComplete="off"
          placeholder="ex.: Férias de verão"
          className={TOUCH}
          aria-invalid={errorFor('name') !== undefined}
          aria-describedby={errorFor('name') === undefined ? undefined : 'objetivo-nome-erro'}
          onChange={(event) => setName(event.target.value)}
        />
        <FieldError id="objetivo-nome-erro">{errorFor('name')}</FieldError>
      </Field>

      <Field data-invalid={errorFor('description') !== undefined}>
        <FieldLabel htmlFor="objetivo-descricao">Descrição</FieldLabel>
        <Textarea
          id="objetivo-descricao"
          value={description}
          rows={2}
          placeholder="Opcional"
          aria-invalid={errorFor('description') !== undefined}
          aria-describedby={
            errorFor('description') === undefined ? undefined : 'objetivo-descricao-erro'
          }
          onChange={(event) => setDescription(event.target.value)}
        />
        <FieldError id="objetivo-descricao-erro">{errorFor('description')}</FieldError>
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field data-invalid={errorFor('targetAmountInCents') !== undefined}>
          <FieldLabel htmlFor="objetivo-alvo">Valor a juntar</FieldLabel>
          <div
            role="group"
            aria-describedby={
              errorFor('targetAmountInCents') === undefined ? undefined : 'objetivo-alvo-erro'
            }
          >
            <MoneyInput
              id="objetivo-alvo"
              valueInCents={targetAmountInCents}
              onValueChange={setTargetAmountInCents}
            />
          </div>
          <FieldError id="objetivo-alvo-erro">{errorFor('targetAmountInCents')}</FieldError>
        </Field>

        <Field data-invalid={errorFor('targetDate') !== undefined}>
          <FieldLabel htmlFor="objetivo-prazo">Prazo</FieldLabel>
          <Input
            id="objetivo-prazo"
            type="date"
            value={targetDate}
            required
            className={TOUCH}
            aria-invalid={errorFor('targetDate') !== undefined}
            aria-describedby={
              errorFor('targetDate') === undefined ? undefined : 'objetivo-prazo-erro'
            }
            onChange={(event) => setTargetDate(event.target.value)}
          />
          <FieldError id="objetivo-prazo-erro">{errorFor('targetDate')}</FieldError>
        </Field>
      </div>

      <div className="space-y-1">
        <Label htmlFor="objetivo-frequencia">Frequência do aporte</Label>
        <Select value={contributionFrequency} onValueChange={setContributionFrequency}>
          <SelectTrigger id="objetivo-frequencia" className={`w-full ${TOUCH}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FREQUENCY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          É a cadência com que contamos os períodos que faltam até ao prazo.
        </p>
      </div>

      {isEdit ? (
        <Alert>
          <Info aria-hidden />
          <AlertTitle>Valor já reservado</AlertTitle>
          <AlertDescription>
            É o ponto de partida do progresso, não um depósito: alterá-lo muda o acumulado sem criar
            movimento no histórico. Deixa em branco para não mexer.
          </AlertDescription>
        </Alert>
      ) : null}

      <Field data-invalid={errorFor('initialReservedInCents') !== undefined}>
        <FieldLabel htmlFor="objetivo-reservado">
          {isEdit ? 'Corrigir o valor já reservado' : 'Valor já reservado'}
        </FieldLabel>
        <div
          role="group"
          aria-describedby={
            errorFor('initialReservedInCents') === undefined ? undefined : 'objetivo-reservado-erro'
          }
        >
          <MoneyInput
            id="objetivo-reservado"
            valueInCents={initialReservedInCents}
            onValueChange={setInitialReservedInCents}
          />
        </div>
        <FieldDescription>
          {isEdit
            ? 'Em branco: mantém o valor atual.'
            : 'O que já tens guardado para este objetivo. Podes deixar a zero e registar os depósitos depois.'}
        </FieldDescription>
        <FieldError id="objetivo-reservado-erro">{errorFor('initialReservedInCents')}</FieldError>
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
          {pending ? 'A guardar…' : mode === 'create' ? 'Criar objetivo' : 'Guardar alterações'}
        </Button>
      </div>
    </form>
  );
}
