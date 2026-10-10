'use client';

import { usePathname, useRouter } from 'next/navigation';

import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '@/lib/transaction-pagination';

import {
  FilterChips,
  FilterSelect,
  PeriodFilter,
  SearchFilter,
  type DateRange,
  type FilterChip,
  type PeriodPreset,
  presetRange,
} from '@/components/money-filters';
import {
  TRANSACTION_KIND_LABELS,
  TRANSACTION_STATUS_LABELS,
} from '@/components/transaction-kind-badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AccountView } from '@/server/accounts';
import type { CategoryView } from '@/server/categories';

/**
 * Barra de filtros do extrato.
 *
 * O estado dos filtros vive no **URL**: assim um extrato filtrado pode ser
 * guardado nos favoritos, partilhado e recarregado sem se perder, e o servidor
 * consulta a base de dados com os mesmos critérios que o utilizador vê.
 *
 * Qualquer alteração de filtro volta à primeira página — mudar de filtro e ficar
 * na página 7 é uma das formas clássicas de mostrar "sem resultados" a quem tem
 * dados.
 *
 * As constantes de paginação vêm de `@/lib/transaction-pagination`: se
 * estivessem definidas aqui, um Server Component que as importasse receberia
 * uma *client reference* em vez do valor e rebentaria em produção.
 */

/** Alvo de toque: 44 px em telemóvel, denso a partir de `sm`. */
const TOUCH = 'min-h-11 sm:min-h-8';

export interface TransactionFilterValues {
  readonly from?: string;
  readonly to?: string;
  readonly accountId?: string;
  readonly categoryId?: string;
  readonly kind?: string;
  readonly status?: string;
  readonly search?: string;
  readonly limit: number;
}

export function TransactionFilters({
  values,
  today,
  accounts,
  categories,
}: {
  readonly values: TransactionFilterValues;
  /** Data de hoje em Portugal, como `YYYY-MM-DD`. */
  readonly today: string;
  readonly accounts: readonly AccountView[];
  readonly categories: readonly CategoryView[];
}) {
  const router = useRouter();
  const pathname = usePathname();

  /** Reconstrói a query inteira: os filtros que não mudam mantêm-se. */
  function push(changes: Partial<Record<keyof TransactionFilterValues, string | undefined>>) {
    const next: Record<string, string | undefined> = {
      from: values.from,
      to: values.to,
      accountId: values.accountId,
      categoryId: values.categoryId,
      kind: values.kind,
      status: values.status,
      search: values.search,
      limit: values.limit === DEFAULT_PAGE_SIZE ? undefined : String(values.limit),
      ...changes,
    };

    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(next)) {
      if (value !== undefined && value !== '') {
        params.set(key, value);
      }
    }

    const query = params.toString();
    router.push(query === '' ? pathname : `${pathname}?${query}`);
  }

  function applyPreset(preset: PeriodPreset) {
    const range = presetRange(preset, today);
    push({ from: range.from, to: range.to });
  }

  function applyRange(range: DateRange) {
    push({ from: range.from, to: range.to });
  }

  const accountName = (id: string): string =>
    accounts.find((account) => account.id === id)?.name ?? id;

  const categoryName = (id: string): string =>
    categories.find((category) => category.id === id)?.name ?? id;

  const chips: FilterChip[] = [
    ...(values.from === undefined && values.to === undefined
      ? []
      : [
          {
            key: 'periodo',
            label: formatRange(values.from, values.to),
            onRemove: () => push({ from: undefined, to: undefined }),
          },
        ]),
    ...(values.accountId === undefined
      ? []
      : [
          {
            key: 'conta',
            label: `Conta: ${accountName(values.accountId)}`,
            onRemove: () => push({ accountId: undefined }),
          },
        ]),
    ...(values.categoryId === undefined
      ? []
      : [
          {
            key: 'categoria',
            label: `Categoria: ${categoryName(values.categoryId)}`,
            onRemove: () => push({ categoryId: undefined }),
          },
        ]),
    ...(values.kind === undefined
      ? []
      : [
          {
            key: 'tipo',
            label: `Tipo: ${TRANSACTION_KIND_LABELS[values.kind] ?? values.kind}`,
            onRemove: () => push({ kind: undefined }),
          },
        ]),
    ...(values.status === undefined
      ? []
      : [
          {
            key: 'estado',
            label: `Estado: ${TRANSACTION_STATUS_LABELS[values.status] ?? values.status}`,
            onRemove: () => push({ status: undefined }),
          },
        ]),
    ...(values.search === undefined
      ? []
      : [
          {
            key: 'procura',
            label: `Descrição: “${values.search}”`,
            onRemove: () => push({ search: undefined }),
          },
        ]),
  ];

  return (
    <section aria-label="Filtros do extrato" className="space-y-4 rounded-xl border p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <PeriodFilter
          from={values.from}
          to={values.to}
          today={today}
          onPresetChange={applyPreset}
          onRangeChange={applyRange}
        />

        <FilterSelect
          id="filtro-conta"
          label="Conta"
          value={values.accountId}
          options={accounts.map((account) => ({ value: account.id, label: account.name }))}
          onChange={(value) => push({ accountId: value })}
        />

        <FilterSelect
          id="filtro-categoria"
          label="Categoria"
          value={values.categoryId}
          options={buildFilterCategoryOptions(categories)}
          onChange={(value) => push({ categoryId: value })}
        />

        <FilterSelect
          id="filtro-tipo"
          label="Tipo"
          value={values.kind}
          options={Object.entries(TRANSACTION_KIND_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
          onChange={(value) => push({ kind: value })}
        />

        <FilterSelect
          id="filtro-estado"
          label="Estado"
          value={values.status}
          options={Object.entries(TRANSACTION_STATUS_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
          onChange={(value) => push({ status: value })}
        />

        <div className="sm:col-span-2">
          <SearchFilter
            id="filtro-procura"
            label="Procurar na descrição"
            defaultValue={values.search}
            placeholder="ex.: continente"
            onSubmit={(value) => push({ search: value })}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="filtro-tamanho">Por página</Label>
          <Select value={String(values.limit)} onValueChange={(next) => push({ limit: next })}>
            <SelectTrigger id="filtro-tamanho" className={`w-full ${TOUCH}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <FilterChips chips={chips} onClear={() => router.push(pathname)} />
    </section>
  );
}

/** Todas as categorias, com as subcategorias indentadas sob a mãe. */
function buildFilterCategoryOptions(
  categories: readonly CategoryView[],
): { value: string; label: string }[] {
  const roots = categories.filter(
    (category) =>
      category.parentId === null ||
      !categories.some((candidate) => candidate.id === category.parentId),
  );

  return roots.flatMap((root) => [
    { value: root.id, label: root.name },
    ...categories
      .filter((category) => category.parentId === root.id)
      .map((child) => ({ value: child.id, label: `${root.name} › ${child.name}` })),
  ]);
}

/** Intervalo legível, sem depender do fuso do browser. */
function formatRange(from: string | undefined, to: string | undefined): string {
  const formatter = new Intl.DateTimeFormat('pt-PT', {
    timeZone: 'UTC',
    dateStyle: 'short',
  });

  if (from !== undefined && to !== undefined) {
    return `${formatter.format(new Date(`${from}T00:00:00Z`))} — ${formatter.format(new Date(`${to}T00:00:00Z`))}`;
  }

  if (from !== undefined) {
    return `Desde ${formatter.format(new Date(`${from}T00:00:00Z`))}`;
  }

  return to === undefined ? 'Período' : `Até ${formatter.format(new Date(`${to}T00:00:00Z`))}`;
}
