import * as Sentry from '@sentry/nextjs';

import { sentryOptions } from '@/lib/sentry-options';

/** Inicialização do SDK no browser, carregada antes da hidratação. */
Sentry.init({
  ...sentryOptions,
  integrations: [
    // Session Replay com mascaramento total: nenhum texto, input ou imagem sai
    // do browser em claro. A app trata de finanças pessoais, por isso o
    // mascaramento é explícito em vez de depender dos defaults do SDK.
    Sentry.replayIntegration({
      maskAllText: true,
      maskAllInputs: true,
      blockAllMedia: true,
      // Corpos de pedido nunca são capturados no replay.
      networkCaptureBodies: false,
      networkDetailAllowUrls: [],
    }),
  ],
  // 10% das sessões, e 100% das sessões que acabam em erro.
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
