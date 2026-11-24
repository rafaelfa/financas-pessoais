'use client';

import * as Sentry from '@sentry/nextjs';
import { CircleAlert } from 'lucide-react';
import { useEffect } from 'react';

import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';

/** Falha ao carregar o orçamento. */
export default function OrcamentoError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  useEffect(() => {
    // O servidor já reportou este erro (`onRequestError` do instrumentation.ts);
    // o cliente só reporta o que apanhou, e um erro de cliente não traz `digest`.
    if (error.digest !== undefined) {
      return;
    }

    Sentry.captureException(error);
  }, [error]);

  return (
    <EmptyState
      icon={CircleAlert}
      title="Não consegui carregar o orçamento"
      description="A consulta ao orçamento e aos limites falhou. Tenta outra vez; se continuar a falhar, o problema estará na ligação à base de dados."
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
