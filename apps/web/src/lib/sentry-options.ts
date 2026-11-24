import type { BrowserOptions } from '@sentry/nextjs';

/**
 * Opções partilhadas pelas três inicializações do Sentry (browser, node, edge),
 * para que a política de dados viva num só sítio.
 *
 * A app trata de finanças pessoais, por isso a recolha é restrita: sem IP, sem
 * cookies, sem cabeçalhos, sem corpos de pedido, sem parâmetros de URL e sem os
 * dados das consultas à base de dados. Fica só o que serve para depurar: erro,
 * stack trace, release e ambiente.
 *
 * O DSN vem de `NEXT_PUBLIC_SENTRY_DSN`; sem ele o SDK fica desligado em vez de
 * rebentar o build.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

export const sentryOptions = {
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NODE_ENV,
  // Todas as traces em desenvolvimento, 10% em produção para caber no plano.
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
    databaseQueryData: false,
  },
} satisfies BrowserOptions;
