'use client';

import { CreditCard, Info } from 'lucide-react';
import Link from 'next/link';
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
import { createCreditCard, updateCreditCard } from '@/server/cards-actions';
import type { AccountView } from '@/server/accounts';
import { toFieldErrors } from '@/server/result';
import { createCreditCardSchema, updateCreditCardSchema } from '@repo/shared/schemas/domain';
import { invoiceDatesFor } from '@repo/shared';

/**
 * Criação e edição de um cartão de crédito gerido à mão.
 *
 * Não há integração bancária: o cartão é uma configuração — dia de fecho, dia de
 * vencimento e limite — e é essa configuração que decide em que fatura cada
 * compra cai. O diálogo mostra logo a conta certa, em vez de deixar o utilizador
 * descobrir a regra depois de ver uma fatura com valores inesperados.
 */

/** Marcas que o domínio conhece, com o nome que aparece no cartão. */
export const CARD_BRAND_OPTIONS = [
  { value: 'visa', label: 'Visa' },
  { value: 'mastercard', label: 'Mastercard' },
  { value: 'maestro', label: 'Maestro' },
  { value: 'american_express', label: 'American Express' },
  { value: 'multibanco', label: 'Multibanco' },
  { value: 'other', label: 'Outra' },
] as const;

/** Nome legível de uma marca, com recurso ao próprio valor. */
export const CARD_BRAND_LABELS: Readonly<Record<string, string>> = Object.fromEntries(
  CARD_BRAND_OPTIONS.map((option) => [option.value, option.label]),
);

/**
 * Campos que o formulário lê de um cartão existente.
 *
 * Deliberadamente estreito: é o que o formulário precisa, e não o `CardView`
 * inteiro. Assim a lista de cartões pode ganhar campos sem arrastar isto atrás.
 */
export interface EditableCard {
  readonly id: string;
  readonly name: string;
  readonly brand: string;
  readonly paymentAccountId: string | null;
  readonly closingDay: number;
  readonly dueDay: number;
  readonly creditLimitInCents: number | null;
  readonly annualFeeInCents: number | null;
}

/** Alvo de toque: 44 px em telemóvel, denso a partir de `sm`. */
const TOUCH = 'min-h-11 sm:min-h-8';

export function CardDialog({
  mode,
  card,
  accounts,
  today,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  readonly mode: 'create' | 'edit';
  readonly card?: EditableCard;
  readonly accounts: readonly AccountView[];
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
          <DialogTitle>{mode === 'create' ? 'Novo cartão' : 'Editar cartão'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'O dia de fecho decide em que fatura cada compra entra. O vencimento é quando a fatura tem de ser paga.'
              : 'Mudar o fecho ou o vencimento muda em que fatura caem as compras seguintes. O limite serve para acompanhares o disponível.'}
          </DialogDescription>
        </DialogHeader>

        <CardForm
          mode={mode}
          card={card}
          accounts={accounts}
          today={today}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function CardForm({
  mode,
  card,
  accounts,
  today,
  onDone,
}: {
  readonly mode: 'create' | 'edit';
  readonly card?: EditableCard;
  readonly accounts: readonly AccountView[];
  readonly today: string;
  readonly onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(card?.name ?? '');
  const [brand, setBrand] = useState(card?.brand ?? 'other');
  const [paymentAccountId, setPaymentAccountId] = useState(
    card?.paymentAccountId ?? accounts.find((account) => !account.archived)?.id ?? '',
  );
  const [closingDay, setClosingDay] = useState(String(card?.closingDay ?? 10));
  const [dueDay, setDueDay] = useState(String(card?.dueDay ?? 20));
  const [limitInCents, setLimitInCents] = useState<number | null>(card?.creditLimitInCents ?? null);
  const [annualFeeInCents, setAnnualFeeInCents] = useState<number | null>(
    card?.annualFeeInCents ?? null,
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function errorFor(field: string): string | undefined {
    return fieldErrors[field]?.[0];
  }

  const activeAccounts = accounts.filter((account) => !account.archived);
  const hasAccounts = activeAccounts.length > 0;

  // Pré-visualização da regra do fecho, com a mesma função que o servidor usa.
  const parsedClosing = Number(closingDay);
  const parsedDue = Number(dueDay);
  const preview =
    Number.isInteger(parsedClosing) &&
    parsedClosing >= 1 &&
    parsedClosing <= 31 &&
    Number.isInteger(parsedDue) &&
    parsedDue >= 1 &&
    parsedDue <= 31
      ? invoiceDatesFor({ purchaseDate: today, closingDay: parsedClosing, dueDay: parsedDue })
      : null;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const base = {
      name: name.trim(),
      brand,
      paymentAccountId,
      closingDay: Number(closingDay),
      dueDay: Number(dueDay),
      // O schema de entrada usa `monthlyLimitInCents`; a coluna e o `CardView`
      // chamam-lhe `creditLimitInCents`. Dívida de nomenclatura já registada.
      monthlyLimitInCents: limitInCents ?? undefined,
      annualFeeInCents: annualFeeInCents ?? undefined,
    };

    const payload = mode === 'create' ? base : { ...base, id: card?.id ?? '' };

    const parsed =
      mode === 'create'
        ? createCreditCardSchema.safeParse(payload)
        : updateCreditCardSchema.safeParse(payload);

    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      return;
    }

    startTransition(async () => {
      const result =
        mode === 'create'
          ? await createCreditCard(parsed.data)
          : await updateCreditCard(parsed.data);

      if (!result.ok) {
        setFormError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }

      toast.success(mode === 'create' ? 'Cartão criado.' : 'Cartão atualizado.');
      onDone();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {hasAccounts ? null : (
        <Alert variant="destructive">
          <Info aria-hidden />
          <AlertTitle>Precisas de uma conta para pagar a fatura</AlertTitle>
          <AlertDescription>
            A fatura de um cartão é paga a partir de uma conta tua, e o contrato exige essa ligação
            na criação. Cria primeiro a conta de onde o pagamento sai.
            <span className="mt-2 block">
              <Button asChild size="sm" variant="outline" className={TOUCH}>
                <Link href="/contas">Ir para as contas</Link>
              </Button>
            </span>
          </AlertDescription>
        </Alert>
      )}

      <Field data-invalid={errorFor('name') !== undefined}>
        <FieldLabel htmlFor="cartao-nome">Nome</FieldLabel>
        <Input
          id="cartao-nome"
          value={name}
          required
          autoComplete="off"
          placeholder="ex.: Cartão Millennium"
          className={TOUCH}
          aria-invalid={errorFor('name') !== undefined}
          aria-describedby={errorFor('name') === undefined ? undefined : 'cartao-nome-erro'}
          onChange={(event) => setName(event.target.value)}
        />
        <FieldError id="cartao-nome-erro">{errorFor('name')}</FieldError>
      </Field>

      <div className="space-y-1">
        <Label htmlFor="cartao-marca">Marca</Label>
        <Select value={brand} onValueChange={setBrand}>
          <SelectTrigger id="cartao-marca" className={`w-full ${TOUCH}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CARD_BRAND_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="cartao-conta">Conta de pagamento</Label>
        <Select
          value={paymentAccountId}
          onValueChange={setPaymentAccountId}
          disabled={!hasAccounts}
        >
          <SelectTrigger
            id="cartao-conta"
            aria-required
            className={`w-full ${TOUCH}`}
            aria-invalid={errorFor('paymentAccountId') !== undefined}
            aria-describedby={
              errorFor('paymentAccountId') === undefined ? undefined : 'cartao-conta-erro'
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
        <p className="text-sm text-muted-foreground">
          De onde sai o dinheiro quando pagas a fatura. Podes mudar a conta no momento do pagamento.
        </p>
        <FieldError id="cartao-conta-erro">{errorFor('paymentAccountId')}</FieldError>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field data-invalid={errorFor('closingDay') !== undefined}>
          <FieldLabel htmlFor="cartao-fecho">Dia de fecho</FieldLabel>
          <Input
            id="cartao-fecho"
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            value={closingDay}
            required
            className={TOUCH}
            aria-invalid={errorFor('closingDay') !== undefined}
            aria-describedby={
              errorFor('closingDay') === undefined ? undefined : 'cartao-fecho-erro'
            }
            onChange={(event) => setClosingDay(event.target.value)}
          />
          <FieldError id="cartao-fecho-erro">{errorFor('closingDay')}</FieldError>
        </Field>

        <Field data-invalid={errorFor('dueDay') !== undefined}>
          <FieldLabel htmlFor="cartao-vencimento">Dia de vencimento</FieldLabel>
          <Input
            id="cartao-vencimento"
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            value={dueDay}
            required
            className={TOUCH}
            aria-invalid={errorFor('dueDay') !== undefined}
            aria-describedby={
              errorFor('dueDay') === undefined ? undefined : 'cartao-vencimento-erro'
            }
            onChange={(event) => setDueDay(event.target.value)}
          />
          <FieldError id="cartao-vencimento-erro">{errorFor('dueDay')}</FieldError>
        </Field>
      </div>

      {preview === null ? null : (
        <p
          className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
          aria-live="polite"
        >
          Uma compra feita hoje entra na fatura que fecha a{' '}
          <strong>{formatDay(preview.closingDate)}</strong> e vence a{' '}
          <strong>{formatDay(preview.dueDate)}</strong>. Os dias inexistentes (31 em fevereiro) são
          limitados ao último dia do mês.
        </p>
      )}

      <Field data-invalid={errorFor('monthlyLimitInCents') !== undefined}>
        <FieldLabel htmlFor="cartao-limite">Limite mensal</FieldLabel>
        <div
          role="group"
          aria-describedby={
            errorFor('monthlyLimitInCents') === undefined ? undefined : 'cartao-limite-erro'
          }
        >
          <MoneyInput
            id="cartao-limite"
            valueInCents={limitInCents}
            onValueChange={setLimitInCents}
          />
        </div>
        <FieldDescription>
          Opcional. Serve para mostrar o limite disponível; sem limite definido, a lista não o
          inventa.
        </FieldDescription>
        <FieldError id="cartao-limite-erro">{errorFor('monthlyLimitInCents')}</FieldError>
      </Field>

      <Field data-invalid={errorFor('annualFeeInCents') !== undefined}>
        <FieldLabel htmlFor="cartao-anuidade">Anuidade</FieldLabel>
        <div
          role="group"
          aria-describedby={
            errorFor('annualFeeInCents') === undefined ? undefined : 'cartao-anuidade-erro'
          }
        >
          <MoneyInput
            id="cartao-anuidade"
            valueInCents={annualFeeInCents}
            onValueChange={setAnnualFeeInCents}
          />
        </div>
        <FieldDescription>Opcional. Fica registada para memória futura.</FieldDescription>
        <FieldError id="cartao-anuidade-erro">{errorFor('annualFeeInCents')}</FieldError>
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
        <Button type="submit" className={TOUCH} disabled={pending || !hasAccounts}>
          {pending ? 'A guardar…' : mode === 'create' ? 'Criar cartão' : 'Guardar alterações'}
        </Button>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CreditCard className="size-3.5" aria-hidden />
        Nenhum dado de cartão real é guardado: só o nome, as datas e os valores.
      </p>
    </form>
  );
}

/** Data de calendário em formato curto, sem deslocação de fuso. */
function formatDay(date: string): string {
  return new Intl.DateTimeFormat('pt-PT', { timeZone: 'UTC', dateStyle: 'short' }).format(
    new Date(`${date}T00:00:00Z`),
  );
}
