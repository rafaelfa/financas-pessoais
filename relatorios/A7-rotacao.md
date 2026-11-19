# A7 — Rodar a palavra-passe da Neon

Executada **19/11/2026, 15:59Z → 16:12Z**, por mim (Lead), com o utilizador a autorizar o scope da
Vercel às 15:52Z. Não é código: é produção, por isso não passou pela cadeia Dev → QA → Revisor.

## O que estava escrito antes, e o que era errado

`DECISOES.md` (19/11, 13:51Z) media bem e inferia mal. A medição: as três ligações do projeto
`old-fire-26176066` saíam da API **com a mesma palavra-passe** — `production` (diário),
`Financas_Pessoal` (esta app) e `testes-e2e`. A inferência: «rodar a palavra-passe parte os três ao
mesmo tempo». **Falso.** A palavra-passe é **por ramo**; o que os três partilhavam era o *valor*,
copiado na criação dos ramos. Medido durante a execução:

| Momento | diário (`br-snowy-dew`) | finanças (`br-patient-mud`) | testes (`br-damp-math`) |
| ------- | ----------------------- | --------------------------- | ----------------------- |
| antes de qualquer reset | `…yI` | `…yI` | `…yI` |
| depois de reset em `br-snowy-dew` | `…gD` | `…yI` | `…yI` |
| depois de reset em `br-patient-mud` | `…gD` | `…Fn` | `…yI` |
| depois de reset em `br-damp-math` | `…gD` | `…Fn` | `…EI` |

Consequência prática: a janela que vendi ao utilizador («as duas produções em baixo») só se tornou
real porque **rodei os três ramos um a um** — o primeiro por engano, já que o passo 1 do plano dizia
apenas «`old-fire-26176066` → Reset password de `neondb_owner`» sem dizer em que ramo. Rodei o do
diário primeiro. O diário esteve em baixo **13 minutos** (15:59 → 16:12); esta app, **12** (15:59 →
16:09). Nada disto atingiu a base `cold-pond-15149007` (projeto `Financas_Pessoal` em `us-east-2`),
que tem outra palavra-passe (`…Om`) e não é usada por este repositório — verificado por leitura dos
hosts do `.env` e das variáveis da Vercel.

## A sequência, com a hora de cada passo

| Hora (Z) | Passo | Prova |
| -------- | ----- | ----- |
| 15:52 | Utilizador autoriza o scope `rafaelfas-projects` | `get_git_deployment_context` deixa de dar 403 e lista os três projetos |
| 15:58 | Estado antes da janela | `GET /api/health` → 200, `database.reachable: true`, `uptimeInSeconds: 2` |
| 15:58 | `CRON_SECRET` criado na Vercel (dev/preview/production), `type: sensitive` | id `6bxoHWSFRHAgewl4`; valor novo, 64 hex, gerado por CSPRNG local, nunca reutilizado do `.env` |
| 15:59 | Reset 1 — `br-snowy-dew` (ramo `production` do diário) | API devolve palavra-passe nova, 16 carateres |
| 16:00 | Reset 2 — `br-patient-mud` (produção desta app) | idem |
| 16:03 | `DATABASE_URL` + `DIRECT_URL` repostas na Vercel desta app | hosts `ep-young-poetry-b1nqzwit-pooler` e `ep-young-poetry-b1nqzwit` |
| 16:03 | `DATABASE_URL` + `DIRECT_DATABASE_URL` repostas na Vercel do diário | hosts `ep-frosty-water-b1nyzzpu-pooler` e `ep-frosty-water-b1nyzzpu` |
| 16:04 | Reset 3 — `br-damp-math` (ramo de teste da suíte e2e) | idem |
| 16:06 | `.env` desta máquina atualizado (`DATABASE_URL`, `DIRECT_URL` → `ep-spring-mud-*`; `CRON_SECRET` → o valor novo) | releitura do ficheiro: hosts certos, três ocorrências do segredo, ficheiro de 646 bytes |
| 16:07 | Redeploy de produção desta app (redeploy do `dpl_CKSz…`, commit `3ff0b25`) | `dpl_2c8dwnujGpo77eX2Qmu822BTSgf4` → READY |
| 16:08 | Redeploy de produção do diário (redeploy do `dpl_9Via3…`, commit `3486bbf`) | `dpl_Djxa1i9E5k8GtHipo3o7T5yu2cNF` → READY |
| 16:09 | **`GET https://financas-pessoais-psi-lac.vercel.app/api/health` → 200, `database.reachable: true`** | instance fresca (`uptimeInSeconds: 32`), logo com as variáveis novas |
| 16:10 | Rota do cron em produção, sem escrever nada: sem header → **401**, header errado → **401**, header curto → **401** | `{"error":"Não autorizado."}` nos três; a rota está montada e o guarda responde |
| 16:11 | Base do diário lida com a palavra-passe nova | `run_sql` no ramo `br-snowy-dew` → `neondb`, 8 tabelas |
| 16:12 | Suíte e2e contra o ramo de teste com a palavra-passe nova | `playwright test e2e/46-cron-recorrencias.spec.ts` → **3 passed (37,3 s)**, com `created:3` → `created:0` e o utilizador de teste apagado |

## Porque é que o redeploy era obrigatório

Alterar variáveis num projeto da Vercel **não** altera a instância que está a servir: o par
ambiente→valor é congelado na criação do deploy. Por isso, entre 15:59 e 16:09 as duas apps estavam
mesmo em baixo — o `database.reachable` delas apontava para uma palavra-passe morta. Só o redeploy
(16:07 / 16:08) com as variáveis repostas (16:03) é que as levantou. O plano de `DECISOES.md` não o
dizia; ficou aqui porque é a peça que torna a janela curta.

## O que não ficou feito

1. **`SMOKE_DATABASE_URL` (GitHub Actions deste repositório) continua com a palavra-passe velha.**
   Nem o `gh` nem a integração do OpenBot escrevem segredos do Actions: `GET
   /repos/…/actions/secrets/public-key` → **403 “Resource not accessible by integration”**, medido
   duas vezes. O `workflow_dispatch` do fumo é manual, por isso nada rebenta sozinho — mas o próximo
   fumo autenticado falha na ligação à base. Precisa de um token com `secrets: write` ou de ele ser
   colado à mão em *Settings → Secrets and variables → Actions*. O valor certo é a ligação do ramo
   `Financas_Pessoal` (o mesmo que a app em produção usa, porque o fumo escreve e apaga nessa base).
2. **O `CRON_SECRET` não foi provado em produção no caso positivo**, só nos três negativos: disparar
   a rota autenticada **escreve** na base de produção (gera os atrasos de verdade) e isso não estava
   autorizado. Fica para a primeira execução do próprio cron, às 02:00, ou para quando ele o pedir.
   Atenuante medido: é o mesmo mecanismo de variáveis que acabou de provar o `DATABASE_URL` novo —
   o `/api/health` verde às 16:09 só é possível com o segredo do banco do deploy.
3. **O diário não foi aberto no browser** por mim: provei a base dele por `run_sql` e o deploy por
   `READY` + 307 na raiz, mas não fiz login na app dele.

## Higiene

Os ficheiros temporários que esta operação criou em `D:/openbot/projetos-dev/financas-pessoais`
(`.tmp-cron-secret`, `.tmp-neon-url.txt`, `.tmp-tes-pooled.txt` e três `.ps1`/`.cjs` de serviço)
foram apagados no fim. Foi acrescentada uma linha ao `.gitignore` — `*.tmp-*` — para que um ficheiro
destes não entre na árvore por descuido numa próxima janela; nenhuma das ligações novas foi colada em
chat além do que a ferramenta de gestão de segredos exigia, e os valores vivem agora só na Vercel
(`sensitive`, não legíveis por API) e no `.env` desta máquina.

## Estado da dívida depois disto

O motivo da A7 — uma ligação válida colada no histórico de conversas desde 01/11 — deixou de existir:
esse valor já não abre nenhuma das três bases. **A5** (tirar esta app de dentro de um projeto Neon de
outra app) continua aberta e passa a ser barata na próxima rotação, exatamente como foi escrito: os
ramos já têm palavras-passe separadas, por isso rodam-se um de cada vez.
