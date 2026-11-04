import { describe, expect, it } from 'vitest';

import { importFitId } from '../preview';

/**
 * Testes do núcleo da confirmação, com um duplo que imita o PostgreSQL.
 *
 * -----------------------------------------------------------------------------
 * PORQUE O IMPORT É PELO ALIAS DO `vitest.config.ts`
 * -----------------------------------------------------------------------------
 * O núcleo vive em `apps/web/src/server/import-confirm.ts`, que está fora do
 * `rootDir` de `packages/shared` — um `import` relativo direto dava
 * `TS6059: File ... is not under rootDir` e o `typecheck` do pacote deixava de
 * passar. A resolução do alias é feita pelo Vitest, que tipa o resultado com a
 * interface local `ConfirmCore` (estrutural), e o `tsc` não segue o caminho. O
 * compromisso é explícito: ganha-se o teste a correr em CI sem partir o
 * `typecheck`, e perde-se a verificação de tipos do ficheiro do servidor — que já
 * é verificada pelo `typecheck` de `apps/web`.
 */
const CORE_PATH = '@/server/import-confirm';

interface ConfirmOutcome {
  created: number;
  alreadyExists: number;
  skippedRows: { index: number; reason: string }[];
  imported: { transactionId: string }[];
}

interface ConfirmCore {
  runConfirm(args: {
    tx: unknown;
    userId: string;
    accountId: string;
    rows: readonly unknown[];
    ownedCategories: ReadonlySet<string>;
  }): Promise<ConfirmOutcome>;
}

const { runConfirm } = (await import(CORE_PATH)) as ConfirmCore;

/**
 * -----------------------------------------------------------------------------
 * O QUE ESTES TESTES PROVAM (I1 e I2 da verificação T7.5)
 * -----------------------------------------------------------------------------
 * O defeito I1 era invisível em teste porque só acontece dentro de uma transação
 * de PostgreSQL: um `INSERT` que viola a restrição única **aborta a transação**,
 * e um `catch` com `continue` não a recupera. O `COMMIT` de uma transação abortada
 * é um `ROLLBACK` silencioso — a ação devolvia `created: 1` e a conta não mudava.
 *
 * O duplo abaixo imita isso: depois de uma violação, todas as operações lançam
 * `25P02` (como o PostgreSQL) e o `commit()` não grava nada. Sem esta fidelidade,
 * os testes não provariam nada — é por isso que há um teste só para o duplo.
 *
 * Os números são os que o verificador mediu: duplicado na **última** posição
 * (2 → 2, `created: 1`), duplicado na **primeira** (perde a linha nova válida) e
 * **dois pedidos em paralelo** de um CSV sem `Id` (6 → 12).
 */

const USER = 'user-1';
const ACCOUNT = 'acc-1';

interface FakeRow {
  id: string;
  userId: string;
  financialAccountId: string;
  /** Cartão do extrato, quando a confirmação o recebeu. */
  cardId?: string | null;
  paymentMethod?: string;
  fitId: string | null;
  date: Date;
  amountInCents: number;
  description: string | null;
}

class FakePrismaError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'PrismaClientKnownRequestError';
    this.code = code;
  }
}

interface FakeDb {
  rows: FakeRow[];
  preReads: number;
  inserts: number;
}

function createFakeDb(rows: readonly FakeRow[] = []): FakeDb {
  return { rows: [...rows], preReads: 0, inserts: 0 };
}

function createFakeTx(db: FakeDb, hooks: { beforeCreate?: () => void } = {}) {
  let aborted: string | null = null;
  let sequence = 0;
  const pending: FakeRow[] = [];

  const assertUsable = (): void => {
    if (aborted !== null) {
      throw new FakePrismaError(
        '25P02',
        'current transaction is aborted, commands ignored until end of transaction block',
      );
    }
  };

  const api = {
    transaction: {
      async findMany(args: unknown): Promise<unknown> {
        assertUsable();
        db.preReads += 1;

        const { where, select } = args as {
          where: { userId?: unknown; financialAccountId?: unknown; fitId?: unknown };
          select: Record<string, boolean>;
        };

        const found = db.rows.filter((row) => {
          if (where.userId !== undefined && row.userId !== where.userId) return false;

          if (
            where.financialAccountId !== undefined &&
            row.financialAccountId !== where.financialAccountId
          ) {
            return false;
          }

          if (where.fitId !== undefined) {
            const wanted = where.fitId;

            if (wanted === null) return row.fitId === null;

            if (typeof wanted === 'object' && wanted !== null && 'in' in wanted) {
              const list = (wanted as { in: unknown }).in;
              return !Array.isArray(list) || list.includes(row.fitId);
            }

            return row.fitId === wanted;
          }

          return true;
        });

        if (select['fitId'] === true && Object.keys(select).length === 1) {
          return found.map((row) => ({ fitId: row.fitId }));
        }

        return found.map((row) => ({
          date: row.date,
          amountInCents: row.amountInCents,
          description: row.description,
        }));
      },

      async create(args: unknown): Promise<unknown> {
        assertUsable();
        db.inserts += 1;
        hooks.beforeCreate?.();

        const { data } = args as { data: Omit<FakeRow, 'id'> };
        const fitId = (data.fitId ?? null) as string | null;

        // A restrição `@@unique([financialAccountId, fitId])`. No PostgreSQL este
        // erro aborta a transação — é isso que se imita.
        if (
          fitId !== null &&
          db.rows.some(
            (row) => row.financialAccountId === data.financialAccountId && row.fitId === fitId,
          )
        ) {
          aborted = 'P2002';
          throw new FakePrismaError(
            'P2002',
            'Unique constraint failed on the fields: (`financialAccountId`,`fitId`)',
          );
        }

        sequence += 1;
        const created: FakeRow = { ...(data as Omit<FakeRow, 'id'>), id: `tx-${String(sequence)}` };
        pending.push(created);

        return { id: created.id };
      },
    },

    /** O COMMIT: se a transação abortou, não grava nada (o ROLLBACK silencioso). */
    commit(): void {
      if (aborted === null) {
        db.rows.push(...pending);
      }
    },
  };

  return api;
}

function row(
  date: string,
  description: string,
  amountInCents: number,
  fitId: string | null = null,
) {
  return { date, description, amountInCents, fitId, categoryId: null };
}

/** Corre uma confirmação completa, com commit, como a ação faz. */
async function confirm(
  db: FakeDb,
  rows: ReturnType<typeof row>[],
  hooks: { beforeCreate?: () => void } = {},
  cardId?: string,
) {
  const tx = createFakeTx(db, hooks);

  try {
    const outcome = await runConfirm({
      tx: tx as never,
      userId: USER,
      accountId: ACCOUNT,
      ...(cardId === undefined ? {} : { cardId }),
      rows,
      ownedCategories: new Set<string>(),
    });

    tx.commit();

    return { outcome, aborted: false };
  } catch (error) {
    tx.commit();

    return { outcome: null, aborted: true, error };
  }
}

const EXISTING: FakeRow = {
  id: 'existente',
  userId: USER,
  financialAccountId: ACCOUNT,
  fitId: 'JA-EXISTE',
  date: new Date('2026-10-01T00:00:00.000Z'),
  amountInCents: -100,
  description: 'já existe',
};

describe('duplo do PostgreSQL (a fidelidade de que os testes dependem)', () => {
  it('aborta a transação na violação única e o commit não grava nada', async () => {
    const db = createFakeDb([EXISTING]);
    const tx = createFakeTx(db);

    await expect(
      tx.transaction.create({
        data: { ...EXISTING, id: undefined, description: 'de novo' },
        select: { id: true },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });

    // Depois do erro a transação está inutilizável — como no PostgreSQL.
    await expect(
      tx.transaction.findMany({ where: { userId: USER }, select: { fitId: true } }),
    ).rejects.toMatchObject({ code: '25P02' });

    tx.commit();

    expect(db.rows).toHaveLength(1);
  });
});

describe('I1 — o duplicado dentro da transação', () => {
  it('duplicado na última posição: grava a linha nova e diz a verdade', async () => {
    const db = createFakeDb([EXISTING]);

    const { outcome, aborted } = await confirm(db, [
      row('2026-10-02', 'movimento novo', -2_500, 'NOVO-1'),
      row('2026-10-01', 'já existe', -100, 'JA-EXISTE'),
    ]);

    expect(aborted).toBe(false);
    expect(outcome?.created).toBe(1);
    expect(outcome?.alreadyExists).toBe(1);
    // O cenário medido: a conta tem de ter ganho a linha nova (era 1, fica 2).
    expect(db.rows).toHaveLength(2);
    expect(db.rows.map((r) => r.fitId)).toEqual(['JA-EXISTE', 'NOVO-1']);
  });

  it('duplicado na primeira posição: a linha nova válida não se perde', async () => {
    const db = createFakeDb([EXISTING]);

    const { outcome, aborted } = await confirm(db, [
      row('2026-10-01', 'já existe', -100, 'JA-EXISTE'),
      row('2026-10-02', 'movimento novo', -2_500, 'NOVO-1'),
    ]);

    expect(aborted).toBe(false);
    expect(outcome?.created).toBe(1);
    expect(db.rows).toHaveLength(2);
    expect(db.rows[1]?.fitId).toBe('NOVO-1');
  });

  it('reimportar o mesmo ficheiro não cria nada e não aborta', async () => {
    const db = createFakeDb();
    const rows = [row('2026-10-01', 'Renda', -85_000), row('2026-10-02', 'Vencimento', 215_000)];

    const first = await confirm(db, rows);
    expect(first.outcome?.created).toBe(2);

    const second = await confirm(
      db,
      db.rows.map((record) => ({
        date: record.date.toISOString().slice(0, 10),
        description: record.description ?? '',
        amountInCents: record.amountInCents,
        fitId: record.fitId,
        categoryId: null,
      })),
    );

    expect(second.aborted).toBe(false);
    expect(second.outcome?.created).toBe(0);
    expect(second.outcome?.alreadyExists).toBe(2);
    expect(db.rows).toHaveLength(2);
  });

  it('lê dentro da transação antes de escrever', async () => {
    const db = createFakeDb();

    await confirm(db, [row('2026-10-01', 'Renda', -85_000)]);

    expect(db.preReads).toBeGreaterThanOrEqual(1);
    expect(db.inserts).toBe(1);
  });
});

describe('I2 — dois pedidos em paralelo de um CSV sem Id', () => {
  const CSV_ROWS = [
    row('2026-10-01', 'Vencimento outubro', 215_000),
    row('2026-10-02', 'Renda casa outubro', -85_000),
    row('2026-10-05', 'Compra Continente; Matosinhos', -6_437),
    row('2026-10-06', 'Transferência recebida João Silva', 120_000),
    row('2026-10-08', 'Seguro automóvel', -31_245),
    row('2026-10-09', 'Levantamento multibanco', -5_000),
  ];

  it('sequencial: o segundo pedido não grava nenhuma das 6', async () => {
    const db = createFakeDb();

    const first = await confirm(db, CSV_ROWS);
    const second = await confirm(db, CSV_ROWS);

    expect(first.outcome?.created).toBe(6);
    expect(second.outcome?.created).toBe(0);
    expect(second.outcome?.alreadyExists).toBe(6);
    // O cenário medido: 12 linhas. Tem de ficar em 6.
    expect(db.rows).toHaveLength(6);
  });

  it('corrida a sério (o outro pedido grava entre a leitura e o INSERT): nada fica duplicado', async () => {
    const db = createFakeDb();
    const rows = [row('2026-10-01', 'Renda casa outubro', -85_000)];
    let rivalCommitted = false;

    const { aborted, error } = await confirm(db, rows, {
      beforeCreate: () => {
        if (rivalCommitted) return;

        rivalCommitted = true;
        db.rows.push({
          id: 'rival-1',
          userId: USER,
          financialAccountId: ACCOUNT,
          fitId: importFitId(
            null,
            rows[0]?.date ?? null,
            rows[0]?.amountInCents ?? null,
            rows[0]?.description ?? '',
          ),
          date: new Date('2026-10-01T00:00:00.000Z'),
          amountInCents: -85_000,
          description: 'Renda casa outubro',
        });
      },
    });

    /*
     * A ação **não mente**: a transação aborta e o chamador fica a saber que nada
     * foi gravado — em vez de devolver `created: 1` com a conta igual.
     */
    expect(aborted).toBe(true);
    expect(error).toBeDefined();
    expect(db.rows).toHaveLength(1);
  });
});

describe('I8 e I9 — recusa por linha, não do payload inteiro', () => {
  it('uma data impossível recusa a linha e só essa', async () => {
    const db = createFakeDb();

    const { outcome } = await confirm(db, [
      row('2026-02-31', 'data impossível', -1_000),
      row('2026-10-02', 'válida', -2_500),
    ]);

    expect(outcome?.created).toBe(1);
    expect(db.rows).toHaveLength(1);
    expect(outcome?.skippedRows).toHaveLength(1);
    expect(outcome?.skippedRows[0]?.reason).toMatch(/inexistente/);
  });

  it('uma categoria que não é do utilizador recusa a linha em vez de a gravar sem categoria', async () => {
    const db = createFakeDb();
    const tx = createFakeTx(db);

    const outcome = await runConfirm({
      tx: tx as never,
      userId: USER,
      accountId: ACCOUNT,
      rows: [{ ...row('2026-10-02', 'válida', -2_500), categoryId: 'cat-de-outro' }],
      ownedCategories: new Set<string>(),
    });
    tx.commit();

    expect(outcome.created).toBe(0);
    expect(outcome.skippedRows).toHaveLength(1);
    expect(outcome.skippedRows[0]?.reason).toMatch(/Categoria/);
  });

  it('valor zero ou acima do Int é recusado com motivo', async () => {
    const db = createFakeDb();

    const { outcome } = await confirm(db, [
      row('2026-10-02', 'zero', 0),
      row('2026-10-03', 'absurdo', 99_999_999_999),
      row('2026-10-04', 'bom', -1_000),
    ]);

    expect(outcome?.created).toBe(1);
    expect(outcome?.skippedRows).toHaveLength(2);
    expect(db.rows).toHaveLength(1);
  });
});

describe('invariante da contagem', () => {
  it('created + alreadyExists + skippedRows cobre todas as linhas enviadas', async () => {
    const db = createFakeDb([EXISTING]);

    const rows = [
      row('2026-10-01', 'já existe', -100, 'JA-EXISTE'),
      row('2026-10-02', 'nova', -2_500, 'NOVO-1'),
      row('2026-02-31', 'data impossível', -1_000),
    ];

    const { outcome } = await confirm(db, rows);
    const total =
      (outcome?.created ?? 0) + (outcome?.alreadyExists ?? 0) + (outcome?.skippedRows.length ?? 0);

    expect(total).toBe(rows.length);
  });
});

describe('cartão do extrato', () => {
  /*
   * Um extrato de cartão é todo do mesmo cartão: o `cardId` é do lote, não da
   * linha. Sem ele, uma regra «só neste cartão» nunca apanhava um importado — e
   * era isso que o QA mediu.
   */
  it('sem cartão: grava `cardId` nulo e mantém o meio de pagamento em débito', async () => {
    const db = createFakeDb([]);
    const { outcome } = await confirm(db, [row('2026-10-02', 'padaria', -350)]);

    expect(outcome?.created).toBe(1);
    expect(db.rows[0]?.cardId).toBeNull();
    expect(db.rows[0]?.paymentMethod).toBe('DEBIT');
  });

  it('com cartão: grava o `cardId` e passa o meio de pagamento a crédito', async () => {
    const db = createFakeDb([]);
    const { outcome } = await confirm(
      db,
      [row('2026-10-02', 'compra no cartão', -350)],
      {},
      'cartao-1',
    );

    expect(outcome?.created).toBe(1);
    expect(db.rows[0]?.cardId).toBe('cartao-1');
    expect(db.rows[0]?.paymentMethod).toBe('CREDIT');
  });
});
