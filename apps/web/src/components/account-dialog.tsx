'use client';

import { Banknote, Coins, Landmark, PiggyBank, Wallet } from 'lucide-react';
import { type ComponentType, useState, useTransition } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { createAccount, updateAccount } from '@/server/accounts-actions';
import type { AccountView } from '@/server/accounts';
import { toFieldErrors } from '@/server/result';
import { createAccountSchema, updateAccountSchema } from '@repo/shared/schemas/domain';

/**
 * Criação e edição de uma conta.
 *
 * O saldo inicial só se define na criação: a partir daí, a forma correta de o
 * corrigir é **travar o saldo**, que cria um lançamento de ajuste auditável em
 * vez de reescrever o histórico.
 */

/** Tipos de conta do domínio, pela ordem em que aparecem no formulário. */
export const ACCOUNT_TYPE_OPTIONS = [
  { value: 'checking', label: 'Conta à ordem' },
  { value: 'savings', label: 'Poupança' },
  { value: 'wallet', label: 'Carteira' },
  { value: 'cash', label: 'Dinheiro' },
  { value: 'investment', label: 'Investimento' },
] as const;

/** Nome legível de um tipo de conta, com recurso ao próprio valor. */
export const ACCOUNT_TYPE_LABELS: Readonly<Record<string, string>> = Object.fromEntries(
  ACCOUNT_TYPE_OPTIONS.map((option) => [option.value, option.label]),
);

/** Ícone de cada tipo, para o cartão da conta se distinguir num relance. */
export const ACCOUNT_TYPE_ICONS: Readonly<Record<string, ComponentType<{ className?: string }>>> = {
  checking: Landmark,
  savings: PiggyBank,
  wallet: Wallet,
  cash: Banknote,
  investment: Coins,
};

/** Alvo de toque: 44 px em telemóvel, denso a partir de `sm`. */
const TOUCH = 'min-h-11 sm:min-h-8';

export function AccountDialog({
  mode,
  account,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  readonly mode: 'create' | 'edit';
  readonly account?: AccountView;
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
          <DialogTitle>{mode === 'create' ? 'Nova conta' : 'Editar conta'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Onde o dinheiro está. O saldo daqui para a frente é calculado a partir dos movimentos.'
              : 'Muda o nome, a instituição ou o tipo. O saldo calculado não se altera por aqui.'}
          </DialogDescription>
        </DialogHeader>

        {/* O formulário só existe com o diálogo aberto: cada abertura começa do
            zero, sem sincronizar estado à mão. */}
        <AccountForm mode={mode} account={account} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function AccountForm({
  mode,
  account,
  onDone,
}: {
  readonly mode: 'create' | 'edit';
  readonly account?: AccountView;
  readonly onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(account?.name ?? '');
  const [institution, setInstitution] = useState(account?.institution ?? '');
  const [type, setType] = useState(account?.type ?? 'checking');
  const [openingBalanceInCents, setOpeningBalanceInCents] = useState<number | null>(
    account?.openingBalanceInCents ?? null,
  );
  const [isPrimary, setIsPrimary] = useState(account?.isPrimary ?? false);
  const [notes, setNotes] = useState('');
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
      institution: institution.trim(),
      type,
      isPrimary,
      notes: notes.trim(),
    };

    const payload =
      mode === 'create'
        ? { ...base, openingBalanceInCents: openingBalanceInCents ?? 0 }
        : { ...base, id: account?.id ?? '' };

    const parsed =
      mode === 'create'
        ? createAccountSchema.safeParse(payload)
        : updateAccountSchema.safeParse(payload);

    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      return;
    }

    startTransition(async () => {
      const result =
        mode === 'create' ? await createAccount(parsed.data) : await updateAccount(parsed.data);

      if (!result.ok) {
        setFormError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }

      toast.success(mode === 'create' ? 'Conta criada.' : 'Conta atualizada.');
      onDone();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field data-invalid={errorFor('name') !== undefined}>
        <FieldLabel htmlFor="conta-nome">Nome</FieldLabel>
        <Input
          id="conta-nome"
          value={name}
          required
          autoComplete="off"
          className={TOUCH}
          aria-invalid={errorFor('name') !== undefined}
          aria-describedby={errorFor('name') === undefined ? undefined : 'conta-nome-erro'}
          onChange={(event) => setName(event.target.value)}
        />
        <FieldError id="conta-nome-erro">{errorFor('name')}</FieldError>
      </Field>

      <Field data-invalid={errorFor('institution') !== undefined}>
        <FieldLabel htmlFor="conta-instituicao">Instituição</FieldLabel>
        <Input
          id="conta-instituicao"
          value={institution}
          placeholder="Opcional — ex.: Millennium bcp"
          className={TOUCH}
          aria-invalid={errorFor('institution') !== undefined}
          aria-describedby={
            errorFor('institution') === undefined ? undefined : 'conta-instituicao-erro'
          }
          onChange={(event) => setInstitution(event.target.value)}
        />
        <FieldError id="conta-instituicao-erro">{errorFor('institution')}</FieldError>
      </Field>

      <div className="space-y-1">
        <Label htmlFor="conta-tipo">Tipo</Label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger id="conta-tipo" className={`w-full ${TOUCH}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACCOUNT_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {mode === 'create' ? (
        <Field data-invalid={errorFor('openingBalanceInCents') !== undefined}>
          <FieldLabel htmlFor="conta-saldo">Saldo inicial</FieldLabel>
          {/* O `MoneyInput` não expõe `aria-invalid`: o estado inválido fica no
              `Field` (cor e mensagem) e a mensagem associa-se por
              `aria-describedby`. `aria-invalid` num `role="group"` é ARIA
              inválido e não chegaria ao leitor de ecrã. */}
          <div
            role="group"
            aria-describedby={
              errorFor('openingBalanceInCents') === undefined ? undefined : 'conta-saldo-erro'
            }
          >
            <MoneyInput
              id="conta-saldo"
              valueInCents={openingBalanceInCents}
              onValueChange={setOpeningBalanceInCents}
            />
          </div>
          <FieldDescription>
            Quanto tens nesta conta hoje. Negativo não é permitido aqui: se a conta está no
            vermelho, cria-a a zero e trava o saldo.
          </FieldDescription>
          <FieldError id="conta-saldo-erro">{errorFor('openingBalanceInCents')}</FieldError>
        </Field>
      ) : (
        <Field>
          <FieldLabel htmlFor="conta-saldo-fixo">Saldo inicial</FieldLabel>
          <Input
            id="conta-saldo-fixo"
            value={formatCentsAsDecimal(account?.openingBalanceInCents ?? 0)}
            readOnly
            disabled
            className={TOUCH}
          />
          <FieldDescription>
            Não se altera depois de criada. Para acertar o saldo, usa “Travar saldo”: isso cria um
            lançamento de ajuste e o histórico fica intacto.
          </FieldDescription>
        </Field>
      )}

      <Field>
        <FieldLabel htmlFor="conta-principal">Conta principal</FieldLabel>
        <div className="flex min-h-11 items-center gap-3 sm:min-h-0">
          <Switch id="conta-principal" checked={isPrimary} onCheckedChange={setIsPrimary} />
          <span className="text-sm text-muted-foreground">
            É a conta que aparece por omissão nos lançamentos rápidos.
          </span>
        </div>
      </Field>

      <Field data-invalid={errorFor('notes') !== undefined}>
        <FieldLabel htmlFor="conta-notas">Notas</FieldLabel>
        <Textarea
          id="conta-notas"
          value={notes}
          rows={2}
          placeholder="Opcional"
          aria-invalid={errorFor('notes') !== undefined}
          aria-describedby={errorFor('notes') === undefined ? undefined : 'conta-notas-erro'}
          onChange={(event) => setNotes(event.target.value)}
        />
        <FieldError id="conta-notas-erro">{errorFor('notes')}</FieldError>
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
          {pending ? 'A guardar…' : mode === 'create' ? 'Criar conta' : 'Guardar alterações'}
        </Button>
      </div>
    </form>
  );
}

/** Formata cêntimos como decimal pt-PT, para um campo só de leitura. */
function formatCentsAsDecimal(amountInCents: number): string {
  return new Intl.NumberFormat('pt-PT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountInCents / 100);
}
