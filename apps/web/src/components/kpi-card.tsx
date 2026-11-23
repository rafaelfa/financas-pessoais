import type { ComponentType } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Indicador de topo do painel.
 *
 * O número é o herói: fica grande, com números tabulares para que a largura não
 * dance quando os valores mudam. O rótulo e a nota ficam discretos por cima e
 * por baixo.
 */
export function KpiCard({
  label,
  children,
  hint,
  icon: Icon,
  prominent = false,
  className,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
  /** Nota curta; aceita marcação porque algumas notas contêm um `<Amount>`. */
  readonly hint?: React.ReactNode;
  readonly icon?: ComponentType<{ className?: string }>;
  /** O valor é o herói do ecrã: um degrau acima dos restantes indicadores. */
  readonly prominent?: boolean;
  readonly className?: string;
}) {
  return (
    <Card className={cn('gap-2', className)}>
      <CardHeader className="pb-0">
        <CardTitle className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <p
          className={cn(
            'font-semibold tracking-tight tabular-nums',
            // O degrau `prominent` é 36 px, mas em duas colunas a 375 px o
            // número não cabe no cartão (175 px de texto para 130 de caixa) e
            // saía cortado. Um degrau abaixo só nessa largura — decidido aqui,
            // não em cada sítio que passa o valor.
            prominent ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-[1.75rem]',
          )}
        >
          {children}
        </p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
