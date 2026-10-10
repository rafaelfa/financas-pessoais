import type { Metadata } from 'next';
import Link from 'next/link';

import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import {
  TRANSACTION_KIND_LABELS,
  TRANSACTION_STATUS_LABELS,
} from '@/components/transaction-kind-badge';
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  TransactionFilters,
} from '@/components/transaction-filters';
import { TransactionQuickAdd } from '@/components/transaction-quick-add';
import { TransactionTable } from '@/components/transaction-table';
import { todayInLisbon } from '@/lib/today';
import { listAccounts } from '@/server/accounts';
import { listCategories } from '@/server/categories';
import {
  listTransactions,
  type TransactionFilters as TransactionFiltersInput,
} from '@/server/transactions';

export const metadata: Metadata = { title: 'Transações' };

type SearchParams = Record<string, string | string[] | undefined>;

/** Só aceita datas de calendário bem formadas; o resto é ignorado. */
function readDate(params: SearchParams, key: string): string | undefined {
  const value = readText(params, key);

  return value !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

/** Texto simples: ignora repetições (`?a=1&a=2`) e valores vazios. */
function readText(params: SearchParams, key: string): string | undefined {
  const value = params[key];

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed === '' ? undefined : trimmed;
}

/** Um valor que exista num conjunto fechado (tipos e estados). */
function readOption(
  params: SearchParams,
  key: string,
  allowed: Readonly<Record<string, string>>,
): string | undefined {
  const value = readText(params, key);

  return value !== undefined && allowed[value] !== undefined ? value : undefined;
}

function readLimit(params: SearchParams): number {
  const value = Number(readText(params, 'limit'));

  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(value) ? value : DEFAULT_PAGE_SIZE;
}

function readPage(params: SearchParams): number {
  const value = Number(readText(params, 'page'));

  return Number.isInteger(value) && value > 0 ? value : 1;
}

/** Query do URL com os filtros atuais e, opcionalmente, outra página. */
function buildHref(filters: TransactionFiltersInput, limit: number, page: number): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }

  if (limit !== DEFAULT_PAGE_SIZE) {
    params.set('limit', String(limit));
  }

  if (page > 1) {
    params.set('page', String(page));
  }

  const query = params.toString();

  return query === '' ? '/transacoes' : `/transacoes?${query}`;
}

/**
 * Extrato de transações.
 *
 * Os filtros chegam pelo URL, são saneados aqui — a consulta do servidor ignora
 * em bloco um filtro inválido, por isso não lhe passamos lixo — e são aplicados
 * na mesma consulta que produz o total e a soma.
 */
export default async function TransacoesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const today = todayInLisbon();

  const filters: TransactionFiltersInput = {
    from: readDate(params, 'from'),
    to: readDate(params, 'to'),
    accountId: readText(params, 'accountId'),
    categoryId: readText(params, 'categoryId'),
    kind: readOption(params, 'kind', TRANSACTION_KIND_LABELS),
    status: readOption(params, 'status', TRANSACTION_STATUS_LABELS),
    search: readText(params, 'search'),
  };

  const limit = readLimit(params);
  const page = readPage(params);

  const [accounts, categories, firstAttempt] = await Promise.all([
    listAccounts(),
    listCategories(),
    listTransactions({ ...filters, limit, offset: (page - 1) * limit }),
  ]);

  /*
   * Um favorito antigo com `?page=7` num extrato que entretanto encolheu para
   * três páginas não pode mostrar "sem resultados" com dados à vista: recua-se
   * para a última página que existe.
   */
  let transactions = firstAttempt;

  if (page > 1 && transactions.items.length === 0 && transactions.total > 0) {
    const lastPage = Math.max(1, Math.ceil(transactions.total / limit));
    transactions = await listTransactions({ ...filters, limit, offset: (lastPage - 1) * limit });
  }

  const hasActiveFilters = Object.values(filters).some((value) => value !== undefined);
  const pageCount = Math.max(1, Math.ceil(transactions.total / limit));
  const safePage = Math.min(page, pageCount);
  const firstOnPage = transactions.total === 0 ? 0 : (safePage - 1) * limit + 1;
  const lastOnPage = Math.min(safePage * limit, transactions.total);

  return (
    <>
      <PageHeader
        title="Transações"
        description="Todos os movimentos, com filtros por período, conta, categoria, tipo e estado. A soma no fim refere-se a tudo o que está filtrado."
      />

      <div className="space-y-6">
        <TransactionQuickAdd accounts={accounts} categories={categories} today={today} />

        <TransactionFilters
          values={{ ...filters, limit }}
          today={today}
          accounts={accounts}
          categories={categories}
        />

        <TransactionTable
          items={transactions.items}
          total={transactions.total}
          sumInCents={transactions.sumInCents}
          accounts={accounts}
          categories={categories}
          hasActiveFilters={hasActiveFilters}
        />

        {transactions.total === 0 ? null : (
          <nav
            aria-label="Paginação do extrato"
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <p className="text-sm text-muted-foreground">
              A mostrar {firstOnPage}–{lastOnPage} de {transactions.total}
              {pageCount > 1 ? ` · página ${safePage} de ${pageCount}` : null}
            </p>

            {pageCount <= 1 ? null : (
              <div className="flex items-center gap-2">
                {safePage > 1 ? (
                  <Button asChild variant="outline" size="sm" className="min-h-11 sm:min-h-0">
                    <Link href={buildHref(filters, limit, safePage - 1)} rel="prev">
                      Anterior
                    </Link>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" className="min-h-11 sm:min-h-0" disabled>
                    Anterior
                  </Button>
                )}

                {safePage < pageCount ? (
                  <Button asChild variant="outline" size="sm" className="min-h-11 sm:min-h-0">
                    <Link href={buildHref(filters, limit, safePage + 1)} rel="next">
                      Seguinte
                    </Link>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" className="min-h-11 sm:min-h-0" disabled>
                    Seguinte
                  </Button>
                )}
              </div>
            )}
          </nav>
        )}
      </div>
    </>
  );
}
