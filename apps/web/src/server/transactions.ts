import { prisma, TransactionKind, TransactionStatus, type Prisma } from '@repo/db/client';
import {
  amountWhereClause,
  rankDescriptionSuggestions,
  transactionFiltersSchema,
  type AmountFilter,
  type DescriptionUsage,
} from '@repo/shared';

import { todayInLisbon } from '@/lib/today';

import { toIsoDate } from './mapping';
import { requireUser } from './session';

/**
 * Consultas do extrato.
 *
 * Os filtros chegam pelo URL, ou seja, são texto que pode estar errado. Em vez
 * de rebentar com um ecrã de erro, um filtro inválido é ignorado e o extrato
 * aparece sem filtros — previsível e sem perda de dados.
 */

export interface TransactionView {
  readonly id: string;
  readonly kind: string;
  readonly status: string;
  readonly amountInCents: number;
  readonly date: string;
  readonly description: string | null;
  readonly accountId: string | null;
  readonly accountName: string | null;
  readonly categoryId: string | null;
  readonly categoryName: string | null;
  readonly invoiceId: string | null;
  readonly settled: boolean;
  readonly tags: string[];
  readonly transferGroupId: string | null;
  /** Cartão usado, quando a compra foi a crédito. */
  readonly cardId: string | null;
  readonly cardName: string | null;
  /** Posição no parcelamento, quando a compra foi parcelada. */
  readonly installmentNumber: number | null;
  readonly installmentCount: number | null;
}

export interface TransactionFilters {
  readonly from?: string;
  readonly to?: string;
  readonly accountId?: string;
  readonly categoryId?: string;
  readonly kind?: string;
  readonly status?: string;
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface TransactionPage {
  readonly items: TransactionView[];
  readonly total: number;
  /** Soma líquida (entradas menos saídas) de tudo o que está filtrado. */
  readonly sumInCents: number;
}

const KIND_BY_INPUT: Record<string, TransactionKind> = {
  expense: TransactionKind.EXPENSE,
  income: TransactionKind.INCOME,
  transfer: TransactionKind.TRANSFER,
  invoice_payment: TransactionKind.INVOICE_PAYMENT,
  goal_deposit: TransactionKind.GOAL_DEPOSIT,
  goal_withdrawal: TransactionKind.GOAL_WITHDRAWAL,
  balance_adjust: TransactionKind.BALANCE_ADJUST,
};

const STATUS_BY_INPUT: Record<string, TransactionStatus> = {
  pending: TransactionStatus.PENDING,
  confirmed: TransactionStatus.CONFIRMED,
  ignored: TransactionStatus.IGNORED,
};

/** Lista paginada do extrato, com o total de registos e a soma líquida. */
export async function listTransactions(
  filters: TransactionFilters = {},
  amountFilter: AmountFilter | null = null,
): Promise<TransactionPage> {
  const user = await requireUser();
  const parsed = transactionFiltersSchema.safeParse(filters);
  const value = parsed.success ? parsed.data : { limit: 50, offset: 0 };

  const where: Prisma.TransactionWhereInput = {
    userId: user.id,
    ...(value.from !== undefined || value.to !== undefined
      ? {
          date: {
            ...(value.from !== undefined ? { gte: new Date(value.from) } : {}),
            ...(value.to !== undefined ? { lte: new Date(value.to) } : {}),
          },
        }
      : {}),
    ...(value.accountId !== undefined ? { financialAccountId: value.accountId } : {}),
    ...(value.categoryId !== undefined ? { categoryId: value.categoryId } : {}),
    ...(value.kind !== undefined && KIND_BY_INPUT[value.kind] !== undefined
      ? { kind: KIND_BY_INPUT[value.kind] }
      : {}),
    ...(value.status !== undefined && STATUS_BY_INPUT[value.status] !== undefined
      ? { status: STATUS_BY_INPUT[value.status] }
      : {}),
    ...(value.search !== undefined && value.search.length > 0
      ? { description: { contains: value.search, mode: 'insensitive' } }
      : {}),
    // O mesmo `where` alimenta as três consultas — linhas, contagem e soma.
    ...(amountFilter === null ? {} : amountWhereClause(amountFilter)),
  };

  const [rows, total, aggregate] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      skip: value.offset,
      take: value.limit,
      include: {
        financialAccount: { select: { name: true } },
        category: { select: { name: true } },
        tags: { select: { name: true } },
        // O cartão faz parte da identificação de uma compra: sem ele, um gasto a
        // crédito parece igual a um gasto da conta, e o extrato deixa de explicar
        // de onde saiu o dinheiro.
        card: { select: { name: true } },
      },
    }),
    prisma.transaction.count({ where }),
    prisma.transaction.aggregate({ where, _sum: { amountInCents: true } }),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      // Prisma devolve o enum em maiúsculas (CONFIRMED, PENDING, IGNORED). A UI
      // e os esquemas usam minúsculas; normaliza aqui para não ter que converter
      // em cada componente.
      status: row.status.toLowerCase(),
      amountInCents: row.amountInCents,
      date: toIsoDate(row.date),
      description: row.description,
      accountId: row.financialAccountId,
      accountName: row.financialAccount?.name ?? null,
      categoryId: row.categoryId,
      categoryName: row.category?.name ?? null,
      invoiceId: row.invoiceId,
      settled: row.settled,
      tags: row.tags.map((tag) => tag.name),
      transferGroupId: row.transferGroupId,
      cardId: row.cardId,
      cardName: row.card?.name ?? null,
      installmentNumber: row.installmentNumber,
      installmentCount: row.installmentCount,
    })),
    total,
    sumInCents: aggregate._sum.amountInCents ?? 0,
  };
}

/** Primeiro dia da janela de sugestões: o mesmo dia, doze meses antes. */
function twelveMonthsAgo(today: string): Date {
  const [year, month, day] = today.split('-').map(Number) as [number, number, number];

  // `Date.UTC` trata do 29 de fevereiro como o resto do JavaScript: um dia de
  // diferença na janela não muda a lista, e inventar aqui uma regra seria pior.
  return new Date(Date.UTC(year - 1, month - 1, day));
}

/**
 * Descrições já usadas, para sugerir no campo.
 *
 * **Uma consulta** (`groupBy` sobre a descrição, dentro da janela de 12 meses):
 * o `where` usa o índice `[userId, date]` e a contagem vem do próprio grupo. A
 * ordenação é feita no `shared`, porque é lá que se pode testar.
 */
export async function descriptionSuggestions(): Promise<DescriptionUsage[]> {
  const user = await requireUser();

  const rows = await prisma.transaction.groupBy({
    by: ['description'],
    where: {
      userId: user.id,
      description: { not: null },
      date: { gte: twelveMonthsAgo(todayInLisbon()) },
    },
    _count: { _all: true },
  });

  return rankDescriptionSuggestions(
    rows.flatMap((row) =>
      row.description === null ? [] : [{ description: row.description, uses: row._count._all }],
    ),
  );
}
