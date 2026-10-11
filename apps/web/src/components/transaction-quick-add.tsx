'use client';

import { ArrowLeftRight, CreditCard, Wallet } from 'lucide-react';
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
import type { CardView } from '@/server/cards';
import type { CategoryView } from '@/server/categories';
import { toFieldErrors } from '@/server/result';
import { createTransactionSchema, createTransferSchema } from '@repo/shared/schemas/domain';
import { addMonths, formatCurrency, invoiceDatesFor, splitInstallments } from '@repo/shared';
import { cn } from '@/lib/utils';

/**
 * Lançamento rápido.
 *
 * É o formulário que se usa dezenas de vezes por mês, muitas vezes de pé no
 * supermercado. Por isso:
 * - o valor aceita contas escritas no campo e é confirmado com `Enter`;
 * - `Enter` em qualquer campo (menos nos seletores) lança o movimento;
 * - a conta, a data, a forma de pagamento e o cartão ficam preenchidos depois de
 *   guardar, para o lançamento seguinte ser só escrever o valor;
 * - o sinal é do formulário, não do utilizador: um gasto é sempre subtraído.
 *
 * Compras a crédito: o cartão decide em que fatura a compra entra, e o formulário
 * diz qual é **antes** de guardar. Um parcelamento gera um lançamento por fatura,
 * com a soma exata do valor.
 */

type QuickMode = 'expense' | 'income' | 'transfer';

/** Valor sentinela: o Radix Select reserva a string vazia. */
const NO_CATEGORY = '__sem_categoria__';

/** Alvo de toque: 44 px em telemóvel, denso a partir de `sm`. */
const TOUCH = 'min-h-11 sm:min-h-8';

export function TransactionQuickAdd({
  accounts,
  cards,
  categories,
  today,
  initialCardId,
}: {
  readonly accounts: readonly AccountView[];
  readonly cards: readonly CardView[];
  readonly categories: readonly CategoryView[];
  /** Data de hoje em Portugal, como `YYYY-MM-DD`. */
  readonly today: string;
  /** Cartão pré-escolhido, quando se chega do ecrã dos cartões. */
  readonly initialCardId?: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const amountFieldId = useId();
  const descriptionFieldId = useId();
  const dateFieldId = useId();

  const activeCards = cards.filter((card) => !card.archived);

  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<QuickMode>('expense');
  const [paymentMethod, setPaymentMethod] = useState<'debit' | 'credit'>(
    initialCardId === undefined ? 'debit' : 'credit',
  );
  const [cardId, setCardId] = useState(() => initialCardId ?? activeCards[0]?.id ?? '');
  const [installmentMode, setInstallmentMode] = useState<'single' | 'installment'>('single');
  const [installmentCount, setInstallmentCount] = useState('12');
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

  const selectedCard = activeCards.find((card) => card.id === cardId) ?? null;
  const isTransfer = mode === 'transfer';
  /**
   * Compras a crédito existem em gastos e ganhos (um estorno no cartão também
   * acontece). Transferências entre contas não passam por cartão.
   */
  const usesCredit = !isTransfer && paymentMethod === 'credit';
  const usesInstallments = usesCredit && mode === 'expense' && installmentMode === 'installment';
  const installmentCountNumber = Number(installmentCount);
  const installmentPreview =
    usesInstallments &&
    amountInCents !== null &&
    Number.isInteger(installmentCountNumber) &&
    installmentCountNumber >= 2
      ? splitInstallments(amountInCents, installmentCountNumber)
      : null;
  const creditNeedsCard = usesCredit && selectedCard === null;

  /**
   * Onde é que a compra cai. Calculado com `invoiceDatesFor`, a **mesma** função
   * que o servidor usa para criar a fatura: uma conta paralela no cliente
   * acabaria a divergir da regra.
   */
  const invoicePreview =
    usesCredit && selectedCard !== null
      ? invoiceDatesFor({
          purchaseDate: date,
          closingDay: selectedCard.closingDay,
          dueDay: selectedCard.dueDay,
        })
      : null;

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
      paymentMethod: usesCredit ? 'credit' : 'debit',
      cardId: usesCredit ? cardId : null,
      paymentCondition: usesInstallments ? 'installment' : 'single',
      installmentCount: usesInstallments ? installmentCountNumber : undefined,
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

      toast.success(
        usesInstallments
          ? `Compra registada em ${installmentCountNumber} parcelas.`
          : mode === 'income'
            ? 'Ganho registado.'
            : 'Gasto registado.',
      );
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

          {isTransfer ? null : (
            <div className="space-y-1">
              <span id="lancamento-pagamento" className="text-sm font-medium">
                Forma de pagamento
              </span>
              <div
                role="radiogroup"
                aria-labelledby="lancamento-pagamento"
                className="flex flex-wrap gap-2"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={paymentMethod === 'debit'}
                  onClick={() => setPaymentMethod('debit')}
                  className={cn(
                    'inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors sm:min-h-8',
                    paymentMethod === 'debit'
                      ? 'border-transparent bg-primary text-primary-foreground'
                      : 'border-border bg-background hover:bg-muted',
                  )}
                >
                  <Wallet className="size-4" aria-hidden />
                  Conta
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={paymentMethod === 'credit'}
                  disabled={activeCards.length === 0}
                  onClick={() => setPaymentMethod('credit')}
                  className={cn(
                    'inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors sm:min-h-8',
                    paymentMethod === 'credit'
                      ? 'border-transparent bg-primary text-primary-foreground'
                      : 'border-border bg-background hover:bg-muted',
                    activeCards.length === 0 ? 'cursor-not-allowed opacity-50' : '',
                  )}
                >
                  <CreditCard className="size-4" aria-hidden />
                  Cartão de crédito
                </button>
              </div>
              {activeCards.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Ainda não tens cartões.{' '}
                  <Link href="/cartoes" className="underline underline-offset-2">
                    Cria um cartão
                  </Link>{' '}
                  para registar compras a crédito.
                </p>
              ) : null}
            </div>
          )}

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

            {usesCredit ? (
              <div className="space-y-1">
                <FieldLabel htmlFor="lancamento-cartao">Cartão</FieldLabel>
                <Select
                  value={cardId}
                  onValueChange={(next) => {
                    setCardId(next);

                    // A fatura é paga pela conta do cartão: poupa uma escolha.
                    const chosen = activeCards.find((card) => card.id === next);

                    if (chosen?.paymentAccountId != null) {
                      setAccountId(chosen.paymentAccountId);
                    }
                  }}
                >
                  <SelectTrigger
                    id="lancamento-cartao"
                    aria-required
                    className={`w-full ${TOUCH}`}
                    aria-invalid={errorFor('cardId') !== undefined || creditNeedsCard}
                  >
                    <SelectValue placeholder="Escolhe o cartão" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeCards.map((card) => (
                      <SelectItem key={card.id} value={card.id}>
                        {card.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError>{errorFor('cardId')}</FieldError>
              </div>
            ) : null}

            <div className="space-y-1">
              <FieldLabel htmlFor="lancamento-conta">
                {isTransfer ? 'Da conta' : usesCredit ? 'Conta de pagamento' : 'Conta'}
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

            {usesCredit && invoicePreview !== null ? (
              <div className="rounded-lg border bg-muted/40 p-3 text-sm sm:col-span-2">
                <p>
                  {usesInstallments && installmentPreview !== null
                    ? `${installmentCountNumber} parcelas de ${formatCurrency(installmentPreview[0] ?? 0)} — a primeira entra na fatura que fecha a `
                    : 'Entra na fatura que fecha a '}
                  <strong>{formatIsoDate(invoicePreview.closingDate)}</strong> e vence a{' '}
                  <strong>{formatIsoDate(invoicePreview.dueDate)}</strong>.
                </p>
                {usesInstallments && installmentPreview !== null ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    A última parcela cai na fatura que fecha a{' '}
                    {formatIsoDate(
                      invoiceDatesFor({
                        purchaseDate: addMonths(date, installmentCountNumber - 1),
                        closingDay: selectedCard?.closingDay ?? 1,
                        dueDay: selectedCard?.dueDay ?? 1,
                      }).closingDate,
                    )}
                    . A soma das parcelas é exatamente o valor da compra.
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">
                    A compra não sai da conta agora: só quando a fatura for paga.
                  </p>
                )}
              </div>
            ) : null}

            {usesCredit && mode === 'expense' ? (
              <div className="space-y-1 sm:col-span-2">
                <span id="lancamento-condicao" className="text-sm font-medium">
                  Como pagas
                </span>
                <div
                  role="radiogroup"
                  aria-labelledby="lancamento-condicao"
                  className="flex flex-wrap gap-2"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={installmentMode === 'single'}
                    onClick={() => setInstallmentMode('single')}
                    className={cn(
                      'inline-flex min-h-11 items-center rounded-lg border px-3 text-sm font-medium transition-colors sm:min-h-8',
                      installmentMode === 'single'
                        ? 'border-transparent bg-primary text-primary-foreground'
                        : 'border-border bg-background hover:bg-muted',
                    )}
                  >
                    À vista
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={installmentMode === 'installment'}
                    onClick={() => setInstallmentMode('installment')}
                    className={cn(
                      'inline-flex min-h-11 items-center rounded-lg border px-3 text-sm font-medium transition-colors sm:min-h-8',
                      installmentMode === 'installment'
                        ? 'border-transparent bg-primary text-primary-foreground'
                        : 'border-border bg-background hover:bg-muted',
                    )}
                  >
                    Em parcelas
                  </button>
                </div>
              </div>
            ) : null}

            {usesInstallments ? (
              <Field data-invalid={errorFor('installmentCount') !== undefined}>
                <FieldLabel htmlFor="lancamento-parcelas">Número de parcelas</FieldLabel>
                <Input
                  id="lancamento-parcelas"
                  type="number"
                  inputMode="numeric"
                  min={2}
                  max={72}
                  value={installmentCount}
                  className={TOUCH}
                  aria-invalid={errorFor('installmentCount') !== undefined}
                  aria-describedby={
                    errorFor('installmentCount') === undefined
                      ? undefined
                      : 'lancamento-parcelas-erro'
                  }
                  onChange={(event) => setInstallmentCount(event.target.value)}
                />
                <FieldDescription>
                  {installmentPreview === null
                    ? 'Entre 2 e 72 parcelas.'
                    : `${installmentCountNumber} × ${formatCurrency(installmentPreview[0] ?? 0)} (as primeiras podem ter um cêntimo a mais).`}
                </FieldDescription>
                <FieldError id="lancamento-parcelas-erro">
                  {errorFor('installmentCount')}
                </FieldError>
              </Field>
            ) : null}

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
              disabled={pending || needsTwoAccounts || amountInCents === null || creditNeedsCard}
            >
              {pending
                ? 'A lançar…'
                : isTransfer
                  ? 'Transferir'
                  : usesInstallments
                    ? `Lançar em ${installmentCountNumber} parcelas`
                    : 'Lançar'}
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

/** Data de calendário (`YYYY-MM-DD`) para o formato português (`DD/MM/AAAA`). */
function formatIsoDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');

  return year === undefined || month === undefined || day === undefined
    ? isoDate
    : `${day}/${month}/${year}`;
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
