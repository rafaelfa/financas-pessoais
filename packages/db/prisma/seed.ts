/**
 * Seed de **demonstração** — o conjunto de dados que se mostra ao cliente.
 *
 * -----------------------------------------------------------------------------
 * O QUE CRIA
 * -----------------------------------------------------------------------------
 * 1. O **utilizador demo** (`DEMO_EMAIL`, ver abaixo) com sessão possível: a
 *    linha `User` e a conta de credencial do `better-auth`, com a palavra-passe
 *    guardada no mesmo formato que o registo da aplicação produz. O hash vem de
 *    `@better-auth/utils/password`, que é exatamente o que `better-auth/crypto`
 *    reexporta (`better-auth/dist/crypto/password.mjs:1`): `scrypt` com
 *    `N=16384, r=16, p=1, dkLen=64`, guardado como `salt:hash` em hexadecimal.
 *    Importa-se o utilitário e não `better-auth/crypto` porque, neste workspace,
 *    o `pnpm` liga os pacotes por *junctions* no Windows e o Node não as resolve
 *    ao subir a árvore — `better-auth/crypto` arrasta `@noble/hashes` e falha
 *    (`ERR_MODULE_NOT_FOUND`) com o Node puro. O utilitário só usa `node:crypto`,
 *    pelo que corre em qualquer sítio. A implementação **não** é nossa: é a da
 *    biblioteca.
 * 2. O **catálogo de categorias de Portugal** e a carteira principal, pelo mesmo
 *    caminho do aprovisionamento de um registo novo (`DEFAULT_CATEGORIES` +
 *    `slugify`) — não há aqui uma segunda lista de categorias.
 * 3. **Três contas**: a carteira aprovisionada, uma conta à ordem e uma poupança.
 * 4. **Três meses de lançamentos** (o mês corrente e os dois anteriores, contados
 *    a partir de hoje em Lisboa): ordenados, compras de supermercado, utilidades,
 *    uma transferência entre contas, o pagamento de uma fatura de cartão e
 *    aportes para um objetivo. Inclui dois movimentos **sem categoria** com o
 *    texto que as regras procuram, para se ver a categorização a funcionar.
 * 5. **Um orçamento** mensal com limites, calibrado para um deles ficar em
 *    **alerta** (Alimentação a 84 %), e **um objetivo** com três aportes.
 * 6. **Um cartão** com três faturas: uma paga, uma **fechada e por pagar** e a do
 *    ciclo em curso.
 * 7. **Duas recorrências ativas** (renda e salário), com as ocorrências dos três
 *    meses ligadas a elas.
 * 8. **Duas regras de categorização** que correspondem aos dois movimentos sem
 *    categoria — a pré-visualização de /regras mostra-as a trabalhar.
 *
 * -----------------------------------------------------------------------------
 * IDEMPOTÊNCIA
 * -----------------------------------------------------------------------------
 * Todos os identificadores são **derivados** do e-mail do demo (`demoId`), e não
 * sorteados. Cada escrita é um `upsert` por `id` (ou por chave natural, no
 * utilizador e na conta de credencial), pelo que correr o seed duas vezes
 * **atualiza as mesmas linhas** e cria **zero** linhas novas. As datas são
 * calculadas a partir do mês corrente, por isso uma segunda passagem noutro mês
 * reescreve o mesmo conjunto com as datas novas, em vez de o duplicar.
 *
 * -----------------------------------------------------------------------------
 * COMO USAR E COMO APAGAR
 * -----------------------------------------------------------------------------
 *   pnpm --filter @repo/db db:seed
 *
 * O utilizador demo é identificável pelo e-mail e sai inteiro numa linha:
 *
 *   DELETE FROM "user" WHERE email = 'demo@financas-pessoais.pt';   -- cascata
 *
 * Nada mais é tocado: o seed só escreve linhas do utilizador demo.
 */

import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword, verifyPassword } from '@better-auth/utils/password';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_PRIMARY_ACCOUNT_NAME,
  addMonths,
  budgetPeriodFor,
  budgetStatusList,
  formatCurrency,
  goalProgress,
  invoiceChain,
  slugify,
  toFinanceInvoice,
  toFinancePayment,
  toFinanceTransaction,
  toIsoDate,
} from '@repo/shared';
import { config as loadEnv } from 'dotenv';

import { type CategoryKind, type Prisma, PrismaClient } from '../src/generated/prisma/client';

// O workspace tem um único `.env` canónico na raiz. `dotenv` recebe as duas
// localizações candidatas para funcionar de `packages/db` ou da raiz.
loadEnv({ path: ['.env', '../../.env'], quiet: true });

/** Utilizador demo. É a chave estável de tudo o que este ficheiro escreve. */
export const DEMO_EMAIL = 'demo@financas-pessoais.pt';
/** Palavra-passe do demo. Não é segredo: é para mostrar, não para proteger nada. */
export const DEMO_PASSWORD = 'Demo-financas-2026';
export const DEMO_NAME = 'Maria Demonstração';

/** Nome do orçamento do mês: estável, porque é a chave do `upsert`. */
const BUDGET_NAME = 'Orçamento mensal';

type SeedClient = Prisma.TransactionClient | PrismaClient;

// -----------------------------------------------------------------------------
// Identificadores derivados
// -----------------------------------------------------------------------------

/**
 * Identificador determinístico, com a forma de um UUID.
 *
 * A forma importa: os identificadores viajam em formulários e nos URL, e o
 * produto usa UUIDs em todo o lado. Como são derivados de uma semente fixa, a
 * mesma entidade tem sempre o mesmo `id` — é isso que torna o seed idempotente
 * sem depender de chaves naturais espalhadas pelo esquema.
 */
function demoId(scope: string, key: string): string {
  const hex = createHash('sha256')
    .update(`financas-pessoais/demo/${scope}/${key}`)
    .digest('hex')
    .slice(0, 32);

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

// -----------------------------------------------------------------------------
// Datas e dinheiro
// -----------------------------------------------------------------------------

/** A data de hoje em Portugal, `YYYY-MM-DD` (mesma regra de `@/lib/today`). */
function todayInLisbon(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Lisbon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** `AAAA-MM` do mês deslocado `offset` meses do corrente. */
function monthKey(offset: number): string {
  return addMonths(`${todayInLisbon().slice(0, 7)}-01`, offset).slice(0, 7);
}

/** Data de calendário do dia `day` do mês deslocado `offset` meses do corrente. */
function monthDay(offset: number, day: number): string {
  return `${monthKey(offset)}-${String(day).padStart(2, '0')}`;
}

/** `@db.Date` guarda meia-noite UTC; esta é a forma canónica de lá chegar. */
function asDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/**
 * Cêntimos a partir de euros e cêntimos inteiros.
 *
 * Nada de `62.45 * 100`: o dinheiro é sempre inteiro, e uma multiplicação em
 * vírgula flutuante é exatamente o que este projeto proíbe.
 */
function c(euros: number, cents = 0): number {
  return euros * 100 + cents;
}

// -----------------------------------------------------------------------------
// Aprovisionamento (catálogo + carteira), igual ao de um registo novo
// -----------------------------------------------------------------------------

interface PreparedCategory {
  readonly name: string;
  readonly slug: string;
  readonly kind: CategoryKind;
  readonly internal: boolean;
  readonly parentSlug: string | null;
  readonly color: string | null;
  readonly sortOrder: number;
}

/**
 * Espelha `prepareCatalogue` de `apps/web/src/server/provision.ts`.
 *
 * A **fonte** é a mesma (`DEFAULT_CATEGORIES` de `@repo/shared`): o que se repete
 * é o mapa em memória, não a lista de categorias. Sem isto, o seed e o registo
 * criavam catálogos diferentes — era o que acontecia antes desta correção, em que
 * o seed gravava `agua-luz-gas` e `ajuste-saldo` enquanto o registo gravava
 * `agua-luz-e-gas` e `ajuste-de-saldo` (e o "travar saldo" procura exatamente
 * este último).
 */
function prepareCatalogue(): PreparedCategory[] {
  return DEFAULT_CATEGORIES.map((category, index) => ({
    name: category.name,
    slug: slugify(category.name) || `categoria-${index}`,
    kind: category.kind === 'income' ? 'INCOME' : 'EXPENSE',
    internal: category.internal ?? false,
    parentSlug: category.parent === undefined ? null : slugify(category.parent),
    color: category.color ?? null,
    sortOrder: index,
  }));
}

function categoryKey(kind: CategoryKind, slug: string): string {
  return `${kind}:${slug}`;
}

/**
 * Cria as categorias que faltam (nunca as duplica nem reescreve nomes) e a
 * carteira principal, se o utilizador ainda não tiver contas.
 *
 * Mesmas decisões de `provisionUser`: um catálogo **parcial** é reparável,
 * comparando por identificador estável, e o catálogo nunca é recriado por cima
 * dos nomes que o utilizador tenha mudado.
 */
async function provisionDemoUser(prisma: SeedClient, userId: string): Promise<number> {
  const accountCount = await prisma.financialAccount.count({ where: { userId } });

  if (accountCount === 0) {
    const wallet = await prisma.financialAccount.create({
      data: {
        userId,
        name: DEFAULT_PRIMARY_ACCOUNT_NAME,
        type: 'WALLET',
        currency: 'EUR',
        openingBalanceInCents: 0,
        origin: 'MANUAL',
      },
      select: { id: true },
    });

    await prisma.user.update({
      where: { id: userId },
      data: { primaryAccountId: wallet.id },
    });
  }

  const existingRows = await prisma.category.findMany({
    where: { userId },
    select: { slug: true, kind: true },
  });
  const existingKeys = new Set(existingRows.map((row) => categoryKey(row.kind, row.slug)));
  const catalogue = prepareCatalogue();
  const missing = catalogue.filter(
    (category) => !existingKeys.has(categoryKey(category.kind, category.slug)),
  );

  if (missing.length === 0) {
    return 0;
  }

  const roots = missing.filter((category) => category.parentSlug === null);
  const children = missing.filter((category) => category.parentSlug !== null);

  if (roots.length > 0) {
    await prisma.category.createMany({
      data: roots.map((category) => ({
        userId,
        name: category.name,
        slug: category.slug,
        kind: category.kind,
        isInternal: category.internal,
        isSystem: true,
        color: category.color,
        sortOrder: category.sortOrder,
      })),
    });
  }

  if (children.length > 0) {
    const created = await prisma.category.findMany({
      where: { userId },
      select: { id: true, slug: true, kind: true },
    });
    const idByKey = new Map(created.map((row) => [categoryKey(row.kind, row.slug), row.id]));

    await prisma.category.createMany({
      data: children.map((category) => ({
        userId,
        name: category.name,
        slug: category.slug,
        kind: category.kind,
        parentId:
          category.parentSlug === null
            ? null
            : (idByKey.get(categoryKey(category.kind, category.parentSlug)) ?? null),
        isInternal: category.internal,
        isSystem: true,
        color: category.color,
        sortOrder: category.sortOrder,
      })),
    });
  }

  return missing.length;
}

// -----------------------------------------------------------------------------
// Dados do demo
// -----------------------------------------------------------------------------

interface AccountSpec {
  readonly key: string;
  readonly name: string;
  readonly type: 'CHECKING' | 'SAVINGS';
  readonly institution: string;
  readonly openingBalanceInCents: number;
}

const DEMO_ACCOUNTS: readonly AccountSpec[] = [
  {
    key: 'checking',
    name: 'Conta ordenado',
    type: 'CHECKING',
    institution: 'Millennium bcp',
    openingBalanceInCents: c(1_250),
  },
  {
    key: 'savings',
    name: 'Poupança',
    type: 'SAVINGS',
    institution: 'Millennium bcp',
    openingBalanceInCents: c(5_000),
  },
];

interface TransactionSpec {
  readonly key: string;
  readonly data: Omit<Prisma.TransactionUncheckedCreateInput, 'id' | 'userId'>;
}

/**
 * Os três meses de lançamentos.
 *
 * As compras de cartão estão separadas por fatura: cada uma cai na fatura do
 * ciclo em que a compra acontece (21 do mês anterior ao 20 do mês de fecho), que
 * é a regra que a aplicação usa (`invoiceDatesFor`).
 */
function buildTransactions(args: {
  readonly checkingId: string;
  readonly savingsId: string;
  readonly cardId: string;
  readonly invoiceClosedId: string;
  readonly invoicePaidId: string;
  readonly invoiceOpenId: string;
  readonly goalId: string;
  readonly rentRecurrenceId: string;
  readonly salaryRecurrenceId: string;
  readonly categoryId: (kind: CategoryKind, name: string) => string;
}): TransactionSpec[] {
  const {
    checkingId,
    savingsId,
    cardId,
    invoiceClosedId,
    invoicePaidId,
    invoiceOpenId,
    goalId,
    rentRecurrenceId,
    salaryRecurrenceId,
    categoryId,
  } = args;

  const expense = (category: string) => categoryId('EXPENSE', category);
  const income = (category: string) => categoryId('INCOME', category);
  const rows: TransactionSpec[] = [];

  /** Um lançamento simples numa conta. */
  const add = (
    key: string,
    date: string,
    description: string,
    amountInCents: number,
    accountId: string,
    options: Partial<Omit<Prisma.TransactionUncheckedCreateInput, 'id' | 'userId'>> = {},
  ): void => {
    rows.push({
      key,
      data: {
        kind: amountInCents < 0 ? 'EXPENSE' : 'INCOME',
        status: 'CONFIRMED',
        amountInCents,
        date: asDate(date),
        description,
        financialAccountId: accountId,
        settled: true,
        settledOn: asDate(date),
        ...options,
      },
    });
  };

  /** Uma compra a crédito: entra na fatura indicada e só se liquida com ela. */
  const addCredit = (
    key: string,
    date: string,
    description: string,
    amountInCents: number,
    invoiceId: string,
    category: string,
  ): void => {
    rows.push({
      key,
      data: {
        kind: 'EXPENSE',
        status: 'CONFIRMED',
        amountInCents,
        date: asDate(date),
        description,
        financialAccountId: checkingId,
        cardId,
        invoiceId,
        categoryId: expense(category),
        paymentMethod: 'CREDIT',
        paymentCondition: 'SINGLE',
        // Uma compra a crédito não move a conta: liquida-se quando a fatura for paga.
        settled: false,
      },
    });
  };

  /** Uma transferência: duas pernas do mesmo valor, com sinais opostos. */
  const addTransfer = (key: string, date: string, amountInCents: number): void => {
    const groupId = demoId('transfer', key);
    const category = expense('Transferência');

    rows.push({
      key: `${key}-out`,
      data: {
        kind: 'TRANSFER',
        status: 'CONFIRMED',
        amountInCents: -Math.abs(amountInCents),
        date: asDate(date),
        description: 'Transferência para a poupança',
        financialAccountId: checkingId,
        categoryId: category,
        transferGroupId: groupId,
        settled: true,
        settledOn: asDate(date),
      },
    });

    rows.push({
      key: `${key}-in`,
      data: {
        kind: 'TRANSFER',
        status: 'CONFIRMED',
        amountInCents: Math.abs(amountInCents),
        date: asDate(date),
        description: 'Transferência da conta ordenado',
        financialAccountId: savingsId,
        categoryId: category,
        transferGroupId: groupId,
        settled: true,
        settledOn: asDate(date),
      },
    });
  };

  for (const offset of [-2, -1, 0]) {
    const month = monthKey(offset);

    // --- Ordenado e renda: as duas séries recorrentes, com as ocorrências ligadas.
    rows.push({
      key: `${month}-salario`,
      data: {
        kind: 'INCOME',
        status: 'CONFIRMED',
        amountInCents: c(1_850),
        date: asDate(monthDay(offset, 5)),
        description: 'Ordenado',
        financialAccountId: checkingId,
        categoryId: income('Salário'),
        settled: true,
        settledOn: asDate(monthDay(offset, 5)),
        paymentCondition: 'RECURRING',
        recurrenceId: salaryRecurrenceId,
        origin: 'RECURRENCE',
      },
    });

    rows.push({
      key: `${month}-renda`,
      data: {
        kind: 'EXPENSE',
        status: 'CONFIRMED',
        amountInCents: -c(750),
        date: asDate(monthDay(offset, 8)),
        description: 'Renda da casa',
        financialAccountId: checkingId,
        categoryId: expense('Habitação'),
        settled: true,
        settledOn: asDate(monthDay(offset, 8)),
        paymentCondition: 'RECURRING',
        recurrenceId: rentRecurrenceId,
        origin: 'RECURRENCE',
      },
    });

    // --- Utilidades, transportes e restauração.
    add(
      `${month}-agua-luz-gas`,
      monthDay(offset, 12),
      'Eletricidade e gás',
      -c(84, 20),
      checkingId,
      {
        categoryId: expense('Água, luz e gás'),
      },
    );
    add(`${month}-telecom`, monthDay(offset, 15), 'Telecomunicações', -c(39, 99), checkingId, {
      categoryId: expense('Telecomunicações'),
    });
    add(`${month}-combustivel`, monthDay(offset, 18), 'Combustível', -c(55, 30), checkingId, {
      categoryId: expense('Combustível'),
    });
    add(`${month}-restauracao`, monthDay(offset, 21), 'Jantar fora', -c(18, 50), checkingId, {
      categoryId: expense('Restauração'),
    });
    add(`${month}-transportes`, monthDay(offset, 3), 'Passe mensal', -c(35), checkingId, {
      categoryId: expense('Transportes'),
    });

    // --- Aporte para o objetivo, com o lançamento que move o dinheiro.
    if (offset > -2) {
      const key = `${month}-aporte-objetivo`;
      const date = monthDay(offset, 6);

      rows.push({
        key,
        data: {
          kind: 'GOAL_DEPOSIT',
          status: 'CONFIRMED',
          amountInCents: -c(200),
          date: asDate(date),
          description: 'Aporte — Férias 2027',
          financialAccountId: checkingId,
          goalId,
          settled: true,
          settledOn: asDate(date),
        },
      });
    }

    addTransfer(`${month}-transferencia`, monthDay(offset, 25), c(300));
  }

  // --- Supermercado: no mês corrente soma exatamente 210,00 €, para o limite de
  // Alimentação (250,00 €) ficar em alerta aos 84 %.
  const groceries: Record<string, readonly number[]> = {
    '-2': [c(44, 90), c(66, 30)],
    '-1': [c(52, 10), c(47, 85), c(38, 20)],
    '0': [c(48, 20), c(56, 40), c(62, 75), c(42, 65)],
  };

  for (const offset of [-2, -1, 0]) {
    const month = monthKey(offset);

    (groceries[String(offset)] ?? []).forEach((amount, index) => {
      add(
        `${month}-supermercado-${index + 1}`,
        monthDay(offset, 10 + index * 3),
        'Supermercado',
        -amount,
        checkingId,
        { categoryId: expense('Alimentação') },
      );
    });
  }

  // --- Faturas do cartão (fecha a 20, vence a 5 do mês seguinte).
  // Paga: ciclo que fechou há dois meses, liquidada a 5 do mês seguinte.
  addCredit('fatura-paga-1', monthDay(-2, 12), 'Móveis para a sala', c(200), invoicePaidId, 'Casa');
  addCredit(
    'fatura-paga-2',
    monthDay(-2, 18),
    'Casaco de inverno',
    c(155, 80),
    invoicePaidId,
    'Vestuário',
  );

  // Fechada e por pagar: soma 412,30 €.
  addCredit(
    'fatura-fechada-1',
    monthDay(-2, 22),
    'Jantar de aniversário',
    c(85, 60),
    invoiceClosedId,
    'Lazer',
  );
  addCredit('fatura-fechada-2', monthDay(-1, 5), 'Ténis', c(146, 70), invoiceClosedId, 'Vestuário');
  addCredit(
    'fatura-fechada-3',
    monthDay(-1, 18),
    'Fim de semana',
    c(180),
    invoiceClosedId,
    'Lazer',
  );

  // Ciclo em curso: entra na fatura que ainda está aberta.
  addCredit('fatura-aberta-1', monthDay(0, 2), 'Camisa', c(59, 90), invoiceOpenId, 'Vestuário');
  addCredit('fatura-aberta-2', monthDay(0, 8), 'Livros', c(24, 30), invoiceOpenId, 'Lazer');

  // --- Dois movimentos sem categoria, com o texto que as regras procuram. É o
  // que faz /regras e o assistente de fecho mostrarem trabalho por fazer.
  add('sem-categoria-1', monthDay(0, 9), 'CONTINENTE MODELO LISBOA', -c(31, 45), checkingId);
  add('sem-categoria-2', monthDay(0, 7), 'GALP AVEIRAS', -c(48), checkingId);

  return rows;
}

// -----------------------------------------------------------------------------
// Escrita
// -----------------------------------------------------------------------------

export interface DemoSeedResult {
  readonly userId: string;
  readonly email: string;
  readonly userCreated: boolean;
  readonly categoriesCreated: number;
  /** `true` quando o hash guardado confere com `DEMO_PASSWORD`. */
  readonly credentialVerified: boolean;
}

/**
 * Escreve (ou reafirma) o conjunto de demonstração. Idempotente.
 *
 * Devolve o que fez, para quem chamar poder relatar sem medir outra vez.
 */
export async function seedDemo(prisma: SeedClient): Promise<DemoSeedResult> {
  const existing = await prisma.user.findUnique({
    where: { email: DEMO_EMAIL },
    select: { id: true },
  });

  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    create: {
      id: demoId('user', DEMO_EMAIL),
      name: DEMO_NAME,
      email: DEMO_EMAIL,
      emailVerified: true,
      currency: 'EUR',
    },
    // Não se reescrevem as preferências: se quem está a rever a demonstração
    // mudou o dia de início do mês, a passagem seguinte não lho tira.
    update: {},
    select: { id: true },
  });

  const userId = user.id;
  const categoriesCreated = await provisionDemoUser(prisma, userId);

  // Conta de credencial do `better-auth`: é o que permite entrar com e-mail e
  // palavra-passe. O formato do hash é o da biblioteca (`hashPassword`), e o
  // `accountId` da credencial é o `id` do utilizador — como no registo.
  const password = await hashPassword(DEMO_PASSWORD);

  await prisma.account.upsert({
    where: { providerId_accountId: { providerId: 'credential', accountId: userId } },
    create: {
      id: demoId('account', userId),
      userId,
      providerId: 'credential',
      accountId: userId,
      password,
    },
    update: { password },
  });

  /*
   * Confirma que a credencial serve para entrar: relê o hash da base e verifica-o
   * com a mesma função que o `better-auth` usa no início de sessão. Sem isto, um
   * erro no formato do hash só apareceria quando alguém tentasse entrar — e o
   * seed diria que estava tudo pronto.
   */
  const storedCredential = await prisma.account.findUnique({
    where: { providerId_accountId: { providerId: 'credential', accountId: userId } },
    select: { password: true },
  });

  if (
    storedCredential?.password == null ||
    !(await verifyPassword(storedCredential.password, DEMO_PASSWORD))
  ) {
    throw new Error(
      'A credencial do utilizador demo não confere: o hash guardado não valida a palavra-passe. ' +
        'Entrar com o demo falharia.',
    );
  }

  // --- Contas
  const accountIdByKey = new Map<string, string>();

  for (const spec of DEMO_ACCOUNTS) {
    const id = demoId('financial-account', spec.key);

    await prisma.financialAccount.upsert({
      where: { id },
      create: {
        id,
        userId,
        name: spec.name,
        type: spec.type,
        institution: spec.institution,
        currency: 'EUR',
        openingBalanceInCents: spec.openingBalanceInCents,
        origin: 'MANUAL',
      },
      // O saldo de abertura e o nome ficam como o utilizador os deixar.
      update: {},
    });

    accountIdByKey.set(spec.key, id);
  }

  const checkingId = accountIdByKey.get('checking');
  const savingsId = accountIdByKey.get('savings');

  if (checkingId === undefined || savingsId === undefined) {
    throw new Error('Contas do demo não foram criadas.');
  }

  // A conta principal passa a ser a conta à ordem: é a que o demo usa em tudo.
  await prisma.user.update({
    where: { id: userId },
    data: { primaryAccountId: checkingId },
  });

  // --- Categorias: mapa por (tipo, slug) para ligar os lançamentos
  const categoryRows = await prisma.category.findMany({
    where: { userId },
    select: { id: true, slug: true, kind: true },
  });
  const categoryByKey = new Map(
    categoryRows.map((row) => [categoryKey(row.kind, row.slug), row.id]),
  );

  const categoryId = (kind: CategoryKind, name: string): string => {
    const id = categoryByKey.get(categoryKey(kind, slugify(name)));

    if (id === undefined) {
      throw new Error(`Categoria em falta no catálogo: "${kind}:${name}".`);
    }

    return id;
  };

  // --- Cartão: fecha a 20, vence a 5 do mês seguinte.
  const cardId = demoId('credit-card', 'millennium');

  await prisma.creditCard.upsert({
    where: { id: cardId },
    create: {
      id: cardId,
      userId,
      name: 'Cartão Millennium',
      paymentAccountId: checkingId,
      brand: 'VISA',
      closingDay: 20,
      dueDay: 5,
      creditLimitInCents: c(2_000),
      annualFeeInCents: c(25),
    },
    update: {},
  });

  // --- Faturas. As datas seguem `invoiceDatesFor`: uma compra até ao dia de
  // fecho pertence à fatura desse mês, depois do fecho passa para a seguinte; o
  // vencimento cai no mês seguinte porque o dia de vencimento é menor.
  const paidClosing = monthDay(-2, 20);
  const closedClosing = monthDay(-1, 20);
  const openClosing = monthDay(0, 20);

  const invoicePaidId = demoId('invoice', paidClosing);
  const invoiceClosedId = demoId('invoice', closedClosing);
  const invoiceOpenId = demoId('invoice', openClosing);

  const invoices = [
    {
      id: invoicePaidId,
      closingDate: paidClosing,
      dueDate: monthDay(-1, 5),
      // Cache coerente com a cadeia calculada: paga a 100 %.
      totalAmountInCents: c(355, 80),
      paidAmountInCents: c(355, 80),
      carriedOverInCents: 0,
      status: 'PAID' as const,
      closedAt: asDate(paidClosing),
      paidAt: asDate(monthDay(-1, 5)),
    },
    {
      id: invoiceClosedId,
      closingDate: closedClosing,
      dueDate: monthDay(0, 5),
      totalAmountInCents: c(412, 30),
      paidAmountInCents: 0,
      carriedOverInCents: 0,
      status: 'CLOSED' as const,
      closedAt: asDate(closedClosing),
      paidAt: null,
    },
    {
      id: invoiceOpenId,
      closingDate: openClosing,
      dueDate: monthDay(1, 5),
      totalAmountInCents: c(84, 20),
      paidAmountInCents: 0,
      // O que ficou por pagar da fatura anterior transita para esta, que é a que
      // está em curso.
      carriedOverInCents: c(412, 30),
      status: 'OPEN' as const,
      closedAt: null,
      paidAt: null,
    },
  ];

  for (const invoice of invoices) {
    await prisma.invoice.upsert({
      where: { id: invoice.id },
      create: {
        id: invoice.id,
        userId,
        cardId,
        closingDate: asDate(invoice.closingDate),
        dueDate: asDate(invoice.dueDate),
        totalAmountInCents: invoice.totalAmountInCents,
        paidAmountInCents: invoice.paidAmountInCents,
        carriedOverInCents: invoice.carriedOverInCents,
        status: invoice.status,
        closedAt: invoice.closedAt,
        paidAt: invoice.paidAt,
      },
      // A cache das faturas é recalculada pela aplicação a cada escrita; aqui
      // reafirma-se o valor coerente com o que o seed grava.
      update: {
        closingDate: asDate(invoice.closingDate),
        dueDate: asDate(invoice.dueDate),
        totalAmountInCents: invoice.totalAmountInCents,
        paidAmountInCents: invoice.paidAmountInCents,
        carriedOverInCents: invoice.carriedOverInCents,
        status: invoice.status,
        closedAt: invoice.closedAt,
        paidAt: invoice.paidAt,
      },
    });
  }

  // --- Objetivo
  const goalId = demoId('goal', 'ferias-2027');

  await prisma.goal.upsert({
    where: { id: goalId },
    create: {
      id: goalId,
      userId,
      name: 'Férias 2027',
      description: 'Duas semanas no Algarve, sem mexer na poupança.',
      isPreset: false,
      targetAmountInCents: c(2_500),
      initialReservedInCents: c(300),
      targetDate: asDate(`${todayInLisbon().slice(0, 4)}-07-01`),
      contributionFrequency: 'MONTHLY',
      requiredContributionInCents: c(200),
      reminderFrequency: 'MONTHLY',
      deadlineAlert: true,
      state: 'ACTIVE',
    },
    update: {},
  });

  // --- Recorrências (as ocorrências dos três meses já nascem ligadas a elas)
  const rentRecurrenceId = demoId('recurrence', 'renda');
  const salaryRecurrenceId = demoId('recurrence', 'salario');

  const recurrences = [
    {
      id: rentRecurrenceId,
      name: 'Renda da casa',
      kind: 'EXPENSE' as const,
      amountInCents: -c(750),
      description: 'Renda da casa',
      dayOfMonth: 8,
      categoryId: categoryId('EXPENSE', 'Habitação'),
      nextRunDate: monthDay(1, 8),
    },
    {
      id: salaryRecurrenceId,
      name: 'Ordenado',
      kind: 'INCOME' as const,
      amountInCents: c(1_850),
      description: 'Ordenado',
      dayOfMonth: 5,
      categoryId: categoryId('INCOME', 'Salário'),
      nextRunDate: monthDay(1, 5),
    },
  ];

  for (const recurrence of recurrences) {
    const data = {
      userId,
      name: recurrence.name,
      kind: recurrence.kind,
      amountInCents: recurrence.amountInCents,
      description: recurrence.description,
      frequency: 'MONTHLY' as const,
      interval: 1,
      dayOfMonth: recurrence.dayOfMonth,
      startDate: asDate(monthDay(-2, recurrence.dayOfMonth)),
      endDate: null,
      nextRunDate: asDate(recurrence.nextRunDate),
      isActive: true,
      financialAccountId: checkingId,
      categoryId: recurrence.categoryId,
    };

    await prisma.recurrence.upsert({
      where: { id: recurrence.id },
      create: { id: recurrence.id, ...data },
      update: data,
    });
  }

  // --- Lançamentos
  const specs = buildTransactions({
    checkingId,
    savingsId,
    cardId,
    invoiceClosedId,
    invoicePaidId,
    invoiceOpenId,
    goalId,
    rentRecurrenceId,
    salaryRecurrenceId,
    categoryId,
  });

  const idByKey = new Map(specs.map((spec) => [spec.key, demoId('transaction', spec.key)]));

  for (const spec of specs) {
    const id = idByKey.get(spec.key);
    const data = { userId, ...spec.data };

    await prisma.transaction.upsert({
      where: { id },
      create: { id, ...data },
      update: data,
    });
  }

  /*
   * As pernas da transferência apontam uma para a outra.
   *
   * Fica para o fim de propósito: a chave estrangeira exige que a outra perna já
   * exista, e `counterpartTransactionId` é `@unique` — não pode ser escrita a
   * meio de uma criação.
   */
  for (const offset of [-2, -1, 0]) {
    const month = monthKey(offset);
    const outId = idByKey.get(`${month}-transferencia-out`);
    const inId = idByKey.get(`${month}-transferencia-in`);

    if (outId === undefined || inId === undefined) {
      continue;
    }

    await prisma.transaction.update({
      where: { id: outId },
      data: { counterpartTransactionId: inId },
    });
    await prisma.transaction.update({
      where: { id: inId },
      data: { counterpartTransactionId: outId },
    });
  }

  // --- Aportes do objetivo: o primeiro é só uma marca de progresso, os outros
  // dois têm o lançamento que move o dinheiro (e é ele que os liga).
  const movements = [
    { key: 'aporte-1', offset: -2, linked: false },
    { key: 'aporte-2', offset: -1, linked: true },
    { key: 'aporte-3', offset: 0, linked: true },
  ];

  for (const movement of movements) {
    const date = monthDay(movement.offset, 6);
    const transactionId = movement.linked
      ? (idByKey.get(`${monthKey(movement.offset)}-aporte-objetivo`) ?? null)
      : null;
    const id = demoId('goal-movement', movement.key);
    const data = {
      userId,
      goalId,
      type: 'DEPOSIT' as const,
      amountInCents: c(200),
      date: asDate(date),
      transactionId,
      note: movement.linked ? null : 'Reserva inicial, antes de haver conta associada',
    };

    await prisma.goalMovement.upsert({
      where: { id },
      create: { id, ...data },
      update: data,
    });
  }

  // --- Pagamento da fatura paga: o registo e o lançamento, ligados um ao outro.
  const invoicePaymentDate = monthDay(-1, 5);
  const paymentTransactionId = demoId('transaction', 'pagamento-fatura-paga');

  await prisma.transaction.upsert({
    where: { id: paymentTransactionId },
    create: {
      id: paymentTransactionId,
      userId,
      kind: 'INVOICE_PAYMENT',
      status: 'CONFIRMED',
      amountInCents: -c(355, 80),
      date: asDate(invoicePaymentDate),
      description: 'Pagamento da fatura do Cartão Millennium',
      financialAccountId: checkingId,
      cardId,
      invoiceId: invoicePaidId,
      settled: true,
      settledOn: asDate(invoicePaymentDate),
    },
    update: {
      date: asDate(invoicePaymentDate),
      amountInCents: -c(355, 80),
      invoiceId: invoicePaidId,
    },
  });

  const invoicePaymentId = demoId('invoice-payment', 'fatura-paga');

  await prisma.invoicePayment.upsert({
    where: { id: invoicePaymentId },
    create: {
      id: invoicePaymentId,
      userId,
      invoiceId: invoicePaidId,
      financialAccountId: checkingId,
      amountInCents: c(355, 80),
      date: asDate(invoicePaymentDate),
      transactionId: paymentTransactionId,
      note: 'Pagamento da fatura',
    },
    update: {
      date: asDate(invoicePaymentDate),
      amountInCents: c(355, 80),
      transactionId: paymentTransactionId,
    },
  });

  // --- Orçamento do mês, com um limite em alerta.
  const budgetId = demoId('budget', BUDGET_NAME);

  await prisma.budget.upsert({
    where: { id: budgetId },
    create: {
      id: budgetId,
      userId,
      name: BUDGET_NAME,
      scope: 'MONTHLY_DEFAULT',
      // Sentinela do esquema para orçamentos que valem todos os meses.
      periodStart: asDate('1970-01-01'),
      periodEnd: null,
      totalAmountInCents: c(1_500),
      alertsEnabled: true,
    },
    update: {
      totalAmountInCents: c(1_500),
      alertsEnabled: true,
    },
  });

  const limits = [
    { name: 'Alimentação', amountInCents: c(250), alertThresholdPct: 80 },
    { name: 'Transportes', amountInCents: c(150), alertThresholdPct: 80 },
    { name: 'Habitação', amountInCents: c(800), alertThresholdPct: 90 },
  ];

  for (const limit of limits) {
    const category = categoryId('EXPENSE', limit.name);
    const data = {
      amountInCents: limit.amountInCents,
      alertThresholdPct: limit.alertThresholdPct,
      alertsEnabled: true,
    };

    await prisma.budgetLimit.upsert({
      where: { budgetId_categoryId: { budgetId, categoryId: category } },
      create: { budgetId, userId, categoryId: category, ...data },
      update: data,
    });
  }

  // --- Regras de categorização: correspondem aos dois movimentos sem categoria.
  const rules = [
    {
      key: 'supermercado',
      name: 'Supermercado',
      descriptionContains: 'CONTINENTE',
      category: 'Alimentação',
      priority: 10,
    },
    {
      key: 'combustivel',
      name: 'Combustível',
      descriptionContains: 'GALP',
      category: 'Combustível',
      priority: 20,
    },
  ];

  for (const rule of rules) {
    const id = demoId('rule', rule.key);
    const data = {
      userId,
      name: rule.name,
      kind: 'EXPENSE' as const,
      priority: rule.priority,
      enabled: true,
      descriptionContains: rule.descriptionContains,
      counterparty: null,
      amountMinInCents: null,
      amountMaxInCents: null,
      dayMin: null,
      dayMax: null,
      financialAccountId: null,
      cardId: null,
      action: 'SET_CATEGORY' as const,
      targetCategoryId: categoryId('EXPENSE', rule.category),
      targetTagNames: [],
    };

    await prisma.transactionRule.upsert({
      where: { id },
      create: { id, ...data },
      update: data,
    });
  }

  return {
    userId,
    email: DEMO_EMAIL,
    userCreated: existing === null,
    categoriesCreated,
    credentialVerified: true,
  };
}

// -----------------------------------------------------------------------------
// Medições (leitura) — o que o motor diz do conjunto acabado de escrever
// -----------------------------------------------------------------------------

export interface DemoSample {
  readonly transactions: number;
  readonly budget: {
    readonly limitName: string;
    readonly limitInCents: number;
    readonly spentInCents: number;
    readonly usedPct: number;
    readonly state: string;
    readonly alertTriggered: boolean;
  } | null;
  readonly invoices: readonly {
    readonly closingDate: string;
    readonly status: string;
    readonly totalInCents: number;
    readonly paidInCents: number;
    readonly outstandingInCents: number;
  }[];
  readonly outstandingInCents: number;
  readonly goal: { readonly accumulatedInCents: number; readonly progressPct: number } | null;
  readonly uncategorized: number;
}

/**
 * Lê o demo e passa-o pelo **mesmo motor** que os ecrãs usam.
 *
 * Existe para o relatório poder dizer "o limite está em alerta" com um número
 * medido, e não com a intenção de quem escreveu o seed.
 */
export async function sampleDemo(prisma: SeedClient, userId: string): Promise<DemoSample> {
  const today = todayInLisbon();

  const [user, transactions, categories, limits, budgets, invoices, payments, movements, goals] =
    await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { monthStartDay: true },
      }),
      prisma.transaction.findMany({ where: { userId } }),
      prisma.category.findMany({ where: { userId } }),
      prisma.budgetLimit.findMany({ where: { userId }, include: { budget: true } }),
      prisma.budget.findMany({ where: { userId } }),
      prisma.invoice.findMany({ where: { userId } }),
      prisma.invoicePayment.findMany({ where: { userId } }),
      prisma.goalMovement.findMany({ where: { userId } }),
      prisma.goal.findMany({ where: { userId } }),
    ]);

  const financeTransactions = transactions.map(toFinanceTransaction);
  const nameById = new Map(categories.map((category) => [category.id, category.name]));

  const budget = budgets.find((row) => row.scope === 'MONTHLY_DEFAULT');

  let budgetMeasurement: DemoSample['budget'] = null;

  if (budget !== undefined) {
    const period = budgetPeriodFor({
      budget: { scope: 'monthly_default', periodStart: toIsoDate(budget.periodStart) },
      user,
      today,
    });
    const statuses = budgetStatusList({
      limits: limits
        .filter((limit) => limit.budgetId === budget.id)
        .map((limit) => ({
          id: limit.id,
          categoryId: limit.categoryId,
          amountInCents: limit.amountInCents,
          alertThresholdPct: limit.alertThresholdPct ?? undefined,
          alertsEnabled: limit.alertsEnabled,
        })),
      transactions: financeTransactions,
      period,
      referenceDate: today,
    });
    const flagged = statuses.find((status) => status.alertTriggered) ?? statuses[0];

    if (flagged !== undefined) {
      budgetMeasurement = {
        limitName: nameById.get(flagged.categoryId) ?? flagged.categoryId,
        limitInCents: flagged.limitInCents,
        spentInCents: flagged.spentInCents,
        usedPct: flagged.usedPct,
        state: flagged.state,
        alertTriggered: flagged.alertTriggered,
      };
    }
  }

  const chain = invoiceChain({
    invoices: invoices.map(toFinanceInvoice),
    transactions: financeTransactions,
    payments: payments.map(toFinancePayment),
    today,
  });

  const goal = goals[0];
  const goalMeasurement =
    goal === undefined
      ? null
      : goalProgress({
          goal: {
            id: goal.id,
            targetAmountInCents: goal.targetAmountInCents,
            initialReservedInCents: goal.initialReservedInCents,
            targetDate: toIsoDate(goal.targetDate),
            contributionFrequency: 'monthly',
          },
          movements: movements.map((movement) => ({
            goalId: movement.goalId,
            type: movement.type === 'WITHDRAWAL' ? ('withdrawal' as const) : ('deposit' as const),
            amountInCents: movement.amountInCents,
            date: toIsoDate(movement.date),
          })),
          today,
        });

  return {
    transactions: transactions.length,
    budget: budgetMeasurement,
    invoices: chain.map((entry) => ({
      closingDate: entry.closingDate,
      status: entry.status,
      totalInCents: entry.totalInCents,
      paidInCents: entry.paidInCents,
      outstandingInCents: entry.outstandingInCents,
    })),
    outstandingInCents: chain[chain.length - 1]?.outstandingInCents ?? 0,
    goal:
      goalMeasurement === null
        ? null
        : {
            accumulatedInCents: goalMeasurement.accumulatedInCents,
            progressPct: goalMeasurement.progressPct,
          },
    uncategorized: transactions.filter(
      (transaction) =>
        transaction.categoryId === null &&
        transaction.status !== 'IGNORED' &&
        (transaction.kind === 'EXPENSE' || transaction.kind === 'INCOME'),
    ).length,
  };
}

// -----------------------------------------------------------------------------
// Contagens (para provar a idempotência)
// -----------------------------------------------------------------------------

/** Linhas por tabela de um utilizador. É a medida que prova "0 criadas". */
export async function countRows(
  prisma: SeedClient,
  userId: string,
): Promise<Record<string, number>> {
  const [
    accounts,
    categories,
    transactions,
    cards,
    invoices,
    invoicePayments,
    goals,
    goalMovements,
    budgets,
    budgetLimits,
    recurrences,
    rules,
  ] = await Promise.all([
    prisma.financialAccount.count({ where: { userId } }),
    prisma.category.count({ where: { userId } }),
    prisma.transaction.count({ where: { userId } }),
    prisma.creditCard.count({ where: { userId } }),
    prisma.invoice.count({ where: { userId } }),
    prisma.invoicePayment.count({ where: { userId } }),
    prisma.goal.count({ where: { userId } }),
    prisma.goalMovement.count({ where: { userId } }),
    prisma.budget.count({ where: { userId } }),
    prisma.budgetLimit.count({ where: { userId } }),
    prisma.recurrence.count({ where: { userId } }),
    prisma.transactionRule.count({ where: { userId } }),
  ]);

  return {
    conta: accounts,
    categoria: categories,
    lançamento: transactions,
    cartão: cards,
    fatura: invoices,
    'pagamento de fatura': invoicePayments,
    objetivo: goals,
    'movimento de objetivo': goalMovements,
    orçamento: budgets,
    'limite de orçamento': budgetLimits,
    recorrência: recurrences,
    regra: rules,
  };
}

// -----------------------------------------------------------------------------
// Ponto de entrada
// -----------------------------------------------------------------------------

function formatCents(cents: number): string {
  return formatCurrency(cents);
}

function report(label: string, counts: Record<string, number>): void {
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

  console.info(`[seed] ${label}: ${total} linha(s)`);

  for (const [table, count] of Object.entries(counts)) {
    console.info(`[seed]   ${table}: ${count}`);
  }
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL não está definida. Preenche o `.env` da raiz com a ligação do Neon ' +
        '(ou sobe o Postgres do `docker-compose.yml`) antes de correr o seed.',
    );
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    const before = await prisma.user.findUnique({
      where: { email: DEMO_EMAIL },
      select: { id: true },
    });
    const beforeCounts: Record<string, number> =
      before === null ? {} : await countRows(prisma, before.id);

    // Fotografia dos **outros** utilizadores: é a prova de que o seed só toca no
    // demo. Nenhum é lido no conteúdo, só contado.
    const others = await prisma.user.findMany({
      where: { email: { not: DEMO_EMAIL } },
      select: { id: true },
    });
    const othersBefore = await Promise.all(others.map((user) => countRows(prisma, user.id)));

    const result = await seedDemo(prisma);

    const afterCounts = await countRows(prisma, result.userId);
    const othersAfter = await Promise.all(others.map((user) => countRows(prisma, user.id)));

    report('linhas do utilizador demo (antes)', beforeCounts);
    report('linhas do utilizador demo (depois)', afterCounts);

    const created = Object.fromEntries(
      Object.entries(afterCounts).map(([table, count]) => [
        table,
        count - (beforeCounts[table] ?? 0),
      ]),
    );
    const totalCreated = Object.values(created).reduce((sum, value) => sum + value, 0);

    console.info(`[seed] criadas nesta passagem: ${totalCreated}`);
    for (const [table, count] of Object.entries(created)) {
      console.info(`[seed]   ${table}: +${count}`);
    }

    const untouched = othersBefore.every(
      (counts, index) => JSON.stringify(counts) === JSON.stringify(othersAfter[index] ?? {}),
    );

    console.info(
      `[seed] outros utilizadores: ${others.length} · linhas inalteradas: ${untouched ? 'sim' : 'NÃO'}`,
    );

    if (!untouched) {
      throw new Error('O seed alterou linhas de outro utilizador. Nada disto devia acontecer.');
    }

    const sample = await sampleDemo(prisma, result.userId);

    console.info(`[seed] utilizador demo: ${result.email} · ${result.userId}`);
    console.info(`[seed] palavra-passe: ${DEMO_PASSWORD}`);
    console.info(
      `[seed] credencial conferida com a biblioteca: ${result.credentialVerified ? 'sim' : 'NÃO'}`,
    );
    console.info(`[seed] categorias criadas nesta passagem: ${result.categoriesCreated}`);
    console.info(
      `[seed] lançamentos: ${sample.transactions} (sem categoria, como o fecho de mês conta: ${sample.uncategorized})`,
    );

    if (sample.budget !== null) {
      console.info(
        `[seed] orçamento · ${sample.budget.limitName}: ` +
          `${formatCents(sample.budget.spentInCents)} de ${formatCents(sample.budget.limitInCents)} ` +
          `= ${sample.budget.usedPct}% · estado ${sample.budget.state} · ` +
          `alerta ${sample.budget.alertTriggered ? 'acionado' : 'não acionado'}`,
      );
    }

    for (const invoice of sample.invoices) {
      console.info(
        `[seed] fatura ${invoice.closingDate}: ${invoice.status} · ` +
          `total ${formatCents(invoice.totalInCents)} · pago ${formatCents(invoice.paidInCents)} · ` +
          `em dívida ${formatCents(invoice.outstandingInCents)}`,
      );
    }

    console.info(`[seed] cartão em dívida (cadeia): ${formatCents(sample.outstandingInCents)}`);

    if (sample.goal !== null) {
      console.info(
        `[seed] objetivo: ${formatCents(sample.goal.accumulatedInCents)} acumulado ` +
          `(${sample.goal.progressPct}%)`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * `true` quando o ficheiro é o ponto de entrada (`tsx prisma/seed.ts`), `false`
 * quando é importado. Compara caminhos resolvidos para funcionar em Windows e em
 * POSIX.
 */
function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;

  return fileURLToPath(import.meta.url) === resolve(entry);
}

if (isDirectRun()) {
  main().catch((error: unknown) => {
    console.error('[seed] falhou:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
