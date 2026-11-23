'use client';

import { useMemo } from 'react';
import { Cell, Label, Pie, PieChart } from 'recharts';

import { categoryColourMap } from '@/lib/category-colour';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { maskAmount } from '@/components/amount';
import { usePrivacy } from '@/components/privacy-mode';
import { formatCurrency } from '@repo/shared';

export interface DonutSlice {
  readonly categoria: string;
  readonly valor: number;
}

/**
 * Despesas por categoria.
 *
 * As cores vêm das séries do tema, que foram escolhidas para serem distinguíveis
 * por quem tem daltonismo. O valor total fica no centro, porque é a informação
 * que se procura primeiro.
 */
export function CategoryDonut({
  data,
  categoryNames,
  colours,
}: {
  readonly data: readonly DonutSlice[];
  /** Nomes de todas as categorias não arquivadas, na ordem canónica: dá a base da cor. */
  readonly categoryNames: readonly string[];
  /**
   * Mapa do ecrã, quando o donut é só uma parte do que está pintado. A lista de
   * Relatórios tem nomes que as fatias não mostram; sem este mapa, a mesma
   * categoria podia sair com duas cores no mesmo ecrã.
   */
  readonly colours?: Readonly<Record<string, string>>;
}) {
  const total = useMemo(() => data.reduce((sum, slice) => sum + slice.valor, 0), [data]);
  const { hidden } = usePrivacy();
  const totalText = formatCurrency(Math.round(total * 100), 'EUR');

  const palette = useMemo(
    () =>
      colours ??
      categoryColourMap(
        data.map((slice) => slice.categoria),
        categoryNames,
      ),
    [colours, data, categoryNames],
  );

  const config = useMemo(
    () =>
      Object.fromEntries(
        data.map((slice) => [
          slice.categoria,
          { label: slice.categoria, color: palette[slice.categoria] },
        ]),
      ),
    [data, palette],
  );

  return (
    <ChartContainer config={config} className="mx-auto h-48 w-full sm:h-64">
      <PieChart accessibilityLayer>
        <ChartTooltip content={<ChartTooltipContent nameKey="categoria" masked={hidden} />} />
        <Pie
          data={[...data]}
          dataKey="valor"
          nameKey="categoria"
          innerRadius={62}
          outerRadius={92}
          strokeWidth={2}
        >
          {data.map((slice) => (
            <Cell key={slice.categoria} fill={palette[slice.categoria]} />
          ))}
          <Label
            content={({ viewBox }) => {
              if (viewBox === undefined || !('cx' in viewBox) || !('cy' in viewBox)) {
                return null;
              }

              return (
                <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                  <tspan
                    x={viewBox.cx}
                    y={viewBox.cy}
                    data-amount={hidden ? 'oculto' : 'visivel'}
                    aria-hidden={hidden}
                    className="fill-foreground text-lg font-semibold"
                  >
                    {hidden ? maskAmount(totalText) : totalText}
                  </tspan>
                  <tspan
                    x={viewBox.cx}
                    y={(viewBox.cy ?? 0) + 20}
                    className="fill-muted-foreground text-xs"
                  >
                    total do mês
                  </tspan>
                </text>
              );
            }}
          />
        </Pie>
        <ChartLegend content={<ChartLegendContent nameKey="categoria" />} />
      </PieChart>
    </ChartContainer>
  );
}
