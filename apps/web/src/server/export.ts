import { CSV_EXPORT_HEADERS, formatCentsForCsv, serializeCsv, toIsoDate } from '@repo/shared';

/**
 * Formatação das exportações, sem `'use server'`.
 *
 * O `export-actions.ts` só pode exportar funções assíncronas (é a regra dos
 * ficheiros `'use server'`), e aqui vivem as peças que não são ações: o tipo do
 * ficheiro, os rótulos das operações internas e a construção das linhas de CSV.
 * É também aqui que o formato fica definido num sítio só — e é este formato que o
 * importador tem de aceitar, para que exportar e reimportar feche o ciclo.
 */

export interface ExportFile {
  readonly filename: string;
  readonly content: string;
}

/** Rótulo para os lançamentos que não têm descrição (operações internas). */
export function labelForKind(kind: string): string {
  switch (kind) {
    case 'EXPENSE':
      return 'Gasto';
    case 'INCOME':
      return 'Ganho';
    case 'TRANSFER':
      return 'Transferência';
    case 'INVOICE_PAYMENT':
      return 'Pagamento de fatura';
    case 'GOAL_DEPOSIT':
      return 'Aporte em objetivo';
    case 'GOAL_WITHDRAWAL':
      return 'Resgate de objetivo';
    case 'BALANCE_ADJUST':
      return 'Ajuste de saldo';
    default:
      return '';
  }
}

export interface CsvExportRow {
  readonly date: Date;
  readonly description: string | null;
  readonly amountInCents: number;
  readonly fitId: string | null;
  readonly kind: string;
  readonly accountName: string | null;
  readonly categoryName: string | null;
}

/**
 * Constrói o CSV dos movimentos.
 *
 * A coluna `Saldo` fica vazia: um saldo corrente só faz sentido dentro de uma
 * conta, e uma exportação pode juntar várias — um número aqui seria uma mentira
 * com aspas. O importador aceita-a vazia.
 */
export function buildTransactionsCsv(rows: readonly CsvExportRow[]): string {
  const lines: string[][] = [
    [...CSV_EXPORT_HEADERS, 'Conta', 'Categoria'],
    ...rows.map((row) => [
      toIsoDate(row.date),
      row.description ?? labelForKind(row.kind),
      formatCentsForCsv(row.amountInCents),
      '',
      row.fitId ?? '',
      row.accountName ?? '',
      row.categoryName ?? '',
    ]),
  ];

  return serializeCsv(lines);
}

/** Nome do ficheiro, com o período e a conta quando existem. */
export function transactionsFilename(filters: {
  readonly from?: string | undefined;
  readonly to?: string | undefined;
  readonly accountId?: string | undefined;
}): string {
  const parts = [
    filters.accountId === undefined ? null : 'conta',
    filters.from ?? null,
    filters.to ?? null,
  ].filter((part): part is string => part !== null);

  return `movimentos${parts.length === 0 ? '' : `-${parts.join('-')}`}.csv`;
}
