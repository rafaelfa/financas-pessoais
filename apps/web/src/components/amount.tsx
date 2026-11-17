'use client';

import { formatCurrency } from '@repo/shared';

import { usePrivacy } from '@/components/privacy-mode';
import { cn } from '@/lib/utils';

type Tone = 'auto' | 'income' | 'expense' | 'neutral';

/** Texto do montante, com o sinal opcional. É a forma que a máscara tem de igualar. */
function formatAmountText(amountInCents: number, withSign = false): string {
  const sign = withSign && amountInCents > 0 ? '+' : '';

  return `${sign}${formatCurrency(amountInCents, 'EUR')}`;
}

/** Mesmo número de caracteres que o texto, para o layout não saltar. */
export function maskAmount(text: string): string {
  return '•'.repeat(text.length);
}

/**
 * Montante com sinal e tom.
 *
 * O tom nunca é o único portador de significado: o sinal e o número estão sempre
 * lá, porque cerca de 8% dos homens não distingue vermelho de verde.
 *
 * Com o modo privacidade ativo o texto é substituído por `••••` e o leitor de
 * ecrã ouve «montante oculto» — o valor não fica no DOM.
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
  const { hidden } = usePrivacy();

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

  const text = formatAmountText(amountInCents, withSign);

  return (
    <span
      className={cn('font-numeric tabular-nums', toneClass, className)}
      data-amount={hidden ? 'oculto' : 'visivel'}
    >
      {hidden ? (
        <>
          <span aria-hidden="true">{maskAmount(text)}</span>
          <span className="sr-only">montante oculto</span>
        </>
      ) : (
        text
      )}
    </span>
  );
}
