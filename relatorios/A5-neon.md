# A5 — Levar os dados para o projeto Neon próprio

Executada **19/11/2026, ~19:25Z → 19:52Z**, por mim (Lead), na janela que o utilizador autorizou com um
«agora». Não é código: é produção, por isso não passou pela cadeia Dev → QA → Revisor — o QA vem provar
depois, como combinado na abertura da vaga.

Resultado: **a app vive agora no projeto `Financas_Pessoal` (`cold-pond-15149007`, `us-east-2`).** Os
dados estão copiados e provados byte a byte, a Vercel aponta para o endpoint novo e está reimplantada, e
**nada foi apagado**: o ramo emprestado no projeto do chofer continua vivo com os mesmos 158 linhas.

## A rota que se mudou pelo caminho

O plano de 18:50Z dizia `pg_dump | psql` em Docker. **Inexecutável nesta máquina, medido antes de
começar:** o `com.docker.service` está `Stopped`, o WSL `docker-desktop` está `Stopped`, o daemon devolve
`500 Internal Server Error ... dockerDesktopLinuxEngine`, e `pg_dump`/`psql`/`pg_restore` não existem no
PATH. A rota escolhida foi **`postgres_fdw`**: liga-se a origem ao destino dentro do próprio servidor e
copia-se com `insert into … select`. Serve para isto porque 11 MB / 158 linhas é uma migração de minutos,
não de horas.

Ganhou mais uma razão no caminho: **nenhuma palavra-passe nem nenhum dado passaram por este chat.** A
ponte foi montada e desmontada por SQL, e as credenciais nunca saíram do servidor.

## A sequência, com a hora de cada passo

| Hora (Z) | Passo | Prova |
| -------- | ----- | ----- |
| 18:50 | Medição dos dois lados por API (registo na vaga 6) | mesma versão PostgreSQL (18.7) nos dois endpoints |
| ~19:25 | Ponte no destino: `create extension postgres_fdw`, `create server src_old_fire`, `create user mapping` | primeira importação falhou com `type "public.CategoryKind" does not exist` — os `CREATE TYPE` têm de vir antes |
| ~19:30 | **DDL do schema no destino**, 74 statements numa transacção | 20 enums, 27 tabelas (302 colunas com tipo/nulosidade/valor por omissão), 27 chaves primárias, 275 checks/únicas. `run_sql_transaction` → 74/74 aplicados |
| ~19:33 | Carga `import foreign schema` + `insert into public.<t> select …` tabela a tabela | **158 linhas**, 27/27 tabelas com contagem devolvida |
| ~19:35 | 76 índices não-constraint + 52 chaves estrangeiras + `analyze` (129 statements) | 129/129 aplicados |
| ~19:36 | **Verificação**: estrutura e soma de verificação por tabela, origem vs destino | 27/27 `md5` iguais, 302 colunas, 285 constraints, 103 índices, 20 enums nos dois lados |
| 19:37:35 | Estado antes do corte | `GET /api/health` → 200, `database.reachable: true` (ainda na origem) |
| 19:38:52 | `DATABASE_URL` → host `-pooler` de `ep-wispy-sky-b4e0sr8e` | `filter_project_envs`: `updatedAt 19:38:52Z` |
| 19:38:53 | `DIRECT_URL` → host directo do mesmo endpoint | `updatedAt 19:38:53Z` |
| 19:39:41 | `create_deployment` com `deploymentId` da produção anterior, `target: production`, `forceNew` | `dpl_BcvdsMwRyMMQZDGWGFGna2CX89Df` |
| 19:41:06 | Deploy `READY` e corte feito | 200, `uptimeInSeconds: 12` — a instância a servir é a nova |
| 19:42:05 | 20 pedidos de santé em paralelo | 20/20 HTTP 200 |
| ~19:43 | **Prova de que é o destino que serve** (ver abaixo) | origem sem variação; destino com `user` 19 → 27 |
| ~19:45 | Deriva da janela cópia→corte, linha a linha | 0 ausentes, 0 divergentes, 0 a mais |
| ~19:50 | Ponte desmontada: `drop schema fdw_src cascade`, `drop server src_old_fire cascade` | 0 esquemas `fdw_src`, 0 servidores estrangeiros, 0 tabelas estrangeiras |
| ~19:52 | **Palavra-passe da origem rodada** | a que tinha caído no chat deixou de abrir; a nova nunca foi impressa |

*As horas das variáveis, do deploy e da santé vêm dos objectos da Vercel; as das etapas de SQL são
inferidas da ordem das chamadas (±2 min).*

## Prova

### 1. Contagem igual tabela a tabela (o ponto 2 do critério)

Medida nos dois lados, na mesma chamada, depois de tudo estar montado:

| Tabela | Origem | Destino | |
| ------ | -----: | ------: | - |
| `_TransactionTags` | 0 | 0 | ✅ |
| `_prisma_migrations` | 2 | 2 | ✅ |
| `account` | 2 | 2 | ✅ |
| `account_group` | 0 | 0 | ✅ |
| `account_group_item` | 0 | 0 | ✅ |
| `asset` | 0 | 0 | ✅ |
| `budget` | 1 | 1 | ✅ |
| `budget_limit` | 3 | 3 | ✅ |
| `category` | 58 | 58 | ✅ |
| `credit_card` | 2 | 2 | ✅ |
| `financial_account` | 5 | 5 | ✅ |
| `goal` | 1 | 1 | ✅ |
| `goal_movement` | 3 | 3 | ✅ |
| `invoice` | 4 | 4 | ✅ |
| `invoice_payment` | 1 | 1 | ✅ |
| `liability` | 0 | 0 | ✅ |
| `locked_balance` | 0 | 0 | ✅ |
| `month_close` | 0 | 0 | ✅ |
| `receivable_payable` | 0 | 0 | ✅ |
| `receivable_payable_payment` | 0 | 0 | ✅ |
| `recurrence` | 2 | 2 | ✅ |
| `session` | 18 | 18 | ✅ |
| `tag` | 0 | 0 | ✅ |
| `transaction` | 52 | 52 | ✅ |
| `transaction_rule` | 2 | 2 | ✅ |
| `user` | 2 | 2 | ✅ |
| `verification` | 0 | 0 | ✅ |

**158 = 158, 27/27.** Contagem sozinha não prova conteúdo, por isso foi junta uma **soma de verificação**:
`md5(string_agg(t::text order by t::text))` por tabela, com a sessão a fixar `TimeZone=UTC` nos dois lados
para o texto das datas não enganar. **27 tabelas com o mesmo `md5`** — o conteúdo é igual, não só o
tamanho. O repositório não tem uma única `SELECT *` textual (verificado por `git grep`), por isso a ordem
das colunas não pode fazer diferença no comportamento da app.

### 2. Estrutura

302 colunas, 285 constraints (27 primárias + 52 estrangeiras + restantes), 103 índices e 20 `enum` nos
dois lados, com as definições comparadas como conjuntos: **zero diferenças**. A única divergência possível
era cosmética: a `goal` da origem tem um buraco no número interno das colunas (`attnum` 17 com 16
visíveis, marca de uma coluna antiga eliminada) e no destino as colunas ficaram corridas. **Nomes, ordem,
tipos, nulosidade e valores por omissão são iguais** — o `attnum` não é uma identidade pública nem entra
no SQL do Prisma.

### 3. Produção

- `GET /api/health` → **200**, `database.reachable: true`, `uptimeInSeconds: 12` nos primeiros segundos
  depois do `READY`, e **20/20 pedidos em paralelo a devolver 200**.
- A peça que a A7 ensinou está cumprida: as variáveis foram escritas **e** houve `redeploy`; sem o
  `redeploy` a instância antiga continuava a apontar para a origem.

### 4. De onde é que a app está a ler — a prova que faltava

O `/api/health` só faz `SELECT 1`, que não distingue uma base da outra. Então mediu-se **por contadores
de varrimento** (`pg_stat_user_tables`), com tráfego provocado de propósito:

| | Antes | 12 tentativas de entrada + 10 páginas | Depois |
| --- | --- | --- | --- |
| Origem `user` | seq 6347 | — | **seq 6347 (inalterado)** |
| Destino `user` | seq 19 | — | **seq 27** |

Nenhuma das 12 tentativas (`401 Invalid email or password`) tocou a origem; todas bateram no destino. As
contas de `transaction`/`category` ficaram iguais nos dois lados, `session` 18 = 18, `user` 2 = 2.
**É a base nova que a app lê e onde escreve.**

### 5. A janela entre a cópia e o corte

Entre ~19:33 (carga) e 19:41 (corte) a origem ainda era a base servida, por isso qualquer escrita nesse
intervalo teria ficado de fora da cópia. Foi medida, linha a linha, por chave primária (as 27 tabelas
têm-na), através da ponte, antes de a desmontar:

**0 linhas na origem sem cópia no destino, 0 linhas copiadas com conteúdo diferente, 0 linhas do destino
sem origem** — nem `session`: as sessões activa-se antes do corte não escreveram nada. Não houve
deriva.

## O que correu mal (e o que fica de regra)

1. **Vendi uma rota que a máquina não tem.** O plano de 18:50Z prometia `pg_dump` em Docker sem ter
   verificado o daemon. Regra: medir a ferramenta *antes* de oferecer a rota, não durante.
2. **Um erro meu deixou uma palavra-passe no chat.** Uma chamada a `get_connection_string` com
   `pooled:false` (parâmetro que o Neon ignora: devolve sempre o host `-pooler`) imprimiu a string
   completa da origem e o meu resumo com máscara avariada mostrou-a. Foi rodada às ~19:52Z e já não abre
   nada. Regra que fica: **nenhuma ferramenta devolve texto de segredo para o resultado**; só comprimentos,
   hosts e booleanos.
3. **Disparei um `redeploy` antes de confirmar a escrita.** A primeira tentativa de escrever as
   variáveis falhou em silêncio e eu criei o deployment à mesma; cancelei-o (`dpl_4m7EVvEzHxsbsjWW9oWuzYMYVSuX`)
   sem ele ter servido tráfego. Regra: **ler o `updatedAt` da Vercel antes de tocar no deploy**.
4. **O modo `sensitive` é uma armadilha de escrita.** `edit_project_env` recusa mudar o `type` de uma
   variável sensível (`400 You cannot change the type of a Sensitive Environment Variable`) e recusa mudar
   a `key`; o `PATCH` que aceita leva **só** `value`. E como o MCP da Vercel não expõe
   `delete_project_env`, não há como as reconverter em `encrypted`: continuam ilegíveis para mim.
   A fonte da verdade das ligações é a Neon.
5. **Três dialetos que a API HTTP do Neon não aceita**: `import foreign schema … options (import_collate
   false)` (`42601`), `unnest(…) with ordinality as k(a,b)` (`42601` — contorna-se com
   `generate_subscripts`), e `run_sql` com `params:` (`08P01`, o `prepare` leva 0 parâmetros). Nada disto
   é erro de lógica; é lista de comandos a evitar.
6. Os dados de 58 categorias, 52 movimentos e 18 sessões **não saíram das duas bases** — não há dump em
   disco nem linha de dados no chat.

## Prova do QA — **PASS** (relatório: `relatorios/A5-qa.md`)

O QA reproduziu P1–P4 com chamadas dele às ~19:58–20:02Z e deu **PASS**, remetendo os pontos 5 e 6
para o utilizador. Confirmou com milissegundos os `updatedAt` das variáveis (`.757` / `.205`), as
9 tabelas de `neon_auth`, 158 = 158, e 10 tentativas de entrada dele com a origem **inalterada** e o
destino a mexer.

Dois buracos do relatório dele, que fechei eu às **20:04–20:06Z** com medição própria:

| | O que faltava ao QA | O que medi eu |
| --- | --- | --- |
| conteúdo | P2 só por contagem — sem hash | **27/27 `md5` iguais, 158 = 158**, repetido **depois** do corte e das sondas dele |
| deployment | «não consultei `get_deployments` para confirmar o ID e o `READY`» | `list_deployments` → `dpl_BcvdsMwRyMMQZDGWGFGna2CX89Df`, **`state: READY`**, `githubCommitSha: 52432be…`, criado 19:39:41Z, `url: financias-pessoais-3tittgr6t-rafaelfas-projects.vercel.app` |
| varrimentos | só o par dele (destino 36 → 37, origem 6354 = ) | 6 tentativas minhas: destino **40 → 45**, origem **6355 → 6355** — mesma direção, noutro instante |
| app na base nova | santé 200 | santé 200 + **`GET /api/cron/recurrences` → 401**, `POST` → 405, caminho inventado → 404: a rota da T70 está publicada em cima da base nova |

Reparo que fica para as próximas voltas do QA: **contagem igual não prova conteúdo** — é o hash que
prova. E os contadores da origem **não são uma linha de base absoluta**: sobem com qualquer leitura,
incluindo as minhas (o `md5` que corri em cima das 27 tabelas de origem varre `user`, e é a explicação
mais provável para 6354 → 6355 entre as duas medições). O que sustenta a conclusão não é «a origem não
anda», é o **par dentro da mesma janela de sondas**: 12 tentativas → origem exatamente 6347 e destino a
subir (19:43); 10 tentativas do QA → origem 6354 igual; 6 minhas → origem 6355 igual, destino 40 → 45.

## Estado do critério de fecho (os 7 pontos)

| # | Ponto | Estado |
| - | ----- | ------ |
| 1 | Cópia só do `public`, sem tocar em `neon_auth` | ✅ 27 tabelas em `public`, 9 em `neon_auth` — medido por mim **e** pelo QA, nos dois momentos |
| 2 | Contagem igual tabela a tabela | ✅ 27/27, 158 = 158, com `md5` por tabela igual nos dois lados (repetido 20:04Z, depois do corte) |
| 3 | Vercel reposta **e** reimplantada | ✅ hosts `ep-wispy-sky-b4e0sr8e` (+`-pooler`), `dpl_BcvdsMwRyMMQZDGWGFGna2CX89Df` `READY` — `updatedAt` confirmado pelo QA ao milissegundo e o `state: READY` lido por API às 20:04Z |
| 4 | Prova em produção, pela app e pela base | ✅ santé 200/200 e varrimentos a baterem no destino, em três voltas independentes (19:43 minha, ~20:00 do QA, 20:05 minha) |
| 5 | `SMOKE_DATABASE_URL` trocado pelo utilizador | ⏳ **à espera dele** — o valor actual aponta para a origem, cuja palavra-passe foi rodada hoje; o fumo parte com `authentication failed` |
| 6 | Ramo de teste movido em passo próprio | ⏳ **à espera de decisão** — perguntei se entrava nesta vaga e ficou sem resposta; `testes-e2e` continua no projeto do chofer |
| 7 | Nada se apaga nesse dia | ✅ origem viva com 27 tabelas / 52 movimentos; reaping no máximo **26/11**, só com ele a pedir |

## Achados que deixo para a próxima volta

- **F-A5-1 — a produção está uma migração atrás do `main`, e o `MAPA.md` dizia o contrário.**
  `_prisma_migrations` do ramo de produção tem **2** registos; há 3 pastas em
  `packages/db/prisma/migrations/`. Faltou `20261103203748_remove_goal_movement_yield`, e a prova de que
  nunca correu na produção é o `enum`: **`DEPOSIT, WITHDRAWAL, YIELD`** na origem e no destino copiado.
  Medido hoje nos três ramos:

  | Ramo | `_prisma_migrations` | `GoalMovementType` |
  | ---- | -------------------: | ------------------ |
  | produção antiga `br-patient-mud` | 2 | com `YIELD` |
  | novo projeto `br-rough-bird` | 2 | com `YIELD` |
  | testes `br-damp-math` | **3** | `DEPOSIT, WITHDRAWAL` |

  O `MAPA.md:148-154` («três aplicadas», medido 18/11 com a `DATABASE_URL` do `.env`) **meiou o ramo de
  teste e chamou-lhe produção** — o `.env` desta máquina aponta para `ep-spring-mud`, não para a
  produção. Já está corrigido lá.
  Custo real: nenhum por agora — as 3 linhas de `goal_movement` são todas `DEPOSIT`, portanto o
  `USING ("type"::text::…)` da migração não apanha um `YIELD` pelo caminho. Mas **o primeiro
  `pnpm db:migrate` em produção aplica a migração**, e isso é decisão do utilizador, não minha.
- **F-A5-2 — o destino tem Neon Auth montada** (9 tabelas em `neon_auth`, de 01/11) que esta app não usa:
  a autenticação é better-auth, com as tabelas todas em `public`. Não incomoda nada, mas é superfície de
  ataque que ninguém pediu; decide-se se se desliga.
- **F-A5-3 — o `postgres_fdw` fica instalado no destino** como extensão. Não há servidor estrangeiro nem
  tabelas estrangeiras; só o `create extension` sobrevive à desmontagem.

## Custos reais da janela

A app nunca esteve inacessível: o corte foi feito por `redeploy` com a instância nova em `READY` aos
19:41:06Z, e o único intervalo em que as duas ligações coexistiram foi o da escrita das variáveis (19:38:53
→ 19:41:06, **2 min 13 s**), durante o qual a instância antiga continuou a servir da origem. Não houve
perda de escrita nesse intervalo, como se mediu no ponto 5.
