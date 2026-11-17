import type { AccountBalancePoint } from '@repo/shared';

/**
 * Sparkline do saldo dos últimos 30 dias.
 *
 * Um SVG de 30 pontos, e não um gráfico: sem eixo, sem tooltip e sem leitor
 * associado. O que se quer ler de relance é a **forma** — a subida ou a descida
 * —, e um `recharts` dentro de cada cartão custaria o runtime dos gráficos por
 * cartão para desenhar uma polilinha.
 *
 * Nunca mostra números: os pontos vêm em cêntimos e o `aria-label` não os repete.
 * O texto para leitores de ecrã descreve a tendência pelo que ela é, não pelo
 * valor — e sobrevive à máscara de privacidade, que é do texto e não da forma.
 */

/** Largura do `viewBox`; a altura final vem do CSS. */
const VIEWBOX_WIDTH = 100;
const VIEWBOX_HEIGHT = 32;

export function AccountSparkline({
  series,
  className,
}: {
  readonly series: readonly AccountBalancePoint[];
  readonly className?: string;
}) {
  const values = series.map((point) => point.balanceInCents);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const step = values.length > 1 ? VIEWBOX_WIDTH / (values.length - 1) : 0;

  const points = values
    .map((value, index) => {
      const x = index * step;
      // Sem amplitude (conta parada), a reta fica ao meio: a caixa não desaparece
      // e a grelha não salta.
      const y =
        span === 0 ? VIEWBOX_HEIGHT / 2 : VIEWBOX_HEIGHT - ((value - min) / span) * VIEWBOX_HEIGHT;

      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        preserveAspectRatio="none"
        aria-hidden
        data-sparkline
        data-points={values.length}
        className="h-8 w-full text-chart-balance"
      >
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span className="sr-only">Tendência do saldo nos últimos 30 dias.</span>
    </div>
  );
}
