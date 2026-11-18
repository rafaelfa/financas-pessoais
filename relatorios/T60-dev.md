# T60 — A contagem «Faturas por pagar» soma a cadeia inteira (prova do Dev)

Base `3a6a8c6`. Um ficheiro, uma regra: **por cartão, só a última fatura da cadeia conta**.

## O que mudou

`apps/web/src/server/review.ts` — `unpaidInvoices` deixou de ser um `filter` sobre **todas** as
faturas e passou a ser um `filter` sobre a **última fatura de cada cartão** (mapa por `cardId`,
escolhendo a de maior **`closingDate`**, que é a chave da cadeia em `invoiceChain`).

Porquê: o motor transita o que falta pagar para a fatura seguinte (`carriedOverInCents = outstanding`,
`packages/shared/src/finance/invoice.ts:239`), por isso duas faturas do mesmo cartão com valor por
pagar são **uma** dívida. É a regra que o próprio motor usa em `totalsByCard` (`:269`), que devolve
`chain[chain.length - 1].outstandingInCents` como dívida do cartão.

## Critério 1 — os dois números

Cenário: **cartão A** com outubro (60,00 €) e novembro (45,00 € de compras + 60,00 € transitados =
**105,00 €**); **cartão B** com uma única fatura de 70,00 €. Todas fechadas, todas por pagar.

| Medida | Número |
|---|---|
| `/revisao` → cartão «Faturas por pagar» | **2** |
| Faturas `closed` com valor por pagar, lidas da base (SQL: `carriedOver + compras − pago > 0` e `closingDate <= hoje`) | **3** |

É esta a diferença que a tarefa corrige: três faturas, duas dívidas (A = 105,00 €, B = 70,00 €).

## Critério 2 — as duas metades do pagamento

Pagos pelo diálogo da página de cartões (mesma ação da interface, não por SQL):

| Passo | «Faturas por pagar» |
|---|---|
| Antes | **2** |
| Pagar a fatura de **outubro** do cartão A (a última é a de novembro) | **2** — não desce, a dívida continua na de novembro |
| Pagar a fatura de **novembro** do cartão A (a última) | **1** — desce |

## Critério 3 — acessibilidade e layout

`axe` (wcag2a/2aa/21a/21aa/22aa) em `/revisao`: **0** a 1280 e **0** a 360; `scrollWidth` 360 com
`innerWidth` 360. Layout inalterado: não se tocou no cartão nem no texto, só no número. Capturas:
`relatorios/T60-revisao-1280.png`, `T60-revisao-360.png`.

## Gate

`format:check` verde · `lint` 4/4 · `typecheck` 4/4 · `test` **582** · `build` 2/2. Sem morte de
worker. Zero dependências novas, zero migrações.

## Diff

```
apps/web/src/server/review.ts | 19 ++++++++++++++++++-
1 file changed, 19 insertions(+), 1 deletion(-)
```

## Extraí função partilhada? **Não** — e porquê (uma linha)

O que é comum ao calendário é só «a última fatura de cada cartão» (5 linhas), mas os dois sítios leem
coisas diferentes (o calendário precisa de **itens com data**, filtrados por mês e vencimento; aqui é
uma **contagem**), e o módulo onde o helper devia viver (`server/invoices.ts`) não está nos ficheiros
desta tarefa; mais: o calendário escolhe a «última» por **`dueDate`** e aqui escolhi por
**`closingDate`** — alinhar as duas chaves é a próxima alteração a fazer ali, quando `calendar.ts`
puder ser tocado, e nessa altura `lastInvoiceByCard` passa para `server/invoices.ts` e os dois
importam-no.
