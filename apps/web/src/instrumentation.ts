import * as Sentry from '@sentry/nextjs';

/**
 * Next.js instrumentation hook. Loads the server or edge Sentry config for the
 * runtime that is actually booting, and forwards Server Component, middleware
 * and proxy errors that Next.js itself catches (`onRequestError`).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

/**
 * O `digest` que o Next põe no erro (é o número que o ecrã mostra como
 * «Referência») não vai no evento que o SDK envia; sem isto o número que o
 * utilizador dita não existe no Sentry. Aceita `unknown` porque é o que o hook
 * do Next entrega.
 */
function readDigest(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('digest' in error)) {
    return undefined;
  }

  const digest = (error as { digest?: unknown }).digest;

  return typeof digest === 'string' ? digest : undefined;
}

/**
 * Reporte do que Next.js apanha (Server Components, middleware, proxy). Põe o
 * `digest` como etiqueta e delega no `captureRequestError` do SDK, cujo
 * `withScope` interno herda a etiqueta. Sem `digest`, delega diretamente.
 */
export function onRequestError(
  error: unknown,
  request: Parameters<typeof Sentry.captureRequestError>[1],
  errorContext: Parameters<typeof Sentry.captureRequestError>[2],
): void {
  const digest = readDigest(error);

  if (digest === undefined) {
    Sentry.captureRequestError(error, request, errorContext);
    return;
  }

  Sentry.withScope((scope) => {
    scope.setTag('nextjs.digest', digest);
    Sentry.captureRequestError(error, request, errorContext);
  });
}
