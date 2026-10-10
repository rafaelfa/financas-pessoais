import { prisma } from '@repo/db/client';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';

/**
 * Autenticação.
 *
 * Utilizador único por conta, com e-mail e palavra-passe. Não há login social
 * nem multiusuário: a decisão foi tomada com o cliente e está registada no
 * plano (§1, D2). O que existe é uma conta por pessoa, com os dados isolados
 * por `userId` em todas as consultas.
 *
 * O adaptador Prisma é o do próprio `better-auth` (`/adapters/prisma`), pelo que
 * não há uma dependência extra a manter. Os modelos `User`, `Session`, `Account`
 * e `Verification` do esquema seguem os nomes exigidos pela biblioteca.
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    // Oito caracteres é o mínimo que não atrapalha quem usa gestor de palavras-passe.
    minPasswordLength: 8,
    autoSignIn: true,
  },
  session: {
    // Trinta dias: uma aplicação de finanças pessoais abre-se de forma
    // intermitente, e obrigar a entrar todas as semanas só afasta as pessoas.
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  advanced: {
    // Sem cookies de terceiros: a sessão é do próprio domínio da aplicação.
    useSecureCookies: process.env.NODE_ENV === 'production',
  },
});

export type Auth = typeof auth;
