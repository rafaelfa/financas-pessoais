'use client';

import { useMemo } from 'react';
import { Cell, Label, Pie, PieChart } from 'recharts';

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { formatCurrency } from '@repo/shared';

export interface DonutSlice {
  readonly categoria: string;
  readonly valor: number;
}

const SERIES = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
  'var(--chart-8)',
];

/**
 * Despesas por categoria.
 *
 * As cores vêm das séries do tema, que foram escolhidas para serem distinguíveis
 * por quem tem daltonismo. O valor total fica no centro, porque é a informação
 * que se procura primeiro.
 */
export function CategoryDonut({ data }: { readonly data: readonly DonutSlice[] }) {
  const total = useMemo(() => data.reduce((sum, slice) => sum + slice.valor, 0), [data]);

  const config = useMemo(
    () =>
      Object.fromEntries(
        data.map((slice, index) => [
          slice.categoria,
          { label: slice.categoria, color: SERIES[index % SERIES.length] },
        ]),
      ),
    [data],
  );

  return (
    <ChartContainer config={config} className="mx-auto h-64 w-full">
      <PieChart accessibilityLayer>
        <ChartTooltip content={<ChartTooltipContent nameKey="categoria" />} />
        <Pie
          data={[...data]}
          dataKey="valor"
          nameKey="categoria"
          innerRadius={62}
          outerRadius={92}
          strokeWidth={2}
        >
          {data.map((slice, index) => (
            <Cell key={slice.categoria} fill={SERIES[index % SERIES.length]} />
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
                    className="fill-foreground text-lg font-semibold"
                  >
                    {formatCurrency(Math.round(total * 100), 'EUR')}
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
