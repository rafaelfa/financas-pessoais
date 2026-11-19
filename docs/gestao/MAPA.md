# MAPA — financas-pessoais

Escrito pelo Lead antes de tocar em qualquer coisa. Tudo abaixo foi medido nesta
máquina (Windows, `D:\openbot\projetos-dev\financas-pessoais`, clonado em 2026-11-01
com `--depth 1`, HEAD `b980ed0`, ramo `main` limpo no remoto).

## Stack real — verificada a 2026-11-18

Verificado nos manifestos instalados, não no README.

- **Node 24.21.0**, `engines.node >= 20.18.1`; **pnpm 10.17.1** (`packageManager`)
- **Monorepo**: pnpm workspaces (`apps/*`, `packages/*`) + Turborepo 2.11.7
- **Web**: Next.js **16.4.6** (App Router), React **19.3.0**, TypeScript **5.9.3**
  (estrito), Tailwind CSS **4.3.3**, radix-ui 1.7.0, shadcn 4.21.4 (só `devDependencies`), Recharts 3.8.0
- **Dados**: Prisma **7.10.0**, PostgreSQL (Neon), **25 modelos**, **3 migrações**
  (`20261011000000_linha_de_base`, `20261014192848_add_receivable_payable_and_account_group`,
  `20261103203748_remove_goal_movement_yield`) — lidas de `_prisma_migrations` a 2026-11-18
- **Auth**: better-auth 1.7.7 (utilizador único), Zod 4.6.6
- **Testes**: Vitest no `packages/shared` (32 ficheiros, **582 testes** a 2026-11-18), Playwright 1.64.0 + axe na raiz
- **Deploy**: Vercel + Neon; produção `https://financas-pessoais-psi-lac.vercel.app`

## Como se corre — medido a 2026-11-18

Todos os resultados abaixo foram medidos **nesta árvore** (commit `16ae678`), com o
`node_modules` já instalado. Cada linha traz o comando: quem duvidar, corre-o.

| Comando                            | Resultado medido a 2026-11-18                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`   | **OK** — `Already up to date` (o lockfile está alinhado com os `package.json`)    |
| `pnpm db:generate`                  | OK com o `.env` presente (`prisma generate`, 210 ms); sem `.env` falha por `DIRECT_URL` |
| `pnpm format:check`                 | **OK** — `All matched files use Prettier code style!`                            |
| `pnpm lint`                         | **OK** — 4/4 tarefas, 0 erros                                                    |
| `pnpm typecheck`                    | **OK** — 4/4 tarefas, 0 erros                                                    |
| `pnpm test`                         | **OK** — 32 ficheiros, **582 testes**, ~1,8 s                                    |
| `pnpm build`                        | **OK** — 2/2 tarefas                                                            |
| `pnpm test:e2e`                     | **não corrido nesta passagem** — é a suíte do QA; exige `.env` com base real (existe nesta máquina) |

Conclusão operacional: **o gate está verde nesta árvore**, medido a 2026-11-18. As
linhas de 2026-11-01 que diziam o contrário descreviam o estado até ao commit
`b980ed0` e estão corrigidas em "Onde dói".

`.env` desta máquina: base Neon real (não a falsa descrita a 2026-11-01). Chega para
`build`, `typecheck`, `db:generate` e para a suíte e2e do QA.

## Mapa de ficheiros — estrutura verificada a 2026-11-18

Sem contagens de linhas nem de ficheiros: isso envelhece em cada commit e não é o que
aqui serve. O que se segue é a **forma** do repositório — o que vive onde.

| Caminho | O que faz |
| --- | --- |
| `apps/web/src/app/(app)/` | os ecrãs autenticados: painel, transações, contas, contas a pagar/receber, consolidação de contas, cartões, património, orçamento, objetivos, recorrências, regras, categorias, relatórios, importar, revisão, calendário e definições |
| `apps/web/src/app/(auth)/` | `entrar` e `registar` |
| `apps/web/src/app/api/` | só `health` e `auth/[...all]` — **não existe rota de cron** |
| `apps/web/src/app/(app)/api/` | as duas rotas de dados que não são Server Actions: `account-group` e `receivable-payable` |
| `apps/web/src/server/` | a camada fina: consulta + validação + transação, um módulo por assunto (`transactions.ts`, `transactions-actions.ts`, `review.ts`, `calendar.ts`, `invoices.ts`, …) |
| `apps/web/src/components/` | componentes da aplicação; `ui/` é shadcn gerado |
| `packages/shared/src/finance/` | o motor financeiro puro (caixa e competência), testado no Vitest |
| `packages/shared/src/import/` | leitura de OFX/CSV, pré-visualização e reversão de importação |
| `packages/shared/src/schemas/`, `types/`, `utils/` | Zod, tipos e utilitários (dinheiro em cêntimos, datas `YYYY-MM-DD`) |
| `packages/db/prisma/schema.prisma` | os modelos; `seed.ts` cria a conta de demonstração (idempotente) |
| `e2e/` | specs Playwright (por ecrã e por tarefa) + `global.setup/teardown` |
| `docs/plano/` | `PLANO-EXECUCAO.md`, `ESTADO-E-HANDOFF.md`, `DEPLOY.md` |
| `docs/spec/` | contratos de cálculo e os relatórios de verificação adversarial |
| `docs/gestao/` | este mapa, `TASKS.md`, `DECISOES.md` |
| `.github/workflows/` | `ci.yml` (o gate, com `--frozen-lockfile`) e `smoke.yml` |

## Onde dói

Medido a **2026-11-18**, item a item, com o comando à frente. O que já não se
verificava saiu da lista — a lista antiga (2026-11-01) está no histórico do git e
descrevia o estado até ao commit `b980ed0`.

1. **`test:e2e` e `db:seed` exigem uma base real.** `playwright.config.ts` lê o `.env`
   e o seed escreve na `DATABASE_URL`: sem Neon (ou o `docker-compose.yml` levantado)
   não há como correr nenhum dos dois.
   - Comando: `ls .env` · saída: existe (base real nesta máquina).
   - Comando: `pnpm test:e2e` · saída: **não corrido aqui** — é a suíte do QA.
   - Continua verdadeiro como **requisito**, não como defeito.

2. **O que ficou resolvido desde 2026-11-01** (com a prova de hoje, para não voltar a
   ser copiado como problema):

| Item de 01/11 | Comando (2026-11-18) | Saída de hoje | Estado |
| --- | --- | --- | --- |
| Lockfile desatualizado (`react-hook-form` ausente) | `pnpm install --frozen-lockfile` · `grep -c react-hook-form pnpm-lock.yaml` | `Already up to date` · **3** ocorrências | **fechado** |
| 12 ficheiros por formatar | `pnpm format:check` | `All matched files use Prettier code style!` | **fechado** |
| Sem `.gitattributes` / CRLF | `ls .gitattributes` · `git config --get core.autocrlf` | existe (19 B) · `false` | **fechado** |
| `next-env.d.ts` a partir o `format:check` | `grep -n next-env .prettierignore` | `10:apps/web/next-env.d.ts` | **fechado** |
| 51 erros de lint (incl. `jsx-no-undef`) | `pnpm lint` | 4/4 tarefas, **0 erros** | **fechado** |
| 80 erros de tipo | `pnpm typecheck` | 4/4 tarefas, **0 erros** | **fechado** |
| Ecrãs novos sem teste | `ls e2e/ \| grep -E "45-contas-pagar\|55-consolidacao"` | `45-contas-pagar-receber.spec.ts`, `55-consolidacao-contas.spec.ts` | **fechado** |
| Produção 8 commits atrás | `curl -o /dev/null -w '%{http_code}' …/revisao` e `…/calendario` contra um caminho inventado | `/revisao` e `/calendario` **307** · caminho inventado **404** · `/api/health` **200** com base `reachable` | **fechado** |
| README/handoff a mentir sobre o estado | este ficheiro + os dois documentos | corrigidos a 2026-11-18 | **fechado** |

3. **Não se verifica daqui** (e é por isso que não está escrito como verde):
   - estado `READY` do último deploy na Vercel e conteúdo exato do build publicado —
     precisaria da API/CLI da Vercel, que esta tarefa não usa;
   - resultado da suíte e2e — é do QA;
   - dados de produção além do que o `/api/health` e os códigos HTTP dizem.

## Produção, CI e Vercel — verificado em 2026-11-18

**Produção está no ar e serve código recente.** Verificado só com pedidos `GET`
públicos e com a API do GitHub (nenhum deploy, nenhum `vercel`):

| Verificação | Comando | Saída de 2026-11-18 |
| --- | --- | --- |
| Saúde | `curl -s -o- -w '%{http_code}' https://financas-pessoais-psi-lac.vercel.app/api/health` | **200** · `environment: production` · `database: reachable: true` |
| Rotas antigas | `curl -o /dev/null -w '%{http_code}' …/` e `…/transacoes` | **307** (redirecionam para `/entrar`; existem) |
| Rotas da vaga 1 e 2 | `…/revisao` e `…/calendario` | **307** — as rotas da T54 e da T55 **existem em produção** (um caminho inexistente dá 404, como aconteceu a `/contas-pagar-receber` a 01/11) |
| Último deploy de produção | `gh api "repos/rafaelfa/financas-pessoais/deployments?environment=Production&per_page=3"` | sha **`16ae678`** (= `HEAD`), criado `2026-11-18T09:24:52Z`; os anteriores: `8d084dd` (09:07) e `eeacad2` (09:07) |

**O que não se verifica daqui:** o estado `READY`/`ERROR` desse deploy e o conteúdo do
build publicado. Precisaria de `vercel ls`/API da Vercel com token — fora do âmbito
desta tarefa. O que os pedidos acima provam é que o que está a servir inclui as rotas
da T54/T55; não provam que o deploy de `16ae678` já esteja a servir.

**CI (`gh run list`, 2026-11-18):** a execução de `8d084dd` (run `44272978670`) está
**success** (1m56s) e a de `16ae678` (run `44275535227`) estava **in_progress** no
momento da medição. As execuções falhadas de outubro (`b980ed0`, `324c4db`, …) são
históricas e já não descrevem `main`.

**As migrações continuam a não correr no build** (`turbo.json`: `build` depende de
`^db:generate`, não de `migrate deploy`) — isso não mudou e é o que continua a exigir
`prisma migrate deploy` à mão para migrações novas.

## Base de dados Neon — layout real, reescrito a 2026-11-19 (depois da A5)

**Desde 19/11 que a base desta app é o projeto `Financas_Pessoal`.** Antes disso era um
ramo dentro do projeto da app do chofer, e é por isso que as duas produções caíam juntas
quando se rodava uma palavra-passe.

| Projeto                  | Região        | Papel hoje |
| ------------------------ | ------------- | ---------- |
| `cold-pond-15149007` **`Financas_Pessoal`** | `aws-us-east-2` | **desta app** — produção na Vercel aponta para aqui |
| `old-fire-26176066` `diario_chofer` | `aws-eu-central-1` | diário do chofer (ramo `production`) + **cópia de segurança de 19/11** (ramo `Financas_Pessoal`, apaga-se no máximo a 26/11) + ramo `testes-e2e` |
| `patient-field-12858176` | — | também chamado `diario_chofer`; inativo desde 2026-09-26 |

Produção desta app, lido por API a 19/11:

- projeto `cold-pond-15149007`, ramo `production` = `br-rough-bird-b4yllio1`
- endpoint `ep-wispy-sky-b4e0sr8e` · pooler `ep-wispy-sky-b4e0sr8e-pooler`
- `aws-us-east-2`, PostgreSQL **18.7**, compute `active`
- 27 tabelas em `public` (158 linhas) **e 9 tabelas em `neon_auth`**, que a app não usa:
  a autenticação é better-auth, com as tabelas em `public`. A Neon Auth ficou montada no
  projeto quando ele nasceu, a 01/11.

Ramos do projeto antigo, para não voltar a confundi-los:

| Ramo | Endpoint | Quem o usa |
| ---- | -------- | ---------- |
| `production` (`br-snowy-dew`) | `ep-frosty-water-b1nyzzpu` | diário do chofer — **nunca tocar** |
| `Financas_Pessoal` (`br-patient-mud`) | `ep-young-poetry-b1nqzwit` | cópia de segurança até 26/11; a palavra-passe foi rodada a 19/11, já não há ligação no repo |
| `testes-e2e` (`br-damp-math`) | `ep-spring-mud-b11fe546` | **`.env` desta máquina** e a suíte e2e — continua no projeto do chofer (ponto 6 da A5, por decidir) |

**Migrações — engano corrigido.** O `MAPA.md` de 18/11 media **o ramo de teste** (a
`DATABASE_URL` do `.env` aponta para `ep-spring-mud`) e chamava-lhe produção. Medido nos
três ramos a 19/11 por API:

| Migração | produção antiga | projeto novo | testes |
| -------- | --------------- | ------------ | ------ |
| `20261011000000_linha_de_base` | sim | sim | sim |
| `20261014192848_add_receivable_payable_and_account_group` | sim | sim | sim |
| `20261103203748_remove_goal_movement_yield` | **não** | **não** | sim |

Prova: `GoalMovementType` ainda tem `YIELD` na produção e no projeto novo; no ramo de
teste é `DEPOSIT, WITHDRAWAL`. Nada se partiu — as 3 linhas de `goal_movement` são todas
`DEPOSIT` — mas **o primeiro `pnpm db:migrate` em produção aplica essa migração**, e isso
é decisão do utilizador.

**As tabelas da funcionalidade nova já existem na base** (`receivable_payable`,
`receivable_payable_payment`, `account_group`, `account_group_item`), com **0 linhas**
— coerente com o facto de o código nunca ter chegado a produção.

**Dados reais presentes** — comando e saída de 2026-11-18 (script de leitura com a
`DATABASE_URL` do `.env`, um `count(*)` por tabela):

```
user 2 · financial_account 5 · transaction 52 · invoice 4 · recurrence 2 ·
category 58 · budget 1 · receivable_payable 0 · account_group 0
```

*Medido no ramo de teste, que é cópia da produção; por isso os números batiam certo.
Repetido a 19/11 na produção de origem e no projeto novo, tabela a tabela: **158 linhas
nos dois lados, 27/27 tabelas com o mesmo `md5`** — ver `relatorios/A5-neon.md`.*

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

## Histórico: produção depois do deploy de 2026-11-01

> Secção **histórica**, mantida para o registo. O estado atual está em "Produção, CI e
> Vercel — verificado em 2026-11-18"; o commit e o deploy citados aqui há muito que
> foram substituídos.

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

## Armadilhas medidas a 2026-11-17 (vaga 2, T52–T59)

Três coisas que custaram uma medição errada e não se vêem no código.

1. **Uma árvore, um build, uma porta.** Dois agentes a correr `next start` na
   mesma máquina colidem com `EADDRINUSE` e o segundo passa a servir — sem aviso —
   o `.next` do primeiro. Numa das voltas da T55 leu-se o build errado e o número
   saiu errado. Toda a medição de browser tem de declarar a **porta** e o
   **`.next/BUILD_ID`** que está a servir, e fechar a porta antes de servir outra.
2. **`apps/web/next-env.d.ts` fica modificado depois de cada `next build`**, porque
   o Next o reescreve com aspas duplas e o repositório o guarda com aspas simples.
   Está no `.prettierignore`, por isso não parte o gate — mas **reverte-se antes de
   commitar**, ou o diff leva um ficheiro gerado.
3. **A dívida de um cartão é a da última fatura da cadeia.** O motor faz
   `carriedOverInCents = outstandingInCents` (`packages/shared/src/finance/invoice.ts:239`):
   o que falta pagar de uma fatura entra no total da seguinte, e cada fatura da
   cadeia continua a mostrar o seu próprio «por pagar». Somar faturas da cadeia
   conta o mesmo dinheiro duas vezes — foi um DEVE na T55, e a regra certa está em
   `totalsByCard` (`:269`).

**Nota sobre a lista «Onde dói»:** remedida a **2026-11-18**, com o comando e a
saída de cada item na própria secção. Seis dos dez itens estavam fechados, dois
(estado do CI e da produção) estavam fechados *e* desatualizados, um continua
verdadeiro como requisito (`test:e2e` precisa de base real) e um era este documento.
Quem usar o mapa como verdade mede primeiro; a data e o comando estão lá para isso.
4. **Dois agentes a correr a suíte ao mesmo tempo estragam a medição um do outro.**
   Partilham o mesmo `test-results/` e o mesmo utilizador `e2e-*` na base. O sintoma
   não é «dois testes falham»: é `browserContext.close: ENOENT …/traces` numa corrida
   e «a fatura não é do cartão» na outra — falhas que parecem defeito de código e são
   colisão de ambiente. Aconteceu três vezes na vaga 3/4 (uma delas deu uma leitura
   contra o build errado). Antes de medir: uma corrida de cada vez, ou um `--output`
   próprio e um prefixo de dados próprio. **Este é o motivo pelo qual o `flake` da
   T65 nunca teve reprodução** — o ambiente não é observável por omissão.
5. **Um `trace.zip` não sobrevive sozinho.** `outputDir: test-results` é limpo no
   arranque seguinte, por isso o traço de uma falha desaparece antes de alguém o ler.
   É para isso que existe `pnpm test:e2e` (invólucro que copia trace, screenshot e
   `error-context.md` para `relatorios/.falhas/<data-hora>/` quando a corrida falha) e
   `pnpm qa:artefactos` (recupera o que ainda esteja no `test-results/`).

## Armadilhas medidas a 2026-11-19 (A5 — migração entre projetos Neon)

Cinco coisas que custaram tempo e que não se vêem em nenhum ficheiro do repo.

1. **Não há cliente Postgres nesta máquina, e o Docker não tem daemon.** `pg_dump`,
   `psql`, `pg_restore`: ausentes. Docker Desktop instalado mas morto —
   `request returned 500 Internal Server Error for API route … dockerDesktopLinuxEngine`,
   `com.docker.service` em `Stopped`, WSL `docker-desktop` em `Stopped`. **Antes de
   prometer uma rota que usa uma ferramenta, mede-se a ferramenta.** A rota que ficou
   foi `postgres_fdw`: uma ponte entre as duas bases, montada e desmontada por SQL, sem
   dados nem palavras-passe a passar pelo chat.
2. **A API HTTP do Neon (`run_sql`) rejeita três formas que o `psql` aceita**:
   `import foreign schema … options (import_collate false)` → `42601 syntax error at or
   near "false"`; `unnest(…) with ordinality as k(a,b)` → `42601` (contorna-se com
   `generate_subscripts(con.conkey, 1)`); e `run_sql` com `params:` → `08P01 bind message
   supplies 0 parameters`. Além disso `run_sql` corre **um** statement; para vários é
   `run_sql_transaction` com `sql_statements`.
3. **`get_connection_string` imprime a palavra-passe, com ou sem `pooled:false`** — esse
   parâmetro é ignorado e a API devolve sempre o host `-pooler` (o host directo obtém-se
   ao tirar `-pooler`). Numa chamada de verificação a string completa foi para o chat.
   Regra: **uma ferramenta de ligação devolve host, comprimento e booleanos — nunca o
   texto do segredo.**
4. **Variáveis `sensitive` na Vercel não se podem corrigir.** `edit_project_env` aceita
   **só** `value` num `PATCH`; meter `type` ou `key` no corpo dá `400 You cannot change
   the type/key of a Sensitive Environment Variable`, e um valor rejeitado **não altera o
   registo**. O MCP da Vercel não expõe `delete_project_env`, por isso uma variável criada
   como `sensitive` fica ilegível para sempre — inclusive para quem a escreveu. A fonte da
   verdade das ligações é o Neon. E verificar a escrita faz-se pelo `updatedAt` de
   `filter_project_envs`, **antes** de disparar o `redeploy`.
5. **Um redeploy a partir de um deployment anterior herda as variáveis do projeto, não as
   do deployment antigo** — por isso o corte exige escrever primeiro e só depois
   `create_deployment` com `forceNew: '1'`. O contrário já nos apanhou na A7: mudar a
   variável sem `redeploy` deixa a app a servir da base velha.

**Como se prova qual das duas bases está a servir, sem dump nem log:** `pg_stat_user_tables`
lado a lado. Na A5 bateram-se 12 tentativas de entrada em produção e o `seq_scan` de `user`
subiu 19 → 27 no destino, ficando **exatamente igual** na origem. O `/api/health` só faz
`SELECT 1` e não distingue uma base da outra, por isso não serve de prova sozinho.
