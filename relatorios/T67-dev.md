# T67 — O SQL livre saiu dos testes; o cenário do empate ficou (prova do Dev)

Base `d1a9bbd`. `e2e/support/db.ts` deixou de exportar um executor de SQL arbitrário e passou a ter
**fixtures com nome e forma**.

## O `grep`, antes e depois

```
$ grep -rn "executarSqlDoSpec" e2e/
antes:  e2e/41-cadeia-faturas.spec.ts (8 chamadas) · e2e/42-revisao-menores.spec.ts (9 chamadas) · e2e/support/db.ts (definição)
depois: 0
```

A função **desapareceu** do ficheiro (não ficou exportada com outro nome): o `grep` acima conta zero
ocorrências em `e2e/`. As duas specs que a usavam passaram a chamar as fixtures.

## As fixtures, e o que elas **não** permitem

| Fixture | Assinatura (resumo) | Não permite |
|---|---|---|
| `lerContextoDoUtilizador(email)` | → `{ userId, contaId, categoriaDespesaId }` | escolher outra conta, outra categoria ou outro utilizador |
| `criarCartaoDoSpec({ email, nome, fechoDia, vencimentoDia })` | → id do cartão | passar SQL, escolher campos fora dos do produto |
| **`criarFaturaDoSpec({ cartaoId, fecho, vence, totalInCents, estado? })`** | → id da fatura | inventar colunas; o estado só pode ser `OPEN`/`CLOSED`/`PAID` |
| `criarCompraNaFaturaDoSpec({ cartaoId, faturaId, descricao, valorInCents, data })` | — | escolher o sinal (é sempre saída), a conta (vem do cartão) ou o estado |
| `lerFaturasDoCartao(cartaoId)` | → `[{ id, fecho, vence }]` pela ordem da cadeia | qualquer outro `SELECT` |
| `moverFechoDaFatura(faturaId, { fecho, vence })` | — | mudar outro campo da fatura |
| `criarLancamentoDoSpec({ email, descricao, valorInCents, estado, comCategoria? })` | — | escolher a conta, a data, o tipo; `estado` só `PENDING`/`CONFIRMED`/`IGNORED` |
| `contarEstadoDoUtilizador(email)` | → `{ pendentes, semCategoria, contasVencidas }` | outra contagem, outro `where` |
| `criarContaAPagarDoSpec(email, descricao, tipo, valor, vencimento)` | (já existia) | — |

A fixture central é a da fatura: é ela que monta o empate da T61 (duas faturas do mesmo cartão a
vencer no mesmo dia) com os **campos que o produto escreveria** — e o `limparDadosDoSpec`/
`apagarCartoesDoSpec` pelo prefixo continuam a apanhá-la, porque o nome do cartão leva o prefixo.

Custo: `db.ts` +192/−… (as nove fixtures, cada uma com o SQL fechado lá dentro) e as duas specs com
menos código do que tinham — o SQL solto saiu de ambas.

## A spec 41 verde, sem reescrever o cenário

```
$ E2E_BASE_URL=http://localhost:3100 E2E_REUSE_SERVER=1 pnpm test:e2e \
    e2e/41-cadeia-faturas.spec.ts e2e/42-revisao-menores.spec.ts --project=chromium --reporter=line
  [1/6] … 41 › no empate conta a última fatura (105,00 €), a mesma nos dois ecrãs
  [2/6] … 41 › com fevereiro por fechar, os dois dão 0 e o calendário não mostra o cartão
  [3/6] … 41 › axe 0 em /revisao e no calendário, a 1280 e a 360
  [6/6] … 42 › axe 0 nas duas rotas, a 1280 e a 360
  6 passed (22.5s)
```

As asserções são as mesmas: as duas faturas com `vence = ['2026-02-01', '2026-02-01']` e
`fecho = ['2026-01-31', '2026-02-28']`, a Revisão a contar 1 fatura, o calendário de fevereiro com
**105,00 €** e não 60,00 €, e a escolhida a ser a de fevereiro.

## O vermelho continua a existir (mutação, reposta)

Forçando a regra a escolher pela `dueDate` (em `apps/web/src/server/invoices.ts`, cópia temporária,
revertida logo a seguir) a spec 41 fica vermelha **por asserção**, não por timeout:

```
  expect(received).toContain(expected) // indexOf
  Expected substring: "105,00 €"
  Received string:    "11-60,00 €Fatura T61 prova cartãoFatura · Vencida-60,00 €"
  > 115 |     expect(dias[0], 'e é a de fevereiro, com 105,00 €').toContain('105,00 €');
  1 failed · 2 passed (17.8s)
```

Reposto (`closingDate`), reconstruído e verde outra vez (6 passed). O ficheiro de aplicação está como
estava: `git status` só tem os três ficheiros de `e2e/`.

## Volta 2 — três fugas e uma fixture permissiva

1. **Duas compras órfãs por corrida.** As compras chamavam-se `'T61 janeiro'`/`'T61 fevereiro'`, que
   **não casam** com o prefixo `'T61 prova'` do `limparDadosDoSpec`; como `transaction.invoiceId` é
   `SetNull`, sobram dois movimentos sem fatura (e sem categoria) na conta partilhada, a contar no
   cartão «Sem categoria» da Revisão. Corrigido **pôr o `PREFIXO` na descrição** (em vez de apagar por
   `cardId` no `apagarCartoesDoSpec`): a limpeza dos movimentos é do `limparDadosDoSpec`, que já é a
   função que diz removê-los; alargar `apagarCartoesDoSpec` a movimentos punha um helper de cartões a
   apagar dinheiro que o nome não promete.
2. **`moverFechoDaFatura` sem dono.** O `UPDATE` passou a levar
   `AND "userId" = (SELECT id FROM "user" WHERE email = $2)` e a assinatura a receber `email`; se
   nenhuma linha casar, **lança** em vez de não fazer nada em silêncio.
3. **Fixture do `beforeAll` mutada num teste.** O segundo teste mexe no fecho de fevereiro (é o
   cenário) e agora **repõe-no num `finally`**, senão o teste de `axe` a seguir via outro estado e o
   ficheiro passava a depender da ordem.
4. **A fixture aceitava uma compra numa fatura de outro cartão** (achado do QA): passou a ler
   `SELECT "cardId" FROM invoice WHERE id = $1` e a **lançar** se não for o cartão pedido — era
   exatamente a categoria que esta tarefa fecha (teste verde sobre estado impossível).

Ficou também um comentário a separar as fixtures que só a spec 41 usa das genéricas, como sugeriste.

### Provas

```
$ SELECT count(*) FROM "transaction" WHERE description LIKE 'T61%' AND "invoiceId" IS NULL   -- depois de uma corrida
{"transacoesT61":0,"orfaos":0}

$ grep -n 'UPDATE "' -A 3 e2e/support/db.ts
  `UPDATE "invoice" SET "closingDate" = $3::date, "dueDate" = $4::date
    WHERE id = $1 AND "userId" = (SELECT id FROM "user" WHERE email = $2)`,
```

Corridas: **6 passed (24,9 s)** com a 41 e a 42, e **12 passed (42,6 s)** com `--repeat-each=2` (a
ordem deixa de importar; o `beforeAll`/`afterAll` correm por repetição e o estado é reposto).

**Uma escrita antiga continua sem dono, e não a mexi:** `definirStatusDoLancamento` (`db.ts:219`,
usada pela spec 35) faz `UPDATE "transaction" … WHERE id = $1`. O id vem de `idDoLancamento(email, …)`,
que já o resolve pelo email do utilizador — mas o `WHERE` não o repete. Corrigi-la exige mudar a
assinatura **e** duas chamadas na spec 35, que não está nos ficheiros desta tarefa; fica dito.

### Volta 3 — o comentário passou a dizer a verdade

O comentário do `moverFechoDaFatura` dizia «como todas as outras escritas», e não era verdade:
`definirStatusDoLancamento` (spec 35) era a única escrita do ficheiro sem dono no `WHERE` **e** sem
verificação de `rowCount`. Escolhi o mais pequeno — **sem mexer na spec 35**:

1. `definirStatusDoLancamento` ganhou a verificação de `rowCount` e **lança** se não afectar uma linha
   (a assinatura ficou igual; a spec 35 não entra no diff).
2. O comentário passou a «como as outras escritas **desta tarefa**», com uma linha a apontar a exceção
   conhecida e o custo de a fechar (assinatura + duas chamadas da spec 35).

**Custo da opção 3** (pôr o `userId` e mudar a assinatura): dois ficheiros a mais no diff e a suíte da
spec 35 a correr nesta tarefa. Ficou para uma tarefa própria, escrita no comentário.

O `grep` das escritas, agora igual ao comentário:

```
$ grep -n 'UPDATE "' -A 2 e2e/support/db.ts
220:      'UPDATE "transaction" SET status = $2::"TransactionStatus" WHERE id = $1',        ← sem dono (exceção dita)
436:        WHERE id = $1 AND "userId" = (SELECT id FROM "user" WHERE email = $2)`,        ← com dono

$ grep -n "rowCount !==" e2e/support/db.ts
230:    if (result.rowCount !== 1) {   ← definirStatusDoLancamento
440:    if (result.rowCount !== 1) {   ← moverFechoDaFatura
```

Corrida de controlo com as três specs afectadas: **10 passed (1,1 min)** — 35, 41 e 42.

### Nota de ambiente

As primeiras corridas desta volta falharam com `browserContext.close: ENOENT … traces/….trace` e com
«a fatura não é do cartão» — **não era do código**: o QA estava a correr a suíte em paralelo, com o
mesmo `test-results/` (o Playwright limpa-o no arranque) e o mesmo utilizador `e2e-*` (o teardown deles
apaga-o). Esperei que terminasse e corri com `--output=tmp-t67/out` próprio: 6 e 12 verdes.

## Gate

`format:check` verde · `lint` 4/4 · `typecheck` 4/4 · `test` **591** · `build` 2/2. Zero dependências
novas. Base limpa: 2 utilizadores, 0 `e2e-*`, 0 linhas/cartões `T61`.

## Diff

```
 e2e/41-cadeia-faturas.spec.ts  | 159 ++++++++++++++++------------
 e2e/42-revisao-menores.spec.ts |  89 +++++-----------
 e2e/support/db.ts              | 252 +++++++++++++++++++++++++++++++++++++++++---
 3 files changed, 355 insertions(+), 145 deletions(-)
```

Nota de âmbito: a T67 autorizava `db.ts` e a spec 41, mas a spec **42** também chamava o executor —
sem ela o `grep` nunca chegaria a 0. Mudei-a do mesmo modo (só a montagem do cenário), e digo-o aqui
para não ser surpresa no diff.
