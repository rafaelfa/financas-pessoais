import { createRequire } from 'node:module';
import { resolve } from 'node:path';

import { databaseUrl } from './env';

/**
 * Acesso à base de dados para a limpeza dos utilizadores de teste.
 *
 * O `pg` não está instalado na raiz (é dependência de `@repo/db`), e acrescentá-lo
 * seria uma dependência nova na raiz só para apagar linhas. Resolve-se a partir do
 * pacote onde ele já vive. O `smoke.mjs` faz o mesmo caminho, por outra via
 * (`node packages/db/smoke.mjs` corre com o `node_modules` do pacote).
 */

interface QueryResult {
  readonly rowCount: number | null;
  readonly rows: Record<string, unknown>[];
}

interface PgClient {
  connect(): Promise<void>;
  query(text: string, values?: readonly unknown[]): Promise<QueryResult>;
  end(): Promise<void>;
}

interface PgModule {
  readonly Client: new (config: { connectionString: string }) => PgClient;
}

const requireFromDb = createRequire(resolve(process.cwd(), 'packages', 'db', 'package.json'));
const pg = requireFromDb('pg') as PgModule;

/** Prefixo de todos os utilizadores criados pelos e2e. */
export const PREFIXO_UTILIZADOR_E2E = 'e2e-';

/** Abre uma ligação, corre o que for preciso e fecha sempre. */
async function withClient<T>(run: (client: PgClient) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: databaseUrl() });

  await client.connect();

  try {
    return await run(client);
  } finally {
    await client.end().catch(() => undefined);
  }
}

/**
 * Apaga **todos** os utilizadores `e2e-*` e o que lhes pertence.
 *
 * Corre no arranque (para limpar restos de uma corrida interrompida) e no fim,
 * aconteça o que acontecer aos testes. As relações têm `onDelete: Cascade`, é o
 * mesmo caminho que o `smoke.mjs` usa para os utilizadores `smoke-*`.
 */
export async function apagarUtilizadoresDeTeste(): Promise<number> {
  return withClient(async (client) => {
    const result = await client.query('DELETE FROM "user" WHERE email LIKE $1', [
      `${PREFIXO_UTILIZADOR_E2E}%`,
    ]);

    return result.rowCount ?? 0;
  });
}

/** Quantos utilizadores de teste existem agora (0 é o estado limpo). */
export async function contarUtilizadoresDeTeste(): Promise<number> {
  return withClient(async (client) => {
    const result = await client.query(
      'SELECT count(*)::int AS total FROM "user" WHERE email LIKE $1',
      [`${PREFIXO_UTILIZADOR_E2E}%`],
    );

    return Number(result.rows[0]?.total ?? 0);
  });
}

/** O que o aprovisionamento criou para um utilizador, medido na base. */
export interface AprovisionamentoMedido {
  readonly userId: string | undefined;
  readonly categorias: number;
  readonly contas: number;
  readonly contaPrincipal: string | undefined;
  readonly saldoAberturaDaConta: number | undefined;
}

/** Lê o aprovisionamento de um utilizador pelo e-mail (o critério do fumo). */
export async function lerAprovisionamento(email: string): Promise<AprovisionamentoMedido> {
  return withClient(async (client) => {
    const user = await client.query('SELECT id FROM "user" WHERE email = $1', [email]);
    const userId = user.rows[0]?.id;

    if (typeof userId !== 'string') {
      return {
        userId: undefined,
        categorias: 0,
        contas: 0,
        contaPrincipal: undefined,
        saldoAberturaDaConta: undefined,
      };
    }

    const [categories, accounts] = await Promise.all([
      client.query('SELECT count(*)::int AS total FROM category WHERE "userId" = $1', [userId]),
      client.query(
        'SELECT name, "openingBalanceInCents" FROM financial_account WHERE "userId" = $1 ORDER BY "createdAt" ASC',
        [userId],
      ),
    ]);

    const primeira = accounts.rows[0];

    return {
      userId,
      categorias: Number(categories.rows[0]?.total ?? 0),
      contas: accounts.rows.length,
      contaPrincipal: typeof primeira?.name === 'string' ? primeira.name : undefined,
      saldoAberturaDaConta:
        typeof primeira?.openingBalanceInCents === 'number'
          ? primeira.openingBalanceInCents
          : undefined,
    };
  });
}

/**
 * Apaga um utilizador de teste pelo e-mail exato.
 *
 * É o mesmo caminho que `apagarUtilizadoresDeTeste` faz em bloco e que o
 * `globalTeardown` repete no fim: serve para um spec que cria um utilizador
 * **próprio** o poder largar no `afterAll`, sem esperar pelo fim da corrida.
 */
export async function apagarUtilizador(email: string): Promise<number> {
  return withClient(async (client) => {
    const result = await client.query('DELETE FROM "user" WHERE email = $1', [email]);

    return result.rowCount ?? 0;
  });
}

/**
 * O `id` de um lançamento do utilizador, pela descrição.
 *
 * As descrições dos specs levam um sufixo da corrida, para não colidirem com os
 * movimentos que outros specs deixaram no mesmo utilizador.
 */
export async function idDoLancamento(
  email: string,
  descricao: string,
): Promise<string | undefined> {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT t.id
         FROM "transaction" t
         JOIN financial_account a ON a.id = t."financialAccountId"
         JOIN "user" u ON u.id = a."userId"
        WHERE u.email = $1 AND t.description = $2
        ORDER BY t."createdAt" DESC
        LIMIT 1`,
      [email, descricao],
    );

    const id = result.rows[0]?.id;

    return typeof id === 'string' ? id : undefined;
  });
}

/** Um lançamento lido da base, com os campos que o diagnóstico mede. */
export interface LancamentoMedido {
  readonly id: string;
  readonly status: string;
  readonly origin: string;
  readonly settled: boolean;
  readonly amountInCents: number;
  readonly date: string;
}

/** Lê o lançamento por `id`: é esta a leitura antes/depois de cada passo. */
export async function lerLancamento(id: string): Promise<LancamentoMedido | undefined> {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT id, status::text AS status, origin::text AS origin, settled,
              "amountInCents" AS amount, to_char(date, 'YYYY-MM-DD') AS dia
         FROM "transaction"
        WHERE id = $1`,
      [id],
    );

    const row = result.rows[0];

    if (row === undefined) {
      return undefined;
    }

    return {
      id: String(row.id),
      status: String(row.status),
      origin: String(row.origin),
      settled: Boolean(row.settled),
      amountInCents: Number(row.amount),
      date: String(row.dia),
    };
  });
}

/**
 * Força o `status` de um lançamento.
 *
 * É **preparação do cenário**, não o caminho medido: garante que o lançamento
 * está `PENDING` antes de se clicar no menu, para que a mudança observada seja
 * atribuível ao clique e não a outra escrita qualquer.
 */
export async function definirStatusDoLancamento(
  id: string,
  status: 'PENDING' | 'CONFIRMED' | 'IGNORED',
): Promise<void> {
  await withClient(async (client) => {
    await client.query('UPDATE "transaction" SET status = $2::"TransactionStatus" WHERE id = $1', [
      id,
      status,
    ]);
  });
}

/** Conta as transações de um utilizador (por e-mail) numa conta com dado nome. */
export async function contarTransacoes(email: string, nomeDaConta?: string): Promise<number> {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT count(*)::int AS total
         FROM "transaction" t
         JOIN financial_account a ON a.id = t."financialAccountId"
         JOIN "user" u ON u.id = a."userId"
        WHERE u.email = $1 AND ($2::text IS NULL OR a.name = $2)`,
      [email, nomeDaConta ?? null],
    );

    return Number(result.rows[0]?.total ?? 0);
  });
}
