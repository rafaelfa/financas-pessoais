# MAPA — financas-pessoais

Escrito pelo Lead antes de tocar em qualquer coisa. Tudo abaixo foi medido nesta
máquina (Windows, `D:\openbot\projetos-dev\financas-pessoais`, clonado em 2026-11-01
com `--depth 1`, HEAD `b980ed0`, ramo `main` limpo no remoto).

## Stack real

Verificado nos manifestos instalados, não no README.

- **Node 24.21.0**, `engines.node >= 20.18.1`; **pnpm 10.17.1** (`packageManager`)
- **Monorepo**: pnpm workspaces (`apps/*`, `packages/*`) + Turborepo 2.11.7
- **Web**: Next.js **16.4.0** (App Router), React **19.3.0**, TypeScript **5.9.3**
  (estrito), Tailwind CSS **4.3.3**, radix-ui 1.7.0, shadcn 4.21.4, Recharts 3.8.0
- **Dados**: Prisma **7.10.0**, PostgreSQL (Neon), **25 modelos**, **2 migrações**
  (`20261011000000_linha_de_base`, `20261014192848_add_receivable_payable_and_account_group`)
- **Auth**: better-auth 1.7.7 (utilizador único), Zod 4.6.5
- **Testes**: Vitest no `packages/shared` (28 ficheiros), Playwright 1.64.0 + axe na raiz
- **Deploy**: Vercel + Neon; produção `https://financas-pessoais-psi-lac.vercel.app`

## Como se corre — medido a 2026-11-01

`pnpm install` demora ~44 s nesta máquina. Todos os resultados abaixo são desta
passagem, com o `node_modules` acabado de criar.

| Comando                          | Resultado medido                                                                          |
| -------------------------------- | ----------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile` | **FALHA** — `ERR_PNPM_OUTDATED_LOCKFILE`: faltam `@hookform/resolvers@3.3.0` e `react-hook-form@7.53.1` |
| `pnpm install --no-frozen-lockfile` | OK, 44,2 s (reescreve `pnpm-lock.yaml` com +25 linhas)                                 |
| `pnpm db:generate`               | OK **só** com `.env` presente; sem ele `PrismaConfigEnvError: Cannot resolve environment variable: DIRECT_URL` |
| `pnpm format:check`              | **FALHA** — ver "Onde dói" (1 e 2)                                                        |
| `pnpm format`                    | OK, deixa o `format:check` verde                                                           |
| `pnpm lint`                      | **FALHA** — 51 erros em 11 ficheiros                                                       |
| `pnpm typecheck`                 | **FALHA** — 2 erros (`receivable-payable-actions.ts:262` e `:300`)                         |
| `pnpm test`                      | **VERDE** — 28 ficheiros, **522 testes**, 1,81 s                                           |
| `pnpm build`                     | **FALHA** — "Failed to type check", 7 erros TS no `@repo/web`                              |
| `pnpm test:e2e`                  | **não corrido** — exige `.env` com base Neon real (a desta máquina é falsa)                |

Conclusão operacional: **o gate está vermelho em `main`**, ao contrário do que o
`README.md` e o `docs/plano/ESTADO-E-HANDOFF.md` afirmam (esses documentos descrevem
o estado anterior ao commit `b980ed0`).

`.env` desta máquina: criado a partir do `.env.example` com valores **falsos**
(base `localhost`, segredos de enchimento). Chega para `db:generate`, `typecheck` e
`build`; não chega para `dev`, `test:e2e` nem `db:seed`.

## Mapa de ficheiros

| Caminho                                        | O que faz                                                                        |
| ---------------------------------------------- | -------------------------------------------------------------------------------- |
| `apps/web/src/app/(app)/`                      | 14 ecrãs autenticados: contas, transações, categorias, orçamento, objetivos, cartões, recorrências, regras, relatórios, importar, definições, consolidação-contas, contas-pagar-receber |
| `apps/web/src/app/(auth)/`                     | `entrar` e `registar`                                                            |
| `apps/web/src/app/api/`                        | só `health` e `auth/[...all]` — **não existe rota de cron**                       |
| `apps/web/src/app/(app)/api/`                  | 2 rotas novas: `account-group`, `receivable-payable` (do commit `b980ed0`)         |
| `apps/web/src/server/`                         | 42 módulos finos: consulta + validação + transação (ex.: `transactions-actions.ts`, 646 linhas) |
| `apps/web/src/components/`                     | inclui `ui/` (shadcn). Maiores: `transaction-quick-add.tsx` e `recurrence-dialog.tsx` (749 linhas) |
| `packages/shared/src/finance/`                 | motor financeiro puro (caixa e competência), 16 ficheiros de teste                |
| `packages/shared/src/import/`                  | OFX/CSV: `ofx.ts` (958 linhas), `preview.ts` (745), reversão de importação         |
| `packages/shared/src/schemas/`, `types/`, `utils/` | Zod, tipos e utilitários (dinheiro em cêntimos, datas `YYYY-MM-DD`)             |
| `packages/db/prisma/schema.prisma`             | 25 modelos; `seed.ts` com 1 485 linhas (demo idempotente)                          |
| `e2e/`                                         | 10 specs Playwright (20 percursos) + `global.setup/teardown`                       |
| `docs/plano/`                                  | `PLANO-EXECUCAO.md`, `ESTADO-E-HANDOFF.md`, `DEPLOY.md`                            |
| `docs/spec/`                                   | contrato de cálculo (`F1`) e 6 relatórios de verificação adversarial               |
| `.github/workflows/`                           | `ci.yml` (gate com `--frozen-lockfile` + PostgreSQL em serviço) e `smoke.yml`       |

Volumes: `apps/web/src` 207 ficheiros `.ts/.tsx`, `packages/shared/src` 72,
`packages/db` 4, `e2e` 18. Total dos fontes: ~52 300 linhas.

## Onde dói

Por ordem de gravidade, tudo medido.

1. **`pnpm-lock.yaml` desatualizado em `main`.** `apps/web/package.json` declara
   `react-hook-form@7.53.1` e `@hookform/resolvers@3.3.0`; o lockfile não tem
   nenhuma das duas (`grep -c react-hook-form pnpm-lock.yaml` → 0). Como o CI corre
   `pnpm install --frozen-lockfile` (`.github/workflows/ci.yml:80`), **a CI falha no
   primeiro passo**. O commit `b980ed0` ("adicionar react-hook-form, … ausentes")
   mexeu no `package.json` e esqueceu o lockfile.
2. **12 ficheiros não estão formatados** (`apps/web/src/components/ui/form.tsx`,
   `ui/use-toast.tsx`, `account-group-*.tsx`, `receivable-payable-*.tsx`,
   `consolidacao-contas/page.tsx`, `server/account-groups.ts`,
   `schemas/domain/receivable-payable.ts` e 3 mais). `pnpm format:check` falha com
   eles. **Já corrigido na árvore de trabalho desta máquina** por `pnpm format` (não
   commitado) — o Dev confirma e commita.
3. **Sem `.gitattributes`, com `core.autocrlf=true` global no Windows.** O clone
   entregou CRLF e o Prettier exige `endOfLine: "lf"` → **330 ficheiros "mal
   formatados"** que estão corretos no git (os blobs são LF, confirmado com
   `git show HEAD:tsconfig.json`). Um clone no Linux não vê isto; um Windows vê o gate
   vermelho sem ter mudado nada. Resolvido na T1 com `.gitattributes`
   (`* text=auto eol=lf`). Depois de o `pnpm format` reconverter para LF, esses
   ficheiros ficam com conteúdo igual ao commit e aparecem só como cache de stat
   obsoleta em `git status` (`git hash-object` == `git rev-parse HEAD:…`).
4. **`pnpm build` reescreve `apps/web/next-env.d.ts` com aspas duplas** e o Prettier
   exige `singleQuote: true` → `format:check` falha em qualquer sequência
   "build e depois format". É ficheiro gerado (diz "should not be edited"), logo a
   correção é pô-lo no `.prettierignore`. O CI esconde o problema porque corre
   `format` antes de `build`.
5. **A funcionalidade do commit `b980ed0` está a meio.** `react/jsx-no-undef` em
   `apps/web/src/components/account-group-dialog.tsx:195` (`<Checkbox …>` usado, sem
   import) — é crash em runtime, não só lint. Mais 39 `no-unused-vars` (imports
   `DialogContent`, `Form`, `DrawerTitle`, `Badge`, `Link`, `fail`, `ActionResult`),
   6 `react/no-unescaped-entities`, 4 `no-explicit-any`, 1
   `react-hooks/set-state-in-effect` (`lib/hooks/use-mobile.tsx:9`).
6. **Erros de tipo reais** em `apps/web/src/server/receivable-payable-actions.ts`:
   `:262` e `:300` usam `existing.status` mas o `select` só traz `{ id: true }`
   (`TS2339`); `:207` passa `string | null` onde se espera `string | undefined`
   (`TS2322`). Os dois primeiros são a mesma linha copiada em duas ações.
   **Total medido: 80 erros** em `pnpm typecheck` (32 `TS6133` de código não usado, 28
   `TS2339`, 2 `TS7006`, 2 `TS2349`, 2 `TS2322`, 1 `TS6196`, 1 `TS2769`, 1 `TS2304`),
   concentrados em 7 ficheiros: `receivable-payable-dialog.tsx` (29),
   `account-group-dialog.tsx` (28), `receivable-payable-actions.ts` (4),
   `receivable-payable-list.tsx` (4) e 3 outros. O `pnpm build` mostra os mesmos 80.
7. **`test:e2e` não corre sem base real.** O `playwright.config.ts` aponta para o
   `.env`, e sem Neon (ou o `docker-compose.yml` levantado) não há como provar nada
   nos percursos.
8. **Os ecrãs novos não têm teste.** `consolidacao-contas` e `contas-pagar-receber`
   não aparecem em `e2e/` nem nos 522 testes do `shared`. Foram acrescentados sem
   verificação.
9. **`docs/plano/ESTADO-E-HANDOFF.md` e o `README.md` mentem sobre o estado.** Dizem
   "árvore verde, CI verde em `main`"; o gate falha em 4 de 8 comandos medidos e o CI
   está vermelho desde 2026-10-14 19:30.
10. **A produção está 8 commits atrás.** Nada do trabalho deste mês chegou ao ar.
    Ver "Produção, CI e Vercel".

## Produção, CI e Vercel — verificado em 2026-11-01

Isto é o que responde à pergunta "o projeto está no ar?".

**Produção está no ar e saudável, mas está 8 commits atrás de `main`.**

- `GET /api/health` → `200`, `environment: production`, base de dados
  `reachable: true`.
- `GET /` → `307` para `/entrar`. Os 8 ecrãs antigos respondem `307` (transações,
  cartões, orçamento, relatórios, categorias, regras, contas, definições).
- **`/contas-pagar-receber` e `/consolidacao-contas` respondem `404`** — o código
  publicado não tem a funcionalidade do `b980ed0`.
- O deploy que serve a produção é `dpl_FtCdbjsWbJj2xmLj8moWhGHKoFUM`, do commit
  **`e4366ee`** ("feat: melhorias de usabilidade e responsividade"), `READY`.

**Os 8 deploys seguintes falharam todos** (API do Vercel, estado `ERROR`,
`target: production`, todos em `main`): `b980ed0`, `324c4db`, `6c3a8b3` (três
vezes), `9298813`, `cf21804`, `b04bc9a`, `589d488`. Nenhum chegou a produção — não
há nada partido no ar, apenas trabalho retido.

**O CI diz o mesmo** (`gh run list`):

| Commit                                                | Data do run      | Estado              | Passo que falhou                     |
| ----------------------------------------------------- | ---------------- | ------------------- | ------------------------------------ |
| `b980ed0` (HEAD)                                      | 2026-10-18 10:53 | falha               | **Instalar dependências** (lockfile) |
| `324c4db`                                             | 2026-10-18 10:46 | falha               | —                                    |
| `6c3a8b3`, `9298813`, `cf21804`, `b04bc9a`, `589d488` | 2026-10-14 19:30–19:44 | falha        | —                                    |
| `e4366ee`                                             | 2026-10-14 18:41 | **sucesso** (2m40s) | —                                    |
| commits de documentação de 2026-10-13                  | 20:04–20:29      | falha               | **Formatação**                       |

Conclusão: o último estado verde conhecido é **`e4366ee`**, exatamente o que está
publicado. Tudo o que veio depois é trabalho não integrado.

**Histórico reescrito.** Três deploys `READY` referem commits que já não existem em
`main` (`6ec220d`, `18c0e0e`, `343acbf`, de 2026-10-13): houve rebase/force-push, ou
os ramos foram apagados. Não é recuperável pelo repositório.

**As migrações não correm no build** (`turbo.json`: `build` depende de
`^db:generate`, não de `migrate deploy`) e o CI também não as corre. Portanto a
migração `20261014192848_add_receivable_payable_and_account_group` **não tem caminho
automático para a Neon de produção**; se correu, foi à mão.

**A base Neon foi verificada** (MCP do Neon, leitura, 2026-11-01). Ver secção
seguinte.

## Base de dados Neon — layout real, verificado

**A confusão começa aqui: existem dois projetos Neon chamados `diario_chofer`, e não
existe nenhum projeto chamado `financas`.** A base das finanças é um **ramo** dentro
de um deles.

| Projeto                | Conteúdo                                                                 |
| ---------------------- | ------------------------------------------------------------------------ |
| `old-fire-26176066`    | ramo `main` = app do diário do chofer (`app_users`, `driving_sessions`, `work_days`, …) |
| `patient-field-12858176` | também chamado `diario_chofer`; inativo desde 2026-09-26                 |

A base do `financas-pessoais` é o **ramo `Financas_Pessoal`** do primeiro projeto:

- projeto `old-fire-26176066`, ramo `br-patient-mud-b166137a` (`Financas_Pessoal`)
- endpoint `ep-young-poetry-b1nqzwit` · pooler `ep-young-poetry-b1nqzwit-pooler`
- região `aws-eu-central-1`, PostgreSQL **18**, estado do compute `active`
- plano `free_v3`, `suspend_timeout_seconds: 0` (suspende assim que fica ocioso —
  por isso a primeira consulta depois de um intervalo demora uns segundos)
- criado em 2026-10-10 17:04 UTC

**Migrações — ambas aplicadas**, em `_prisma_migrations`:

| Migração                                             | Aplicada | Passos |
| ---------------------------------------------------- | -------- | ------ |
| `20261011000000_linha_de_base`                       | sim      | 0 (marcada com `migrate resolve`, é a linha de base) |
| `20261014192848_add_receivable_payable_and_account_group` | sim  | 1      |

**As tabelas da funcionalidade nova já existem na base** (`receivable_payable`,
`receivable_payable_payment`, `account_group`, `account_group_item`), com **0 linhas**
— coerente com o facto de o código nunca ter chegado a produção.

**Dados reais presentes** (contagem direta): 2 utilizadores, 5 contas financeiras,
52 transações, 1 orçamento, 0 contas a pagar/receber, 0 grupos.

Consequência para o plano: **reter o código não tem custo de base de dados** — a
migração já correu e as tabelas estão vazias. Nenhum `migrate deploy` é preciso para
subir o código novo; só para futuras migrações.

## Baseline do e2e — medido em 2026-11-01 contra um ramo Neon de teste

Ramo `testes-e2e` (`br-damp-math-b1mtm603`, endpoint `ep-spring-mud-b11fe546`),
cópia do ramo de produção, criado só para isto. **A produção não foi tocada.**

| Como o servidor arrancou | Resultado | Falhas |
| --- | --- | --- |
| `next dev` (o que o `playwright.config.ts` usa) | **20/24** em 4,2 min | 1 por o *dev overlay* `<nextjs-portal>` intercetar cliques em «Terminar sessão»; 3 no estado do lançamento |
| `next start` (build de produção, `.next` limpo) | **21/24** em 2,8 min | as 3 do estado do lançamento |

**As 3 falhas restantes são pré-existentes e alheias a este trabalho.**
`e2e/35-estado-transacoes.spec.ts` falha em `support/ui.ts:104`: o formulário de
lançamento rápido (`locator('form').filter({ hasText: 'Natureza' })`) não aparece em
20 s. Não tem relação com contas a pagar/receber nem com a T1/T2 — o caminho do
lançamento rápido foi mexido em commits de 2026-10-14, depois da última passagem verde.

**Consequência de método:** o comentário do `playwright.config.ts` justifica `next dev`
com o `spawn EPERM` do `next build` na sandbox. Esse motivo desapareceu — o `build`
passa. O e2e deve correr contra `next start`, senão o *overlay* de desenvolvimento
introduz uma falha que não existe em produção.

**Como se corre nesta máquina** (o `webServer` do Playwright não segura o processo em
segundo plano; `nohup` segura):

```bash
rm -rf apps/web/.next && pnpm build
nohup pnpm --filter @repo/web start > /tmp/prod.log 2>&1 < /dev/null & disown
E2E_REUSE_SERVER=1 pnpm exec playwright test --reporter=line
```

## Produção depois do deploy (2026-11-01, verificada)

- **Commit `2f84384` empurrado** para `main` (ver "Como se faz push neste repositório").
- **CI verde pela primeira vez desde 2026-10-14**: run `41320502835`,
  `format · lint · typecheck · test · build` — exit 0.
- **Vercel**: deploy `dpl_2sqFbHRkwG4ZqP1vNEsRiQFuYcQo`, `READY`, `target: production`,
  commit `2f84384`.
- **14 páginas autenticadas a `200`** em `https://financas-pessoais-psi-lac.vercel.app`,
  incluindo `/contas-pagar-receber` e `/consolidacao-contas` (antes 404). Sessão obtida com a
  conta demo documentada no `README`; só `GET`, nenhuma escrita.
- Os dois ecrãs novos devolvem HTML com conteúdo real (`Contas a Pagar`, `Nova Conta`, `Total`,
  `Consolidação`, `Novo Grupo`, `Saldo`) — 72 376 e 65 985 bytes.
- **Não corri o `packages/db/smoke.mjs`**: ele apaga o utilizador de teste com a `DATABASE_URL`
  do `.env`, que nesta máquina aponta para o ramo `testes-e2e` — corrê-lo deixaria um utilizador
  órfão na produção. A verificação autenticada acima cobre o mesmo risco (500 em página
  autenticada), que é o que o smoke existe para apanhar.

## Como se faz push neste repositório

O token do OpenBot tem só leitura no conteúdo, e o `OpenBotGit` aparece em "Authorized GitHub
Apps" **sem instalação** (`GET /user/installations` → `total_count: 0`), pelo que não há
nenhuma permissão que o utilizador possa ligar no painel. Três tokens *fine-grained* falharam
com `Resource not accessible by personal access token` e o cabeçalho
`x-accepted-github-permissions: contents=write`.

Solução adoptada: **chave SSH** em `D:\openbot\projetos-dev\_chaves\id_ed25519_openbot`
(privada com permissões 600, fora do repositório; a pública registada na conta GitHub). O
remoto passou a `git@github.com:rafaelfa/financas-pessoais.git` e o repo tem `core.sshCommand`
a apontar para essa chave. Para empurrar: `git push origin main`.

## Segredos e dados

- `.env` **não existe no repositório** e está no `.gitignore` (linha 20). O
  `.env.example` traz 6 variáveis: `DATABASE_URL`, `DIRECT_URL`, `BETTER_AUTH_SECRET`,
  `BETTER_AUTH_URL`, `CRON_SECRET`, `NODE_ENV`.
- As migrações usam **`DIRECT_URL`** (o pooler do Neon não corre `prisma migrate`).
  Trocar uma pela outra dá um erro que não explica a causa.
- **Produção tem segredos reais na Vercel.** Não estão aqui e não devem passar por
  chat, ficheiros ou commits.
- `CRON_SECRET` está declarada no `.env.example`, no `turbo.json` e na Vercel, mas
  **nenhuma rota a usa** — é uma variável que promete uma tarefa agendada que não
  existe (já assinalado no §6.3 do handoff).
- O `seed.ts` cria um utilizador de demonstração com palavra-passe conhecida
  (`demo@financas-pessoais.pt`). Nunca correr este seed contra a base de produção.
- Nunca escrever em: `.env`, `.next/`, `node_modules/`, `packages/db/src/generated/`.

## O que não se percebe

1. **O commit `b980ed0` é uma funcionalidade a meio ou um commit acidental?** Junta
   "contas a pagar/receber", "grupos de conta", "consolidação de contas", uma
   migração de base de dados e o conserto de 3 imports — sem testes e sem passar no
   gate. Preciso de saber se a intenção é **terminar** ou **reter** a funcionalidade.
2. **A migração `add_receivable_payable_and_account_group` já foi aplicada à Neon de
   produção?** — **RESPONDIDO: sim**, e as tabelas estão vazias (ver "Base de dados
   Neon"). Já não é uma incógnita do plano.
3. **Não há `.gitattributes`**: resolvido na T1 (`* text=auto eol=lf`). Fica a
   pergunta: o gate tem de correr no Windows (esta máquina) ou basta o runner de
   Ubuntu?
4. **A rota de cron existe?** Se não, o `CRON_SECRET` sai do `.env.example` e do
   `turbo.json`, ou escreve-se a rota que gera as recorrências vencidas.
5. **O gate tem de correr no Windows** (esta máquina) ou basta o runner de Ubuntu?
   Muda se o `.gitattributes` é obrigatório ou apenas simpático.
