# Deploy em produção (Vercel + Neon)

Este documento existe para que o deploy não seja conhecimento oral. O que está
aqui foi verificado no repositório e contra a aplicação publicada; o que **não**
pude verificar a partir do repositório está marcado como tal, em vez de ser
escrito como se fosse facto.

- **URL de produção:** `https://financas-pessoais-psi-lac.vercel.app`
- **Base de dados:** PostgreSQL no Neon (host com `-pooler` na `DATABASE_URL`).
- **Repositório:** `https://github.com/rafaelfa/financas-pessoais`, ramo `main`.

## 1. O que o build precisa

O deploy é de um **monorepo pnpm**. O `next build` não gera o cliente Prisma por
si: o cliente é gerado pelo `turbo` como dependência do `build`
(`turbo.json` → `"build": { "dependsOn": ["^build", "^db:generate"] }`). Qualquer
configuração de build tem de o manter, senão o build falha em
`@repo/db/client`.

Configuração esperada no projeto Vercel:

| Definição | Valor |
|---|---|
| Root Directory | raiz do repositório (**não** `apps/web`) — o workspace e o `turbo.json` vivem aqui |
| Framework Preset | Next.js |
| Build Command | `pnpm build` (ou o equivalente que corra o `turbo` a partir da raiz) |
| Install Command | `pnpm install` |
| Node.js Version | 22 |
| Output Directory | a predefinição do Next.js (`apps/web/.next`), não forçar |

> **Não verificado:** este repositório não tem `vercel.json` nem pasta `.vercel/`
> (ambos ausentes), e a CLI do Vercel não está instalada nesta máquina. As linhas
> acima são o que o monorepo exige e o que a aplicação publicada demonstra estar
> a acontecer — não são a leitura do painel. Quem tiver acesso ao painel deve
> confirmar a tabela e corrigir este documento se divergir.

## 2. Variáveis de ambiente

Todas têm de existir no ambiente **Production** (e em **Preview**, se os preview
deploys apontarem para um ramo de base de dados no Neon):

| Variável | Para que serve |
|---|---|
| `DATABASE_URL` | Ligação **com pooling** (host com `-pooler`), usada em execução |
| `DIRECT_URL` | Ligação **direta**, usada pelas migrações (um pooler não corre `prisma migrate`) |
| `BETTER_AUTH_SECRET` | Assinatura das sessões; gerar com 32 bytes aleatórios |
| `BETTER_AUTH_URL` | URL público da aplicação (em produção, o domínio de produção — não `localhost`) |
| `CRON_SECRET` | Ver a nota do §4: está declarada, mas hoje **não é usada** |
| `NODE_ENV` | `production` |

O `.env.example` da raiz tem a forma de cada uma. O `.env` local está no
`.gitignore` e nunca é publicado.

**`BETTER_AUTH_URL` errado é a avaria mais silenciosa desta lista:** as cookies de
sessão passam a ser emitidas para o domínio errado e o sintoma é "entra e volta
ao ecrã de entrada", sem erro no servidor.

## 3. Migrações

As migrações **não** correm no build, de propósito: um build que altera o esquema
da base de produção a cada deploy é uma avaria à espera de acontecer (e dois
deploys em paralelo a migrar ao mesmo tempo é pior). O passo é explícito e
anterior ao deploy:

```bash
# a partir da raiz, com o DIRECT_URL do ambiente alvo no .env
pnpm --filter @repo/db exec prisma migrate deploy
```

Quando a migração remove uma coluna, o `prisma migrate deploy` recusa sem
`--accept-data-loss` — e o aviso deve ser lido, não contornado por reflexo.

Depois de mexer no `schema.prisma`, regenerar o cliente (`pnpm db:generate`)
antes de concluir que um campo novo "não existe": o erro de tipos vem do cliente
antigo, não do esquema.

## 4. Tarefas agendadas — estado real

`CRON_SECRET` está declarada no `.env.example` e declarada no `turbo.json`
(`globalEnv`), **mas não existe nenhuma rota de cron no código**: as únicas rotas
de API são `/api/health` e `/api/auth/[...all]`. Não há, portanto, nenhuma
entrada `crons` a configurar, e a variável é hoje inerte.

Fica registado como decisão em aberto, não como funcionalidade: ou se cria a rota
que gera as recorrências vencidas (protegida por `CRON_SECRET`) e se acrescenta a
entrada `crons`, ou se retira a variável. Manter uma variável que promete uma
tarefa agendada que não existe é o tipo de documento que mente sozinho.

## 5. Verificação depois do deploy

```bash
# 1. o fumo autenticado, contra o URL publicado (cria e apaga um utilizador de teste)
node packages/db/smoke.mjs https://financas-pessoais-psi-lac.vercel.app

# 2. o mesmo, a partir do GitHub Actions (workflow "Fumo em produção", à mão)
#    precisa do segredo SMOKE_DATABASE_URL no repositório
```

O fumo pede as 12 páginas autenticadas e falha se alguma responder com erro de
servidor, confirma que o registo aprovisiona 29 categorias e 1 conta, e apaga o
utilizador no fim. A última execução conhecida (2026-10-11) passou nas 12 páginas.

O fumo **não** substitui uma passagem pelos testes ponta a ponta
(`pnpm test:e2e`): confirma que as páginas respondem, não que os fluxos escrevem
o que deviam.

## 6. Domínio e PWA

A PWA (manifesto, service worker e ícones) está em `apps/web/public/` e
`apps/web/src/app/manifest.ts`. Ao ligar um domínio próprio, três coisas mudam de
uma vez e é fácil esquecer a terceira: `BETTER_AUTH_URL`, as origens permitidas
do `better-auth` e o `start_url` do manifesto. O sintoma de esquecer a segunda é
uma sessão que funciona na página e falha nas chamadas do cliente.
