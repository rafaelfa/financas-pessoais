import { CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Estado de consumo de um orçamento, em palavras.
 *
 * O motor devolve `safe` abaixo de 70%, `warning` entre 70% e 100% e `exceeded`
 * a partir de 100% (`BUDGET_WARNING_PCT` e `BUDGET_EXCEEDED_PCT`). Nenhum destes
 * estados é comunicado só por cor: há sempre o rótulo escrito e o número.
 */

/** Nome legível de cada estado. */
export const BUDGET_STATE_LABELS: Readonly<Record<string, string>> = {
  safe: 'Tranquilo',
  warning: 'Atenção',
  exceeded: 'Excedido',
};

/** Uma frase que explica o estado, para quem chega de novo ao ecrã. */
export const BUDGET_STATE_DESCRIPTIONS: Readonly<Record<string, string>> = {
  safe: 'Abaixo dos 70% do limite.',
  warning: 'Já passaste dos 70% do limite.',
  exceeded: 'Passaste o limite definido.',
};

export function BudgetStateBadge({ state }: { readonly state: string }) {
  const label = BUDGET_STATE_LABELS[state] ?? state;

  if (state === 'exceeded') {
    return (
      <Badge variant="destructive" className="font-normal">
        <CircleAlert className="size-3" aria-hidden />
        {label}
      </Badge>
    );
  }

  if (state === 'warning') {
    return (
      <Badge variant="outline" className="font-normal text-warning-foreground">
        <TriangleAlert className="size-3" aria-hidden />
        {label}
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="font-normal">
      <CircleCheck className="size-3" aria-hidden />
      {label}
    </Badge>
  );
}

/** Cor da barra, por estado. */
function barTone(state: string): string {
  if (state === 'exceeded') {
    return 'bg-destructive';
  }

  return state === 'warning' ? 'bg-warning' : 'bg-primary';
}

/**
 * Barra de consumo com o limiar de alerta marcado.
 *
 * A barra nunca passa dos 100%: o que excede o limite aparece na frase e na
 * sobra (que fica negativa), não a transbordar para fora do cartão.
 */
export function BudgetMeter({
  usedPct,
  state,
  thresholdPct,
  label,
  className,
}: {
  readonly usedPct: number;
  readonly state: string;
  readonly thresholdPct?: number | null;
  /** Nome acessível: “Orçamento de Alimentação”. */
  readonly label: string;
  readonly className?: string;
}) {
  const clamped = Math.max(0, Math.min(usedPct, 100));

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${label}: ${usedPct}% consumido, ${BUDGET_STATE_LABELS[state] ?? state}`}
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-muted', className)}
    >
      <div className={cn('h-full rounded-full', barTone(state))} style={{ width: `${clamped}%` }} />

      {thresholdPct === null || thresholdPct === undefined ? null : (
        <span
          aria-hidden
          className="absolute inset-y-0 w-px bg-foreground/50"
          style={{ left: `${Math.max(0, Math.min(thresholdPct, 100))}%` }}
        />
      )}
    </div>
  );
}
