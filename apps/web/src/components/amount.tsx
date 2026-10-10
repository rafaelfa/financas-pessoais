import { formatCurrency } from '@repo/shared';

import { cn } from '@/lib/utils';

type Tone = 'auto' | 'income' | 'expense' | 'neutral';

/**
 * Montante com sinal e tom.
 *
 * O tom nunca é o único portador de significado: o sinal e o número estão sempre
 * lá, porque cerca de 8% dos homens não distingue vermelho de verde.
 */
export function Amount({
  amountInCents,
  tone = 'auto',
  withSign = false,
  className,
}: {
  readonly amountInCents: number;
  readonly tone?: Tone;
  readonly withSign?: boolean;
  readonly className?: string;
}) {
  const resolved: Exclude<Tone, 'auto'> =
    tone !== 'auto'
      ? tone
      : amountInCents > 0
        ? 'income'
        : amountInCents < 0
          ? 'expense'
          : 'neutral';

  const toneClass =
    resolved === 'income'
      ? 'text-income'
      : resolved === 'expense'
        ? 'text-expense'
        : 'text-foreground';

  return (
    <span className={cn('font-numeric tabular-nums', toneClass, className)}>
      {withSign && amountInCents > 0 ? '+' : ''}
      {formatCurrency(amountInCents, 'EUR')}
    </span>
  );
}
