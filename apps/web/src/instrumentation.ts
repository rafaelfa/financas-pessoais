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

export const onRequestError = Sentry.captureRequestError;
