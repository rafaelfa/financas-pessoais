'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import { usePrivacy } from '@/components/privacy-mode';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';

export interface CashflowPoint {
  readonly mes: string;
  readonly entradas: number;
  readonly saidas: number;
}

const CONFIG = {
  // Cor com significado: mexer na paleta de séries não muda o que é «Entradas».
  entradas: { label: 'Entradas', color: 'var(--chart-income)' },
  saidas: { label: 'Saídas', color: 'var(--chart-expense)' },
};

const euroCompact = new Intl.NumberFormat('pt-PT', {
  notation: 'compact',
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

/**
 * Fluxo dos últimos meses.
 *
 * Valores em euros (não em cêntimos): o eixo não deve mostrar `215000`.
 * O componente é cliente porque o Recharts mede o DOM para se dimensionar.
 */
export function CashflowChart({ data }: { readonly data: readonly CashflowPoint[] }) {
  const { hidden } = usePrivacy();

  return (
    <ChartContainer config={CONFIG} className="h-48 w-full sm:h-64">
      <BarChart data={[...data]} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="mes" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={(value: number) => (hidden ? '•••' : euroCompact.format(value))}
        />
        <ChartTooltip content={<ChartTooltipContent masked={hidden} />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="entradas" fill="var(--color-entradas)" radius={4} />
        <Bar dataKey="saidas" fill="var(--color-saidas)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}
