import {
  type FinanceTransactionRule,
  type ImportFormat,
  type ImportRow,
  type ImportIssue,
  buildPreview,
  detectFormat,
  parseCsvDocument,
  parseOfxDocument,
} from '@repo/shared';

/**
 * Lógica da importação de extratos, sem tocar na base de dados.
 *
 * Fica separada de `import-actions.ts` (que tem o `'use server'`) por duas
 * razões: as funções puras podem ser testadas sem infraestrutura, e um ficheiro
 * `'use server'` só pode exportar funções assíncronas — as constantes e os
 * validadores que aqui vivem não teriam onde existir.
 */

/** Resultado da pré-visualização, tal como a interface o mostra. */
export interface ImportPreview {
  readonly format: ImportFormat;
  readonly accountId: string;
  readonly accountName: string;
  /** Cartão escolhido para o extrato, ou `null` para um extrato de conta. */
  readonly cardId: string | null;
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

/** Regras do motor de categorização, no formato que `classifyTransaction` espera. */
export interface PreviewRules {
  readonly rules: readonly FinanceTransactionRule[];
  readonly categoryNames: ReadonlyMap<string, string>;
}

/** Linha de transação já gravada, para reconhecer duplicados. */
export interface ExistingTransaction {
  readonly fitId: string | null;
  readonly date: Date;
  readonly amountInCents: number;
  readonly description: string | null;
}

/** Conta de destino, com o saldo de referência para o saldo implícito. */
export interface PreviewAccount {
  readonly id: string;
  readonly name: string;
  readonly openingBalanceInCents: number;
  readonly balanceInCents: number | null;
}

/** Categoria do utilizador, para traduzir a sugestão num nome. */
export interface CategoryName {
  readonly id: string;
  readonly name: string;
}

/** Regra como vem da base de dados, antes de ser convertida. */
export interface RuleRow {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly priority: number;
  readonly targetCategoryId: string | null;
  readonly descriptionContains: string | null;
  readonly counterparty: string | null;
  readonly amountMinInCents: number | null;
  readonly amountMaxInCents: number | null;
  readonly dayMin: number | null;
  readonly dayMax: number | null;
  readonly financialAccountId: string | null;
  readonly cardId: string | null;
}

/**
 * Aplica o motor de regras a um extrato lido.
 *
 * O `format` decide só qual dos parsers corre: a partir daí o caminho é o mesmo,
 * incluindo a sugestão de categorias. Duas implementações da mesma ideia — uma
 * para OFX e outra para CSV — divergiriam com o tempo.
 */
export function buildImportPreview(args: {
  readonly format: ImportFormat;
  readonly content: string;
  readonly cardId?: string;
  readonly account: PreviewAccount;
  readonly existing: readonly ExistingTransaction[];
  readonly rules: readonly FinanceTransactionRule[];
  readonly categoryNames: ReadonlyMap<string, string>;
}): Omit<ImportPreview, 'accountId' | 'accountName'> {
  const base = args.format === 'ofx' ? buildFromOfx(args) : buildFromCsv(args);

  return { format: args.format, cardId: args.cardId ?? null, ...base };
}

/** Aviso comum quando não há regras: sem elas, nada é sugerido. */
function noRulesWarning(): string {
  return (
    'Não tens regras de categorização ativas: os movimentos entram sem sugestão de categoria e ' +
    'ficam por classificar no extrato.'
  );
}

function buildFromOfx(args: {
  readonly content: string;
  readonly cardId?: string;
  readonly account: PreviewAccount;
  readonly existing: readonly ExistingTransaction[];
  readonly rules: readonly FinanceTransactionRule[];
  readonly categoryNames: ReadonlyMap<string, string>;
}) {
  const statement = parseOfxDocument(args.content);
  const warnings: string[] = args.rules.length === 0 ? [noRulesWarning()] : [];

  return buildPreview({
    account: args.account,
    raw: statement.transactions.map((transaction) => ({
      date: transaction.date,
      description: transaction.memo ?? transaction.name ?? '',
      amountInCents: transaction.amountInCents,
      fitId: transaction.fitId,
      sourceLine: transaction.line,
      parserIssue: null,
    })),
    existing: args.existing,
    cardId: args.cardId,
    rules: { rules: args.rules, categoryNames: args.categoryNames },
    // O saldo **declarado** é o do primeiro extrato, o mesmo de onde vêm os
    // movimentos: misturar o saldo de uma conta com os movimentos de outra era o
    // defeito I3 da verificação.
    statedEndBalanceInCents: statement.ledgerBalanceInCents,
    warnings,
    issues: statement.issues,
  });
}

function buildFromCsv(args: {
  readonly content: string;
  readonly cardId?: string;
  readonly account: PreviewAccount;
  readonly existing: readonly ExistingTransaction[];
  readonly rules: readonly FinanceTransactionRule[];
  readonly categoryNames: ReadonlyMap<string, string>;
}) {
  const statement = parseCsvDocument(args.content);
  const warnings: string[] = args.rules.length === 0 ? [noRulesWarning()] : [];

  if (statement.separator === ',') {
    warnings.push(
      'O ficheiro usa vírgula como separador. Confirma as descrições: um valor com vírgula decimal ' +
        'pode ter sido lido como duas colunas.',
    );
  }

  return buildPreview({
    account: args.account,
    raw: statement.rows.map((row) => ({
      date: row.date,
      description: row.description,
      amountInCents: row.amountInCents,
      fitId: row.fitId,
      sourceLine: row.line,
      parserIssue: null,
    })),
    existing: args.existing,
    cardId: args.cardId,
    rules: { rules: args.rules, categoryNames: args.categoryNames },
    statedEndBalanceInCents: statement.lastBalanceInCents,
    warnings,
    issues: statement.issues,
  });
}

/**
 * Converte as regras da base de dados para o tipo do motor.
 *
 * As regras sem categoria de destino não entram: não teriam para onde sugerir. As
 * desativadas também não — quem as desligou não quer vê-las a sugerir na
 * importação.
 */
export function toPreviewRules(
  rows: readonly RuleRow[],
  categories: readonly CategoryName[],
): PreviewRules {
  return {
    rules: rows
      .filter((row) => row.targetCategoryId !== null && row.targetCategoryId !== '')
      .map((row) => ({
        id: row.id,
        name: row.name,
        kind: row.kind === 'INCOME' ? ('income' as const) : ('expense' as const),
        priority: row.priority,
        targetCategoryId: row.targetCategoryId ?? '',
        ...(row.descriptionContains !== null
          ? { descriptionContains: row.descriptionContains }
          : {}),
        ...(row.counterparty !== null ? { counterparty: row.counterparty } : {}),
        ...(row.amountMinInCents !== null ? { amountMinInCents: row.amountMinInCents } : {}),
        ...(row.amountMaxInCents !== null ? { amountMaxInCents: row.amountMaxInCents } : {}),
        ...(row.dayMin !== null ? { dayMin: row.dayMin } : {}),
        ...(row.dayMax !== null ? { dayMax: row.dayMax } : {}),
        ...(row.financialAccountId !== null ? { accountId: row.financialAccountId } : {}),
        // Sem isto, uma regra «só neste cartão» chegava ao motor sem cartão e
        // passava a valer para tudo — o oposto do que a regra diz.
        ...(row.cardId !== null ? { cardId: row.cardId } : {}),
      })),
    categoryNames: new Map(categories.map((category) => [category.id, category.name])),
  };
}

/**
 * Formato do conteúdo: o que o cliente disse, ou o que o ficheiro revela.
 *
 * Uma pessoa que escolha "CSV" para um ficheiro OFX não deve receber uma
 * pré-visualização vazia; quase sempre foi só a opção errada no seletor.
 */
export function resolveFormat(content: string, declared: ImportFormat | undefined): ImportFormat {
  return declared ?? detectFormat(content);
}
