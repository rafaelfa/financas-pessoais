import * as Sentry from '@sentry/nextjs';

import { sentryOptions } from './lib/sentry-options';

/** Inicialização do SDK no runtime Node.js, carregada por `instrumentation.ts`. */
Sentry.init(sentryOptions);
