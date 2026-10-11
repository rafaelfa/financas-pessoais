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
