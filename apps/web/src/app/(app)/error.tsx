'use client';

import { CircleAlert, LayoutDashboard, RefreshCw } from 'lucide-react';
import Link from 'next/link';

import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';

/**
 * Rede de segurança da secção da aplicação.
 *
 * Cada segmento com o seu próprio `error.tsx` apanha os seus erros; este apanha
 * o painel e qualquer ecrã que não tenha um. Oferece as duas saídas que fazem
 * sentido: **tentar outra vez sem recarregar** (`reset` volta a renderizar o
 * segmento) e **voltar ao painel**, para quando o ecrã que falhou não é o que o
 * utilizador quer.
 *
 * Diz também o que *não* aconteceu: nenhum ecrã escreve sem uma ação explícita,
 * por isso uma consulta falhada não deixa dados a meio.
 */
export default function AppError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  return (
    <EmptyState
      icon={CircleAlert}
      title="Algo falhou ao carregar este ecrã"
      description="A consulta aos teus dados não chegou ao fim. Nada foi alterado — a aplicação só escreve quando carregas num botão. Tenta outra vez e, se continuar a falhar, volta ao painel."
      action={
        <div className="flex flex-col items-center gap-2">
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" onClick={reset} className="min-h-11 sm:min-h-8">
              <RefreshCw className="size-3.5" aria-hidden />
              Tentar outra vez
            </Button>
            <Button asChild variant="outline" className="min-h-11 sm:min-h-8">
              <Link href="/">
                <LayoutDashboard className="size-3.5" aria-hidden />
                Ir para o painel
              </Link>
            </Button>
          </div>

          {error.digest === undefined ? null : (
            <span className="font-numeric text-xs text-muted-foreground">
              Referência: {error.digest}
            </span>
          )}
        </div>
      }
    />
  );
}
