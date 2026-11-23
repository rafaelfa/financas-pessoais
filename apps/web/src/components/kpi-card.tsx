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
    <Card className={cn('@container gap-2', className)}>
      <CardHeader className="px-2 pb-0 @min-[16rem]:px-4">
        <CardTitle className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 px-2 @min-[16rem]:px-4">
        <p
          className={cn(
            'font-semibold tracking-tight tabular-nums',
            /*
             * O tamanho segue a largura do **cartão** (`@container`), não a do
             * ecrã: em duas colunas o cartão encolhe até 164 px e o dinheiro
             * não pode ser cortado nem abreviado. O mais longo que a app mostra
             * («12 345,67 €») mede 137,7 px a 24 px e 206,6 px a 36 px, por isso
             * os degraus só sobem quando há largura para eles, com o padding à
             * conta: 12,5 rem (200 px) para 28 px e para 30 px — os dois sobem
             * juntos, para o destaque nunca ficar menor que os irmãos — e 15 rem
             * (240) para 36 px; o `px-4` só volta a 16 rem (256), onde
             * 206,6 + 32 + 2 + 4 = 244,6 já cabe. Abaixo de 12,5 rem o destaque
             * iguala os outros — o número é o mesmo, o que muda é a caixa.
             */
            prominent
              ? 'text-2xl @min-[12.5rem]:text-3xl @min-[15rem]:text-4xl'
              : 'text-2xl @min-[12.5rem]:text-[1.75rem]',
          )}
        >
          {children}
        </p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
