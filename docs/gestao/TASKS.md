# Tarefas — financas-pessoais

Uma tarefa de cada vez. Uma tarefa só fecha com prova do QA.

Contexto obrigatório antes de pegar numa tarefa: `AGENTS.md` e `docs/gestao/MAPA.md`.

| ID  | Tarefa                                                                                                                          | Dono | Estado                                                          | Prova              |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------- | ------------------ |
| T1  | Repor o install e a formatação: lockfile com `react-hook-form`/`@hookform/resolvers`, 12 ficheiros formatados, `.gitattributes` | Dev  | **fechada** (Dev + QA + Revisor)                                | `relatorios/T1.md` |
| T2  | Fazer `lint`, `typecheck` e `build` verdes sem mudar comportamento (80 erros de tipo, 51 de lint)                               | Dev  | **fechada** (QA provou o cancelar em runtime)                   | `relatorios/T2.md` |
| T3  | Provar os ecrãs novos com e2e: criar, editar, pagar e apagar pela interface, com estado na base                                 | QA   | **fechada** (9 testes novos, 2 execuções seguidas, suite 30/33) | `relatorios/T3.md` |     | T4  | Atualizar `README.md` e `docs/plano/ESTADO-E-HANDOFF.md` para o estado real | Dev | **fechada** (verificado por `curl` e gate re-corrido) | —   |

## T1 — Repor o install e a formatação

**Porque:** o CI corre `pnpm install --frozen-lockfile` e falha no primeiro passo;
`pnpm format:check` falha em 12 ficheiros.

**Ficheiros que pode escrever:** `pnpm-lock.yaml`, `.gitattributes` (novo),
`.prettierignore` (uma linha: `apps/web/next-env.d.ts`), e **apenas** os 12
ficheiros que o `pnpm format` reescreve (lista em `docs/gestao/MAPA.md`, "Onde dói"
§2). Mais nada.

**Critério de aceitação (verificável):**

1. `pnpm install --frozen-lockfile` termina com código 0 numa pasta limpa
   (`rm -rf node_modules` antes, se possível num clone novo).
2. `pnpm format:check` termina com "All matched files use Prettier code style!".
3. `git diff --stat` não mostra alterações de lógica — só formatação e lockfile.
4. `pnpm test` continua com **522 testes** verdes.
5. `pnpm build` seguido de `pnpm format:check` continua verde (prova do
   `.prettierignore`; o `build` ainda falha por erros de tipo, isso é a T2).

**O que NÃO fazer:** não corrigir os erros de lint ou de tipo (é a T2), não mexer em
lógica, não mudar versões de dependências, não tocar em `docs/`, não commitar.

## Facto novo (2026-11-01): a produção está 8 commits atrás

O último deploy que subiu foi o `e4366ee`; os 8 commits seguintes falharam todos no
Vercel e no CI. Consequência prática: **nada do trabalho de outubro chegou ao ar** e
não há nada partido em produção. Detalhe em `MAPA.md` → "Produção, CI e Vercel".

| T5 | Pôr a produção a par do `main`: deploy e verificação autenticada nas 14 páginas | Lead | **fechada** (commit `2f84384`, CI verde, deploy `READY`, 14/14 a 200) | ver `MAPA.md` |

## T2 — Fazer o gate de tipos e lint passar

**Porque:** com a T1 feita, `pnpm install --frozen-lockfile`, `format:check` e `test`
ficam verdes; sobram 80 erros de tipo e 51 de lint, e `build` falha no type check.

**Medição de 2026-11-01** (`pnpm typecheck` e `pnpm build`, ambos): 80 erros em 7
ficheiros — 32 `TS6133` (código não usado), 28 `TS2339` (propriedade inexistente),
2 `TS7006`, 2 `TS2349`, 2 `TS2322`, 1 `TS6196`, 1 `TS2769`, 1 `TS2304`.
Os piores: `receivable-payable-dialog.tsx` (29), `account-group-dialog.tsx` (28).
Lint: 51 erros — 39 `no-unused-vars`, 6 `no-unescaped-entities`, 4 `no-explicit-any`,
1 `react/jsx-no-undef` (`<Checkbox>` sem import em `account-group-dialog.tsx:195`),
1 `react-hooks/set-state-in-effect`.

**Ficheiros que pode escrever:** apenas os que hoje falham —
`apps/web/src/components/{receivable-payable,account-group}-{dialog,list}.tsx`,
`apps/web/src/components/ui/{form,use-toast}.tsx`,
`apps/web/src/app/(app)/api/{account-group,receivable-payable}/route.ts`,
`apps/web/src/app/(app)/consolidacao-contas/page.tsx`,
`apps/web/src/app/(app)/contas-pagar-receber/page.tsx`,
`apps/web/src/server/{account-groups,receivable-payable-actions}.ts`,
`apps/web/src/lib/hooks/use-mobile.tsx`.

**Critério de aceitação (verificável):**

1. `pnpm typecheck` → 0 erros; `pnpm lint` → 0 erros; `pnpm build` → exit 0.
2. `pnpm test` continua com **522 testes** verdes — nenhum teste alterado.
3. `pnpm format:check` continua verde.
4. Nenhuma alteração de comportamento: os `select` do Prisma continuam a trazer o que
   o código usa, e o `<Checkbox>` passa a estar importado do sítio certo.
5. `git diff` limitado aos ficheiros acima.

**O que NÃO fazer:** não apagar funcionalidade para calar o lint (um import não usado
sai, uma condição `cardId` que o motor ignora **não** sai sem decisão), não desligar
regras do ESLint, não acrescentar `any` para calar `TS2339`, não tocar em `docs/`,
`README.md`, `e2e/` nem em testes, não fazer commit nem push.

## Registo de fecho — T1 (2026-11-01)

- **Dev:** `--frozen-lockfile` exit 0, `format:check` verde, 522 testes, `.gitattributes` criado.
- **QA:** repetiu tudo com `node_modules` apagado; comparou a AST dos 12 ficheiros → 0 diferenças de lógica. APROVADA. Prova em `relatorios/T1.md`.
- **Revisor:** 363 blobs verificados — nenhum texto com CRLF em `HEAD` (só 6 PNG binários); lockfile só acrescenta (25/0); 12 ficheiros cosméticos. APROVADA.
- **Objeção operacional do Revisor, a respeitar em todos os commits deste projeto:**
  `git status` mostra ~335 `M` dos quais ~320 são fantasma (bytes idênticos ao índice).
  **Commitar sempre com caminhos explícitos, nunca `git add -A` nem `git add .`.**
- Pendente: commit (aguarda decisão do utilizador).

| T6 | Variante `success` no `Badge` + token `--success` no `globals.css` para o estado "pago" deixar de sair sem cor | Dev | aberta (visual, depois de T4) | `relatorios/T6.md` |

## Estado medido da T2 (Dev, 2026-11-01) — confirmado pelo Lead

Repeti dois comandos por conta própria: `pnpm typecheck` → **0 erros** e nenhum
`*.test.ts` no diff. O diff são 16 ficheiros, todos dentro do âmbito.

**A T2 não foi só cosmética.** Os dois diálogos nunca renderizavam: usavam
`Content.Content`/`Content.Body` sobre um componente-função (que não tem essas
propriedades) e um `<radio>` minúsculo que não é elemento HTML. As props eram
`children` com um render-prop que nenhuma página usava, enquanto as páginas passam
`trigger`. Foram reescritos. Isto faz da T3 (prova de comportamento) obrigatória, não
opcional.

**Mudança de comportamento aceite (D5):** o guard "conta paga não se apaga nem se
reabre" passou a disparar de verdade. Antes `existing.status` era `undefined` em
runtime porque o `select` não o trazia, e a regra nunca corria. QA: isto é o
comportamento correto, não é regressão.

| T7 | Tornar os ecrãs novos funcionais: são server components com `console.log` nos botões — têm de chamar as server actions que já existem | Dev | **fechada** (Dev + QA + Revisor; 2 objeções corrigidas e provadas com base real) | `relatorios/T7.md` |
| T8 | Defeitos de dados da funcionalidade: `accountIds` descartado, cêntimos por vírgula flutuante e valor mostrado em cêntimos num campo «€» | Dev | aberta — junta à T7 num só passo | `relatorios/T8.md` |

## O que a T2 provou de mau (medido, 2026-11-01)

O gate está verde, mas a funcionalidade **não funciona**. Isto é o retrato real, com prova
em `relatorios/T2.md`:

1. **Os botões não fazem nada.** As páginas `contas-pagar-receber` e `consolidacao-contas`
   são _server components_ e os handlers são `console.log('Pagar conta:', id)`,
   `console.log('Apagar conta:', id)`, `onEdit={(item) => console.log('Editar:', item)}`
   (`page.tsx:27,32,92,111` e `:20,82`). As server actions existem e não são chamadas.
   As listas também não têm `'use client'`, por isso nem respondem a cliques.
2. **Submeter com erro não dá sinal.** O `FormMessage` não mostra nada, portanto o
   utilizador vê um botão que parece morto.
3. **O Zod descarta `accountIds`.** O formulário do grupo escolhe contas e o schema
   remove-as antes de chegar ao servidor: grupos ficam sempre vazios.
4. **Cêntimos em vírgula flutuante.** `19.99 * 100 = 1998.9999999999998` e o schema exige
   `.int()`: qualquer conta com cêntimos falha. Viola a regra nº 1 do `AGENTS.md`
   ("dinheiro é sempre cêntimos inteiros").

Consequência para o plano: **a T3 não pode provar o que está quebrado**; T7 e T8 vêm antes, e
o deploy (T5) não acontece com botões mortos.

## Registo de fecho — T2 (2026-11-01)

- **Dev:** gate 80→0 erros de tipo e 51→0 de lint; reescreveu os dois diálogos, que não
  renderizavam.
- **QA:** repetiu o gate com `.next` apagado; contou campos (9→9, 4→4); e provou o
  "Cancelar" **por execução** — bundle com esbuild, `fetch` espião e contador de eventos
  `submit`: Cancelar 0 submits e 0 pedidos nos 4 botões, submeter 1 submit e 1 POST.
  Prova em `relatorios/T2.md`.
- **Revisor:** objeção DEVE (Cancelar herdava `type=submit`) → corrigida e reprovada.
  Também corrigiu dois diagnósticos meus: a remoção do `tx.category.findUnique` era
  **correção real** (Prisma lança com `id: null`), não neutra.
- Gate final: `format:check`, `lint`, `typecheck`, `test` (522), `build` — todos exit 0.
- Pendente: commit (D4 — só no fim e com autorização).

## Objeção DEVE do Revisor na T2 (2026-11-01) — a corrigir antes de fechar

**O botão "Cancelar" dos dois diálogos não cancela: grava.** É um `<Button>` sem `type`
dentro do `<form>`; o HTML dá-lhe `type=submit` por omissão (`ui/button.tsx:43` não
define `type`). Está em 4 sítios:
`receivable-payable-dialog.tsx:319` e `:334`, `account-group-dialog.tsx:205` e `:220`.
O defeito já existia no `HEAD`, mas a reescrita tornou-o alcançável (antes os diálogos
nem renderizavam). Correção: `type="button"` nesses botões — e auditoria dos restantes
`<Button>` dentro de `<form>` nos dois ficheiros.

**Correção de registo:** eu tinha dito que remover o `tx.category.findUnique` não mudava
nada. O Revisor provou o contrário e tem razão: `categoryId` é `String?`
(`schema.prisma:1048`) e o Prisma **lança** com `where: { id: null }`. Ou seja, pagar uma
conta **sem categoria** abortava com erro. A remoção corrige um bug real, não apaga uma
verificação. Nem eu nem o QA tínhamos razão aqui.

## T7 — Tornar os ecrãs novos funcionais

**Porque:** hoje são uma maquete. Os botões têm `console.log` e as listas não são
componentes cliente, por isso nada reage. As _server actions_ já existem e estão
fechadas por `requireUser()` — falta chamá-las.

**Âmbito (medido em 2026-11-01):**

1. `apps/web/src/app/(app)/contas-pagar-receber/page.tsx` — `handlePay`, `handleDelete`
   e `onEdit` são `console.log` (`:27`, `:32`, `:92`, `:111`).
2. `apps/web/src/app/(app)/consolidacao-contas/page.tsx` — `onDelete` e `onEdit` são
   `console.log` (`:20`, `:82`).
3. `apps/web/src/components/receivable-payable-list.tsx` e `account-group-list.tsx` —
   sem `'use client'`, com `onClick` que nunca corre no servidor.
4. `FormMessage` não mostra nada: submissão inválida parece botão morto.
5. Os dois `<select>` de `receivable-payable-dialog.tsx` fazem `{...field}` sem valor
   inicial em `mode="create"` → campo não controlado que passa a controlado.

**Critério de aceitação:** editar, pagar e apagar mudam a base de dados e a lista
recarrega; um formulário inválido mostra a mensagem; sem `console.log` nos handlers;
o gate continua verde e os 522 testes continuam.

**Fora do âmbito (é T8):** `accountIds` descartado pelo Zod e cêntimos em vírgula
flutuante.

| T9 | Correr o e2e contra `next start` (build de produção) em vez de `next dev`: o _overlay_ de desenvolvimento interceta cliques | Dev | aberta | `relatorios/T9.md` |
| T26 | **Editar um lançamento pela interface dá HTTP 500** em produção: `updateTransaction` faz `createTransactionSchema.partial()` e o schema tem `superRefine`, que no Zod 4 lança | Dev | Dev done (67/67 e2e); em prova QA | `relatorios/T26.md` |
| T27 | **Editar uma transferência é impossível pela interface:** o diálogo envia sempre `accountId` e a ação recusa "por presença do campo", mesmo quando o valor não muda | Dev | aberta (achado da T26) | `relatorios/T27.md` |
| T10 | Investigar 3 e2e de `35-estado-transacoes` que falham | QA | **fechada** (localizador + sessão em falta; a 4.ª falha revelou a T26) | `relatorios/T10.md` |

## Baseline do e2e (2026-11-01, ramo Neon de teste)

`next dev` → 20/24 · `next start` → **21/24**. As 3 falhas são de
`35-estado-transacoes` e são pré-existentes (o formulário rápido não aparece em 20 s);
nenhuma toca em contas a pagar/receber. Detalhe e comandos em `MAPA.md`.

| T11 | `updateReceivablePayable` não escreve `type` e `updateAccountGroup` não escreve `accountIds`; o diálogo de criação aceita contas arquivadas | Dev | **fechada** (Dev 18/18, Revisor sem achados, QA 6/6) | `relatorios/T11.md` |
| T12 | Limpeza: rotas `/api/account-group` e `/api/receivable-payable` sem consumidor, e `payReceivablePayable` devolve `paymentId: 'payment-created'` fictício | Dev | aberta (após T3) | `relatorios/T12.md` |

## Defeitos que o Dev encontrou na T7 e não corrigiu (bem) — ficam registados

- `updateReceivablePayable` não escreve `type` → T11. Decisão de negócio pendente: tipo
  imutável (e então o formulário não o deve mostrar em edição) ou escrito (e então a
  action corrige-se). As duas são defensáveis; escolhe-se na T11, com prova.
- As duas rotas `/api/*` ficaram sem consumidor (a UI passou a usar as actions) e
  `payReceivablePayable` devolve um `paymentId` inventado → T12.
- A lista de contas do diálogo de pagamento não filtra arquivadas (o tipo das props só
  conhece `{id,name}`). Fica em T12.
- `accountIds` descartado e cêntimos em vírgula flutuante → T8, já aberta.

## Registo de fecho — T7 (2026-11-01)

- **Dev:** 6 `console.log` e os `fetch('/api/…')` fora; 3 componentes `'use client'`; diálogo de
  pagamento novo; `AlertDialog` a confirmar; e, na reabertura, `@hookform/resolvers`
  substituído por `apps/web/src/lib/zod-resolver.ts` (33 linhas, complexidade 5).
- **QA:** reprovou o ponto 5 na primeira passagem (causa raiz: `resolvers@3.3.0` lê
  `error.errors`, o Zod 4 expõe `error.issues`) e aprovou na re-prova com o harness
  reconstruído: **15/15**, mensagens visíveis, 0 chamadas à action em inválido, 1 em válido,
  0 `unhandledrejection`. Prova em `relatorios/T7.md`.
- **Limitações anotadas, não bloqueantes:** o adaptador usa chaves planas (`"a.b"`) e
  devolve `parsed.data`, que descarta `accountIds` — a segunda é a T8. O `as FieldErrors`
  é cast único e comentado; "zero casts" iria para a T12.
- Pendente: revisão de código e commit (D4).

## Reprovação da T7 pelo QA (2026-11-01) — causa raiz identificada

6 de 7 pontos passaram. O 5 falhou: **submissão inválida continua sem mostrar mensagem**,
que era exatamente o sintoma que a T7 tinha de matar.

Causa, provada pelo QA em Node e no browser com o diálogo real:
`@hookform/resolvers@3.3.0` espera `error.errors`; o **Zod 4** passou a expor
`error.issues`. O resolver rejeita a promessa com o `ZodError`, o React Hook Form nunca
recebe `errors`, e o `FormMessage` devolve `null`. Resultado: 1 submit, 0 chamadas à
action, 0 parágrafos de erro, `unhandledrejection` na consola.

Isto não é um bug da T2 nem do Zod: é a consequência do commit `b980ed0`, que fixou
`@hookform/resolvers@3.3.0` (compatível com Zod 3) num projeto que já estava em Zod 4.6.5.

## Registo de fecho — T7 (2026-11-01) — FECHADA

- **Dev:** 6 `console.log` e os `fetch('/api/…')` fora; 3 componentes `'use client'`; diálogo de
  pagamento novo; `AlertDialog` a confirmar; `@hookform/resolvers` substituído pelo adaptador
  `apps/web/src/lib/zod-resolver.ts`; e as 4 correções finais (sem conta pré-selecionada,
  arquivadas fora, valor em euros com `Math.round`, `accountIds` no schema).
- **QA:** reprovou o ponto 5 uma vez (causa raiz `resolvers@3.3.0` vs Zod 4), re-provou com o
  harness reconstruído, e depois provou as 4 correções **contra a base de teste**: 20/20 do Dev,
  mais a sua própria passagem — `19,99`→`1999`, `12.34`→`1234`, `1234` mostra `12,34`,
  botão desativado sem conta, arquivada fora, grupo com 2 contas → 2 linhas em
  `account_group_item`, e a base devolvida ao estado inicial (2 users / 5 contas / 52 transações).
- **Revisor:** aprovou com 2 objeções DEVE (conta pré-selecionada; valor em cêntimos num campo
  «€»), ambas corrigidas e re-provadas.
- **Gate final:** `format:check`, `lint`, `typecheck`, `test` (522), `build` — todos exit 0.
- Pendente: commit (D4).

## Objeções DEVE do Revisor na T7 (2026-11-01) — a T8 é absorvida aqui

O Revisor aprovou a T7 com duas objeções que valem mais do que cosmética:

1. **`receivable-payable-pay-dialog.tsx:79` pré-seleciona `accounts[0]`.** Um clique em
   Confirmar grava um movimento na conta que o utilizador nunca escolheu. E a lista vem de
   `accounts.ts:53` **sem filtrar arquivadas**.
2. **`receivable-payable-dialog.tsx:213-224`, com `receivable-payable-list.tsx:253`:** o
   campo de edição mostra cêntimos (`1234`) num campo rotulado «€» (devia ser `12,34`).

Decisão do Lead: a objeção 2 pertence à mesma família de defeitos da T8 (dinheiro), e as
duas mexem nos mesmos dois diálogos. Fazem-se **num só passo**, com uma revisão só, em vez
de duas passagens pelas mesmas linhas. A T8 fica absorvida.

Mecanismo do `accountIds`, agora confirmado: o `createAccountGroup` **sabe** gravar
`value.accountIds` (`account-group-actions.ts`), mas o schema local do diálogo
(`account-group-dialog.tsx:45`) não declara o campo, e o adaptador devolve
`values: parsed.data` — o Zod descarta o que o schema não declara. Basta declarar.

| T12 | Erros e limpeza: diálogo ignora `fieldErrors`, o P2002 de itens duplicados sai com a mensagem do nome, e `paymentId` fictício | Dev | **fechada** (QA provou no caminho real; Revisor sem achados) | `relatorios/T12.md` |
| T13 | **Segurança:** `createAccountGroup` não confirma que os `accountIds` são do utilizador | Dev | **fechada** (teste vermelho 4/5 → 5/5 verde; QA tentou furar em 4 frentes) | `relatorios/T13.md` |

## Achados da T7 que passaram a executáveis (2026-11-01)

A T7 tornou o `accountIds` real. Duas consequências que antes eram teoria:

1. **`createAccountGroup` não valida a posse das contas.** **CONFIRMADO pelo QA** com dois
   utilizadores: `POST /api/account-group` com cookie de A e `accountIds:[conta de B]`
   devolveu `200` e gravou uma linha em `account_group_item` a ligar o grupo de A à conta de
   B. Teste vermelho em `relatorios/T13-prova-autorizacao.mjs` (4/5, EXIT=1). → **T13**.
   Âmbito confirmado: só `createAccountGroup`. `deleteAccountGroup`, `addAccountToGroup` e
   `removeAccountFromGroup` já recusam com `400` o que não é do utilizador.
2. **`updateAccountGroup` ignora `accountIds`**: o diálogo envia os ids e a ação só grava
   nome e descrição (itens 0→0). → T11.

## Registo de fecho — T13 (2026-11-01)

- **Dev:** consulta de posse por conjunto (`Set` + `some`) antes da transação, +17 linhas num só
  ficheiro. Complexidade medida: 8 (limite 10).
- **QA:** o teste vermelho passou a **5/5 EXIT=0** sem tocar no ficheiro de teste, e tentou furar
  em quatro frentes: id inexistente → 400; conta própria + alheia → 400 sem linha parcial;
  id próprio repetido → 400 com rollback; `[]` explícito → 200 com 0 itens. Script novo
  `relatorios/T13-provas-adicionais.mjs` → 6/6. Base igual ao baseline em todos os casos.
- **Revisor:** confirmou que a transação grava **a mesma** lista validada (nunca re-derivada),
  que a verificação é só leitura antes do `$transaction`, e que `addAccountToGroup` já valida
  a posse — o buraco não se reabre por outro caminho.
- **Achado do QA para a T12:** id próprio repetido devolve 400 com a mensagem errada
  («Já tens um grupo com esse nome»), porque o `P2002` da chave única dos itens é traduzido
  pelo erro de unicidade do grupo. Não é falha de segurança.

## Achados do Revisor no fecho da T7 (2026-11-01) — a T11

Delta das objeções aprovado sem achados bloqueantes. Ficaram dois pontos opcionais que
vão para a T11:

1. O diálogo de **criação** continua a receber a lista completa de contas
   (`contas-pagar-receber/page.tsx:33`), por isso ainda é possível criar uma conta a
   pagar/receber ligada a uma conta **arquivada**. A edição já filtra.2. `eurosToCents("1,005")` dá 100 (meio cêntimo com 3 casas cai para baixo por imprecisão de
   vírgula flutuante). Com duas casas — o que a moeda tem — está correto. Fica declarado
   como limitação conhecida, não como bug a perseguir.

Confirmado pelo Revisor, e vale registar: o `select` de edição com uma conta arquivada fica
em branco **mas o React Hook Form mantém o id** e não apaga a ligação. O meu receio de
regressão não se confirmou.

## Ressalva do Revisor no fecho da T13 (2026-11-01) — pré-existente, vai para a T11

O diálogo só mostra `result.error` num toast e **ignora `fieldErrors`**
(`grep fieldErrors apps/web/src/components/account-group-dialog.tsx` → 0). Por isso, quando
`createAccountGroup` recusa por posse, a mensagem aparece como toast mas nada fica marcado no
campo das contas. Não é regressão — sempre foi assim — mas é o mesmo tipo de defeito que a T7
foi corrigir no `FormMessage`: o erro existe e não chega ao sítio onde o utilizador olha.

Confirmado também: `addAccountToGroup` (`:214-221`) já valida a posse; o buraco da T13 não
fica reaberto por outro caminho.

| T14 | `updateReceivablePayable` está em complexidade 14 (o projeto não configura a regra `complexity`; a referência é 10). Dívida pré-existente, não efeito da T11 | Dev | aberta (dívida, não bloqueia deploy) | — |

## Decisão do Lead sobre a T11 (2026-11-01)

**A linha extra em `account-group-list.tsx` fica.** O Dev abriu o diálogo de edição sem as
contas atuais marcadas; agora que o update **escreve** as contas, marcar uma conta substituiria
o grupo inteiro por essa — apagava as outras. A pré-seleção
(`accountIds: editing.accountGroupItems.map(...)`) é o que torna o update não destrutivo. Está
dentro do espírito da tarefa e sem ela a T11 produzia um defeito pior do que o que corrigiu.

O `type` de uma conta a pagar/receber é **imutável depois de criada** (D7 em `DECISOES.md`):
recusa na ação e campo desativado na edição.

O Revisor confirmou o mecanismo e não abriu exceção: o `type` que o formulário envia vem do
`defaultValues` do React Hook Form (`receivable-payable-list.tsx:251`), **não** do rádio
`disabled` — por isso o guard compara sempre com o valor atual e não passa por acidente.
Também confirmou que `deleteMany` + `createMany` + `update` estão na mesma `$transaction`
(`account-group-actions.ts:167-187`), logo uma falha a meio desfaz a eliminação dos itens:
**não há perda silenciosa**, que era o meu maior receio.

**Achado grave no instrumento de prova:** `relatorios/T13-prova-autorizacao.mjs` imprime
`FALHA` em 3 de 5 verificações e mesmo assim sai com **EXIT=0**, porque o código de saída só
olha para a primeira verificação. Um teste que mente sobre o resultado é pior do que não ter
teste. Vai para o QA corrigir junto com a verificação da T11.

## T12 — Erros que mentem e código que já não serve

**Porque:** quatro defeitos pequenos que fazem a aplicação dizer coisas falsas. Nenhum é de
segurança, todos são de confiança.

1. **O diálogo ignora `fieldErrors`.** `createAccountGroup` recusa por posse e devolve
   `fail(msg, { accountIds: [...] })`, mas o diálogo só faz toast de `result.error`
   (`grep fieldErrors apps/web/src/components/account-group-dialog.tsx` → 0). A mensagem
   aparece fora do sítio onde o utilizador olha. Mesmo tipo de defeito que a T7 corrigiu no
   `FormMessage`.
2. **Mensagem errada em id repetido.** Enviar o mesmo `accountId` próprio duas vezes devolve
   400 «Já tens um grupo com esse nome» — o `P2002` da chave única dos itens é traduzido pelo
   erro de unicidade do **nome** do grupo. Medido pelo QA na T13.
3. **`payReceivablePayable` devolve `ok({ paymentId: 'payment-created' })`** — um id inventado.
   A interface não o usa, mas a API mente a quem a chamar.
4. **Duas rotas sem consumidor:** `apps/web/src/app/(app)/api/account-group/route.ts` e
   `api/receivable-payable/route.ts`. A interface passou a usar as server actions na T7.

**Cuidado no ponto 4:** `relatorios/T13-prova-autorizacao.mjs` e
`relatorios/T13-provas-adicionais.mjs` chamam a rota HTTP para provar a autorização. Se a rota
sai, esses scripts têm de passar a exercer a action por outro caminho, ou ficam a medir um
endpoint que já não existe. Não apagar sem resolver isto primeiro.

**Decisão do Lead (D8): as rotas `/api/*` FICAM.** Apagá-las destruiria a única prova
executável da correção de autorização da T13 (os scripts falam HTTP, não sabem chamar
server actions). E não há lógica duplicada: as rotas só delegam nas ações e traduzem
`ActionResult` em código HTTP. Ficam, com um comentário a dizer que a interface usa as
actions e que a rota é a superfície HTTP. A T12 fica com os outros três pontos.

**Critério de aceitação:** os quatro pontos fechados, os scripts da T13 continuam a provar o que
provavam (ou são atualizados com nota no relatório), gate verde, 522 testes.

| T15 | O diálogo de contas a pagar/receber tem o mesmo buraco de `fieldErrors` (mensagem de nome repetido só em toast) | Dev | aberta (após T3) | `relatorios/T15.md` |

## T12 — o que ficou decidido

- **Conta repetida: deduplicar** (`[...new Set(ids)]`), não distinguir o `P2002`. 2 linhas, zero ramos
  novos, e resolve a causa em vez do sintoma. O `P2002` continua a servir o nome de grupo repetido,
  que tem de continuar a dar aquela mensagem.
- **`create` passou a `createMany`** sobre a lista sem repetidos (era `for` + `create()` por id); o
  `skipDuplicates` do update saiu por ficar redundante.
- **Mudança estrutural no diálogo:** o bloco das contas tinha **um `FormField name="accountIds"`
  por cada conta** e nenhum `FormMessage` — o `setError('accountIds')` não tinha onde aparecer.
  Passou a um único `FormField` com as caixas dentro e um `<FormMessage />`. Sem isto, a correção
  do ponto 1 era invisível.
- **Rotas `/api/*` mantidas** (D8), agora com duas linhas de comentário a dizer que a interface usa
  as ações e que a rota é a superfície HTTP usada pelos testes de autorização.

| T16 | **Dinheiro:** `payReceivablePayable` lê `existing` fora da transação — duas confirmações em paralelo pagam a mesma conta duas vezes | Dev | aprovada Revisor; falta re-execução do QA | `relatorios/T16.md` |

## T16 — a concorrência passou de teórica a alcançável

O Revisor assinalou, ao fechar a T12: `receivable-payable-actions.ts:168` lê o registo **fora**
da transação, e o `update` de status não tem guarda condicional. Duas confirmações simultâneas
passam ambas na verificação "já está paga?" e cada uma cria o seu movimento — a conta fica paga
duas vezes, com dinheiro duplicado na conta.

Isto já estava no código antes de nós. O que mudou: **não existia botão de pagar funcional até à
T7.** A falha era inalcançável e passou a ser um clique. Correção sugerida pelo Revisor:
`updateMany` com `where: { id, userId, status: { not: 'PAID' } }` dentro da transação e tratar
`count === 0` como "já pago", em vez de ler antes e escrever depois.

Prova exigida: dois pedidos em paralelo (o QA já usou este método para a T5.6 e a T7.5) — só um
deve criar movimento, e a base tem de ficar com **um** pagamento e **um** movimento.

## Registo — T16 (2026-11-01)

- **Antes da correção**, o defeito foi reproduzido **3 vezes em 3**: dois `PATCH` em paralelo,
  ambos `200`, **2 pagamentos e 2 movimentos**. Não é teoria, é dinheiro a duplicar.
- **Depois**: `updateMany` com `status: { not: 'PAID' }` dentro da transação; o segundo pedido
  recebe `400` «Esta conta já está paga.» e não escreve nada. Três rondas, sempre `1 pagamento /
1 movimento`, contados por SQL e não pelo corpo da resposta.
- Autorização intocada; complexidade 7 (era 6).
- **Limites declarados:** só dois pedidos em paralelo (não três ou mais); só `PAYABLE`; não
  exercitou `createTransaction: false`; e continua a existir uma janela teórica entre a posse da
  conta de pagamento (lida fora da transação) e a escrita — cai no `failFromWriteError` genérico,
  não duplica dinheiro.
- **Revisor confirmou o mecanismo:** em `READ COMMITTED` o segundo `updateMany` bloqueia na linha,
  reavalia o `where` contra a versão já commitada e devolve `count: 0` — a guarda não depende do
  entrelaçamento. E declarou (para não corrigir agora): o snapshot de `existing` alimenta
  `paidAmountInCents` e o `type`/`description`/`categoryId` do movimento, por isso uma edição
  concorrente do montante grava o valor antigo. Risco teórico, registado.

| T17 | **Acessibilidade dos ecrãs novos:** `FormLabel` sem `htmlFor` (campos só alcançáveis por placeholder) e os dois ecrãs fora da varredura do axe | Dev | a fazer | `relatorios/T17.md` |
| T18 | O e2e do pagamento conta os movimentos (+1) mas não confere o montante do movimento criado | QA | **fechada** (montante, `kind`, estado, `settled` e conta conferidos; 9 verdes em duas execuções) | `relatorios/T3.md` |

## Registo — T3 (2026-11-01)

- Dois specs novos pela interface: `e2e/45-contas-pagar-receber.spec.ts` (6 testes) e
  `e2e/55-consolidacao-contas.spec.ts` (3). **9 passaram em duas execuções seguidas** (34,0 s e 33,1 s).
- Suite completa: **30/33**, e as 3 falhas são exatamente as conhecidas de
  `35-estado-transacoes` (333, 409, 479) — nenhuma quarta. Baseline era 21/24.
- O que ficou provado com valores: `19,99` → lista «19,99 €» e 1999 na base; editar → 2550; tipo
  `disabled` em edição; pagar → badge «Paga», `paidAmountInCents=1999` e +1 movimento na conta
  escolhida; cancelar mantém, confirmar apaga; inválido mostra as duas mensagens e cria 0 linhas;
  grupo 2→1→apagado com os itens certos.
- **Gaps relatados e não corrigidos** (viram T17 e T18): os dois ecrãs não entram na varredura do
  axe nem no teste de desempenho; `FormLabel` sem `htmlFor` nos diálogos, por isso os campos só são
  alcançáveis pelo placeholder; e o e2e conta os movimentos mas não confere o montante do que o
  pagamento criou.
- **Objeção do Revisor levantada e retirada por medição.** Ele viu que `limparDadosDoSpec` não apaga
  movimentos e concluiu que cada execução deixava uma despesa na conta real. Medi a base: 52
  transações, exactamente o baseline, depois de quatro suites. Ele foi verificar de quem era a conta
  — é do utilizador `e2e-*`, provisionado pelo `global.setup` — e retirou a objeção. Fica só isto:
  o comentário da função promete apagar o que o spec criou e não apaga o movimento; quem o apanha é
  o teardown. Uma linha de comentário, não um defeito.

| T17 | **Acessibilidade dos ecrãs novos:** `FormLabel` sem `htmlFor` (campos só alcançáveis por placeholder) e os dois ecrãs fora da varredura do axe | Dev | Dev done (4 violações críticas → 0); em revisão | `relatorios/T17.md` |

## Registo — T17 (2026-11-01)

**A causa não era só faltar `htmlFor`:** o `FormLabel` do `ui/form.tsx` **deitava fora as props**
(`{ children }` e mais nada), por isso escrever `htmlFor` nos diálogos não fazia nada — a primeira
passagem do Dev provou isso (ids aplicados, axe a apontar os mesmos nós, `getByLabel` ainda a 0).
E o `FormControl` do projeto é um `<div>`, não gera `id`; não havia caminho pronto.

Correção mínima: `{ children, ...props }` no `FormLabel` e ids por instância com `useId`
(o mesmo diálogo existe duas vezes na página — cabeçalho e estado vazio).

Axe: **4 violações críticas → 0** em 7 cenários (`label` e `select-name`). `getByLabel` passa de
5/10 campos para 10/10. O diálogo de pagamento não precisou de nada — já tinha ids desde a T7, e o
que o QA descrevia como «os selects e a data do diálogo de pagamento» era o diálogo de **conta**.

**Declarado e não feito:** o grupo de radios `type` não está num `fieldset`/`legend` (não é
violação, mas o nome acessível fica verboso) e «Adicionar Contas ao Grupo» é uma legenda de
conjunto, não um rótulo de controlo. Ambos exigiam mudar estrutura e microcopy.

| T19 | **Os dois ecrãs novos não têm entrada no menu:** `/contas-pagar-receber` e `/consolidacao-contas` não estão em `lib/nav.ts`, por isso só se chegam escrevendo o endereço | Dev | **fechada** (Dev + QA + Revisor; spec 15 falha sem a correção e passa com ela, 14/14 destinos respondem) | `relatorios/T19.md` · `relatorios/T19-qa.md` |
| T20 | `README.md` e §0 do `ESTADO-E-HANDOFF.md` a dizer que produção responde `404` e que o CI está vermelho — falso desde o deploy do `2f84384` | Dev | **fechada** (Dev + QA + Revisor; 3 ficheiros, 47/28, cada número medido) | `relatorios/T20.md` · `relatorios/T20-qa.md` |

## T19 — Os dois ecrãs novos não têm entrada no menu

**Porque (verificado pelo Lead em 2026-11-01, a pedido do utilizador):** a navegação da app vem
toda de `apps/web/src/lib/nav.ts` — barra lateral (`app-sidebar.tsx:20`), barra do telemóvel
(`mobile-nav.tsx:6`) e paleta de comandos (`command-palette.tsx` via `ALL_NAV_ITEMS`). Esse
ficheiro declara 12 destinos e **não declara nenhum dos dois ecrãs novos**. Fora daí só existe
`revalidatePath` nas server actions; nenhum `<Link>` nem atalho em `/contas` aponta para eles.

**Prova do defeito:** `curl` a produção com `2f84384` publicado dá `307` → `/entrar` nas duas
rotas (existem e pedem login), mas nenhum membro da equipa conseguiu chegar-lhes a clicar. O e2e
não o apanhou porque `abrirRota()` escreve o endereço em vez de navegar pelo menu.

**Ficheiros que pode escrever:** `apps/web/src/lib/nav.ts` e **um** spec novo em `e2e/`
(nome sugerido: `e2e/15-navegacao.spec.ts`). Mais nada.

**Arrumação decidida pelo utilizador (opção 1):** secção **«Dia a dia»**, por esta ordem —
Painel, Transações, Contas, **Contas a pagar/receber**, **Consolidação**, Cartões. Rótulos
curtos: «Contas a pagar/receber» e «Consolidação». `description` obrigatória, como os outros.
Ícone: escolhe entre os `lucide-react` que o ficheiro já importa ou acrescenta um, sem
dependência nova.

**Critério de aceitação (verificável):**

1. `pnpm typecheck` e `pnpm lint` → 0 erros; `pnpm test` → 522 testes; `pnpm build` → exit 0;
   `pnpm format:check` → verde.
2. No browser, na barra lateral, clicar em «Contas a pagar/receber» abre
   `/contas-pagar-receber` com o título «Contas a Pagar / Receber», e «Consolidação» abre
   `/consolidacao-contas` com «Consolidação de Contas».
3. O spec novo **navega pelo menu, não por `abrirRota()`**: entra, clica o item, confere URL e
   título, para os dois ecrãs. Tem de falhar se retirares a entrada do `nav.ts` — cola a prova de
   que falhou antes da correção e passou depois.
4. As duas rotas continuam a aparecer na paleta de comandos (vem de graça por `ALL_NAV_ITEMS`;
   confirma, não reimplementes).
5. `git diff` limitado aos dois ficheiros acima.

**O que NÃO fazer:** não mexer em `MOBILE_NAV` (são 5 destinos de propósito; não passa a 7); não
criar `redirect` nem alias de rota; não alterar as páginas, os diálogos nem as server actions; não
tocar em `README.md` nem em `docs/` (é a T20); não correr o axe nem mexer nos specs 80/90; não
fazer commit nem push.

## Registo de fecho — T19 (2026-11-01)

- **Dev:** `nav.ts` com `CONTAS_A_PAGAR_RECEBER` (`Receipt`) e `CONSOLIDACAO` (`Layers`); secção «Dia a dia»
  com 6 itens pela ordem decidida; `ALL_NAV_ITEMS` 12 → 14. Spec novo `e2e/15-navegacao.spec.ts`, que entra
  por `/` e clica no menu — sem `abrirRota()`. Gate verde, 522 testes.
- **QA (prova própria):** refez o gate; percurso humano por cliques com `h1` e `aria-current`; repôs o
  `nav.ts` de `2f84384`, **reconstruiu** e viu 3 falhas, repôs a versão nova e viu 3 passagens em 6,5 s;
  percorreu os 14 destinos — 14/14 respondem, 0 dão `404`. Prova em `relatorios/T19-qa.md`.
- **Revisor:** aprovada sem achados bloqueantes. `href` batem com as pastas reais; rótulos na linha dos
  existentes; `MOBILE_NAV` intocado com 5; `isActiveRoute` não acende «Contas» com `/contas-pagar-receber`
  (só compara prefixo com barra); o spec não passa com lista vazia (`toHaveText` de 6 rótulos), não tem
  `waitForTimeout` nem `force`, e não depende de dados. Confirmou que o motivo escrito sobre a paleta é
  verdadeiro (`command.tsx:53` monta os filhos sem o `<Command>` da linha 22).
- **Limite na altura em que fechou:** a paleta de comandos não ficou provada na interface porque rebentava ao abrir;
  a T21 corrigiu-a e provou-a depois (14 opções, filtro 14 → 1, axe com 0 violações).
- **Publicado em 2026-11-01:** commit `468a138`, CI `41346236265` verde, deploy `dpl_AF1dL7LZS2j5gUhcRxpMaC4Jkjdk`
  `READY`. Verificado em produção com sessão: «Dia a dia» com 6 destinos, os dois ecrãs a abrir com o título certo e
  `/api/health` `200`. O estado publicado passou a ser o `ddbdcd7` depois do commit de documentação.
- **Fechada e publicada.**

## T20 — O README mente sobre o estado

**Porque (medido pelo Lead em 2026-11-01):** `README.md:10` («Em produção, `/contas-pagar-receber`
e `/consolidacao-contas` respondem `404`»), o aviso do topo («Nada disto está em produção») e o
parágrafo do CI («vermelho em `main` desde 2026-10-14 … ainda não foi empurrada») são falsos desde
o deploy do `2f84384`. Verificado agora: as duas rotas dão `307` → `/entrar`, `/api/health` dá
`200`, o deploy está `READY` e o CI verde é o run `41320502835`. O mesmo texto velho está em
`docs/plano/ESTADO-E-HANDOFF.md` §0 («Nada disto está commitado»).

**Ficheiros que pode escrever:** `README.md` e `docs/plano/ESTADO-E-HANDOFF.md`. Mais nada.

**Critério de aceitação:** nenhuma afirmação de estado no README ou no §0 do handoff contrariada
por medição; cada número que escreveres tem de vir de um comando que corras e coles. A lista de
funcionalidades, o âmbito, a stack e os comandos ficam como estão — só o estado muda.

**O que NÃO fazer:** não inventar datas, contagens de testes nem resultados de deploy; não
acrescentar funcionalidade nenhuma à lista; não commitar (o commit e o push continuam a aguardar
autorização do utilizador, D4).

| T21 | **Paleta de comandos rebenta ao abrir:** `ui/command.tsx` → `CommandDialog` monta os filhos sem os envolver no `<Command>` do cmdk (`Cannot read properties of undefined (reading 'subscribe')`). Atinge os 14 destinos, não é do `nav.ts` | Dev | **fechada** (Dev + QA + Revisor; 14 opções, filtro 14→1, 0 erros, axe 0 violações) | `relatorios/T21.md` · `relatorios/T21-qa.md` |

## Registo de fecho — T20 (2026-11-01)

- **Dev:** reescreveu só a secção de estado. `git diff --stat` = `README.md` (26), `docs/plano/ESTADO-E-HANDOFF.md` (48)
  e `.prettierignore` (+1) → 3 ficheiros, 47/28. Lista de funcionalidades, âmbito, stack, estrutura, arranque e
  comandos: zero linhas alteradas. Cada número saiu de um comando colado no `relatorios/T20.md`.
- **QA (prova própria):** `curl` nas três rotas (`307` → `/entrar`, `200`), `rev-parse`/`rev-list` (`2f84384`, `0 0`),
  `gh run view 41320502835` (`success`, `push`, `2f84384`), deploy `dpl_2sq…` `READY` em produção com o alias
  `psi-lac` (medido pela API). Entrou em **produção** com a conta demo e contou a barra lateral: «Dia a dia» com
  **4** destinos — o menu da T19 não está publicado. Reproduziu a paleta `Ctrl+K` partida em produção e no build
  local (`dialog=0 input=0 itens=0`, `Cannot read properties of undefined (reading 'subscribe')`).
- **Achado do QA, corrigido:** as «8 execuções falhadas» eram **7 `failure` + 1 `cancelled`**. O Dev reconfirmou com
  o `gh` (`{"total":8,"porConclusao":[{"cancelled":1},{"failure":7}]}`) e a frase passou a «as oito… não passaram:
  sete falharam e uma foi cancelada por ser duplicada». O mesmo número aparecia no §0 e foi corrigido lá também.
- **Revisor:** aprovada sem bloqueantes. Nota de registo: o `.prettierignore` já ignorava `*.md`, por isso o
  `format:check` verde **não** é prova de que o README está formatado — só o resto. O QA confirmou-o desligando o
  ignore (`prettier --check --ignore-path /dev/null` → `[warn]` nos dois `.md`).
- Gate final: `format:check`, `lint`, `typecheck`, `test` (28 ficheiros, 522), `build` — todos exit 0.
- **Publicado em 2026-11-01:** commit `468a138`, CI `41346236265` verde, deploy `dpl_AF1dL7LZS2j5gUhcRxpMaC4Jkjdk`
  `READY`. Verificado em produção com sessão: «Dia a dia» com 6 destinos, os dois ecrãs a abrir com o título certo e
  `/api/health` `200`. O estado publicado passou a ser o `ddbdcd7` depois do commit de documentação.
- **Fechada e publicada.**

## T21 — A paleta de comandos rebenta ao abrir

**Achado pelo Dev na T19 e confirmado por mim no código** (`apps/web/src/components/ui/command.tsx:41-58`):
o `CommandDialog` mete `children` (`CommandInput`, `CommandList`, `CommandItem`, todos do `cmdk`)
dentro do `DialogContent` **sem os envolver no `<Command>`**, que é quem cria o contexto. Resultado:
abrir a paleta dá `PAGE ERROR: Cannot read properties of undefined (reading 'subscribe')`.

É anterior a nós e independente do `nav.ts` — acontece igual com os 12 destinos antigos, por isso
nenhum utilizador conseguiu usar a paleta até hoje. Ficou fora da T19 por estar fora dos ficheiros
dessa tarefa, como deve ser.

**Ficheiros que pode escrever:** `apps/web/src/components/ui/command.tsx` e o spec que prova a
paleta (`e2e/15-navegacao.spec.ts` já tem o motivo escrito no cabeçalho: o teste da paleta entra
lá quando isto estiver corrigido). Mais nada.

**Critério de aceitação (verificável):**

1. Abrir a paleta (`Ctrl+K` / `Cmd+K`) não lança erro na consola e mostra a lista.
2. Escrever «consolida» filtra e clicar no item abre `/consolidacao-contas`; o mesmo para
   «contas a pagar».
3. O teste da paleta passa a estar no `e2e/15-navegacao.spec.ts` e falha se a correção for
   revertida (colar as duas execuções).
4. Gate completo verde: `format:check`, `lint`, `typecheck`, `test` (522), `build`.
5. `git diff` limitado a esses dois ficheiros.

**O que NÃO fazer:** não trocar o `cmdk` nem o `Dialog`; não reescrever a paleta; não mexer no
`nav.ts` (já está fechado pela T19); não fazer commit nem push.

| T22 | **`DialogHeader` do `CommandDialog` vive fora do `DialogContent`:** o `<h2>` «Ir para» `sr-only` está sempre no DOM, mesmo com a paleta fechada, e entra na lista de cabeçalhos de um leitor de ecrã em todas as páginas | Dev | aberta (achado do Revisor na T21; anterior a nós) | — |

## Registo de fecho — T21 (2026-11-01)

- **Dev:** `apps/web/src/components/ui/command.tsx` — `{children}` passou a `<Command>{children}</Command>` (+6/−1, 5 das quais
  comentário a explicar a causa). Um `<Command>` a mais nenhum; sem trocar `cmdk`, `Dialog` nem o consumidor. Dois testes novos em
  `e2e/15-navegacao.spec.ts` que abrem com `Ctrl+K`, contam as opções, exigem que o filtro **encurte** a lista, clicam e conferem
  URL e `h1`, com recolha de `pageerror`/`console.error` ligada antes de abrir.
- **Prova nos dois sentidos:** sem a correção, `2 failed` (`getByRole('dialog')` → element(s) not found) e o erro original medido
  no build: `dialogos=0 opcoes=0`, `Cannot read properties of undefined (reading 'subscribe')`. Com ela, `5 passed (9.8 s)` e
  `erros = []` em todo o percurso.
- **QA (prova própria):** `dialog=1 input=1 listbox=1 opcoes=14`; «consolida» 14 → 1 → `/consolidacao-contas`; «contas a pagar»
  14 → 1 → `/contas-pagar-receber`; zero `pageerror`/`console.error`. Repôs `ui/command.tsx` de `2f84384`, **reconstruiu** e viu o
  defeito original; repôs a versão do Dev e viu passar. **Axe sobre a paleta aberta: 0 violações** — nunca tinha sido medido, porque
  a paleta rebentava antes de ser vista.
- **Revisor:** aprovada. A correção é a padrão do shadcn e a mínima; `command-palette.tsx` é o único consumidor, logo não há duplo
  aninhamento. Notas de registo: (1) `DialogHeader` fora do `DialogContent` deixa o `<h2>` «Ir para» sempre no DOM → virou **T22**;
  (2) o pacote `cn@0.4.0` é o oficial do shadcn, sem risco; (3) um comentário do spec deixou de ser exato — corrigido nesta mesma
  tarefa.
- Gate final: `format:check`, `lint` 4/4, `typecheck` 4/4, `test` (28 ficheiros, 522), `build` 2/2 — todos exit 0.
- **Publicado em 2026-11-01:** commit `468a138`, CI `41346236265` verde, deploy `dpl_AF1dL7LZS2j5gUhcRxpMaC4Jkjdk`
  `READY`. Verificado em produção com sessão: «Dia a dia» com 6 destinos, os dois ecrãs a abrir com o título certo e
  `/api/health` `200`. O estado publicado passou a ser o `ddbdcd7` depois do commit de documentação.
- **Fechada e publicada.**

## T22 — O título escondido da paleta está sempre no DOM

**Achado pelo Revisor ao fechar a T21.** Em `apps/web/src/components/ui/command.tsx:45-48`, o
`DialogHeader`/`DialogTitle`/`DialogDescription` são renderizados **fora** do `DialogContent`. O
Radix resolve o nome acessível do diálogo à mesma (liga `aria-labelledby`/`aria-describedby` pelo
contexto, e o axe deu 0 violações com a paleta aberta), mas o `<h2>` «Ir para» `sr-only` fica no
DOM **sempre**, mesmo com a paleta fechada — entra na lista de cabeçalhos e no fluxo de leitura de
um leitor de ecrã em todas as páginas.

Não é regressão da T21: já estava assim antes. O axe não apanha isto porque não é violação — é
ruído de estrutura.

**Correção mínima esperada:** mover o `DialogHeader` para dentro do `DialogContent`. Nada mais.

**Critério de aceitação:** com a paleta **fechada**, o documento não tem o `<h2>` «Ir para»; com a
paleta **aberta**, o diálogo continua nomeado (o teste da T21 e o axe do 80 continuam verdes).

**O que NÃO fazer:** não mexer no `<Command>{children}</Command>` da T21, nem no `command-palette.tsx`.

| T23 | **Polimento visual aprovado pelo utilizador:** scroll horizontal em `/transacoes`, 6 frases em pt-BR, cartões sem destaque no escuro e património sem hierarquia no Painel | Dev | **fechada** (Dev + QA + Revisor; 0 rotas com excesso em 56 medições, contraste 14,2:1, 15 frases) | `relatorios/T23.md` · `relatorios/T23-qa.md` |
| T24 | **T22:** o `DialogHeader` do `CommandDialog` vive fora do `DialogContent`, por isso o `<h2>` «Ir para» está sempre no DOM | Dev | aberta (fase própria; não bloqueia nada) | `relatorios/T24.md` |

## T23 — Polimento visual (aprovado pelo utilizador)

**Contexto:** o utilizador disse que a app está «muito básica» e autorizou este conjunto depois de eu medir em
produção e o Revisor mapear o código (`relatorios/T23-mapa-visual-revisor.md`). Não é um redesenho: são quatro
coisas pequenas, três delas defeitos. **Fora do âmbito, de propósito:** reestilizar `ui/card.tsx` (23 ficheiros,
29 cartões, todos os ecrãs) e criar sparkline (não existe componente; é trabalho novo).

**Ficheiros que pode escrever:**
`apps/web/src/components/ui/sidebar.tsx`, `apps/web/src/app/(app)/consolidacao-contas/page.tsx`,
`apps/web/src/components/receivable-payable-dialog.tsx`, `apps/web/src/app/globals.css`,
`apps/web/src/components/kpi-card.tsx`, `apps/web/src/components/page-header.tsx`,
`apps/web/src/app/(app)/page.tsx` e **um** spec novo `e2e/16-largura.spec.ts`. Mais nada.

### 1. Scroll horizontal em `/transacoes` (defeito)

**Medido:** a 1200 px de largura de janela, `document.documentElement.scrollWidth = 1309` contra `innerWidth = 1200`
— 109 px a mais. **Causa (Revisor, confirmada por eliminação):** `SidebarInset` (`sidebar.tsx:293-298`) é um _flex
item_ `w-full flex-1` **sem `min-w-0`**; o `min-width:auto` não o deixa encolher abaixo do `min-content` do
conteúdo, e esse mínimo é a tabela (`whitespace-nowrap` em `ui/table.tsx:60,72`). O `overflow-x-auto` da tabela
nunca chega a rolar porque o pai cresceu com ela.

**Correção esperada:** `min-w-0` no `SidebarInset`, uma classe. **Não** mexer na tabela partilhada.

### 2. Português de Portugal em todo o lado (defeito)

Seis frases em pt-BR no meio de uma app em pt-PT — e uma delas agramatical em qualquer variante:

- `consolidacao-contas/page.tsx:22` — «Agrupe suas contas…»
- `consolidacao-contas/page.tsx:80` — «Crie grupos para consolidar suas contas…»
- `consolidacao-contas/page.tsx:105` — «…áreas específicas da **sua finança**»
- `receivable-payable-dialog.tsx:163,189,214` — «Registre uma conta que **você** precisa pagar», «Despesa que você precisa pagar», «Receita que você espera receber»

Reescreve no registo do resto da app: **tu**, não você; «as tuas contas»; «as tuas finanças». Sem mudar o
significado nem acrescentar frases novas.

### 3. Cartões sem destaque no escuro (aspecto)

**Medido:** no tema escuro, fundo `lab 6.17`, cartão `lab 11.23`, contorno `lab 21.10` — a separação vem quase só
do contorno. E existe já um token com o tom certo, **a zero usos**: `--surface-raised` (`globals.css:134`).

**Correção esperada:** no `.dark`, aproximar `--card` do valor que `--surface-raised` já tem (~`oklch(0.27 …)`).
Umas linhas em `globals.css`. **O tema claro não muda.** O contorno continua a existir.

### 4. O património não é o herói (hierarquia)

**Medido:** no Painel, os quatro números são todos `28px/600` e os cartões têm todos `113px` — «Património líquido
7556,43 €» tem o mesmo peso que «Saídas do mês 0,00 €». Pior: o `h1` da página é `24px` (`page-header.tsx:20`),
ou seja **o indicador é maior que o título da página**.

**Correção esperada:**

- `kpi-card.tsx`: prop **opcional** `prominent` (ex.: `text-4xl` no valor). Por omissão, tudo como está.
- `page.tsx`: usar `prominent` **só** no cartão do património.
- `page-header.tsx`: subir o `h1` de `text-2xl` para `text-3xl`, para a hierarquia não ficar invertida.
- Os outros 13 KPIs (Orçamento, Relatórios) **não mudam**.

**Critério de aceitação (verificável, cola a prova):**

1. `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (522) e `pnpm build` — todos exit 0.
2. Spec novo `e2e/16-largura.spec.ts`: nas 14 rotas autenticadas, `scrollWidth <= innerWidth + 1` a 1200 px e a
   1024 px. **Prova ao contrário:** sem o `min-w-0`, o spec tem de falhar em `/transacoes` (cola as duas execuções).
3. Nenhuma das seis frases em pt-BR fica; `grep` a `você|suas|Agrupe|Registre` nos ficheiros de produto devolve 0.
   Cola o `grep`.
4. No escuro, mede com `getComputedStyle` a luminância do fundo e do cartão **antes e depois** e cola os dois
   valores; o cartão tem de ficar mais claro que antes e o texto continuar legível (contraste do `foreground`
   sobre o cartão ≥ 4.5:1, cola o cálculo). No tema claro, os valores **não** mudam.
5. No Painel: o valor do património fica `≥ 36px` e os outros três continuam `≤ 28px`; o `h1` fica `30px`. Cola as
   quatro medições e um par de imagens antes/depois.
6. `git diff --stat` limitado aos oito ficheiros acima.

**O que NÃO fazer:** não tocar em `ui/card.tsx`; não criar componente de sparkline; não acrescentar dependências;
não mudar rótulos, ordem do menu nem `MOBILE_NAV`; não mexer nos specs 80/90; não commitar nem fazer push.

## Registo de fecho — T23 (2026-11-01)

**Cinco rondas de Dev, porque o âmbito cresceu três vezes — e isso está registado como erro meu, não do Dev.**
Cada varredura de pt-BR encontrava mais frases (6 → 11 → 15). Fechei a extensão quando o padrão deu zero.

- **Scroll (defeito):** `min-w-0` no `SidebarInset` (`sidebar.tsx:298`). Antes: 5 rotas com excesso — `/transacoes` +109 e
  `/recorrencias` +94 a 1200; `/transacoes` +256, `/cartoes` +124, `/recorrencias` +256 a 1024. Depois: **0 rotas com excesso**
  em 14 rotas × 2 larguras × 2 conjuntos de dados = **56 medições**. A tabela passou a rolar **dentro** do `overflow-x-auto`.
- **Teste que guarda o defeito:** `e2e/16-largura.spec.ts` (28 casos). Sem a classe → `1 failed / 27 passed`; com ela →
  `28 passed`. **Armadilha apanhada a meio caminho:** a primeira versão passava por acidente porque o utilizador do `globalSetup`
  não tinha transações — sem tabela não há largura mínima. O spec passou a criar e apagar dados no `beforeAll`/`afterAll`.
  Limite conhecido: com esses dados falha a 1024 e não a 1200; com os dados da demo falha nas duas (verificado pelo QA e pelo Revisor).
- **pt-BR:** **15 frases** corrigidas em 5 ficheiros. Não são 6: as rondas mostraram que o texto da app foi escrito com registos
  diferentes. **7 strings ficaram de fora e estão na T25** — 4 delas só apareceram na varredura do QA (dois _toasts_ «ao salvar»,
  «Não consegui registrar o pagamento», `placeholder="Aluguel"`). **O critério «zero pt-BR» não se cumpriu na T23**; cumpre-se na T25.
- **Escuro:** `--card` `0.235 → 0.26` (fundo `L*6.17`, cartão `L*11.23 → 14.13`). Contraste do texto **14,18:1**, rótulos
  **5,82:1**. Tema claro **inalterado** (fundo `L*98,89`, cartão `L*100`, 17,35:1).
- **Efeito secundário que a nossa mudança criou, e que fechámos na 5.ª ronda:** ao subir o cartão, a separação cartão↔superfícies
  internas caiu de **4,06 → 1,16** níveis de luminosidade; o rodapé da tabela e o _hover_ fundiam-se com o cartão. Corrigido
  subindo `--muted` `0.27 → 0.31` e `--secondary` `0.28 → 0.32` no `.dark`: o salto voltou a **5,80** (`muted`) e **6,96**
  (`secondary`), com `muted-foreground` sobre `muted` a **4,96:1**. **Não baixámos o cartão** — isso desfazia o que o utilizador aprovou.
  Nota: a faixa do rodapé usa `bg-muted/50`, por isso mostra metade do salto (Δ 3,05). Se precisar de ser mais marcada, é
  `ui/table.tsx:36` (`bg-muted` inteiro) — é desenho, não a correção pedida, e não foi tocado.
- **Hierarquia:** `h1` `24 → 30px`; património `28 → 36px`; os outros três continuam a 28px; os **13 KPIs** de Orçamento e
  Relatórios não mudaram (prop `prominent` opcional, omissão `false`).
- **QA (prova própria):** 56 medições de scroll, prova ao contrário com rebuild, contrastes, hierarquia nos 6 ecrãs, 12 imagens
  e regressão visual em Painel, Transações, Contas a pagar/receber, Objetivos, Orçamento e Relatórios. PASS, com a ressalva do pt-BR.
- **Revisor:** aprovada. Confirmou o `min-w-0` em offcanvas (375px), `variant=inset` e colapso; o `prominent` sem efeito nos
  outros KPIs; títulos longos a 768px sem sobreposição; e que os dados do spec são criados e apagados sem dependência de ordem.
- Gate final: `format:check`, `lint` 4/4, `typecheck` 4/4, `test` (28 ficheiros, 522), `build` 2/2, spec 16 `28 passed`.
- **Pendente:** commit e deploy (aguarda autorização do utilizador).

## T24 — O título escondido da paleta está sempre no DOM (T22)

**Achado do Revisor na T21.** Em `apps/web/src/components/ui/command.tsx:45-48` o `DialogHeader`/`DialogTitle`/
`DialogDescription` são renderizados **fora** do `DialogContent`. O Radix resolve o nome acessível do diálogo à
mesma (`aria-labelledby` pelo contexto, e o axe deu 0 violações), mas o `<h2>` «Ir para» `sr-only` fica no DOM
**sempre** — entra na lista de cabeçalhos e no fluxo de leitura de um leitor de ecrã em todas as páginas.

**Correção mínima:** mover o `DialogHeader` para dentro do `DialogContent`. Nada mais.

**Critério de aceitação:** com a paleta **fechada**, `aria-hidden` ao lado, o documento não tem o `<h2>` «Ir para»
(teste no `e2e/15-navegacao.spec.ts`); com a paleta **aberta**, o diálogo continua com nome acessível e o teste
atual passa. Axe do 80 continua verde. Gate completo verde.

| T25 | **Microcopy: as 7 strings de pt-BR que sobraram** — inclui as 3 que a T23 deixou de fora e as 4 que só o QA encontrou (toasts «ao salvar», «registrar», placeholder «Aluguel») | Dev | aberta (2026-11-01; nenhuma bloqueia) | `relatorios/T25.md` |

## T25 — Microcopy: o resto da lista fechada na T23

**Porque existe:** durante a T23 a correção do pt-BR foi crescendo a cada varredura (6 → 11 → 15 frases). Fechei o âmbito quando o padrão deu zero e mandei deixar o resto **registado em vez de corrigido**, para a tarefa não andar sem fim. Esta é essa lista, fechada pelo Dev no `relatorios/T23.md` §2 e §3.

**As 7 ocorrências por corrigir** (todas em texto de produto visível, nenhuma em comentário). As três primeiras foram registadas pelo Dev na T23; as quatro seguintes só apareceram na varredura do QA — e duas delas chegam ao utilizador por _toast_, que ninguém vê a ler o código:

| Ficheiro:linha                                 | Hoje                                                                                                | Proposta                                                           |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `components/account-group-dialog.tsx:135`      | toast «Ocorreu um erro ao **salvar** o grupo»                                                       | «…ao guardar o grupo»                                              |
| `components/account-group-dialog.tsx:146`      | «Crie um grupo para consolidar várias contas **em uma** visualização.»                              | «Cria um grupo para consolidares várias contas numa visualização.» |
| `components/account-group-dialog.tsx:148`      | `submitLabel = 'Salvar Alterações'`                                                                 | «Guardar alterações»                                               |
| `components/receivable-payable-dialog.tsx:152` | toast «…ao **salvar** a conta»                                                                      | «…ao guardar a conta»                                              |
| `components/receivable-payable-dialog.tsx:165` | `submitLabel = 'Salvar Alterações'`                                                                 | «Guardar alterações»                                               |
| `components/receivable-payable-dialog.tsx:235` | `placeholder="… Aluguel …"`                                                                         | «… Renda …» (pt-PT; confirmar com o campo vizinho)                 |
| `server/receivable-payable-actions.ts:252`     | «Não consegui **registrar** o pagamento» — chega ao ecrã por `toast({ description: result.error })` | «…registar o pagamento»                                            |

**Atenção ao mexer nas duas `Salvar Alterações`:** ao contrário do resto, **estas estão assertadas em e2e** — `e2e/45-contas-pagar-receber.spec.ts:97` e `e2e/55-consolidacao-contas.spec.ts:125` procuram o texto. Mudar o rótulo obriga a atualizar os dois specs no mesmo passo, senão o gate fica vermelho.

Nota: a lista completa do varrimento exaustivo (12 ocorrências) está no `relatorios/T23.md`, com 11 classificadas como **pt-PT correto em comentários** — não se tocam.

**Critério de aceitação:** as sete substituídas; varredura larga (`você|suas |seus |Gerencie|Registre|Agrupe|Adicione|Visualize|Selecione|Preencha|Escolha|Comece|Crie |deseja|Digite|em uma|Salvar|registrar|Aluguel`) em texto de produto devolve **0 reais**; os dois e2e que assertam «Salvar Alterações» atualizados no mesmo passo (`45:97`, `55:125`); gate completo verde e spec afetado a passar.

**O que NÃO fazer:** não transformar isto numa revisão de texto de toda a app; não mexer em comentários.

## T10 — diagnóstico fechado (2026-11-01): não é defeito da aplicação

O helper `formularioDeLancamentoRapido` (`e2e/support/ui.ts:36-38`) procura
`locator('form').filter({ hasText: 'Natureza' })`. **O seletor de natureza saiu do formulário** e
passou a três botões fora dele — `Gasto`, `Ganho`, `Transferência` — com o `kind` a entrar por prop
(`kind: mode`, `transaction-quick-add.tsx:199`).

Dentro do `<form>` ficaram: `Valor`, `Data`, `Cartão`, `Para a conta`, `Categoria`,
`Número de parcelas`, `Descrição`. `grep -rn "Natureza" apps/web/src` só devolve os diálogos de
categoria, recorrência e regra.

**Provado em produção:** `/transacoes` tem os três botões e funcionam. A mudança veio de um commit
de 2026-10-14 e ninguém deu por ela porque o CI estava vermelho desde essa data — o teste deixou de
proteger o que dizia proteger, e a falha era invisível.

**Correção:** pertence ao QA (é dono do `e2e/`): trocar o filtro por algo estável e acessível
(`filter({ has: page.getByLabel('Valor', { exact: true }) })`), varrer os outros helpers à procura
do mesmo apodrecimento e só depois exigir 34/34.

## T26 — Editar lançamento devolve 500 (achado pela T10)

**Como apareceu:** a T10 corrigiu o teste obsoleto e, com ele a correr outra vez, a quarta verificação
falhou por motivo real. O teste estava a proteger um defeito que ninguém via há semanas.

```
⨯ Error: .partial() cannot be used on object schemas containing refinements
  apps/web/src/server/transactions-actions.ts:446-447
```

`updateTransaction` faz `createTransactionSchema.partial()` e `createTransactionSchema` é
`createTransactionShape.superRefine(...)` (`packages/shared/src/domain/transactions.ts:75`). No
Zod 4, `.partial()` sobre um schema com refinamento **lança na chamada** — por isso é 500 na
edição e o resto da aplicação funciona.

**Consequência:** qualquer edição de lançamento pela interface falha. É o ecrã mais usado da app.

**Já existe a peça certa:** `updateTransactionSchema` (`transactions.ts:147`), escrita à mão e sem
`.partial()` sobre refinamento.

**Varredura da mesma classe de defeito (feita pelo Lead):** os outros sete `.partial()` do projeto
não correm risco — `budgetShape`, `goalShape`, `recurrenceShape`, `ruleShape` são _shapes_ simples
(é para isso que o sufixo `Shape` existe) e `createAccountSchema`, `createCreditCardSchema`,
`createReceivablePayableSchema` e `createAccountGroupSchema` não têm refinamento. O refinamento de
`accounts.ts:147` é de outra schema (compra parcelada). **Só a transação está afetada.**

## T27 — Editar transferência está bloqueado (achado da T26)

Com o 500 da T26 corrigido, a edição de uma **transferência** chega finalmente à regra de negócio —
e é recusada sempre:

> «Numa transferência não podes mudar a conta nem a categoria. Elimina-a e cria outra.»

A regra recusa **pela presença do campo** `accountId`, e o diálogo de edição envia-o **sempre**
(`transaction-edit-dialog.tsx:141`). Ou seja: com o 500 ou com a correção, editar uma transferência
nunca funcionou — antes falhava antes de chegar à regra.

**Candidatos de correção:** (a) a ação compara valores em vez de presença
(`value.accountId !== existing.accountId`), que corresponde ao que a mensagem promete — só recusa
quando muda; (b) o diálogo deixa de enviar `accountId` quando não mudou. A (a) é mais robusta
porque protege também quem chame a ação por outro caminho; a decisão e a prova são da tarefa.

**Não é regressão de nada que tenhamos feito** — é um caminho que nunca esteve alcançável.

| T28 | **Endurecimento (opcional):** o schema de edição não exige o sinal do valor por tipo (a criação exige). Hoje nenhum caminho o explora; uma guarda de 2 linhas com `existing.kind` fecha-o | Dev | aberta (não bloqueia) | — |

| T29 | O teste de acessibilidade **não protege contra a regressão dos rótulos**: o axe não acusa `placeholder` como nome. Falta asserção de nome acessível | QA | aberta (após T31) | `relatorios/T29.md` |
| T31 | **Mobile e tema escuro nunca foram exercitados**: os e2e só correm em Chromium a 1280 px e no tema claro | Dev | a fazer | `relatorios/T31.md` |
| T32 | `CRON_SECRET` promete uma tarefa agendada que não existe (a geração de recorrências é manual, por botão) | Dev | a fazer | `relatorios/T32.md` |

## Ronda “defeitos abertos” (2026-11-03)

O utilizador pediu para resolver os seis defeitos que listei como abertos. Já fechados nesta mesma
ronda: **T10/T26** (500 na edição de lançamento) e **T18**. Entram agora:

- **T6** — variante `success` no `Badge` + token `--success` (claro e escuro) para o estado «paga»
  deixar de sair igual a «aberta».
- **T15** — o diálogo de contas a pagar/receber passa a mostrar os `fieldErrors` no campo, como o de
  grupos já faz desde a T12.
- **T9** — o e2e passa a correr contra o **build de produção** por omissão; contra `next dev` o
  _overlay_ do Next intercetou cliques e deu um falso negativo.
- **T31** — projetos de telemóvel (Chromium e WebKit) e tema escuro na configuração do Playwright; o
  ramo `Drawer` dos diálogos e o axe no escuro nunca foram exercitados.
- **T29** — asserção de **nome acessível** nos campos (o axe aceita `placeholder` como nome, e por
  isso não teria apanhado o defeito dos rótulos da T17).
- **T32** — remover `CRON_SECRET` do `.env.example` e do `turbo.json`: não há rota de cron e a
  geração de recorrências é um botão idempotente na própria interface (`generateDueRecurrences`).
  Criar infraestrutura de cron para um problema que a UI já resolve é o contrário de simplificar.

| T33 | **Em telemóvel nenhum formulário em `Drawer` pode ser submetido:** o rodapé fica abaixo do ecrã e o `DrawerContent` não rola (393×727: conteúdo 1742 px, `overflow-y: visible`) | Dev | a fazer (urgente — achado da T31) | `relatorios/T33.md` |

## T33 — o `Drawer` de telemóvel está partido (achado da T31)

Ao acrescentar o projeto de telemóvel ao Playwright, a configuração pedida revelou um defeito real:

```
viewport 393×727 (Pixel 5)
drawer: altura 581 px · conteúdo 1742 px · overflow-y: visible   ← não rola
botão «Criar Conta»: top 730 · bottom 762  (o ecrã tem 727)
scrollIntoView → não muda nada · clique → timeout
```

**Nenhum utilizador de telemóvel consegue criar, editar ou pagar uma conta a pagar/receber** — o
botão de submeter fica fora do ecrã e não há scroll. Vale para todos os diálogos em `Drawer` (mesma
estrutura em `ui/drawer.tsx`).

Não é flake: o Dev reproduziu fora do e2e, com números. E o defeito estava lá desde a T7 — ninguém
viu porque **o ramo de telemóvel nunca tinha sido exercitado**; foi preciso um projeto de telemóvel
para o pôr a descoberto. Confirma a tese de que "nunca testado" não é "não tem problemas".

**Correção esperada (escolhida pelo Lead):** corrigir o `Drawer` partilhado — altura máxima em `svh`
e miolo com `overflow-y-auto`, com o rodapé alcançável. Uma correção, todos os diálogos.

| T33 | **Em telemóvel nenhum formulário em `Drawer` podia ser submetido:** rodapé abaixo do ecrã e sem scroll | Dev | Dev done (medidas antes → depois; 81/81); em prova QA | `relatorios/T33.md` |
| T34 | **Inconsistência de telemóvel:** o diálogo de pagamento usa `Dialog` em todos os tamanhos e não `Drawer` como os outros dois, por isso abre centrado em vez de folha | Dev | aberta (visual, baixa prioridade) | — |

## Registo — T33 (2026-11-01)

Correção no primitivo (`ui/drawer.tsx`, 2 sítios): `max-h-[80vh]` → `max-h-[85svh]`,
`overflow-y-auto` + `overscroll-contain` no `DrawerContent`, e `DrawerFooter` **sticky** no fundo
(sem o sticky, o formulário de edição com uma linha a mais voltava a empurrar o botão para fora:
722–754 contra 727 de ecrã).

```
ANTES   conteúdo 1742 px · overflow-y: visible · botão 730–762 → fora (ecrã 727) · clique: timeout
DEPOIS  conteúdo 1851 px · overflow-y: auto    · botão 679–711 → dentro · clique cria a conta (1234 cêntimos)
```

Suite: **81/81** — `[telemovel] 45` 0/6 → **6/6**, `55` 3/3, `[escuro] 15-navegacao` 5/5,
`[chromium]` 67/67 sem regressões. Também provado: tema escuro nos dois ecrãs novos (fundo
`rgb(30,37,44)`, luminância 36 contra 19 da página) e o T15 no ramo telemóvel.

**Por verificar:** `svh` num telefone real com a barra do browser a aparecer; gesto de arrastar
para fechar; rodapé sticky com o teclado virtual aberto (o Playwright não emula teclado).

**Objeção DEVE do Revisor nesta ronda:** o bloco de comentário do `playwright.config.ts:20-22`
continuava a documentar «`next dev` e não `next start`» e a justificação com `spawn EPERM` —
contradizia o `command` da T9 e convidava a reverter a correção. Corrigido antes de publicar, junto
com o `channel` que os projetos novos não herdavam.

**Dívida declarada:** só **9 dos 81** testes correm em telemóvel, e são a única cobertura do
primitivo `Drawer` — passa a T3 continuada: um dia, os percursos principais também em telemóvel.

**Achado do Dev, por tratar:** `docs/spec/T8.4-e2e-e-desempenho.md` tem números medidos em `dev` e
agora esses já não são «limite superior» — são história de outra configuração. Ficheiro do QA:
ou se remedem contra o build de produção, ou passam a estar marcados como históricos com a data.
Fica registado para a próxima passagem do QA; o comentário do `playwright.config.ts` já aponta para
isso, para ninguém ler os números como atuais.

| T35 | **Três defeitos que a correção do `Drawer` expôs:** espaçador do `vaul` a inflar o scroll, foco preso ao fechar, formulário a guardar valores | Dev | Dev done (scroll 1851 → 612; 81/81); em prova QA | `relatorios/T35.md` |

## T35 — resíduos que só apareceram ao exercitar o `Drawer` a sério

Os três vieram do QA, todos medidos, nenhum inventado:

1. `drawer-content::after` ocupa **1233,88 px** vazios; rolar até ao fim deixa o rodapé e o último
   campo **acima** do ecrã (`top` −556 / −592). Ou seja: dá para rolar para dentro do nada. É
   consequência directa de pôr `overflow-y-auto` no `DrawerContent` — o espaçador do `vaul` passou a
   fazer parte da área rolável.
2. Ao fechar o drawer, o Chromium escreve `Blocked aria-hidden on an element because its descendant
retained focus` — gestão de foco do `vaul`, não tratada.
3. O formulário de criação **guarda os valores** ao reabrir: submeter outra vez dá «Já tens uma conta
   com essa descrição». Falta repor o formulário ao fechar ou depois de criar.

Nenhum deles é regressão de comportamento antigo — são todos consequência de o `Drawer` passar
finalmente a ser usado.

**Diagnóstico do espaçador (Dev):** é o `vaul` que o cria —
`[data-vaul-drawer]::after { position:absolute; top:100%; height:200% }`, um fundo pintado abaixo
da folha para o arrastar não deixar buraco. Como o `::after` é absoluto em relação ao
`DrawerContent`, pôr-lhe o scroll transformou-o em conteúdo: 2×617 ≈ 1234 px de vazio. **Não foi
removido** (riscava a animação de arrastar): o scroll passou para um wrapper interior. Área rolável
de 1851 → **612 px**, e no fim da rolagem o último campo (599–663) e o rodapé (679–711) ficam dentro
dos 727.

**Revisor:** aprovada sem achados materiais. Confirmou o que eu temia no foco — `quemAbriu` é lido
antes do efeito do `vaul`, apanha o botão; aberto por código o valor é `body` e `body.focus()` é
inócuo (e nesse caminho o Radix também não restauraria nada, porque as listas montam o diálogo por
linha); `focus()` num nó removido não lança. O `sticky` melhora com o wrapper e o `::after` fica fora
da área rolável.

**Verificação que só um telefone responde:** com `overscroll-contain` no wrapper, confirmar que o
**arrastar para fechar** do `vaul` continua a responder a partir do miolo. O Playwright não emula o
gesto; fica pendente de um teste manual num telefone real, junto com o teclado virtual.

| T36 | **Foco perdido ao fechar pelo «Cancelar» do drawer:** volta ao `body` em vez do botão que abriu (por Escape funciona) | Dev | Dev done (handler removido; 9/9); em prova QA | `relatorios/T36.md` |

## T36 — o foco só volta por Escape, não por «Cancelar»

Medido pelo QA em três ciclos, com clique real (CDP): **Escape ×3 → foco no botão «Nova Conta»**
(certo); **«Cancelar» ×3 → foco no `body`** (errado). Com `.click()` sintético voltava ao botão, o que
diz que o comportamento depende de o botão ter recebido foco antes de fechar — é precisamente o caso
de quem usa teclado.

Hipótese de trabalho para o Dev: o alvo do foco é apanhado no **render** do conteúdo, e no caminho
do «Cancelar» esse render volta a acontecer depois de o foco já estar dentro do diálogo, pelo que o
ref aponta para o próprio botão «Cancelar» (que desaparece a seguir). Alternativa preferível:
**não** fazer `preventDefault()` quando não há alvo guardado, deixando o Radix devolver o foco ao
trigger — que é o comportamento por omissão dele.

**Fechado — e a correção foi apagar, não acrescentar.** O Dev mediu com e sem o handler:

```
COM o nosso onCloseAutoFocus   Escape → BUTTON ×3 ✓   Cancelar → BODY ×3 ✗   overlay → BODY ×3 ✗
SEM nada nosso (Radix puro)    Escape → BUTTON ×3 ✓   Cancelar → BUTTON ×3 ✓ overlay → BUTTON ×3 ✓
```

O `preventDefault()` era o que anulava o restauro do Radix, e o nosso `focus()` ia para um nó a
desmontar. O aviso `aria-hidden` também vinha daí: 0 em 13 fechos depois de o código sair.
`ui/drawer.tsx` ficou com **+14/−3** contra o HEAD (era +34/−2), sem uma linha de foco.

**Nota honesta do Dev:** os diálogos abertos a partir da lista (edição, pagamento) não têm gatilho,
logo fecham com o foco no `body` por desenho — não são o caso do critério, mas fica escrito.

| T37 | **Foco perdido nos diálogos abertos pela lista** (edição, pagamento): 5 de 6 modos de fecho deixam o foco no `body`, não na linha/cartão de origem | Dev | aberta (achado da T36; nunca tiveram gatilho) | `relatorios/T37.md` |

| T38 | **Ecrã de bens e dívidas:** o património líquido conta com eles e não havia forma de os registar | Dev | **fechada** (QA 8/8; suite 87/87; `e2e/26-patrimonio.spec.ts`) | `relatorios/T38.md` |
| T41 | **O Painel só mostra os KPIs quando há lançamentos** (`hasData`), e `/patrimonio` não mostra número no estado vazio | Dev | **fechada** (QA 5 cenários; incluindo cartão com fatura aberta a dar negativo) | `relatorios/T41.md` |
| T42 | **O património líquido do Painel ignora as faturas de cartão abertas e o valor dos objetivos** | Dev | Dev done (fatura −25 000, objetivo +50 000; ambos os ecrãs iguais); em prova QA | `relatorios/T42.md` |

## T38 — ecrã de bens e dívidas (medido antes de planear)

Antes de planear, a base de teste dizia: **0 bens, 0 dívidas** — o património do Painel era só contas
menos cartões. Confirmava a queixa do utilizador.

Resultado (pela interface, valores da base e do Painel):

```
Painel inicial                         0
bem «Casa» 12.500,00           → base 1250000 · Painel 1 250 000
dívida 3.000,00 (3,50 % → 350 bp) → Painel 950 000
editar o bem para 13.000,00    → base 1300000 · Painel 1 000 000
arquivar o bem                 → linha fica, `archivedAt` preenchido · Painel −300 000
valor 0 / datas trocadas       → mensagem no campo, 0 linhas criadas
telemóvel 393×727              → Drawer, «Registar bem» 639–671 dentro de 727
```

Testes: 522 → **541** (19 de schema). Gate verde.

**Fora da lista pedida, com justificação aceite:** `server/dashboard.ts` (o `netWorth()` era chamado
sem `assets`/`liabilities` — sem isto o critério 1 era impossível) e `packages/db/smoke.mjs`
(a `/patrimonio` no fumo, que o próprio âmbito pedia).

**Complexidades acima da referência:** `updateLiability` 15, `createAsset`/`updateAsset`/`createLiability`
6–10. Vêm do idioma de updates parciais que o projeto j谩 usa (`...(value.x !== undefined ? …)`), o
mesmo do `updateTransaction` (14). Não se baixa sem perder tipos do Prisma — fica declarado.

## T38 — objeções DEVE do Revisor (2026-11-03)

**(a) Dois «património líquido» com fórmulas diferentes.** A página faz `bens − dívidas` inline
(`patrimonio/page.tsx:30`) enquanto o Painel usa `netWorth({accounts, assets, liabilities})`
(`dashboard.ts:249`). Com 10 000 € em contas, 200 000 € de casa e 150 000 € de crédito, o Painel diz
**60 000 €** e a página diz **50 000 €** — o mesmo nome, dois números. O comentário do próprio
ficheiro diz que usa o motor, e não usa.

**(b) Não se pode gravar uma dívida liquidada.** `positiveCentsSchema` (exige > 0) foi usado para
`valueInCents`, `outstandingInCents` e `installmentAmountInCents`; uma dívida a 0,00 € devolve «O valor
tem de ser maior que zero». `nonNegativeCentsSchema` existe precisamente para saldos e valores de bens.

**Confirmações úteis do Revisor:** não há duplicação com contas/cartões/faturas (chaves distintas do
_breakdown_); o filtro de arquivados está nas consultas, como nas categorias; todas as consultas levam
`userId`; as duas queries novas viajam no `Promise.all` que já existia. E a razão pela qual o T26 não
se repete aqui: o `.partial()` corre sobre o `liabilityShape` **antes** do refinamento.

## Nota honesta sobre o critério «zero» da T38

O critério 5 que escrevi pedia «valor 0 → mensagem». O Revisor depois mostrou que **uma dívida
liquidada tem de poder gravar-se a 0,00 €** e a correção passou a aceitar zero (`nonNegativeCentsSchema`,
e o mesmo para bens). O QA fez bem em assinalar a contradição: **o critério estava errado, não o
código**. O teste e2e ficou com o comportamento real e um comentário; a regra é «zero é válido»,
por decisão registada — quem mudar isso muda também o schema e o teste.

## T42 — O património líquido do Painel está incompleto (achado do Revisor na T38)

`dashboard.ts:249` chama `netWorth({ accounts, transactions, assets, liabilities, upTo })` e **não
passa `invoices` nem `goalMovements`**. Só que a fórmula está escrita no próprio módulo
(`packages/shared/src/finance/netWorth.ts:17-23`):

> `ativos = saldos em conta + investimentos + bens` · `passivos = fatura de cartão aberta + dívidas`
> e, por decisão documentada, **o valor acumulado em objetivos conta como ativo**.

Faltam, portanto, duas parcelas reais: **a dívida dos cartões** (faturas abertas) — que faz o número
sair **inflacionado** — e **o valor em objetivos** — que o faz sair **subavaliado**. O `NetWorthBreakdown`
já tem `invoicesInCents` e `goalsInCents`; o Painel simplesmente não lhes dá dados.

Isto é anterior ao nosso trabalho, mas torna-se mais sério agora: até hoje a página de património e o
Painel discordavam; agora mostram **o mesmo número errado nos dois sítios**, e a confiança que isso
transmite é pior do que a incoerência anterior.

**Correção esperada:** carregar as faturas abertas e os movimentos de objetivo no `dashboard.ts` e
passá-los ao motor (as consultas já existem em `server/invoices.ts` e `server/goals.ts`), sem escrever
a fórmula no `dashboard`. Prova: um cartão com fatura aberta de X faz o património descer X, e um
objetivo com Y acumulado faz subir Y — medido nos dois ecrãs.

## Duas instruções minhas que estavam erradas (T42-b), registadas

1. **Tirar três colunas do `select` dos objetivos: não é possível sem mexer no motor.** `FinanceGoal`
   (`packages/shared/src/finance/types.ts:139`) exige `targetAmountInCents`, `targetDate` e
   `contributionFrequency`, apesar de o `netWorth` só ler dois campos. O Dev aplicou, viu o
   `TS2322`, e **reverteu em vez de fazer cast ou de inventar valores** — fez bem. As três colunas
   custam bytes; mudar o contrato do motor (usado também pelo `goalProgress`) para poupar bytes não se
   justifica. **Decisão: ficam.**
2. **O critério «`grep toRecurrenceFrequency` → 0» era inválido**: a função também serve as
   recorrências (`dashboard.ts:334`), que nada têm a ver com objetivos. Devia ter pedido «0 no bloco
   dos objetivos», não no ficheiro.

**O que ficou feito e provado:** o filtro de data na consulta dos movimentos
(`date: { lte: today }`), com os cinco números do breakdown idênticos ao cêntimo.
| T39 | **A condição `cardId` das regras era ignorada pelo motor** (e a regra aparecia como inválida) | Dev | Dev done (teste vermelho → 20/20; 548 testes); em prova QA | `relatorios/T39.md` |
| T40 | **`GoalMovementType.yield` era código morto** com uma migração associada | Dev | Dev done (enum com 2 valores, 3 movimentos intactos, 90 000 antes e depois); em prova QA | `relatorios/T40.md` |

| T45 | **A importação passa a perguntar o cartão** (o `cardId` passa a chegar aos importados) | Dev | **reprovada na autorização:** a confirmação aceita um `cardId` de outro utilizador | `relatorios/T45.md` |

## T41 — a minha lista de seis termos estava errada, e o Dev provou-o

Eu pedi `hasData = lançamentos || contas || bens || dívidas || objetivos || faturas`. O termo `contas`
tornava o critério 1 impossível: **o registo cria sempre uma «Carteira principal»** (`provision.ts:63`),
logo haveria sempre uma conta e o estado de boas-vindas nunca apareceria. O Dev mediu, afastou-se da
lista e propôs:

```ts
hasData: transactions.length > 0 || patrimony.netInCents !== 0,
```

Dois termos, um ramo, zero consultas novas — e a pergunta certa: **«há valor?»**, não «há registos?».
Fica registado porque é a segunda vez hoje que uma instrução minha é corrigida com prova (a primeira
foi o `select` dos objetivos, T42-b).

**Resíduo conhecido e aceite:** um bem ou objetivo **a zero**, sem mais nada, ainda mostra o estado
vazio — `netInCents` é 0. Distinguir exigiria contar registos sem contar a carteira provisionada;
para um canto tão estreito, não vale a linha extra.

## T45 — a confirmação não confirma a posse do cartão (falha de autorização, 2026-11-03)

O QA forjou o pedido: escolheu o **próprio** cartão na interface e reescreveu a chamada da server action
com o id do cartão de **outra** utilizadora. Resultado:

```
pré-visualização → «Cartão não encontrado.»            (recusa, correto)
confirmação      → «2 movimentos importados»           (aceita)
base             → 2 transações do atacante com cardId = cartão da vítima, paymentMethod CREDIT
```

**Causa:** `import-actions.ts:96-104` e `:130-138` verificam a posse — **as duas dentro do
`previewImport`** — com um comentário a dizer «a confirmação repete esta verificação». Não repete:
`confirmImport` (`:215-281`) valida a conta (`:224-232`) e as categorias (`:247-265`) e passa o
`cardId` ao `runConfirm`, que grava (`import-confirm.ts:314`).

**É a terceira vez que esta classe aparece** (T13 com `accountIds`, a importação agora, sempre com um
comentário a prometer uma verificação que não existe no sítio onde é usada). Regra que fica: um
comentário a dizer «isto é verificado ali» não substitui a verificação aqui — e quem escreve o
comentário é quem tem de provar que o outro sítio verifica.

**O que passou:** OFX com cartão (2/2 com `cardId` e `CREDIT`), aplicar regras ao já importado (2
categorizados), sem cartão (`null`/`DEBIT`), desfazer a importação (2 apagados, 0 restantes).

## T45 — A importação não conhece cartões (achado do QA na T39)

Medido: um CSV de 2 linhas importado pela interface fica com `origin = IMPORTED` e **`cardId = null`**
nas duas. Com uma regra «só no cartão A» e uma regra de descrição «supermercado», a pré-visualização
diz «1 seria categorizado» — e é a da **descrição**: a regra de cartão não apanha nenhuma.

Causa: `import-confirm.ts:299-311` cria com `financialAccountId` e `paymentMethod: 'DEBIT'`, e **não
escreve `cardId`**; e o fluxo de importação (`import.ts`, `import-preview.tsx`) **não pergunta** a que
cartão pertence o extrato. Não é um `if` em falta: é uma pergunta que a interface não faz.

**É funcionalidade, não correção** — e há uma decisão de produto dentro dela: um extrato de cartão
importado deve virar lançamentos com `cardId` (e entrar na fatura desse cartão?) ou continuar a ser
lançamentos de conta? A resposta muda o desenho.

## T44 — Duplicação do mapeamento de objetivos (declarada, do Revisor)

A conversão dos movimentos de objetivo para o tipo do motor está escrita em dois sítios:
`goals.ts:75-81` (ecrã `/objetivos`) e dentro do `dashboard.ts` (património). O Revisor identificou o
corte: `toFinanceGoal` e `toFinanceGoalMovement` para `server/mapping.ts`, ao lado de
`toFinanceInvoice`, usados pelos dois — com a terceira variante (`goals.ts:178`) a ficar com os campos
extra que só ela tem.

**Porque não entrou já:** o corte mexe em `goals.ts`, que serve uma página fechada e testada, para
ganhar estrutura e não comportamento. O custo/risco de o fazer na véspera de publicar é maior do que
o da duplicação existir mais uma semana. Fica registado com o sítio exato.

**Achados menores do mesmo Revisor, a corrigir já (T42-b):** o `select` dos objetivos traz
`targetAmountInCents`, `targetDate` e `contributionFrequency` que o `netWorth` não lê (`netWorth.ts:57`
só usa `id` e `initialReservedInCents`), e o `toRecurrenceFrequency` é peso morto; e
`goalMovement.findMany` não tem filtro de data, pelo que o _payload_ cresce sem tecto (o motor
descarta depois, mas os dados já viajaram).

## Regras de método que ficaram desta ronda

- **Um teste de largura precisa de conteúdo que force a largura.** Medir um ecrã vazio dá sempre verde — foi o que quase deixou passar o scroll de `/transacoes` (o utilizador do `globalSetup` não tem transações). Se um teste mede layout, os dados que provocam o problema têm de existir no próprio teste.
- **Quando uma varredura de texto encontra uma frase, a lista do padrão está errada.** Corrigir a frase e voltar a correr; cada ronda encontrou mais. O critério de fim é o `grep` dar zero, não a lista de sítios que eu vi a olho.

## Regras

- Cada tarefa tem um critério de aceitação verificável. "Funciona" não é critério.
- Tarefa que cresce a meio: pára, divide, e volta a escrever a lista.
- Tarefa fechada sem prova = tarefa aberta.
- **Enquanto o QA estiver a provar, o Dev não reconstrói `.next`.** Os dois partilham a
  mesma árvore: um `build`/`dev` a meio da medição dá 500 e `ChunkLoadError`, e a corrida
  inteira do QA deixa de valer (aconteceu duas vezes na T46). Quem precisa de construir
  avisa o Lead e espera a vez.
- **Quem mede não aproveita números de um build que já mudou.** Corrida invalidada a meio
  diz-se invalidada e repete-se — não se escolhem os valores que interessam.

---

# Vaga 1 — "barato e visível" (decisão D7–D11, 2026-11-17)

Objetivo: a aplicação fica melhor sem tocar no modelo de dados. **Nenhuma tabela, nenhuma
coluna, nenhuma migração em toda a vaga.** Publica-se tudo de uma vez no fim.

| ID  | Tarefa                                                                                                                      | Dono | Estado                                                                                  | Prova               |
| --- | --------------------------------------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------- | ------------------- |
| T46 | **Modo privacidade:** um interruptor troca os montantes por máscara, sem flash ao recarregar                                | Dev  | **fechada** (QA: 13→0 montantes, 0 px de altura, varredura limpa; Revisor: APROVO)      | `relatorios/T46.md` |
| T47 | **Sparkline de 30 dias no cartão de cada conta**                                                                            | Dev  | **fechada** (PASS QA; gate verde com 563; payload: 0 em 8 rotas, 3 séries em `/contas`) | `relatorios/T47.md` |
| T48 | **Filtro por valor no extrato** (`>`, `<`, `=`), chip removível — os chips e o total já existiam                            | Dev  | **fechada** (PASS QA re-provado; teto de 32 bits provado nos 4 lados; APROVO)           | `relatorios/T48.md` |
| T49 | **Sugestão de descrição** a partir do histórico, com texto livre sempre aceite                                              | Dev  | **fechada** (PASS QA; lista no fluxo, um clique grava, `Escape` nos 3 casos)            | `relatorios/T49.md` |
| T50 | **Cores de dinheiro com significado:** trocar as cores de paleta escritas à mão e apontar os gráficos aos tokens semânticos | Dev  | **fechada** (PASS QA; `axe` 2/6 → 0; borda 1 px a render)                               | `relatorios/T50.md` |
| T51 | **`/contas`, dois defeitos herdados:** nome comprido cortado a seco e contraste do cartão arquivado (3,12:1)                | Dev  | **PASS do QA** nos dois defeitos; confirm do Revisor em curso                           | `relatorios/T51.md` |

## T46 — Modo privacidade

**Porque:** hoje qualquer pessoa ao lado vê os saldos. É o item mais barato do plano e
serve de cronómetro da vaga (nenhum schema, nenhuma dependência).

**Comportamento esperado**

1. Um botão no cabeçalho (junto ao `CommandPalette` e ao `ModeToggle`) alterna entre
   «Ocultar montantes» e «Mostrar montantes», com `Eye`/`EyeOff` do `lucide`.
2. Atalho **`Ctrl+Shift+H`** (não `Ctrl+H`: no Chrome e no Firefox abre o histórico).
   Não dispara dentro de campos de texto nem com a paleta aberta.
3. Com a máscara ativa, cada montante renderizado por `<Amount>` mostra `••••` no lugar
   dos dígitos, **com o mesmo número de caracteres** do valor formatado, para o layout
   não saltar.
4. A preferência fica em `localStorage` (`financas:privacidade`), aplicada por um script
   inline no `<head>` **antes** da hidratação — recarregar nunca mostra um valor verdadeiro.
5. **Não** se mascaram: campos de formulário (`money-input`, pré-visualização de
   parcelas), textos de regras, nem exportações (CSV/XLSX/PDF). A privacidade é do ecrã.

**Ficheiros que pode escrever:** `components/amount.tsx` · novo
`components/privacy-mode.tsx` (provider + botão + atalho) · `components/app-shell.tsx`
(cabeçalho) · `app/layout.tsx` (script inline e provider) · `components/category-donut.tsx`
(o total passa a usar `<Amount>`) · `app/globals.css` (a classe da máscara). Mais nada.

**Critério de aceitação (verificável, com números)**

1. Painel com dados reais: contar os montantes no DOM (atributo `data-amount`) — antes
   **N visíveis**, depois **N mascarados**, `N` igual nos dois lados.
2. A altura da página não muda ao alternar: medir `document.body.scrollHeight` antes e
   depois, a 360 px e a 1280 px; diferença ≤ 2 px.
3. Recarregar com `F5` mantém a máscara; **no texto visível** do HTML servido não há
   nenhum valor (prova por `curl`); o payload `self.__next_f` leva os números e isso é
   aceite — a máscara é de apresentação, não é segredo (D14).
4. Botão e atalho produzem o mesmo estado; o atalho não dispara a escrever num campo.
5. Formulários e exportações continuam com valores (provar um CSV exportado com a
   máscara ativa).
6. Leitor de ecrã: o montante mascarado anuncia «montante oculto», não o valor.
7. `format:check`, `lint`, `typecheck`, `test`, `build` verdes; **556 testes** sem
   alterações; zero dependências novas; zero migrações.

**O que NÃO fazer:** não tocar no servidor, na base de dados, no schema nem nas
exportações; não mascarar inputs; não mudar o atalho `Ctrl+K`; não acrescentar
dependências; não escrever em `e2e/` (é do QA); não fazer commit nem push.

### T46 — correção pedida pelo Lead (2026-11-17), depois da entrega do Dev

**Aceite do desenho do Dev:** cookie `financas-privacidade` + atributo
`data-privacidade` no `<html>` + `<span>` da donut a usar os ajudantes. O custo («todas as
rotas passam a dinâmicas, `/entrar` e `/registar` perdem o estático») fica registado em
`DECISOES.md` D12.

**Defeito a corrigir, dentro do mesmo âmbito:** os gráficos continuam a mostrar valores ao
passar o rato (`components/ui/chart.tsx:234` usa `toLocaleString()` no valor, e o eixo da
projeção formata em euros). Um modo que se chama privacidade e mostra números no tooltip não
cumpre o que promete.

**Ficheiros adicionais autorizados:** `components/ui/chart.tsx` (prop opcional
`masked` no `ChartTooltipContent`) · `components/cashflow-chart.tsx` ·
`components/dashboard-forecast-chart.tsx` (tooltip **e** `tickFormatter` do eixo) ·
`components/category-donut.tsx` (já na lista).

**Critério:** máscara ativa → o DOM do tooltip e os rótulos do eixo **não têm um único
dígito** nos três gráficos; a forma e o tamanho do gráfico não mudam; com a máscara
inativa, tudo continua exatamente como hoje (mesmo `toLocaleString()`, sem "melhorias" de
formatação).

### T46 — correção 2: valores servidos fora do `<Amount>` (achado do Revisor, 2026-11-17)

O Revisor encontrou dois ecrãs que mostram dinheiro em texto montado **no servidor**, fora
do `<Amount>` — e por isso visível com a máscara ligada:

| Sitio                                        | O que mostra                                                   |
| -------------------------------------------- | -------------------------------------------------------------- |
| `app/(app)/page.tsx:282,297`                 | dica do KPI «Por competência: 1 234,56 €» na vista por omissão |
| `app/(app)/page.tsx:173`                     | dica do KPI de cartão «Limite disponível: … €»                 |
| `app/(app)/contas-pagar-receber/page.tsx:66` | «Valor Pendente» somado à mão (`/ 100`) e impresso com `€`     |

**Ficheiros adicionais autorizados:** `app/(app)/page.tsx`,
`app/(app)/contas-pagar-receber/page.tsx` (mais os já autorizados, para os menores).
**Aspeto:** o resultado visual com a máscara **inativa** tem de ficar igual — cor e
tamanho medidos antes e depois nesses três sítios.

**Menores do mesmo Revisor, a fechar agora:** nome do cookie numa só constante
(`layout.tsx` vs `privacy-mode.tsx`) · `Secure` quando a página é https · texto para
leitor de ecrã no tooltip mascarado (como o `<Amount>` já tem) · `formatAmountText`
deixa de ser exportado se não tem consumidor externo. O script no `<body>` fica onde está.

**Critério de vaga (novo):** com a máscara ligada, varrer os **14 ecrãs** do `nav.ts` e
listar **todos** os textos com dígitos que restem, classificando cada um: montante ou não
(percentagens, contagens, datas e números de parcela são legítimos). A varredura é o
critério — não a lista de sítios que alguém se lembrou de abrir.

### T46 — fecho (2026-11-17): QA PASS, Revisor APROVO

Prova do QA no build final (Painel com dados, a 1280 px):

| Medida                                         | Antes | Depois                        |
| ---------------------------------------------- | ----- | ----------------------------- |
| Montantes visíveis (`[data-amount='visivel']`) | 13    | **0**                         |
| Elementos com dígitos (Painel)                 | 38    | 14                            |
| Caracteres dígito (Painel)                     | 137   | 45                            |
| `scrollHeight` (Painel)                        | 2228  | 2228 (**0 px**)               |
| Altura a 360 px, 15 ecrãs                      | —     | **0 px**, 0 elementos movidos |

Os 14 textos que continuam com dígitos são datas, percentagens, contagens e números de
parcela — classificados um a um em `relatorios/T46.md`. Restam **2** textos com `€`: os
exemplos estáticos de `/importar` e `/definicoes`, que não são dados do utilizador.

**Os dois extremos do arranque foram medidos**, e é o que valida o desenho D12:

- Cookie apagado, `localStorage` vivo: primeiro frame **0 valores visíveis** (CSS) e os 13
  ocultos depois da hidratação.
- `localStorage` apagado, cookie vivo: primeiro frame já **12 ocultos / 0 dígitos**; com JS
  desligado o HTML vem **todo oculto** (200). É o caso que justifica o cookie.

Também provado: `F5` e um segundo separador mantêm os 13 ocultos; atalho dispara livre e
não dispara em campo de texto nem com a paleta aberta; CSV/JSON continuam com valores,
campos e pré-visualização de parcelas legíveis; `axe` 0 violações; 393×851 em modo escuro
com 0 px; suite **88/88** (87 + `e2e/27-privacidade.spec.ts`); gate verde com **556**
testes; base reposta ao baseline (2 users, 0 `qa.*`/`e2e-*`).

**A contradição dos +36 px fechou-se contra o QA**, e está bem: eram do build intermédio
(`.next` a ser substituído → 500/`ChunkLoadError`), não da máscara. Nenhum dos dois lados
tinha razão por autoridade — tinha razão a medição no build que não mudou.

**Fica como dívida (não é regressão da T46):** `/relatorios` a 360 px tem `scrollWidth`
382 > 360 **antes e depois** da máscara. Passa para a T50 ou para uma tarefa própria de
telemóvel.

**Nota de critério:** o critério 3 dizia «no texto visível não há nenhum valor» — cumpre-se.
Não dizia «nenhum dígito»: as datas do eixo X e do tooltip (`09/12`) mantêm-se, e é o
certo (D15). O critério de vaga já previa esta distinção; ficou registada.

## T47 — Sparkline de 30 dias em cada conta

**Porque:** `/contas` mostra o saldo de hoje e mais nada. Uma linha de 30 dias diz se a
conta está a subir ou a descer sem abrir `/relatorios`, e é o tipo de coisa que se vê de
relance. Zero schema, zero dependências.

**Âmbito (mais estreito do que a linha antiga da tabela):** `AccountCard`, que é usado
**só** em `/contas` (ativas e arquivadas). O Painel não desenha cartões por conta — o KPI
dele é do âmbito escolhido —, por isso não entra nesta tarefa.

**Comportamento esperado**

1. Cada cartão de conta mostra uma sparkline de **30 pontos**, um por dia, do 30.º dia
   atrás até hoje (fuso `Europe/Lisbon`, via `todayInLisbon()`).
2. O saldo de cada ponto é o **do motor**: `accountBalanceInCents(conta, transações, { upTo: dia })`
   não muda de semântica (só liquidadas, ignora as marcadas como ignoradas). Não se escreve
   uma segunda fórmula de saldo.
3. **O último ponto tem de ser igual ao `balanceInCents` que o cartão já mostra.** É o
   teste que apanha o caminho paralelo; se divergir, está errado o cálculo da série.
4. Sem movimentos nos 30 dias: linha horizontal (a caixa não desaparece, não há salto de
   layout).
5. **Privacidade (T46):** a sparkline mostra forma, não números. Sem tooltip, sem eixo, sem
   `aria-label` com euros; o SVG vai `aria-hidden` com um `sr-only` tipo «tendência dos
   últimos 30 dias». Com a máscara ativa, a varredura de textos com dígitos de `/contas`
   tem de continuar a dar **zero montantes**.
6. Custo: a série sai das transações que `listAccounts` **já** carrega. Nenhuma consulta
   nova, nenhum `N+1` por conta.

**Ficheiros que pode escrever:** `packages/shared/src/finance/balance.ts` (função de série,
pura) · `packages/shared/src/finance/__tests__/balance.test.ts` (testes dela) ·
`apps/web/src/server/accounts.ts` (`AccountView` ganha a série já calculada) · novo
`apps/web/src/components/account-sparkline.tsx` · `apps/web/src/components/account-card.tsx`
(render). Mais nada.

**Critério de aceitação (verificável, com números)**

1. Teste unitário: série de 30 pontos para um conjunto conhecido de transações; **último
   ponto === `accountBalanceInCents` sem `upTo`**; um caso com conta sem movimentos (reta);
   um caso com transferência entre contas (não a contar duas vezes).
2. `/contas` com ≥3 contas: todas as sparklines têm 30 pontos e **um só** tamanho medido
   (largura × altura iguais em todas).
3. Consultas: o número de queries do Prisma em `/contas` é **o mesmo** antes e depois
   (provar com o log de queries, não por leitura).
4. A 360 px: `scrollWidth <= 360` em `/contas`, e a altura do cartão igual entre os cartões
   da mesma grelha.
5. Máscara ativa: 0 montantes visíveis em `/contas` e a varredura de textos com dígitos não
   ganha nenhuma entrada nova em relação à T46.
6. `format:check`, `lint`, `typecheck`, `test`, `build` verdes; testes **≥ 556** (os novos
   somam, nenhum antigo se altera sem justificação); zero dependências novas — **não usar
   `recharts`** para isto (já existe, mas um SVG de 30 pontos custa ~20 linhas e não arrasta
   o runtime dos gráficos para dentro de cada cartão); zero migrações.

**O que NÃO fazer:** não acrescentar `recharts`/`d3` ao cartão, não ir buscar dados ao
cliente (nada de `fetch` em `useEffect`), não tocar no motor nem nas regras de saldo, não
mascarar nem esconder a linha com a máscara ativa (a forma é o que se quer ver), não mexer
em `e2e/` (é do QA), não fazer commit nem push.

### T47 — correções menores pedidas pelo Revisor (2026-11-17) — **feitas, à espera do gate**

As três estão na árvore: docstring reescrito, `listAccounts({ withSeries: true })` opt-in
com `balanceSeries?:` (e o `todayInLisbon()` só no ramo que precisa dele), e
`--color-chart-balance` mapeado com `text-chart-balance` no componente. O cartão não desenha
`<svg>` quando a série falta. Nada construído ainda: o gate e a prova de payload
(zero `balanceSeries` nos 8 consumidores, 30 pontos por conta em `/contas`) correm depois do
relatório do QA.

O Revisor aprovou o comportamento (DEVE: nenhum) e deixou três menores. Verifiquei os três
no código antes de os aceitar; vão para o Dev **quando o QA fechar**, porque o build está
congelado a meio da medição.

1. **O comentário promete o que o teste desmente.** `balance.ts:73-75` diz que «o último
   ponto tem de coincidir com o saldo que o cartão mostra», e `balance.test.ts:264-275`
   fixa o caso em que não coincide (liquidado com data futura). Reescrever a frase: coincide
   **exceto** com liquidados de data futura. Quem ler o comentário hoje «corrige» a série
   para bater com o número e esconde a divergência de propósito.
2. **A série viaja em 9 páginas; só uma a desenha.** `AccountView` ganhou `balanceSeries` e
   `listAccounts()` é chamado em `transacoes`, `cartoes`, `objetivos`, `contas-pagar-receber`,
   `importar`, `recorrencias`, `regras`, `consolidacao-contas` e `contas` — 30 números por
   conta calculados e serializados no payload de oito páginas que não têm sparkline.
   Corrigir com um campo opcional preenchido só no caminho de `/contas` (ou
   `listAccounts({ withSeries: true })`); o resto dos consumidores fica igual.
3. **A cor da linha é da paleta, não do significado.** `--chart-balance: var(--chart-1)`
   existe em `globals.css:115` mas não tem `--color-chart-balance` no `@theme`, logo não há
   classe Tailwind e o componente usa `text-chart-1`. Quando a T50 reescrever `chart-1..5`,
   a linha do saldo muda de significado por arrasto. Mapear o token e usar
   `text-chart-balance` — ou apagar o alias morto, mas então a linha não tem nome próprio.

**Ficheiros adicionais autorizados para o ponto 3:** `apps/web/src/app/globals.css` (uma linha
no `@theme`) e `apps/web/src/app/(app)/contas/page.tsx` (uma linha: `listAccounts({ withSeries: true })`,
porque `listAccounts()` não sabe quem a chama). Sem mudança de cor visível: o valor continua
a ser `--chart-1`.

**Regra para o cartão:** desenha a linha **só** quando a série existe. Sem série, nada de
`<svg>` vazio nem caixa reservada — melhor um cartão sem linha do que uma reta falsa.

### T47 — prova do QA (2026-11-17): PASS, com 2 defeitos herdados

**A linha bate com o número — e o desvio é exatamente o futuro.** Sem lançamentos futuros,
5/5 contas com o último ponto igual ao saldo impresso (232 655 = 2 326,55 €, 40 000, 100 000,
20 000, 0), e o `y` do SVG a bater com o valor esperado. Com **um liquidado de −777,77 € com
data de amanhã**: cartão **1 548,78 €**, último ponto parado em 232 655 → **desvio
777,77 €**, e o `y` final não se mexe. Na base real, `settled AND date > hoje` dá **0**:
a divergência de D16 é alcançável por má digitação, não é o estado normal.

| Medida                                  | Resultado                                                                  |
| --------------------------------------- | -------------------------------------------------------------------------- |
| Pontos por sparkline                    | 30 em 5/5 contas                                                           |
| Tamanhos medidos                        | 283×32 (1280) · 192×32 (768) · 296×32 (360) — **um por largura**           |
| Alturas por linha da grelha             | `[292,292,292]` · `[332,332]` · `[312,312]` — iguais                       |
| `scrollWidth` a 360 px                  | **360**                                                                    |
| Máscara ligada                          | 6 montantes → **0** visíveis, **5 sparklines desenhadas**                  |
| Tema escuro (393×851)                   | `7,25:1`, traço de 1,5 px                                                  |
| Custo de `/contas` com 2000 lançamentos | 185 → **227 ms** (+42 ms, +23 %), HTML +141 B                              |
| Gate                                    | format 0 · lint 0 · typecheck 0 · test **563** · build 0 · suite **90/90** |

O custo medido confirma o que o Dev tinha dito por leitura e não conseguia provar: a série
não acrescenta consultas, acrescenta CPU (30 × movimentos) — e 227 ms com 2000 lançamentos
numa conta é aceitável para uma página que já fazia 185 ms.

**Dois defeitos que já existiam (não são regressão da T47) → T51:**

1. `axe` dá **3 `color-contrast` serious** em `/contas`, todas no cartão **arquivado**
   (`opacity-70` → 3,12:1, `#8b9298` sobre `#fefefd`), iguais com e sem máscara. O SVG é
   `aria-hidden` e não é a causa.
2. **O nome de uma conta comprida não trunca**: o `h3` tem `truncate`, mas o `clientWidth`
   mede 853 dentro de um cartão de 328 — o texto sai cortado a seco, sem «…», e o cartão
   chega a 973 px. O `scrollWidth` da página fica em 360 porque o transbordo é silencioso.
   É o defeito mais visível dos dois e é uma linha (`min-w-0` no filho flexível).

## T51 — `/contas`: o nome que não trunca e o cartão arquivado que não se lê

**Porque:** dois defeitos que já estavam antes da T47, encontrados ao medir aquele ecrã —
nenhum dos dois é regressão, os dois são visíveis.

1. **Nome comprido cortado a seco.** O `h3` do cartão tem `truncate`, mas o `clientWidth`
   mede **853 px dentro de um cartão de 328**, e o cartão chega a **973 px**. O
   `scrollWidth` da página fica em 360 porque o transbordo é engolido — por isso é que nunca
   apareceu numa medição de scroll horizontal.

   **O `min-w-0` já lá está** (`account-card.tsx:96`, no `div` do título), e não chega — o
   diagnóstico do QA («falta `min-w-0` no filho flexível») está incompleto. A cadeia é
   outra: `truncate` põe `white-space: nowrap`, logo o **min-content** do `h3` é o nome
   inteiro; o cartão é o `<li>` de uma grelha com colunas `1fr`, cujo mínimo é `auto` — e o
   `min-content` do item empurra a **track** da grelha para 853 px, independentemente do que
   se passe dentro do flex. Por isso o remédio tem de estar **acima** do flex (`min-w-0` no
   `<li>`/cartão, ou `minmax(0,1fr)` nas colunas), não dentro dele.

2. **Cartão arquivado abaixo do contraste mínimo.** `opacity-70` deixa o texto em
   **3,12:1** (`#8b9298` sobre `#fefefd`) → **3 violações `axe` `color-contrast` serious**,
   iguais com e sem máscara. O mínimo para texto normal é 4,5:1.

**Critério de aceitação**

1. Com um nome de 60+ caracteres: o cartão fica com a largura da grelha (**≤ 328 px** a
   360 px), o nome termina em «…», e nenhum cartão passa de `scrollWidth` da janela.
   Medir `clientWidth` do `h3` **dentro** do cartão **e** a largura do `<li>`, não só o
   `scrollWidth` da página — foi esse que escondeu o defeito durante três rondas.
2. O nome completo continua acessível (o texto no DOM não é cortado; só a pintura).
3. `axe` em `/contas` com uma conta arquivada: **0 violações `color-contrast`**; e a conta
   arquivada continua a distinguir-se de uma ativa à vista.
4. Sem mudar mais nada no cartão: mesmas alturas por linha da grelha, mesma sparkline.
5. `format:check`/`lint`/`typecheck`/`test`/`build` verdes; zero dependências.

**Sobre o defeito 2 (contraste):** o `opacity-70` tem de sair — nenhuma opacidade global
chega a 4,5:1. A conta arquivada continua a distinguir-se pelo `Badge` «Arquivada», pelo
fundo mais apagado e/ou pela borda tracejada; a distinção passa a ser **cor de superfície**,
não transparência.

**O que NÃO fazer:** não trocar a grelha por lista, não mexer na sparkline, não usar
`opacity` como sinónimo de «inativo» (é o que causa o defeito 2), não tocar em `e2e/` nem
fazer commit.

### T47 — 2.ª ronda de menores (Revisor, 2026-11-17 14:00): o `undefined` viaja

O Revisor corrigiu-me numa coisa que eu tinha afirmado ao contrário: **um prop `undefined`
não desaparece do payload** — o React Flight serializa-o como `"$undefined"` (verificado no
`react-server-dom-webpack`), o que são ~27 B por conta nas 8 páginas que não têm sparkline.
Ou seja, o opt-in não chegou a poupar o que eu disse que poupava.

Duas correções, ambas no `accounts.ts`/`account-card.tsx`:

1. **Chave fora, não `undefined`:** `...(today === null ? {} : { balanceSeries })`.
2. **O opt-in a falhar à vista:** com `AccountView` de campo opcional, um
   `listAccounts()` sem a flag em `/contas` compila e o cartão sai mudo, sem aviso. Duas
   assinaturas resolvem-no no tipo: `interface AccountWithSeries extends AccountView`
   (com `balanceSeries` obrigatório), `listAccounts({ withSeries: true }):
Promise<AccountWithSeries[]>` e `listAccounts(options?: { withSeries?: false }):
Promise<AccountView[]>`, e o cartão a receber `AccountWithSeries`. Um `undefined` a mais
   passa a ser erro de compilação.

**Correção minha, também:** o `todayInLisbon()` **já está** içado (`accounts.ts:81`, uma vez
por pedido, só no ramo que precisa dele). O nit que mandei ao Dev sobre isso estava errado —
não há nada a içar, e não se toca.

**Consequência para a prova de payload:** procurar `balanceSeries` **e** `$undefined`; um
grep por `null` dá falso negativo.

### T47 — fecho (2026-11-17): PASS do QA, APROVO do Revisor, gate verde

Última medição antes de fechar, com sessão real e 3 contas — o grep procura as **duas**
formas (`balanceSeries` e `"$undefined"`), porque um grep por `null` daria falso negativo:

| Rota                                                    | `balanceSeries` | `"balanceSeries":"$undefined"` | sparkline | `data-points="30"` |
| ------------------------------------------------------- | --------------- | ------------------------------ | --------- | ------------------ |
| 8 consumidores (`/transacoes` … `/consolidacao-contas`) | **0**           | **0**                          | 0         | 0                  |
| `/contas`                                               | **3**           | 0                              | 3         | 3                  |

E o custo do meu erro ficou medido ao byte: as 7 páginas que antes levavam a chave
perderam **99 B cada** (`/transacoes` 104 289 → 104 190, `/cartoes` 67 639 → 67 540,
`/regras` 74 504 → 74 405). O `undefined` ia mesmo no Flight.

**O que ficou garantido por tipo, não por disciplina:** `AccountWithSeries` com
`balanceSeries` obrigatório e duas assinaturas de `listAccounts`. Um `listAccounts()`
esquecido em `/contas` passou a ser **erro de compilação**, e não um cartão mudo que
ninguém nota.

Gate: `format:check` · `lint` 0 · `typecheck` 0 · `test` **563** (nenhum antigo alterado) ·
`build` ✓ · suite **90/90**. Zero dependências, zero migrações. `:3100` parada pelo PID,
base no baseline (2 utilizadores, 5 contas, 52 lançamentos, 0 de teste). Sem commit.

**Dívida que fica:** `/relatorios` a 360 px com 22 px de transbordo (T46), e a T51
(`/contas`: nome comprido sem reticências e contraste 3,12:1 no cartão arquivado).

### T51 — a causa era outra (nem a do QA, nem a minha) — 2026-11-17

O QA disse «falta `min-w-0` no filho flexível»; eu disse «é a track da grelha da página,
porque `white-space: nowrap` faz o min-content do `h3` ser o nome inteiro». **Os dois
estavam errados**, e o Dev mediu a cadeia antes de mexer:

```
DIV 662  block   (h3, truncate)          ← clientWidth 662 dentro de um cartão de 328
DIV 662  block   (min-w-0 flex-1)
DIV 766  flex    (min-width: auto — item da grelha do CardHeader)  ← é aqui que cresce
DIV 328  grid    (CardHeader)
DIV 328  flex    (Card, overflow-x: hidden)
LI  328          (grelha da página)
```

O `<li>` e o cartão **nunca** cresceram (328 a 360 px, 315 a 1280, mesmo com 120
caracteres): o `Card` tem `overflow-x: hidden` e, como é um scroll container, o seu
contributo de min-content é **0** — foi isso que escondeu o transbordo de todos os
`scrollWidth` que medimos. Quem não encolhia era a **grelha interna do `CardHeader`**, e o
`h3` ficava com a largura do texto, pelo que o `overflow: hidden` do `truncate` nunca chegou
a pintar a reticência: via-se um corte a seco na borda do cartão.

**Correção:** `min-w-0` no `div.flex` do `CardHeader`, uma classe. Depois, com um nome de
**120** caracteres (931 px de texto): `h3` 662 → **192** (360 px) e → **195** (1280), com
`clientWidth < scrollWidth`, logo a reticência é pintada; alturas inalteradas (304 / 292) e a
sparkline com 30 pontos. O texto completo continua no DOM.

**Lição para o método:** `scrollWidth` da página **não é** prova de que nada transborda —
um `overflow: hidden` a meio da árvore engole o defeito. Medir o elemento, e medir a cadeia
de pais até ao primeiro que tem largura fixa.

### T51 — DEVE do Revisor (14:08): o tracejado não pinta

`border-dashed` sozinho não desenha nada: o `Card` primitivo usa `ring-1 ring-foreground/10`
e **não** tem `border`, e o preflight do Tailwind põe `border: 0 solid` em `*`. Logo o
tracejado prometido não aparece em conta nenhuma, nos dois temas — e a única marca a
distinguir a arquivada fica a ser `bg-muted/40`, que é uma diferença de superfície de
6/255 (255,255,255 → 249,251,251 no claro; 30,37,44 → 35,42,49 no escuro).

**Dois motivos para isto importar:** o `opacity-70` saiu para ganhar contraste, e sem o
tracejado a arquivada passa a ser quase indistinguível de uma ativa — trocámos um defeito de
acessibilidade por um defeito de legibilidade, que é pior porque o `axe` não o vê.

**Correção:** `border border-dashed border-foreground/10 ring-0` (o `ring-0` evita a linha
dupla com o `ring-1` do primitivo). Prova exigida: `border-top-style: dashed` e
`border-top-width: 1px` computados, mais uma captura — não basta a classe no ficheiro.

**Achado secundário do mesmo Revisor, que é consequência do `min-w-0`:** a linha
tipo · instituição (`account-card.tsx:111`) não tem `truncate` nem `break-words`. Antes
empurrava o cartão; agora, com o `min-w-0`, uma palavra longa sem espaços **pinta por cima
do botão de ações**. Passa a `break-words` (não `truncate`: a instituição é texto do
utilizador e cortá-lo em silêncio é pior do que ele ocupar duas linhas).

### T51 — prova do QA (14:12): os dois defeitos fechados

| Medida                           | Antes                      | Depois                                                               |
| -------------------------------- | -------------------------- | -------------------------------------------------------------------- |
| `axe` em `/contas` com arquivada | 3 `color-contrast` serious | **0** (com e sem máscara)                                            |
| `muted-foreground` no cartão     | **3,12:1**                 | **5,68:1** (claro, QA) / 5,75:1 (Revisor) · escuro 5,46:1 (Revisor)  |
| Título / `Badge`                 | —                          | 16,40:1 (claro) · 15,04:1 (escuro)                                   |
| Nome de 81 caracteres            | corte a seco               | `clientWidth` 195 e 192 < `scrollWidth` 667 → **reticência pintada** |
| `textContent` do nome            | —                          | **81 caracteres** (nada perdido no DOM)                              |
| Altura da arquivada              | 292                        | 294 (**+2 px**, a borda) — ativas iguais                             |
| Sparkline / `scrollWidth` 360    | 30 pontos / 360            | 30 pontos / **360**                                                  |

Suite **91/91** com a spec nova (`e2e/29-contas-truncagem.spec.ts`, criada e apagada pela interface).

**A ressalva do QA, que aceito e registo:** a borda tracejada tem **1,22:1** (claro) e **1,34:1**
(escuro) — é **decoração**, não é a marca que distingue. A distinção real é o `Badge`
«Arquivada» (texto, 16,40:1) e o botão «Travar saldo» desativado, com 8/255 (claro) e 12/255
(escuro) de diferença de superfície a ajudar.

**É aceitável, e por uma razão de acessibilidade e não de gosto:** uma marca **em texto**
sobrevive a daltonismo, a ecrã em cinzento e a leitor de ecrã — é mais robusta do que
qualquer diferença de cor. Subir a borda a 3:1 seria mexer no token `--border`, que é a
decisão **A4** (pendente do utilizador, 1,31:1). Logo isto não é dívida da T51: é o mesmo
assunto da A4, e fica lá.

**O que a T51 corrigiu de facto:** o texto deixou de estar escondido atrás de 70% de
opacidade (3,12:1 → 5,68:1), o nome truncou com reticência, e o texto completo continua a
existir para quem não vê a pintura.

## T48 — Filtro por valor no extrato (o resto da linha antiga já existe)

**Antes de escrever esta tarefa fui ao código, e a linha antiga da tabela estava errada em
dois dos três pontos:**

| O que a linha prometia            | Estado real                                                                                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chips removíveis                  | **Já existe** — `FilterChips` (`money-filters.tsx:377`), usado em `transaction-filters.tsx:251`, com «Limpar tudo»                                                  |
| Total do conjunto filtrado        | **Já existe** — rodapé da tabela (`transaction-table.tsx:405`), `count` + `_sum` na mesma consulta (`transactions.ts:105-145`), e inclui ignorados e não liquidados |
| Operador de valor (`>`, `<`, `=`) | **Falta** — não há `minAmount`, `maxAmount` nem qualquer parâmetro de valor                                                                                         |

Logo a T48 é **só** o operador. Não se reescrevem chips nem totais.

**Semântica, decidida (D19): o filtro é sobre o módulo do valor.** «Acima de 25 €» tem de
apanhar a compra de −5 000 cêntimos. Se fosse sobre o valor assinado, filtrar «acima de 25»
devolvia só rendimentos — que é o contrário do que quem procura despesas grandes quer.

**URL:** `valor` (em euros, com vírgula ou ponto) e `valorOp` ∈ `gt` | `lt` | `eq`.
Os dois têm de existir; um sem o outro é ignorado. Converter com `parseAmountToCents`
(`packages/shared/src/import/cents.ts:74`) — **não** se escreve um segundo parser de dinheiro.

**Tradução para o Prisma, sem SQL cru** (o `PRISMA` não tem `abs`; usar `OR`/`AND` mantém o
`count` e o `aggregate` corretos, que é o que o rodapé mostra):

| Operador   | Cláusula                                                             | Nota                               |
| ---------- | -------------------------------------------------------------------- | ---------------------------------- |
| `gt` (v>0) | `OR: [{ amountInCents: { gt: v } }, { amountInCents: { lt: -v } }]`  | `v=0` vira `neq: 0`                |
| `lt` (v>0) | `AND: [{ amountInCents: { lt: v } }, { amountInCents: { gt: -v } }]` | `v=0` → nenhum resultado (correto) |
| `eq`       | `OR: [{ amountInCents: v }, { amountInCents: -v }]`                  | exato                              |

Limites **estritos**: `gt` e `lt` não incluem o valor; `eq` é igualdade exata em cêntimos.

**Comportamento esperado**

1. Um controlo na barra: operador (`Maior que` / `Menor que` / `Igual a`) + campo de valor. O
   campo aceita `25`, `25,50`, `25.50` e mostra o valor formatado ao sair.
2. Chip «Valor: acima de 25,00 €» / «abaixo de 25,00 €» / «igual a 25,00 €», removível, que
   limpa **os dois** parâmetros. «Limpar tudo» limpa também.
3. Qualquer alteração volta à **página 1** (é o que o `push` já faz em todos os filtros).
4. Entrada inválida (`valor=abc`, `valorOp=xx`, `valor=` vazio, valor sem operador): filtro
   **ignorado**, página normal, sem 500 e sem texto de erro a gritar por causa de um URL.
5. O rodapé continua a dizer a verdade: contagem e soma do **conjunto filtrado**, com o
   valor incluído no `where` das três consultas (rows, count, aggregate).
6. **Privacidade (D15):** o chip mostra o critério que o utilizador escreveu, não um saldo —
   não se mascara com a máscara ativa.

**Ficheiros:** novo `packages/shared/src/finance/amount-filter.ts` (parser e predicado puros,
sem Prisma) · `packages/shared/src/finance/__tests__/amount-filter.test.ts` ·
`apps/web/src/server/transactions.ts` (a cláusula) · `apps/web/src/app/(app)/transacoes/page.tsx`
(ler os params) · `apps/web/src/components/transaction-filters.tsx` (controlo e chip). Mais nada.

**Porque os testes vão para `packages/shared`:** não existe **nenhum** teste em `apps/web`
(os 30 ficheiros vivem em `packages/shared`). Pôr o parser a testar em `apps/web` obrigaria a
inventar uma configuração de testes nova — dependência de infraestrutura que esta tarefa não
justifica.

**Critério de aceitação**

1. Testes do parser: `25` → 2 500; `25,50` → 2 550; `25.50` → 2 550; `abc` → `null`;
   `valorOp` fora do conjunto → `null`; `-25` → 2 500 (módulo).
2. Testes do predicado: com `gt 2 500`, `−5 000` e `+5 000` passam, `2 500` **não** passa,
   `2 499` não passa; com `lt 2 500`, `2 499` passa e `2 500` não; com `eq 2 500`, `−2 500`
   e `+2 500` passam e `2 501` não.
3. Na base: com `?valorOp=gt&valor=25`, o rodapé conta **N** e a soma **S**; o QA reconta a
   partir da base as linhas com `abs(amountInCents) > 2500` e os dois números têm de bater,
   um a um. É o critério que apanha a cláusula errada — não a lista de linhas visíveis.
4. Chip e «Limpar tudo» devolvem a URL sem `valor`/`valorOp`, e a contagem volta ao total.
5. `?valor=abc`, `?valor=`, `?valorOp=gt` sozinhos: 200, filtro ausente, contagem igual à
   de `/transacoes` sem parâmetros.
6. `format:check`, `lint`, `typecheck`, `test` (**≥ 563**, os novos somam), `build` verdes;
   zero dependências novas; zero migrações.

**O que NÃO fazer:** não usar `$queryRaw` (parte o `aggregate` do rodapé), não escrever um
parser de dinheiro novo, não mexer nos chips existentes nem no rodapé, não filtrar por valor
assinado, não tocar em `e2e/` nem fazer commit.

### T48 — a tabela do Dev não prova o limite (verificado por mim, 14:40)

A implementação está certa — o parser usa `parseAmountToCents`, `?valor=25` são **2 500
cêntimos**, e a cláusula `OR`/`AND` está como pedi. Mas a tabela de integração não exercita o
limite, e a frase que a acompanha está errada: com `valor=25` (25,00 €), as linhas de
**±2 500,00 €** estão **dentro** do `gt`, não fora (250 000 > 2 500). O que ele mostrou foi
«9 de 10», em que o único excluído é `−0,01 €` — o limite nunca esteve em causa.

O caso que falta, e que é o único que prova a rigidez **na base** (as 8 provas unitárias
provam o predicado em JavaScript, não a cláusula SQL):

| Filtro                   | Esperado com ±2 500,00 € na base         |
| ------------------------ | ---------------------------------------- |
| `?valorOp=gt&valor=2500` | 2 500,00 € **fora** (n = 7, não 9)       |
| `?valorOp=lt&valor=2500` | 2 500,00 € **fora**                      |
| `?valorOp=eq&valor=2500` | **exatamente 2** linhas (os dois sinais) |

É o critério 3 refeito com o limite à vista. Pedido ao Dev e ao QA.

**Refeita pelo Dev, e a minha previsão estava errada:** a semente só tem **dois** lançamentos
acima de 2 500,00 €, não sete — os 7/8/2 que eu escrevi não se aplicam a ela. Com `valor=2500`,
base e rodapé batem um a um:

| Filtro | base (`abs`)        | rodapé             | linhas                |
| ------ | ------------------- | ------------------ | --------------------- |
| `gt`   | **2**, soma 0       | **2**, `0,00 €`    | −5 000,00 e +5 000,00 |
| `lt`   | **6**, soma −10 001 | **6**, `−100,01 €` | os outros seis        |
| `eq`   | **2**, soma 0       | **2**, `0,00 €`    | −2 500,00 e +2 500,00 |

O `±2 500,00 €` fica fora do `gt` e do `lt` e é exatamente o `eq` — agora provado na base, e
não só no predicado.

### T48 — prova do QA (semente independente): PASS

O QA não usou a semente do Dev nem a minha previsão — semeou a dele, com o limite em
**25,00 €**, e voltou a bater base contra rodapé:

| Filtro (`valor=25`) | base (`abs`)        | rodapé              |
| ------------------- | ------------------- | ------------------- |
| `gt`                | **30**, +1 105,00 € | **30**, +1 105,00 € |
| `lt`                | **5**, −0,01 €      | **5**, −0,01 €      |
| `eq`                | **2**, 0,00 €       | **2**, 0,00 €       |
| sem filtro          | **37**, +1 104,99 € | 37                  |

30 + 5 + 2 = 37: nenhuma linha ficou de fora nem contada duas vezes. E ele notou a
ambiguidade que a minha nota deixou no ar: **`valor=25` são 25,00 €, `valor=2500` são
2 500,00 €** — os dois ensaios (o do Dev com o limite em 2 500,00 € e o dele com o limite em
25,00 €) provam a mesma coisa com escalas diferentes, e é isso que dá confiança, não o número
igual.

Também provado: 30 resultados em duas páginas com o rodapé a somar o conjunto e não a página;
6 URLs inválidos todos a 200 com o par fora dos links de paginação; chip e «Limpar tudo»;
volta à página 1 (30 → 29 resultados, o `gt` estrito exclui os 30,00 €); a 360 px a barra mede
328 e o controlo 294, sem transbordo; e com a máscara o chip **mostra** o valor (é critério,
não saldo — D15) enquanto os 26 montantes ficam ocultos.

Suite **92/92**. Nota de método do QA: a spec nova deixou de limpar o gasto no `afterAll`
porque contaminava a percentagem do orçamento noutra spec — era a única falha da suite e está
resolvida.

### T48 — DEVE do Revisor (14:54): o valor do URL entra sem teto de 32 bits

`parseAmountFilter` aceita qualquer montante que `parseAmountToCents` considere inteiro
seguro (até ~9×10¹⁵ cêntimos) e **não aplica o teto do domínio**. `?valor=30000000&valorOp=gt`
chega ao `where` como `gt: 3 000 000 000`, e a coluna é `Int` (`schema.prisma:410`) com máximo
**2 147 483 647** (`MAX_AMOUNT_IN_CENTS`, `schemas/domain/primitives.ts:34`). O parâmetro não
encaixa em `int4`: no melhor caso a página devolve zero linhas, no caminho normal o Postgres
recusa (22003) e dá **500**.

É um URL, logo é entrada de qualquer pessoa — e o critério da tarefa diz que um URL mal
escrito tem de dar a página sem o filtro, nunca um erro.

**Correção:** depois de `parseAmountToCents`, `if (Math.abs(cents) > MAX_AMOUNT_IN_CENTS) return null;`
— reutilizando a constante do domínio, não um número novo escrito à mão.

**Menor que vai junto, e que é o mesmo problema de prova falsa desta vaga:**
`matchesAmountFilter` só é usado pelos próprios testes. A regra (módulo + estrito) existe duas
vezes — no predicado JS e na cláusula SQL — e a que corre é a SQL. Os 8 testes provam a
implementação que **não** filtra. Ou o predicado passa a ser o que gera a cláusula, ou sai e os
testes passam a cobrir a cláusula. Decisão: **a cláusula passa a viver no módulo puro**
(`amount-filter.ts`), devolve o objeto que o Prisma consome, e os testes passam a afirmar sobre
esse objeto. `transactions.ts` fica só a espalhá-lo no `where` — uma implementação, testada.

**Menor cosmético:** `AmountFilter.amountInCents` diz «nunca negativo» mas o tipo não o
garante; `Math.abs` na entrada da cláusula (defensivo, uma linha).

### T48 — correção do DEVE (15:05): teto aplicado e a cláusula passou a existir uma só vez

- **Teto:** `parseAmountFilter` recusa `|cents| > MAX_AMOUNT_IN_CENTS`. `?valorOp=gt&valor=30000000`
  → **200**, sem chip, contagem igual a sem parâmetros. Limites testados: `21 474 836,47` aceite,
  `21 474 836,48` recusado.
- **Uma implementação:** `matchesAmountFilter` saiu; `amountWhereClause(filter)` vive em
  `packages/shared/src/finance/amount-filter.ts` e devolve o objeto que a consulta consome;
  `transactions.ts` só o espalha no `where`, **sem `as`** — o tipo é estrutural e o `typecheck`
  passa com o spread direto. Se um dia deixar de passar, parte o gate em vez de ficar escondido
  num cast.
- **`Math.abs` à entrada da cláusula**, com um teste a provar que `−2 500` e `2 500` dão a mesma
  cláusula.
- Os 10 testes afirmam agora sobre **o objeto da cláusula**, que é o que filtra.

Gate: 573 testes, `format`/`lint`/`typecheck`/`build` verdes. A prova oficial na base volta a ser
do QA — a cláusula mudou de sítio, e leitura não é prova.

### T48 — re-prova do QA no código atual (15:20): PASS

A cláusula mudou de sítio, por isso a prova foi refeita contra o código que corre — e não
contra os números da primeira passagem.

| Filtro                | base                   | rodapé           |
| --------------------- | ---------------------- | ---------------- |
| sem filtro            | 37 / +1 104,99 €       | 37 / +1 104,99 € |
| `valor=25&valorOp=gt` | 30 / +110 500 cêntimos | 30 / +1 105,00 € |
| `lt`                  | 5 / −1 cêntimo         | 5 / −0,01 €      |
| `eq`                  | 2 / 0                  | 2 / 0,00 €       |

**O teto, nos quatro lados:** `gt=30000000` → 200, 37, sem chip; `eq=21474836.48` (MAX+1) →
200, 37; `lt=30000000` → 200, 37; `eq=21474836.47` (MAX) → 200, **aceite**, com chip
«igual a 21 474 836,47 €» e zero resultados. **O 500 não existe.** Os 6 URLs inválidos
continuam a 200 com a contagem de sem-parâmetros.

Suite 92/92; a spec nova não precisou de alteração (usa 43,21 €, longe do teto). Gate: 573
testes.

### T48 — fecho (15:25): APROVO do Revisor, com uma ressalva que fica registada

O Revisor confirmou que o tipo estrutural **não é decorativo** mas também não faz o que eu
perguntei: garante a **forma** (o `AmountComparison` não tem `gte` nem índice, logo uma chave
inventada não typechecka no sítio onde a cláusula é construída) mas **não garante o sinal** —
`{lt: 2500}` e `{lt: -2500}` têm o mesmo tipo. Sinal trocado só se apanha com testes, e é por
isso que a mudança de sítio valeu: agora os testes afirmam sobre o objeto que vai para a
consulta.

**Ressalvas honestas que ficam escritas:**

- Um campo **acrescentado** a um tipo mais tarde passa por spread (o TS não faz
  excess-property check em spreads); o erro só apareceria se o tipo fosse incompatível.
- `amountWhereClause` não tem teto próprio — quem a chamar com um `AmountFilter` montado à mão
  passa. Hoje não há chamador além do extrato; a garantia do teto vive no parser, que é o único
  caminho com entrada do exterior.

**O que a tarefa entregou:** filtro por valor com `>`, `<`, `=` sobre o **módulo** (D19), chip
removível, teto de 32 bits, URLs inválidos ignorados sem 500, rodapé a somar o conjunto
filtrado, e uma regra que existe uma só vez — no `shared`, testada, sem SQL cru e sem cast.

## T49 — Sugestão de descrição a partir do histórico

**Porque:** quem lança dez movimentos por semana escreve «Continente», «continente» e
«CONtinente» três vezes. Sugerir o que já existe reduz variantes e torna a pesquisa do extrato
útil.

**O que já existe (verificado no código, não suposto):**

- `apps/web/src/components/ui/combobox.tsx` — um `Combobox` completo sobre `@base-ui/react`,
  **sem um único consumidor**. Esta tarefa dá-lhe o primeiro uso, e é isso que o põe à prova.
- A descrição é um `<Input>` simples em dois sítios: `transaction-quick-add.tsx:655` e
  `transaction-edit-dialog.tsx:215`. Ambos com `useId()` e `aria-invalid` já montados.
- `Transaction.description` é `String?` e há índice `[userId, date]`.

**Âmbito:** só os dois sítios onde se escreve a descrição de um **lançamento**. Ficam de fora
recorrências, regras e o mapeamento da importação — cada um tem o seu campo e a sua validação,
e alargar agora é como as tarefas crescem até não fechar.

**Comportamento esperado**

1. Ao focar/escrever no campo, aparece uma lista com as descrições **já usadas** pelo
   utilizador, filtradas pelo que está escrito (`includes`, sem distinguir maiúsculas de
   minúsculas). **Não** se promete insensibilidade a acentos.
2. **Texto livre continua a ser aceite**: escrever algo que não está na lista e gravar funciona
   como hoje. A lista sugere, não restringe.
3. Escolher uma sugestão preenche o campo; o formulário grava exatamente o texto escolhido.
4. **Origem dos dados: no servidor**, numa função nova `descriptionSuggestions()` em
   `server/transactions.ts`, entregue por props a partir de `transacoes/page.tsx`. Sem rota de
   API nova e **sem `fetch` no cliente**.
5. Janela de **12 meses**: uma descrição usada só há 13 meses não aparece. Limite de **50**
   sugestões, ordenadas por número de usos e, em empate, alfabeticamente (a ordem tem de ser
   determinística, senão a lista muda sem nada mudar).
6. Teclado: setas percorrem, `Enter` escolhe, `Escape` fecha e **mantém** o que estava escrito,
   `Tab` não fica preso. O campo mantém o rótulo e o `aria-invalid` que já tem.
7. Sem histórico: nenhuma lista, nenhum erro, o formulário funciona como hoje.

**Ficheiros:** novo `apps/web/src/components/description-combobox.tsx` · novo
`packages/shared/src/finance/description-suggestions.ts` (filtro e ordenação puros) + teste ·
`apps/web/src/server/transactions.ts` (a consulta) · `app/(app)/transacoes/page.tsx` (props) ·
`components/transaction-quick-add.tsx` · `components/transaction-edit-dialog.tsx` ·
`components/transaction-table.tsx` (só para passar as props ao diálogo). Mais nada.

**Porque o filtro vai para o `shared`:** é a única forma de o testar — continua a não haver
testes em `apps/web`.

**Critério de aceitação**

1. Testes do filtro: `['Continente','continente','Pingo Doce']` com `'cont'` devolve as duas
   variantes; ordem por usos e, em empate, alfabética; lista vazia → vazio; texto vazio →
   devolve as 50 (as mais usadas).
2. **Uma consulta a mais, não mais:** o contador de queries em `/transacoes` passa de **N**
   para **N+1** (medido com log do `pg`, como se fez na T47) e a consulta usa o índice
   `[userId, date]`.
3. **Janela:** um lançamento com descrição só de há 13 meses não aparece na lista; um de há 2
   meses aparece. Provar com dados semeados.
4. **Limite e ordem:** com 60 descrições distintas, vêm 50, e duas execuções seguidas dão a
   **mesma** ordem.
5. Escolher uma sugestão grava esse texto; escrever texto novo grava o texto novo.
6. Teclado e leitor de ecrã: setas/`Enter`/`Escape` como acima, `axe` 0 nas duas caixas.
7. 360 px: a lista não sai do ecrã nem cria scroll horizontal.
8. `format:check`, `lint`, `typecheck`, `test` (**≥ 573**, os novos somam), `build` verdes;
   **zero dependências novas** (`@base-ui/react` e o `combobox` já lá estão); zero migrações.

**O que NÃO fazer:** não auto-preencher conta/categoria a partir da descrição (é outra
funcionalidade, e sem dados fiáveis faz adivinhar); não tornar o campo obrigatório; não
restringir a lista a valores existentes; não criar rota de API; não usar `cmdk` (existe, mas o
`combobox` já resolve); não tocar em `e2e/` nem fazer commit.

### T49 — decisão do Dev que eu aceito: sem `Popup` (2026-11-17)

O `Combobox` do base-ui, com o input **fora** do popup, é **sempre modal**
(`focusManagerModal = !inputInsidePopup || modal`, `ComboboxPopup.js:109`): o popup marca o
resto da página `aria-hidden` e o `axe` acusa **12 `aria-hidden-focus`** (cabeçalho, barra
lateral, os outros campos do formulário). Uma lista de sugestões não é um diálogo, e um
formulário marcado como inerte enquanto se escreve é pior do que não ter lista.

Ficou `Combobox` + `ComboboxInput` + `ComboboxList`/`ComboboxItem` com a lista ancorada ao
campo (`absolute`, sem portal, sem focus manager). O teclado e o ARIA continuam a ser do
base-ui. **Aceito**, e fica o registo: o primitivo é que tem de servir o ecrã, não o contrário.

**Números do Dev:** 50 itens nas duas leituras com a mesma ordem; «Recente T49» (2 meses)
presente e «Antiga T49» (13 meses) ausente; `/transacoes` de **19 → 20** consultas (N+1);
`axe` 0 no estado limpo, com a lista aberta e no diálogo de edição; 360 px com a lista de
32 a 328; `test` 581.

**Achado fora do âmbito, a não perder:** depois de gravar, o `axe` acusa 1 `color-contrast` no
**toast do `sonner`** («Gasto registado.»), não no campo. É anterior a esta tarefa e vai para a
lista de contraste (A4/T50).

### T49 — dois DEVE do Revisor (15:24)

**1. A lista é cortada no Lançamento rápido.** O cartão é um `<Card>` e o `Card` primitivo
tem `overflow-hidden` (`ui/card.tsx:14`); a lista é `absolute` **na mesma subárvore**, com
`max-h-56` (224 px), mas só há ~80 px até à borda do cartão (abaixo ficam o `FieldError`, a
fila de botões e os dois `16 px` de padding). Resultado: a lista aparece cortada a 2–3 linhas
e o resto das sugestões é **inalcançável com o rato**. É exatamente o risco da solução sem
portal, e só não aparece no diálogo de edição porque o `DialogContent` não tem
`overflow-hidden`.

**Correção:** `overflow-visible` no `<Card>` do lançamento rápido. Se partir os cantos
arredondados de algum conteúdo, diz — então a lista vai para um portal e o problema volta a ser
o do `Popup`.

**2. Sugestões em branco.** `description: { not: null }` não exclui a **string vazia**, e a
string vazia é gravável: o diálogo de edição manda `description: trimmed`
(`transaction-edit-dialog.tsx:149`) e o servidor escreve-a tal e qual
(`transactions-actions.ts:538`). Limpar a descrição de um lançamento cria uma sugestão em
branco — uma linha clicável vazia, e um dos 50 lugares gasto.

**Correção, nos dois lados:** (a) descartar descrições em que `trim()` é vazio no
`rankDescriptionSuggestions` (é lá que se pode testar, e cobre também as só-espaços);
(b) o diálogo de edição passa a mandar `null` em vez de `''`, como o lançamento rápido já faz —
senão voltamos a criar o problema na próxima gravação.

**Confirmado pelo Revisor e não é preciso mexer:** o `role="combobox"`, `aria-expanded` e
`aria-controls` funcionam sem `Popup` (vêm do `AriaCombobox`); não há filtragem a dobrar; a
janela usa o índice `[userId, date]`; e a lista é calculada **uma vez** e desce por referência.

### T49 — primeira metade do QA (15:40): o que já está provado

Medido no build **anterior** às correções, onde ainda é válido:

- **`aria-hidden-focus` não voltou:** com a lista aberta, cabeçalho, barra lateral, `main` e
  formulário não estão `aria-hidden` nem `inert`; nenhum `[inert]` na página. Só ficam
  escondidos 3 `<select>` nativos e um input interno do base-ui. A decisão de dispensar o
  `Popup` está validada.
- **Janela de 12 meses:** a descrição de há 13 meses não aparece (a lista nem abre); a de há
  2 meses aparece.
- **Ordem determinística:** 50 itens nas duas leituras, ordem idêntica; topo por usos
  (5 → 3 → 2).
- **Consultas:** 20 statements por `/transacoes`, estáveis em 3 pedidos, e **exatamente um**
  é o `GROUP BY description` — N+1, como pedido.
- **Teclado e rato:** setas percorrem, `Enter` escolhe **sem submeter** (contagem na base
  inalterada), `Escape` fecha e mantém o escrito, o rato escolhe. `Tab` não prende o foco, mas
  a lista fica aberta com o foco fora — fecha ao clicar fora.
- **`axe`:** 0 no estado limpo, 0 com a lista aberta, 0 no diálogo com lista.
- **O `color-contrast` é anterior:** 1 no toast do `sonner` (`div[data-title]`, **4,25:1**) e o
  mesmo 1 no toast «Conta criada.» de `/contas` — não é desta tarefa.
- **Máscara (D15):** «T49 compra 07» continua visível, 0 itens dentro de `[data-amount]`, e os
  26 montantes ocultos.

### T49 — correções provadas pelo Dev (15:55)

**A lista já não é cortada.** Caixas medidas com a lista aberta: cartão de 184 a **714**, campo
de 618 a 650, lista de 654 a **888** — sai **174 px abaixo do fundo do cartão**, com os 234 px
inteiros. O item 50 foi alcançado com a roda (`scrollTop` 1184 de 1408) e clicado; o campo
passou a `T49b compra 49`. O `overflow-visible` não mexeu em nada visível.

**Sugestões em branco:** gravação com descrição vazia → na base a linha ficou `description is
null`; a lista seguinte ficou com **50 itens, sem linha em branco**. A única `''` na base foi
inserida de propósito, por SQL, para provar que o `trim()` a descarta. Extrato: 61 → 62, só o
lançamento novo — com descrição `null` a linha aparece normalmente, como antes.

Gate: **582** testes, tudo verde.

**Nota honesta do Dev, que agradeço:** a base **não** está no baseline — há um terceiro
utilizador, a semente do QA (`qa.t49…`, 71 lançamentos), criada às 15:25. Total: 3 utilizadores,
7 contas, 123 lançamentos. Tem de voltar a 2 / 5 / 52 antes de a vaga fechar.

### T49 — FAIL do QA (16:05): a lista cobre o botão «Lançar»

O `overflow-visible` resolveu o corte e criou outro defeito, no mesmo sítio: a lista
(654 → 888) fica **por cima da fila de botões** (666 → 698). O primeiro clique em «Lançar»
atinge um `role="option"` («T49 mercado semanal») em vez do botão, e o percurso que cria a
descrição e depois tenta gravar fica preso — é o que deixa a suite em **92/93** (spec
`70-exportar` vermelha).

É a segunda vez na mesma tarefa que o problema é o **espaço**: o `Card` cortava a lista, e a
lista tapa os controlos. Fechar o `overflow` foi o remendo errado; a saída é o sítio onde a
lista é desenhada.

**Hipótese a testar primeiro (e a razão pela qual o `Popup` pode voltar):**
`focusManagerModal = !inputInsidePopup || modal`. O Dev dispensou o `Popup` porque pôs o input
**fora** dele. Com o `ComboboxInput` **dentro** do `Popup` (`inputInsidePopup = true`) e
`modal={false}`, a expressão dá `false` — sem focus manager modal, sem `aria-hidden` na página
—, e o popup passa a ser posicionado pela biblioteca (portal, com flip), o que resolve o corte
**e** a sobreposição dos botões de uma vez.

Se essa variante voltar a acusar `aria-hidden-focus`, a alternativa é a lista abrir para
**cima** no lançamento rápido (a fila de botões é o único controlo que não pode ficar debaixo
da lista).

**Critério que fecha a regressão:** com a lista aberta, **um** clique em «Lançar» grava o
lançamento (não escolhe sugestão, não fica à espera de um segundo clique), e a spec
`70-exportar` volta a verde.

### T49 — terceira via: a lista entra no fluxo (16:20)

O Dev não seguiu a minha hipótese, e fez bem: com o `ComboboxInput` **dentro** do `Popup`, o
input passa a ser o filtro do popup e o controlo visível no formulário é o **`Trigger`** (um
botão). A descrição deixava de se escrever — derruba o requisito de texto livre, e não é um
assunto de acessibilidade.

Ficou a lista **no fluxo**: campo 618–650, lista 662–896, botão «Lançar» **912–944** — a lista
empurra os botões em vez de os tapar; o `overflow-visible` no cartão saiu porque já não é
preciso. O cartão cresce de 530 para 776 px quando a lista abre.

Provado pelo Dev: item 50 com o rato (`scrollTop` 1184/1408) → `T49c compra 49`; **um só**
clique em «Lançar» com a lista aberta grava (base 60 → 61, descrição correta, campo limpo);
`axe` sem `aria-hidden-focus`; 360 px com `scrollWidth` 360. Suite **93/93** com a
`70-exportar` verde, e a base de volta a 2 / 5 / 52.

Decisão registada em `DECISOES.md` (D20), com a regra que faltava: uma camada flutuante sobre
um formulário tem de provar **três** coisas — não é cortada, não tapa outro controlo, e o
controlo de baixo continua a receber o clique. A T49 falhou a terceira porque ninguém a mediu
até o QA clicar no botão.

### T49 — FAIL do QA outra vez, e agora por uma razão mais fina (16:40)

**1. O botão foge debaixo do dedo.** A lista já não tapa o botão: aberta ocupa 662–708 e o
botão está em **723,75–755,75**. Mas no **`mousedown`** a lista fecha, o botão **salta para
666,2** e o `mouseup` cai fora dele — **um clique não grava** (base 5 → 5, sem toast). O
segundo clique grava. Escape + um clique grava.

É a quarta variante do mesmo problema, e a mais instrutiva: o alvo do clique **mexeu-se entre
o press e o release**. Uma lista no fluxo não tapa nada, mas **empurra** — e empurrar durante o
clique é tão mau como tapar.

**2. A suite dá verde sem provar o cenário.** `esperarAviso` apanha o toast **anterior**
(309 ms na primeira gravação, **3 ms** na segunda — é o velho), e as expectativas saem do
ficheiro exportado, por isso **uma** linha satisfaz o teste. O `70-exportar` passa e o cenário
de duas gravações seguidas deixou de ser provado. Prova falsa dentro da própria suite — a mesma
classe que já nos custou a T46, agora no instrumento de medida.

**Provado e não se repete:** lista inteira e item 50 com o rato (1280 e 360), salto de
**+246 px** no cartão com o **campo parado** (y 618 nos dois) e foco a ficar no campo; `axe` 0
com a lista aberta (o `color-contrast` do toast é anterior e dá o mesmo em `/contas`); 360 sem
transbordo; suite **93/93** confirmada pelo QA; base de volta a **2 / 5 / 52**.

### T49 — fecho (16:35): PASS do QA

| Prova                                    | Resultado                                                                                       |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Um clique em «Lançar» com a lista aberta | alvo `BUTTON` no `pointerdown` **e** no `mouseup`, lista fecha **depois** do clique, base 5 → 6 |
| Outros campos com a lista aberta         | «Conta» fecha a lista e abre o select; «Data» recebe o foco                                     |
| Duas gravações seguidas                  | `antes=0 · 1.ª=1 (562 ms) · 2.ª=2 (580 ms)` — a segunda esperou um aviso **novo**               |
| O instrumento falha quando deve          | espera sem gravação → **timeout de 20 019 ms**                                                  |
| `Escape` (diálogo · lista)               | aberta `1·1 → 1·0` (texto mantido) · sem sugestões `1·0 → 0·0` · fechada `1·0 → 0·0`            |
| `pointercancel` real                     | lista não fica órfã: tocar fora fecha, reabre e escolhe                                         |
| Gate                                     | format 0 · lint 0 · typecheck 0 · **582** testes · build 0 · suite **93/93**                    |
| Base                                     | **2 utilizadores / 5 contas / 52 lançamentos**, 0 `qa.*`/`e2e-*`                                |

**Custo aceite (D20):** a lista entra no fluxo e o cartão cresce ~246 px ao abrir; o campo não mexe
de sítio e o foco fica onde estava.

**Limitação registada, anterior à tarefa:** a 568 px de altura a barra de scroll do diálogo de
edição é _overlay_ e não se vê; quem não tentar rolar vê o formulário cortado. Sem a lista o
conteúdo já tem 541 px para 483.

**Três correções que só apareceram por se medir, não por se ler:** o `preventDefault` do `Escape`
incondicional (do Revisor), o listener a depender de `aberta` em vez de `listaVisivel` (do QA) e
o `if (!aberta) return` que **não bastava** porque o Radix ouve o `keydown` em captura no
documento, antes do React.

## T50 — Cores de dinheiro com significado (o sistema já existe; falta quem o use)

**Fui ao código antes de escrever isto, e a linha antiga da tabela estava errada outra vez.** Os
tokens semânticos **já existem** em `app/globals.css`, com variantes claras e escuras declaradas
ao lado:

- `--income` · `--expense` · `--goal` · `--success` · `--warning` (e `--destructive` do shadcn),
  todos mapeados em `@theme` (`--color-income` …).
- Nos gráficos: `--chart-income: var(--income)` · `--chart-expense: var(--expense)` ·
  `--chart-savings: var(--goal)` · `--chart-balance: var(--chart-1)` · `--chart-grid` ·
  `--chart-axis`.
- O `<Amount>` já usa `text-income` / `text-expense`.

O que **não** está feito é o resto do produto usá-los. Há **8 sítios** em dois ficheiros a escrever
cores da paleta do Tailwind à mão, que não seguem o tema:

| Ficheiro                                     | O que está                        | Deve ser                                  |
| -------------------------------------------- | --------------------------------- | ----------------------------------------- |
| `app/(app)/contas-pagar-receber/page.tsx:58` | `text-amber-600` (por pagar)      | **`text-warning-foreground`**             | `--warning` como texto dá **3,20:1**; a foreground dá **4,98:1** |
| `…:62`                                       | `text-green-600` (pagas)          | `text-success`                            | aqui o **base** é o token de texto: **7,35:1**                   |
| `…:69`                                       | `text-amber-600` (valor pendente) | **`text-warning-foreground`**             | mesmo par do «por pagar»                                         |
| `components/receivable-payable-list.tsx:196` | `text-red-600` (vencido)          | **`text-expense`**                        | é estado financeiro, não erro de sistema                         |
| `…:205`                                      | `text-green-600` (recebido)       | `text-success`                            | —                                                                |
| `…:144`                                      | `bg-red-50` + `border-red-200`    | **`bg-expense/10` + `border-expense/30`** | `--color-expense` está mapeado no `@theme`                       |

E os gráficos com significado a usar a **paleta** em vez do token de domínio:

- `components/cashflow-chart.tsx:21-22` — `entradas: var(--chart-4)`, `saidas: var(--chart-5)`;
  deviam ser `var(--chart-income)` e `var(--chart-expense)`. Hoje, mudar a paleta de séries muda
  o significado de «Entradas».
- `components/category-donut.tsx` — **fica como está**: uma categoria não tem cor com
  significado, a paleta cíclica é o uso correto.

**Comportamento esperado:** nenhuma cor de dinheiro escrita à mão em `.tsx`. Toda a cor de
significado vem de um token que tem variante escura declarada. Isto é o que faz o modo escuro
estar certo **por construção** e não por alguém ter escolhido dois matizes.

**Opcional, só se for limpo:** o `color-contrast` de **4,25:1** no toast do `sonner` (achado do
QA, anterior a estas tarefas). Se se resolver em `components/ui/sonner.tsx` com as variáveis que
o `sonner` já expõe, entra; se obrigar a estilos frágeis, fica registado e não se faz.

**Ficheiros:** `app/(app)/contas-pagar-receber/page.tsx` · `components/receivable-payable-list.tsx` ·
`components/cashflow-chart.tsx` · (opcional) `components/ui/sonner.tsx`. Mais nada — **não** se
mexe no `globals.css`, porque não falta lá nada.

**Critério de aceitação**

1. `grep -rE "(text|bg|border|ring|fill|stroke)-(emerald|green|red|rose|amber|yellow|blue|sky|violet|purple)-[0-9]{2,3}" apps/web/src --include=*.tsx` → **0**.
2. Cada sítio trocado, com rácio **medido** no claro e no escuro: texto ≥ **4,5:1**, superfícies
   e bordas ≥ **3:1**. Colar o antes/depois.
3. `axe` **0** em `/contas-pagar-receber` nos dois temas (era onde estavam estas cores).
4. Os dois gráficos: as séries de entradas/saídas passam a ler `--chart-income`/`--chart-expense`
   — provar pelo estilo computado e que o valor **muda** entre temas.
5. Sem regressão de forma: alturas e larguras dos dois ecrãs iguais às de antes (as cores mudam,
   o layout não).
6. `--chart-balance` (T47) continua a funcionar e a linha do saldo não muda de cor.
7. `format:check`, `lint`, `typecheck`, `test` (**≥ 582**), `build` verdes; zero dependências,
   zero migrações.

**O que NÃO fazer:** não reescrever a paleta, não acrescentar um segundo sistema de cores, não
recolorir os gráficos por gosto, não usar `--success` para dinheiro (sucesso é um estado,
`--income` é dinheiro que entra — são significados diferentes), não tocar em `e2e/` nem fazer
commit.

**Os pares de tokens não são simétricos, e este é o erro que quase passou:** em `success` o token
de **texto** é o base (`--success`, 7,35:1 no claro) e o `-foreground` é branco, para usar por
cima do fundo; em `warning` é ao contrário — o base é fundo e o **`-foreground`** é o texto
(4,98:1). Copiar «`text-success` + `text-warning`» dava meio certo e meio errado, e o erro só
apareceria num ecrã que ninguém mede.

**Nota de significado:** `--destructive` e `--expense` são **literalmente a mesma cor** no claro
(`oklch(0.55 0.2 25)`) e quase iguais no escuro — por isso a escolha é só de significado, e uma
conta vencida é estado financeiro. `--destructive` fica para as ações destrutivas (apagar,
arquivar).

### T50 — a minha tabela reprovou o meu próprio critério (16:55)

Aplicada à letra, `bg-expense/10` + `border-expense/30` na linha vencida **falhava o critério da
própria tarefa**: o tint escurece a superfície e come o contraste do que está lá dentro.

```
fundo do cartão vencido    #f7e7e5
montante dentro            text-income    4,35:1   ✗
data vencida               text-expense   4,49:1   ✗
borda (30% de --expense)                  1,63:1   ✗
axe em /contas-pagar-receber              2 violações
```

**Troca aceite: `border-expense` sólido, sem tint** — borda **5,24:1** (claro) e **6,99:1**
(escuro), texto sobre a superfície normal do cartão, `axe` **0** nos dois temas. Mesma família de
tokens, nenhum token novo, `globals.css` intocado.

**Padrão que já vai em três:** uma prescrição escrita por quem leu o código (eu incluído) tem de
ser **medida por quem a aplica**. O `text-warning`, o `if (!aberta) return` e agora o
`bg-expense/10` — os três eram sensatos no papel e falharam no ecrã.

**Rácios medidos (claro | escuro), antes → depois:**

| Sítio                  | claro           | escuro           |
| ---------------------- | --------------- | ---------------- |
| «Contas Pendentes»     | 3,20 → **4,97** | 4,84 → **8,75**  |
| «Contas Pagas»         | 3,22 → **7,30** | 4,81 → **8,17**  |
| «Valor Pendente»       | 3,20 → **4,97** | 4,84 → **8,75**  |
| Data vencida           | 4,36 → **5,39** | 4,36 → **5,85**  |
| Cartão vencido (borda) | 1,41 → **5,24** | 12,73 → **6,99** |
| `axe` na página        | **2 → 0**       | **6 → 0**        |

O Dev também corrigiu o **próprio medidor** (compunha sobre branco e mentia no escuro) antes de
tirar os números. Sem isso, a coluna do escuro era ficção.

**`sonner` fica como está:** o par vem de `--popover-foreground` sobre `--popover` (4,25:1);
resolver em `sonner.tsx` obrigaria a fixar uma cor à mão ou a mexer no `globals.css`. Registado
como limitação, não como dívida da T50.

### T50 — DEVE do Revisor: a borda da linha vencida não pinta nada (16:44)

`'border-expense'` só define **`border-color`**. O `Card` primitivo **não tem `border`** (desenha
com `ring-1 ring-foreground/10`, `ui/card.tsx:14`) e o preflight põe `border: 0 solid`. Logo a
linha vencida ficou **igual a todas as outras**: as 5,24:1 que o Dev mediu são a cor do token, não
pixéis — e o `axe` não vê uma borda de largura 0.

**Fix:** `'border border-expense'`.

**Terceira vez na vaga com o mesmo erro de classe:** a T51 (`border-dashed` no cartão arquivado) e
agora a T50. **Regra de projeto:** no Tailwind, `border-<cor>` sem `border` não desenha nada, e a
classe no ficheiro não é prova — a prova é `border-top-width` **computado**. Vale para `border`,
`ring`, `outline` e `divide`.

**O que estava certo e não se mexe:**

- **A WCAG 1.4.1 está coberta por texto:** o badge diz `Vencida` (`:149-153`) e a data está em
  `text-expense`. A cor não é o único portador, e era assim antes da troca.
- A troca do tint pela borda sólida: 1 px a 100% é mais discreto do que o `bg-expense/10`, que
  reprovava o contraste do que está lá dentro.
- Legenda e linhas de projeção seguem os tokens (`--chart-income`, `--chart-expense`,
  `--chart-forecast`, `--chart-axis`), e o swatch da legenda vem do próprio `fill` da série.

**Dívida de tokens registada (não é deste diff, o `globals.css` não foi tocado):** a polaridade de
`warning` está **invertida** em relação a `success`/`expense` — nesses o **base** é a cor de texto e
a foreground serve para por cima do fundo; em `warning` é o contrário, e por isso se usa
`--warning-foreground` como texto sobre o cartão. Resolve-se com um `--warning-text` ou com uma
`--warning-surface`, numa tarefa que possa tocar no `globals.css`.

**Dois pontos de gráficos para a próxima:** o `<CartesianGrid>` do fluxo de caixa não tem `stroke`
e pinta com o cinzento do recharts nos dois temas, apesar de `--chart-grid` existir; e o donut usa
`--chart-1`, que é a mesma cor de `--chart-balance` — inofensivo, mas é o sítio a rever quando a
paleta de séries ganhar significado.

### T50 — a borda pinta, e a minha hipótese da grelha estava errada (17:10)

**Borda:** `border border-expense` → `border-top-width: 0px → 1px`, `solid`, nos dois temas.
Custo: o cartão vencido cresce **2 px** (192 → 194), inevitável com uma borda real, e é o único
movimento de layout. `axe` 0 nos dois temas — agora com a borda a render, não com 0 px.

**A grelha do fluxo de caixa: não se mexe, e a razão é boa.** Eu supus que o `<CartesianGrid>` sem
`stroke` pintava com o cinzento do recharts nos dois temas. **Não pinta**: tem `stroke="#ccc"` no
DOM, mas o `ChartContainer` reescreve-o com
`[&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50` — ou seja, o que se vê é
`--border` a 50%, que já muda com o tema.

Trocar por `--chart-grid` piorava nos dois sentidos: no claro a mesma luminosidade mas **opaca**
(metade do peso a dobrar) e no escuro mais apagada (21% opaca contra 32% a 50% sobre o fundo). O
Dev mediu antes de aplicar e não aplicou — correto.

**Quarta vez na vaga em que uma hipótese minha ou do Revisor foi desmentida pela medição** (o
`text-warning`, o `if (!aberta) return`, o `bg-expense/10` e agora a grelha). Regra que fica: uma
hipótese sobre o que um componente pinta tem de ser confirmada no **estilo computado**, porque as
bibliotecas reescrevem o que o JSX declara.

**Fica registado:** `--chart-grid` e `--chart-axis` existem e a grelha não os usa (o eixo da
projeção usa `--chart-axis`). É dívida de consistência de tokens, não defeito visível.

### T50 — fecho (17:20): PASS do QA

| Medida                           | Antes                  | Depois                       |
| -------------------------------- | ---------------------- | ---------------------------- |
| `axe` em `/contas-pagar-receber` | 2 (claro) · 6 (escuro) | **0 · 0**                    |
| Pendentes / Valor Pendente       | 3,20                   | **4,97** claro · 8,75 escuro |
| Pagas / recebido                 | 3,22                   | **7,30** · 8,17              |
| Data vencida                     | 4,36                   | **5,39** · 5,85              |
| Borda do vencido                 | 0 px (não pintava)     | **1 px**, 5,24 · 6,99        |
| Cores de paleta em `.tsx`        | 8 sítios               | **0**                        |

A linha vencida tem **três** marcas — borda, data a vermelho e o texto «• Vencida» no badge —, por
isso não depende da cor (WCAG 1.4.1). O QA reproduziu os rácios do Dev (a diferença era
arredondamento da conversão `lab`; o canvas do browser dá o mesmo). Fluxo 547×256 e donut na paleta
categórica, como devia. Base **2 / 5 / 52**, suite **93/93**, 582 testes.

**Lacuna de cobertura que o QA levantou e eu aceito corrigir:** a spec `80-acessibilidade` só falha
em violações **critical**, e esta era **serious** (`color-contrast`) — ou seja, a suite **não
protege** a correção da T50: uma regressão de contraste passaria verde. Pedida uma spec dirigida a
`/contas-pagar-receber` com uma vencida criada pela interface.

**O toast do `sonner` continua a 4,25:1** em `/transacoes` e igual em `/contas`: anterior, registado,
não é desta vaga.

---

# Fecho da vaga 1 — "barato e visível"

| ID  | Tarefa                                               | Estado      |
| --- | ---------------------------------------------------- | ----------- |
| T46 | Modo privacidade com máscara e cookie no servidor    | **fechada** |
| T47 | Sparkline de 30 dias por conta                       | **fechada** |
| T48 | Filtro por valor no extrato                          | **fechada** |
| T49 | Sugestão de descrição a partir do histórico          | **fechada** |
| T50 | Cores de dinheiro com significado                    | **fechada** |
| T51 | `/contas`: truncagem e contraste do cartão arquivado | **fechada** |

**Zero tabelas, zero colunas, zero migrações, zero dependências novas** — a promessa da vaga foi
cumprida. Gate final: `format:check` · `lint` 0 · `typecheck` 0 · **582** testes · `build` ✓ ·
suite **93/93**. Base no baseline (2 utilizadores, 5 contas, 52 lançamentos, 0 de teste).

**O que a vaga deixou por fechar, escrito para não se perder:**

1. `/relatorios` a 360 px com 22 px de transbordo (T46).
2. Barra de scroll do diálogo de edição invisível a 568 px de altura (overlay, anterior à T49).
3. Toast do `sonner` a 4,25:1 (anterior a tudo isto).
4. Polaridade de `warning` invertida face a `success`/`expense` — pede `--warning-text` e uma
   passagem pelo `globals.css`.
5. `--chart-grid` sem consumidor (a grelha do fluxo usa `border/50`, que já é temática).
6. A decisão **A4** (contraste de `--border`/`--input`, 1,31:1 contra o mínimo 3:1) continua do
   utilizador.

**Método que esta vaga provou, e vale mais do que as seis tarefas:** uma correção prescrita por
quem leu o código tem de ser medida por quem a aplica — o `text-warning`, o `if (!aberta) return`,
o `bg-expense/10`, a grelha do recharts e o `border-dashed` caíram todos contra medições, e nenhum
desses erros seria apanhado pela suite.

---

# Vaga 2 — "chegar depressa ao que importa" (sem tabelas, sem migrações)

Objetivo: menos cliques até ao que se usa todos os dias, e nenhuma alteração ao modelo de
dados — o que a vaga 2 entrega calcula-se na hora.

| ID  | Tarefa                                                                 | Dono | Estado                      |
| --- | ---------------------------------------------------------------------- | ---- | --------------------------- |
| T52 | **Navegação 15 → 8 destinos** (D7), com os restantes a mudar de porta  | Dev  | **fechada** (PASS QA na 3ª volta; 8 ligações, 15 na paleta, 0 órfãos) |
| T53 | **Ações em massa no extrato:** selecionar N lançamentos e agir uma vez | Dev  | **fechada** (PASS QA na 3ª volta; suíte 101/101; alvo medido com cliques) |
| T54 | **Ecrã de Revisão:** uma página com o que está por arrumar             | Dev  | **fechada** (PASS QA na volta 2; mutação vermelha por asserção; suíte 113) |
| T59 | **Editar uma transferência falha sempre ao gravar:** o diálogo envia `accountId` e o servidor recusa-o | Dev  | **fechada** (PASS QA; mutação vermelha em 1,5 s; suíte 108) |
| T57 | **Dois defeitos herdados do extrato:** `kind` em maiúsculas e o contraste do separador de `/importar` | Dev  | **fechada** (PASS QA; 2 mutações vermelhas; `axe` 0 sem exceção) |
| T55 | **Calendário de contas:** o mês de vencimentos e movimentos previstos  | Dev  | **fechada** (PASS QA na 3ª volta; 2 DEVE apanhados; suíte 120) |
| T56 | **Segurança: Next 16.4.0 → 16.4.6** (D21), depois da T53            | Dev  | **fechada** (PASS QA; 5 avisos → 0; `next build` directo exit 0) |
| T58 | **A árvore de dependências:** a CLI `shadcn` sai do runtime e o `zod` sobe a 4.6.6 | Dev  | **fechada** (PASS QA; avisos 29 → 8; CSS compilado verificado) |

---

# Vaga 3 — "fechar as contas" (sem tabelas, sem migrações)

Objetivo: deixar de ter duas verdades sobre o mesmo dinheiro e um mapa que mente. Nada de produto
novo — a vaga fecha o que as duas anteriores deixaram a apontar para o lado.

| ID  | Tarefa                                                                 | Dono | Estado                      |
| --- | ---------------------------------------------------------------------- | ---- | --------------------------- |
| T61 | **A regra «última fatura da cadeia» está escrita duas vezes, com chaves diferentes:** alinhar num sítio só | Dev  | **fechada** (PASS QA; 1 definição e 2 importadores; empate por fixture SQL) |
| T62 | **O `MAPA.md` mente sobre o próprio estado:** remedir e corrigir, com o `README.md` e o `ESTADO-E-HANDOFF.md` | Dev  | **fechada** (PASS QA; 10 de 10 afirmações conferem; produção serve o HEAD) |
| T63 | **Três menores de acessibilidade e higiene** que ficaram escritos nas tarefas fechadas | Dev  | **fechada** (PASS QA; 1 DEVE apanhado; spec do fuso com `America/Sao_Paulo`) |
| T64 | **`semCategoria` fora do schema de filtros:** o filtro morre em silêncio se o schema ficar estrito | Dev  | **fechada** (PASS QA; 3 chaves declaradas; `strict` do objecto completo verde) |
| T60 | **A contagem «Faturas por pagar» soma a cadeia inteira** | Dev  | **fechada** (PASS QA; 2 no ecrã para 3 na base; mutação em 923 ms) |

---

# Vaga 4 — "confiar na prova" (sem tabelas, sem migrações)

Objetivo: três coisas que não partem nada hoje e que, no dia em que partirem, ninguém vai acreditar no aviso.

| ID  | Tarefa                                                                 | Dono | Estado                      |
| --- | ---------------------------------------------------------------------- | ---- | --------------------------- |
| T65 | **O `flake` do «apaga o grupo»:** um vermelho intermitente ensina a repetir até passar | Dev  | **fechada** (não reproduzível em >170 execuções; âmbito mudado para preservar artefactos, provado) |
| T66 | **Um valor inválido no URL derruba todos os filtros:** o schema passa a degradar em vez de rebentar | Dev  | **fechada** (PASS QA; campo a campo com `catch`; chamador cru provado) |
| T67 | **O executor de SQL genérico nos testes:** apertar antes que alguém o use para inventar dados | Dev  | **fechada** (PASS QA; SQL livre a 0; órfãos 0 durante a corrida) |
| T68 | **O teste do invólucro não corre no CI:** a proteção existe e não morde | Dev  | **fechada** (PASS QA; passo 9 do job ; morde, provado) |

---

# Vaga 5 — «o que ficou de fora e foi pedido» (sem tabelas, sem migrações)

Objetivo: três coisas que o relatório `relatorios/NAO-IMPLEMENTADO.md` deixou escritas e o utilizador
pediu a 19/11, por esta ordem: **(1)** rodar a palavra-passe da Neon, **(2)** T70, **(3)** T71.

| ID  | Tarefa                                                                 | Dono | Estado                      |
| --- | ---------------------------------------------------------------------- | ---- | --------------------------- |
| T70 | **Recorrências vencidas geram-se sozinhas:** a rota de cron que a A3 pedia | Dev | **aberta** (handoff 19/11) |
| T71 | **`logicalCount` escrito duas vezes:** o par de uma transferência conta uma vez, num sítio só | Dev | **na fila** — escrita, handoff só depois de a T70 fechar |
| A7  | **Rodar a palavra-passe da Neon** — não é código, é produção: meu e do utilizador, fora de fila | Lead + utilizador | **bloqueada** (à espera do consentimento Vercel) |

A **A7** vai primeiro na prática, mas não pode: a palavra-passe é **uma só para os três ramos** do
projeto `old-fire-26176066`, por isso rodá-la parte também o diário do chofer. Sem saber onde mais
ela vive, rodar é deitar produção abaixo à sorte. Ver a secção A7 em `DECISOES.md`.

## T52 — Navegação 15 → 8 destinos (D7)

**Porque:** a barra lateral tem 15 destinos e o uso diário é de quatro. A decisão D7 fixou a
versão **moderada**: oito destinos, e os outros sete mudam de porta sem perder o ecrã.

**Comportamento esperado**

1. A barra lateral fica com **oito** ligações, em três grupos:
   - **Dia a dia:** Painel · Transações · Contas · Contas a pagar/receber
   - **Planeamento:** Orçamento · Objetivos · Património
   - **Análise:** Relatórios
2. **As rotas não mudam.** Nada de `redirect`, nada de URLs novos: muda o menu, não o
   endereço. Um favorito antigo tem de continuar a abrir o mesmo ecrã.
3. Os sete que saem da barra ganham porta, e continuam a **um clique** do sítio onde passam a
   viver:
   - `Cartões` e `Consolidação` → separadores/sub-navegação dentro de `/contas`.
   - `Recorrências`, `Regras`, `Categorias`, `Importar` → menu do cabeçalho de `/transacoes`.
   - `Definições` → rodapé do utilizador.
4. **A paleta de comandos continua a conhecer os 15.** `ALL_NAV_ITEMS` não pode encolher: se
   o `Ctrl+K` perder destinos, a simplificação passou a ser esconderijo.
5. A navegação inferior do telemóvel fica com os cinco de hoje.
6. Nenhum ecrã fica órfão: cada uma das 15 rotas tem de ter **pelo menos uma ligação** dentro
   da aplicação. É o critério que apanha o esquecimento clássico — tirar da barra e não pôr em
   lado nenhum.

**Ficheiros:** `apps/web/src/lib/nav.ts` · `components/app-sidebar.tsx` ·
`components/mobile-nav.tsx` · `components/command-palette.tsx` · `components/app-shell.tsx` ·
`app/(app)/contas/page.tsx` (separadores de Cartões/Consolidação) ·
`app/(app)/transacoes/page.tsx` (menu do cabeçalho) · `e2e/support/ui.ts` e os specs que
navegam por ligações (é do QA, mas a T52 pode pedir-lhe a alteração).

**Critério de aceitação**

1. Barra lateral com **exatamente 8** ligações nos três grupos acima, a 1280 e a 360 px
   (a 360 usa-se a navegação inferior).
2. As **15 rotas** continuam a responder 200 e cada uma tem ≥1 ligação na aplicação: provar
   com uma varredura de links a partir de `/`, `/contas` e `/transacoes`, listando rota →
   onde está a ligação.
3. `Ctrl+K` devolve os **15** destinos (contar os itens da lista, não a olho).
4. Os sete ecrãs movidos estão a **≤ 2 cliques** de `/`: Cartões e Consolidação por Contas;
   Recorrências, Regras, Categorias e Importar por Transações; Definições pela conta.
5. Teclado e leitor de ecrã: a barra mantém `aria-current` na página atual, a ordem de `Tab`
   segue a ordem visual, `axe` **0** em `/` e `/contas`; alvos de toque ≥ 44 px a 360.
6. Sem regressão de comportamento: `format:check`, `lint`, `typecheck`, `test` (**≥582**),
   `build` verdes e **suite 94/94** depois de atualizados os percursos de navegação.
7. Zero dependências novas, zero migrações.

**O que NÃO fazer:** não mudar rotas nem criar redirecionamentos; não apagar ecrãs; não
encurtar `ALL_NAV_ITEMS`; não juntar dois ecrãs numa página só para reduzir o número; não
tocar em `e2e/` sem combinar com o QA; não fazer commit nem push (é o Lead que empurra).

---

# Vagas 3 a 5 — o que exige schema

Cada vaga escreve as suas tarefas em detalhe quando abre. O que **já está fixado** (D8, D11):

| Vaga | Schema                                                           | Migração                             | O que fica dependente dela                                                 |
| ---- | ---------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------- |
| 3    | `NetWorthSnapshot` · `Insight` · `BudgetLimit.rolloverEnabled`   | **a primeira desde a linha de base** | património com memória mensal, «insight lido», orçamento que transita      |
| 4    | `Merchant` · `Transaction.merchantId`                            | **T60** (D8: a única da vaga)        | comerciante como entidade; a importação **sugere** e o utilizador confirma |
| 5    | `ImportMapping` · `Attachment` · `Transaction.importFingerprint` | a última                             | mapeamento de colunas guardado, recibos anexados, importação idempotente   |

**Duas coisas que não se fazem sem o utilizador:** a migração de desenvolvimento na vaga 3
(base Neon, aditiva mas real) e a migração de **produção**, no fim das vagas 4 e 5, sempre
por mão dele (D11). As passkeys (T64) trazem a tabela do `better-auth` — não é desenho nosso.

### T52 — DEVE do Revisor (17:22): os separadores só existem numa das três páginas

A barra de secções é renderizada **só** em `/contas`, e `Cartões`/`Consolidação` saíram da barra
lateral. Logo, quem entra em `/cartoes` ou `/consolidacao-contas` **perde a barra**: não há
separador para voltar a Contas nem para saltar para o irmão, e a barra lateral não destaca nada —
a única saída é a paleta ou o botão «voltar».

O mesmo padrão nos quatro do «Mais»: de `/regras` não há menu para `/categorias`.

**É o mesmo defeito da tarefa, do outro lado:** o critério «nenhum ecrã órfão» foi cumprido a
medir **ligações de entrada**; faltava medir **ligações de saída**. Uma rota pode ser alcançável
e ainda assim ser um beco sem saída.

**Correção:** a barra de secções passa a componente com `pathname` e é renderizada nas **três**
páginas; o menu «Mais» nas **quatro**; e o item `Contas` da barra lateral passa a estar ativo
também em `/cartoes` e `/consolidacao-contas`.

**Menor do mesmo parecer:** envolver a lista do `<details>` em
`<nav aria-label="Ferramentas do extrato">` — hoje não é uma região de navegação para o leitor de
ecrã.

**Duplicação das listas: melhor do que a guarda que eu ia pedir.** O Revisor notou que não há
teste de navegação em `apps/web` (o vitest só existe em `packages/shared`, e um runner novo seria
dependência contra a regra da vaga). A solução certa é **eliminar** a duplicação: um mapa
`const NAV = { painel: PAINEL, … }` com as quatro listas a referenciar chaves e
`ALL_NAV_ITEMS = Object.values(NAV)`. Um ecrã novo entra uma vez e a paleta deriva-o.

### T52 — DEVE do Revisor (17:35): o menu «Mais» fica aberto depois de navegar

Ao passar as portas para o `AppShell`, o `<details>` deixou de viver dentro da página e passou a
viver no layout — **que não remonta entre rotas irmãs**. O `open` é estado do DOM, não do React:
abrir «Mais» e clicar em «Regras» deixa o menu aberto **por cima da página nova**, e como
`TRANSACTION_MENU_ROUTES` inclui `/regras`, ele continua lá.

Antes não acontecia por acidente feliz: o `<details>` morria com a página. Mover código para o
sítio certo cria defeitos que só existem nesse sítio.

**Correção:** `key={pathname}` no `<details>` (remonta fechado a cada rota).

**Menor do mesmo parecer, que também é uma correção de coerência:** em `/cartoes` e
`/consolidacao-contas` a barra lateral não destaca «Contas» — `isActiveRoute` compara o caminho
exato. E o `includes` exato usado nas listas de secções desaparece no dia em que um destes ecrãs
ganhe uma sub-rota (`/cartoes/123`).

**Correção única para os dois:** subir o `isActiveRoute` de `app-sidebar.tsx:23-25` para
`lib/nav.ts` (raiz exata + prefixo com barra — e **não** `startsWith('/contas')`, que apanharia
`/contas-pagar-receber`) e usá-lo nas duas listas e no destaque da barra lateral.

E um comentário no `NAV` a dizer que a ordem do objeto **é** a ordem de apresentação da paleta:
`Object.values` mantém a inserção, por isso mover uma chave reordena o `Ctrl+K` em silêncio.

### T52 — FAIL do QA (17:50): o cabeçalho a 360 px transborda 19 px

Cinco rotas com o menu (`/transacoes`, `/recorrencias`, `/regras`, `/categorias`, `/importar`)
mediam `scrollWidth` **379** a 360 px; as rotas sem menu mediam 360. O culpado não era o menu: o
grupo direito do cabeçalho tinha passado a **246 px** com o botão «Mais» (76 px, com rótulo) e o
último controlo acabava em x = 379. Ficou 379 com o `<details>` fechado **e** aberto.

**Correção:** o rótulo «Mais» passa a `sr-only` abaixo de `sm` (`<span className="sr-only
sm:not-sr-only">Mais</span>`): fica o ícone, o nome acessível não se perde, e o rótulo volta a
partir de 640. Botão 76 → 38 px, grupo 246 → 208, e as cinco rotas fecham a **360**.

Proibido, e cumprido: `overflow-x: hidden` para esconder o sintoma, alvos abaixo de 44 px, e
esconder o menu (deixaria `/regras` sem porta para `/categorias`).

### T52 — FAIL do QA (18:0x): alvo de 36 px e painel cortado pela esquerda

Duas coisas na medição seguinte:

1. O trigger «Mais» media **38×36** a 360 — abaixo do critério 5 desta tarefa («alvos de toque ≥
   44 px a 360»). Subir a altura não mexe na largura, logo não desfazia o fecho do overflow.
2. O painel do menu, aberto a 360, ancorava em `right-0` do `<details>` e começava em **x = −34**
   (itens em x = −29): borda e ícones cortados. O `scrollWidth` continuava 360 **porque
   transbordava para a esquerda** — o defeito escapou ao critério do overflow por estar do lado
   que ninguém mediu.

**Correção:** `min-h-11 sm:min-h-9` no `<summary>` (44 a 360, 36 a partir de 640) e
`max-sm:right-auto max-sm:left-0` no painel (abaixo de `sm` ancora à esquerda do trigger). A 360:
trigger 38×44, painel 136→344, `minX` 136, margem 16. A 1279: painel 824,8→1032,8 (o grupo largo
não corta). A 1280: 826→1034, **exactamente onde estava** antes desta volta.

### T52 — decisão do Lead: `target-size` com um overlay aberto não é critério deste projeto

Última medição: 14 das 15 células de `axe` limpas; a que sobra é **nova** — a 393 px em
`/recorrencias`, com o menu aberto, o painel tapa parcialmente um botão de filtro de 127×28
(sobra 127,4×13,5), e o `axe` marca `target-size`. O QA provou a causa: repondo a geometria
anterior por CSS injectado, a mesma página dá 0 — mas com o painel em x = −1→207, isto é, **o
zero anterior vinha do painel estar fora do ecrã**, não de ser inofensivo.

A norma (WCAG 2.2, SC 2.5.8) tem cinco exceções — Spacing, Equivalent, Inline, User agent
control, Essential — e **nenhuma para alvo tapado**: não há argumento normativo para declarar a
célula conforme. O que há é isto: qualquer menu, popover ou paleta sobre conteúdo tapa alvos
abaixo dele, e nenhuma posição do painel evita os botões da página que fica por baixo. As duas
saídas que restam são piores — encolher os links do menu abaixo de 44 px (quebra o critério 5) ou
voltar a pôr o painel fora do ecrã (era o defeito).

**Decisão:** o `axe 0` mede-se no **estado por omissão** da página, que é a convenção das
varreduras de acessibilidade; com um overlay invocado pelo utilizador aberto, `target-size` não é
bloqueio. Registado aqui e no relatório do QA. Não é decisão irreversível nem muda contrato
nenhum — fica como linha, não como D-número.

**Fora do âmbito, resolvido depois:** `/importar` tinha `color-contrast` **4,42:1** no gatilho de
um *tab* Radix. Foi corrigido na **T57** (5,45:1 no claro, 4,94:1 no escuro) e o `axe` dá **0** na
rota — a exceção que aqui estava registada **saiu**.

### T52 — prova de fecho (QA, build final de 17/11 18:09)

Medido no código que vai a commit, não num build anterior:

| O que                                                    | Números                                                          |
| -------------------------------------------------------- | ---------------------------------------------------------------- |
| Barra lateral                                             | **8** ligações nos três grupos, a 1280 e a 360 (0 ligações a 360) |
| Rotas com porta                                           | **15/15**; `foraDoContrato: []`, `semPorta: []`                   |
| `Ctrl+K`                                                  | **15** itens, cada rótulo uma vez                                 |
| Barra de secções                                          | nas **3** páginas, `aria-current` no separador certo              |
| «Contas» aceso                                            | `/contas`, `/cartoes`, `/consolidacao-contas`; **null** em `/contas-pagar-receber` |
| Menu «Mais»                                               | abre por clique/Enter/Espaço, `Tab` entra nos links, fecha ao navegar (`marcado: null` prova a remontagem) |
| A 360                                                     | trigger 38×44, painel 136→344, margem 16, `scrollWidth` 360 nas 20 células |
| A 1280                                                    | painel 826→1034, igual ao `HEAD` deste ecrã                       |
| `axe`                                                     | 0 em `/`, `/transacoes`, `/cartoes`, `/consolidacao-contas`, 360/393/1280 |
| Gate                                                      | `format:check` · `lint` 0 · `typecheck` 0 · `test` **582** · `build` ✓ · suite **96/96** |
| Base                                                      | 2 utilizadores · 5 contas · 52 movimentos · 0 `qa.*` · 0 `e2e-*`   |

Prova e medições em `relatorios/T52.md` e `relatorios/.qa-t52{d,c,b}/`. Revisor sem DEVE no delta
final (`6fe5444`).

**O que a T52 não resolve, e fica escrito:**

- O `<details>` nativo não fecha com `Escape` nem com clique fora — só no próprio gatilho ou ao
  navegar. É comportamento de *disclosure*, não defeito de implementação; acrescentar handlers
  reabriria a classe de defeitos da T49. Fora do âmbito.
- Na fronteira 639→640 o painel salta ~135 px para a esquerda ao trocar de âncora e ao reaparecer
  o rótulo. Só se vê a arrastar a janela; não há corte nem overflow.
- `/importar`: `color-contrast` **4,42:1** no gatilho de um *tab* Radix — anterior a esta tarefa,
  mesmo nó a 360 e a 1280. Candidato a tarefa nova, não aberto.
- O `target-size` com o menu aberto ficou decidido acima e não reabre.

## T53 — Ações em massa no extrato

**Porque:** o extrato filtra bem e depois não deixa fazer nada com o resultado. Categorizar os
lançamentos de uma importação, ou confirmar uma dúzia de uma vez, é hoje uma dúzia de idas ao
diálogo de edição — e é o passo que sobra entre a T47 (que importa) e o dia-a-dia.

**Comportamento esperado**

1. Cada linha ganha uma caixa de seleção. A do cabeçalho seleciona **os da página atual** — não
   «todos os resultados do filtro» — e o nome acessível tem de dizer exatamente isso.
2. Com pelo menos uma selecionada aparece uma barra de ações acima da tabela: a contagem, as
   ações, e «Limpar».
3. Ações: **marcar efetivada**, **marcar por liquidar**, **mudar categoria**, **apagar**.
   - **Categoria:** só se aplica às compatíveis com o tipo. Seleção que mistura despesa e receita
     desativa a ação, e a razão fica visível — não se aplica uma categoria de receita a despesas.
   - **Apagar:** passa pelo diálogo de confirmação, com o **número** e o **total em euros** da
     seleção, no formato de dinheiro do resto da app. Nunca apaga sem confirmar.
4. **Transferências:** apagar uma perna apaga o par, como na ação individual; na confirmação o par
   conta como **um** lançamento, não como dois.
5. Mudar de página, filtro, ordenação ou tamanho de página **limpa a seleção**: nunca se age sobre
   linhas que já não estão à vista.
6. Idempotente: aplicar «efetivada» a quem já está efetivada não muda nada e não dá erro.
7. Servidor: as ações validam o `userId` de **todas** as linhas e correm numa só transacção; teto
   de **200** ids por pedido, acima disso recusa com mensagem. Um id que não é do utilizador não
   pode arrastar os outros para o sucesso.
8. Teclado e leitor de ecrã: `Escape` limpa a seleção; a contagem é anunciada quando muda; cada
   caixa de linha tem nome acessível com a descrição e o valor do lançamento.

**Ficheiros:** `components/transaction-table.tsx` · `components/transaction-bulk-actions.tsx` (novo)
· `server/transactions-actions.ts` · `app/(app)/transacoes/page.tsx` (só se precisar de passar
algo) · `e2e/` (é do QA).

**Critério de aceitação**

1. Selecionar 3 e marcar efetivada: as 3 mudam **sem refresh manual**, e o total de pendentes
   bate com a nova realidade.
2. Categoria: duas despesas recebem a categoria; seleção mista desativa a ação com a razão à
   vista.
3. Apagar 2: a confirmação diz «2 lançamentos» e o total; cancelar não apaga nada, confirmar apaga
   os 2.
4. Transferência: selecionar **uma** perna e apagar faz desaparecer **as duas**.
5. Mudar de página ou de filtro faz **desaparecer a barra** e a seleção voltar a zero.
6. Servidor: um pedido com 201 ids é recusado; um id de outro utilizador **não** apaga os válidos
   (prova no servidor, não na interface).
7. `axe` **0** com 3 selecionados, a 1280 e a 360; a barra não transborda a 360 e os alvos de toque
   cumprem 44 px.
8. Gate: `format:check`, `lint`, `typecheck`, `test` (**≥582**), `build`; suite com a spec nova, e
   essa spec tem de falhar quando deve (tirar a limpeza ao mudar de página tem de a fazer vermelho).
9. Zero dependências novas, zero migrações.

**O que NÃO fazer:** nada de «selecionar todos os resultados do filtro» (é outra conversa, e é a
maneira mais fácil de apagar um ano de extrato); não mexer nas ações individuais que já existem;
não apagar em cascata contas ou categorias; não tocar em `e2e/` sem combinar com o QA; não fazer
commit nem push.

## T57 — Dois defeitos herdados do extrato

Aberto a pedido do utilizador (17/11), a seguir à T53 e **antes** da T56. Os dois vieram à luz
durante a T52/T53 e nenhum deles é daquelas tarefas: são anteriores e ficam aqui, como a T51 fez
com os dois de `/contas`. **Um commit por defeito**; um só ciclo de QA para os dois.

### 1. O `kind` não é normalizado — e esconde o campo Categoria

`server/transactions.ts:138` normaliza o `status` (`row.status.toLowerCase()`, com um comentário a
explicar porquê) e **não** faz o mesmo ao `kind`, que sai do Prisma em maiúsculas. Duas
consequências visíveis hoje:

- `TRANSACTION_KIND_LABELS` tem as chaves em minúsculas (`expense: 'Gasto'`), por isso o selo cai
  no `?? kind` e o ecrã mostra **«EXPENSE»**, «INCOME», «TRANSFER» em vez de «Gasto», «Ganho»,
  «Transferência».
- `transaction-edit-dialog.tsx:133` decide `showCategory` por `kind === 'expense' || kind ===
  'income'`. Com maiúsculas é **sempre falso**: o diálogo de edição **esconde o campo Categoria em
  todos os lançamentos**. É o defeito que importa — o mais grave dos dois.

**Correção mínima:** normalizar na origem, no mesmo sítio e com o mesmo critério do `status`, e
**uma** spec que guarde as duas coisas: o selo mostra o rótulo humano e o diálogo de edição tem o
campo Categoria numa despesa e num ganho.

**Armadilha a evitar:** comparar em minúsculas em cada componente. A T53 já o faz no código novo e
continua certo quando a origem for corrigida — mas a origem é o sítio, e é lá que se corrige.

### 2. O gatilho do separador de `/importar` não chega ao contraste mínimo

`color-contrast` **4,42:1** (`#6c7276` sobre `#eff5f5`), medido pelo `axe` no gatilho de um *tab*
Radix em `/importar`. Falta 0,08 para o mínimo AA de 4,5:1. Anterior à T52, mesmo nó e mesmos
valores a 360 e a 1280, num ficheiro intocado por aquelas tarefas.

**Correção mínima:** subir o contraste do gatilho inativo ao mínimo, no token ou na classe — não
inventar uma cor nova se um token existente servir. Depois desta tarefa a **exceção registada no
fecho da T52 deixa de ser precisa**: `axe` tem de dar **0** em `/importar`, sem exceções escritas.

**Não fazer:** não mexer na paleta global para resolver um gatilho; se o token não chegar, corrige
só o que este controlo usa e diz porquê.

### Critério de aceitação

1. `/transacoes` mostra «Gasto», «Ganho», «Transferência» — nunca o valor cru do enum — **e com o
   ícone da natureza**: o `TransactionKindIcon` também compara em minúsculas, por isso hoje o selo
   sai em inglês e sem ícone. Prova a 1280 e a 360.
2. O diálogo de edição mostra o campo **Categoria** numa despesa e num ganho, e continua a
   escondê-lo onde não se aplica (transferência) — os dois lados, não só o que faltava.
3. `/importar`: `color-contrast` no gatilho ≥ **4,5:1** nos dois temas, e `axe` **0** na rota sem
   nenhuma exceção no relatório.
4. Spec que protege as duas coisas e que **falha quando deve** (repor o `kind` cru tem de a fazer
   vermelha; repor a cor antiga também).
5. Gate: `format:check`, `lint`, `typecheck`, `test` (**≥582**), `build`; suíte verde.
6. Zero dependências novas, zero migrações, zero alterações de rotas.

**Ficheiros:** `apps/web/src/server/transactions.ts` · `apps/web/src/components/transaction-edit-dialog.tsx`
(só se o `showCategory` precisar de ficar robusto à origem) · o que define a cor do gatilho do
separador em `/importar` · `e2e/` (é do QA).

**O que NÃO fazer:** não commitar nem empurrar; não tocar em `nav.ts`, no shell nem na barra
lateral; não alargar a normalização a outros campos "por simetria" sem provar que estão errados; não
abrir exceções novas no `axe`.

### T53 — prova de fecho (QA, build final de 17/11 20:0x)

| O que                                        | Números                                                                    |
| -------------------------------------------- | -------------------------------------------------------------------------- |
| Apagar um par de transferência               | par criado pela interface (77,00 €), **uma** perna selecionada → 2 → **0**, diálogo «1 lançamento» |
| Mudar de página / filtro / limite            | 30 linhas, paginação 25 → barra **ausente** nos três                       |
| 201 ids                                      | recusado antes de tocar na base                                            |
| Id de outro utilizador                       | recusado, linha válida intacta; id já apagado: recusado, nada aplicado     |
| Efetivar duas vezes                          | `false→true` e `true`, data igual, **0** erros                             |
| Categoria mista                              | ação desativada com a razão visível; servidor recusa nos quatro caminhos   |
| Alvo de toque a 360                          | **44×44**; quatro cantos e centro marcam e desmarcam                        |
| Alvo de toque a 1280                         | **32×44**, x 288→320; x=323 e a coluna de datas dão 0→0                     |
| `aria-live`                                  | nó montado antes da seleção, «1 selecionado» → «3 selecionados»            |
| `axe`                                        | **0** com 3 selecionados a 360 e a 1280                                     |
| Gate                                         | `format:check` · `lint` 0 · `typecheck` 0 · `test` **582** · `build` ✓ · suíte **101/101** |

Prova em `relatorios/T53.md` (três voltas, cada uma com o número que a motivou) e
`relatorios/T53-dev.md`. Revisor sem DEVE no delta final.

**As três voltas falharam todas no alvo de toque, por três razões diferentes**, e nenhuma foi
apanhada por leitura de código:

1. As classes de toque caíram no `Checkbox` e a **caixa desenhada** cresceu para 44 (28 no
   desktop): alvo certo, desenho errado, coluna alargada.
2. A moldura de 44 em volta era um `div`: media 44 e **não recebia o clique**. Alvo decorativo. O
   `axe` não marca porque a regra isenta alvos com espaço à volta — **passa no axe e falha no dedo**.
3. O alvo de 44 numa coluna de **40** invadia 6 px da coluna de datas: clicar perto da data marcava
   a linha.

**Regra que fica:** um alvo de toque mede-se **com cliques**, em sítios onde não deve haver clique e
nos bordos. Um rect de CSS e um `axe` verde não provam que o dedo acerta.

**Menores registados (nenhum bloqueia):**

- `logicalCount` e a família de categoria estão escritos duas vezes (cliente e servidor). **É
  partilhável** em `packages/shared` — que já está importado nesse ficheiro — com uma assinatura
  `readonly { transferGroupId: string | null }[] → number`. Não se corrigiu por âmbito, não por
  impossibilidade: a justificação inicial («precisava de um módulo novo») era falsa.
- `transactions-actions.ts` · o `affected` do toast vem de `logicalCount(rows)`, não do `count` da
  escrita; com duas abas o toast pode dizer «3 apagados» e a base ter apagado 2.
- `transaction-table.tsx` · `sm:after:-inset-x-2` está acoplado a `w-10` + `sm:min-w-8`; se a
  coluna mudar de largura, o alvo invade a coluna de datas ou encolhe abaixo do mínimo, em silêncio.

## T56 — Segurança: Next 16.4.0 → 16.4.6 (D21)

**Porque:** a versão fixada tem duas falhas **críticas** de execução remota de código e uma alta
de negação de serviço, e neste projeto são alcançáveis: o `/_next/image` é servido por omissão e
responde **sem autenticação** mesmo sem `next/image` em uso, e as Server Actions são usadas em
todas as mutações. A D21 já registou os avisos e decidiu a subida depois da T53.

**Comportamento esperado**

1. `next` e `eslint-config-next` passam a **`16.4.6`**, com pin exato (sem `^` — o pin é
   deliberado e não muda aqui).
2. `pnpm-lock.yaml` re-resolvido. É **esperado** que o diff inclua as entradas com peer do Next
   (`better-auth@1.7.7(next@16.4.6(…))`, `@next/eslint-plugin-next`, `eslint-config-next`): é a
   mesma árvore com a versão nova, não uma dependência a mais.
3. **Zero alterações de código de aplicação.** É um patch.

**Critério de aceitação**

1. `apps/web/node_modules/next/package.json` diz **16.4.6**, e o lockfile não tem nenhuma
   `next@16.4.0` a sobrar. Prova também que só existe **uma** versão de `next` na árvore
   (`pnpm why next`).
2. O registo do npm consultado **com o comando**, não de memória: 16.4.0 devolve os avisos (os da
   D21) e **16.4.6 devolve zero**. Cola as duas saídas.
3. `npx next build` **corrido diretamente** em `apps/web` já não termina em `SecurityFatalError`
   (o `nudge` do Next só dispara para versões afetadas). Se ainda disparar, diz porquê e não
   contornes com variáveis de ambiente.
4. Gate completo: `format:check`, `lint`, `typecheck`, `test` (**582**), `build` (turbo) e a
   **suíte 101/101** — a subida é de patch, mas o comportamento é o que se mede.
5. `git diff --stat` mexeu **só** em `apps/web/package.json` e `pnpm-lock.yaml`. Qualquer ficheiro
   de código no diff é sinal de que a subida não é o que se pensa.
6. Zero dependências novas, zero migrações, zero alterações a `next.config`.

**O que NÃO fazer:** não subir de minor nem de major; não aproveitar para atualizar outras
dependências («já que estamos aqui»); não mexer em `config.experimental` nem definir
`__NEXT_AGENT_UPGRADE` para calar o aviso; não commitar nem empurrar (é o Lead).

## T54 — Ecrã de Revisão: quatro contagens e um salto

**Escolha do utilizador (17/11):** a página **só conta e salta** — a correção faz-se onde ela já
se faz (no extrato, com as ações em massa da T53, e nas páginas de contas e de cartões). Quatro
fontes: por confirmar, sem categoria, contas vencidas, faturas por pagar.

**Porque:** o que está por arrumar não tem hoje um sítio onde se veja todo junto. Cada um destes
quatro já tem ecrã; o que falta é saber **quantos** são, sem os procurar um a um.

**Comportamento esperado**

1. Rota nova **`/revisao`**, no grupo autenticado (a guarda de sessão vem do layout).
2. Quatro cartões, cada um com a **contagem real** e um salto:
   - **Por confirmar** — `status = PENDING` → `/transacoes?status=pending`
   - **Sem categoria** — `kind` EXPENSE/INCOME, `categoryId = null`, `status ≠ IGNORED` →
     `/transacoes?semCategoria=1`
   - **Contas vencidas** — `ReceivablePayable.status = OVERDUE` → `/contas-pagar-receber`
   - **Faturas por pagar** — `Invoice.status = CLOSED` → `/cartoes`
3. O total no topo, e **cada cartão com o seu estado de zero** («Nada por confirmar», não um `0`
   sem explicação).
4. **A porta principal é o Painel** — um bloco «por arrumar» com o total e ligação para
   `/revisao`. A barra lateral **continua com oito** (D7 não muda por causa disto).
5. A **paleta** passa a ter **16**: `/revisao` entra em `ALL_NAV_ITEMS`. A spec `33-navegacao-15`
   do QA atualiza a contagem e o nome — **afrouxá-la para «≥15» é proibido**: o contrato existe
   para apanhar quem acrescenta um ecrã e esquece a porta.
6. O filtro **`semCategoria=1`** vive na URL, como todos os outros: sobrevive a recarregar, é
   partilhável, e aparece como chip removível na barra de filtros.
7. Zero dependências novas, zero migrações, nenhuma rota existente muda de endereço.

**Ficheiros:** `app/(app)/revisao/page.tsx` (novo) · `server/review.ts` (novo, ou as consultas
junto de `server/transactions.ts` se ficarem melhor lá) · `lib/nav.ts` (a entrada da paleta) ·
`app/(app)/page.tsx` (o bloco do Painel) · `components/transaction-filters.tsx`,
`app/(app)/transacoes/page.tsx` e `server/transactions.ts` (o filtro `semCategoria`) ·
`e2e/` (é do QA).

**Critério de aceitação**

1. As quatro contagens medidas contra a base, com dados criados para cada caso; a soma do topo é
   igual à soma dos quatro.
2. Resolver um item de cada tipo (confirmar um lançamento, dar categoria a um, pagar uma conta,
   pagar uma fatura) faz **a contagem desse cartão descer** sem refresh manual.
3. O salto do extrato abre com o filtro aplicado e o chip visível, e o **`total` que o extrato
   devolve com `?semCategoria=1` é igual à contagem do cartão** — a mesma verdade nos dois sítios.
4. `?semCategoria=1` sobrevive a recarregar; limpar o chip devolve a lista completa.
5. Nenhum ecrã órfão: `/revisao` tem porta no Painel **e** na paleta; barra lateral continua
   **8**; paleta **16**.
6. `axe` **0** em `/revisao` a 1280 e a 360; alvos de toque ≥44 a 360; sem transbordo horizontal.
7. Teclado e leitor de ecrã: a ordem de `Tab` segue a ordem visual, e o nome acessível de cada
   cartão **inclui o número** («3 lançamentos por confirmar»), não só o título.
8. Gate completo e suíte; a spec nova **falha quando deve** (fazer a contagem do cartão divergir
   do `total` do extrato tem de a deixar vermelha).
9. Zero dependências novas, zero migrações.

**O que NÃO fazer:** não pôr `/revisao` na barra lateral (quebraria os oito de D7 e a decisão é que
a porta é o Painel); não afrouxar a spec da paleta; **não pôr o extrato dentro de `/revisao`** — a
página conta e salta, e a correção vive onde já vive; não criar filtros novos para além do
`semCategoria`; não commitar nem empurrar.

**Correção ao contrato, aceite durante a implementação (17/11):** dois dos quatro filtros escritos
aqui davam **zero para sempre**, porque a coluna não é a verdade.

1. **Contas vencidas:** `ReceivablePayable.status = OVERDUE` **nunca é gravado** por nada na
   aplicação — o valor existe no enum, na etiqueta e no schema, e mais nada. A página de contas a
   pagar/receber marca vencida com `status = 'OPEN' && dueDate < hoje`. O cartão passa a contar
   **assim**: com a leitura literal, o cartão ficaria a zero enquanto a página mostrava contas
   vencidas, e o critério 2 («pagar uma conta faz o cartão descer») seria impossível de cumprir.
2. **Faturas por pagar:** `Invoice.status` é **derivado** (data de fecho + o que já foi pago, pela
   cadeia de faturas), não lido da coluna. A contagem lê `listInvoices()`, a mesma fonte da página de
   cartões, e filtra `status === 'closed'`.

A regra que isto fixa, e que vale para o resto da vaga: **a contagem lê a mesma fonte que o ecrã onde
se corrige** — se o cartão e a página discordarem, um dos dois está a ler uma coluna que já não é a
verdade.

**Volta 2 (DEVE do Revisor, aceite):** `status === 'closed'` sozinho ainda contava faturas **de total
0 €**. O `invoiceChain` só dá `paid` quando `totalInCents > 0 && outstandingInCents === 0`
(`packages/shared/src/finance/invoice.ts:137-142`), por isso uma fatura sem compras cai em `closed` com
`outstandingInCents: 0`. É alcançável: a fatura nasce por `invoice.upsert` (`invoice-writes.ts:48`) e
**nunca é apagada** — não existe `invoice.delete` na aplicação. E não sai pelo ecrã, porque
`/cartoes` desativa «Paga» quando `outstandingInCents === 0` (`invoice-row-actions.tsx:34,51`).
Correção: `&& invoice.outstandingInCents > 0`. Um cartão nunca chega a zero com dinheiro que já não
existe.

## T58 — A árvore de dependências: tirar a CLI do runtime e fechar o zod

**Porque:** a auditoria à árvore **de produção** (`pnpm audit --prod`, 17/11) devolve **34 avisos**,
e a subida do Next da T56 só fecha **5**. Medido: 2 críticos e 1 alto no `next`, e o resto em 23
pacotes que entram por três portas.

```
critical  next      x2   (fecha com a T56)
high      next      x1   (fecha com a T56)
moderate  next      x2   (fecha com a T56)
high      zod        x1   ← é nosso, e está em uso
high      systeminformation, undici x4, body-parser, hono, qs, minimatch, ip-address, fast-uri  ← entram por `shadcn`
high      deepmerge-ts, mysql2, picomatch, fast-uri  ← entram por `better-auth`
```

**A descoberta que vale mais:** `shadcn` é uma **CLI de geração de código**, está em
`dependencies` do `apps/web`, não é importada em sítio nenhum do código (`grep` vazio) e não é
usada por nenhum script. Ainda assim arrasta para a instalação de produção um servidor MCP, o
`hono`, o `express`, o `undici` e o `express-rate-limit` — **~20 dos 34 avisos e a maior parte da
superfície que ninguém executa.** Um gerador de código não pertence ao runtime da aplicação.

**O que se faz (sem subir nenhuma versão de framework e sem dependências novas):**

1. `shadcn` passa de `dependencies` para `devDependencies`. Continua disponível para gerar
   componentes em desenvolvimento e no build; deixa de ser instalado em produção.
   **Não sai da árvore** — ver a nota abaixo: o CSS dele é usado pela aplicação.
2. `zod` **4.6.5 → 4.6.6** (patch). O aviso é alto e o `zod` **é** nosso: valida o `input` de todas
   as Server Actions. O aviso é exaustão de memória a validar colecções com limites grandes — isto
   é, input de fora.
3. `pnpm-lock.yaml` re-resolvido; nada mais sobe.

**Porque o pacote não sai de vez (achado do Dev, verificado):** `apps/web/src/app/globals.css:3`
faz `@import 'shadcn/tailwind.css'`, e esse ficheiro não são só dois `@keyframes` de acordeão —
define **nove `@custom-variant`** (`data-open`, `data-closed`, `data-checked`, `data-unchecked`,
`data-selected`, `data-disabled`, `data-active`, `data-horizontal`, `data-vertical`) que a
interface usa **158 vezes** (`data-open:` 53, `data-closed:` 46, `data-active:` 19, …). Copiar
isso para o `globals.css` é trabalho de outra tarefa, com prova visual; aqui só se muda a
**categoria da dependência**.

E não é uma restrição nova: `tailwindcss`, `@tailwindcss/postcss` e `typescript` **já** estão em
`devDependencies` — o projeto já precisa das dependências de desenvolvimento para construir. Um
`install --prod` antes do build já falhava por outras razões.

**O que fica de fora, e porquê (registar, não corrigir aqui):**

- `mysql2` — entra como peer opcional do `better-auth`, e a base é **PostgreSQL**. Os avisos são do
  protocolo MySQL: não são alcançáveis. Sair exige mexer no `better-auth`; não se faz por um aviso
  que não se pode atingir.
- `deepmerge-ts` (<8) — vem do `better-auth`; a correção exige subir o `better-auth` (minor), que é
  outra conversa.
- `picomatch` — o aviso diz que não há versão corrigida (`patched: <0.0.0`). Fica registado como
  **sem correção disponível**, não como esquecido.

**Critério de aceitação**

1. `pnpm audit --prod` **depois**: os avisos de `shadcn` (systeminformation, undici, body-parser,
   hono, qs, minimatch, ip-address, fast-uri, @hono/node-server) **desaparecem**; o de `zod` também.
   Cola o antes/depois com os números, não a conclusão.
2. `pnpm audit --prod` mostra a árvore **sem** `shadcn`: `pnpm why shadcn` explica-o, e
   `pnpm why shadcn --prod` já não o encontra.
3. `zod` instalado diz **4.6.6**; nenhuma alteração de código de aplicação.
4. Os avisos que **ficam** estão listados um a um no relatório, cada um com a razão de não se
   corrigir (não alcançável / exige subida de minor / sem correção disponível).
5. Gate completo: `format:check`, `lint`, `typecheck`, `test` (**582**), `build`, suíte **101/101**.
6. `git diff` toca em `apps/web/package.json` e `pnpm-lock.yaml`. **Zero** ficheiros de código.
7. Zero dependências novas, zero migrações.

**O que NÃO fazer:** não subir `better-auth`, não remover o `mysql2` à força, não acrescentar
`overrides` no `pnpm-workspace.yaml` para calar avisos, não mexer em versões que não estão na
lista, e não commitar nem empurrar.

### T58 — o `shadcn` sai do runtime **depois** desta tarefa? Não: fica registado

Fica escrito para não se repetir a pergunta. Tirar o pacote da árvore exige portar o
`shadcn/tailwind.css` para o `globals.css`: 9 `@custom-variant` e 2 `@keyframes`, usados 158 vezes
na interface. É uma tarefa própria, com prova visual em todos os componentes que usam `data-open:`
e `data-closed:` (menus, diálogos, separadores, caixas), e **não** um efeito colateral desta.

O que esta tarefa entrega é o que interessa ao risco: com o pacote em `devDependencies`, ele sai da
árvore **de produção** e leva consigo ~20 avisos e um servidor MCP que ninguém executa.

### T57 — prova de fecho (QA, build final; mutações repetidas por mim)

| O que                                       | Números                                                                    |
| ------------------------------------------- | -------------------------------------------------------------------------- |
| Rótulos a 1280 e 360                        | **0** ocorrências de `EXPENSE`/`INCOME`/`TRANSFER`/`GOAL_*`; «Gasto», «Ganho», «Transferência» |
| Ícone                                       | «Transferência» com `lucide-arrow-left-right`; gasto e ganho sem ícone **por desenho** |
| Diálogo de edição                           | Categoria: despesa **1**, ganho **1**, transferência **0**                  |
| Contraste do gatilho                        | **5,45:1** claro · **4,94:1** escuro; `axe` **0** em `/importar` nos dois temas |
| Mutação 1 — `kind: row.kind` cru            | **2 failed, 1 passed**: «o texto não pode conter «EXPENSE»» e «Expected: 1, Received: 0» (Categoria) |
| Mutação 2 — `text-foreground/60` de volta   | **1 failed, 2 passed**: `victoria /importar` «light: color-contrast (1)»    |
| Suíte                                       | **104/104** (corrida por mim — a do QA morreu com `code=3221226091`)        |
| Gate                                        | `format:check` · `lint` 0 · `typecheck` 0 · `test` **582** · `build` ✓      |

Depois das mutações, o `git diff` voltou a **8+/5− nos mesmos dois ficheiros** — provado por
comparação byte a byte com as cópias, não por memória.

**Porque o defeito viveu tanto tempo (menor, e o mais útil do parecer):** `TransactionView.kind` é
`string`, não união. Com `'expense' | 'income' | …` o compilador apanhava o enum cru na hora. O
`status`, ao lado, sempre foi normalizado — a diferença entre os dois campos é que um tinha o
comentário a lembrar e o outro era `string` para todos os efeitos.

**Nenhum consumidor dependia das maiúsculas.** O Revisor seguiu os dois únicos chamadores de
`listTransactions` e as comparações que restam em `'EXPENSE'`/`'TRANSFER'` (`reports.ts`, `export.ts`)
comem linhas do Prisma, não `TransactionView` — comparação correcta antes e depois.

**Achado do Revisor, anterior a esta tarefa e não corrigido (candidato a T59, precisa de autorização
do utilizador):** abrir «Editar» numa **transferência** e gravar **falha sempre** — o diálogo envia
`sempre` `accountId` e o servidor recusa qualquer `accountId` numa transferência
(`transaction-edit-dialog.tsx:157` + `transactions-actions.ts:511`). O botão é oferecido em todas as
linhas. É um beco sem saída para o utilizador, e não é da T57: antes era igual.

**Menores registados:** o comentário de `transaction-bulk-actions.tsx:43` ainda diz que o `kind` chega
em maiúsculas (desactualizado, sem efeito) · `ui/tabs.tsx:58` ficou com um `dark:text-muted-foreground`
redundante com a base · tipar `TransactionView.kind` como união impediria a repetição do defeito.

## T59 — Editar uma transferência falha sempre

**Aberto a pedido do utilizador (17/11), depois da T58.** Achado do Revisor durante a T57;
**anterior** a todas as tarefas desta vaga — antes era igual.

**O defeito, medido por leitura:** o diálogo «Editar lançamento» é oferecido em **todas** as linhas
(`transaction-table.tsx:528`) e envia **sempre** `accountId` (`transaction-edit-dialog.tsx:157`); o
servidor recusa **qualquer** `accountId` numa transferência (`transactions-actions.ts:511`). Resultado:
abrir «Editar» numa transferência e gravar **falha sempre**, seja qual for o campo que o utilizador
mudou. Não há caminho nenhum para corrigir a descrição ou a data de uma transferência pela interface.

**Comportamento esperado**

1. Editar uma transferência **grava**: descrição, data e valor.
2. O valor continua a ser **espelhado na outra perna** — a nota «O valor é espelhado automaticamente
   na outra conta» (`transaction-edit-dialog.tsx:203`) existe para isso e passa a ser alcançável.
3. A conta **não** é editável numa transferência: mudar a conta de uma perna é outra operação, e é
   por isso que o servidor a recusa. A interface deixa de a oferecer (ou de a enviar) em vez de
   deixar o utilizador preencher um campo que vai ser rejeitado no fim.
4. Editar uma despesa, um ganho ou uma linha de fatura continua a funcionar **exactamente** como hoje.
5. A recusa do servidor mantém-se: uma transferência com `accountId` continua a ser rejeitada. O
   defeito está em quem envia, não em quem recusa — **não abras a porta do servidor para o tapar**.

**Critério de aceitação**

1. Numa transferência, mudar a **descrição** grava e aparece na lista; mudar o **valor** grava e a
   outra perna fica com o sinal oposto e o mesmo montante.
2. O campo **Conta** não é oferecido (ou não é enviado) numa transferência, e o utilizador vê porquê.
3. Despesa e ganho: guardar continua a funcionar, com a conta a ser actualizada como hoje.
4. Uma spec que **falha quando deve**: com o `accountId` a voltar a ser enviado numa transferência,
   a spec fica vermelha com a mensagem real da recusa (não um timeout).
5. `axe` 0 no diálogo aberto numa transferência, a 1280 e a 360.
6. Gate completo e suíte; zero dependências novas, zero migrações, zero alterações de rotas.

**Ficheiros:** `components/transaction-edit-dialog.tsx` · `server/transactions-actions.ts` (só se a
mensagem de recusa precisar de ser mais clara) · `e2e/` (é do QA).

**O que NÃO fazer:** não abras a validação do servidor para aceitar `accountId` numa transferência;
não transformes a edição de uma transferência numa edição do par inteiro sem falar comigo (é outra
decisão); não mexas no diálogo de criação; não commites nem empurres.

## T55 — Calendário de contas: o mês de vencimentos e movimentos previstos

**Porque:** o que já está agendado está espalhado por três sítios — recorrências, contas a
pagar/receber e faturas de cartão — e nenhum deles responde à pergunta que se faz no início do mês:
**«o que é que me sai este mês e quando»**.

**Comportamento esperado**

1. Rota nova **`/calendario`**, no grupo autenticado. O mês vive na **URL** (`?mes=2026-11`), como
   os filtros do extrato: recarregar e partilhar mantêm o mês. Sem `?mes`, abre no mês corrente.
2. Vista de **mês** a partir de `sm`; a **360** a mesma informação em **lista por dia** (uma grelha de
   7 colunas não cabe e não se lê).
3. Quatro fontes, cada item com a sua etiqueta de origem e um salto para o ecrã onde se resolve:
   - **Contas a pagar/receber** com `dueDate` no mês e estado `OPEN`/`OVERDUE` → `/contas-pagar-receber`
   - **Faturas de cartão** com `dueDate` no mês e estado `CLOSED` → `/cartoes`
   - **Recorrências** activas com `nextRunDate` no mês → `/recorrencias`
   - **Lançamentos por liquidar** (`settled = false`) com data no mês → `/transacoes`
4. Cada dia mostra o **número de itens** e o **saldo do dia** (entradas menos saídas); o mês mostra
   três totais: **a pagar**, **a receber**, **saldo previsto**.
5. Um item **vencido** aparece no dia em que venceu, marcado como vencido — não desaparece nem salta
   para o mês seguinte. As contas `OVERDUE` de meses anteriores aparecem no **mês corrente**, numa
   faixa «em atraso», para não se perderem quando o mês vira.
6. **Só leitura.** O calendário não cria, não paga e não apaga nada: cada item leva ao ecrã próprio.
7. A **paleta** passa a ter **17** (`/revisao` da T54 + `/calendario`) e a barra lateral **continua
   com oito**. A porta é o Painel, ao lado do bloco «por arrumar» da T54.
8. Zero dependências novas, zero migrações, zero tabelas.

**Ficheiros:** `app/(app)/calendario/page.tsx` (novo) · `server/calendar.ts` (novo) · `lib/nav.ts` ·
`app/(app)/page.tsx` (a porta) · `e2e/` (é do QA).

**Critério de aceitação**

1. Com dados criados nas quatro fontes, o mês mostra **cada item no dia certo**, com o valor e a
   etiqueta de origem; os três totais batem com a soma dos itens.
2. Um item vencido no mês anterior aparece na faixa «em atraso» do mês corrente, e **não** duplicado
   no dia original.
3. `?mes` sobrevive a recarregar; navegar para o mês seguinte e voltar mantém tudo; um `?mes` inválido
   cai no mês corrente em vez de rebentar.
4. A 360 vê-se a **lista por dia** (não a grelha), sem transbordo (`scrollWidth` = 360); a partir de
   `sm` vê-se a grelha.
5. `axe` **0** a 1280 e a 360; cada dia é alcançável por teclado e o nome acessível inclui a data, o
   número de itens e o saldo; nenhum item comunica **só** por cor (vencido tem palavra, não só
   vermelho).
6. **Só leitura**: depois de percorrer o mês inteiro, nenhuma escrita na base (comparar contagens
   antes/depois).
7. Paleta a **17**, barra lateral a **8**, `/calendario` com porta no Painel e na paleta; a spec do
   contrato de navegação actualiza-se para 17 — **não** se afrouxa.
8. Gate completo e suíte; zero dependências novas, zero migrações.

**O que NÃO fazer:** não criar tabela nem migração («um evento» não se guarda aqui — deriva-se do que
já existe); não pôr `/calendario` na barra lateral; não pôr o calendário a criar lançamentos; não
trazer as recorrências inactivas; não afrouxar a spec da paleta; não commitar nem empurrar.

### T56 — prova de fecho (QA, build novo)

| O que                              | Números                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------ |
| Versão instalada                   | **16.4.6** · `pnpm why next -r` mostra **uma só**; lockfile com 8 `next@16.4.6` e **0** `next@16.4.0` |
| Registo do npm (consultado pelo QA) | 16.4.0 → **5 avisos** (2 critical, 1 high, 2 moderate) · 16.4.6 → **`{}`**     |
| `next build` directo               | «▲ Next.js 16.4.6» · *Compiled successfully* · **exit 0** · 0 `SecurityFatalError` |
| Ambiente                           | sem `__NEXT_AGENT_UPGRADE` nem variáveis `NEXT*`; `next.config.ts` **igual ao HEAD** |
| `pnpm audit --prod`                | **36 → 31**; **critical 2 → 0**; menções a `next` **5 → 0**                    |
| Suíte                              | **104 passed (6,2 m)**, sem morte de worker                                    |
| Seis páginas no build novo          | 200, título certo, **0** `pageerror`, **0** erro de consola                    |
| Diff                               | `apps/web/package.json` (4) e `pnpm-lock.yaml` (106) — **zero** código          |

**Método do Revisor, que vale mais do que o diff:** comparou os **conjuntos de chaves** dos dois
lockfiles — 1162 de cada lado, diferença simétrica de 32, **12 nomes alterados** (todos do Next,
incluindo os oito `@next/swc-*`) e **zero nomes novos ou removidos**. Os binários nativos alinhados
com o runtime são a falha clássica destas subidas, e passam despercebidos num *diff* de 106 linhas.

**Armadilha de leitura registada:** `grep 16.4.0 pnpm-lock.yaml` continua a dar **três** resultados —
são `globals@16.4.0`, o pacote de globais do ESLint. Coincidência de número, não é o Next.

**O que esta tarefa não compra:** restam **31** avisos na árvore de produção, quase todos
transitivos do `shadcn` (que é uma CLI) e do `better-auth`. A **T58** fecha a maior parte; o
`mysql2` (MySQL num projeto PostgreSQL), o `deepmerge-ts` (exige subir o `better-auth`) e o
`picomatch` (sem correção publicada) ficam com a razão escrita.

### T58 — prova de fecho (QA)

| O que                        | Números                                                                     |
| ---------------------------- | ---------------------------------------------------------------------------- |
| Avisos únicos (`--prod`)     | **29 → 8** (instâncias 31 → 8) · dependências de produção **704 → 470**       |
| `shadcn` fora do runtime     | `why shadcn -r` → `devDependencies 4.21.4`; `why shadcn --prod -r` → **vazio**; versão inalterada |
| `zod`                        | **4.6.6** instalado e no lockfile; o aviso desapareceu                        |
| Lockfile                     | 1158 chaves de cada lado; as 10 que entram e as 10 que saem são **todas** `zod@4.6.5→4.6.6` ou peers com essa versão |
| `shadcn` no lockfile         | entrada **byte a byte igual** (mesma `integrity`, mesma linha) — mudou de secção, não foi re-resolvido |
| **O CSS não se perdeu**      | o compilado tem `.data-open\:animate-in…`, `data-open:bg-accent`, `[data-state=open]`; menu e diálogo com `animationName: enter` 0,1 s; separadores de `/importar` trocam de aba |
| Suíte                        | **104 passed (5,9 m)**, sem morte de worker                                  |
| `axe` `/importar`            | **0** no claro e no escuro                                                   |
| Diff                         | `apps/web/package.json` (2+/2−) e `pnpm-lock.yaml` (39+/39−) — zero código    |

**Correção ao número do Dev, que eu também repeti:** os avisos não eram «31 instâncias» — são **29 avisos únicos** antes e **8** depois. E os oito que ficam **não** vêm todos do `better-auth` como ele disse: vêm por `prisma>@prisma/config` (`deepmerge-ts`), `prisma>@prisma/dev>…>ajv` (`fast-uri`), `mysql2` e `vitest` (`picomatch`). A atribuição errada teria escondido três caminhos de origem diferentes.

**Decisão sobre o piso do `zod` (menor proposto pelo Revisor, não feito):** o `packages/shared` continua a declarar `^4.6.5`. Subir para `^4.6.6` não mudaria nada do que é instalado — `^4.6.5` **nunca** resolve para 4.6.5 enquanto existir 4.6.6, porque o range pede a versão mais alta que o satisfaça. O piso só valeria contra um **downgrade deliberado**, que é o mesmo risco de qualquer dependência. Registado, não feito, e a razão é esta e não «falta de tempo».

**O que fica dito no contrato e se confirma:** o `shadcn` continua **necessário no build** (o `globals.css` importa o CSS dele). Não é problema de deploy — o build já precisa de `tailwindcss` e `@tailwindcss/postcss`, que também são devDependencies. O cenário que partiria isto (um stage Docker com `install --prod` **antes** do `next build`) não existe neste repositório, e fica escrito para o dia em que alguém o criar.

### T59 — prova de fecho (QA)

| O que                          | Números                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------- |
| Spec nova                      | `e2e/37-editar-transferencia.spec.ts` (4 testes) **verde**; suíte **108 passed (6,2 m)**     |
| **Mutação**                    | reposto o envio de `accountId` → `x 1` em **1,5 s** com a recusa real, não timeout           |
| Descrição numa transferência   | grava nas **duas** pernas                                                                   |
| Valor                          | 500,00 → **−50 000/+50 000**, mesmo `transferGroupId`, contas intactas                       |
| Conta e Categoria             | **0** e **0** no diálogo de uma transferência, a 1280 e a 360; nota presente                 |
| Despesa / ganho / fatura       | Conta+Categoria nos dois primeiros, Conta e sem Categoria na linha de fatura; mudar a conta numa despesa grava |
| Servidor                       | pedido directo com `accountId` numa transferência → recusa **inalterada**, pernas intactas    |
| `axe`                          | **0** no diálogo aberto numa transferência, a 1280 e a 360                                  |
| Gate                           | `format:check`/`lint`/`typecheck`/`test` **582**/`build` → 0/0/0/582/0                       |
| Diff                           | `transaction-edit-dialog.tsx` 38+/23− · `e2e/support/db.ts` 39+ · spec nova — zero servidor  |

**O detalhe que decidia o defeito e foi medido, não assumido:** o `isTransfer` compara `kind === 'transfer'` em **minúsculas** (`:141`), coerente com o `TransactionView` normalizado da T57 e com o servidor, que compara com o enum. Com a comparação em maiúsculas o `accountId` sairia do payload em **todas** as naturezas, o campo Conta desapareceria de tudo e o teste 1 — mais a mutação — apanhava-o.

**Uma armadilha que fica escrita:** o servidor recusa `categoryId` **mesmo a `null`** (`value.categoryId !== undefined`). Numa transferência não basta não escolher categoria — **não se pode enviar o campo**. Quem «limpar» isto para `categoryId: null` reabre o defeito com outra cara.

**O que isto não resolve (menores lidos pelo Revisor, nenhum bloqueia):**

1. A frase de recusa existe **duas vezes** (diálogo e `transactions-actions.ts:511`); a do servidor tem de ficar como guarda da API, mas as duas cópias divergem à primeira edição de texto.
2. A nota diz «elimina esta transferência» sem dizer que apagar uma perna apaga **as duas** — o diálogo de apagar já o diz, por isso o utilizador descobre no momento certo.
3. Para transferências o `accountId`/`setAccountId` continuam a ser inicializados e nunca enviados (estado morto, explicado em comentário).

### T54 — prova de fecho (QA, volta 2)

| O que                        | Números                                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| Quatro contagens             | **2 por confirmar · 3 sem categoria · 2 vencidas · 0 faturas** · topo **7 = soma**              |
| Presa a zero                 | ao inserir uma conta `OPEN` vencida: cartão **2 → 3** e topo **7 → 8** (a leitura literal `OVERDUE` dava 0) |
| Descidas                     | confirmar 2→1 · categorizar 3→2 · pagar conta 3→2 · pagar fatura 1→0 — só o cartão certo        |
| **Fatura de total 0**        | 45,00 € → 1 fatura; apagar a compra → `/cartoes` «Fechada · 0,00 €» com «Paga» e `/revisao` **0** e «Nada por arrumar» |
| Extrato `?semCategoria=1`    | chip visível · total do extrato **=** cartão · sobrevive a recarregar · limpar devolve a lista  |
| Navegação                    | paleta **16** com «Revisão» · barra **8** + Definições no rodapé · `/revisao` fora · porta no Painel · spec 33 passa a `toHaveCount(16)`, sem afrouxar |
| Mutação                      | extrato com `status: 'CONFIRMED'` → «o extrato conta o mesmo que o cartão — Expected 3, Received 2» em **2,2 s**; reposto (`18 0`) |
| `axe` / layout               | **0** a 1280 e a 360 · `scrollWidth` 1280/360 · alvos ≥44 · `Tab` na ordem visual · nome com o número |
| Suíte / gate                 | **113 passed (6,5 m)** sem morte de worker · `format`/`lint`/`typecheck` 0 · **582** testes · `build` 0 |

**Facto que se vê na descida e não é defeito:** pagar uma conta a pagar cria o lançamento correspondente **sem categoria**, por isso o cartão «sem categoria» **sobe** (2→3) enquanto o das vencidas desce. É a verdade da base a mexer-se, não um erro de contagem — fica registado para ninguém o «corrigir» depois.

**Duas notas de âmbito:** o Painel **sem dados** não desenha o bloco «Por arrumar» (um utilizador novo só tem a paleta como porta), e é por isso que a spec 33 cria um lançamento antes de procurar órfãos. E o cartão e a página podem discordar num caso legítimo: uma fatura com `outstanding 0` que a página ainda mostre — o cartão diz «0 por pagar», que é a verdade do dinheiro.

**Menores registados, não corrigidos:** `ReviewCard.done` é preenchido em quatro cartões e nunca lido · o nome acessível da ligação lê o número duas vezes («3 3 lançamentos por confirmar») · `isOverdue` da página de contas usa a meia-noite **do browser** e não de Lisboa (em Portugal coincidem; a oeste de UTC pode divergir) · `semCategoria` não está no `transactionFiltersSchema` (não é `.strict()`, por isso passa; se alguém o tornar estrito, o filtro morre em silêncio).

### T55 — prova de fecho (QA, 3 voltas)

| O que                        | Números                                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| Itens no dia certo           | 10 → −50 Conta · 12 → −105 Fatura · 15 → +70 Conta · 18 → 3 itens · 20 → −800 Recorrência · 25 → −30 Lançamento, **com valor e origem a 1280** |
| Totais                       | **1015,00 / 80,00 / −935,00** = soma dos itens dos dias (inclui a transferência, ver abaixo)   |
| Faixa «em atraso»            | **2 itens** (fatura → `/cartoes`, conta → `/contas-pagar-receber`), fora dos dias, ausentes noutros meses, fora dos totais |
| `?mes`                       | sobrevive a recarregar · seguinte/anterior voltam a novembro · `2026-13`, `abc`, `2026-11-30` e `0099-05` caem em novembro |
| 360 / 1280                   | lista por dia a 360 (`scrollWidth` 360) · grelha a 1280 com **todos** os itens, valor, origem e ligação |
| `axe` / teclado              | **0** a 1280 e a 360 · **6 paragens de `Tab`** (só dias com itens; eram 30) · nome do dia com data, itens e saldo · «Vencida» escrito no DOM |
| Só leitura                   | **260 → 260** nas 27 tabelas, login feito antes da primeira contagem                           |
| Navegação                    | paleta **17** · barra **8** · `/calendario` fora dela · porta no Painel · specs 33 e 38 a 17 sem afrouxar |
| Mutação                      | `billableInvoices` reposto a todas as faturas → «not toContainText … "2 faturas venceram … A −60,00 €"» — **asserção**, não timeout |
| Suíte / gate                 | **120 passed (6,5 m)** sem morte de worker · `format`/`lint`/`typecheck` 0 · **582** testes · `build` 0 |

**DEVE 1 (volta 2) · a dívida de uma fatura vencida desaparecia do calendário.** O filtro dos dias exigia `dueDate` dentro do mês e a faixa só consultava contas a pagar/receber: uma fatura de 300,00 € vencida em outubro não estava nos dias, não estava na faixa, não entrava em «a pagar» nem no saldo — via-se só em `/cartoes`. Correção: a faixa junta as faturas `closed && outstanding > 0 && dueDate < start`.

**DEVE 2 (volta 2) · a partir de `sm` o terceiro item de um dia não existia.** A grelha cortava em `slice(0, 2)` e o `+N` era texto morto — não abria nada — e nenhum item da grelha mostrava valor nem origem. O critério 1 («cada item, com o valor e a etiqueta de origem») só se cumpria a 360. Correção: célula lista todos os itens com valor, origem e ligação, com scroll interno.

**Volta 3 · a mesma dívida contada duas vezes no ecrã.** A correção da volta 2 expôs o trânsito da cadeia: `invoice.ts:239` faz `carriedOverInCents = outstandingInCents`, por isso os 60,00 € de outubro apareciam **na faixa** e **dentro** da fatura de novembro (45 + 60 = 105) — quem somava o ecrã chegava a 165,00 € para 105,00 € de dívida. Regra fixada: **por cartão, só a última fatura da cadeia conta dinheiro**, na faixa e nos dias. É a mesma que o motor já usa em `totalsByCard` (`invoice.ts:269`: a dívida do cartão é `chain[last].outstandingInCents`). Medido: cartão A soma **105,00 €** e nada dele na faixa; cartão B, cuja última fatura está fechada e vencida, aparece na faixa com 70,00 €.

**Consequências aceites, escritas para não serem redescobertas como defeitos:**

1. **Transferência por liquidar** conta como saída **e** entrada: com 10,00 € entre contas, «a pagar» 925 → **935** e «a receber» 70 → **80**, com o saldo do dia a 0,00 € e o saldo do mês parado (−855 €). Os dois brutos são «soma das saídas/entradas dos itens», não «o que sai da casa».
2. **Compra de cartão com fatura `open`** não aparece no mês da compra: entra quando a fatura fechar, no dia do vencimento. É o preço de não contar o mesmo dinheiro duas vezes.
3. **Se a última fatura de um cartão estiver `open`**, a dívida transitada não aparece na faixa até essa fatura vencer — a data de pagamento moveu-se para a frente, que é o que o trânsito significa.

**Menores registados, não corrigidos:** a «última fatura» é escolhida por `dueDate` e não por `closingDate` (equivalente na prática — nada na aplicação edita o `dueDate` de uma fatura; só o `createInvoice` o calcula de `closingDate + dueDay`) · pluralização escrita à mão em três sítios · guarda morto no `leadingBlanks` · `rel` do `MonthLink` decidido pelo texto do filho · `dayLabel` e o `<h3>` repetem a data.

**Ligação com a T54 — fica por corrigir e precisa de autorização:** a contagem «Faturas por pagar» (`server/review.ts`) continua a somar todas as `closed` com valor por pagar, por isso no cenário acima diria «2 faturas» para a mesma dívida de 105,00 €. É o mesmo filtro de uma linha, em ficheiro de outra tarefa.

**Facto de ambiente que custou uma medição:** a `next start` falhou com `EADDRINUSE` e o Dev leu, sem dar por isso, o build de outro agente em `:3000`. Tudo o que se mede neste projeto tem de vir com a porta e o `.next/BUILD_ID` declarados — um PASS contra o build errado é verde e falso.

## T60 — A contagem «Faturas por pagar» soma a cadeia inteira

**Aberto a pedido do utilizador (17/11), depois da T55.** Achado do Dev ao fechar a volta 3 da T55,
medido pelo QA no mesmo cenário.

**O defeito:** `server/review.ts` conta as faturas com `status === 'closed' && outstandingInCents > 0`.
Como o motor faz `carriedOverInCents = outstandingInCents` (`packages/shared/src/finance/invoice.ts:239`),
o que falta pagar de uma fatura entra no total da seguinte, e **cada fatura da cadeia continua a
mostrar o seu próprio «por pagar»**. Resultado: um cartão com a fatura de outubro de 60,00 € em aberto
e a de novembro de 105,00 € (45 + 60 transitados) conta **duas** faturas para **uma** dívida de
105,00 €. Com dois cartões nessa situação, a Revisão diz «3 faturas por pagar» onde há 2 dívidas.

**Regra, a mesma que a T55 fixou e que o motor já usa em `totalsByCard` (`:269`):** a dívida de um
cartão é a da **última fatura da cadeia**. Por isso, por cartão, só a última conta.

**Comportamento esperado**

1. A contagem é o número de **cartões** com a última fatura `closed` e com valor por pagar — não o
   número de faturas da base.
2. O cenário da T55 passa a dar **2** (cartão A com a última fatura de 105,00 €, cartão B com 70,00 €),
   e não 3.
3. A contagem continua a bater com o que `/cartoes` apresenta como dívida: a mesma dívida, o mesmo
   número de cartões devedores.
4. Resolver continua a funcionar: pagar a fatura de um cartão faz a contagem descer **1**, e pagar a
   última fatura de um cartão com dívida transitada faz descer **1** (não 2).

**Critério de aceitação**

1. Com o cenário de duas faturas no mesmo cartão, a contagem no ecrã e na base é **2**, com o número
   de faturas `closed` com valor por pagar lido da base a ser **3** — os dois números colados.
2. Pagar a última fatura de um dos cartões faz a contagem descer para **1**; pagar a de outubro de um
   cartão cuja última é novembro **não** a faz descer (a dívida continua na de novembro).
3. `axe` **0** em `/revisao` a 1280 e a 360; nada muda no layout.
4. Gate completo e suíte; a spec nova **falha quando deve**: repor a contagem a todas as faturas da
   cadeia tem de a deixar vermelha por asserção.
5. Zero dependências novas, zero migrações.

**Ficheiros:** `apps/web/src/server/review.ts` · `e2e/` (é do QA).

**O que NÃO fazer:** não mexas no calendário (`server/calendar.ts` já segue a regra certa), não
alteres o motor de faturas, não afrouxes a spec da paleta, não commites nem empurres.

## T61 — A regra «última fatura da cadeia» está escrita duas vezes, com chaves diferentes

**Aberto a pedido do utilizador (17/11), depois da T60.** Achado do Dev ao fechar a T60 e do Revisor,
que encontrou o gatilho.

**O defeito:** a mesma regra existe em dois ficheiros e escolhe por chaves diferentes.
`server/review.ts` (T60) escolhe a última fatura de cada cartão por **`closingDate`**; o calendário
(`server/calendar.ts:187`, T55) escolhe por **`dueDate`**. Hoje dão a mesma fatura, porque o
`dueDate` nasce de `closingDate + dueDay` e nada o edita. **Mas há um caso em que divergem, e foi
medido:** um cartão com `closingDay = 31` e `dueDay = 1` tem duas faturas que vencem no **mesmo dia**
(fecho 31/01 e fecho 28/02 vencem ambos a 01/03). No empate, o `calendar.ts` compara com `>` estrito e
fica com a **primeira** que vê na lista — que o `listInvoices` ordena por `dueDate` descendente e
mantém em ordem de cadeia no empate, ou seja a de **fecho anterior**. Com a de fevereiro ainda `open`,
a Revisão conta **0** e o calendário põe **60,00 €** no dia 1 de março; depois de fevereiro fechar, a
Revisão diz **105,00 €** e o calendário continua nos 60,00 € da de janeiro.

**Comportamento esperado**

1. Uma só função, num sítio só, que devolve «a última fatura de cada cartão» — em `server/invoices.ts`,
   ao lado de `listInvoices`/`loadInvoiceContext`, escolhida por **`closingDate`**, que é a chave da
   cadeia (`invoiceChain` ordena por `closingDate`).
2. `server/review.ts` e `server/calendar.ts` passam a **importar** essa função. Nenhum dos dois volta a
   escolher a última fatura à mão.
3. Comportamento visível igual em todos os casos já provados, **exceto** o empate: no cartão
   `closingDay 31 · dueDay 1`, o calendário passa a mostrar a fatura de **fecho mais recente**, igual à
   Revisão.

**Critério de aceitação**

1. Um só sítio escolhe: `grep` da escolha da última fatura não encontra duas implementações.
2. O caso do empate medido: cartão com `closingDay 31` e `dueDay 1`, fatura de janeiro fechada com
   60,00 € por pagar e a de fevereiro `open` com 45,00 € — depois de fevereiro fechar, a Revisão diz
   **105,00 €** e o calendário também, no mesmo dia. Cola os números antes e depois.
3. Tudo o que a T54 e a T55 provaram continua igual: as quatro contagens, os três totais do mês, a
   faixa «em atraso», a dupla apresentação que a T55 fechou.
4. Gate completo e suíte; a spec nova **falha quando deve** (voltar a escolher por `dueDate` tem de a
   deixar vermelha por asserção).
5. Zero dependências novas, zero migrações.

**Ficheiros:** `apps/web/src/server/invoices.ts` · `apps/web/src/server/review.ts` ·
`apps/web/src/server/calendar.ts` · `e2e/` (é do QA).

**O que NÃO fazer:** não mudes o motor de faturas, não mudes o comportamento de `listInvoices`, não
refactorizes o resto do calendário nem da Revisão, não commites nem empurres.

### T60 — prova de fecho (QA)

| O que                        | Números                                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| Os dois números              | `/revisao` diz **2** · base conta **3** faturas `closed` com valor por pagar                    |
| A diferença                  | a fatura de outubro do cartão A (60,00 €) está **dentro** dos 105,00 € de novembro             |
| Pagar a fatura corrente      | 2 → **1**                                                                                      |
| `axe` / layout               | **0** a 1280 e a 360 · `scrollWidth` 1280/360 · texto do cartão igual                          |
| Mutação                      | `invoices.filter` reposto → «a Revisão conta a dívida … Expected: 2, Received: 3» em **923 ms** (asserção) |
| Suíte / gate                 | **123 passed (6,9 m)** sem morte de worker · gate 0/0/582/0 · `format:check` **0** na árvore inteira |
| Diff                         | `server/review.ts` 18+/1− — um ficheiro                                                    |

**Consequência da mesma regra, escrita para não ser redescoberta como defeito:** se a **última** fatura de um cartão estiver `open` (ciclo a decorrer), a contagem não inclui esse cartão — a dívida transitada das anteriores está dentro dela e aparece quando ela fechar. Não é dinheiro perdido nem dívida esquecida: é a mesma quantia com a data de pagamento movida para a frente, e o cartão de `/cartoes` mostra-a sempre. Contar a última `closed` em vez da última da cadeia punha o mesmo dinheiro a contar duas vezes, que é o defeito que esta tarefa fechou.

**Nota do QA que fica escrita:** a metade «pagar a fatura de outubro» **não é executável pela interface**. Em `/cartoes?fatura=<id>` a fatura antiga abre o detalhe com o botão **«Fechar»** apenas; só a fatura corrente de cada cartão tem «Pagar fatura». Não é um defeito: a dívida da de outubro já está na de novembro, e é por isso que a contagem não desce ao lidar com ela — a razão é estrutural, não um atalho do teste.

**Fica aberta a divergência de chaves** (T61): a Revisão escolhe a última fatura por `closingDate` e o calendário por `dueDate`. O Revisor mediu o caso em que divergem — cartão com `closingDay 31` e `dueDay 1` dá duas faturas que vencem no mesmo dia e o calendário fica com a de fecho anterior.

## T62 — O `MAPA.md` mente sobre o próprio estado

**Porque:** o `MAPA.md` é o documento que a equipa lê para decidir o que fazer a seguir, e a secção
«Onde dói» foi medida a **2026-11-01**. Três itens dela já não são verdade, e eu verifiquei-os hoje:
o lockfile **tem** `react-hook-form` (3 referências), o `format:check` está a **0** na árvore inteira, e
os dois ecrãs que a lista dizia sem teste (`contas-pagar-receber`, `consolidacao-contas`) têm specs
(`e2e/45-…`, `e2e/55-…`). O `README.md` e o `docs/plano/ESTADO-E-HANDOFF.md` dizem «árvore verde»
quando o CI estava vermelho — e agora há itens verdes anunciados como vermelhos. Um mapa que mente é
pior do que nenhum, porque é em cima dele que se planeia.

**Comportamento esperado**

1. Cada item de «Onde dói» passa a ter: **o comando** que o mede, **a saída** de hoje e **a data**.
2. O que já não se verifica **sai da lista** — não fica «provavelmente fechado».
3. O que continua verdadeiro fica, com o número remedido (não herdado de 01/11).
4. `README.md` e `docs/plano/ESTADO-E-HANDOFF.md`: o estado do gate e do CI escritos como estão
   **hoje**, com a data, ou removidos se não se poderem verificar daqui.

**Critério de aceitação**

1. Nenhuma afirmação na secção «Onde dói» sem comando e saída colados no relatório.
2. Os três itens que eu medi hoje (lockfile, formatação, specs dos dois ecrãs) aparecem **corrigidos**
   ou removidos, com a medição ao lado.
3. O relatório `relatorios/T62-dev.md` tem uma tabela: item · comando · saída · veredicto
   (mantém/corrigido/removido).
4. Zero alterações a código de aplicação. Zero dependências.
5. Não se inventa: o que não se pode medir daqui (estado do CI no GitHub, produção na Vercel) aparece
   como **não verificado daqui**, com o que seria preciso para o verificar.

**Ficheiros:** `docs/gestao/MAPA.md` · `README.md` · `docs/plano/ESTADO-E-HANDOFF.md`.

**O que NÃO fazer:** não corras `vercel`, não faças deploy, não mexas em código, não commites.

## T63 — Três menores de acessibilidade e higiene

**Porque:** ficaram escritos nas tarefas fechadas e não justificavam uma volta própria. Agora justificam
uma tarefa pequena.

1. **O número lido duas vezes** no cartão da Revisão: o nome acessível da ligação diz «3 3 lançamentos
   por confirmar» porque o `<span>` do número e a frase o repetem (`revisao/page.tsx:128`).
2. **`ReviewCard.done`** é preenchido em quatro cartões e **nunca lido** (`revisao/page.tsx:27,40,50,60,70`)
   — são quatro strings e um campo a manter sem efeito.
3. **O fuso do `isOverdue`** na página de contas a pagar/receber (`receivable-payable-list.tsx:120-126`)
   usa a meia-noite **do browser**, não de Lisboa: em Portugal coincide, a oeste de UTC uma conta que
   vence hoje aparece «Vencida» e não é contada pelo cartão da Revisão nem pelo calendário.

**Critério de aceitação**

1. O nome acessível de cada cartão da Revisão diz o número **uma vez** — colar o nome lido do DOM.
2. `done` deixa de existir ou passa a ser usado; zero campos sem leitor no ficheiro.
3. O `isOverdue` compara com a **data de Lisboa**, e a página e o cartão da Revisão concordam num
   cenário de fronteira (uma conta que vence hoje). Cola o teste com o fuso forçado
   (`TZ=America/Sao_Paulo` ou equivalente) a mostrar que não muda de resposta.
4. `axe` **0** em `/revisao` e em `/contas-pagar-receber`, a 1280 e a 360.
5. Gate completo e suíte; zero dependências.

**Ficheiros:** `app/(app)/revisao/page.tsx` · `components/receivable-payable-list.tsx` (e o
`lib/today.ts` se precisares de um helper, sem o duplicar).

**O que NÃO fazer:** não mudes o comportamento do cartão nem o texto visível; não toques no calendário
nem na contagem da Revisão; não commites.

## T64 — `semCategoria` fora do schema de filtros

**Porque:** o filtro `semCategoria=1` do extrato vive só no URL e é lido por `server/transactions.ts:102`.
Não está no `transactionFiltersSchema` (`packages/shared/src/schemas/domain/transactions.ts:163-173`),
que **não** é `.strict()` — por isso a chave extra é descartada em silêncio hoje. Se alguém tornar o
schema estrito, o `safeParse` falha, o `value` cai para `{ limit: 50, offset: 0 }` e **todos os filtros
do extrato desaparecem sem erro**. É uma armadilha armada, não um defeito visível.

**Comportamento esperado**

1. `semCategoria` passa a ser uma chave declarada do schema de filtros (booleano ou o literal `'1'`,
   coerente com o que `transactions.ts` já lê), com o mesmo comportamento de hoje.
2. Um teste no `packages/shared` que falha se a chave for removida do schema — e que continua a passar
   se o schema ficar estrito.

**Critério de aceitação**

1. `transactionFiltersSchema` declara a chave, e `server/transactions.ts` lê-a do valor já parseado em
   vez de a ir buscar ao URL à mão.
2. Teste novo: com o schema tornado `.strict()` numa cópia, um filtro com `semCategoria: '1'` continua a
   fazer `safeParse` com sucesso — colar a saída.
3. Mais teste: o filtro continua a devolver o mesmo `total` e as mesmas linhas do que hoje (mesmo
   cenário da T54, cartão e rodapé iguais).
4. Gate completo e suíte; zero dependências, zero migrações.

**Ficheiros:** `packages/shared/src/schemas/domain/transactions.ts` · `apps/web/src/server/transactions.ts`
· `apps/web/src/app/(app)/transacoes/page.tsx` (se o parse mudar de sítio).

**O que NÃO fazer:** não mudes o `where` do filtro (o cartão da Revisão lê o mesmo), não acrescentes
filtros novos, não commites.

### T61 — prova de fecho (QA)

| O que                        | Números                                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| Uma implementação            | `grep lastInvoiceByCard` → **1 definição** (`invoices.ts:74`, por `closingDate`) + **2 importadores**; nenhum mapa local sobra |
| O empate, por fixture SQL    | cartão fecho 31/venc 1: janeiro (60,00 €) e fevereiro (105,00 €) vencem **ambos a 01/02**; `/revisao` **1** fatura, calendário **1 item −105,00 €** — a de fevereiro (`8a5f8458…`), não a de janeiro (`a6a2707c…`) |
| A outra metade               | com fevereiro por fechar: **0** nos dois ecrãs, sem valor a mais                              |
| Regressão                    | specs 38/39/40 verdes na mesma árvore; `axe` **0** em `/revisao` e no calendário, 1280 e 360  |
| Mutação                      | calendário a escolher por `dueDate` → «Expected "105,00 €", Received "…−60,00 €"» — asserção   |
| Suíte / gate                 | **126 passed (7,3 m)** sem morte de worker · `format:check` 0 na árvore inteira · lint/typecheck/build 0 · **582** testes |
| Diff                         | `invoices.ts` +30 · `calendar.ts` −23 · `review.ts` −32 — motor intocado                     |

**Nota de método, escrita para não enganar quem vier depois:** o cenário do empate **não se constrói pelo ecrã** (exige um ciclo a fechar a 31 num mês de 31 dias e o vencimento no mesmo dia da fatura seguinte). A fixture é **SQL**, com um `executarSqlDoSpec` novo em `e2e/support/db.ts`, e está documentada no relatório e na spec. É o único caso desta vaga provado fora do caminho do utilizador — e é o que dá sentido à regra.

**Facto a vigiar, não achado:** o `e2e/support/db.ts` passou a ter um executor de SQL genérico. É útil e é o que torna o empate possível, mas num sítio onde qualquer spec o pode chamar. Se um dia se quiser apertar, é uma tarefa de testes, não de produto.

### T62 — prova de fecho (QA)

| O que                        | Números                                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| Afirmações do mapa          | **10 de 10 conferem, 0 falsas** — cada uma com comando e saída                                 |
| Lockfile / formatação       | `Already up to date` · `react-hook-form` **3** · `format:check` «All matched files use Prettier» |
| `.gitattributes` / `next-env` | 19 B e `core.autocrlf false` · `next-env.d.ts` no `.prettierignore:10`                        |
| Lint / typecheck            | **4/4, 0 erros** · **4/4, 0 erros**                                                            |
| As duas specs               | existem **e correm**: 17 passed (um `flake` em «apaga o grupo» — ver abaixo)                   |
| **Produção**                | `/revisao` e `/calendario` **307** → `/entrar` · caminho inventado **404** · `/api/health` **200** com base `reachable` · deploy de Produção **`16ae678` = HEAD** |
| Migrações                   | **3 no repositório = 3 na base**, mesmos nomes, nenhuma revertida                              |
| Stack                       | Next **16.4.6** · Zod **4.6.6** · `shadcn` só em devDependencies 4.21.4 · **582** testes em 32 ficheiros |
| Diff                        | três `.md` (146+/230−) — **zero código**                                                       |

**O item 10 estava invertido, não atrasado.** O mapa dizia «a produção está 8 commits atrás»; medido hoje, o deploy de Produção corresponde ao `HEAD` e as rotas da T54 e da T55 respondem. A prova aceitável não é o registo do deploy (isso prova publicação, não serviço) mas o **307 numa rota real contra o 404 de um caminho inventado** — e o próprio `/api/health` a 200 com a base alcançável. A API da Vercel deu **403** (scope), pelo que o `READY` e o conteúdo do build publicado ficam **não verificados daqui**.

**Lacuna do mapa que se fechou:** conhecia **duas** migrações e existem **três** — faltava `20261103203748_remove_goal_movement_yield`, aplicada na base e ausente do documento.

**O que se perdeu e voltou:** a primeira versão da correção apagou a secção «Mapa de ficheiros» inteira (~20 linhas de estrutura: os ecrãs, os módulos finos, o motor puro, o OFX/CSV). O que era falso eram as contagens e os números de linha; a estrutura era contexto que ninguém reescreve. Voltou sem números e datada.

**`flake` encontrado pelo QA, registado e não corrigido:** na corrida conjunta das specs, «apaga o grupo» (`55-consolidacao-contas`) falhou uma vez e passou isolada em 2/2. É instabilidade de teste, não defeito de produto — mas é o tipo de vermelho que ensina a equipa a repetir até passar, e isso estraga o valor da suíte. Candidato a tarefa.

### T63 — prova de fecho (QA)

| O que                        | Números                                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| Nomes acessíveis (0, 1, 3)   | «Por confirmar **3 lançamentos** por confirmar…» · «Sem categoria **1 lançamento** sem categoria…» · «Contas vencidas **Nada vencido**…» — o número aparece **uma** vez |
| Texto visível                | inalterado nos três casos                                                                     |
| `done`                       | `grep -n done revisao/page.tsx` → **0**; o estado zero continua a sair de `empty`             |
| **Fuso**                     | spec `42-revisao-menores.spec.ts` com `timezoneId: 'America/Sao_Paulo'`: conta que vence **hoje em Lisboa** → página **1** «Vencida» e cartão da Revisão **1** |
| Mutação do fuso              | comparação com a meia-noite local → «só a de ontem está vencida — Expected: 1, Received: 2» em **3,0 s** (asserção) |
| `axe` / layout               | **0** em `/revisao` e `/contas-pagar-receber`, 1280 e 360 · `scrollWidth` 1280/360            |
| Suíte / gate                 | **129 passed (8,1 m)** sem morte de worker · `format:check` 0 na árvore inteira · 582 testes · lint/typecheck/build 0 |
| Diff                         | dois ficheiros (21+/11− na volta 1, 12+/5− no `isOverdue`)                                    |

**DEVE da volta 2, e o defeito era meu:** ao esconder o número grande (`aria-hidden`) para matar o «3 3 lançamentos», passei a esconder a informação no único caso em que a frase não a repetia. `countLabel` devolve `unit[0]` — «lançamento por confirmar» — quando `count === 1`, **sem numeral**: um cartão com exatamente um item lia-se «Por confirmar lançamento por confirmar». Com 0 havia o `empty`; com 3 a frase já trazia o número. Só o 1 ficava sem nada. Correção: o numeral entra **só em `sr-only`** nesse ramo, e o texto visível não muda.

**O que isto ensina, e fica escrito:** nenhum teste anterior o apanhava — `axe` a 0, texto visível certo, página a funcionar. Só se vê lendo o **nome acessível produzido**. É por isso que a prova desta tarefa é o nome do DOM nos três casos, e não uma captura.

**O fuso, agora com trava:** a divergência só existe a oeste de UTC, e por isso a spec força `America/Sao_Paulo` em vez de confiar no ambiente. Sem forçar o fuso, o teste passaria sempre e não provaria nada — que é a razão pela qual o defeito esteve escrito durante três tarefas sem ser corrigido.

### T64 — prova de fecho (QA)

| O que                        | Números                                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| **A prova central**          | `transactionFiltersSchema.strict().safeParse(objecto completo)` → **true** com `semCategoria`, `valor`, `valorOp`; na cópia **sem as duas linhas** → **false** com `unrecognized_keys: ["valor","valorOp"]` |
| Controlo                     | assere o **código** `unrecognized_keys`, não só o booleano                                    |
| Vermelhos                    | sem a linha de `semCategoria`: **3 failed / 1 passed** (asserção, não compilação) · só com `valor`/`valorOp` fora: **1 failed / 3 passed** |
| Comportamento                | cartão «Sem categoria» **3** = `?semCategoria=1` **total 3** (3 linhas, chip), recarregar mantém, limpar devolve **4** |
| Filtros combinados           | `valor=15&valorOp=gt` → **3** · `+semCategoria=1` → **2** · `+status=pending` → **1** · `+search=mercado` → **1** · `valor=abc` → **4** (par inválido ignorado) |
| Suíte / gate                 | **586 testes** em 33 ficheiros · suíte **129 passed (7,7 m)** · `format:check` 0 na árvore inteira · lint/typecheck/build 0 |

**O buraco que a volta 2 fechou, e é o mais instrutivo da vaga:** a primeira entrega declarou **só** `semCategoria`. O Revisor executou o schema estrito em vez de o ler e provou que `valor` e `valorOp` — que a página põe no **mesmo objecto** — continuavam fora: com o schema estrito, quem tivesse `?valor=100&valorOp=gt` perdia **todos** os filtros do extrato. O teste do Dev não o via porque o caso estrito só levava duas chaves. **Um teste que prova «esta chave passa» não prova «o objecto passa»** — e a diferença era exatamente o defeito.

**Fica escrito, não corrigido:** um **valor** inválido (`?semCategoria=true`) ainda faz o `parse` inteiro falhar em vez de cair só ele; o guarda é a normalização em `transacoes/page.tsx:137`. O caminho certo é o schema **degradar em vez de rebentar** (`catch(undefined)` por campo). Candidato a tarefa, junto com o `flake` do «apaga o grupo» e o executor de SQL genérico em `e2e/support/`.

## T65 — O `flake` do «apaga o grupo»

**Porque:** na corrida conjunta da T62, o teste «apaga o grupo» de `e2e/55-consolidacao-contas.spec.ts`
falhou **uma** vez e passou isolado em 2/2 (23,7 s). Não é um defeito do produto; é pior — é um
vermelho que a equipa aprende a repetir até passar. A partir daí a suíte deixa de servir como prova, e
esta equipa fecha tarefas com a suíte na mão.

**O que se sabe:** falha **na corrida conjunta**, passa **isolado**. Isso aponta para estado partilhado
entre specs (dados de outro spec na base, ordem de execução, ou dois workers a tocar nas mesmas linhas),
não para o teste em si.

**Comportamento esperado**

1. A causa escrita por extenso: o que é partilhado, e por que ordem de execução importa.
2. A correção **na causa**, não no teste: espera cega (`waitForTimeout`) e repetição do teste não
   contam como correção.

**Critério de aceitação**

1. O vermelho **reproduzido por comando**, colado: a spec corrida em conjunto falha hoje, ou — se não
   falhar — diz quantas tentativas foram precisas e com que comando (`--repeat-each`, `--workers`).
2. A causa identificada com a linha e o dado que colidem.
3. Depois da correção: a spec corrida **5 vezes seguidas** na mesma invocação, verde; e a suíte inteira
   uma vez, verde.
4. Nenhum `waitForTimeout` novo, nenhum `test.skip`, nenhum `retries` a aumentar para tapar.
5. Zero dependências, zero migrações, zero alterações de produto.

**Ficheiros:** `e2e/55-consolidacao-contas.spec.ts` · `e2e/support/` (o que precisar). Não toques em
`apps/`.

**O que NÃO fazer:** não aumentes `retries` no `playwright.config.ts` · não marques o teste como `skip`
ou `fixme` · não serializes a suíte inteira para esconder a colisão — se a correção for mesmo
`workers: 1`, isso é uma decisão minha, não tua, e vem com o custo escrito.

## T66 — Um valor inválido no URL derruba todos os filtros

**Porque:** o schema do extrato já conhece todas as chaves (T64), mas um **valor** inválido ainda faz
o `safeParse` falhar inteiro: `?semCategoria=true` sai da página como `undefined` e o filtro desliga-se
— mas se um chamador passar o valor cru, o `value` cai para `{ limit: 50, offset: 0 }` e o utilizador
**perde todos os filtros** sem uma única mensagem. Hoje o guarda é a normalização da página, não o schema.

Isto foi escrito como resíduo na T64 e ficou por decisão minha. Agora é tarefa.

**Comportamento esperado**

1. Um valor inválido num campo **cai só esse campo** (`undefined`), e os outros filtros continuam a
   valer. O caminho é `catch` por campo (ou equivalente), não um `try/catch` à volta do parse todo.
2. Nenhum comportamento válido muda: `semCategoria=1`, `limites`, `datas` e `valor`/`valorOp` continuam
   a filtrar como hoje.

**Critério de aceitação**

1. `?semCategoria=true&search=mercado` devolve **só o que o `search` filtra** (colar o total com e sem
   o `search`), e não a lista sem filtros nenhum.
2. `?semCategoria=true` sozinho devolve a lista completa do utilizador (não os 50 por omissão) — colar
   o total.
3. Um `limit` inválido (`?limit=abc`) não derruba os outros filtros: colar um caso com `search`.
4. Teste no `packages/shared` que prova as duas coisas (valor inválido cai só ele; os válidos seguem), e
   que **falha quando deve** (sem o `catch`, vermelho por asserção).
5. Gate completo e suíte; zero dependências.

**Ficheiros:** `packages/shared/src/schemas/domain/transactions.ts` · `apps/web/src/server/transactions.ts`
· `apps/web/src/app/(app)/transacoes/page.tsx` (só se a normalização deixar de ser precisa).

**O que NÃO fazer:** não mudes o `where` nem o `parseAmountFilter` · não engulas erros de parse em
silêncio sem teste que o prove · não commites.

## T67 — O executor de SQL genérico nos testes

**Porque:** para o empate da T61 era preciso um cenário que o formulário não constrói, e o
`e2e/support/db.ts` ganhou um `executarSqlDoSpec` — um executor de SQL **arbitrário**, disponível a
qualquer spec. É o que torna o caso possível, e é uma porta aberta: uma spec pode passar a inventar
dados que o produto nunca produz, e o teste fica verde sobre um estado impossível.

**Comportamento esperado**

1. Deixa de haver um executor genérico. Ficam **funções de fixture com nome e forma**: uma que cria a
   fatura com o fecho que se quer, com os campos que o produto escreveria, e que o `limparDadosDoSpec`
   apanha pelo prefixo como as outras.
2. A spec da T61 continua a passar, sem reescrever o cenário.

**Critério de aceitação**

1. `grep` mostra que nenhuma spec pode chamar SQL arbitrário (o executor genérico desapareceu ou
   deixou de ser exportado).
2. A fixture nova está documentada com o cenário que serve e o que **não** permite (por exemplo: não
   aceita SQL livre, só os campos da assinatura).
3. A spec `41-cadeia-faturas` verde com a fixture nova, e o vermelho dela continua a existir (mutação
   do `closingDate` → asserção).
4. Gate completo e suíte; zero dependências.

**Ficheiros:** `e2e/support/db.ts` · `e2e/41-cadeia-faturas.spec.ts`.

**O que NÃO fazer:** não apagues o cenário do empate para poder remover o executor — o cenário vale mais
do que a limpeza · não toques em `apps/` · não commites.

### T65 — prova de fecho (QA) e mudança de âmbito

**O `flake` não se reproduziu, e isso passou a ser a conclusão.** O Dev tentou **79** execuções da spec (repeat-each 5 nos dois projetos, 15 em `chromium`, suíte inteira) e uma sonda que atrasava os chunks em 2,5 s; o QA tentou a base fria (10 min de ociosidade + suíte inteira) e a CPU saturada. Total **>170 execuções, zero falhas do «apaga o grupo»**. Pelo caminho o Dev **desmentiu a sua própria hipótese** dos chunks (`page.goto` só resolve no `load`), o que vale mais do que trinta verdes.

**A razão de não haver resposta estava no repositório:** o `trace.zip` da falha original da T62 **existiu e foi apagado**, porque `outputDir: test-results` é limpo no arranque seguinte. Sem o ficheiro, o `flake` era um mistério por construção — não por falta de trabalho.

**O que a tarefa passou a entregar:**

| O que                        | Prova                                                                                          |
| ---------------------------- | ---------------------------------------------------------------------------------------------- |
| `pnpm test:e2e`              | invólucro que corre o Playwright, repassa argumentos e herda o `stdio` (129 testes listados com `--list`) |
| Falha normal                 | copia `trace.zip` + `test-failed-*.png` + `error-context.md` para `relatorios/.falhas/<data>`, **EXIT=1** |
| `trace.zip` copiado          | **íntegro** — 10 entradas, `test.trace` 7 310 B + attachments                                   |
| Interrupção                  | `signal`, `3221225786` (Ctrl+C no Windows) e `130` → mensagem, **EXIT=130**, **nada copiado**   |
| Arranque falhado             | `error` → mensagem e exit 1 (antes saía **0 mudo**)                                            |
| `pnpm qa:teste`              | **8 pass em ~75 ms**; com o `1` no `INTERROMPIDO` → `pass 6 · fail 2`                          |
| Guarda do `argv[1]`          | invocado por outro caminho → mensagem e **exit 1**; importado → silêncio                      |
| Config / higiene             | `retries: 0`, `expect.timeout: 20 000`, `playwright.config.ts` intocado, zero `waitForTimeout`  |
| Suíte / gate                 | **129 passed (7,4 m)** pelo caminho novo, igual ao direto · gate 0/0/0/586/0                   |

**Uma falha a mais, que não é produto:** na corrida a frio, **4 testes não chegaram a correr** — três a 0 ms, uma a 680 ms — com `worker process exited unexpectedly (3221225794 = 0xC0000142)`, família do `3221226091` da T57. O processo worker morre e leva atrás a fila dele: um sintoma desses pode produzir qualquer falha, incluindo um `expect` de 20 s a esgotar. É ambiente (Windows), não produto — o CI corre em Linux. Fica como **T69 proposta**.

**Declarado e não provado:** um `Ctrl+C` **real** não foi injetado nem pelo Dev nem pelo QA neste ambiente (o `kill -INT` do Git Bash não chega ao filho do invólucro; o `taskkill` mata com outro código). O ramo POSIX (`signal: 'SIGINT'`) está provado pela **tabela de oito casos**, não por uma corrida. O que está medido é o `0xC000013A` do Windows, que é o Ctrl+C desta máquina.

**O buraco que fica aberto, e é o mais importante:** o CI **não corre** `pnpm qa:teste` — `pnpm test` é `turbo run test` e nunca chega à raiz. Hoje, apagar o `130` do `INTERROMPIDO` deixa o CI **inteiro verde**. O teste existe e passa; a proteção ainda não. Fica como **T68 proposta** (duas linhas no `ci.yml`).

**Menores registados:** `scripts/` está fora dos workspaces, por isso `lint` e `typecheck` não veem os três ficheiros (só o Prettier os cobre) · o glob `scripts/*.test.mjs` não apanha um teste futuro fora dessa pasta, em silêncio · um `taskkill /F` ou OOM chegam como `status: 1` e caem em «falhou», copiando um `test-results` a meio · o `process.on('SIGINT', () => {})` tira o Ctrl+C ao invólucro (não ao Playwright); corrigir exige `spawn` assíncrono.

### T66 — prova de fecho (QA)

| O que                        | Números                                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| O defeito, na sonda do chamador | `{semCategoria:'true', search:'mercado'}` **antes** → `safeParse false` → `{limit:50, offset:0}` (todos os filtros perdidos) · **depois** → `true` com `{search:'mercado', limit:50, offset:0}` |
| Com 60 lançamentos, 3 «mercado» | `/transacoes` **60** · `?search=mercado` **3** · `?semCategoria=true&search=mercado` **3** · `?semCategoria=true` **60** (não 50) · `?limit=abc&search=mercado` **3** |
| Outros campos degradam sozinhos | `{limit:'abc', search:'mercado'}` → `search` preservado · `{kind:'inventado', status:'pending'}` → `status` preservado |
| Sem regressão                | `?valor=15&valorOp=gt` **3** · `?semCategoria=1` **30 de 60** · objecto completo com `limit:25, offset:50` |
| Teste                        | **9 passed** no ficheiro do schema · mutação sem o `catch` → `5 failed / 4 passed`               |
| Limites                      | `999999`, `201`, `-5`, `'abc'` → **50** · `25` → 25 · `offset` `-1` → 0, `7` → 7 (com `catch`, não `undefined`: no Prisma um `limit` indefinido é **sem LIMIT**) |
| Suíte / gate                 | **591 testes** · suíte **129 passed (7,7 m)** · `format:check` 0 na árvore inteira · lint/typecheck/build 0 |

**Os meus critérios 1–3 eram mais fracos do que a correção.** O Dev avisou, e o QA confirmou: os cinco totais do URL são **iguais antes e depois**, porque desde a T64 a página normaliza e nunca entrega um valor inválido ao schema. Os critérios servem como regressão; o valor real está na sonda do **chamador cru** e na degradação **dos outros campos** — `limit:'abc'` já não derruba o `search`.

**Uma expectativa da T64 mudou, e está presa nos dois sentidos.** O caso «`semCategoria: '0'` é recusado» saiu e entrou «`'0'` cai só ele» (`success: true`, `undefined`), com a razão escrita. O Revisor confirmou que não ficou mais fraco: repor `z.literal('1')` sem `catch` volta a dar `false` e o teste falha; afrouxar para `z.string()` deixa o `'0'` chegar ao `data` e o `toBeUndefined()` falha. O contrato `strict()` com o objecto completo, da T64, continua coberto e verde.

**O preço da degradação, escrito:** com `catch`, um valor inválido deixa de ser distinguível de um campo ausente. Hoje não custa — `transactionFiltersSchema` só serve `listTransactions`, não há Server Action nem rota a validar com ele — mas no dia em que servir entrada de fora, o `success` não dirá nada sobre os campos.

**Menores:** uma pesquisa com mais de 120 caracteres continua a não filtrar (antes derrubava tudo, agora cai só ela — o mesmo silêncio, mais pequeno); e o `search` é descartado em vez de truncado.

### T67 — prova de fecho (QA)

| O que                        | Números                                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| A porta fechada              | `grep executarSqlDoSpec e2e/` → **0** (antes: 8 chamadas na 41, 9 na 42, mais a definição); `withClient` continua **sem export** — não há forma de obter um cliente |
| Fixtures com forma           | `criarCartaoDoSpec`, `criarFaturaDoSpec`, `criarCompraNaFaturaDoSpec`, `lerFaturasDoCartao`, `moverFechoDaFatura`, `criarLancamentoDoSpec`, `contarEstadoDoUtilizador`, `lerContextoDoUtilizador` — todas recebem **campos**, nenhuma aceita SQL; valores por `$n`, datas por `$n::date` |
| Órfãos                       | **0 durante a corrida** (polling de 45 s a cada 1,5 s: `prefixo 2` mid-run, `orfaos 0`) e 0 depois — antes eram **2 por corrida**, e o teardown escondia-os |
| Spec 41                      | cenário intacto: janeiro 31/01→**01/02** 60,00 € e fevereiro 28/02→**01/02** 105,00 € · `--repeat-each=2` → **6 passed (29,0 s)** |
| Spec 42 (do QA)              | `timezoneId: 'America/Sao_Paulo'` na linha 133 e as mesmas asserções (`página 1 · Revisão 1`)   |
| Os dois vermelhos            | 41: «Expected "105,00 €" / Received "11-60,00 €…"» · 42: «Expected: 1, Received: 2»            |
| Suíte / gate                 | **129 passed (7,5 m)** com `--output` próprio · gate 0/0/0/591/0                                |

**O `--repeat-each=2` pagou-se:** o cartão da spec 41 tinha **nome fixo**, por isso a segunda passagem voltava a correr o `beforeAll` com o cartão da anterior e rebentava na chave única (`credit_card_userId_name_key`). Passou a `${PREFIXO} cartão ${Date.now().toString(36)}`. Era a mesma família de defeito que a T65 andou a caçar — dependência do estado deixado atrás — mas num sítio onde nem o `finally` nem a limpeza por prefixo chegavam. **Correção do QA, não do Dev:** o relatório do Dev não a menciona porque não a viu.

**O que ficou de fora, dito e não corrigido:** `definirStatusDoLancamento` (`db.ts:220`, spec 35) continua a actualizar por `id` **sem dono** no `WHERE` — é a única excepção, e está escrita ao lado do comentário que fixa a regra («as outras escritas **desta tarefa**»), com o custo de a fechar (mudar a assinatura e duas chamadas da spec 35). Ganhou `rowCount`, para não falhar em silêncio. O `grep` e o comentário dizem a mesma coisa.

**Sobre as +252 linhas no `db.ts`:** cinco dos sete helpers novos têm um único consumidor, a spec 41. Vivem lá porque a regra é «SQL só no `db.ts`» — o ficheiro crescer é o preço da regra, não o contrário. Ficaram num bloco separado dos genéricos.

## T68 — O teste do invólucro não corre no CI

**Aberto a pedido do utilizador (18/11), depois da T65.** Achado do Revisor ao fechar a T65, e é o
buraco que dá sentido a tudo o que essa tarefa entregou.

**O defeito:** o `pnpm test:e2e` agora classifica o resultado, copia os artefactos quando falha e tem
**oito testes próprios** (`scripts/qa-e2e.test.mjs`) que prendem a classificação. Só que o CI corre
`pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` — e `pnpm test` é `turbo run test`, que percorre
os scripts dos pacotes e **nunca chega à raiz**. `grep "qa:" .github/workflows/` não devolve nada.

Consequência medida: **apagar o `130` do `INTERROMPIDO` deixa o CI inteiro verde.** O teste existe, a
proteção não.

**Comportamento esperado**

1. O CI corre `pnpm qa:teste` — no mesmo job dos testes, como passo próprio, com o mesmo comando que se
   usa à mão.
2. Nada mais do workflow muda: os passos existentes ficam na mesma ordem e com as mesmas condições.
3. O passo **não** precisa de base de dados nem de browser: `qa:teste` é `node --test`, puro. Se
   precisar de instalar dependências a mais, diz — não deve.

**Critério de aceitação**

1. O `ci.yml` tem o passo, e um `grep "qa:teste" .github/workflows/ci.yml` devolve-o.
2. O YAML **é válido**: cola a saída do parse (`node -e` com um parser YAML, ou `pnpm exec yaml`), porque
   um workflow inválido só se descobre no GitHub, depois do push.
3. **O passo morde:** numa cópia, mete o `1` no `INTERROMPIDO` e mostra que `pnpm qa:teste` sai ≠ 0 (é o
   que o CI vai ver); repõe.
4. Localmente, `pnpm qa:teste` corre em **menos de 1 s** e não instala nada.
5. Gate completo e suíte; zero dependências novas.

**Ficheiros:** `.github/workflows/ci.yml` (só isto).

**O que NÃO fazer:** não mexas nos outros passos, nem nas versões de Node, nem no `smoke.yml` · não
acrescentes o `qa:teste` ao script `test` do `package.json` (o `test` é do turbo e o CI chama-o; misturar
esconde a origem de uma falha) · não commites nem empurres.

### T68 — prova de fecho (QA)

| O que                        | Números                                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| Onde corre                   | job **`gate`** (o único), passo **9 de 11**, entre «Tipos» e «Testes» · ordem `install · db · format · lint · typecheck · qa:teste · test · build` |
| O passo morde                | `1` no `INTERROMPIDO` → **EXIT=1** (`pass 6 · fail 2`); reposto → **EXIT=0**, `8 pass`         |
| Sem base nem browser         | `.env` renomeado e `env -u DATABASE_URL -u DIRECT_URL pnpm qa:teste` → **8 pass (92 ms)**        |
| Tempo                        | **743 ms** com o arranque do pnpm · **300 ms** só o `node --test`                               |
| YAML                         | parse independente: 1 job, 11 passos, nome novo «format · lint · typecheck · **qa** · test · build» |
| Node do CI                   | o comando corre com **Node 22** (`npx node@22 --test "scripts/*.test.mjs"` → 8 pass) — o glob é expandido pelo Node, não pelo shell |
| Fora do repositório          | os **três** scripts copiados para fora, sem `node_modules` → `classificar: function` e **8 pass** (antes: `MODULE_NOT_FOUND: @playwright/test/package.json`) |

**A correção da volta 2, e a prova que a justificou:** `scripts/qa-e2e.mjs` resolvia `@playwright/test/package.json` no **topo do módulo**, por isso o teste de uma função pura só corria com o Playwright instalado. O QA provou-o copiando o script para fora do repositório — o import rebentava. A resolução passou para dentro do `correr()`, e o mesmo teste passa agora **sem `node_modules`**. Sem esta volta, o passo novo no CI funcionava — mas ficava a depender de um pacote que não tem nada a ver com o que testa.

**O nome do job também mentia por omissão:** dizia «format · lint · typecheck · test · build» e passou a correr o invólucro dos e2e sem o dizer. É o mesmo defeito do `MAPA`, num sítio mais pequeno; agora diz `qa`.

**Nota de método do QA:** o PyYAML lê a chave `on:` como `True` (YAML 1.1) — artefacto do parser, não do ficheiro. Fica escrito para ninguém «corrigir» um workflow que está certo.

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
