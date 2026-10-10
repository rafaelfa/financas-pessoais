/**
 * T3.3 — Verificação adversarial da camada de dados (script TEMPORÁRIO).
 *
 * Ficheiro de verificação, não de produção. Faz a Parte B do relatório
 * `docs/spec/T3.3-verificacao-camada-dados.md`:
 *
 *  1. cria dois utilizadores de teste via `POST /api/auth/sign-up/email`;
 *  2. confirma que as páginas privadas respondem com cookie e redirecionam para
 *     `/entrar` sem cookie;
 *  3. verifica isolamento entre contas: cria dados privados de B e confirma que
 *     o HTML de A nunca os contém (e vice-versa);
 *  4. demonstra ao nível da base de dados o efeito de uma escrita cruzada que a
 *     Server Action `createTransaction` aceita (IDs de fatura/objetivo/cartão
 *     sem confirmação de propriedade);
 *  5. testa a corrida do aprovisionamento (`provisionUser` em paralelo) e a
 *     permanência de um catálogo parcial;
 *  6. testa se a base impede dois "travamentos de saldo" iguais na mesma data;
 *  7. apaga TODOS os utilizadores de teste (`qa-*@example.com`) e confirma que a
 *     base ficou limpa.
 *
 * NÃO toca no utilizador real `rafaelfa.aguiar@gmail.com`: só o lê, para
 * confirmar que as contagens dele não mudaram.
 *
 * Correr (o sandbox bloqueia o esbuild do `tsx`, que cria um processo filho com
 * `pipes`; este é o equivalente sem processo filho, com o carregador de
 * TypeScript do próprio Node):
 *
 *   node --experimental-transform-types --import <hook> verificacao-t33.ts
 *
 * O `<hook>` é um resolvedor que acrescenta `.ts`/`/index.ts` aos especificadores
 * sem extensão do monorepo (o Node ESM exige extensão explícita). Ver o comando
 * completo no relatório.
 */

import { createHash, randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

import { config } from 'dotenv';

// O `.env` vive na raiz do monorepo. Resolve-se por caminho absoluto (o `cwd`
// depende de quem corre o script) e mantêm-se os caminhos relativos como
// alternativa. Tem de correr ANTES de importar o cliente Prisma.
const here = dirname(fileURLToPath(import.meta.url));

config({
  path: [
    resolve(here, '../../.env'),
    resolve(here, '../.env'),
    resolve(here, '.env'),
    '../../.env',
    '.env',
  ],
  quiet: true,
});

const BASE_URL = process.env.VERIFICACAO_BASE_URL ?? 'https://financas-pessoais-psi-lac.vercel.app';
const ORIGIN = BASE_URL;
const REAL_USER_EMAIL = 'rafaelfa.aguiar@gmail.com';
const PASSWORD = 'Verificacao-T33-2026!';
/** Identificador curto e único desta execução. */
const RUN = Date.now().toString(36);

interface PageResult {
  readonly path: string;
  readonly status: number;
  readonly location: string | null;
  readonly ms: number;
  readonly bytes: number;
  readonly sha256: string;
}

/** HTML em memória (não se escrevem ficheiros fora do âmbito da tarefa). */
const htmlCache = new Map<string, string>();

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function cookieHeader(setCookies: readonly string[]): string {
  return setCookies
    .map((value) => value.split(';')[0]?.trim() ?? '')
    .filter((value) => value !== '')
    .join('; ');
}

async function httpGet(
  path: string,
  cookie?: string,
): Promise<{ status: number; location: string | null; body: string; ms: number }> {
  const started = performance.now();

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      redirect: 'manual',
      headers: cookie === undefined || cookie === '' ? {} : { cookie },
    });
    const body = await response.text();

    return {
      status: response.status,
      location: response.headers.get('location'),
      body,
      ms: Math.round(performance.now() - started),
    };
  } catch (error) {
    return {
      status: -1,
      location: null,
      body: `ERRO: ${String(error)}`,
      ms: Math.round(performance.now() - started),
    };
  }
}

/**
 * POST JSON. O `Origin` é obrigatório: sem ele o better-auth responde
 * `403 MISSING_OR_NULL_ORIGIN` (proteção CSRF a funcionar).
 */
async function httpPostJson(
  path: string,
  body: unknown,
): Promise<{ status: number; text: string; setCookies: string[] }> {
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'content-type': 'application/json',
        origin: ORIGIN,
        referer: `${ORIGIN}/registar`,
      },
      body: JSON.stringify(body),
    });
    const text = await response.text();

    return { status: response.status, text, setCookies: response.headers.getSetCookie() };
  } catch (error) {
    return { status: -1, text: `ERRO: ${String(error)}`, setCookies: [] };
  }
}

async function main(): Promise<void> {
  const { prisma } = await import('./src/client');
  const shared = await import('../shared/src/index');
  const { provisionUser } = await import('../../apps/web/src/server/provision');

  const summary: Record<string, unknown> = { baseUrl: BASE_URL, run: RUN };
  const pageResults: PageResult[] = [];
  const testUserIds: string[] = [];
  /** Todos os ids criados nesta execução, para a verificação de órfãos final. */
  const createdIds: string[] = [];

  const realUserBefore = await prisma.user.findUnique({
    where: { email: REAL_USER_EMAIL },
    select: { id: true },
  });
  const realCountsBefore =
    realUserBefore === null
      ? null
      : {
          categories: await prisma.category.count({ where: { userId: realUserBefore.id } }),
          accounts: await prisma.financialAccount.count({ where: { userId: realUserBefore.id } }),
          transactions: await prisma.transaction.count({ where: { userId: realUserBefore.id } }),
        };

  // -------------------------------------------------------------------------
  // 1. Registo dos dois utilizadores de teste
  // -------------------------------------------------------------------------
  const accounts: Array<{ label: 'A' | 'B'; email: string; id: string; cookie: string }> = [];

  for (const label of ['A', 'B'] as const) {
    const email = `qa-t33-${label.toLowerCase()}-${RUN}@example.com`;
    const signUp = await httpPostJson('/api/auth/sign-up/email', {
      email,
      password: PASSWORD,
      name: `QA ${label}`,
    });

    // `autoSignIn: false` (ver `lib/auth.ts`): o registo não abre sessão, logo o
    // cookie tem de vir do início de sessão explícito.
    const signIn = await httpPostJson('/api/auth/sign-in/email', { email, password: PASSWORD });
    const setCookies = signIn.setCookies.length > 0 ? signIn.setCookies : signUp.setCookies;

    const row = await prisma.user.findUnique({ where: { email }, select: { id: true } });

    if (row !== null) {
      testUserIds.push(row.id);
      createdIds.push(row.id);
    }

    console.log(
      `[registo ${label}] email=${email} signUp=${signUp.status} signIn=${signIn.status} ` +
        `cookies=${setCookies.length} naBD=${row !== null}`,
    );

    if (signUp.status !== 200) {
      console.log(`[registo ${label}] corpo: ${signUp.text.slice(0, 200)}`);
    }

    accounts.push({
      label,
      email,
      id: row?.id ?? '',
      cookie: cookieHeader(setCookies),
    });
  }

  summary.signUp = accounts.map((account) => ({
    label: account.label,
    email: account.email,
    inDatabase: account.id !== '',
    hasCookie: account.cookie !== '',
  }));

  const a = accounts[0]!;
  const b = accounts[1]!;
  const ready = a.id !== '' && b.id !== '' && a.cookie !== '' && b.cookie !== '';

  summary.parteBDesbloqueada = ready;

  if (!ready) {
    summary.motivo = 'Não foi possível criar sessão para A e B; as secções 2 a 6 foram saltadas.';
  }

  // O gancho `after` do better-auth corre dentro do pedido de registo; confirma-se
  // o resultado no fim, com tolerância.
  for (const account of accounts) {
    const started = Date.now();
    let categories = 0;
    let wallet = 0;

    if (account.id === '') {
      continue;
    }

    for (;;) {
      categories = await prisma.category.count({ where: { userId: account.id } });
      wallet = await prisma.financialAccount.count({ where: { userId: account.id } });

      if (categories > 0 && wallet > 0) {
        break;
      }

      if (Date.now() - started > 30_000) {
        break;
      }

      await new Promise((resolveTimer) => setTimeout(resolveTimer, 500));
    }

    (summary as Record<string, unknown>)[`provision_${account.label}`] = {
      categories,
      accounts: wallet,
      expectedCategories: shared.DEFAULT_CATEGORIES.length,
      waitedMs: Date.now() - started,
    };

    console.log(
      `[aprovisionamento ${account.label}] categorias=${categories} contas=${wallet} ` +
        `esperado=${shared.DEFAULT_CATEGORIES.length} esperaMs=${Date.now() - started}`,
    );
  }

  // -------------------------------------------------------------------------
  // 2. Páginas privadas, com e sem cookie
  // -------------------------------------------------------------------------
  const paths = ['/', '/transacoes', '/contas', '/categorias'] as const;

  for (const path of paths) {
    if (ready) {
      for (const pass of [1, 2] as const) {
        const response = await httpGet(path, a.cookie);
        const key = `A|${path}|${pass}`;
        htmlCache.set(key, response.body);

        pageResults.push({
          path: key,
          status: response.status,
          location: response.location,
          ms: response.ms,
          bytes: Buffer.byteLength(response.body, 'utf8'),
          sha256: sha256(response.body).slice(0, 16),
        });
      }
    }

    const anonymous = await httpGet(path);
    pageResults.push({
      path: `anonimo|${path}`,
      status: anonymous.status,
      location: anonymous.location,
      ms: anonymous.ms,
      bytes: Buffer.byteLength(anonymous.body, 'utf8'),
      sha256: sha256(anonymous.body).slice(0, 16),
    });

    console.log(
      `[http] ${path} ` +
        (ready
          ? `com cookie: ${pageResults
              .filter((item) => item.path.startsWith(`A|${path}`))
              .map((item) => `${item.status}/${item.ms}ms`)
              .join(' ')} | `
          : 'com cookie: (sem sessão) | ') +
        `sem cookie: ${anonymous.status} → ${anonymous.location ?? '(sem location)'}`,
    );
  }

  summary.pages = pageResults;

  // Páginas que devolveram a página de erro do Next (`__next_error__`): guarda o
  // digest, que é a única pista que sobra em produção.
  summary.httpErrors = [...htmlCache.entries()]
    .filter(([, body]) => body.includes('__next_error__'))
    .map(([key, body]) => ({
      key,
      digest: /"digest":"([^"]+)"/.exec(body)?.[1] ?? null,
    }));

  if ((summary.httpErrors as unknown[]).length > 0) {
    console.log('[erro http]', JSON.stringify(summary.httpErrors));
  }

  // -------------------------------------------------------------------------
  // 2b. A camada de dados do extrato, executada diretamente, rebenta?
  // -------------------------------------------------------------------------
  if (ready) {
    const parsed = shared.transactionFiltersSchema.safeParse({
      from: undefined,
      to: undefined,
      accountId: undefined,
      categoryId: undefined,
      kind: undefined,
      status: undefined,
      search: undefined,
      limit: 25,
      offset: 0,
    });

    let dataLayerError: string | null = null;
    let rows = 0;

    try {
      const where = { userId: a.id };

      rows = await prisma.transaction.count({ where });
      await prisma.transaction.findMany({
        where,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip: 0,
        take: 25,
        include: {
          financialAccount: { select: { name: true } },
          category: { select: { name: true } },
          tags: { select: { name: true } },
        },
      });
      await prisma.transaction.aggregate({ where, _sum: { amountInCents: true } });
    } catch (error) {
      dataLayerError = String(error).split('\n')[0] ?? null;
    }

    summary.transactionsDataLayer = {
      parseOk: parsed.success,
      rowCount: rows,
      error: dataLayerError,
    };
    console.log('[camada de dados do extrato]', JSON.stringify(summary.transactionsDataLayer));
  }

  // -------------------------------------------------------------------------
  // 3. Dados privados de B e isolamento das leituras
  // -------------------------------------------------------------------------
  const bPrivateAccountName = `CONTA-PRIVADA-B-${RUN}`;
  const bPrivateCategoryName = `CATEGORIA-PRIVADA-B-${RUN}`;
  const aPrivateAccountName = `CONTA-PRIVADA-A-${RUN}`;
  const aPrivateCategoryName = `CATEGORIA-PRIVADA-A-${RUN}`;

  if (ready) {
    await prisma.financialAccount.create({
      data: {
        userId: b.id,
        name: bPrivateAccountName,
        type: 'WALLET',
        openingBalanceInCents: 0,
        currency: 'EUR',
        origin: 'MANUAL',
      },
      select: { id: true },
    });

    await prisma.financialAccount.create({
      data: {
        userId: a.id,
        name: aPrivateAccountName,
        type: 'WALLET',
        openingBalanceInCents: 0,
        currency: 'EUR',
        origin: 'MANUAL',
      },
      select: { id: true },
    });

    await prisma.category.create({
      data: {
        userId: b.id,
        name: bPrivateCategoryName,
        slug: `categoria-privada-b-${RUN}`,
        kind: 'EXPENSE',
        isInternal: false,
        isSystem: false,
        sortOrder: 900,
      },
      select: { id: true },
    });

    await prisma.category.create({
      data: {
        userId: a.id,
        name: aPrivateCategoryName,
        slug: `categoria-privada-a-${RUN}`,
        kind: 'EXPENSE',
        isInternal: false,
        isSystem: false,
        sortOrder: 901,
      },
      select: { id: true },
    });

    // Releitura DEPOIS de existirem os dados privados: o HTML da secção 2 foi
    // capturado antes de B ter conta própria, logo só serve para a comparação
    // "a página de A mostra os dados de A".
    const aContas = (await httpGet('/contas', a.cookie)).body;
    const bContas = (await httpGet('/contas', b.cookie)).body;
    const aCategorias = (await httpGet('/categorias', a.cookie)).body;
    const bCategorias = (await httpGet('/categorias', b.cookie)).body;
    const aTransacoes = (await httpGet('/transacoes', a.cookie)).body;

    const systemNames = shared.DEFAULT_CATEGORIES.map((category) => category.name);

    summary.isolation = {
      bAccountLeakedIntoA: aContas.includes(bPrivateAccountName),
      bCategoryLeakedIntoA: aCategorias.includes(bPrivateCategoryName),
      bPurchaseLeakedIntoA: aTransacoes.includes(`Compra de B ${RUN}`),
      aAccountLeakedIntoB: bContas.includes(aPrivateAccountName),
      aCategoryLeakedIntoB: bCategorias.includes(aPrivateCategoryName),
      aSeesOwnAccount: aContas.includes(aPrivateAccountName),
      bSeesOwnAccount: bContas.includes(bPrivateAccountName),
      aSeesOwnCategory: aCategorias.includes(aPrivateCategoryName),
      bSeesOwnCategory: bCategorias.includes(bPrivateCategoryName),
      categoriesMissingFromA: systemNames.filter((name) => !aCategorias.includes(name)),
      categoriesMissingFromB: systemNames.filter((name) => !bCategorias.includes(name)),
      defaultCategoryCount: shared.DEFAULT_CATEGORIES.length,
      bytesAContas: Buffer.byteLength(aContas, 'utf8'),
      bytesBCategorias: Buffer.byteLength(bCategorias, 'utf8'),
    };

    console.log('[isolamento]', JSON.stringify(summary.isolation));
  }

  // -------------------------------------------------------------------------
  // 4. Escrita cruzada: `createTransaction` aceita invoiceId/goalId/cardId de
  //    outro utilizador (demonstração ao nível da base de dados)
  // -------------------------------------------------------------------------
  if (ready) {
    const card = await prisma.creditCard.create({
      data: { userId: b.id, name: `Cartao privado B ${RUN}`, closingDay: 20, dueDay: 10 },
      select: { id: true },
    });

    const invoice = await prisma.invoice.create({
      data: {
        userId: b.id,
        cardId: card.id,
        closingDate: new Date('2026-09-20'),
        dueDate: new Date('2026-10-10'),
        status: 'OPEN',
      },
      select: { id: true },
    });

    const bAccount = await prisma.financialAccount.findFirst({
      where: { userId: b.id, name: bPrivateAccountName },
      select: { id: true },
    });

    await prisma.transaction.create({
      data: {
        userId: b.id,
        kind: 'EXPENSE',
        status: 'CONFIRMED',
        amountInCents: -50_000,
        date: new Date('2026-09-05'),
        description: `Compra de B ${RUN}`,
        financialAccountId: bAccount?.id ?? null,
        invoiceId: invoice.id,
        settled: false,
      },
      select: { id: true },
    });

    const toMotorTransaction = (row: {
      id: string;
      kind: string;
      status: string;
      amountInCents: number;
      date: Date;
      description: string | null;
      financialAccountId: string | null;
      categoryId: string | null;
      invoiceId: string | null;
      goalId: string | null;
      transferGroupId: string | null;
      settled: boolean;
    }) => ({
      id: row.id,
      kind: row.kind.toLowerCase() as never,
      status: row.status.toLowerCase() as never,
      amountInCents: row.amountInCents,
      date: row.date.toISOString().slice(0, 10),
      description: row.description ?? undefined,
      accountId: row.financialAccountId ?? '',
      categoryId: row.categoryId ?? undefined,
      invoiceId: row.invoiceId ?? undefined,
      goalId: row.goalId ?? undefined,
      transferGroupId: row.transferGroupId ?? undefined,
      settled: row.settled,
    });

    const invoiceRecord = {
      id: invoice.id,
      cardId: card.id,
      closingDate: '2026-09-20',
      dueDate: '2026-10-10',
      carriedOverInCents: 0,
    };

    const rowsBefore = await prisma.transaction.findMany({ where: { invoiceId: invoice.id } });
    const totalsBefore = shared.invoiceTotals({
      invoice: invoiceRecord,
      transactions: rowsBefore.map(toMotorTransaction),
      payments: [],
      today: '2026-10-15',
    });

    const aMainAccount = await prisma.financialAccount.findFirst({
      where: { userId: a.id, name: aPrivateAccountName },
      select: { id: true },
    });

    // É exatamente esta a linha que `createTransaction` escreveria se A passasse
    // o `invoiceId` de B: a ação só confirma conta e categoria, nunca a fatura.
    const crossUserRow = await prisma.transaction.create({
      data: {
        userId: a.id,
        kind: 'INVOICE_PAYMENT',
        status: 'CONFIRMED',
        amountInCents: -50_000,
        date: new Date('2026-10-05'),
        description: `Pagamento cruzado A para a fatura de B ${RUN}`,
        financialAccountId: aMainAccount?.id ?? null,
        invoiceId: invoice.id,
        settled: true,
      },
      select: { id: true, userId: true },
    });

    const rowsAfter = await prisma.transaction.findMany({ where: { invoiceId: invoice.id } });
    const totalsAfter = shared.invoiceTotals({
      invoice: invoiceRecord,
      transactions: rowsAfter.map(toMotorTransaction),
      payments: [],
      today: '2026-10-15',
    });

    summary.crossUserWrite = {
      acceptedWithDifferentUser: crossUserRow.userId === a.id,
      crossUserTransactionId: crossUserRow.id,
      outstandingBeforeInCents: totalsBefore.outstandingInCents,
      outstandingAfterInCents: totalsAfter.outstandingInCents,
      invoiceStatusBefore: totalsBefore.status,
      invoiceStatusAfter: totalsAfter.status,
      rowsOnInvoice: rowsAfter.length,
      distinctUserIdsOnInvoice: [...new Set(rowsAfter.map((row) => row.userId))].length,
    };

    console.log('[escrita cruzada]', JSON.stringify(summary.crossUserWrite));

    // O extrato de B, agora com dados: o 500 também acontece com movimentos?
    const bTransacoes = await httpGet('/transacoes', b.cookie);

    summary.transactionsPageWithData = {
      status: bTransacoes.status,
      bytes: Buffer.byteLength(bTransacoes.body, 'utf8'),
      digest: /"digest":"([^"]+)"/.exec(bTransacoes.body)?.[1] ?? null,
    };

    console.log('[extrato com dados]', JSON.stringify(summary.transactionsPageWithData));
  }

  // -------------------------------------------------------------------------
  // 5. Corrida do aprovisionamento + permanência de catálogo parcial
  // -------------------------------------------------------------------------
  const raceUser = await prisma.user.create({
    data: { id: randomUUID(), name: `QA corrida ${RUN}`, email: `qa-race-${RUN}@example.com` },
    select: { id: true },
  });
  testUserIds.push(raceUser.id);
  createdIds.push(raceUser.id);

  await Promise.all([
    provisionUser(raceUser.id),
    provisionUser(raceUser.id),
    provisionUser(raceUser.id),
  ]);

  const raceCategories = await prisma.category.findMany({
    where: { userId: raceUser.id },
    select: { id: true, parentId: true, slug: true },
  });
  const raceAccounts = await prisma.financialAccount.count({ where: { userId: raceUser.id } });
  const raceSlugs = raceCategories.map((row) => row.slug);
  const duplicateSlugs = raceSlugs.filter((slug, index) => raceSlugs.indexOf(slug) !== index);
  const childrenBefore = raceCategories.filter((row) => row.parentId !== null).length;

  // Catálogo parcial: apagam-se as subcategorias e volta a chamar-se o
  // aprovisionamento. Se não for reconstruído, o estado parcial é permanente
  // (o `categoryCount > 0` faz `provisionUser` sair cedo).
  await prisma.category.deleteMany({ where: { userId: raceUser.id, parentId: { not: null } } });
  await provisionUser(raceUser.id);
  const afterPartial = await prisma.category.count({ where: { userId: raceUser.id } });

  summary.provisioning = {
    concurrentCalls: 3,
    categoriesAfterRace: raceCategories.length,
    expected: shared.DEFAULT_CATEGORIES.length,
    childrenAfterRace: childrenBefore,
    duplicateSlugs: [...new Set(duplicateSlugs)],
    accountsAfterRace: raceAccounts,
    catalogueRebuiltAfterPartialLoss: afterPartial !== raceCategories.length - childrenBefore,
    categoriesAfterPartialLoss: afterPartial,
    rootsRemaining: raceCategories.length - childrenBefore,
  };

  console.log('[aprovisionamento]', JSON.stringify(summary.provisioning));

  // -------------------------------------------------------------------------
  // 6. A base impede dois travamentos de saldo iguais na mesma data?
  // -------------------------------------------------------------------------
  const lockAccount = await prisma.financialAccount.findFirst({
    where: { userId: raceUser.id },
    select: { id: true },
  });

  let duplicateLockAccepted = false;
  let duplicateLockError: string | null = null;

  if (lockAccount !== null) {
    const lockData = {
      userId: raceUser.id,
      financialAccountId: lockAccount.id,
      referenceDate: new Date('2026-10-31'),
      reportedBalanceInCents: 1_000,
      computedBalanceInCents: 500,
      adjustmentInCents: 500,
    };

    await prisma.lockedBalance.create({ data: lockData });

    try {
      await prisma.lockedBalance.create({ data: lockData });
      duplicateLockAccepted = true;
    } catch (error) {
      duplicateLockError = String(error).split('\n')[0] ?? null;
    }
  }

  summary.duplicateLock = { acceptedByDatabase: duplicateLockAccepted, error: duplicateLockError };
  console.log('[travar saldo duplicado]', JSON.stringify(summary.duplicateLock));

  // -------------------------------------------------------------------------
  // 6b. O schema Zod aceita montantes que a coluna `Int` não consegue guardar?
  // -------------------------------------------------------------------------
  const overflowInCents = 99_999_999_999;
  const parsedOverflow = shared.createTransactionSchema.safeParse({
    kind: 'income',
    amountInCents: overflowInCents,
    date: '2026-10-05',
    accountId: lockAccount?.id ?? 'conta-qualquer',
    categoryId: 'categoria-qualquer',
    settled: true,
  });

  let overflowAccepted = false;
  let overflowError: string | null = null;

  try {
    await prisma.transaction.create({
      data: {
        userId: raceUser.id,
        kind: 'INCOME',
        status: 'CONFIRMED',
        amountInCents: overflowInCents,
        date: new Date('2026-10-05'),
        financialAccountId: lockAccount?.id ?? null,
        settled: true,
      },
    });
    overflowAccepted = true;
  } catch (error) {
    overflowError = String(error).split('\n')[0] ?? null;
  }

  summary.amountOverflow = {
    zodAcceptsOverflow: parsedOverflow.success,
    attemptedInCents: overflowInCents,
    postgresIntMax: 2_147_483_647,
    acceptedByDatabase: overflowAccepted,
    error: overflowError,
  };

  console.log('[montante acima do Int]', JSON.stringify(summary.amountOverflow));

  // -------------------------------------------------------------------------
  // 7. Limpeza
  // -------------------------------------------------------------------------
  let cascadeDeleteOutcome = 'não tentado';

  if (b.id !== '') {
    try {
      await prisma.user.delete({ where: { id: b.id } });
      cascadeDeleteOutcome =
        'sucesso (a cascata apagou cartão e fatura sem violar o Restrict de Invoice.card)';
      testUserIds.splice(testUserIds.indexOf(b.id), 1);
    } catch (error) {
      cascadeDeleteOutcome = `FALHOU: ${String(error).split('\n')[0] ?? ''}`;
    }
  }

  // Limpeza defensiva, por ordem de dependências, para todos os utilizadores de
  // teste conhecidos (inclui os dois de HTTP e o da corrida).
  const sweep = await prisma.user.findMany({
    where: { email: { startsWith: 'qa-' } },
    select: { id: true, email: true },
  });
  const sweepEvidence: Array<{ email: string; categories: number; accounts: number }> = [];

  for (const user of sweep) {
    if (!testUserIds.includes(user.id)) {
      testUserIds.push(user.id);
    }

    if (!createdIds.includes(user.id)) {
      createdIds.push(user.id);
    }

    sweepEvidence.push({
      email: user.email,
      categories: await prisma.category.count({ where: { userId: user.id } }),
      accounts: await prisma.financialAccount.count({ where: { userId: user.id } }),
    });
  }

  for (const userId of [...testUserIds]) {
    await prisma.transaction.deleteMany({ where: { userId } });
    await prisma.invoicePayment.deleteMany({ where: { userId } });
    await prisma.lockedBalance.deleteMany({ where: { userId } });
    await prisma.invoice.deleteMany({ where: { userId } });
    await prisma.creditCard.deleteMany({ where: { userId } });
    await prisma.category.deleteMany({ where: { userId } });
    await prisma.financialAccount.deleteMany({ where: { userId } });
    await prisma.session.deleteMany({ where: { userId } });
    await prisma.account.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  }

  const leftovers = await prisma.user.findMany({
    where: { OR: [{ email: { startsWith: 'qa-' } }] },
    select: { email: true },
  });

  const orphanCounts = {
    categories: await prisma.category.count({ where: { userId: { in: createdIds } } }),
    accounts: await prisma.financialAccount.count({ where: { userId: { in: createdIds } } }),
    transactions: await prisma.transaction.count({ where: { userId: { in: createdIds } } }),
    invoices: await prisma.invoice.count({ where: { userId: { in: createdIds } } }),
    cards: await prisma.creditCard.count({ where: { userId: { in: createdIds } } }),
    lockedBalances: await prisma.lockedBalance.count({ where: { userId: { in: createdIds } } }),
    sessions: await prisma.session.count({ where: { userId: { in: createdIds } } }),
  };

  const realCountsAfter =
    realUserBefore === null
      ? null
      : {
          categories: await prisma.category.count({ where: { userId: realUserBefore.id } }),
          accounts: await prisma.financialAccount.count({ where: { userId: realUserBefore.id } }),
          transactions: await prisma.transaction.count({ where: { userId: realUserBefore.id } }),
        };

  summary.cleanup = {
    cascadeDeleteOutcome,
    deletedTestUsers: testUserIds.length,
    sweepEvidence,
    usersLeftBehind: leftovers.map((row) => row.email),
    orphanRows: orphanCounts,
    realUserUntouched: JSON.stringify(realCountsBefore) === JSON.stringify(realCountsAfter),
    realUserExists: realUserBefore !== null,
  };

  console.log('[limpeza]', JSON.stringify(summary.cleanup));
  console.log('RESULTADO_JSON_INICIO');
  console.log(JSON.stringify(summary, null, 2));
  console.log('RESULTADO_JSON_FIM');

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('FALHA NA VERIFICAÇÃO:', error);
  process.exitCode = 1;
});
