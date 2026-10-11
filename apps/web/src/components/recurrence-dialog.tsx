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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { AccountView } from '@/server/accounts';
import type { CategoryView } from '@/server/categories';
import type { RecurrenceView } from '@/server/recurrences';
import { createRecurrence, updateRecurrence } from '@/server/recurrences-actions';
import { toFieldErrors } from '@/server/result';
import { describeFrequency, nextOccurrence, type RecurrenceFrequency } from '@repo/shared';
import { createRecurrenceSchema, updateRecurrenceSchema } from '@repo/shared/schemas/domain';

/**
 * Criação e edição de uma recorrência.
 *
 * Uma recorrência é uma **série**: uma regra («todos os meses, dia 5») que gera
 * lançamentos até hoje. Por isso o formulário tem de responder a duas perguntas
 * que o utilizador faz sempre antes de guardar:
 *
 * 1. «Qual é a próxima data?» — o resumo por extenso (`describeFrequency`) e a
 *    lista das próximas ocorrências, calculadas com a **mesma função pura que o
 *    servidor usa** (`nextOccurrence`), para a promessa não divergir do que fica
 *    gravado;
 * 2. «Isto vai duplicar?» — não: a geração é idempotente, e a nota no rodapé
 *    di-lo em vez de o deixar adivinhar.
 */

/** Alvo de toque: 44 px em telemóvel, denso a partir de `sm`. */
const TOUCH = 'min-h-11 sm:min-h-8';

/**
 * Valor sentinela de «sem categoria».
 *
 * O Radix não aceita um item de lista com valor vazio, e o domínio usa `null`
 * para «sem categoria». A tradução entre os dois vive nesta constante.
 */
const NO_CATEGORY = '__sem_categoria__';

/** Frequências que o domínio aceita, pela ordem em que aparecem no formulário. */
export const RECURRENCE_FREQUENCY_OPTIONS = [
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensal' },
  { value: 'quarterly', label: 'Trimestral' },
] as const;

/**
 * Campo opcional de texto: vazio vira `null`.
 *
 * O `updateRecurrence` é **parcial**, e há uma diferença que importa: omitir o
 * campo significa «não mexer»; enviar `null` significa «limpar». Um campo
 * esvaziado pelo utilizador tem de virar `null`, senão a limpeza não era
 * guardada e o ecrã voltava a mostrar o valor antigo sem explicação.
 */
function optionalOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** Nome legível de uma natureza de recorrência. */
const KIND_LABELS: Readonly<Record<string, string>> = {
  expense: 'Gasto',
  income: 'Ganho',
};

/** Primeira letra em maiúscula, para a frase começar bem. */
function capitalize(value: string): string {
  return value.length === 0 ? value : `${value[0]?.toUpperCase() ?? ''}${value.slice(1)}`;
}

/**
 * Frequência inicial do formulário.
 *
 * O formulário oferece exatamente o mesmo conjunto que o schema Zod aceita, por
 * isso a frequência de uma série existente entra **tal e qual**; só uma série nova
 * precisa de uma escolha por omissão. Aqui havia uma coerção (`yearly → monthly`)
 * que, ao gravar a série, convertia a linha da base de anual em mensal — uma
 * alteração silenciosa de dados causada por abrir o formulário.
 */
function supportedFrequency(value: RecurrenceFrequency | undefined): RecurrenceFrequency {
  return value ?? 'monthly';
}

export function RecurrenceDialog({
  mode,
  recurrence,
  accounts,
  categories,
  today,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  readonly mode: 'create' | 'edit';
  readonly recurrence?: RecurrenceView;
  readonly accounts: readonly AccountView[];
  readonly categories: readonly CategoryView[];
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

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Nova recorrência' : 'Editar recorrência'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Uma conta fixa ou um rendimento que se repete. A aplicação gera os lançamentos até hoje, sem criar duas vezes o mesmo.'
              : 'Alterar a série muda as ocorrências futuras. As que já foram geradas ficam como estão.'}
          </DialogDescription>
        </DialogHeader>

        {/* O formulário só existe com o diálogo aberto: cada abertura começa do
            zero, sem sincronizar estado à mão. */}
        <RecurrenceForm
          mode={mode}
          recurrence={recurrence}
          accounts={accounts}
          categories={categories}
          today={today}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function RecurrenceForm({
  mode,
  recurrence,
  accounts,
  categories,
  today,
  onDone,
}: {
  readonly mode: 'create' | 'edit';
  readonly recurrence?: RecurrenceView;
  readonly accounts: readonly AccountView[];
  readonly categories: readonly CategoryView[];
  readonly today: string;
  readonly onDone: () => void;
}) {
  const activeAccounts = accounts.filter((account) => !account.archived);

  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(recurrence?.name ?? '');
  const [kind, setKind] = useState<'expense' | 'income'>(recurrence?.kind ?? 'expense');
  const [amountInCents, setAmountInCents] = useState<number | null>(
    recurrence?.amountInCents ?? null,
  );
  const [description, setDescription] = useState(recurrence?.description ?? '');
  const [frequency, setFrequency] = useState<'weekly' | 'monthly' | 'quarterly'>(
    supportedFrequency(recurrence?.frequency),
  );
  const [interval, setIntervalValue] = useState(String(recurrence?.interval ?? 1));
  const [dayOfMonth, setDayOfMonth] = useState(
    recurrence?.dayOfMonth === null || recurrence?.dayOfMonth === undefined
      ? ''
      : String(recurrence.dayOfMonth),
  );
  const [startDate, setStartDate] = useState(recurrence?.startDate ?? today);
  const [endDate, setEndDate] = useState(recurrence?.endDate ?? '');
  /*
   * Na criação, a primeira conta ativa é a escolha natural; na edição, mostra-se
   * a conta gravada — e, se ela já não existir, o campo fica vazio a pedir uma
   * escolha, em vez de trocar de conta em silêncio.
   */
  const [accountId, setAccountId] = useState(
    recurrence === undefined ? (activeAccounts[0]?.id ?? '') : (recurrence.accountId ?? ''),
  );
  const [categoryId, setCategoryId] = useState(recurrence?.categoryId ?? '');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function errorFor(field: string): string | undefined {
    return fieldErrors[field]?.[0];
  }

  const parsedInterval = Number(interval);
  // O limite superior é o do schema (24): a interface não promete um intervalo
  // que o servidor recusaria.
  const intervalIsValid =
    Number.isInteger(parsedInterval) && parsedInterval >= 1 && parsedInterval <= 24;
  const parsedDay = dayOfMonth.trim() === '' ? undefined : Number(dayOfMonth);
  const dayIsValid =
    frequency === 'weekly' ||
    (parsedDay !== undefined && Number.isInteger(parsedDay) && parsedDay >= 1 && parsedDay <= 31);
  const amountIsValid = amountInCents !== null && amountInCents > 0;
  const endIsAfterStart = endDate.trim() === '' || endDate >= startDate;
  const categoryChoices = categoriesForKind(categories, kind, categoryId);
  const accountChoices = accountsForSelection(accounts, accountId);

  /*
   * Pré-visualização: as próximas ocorrências a partir da data de início, com a
   * mesma função que o servidor usa para avançar a série. Só aparece quando os
   * campos que a determinam estão preenchidos e válidos.
   */
  const preview =
    startDate.trim() !== '' && intervalIsValid && dayIsValid && endIsAfterStart
      ? upcomingDates({
          startDate,
          frequency,
          interval: parsedInterval,
          dayOfMonth: frequency === 'weekly' ? undefined : parsedDay,
          endDate: endDate.trim() === '' ? undefined : endDate,
          count: 4,
        })
      : [];

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const base = {
      name: name.trim(),
      kind,
      amountInCents: amountInCents ?? 0,
      description: optionalOrNull(description),
      frequency,
      interval: intervalIsValid ? parsedInterval : 1,
      // Sem dia explícito (ou numa série semanal), o motor usa o dia da data de
      // início. `null` limpa um dia antigo quando a série muda de natureza.
      dayOfMonth: frequency === 'weekly' ? null : (parsedDay ?? null),
      startDate,
      endDate: optionalOrNull(endDate),
      accountId,
      categoryId: optionalOrNull(categoryId),
    };

    const payload = mode === 'create' ? base : { ...base, id: recurrence?.id ?? '' };

    const parsed =
      mode === 'create'
        ? createRecurrenceSchema.safeParse(payload)
        : updateRecurrenceSchema.safeParse(payload);

    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      setFormError(parsed.error.issues[0]?.message ?? null);
      return;
    }

    startTransition(async () => {
      const result =
        mode === 'create'
          ? await createRecurrence(parsed.data)
          : await updateRecurrence(parsed.data);

      if (!result.ok) {
        setFormError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }

      toast.success(mode === 'create' ? 'Recorrência criada.' : 'Recorrência atualizada.');
      onDone();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field data-invalid={errorFor('name') !== undefined}>
        <FieldLabel htmlFor="recorrencia-nome">Nome</FieldLabel>
        <Input
          id="recorrencia-nome"
          value={name}
          required
          autoComplete="off"
          placeholder="ex.: Renda, Netflix, Salário"
          className={TOUCH}
          aria-invalid={errorFor('name') !== undefined}
          aria-describedby={errorFor('name') === undefined ? undefined : 'recorrencia-nome-erro'}
          onChange={(event) => setName(event.target.value)}
        />
        <FieldError id="recorrencia-nome-erro">{errorFor('name')}</FieldError>
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <FieldLabel htmlFor="recorrencia-natureza">Natureza</FieldLabel>
          <Select
            value={kind}
            onValueChange={(value) => {
              setKind(value === 'income' ? 'income' : 'expense');
              // A categoria tem de ser da mesma natureza: limpa-se em vez de
              // deixar uma escolha inválida no ecrã.
              setCategoryId('');
            }}
          >
            <SelectTrigger
              id="recorrencia-natureza"
              className={`w-full ${TOUCH}`}
              aria-invalid={errorFor('kind') !== undefined}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(['expense', 'income'] as const).map((option) => (
                <SelectItem key={option} value={option}>
                  {KIND_LABELS[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError>{errorFor('kind')}</FieldError>
        </div>

        <Field data-invalid={errorFor('amountInCents') !== undefined || !amountIsValid}>
          <FieldLabel htmlFor="recorrencia-valor">Valor</FieldLabel>
          <div
            role="group"
            aria-describedby={
              errorFor('amountInCents') === undefined && amountIsValid
                ? undefined
                : 'recorrencia-valor-erro'
            }
          >
            <MoneyInput
              id="recorrencia-valor"
              valueInCents={amountInCents}
              onValueChange={setAmountInCents}
            />
          </div>
          <FieldDescription>
            Valor de cada ocorrência, sempre positivo: é a natureza que decide se sai ou entra.
          </FieldDescription>
          <FieldError id="recorrencia-valor-erro">
            {errorFor('amountInCents') ??
              (amountInCents !== null && amountInCents <= 0
                ? 'O valor tem de ser positivo: é a natureza que decide se sai ou entra.'
                : amountIsValid
                  ? undefined
                  : 'Escreve o valor de cada ocorrência.')}
          </FieldError>
        </Field>
      </div>

      <Field data-invalid={errorFor('description') !== undefined}>
        <FieldLabel htmlFor="recorrencia-descricao">Descrição</FieldLabel>
        <Textarea
          id="recorrencia-descricao"
          value={description}
          rows={2}
          placeholder="Opcional — aparece no lançamento gerado"
          aria-invalid={errorFor('description') !== undefined}
          aria-describedby={
            errorFor('description') === undefined ? undefined : 'recorrencia-descricao-erro'
          }
          onChange={(event) => setDescription(event.target.value)}
        />
        <FieldError id="recorrencia-descricao-erro">{errorFor('description')}</FieldError>
      </Field>

      <fieldset className="space-y-3 rounded-lg border p-3">
        <legend className="px-1 text-sm font-medium">Quando se repete</legend>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <FieldLabel htmlFor="recorrencia-frequencia">Frequência</FieldLabel>
            <Select
              value={frequency}
              onValueChange={(value) => {
                const next =
                  value === 'weekly' ? 'weekly' : value === 'quarterly' ? 'quarterly' : 'monthly';
                setFrequency(next);
                if (next !== 'weekly' && dayOfMonth.trim() === '') {
                  // Sugere o dia da data de início, que é o que aconteceria sem
                  // dia explícito — evita um campo em branco sem sentido.
                  const dayFromStart = /^\d{4}-\d{2}-\d{2}$/.test(startDate)
                    ? startDate.slice(8, 10)
                    : '';

                  if (dayFromStart !== '') {
                    setDayOfMonth(dayFromStart);
                  }
                }
              }}
            >
              <SelectTrigger
                id="recorrencia-frequencia"
                className={`w-full ${TOUCH}`}
                aria-invalid={errorFor('frequency') !== undefined}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECURRENCE_FREQUENCY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError>{errorFor('frequency')}</FieldError>
          </div>

          <Field data-invalid={errorFor('interval') !== undefined || !intervalIsValid}>
            <FieldLabel htmlFor="recorrencia-intervalo">Repetir a cada</FieldLabel>
            <Input
              id="recorrencia-intervalo"
              type="number"
              inputMode="numeric"
              min={1}
              max={24}
              value={interval}
              required
              className={TOUCH}
              aria-invalid={errorFor('interval') !== undefined || !intervalIsValid}
              aria-describedby={
                errorFor('interval') === undefined ? undefined : 'recorrencia-intervalo-erro'
              }
              onChange={(event) => setIntervalValue(event.target.value)}
            />
            <FieldDescription>
              Repete a cada N períodos: 1 é o normal, 2 com «mensal» dá de dois em dois meses.
            </FieldDescription>
            <FieldError id="recorrencia-intervalo-erro">
              {errorFor('interval') ??
                (intervalIsValid
                  ? undefined
                  : 'O intervalo é um número inteiro de períodos, entre 1 e 24.')}
            </FieldError>
          </Field>

          {frequency === 'weekly' ? (
            <p className="self-end pb-2 text-sm text-muted-foreground">
              Semanal: cai sempre no mesmo dia da semana da data de início.
            </p>
          ) : (
            <Field data-invalid={errorFor('dayOfMonth') !== undefined || !dayIsValid}>
              <FieldLabel htmlFor="recorrencia-dia">Dia do mês</FieldLabel>
              <Input
                id="recorrencia-dia"
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                value={dayOfMonth}
                className={TOUCH}
                aria-invalid={errorFor('dayOfMonth') !== undefined || !dayIsValid}
                aria-describedby={
                  errorFor('dayOfMonth') === undefined ? undefined : 'recorrencia-dia-erro'
                }
                onChange={(event) => setDayOfMonth(event.target.value)}
              />
              <FieldError id="recorrencia-dia-erro">
                {errorFor('dayOfMonth') ?? (dayIsValid ? undefined : 'O dia do mês vai de 1 a 31.')}
              </FieldError>
            </Field>
          )}
        </div>

        {frequency === 'weekly' ? null : (
          <p className="text-xs text-muted-foreground">
            Nos meses mais curtos, o dia ajusta-se ao último do mês (31 cai a 30, e a 28 ou 29 em
            fevereiro) e volta ao 31 no mês seguinte. O dia não se perde.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field data-invalid={errorFor('startDate') !== undefined}>
            <FieldLabel htmlFor="recorrencia-inicio">Início</FieldLabel>
            <Input
              id="recorrencia-inicio"
              type="date"
              value={startDate}
              required
              className={TOUCH}
              aria-invalid={errorFor('startDate') !== undefined}
              aria-describedby={
                errorFor('startDate') === undefined ? undefined : 'recorrencia-inicio-erro'
              }
              onChange={(event) => setStartDate(event.target.value)}
            />
            <FieldDescription>
              A primeira ocorrência. O histórico anterior a esta data não é gerado.
            </FieldDescription>
            <FieldError id="recorrencia-inicio-erro">{errorFor('startDate')}</FieldError>
          </Field>

          <Field data-invalid={errorFor('endDate') !== undefined || !endIsAfterStart}>
            <FieldLabel htmlFor="recorrencia-fim">Fim</FieldLabel>
            <Input
              id="recorrencia-fim"
              type="date"
              value={endDate}
              className={TOUCH}
              aria-invalid={errorFor('endDate') !== undefined || !endIsAfterStart}
              aria-describedby={
                errorFor('endDate') === undefined ? undefined : 'recorrencia-fim-erro'
              }
              onChange={(event) => setEndDate(event.target.value)}
            />
            <FieldDescription>Opcional — deixa em branco para não ter fim.</FieldDescription>
            <FieldError id="recorrencia-fim-erro">
              {errorFor('endDate') ??
                (endIsAfterStart ? undefined : 'O fim não pode ser antes do início.')}
            </FieldError>
          </Field>
        </div>
      </fieldset>

      <section aria-labelledby="recorrencia-previsao" className="space-y-2">
        <h3 id="recorrencia-previsao" className="text-sm font-medium">
          Como fica a série
        </h3>
        <p className="text-sm text-muted-foreground">
          {capitalize(
            describeFrequency({
              frequency,
              interval: intervalIsValid ? parsedInterval : 1,
              dayOfMonth: frequency === 'weekly' ? undefined : parsedDay,
            }),
          )}
          .
        </p>

        {preview.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Preenche o início e a frequência para veres as próximas datas.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2 text-sm" aria-live="polite">
            {preview.map((date) => (
              <li
                key={date}
                className="font-numeric rounded-md border bg-muted/40 px-2 py-1 tabular-nums"
              >
                {formatDay(date)}
              </li>
            ))}
            <li className="self-center text-xs text-muted-foreground">
              {endDate.trim() === '' ? 'e por aí fora.' : 'e até ao fim indicado.'}
            </li>
          </ul>
        )}
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <FieldLabel htmlFor="recorrencia-conta">Conta</FieldLabel>
          <Select
            value={accountId}
            onValueChange={setAccountId}
            disabled={accountChoices.length === 0}
          >
            <SelectTrigger
              id="recorrencia-conta"
              aria-required
              className={`w-full ${TOUCH}`}
              aria-invalid={errorFor('accountId') !== undefined}
              aria-describedby={
                errorFor('accountId') === undefined ? undefined : 'recorrencia-conta-erro'
              }
            >
              <SelectValue placeholder="Escolhe a conta" />
            </SelectTrigger>
            <SelectContent>
              {accountChoices.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
                  {account.archived ? ' (arquivada)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError id="recorrencia-conta-erro">
            {errorFor('accountId') ??
              (accountId === '' ? 'Escolhe a conta onde o lançamento entra ou sai.' : undefined)}
          </FieldError>
        </div>

        <div className="space-y-1">
          <FieldLabel htmlFor="recorrencia-categoria">Categoria</FieldLabel>
          <Select
            value={categoryId === '' ? NO_CATEGORY : categoryId}
            onValueChange={(value) => setCategoryId(value === NO_CATEGORY ? '' : value)}
          >
            <SelectTrigger
              id="recorrencia-categoria"
              className={`w-full ${TOUCH}`}
              aria-invalid={errorFor('categoryId') !== undefined}
              aria-describedby={
                errorFor('categoryId') === undefined ? undefined : 'recorrencia-categoria-erro'
              }
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {/* Sem este item, escolher uma categoria seria uma porta só de ida:
                  o Radix não aceita um item com valor vazio. */}
              <SelectItem value={NO_CATEGORY}>Sem categoria</SelectItem>
              {categoryChoices.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>
            Opcional. As categorias internas ficam de fora: não contam para os totais.
          </FieldDescription>
          <FieldError id="recorrencia-categoria-erro">{errorFor('categoryId')}</FieldError>
        </div>
      </div>

      {activeAccounts.length === 0 ? (
        <p role="alert" className="text-sm text-destructive">
          Não tens nenhuma conta ativa. Cria ou reativa uma conta antes de criar recorrências.
        </p>
      ) : null}

      {formError === null ? null : (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        Gerar as ocorrências em atraso pode ser feito as vezes que quiseres: a geração é idempotente
        e nunca cria duas vezes a mesma data.
      </p>

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
        <Button
          type="submit"
          className={TOUCH}
          disabled={pending || !amountIsValid || !intervalIsValid || accountId === ''}
        >
          {pending ? 'A guardar…' : mode === 'create' ? 'Criar recorrência' : 'Guardar alterações'}
        </Button>
      </div>
    </form>
  );
}

/** Categorias da natureza certa, com a escolhida sempre presente na lista. */
function categoriesForKind(
  categories: readonly CategoryView[],
  kind: 'expense' | 'income',
  selectedId: string,
): CategoryView[] {
  return categories.filter(
    (category) => !category.internal && (category.kind === kind || category.id === selectedId),
  );
}

/**
 * Contas para escolha.
 *
 * As ativas e, **sempre**, a que está escolhida: uma série apontada a uma conta
 * entretanto arquivada tem de continuar a mostrar a conta certa no formulário —
 * escondê-la faria o campo parecer vazio e a edição parecer sem conta.
 */
function accountsForSelection(accounts: readonly AccountView[], selectedId: string): AccountView[] {
  return accounts.filter((account) => !account.archived || account.id === selectedId);
}

/**
 * As próximas ocorrências de uma série, a partir do início.
 *
 * Usa `nextOccurrence` — a função pura do motor — para a pré-visualização não
 * divergir do que o servidor grava. O ciclo tem um limite explícito: uma série
 * que não avance (defeito no motor) tem de parar aqui, não bloquear o browser.
 */
export function upcomingDates({
  startDate,
  frequency,
  interval,
  dayOfMonth,
  endDate,
  count,
}: {
  readonly startDate: string;
  readonly frequency: 'weekly' | 'monthly' | 'quarterly';
  readonly interval: number;
  readonly dayOfMonth: number | undefined;
  readonly endDate: string | undefined;
  readonly count: number;
}): string[] {
  const dates: string[] = [];
  let cursor = startDate;

  for (let index = 0; index < count; index += 1) {
    if (endDate !== undefined && cursor > endDate) {
      break;
    }

    dates.push(cursor);

    const next = nextOccurrence({ from: cursor, frequency, interval, dayOfMonth });

    // Uma série que não avance seria um ciclo sem fim a repetir a mesma data.
    if (next <= cursor) {
      break;
    }

    cursor = next;
  }

  return dates;
}

/** Data de calendário em formato curto, sem deslocação de fuso. */
function formatDay(date: string): string {
  return new Intl.DateTimeFormat('pt-PT', { timeZone: 'UTC', dateStyle: 'short' }).format(
    new Date(`${date}T00:00:00Z`),
  );
}
