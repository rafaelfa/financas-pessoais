import {
  type ImportFormat,
  descriptionDigest,
  importFitId,
  withImportIdentifiers,
} from '@repo/shared';

/**
 * Núcleo da confirmação de uma importação, sem sessão e sem `'use server'`.
 *
 * Vive aqui por uma razão específica: o defeito I1 da verificação T7.5 só se
 * reproduz dentro de uma transação de PostgreSQL, e a versão anterior estava
 * enterrada dentro da Server Action, onde não havia como a testar sem uma base de
 * dados a sério. Extraída para uma função que recebe o cliente, o cenário medido
 * — duplicado na **última** linha, dois pedidos em **paralelo** — passa a ser
 * testável com um duplo que imita o comportamento do PostgreSQL (uma violação de
 * restrição única aborta a transação).
 *
 * O tipo do cliente é estrutural de propósito: não conhece Prisma, só os quatro
 * métodos que usa. É isso que permite trocá-lo por um duplo nos testes.
 */

export interface ImportRowInput {
  readonly date: string | null;
  readonly description: string;
  readonly amountInCents: number | null;
  readonly fitId?: string | null | undefined;
  readonly categoryId?: string | null | undefined;
}

export interface SkippedImportRow {
  readonly index: number;
  readonly reason: string;
}

export interface ImportedTransactionRef {
  readonly transactionId: string;
  readonly fitId: string | null;
  readonly date: string;
  readonly amountInCents: number;
  readonly descriptionDigest: string;
  readonly categoryId: string | null;
}

export interface ConfirmOutcome {
  readonly created: number;
  readonly alreadyExists: number;
  readonly skippedRows: readonly SkippedImportRow[];
  readonly imported: readonly ImportedTransactionRef[];
}

/**
 * O que a confirmação precisa do cliente de base de dados (real ou duplo).
 *
 * Os argumentos dos métodos são `unknown` de propósito: `Prisma.TransactionClient`
 * é genérico, e um `create(args: { data: Record<string, unknown> })` **não** aceita
 * o cliente real (o `data` tipado exige os campos obrigatórios). O que este módulo
 * promete é chamar os dois métodos com a forma certa; os testes provam-no com um
 * duplo que imita o PostgreSQL (uma violação de restrição única aborta a
 * transação).
 */
export interface ConfirmTx {
  transaction: {
    findMany(args: unknown): Promise<unknown>;
    create(args: unknown): Promise<unknown>;
  };
}

/** Estreita o resultado de `findMany` para o que o algoritmo lê. */
function asRows(value: unknown): readonly Record<string, unknown>[] {
  return Array.isArray(value) ? (value as readonly Record<string, unknown>[]) : [];
}

/** Estreita o resultado de `create` ao identificador criado. */
function asCreatedId(value: unknown): string {
  if (typeof value === 'object' && value !== null && 'id' in value) {
    const id = (value as { id: unknown }).id;

    if (typeof id === 'string') {
      return id;
    }
  }

  throw new Error('A base de dados não devolveu o identificador do movimento criado.');
}

/** Teto de um inteiro de 32 bits, o máximo que a coluna `Int` aceita. */
const MAX_AMOUNT_IN_CENTS = 2_147_483_647;

/**
 * Valida uma data de calendário escrita como texto.
 *
 * Valida pelo calendário, e não por expressão regular: `2026-02-31` tem a forma
 * certa e não existe. Uma data impossível recusa **essa linha**, não a
 * importação — era o defeito I8, em que uma linha mal escrita derrubava o payload
 * inteiro.
 */
export function parseCalendarDate(value: string): string | null {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.slice(0, 10));

  if (parts?.[1] === undefined || parts[2] === undefined || parts[3] === undefined) {
    return null;
  }

  const year = Number.parseInt(parts[1], 10);
  const month = Number.parseInt(parts[2], 10);
  const day = Number.parseInt(parts[3], 10);
  const probe = new Date(Date.UTC(year, month - 1, day));

  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }

  return `${parts[1]}-${parts[2]}-${parts[3]}`;
}

/**
 * Valida e normaliza as linhas: o que não serve é recusado com motivo, o resto
 * segue com todos os campos decididos (`null` em vez de `undefined`).
 */
export function prepareRows(args: {
  readonly rows: readonly ImportRowInput[];
  readonly ownedCategories: ReadonlySet<string>;
}): {
  readonly prepared: {
    readonly index: number;
    readonly date: string;
    readonly description: string;
    readonly amountInCents: number;
    readonly fitId: string | null;
    readonly categoryId: string | null;
  }[];
  readonly skippedRows: SkippedImportRow[];
} {
  const skippedRows: SkippedImportRow[] = [];
  const prepared: {
    readonly index: number;
    readonly date: string;
    readonly description: string;
    readonly amountInCents: number;
    readonly fitId: string | null;
    readonly categoryId: string | null;
  }[] = [];

  for (const [index, row] of args.rows.entries()) {
    if (row.date === null) {
      skippedRows.push({ index, reason: 'Linha sem data.' });
      continue;
    }

    const date = parseCalendarDate(row.date);

    if (date === null) {
      skippedRows.push({ index, reason: `Data inexistente: "${row.date}".` });
      continue;
    }

    if (row.amountInCents === null || !Number.isFinite(row.amountInCents)) {
      skippedRows.push({ index, reason: 'Linha sem valor.' });
      continue;
    }

    if (!Number.isInteger(row.amountInCents) || row.amountInCents === 0) {
      skippedRows.push({ index, reason: 'Valor inválido (zero ou não inteiro, em cêntimos).' });
      continue;
    }

    if (Math.abs(row.amountInCents) > MAX_AMOUNT_IN_CENTS) {
      skippedRows.push({ index, reason: 'Valor acima do limite suportado.' });
      continue;
    }

    if (
      row.categoryId !== null &&
      row.categoryId !== undefined &&
      !args.ownedCategories.has(row.categoryId)
    ) {
      skippedRows.push({ index, reason: 'Categoria não encontrada ou não é tua.' });
      continue;
    }

    prepared.push({
      index,
      date,
      description: row.description,
      amountInCents: row.amountInCents,
      fitId: row.fitId ?? null,
      categoryId: row.categoryId ?? null,
    });
  }

  return { prepared, skippedRows };
}

/**
 * Lê o que já existe e insere o que falta — **na ordem certa**.
 *
 * A leitura dentro da transação é a correção do I1: em PostgreSQL um `INSERT`
 * que viola a restrição única aborta a transação, e um `catch` com `continue` não
 * a recupera. Filtrar antes de inserir evita o erro em vez de o tratar.
 */
export async function runConfirm(args: {
  readonly tx: ConfirmTx;
  readonly userId: string;
  readonly accountId: string;
  /** Cartão do extrato, quando o utilizador o escolheu e a posse foi confirmada. */
  readonly cardId?: string;
  readonly rows: readonly ImportRowInput[];
  readonly ownedCategories: ReadonlySet<string>;
}): Promise<ConfirmOutcome> {
  const { prepared, skippedRows } = prepareRows({
    rows: args.rows,
    ownedCategories: args.ownedCategories,
  });

  /*
   * Identificadores derivados, calculados **sobre a lista toda** e pela ordem do
   * ficheiro: é a mesma função que a pré-visualização usa, pelo que a linha que
   * ali apareceu como `duplicate` também aqui é reconhecida, e a que ali apareceu
   * como `new` recebe exatamente o identificador que foi mostrado.
   */
  const identified = withImportIdentifiers(prepared);

  const wantedIds = identified
    .map((row) => row.derivedFitId)
    .filter((id): id is string => id !== null);

  const taken =
    wantedIds.length === 0
      ? []
      : asRows(
          await args.tx.transaction.findMany({
            where: {
              userId: args.userId,
              financialAccountId: args.accountId,
              fitId: { in: wantedIds },
            },
            select: { fitId: true },
          }),
        );

  const takenIds = new Set(
    taken.map((row) => row['fitId']).filter((id): id is string => typeof id === 'string'),
  );

  /*
   * Movimentos gravados **antes** desta versão, sem identificador: são
   * reconhecidos pela impressão digital, senão voltariam a entrar na primeira
   * reimportação depois da correção.
   */
  const withoutId = asRows(
    await args.tx.transaction.findMany({
      where: { userId: args.userId, financialAccountId: args.accountId, fitId: null },
      select: { date: true, amountInCents: true, description: true },
    }),
  );

  const takenFingerprints = new Set(
    withoutId
      .map((row) => {
        const date = row['date'];
        const amount = row['amountInCents'];
        const description = row['description'];

        return importFitId(
          null,
          date instanceof Date ? date.toISOString().slice(0, 10) : null,
          typeof amount === 'number' ? amount : null,
          typeof description === 'string' ? description : '',
        );
      })
      .filter((id): id is string => id !== null),
  );

  const seen = new Set<string>();
  const imported: ImportedTransactionRef[] = [];
  let alreadyExists = 0;

  for (const row of identified) {
    const fitId = row.derivedFitId;

    if (fitId === null) {
      skippedRows.push({ index: row.index, reason: 'Não consegui identificar a linha.' });
      continue;
    }

    if (takenIds.has(fitId) || takenFingerprints.has(fitId) || seen.has(fitId)) {
      alreadyExists += 1;
      continue;
    }

    seen.add(fitId);

    const date = new Date(`${row.date}T00:00:00.000Z`);
    const description = row.description === '' ? null : row.description;

    const record = await args.tx.transaction.create({
      data: {
        userId: args.userId,
        // O sinal decide o tipo: uma saída é um gasto, uma entrada é um ganho. O
        // extrato não traz mais informação do que isto, e inventar um tipo a
        // partir do texto seria adivinhar.
        kind: row.amountInCents < 0 ? 'EXPENSE' : 'INCOME',
        status: 'CONFIRMED',
        amountInCents: row.amountInCents,
        date,
        description,
        financialAccountId: args.accountId,
        categoryId: row.categoryId,
        cardId: args.cardId ?? null,
        // Um movimento de extrato é algo que já aconteceu no banco.
        settled: true,
        settledOn: date,
        /*
         * Com cartão escolhido, o meio é **crédito**: `CreditCard` é, por
         * definição, um cartão de crédito. Sem cartão, mantém-se `DEBIT` — é o
         * que o extrato de conta sempre significou aqui.
         */
        paymentMethod: args.cardId === undefined ? 'DEBIT' : 'CREDIT',
        paymentCondition: 'SINGLE',
        fitId,
        origin: 'IMPORTED',
      },
      select: { id: true },
    });

    imported.push({
      transactionId: asCreatedId(record),
      fitId,
      date: row.date,
      amountInCents: row.amountInCents,
      descriptionDigest: descriptionDigest(description),
      categoryId: row.categoryId,
    });
  }

  return {
    created: imported.length,
    alreadyExists,
    skippedRows,
    imported,
  };
}

/** Tipo reexportado para quem constrói a pré-visualização. */
export type { ImportFormat };
