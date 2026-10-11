import { PieChart } from 'lucide-react';

import { Amount } from '@/components/amount';
import { CategoryDonut, type DonutSlice } from '@/components/category-donut';
import { ChartCard } from '@/components/chart-card';
import { EmptyState } from '@/components/empty-state';
import { formatPercentage } from '@/components/report-basis';
import type { ReportView } from '@/server/reports';

/**
 * Despesas por categoria.
 *
 * Duas vistas do mesmo mês, porque servem para coisas diferentes: o donut mostra
 * a **forma** — onde é que o dinheiro se concentra — e a lista dá os **números
 * exatos**, com o peso e o número de movimentos de cada categoria.
 *
 * O gráfico junta as categorias mais pequenas numa fatia “Outras” para o donut
 * continuar legível, mas o valor total do centro é o do período inteiro: a fatia
 * agregada soma exatamente o que ficou de fora. A lista não esconde nada.
 */

/** Quantas categorias aparecem individualmente no donut. */
const TOP_SLICES = 8;

/** Categorias internas, que o motor exclui dos totais por definição. */
const INTERNAL_CATEGORY_NOTE =
  'As categorias internas — Transferência, Fatura de cartão, Ajuste de saldo e Investimento — aparecem no extrato mas nunca contam como despesa nem como ganho. É por isso que não estão nesta lista.';

export function ReportCategoryBreakdown({ report }: { readonly report: ReportView }) {
  const expenses = report.byCategory
    .filter((category) => category.kind === 'expense' && category.amountInCents !== 0)
    .sort((left, right) => right.amountInCents - left.amountInCents);

  if (expenses.length === 0) {
    return (
      <ChartCard title="Despesas por categoria" description={describeBasis(report)}>
        <EmptyState
          icon={PieChart}
          title="Sem despesas neste período"
          description="Neste período e neste regime não há despesas classificadas. Muda o período ou o regime para veres outro mês."
        />
      </ChartCard>
    );
  }

  const slices = buildSlices(expenses);

  return (
    <section aria-label="Despesas por categoria" className="space-y-4">
      <ChartCard
        title="Despesas por categoria"
        description={`${describeBasis(report)} O gráfico mostra as maiores; a lista abaixo tem todas.`}
      >
        <CategoryDonut data={slices} />
      </ChartCard>

      <ul className="divide-y rounded-xl border">
        {expenses.map((category) => (
          <li
            key={category.categoryId}
            className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2 text-sm"
          >
            <span className="min-w-0 flex-1 truncate font-medium">{category.categoryName}</span>

            <span className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {category.transactionCount === 1
                  ? '1 movimento'
                  : `${category.transactionCount} movimentos`}
              </span>
              <span className="w-14 text-right text-xs text-muted-foreground tabular-nums">
                {formatPercentage(category.sharePct)}
              </span>
              <Amount amountInCents={category.amountInCents} tone="neutral" />
            </span>
          </li>
        ))}
      </ul>

      <p className="text-xs text-muted-foreground">{INTERNAL_CATEGORY_NOTE}</p>
    </section>
  );
}

/** Descrição do regime, para o cabeçalho do gráfico não enganar. */
function describeBasis(report: ReportView): string {
  return `Peso de cada categoria nas saídas de ${report.label}, em ${
    report.basis === 'accrual' ? 'competência' : 'caixa'
  }.`;
}

/**
 * Fatias do donut: as maiores individualmente e o resto agregado.
 *
 * A agregação é o que mantém o gráfico legível num mês com muitas categorias —
 * desde que o total do centro continue a ser o do período, que é o que esta
 * função garante.
 */
function buildSlices(
  expenses: readonly { categoryName: string; amountInCents: number }[],
): DonutSlice[] {
  const top = expenses.slice(0, TOP_SLICES);
  const rest = expenses.slice(TOP_SLICES);

  const slices: DonutSlice[] = top.map((category) => ({
    categoria: category.categoryName,
    valor: category.amountInCents / 100,
  }));

  if (rest.length > 0) {
    slices.push({
      categoria: `Outras (${rest.length})`,
      valor: rest.reduce((total, category) => total + category.amountInCents, 0) / 100,
    });
  }

  return slices;
}
