# T61 — A regra «última fatura da cadeia» num sítio só (prova do Dev)

Base `eeacad2`. A regra saiu de dois ficheiros e passou a viver em `server/invoices.ts`, ao lado de
`listInvoices`/`loadInvoiceContext`, escolhida por **`closingDate`**.

## Um só sítio escolhe (critério 1)

Assinatura nova, em `apps/web/src/server/invoices.ts`:

```ts
export function lastInvoiceByCard(
  invoices: readonly InvoiceSummary[],
): readonly InvoiceSummary[]
```

`grep -rn "lastInvoiceByCard" apps/web/src`:

```
apps/web/src/server/invoices.ts:74:export function lastInvoiceByCard(invoices: readonly InvoiceSummary[]): readonly InvoiceSummary[] {
apps/web/src/server/calendar.ts:4:import { lastInvoiceByCard, listInvoices } from '@/server/invoices';
apps/web/src/server/calendar.ts:181: const billableInvoices = lastInvoiceByCard(invoices);
apps/web/src/server/review.ts:4:import { lastInvoiceByCard, listInvoices } from '@/server/invoices';
apps/web/src/server/review.ts:77: const unpaidInvoices = lastInvoiceByCard(invoices).filter(…
```

Implementações da escolha: **2 → 1**. Nenhum dos dois ficheiros volta a comparar faturas à mão (os
dois mapas locais desapareceram: `calendar.ts` −23/+… e `review.ts` −32/+…).

## O caso do empate (critério 2)

Construído por SQL, porque pelo ecrã exigiria um ciclo a fechar a 31 num mês de 31 dias **e** o
vencimento a cair no mesmo dia da fatura seguinte: cartão com `closingDay = 31` e `dueDay = 1`, fatura
de **janeiro** (fecho 31/01, vencimento 01/02, 60,00 € por pagar) e fatura de **fevereiro**
(fecho 28/02, **o mesmo vencimento 01/02**, 45,00 € de compras + 60,00 € transitados = **105,00 €**).

| Momento | Medida | Antes (calendário por `dueDate`, Revisão por `closingDate`) | Depois | Mesmo dia? |
|---|---|---|---|---|
| Fevereiro **fechado** | Calendário, dia 01/02 | **−60,00 €** (a fatura de janeiro) | **−105,00 €** (a de fevereiro) | **sim**, dia 1 |
| Fevereiro **fechado** | «Faturas por pagar» (Revisão) | 1 fatura (a de fevereiro, 105,00 €) | 1 fatura | — |
| Fevereiro **fechado** | «A pagar» do mês | 60,00 € | **105,00 €** | — |
| Fevereiro **`open`** (fecho 28/02/2027) | Calendário, dia 01/02 | 60,00 € (medido pelo Revisor) | **nada** | consequência aceite |
| Fevereiro **`open`** | «Faturas por pagar» | **0** | **0** | igual |

Ou seja: antes, o calendário escolhia **janeiro** no empate (comparava `dueDate` com `>` estrito e
ficava com a primeira da lista) enquanto a Revisão escolhia **fevereiro**; depois, os dois escolhem
fevereiro — a última da cadeia, pela `closingDate` — e o dinheiro mostrado é o mesmo (105,00 €). Com a
última fatura `open`, nenhum dos dois mostra dinheiro: a data de pagamento moveu-se para a frente.

## Nada do que a T54/T55 provou mudou (critério 3)

- As quatro contagens da Revisão continuam a sair do mesmo `getReviewCounts`; só mudou **qual** fatura
  entra na quarta. Medido nesta base: 1 fatura (fevereiro) enquanto a de janeiro também tinha valor
  por pagar — a mesma correção da T60.
- Os três totais do mês continuam a somar os itens dos dias: fevereiro deu 105,00 € / 0,00 € /
  −105,00 € (antes 60,00 € / 0,00 € / −60,00 €, com o valor errado).
- A faixa «em atraso» usa a mesma lista filtrada (`billableInvoices`), sem alteração de regra.
- Regra mantida: **só a última fatura da cadeia conta dinheiro**, agora num sítio só.

## Gate (critério 4)

`format:check` verde · `lint` 4/4 · `typecheck` 4/4 · `test` **582** · `build` 2/2. Sem morte de worker.
Zero dependências novas, zero migrações. O motor de faturas (`packages/shared`) e a ordem de
`listInvoices` não foram tocados.

## Diff

```
apps/web/src/server/calendar.ts  | 23 ++++++-----------------
apps/web/src/server/invoices.ts  | 30 ++++++++++++++++++++++++++++++
apps/web/src/server/review.ts    | 32 +++++++++-----------------------
3 files changed, 45 insertions(+), 40 deletions(-)
```

Base deixada como estava: 2 utilizadores, 0 `e2e-*`.
