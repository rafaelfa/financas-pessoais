# Tarefas — financas-pessoais

Uma tarefa de cada vez. Uma tarefa só fecha com prova do QA.

Contexto obrigatório antes de pegar numa tarefa: `AGENTS.md` e `docs/gestao/MAPA.md`.

| ID  | Tarefa                                                                                                     | Dono   | Estado         | Prova            |
| --- | ---------------------------------------------------------------------------------------------------------- | ------ | -------------- | ---------------- |
| T1  | Repor o install e a formatação: lockfile com `react-hook-form`/`@hookform/resolvers`, 12 ficheiros formatados, `.gitattributes` | Dev    | **fechada** (Dev + QA + Revisor) | `relatorios/T1.md` |
| T2  | Fazer `lint`, `typecheck` e `build` verdes sem mudar comportamento (80 erros de tipo, 51 de lint) | Dev    | **fechada** (QA provou o cancelar em runtime) | `relatorios/T2.md` |
| T3  | Provar os ecrãs novos com e2e: criar, editar, pagar e apagar pela interface, com estado na base | QA | **fechada** (9 testes novos, 2 execuções seguidas, suite 30/33) | `relatorios/T3.md` || T4  | Atualizar `README.md` e `docs/plano/ESTADO-E-HANDOFF.md` para o estado real | Dev | **fechada** (verificado por `curl` e gate re-corrido) | — |

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

| T5  | Pôr a produção a par do `main`: deploy e verificação autenticada nas 14 páginas | Lead   | **fechada** (commit `2f84384`, CI verde, deploy `READY`, 14/14 a 200) | ver `MAPA.md` |

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

| T6  | Variante `success` no `Badge` + token `--success` no `globals.css` para o estado "pago" deixar de sair sem cor | Dev | aberta (visual, depois de T4) | `relatorios/T6.md` |

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

| T7  | Tornar os ecrãs novos funcionais: são server components com `console.log` nos botões — têm de chamar as server actions que já existem | Dev | **fechada** (Dev + QA + Revisor; 2 objeções corrigidas e provadas com base real) | `relatorios/T7.md` |
| T8  | Defeitos de dados da funcionalidade: `accountIds` descartado, cêntimos por vírgula flutuante e valor mostrado em cêntimos num campo «€» | Dev | aberta — junta à T7 num só passo | `relatorios/T8.md` |

## O que a T2 provou de mau (medido, 2026-11-01)

O gate está verde, mas a funcionalidade **não funciona**. Isto é o retrato real, com prova
em `relatorios/T2.md`:

1. **Os botões não fazem nada.** As páginas `contas-pagar-receber` e `consolidacao-contas`
   são *server components* e os handlers são `console.log('Pagar conta:', id)`,
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
componentes cliente, por isso nada reage. As *server actions* já existem e estão
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

| T9  | Correr o e2e contra `next start` (build de produção) em vez de `next dev`: o *overlay* de desenvolvimento interceta cliques | Dev | aberta | `relatorios/T9.md` |
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
— 109 px a mais. **Causa (Revisor, confirmada por eliminação):** `SidebarInset` (`sidebar.tsx:293-298`) é um *flex
item* `w-full flex-1` **sem `min-w-0`**; o `min-width:auto` não o deixa encolher abaixo do `min-content` do
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
  diferentes. **7 strings ficaram de fora e estão na T25** — 4 delas só apareceram na varredura do QA (dois *toasts* «ao salvar»,
  «Não consegui registrar o pagamento», `placeholder="Aluguel"`). **O critério «zero pt-BR» não se cumpriu na T23**; cumpre-se na T25.
- **Escuro:** `--card` `0.235 → 0.26` (fundo `L*6.17`, cartão `L*11.23 → 14.13`). Contraste do texto **14,18:1**, rótulos
  **5,82:1**. Tema claro **inalterado** (fundo `L*98,89`, cartão `L*100`, 17,35:1).
- **Efeito secundário que a nossa mudança criou, e que fechámos na 5.ª ronda:** ao subir o cartão, a separação cartão↔superfícies
  internas caiu de **4,06 → 1,16** níveis de luminosidade; o rodapé da tabela e o *hover* fundiam-se com o cartão. Corrigido
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

**As 7 ocorrências por corrigir** (todas em texto de produto visível, nenhuma em comentário). As três primeiras foram registadas pelo Dev na T23; as quatro seguintes só apareceram na varredura do QA — e duas delas chegam ao utilizador por *toast*, que ninguém vê a ler o código:

| Ficheiro:linha | Hoje | Proposta |
|---|---|---|
| `components/account-group-dialog.tsx:135` | toast «Ocorreu um erro ao **salvar** o grupo» | «…ao guardar o grupo» |
| `components/account-group-dialog.tsx:146` | «Crie um grupo para consolidar várias contas **em uma** visualização.» | «Cria um grupo para consolidares várias contas numa visualização.» |
| `components/account-group-dialog.tsx:148` | `submitLabel = 'Salvar Alterações'` | «Guardar alterações» |
| `components/receivable-payable-dialog.tsx:152` | toast «…ao **salvar** a conta» | «…ao guardar a conta» |
| `components/receivable-payable-dialog.tsx:165` | `submitLabel = 'Salvar Alterações'` | «Guardar alterações» |
| `components/receivable-payable-dialog.tsx:235` | `placeholder="… Aluguel …"` | «… Renda …» (pt-PT; confirmar com o campo vizinho) |
| `server/receivable-payable-actions.ts:252` | «Não consegui **registrar** o pagamento» — chega ao ecrã por `toast({ description: result.error })` | «…registar o pagamento» |

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
não correm risco — `budgetShape`, `goalShape`, `recurrenceShape`, `ruleShape` são *shapes* simples
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
  *overlay* do Next intercetou cliques e deu um falso negativo.
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
| T41 | **O Painel só mostra os KPIs quando há lançamentos** (`hasData`): quem registe bens e dívidas sem movimentos vê o estado vazio e o património existe sem se ver | Dev | aberta (achado da T38) | — |
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
*breakdown*); o filtro de arquivados está nas consultas, como nas categorias; todas as consultas levam
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
`goalMovement.findMany` não tem filtro de data, pelo que o *payload* cresce sem tecto (o motor
descarta depois, mas os dados já viajaram).

## Regras de método que ficaram desta ronda

- **Um teste de largura precisa de conteúdo que force a largura.** Medir um ecrã vazio dá sempre verde — foi o que quase deixou passar o scroll de `/transacoes` (o utilizador do `globalSetup` não tem transações). Se um teste mede layout, os dados que provocam o problema têm de existir no próprio teste.
- **Quando uma varredura de texto encontra uma frase, a lista do padrão está errada.** Corrigir a frase e voltar a correr; cada ronda encontrou mais. O critério de fim é o `grep` dar zero, não a lista de sítios que eu vi a olho.

## Regras

- Cada tarefa tem um critério de aceitação verificável. "Funciona" não é critério.
- Tarefa que cresce a meio: pára, divide, e volta a escrever a lista.
- Tarefa fechada sem prova = tarefa aberta.
