'use client';

import { ArrowLeftRight, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { MoneyInput } from '@/components/money-input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createTransaction, createTransfer } from '@/server/transactions-actions';
import type { AccountView } from '@/server/accounts';
import type { CategoryView } from '@/server/categories';
import { toFieldErrors } from '@/server/result';
import { createTransactionSchema, createTransferSchema } from '@repo/shared/schemas/domain';
import { cn } from '@/lib/utils';

/**
 * Lançamento rápido.
 *
 * É o formulário que se usa dezenas de vezes por mês, muitas vezes de pé no
 * supermercado. Por isso:
 * - o valor aceita contas escritas no campo e é confirmado com `Enter`;
 * - `Enter` em qualquer campo (menos nos seletores) lança o movimento;
 * - a conta, a data e a natureza ficam preenchidas depois de guardar, para o
 *   lançamento seguinte ser só escrever o valor;
 * - o sinal é do formulário, não do utilizador: um gasto é sempre subtraído.
 */

type QuickMode = 'expense' | 'income' | 'transfer';

/** Valor sentinela: o Radix Select reserva a string vazia. */
const NO_CATEGORY = '__sem_categoria__';

/** Alvo de toque: 44 px em telemóvel, denso a partir de `sm`. */
const TOUCH = 'min-h-11 sm:min-h-8';

export function TransactionQuickAdd({
  accounts,
  categories,
  today,
}: {
  readonly accounts: readonly AccountView[];
  readonly categories: readonly CategoryView[];
  /** Data de hoje em Portugal, como `YYYY-MM-DD`. */
  readonly today: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const amountFieldId = useId();
  const descriptionFieldId = useId();
  const dateFieldId = useId();

  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<QuickMode>('expense');
  const [amountInCents, setAmountInCents] = useState<number | null>(null);
  const [amountResetKey, setAmountResetKey] = useState(0);
  const [accountId, setAccountId] = useState(() => defaultAccountId(accounts));
  const [toAccountId, setToAccountId] = useState(
    () => accounts.find((account) => account.id !== defaultAccountId(accounts))?.id ?? '',
  );
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitRequested, setSubmitRequested] = useState(0);

  const activeAccounts = accounts.filter((account) => !account.archived);
  const needsTwoAccounts = mode === 'transfer' && activeAccounts.length < 2;

  /**
   * O `Enter` no campo do valor confirma primeiro a expressão lá dentro (pode
   * ser `12,50 + 3,20`) e só no render seguinte é que o formulário é submetido.
   * Submeter já daria o valor anterior — o campo ainda não o tinha propagado.
   */
  useEffect(() => {
    if (submitRequested === 0) {
      return;
    }

    formRef.current?.requestSubmit();
  }, [submitRequested]);

  function errorFor(field: string): string | undefined {
    return fieldErrors[field]?.[0];
  }

  const categoryOptions = buildCategoryOptions(
    categories,
    mode === 'income' ? 'income' : 'expense',
  );

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const trimmedDescription = description.trim();

    if (mode === 'transfer') {
      const parsed = createTransferSchema.safeParse({
        fromAccountId: accountId,
        toAccountId,
        amountInCents: Math.abs(amountInCents ?? 0),
        date,
        description: trimmedDescription === '' ? undefined : trimmedDescription,
      });

      if (!parsed.success) {
        setFieldErrors(toFieldErrors(parsed.error));
        return;
      }

      startTransition(async () => {
        const result = await createTransfer(parsed.data);

        if (!result.ok) {
          setFormError(result.error);
          setFieldErrors(result.fieldErrors ?? {});
          toast.error(result.error);
          return;
        }

        toast.success('Transferência registada nas duas contas.');
        resetAfterSuccess();
      });

      return;
    }

    // O sinal é decidido aqui: quem lança escreve o valor em módulo.
    const signedAmount =
      mode === 'income' ? Math.abs(amountInCents ?? 0) : -Math.abs(amountInCents ?? 0);

    const parsed = createTransactionSchema.safeParse({
      kind: mode,
      amountInCents: signedAmount,
      date,
      description: trimmedDescription === '' ? undefined : trimmedDescription,
      accountId,
      categoryId: categoryId === '' ? null : categoryId,
    });

    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      return;
    }

    startTransition(async () => {
      const result = await createTransaction(parsed.data);

      if (!result.ok) {
        setFormError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }

      toast.success(mode === 'income' ? 'Ganho registado.' : 'Gasto registado.');
      resetAfterSuccess();
    });
  }

  /** Limpa só o que muda entre lançamentos: valor e descrição. */
  function resetAfterSuccess() {
    setAmountInCents(null);
    setDescription('');
    setAmountResetKey((key) => key + 1);
    router.refresh();
  }

  function onFormKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }

    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    // Nos seletores e nos botões, `Enter` faz o que é deles: abrir, escolher, agir.
    if (target.closest('[data-slot="select-trigger"], button, textarea, a')) {
      return;
    }

    event.preventDefault();
    setSubmitRequested((count) => count + 1);
  }

  if (activeAccounts.length === 0) {
    return (
      <Alert>
        <Wallet aria-hidden />
        <AlertTitle>Precisas de uma conta antes de lançar</AlertTitle>
        <AlertDescription>
          Os lançamentos vivem dentro de uma conta. Cria a primeira — por exemplo, a conta onde
          recebes o ordenado.
          <span className="mt-2 block">
            <Button asChild size="sm" className={TOUCH}>
              <Link href="/contas">Ir para as contas</Link>
            </Button>
          </span>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lançamento rápido</CardTitle>
        <CardDescription>
          Escreve o valor e prime <kbd className="rounded border px-1">Enter</kbd>. A conta e a data
          ficam preenchidas para o próximo.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form
          ref={formRef}
          onSubmit={onSubmit}
          onKeyDown={onFormKeyDown}
          className="space-y-4"
          noValidate
        >
          <div className="space-y-1">
            <span id="lancamento-tipo" className="text-sm font-medium">
              Natureza
            </span>
            <div
              role="radiogroup"
              aria-labelledby="lancamento-tipo"
              className="flex flex-wrap gap-2"
            >
              {QUICK_MODES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={mode === option.value}
                  onClick={() => {
                    setMode(option.value);
                    setCategoryId('');
                  }}
                  className={cn(
                    'inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors sm:min-h-8',
                    mode === option.value
                      ? 'border-transparent bg-primary text-primary-foreground'
                      : 'border-border bg-background hover:bg-muted',
                  )}
                >
                  {option.value === 'transfer' ? (
                    <ArrowLeftRight className="size-4" aria-hidden />
                  ) : null}
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field data-invalid={errorFor('amountInCents') !== undefined}>
              <FieldLabel htmlFor={amountFieldId}>Valor</FieldLabel>
              {/* O `MoneyInput` não expõe `aria-invalid`; a mensagem segue por
                  `aria-describedby` e o estado inválido veste o `Field`. */}
              <div
                role="group"
                aria-describedby={
                  errorFor('amountInCents') === undefined ? undefined : 'lancamento-valor-erro'
                }
              >
                <MoneyInput
                  key={amountResetKey}
                  id={amountFieldId}
                  valueInCents={amountInCents}
                  onValueChange={setAmountInCents}
                  autoFocus={amountResetKey > 0}
                />
              </div>
              <FieldDescription>
                {mode === 'expense'
                  ? 'Escreve o valor sem sinal: um gasto é sempre subtraído.'
                  : mode === 'income'
                    ? 'Escreve o valor sem sinal: um ganho é sempre somado.'
                    : 'Valor a passar de uma conta para a outra.'}
              </FieldDescription>
              <FieldError id="lancamento-valor-erro">{errorFor('amountInCents')}</FieldError>
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
                aria-describedby={
                  errorFor('date') === undefined ? undefined : 'lancamento-data-erro'
                }
                onChange={(event) => setDate(event.target.value)}
              />
              <FieldError id="lancamento-data-erro">{errorFor('date')}</FieldError>
            </Field>

            <div className="space-y-1">
              <FieldLabel htmlFor="lancamento-conta">
                {mode === 'transfer' ? 'Da conta' : 'Conta'}
              </FieldLabel>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger
                  id="lancamento-conta"
                  aria-required
                  className={`w-full ${TOUCH}`}
                  aria-invalid={
                    errorFor('accountId') !== undefined || errorFor('fromAccountId') !== undefined
                  }
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
              <FieldError id="lancamento-conta-erro">
                {errorFor('accountId') ?? errorFor('fromAccountId')}
              </FieldError>
            </div>

            {mode === 'transfer' ? (
              <div className="space-y-1">
                <FieldLabel htmlFor="lancamento-destino">Para a conta</FieldLabel>
                <Select value={toAccountId} onValueChange={setToAccountId}>
                  <SelectTrigger
                    id="lancamento-destino"
                    aria-required
                    className={`w-full ${TOUCH}`}
                    aria-invalid={errorFor('toAccountId') !== undefined}
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
                <FieldError>{errorFor('toAccountId')}</FieldError>
              </div>
            ) : (
              <div className="space-y-1">
                <FieldLabel htmlFor="lancamento-categoria">Categoria</FieldLabel>
                <Select
                  value={categoryId === '' ? NO_CATEGORY : categoryId}
                  onValueChange={(next) => setCategoryId(next === NO_CATEGORY ? '' : next)}
                >
                  <SelectTrigger
                    id="lancamento-categoria"
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
                <FieldError>{errorFor('categoryId')}</FieldError>
              </div>
            )}

            <Field className="sm:col-span-2" data-invalid={errorFor('description') !== undefined}>
              <FieldLabel htmlFor={descriptionFieldId}>Descrição</FieldLabel>
              <Input
                id={descriptionFieldId}
                value={description}
                placeholder="Opcional — ex.: Compra do mês"
                autoComplete="off"
                className={TOUCH}
                aria-invalid={errorFor('description') !== undefined}
                aria-describedby={
                  errorFor('description') === undefined ? undefined : 'lancamento-descricao-erro'
                }
                onChange={(event) => setDescription(event.target.value)}
              />
              <FieldError id="lancamento-descricao-erro">{errorFor('description')}</FieldError>
            </Field>
          </div>

          {needsTwoAccounts ? (
            <p role="alert" className="text-sm text-destructive">
              Para transferir precisas de duas contas ativas. Cria ou reativa outra em Contas.
            </p>
          ) : null}

          {formError === null ? null : (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Button
              type="submit"
              className={`w-full sm:w-auto ${TOUCH}`}
              disabled={pending || needsTwoAccounts || amountInCents === null}
            >
              {pending ? 'A lançar…' : mode === 'transfer' ? 'Transferir' : 'Lançar'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

const QUICK_MODES: readonly { value: QuickMode; label: string }[] = [
  { value: 'expense', label: 'Gasto' },
  { value: 'income', label: 'Ganho' },
  { value: 'transfer', label: 'Transferência' },
];

/** Conta por omissão: a principal, ou a primeira ativa. */
function defaultAccountId(accounts: readonly AccountView[]): string {
  const active = accounts.filter((account) => !account.archived);

  return (active.find((account) => account.isPrimary) ?? active[0])?.id ?? '';
}

/**
 * Opções de categoria do tipo pedido.
 *
 * As categorias internas (transferência, fatura, ajuste) ficam de fora: não se
 * classificam gastos à mão com elas. As subcategorias aparecem indentadas sob o
 * nome da mãe, para o conjunto continuar legível.
 */
export function buildCategoryOptions(
  categories: readonly CategoryView[],
  kind: 'expense' | 'income',
): { value: string; label: string }[] {
  const ofKind = categories.filter((category) => category.kind === kind);
  const roots = ofKind.filter((category) => category.parentId === null);

  return roots.flatMap((root) => {
    const children = ofKind.filter((category) => category.parentId === root.id);

    return [
      ...(root.internal ? [] : [{ value: root.id, label: root.name }]),
      ...children
        .filter((child) => !child.internal)
        .map((child) => ({ value: child.id, label: `${root.name} › ${child.name}` })),
    ];
  });
}
