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

/* ------------------------------------------------------------------------- *
 * Contas a pagar/receber e grupos de contas (T3)
 *
 * Leitura e limpeza para os percursos de `45-contas-pagar-receber` e
 * `55-consolidacao-contas`. Como no resto deste ficheiro, a base só é usada para
 * **confirmar** o que a interface fez e para limpar o que o spec criou — nunca
 * para preparar o caminho medido.
 * ------------------------------------------------------------------------- */

/** Uma conta a pagar/receber lida da base. */
export interface ContaAPagarMedida {
  readonly id: string;
  readonly amountInCents: number;
  readonly status: string;
  readonly paidAmountInCents: number;
  readonly financialAccountId: string | null;
}

/** A conta a pagar/receber do utilizador com esta descrição exata. */
export async function lerContaAPagar(
  email: string,
  descricao: string,
): Promise<ContaAPagarMedida | undefined> {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT r.id,
              r."amountInCents" AS amount,
              r.status::text AS status,
              r."paidAmountInCents" AS paid,
              r."financialAccountId" AS conta
         FROM receivable_payable r
         JOIN "user" u ON u.id = r."userId"
        WHERE u.email = $1 AND r.description = $2
        ORDER BY r."createdAt" DESC
        LIMIT 1`,
      [email, descricao],
    );

    const row = result.rows[0];

    if (row === undefined) {
      return undefined;
    }

    return {
      id: String(row.id),
      amountInCents: Number(row.amount),
      status: String(row.status),
      paidAmountInCents: Number(row.paid),
      financialAccountId: typeof row.conta === 'string' ? row.conta : null,
    };
  });
}

/** Quantas contas a pagar/receber do utilizador começam por este prefixo. */
export async function contarContasAPagar(email: string, prefixo: string): Promise<number> {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT count(*)::int AS total
         FROM receivable_payable r
         JOIN "user" u ON u.id = r."userId"
        WHERE u.email = $1 AND r.description LIKE $2`,
      [email, `${prefixo}%`],
    );

    return Number(result.rows[0]?.total ?? 0);
  });
}

/** Quantas linhas tem o grupo com este nome (0 se o grupo não existir). */
export async function contarItensDoGrupo(email: string, nome: string): Promise<number> {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT count(i.id)::int AS total
         FROM account_group g
         JOIN "user" u ON u.id = g."userId"
         LEFT JOIN account_group_item i ON i."accountGroupId" = g.id
        WHERE u.email = $1 AND g.name = $2
        GROUP BY g.id`,
      [email, nome],
    );

    return Number(result.rows[0]?.total ?? 0);
  });
}

/**
 * Limpeza de um spec: apaga movimentos, contas a pagar/receber, grupos e contas
 * financeiras do utilizador cujo nome/descrição comece pelo prefixo.
 *
 * Os **movimentos** entram na limpeza de propósito: o `globalTeardown` apaga o
 * utilizador e a cascata leva-os, mas isso só acontece se a corrida chegar ao
 * fim. Um spec que rebente a meio deixaria movimentos órfãos no utilizador
 * partilhado; apagá-los aqui faz o resíduo deixar de depender da cascata. O que
 * ficar por apagar (outras tabelas do utilizador de teste) continua a ser
 * apanhado pela cascata do teardown — é a rede, não a via principal.
 *
 * A ordem importa: movimentos antes das contas financeiras (a FK aponta para
 * elas), grupos antes das contas (as linhas do grupo caem por cascata) e contas a
 * pagar antes das contas financeiras.
 */
export async function limparDadosDoSpec(
  email: string,
  prefixo: string,
): Promise<{
  movimentos: number;
  contasAPagar: number;
  grupos: number;
  contasFinanceiras: number;
}> {
  return withClient(async (client) => {
    const movimentos = await client.query(
      `DELETE FROM "transaction"
        WHERE "userId" = (SELECT id FROM "user" WHERE email = $1)
          AND (
            description LIKE $2
            OR "financialAccountId" IN (
              SELECT id FROM financial_account
               WHERE "userId" = (SELECT id FROM "user" WHERE email = $1)
                 AND name LIKE $2
            )
          )`,
      [email, `${prefixo}%`],
    );
    const contasAPagar = await client.query(
      `DELETE FROM receivable_payable
        WHERE "userId" = (SELECT id FROM "user" WHERE email = $1)
          AND description LIKE $2`,
      [email, `${prefixo}%`],
    );
    const grupos = await client.query(
      `DELETE FROM account_group
        WHERE "userId" = (SELECT id FROM "user" WHERE email = $1)
          AND name LIKE $2`,
      [email, `${prefixo}%`],
    );
    const contasFinanceiras = await client.query(
      `DELETE FROM financial_account
        WHERE "userId" = (SELECT id FROM "user" WHERE email = $1)
          AND name LIKE $2`,
      [email, `${prefixo}%`],
    );

    return {
      movimentos: movimentos.rowCount ?? 0,
      contasAPagar: contasAPagar.rowCount ?? 0,
      grupos: grupos.rowCount ?? 0,
      contasFinanceiras: contasFinanceiras.rowCount ?? 0,
    };
  });
}

/** O `id` de uma conta financeira do utilizador, pelo nome exato. */
export async function idDaConta(email: string, nome: string): Promise<string | undefined> {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT a.id
         FROM financial_account a
         JOIN "user" u ON u.id = a."userId"
        WHERE u.email = $1 AND a.name = $2
        LIMIT 1`,
      [email, nome],
    );

    const id = result.rows[0]?.id;

    return typeof id === 'string' ? id : undefined;
  });
}

/** O movimento criado pelo pagamento de uma conta a pagar/receber. */
export interface MovimentoDoPagamento {
  readonly id: string;
  readonly amountInCents: number;
  readonly kind: string;
  readonly status: string;
  readonly settled: boolean;
  readonly financialAccountId: string | null;
}

/**
 * Lê o movimento com a descrição da conta paga (o pagamento cria-o com a mesma
 * descrição). Serve para conferir o **montante**, o `kind` e a conta — o que o
 * spec contava mas não media.
 */
export async function lerMovimentoDoPagamento(
  email: string,
  descricao: string,
): Promise<MovimentoDoPagamento | undefined> {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT t.id,
              t."amountInCents" AS amount,
              t.kind::text AS kind,
              t.status::text AS status,
              t.settled,
              t."financialAccountId" AS conta
         FROM "transaction" t
         JOIN "user" u ON u.id = t."userId"
        WHERE u.email = $1 AND t.description = $2
        ORDER BY t."createdAt" DESC
        LIMIT 1`,
      [email, descricao],
    );

    const row = result.rows[0];

    if (row === undefined) {
      return undefined;
    }

    return {
      id: String(row.id),
      amountInCents: Number(row.amount),
      kind: String(row.kind),
      status: String(row.status),
      settled: Boolean(row.settled),
      financialAccountId: typeof row.conta === 'string' ? row.conta : null,
    };
  });
}

/* ------------------------------------------------------------------------- *
 * Património — bens e dívidas (T38)
 *
 * Leitura e limpeza para `26-patrimonio`. A base confirma o que a interface
 * escreveu (valor, arquivo) e apaga o que o spec criou; não prepara o caminho.
 * ------------------------------------------------------------------------- */

/** Um bem lido da base. */
export interface BemMedido {
  readonly id: string;
  readonly valueInCents: number;
  readonly archivedAt: string | null;
}

/** O bem do utilizador com este nome exato. */
export async function lerBem(email: string, nome: string): Promise<BemMedido | undefined> {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT a.id, a."valueInCents" AS valor, a."archivedAt" AS arquivado
         FROM asset a
         JOIN "user" u ON u.id = a."userId"
        WHERE u.email = $1 AND a.name = $2
        ORDER BY a."createdAt" DESC
        LIMIT 1`,
      [email, nome],
    );

    const row = result.rows[0];

    if (row === undefined) {
      return undefined;
    }

    return {
      id: String(row.id),
      valueInCents: Number(row.valor),
      archivedAt: row.arquivado === null ? null : String(row.arquivado),
    };
  });
}

/** Uma dívida lida da base. */
export interface DividaMedida {
  readonly id: string;
  readonly principalInCents: number;
  readonly outstandingInCents: number;
  readonly archivedAt: string | null;
}

/** A dívida do utilizador com este nome exato. */
export async function lerDivida(email: string, nome: string): Promise<DividaMedida | undefined> {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT l.id, l."principalInCents" AS capital, l."outstandingInCents" AS saldo,
              l."archivedAt" AS arquivado
         FROM liability l
         JOIN "user" u ON u.id = l."userId"
        WHERE u.email = $1 AND l.name = $2
        ORDER BY l."createdAt" DESC
        LIMIT 1`,
      [email, nome],
    );

    const row = result.rows[0];

    if (row === undefined) {
      return undefined;
    }

    return {
      id: String(row.id),
      principalInCents: Number(row.capital),
      outstandingInCents: Number(row.saldo),
      archivedAt: row.arquivado === null ? null : String(row.arquivado),
    };
  });
}

/** Quantos bens e dívidas do utilizador começam pelo prefixo (ativos e arquivados). */
export async function contarPatrimonio(email: string, prefixo: string): Promise<number> {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT (
         (SELECT count(*) FROM asset a JOIN "user" u ON u.id = a."userId"
           WHERE u.email = $1 AND a.name LIKE $2)
         +
         (SELECT count(*) FROM liability l JOIN "user" u ON u.id = l."userId"
           WHERE u.email = $1 AND l.name LIKE $2)
       )::int AS total`,
      [email, `${prefixo}%`],
    );

    return Number(result.rows[0]?.total ?? 0);
  });
}

/** Apaga os bens e dívidas do utilizador cujo nome comece pelo prefixo. */
export async function limparPatrimonioDoSpec(
  email: string,
  prefixo: string,
): Promise<{ bens: number; dividas: number }> {
  return withClient(async (client) => {
    const bens = await client.query(
      `DELETE FROM asset
        WHERE "userId" = (SELECT id FROM "user" WHERE email = $1) AND name LIKE $2`,
      [email, `${prefixo}%`],
    );
    const dividas = await client.query(
      `DELETE FROM liability
        WHERE "userId" = (SELECT id FROM "user" WHERE email = $1) AND name LIKE $2`,
      [email, `${prefixo}%`],
    );

    return { bens: bens.rowCount ?? 0, dividas: dividas.rowCount ?? 0 };
  });
}
