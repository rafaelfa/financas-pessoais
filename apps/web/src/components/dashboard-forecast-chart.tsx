'use client';

import { Area, AreaChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from 'recharts';

import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

/**
 * Previsão de saldo, dia a dia.
 *
 * Os valores passam em **euros** para o Recharts, como no gráfico de fluxo: o
 * eixo nunca deve mostrar cêntimos. O zero tem uma linha própria porque é o que
 * dá sentido ao gráfico — acima é saldo, abaixo é descoberto — e nenhuma
 * informação depende só da cor: o zero está escrito, a área tem uma forma
 * legível e o resumo em texto está ao lado.
 */

/** Um ponto da previsão, já em euros. */
export interface ForecastPoint {
  /** Rótulo curto do dia, para o eixo (ex.: `28 out.`). */
  readonly data: string;
  /** Saldo previsto nesse dia, em euros. */
  readonly saldo: number;
}

const CONFIG = {
  saldo: { label: 'Saldo previsto', color: 'var(--chart-forecast)' },
};

const euroCompact = new Intl.NumberFormat('pt-PT', {
  notation: 'compact',
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

export function DashboardForecastChart({ data }: { readonly data: readonly ForecastPoint[] }) {
  return (
    <ChartContainer config={CONFIG} className="h-64 w-full">
      <AreaChart data={[...data]} accessibilityLayer margin={{ top: 8, right: 8 }}>
        <defs>
          <linearGradient id="previsao-saldo" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-saldo)" stopOpacity={0.6} />
            <stop offset="95%" stopColor="var(--color-saldo)" stopOpacity={0.05} />
          </linearGradient>
        </defs>

        <CartesianGrid vertical={false} />
        <XAxis dataKey="data" tickLine={false} axisLine={false} tickMargin={8} minTickGap={28} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={72}
          tickFormatter={(value: number) => euroCompact.format(value)}
        />

        <ChartTooltip content={<ChartTooltipContent />} />

        <ReferenceLine
          y={0}
          stroke="var(--chart-axis)"
          strokeDasharray="4 4"
          label={{
            value: 'saldo zero',
            position: 'insideTopRight',
            fontSize: 11,
            fill: 'var(--chart-axis)',
          }}
        />

        <Area
          dataKey="saldo"
          type="monotone"
          stroke="var(--color-saldo)"
          strokeWidth={2}
          fill="url(#previsao-saldo)"
        />
      </AreaChart>
    </ChartContainer>
  );
}
