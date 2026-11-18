# T63 — Três menores de acessibilidade e higiene (prova do Dev)

Base `7931156`. Dois ficheiros, três correções, nenhum texto visível mudado.

## 1. O número lido duas vezes no cartão da Revisão

`app/(app)/revisao/page.tsx` — o `<span>` com o número grande passou a `aria-hidden`: a frase ao
lado já o diz («3 lançamentos por confirmar»), por isso escondê-lo do leitor de ecrã tira a repetição
e **não mexe no que se vê**.

Nome lido do DOM (`ariaSnapshot` do Playwright, não captura):

| Antes | Depois |
|---|---|
| `link "Por confirmar 3 3 lançamentos por confirmar Lançamentos que ainda não foram confirmados nem ignorados. Resolver"` | `link "Por confirmar 3 lançamentos por confirmar Lançamentos que ainda não foram confirmados nem ignorados. Resolver"` |

A repetição só aparecia com **mais de um** item (com 1, a frase é «1 lançamento por confirmar» e o
número não se repete) — a semente foi feita com 3 pendentes de propósito.

### Volta 2 — o caso de **um** item

O `aria-hidden` no número grande estava certo para 3 («3 3 lançamentos» → «3 lançamentos»), mas
partia o caso de **1**: o `countLabel` devolve «lançamento por confirmar», **sem numeral**, e o nome
acessível ficava «Por confirmar lançamento por confirmar …» — nem número nem português. Corrigido
com um `sr-only` só nesse ramo:

```tsx
{count === 1 ? <span className="sr-only">{count} </span> : null}
{count > 0 ? countLabel(card, count) : card.empty}
```

Os três casos, lidos do DOM (`ariaSnapshot`), com uma semente de 1 pendente, 3 sem categoria e 0 nos
outros dois:

| Contagem | Nome acessível da ligação | Vezes que o número aparece |
|---|---|---|
| **1** | `Por confirmar **1** lançamento por confirmar Lançamentos que ainda não foram confirmados nem ignorados. Resolver` | **1** |
| **3** | `Sem categoria **3** lançamentos sem categoria Gastos e ganhos sem categoria — … Resolver` | **1** |
| **0** | `Contas vencidas Nada vencido Contas a pagar ou a receber cujo vencimento já passou. Ver` | 0 (e é o correto) |

Texto visível inalterado (o `sr-only` não se vê e o número grande continua a ser o que está à vista).
`axe` em `/revisao` depois desta volta: **0**.

## 2. `ReviewCard.done` — quatro strings sem leitor

Removido o campo do `interface ReviewCard` e as quatro entradas (`'Tudo confirmado'`,
`'Tudo classificado'`, `'Nada vencido'`, `'Nenhuma fatura por pagar'`).

```
$ grep -n "done" "apps/web/src/app/(app)/revisao/page.tsx"
(sem resultados)
```

O comportamento do cartão não mudou: o estado zero continua a usar `empty`, que sempre foi o campo
lido.

## 3. O fuso do `isOverdue` — a página e a Revisão a concordarem

`components/receivable-payable-list.tsx` — `isOverdue` deixou de comparar meias-noites locais do
browser e passou a comparar **datas de calendário** com o hoje de **Lisboa**
(`todayInLisbon()`, o que `lib/today.ts` já tinha — nenhum helper novo):

```ts
const isOverdue = (dueDate: Date | string) => {
  const due = typeof dueDate === 'string' ? dueDate.slice(0, 10) : dueDate.toISOString().slice(0, 10);
  return due < todayInLisbon();
};
```

Cenário: duas contas a pagar, uma que **vence hoje** (18/11/2026 em Lisboa) e uma que venceu ontem;
o contexto do browser foi criado com `timezoneId` forçado.

| Fuso do browser | Antes — «Vencida» na página | Antes — «Contas vencidas» na Revisão | Depois — página | Depois — Revisão |
|---|---|---|---|---|
| `Europe/Lisbon` | 1 | 1 | **1** | **1** |
| `America/Sao_Paulo` (UTC−3) | **2** (a conta que vence hoje aparecia vencida) | **1** | **1** | **1** |

A divergência era real e reproduz-se: com o browser a oeste de UTC, `new Date('2026-11-18')` é a
meia-noite UTC e, convertida para a meia-noite local, cai no dia 17 — a conta que vence hoje aparecia
como vencida na página, enquanto a Revisão (que sempre usou Lisboa) não a contava. Agora as duas
respondem o mesmo, com qualquer fuso.

## `axe`

| Rota | 1280 | 360 |
|---|---|---|
| `/revisao` | **0 violações** | **0 violações** |
| `/contas-pagar-receber` | **0 violações** | **0 violações** |

`scrollWidth` = 1280 e 360, respetivamente (sem transbordo).

## Gate

`format:check` verde · `lint` 4/4 · `typecheck` 4/4 · `test` **582** · `build` 2/2. A suíte e2e é do
QA. Zero dependências novas.

## Diff

```
apps/web/src/app/(app)/revisao/page.tsx             | 23 ++++++++++++++++------
apps/web/src/components/receivable-payable-list.tsx | 17 ++++++++++++-----
2 files changed, 29 insertions(+), 11 deletions(-)
```

Base deixada como estava: 2 utilizadores, 0 `e2e-*`, 0 linhas `T63`.
