import type { ComponentType } from 'react';

import { cn } from '@/lib/utils';

/**
 * Estado vazio.
 *
 * Um ecrã sem dados é o primeiro que o utilizador vê. Explica **o que vai
 * aparecer ali** e dá o próximo passo, em vez de mostrar um espaço em branco.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  readonly icon?: ComponentType<{ className?: string }>;
  readonly title: string;
  readonly description?: string;
  readonly action?: React.ReactNode;
  readonly className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center',
        className,
      )}
    >
      {Icon ? (
        <span
          aria-hidden
          className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground"
        >
          <Icon className="size-5" />
        </span>
      ) : null}
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {description ? (
          <p className="mx-auto max-w-md text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
