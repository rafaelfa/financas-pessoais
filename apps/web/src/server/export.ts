import {
  CSV_EXPORT_HEADERS,
  fingerprintOf,
  formatCentsForCsv,
  serializeCsv,
  toIsoDate,
} from '@repo/shared';

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
 * -----------------------------------------------------------------------------
 * A COLUNA `Id` VAI SEMPRE PREENCHIDA (I4 da verificação T7.5)
 * -----------------------------------------------------------------------------
 * A exportação promete ser reimportável, e não era: 27 movimentos exportados
 * voltavam como 21. A causa eram os movimentos **sem identificador** (lançados à
 * mão, ou importados antes de o importador passar a derivar um) — o ficheiro não
 * lhes dava `Id`, o importador não os conseguia distinguir, e a segunda cópia de
 * um movimento com a mesma data, valor e descrição era marcada como "repetido
 * dentro do próprio ficheiro" e descartada. Dois cafés iguais no mesmo dia
 * perdiam um.
 *
 * Agora toda a linha leva identificador: o `fitId` gravado quando existe, e a
 * impressão digital do conteúdo quando não existe. Como a derivação é **a mesma
 * função** que o importador usa (`fingerprintOf`), o ciclo fecha: o que sai é o
 * que entra, e reimportar não duplica.
 *
 * A coluna `Saldo` continua vazia: um saldo corrente só faz sentido dentro de uma
 * conta, e uma exportação pode juntar várias — um número aqui seria uma mentira
 * com aspas.
 */
export function buildTransactionsCsv(rows: readonly CsvExportRow[]): string {
  const identifiers = exportIdentifiers(rows);

  const lines: string[][] = [
    [...CSV_EXPORT_HEADERS, 'Conta', 'Categoria'],
    ...rows.map((row, index) => [
      toIsoDate(row.date),
      row.description ?? labelForKind(row.kind),
      formatCentsForCsv(row.amountInCents),
      '',
      identifiers[index] ?? '',
      row.accountName ?? '',
      row.categoryName ?? '',
    ]),
  ];

  return serializeCsv(lines);
}

/**
 * Identificador de cada linha exportada, distinto dentro do ficheiro.
 *
 * Quando duas linhas dão a mesma impressão digital (dois cafés iguais no mesmo
 * dia), a segunda recebe `:2` — a mesma convenção do importador. Sem isto, o
 * ficheiro teria dois `Id` iguais e a reimportação perderia uma das linhas.
 *
 * A impressão digital nunca é `null` numa linha exportada: `date` e
 * `amountInCents` são obrigatórios na base de dados. O caso está tratado na
 * mesma por completude, com um identificador derivado da posição.
 */
function exportIdentifiers(rows: readonly CsvExportRow[]): string[] {
  const counts = new Map<string, number>();

  return rows.map((row, index) => {
    const base =
      row.fitId !== null && row.fitId !== ''
        ? row.fitId
        : (fingerprintOf(toIsoDate(row.date), row.amountInCents, row.description ?? '') ??
          `exp-sem-id:${String(index + 1)}`);

    const occurrence = (counts.get(base) ?? 0) + 1;
    counts.set(base, occurrence);

    return occurrence === 1 ? base.slice(0, 80) : `${base}:${String(occurrence)}`.slice(0, 80);
  });
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
