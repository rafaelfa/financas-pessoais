'use client';

import { createAuthClient } from 'better-auth/react';

/**
 * Cliente de autenticação para os componentes de interface.
 *
 * Usa o mesmo `baseURL` da aplicação, pelo que em desenvolvimento aponta para
 * `http://localhost:3000` e em produção para o domínio do Vercel — sem nada
 * escrito à mão.
 */
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
