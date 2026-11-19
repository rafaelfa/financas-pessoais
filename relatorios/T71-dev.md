# T71 — `logicalCount` escrito duas vezes (prova do Dev)

Base `5d5e053`. Escritos: `packages/shared/src/finance/selection.ts` (novo),
`packages/shared/src/finance/index.ts` (uma linha de export),
`packages/shared/src/finance/__tests__/selection.test.ts` (novo),
`apps/web/src/components/transaction-bulk-actions.tsx` e
`apps/web/src/server/transactions-actions.ts` (import + remoção da cópia local).
**Nada mais. Zero dependências novas, zero commits.**

## 1 · A regra, num sítio

Os dois corpos eram a mesma conta, e foi isso que o Lead mediu na abertura: `Set` dos
`transferGroupId` não nulos **+** o número de linhas sem grupo. As duas diferenças eram o nome do
parâmetro e o tipo (`TransactionView` no cliente, `BulkRow` no servidor) — e nenhum dos dois corpos
precisa de mais campo nenhum. O módulo recebe por isso a forma mínima:

```ts
/** O único campo que a contagem precisa de cada linha selecionada. */
export interface SelectableRow {
  readonly transferGroupId: string | null;
}

/** Quantas operações a seleção representa: o par de uma transferência conta como uma. */
export function logicalCount(rows: readonly SelectableRow[]): number {
  const groups = new Set(
    rows.flatMap((row) => (row.transferGroupId === null ? [] : [row.transferGroupId])),
  );

  return groups.size + rows.filter((row) => row.transferGroupId === null).length;
}
```

`packages/shared/src/finance/selection.ts` (24 linhas), exportado por
`packages/shared/src/finance/index.ts:16` (`export * from './selection';`), que o `src/index.ts` já
reexporta em `export * from './finance'`. Os dois chamadores passam a receber o tipo por estrutura:
`TransactionView` e `BulkRow` têm `transferGroupId: string | null`, por isso nem é preciso converter
nada — e foi o `typecheck` que o provou, não eu.

Escolhi **módulo novo** em vez de `rows.ts` por uma razão que está escrita no topo do próprio
`rows.ts`: «Conversão de registos persistidos para os tipos do motor». `logicalCount` não converte
nada, conta. Meter lá uma regra de seleção confundia a fronteira com a aritmética, e a fronteira é
justamente a camada que o comentário diz ter «mais testes por linha de código» por outro motivo.

## 2 · Critério 5.1 · os dois `grep`

```
$ git grep -n --untracked "function logicalCount" -- apps/
exit: 1  (1 = 0 resultados)

$ git grep -n --untracked "logicalCount" -- packages/shared/src
packages/shared/src/finance/selection.ts:18:export function logicalCount(rows: readonly SelectableRow[]): number {
packages/shared/src/finance/__tests__/selection.test.ts:3:import { logicalCount, type SelectableRow } from '../selection';
packages/shared/src/finance/__tests__/selection.test.ts:19:describe('logicalCount', () => {
… (as 7 asserções do ficheiro: linhas 21, 25, 29, 33, 38, 42, 46)
```

A definição é a linha 18; o «export» é a própria palavra nessa linha e a linha 16 do índice. Mostro
o índice à parte para o grep não parecer generoso:

```
$ git grep -n --untracked "selection" -- packages/shared/src/finance/index.ts
packages/shared/src/finance/index.ts:16:export * from './selection';
```

E onde os dois lados a usam agora:

```
$ git grep -n --untracked "logicalCount" -- apps/web/src
apps/web/src/components/transaction-bulk-actions.tsx:3:import { logicalCount } from '@repo/shared';
apps/web/src/components/transaction-bulk-actions.tsx:82:  const logical = logicalCount(selected);
apps/web/src/server/transactions-actions.ts:9:  logicalCount,
apps/web/src/server/transactions-actions.ts:818:    return logicalCount(rows);
apps/web/src/server/transactions-actions.ts:875:    return logicalCount(rows);
apps/web/src/server/transactions-actions.ts:897:    return logicalCount(rows);
```

Armadilha que apanhei no primeiro grep: `Get-ChildItem -Recurse apps -Include *.ts,*.tsx | Select-String`
percorre `node_modules`, e o pnpm lá dentro tem **cópias do `@repo/shared`**. Medido: o grep largo de
`logicalCount` em `apps/` devolve **26 linhas, 20 das quais em `node_modules`**; o de
`function logicalCount` devolvia **2** — duas «definições» que não existem no repositório. Com
`git grep` (que respeita o `.gitignore`) os mesmos padrões dão **0** em `function logicalCount`. É a
saída do `git grep` que está colada acima; o comando largo fica registado aqui porque é o erro em que
se cai.

## 3 · Critério 5.2 · o teste novo

`packages/shared/src/finance/__tests__/selection.test.ts`, os seis casos que pediste e um sétimo que
resulta deles (grupos diferentes nunca se somam entre si):

```ts
function linha(transferGroupId: string | null): SelectableRow {
  return { transferGroupId };
}

describe('logicalCount', () => {
  it('conta um par de transferência como uma operação', () => {
    expect(logicalCount([linha('g1'), linha('g1')])).toBe(1);
  });

  it('conta dois pares como duas operações', () => {
    expect(logicalCount([linha('g1'), linha('g1'), linha('g2'), linha('g2')])).toBe(2);
  });

  it('conta três linhas soltas como três', () => {
    expect(logicalCount([linha(null), linha(null), linha(null)])).toBe(3);
  });

  it('mistura: um par e uma solta são duas operações', () => {
    expect(logicalCount([linha('g1'), linha('g1'), linha(null)])).toBe(2);
  });

  it('um grupo com três linhas continua a ser uma operação', () => {
    // Acontece num parcelamento: as pernas de uma transferência partilham grupo.
    expect(logicalCount([linha('g1'), linha('g1'), linha('g1')])).toBe(1);
  });

  it('a seleção vazia é zero, não uma linha fantasma', () => {
    expect(logicalCount([])).toBe(0);
  });

  it('grupos diferentes nunca se somam entre si', () => {
    expect(logicalCount([linha('g1'), linha('g2'), linha(null)])).toBe(3);
  });
});
```

## 4 · Critério 5.3 · a mutação, medida nos dois lados

**Mutação pedida, ao pé da letra** — `groups.size + soltas` trocado por `rows.length`:

```diff
-  return groups.size + rows.filter((row) => row.transferGroupId === null).length;
+  return rows.length; // MUTAÇÃO T71: contar linhas em vez de operações
```

```
$ pnpm --filter @repo/shared test
 ❯ src/finance/__tests__/selection.test.ts (7 tests | 4 failed) 14ms
 FAIL  selection.test.ts > logicalCount > conta um par de transferência como uma operação
AssertionError: expected 2 to be 1 // Object.is equality
 FAIL  selection.test.ts > logicalCount > conta dois pares como duas operações
AssertionError: expected 4 to be 2
 FAIL  selection.test.ts > logicalCount > mistura: um par e uma solta são duas operações
AssertionError: expected 3 to be 2
 FAIL  selection.test.ts > logicalCount > um grupo com três linhas continua a ser uma operação
AssertionError: expected 3 to be 1
```

Vermelho por asserção, em quatro dos sete casos — os outros três (três soltas, vazio, grupos
diferentes) são verdes com esta mutação, porque `rows.length` coincide com a conta certa quando não
há pernas ligadas. Isso é dito aqui em vez de ficar escondido: **a mutação é apanhada pelos casos
que a distinguem**, e são justamente os pares.

**A mesma mutação no lado que conta `affected` exige uma variante que compile.** Com
`return rows.length`, o `const groups` deixa de ser usado e o `tsconfig` da raiz tem
`noUnusedLocals: true` — o `pnpm build` do `webServer` do Playwright rebentava no TypeScript e a
spec 34 morria por erro de compilação, não por asserção. Fiz então a mutação da **mesma classe**
(contar linhas em vez de operações) que mantém as duas variáveis vivas:

```diff
-  return groups.size + rows.filter((row) => row.transferGroupId === null).length;
+  // MUTAÇÃO T71 (b): conta as linhas LIGADAS em vez das soltas — mesmo erro de
+  // classe (linhas no lugar de operações), mas compila com `noUnusedLocals`.
+  return groups.size + rows.filter((row) => row.transferGroupId !== null).length;
```

```
$ pnpm --filter @repo/shared test
 ❯ src/finance/__tests__/selection.test.ts (7 tests | 6 failed) 17ms
AssertionError: expected 3 to be 1
AssertionError: expected 6 to be 2
AssertionError: expected +0 to be 3
AssertionError: expected 3 to be 2
AssertionError: expected 4 to be 1
AssertionError: expected 4 to be 3

$ pnpm typecheck        (compila — a vermelha seguinte é por asserção, não por build partido)
 Tasks:    4 successful, 4 total
```

E a `affected` medida em e2e, com o build em cima desta mutação
(`pnpm exec playwright test 34-acoes-em-massa --output=test-results/t71-vermelha`):

```
x  1 … › apagar uma perna de uma transferência apaga o par e conta 1 lançamento (25.8s)
Error: expect(locator).toContainText(expected) failed
Expected substring: "Apagar este lançamento?"
Received string:    "Apagar estes 2 lançamentos?2 lançamentos, no total de +77,00 €…"
  122 |     await expect(dialogo).toContainText('Apagar este lançamento?');
1 failed · 4 passed (1.5m)
```

É exatamente a regra: duas linhas de um grupo deixaram de ser **uma** operação e o diálogo passou a
prometer apagar dois. Reposição feita, e o verde está no ponto seguinte.

Nota de método, porque me custou um ciclo: a primeira tentativa desta corrida vermelha foi
interrompida por mim — pipei a saída do Playwright com `Select-Object -First 26`, e o PowerShell ao
satisfazer o `-First` **mata o canal** e levou o `next build` do `webServer` atrás (não havia
`test-results/t71-vermelha/.last-run.json` para prová-lo). A saída colada acima é da re-execução
com o log para ficheiro (`*> …log`) e depois lido; esse erro foi meu, não do código.

## 5 · Critério 5.4 · gate e spec 34

Gate com o código reposto:

```
$ pnpm format:check   All matched files use Prettier code style!
$ pnpm lint           Tasks: 4 successful, 4 total
$ pnpm typecheck      Tasks: 4 successful, 4 total
$ pnpm test           Test Files 34 passed (34) · Tests 598 passed (598)
$ pnpm build          Tasks: 2 successful, 2 total
```

**598 = 591 + os meus 7**, com 34 ficheiros em vez de 33 — nenhum teste existente foi tocado
(`git status --porcelain` não mostra ficheiros de teste modificados; o único `.test.ts` que apareceu
é o novo).

Spec 34, sem a tocar, no código certo:

```
$ pnpm exec playwright test 34-acoes-em-massa --output=test-results/t71-verde --reporter=list
  ok 1 … apagar uma perna de uma transferência apaga o par e conta 1 lançamento (6.6s)
  ok 2 … mudar de página, de filtro ou de tamanho limpa a seleção (5.0s)
  ok 3 … o servidor recusa 201 ids e um id alheio sem alterar as linhas válidas (7.9s)
  ok 4 … marcar efetivada duas vezes não muda nada nem dá erro (2.9s)
  ok 5 … três selecionados: axe 0, nomes, alvos de 44 px, Escape e contagem anunciada (6.2s)
  5 passed (38.5s)
exit: 0
```

Não corri a suíte completa: a pedido do Lead nas voltas anteriores, a suíte é trabalho do QA, e o
criterio 5.4 desta tarefa pede a 34. Máquina verificada antes das corridas de browser: às 16:25:21
`netstat` sem listeners em 3000 e nenhum processo `node` com `playwright`/`next` na linha de comando;
de novo às 16:26:47, `porta 3000: 0`. A corrida verde seguiu-se ao meu `pnpm build`, com a porta já
verificada livre e sem servidor meu em pé (o `webServer` do Playwright levanta e deita o dele).

## 6 · Critério 5.5 · zero dependências e zero `apps/` no `shared`

```
$ git grep -n --untracked -E "^(import|export) .*from '(@/|@repo/web|@repo/db)" -- packages/shared/src
exit: 1  (0 resultados)

$ Select-String -Path packages/shared/src/finance/selection.ts -Pattern "^import"
(sem linha de import = zero dependências, nem de apps/ nem de pacotes)
```

`selection.ts` não importa **nada**: é a função mais pequena do pacote a não precisar de tipos de
armazenamento. O `git diff --name-only` não tem `package.json` nem `pnpm-lock.yaml`, por isso não há
dependência nova nem lockfile a mexer. (Cuidado com o `grep` largo de `apps` em
`packages/shared/src`: apanha sete **prosas** de comentários que falam de `apps/web`, como em
`import/__tests__/import-confirm.test.ts:11` — nenhuma é um import; o padrão acima é que responde à
pergunta.)

## 7 · O que ficou de fora, de propósito

- **`categoryFamily` / `selectionFamily`**: as duas famílias de categoria não foram unificadas, como
  disseste. Medido antes de escrever: o cliente devolve `'expense' | 'income' | 'other' | 'mixed'`
  sobre `kind.toLowerCase()` (`transaction-bulk-actions.tsx:47-55`) e o servidor devolve
  `'expense' | 'income' | null` sobre o enum (`transactions-actions.ts:706-711`). Não é a mesma
  função com nomes diferentes, e unificá-la mudaria o que a barra mostra.
- **A origem do `affected` do toast** (ponto 3.2 do relatório NAO-IMPLEMENTADO): não mudei uma
  vírgula na semântica do `affected`; só passei a contagem a vir de um sítio. As três chamadas que o
  devolvem (818, 875, 897) continuam a chamar a mesma função com o mesmo argumento.
- **Nenhum teste existente alterado**, nada de refactor à volta: o diff dos dois ficheiros de `app`
  é só o import + a remoção da função local (12 e 10 linhas, respetivamente).

## 8 · Diff

```
$ git diff --stat -- apps/web/src/components/transaction-bulk-actions.tsx apps/web/src/server/transactions-actions.ts packages/shared/src/finance/index.ts
 apps/web/src/components/transaction-bulk-actions.tsx | 12 +-----------
 apps/web/src/server/transactions-actions.ts          | 10 +---------
 packages/shared/src/finance/index.ts                 |  1 +
 3 files changed, 3 insertions(+), 20 deletions(-)

$ git status --porcelain   (sem os png do QA)
 M apps/web/next-env.d.ts
 M apps/web/src/components/transaction-bulk-actions.tsx
 M apps/web/src/server/transactions-actions.ts
 M docs/gestao/TASKS.md
 M packages/shared/src/finance/index.ts
?? packages/shared/src/finance/__tests__/selection.test.ts
?? packages/shared/src/finance/selection.ts
```

`3 inserções / 20 remoções` nos três ficheiros seguidos — é a forma que uma deduplicação tem de
ter. Novos: `selection.ts` 24 linhas, `selection.test.ts` 48 linhas.

O `git diff --stat` completo, no fim, com as duas linhas que **não** são minhas:

```
$ git diff --stat
 apps/web/next-env.d.ts                               |  4 ++--
 apps/web/src/components/transaction-bulk-actions.tsx | 12 +-----------
 apps/web/src/server/transactions-actions.ts          | 10 +---------
 docs/gestao/TASKS.md                                 |  2 +-
 packages/shared/src/finance/index.ts                 |  1 +
 5 files changed, 6 insertions(+), 23 deletions(-)
```

`apps/web/next-env.d.ts` foi reescrito pelos `next build` das duas corridas de browser (a armadilha 2
do `MAPA.md`); `docs/gestao/TASKS.md` é teu e mudou outra vez enquanto eu trabalhava (passou de +58
para 2 linhas no diff — não lhe toquei). E a confirmação de que o `.gitignore` da T70 está a fazer
efeito: com duas corridas de browser na árvore, o `format:check` no fim volta a dizer

```
$ pnpm format:check
Checking formatting...
All matched files use Prettier code style!
exit: 0
```
