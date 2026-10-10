import type { FinanceTransaction, FinanceTransactionRule } from './types';

/**
 * Regras de categorização automática.
 *
 * O sistema de referência exige **pelo menos uma** condição e oferece uma
 * pré-visualização das transações identificadas (documento 01, §5.7). Não
 * documenta a precedência entre regras, nem se as condições se combinam por
 * conjunção ou disjunção — é uma das lacunas que o próprio documento assinala.
 *
 * Decisões nossas, explícitas:
 * - as condições preenchidas **combinam-se por conjunção** (todas têm de se
 *   verificar). Uma disjunção faria uma regra disparar sobre quase tudo assim
 *   que tivesse duas condições vagas, o que é pior do que não categorizar;
 * - a precedência é a **ordem de prioridade** declarada na regra, e a primeira
 *   que corresponder ganha. A ordem é visível e editável pelo utilizador;
 * - a comparação de texto ignora maiúsculas, acentos e espaços nas pontas, para
 *   que "PAGAMENTO SERVIÇOS" corresponda a "pagamento servicos";
 * - nada é aplicado sem pré-visualização: `previewClassification` devolve o que
 *   *seria* feito, e é o chamador que decide aplicar.
 */

/** Normaliza texto para comparação: sem acentos, minúsculas, sem espaços nas pontas. */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Uma regra sem nenhuma condição não é válida — o original exige pelo menos uma. */
export function ruleHasCondition(rule: FinanceTransactionRule): boolean {
  return (
    rule.descriptionContains !== undefined ||
    rule.counterparty !== undefined ||
    rule.amountMinInCents !== undefined ||
    rule.amountMaxInCents !== undefined ||
    rule.dayMin !== undefined ||
    rule.dayMax !== undefined ||
    rule.accountId !== undefined
  );
}

/** Regras inválidas, para a interface as assinalar em vez de as guardar. */
export function invalidRules(rules: readonly FinanceTransactionRule[]): FinanceTransactionRule[] {
  return rules.filter((rule) => !ruleHasCondition(rule));
}

function dayOfMonth(isoDate: string): number {
  return Number(isoDate.slice(8, 10));
}

/**
 * Verifica se uma regra corresponde a uma transação.
 *
 * Transferências, pagamentos de fatura, depósitos em objetivos e ajustes de
 * saldo não têm categoria própria e por isso nunca são categorizados por regras.
 */
export function matchesRule(
  transaction: FinanceTransaction,
  rule: FinanceTransactionRule,
): boolean {
  if (transaction.status === 'ignored' || !ruleHasCondition(rule)) {
    return false;
  }

  const isCategorizable = transaction.kind === 'expense' || transaction.kind === 'income';

  if (!isCategorizable || transaction.kind !== rule.kind) {
    return false;
  }

  if (rule.descriptionContains !== undefined) {
    const needle = normalizeText(rule.descriptionContains);

    if (needle.length > 0 && !normalizeText(transaction.description ?? '').includes(needle)) {
      return false;
    }
  }

  if (
    rule.counterparty !== undefined &&
    normalizeText(transaction.counterparty ?? '') !== normalizeText(rule.counterparty)
  ) {
    return false;
  }

  const magnitude = Math.abs(transaction.amountInCents);

  if (rule.amountMinInCents !== undefined && magnitude < rule.amountMinInCents) {
    return false;
  }

  if (rule.amountMaxInCents !== undefined && magnitude > rule.amountMaxInCents) {
    return false;
  }

  const day = dayOfMonth(transaction.date);

  if (rule.dayMin !== undefined && day < rule.dayMin) {
    return false;
  }

  if (rule.dayMax !== undefined && day > rule.dayMax) {
    return false;
  }

  if (rule.accountId !== undefined && transaction.accountId !== rule.accountId) {
    return false;
  }

  return true;
}

export interface ClassificationMatch {
  readonly transactionId: string;
  readonly ruleId: string;
  readonly ruleName: string;
  readonly categoryId: string;
  /** Descrição usada na explicação ao utilizador. */
  readonly reason: string;
}

/**
 * Aplica a primeira regra que corresponder, por ordem de prioridade.
 * Devolve `null` quando nenhuma corresponde.
 */
export function classifyTransaction(
  transaction: FinanceTransaction,
  rules: readonly FinanceTransactionRule[],
): ClassificationMatch | null {
  const ordered = [...rules].sort((a, b) => a.priority - b.priority);

  for (const rule of ordered) {
    if (matchesRule(transaction, rule)) {
      return {
        transactionId: transaction.id,
        ruleId: rule.id,
        ruleName: rule.name,
        categoryId: rule.targetCategoryId,
        reason: `Regra "${rule.name}" (prioridade ${rule.priority})`,
      };
    }
  }

  return null;
}

/** Pré-visualização: o que cada transação receberia, sem alterar nada. */
export function previewClassification(
  transactions: readonly FinanceTransaction[],
  rules: readonly FinanceTransactionRule[],
): ClassificationMatch[] {
  return transactions
    .map((transaction) => classifyTransaction(transaction, rules))
    .filter((match): match is ClassificationMatch => match !== null);
}
