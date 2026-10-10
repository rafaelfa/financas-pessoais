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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { updateInstallmentPlan } from '@/server/installments-actions';
import { toFieldErrors } from '@/server/result';
import { updateInstallmentPlanSchema } from '@repo/shared/schemas/domain';
import { addMonths, invoiceDatesFor, splitInstallments } from '@repo/shared';

/**
 * Edição de um plano de parcelamento.
 *
 * No sistema de referência um parcelamento manual não se podia editar de todo.
 * Aqui edita-se, mas nunca às cegas: antes de guardar, a pré-visualização mostra
 * o novo plano — quantas parcelas, quanto vale cada uma e em que faturas (fecho
 * e vencimento) é que elas caem.
 *
 * A repartição e as datas são calculadas com as **mesmas funções puras** que o
 * servidor usa (`splitInstallments` e `invoiceDatesFor`), para a promessa da
 * pré-visualização não divergir do que fica gravado.
 */

/** Campos que o formulário lê de um plano existente. */
export interface EditableInstallmentPlan {
  readonly planId: string;
  readonly cardName: string;
  readonly description: string;
  readonly totalAmountInCents: number;
  readonly installmentCount: number;
  readonly perInstallmentInCents: number;
  readonly firstDate: string;
}

/** Alvo de toque: 44 px em telemóvel, denso a partir de `sm`. */
const TOUCH = 'min-h-11 sm:min-h-8';

/** Limites do número de parcelas, iguais aos do schema. */
const MIN_INSTALLMENTS = 2;
const MAX_INSTALLMENTS = 72;

export function InstallmentEditDialog({
  plan,
  closingDay,
  dueDay,
  open,
  onOpenChange,
}: {
  readonly plan: EditableInstallmentPlan;
  /** Dia de fecho do cartão, para a pré-visualização das faturas. */
  readonly closingDay: number | null;
  readonly dueDay: number | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar parcelamento</DialogTitle>
          <DialogDescription>
            {plan.cardName} — alterar o plano recalcula as parcelas e as faturas afetadas.
          </DialogDescription>
        </DialogHeader>

        <InstallmentPlanForm
          plan={plan}
          closingDay={closingDay}
          dueDay={dueDay}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function InstallmentPlanForm({
  plan,
  closingDay,
  dueDay,
  onDone,
}: {
  readonly plan: EditableInstallmentPlan;
  readonly closingDay: number | null;
  readonly dueDay: number | null;
  readonly onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [totalAmountInCents, setTotalAmountInCents] = useState<number | null>(
    plan.totalAmountInCents,
  );
  const [installmentCount, setInstallmentCount] = useState(String(plan.installmentCount));
  const [firstDate, setFirstDate] = useState(plan.firstDate);
  const [description, setDescription] = useState(plan.description);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function errorFor(field: string): string | undefined {
    return fieldErrors[field]?.[0];
  }

  const parsedCount = Number(installmentCount);
  const countIsValid =
    Number.isInteger(parsedCount) &&
    parsedCount >= MIN_INSTALLMENTS &&
    parsedCount <= MAX_INSTALLMENTS;
  const totalIsValid = totalAmountInCents !== null && totalAmountInCents > 0;
  const dateIsValid = /^\d{4}-\d{2}-\d{2}$/.test(firstDate);
  const canPreview = countIsValid && totalIsValid && dateIsValid;

  // Pré-visualização: mesma repartição e mesmas datas que o servidor vai gravar.
  const preview =
    canPreview && totalAmountInCents !== null
      ? buildPreview({
          totalAmountInCents,
          installmentCount: parsedCount,
          firstDate,
          closingDay,
          dueDay,
        })
      : null;

  const trimmedDescription = description.trim();

  const changed =
    (totalAmountInCents !== null && totalAmountInCents !== plan.totalAmountInCents) ||
    (countIsValid && parsedCount !== plan.installmentCount) ||
    (dateIsValid && firstDate !== plan.firstDate) ||
    trimmedDescription !== plan.description;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    // Só os campos que mudaram: o schema recusa um pedido sem alterações.
    const payload: Record<string, unknown> = { planId: plan.planId };

    if (totalAmountInCents !== null && totalAmountInCents !== plan.totalAmountInCents) {
      payload.totalAmountInCents = totalAmountInCents;
    }

    if (countIsValid && parsedCount !== plan.installmentCount) {
      payload.installmentCount = parsedCount;
    }

    if (dateIsValid && firstDate !== plan.firstDate) {
      payload.firstDate = firstDate;
    }

    if (trimmedDescription !== plan.description) {
      payload.description = trimmedDescription;
    }

    const parsed = updateInstallmentPlanSchema.safeParse(payload);

    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      setFormError(parsed.error.issues[0]?.message ?? null);
      return;
    }

    startTransition(async () => {
      const result = await updateInstallmentPlan(parsed.data);

      if (!result.ok) {
        setFormError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }

      const invoiceCount = result.data.affectedInvoiceIds.length;
      toast.success(
        invoiceCount === 1
          ? 'Parcelamento atualizado. 1 fatura foi recalculada.'
          : `Parcelamento atualizado. ${invoiceCount} faturas foram recalculadas.`,
      );
      onDone();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field data-invalid={errorFor('description') !== undefined}>
        <FieldLabel htmlFor="parcela-descricao">Descrição</FieldLabel>
        <Input
          id="parcela-descricao"
          value={description}
          autoComplete="off"
          placeholder="ex.: Máquina de lavar"
          className={TOUCH}
          aria-invalid={errorFor('description') !== undefined}
          aria-describedby={
            errorFor('description') === undefined ? undefined : 'parcela-descricao-erro'
          }
          onChange={(event) => setDescription(event.target.value)}
        />
        <FieldError id="parcela-descricao-erro">{errorFor('description')}</FieldError>
      </Field>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field data-invalid={errorFor('totalAmountInCents') !== undefined}>
          <FieldLabel htmlFor="parcela-total">Valor total</FieldLabel>
          <div
            role="group"
            aria-describedby={
              errorFor('totalAmountInCents') === undefined ? undefined : 'parcela-total-erro'
            }
          >
            <MoneyInput
              id="parcela-total"
              valueInCents={totalAmountInCents}
              onValueChange={setTotalAmountInCents}
            />
          </div>
          <FieldError id="parcela-total-erro">{errorFor('totalAmountInCents')}</FieldError>
        </Field>

        <Field data-invalid={errorFor('installmentCount') !== undefined}>
          <FieldLabel htmlFor="parcela-numero">Nº de parcelas</FieldLabel>
          <Input
            id="parcela-numero"
            type="number"
            inputMode="numeric"
            min={MIN_INSTALLMENTS}
            max={MAX_INSTALLMENTS}
            value={installmentCount}
            required
            className={TOUCH}
            aria-invalid={errorFor('installmentCount') !== undefined || !countIsValid}
            aria-describedby={
              errorFor('installmentCount') === undefined ? undefined : 'parcela-numero-erro'
            }
            onChange={(event) => setInstallmentCount(event.target.value)}
          />
          <FieldDescription>
            Entre {MIN_INSTALLMENTS} e {MAX_INSTALLMENTS}.
          </FieldDescription>
          <FieldError id="parcela-numero-erro">
            {errorFor('installmentCount') ??
              (countIsValid
                ? undefined
                : `Um parcelamento tem entre ${MIN_INSTALLMENTS} e ${MAX_INSTALLMENTS} parcelas.`)}
          </FieldError>
        </Field>

        <Field data-invalid={errorFor('firstDate') !== undefined}>
          <FieldLabel htmlFor="parcela-data">Data da 1.ª parcela</FieldLabel>
          <Input
            id="parcela-data"
            type="date"
            value={firstDate}
            required
            className={TOUCH}
            aria-invalid={errorFor('firstDate') !== undefined}
            aria-describedby={errorFor('firstDate') === undefined ? undefined : 'parcela-data-erro'}
            onChange={(event) => setFirstDate(event.target.value)}
          />
          <FieldError id="parcela-data-erro">{errorFor('firstDate')}</FieldError>
        </Field>
      </div>

      <section aria-labelledby="parcela-previsualizacao" className="space-y-2">
        <div className="space-y-1">
          <h3 id="parcela-previsualizacao" className="font-heading text-sm font-medium">
            Pré-visualização do novo plano
          </h3>
          {preview === null ? (
            <p className="text-sm text-muted-foreground">
              {closingDay === null || dueDay === null
                ? 'Sem o dia de fecho do cartão não consigo mostrar em que faturas as parcelas caem. As datas ficam corretas depois de guardares.'
                : 'Preenche o valor total, o número de parcelas e a data da primeira para veres o plano.'}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {preview.parts.length} {preview.parts.length === 1 ? 'parcela' : 'parcelas'} em{' '}
              {preview.invoiceCount === 1 ? '1 fatura' : `${preview.invoiceCount} faturas`}.
              {preview.hasUnevenParts
                ? ' As primeiras parcelas levam o cêntimo a mais, para a soma ser exatamente o total.'
                : null}
            </p>
          )}
        </div>

        {preview === null ? null : (
          <div className="max-h-64 overflow-y-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead className="w-28">Data</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Fatura (fecho → vencimento)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.rows.map((row) => (
                  <TableRow key={row.number}>
                    <TableCell className="font-numeric tabular-nums">{row.number}</TableCell>
                    <TableCell className="font-numeric text-muted-foreground tabular-nums">
                      {formatDay(row.date)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Amount amountInCents={row.amountInCents} tone="neutral" />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.closingDate === null || row.dueDate === null
                        ? '—'
                        : `${formatDay(row.closingDate)} → ${formatDay(row.dueDate)}`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {formError === null ? null : (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {changed ? 'Há alterações por guardar.' : 'Sem alterações.'}
        </p>

        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className={TOUCH}
            disabled={pending}
            onClick={onDone}
          >
            Cancelar
          </Button>
          <Button type="submit" className={TOUCH} disabled={pending || !changed}>
            {pending ? 'A guardar…' : 'Guardar e recalcular'}
          </Button>
        </div>
      </div>
    </form>
  );
}

interface PreviewRow {
  readonly number: number;
  readonly date: string;
  readonly amountInCents: number;
  readonly closingDate: string | null;
  readonly dueDate: string | null;
}

/**
 * Constrói a pré-visualização: uma parcela por mês e, para cada uma, a fatura em
 * que cai, segundo a regra do fecho (docs/spec/F1, regra 15).
 */
function buildPreview({
  totalAmountInCents,
  installmentCount,
  firstDate,
  closingDay,
  dueDay,
}: {
  readonly totalAmountInCents: number;
  readonly installmentCount: number;
  readonly firstDate: string;
  readonly closingDay: number | null;
  readonly dueDay: number | null;
}): {
  readonly rows: readonly PreviewRow[];
  readonly parts: readonly number[];
  readonly invoiceCount: number;
  readonly hasUnevenParts: boolean;
} {
  const parts = splitInstallments(totalAmountInCents, installmentCount);
  const closings = new Set<string>();

  const rows = parts.map((amountInCents, index) => {
    // A mesma função que a ação de servidor usa para datar cada parcela: se a
    // regra mudar, a pré-visualização muda com ela.
    const date = addMonths(firstDate, index);
    const dates =
      closingDay === null || dueDay === null
        ? null
        : invoiceDatesFor({ purchaseDate: date, closingDay, dueDay });

    if (dates !== null) {
      closings.add(dates.closingDate);
    }

    return {
      number: index + 1,
      date,
      amountInCents,
      closingDate: dates?.closingDate ?? null,
      dueDate: dates?.dueDate ?? null,
    };
  });

  const first = parts[0] ?? 0;

  return {
    rows,
    parts,
    invoiceCount: closings.size,
    hasUnevenParts: parts.some((part) => part !== first),
  };
}

/** Data de calendário em formato curto, sem deslocação de fuso. */
function formatDay(date: string): string {
  return new Intl.DateTimeFormat('pt-PT', { timeZone: 'UTC', dateStyle: 'short' }).format(
    new Date(`${date}T00:00:00Z`),
  );
}
