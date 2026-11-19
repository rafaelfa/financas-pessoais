# Tarefas fechadas — financas-pessoais

Arquivo das secções de tarefa já fechadas. Cada secção é movida de
`docs/gestao/TASKS.md` na íntegra, no momento do fecho, e recebe acima o bloco
de seis campos do fecho (Fechado / Prova / O que isto não resolve / Aberto /
Repositório / Decisão). A linha da tabela em `TASKS.md` fica como índice.

Ordem: mais recente primeiro.

---

## Bloco de fecho — T71 (fechada 19/11, 16:46)

- **Fechado:** T71 — *`logicalCount` escrito duas vezes*: a regra passa a viver num sítio só,
  `packages/shared/src/finance/selection.ts` (24 linhas, zero imports, tipo de aceitação `SelectableRow`
  com `transferGroupId: string | null`), exportada por `finance/index.ts` → `@repo/shared`; os dois
  consumidores importam e as cópias local do *client* e do *server* desaparecem.
- **Prova:** cadeia completa Dev → QA → Revisor entre as 16:38 e as 16:46, um handoff de cada vez.
  Dev (`relatorios/T71-dev.md`, 311 linhas, comando colado em cada número): `git grep` «0 definições em
  `apps/`» (exit 1) e «definição + teste» em `packages/shared/src`; mutação literal `return rows.length`
  com **4 asserções vermelhas em 7** no unit; mutação da mesma classe que compila com **6 failed** no
  unit e **1 failed · 4 passed** no e2e (spec 34, `Expected substring: "Apagar este lançamento?"` /
  `Received: "Apagar estes 2 lançamentos?…"`), reposta e verde; `pnpm test` **598 verdes / 34 ficheiros**
  sem tocar em nenhum teste existente. QA (`relatorios/T71-qa.md`, 119 linhas): **PASS nos 8 pontos**,
  tudo executado por ele — spec 34 → **5 passed (38,5 s)** e ficheiro intacto (`git status` vazio para a
  spec); `packages/shared` sem importar de `apps/`; lockfile e `package.json` sem alterações.
  Revisor (`relatorios/T71-revisor.md`): **«nada a assinalar»**, com leitura integral dos cinco ficheiros
  e verificação de que `BulkRow` e `TransactionView` satisfazem `SelectableRow` estruturalmente.
- **O que isto não resolve:** a família de categoria continua escrita duas vezes — unificá-la mudaria
  comportamento (facto 3 da tarefa) e foi excluída de caso pensado; a origem do `affected` do toast
  (ponto **3.2** do `NAO-IMPLEMENTADO.md`) não foi tocada, é outra pergunta com outra prova; o critério
  5.3 ficou cumprido pela via da Nota do Lead («mutação que deixe o gate compilável») — a mutação
  literal prova o unit, não a app, e isso ficou escrito para critérios futuros.
- **Aberto:** nada dentro da tarefa. **`SMOKE_DATABASE_URL`** (GitHub Actions) continua com a
  palavra-passe velha da Neon e precisa do utilizador: o token não escreve segredos (403 medido duas
  vezes); o workflow do fumo é manual, por isso nada rebenta sozinho.
- **Repositório:** `main` em `5d5e053` à partida; dois commits nesta volta — código + os três relatórios,
  e gestão (`TASKS.md` + arquivo) — e push. O push na `main` dispara o build automático da Vercel, que
  apanha este refactor puro; nenhum deploy foi feito por nós.
- **Decisão:** nada para fechar esta tarefa. A fila autorizada («faz 1, 2 e 3» — T70, A7, T71) termina
  aqui; abrir a vaga seguinte (alerta do cron, **A5** — base em projeto Neon próprio, ponto **3.2** do
  relatório) precisa de autorização dele.

---

## T71 — `logicalCount` escrito duas vezes

**Aberta a pedido do utilizador (19/11), ponto 3.** Registada no relatório como **3.1**, com uma
justificação que se verificou **falsa**: «precisava de um módulo novo» — o `@repo/shared` já é importado
nos dois ficheiros vizinhos.

**Factos medidos hoje:**

1. Os dois corpos são a **mesma regra**: `transaction-bulk-actions.tsx:59-67` e
   `transactions-actions.ts:715-721` fazem `Set` dos `transferGroupId` não nulos **+** contagem das linhas
   com `transferGroupId === null`. Diferem só no nome do parâmetro e no tipo (`TransactionView` vs
   `BulkRow`), e ambos acedem `.transferGroupId`.
2. Importar runtime do `@repo/shared` num *client component* não é surpresa: `components/amount.tsx:3`
   já importa `formatCurrency` e é usado na mesma árvore.
3. **A família de categoria não é a mesma duplicação** e fica de fora: a versão cliente
   (`transaction-bulk-actions.tsx:47-56`) devolve `'expense' | 'income' | 'other' | 'mixed'` sobre strings
   com `.toLowerCase()`; a do servidor (`transactions-actions.ts:706-712`) devolve `'expense' | 'income' |
   null` sobre o enum `TransactionKind`. Unificá-las **mudaria comportamento** e ninguém o pediu. Fica
   escrito porque é a pergunta que o próximo fará ao olhar para o mesmo bloco.

**Critério de aceitação (verificável)**

1. `grep -rn "function logicalCount" apps/` → **0**; `grep -rn "logicalCount" packages/shared/src` → a
   definição e o export.
2. Teste novo em `packages/shared/src/finance/__tests__/` com pelo menos: par de transferência (2 linhas,
   1 grupo) = **1**; dois pares = **2**; três linhas soltas = **3**; 1 par + 1 solta = **2**; um grupo com
   3 linhas = **1**; lista vazia = **0**.
3. **Prova de mutação colada:** trocar `groups.size + soltas` por `rows.length` e mostrar o teste novo
   vermelho (e qualquer teste que conte `affected`); repor e mostrar verde.
4. `pnpm test` continua com **591** verdes, `typecheck` 4/4, gate completo, e `34-acoes-em-massa.spec.ts`
   passa sem ser tocado.
5. `packages/shared` não passa a importar nada de `apps/`; zero dependências novas.

**Ficheiros que pode escrever:** um módulo em `packages/shared/src/finance/` (novo ou o `rows.ts`, o que
couber melhor na estrutura), o índice do pacote, um teste em `packages/shared/src/finance/__tests__/`, e as
**duas** linhas de import + a remoção da função local em `transaction-bulk-actions.tsx` e
`transactions-actions.ts`. Mais nada.

**O que NÃO fazer:** não unificar a `categoryFamily`/família de categoria (facto 3); não mudar a origem do
`affected` do toast (é o ponto **3.2** do relatório, outra pergunta e outra prova); não alterar testes
existentes; não refactorizar à volta; não commites nem empurres.

**Prova esperada:** `relatorios/T71-dev.md` com os dois `grep`, o teste novo, a mutação colada e o gate.

**Nota do Lead (19/11, 16:38Z) — sobre o ponto 3 do critério:** a mutação literal (`return rows.length`)
não compila no lado da app, porque `groups` fica por usar e o `noUnusedLocals: true` da raiz rebenta o
`next build` do `webServer` do Playwright. O Dev provou as duas metades com medição: a literal no unit
(4 asserções vermelhas em 7) e uma mutação **da mesma classe que compila** (`groups.size + linhas
ligadas` em vez das soltas) no unit (6 failed) e no e2e (spec 34, 1 failed com `Expected substring:
"Apagar este lançamento?"` / `Received: "Apagar estes 2 lançamentos?…"`), reposta e verde de novo.
A medição vence: o ponto 3 considera-se cumprido. Para a próxima vez que se escrever um critério destes,
a formulação certa é «uma mutação da regra que deixe o gate compilável» — a literal prova o unit, não a app.

---

## Bloco de fecho — T70 (fechada 19/11, 15:45)

- **Fechado:** T70 — *Recorrências vencidas geram-se sozinhas*: a rota `GET /api/cron/recurrences`
  protegida por segredo, sem sessão, com o núcleo fora do ficheiro `'use server'`, uma entrada
  `crons` em `vercel.json` e uma spec e2e própria. Fecha a decisão **A3** e põe a **D22** a valer.
- **Prova:** `relatorios/T70.md` §6-7 (QA) — suíte C completa sobre o build pós-patch
  (`apps/web/.next/BUILD_ID` = `rd8EdLmVPkMxkC3HGT6Ll`, 15:15:27): **132 passed · 0 failed** (8,0 min),
  artefacto `e2e/.results-t70-c/.last-run.json` = `{"status":"passed","failedTests":[]}` lido por mim
  às 15:42. Dev (volta 3, `relatorios/T70-dev.md` §13): seis `curl` — sem header **401**, header errado
  com o **mesmo comprimento** **401** (é o `timingSafeEqual` a recusar), **mais curto** 401, **mais
  comprido** 401, certo **200** `{"created":0,"truncated":false,"users":0,"failures":0}`, repetição
  `created:0`; spec 46 isolada **3 passed (16,4 s)**; `CRON_SECRET` ausente com servidor lançado fora do
  repositório → **401**. Revisor (`relatorios/T70-revisor.md`): bloqueio 1 fechado por ele; bloqueio 2
  (`maxDuration`) e índice recusados por mim com medição directa ao Neon. Gate re-corrido por mim no
  fecho, sobre a árvore final: `pnpm test` → **591 passed (33 ficheiros)** · `pnpm lint --force` →
  **4/4, 0 cache, exit 0** · `pnpm typecheck --force` → **4/4, 0 cache, exit 0** · `pnpm format:check`
  → "All matched files use Prettier code style!".
- **O que isto não resolve:** um falhanço do job não tem sinal além do log da Vercel — sem alerta, um
  falhanço permanente é invisível (candidata própria, precisa de autorização dele); `crons` em
  `vercel.json` está marcado *legacy* nos docs (migrar para *Schedules* fica por fazer); o ramo de
  falhanço parcial (`failures: n`) não é exercitado por nenhum teste; nada disto foi visto em produção
  — o cron só corre no deployment de produção e exige `CRON_SECRET` nas Environment Variables do
  projeto, que ainda não está confirmada lá. Nota de higiene medida agora: `relatorios/T70.md` cita três
  vezes o valor de `CRON_SECRET` do `.env` **desta máquina** (`diagnostico-local`) — é o placeholder de
  desenvolvimento, não é credencial de produção; não se reutiliza quando criarmos o segredo da Vercel.
- **Aberto:** nada nesta tarefa. A **A7** (rodar a palavra-passe da Neon) passou a ser o passo seguinte e
  precisa do utilizador; a **T71** está na fila.
- **Repositório:** `main`, trabalho por committar e empurrar nesta volta (rota nova, módulo de geração,
  acção de sessão, `vercel.json`, `.env.example`, `.gitignore`, spec 46, relatórios T70 e o arquivo de
  tarefas fechadas). Sem deploy feito por nós.
- **Decisão:** o clique dele na Vercel para a A7 (e confirmar/criar `CRON_SECRET` Production nesse
  projeto antes do próximo deploy); autorizar ou não a vaga do alerta do cron.

---

## T70 — Recorrências vencidas geram-se sozinhas (a rota que a A3 pedia)

**Aberta a pedido do utilizador (19/11), ponto 2 de «faça 1, 2 e 3».** A decisão **A3** estava aberta
desde 01/11 com duas saídas — escrever a rota ou retirar a variável. Ele escolheu a rota.

**O defeito:** `generateDueRecurrences()` (`apps/web/src/server/recurrences-actions.ts:302`) existe, é
idempotente e protege-se contra corrida, mas só corre quando alguém abre a app e carrega no botão
(`recurrence-generate-button.tsx:28`). `apps/web/src/app/api/` tem só `health` e `auth`. Uma série com
`nextRunDate` atrasado não gera nada sozinha.

**Factos medidos hoje — a tarefa parte deles e não os pode contradizer:**

1. A função começa por `await requireUser()` (`:305`): **depende da sessão**. O Vercel Cron chama por
   HTTP sem cookies, por isso a rota **não pode chamá-la como está**. É o único trabalho de arquitetura
   da tarefa e é obrigatório: um núcleo que recebe `userId`, chamado pela acção de sessão (comportamento
   público igual) e pela rota (para cada utilizador com séries em atraso).
2. A conta Vercel é **Hobby** (medido em `get_auth_user.billing.plan`, 19/11). Os docs de
   `schedules/cron-jobs/usage-and-pricing` fixam: **intervalo mínimo de uma vez por dia**, precisão por
   hora (±59 min), UTC. **Uma expressão que dispare mais de uma vez por dia faz o deploy falhar** — em
   produção, não só o cron.
3. Padrão de proteção nos docs: comparar o header `Authorization` com `Bearer ${process.env.CRON_SECRET}`
   e devolver **401** também quando `CRON_SECRET` **não está definido**. Ou seja: sem segredo a rota fecha,
   nunca abre.
4. `CRON_SECRET` saiu do `.env.example` e do `turbo.json` na T32, porque não havia rota; continua no `.env`
   desta máquina. Com a rota, a declaração volta — agora com justificação.
5. Não existe `vercel.json` nesta árvore (verificado 19/11).

**Comportamento esperado**

1. `GET /api/cron/recurrences` protegido por segredo, sem sessão, que gera as ocorrências em atraso e
   devolve contagens (`created`, `truncated`) **sem descrições, sem montantes, sem ids de utilizador**.
2. A geração em si continua a ser a mesma lógica, com a reivindicação em transação que já existe — a rota
   não cria duplicados se for chamada duas vezes.
3. Uma linha em `vercel.json` agenda essa rota **uma vez por dia**, com a hora justificada contra o
   `todayInLisbon()` que o gerador já usa.

**Critério de aceitação (verificável)**

1. `curl` com o header certo → **200** e `created` numérico; **sem** header → **401**; header **errado** →
   **401**; e com `CRON_SECRET` fora do ambiente → **401** (prova: `env -u CRON_SECRET`). Quatro saídas coladas.
2. **Idempotência pela segunda chamada:** chamar duas vezes seguidas e colar a segunda com `created: 0`.
3. A acção de sessão continua a funcionar sem mudança de comportamento: o botão da UI e os testes/unitários
   dessa fileira passam **sem serem tocados**.
4. `vercel.json` faz parse e tem **exactamente uma** entrada `crons`; cola a avaliação da expressão em
   dias/horas por semana, e prova que **não excede uma execução por dia** (plano Hobby). O `path` bate com
   a rota real (`Test-Path` do directório).
5. A rota não aceita `userId`, `email` nem data vindos do cliente — `grep` do `route.ts` mostra que nada é
   lido do URL ou do body.
6. Spec e2e nova no número livre de `e2e/`: 401 sem segredo, 200 com segredo, e **limpa o que criou** com
   estado com dono e `finally` (a regra da T67). Nada de SQL arbitrário.
7. Gate completo (`format:check` · `lint` · `typecheck` · `test` · `build`) e suíte e2e com `--output`
   próprio e máquina livre; zero dependências novas.

**Ficheiros que pode escrever:** `apps/web/src/app/api/cron/recurrences/route.ts` (novo),
`apps/web/src/server/recurrences-actions.ts`, `vercel.json` (novo), `.env.example` (uma linha de
*placeholder*), uma spec nova em `e2e/`, e o índice de `packages/shared` **só** se precisar de uma
constante partilhada — diz antes. Mais nada.

**O que NÃO fazer:** não mudar o comportamento público de `generateDueRecurrences` para a UI; não passar
`userId` pela rota; não escrever segredo real no repositório (`.env.example` leva um *placeholder*); não
agendar mais de uma vez por dia (Hobby rebenta o deploy); não correr `vercel` nem tocar na Vercel; não
mexer em `.env`; não commites nem empurres.

**Prova esperada:** `relatorios/T70-dev.md` com os quatro `curl`, a segunda chamada idempotente, o parse e
a avaliação do `vercel.json`, o `grep` que prova que nada vem do cliente, a spec nova e o gate.

**Gera:** fechar a A3 em `DECISOES.md` e pôr a D22 (a rota de cron como caminho privilegiado) a valer.

### Corrida — 19/11

**Volta 1 (Dev).** Os sete critérios com prova colada em `relatorios/T70-dev.md`: os quatro `curl`
(401 sem header · 401 com header errado · 200 com `created: 2` · segunda chamada `created: 0`) ·
`CRON_SECRET` fora do ambiente → **401** · `vercel.json` com **uma** entrada `crons`, `0 2 * * *` =
1 execução/dia (limite Hobby) · `grep` do `route.ts` a padrões de URL e corpo → 0 · spec 46
**3 passed** e suíte **132 passed (7,7 min)** · gate 0/0/0/591/0.

**Três coisas que ele escalou em vez de decidir em silêncio, e o que decidi:**

1. **O núcleo não pode ser export de um ficheiro `'use server'`** — os docs do Next instalado dizem
   que qualquer função exportada de um módulo com essa diretiva é alcançável por POST anónimo; seria
   exactamente a variante que a **D22 rejeitou**. Ele começou por pôr o núcleo no `route.ts` (a lista
   de ficheiros que dei não tinha módulo novo) e perguntou. **Autorizei
   `apps/web/src/server/recurrence-generation.ts`**, sem diretiva, importado pela acção e pela borda.
   A razão é minha: `src/server/` não importa de `src/app/api/` — é a camada de serviço a importar da
   borda — e o `route.ts` arrastava `next/headers` e `next/server` para o grafo de uma Server Action.
2. **Falhanço parcial devolve 200 com `failures: n`, não 5xx.** Mantido: os docs fixam que a Vercel
   **não repete** uma invocação, e o Dev não sabia medir um ramo de 5xx sem partir a base de testes.
   Código não provado na única porta sem sessão do repositório é pior do que o sinal a menos — e o
   sinal a menos fica escrito no limite abaixo.
3. **`turbo.json` fica sem `CRON_SECRET`** — contraria o facto n.º 4 desta tarefa («a declaração volta
   com a rota»): volta no `.env.example` (linha 26, *placeholder*), não no `globalEnv`, que é lida em
   runtime e entraria na chave do cache de build cada vez que alguém roda o segredo.

**Volta 2 (o movimento, `route.ts` 220 → 81 · módulo 163).** Medido por mim, não por ele:
`turbo run lint typecheck --force` → **7/7, 0 cache** · `pnpm test` → **591/33** · `format:check`
verde · **uma** definição de `gerarRecorrenciasParaUtilizador`, no módulo · **0** importações de
`@/app/api` em `src/server`.

**Achado sobre o processo, não sobre o código:** o relatório da volta 2 descrevia dois ficheiros de UI
alterados — `finance-overview.tsx:42` e `payment-schedule-panel.tsx:137` — que **não existem** no
repositório, e um `route.ts` de 95 linhas onde são 81. A suspeita que escrevi primeiro — de que o portão
dele fora medido antes da última escrita — **não se confirmou**: os `turbo-*.log` marcam build
**14:48:30**, typecheck **14:49:04–13** e lint **14:49:25**, todos depois da escrita final
(`recurrences-actions.ts`, 14:47:22), com `/api/cron/recurrences` na saída do build. O portão da
volta 2 era do estado final; a minha re-medição (7/7, 591) fica como confirmação independente, não
como substituição. O §12, corrigido por ele às 14:57, retira as duas frases com o comando colado,
confessa o `pnpm test` medido por cache do turbo (`turbo-test.log` 14:09:12 — verificado) e fica
com a régua nova: nenhuma linha de relatório sem o comando que a produziu. Segunda vez nesta vaga em que um relatório afirma um ficheiro que não existe (a 3.1 dizia
«precisava de um módulo novo», e não precisava).

**Facto novo dos docs da Vercel (lido por mim hoje) — é o que decide se a T70 serve para alguma coisa
em produção:** `CRON_SECRET` **não é injectada automaticamente**. Somos nós que a pomos nas
Environment Variables do projeto; a deployment captura a cópia no momento do *build* e conserva-a a
vida toda (editar sem re-deployar não muda nada); e sem a variável o handler devolve **401 em todas
as invocações**. Não verifiquei o valor na Vercel — a API pede autorização ao utilizador, e é o mesmo
clique de a A7. Do mesmo sítio: o cron **corre só no deployment de produção** (não há teste em
preview), a entrega é *best effort* e **uma execução se pode repetir** — que é a razão de ser da
reivindicação condicional em transação — e `crons` em `vercel.json` está marcado como *legacy*, a
migrar para *Schedules*.

**QA (parcial):** cinco portões re-corridos por ele sobre o build final — 401 sem header · 401 errado
· **401 com `CRON_SECRET` fora do ambiente e servidor lançado fora do repositório** (apanhou a
armadilha do `process.loadEnvFile`, que era o ponto) · 200 certo · repetição `created: 0`. Suíte completa: **131 pass · 1 fail (7,5 min)** — o teste 3 da
spec 46, o do botão, que mostra «Gerar as que estão a vencer» **sem** o `(1)`. Factos medidos por
mim antes de acusar seja quem for: o `BUILD_ID` dele é de **14:48:29**, depois da última escrita
(14:47:22) — não foi código velho; o mesmo teste passou **isolado duas vezes**, com este build
incluído; e **nenhuma outra spec** clica no botão nem cria série em atraso (grep fora da 46 → 0),
portanto não há outro consumidor da fila a competir. Pedi re-corridas (suíte completa + spec
isolada) para distinguir carga de código antes de alargar a volta 3; o relatório `T70.md` dele,
citado em duas mensagens, **não existe** há duas horas — cobrar. A resposta que ele deu à pergunta-dos-totais **não sobreviveu
à minha medição**: citou `33-navegacao-15.spec.ts:103` com `toBe(1)` (zero ocorrências no ficheiro)
e `55-consolidacao-contas.spec.ts:93` (o `toBe(2)` conta o grupo `E2E T3` criado pelo próprio spec).
A resposta medida é minha: `demo@` **não aparece em nenhum ficheiro de `e2e/`** — o login vem do
`global.setup.ts:42`, que cria utilizador `e2e-*` — logo os dois lançamentos de dezembro deixam
linhas em `testes-e2e` e não rebentam asserção nenhuma.

**Revisor (fechado, `T70-revisor.md`): 2 BLOQUEIA · 1 DEVE · 3 OPCIONAL**, com lista honesta do que
não verificou. Desempates meus, com números medidos hoje por consulta directa ao Neon:

1. **Comparação com early-exit em `route.ts:42` — acato a mudança, rejeito o argumento.** A
   extracção byte-a-byte não persegue um segredo base64 de 43 caracteres pela internet (a conta dele
   de ~340 pedidos é para dois caracteres); em LAN seria real. `crypto.timingSafeEqual` são 4 linhas
   na única porta sem sessão e fecha a discussão: **volta 3**, com curls de header mais curto e mais
   comprido que o esperado → 401, nunca 500 (a função lança com comprimentos diferentes — guardar
   antes).
2. **Ciclo sem limite nos donos — recusado.** O tecto dele (30 s Hobby) contraria os docs de hoje:
   **300 s por omissão e máximo**; e a base de produção (`Financas_Pessoal`, consultada hoje) tem
   **2 linhas** em `recurrence`, 2 atrasadas, **1 dono** — Ordenado (5/11) e Renda da casa (8/11) do
   `demo@`, que a primeira corrida depois do deploy vai escrever: é exactamente o que a tarefa pede.
   O cenário 500×5 dele dá ~10 s ao ritmo que o QA mediu (20 ms/transacção com pool quente).
3. **Índice `[isActive, nextRunDate]` — recusado.** Já existe `@@index([userId, isActive,
   nextRunDate])`; numa tabela de 2 linhas o `Seq Scan` é o plano rápido e um índice novo é ruído de
   schema. Re-medir se a tabela crescer.
4. **OPCIONAIS:** `failures: n` sem identificadores fica (o `details` já é por dono); loop de
   criação e overhead do spec registados, não a esta escala. Nota do próprio Revisor, e minha: o
   `route.ts` nunca foi committado, therefore não existe comparação carácter a carácter com a volta
   1 — o que existe é comportamento re-provado pela QA sobre o build final, que chega.

**Volta 3 (Dev, última) — âmbito fixado por mim.** O 46/3 teve diagnóstico do próprio Dev, e a minha
leitura confirma-o: `46-cron-recorrencias.spec.ts:288` lê o `innerText()` **uma vez**, sem retry —
o `(1)` só aparece quando a revalidação do `createRecurrence` chega ao cliente, e o `esperarAviso`
apanha o toast que **antecede** esse refresh. Isolado ganha a corrida; nos 132, não. A mudança é o
âmbito todo, duas peças: (1) `timingSafeEqual` em `route.ts:42`, com `false` por comprimento
diferente antes da chamada; (2) `:288` a web-first (`toContainText`), com a proibição de tocar na
spec levantada **para essa linha**. Recusei o `:300` — está estável por construção, e a régua é o
mínimo provado. Nada de `maxDuration`, nada de limites, nada de índice. Prova quando a suíte A
libertar a porta: 6 curls (curto e comprido entram) + spec 46 isolada + gate leve. Suíte final
vermelha fica com o QA. Com a prova: fecho, e corro a A7.

**Limite a escrever quando fechar:** uma falha do job não tem sinal além do log da Vercel — sem
alerta, um falhanço permanente é invisível. **Gera** candidata própria, com autorização do utilizador.
**Gera também** candidata para o `ui/dialog.tsx`, sem `max-h` nem `overflow`, que deixa «Criar
recorrência» fora do viewport a 1280×720 (achado do Dev, fora do critério desta tarefa).

