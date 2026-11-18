# T54 — Ecrã de Revisão: quatro contagens e um salto (prova do Dev)

Base `43033a7`. Página nova `/revisao` que **só conta e salta**; o filtro `semCategoria=1` no
extrato; o bloco «Por arrumar» no Painel; a paleta a 16.

## Decisões (duas, e a segunda é uma correção ao contrato)

1. **As consultas vivem em `server/review.ts`** (novo), não em `server/transactions.ts`: são lidas
   por **dois** sítios (`/revisao` e o Painel), e `transactions.ts` já tem o extrato inteiro.
2. **«Contas vencidas» não é `ReceivablePayable.status = OVERDUE`.** O contrato diz isso, mas o
   estado `OVERDUE` **nunca é gravado** em lado nenhum da aplicação: a página de contas a
   pagar/receber marca «Vencida» com `status === 'OPEN' && dueDate < hoje`
   (`receivable-payable-list.tsx:140`). Contando o estado cru o cartão diria **0 para sempre** e o
   critério «resolver uma conta faz a contagem descer» era impossível. Contei como a página conta,
   e a sonda da base mostra a diferença: `status='OVERDUE'` → **1** linha (criada por mim à mão para
   provar isto), `status='OPEN' AND dueDate < hoje` → **2** — que é o que a página mostra.
   Se preferires a leitura literal, é uma linha em `server/review.ts` e o cartão fica morto.
   («Faturas por pagar» tem o mesmo problema às avessas: o estado da fatura é **derivado** em
   `packages/shared/src/finance/invoice.ts`, por isso leio `listInvoices()` — a mesma fonte da
   página de cartões — e não a coluna `Invoice.status`.)

## Volta 2 — fatura fechada de 0 € (DEVE do Revisor)

`server/review.ts` passou a pedir `status === 'closed' **e** outstandingInCents > 0`. Sem a segunda
condição, uma fatura cujo ciclo ficou sem compras sai `closed` com `outstandingInCents: 0` — o
`invoiceChain` só a marca `paid` quando há total e está tudo pago — e ficava a contar para sempre,
com o botão «Paga» **desativado** em `/cartoes`.

Caso montado pelo caminho normal da aplicação (ações do próprio servidor, sem SQL a inventar faturas):
cartão com fecho ao dia 5; compra a crédito de **45,00 €** a **15/10/2026**; depois a compra é
apagada pela ação de apagar lançamentos.

| Passo | Fatura na base (`compras` = soma das transações) | «Faturas por pagar» |
|---|---|---|
| Compra a crédito de 45,00 € (15/10) → fatura fecha 05/11/2026 | 1 fatura, compras **4500**, `closed` | **1** |
| Compra apagada → a fatura **fica** | 1 fatura, compras **0**, `closed`, `outstanding 0` | **0** ← o DEVE |
| `/cartoes` com essa fatura | linha «05/11/26 · 0,00 € · **Fechada**» e o botão **«Paga» `disabled`** | — |
| Nova compra de 78,00 € na mesma fatura | compras **7800**, `closed`, `outstanding 7800` | **1** |

O total do topo acompanha: 1 → 0 → 1 (as outras três contagens estavam a zero neste utilizador).
Nota de leitura: a coluna `invoice.totalAmountInCents` fica no valor antigo (é cache); o estado e o
valor por pagar são derivados das transações, que é o que a página de cartões mostra.

## As quatro contagens, lidas da base

Comando (o mesmo `where` do código, em SQL direto):

```
SELECT count(*) ... FROM "transaction" WHERE "userId"=$1 AND status='PENDING'
SELECT count(*) ... FROM "transaction" WHERE "userId"=$1 AND kind IN ('EXPENSE','INCOME')
                   AND "categoryId" IS NULL AND status <> 'IGNORED'
SELECT count(*) ... FROM receivable_payable WHERE "userId"=$1 AND status='OPEN' AND "dueDate" < CURRENT_DATE
-- faturas: listInvoices() com status derivado 'closed'
```

| Cartão | SQL / fonte | Na página |
|---|---|---|
| Por confirmar | 3 | **3** |
| Sem categoria | 6 | **6** |
| Contas vencidas | 2 (`OPEN` + vencida) · 1 se fosse o estado cru | **2** |
| Faturas por pagar | 2 (`listInvoices` → `closed`) | **2** |
| **Total no topo** | 3+6+2+2 | **13** — «13 coisas por arrumar — a soma dos quatro cartões abaixo.» |

## Resolver um de cada tipo (sem recarregar a página)

Cada passo foi feito no ecrã de origem e depois **navegando pelo cartão do Painel** (navegação do
cliente, sem `reload`):

| Passo | Por confirmar | Sem categoria | Vencidas | Faturas | Total |
|---|---|---|---|---|---|
| Inicial | 3 | 6 | 2 | 2 | 13 |
| Confirmar um lançamento (`/transacoes?status=pending` → menu «Confirmar») | **2** | 6 | 2 | 2 | 12 |
| Dar categoria a um (`/transacoes?semCategoria=1` → «Editar» → Categoria) | 2 | **5** | 2 | 2 | 11 |
| Pagar uma conta vencida (`/contas-pagar-receber` → «Pagar/Receber») | 2 | 5 | **1** | 2 | 10 |
| Pagar uma fatura fechada (`/cartoes` → «Pagar a fatura de …») | 2 | 5 | 1 | **1** | 9 |

## O salto do extrato e a mesma verdade nos dois sítios

`/transacoes?semCategoria=1` (chip «Sem categoria» presente, uma vez):

| O que | Valor |
|---|---|
| Rodapé do extrato | «**6** movimentos no total» |
| Cartão «Sem categoria» | **6** |
| Linhas na página | 6 |
| Depois de recarregar | URL com `?semCategoria=1`, chip presente, total **6** |
| Depois de fechar o chip | `/transacoes`, total **12** (lista completa) |

O filtro vive na URL como os outros: `page.tsx` lê `semCategoria === '1'`, `buildHref` volta a
escrevê-lo, e `listTransactions` aplica-o como condição **em AND** (`kind IN (EXPENSE, INCOME)`,
`categoryId: null`, `status ≠ IGNORED`), para que juntar `status=ignored` a este filtro dê zero em
vez de um número que contradiz o cartão.

## Portas, paleta e barra lateral

| Onde | Medido |
|---|---|
| Painel, bloco «Por arrumar» | presente; «13 coisas por arrumar · 3 por confirmar · 6 sem categoria · 2 vencidas · 2 faturas por pagar» + ligação «Ver a revisão» |
| Paleta (`Ctrl+K`) | **16** itens, com «Revisão» |
| Barra lateral | **8 destinos** nos três grupos + «Definições» no rodapé do utilizador (9 ligações no total, nenhuma delas `/revisao`) |

## Acessibilidade

| Medida | 1280 | 360 |
|---|---|---|
| `axe` (wcag2a/2aa/21a/21aa/22aa) | **0 violações** | **0 violações** |
| `scrollWidth` / `innerWidth` | 1280 / 1280 | 360 / 360 |
| Altura de cada cartão-ligação | 224 / 224 / 204 / 204 | **216** nos quatro (≥ 44) |

Nome acessível de cada cartão inclui o número, ex.: «Por confirmar **3** 3 lançamentos por
confirmar … Resolver». Ordem de `Tab` a partir do primeiro cartão: Por confirmar → Sem categoria →
Contas vencidas → Faturas por pagar, igual à ordem visual. Estado zero usa «Nada por confirmar» em
vez de um `0` (o `CheckCircle` substitui o número).

Capturas: `relatorios/T54-revisao-1280.png`, `T54-revisao-360.png`, `T54-painel-bloco.png`,
`T54-paleta.png`.

## Gate

`format:check` verde · `lint` 4/4 · `typecheck` 4/4 · `test` **582** · `build` 2/2. Sem morte de
worker. Base deixada como estava: 2 utilizadores, 0 `e2e-*`, 0 linhas `T54 %`, 0 contas e 0 cartões
`T54`.

## Ficheiros

| Ficheiro | Linhas |
|---|---|
| `apps/web/src/server/review.ts` (novo) | 76 |
| `apps/web/src/app/(app)/revisao/page.tsx` (novo) | 158 |
| `apps/web/src/lib/nav.ts` | +8 |
| `apps/web/src/app/(app)/page.tsx` | +35 |
| `apps/web/src/server/transactions.ts` | +18 |
| `apps/web/src/app/(app)/transacoes/page.tsx` | +3 |
| `apps/web/src/components/transaction-filters.tsx` | +12 |

Zero dependências novas, zero migrações, nenhuma rota existente mudou de endereço. A spec da
paleta (16/«Revisão») e a spec nova que fica vermelha quando o cartão diverge do extrato são do QA.
