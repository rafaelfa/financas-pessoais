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
    const result = await client.query(
      'UPDATE "transaction" SET status = $2::"TransactionStatus" WHERE id = $1',
      [id, status],
    );

    /*
     * Um `UPDATE` que não apanha nada é um cenário que não foi montado, e um
     * teste por cima dele mede outra coisa. Falta aqui o `userId` no `WHERE`
     * (exceção conhecida: o id vem de `idDoLancamento(email, …)` e mudar a
     * assinatura obrigaria a mexer na spec 35, fora desta tarefa).
     */
    if (result.rowCount !== 1) {
      throw new Error(`Não mudei o estado de nenhum lançamento: ${id} não existe.`);
    }
  });
}

/** Um lançamento com os campos que os specs de edição medem. */
export interface LancamentoBruto {
  readonly id: string;
  readonly kind: string;
  readonly amountInCents: number;
  readonly description: string | null;
  readonly accountId: string | null;
  readonly transferGroupId: string | null;
  /** Compra metida numa fatura de cartão (T84): não sai da conta neste dia. */
  readonly invoiceId: string | null;
  readonly settled: boolean;
}

/**
 * Uma segunda conta na carteira, para o percurso da transferência (T84).
 *
 * O aprovisionamento cria uma só conta; transferir precisa de duas. Campos que o
 * produto escreve numa conta manual (`/contas`), sem SQL à escolha de quem chama.
 */
export async function criarContaDoSpec(email: string, nome: string): Promise<string> {
  const { userId } = await lerContextoDoUtilizador(email);

  return withClient(async (client) => {
    const result = await client.query(
      `INSERT INTO financial_account (id, "userId", type, name, "openingBalanceInCents", currency, origin, "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, 'WALLET'::"AccountType", $2, 0, 'EUR', 'MANUAL'::"AccountOrigin", now(), now())
       RETURNING id`,
      [userId, nome],
    );

    return String(result.rows[0]?.id ?? '');
  });
}

/** Todos os lançamentos do utilizador com esta descrição (o par de uma transferência dá 2). */
export async function lerPorDescricao(
  email: string,
  descricao: string,
): Promise<LancamentoBruto[]> {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT t.id, t.kind::text AS kind, t."amountInCents" AS amount, t.description,
              t."financialAccountId" AS conta, t."transferGroupId" AS grupo,
              t."invoiceId" AS fatura, t.settled
         FROM "transaction" t
         JOIN "user" u ON u.id = t."userId"
        WHERE u.email = $1 AND t.description = $2
        ORDER BY t."amountInCents" ASC`,
      [email, descricao],
    );

    return result.rows.map((row) => ({
      id: String(row.id),
      kind: String(row.kind),
      amountInCents: Number(row.amount),
      description: row.description === null ? null : String(row.description),
      accountId: row.conta === null ? null : String(row.conta),
      transferGroupId: row.grupo === null ? null : String(row.grupo),
      invoiceId: row.fatura === null ? null : String(row.fatura),
      settled: Boolean(row.settled),
    }));
  });
}

/**
 * Fixtures do que a interface **não** consegue produzir.
 *
 * Era um executor de SQL genérico, e SQL livre num
 * teste é uma porta aberta: uma spec podia inventar um estado que o produto
 * nunca produz e ficar verde sobre ele. Agora cada fixture tem nome e forma —
 * os campos que o produto escreveria, fixos aqui — e o SQL fica fechado neste
 * ficheiro. As asserções continuam a ler o ecrã.
 */

/*
 * Fixtures da cadeia de faturas (T61/T67) — a spec 41 é a única que as usa.
 * Vivem aqui porque a regra é «SQL só neste ficheiro»; este bloco é o preço dela.
 */

/** Identificadores do utilizador de teste: a conta e a categoria que os specs usam. */
export async function lerContextoDoUtilizador(email: string): Promise<{
  userId: string;
  contaId: string;
  categoriaDespesaId: string;
}> {
  return withClient(async (client) => {
    const utilizador = await client.query('SELECT id FROM "user" WHERE email = $1', [email]);
    const userId = String(utilizador.rows[0]?.id ?? '');
    const conta = await client.query(
      'SELECT id FROM financial_account WHERE "userId" = $1 ORDER BY "createdAt" LIMIT 1',
      [userId],
    );
    const categoria = await client.query(
      `SELECT id FROM category WHERE "userId" = $1 AND kind = 'EXPENSE'::"CategoryKind" LIMIT 1`,
      [userId],
    );

    return {
      userId,
      contaId: String(conta.rows[0]?.id ?? ''),
      categoriaDespesaId: String(categoria.rows[0]?.id ?? ''),
    };
  });
}

/** Um cartão com o dia de fecho e o de vencimento que o cenário precisa. */
export async function criarCartaoDoSpec(args: {
  readonly email: string;
  readonly nome: string;
  readonly fechoDia: number;
  readonly vencimentoDia: number;
}): Promise<string> {
  const { userId, contaId } = await lerContextoDoUtilizador(args.email);

  return withClient(async (client) => {
    const result = await client.query(
      `INSERT INTO "credit_card" (id, "userId", name, "closingDay", "dueDay", "creditLimitInCents", "paymentAccountId", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 100000, $5, now(), now()) RETURNING id`,
      [userId, args.nome, args.fechoDia, args.vencimentoDia, contaId],
    );

    return String(result.rows[0]?.id ?? '');
  });
}

/**
 * Uma fatura com o fecho e o vencimento pedidos.
 *
 * É a fixture do empate da T61: duas faturas do mesmo cartão a vencer no mesmo
 * dia. O formulário não cria faturas — só o motor, a partir de compras, e as
 * compras caem sempre em meses diferentes — por isso o cenário precisa de as
 * escrever; mas com os campos que o produto escreveria, e não com SQL à escolha
 * de quem chama.
 */
export async function criarFaturaDoSpec(args: {
  readonly cartaoId: string;
  readonly fecho: string;
  readonly vence: string;
  readonly totalInCents: number;
  readonly estado?: 'OPEN' | 'CLOSED' | 'PAID';
}): Promise<string> {
  return withClient(async (client) => {
    const result = await client.query(
      `INSERT INTO "invoice" (id, "userId", "cardId", "closingDate", "dueDate", "totalAmountInCents", "paidAmountInCents", "carriedOverInCents", status, "createdAt", "updatedAt")
       SELECT gen_random_uuid(), c."userId", c.id, $2::date, $3::date, $4, 0, 0, $5::"InvoiceStatus", now(), now()
         FROM "credit_card" c WHERE c.id = $1
       RETURNING id`,
      [args.cartaoId, args.fecho, args.vence, args.totalInCents, args.estado ?? 'CLOSED'],
    );

    return String(result.rows[0]?.id ?? '');
  });
}

/** Uma compra do cartão, apontada à fatura do seu ciclo. */
export async function criarCompraNaFaturaDoSpec(args: {
  readonly cartaoId: string;
  readonly faturaId: string;
  readonly descricao: string;
  readonly valorInCents: number;
  readonly data: string;
}): Promise<void> {
  return withClient(async (client) => {
    /*
     * A fatura tem de ser daquele cartão: uma compra numa fatura de outro cartão
     * é um estado que o produto nunca produz, e uma fixture que o aceita deixa
     * um teste verde sobre um estado impossível — a categoria que a T67 fecha.
     */
    const fatura = await client.query('SELECT "cardId" FROM "invoice" WHERE id = $1', [
      args.faturaId,
    ]);

    if (String(fatura.rows[0]?.cardId ?? '') !== args.cartaoId) {
      throw new Error(
        `A fatura ${args.faturaId} não é do cartão ${args.cartaoId} — a compra não foi criada.`,
      );
    }

    await client.query(
      `INSERT INTO "transaction" (id, "userId", kind, "amountInCents", date, description, "financialAccountId", "cardId", "invoiceId", settled, status, "updatedAt")
       SELECT gen_random_uuid(), c."userId", 'EXPENSE'::"TransactionKind", $2, $3::date, $4, c."paymentAccountId", c.id, $5, false, 'CONFIRMED'::"TransactionStatus", now()
         FROM "credit_card" c WHERE c.id = $1`,
      [args.cartaoId, -Math.abs(args.valorInCents), args.data, args.descricao, args.faturaId],
    );
  });
}

/** As faturas de um cartão, pela ordem da cadeia: fecho e vencimento. */
export async function lerFaturasDoCartao(
  cartaoId: string,
): Promise<readonly { id: string; fecho: string; vence: string }[]> {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT id, to_char("closingDate",'YYYY-MM-DD') AS fecho, to_char("dueDate",'YYYY-MM-DD') AS vence
         FROM "invoice" WHERE "cardId" = $1 ORDER BY "closingDate"`,
      [cartaoId],
    );

    return result.rows.map((row) => ({
      id: String(row.id),
      fecho: String(row.fecho),
      vence: String(row.vence),
    }));
  });
}

/** Move o fecho (e o vencimento) de uma fatura — um ciclo que ainda não fechou. */
export async function moverFechoDaFatura(args: {
  readonly email: string;
  readonly faturaId: string;
  readonly fecho: string;
  readonly vence: string;
}): Promise<void> {
  return withClient(async (client) => {
    /*
     * Com o `userId` no `WHERE`, como as outras escritas **desta tarefa**: o id
     * vem da fixture, mas um `UPDATE` sem dono num helper partilhado é a porta
     * que se abre sozinha no dia em que alguém lhe passar um id de fora.
     *
     * Exceção conhecida, no mesmo ficheiro: `definirStatusDoLancamento` ainda
     * atualiza por `id` sem dono (tem já a verificação de `rowCount`); fechá-la
     * obriga a mudar a assinatura e duas chamadas da spec 35.
     */
    const result = await client.query(
      `UPDATE "invoice" SET "closingDate" = $3::date, "dueDate" = $4::date
        WHERE id = $1 AND "userId" = (SELECT id FROM "user" WHERE email = $2)`,
      [args.faturaId, args.email, args.fecho, args.vence],
    );

    if (result.rowCount !== 1) {
      throw new Error(
        `Não mexi em nenhuma fatura: ${args.faturaId} não existe ou não é de ${args.email}.`,
      );
    }
  });
}

/** Um lançamento do utilizador, com ou sem categoria e com o estado pedido. */
export async function criarLancamentoDoSpec(args: {
  readonly email: string;
  readonly descricao: string;
  readonly valorInCents: number;
  readonly estado: 'PENDING' | 'CONFIRMED' | 'IGNORED';
  readonly comCategoria?: boolean;
}): Promise<void> {
  const { userId, contaId, categoriaDespesaId } = await lerContextoDoUtilizador(args.email);

  return withClient(async (client) => {
    await client.query(
      `INSERT INTO "transaction" (id, "userId", kind, "amountInCents", date, description, "financialAccountId", "categoryId", settled, status, "updatedAt")
       VALUES (gen_random_uuid(), $1, 'EXPENSE'::"TransactionKind", $2, CURRENT_DATE, $3, $4, $5, false, $6::"TransactionStatus", now())`,
      [
        userId,
        args.valorInCents,
        args.descricao,
        contaId,
        args.comCategoria === false ? null : categoriaDespesaId,
        args.estado,
      ],
    );
  });
}

/*
 * Contagens e lançamentos que mais de uma spec usa (T63/T66/T67).
 */

/** As três contagens da Revisão que um spec precisa de conferir na base. */
export async function contarEstadoDoUtilizador(email: string): Promise<{
  pendentes: number;
  semCategoria: number;
  contasVencidas: number;
}> {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT
         (SELECT count(*)::int FROM "transaction" t JOIN "user" u ON u.id = t."userId"
           WHERE u.email = $1 AND t.status = 'PENDING') AS pendentes,
         (SELECT count(*)::int FROM "transaction" t JOIN "user" u ON u.id = t."userId"
           WHERE u.email = $1 AND t.kind IN ('EXPENSE','INCOME') AND t."categoryId" IS NULL
             AND t.status <> 'IGNORED') AS "semCategoria",
         (SELECT count(*)::int FROM "receivable_payable" r JOIN "user" u ON u.id = r."userId"
           WHERE u.email = $1 AND r.status = 'OPEN' AND r."dueDate" < CURRENT_DATE) AS "contasVencidas"`,
      [email],
    );
    const linha = result.rows[0] ?? {};

    return {
      pendentes: Number(linha.pendentes ?? 0),
      semCategoria: Number(linha.semCategoria ?? 0),
      contasVencidas: Number(linha.contasVencidas ?? 0),
    };
  });
}

/** Faturas `CLOSED` com valor por pagar — a contagem "crua" da base (T60). */
export async function contarFaturasFechadasComValor(email: string): Promise<number> {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT count(*)::int AS total
         FROM "invoice" i
         JOIN "user" u ON u.id = i."userId"
        WHERE u.email = $1 AND i.status = 'CLOSED'
          AND (i."totalAmountInCents" - i."paidAmountInCents") > 0`,
      [email],
    );

    return Number(result.rows[0]?.total ?? 0);
  });
}

/** Apaga os cartões do spec (e as faturas deles) pelo prefixo do nome. */
export async function apagarCartoesDoSpec(email: string, prefixo: string): Promise<number> {
  return withClient(async (client) => {
    const user = await client.query('SELECT id FROM "user" WHERE email = $1', [email]);
    const userId = user.rows[0]?.id;

    if (typeof userId !== 'string') {
      return 0;
    }

    await client.query(
      `DELETE FROM "invoice_payment" WHERE "userId" = $1 AND "invoiceId" IN
         (SELECT id FROM "invoice" WHERE "userId" = $1 AND "cardId" IN
            (SELECT id FROM "credit_card" WHERE "userId" = $1 AND name LIKE $2))`,
      [userId, `${prefixo}%`],
    );
    await client.query(
      `DELETE FROM "invoice" WHERE "userId" = $1 AND "cardId" IN
         (SELECT id FROM "credit_card" WHERE "userId" = $1 AND name LIKE $2)`,
      [userId, `${prefixo}%`],
    );

    const removidos = await client.query(
      'DELETE FROM "credit_card" WHERE "userId" = $1 AND name LIKE $2',
      [userId, `${prefixo}%`],
    );

    return removidos.rowCount ?? 0;
  });
}

/** Cria uma conta a pagar/receber com uma data de vencimento (cenário de calendário). */
export async function criarContaAPagarDoSpec(
  email: string,
  descricao: string,
  tipo: 'PAYABLE' | 'RECEIVABLE',
  valorEmCentimos: number,
  vencimento: string,
): Promise<string> {
  const { randomUUID } = await import('node:crypto');

  return withClient(async (client) => {
    const user = await client.query('SELECT id FROM "user" WHERE email = $1', [email]);
    const userId = user.rows[0]?.id;

    if (typeof userId !== 'string') {
      throw new Error(`Não encontrei o utilizador ${email}.`);
    }

    const id = randomUUID();

    await client.query(
      `INSERT INTO "receivable_payable"
         (id, "userId", type, description, "amountInCents", "paidAmountInCents", status, "dueDate", "createdAt", "updatedAt")
       VALUES ($1, $2, $3::"ReceivablePayableType", $4, $5, 0, 'OPEN'::"ReceivablePayableStatus", $6::date, now(), now())`,
      [id, userId, tipo, descricao, valorEmCentimos, vencimento],
    );

    return id;
  });
}

/** Quantos lançamentos têm exatamente esta descrição (o par de uma transferência dá 2). */
export async function contarPorDescricao(email: string, descricao: string): Promise<number> {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT count(*)::int AS total
         FROM "transaction" t
         JOIN "user" u ON u.id = t."userId"
        WHERE u.email = $1 AND t.description = $2`,
      [email, descricao],
    );

    return Number(result.rows[0]?.total ?? 0);
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
 * Preparação de cenário da T53 (ações em massa)
 *
 * A paginação do extrato só tem 25/50/100 linhas: para provar que mudar de
 * página limpa a seleção são precisos mais de 25 lançamentos, e criá-los todos
 * pela interface punha o spec a depender de 30 gravações. Estas linhas são
 * **cenário**, não o caminho medido — o spec confirma sempre as escritas da
 * interface na base, e a limpeza usa o mesmo prefixo.
 * ------------------------------------------------------------------------- */

/** Cria lançamentos manuais do spec e devolve os ids. Prefixo obrigatório. */
export async function criarLancamentosDoSpec(
  email: string,
  prefixo: string,
  quantidade: number,
  opcoes: {
    readonly settled?: boolean;
    readonly valorEmCentimos?: number;
    readonly status?: 'PENDING' | 'CONFIRMED' | 'IGNORED';
    /** Põe a primeira categoria de gasto do utilizador (para o lançamento não ser «sem categoria»). */
    readonly comCategoria?: boolean;
  } = {},
): Promise<string[]> {
  const { randomUUID } = await import('node:crypto');

  return withClient(async (client) => {
    const user = await client.query('SELECT id FROM "user" WHERE email = $1', [email]);
    const userId = user.rows[0]?.id;

    if (typeof userId !== 'string') {
      throw new Error(`Não encontrei o utilizador ${email}.`);
    }

    const conta = await client.query(
      'SELECT id FROM financial_account WHERE "userId" = $1 ORDER BY "createdAt" ASC LIMIT 1',
      [userId],
    );
    const contaId = conta.rows[0]?.id;

    if (typeof contaId !== 'string') {
      throw new Error(`O utilizador ${email} não tem conta financeira.`);
    }

    const ids: string[] = [];
    const valor = opcoes.valorEmCentimos ?? -1234;

    let categoriaId: string | null = null;

    if (opcoes.comCategoria === true) {
      const categoria = await client.query(
        `SELECT id FROM category WHERE "userId" = $1 AND kind = 'EXPENSE'::"CategoryKind"
          ORDER BY "sortOrder", name LIMIT 1`,
        [userId],
      );
      categoriaId = typeof categoria.rows[0]?.id === 'string' ? categoria.rows[0].id : null;

      if (categoriaId === null) {
        throw new Error(`O utilizador ${email} não tem categoria de gasto.`);
      }
    }

    for (let i = 0; i < quantidade; i += 1) {
      const id = randomUUID();
      const descricao = `${prefixo} ${String(i + 1).padStart(2, '0')}`;

      await client.query(
        `INSERT INTO "transaction"
           (id, "userId", kind, "amountInCents", date, description,
            "financialAccountId", settled, "settledOn", status, "categoryId", "updatedAt")
         VALUES ($1, $2, 'EXPENSE'::"TransactionKind", $3, CURRENT_DATE - $4::int,
                 $5, $6, $7, CASE WHEN $7 THEN CURRENT_DATE - $4::int END,
                 $8::"TransactionStatus", $9, now())`,
        [
          id,
          userId,
          valor,
          i,
          descricao,
          contaId,
          opcoes.settled ?? false,
          opcoes.status ?? 'CONFIRMED',
          categoriaId,
        ],
      );

      ids.push(id);
    }

    return ids;
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
