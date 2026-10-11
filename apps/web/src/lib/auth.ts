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
  /**
   * Limite de tentativas (F8.2).
   *
   * -----------------------------------------------------------------------------
   * PORQUE É QUE ISTO ESTÁ AQUI ESCRITO, SE A BIBLIOTECA JÁ O FAZ
   * -----------------------------------------------------------------------------
   * O `better-auth` 1.7.7 liga o limitador sozinho em produção e traz regras
   * internas mais apertadas para os caminhos de credenciais
   * (`dist/api/rate-limiter/index.mjs:305-318`: `/sign-in*`, `/sign-up*`,
   * `/change-password*` e `/change-email*` a 3 pedidos por 10 s; reposição de
   * palavra-passe a 3 por 60 s). Um valor que não está escrito não se discute nem
   * se revê: fica-se dependente de uma omissão da biblioteca, que pode mudar com
   * uma atualização. Aqui está escrito para poder ser lido, medido e alterado.
   *
   * -----------------------------------------------------------------------------
   * A DECISÃO (janela / máximo)
   * -----------------------------------------------------------------------------
   * - **`/sign-in/email`: 10 tentativas por cada 60 segundos, por IP.** Uma
   *   aplicação de utilizador único não tem picos de entrada: quem se engana na
   *   palavra-passe engana-se uma ou duas vezes, e tem de poder voltar a tentar
   *   sem esperar. Mas 10 por minuto são ~14 400 por dia e por endereço, contra
   *   um mínimo de 8 caracteres — ordens de grandeza abaixo do que faria mossa a
   *   uma palavra-passe, mesmo fraca. Comparado com a regra interna da
   *   biblioteca (3 por 10 s = 18/min sustentados), o ritmo sustentado é
   *   **mais apertado**, e é o ritmo que limita um ataque; o que se ganha é não
   *   bloquear quem só se enganou.
   * - **`/sign-up/email`: 20 por 60 segundos.** O registo é um ato isolado — uma
   *   pessoa regista-se uma vez. O valor é folgado de propósito: as próprias
   *   verificações do projeto (o fumo e os testes ponta a ponta) criam vários
   *   utilizadores de teste a partir do mesmo endereço, e um limitador apertado
   *   aqui faria falhar a verificação, não o ataque.
   * - **Reposição de palavra-passe: 5 por 60 segundos.** Não há envio de e-mail
   *   configurado, portanto este caminho não tem uso legítimo com pressa.
   * - **Resto da API de autenticação: 10 s / 100 pedidos**, igual ao que a
   *   biblioteca já usa. Inclui `/get-session`, que é chamado em cada carregamento
   *   de página: baixar este valor apertaria a navegação normal.
   * - **`/change-password` e `/change-email`** ficam com a regra interna da
   *   biblioteca (3 por 10 s): são operações de uma conta só e não as toquei.
   *
   * -----------------------------------------------------------------------------
   * LIMITES DESTA PROTEÇÃO (declarados, não escondidos)
   * -----------------------------------------------------------------------------
   * 1. **`storage: 'memory'` é por instância.** Em serverless (Vercel) cada
   *    instância — e cada arranque a frio — tem o seu contador, pelo que o número
   *    máximo efetivo é "por instância", não global. É a razão pela qual isto não
   *    substitui uma palavra-passe forte: trava a repetição no mesmo processo, não
   *    um ataque distribuído por muitas instâncias ou muitos IP.
   *    (`'database'` exigiria um modelo `rateLimit` com uma coluna `BigInt`, que
   *    `schema.prisma:74-76` exclui de propósito.)
   * 2. **A chave é `ip|path`** (`createRateLimitKey`). Todos os pedidos do mesmo
   *    caminho a partir do mesmo endereço partilham o contador; utilizadores
   *    diferentes não se estorvam.
   * 3. **O IP vem dos cabeçalhos de proxy** (`x-forwarded-for` e afins). Num
   *    deploy atrás do proxy da plataforma, o valor é o que o proxy escreve; um
   *    pedido que chegue diretamente com o cabeçalho forjado pode falsificar a
   *    chave. Não configurei `advanced.ipAddress.trustedProxies` porque não
   *    conheço a cadeia do deploy e uma escolha errada deixaria todos os pedidos
   *    no mesmo contador — fica registado como o que é.
   * 4. **Em desenvolvimento o limitador fica desligado** (é o comportamento por
   *    omissão da biblioteca, tornado explícito aqui). Ligá-lo faria os testes
   *    ponta a ponta, que criam e autenticam utilizadores a partir de
   *    `127.0.0.1`, falharem por 429 — a proteção passaria a ser ela a estragar a
   *    verificação. Produção e *previews* do Vercel correm com
   *    `NODE_ENV=production`, e é aí que a aplicação está exposta.
   */
  rateLimit: {
    enabled: process.env.NODE_ENV === 'production',
    window: 10,
    max: 100,
    storage: 'memory',
    customRules: {
      '/sign-in/email': { window: 60, max: 10 },
      '/sign-up/email': { window: 60, max: 20 },
      '/request-password-reset': { window: 60, max: 5 },
      '/reset-password': { window: 60, max: 5 },
    },
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
