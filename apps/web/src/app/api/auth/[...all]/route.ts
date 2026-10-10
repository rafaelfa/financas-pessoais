import { toNextJsHandler } from 'better-auth/next-js';

import { auth } from '@/lib/auth';

/**
 * Rota de API do `better-auth` (registo, entrada, saída, sessão).
 *
 * O handler tem de ficar em `/api/auth/[...all]`: é o caminho que o cliente
 * usa por omissão.
 */
export const { GET, POST } = toNextJsHandler(auth);
