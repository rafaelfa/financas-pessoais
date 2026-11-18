# T64 — `semCategoria` dentro do schema de filtros (prova do Dev)

Base `46e32d8`. O filtro deixou de ser uma chave que o `safeParse` descartava em silêncio.

## O tipo escolhido, e porquê (uma linha)

`semCategoria: z.literal('1').optional()` — o valor é **o que a URL leva** (`1`), e o filtro viaja
no URL para os links de paginação, para o `buildHref` e para o chip; guardar o literal evita
converter `'1' ⇄ true` em três sítios, e o schema passa a documentar o contrato exato (só `1`).

## O que mudou

| Ficheiro | Mudança |
|---|---|
| `packages/shared/src/schemas/domain/transactions.ts` | `transactionFiltersSchema` passa a declarar `semCategoria: z.literal('1').optional()`, com comentário a explicar a armadilha |
| `apps/web/src/server/transactions.ts` | `const semCategoria = value.semCategoria === '1'` — lido do **valor já validado**, não do objecto cru (`filters.semCategoria`) |
| `packages/shared/src/schemas/__tests__/transaction-filters.test.ts` (novo) | os quatro testes da armadilha, com o objecto **completo** da página e o controlo por código de erro |

O `where` do filtro **não mudou** (`kind IN (EXPENSE, INCOME)`, `categoryId: null`,
`status ≠ IGNORED`, em AND com os outros) — o cartão da Revisão lê exatamente o mesmo.

## O teste, e o que ele impede

```
$ pnpm --filter @repo/shared exec vitest run src/schemas/__tests__/transaction-filters.test.ts

 Test Files  1 passed (1)
      Tests  4 passed (4)
```

Os quatro casos:

1. `{ semCategoria: '1' }` → `safeParse` **sucesso** e o valor chega a `data.semCategoria`.
2. `{ semCategoria: '0' }` e `{ semCategoria: 'true' }` → **recusados** (o contrato é `1`; não é
   «ignorado em silêncio», é recusado com erro).
3. **A armadilha desarmada**: `transactionFiltersSchema.strict().safeParse({ semCategoria: '1',
   search: 'mercado' })` → **sucesso**. É exatamente o que aconteceria no dia em que alguém tornasse
   o schema estrito «para apanhar erros nos filtros».
4. Controlo: o mesmo clone estrito **recusa** uma chave inventada (`{ filtroInventado: '1' }`) — prova
   que o `strict()` do teste 3 é mesmo estrito e não está a passar por acaso.

**A mutação, para provar que o teste apanha o defeito:** retirando a linha do schema e correndo o
mesmo ficheiro, dá **3 failed | 1 passed** — falham os três que dependem da chave, com
`expected undefined to be '1'`, `expected true to be false` e `expected false to be true`. A chave foi reposta
logo em seguida (o schema tem a linha de novo, uma vez).

### Volta 2 — `valor` e `valorOp` também entram no schema

A armadilha estava desarmada numa chave e armada nas outras duas: a página põe
`valor`/`valorOp` no **mesmo** objecto que vai ao `parse`, e um schema estrito
recusava-as — `unrecognized_keys` — derrubando o `safeParse` inteiro e, com ele, todos os
filtros do extrato. Declaradas como `z.string().optional()`; a semântica do par continua no
`parseAmountFilter`.

Sonda sobre o objecto **completo** que a página constrói (`from`, `to`, `accountId`,
`categoryId`, `kind`, `status`, `search`, `semCategoria`, `valor`, `valorOp`, `limit`,
`offset`), com `transactionFiltersSchema.strict().safeParse(...)`:

| Estado | Saída |
|---|---|
| **Depois** (com `valor`/`valorOp` declarados) | `success: true` |
| **Antes** (sem as duas linhas) | `success: false` · `issues: [{"code":"unrecognized_keys","keys":["valor","valorOp"]}]` |

O teste passou a exercitar exatamente esse objecto completo (antes levava só duas chaves — foi
por isso que o caso B do Revisor escapou) e o controlo passou a asserir o **código**
`unrecognized_keys`, não apenas `success === false`, para não ficar verde por outra causa.
Mutação: sem as duas linhas, o teste do objecto completo fica vermelho
(`expected false to be true`).

Ficou também uma linha em `server/transactions.ts` a dizer que o `value` vem do schema e que um
valor inválido **ainda** derruba todos os filtros — o guarda é a normalização da página; o
comportamento não mudou nesta volta.

## O filtro devolve o mesmo (critério 3)

Cenário com 3 lançamentos sem categoria (2 despesas + 1 ganho), 1 ignorado sem categoria e 1 com
categoria:

| Onde | Número |
|---|---|
| Cartão «Sem categoria» da Revisão | **3** |
| Extrato com `?semCategoria=1` — rodapé | «**3** movimentos no total» |
| Extrato — linhas na tabela | **3** |
| Chip «Sem categoria» na barra de filtros | presente (1) |

Continua a valer a combinação que o `AND` garante: `?semCategoria=1&status=ignored` devolve lista
vazia (a tabela deixa de ser renderizada) — não é preciso confiar no filtro do cliente.

## Gate

`format:check` verde · `lint` 4/4 · `typecheck` 4/4 · `test` **586** (582 + os 4 novos) · `build` 2/2.
Zero dependências novas, zero migrações. A suíte e2e é do QA.

## Diff

```
 apps/web/src/server/transactions.ts                | 17 ++++++++++++++---
 packages/shared/src/schemas/domain/transactions.ts | 18 ++++++++++++++++++
 2 files changed, 32 insertions(+), 3 deletions(-)
 + packages/shared/src/schemas/__tests__/transaction-filters.test.ts (novo, 74 linhas)
```

## Outros filtros fora do schema

Verifiquei os que o extrato usa: `from`, `to`, `accountId`, `categoryId`, `kind`, `status`, `search`,
`limit` e `offset` **estão** todos declarados. Ficam de fora do `transactionFiltersSchema` apenas
`valor`/`valorOp` (o par do filtro por valor), que é validado à parte por `parseAmountFilter`
(`packages/shared/src/finance/amount-filter.ts`) e viaja no URL por precisar das duas metades — é o
mesmo padrão de «lido à mão», mas tem validação própria e testada. **Não o acrescentei ao schema**;
fica escrito para decidires.
