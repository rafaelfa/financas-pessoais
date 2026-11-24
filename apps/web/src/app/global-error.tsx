'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

/**
 * Substitui o layout raiz quando um erro escapa a todos os error boundaries,
 * por isso carrega os seus próprios `<html>`/`<body>` e não herda `globals.css`:
 * os estilos aqui são deliberadamente inline e neutros.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-PT">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          background: '#ffffff',
          color: '#18181b',
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <main style={{ maxWidth: '26rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, margin: '0 0 0.75rem' }}>
            Algo correu mal
          </h1>
          <p style={{ margin: '0 0 1.5rem', lineHeight: 1.6, color: '#3f3f46' }}>
            O erro foi registado. Recarrega a página para continuar a usar a app.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              font: 'inherit',
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: '1px solid #18181b',
              background: '#18181b',
              color: '#ffffff',
              cursor: 'pointer',
            }}
          >
            Recarregar
          </button>
          {error.digest ? (
            <p style={{ margin: '1.5rem 0 0', fontSize: '0.875rem', color: '#71717a' }}>
              Referência: {error.digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
