'use client';

import { Info } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { MoneyInput } from '@/components/money-input';
import {
  describeRuleAction,
  describeRuleConditions,
  IMPLEMENTED_RULE_ACTION,
  isRuleActionImplemented,
  RuleConditionList,
} from '@/components/rule-conditions';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { AccountView } from '@/server/accounts';
import type { CardView } from '@/server/cards';
import type { CategoryView } from '@/server/categories';
import { toFieldErrors } from '@/server/result';
import type { RuleView } from '@/server/rules';
import { createRule, updateRule } from '@/server/rules-actions';
import { createRuleSchema, updateRuleSchema } from '@repo/shared/schemas/domain';

/**
 * Criação e edição de uma regra de categorização.
 *
 * O construtor tem de tornar óbvio o que a regra faz, porque uma regra mal
 * escrita age sozinha e em silêncio sobre tudo o que entra. Daí três cuidados:
 *
 * 1. **Conjunção dita em voz alta**: as condições preenchidas têm de se
 *    verificar todas ao mesmo tempo — não é «uma delas»;
 * 2. **Leitura em português, ao vivo**: o resumo é reconstruído a cada tecla, com
 *    a mesma função que a lista usa;
 * 3. **Sem promessas**: só a ação «categorizar» é oferecida, porque é a única que
 *    o servidor executa nesta fase.
 */

/** Alvo de toque: 44 px em telemóvel, denso a partir de `sm`. */
const TOUCH = 'min-h-11 sm:min-h-8';

/**
 * Sentinela de «qualquer conta» / «qualquer cartão».
 *
 * O Radix não aceita um item de lista com valor vazio; o domínio representa
 * «sem restrição» com `null`. A tradução vive nestas constantes.
 */
const ANY_ACCOUNT = '__qualquer_conta__';
const ANY_CARD = '__qualquer_cartao__';

/** Nome legível de cada natureza. */
const KIND_LABELS: Readonly<Record<string, string>> = {
  expense: 'Gasto',
  income: 'Ganho',
};

/** Campo de texto opcional: vazio vira `null` (limpar), ausente seria «não mexer». */
function optionalOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** Número inteiro opcional, a partir de um campo de texto. */
function optionalNumber(value: string): number | null {
  if (value.trim() === '') {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

export function RuleDialog({
  mode,
  rule,
  accounts,
  cards,
  categories,
  defaultPriority,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  readonly mode: 'create' | 'edit';
  readonly rule?: RuleView;
  readonly accounts: readonly AccountView[];
  readonly cards: readonly CardView[];
  readonly categories: readonly CategoryView[];
  /** Prioridade sugerida na criação: a seguir à última regra existente. */
  readonly defaultPriority?: number;
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

      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Nova regra' : 'Editar regra'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Uma regra categoriza sozinha o que entra. Só se aplica quando a pedires — e podes pré-visualizar antes.'
              : 'Alterar a regra não mexe no que já foi categorizado; a alteração vale para as próximas aplicações.'}
          </DialogDescription>
        </DialogHeader>

        {/* O formulário só existe com o diálogo aberto: cada abertura começa do
            zero, sem sincronizar estado à mão. */}
        <RuleForm
          mode={mode}
          rule={rule}
          accounts={accounts}
          cards={cards}
          categories={categories}
          defaultPriority={defaultPriority}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function RuleForm({
  mode,
  rule,
  accounts,
  cards,
  categories,
  defaultPriority,
  onDone,
}: {
  readonly mode: 'create' | 'edit';
  readonly rule?: RuleView;
  readonly accounts: readonly AccountView[];
  readonly cards: readonly CardView[];
  readonly categories: readonly CategoryView[];
  readonly defaultPriority?: number;
  readonly onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(rule?.name ?? '');
  const [kind, setKind] = useState<'expense' | 'income'>(rule?.kind ?? 'expense');
  const [priority, setPriority] = useState(String(rule?.priority ?? defaultPriority ?? 100));
  const [enabled, setEnabled] = useState(rule?.enabled ?? true);
  const [descriptionContains, setDescriptionContains] = useState(rule?.descriptionContains ?? '');
  const [counterparty, setCounterparty] = useState(rule?.counterparty ?? '');
  const [amountMinInCents, setAmountMinInCents] = useState<number | null>(
    rule?.amountMinInCents ?? null,
  );
  const [amountMaxInCents, setAmountMaxInCents] = useState<number | null>(
    rule?.amountMaxInCents ?? null,
  );
  const [dayMin, setDayMin] = useState(rule?.dayMin === null ? '' : String(rule?.dayMin ?? ''));
  const [dayMax, setDayMax] = useState(rule?.dayMax === null ? '' : String(rule?.dayMax ?? ''));
  const [accountId, setAccountId] = useState(rule?.accountId ?? '');
  const [cardId, setCardId] = useState(rule?.cardId ?? '');
  const [targetCategoryId, setTargetCategoryId] = useState(rule?.targetCategoryId ?? '');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function errorFor(field: string): string | undefined {
    return fieldErrors[field]?.[0];
  }

  const parsedPriority = Number(priority);
  const priorityIsValid = Number.isInteger(parsedPriority) && parsedPriority >= 0;
  const parsedDayMin = optionalNumber(dayMin);
  const parsedDayMax = optionalNumber(dayMax);
  const categoryChoices = categories.filter(
    (category) => !category.internal && category.kind === kind,
  );

  /*
   * Leitura ao vivo das condições: a mesma função que a lista usa, alimentada
   * com o estado atual do formulário. É o que transforma um conjunto de campos
   * numa frase que se pode julgar antes de guardar.
   */
  const conditions = describeRuleConditions({
    descriptionContains: optionalOrNull(descriptionContains),
    counterparty: optionalOrNull(counterparty),
    amountMinInCents,
    amountMaxInCents,
    dayMin: parsedDayMin,
    dayMax: parsedDayMax,
    accountId: accountId === '' ? null : accountId,
    accountName: accounts.find((account) => account.id === accountId)?.name ?? null,
    cardId: cardId === '' ? null : cardId,
    cardName: cards.find((card) => card.id === cardId)?.name ?? null,
  });

  const hasCondition = conditions.length > 0;
  const targetCategory = categories.find((category) => category.id === targetCategoryId);
  const currentAction = rule?.action ?? IMPLEMENTED_RULE_ACTION;
  const actionIsSupported = isRuleActionImplemented(currentAction);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const base = {
      name: name.trim(),
      kind,
      priority: priorityIsValid ? parsedPriority : 100,
      enabled,
      descriptionContains: optionalOrNull(descriptionContains),
      counterparty: optionalOrNull(counterparty),
      amountMinInCents,
      amountMaxInCents,
      dayMin: parsedDayMin,
      dayMax: parsedDayMax,
      accountId: accountId === '' ? null : accountId,
      cardId: cardId === '' ? null : cardId,
      targetCategoryId,
    };

    /*
     * A ação só vai no **pedido de criação**: numa alteração não é editável, e o
     * servidor recusaria uma regra antiga gravada com outra ação se eu voltasse a
     * enviá-la. Omiti-la significa «não mexer», que é exatamente a intenção.
     */
    const payload =
      mode === 'create'
        ? { ...base, action: IMPLEMENTED_RULE_ACTION }
        : { ...base, id: rule?.id ?? '' };

    const parsed =
      mode === 'create' ? createRuleSchema.safeParse(payload) : updateRuleSchema.safeParse(payload);

    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      setFormError(parsed.error.issues[0]?.message ?? null);
      return;
    }

    startTransition(async () => {
      const result =
        mode === 'create' ? await createRule(parsed.data) : await updateRule(parsed.data);

      if (!result.ok) {
        setFormError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }

      toast.success(mode === 'create' ? 'Regra criada.' : 'Regra atualizada.');
      onDone();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
        <Field data-invalid={errorFor('name') !== undefined}>
          <FieldLabel htmlFor="regra-nome">Nome</FieldLabel>
          <Input
            id="regra-nome"
            value={name}
            required
            autoComplete="off"
            placeholder="ex.: Supermercado Continente"
            className={TOUCH}
            aria-invalid={errorFor('name') !== undefined}
            aria-describedby={errorFor('name') === undefined ? undefined : 'regra-nome-erro'}
            onChange={(event) => setName(event.target.value)}
          />
          <FieldError id="regra-nome-erro">{errorFor('name')}</FieldError>
        </Field>

        <div className="space-y-1">
          <FieldLabel htmlFor="regra-natureza">Natureza</FieldLabel>
          <Select
            value={kind}
            onValueChange={(value) => {
              const next = value === 'income' ? 'income' : 'expense';
              setKind(next);
              // A categoria de destino tem de ser da mesma natureza: limpa-se em
              // vez de deixar no ecrã uma escolha que o servidor recusaria.
              setTargetCategoryId('');
            }}
          >
            <SelectTrigger
              id="regra-natureza"
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

        <Field data-invalid={errorFor('priority') !== undefined || !priorityIsValid}>
          <FieldLabel htmlFor="regra-prioridade">Prioridade</FieldLabel>
          <Input
            id="regra-prioridade"
            type="number"
            inputMode="numeric"
            min={0}
            max={9999}
            value={priority}
            required
            className={TOUCH}
            aria-invalid={errorFor('priority') !== undefined || !priorityIsValid}
            aria-describedby={
              errorFor('priority') === undefined ? undefined : 'regra-prioridade-erro'
            }
            onChange={(event) => setPriority(event.target.value)}
          />
          <FieldError id="regra-prioridade-erro">
            {errorFor('priority') ??
              (priorityIsValid ? undefined : 'A prioridade é um número inteiro, de 0 para cima.')}
          </FieldError>
        </Field>
      </div>

      <Alert>
        <Info aria-hidden />
        <AlertTitle>As condições combinam-se: têm de se verificar todas</AlertTitle>
        <AlertDescription>
          Uma condição em branco não é uma condição. Se preencheres a descrição e o valor, a regra
          só se aplica ao que tiver as <strong>duas</strong> coisas. Sem nenhuma condição a regra
          categorizaria tudo, e o servidor recusa-a.
        </AlertDescription>
      </Alert>

      <fieldset className="space-y-3 rounded-lg border p-3">
        <legend className="px-1 text-sm font-medium">Condições</legend>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field data-invalid={errorFor('descriptionContains') !== undefined}>
            <FieldLabel htmlFor="regra-descricao">Descrição contém</FieldLabel>
            <Input
              id="regra-descricao"
              value={descriptionContains}
              autoComplete="off"
              placeholder="ex.: continente"
              className={TOUCH}
              aria-invalid={errorFor('descriptionContains') !== undefined}
              aria-describedby={
                errorFor('descriptionContains') === undefined ? undefined : 'regra-descricao-erro'
              }
              onChange={(event) => setDescriptionContains(event.target.value)}
            />
            <FieldDescription>
              Ignora maiúsculas, acentos e espaços nas pontas: «PAGAMENTO SERVIÇOS» encontra
              «pagamento servicos».
            </FieldDescription>
            <FieldError id="regra-descricao-erro">{errorFor('descriptionContains')}</FieldError>
          </Field>

          <Field data-invalid={errorFor('counterparty') !== undefined}>
            <FieldLabel htmlFor="regra-contraparte">Contraparte é</FieldLabel>
            <Input
              id="regra-contraparte"
              value={counterparty}
              autoComplete="off"
              placeholder="ex.: EDP Comercial"
              className={TOUCH}
              aria-invalid={errorFor('counterparty') !== undefined}
              aria-describedby={
                errorFor('counterparty') === undefined ? undefined : 'regra-contraparte-erro'
              }
              onChange={(event) => setCounterparty(event.target.value)}
            />
            <FieldDescription>
              Comparação exata, também sem acentos nem maiúsculas.
            </FieldDescription>
            <FieldError id="regra-contraparte-erro">{errorFor('counterparty')}</FieldError>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field data-invalid={errorFor('amountMinInCents') !== undefined}>
            <FieldLabel htmlFor="regra-valor-min">Valor a partir de</FieldLabel>
            <div
              role="group"
              aria-describedby={
                errorFor('amountMinInCents') === undefined ? undefined : 'regra-valor-min-erro'
              }
            >
              <MoneyInput
                id="regra-valor-min"
                valueInCents={amountMinInCents}
                onValueChange={setAmountMinInCents}
              />
            </div>
            <FieldDescription>Comparado em módulo, sem sinal.</FieldDescription>
            <FieldError id="regra-valor-min-erro">{errorFor('amountMinInCents')}</FieldError>
          </Field>

          <Field data-invalid={errorFor('amountMaxInCents') !== undefined}>
            <FieldLabel htmlFor="regra-valor-max">Valor até</FieldLabel>
            <div
              role="group"
              aria-describedby={
                errorFor('amountMaxInCents') === undefined ? undefined : 'regra-valor-max-erro'
              }
            >
              <MoneyInput
                id="regra-valor-max"
                valueInCents={amountMaxInCents}
                onValueChange={setAmountMaxInCents}
              />
            </div>
            <FieldError id="regra-valor-max-erro">{errorFor('amountMaxInCents')}</FieldError>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field data-invalid={errorFor('dayMin') !== undefined}>
            <FieldLabel htmlFor="regra-dia-min">Do dia</FieldLabel>
            <Input
              id="regra-dia-min"
              type="number"
              inputMode="numeric"
              min={1}
              max={31}
              value={dayMin}
              className={TOUCH}
              aria-invalid={errorFor('dayMin') !== undefined}
              aria-describedby={errorFor('dayMin') === undefined ? undefined : 'regra-dia-min-erro'}
              onChange={(event) => setDayMin(event.target.value)}
            />
            <FieldError id="regra-dia-min-erro">{errorFor('dayMin')}</FieldError>
          </Field>

          <Field data-invalid={errorFor('dayMax') !== undefined}>
            <FieldLabel htmlFor="regra-dia-max">Até ao dia</FieldLabel>
            <Input
              id="regra-dia-max"
              type="number"
              inputMode="numeric"
              min={1}
              max={31}
              value={dayMax}
              className={TOUCH}
              aria-invalid={errorFor('dayMax') !== undefined}
              aria-describedby={errorFor('dayMax') === undefined ? undefined : 'regra-dia-max-erro'}
              onChange={(event) => setDayMax(event.target.value)}
            />
            <FieldDescription>Dia do mês do lançamento, de 1 a 31.</FieldDescription>
            <FieldError id="regra-dia-max-erro">{errorFor('dayMax')}</FieldError>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <FieldLabel htmlFor="regra-conta">Conta</FieldLabel>
            <Select
              value={accountId === '' ? ANY_ACCOUNT : accountId}
              onValueChange={(value) => setAccountId(value === ANY_ACCOUNT ? '' : value)}
            >
              <SelectTrigger
                id="regra-conta"
                className={`w-full ${TOUCH}`}
                aria-invalid={errorFor('accountId') !== undefined}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY_ACCOUNT}>Qualquer conta</SelectItem>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError>{errorFor('accountId')}</FieldError>
          </div>

          <div className="space-y-1">
            <FieldLabel htmlFor="regra-cartao">Cartão</FieldLabel>
            <Select
              value={cardId === '' ? ANY_CARD : cardId}
              onValueChange={(value) => setCardId(value === ANY_CARD ? '' : value)}
            >
              <SelectTrigger
                id="regra-cartao"
                className={`w-full ${TOUCH}`}
                aria-invalid={errorFor('cardId') !== undefined}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY_CARD}>Qualquer cartão</SelectItem>
                {cards.map((card) => (
                  <SelectItem key={card.id} value={card.id}>
                    {card.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError>{errorFor('cardId')}</FieldError>
          </div>
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <FieldLabel htmlFor="regra-categoria">Categoria de destino</FieldLabel>
          <Select value={targetCategoryId} onValueChange={setTargetCategoryId}>
            <SelectTrigger
              id="regra-categoria"
              aria-required
              className={`w-full ${TOUCH}`}
              aria-invalid={errorFor('targetCategoryId') !== undefined}
              aria-describedby={
                errorFor('targetCategoryId') === undefined ? undefined : 'regra-categoria-erro'
              }
            >
              <SelectValue placeholder="Escolhe a categoria" />
            </SelectTrigger>
            <SelectContent>
              {categoryChoices.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>
            Só categorias de {kind === 'expense' ? 'gasto' : 'ganho'} e que contem para os totais.
          </FieldDescription>
          <FieldError id="regra-categoria-erro">{errorFor('targetCategoryId')}</FieldError>
        </div>

        <Field>
          <span className="text-sm font-medium">Ação</span>
          <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
            {describeRuleAction(currentAction)}
          </p>
          {actionIsSupported ? (
            <FieldDescription>
              Nesta fase é a única ação disponível. Aplicar etiquetas, substituir a descrição e
              ignorar lançamentos chegam mais tarde — o servidor recusa-as por agora.
            </FieldDescription>
          ) : (
            <FieldDescription>
              Esta regra foi gravada com uma ação que ainda não existe, e o servidor não a executa.
              Guardar aqui não muda a ação — só a podes corrigir quando ela estiver implementada.
            </FieldDescription>
          )}
        </Field>
      </div>

      <div className="space-y-2 rounded-lg border p-3">
        <h3 className="text-sm font-medium">Como esta regra fica</h3>
        {hasCondition ? (
          <>
            <RuleConditionList conditions={conditions} />
            <p className="text-sm text-muted-foreground">
              {targetCategory === undefined ? (
                <span className="text-destructive">Falta escolher a categoria de destino.</span>
              ) : (
                <>
                  Quando tudo isto se verificar, o lançamento passa a{' '}
                  <strong>{targetCategory.name}</strong>.
                </>
              )}
            </p>
          </>
        ) : (
          <p className="text-sm text-destructive">
            Ainda não há nenhuma condição. Uma regra sem condições categorizaria todos os
            lançamentos da natureza escolhida — o servidor recusa-a.
          </p>
        )}
      </div>

      <Field>
        <div className="flex min-h-11 items-center gap-3 sm:min-h-0">
          <Switch id="regra-ativa" checked={enabled} onCheckedChange={setEnabled} />
          <FieldLabel htmlFor="regra-ativa">
            {enabled ? 'Regra ativa' : 'Regra desativada'}
          </FieldLabel>
        </div>
        <FieldDescription>
          Uma regra desativada continua na lista e mantém a ordem, mas não é usada ao aplicar.
        </FieldDescription>
      </Field>

      {formError === null ? null : (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        Guardar não categoriza nada: a aplicação às transações é sempre um passo separado, com
        pré-visualização.
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
        <Button type="submit" className={TOUCH} disabled={pending || !priorityIsValid}>
          {pending ? 'A guardar…' : mode === 'create' ? 'Criar regra' : 'Guardar alterações'}
        </Button>
      </div>
    </form>
  );
}
