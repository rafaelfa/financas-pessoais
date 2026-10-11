'use client';

import { CircleAlert } from 'lucide-react';

import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';

/**
 * Falha ao carregar as recorrências.
 *
 * O ecrã diz o que falhou e dá uma ação para tentar outra vez, em vez de deixar
 * um espaço em branco. A referência (`digest`) serve para quem tiver de
 * investigar.
 */
export default function RecorrenciasError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  return (
    <EmptyState
      icon={CircleAlert}
      title="Não consegui carregar as recorrências"
      description="A consulta às séries, às contas e às categorias falhou. Tenta outra vez; se continuar a falhar, o problema estará na ligação à base de dados. Nada foi gerado nem alterado — a geração só acontece quando a pedes."
      action={
        <div className="flex flex-col items-center gap-2">
          <Button type="button" onClick={reset}>
            Tentar outra vez
          </Button>
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
