# T66 — Um valor inválido no URL deixa de derrubar todos os filtros (prova do Dev)

Base `984f757`. O schema do extrato passou a **degradar campo a campo** em vez de rebentar.

## O que mudou, e porquê

`packages/shared/src/schemas/domain/transactions.ts` — cada campo opcional ficou com `.catch(undefined)`
por um helper de três linhas:

```ts
function opcional<T extends z.ZodType>(schema: T) {
  return schema.optional().catch(undefined);
}
```

e o `limit`/`offset` com o mesmo número que a omissão (`catch(50)` / `catch(0)`).

**Custo e alternativas**, porque pediste para saber: são **doze linhas** de declaração (uma por campo),
todas explícitas. As duas mais pequenas não servem: um `.catch` no **objecto** devolve o valor de
reposição para o objecto inteiro — é exactamente o defeito de hoje com outro nome; um `preprocess`
que apague as chaves inválidas volta a validar campo a campo por fora e fica com duas verdades. Um
`forEach` sobre um mapa de campos seria mais curto e esconderia o schema. Ficou a forma explícita.

`apps/web/src/server/transactions.ts` — só o comentário: o `?? { limit, offset }` fica como rede para
quando o que chega nem é um objecto, e o comentário passou a dizer isso (antes dizia que era o guarda).

**Não toquei** no `where`, no `parseAmountFilter`, no `semCategoria` válido, no `valor`/`valorOp`, nem
na normalização de `transacoes/page.tsx` (continua a ser ela que impede lixo de chegar ao URL).

## O antes e o depois, no sítio onde o defeito vive

Sonda sobre o mesmo código que `listTransactions` faz (`safeParse` → se falhar, `{ limit: 50, offset: 0 }`):

| Entrada | Antes | Depois |
|---|---|---|
| `{ semCategoria: 'true', search: 'mercado' }` | `safeParse=false` → **`{"limit":50,"offset":0}`** (filtros todos perdidos) | `safeParse=true` → **`{"search":"mercado","limit":50,"offset":0}`** |
| `{ limit: 'abc', search: 'mercado' }` | `safeParse=false` → `{"limit":50,"offset":0}` | `safeParse=true` → `{"search":"mercado","limit":50,"offset":0}` |
| `{ semCategoria: '1' }` | `safeParse=true` → `{"semCategoria":"1",…}` | igual |

## Os três casos do URL (com dados reais: 60 lançamentos, 3 com «mercado»)

| URL | Total | Linhas na página |
|---|---|---|
| `/transacoes` (sem filtro) | **60** | 25 (tamanho de página) |
| `?search=mercado` | **3** | 3 |
| `?semCategoria=true&search=mercado` | **3** | 3 — **o `search` sobreviveu** |
| `?semCategoria=true` (sozinho) | **60** | 25 — a lista inteira, não os 50 do valor de reposição |
| `?limit=abc&search=mercado` | **3** | 3 — o `limit` caiu sozinho |

Nota honesta: **estes cinco números são iguais antes e depois**. Depois da T64, a página normaliza o
URL (`transacoes/page.tsx` só deixa passar `semCategoria === '1'` e um `limit` válido), por isso o
caminho do URL nunca entregava um valor inválido ao schema. Ficam como regressão — o que muda é o
**chamador cru**, e é aí que a sonda acima mostra a diferença.

## O teste, e o vermelho

`packages/shared/src/schemas/__tests__/transaction-filters.test.ts` — cinco casos novos:

- `semCategoria: 'true'` + `search` → **sucesso**, `search` fica, `semCategoria` cai;
- `semCategoria: 'true'` sozinho → sucesso, `limit` 50;
- `limit: 'abc'` + `search` → sucesso, `limit` 50, `search` fica;
- `kind: 'inventado'` + `status: 'pending'` → sucesso, `kind` cai, `status` fica;
- quatro inválidos ao mesmo tempo → cada um cai, `search` fica.

Um caso da T64 mudou de expectativa, e é uma mudança de contrato deliberada: antes exigia-se que
`semCategoria: '0'`/`'true'` fosse **recusado** (`safeParse` falhava); agora o valor inválido é
**ignorado** (como a página já fazia) e o teste diz porquê no comentário.

```
$ npx vitest run src/schemas/__tests__/transaction-filters.test.ts
 Test Files  1 passed (1)
      Tests  9 passed (9)
```

**O vermelho, por mutação** — com o helper a devolver `schema.optional()` (sem `catch`):

```
     × só o valor `1` vale como filtro; o resto cai sem rebentar o resto
     × `semCategoria` inválido não leva o `search` com ele
     × `semCategoria` inválido e sozinho dá o resto por omissão
     × `kind` inválido não leva o `status` com ele
     × vários inválidos ao mesmo tempo: cai cada um, os válidos ficam
ℹ Tests  5 failed | 4 passed (9)
  AssertionError: expected false to be true
```

Reposto de seguida; o caso do `limit` continuou verde na mutação porque tem `catch` próprio — o que
mostra que cada campo cai por si.

## Gate

`format:check` verde · `lint` 4/4 · `typecheck` 4/4 · `test` **591** (586 + os 5 novos) · `build` 2/2.
Zero dependências novas, zero migrações. Base deixada como estava: 2 utilizadores, 0 `e2e-*`, 0 linhas
`T66`.

## Diff

```
 apps/web/src/server/transactions.ts                    |  9 ++-
 packages/shared/src/schemas/__tests__/transaction-…     | 79 ++++++++++++++++-
 packages/shared/src/schemas/domain/transactions.ts     | 38 +++++----
 3 files changed, 106 insertions(+), 20 deletions(-)
```
