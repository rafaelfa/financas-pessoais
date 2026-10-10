import { prisma } from '@repo/db/client';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';

import { provisionUser } from '@/server/provision';

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
    // Sem entrada automática: quem se registou vai para o ecrã de entrada com a
    // confirmação. Entrar é um passo explícito, e assim vê que a conta ficou criada.
    autoSignIn: false,
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
  databaseHooks: {
    user: {
      create: {
        /**
         * Quem se regista tem de encontrar uma aplicação utilizável: cria-se a
         * carteira principal e o catálogo de categorias de Portugal. Sem isto, o
         * primeiro lançamento pediria uma categoria que não existe.
         */
        after: async (user) => {
          await provisionUser(user.id);
        },
      },
    },
  },
});

export type Auth = typeof auth;
