import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Moldura de um gráfico.
 *
 * Um gráfico sem título não se lê, e um gráfico vazio não se distingue de um
 * gráfico avariado. Esta moldura obriga a ter título, descrição e um estado
 * vazio explícito — os gráficos entrarem na Fase 6, mas a moldura já fica
 * pronta para não se inventar CSS à pressa nessa altura.
 */
export function ChartCard({
  title,
  description,
  children,
  isEmpty = false,
  emptyMessage = 'Ainda não há dados suficientes para desenhar este gráfico.',
  isLoading = false,
  actions,
  className,
}: {
  readonly title: string;
  readonly description?: string;
  readonly children?: React.ReactNode;
  readonly isEmpty?: boolean;
  readonly emptyMessage?: string;
  readonly isLoading?: boolean;
  readonly actions?: React.ReactNode;
  readonly className?: string;
}) {
  return (
    <Card className={cn('gap-3', className)}>
      <CardHeader className="gap-1">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="text-base">{title}</CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
          {actions}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : isEmpty ? (
          <div className="flex h-40 items-center justify-center rounded-lg border border-dashed px-6 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}
