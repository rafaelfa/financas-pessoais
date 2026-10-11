import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

import { Amount } from '@/components/amount';
import { formatPercentage } from '@/components/report-basis';
import { Badge } from '@/components/ui/badge';
import type { ReportComparison } from '@/server/reports';

/**
 * Comparação com o mês anterior.
 *
 * A variação percentual pode não existir: se o mês anterior tinha zero naquela
 * linha, dividir por zero daria infinito — e o ecrã não mostra infinito nem um
 * “0%” mentiroso. Nesses casos escreve-se **sem base de comparação**, que é a
 * verdade: não há com que comparar.
 */
export function ReportComparison({ comparison }: { readonly comparison: ReportComparison }) {
  const { current, previous, deltas, topGrowth, topDrop } = comparison;

  return (
    <section aria-label="Comparação com o mês anterior" className="space-y-4">
      <div className="space-y-1">
        <h2 className="font-heading text-lg font-medium">Comparação com o mês anterior</h2>
        <p className="text-sm text-muted-foreground">
          {current.label} face a {previous.label}, no mesmo regime.
        </p>
      </div>

      {deltas.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Não há linhas para comparar entre estes dois períodos.
        </p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {deltas.map((delta) => (
            <li
              key={delta.label}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2 text-sm"
            >
              <span className="min-w-0 flex-1 font-medium">{delta.label}</span>

              <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="text-xs text-muted-foreground">
                  {previous.label}: <Amount amountInCents={delta.previousInCents} tone="neutral" />
                </span>
                <span className="text-xs text-muted-foreground">
                  {current.label}: <Amount amountInCents={delta.currentInCents} tone="neutral" />
                </span>
                <span className="flex items-center gap-2">
                  <Amount amountInCents={delta.changeInCents} withSign tone="neutral" />
                  <ChangeBadge changePct={delta.changePct} />
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <CategoryMovement
          title="Categorias que mais subiram"
          icon={ArrowUpRight}
          movements={topGrowth}
          emptyMessage="Nenhuma categoria subiu face ao mês anterior."
        />
        <CategoryMovement
          title="Categorias que mais desceram"
          icon={ArrowDownRight}
          movements={topDrop}
          emptyMessage="Nenhuma categoria desceu face ao mês anterior."
        />
      </div>
    </section>
  );
}

/** Variação percentual, ou a ausência dela por escrito. */
function ChangeBadge({ changePct }: { readonly changePct: number | null }) {
  if (changePct === null) {
    return (
      <Badge variant="outline" className="font-normal text-muted-foreground">
        <Minus className="size-3" aria-hidden />
        sem base de comparação
      </Badge>
    );
  }

  if (changePct === 0) {
    return (
      <Badge variant="outline" className="font-normal text-muted-foreground">
        <Minus className="size-3" aria-hidden />
        sem alteração
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="font-normal tabular-nums">
      {changePct > 0 ? (
        <ArrowUpRight className="size-3" aria-hidden />
      ) : (
        <ArrowDownRight className="size-3" aria-hidden />
      )}
      {formatPercentage(changePct)}
    </Badge>
  );
}

/** Quantas categorias se destacam em cada cartão. */
const MAX_HIGHLIGHTS = 3;

function CategoryMovement({
  title,
  icon: Icon,
  movements,
  emptyMessage,
}: {
  readonly title: string;
  readonly icon: typeof ArrowUpRight;
  /** Categorias destacadas, já ordenadas pelo servidor. */
  readonly movements: readonly {
    readonly categoryName: string;
    readonly changeInCents: number;
    readonly changePct: number | null;
  }[];
  readonly emptyMessage: string;
}) {
  const highlights = movements.slice(0, MAX_HIGHLIGHTS);

  return (
    <div className="space-y-2 rounded-xl border p-4">
      <p className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        <Icon className="size-3.5" aria-hidden />
        {title}
      </p>

      {highlights.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <ul className="space-y-2">
          {highlights.map((movement) => (
            <li
              key={movement.categoryName}
              className="flex flex-wrap items-center justify-between gap-2"
            >
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {movement.categoryName}
              </span>
              <span className="flex items-center gap-2">
                <Amount amountInCents={movement.changeInCents} withSign tone="neutral" />
                <ChangeBadge changePct={movement.changePct} />
              </span>
            </li>
          ))}
        </ul>
      )}

      {movements.length > highlights.length ? (
        <p className="text-xs text-muted-foreground">
          E mais {movements.length - highlights.length} categoria(s) com variação.
        </p>
      ) : null}
    </div>
  );
}
