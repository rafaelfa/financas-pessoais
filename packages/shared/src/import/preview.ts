/**
 * Pré-visualização de importação: transforma o que os parsers leram numa lista
 * de linhas com estado, **sem tocar na base de dados**.
 *
 * É aqui que vive a decisão mais importante da importação: nada é gravado antes
 * de a pessoa ver o que vai entrar. Um extrato errado propaga-se a todos os
 * saldos do mês, e desfazer uma importação a meio é pior do que a não fazer.
 *
 * Regras:
 * - `duplicate`: o `fitId` já existe nesta conta, ou (sem `fitId`) a impressão
 *   digital `data + valor + descrição` já existe. Desmarcado por omissão.
 * - `suspicious`: sem data ou sem valor legível. Desmarcado por omissão — não se
 *   grava um lançamento de valor desconhecido.
 * - `new`: tudo o resto, marcado. A sugestão de categoria vem do motor de regras
 *   (`classifyTransaction`), nunca de uma heurística nova.
 */

import { classifyTransaction } from '../finance/rules';
import type { FinanceTransaction, FinanceTransactionRule, TransactionKind } from '../finance/types';
import type { importFormatSchema, importRowStatusSchema } from '../schemas/domain/import';
import { type ImportIssue, normalizeForMatch } from './issue';
import type { OfxStatement, OfxStatementTransaction } from './ofx';
import type { CsvStatement, CsvStatementRow } from './csv';

/**
 * O formato e os estados são derivados do schema Zod partilhado, não literais
 * paralelos.
 *
 * Assim a interface (que valida pelo schema) e o parser (que produz estes
 * valores) não podem divergir: acrescentar um estado ao schema é imediatamente
 * visível aqui, e remover um faz o `typecheck` falhar em vez de deixar um valor
 * que nunca é produzido — ou, pior, um valor produzido que a validação rejeita.
 */
export type ImportFormat = ReturnType<typeof importFormatSchema.parse>;
export type ImportRowStatus = ReturnType<typeof importRowStatusSchema.parse>;

export interface ImportRow {
  /** Posição na lista, a começar em 0. É o que o cliente devolve ao confirmar. */
  readonly index: number;
  readonly date: string | null;
  readonly description: string;
  readonly amountInCents: number | null;
  readonly fitId: string | null;
  readonly status: ImportRowStatus;
  readonly reason: string | null;
  /** Por omissão só as linhas `new` vêm marcadas. */
  readonly selected: boolean;
  readonly suggestedCategoryId: string | null;
  readonly suggestedCategoryName: string | null;
  /** Linha do ficheiro de origem, para a pré-visualização apontar o problema. */
  readonly sourceLine: number;
}

export interface ImportPreviewBase {
  readonly rows: readonly ImportRow[];
  readonly newCount: number;
  readonly duplicateCount: number;
  readonly suspiciousCount: number;
  readonly totalDebitsInCents: number;
  readonly totalCreditsInCents: number;
  readonly impliedEndBalanceInCents: number | null;
  readonly warnings: readonly string[];
  readonly issues: readonly ImportIssue[];
}

export interface ExistingTransactionFingerprint {
  readonly fitId: string | null;
  readonly date: Date;
  readonly amountInCents: number;
  readonly description: string | null;
}

export interface PreviewAccount {
  readonly id: string;
  readonly openingBalanceInCents: number;
  readonly balanceInCents: number | null;
  readonly name: string;
}

export interface PreviewCategory {
  readonly id: string;
  readonly name: string;
  readonly isInternal: boolean;
}

export interface PreviewRules {
  readonly rules: readonly FinanceTransactionRule[];
  readonly categoryNames: ReadonlyMap<string, string>;
}

/** `YYYY-MM-DD` de um `Date` guardado à meia-noite UTC. */
function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Impressão digital de um lançamento sem `fitId`.
 *
 * A chave é `data + valor + descrição normalizada`, a mesma tripla que o resto
 * da aplicação usa para reconhecer duplicados. Sem isto, reimportar um extrato
 * CSV — que quase nunca traz `FITID` — duplicaria tudo.
 */
export function fingerprintOf(
  date: string | null,
  amountInCents: number | null,
  description: string,
): string | null {
  if (date === null || amountInCents === null) {
    return null;
  }

  return `${date}|${String(amountInCents)}|${normalizeForMatch(description)}`;
}

function existingFingerprints(existing: readonly ExistingTransactionFingerprint[]): {
  readonly fitIds: Set<string>;
  readonly fingerprints: Set<string>;
} {
  const fitIds = new Set<string>();
  const fingerprints = new Set<string>();

  for (const row of existing) {
    if (row.fitId !== null && row.fitId !== '') {
      fitIds.add(row.fitId);
    }

    const fingerprint = fingerprintOf(isoDate(row.date), row.amountInCents, row.description ?? '');

    if (fingerprint !== null) {
      fingerprints.add(fingerprint);
    }
  }

  return { fitIds, fingerprints };
}

/**
 * Sugere uma categoria para uma linha, usando **o mesmo** motor de regras que a
 * página de regras usa.
 *
 * O tipo da transação decide-se pelo sinal: uma saída é um gasto, uma entrada é
 * um ganho. As regras só se aplicam a esses dois tipos, portanto uma linha sem
 * categoria (ou com valor zero) não recebe sugestão.
 */
function suggest(
  row: {
    readonly date: string | null;
    readonly amountInCents: number | null;
    readonly description: string;
  },
  accountId: string,
  index: number,
  rules: PreviewRules,
): { readonly id: string; readonly name: string } | null {
  if (row.date === null || row.amountInCents === null || row.amountInCents === 0) {
    return null;
  }

  if (rules.rules.length === 0) {
    return null;
  }

  const kind: TransactionKind = row.amountInCents < 0 ? 'expense' : 'income';
  const transaction: FinanceTransaction = {
    id: `import-${String(index)}`,
    kind,
    status: 'confirmed',
    amountInCents: row.amountInCents,
    date: row.date,
    description: row.description,
    accountId,
    settled: false,
  };

  const match = classifyTransaction(transaction, rules.rules);

  if (match === null) {
    return null;
  }

  return {
    id: match.categoryId,
    name: rules.categoryNames.get(match.categoryId) ?? 'Categoria',
  };
}

interface RawRow {
  readonly date: string | null;
  readonly description: string;
  readonly amountInCents: number | null;
  readonly fitId: string | null;
  readonly sourceLine: number;
  /** Motivo de a linha ser suspeita, vindo do parser. */
  readonly parserIssue: string | null;
}

function fromOfx(statement: OfxStatement): RawRow[] {
  const byLine = new Map<number, string>();

  for (const issue of statement.issues) {
    if (!byLine.has(issue.line)) {
      byLine.set(issue.line, issue.message);
    }
  }

  return statement.transactions.map((transaction: OfxStatementTransaction) => ({
    date: transaction.date,
    description: describeOfx(transaction),
    amountInCents: transaction.amountInCents,
    fitId: transaction.fitId,
    sourceLine: transaction.line,
    parserIssue: byLine.get(transaction.line) ?? null,
  }));
}

/** Descrição de uma transação OFX: `MEMO` e, se faltar, `NAME`; nunca os dois. */
function describeOfx(transaction: OfxStatementTransaction): string {
  const memo = transaction.memo?.trim() ?? '';

  if (memo !== '') {
    return memo;
  }

  return transaction.name?.trim() ?? '';
}

function fromCsv(statement: CsvStatement): RawRow[] {
  const byLine = new Map<number, string>();

  for (const issue of statement.issues) {
    if (!byLine.has(issue.line)) {
      byLine.set(issue.line, issue.message);
    }
  }

  return statement.rows.map((row: CsvStatementRow) => ({
    date: row.date,
    description: row.description,
    amountInCents: row.amountInCents,
    fitId: row.fitId,
    sourceLine: row.line,
    parserIssue: byLine.get(row.line) ?? null,
  }));
}

export interface BuildPreviewInput {
  readonly account: PreviewAccount;
  readonly raw: readonly RawRow[];
  readonly existing: readonly ExistingTransactionFingerprint[];
  readonly rules: PreviewRules;
  /** Saldo final declarado pelo ficheiro, quando existe. */
  readonly statedEndBalanceInCents: number | null;
  readonly warnings: readonly string[];
  readonly issues: readonly ImportIssue[];
}

/**
 * Constrói a lista de linhas com estado. Função pura: recebe o que os parsers
 * leram e o que já existe na conta, e devolve o que a pré-visualização mostra.
 */
export function buildPreview(input: BuildPreviewInput): ImportPreviewBase {
  const { fitIds, fingerprints } = existingFingerprints(input.existing);
  const seenFitIds = new Set<string>();
  const seenFingerprints = new Set<string>();
  const rows: ImportRow[] = [];

  for (const [index, raw] of input.raw.entries()) {
    const fingerprint = fingerprintOf(raw.date, raw.amountInCents, raw.description);
    const hasFitId = raw.fitId !== null && raw.fitId !== '';
    let status: ImportRowStatus = 'new';
    let reason: string | null = null;

    if (raw.date === null || raw.amountInCents === null) {
      status = 'suspicious';
      reason = raw.parserIssue ?? (raw.date === null ? 'Sem data legível.' : 'Sem valor legível.');
    } else if (hasFitId && fitIds.has(raw.fitId)) {
      status = 'duplicate';
      reason = 'Já existe nesta conta (mesmo identificador do banco).';
    } else if (hasFitId && seenFitIds.has(raw.fitId)) {
      status = 'duplicate';
      reason = 'Repetido dentro do próprio ficheiro.';
    } else if (!hasFitId && fingerprint !== null && fingerprints.has(fingerprint)) {
      status = 'duplicate';
      reason = 'Já existe nesta conta um movimento igual (data, valor e descrição).';
    } else if (!hasFitId && fingerprint !== null && seenFingerprints.has(fingerprint)) {
      status = 'duplicate';
      reason = 'Repetido dentro do próprio ficheiro.';
    }

    if (hasFitId && raw.fitId !== null) {
      seenFitIds.add(raw.fitId);
    }

    if (fingerprint !== null) {
      seenFingerprints.add(fingerprint);
    }

    const suggestion = status === 'new' ? suggest(raw, input.account.id, index, input.rules) : null;

    rows.push({
      index,
      date: raw.date,
      description: raw.description,
      amountInCents: raw.amountInCents,
      fitId: raw.fitId,
      status,
      reason,
      selected: status === 'new',
      suggestedCategoryId: suggestion?.id ?? null,
      suggestedCategoryName: suggestion?.name ?? null,
      sourceLine: raw.sourceLine,
    });
  }

  /*
   * Totais do que **seria importado**.
   *
   * Os duplicados ficam de fora: já existem na conta, portanto somá-los contaria
   * o mesmo movimento duas vezes no saldo implícito que a pré-visualização
   * mostra. Os suspeitos também, porque não se sabe o valor deles. Um teste da
   * verificação nativa apanhou isto: um movimento repetido dentro do próprio
   * ficheiro somava 1 700,00 € em vez de 850,00 €.
   */
  let totalDebitsInCents = 0;
  let totalCreditsInCents = 0;

  for (const row of rows) {
    if (row.status !== 'new' || row.amountInCents === null) {
      continue;
    }

    if (row.amountInCents < 0) {
      totalDebitsInCents += Math.abs(row.amountInCents);
    } else {
      totalCreditsInCents += row.amountInCents;
    }
  }

  const net = totalCreditsInCents - totalDebitsInCents;
  const warnings = [...input.warnings];

  /*
   * Saldo final implícito.
   *
   * Quando o ficheiro declara um saldo (OFX `LEDGERBAL`, CSV com coluna
   * `Saldo`), é esse o saldo — é o que o banco diz. Quando não declara, calcula-se
   * a partir do saldo atual da conta mais o líquido do que vai ser importado.
   *
   * Não é um saldo "real": é o que os **lançamentos lidos** implicam. Se o
   * utilizador desmarcar linhas na pré-visualização, o número deixa de
   * corresponder — e é por isso que a interface o mostra como estimativa.
   */
  let impliedEndBalanceInCents: number | null;

  if (input.statedEndBalanceInCents !== null) {
    impliedEndBalanceInCents = input.statedEndBalanceInCents;
  } else if (input.account.balanceInCents !== null) {
    // O saldo de referência da conta mais o líquido do que vai ser importado.
    // `balanceInCents` é o saldo **antes** desta importação (o formulário chama
    // `getAccountBalanceAtDate`), não o saldo depois.
    impliedEndBalanceInCents = input.account.balanceInCents + net;
  } else {
    impliedEndBalanceInCents = input.account.openingBalanceInCents + net;
  }

  if (input.account.balanceInCents !== null && input.statedEndBalanceInCents !== null) {
    const expected = input.account.balanceInCents + net;

    if (expected !== input.statedEndBalanceInCents) {
      warnings.push(
        `O saldo final do ficheiro (${String(input.statedEndBalanceInCents)} cêntimos) não ` +
          `corresponde ao saldo da conta mais os movimentos lidos (${String(expected)} cêntimos). ` +
          'Confirma se o extrato é da conta certa e se o período não tem movimentos a mais.',
      );
    }
  }

  return {
    rows,
    newCount: rows.filter((row) => row.status === 'new').length,
    duplicateCount: rows.filter((row) => row.status === 'duplicate').length,
    suspiciousCount: rows.filter((row) => row.status === 'suspicious').length,
    totalDebitsInCents,
    totalCreditsInCents,
    impliedEndBalanceInCents,
    warnings,
    issues: input.issues,
  };
}

/**
 * Junta o resultado dos parsers com o que já existe na conta.
 *
 * O `format` não muda a análise — muda só o que se declara na pré-visualização.
 */
export function previewFromOfx(args: {
  readonly account: PreviewAccount;
  readonly statement: OfxStatement;
  readonly existing: readonly ExistingTransactionFingerprint[];
  readonly rules: PreviewRules;
}): ImportPreviewBase {
  const warnings: string[] = [];

  if (
    args.statement.header['ENCODING'] !== undefined &&
    /USASCII|1252/i.test(args.statement.header['ENCODING'])
  ) {
    warnings.push(
      'O ficheiro diz que está em US-ASCII/Windows-1252. Se os acentos aparecerem trocados na ' +
        'pré-visualização, guarda o extrato em UTF-8 e importa outra vez.',
    );
  }

  const withoutFitId = args.statement.transactions.filter(
    (transaction) => transaction.fitId === null,
  ).length;

  if (withoutFitId > 0) {
    warnings.push(
      `${String(withoutFitId)} movimento(s) sem identificador do banco (FITID): a reimportação ` +
        'do mesmo ficheiro vai reconhecê-los pela data, valor e descrição.',
    );
  }

  return buildPreview({
    account: args.account,
    raw: fromOfx(args.statement),
    existing: args.existing,
    rules: args.rules,
    statedEndBalanceInCents: args.statement.ledgerBalanceInCents,
    warnings,
    issues: args.statement.issues,
  });
}

/** O mesmo, a partir de um extrato CSV. */
export function previewFromCsv(args: {
  readonly account: PreviewAccount;
  readonly statement: CsvStatement;
  readonly existing: readonly ExistingTransactionFingerprint[];
  readonly rules: PreviewRules;
}): ImportPreviewBase {
  const warnings: string[] = [];

  if (args.statement.separator === ',') {
    warnings.push(
      'O ficheiro usa vírgula como separador. Confirma as descrições na pré-visualização: um ' +
        'valor com vírgula decimal pode ter sido lido como duas colunas.',
    );
  }

  return buildPreview({
    account: args.account,
    raw: fromCsv(args.statement),
    existing: args.existing,
    rules: args.rules,
    statedEndBalanceInCents: args.statement.lastBalanceInCents,
    warnings,
    issues: args.statement.issues,
  });
}
