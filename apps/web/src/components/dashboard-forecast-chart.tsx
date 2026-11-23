'use client';

import { Area, AreaChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from 'recharts';

import { usePrivacy } from '@/components/privacy-mode';
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
  const { hidden } = usePrivacy();

  /*
   * T107: sem pontos não há gráfico — e sem frase nenhuma: o estado vazio tem um
   * dono só, o `dashboard-forecast.tsx`. Aqui é só uma guarda defensiva.
   */
  if (data.length === 0) {
    return null;
  }

  return (
    <ChartContainer config={CONFIG} className="h-48 w-full sm:h-64">
      <AreaChart data={[...data]} accessibilityLayer margin={{ top: 8, right: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="data"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={28}
          interval={10}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={52}
          tickFormatter={(value: number) => (hidden ? '•••' : euroCompact.format(value))}
        />

        <ChartTooltip content={<ChartTooltipContent masked={hidden} />} />

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
          strokeDasharray="6 4"
          fill="var(--color-saldo)"
          fillOpacity={0.12}
        />
      </AreaChart>
    </ChartContainer>
  );
}
