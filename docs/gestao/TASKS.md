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

| T5  | Pôr a produção a par do `main`: deploy e depois fumo `smoke.mjs` nas 12 páginas (não precisa de migração — já aplicada) | Lead   | bloqueada (só com aprovação explícita do utilizador) | fumo |

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
| T10 | Investigar 3 e2e de `35-estado-transacoes` que falham: o formulário rápido (`hasText: 'Natureza'`) não aparece | Dev | aberta (pré-existente, não bloqueia T3) | `relatorios/T10.md` |

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
| T18 | O e2e do pagamento conta os movimentos (+1) mas não confere o montante do movimento criado | QA | aberta (junta à T17) | `relatorios/T3.md` |

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

## Regras

- Cada tarefa tem um critério de aceitação verificável. "Funciona" não é critério.
- Tarefa que cresce a meio: pára, divide, e volta a escrever a lista.
- Tarefa fechada sem prova = tarefa aberta.
