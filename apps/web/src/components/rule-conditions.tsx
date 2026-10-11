import { formatCurrency } from '@repo/shared';

/**
 * Condições de uma regra, escritas em português.
 *
 * Uma regra guarda-se como um conjunto de campos, mas ninguém a lê assim: o
 * utilizador quer ver «descrição contém “continente” e valor até 50 €». Esta
 * função é a única tradução entre os dois mundos — a lista e o construtor usam
 * a mesma, para não haver dois textos diferentes para a mesma regra.
 *
 * Regra de composição, dita na interface e cumprida aqui: as condições
 * preenchidas **combinam-se por conjunção** (todas têm de se verificar).
 */

/** Campos que descrevem as condições de uma regra. */
export interface RuleConditionFields {
  readonly descriptionContains: string | null;
  readonly counterparty: string | null;
  readonly amountMinInCents: number | null;
  readonly amountMaxInCents: number | null;
  readonly dayMin: number | null;
  readonly dayMax: number | null;
  readonly accountId: string | null;
  /** Nome da conta, quando o chamador o tem à mão (para o texto ficar legível). */
  readonly accountName?: string | null;
  readonly cardId: string | null;
  readonly cardName?: string | null;
}

/** Nome legível de cada ação de uma regra. */
export const RULE_ACTION_LABELS: Readonly<Record<string, string>> = {
  set_category: 'Categorizar o lançamento',
  set_tags: 'Aplicar etiquetas',
  set_description: 'Substituir a descrição',
  mark_ignored: 'Ignorar o lançamento',
};

/**
 * A única ação implementada nesta fase.
 *
 * A base de dados já comporta as outras três, mas o servidor recusa-as com uma
 * mensagem clara. A interface não as oferece, para não prometer o que não
 * acontece.
 */
export const IMPLEMENTED_RULE_ACTION = 'set_category';

/** Verdadeiro quando a ação da regra já funciona. */
export function isRuleActionImplemented(action: string): boolean {
  return action === IMPLEMENTED_RULE_ACTION;
}

/** Nome legível da ação, com recurso ao próprio valor. */
export function describeRuleAction(action: string): string {
  return RULE_ACTION_LABELS[action] ?? action;
}

/**
 * Frases das condições preenchidas, por ordem de leitura.
 *
 * Devolve uma lista vazia quando a regra não tem condição nenhuma — é o estado
 * que a interface assinala como inválido em vez de esconder.
 */
export function describeRuleConditions(rule: RuleConditionFields): string[] {
  const conditions: string[] = [];

  const description = trimmed(rule.descriptionContains);
  if (description !== null) {
    conditions.push(`descrição contém «${description}»`);
  }

  const counterparty = trimmed(rule.counterparty);
  if (counterparty !== null) {
    conditions.push(`contraparte é «${counterparty}»`);
  }

  const amount = describeAmountRange(rule.amountMinInCents, rule.amountMaxInCents);
  if (amount !== null) {
    conditions.push(amount);
  }

  const days = describeDayRange(rule.dayMin, rule.dayMax);
  if (days !== null) {
    conditions.push(days);
  }

  if (rule.accountId !== null) {
    conditions.push(`na conta «${trimmed(rule.accountName) ?? 'escolhida'}»`);
  }

  if (rule.cardId !== null) {
    conditions.push(`no cartão «${trimmed(rule.cardName) ?? 'escolhido'}»`);
  }

  return conditions;
}

/** Lista de condições, com um texto próprio quando não existe nenhuma. */
export function RuleConditionList({
  conditions,
  emptyLabel = 'Sem condições',
}: {
  readonly conditions: readonly string[];
  readonly emptyLabel?: string;
}) {
  if (conditions.length === 0) {
    return <span className="text-sm text-muted-foreground">{emptyLabel}</span>;
  }

  return (
    <ul className="space-y-0.5 text-sm">
      {conditions.map((condition) => (
        <li key={condition} className="flex gap-1.5">
          <span aria-hidden className="text-muted-foreground">
            •
          </span>
          <span>{condition}</span>
        </li>
      ))}
    </ul>
  );
}

/** Faixa de valor, em módulo: o sinal vem da natureza do lançamento. */
function describeAmountRange(min: number | null, max: number | null): string | null {
  if (min !== null && max !== null) {
    return min === max
      ? `valor igual a ${formatCurrency(min, 'EUR')}`
      : `valor entre ${formatCurrency(min, 'EUR')} e ${formatCurrency(max, 'EUR')}`;
  }

  if (min !== null) {
    return `valor a partir de ${formatCurrency(min, 'EUR')}`;
  }

  if (max !== null) {
    return `valor até ${formatCurrency(max, 'EUR')}`;
  }

  return null;
}

/** Faixa de dias do mês. */
function describeDayRange(min: number | null, max: number | null): string | null {
  if (min !== null && max !== null) {
    return min === max ? `no dia ${min} do mês` : `entre os dias ${min} e ${max} do mês`;
  }

  if (min !== null) {
    return `a partir do dia ${min} do mês`;
  }

  if (max !== null) {
    return `até ao dia ${max} do mês`;
  }

  return null;
}

/** Texto limpo, ou `null` quando não tem conteúdo. */
function trimmed(value: string | null | undefined): string | null {
  const result = (value ?? '').trim();

  return result === '' ? null : result;
}
