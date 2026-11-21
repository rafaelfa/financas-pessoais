'use client';

import { useId, useState, useTransition } from 'react';
import { toast } from 'sonner';

import type { DescriptionUsage } from '@repo/shared';

import { DescriptionCombobox } from '@/components/description-combobox';
import { MoneyInput } from '@/components/money-input';
import { buildCategoryOptions } from '@/components/transaction-quick-add';
import { TRANSACTION_STATUS_LABELS } from '@/components/transaction-kind-badge';
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
import { Switch } from '@/components/ui/switch';
import { updateTransaction } from '@/server/transactions-actions';
import type { AccountView } from '@/server/accounts';
import type { CategoryView } from '@/server/categories';
import type { TransactionView } from '@/server/transactions';
import { toFieldErrors } from '@/server/result';
import { updateTransactionSchema } from '@repo/shared/schemas/domain';

/**
 * Edição de um lançamento existente.
 *
 * A **natureza** não se altera: um gasto não passa a ganho, porque isso mudaria
 * a leitura de meses já fechados. O que se corrige aqui é o valor, a data, a
 * descrição, a conta, a categoria e o estado.
 *
 * O sinal do valor também não se escolhe: mantém-se o que o lançamento já tinha
 * (um gasto continua negativo, um ganho positivo), para o utilizador só escrever
 * o número que vê no talão.
 */

/** Valor sentinela: o Radix Select reserva a string vazia. */
const NO_CATEGORY = '__sem_categoria__';

/** Alvo de toque: 44 px em telemóvel, denso a partir de `sm`. */
const TOUCH = 'min-h-11 sm:min-h-8';

export function TransactionEditDialog({
  transaction,
  accounts,
  categories,
  descriptions,
  open,
  onOpenChange,
}: {
  readonly transaction: TransactionView;
  readonly accounts: readonly AccountView[];
  readonly categories: readonly CategoryView[];
  readonly descriptions: readonly DescriptionUsage[];
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/*
        `max-h` + `overflow-y-auto`: a lista de sugestões entra no fluxo do
        formulário (são mais 234 px) e, sem isto, num ecrã de 568 px o rodapé
        saía da janela — e o Radix bloqueia o scroll do `body`, por isso não
        havia como lá chegar.
      */}
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar lançamento</DialogTitle>
          <DialogDescription>
            Corrigir um movimento não reescreve o passado: altera este registo e o saldo
            recalcula-se a partir dele.
          </DialogDescription>
        </DialogHeader>

        <EditTransactionForm
          transaction={transaction}
          accounts={accounts}
          categories={categories}
          descriptions={descriptions}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function EditTransactionForm({
  transaction,
  accounts,
  categories,
  descriptions,
  onDone,
}: {
  readonly transaction: TransactionView;
  readonly accounts: readonly AccountView[];
  readonly categories: readonly CategoryView[];
  readonly descriptions: readonly DescriptionUsage[];
  readonly onDone: () => void;
}) {
  const amountFieldId = useId();
  const dateFieldId = useId();
  const descriptionFieldId = useId();

  const [pending, startTransition] = useTransition();
  const [amountInCents, setAmountInCents] = useState<number | null>(
    Math.abs(transaction.amountInCents),
  );
  const [date, setDate] = useState(transaction.date);
  const [description, setDescription] = useState(transaction.description ?? '');
  const [accountId, setAccountId] = useState(transaction.accountId ?? accounts[0]?.id ?? '');
  const [categoryId, setCategoryId] = useState(transaction.categoryId ?? '');
  const [status, setStatus] = useState(transaction.status);
  const [settled, setSettled] = useState(transaction.settled);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function errorFor(field: string): string | undefined {
    return fieldErrors[field]?.[0];
  }

  const showCategory = transaction.kind === 'expense' || transaction.kind === 'income';

  /**
   * Numa transferência a conta não se edita: mudar a conta de uma perna é outra
   * operação (o servidor recusa-a, e bem). O campo deixa de ser oferecido e o
   * `accountId` deixa de ser enviado — antes vinha sempre, por isso gravar uma
   * transferência falhava sempre, mesmo mudando só a descrição.
   */
  const isTransfer = transaction.kind === 'transfer';
  const categoryOptions = buildCategoryOptions(
    categories,
    transaction.kind === 'income' ? 'income' : 'expense',
  );

  /** O sinal original preserva-se: é ele que diz se o dinheiro sai ou entra. */
  const sign = transaction.amountInCents < 0 ? -1 : 1;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const trimmed = description.trim();

    const parsed = updateTransactionSchema.safeParse({
      id: transaction.id,
      amountInCents: sign * Math.abs(amountInCents ?? 0),
      date,
      // Limpar a descrição manda `null`: o schema de atualização aceita-o, e
      // uma string vazia ficaria na base como uma descrição que existe e não
      // diz nada — uma sugestão em branco no histórico.
      description: trimmed === '' ? null : trimmed,
      ...(isTransfer ? {} : { accountId }),
      ...(showCategory ? { categoryId: categoryId === '' ? null : categoryId } : {}),
      status,
      settled,
    });

    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      return;
    }

    startTransition(async () => {
      const result = await updateTransaction(parsed.data);

      if (!result.ok) {
        setFormError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }

      toast.success('Lançamento atualizado.');
      onDone();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field data-invalid={errorFor('amountInCents') !== undefined}>
        <FieldLabel htmlFor={amountFieldId}>Valor</FieldLabel>
        {/* Sem `aria-invalid` próprio: o `MoneyInput` não o aceita e num
            `role="group"` seria ARIA inválido. A mensagem vai por
            `aria-describedby`. */}
        <div
          role="group"
          aria-describedby={
            errorFor('amountInCents') === undefined ? undefined : 'editar-valor-erro'
          }
        >
          <MoneyInput
            id={amountFieldId}
            valueInCents={amountInCents}
            onValueChange={setAmountInCents}
          />
        </div>
        <FieldDescription>
          {isTransfer
            ? 'O valor é espelhado automaticamente na outra conta.'
            : sign < 0
              ? 'Escreve o valor sem sinal: continua a ser uma saída.'
              : 'Escreve o valor sem sinal: continua a ser uma entrada.'}
        </FieldDescription>
        <FieldError id="editar-valor-erro">{errorFor('amountInCents')}</FieldError>
      </Field>

      <Field data-invalid={errorFor('date') !== undefined}>
        <FieldLabel htmlFor={dateFieldId}>Data</FieldLabel>
        <Input
          id={dateFieldId}
          type="date"
          value={date}
          required
          className={TOUCH}
          aria-invalid={errorFor('date') !== undefined}
          aria-describedby={errorFor('date') === undefined ? undefined : 'editar-data-erro'}
          onChange={(event) => setDate(event.target.value)}
        />
        <FieldError id="editar-data-erro">{errorFor('date')}</FieldError>
      </Field>

      <Field data-invalid={errorFor('description') !== undefined}>
        <FieldLabel htmlFor={descriptionFieldId}>Descrição</FieldLabel>
        <DescriptionCombobox
          id={descriptionFieldId}
          value={description}
          onChange={setDescription}
          suggestions={descriptions}
          placeholder="Sem descrição"
          className={TOUCH}
          invalid={errorFor('description') !== undefined}
          describedBy={errorFor('description') === undefined ? undefined : 'editar-descricao-erro'}
        />
        <FieldError id="editar-descricao-erro">{errorFor('description')}</FieldError>
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        {isTransfer ? (
          <p className="text-sm text-muted-foreground sm:col-span-2">
            Numa transferência a conta não se altera: para mover o dinheiro a partir de outra conta,
            elimina esta transferência e cria outra.
          </p>
        ) : (
          <div className="space-y-1">
            <FieldLabel htmlFor="editar-conta">Conta</FieldLabel>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger
                id="editar-conta"
                aria-required
                className={`w-full ${TOUCH}`}
                aria-invalid={errorFor('accountId') !== undefined}
                aria-describedby={
                  errorFor('accountId') === undefined ? undefined : 'editar-conta-erro'
                }
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError id="editar-conta-erro">{errorFor('accountId')}</FieldError>
          </div>
        )}

        {showCategory ? (
          <div className="space-y-1">
            <FieldLabel htmlFor="editar-categoria">Categoria</FieldLabel>
            <Select
              value={categoryId === '' ? NO_CATEGORY : categoryId}
              onValueChange={(next) => setCategoryId(next === NO_CATEGORY ? '' : next)}
            >
              <SelectTrigger
                id="editar-categoria"
                className={`w-full ${TOUCH}`}
                aria-invalid={errorFor('categoryId') !== undefined}
                aria-describedby={
                  errorFor('categoryId') === undefined ? undefined : 'editar-categoria-erro'
                }
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CATEGORY}>Sem categoria</SelectItem>
                {categoryOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError id="editar-categoria-erro">{errorFor('categoryId')}</FieldError>
          </div>
        ) : null}

        <div className="space-y-1">
          <FieldLabel htmlFor="editar-estado">Estado</FieldLabel>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger
              id="editar-estado"
              className={`w-full ${TOUCH}`}
              aria-invalid={errorFor('status') !== undefined}
              aria-describedby={errorFor('status') === undefined ? undefined : 'editar-estado-erro'}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TRANSACTION_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError id="editar-estado-erro">{errorFor('status')}</FieldError>
        </div>
      </div>

      <Field>
        <FieldLabel htmlFor="editar-liquidado">Já está liquidado</FieldLabel>
        <div className="flex min-h-11 items-center gap-3 sm:min-h-0">
          <Switch id="editar-liquidado" checked={settled} onCheckedChange={setSettled} />
          <span className="text-sm text-muted-foreground">
            Só o que está liquidado move o saldo da conta.
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
          {pending ? 'A guardar…' : 'Guardar alterações'}
        </Button>
      </div>
    </form>
  );
}
