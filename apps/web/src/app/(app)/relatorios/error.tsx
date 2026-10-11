'use client';

import { CircleAlert } from 'lucide-react';

import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';

/**
 * Falha ao carregar o relatório.
 *
 * Um relatório que não carrega não pode deixar um ecrã em branco: diz o que
 * falhou, dá uma ação para tentar outra vez e guarda a referência para quem
 * tiver de investigar.
 */
export default function RelatoriosError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  return (
    <EmptyState
      icon={CircleAlert}
      title="Não consegui carregar o relatório"
      description="A consulta ao período falhou. Tenta outra vez; se continuar a falhar, o problema estará na ligação à base de dados."
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
