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
  className,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
  readonly hint?: string;
  readonly icon?: ComponentType<{ className?: string }>;
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
        <p className="text-2xl font-semibold tracking-tight tabular-nums sm:text-[1.75rem]">
          {children}
        </p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
