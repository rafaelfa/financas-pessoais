/**
 * Seed de arranque do domínio financeiro.
 *
 * -----------------------------------------------------------------------------
 * O QUE CRIA
 * -----------------------------------------------------------------------------
 * 1. As **categorias de sistema** adaptadas a Portugal:
 *      - 17 de gasto (`CategoryKind.EXPENSE`);
 *      - 8 de ganho (`CategoryKind.INCOME`);
 *      - 4 **internas** (`isInternal = true`): transferência, fatura de cartão,
 *        ajuste de saldo e investimento. Aparecem no extrato mas nunca contam
 *        como ganho ou gasto.
 * 2. A **carteira por omissão** do utilizador ("Carteira principal").
 *
 * -----------------------------------------------------------------------------
 * IDEMPOTÊNCIA
 * -----------------------------------------------------------------------------
 * Tudo é feito com `upsert` sobre chaves naturais estáveis:
 *   - categorias  -> `@@unique([userId, kind, slug])`
 *   - carteira    -> `@@unique([userId, name])`
 * O `slug` (não o `name`) é a chave: renomear a apresentação de uma categoria
 * ("Água/Luz/Gás" -> "Utilidades") não volta a criar a linha nem duplica dados.
 * Correr o seed duas vezes não altera contagens.
 *
 * -----------------------------------------------------------------------------
 * DE QUEM SÃO AS CATEGORIAS
 * -----------------------------------------------------------------------------
 * As categorias são propriedade do utilizador (`userId`), pelo que o seed
 * precisa de saber para quem as criar. A base (Neon) ainda não existe e,
 * portanto, também ainda não existe nenhum utilizador: o `userId` é lido de
 * `SEED_USER_ID` (ou do primeiro argumento da linha de comandos) e o seed
 * **falha com uma mensagem explícita** quando ele não é indicado, em vez de
 * inventar um utilizador órfão.
 *
 * Exemplo, depois de existir base de dados e um utilizador registado:
 *   SEED_USER_ID=<uuid> pnpm --filter @repo/db db:seed
 *
 * Este ficheiro **não é executado por** `prisma generate`/`validate`/`format` e
 * não é corrido em nenhum gate desta tarefa (não há base de dados).
 */

import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

import { PrismaPg } from '@prisma/adapter-pg';
import { config as loadEnv } from 'dotenv';

import { type CategoryKind, type Prisma, PrismaClient } from '../src/generated/prisma/client';

// O workspace tem um único `.env` canónico na raiz. `dotenv` recebe as duas
// localizações candidatas para funcionar de `packages/db` ou da raiz.
loadEnv({ path: ['.env', '../../.env'], quiet: true });

/** Nome da carteira por omissão; a sua chave natural é `@@unique([userId, name])`. */
const DEFAULT_WALLET_NAME = 'Carteira principal';

type CategorySpec = {
  /** Chave estável e única por `(userId, kind)`. Nunca muda depois de publicado. */
  readonly slug: string;
  /** Nome de apresentação em pt-PT. */
  readonly name: string;
  readonly icon: string;
  readonly color: string;
};

/**
 * 17 categorias de gasto plausíveis para Portugal.
 *
 * Mapeamento face às 17 do sistema original (doc. 01 §2.4):
 *   Alimentação, Assinaturas->Subscrições, Casa, Dívidas, Educação, Lazer,
 *   Objetivos de vida->Outros, Pessoal->Vestuário, Pet->Animais,
 *   Saúde, Serviços->Água/Luz/Gás, Taxas->Impostos, Transferências->interna,
 *   Transporte->Transportes+Combustível, Vestuário, Viagem->Lazer, Outros
 *   + acrescentadas: Restauração, Seguros, Telecomunicações.
 */
const EXPENSE_CATEGORIES: readonly CategorySpec[] = [
  { slug: 'habitacao', name: 'Habitação', icon: 'house', color: '#6366f1' },
  { slug: 'alimentacao', name: 'Alimentação', icon: 'shopping-basket', color: '#f97316' },
  { slug: 'restauracao', name: 'Restauração', icon: 'utensils', color: '#fb7185' },
  { slug: 'transportes', name: 'Transportes', icon: 'bus', color: '#0ea5e9' },
  { slug: 'combustivel', name: 'Combustível', icon: 'fuel', color: '#f59e0b' },
  {
    slug: 'agua-luz-gas',
    name: 'Água/Luz/Gás',
    icon: 'droplets',
    color: '#06b6d4',
  },
  {
    slug: 'telecomunicacoes',
    name: 'Telecomunicações',
    icon: 'smartphone',
    color: '#8b5cf6',
  },
  { slug: 'saude', name: 'Saúde', icon: 'heart-pulse', color: '#ef4444' },
  { slug: 'educacao', name: 'Educação', icon: 'graduation-cap', color: '#3b82f6' },
  { slug: 'lazer', name: 'Lazer', icon: 'party-popper', color: '#ec4899' },
  { slug: 'subscricoes', name: 'Subscrições', icon: 'repeat', color: '#a855f7' },
  { slug: 'seguros', name: 'Seguros', icon: 'shield', color: '#14b8a6' },
  { slug: 'impostos', name: 'Impostos', icon: 'landmark', color: '#78716c' },
  { slug: 'vestuario', name: 'Vestuário', icon: 'shirt', color: '#d946ef' },
  { slug: 'casa', name: 'Casa', icon: 'sofa', color: '#84cc16' },
  { slug: 'animais', name: 'Animais', icon: 'paw-print', color: '#22c55e' },
  { slug: 'outros-gastos', name: 'Outros', icon: 'circle-ellipsis', color: '#64748b' },
];

/**
 * 8 categorias de ganho. `outros-ganhos` tem de ter slug próprio porque a
 * chave única é `(userId, kind, slug)` e `outros-gastos` já existe com outro
 * `kind` — ainda assim mantemos slugs distintos para o seed ser legível.
 */
const INCOME_CATEGORIES: readonly CategorySpec[] = [
  { slug: 'salario', name: 'Salário', icon: 'badge-euro', color: '#16a34a' },
  {
    slug: 'rendimento-variavel',
    name: 'Rendimento variável',
    icon: 'trending-up',
    color: '#22c55e',
  },
  {
    slug: 'rendimento-investimentos',
    name: 'Rendimento de investimentos',
    icon: 'chart-line',
    color: '#10b981',
  },
  { slug: 'prendas', name: 'Prendas', icon: 'gift', color: '#f472b6' },
  { slug: 'premios', name: 'Prémios', icon: 'award', color: '#eab308' },
  { slug: 'reembolsos', name: 'Reembolsos', icon: 'rotate-ccw', color: '#38bdf8' },
  { slug: 'cashback', name: 'Cashback', icon: 'coins', color: '#fbbf24' },
  {
    slug: 'transferencias-recebidas',
    name: 'Transferências',
    icon: 'arrow-left-right',
    color: '#94a3b8',
  },
];

/**
 * Categorias **internas**: fora do cálculo de entradas/saídas.
 *
 * `kind` é obrigatório no esquema. Como as internas são operações de saída do
 * ponto de vista do numerário (transferir, pagar fatura, ajustar, investir),
 * ficam todas em `EXPENSE`. O que as exclui dos totais é `isInternal = true`,
 * nunca o `kind` — o motor financeiro filtra por `isInternal`.
 */
const INTERNAL_CATEGORIES: readonly CategorySpec[] = [
  { slug: 'transferencia', name: 'Transferência', icon: 'arrow-left-right', color: '#94a3b8' },
  { slug: 'fatura-cartao', name: 'Fatura de cartão', icon: 'credit-card', color: '#64748b' },
  { slug: 'ajuste-saldo', name: 'Ajuste de saldo', icon: 'scale', color: '#a1a1aa' },
  { slug: 'investimento', name: 'Investimento', icon: 'piggy-bank', color: '#0d9488' },
];

type SeedClient = Prisma.TransactionClient;

/** Upsert das categorias de um tipo. Devolve quantas foram processadas. */
async function upsertCategories(
  prisma: SeedClient,
  userId: string,
  kind: CategoryKind,
  specs: readonly CategorySpec[],
  isInternal: boolean,
): Promise<number> {
  let sortOrder = 0;

  for (const spec of specs) {
    sortOrder += 1;

    await prisma.category.upsert({
      where: {
        userId_kind_slug: { userId, kind, slug: spec.slug },
      },
      create: {
        userId,
        kind,
        slug: spec.slug,
        name: spec.name,
        icon: spec.icon,
        color: spec.color,
        sortOrder,
        isInternal,
        isSystem: true,
      },
      // Não se atualiza o `name` de propósito: se o utilizador renomeou uma
      // categoria de sistema na aplicação, o seed não deve repor o nome
      // original. Atualizam-se apenas os metadados que são do sistema.
      update: {
        isInternal,
        isSystem: true,
        sortOrder,
      },
    });
  }

  return specs.length;
}

/**
 * Cria (ou reafirma) as categorias de sistema e a carteira por omissão do
 * utilizador indicado. Idempotente: pode correr quantas vezes for preciso.
 *
 * @param prisma Cliente Prisma já construído (permite correr dentro de uma
 *   transação em testes).
 * @param userId Utilizador dono das categorias e da carteira.
 */
export async function seed(prisma: SeedClient, userId: string): Promise<void> {
  const expenses = await upsertCategories(prisma, userId, 'EXPENSE', EXPENSE_CATEGORIES, false);
  const incomes = await upsertCategories(prisma, userId, 'INCOME', INCOME_CATEGORIES, false);
  const internals = await upsertCategories(prisma, userId, 'EXPENSE', INTERNAL_CATEGORIES, true);

  await prisma.financialAccount.upsert({
    where: { userId_name: { userId, name: DEFAULT_WALLET_NAME } },
    create: {
      userId,
      name: DEFAULT_WALLET_NAME,
      type: 'WALLET',
      institution: null,
      description: 'Carteira por omissão para lançamentos rápidos.',
      openingBalanceInCents: 0,
      origin: 'MANUAL',
    },
    // Preserva saldos e edições do utilizador: só se garante que a conta existe.
    update: {},
  });

  console.info(
    `[seed] utilizador ${userId}: ` +
      `${expenses} categorias de gasto, ${incomes} de ganho, ${internals} internas, ` +
      `1 carteira ("${DEFAULT_WALLET_NAME}").`,
  );
}

function resolveUserId(): string {
  const fromArgv = process.argv[2];
  const userId = fromArgv ?? process.env.SEED_USER_ID;

  if (!userId) {
    throw new Error(
      'Falta o utilizador para o seed. Indica `SEED_USER_ID=<uuid>` ou passa o uuid como ' +
        'primeiro argumento. As categorias são por utilizador, por isso o seed não pode ' +
        'inventar um dono.',
    );
  }

  return userId;
}

/**
 * `true` quando o ficheiro é o ponto de entrada (`tsx prisma/seed.ts`), `false`
 * quando é importado (testes). Compara caminhos resolvidos para funcionar em
 * Windows e em POSIX.
 */
function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;

  return fileURLToPath(import.meta.url) === resolve(entry);
}

async function main(): Promise<void> {
  const userId = resolveUserId();
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL não está definida. Preenche o `.env` da raiz com a ligação do Neon ' +
        '(ou sobe o Postgres do `docker-compose.yml`) antes de correr o seed.',
    );
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    await seed(prisma, userId);
  } finally {
    await prisma.$disconnect();
  }
}

// Só corre quando é invocado diretamente (permite importar `seed` em testes).
if (isDirectRun()) {
  main().catch((error: unknown) => {
    console.error('[seed] falhou:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
