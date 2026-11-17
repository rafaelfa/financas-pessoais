# T53 — Ações em massa no extrato (prova do Dev)

Base de desenvolvimento (Neon do `.env`), utilizador próprio `e2e-t53a@exemplo.pt` (apagado no fim),
build de produção em `:3100`. Dados semeados por SQL para ter linhas controladas: **9 lançamentos**
(5 despesas, 2 ganhos, 1 transferência = 2 pernas), **0 liquidados**.

O que ficou escrito: `components/transaction-table.tsx` (seleção, caixas, `Escape`),
`components/transaction-bulk-actions.tsx` (novo), `server/transactions-actions.ts` (`bulkSetSettled`,
`bulkSetCategory`, `bulkDelete`) e `app/(app)/transacoes/page.tsx` — **uma linha**: `key` da tabela
com a vista visível (filtros + `limit` + página), que é o que faz a seleção morrer ao mudar de vista.

## As três ações contra a base real

| Passo | Antes | Depois (medido na base) |
|---|---|---|
| **Marcar efetivada** em 3 (2 despesas + 1 ganho) | 9 lançamentos, 0 liquidados | os 3 com `settled = true`; barra desaparece; «Por liquidar» na página **18 → 12** |
| **Mudar categoria** em 2 despesas → «Alimentação» | 2 sem categoria | as 2 com `categoryId` de «Alimentação» |
| **Seleção mista** (1 despesa + 1 ganho) | — | botão desativado + razão visível; servidor recusa na mesma |
| **Apagar 2** (despesa −50,00 € + ganho +250,00 €) | 9 linhas | diálogo: «Apagar estes 2 lançamentos?» / «2 lançamentos, no total de **+200,00 €**»; cancelar → **9**; confirmar → **7** |
| **Apagar 1 perna de transferência** | grupo com 2 linhas | **0** linhas do grupo; diálogo diz «1 lançamento … −200,00 €» e avisa que as duas pernas são apagadas |
| **Marcar por liquidar** em 1 | `settled = true` | `settled = false`; toast «1 lançamento marcado como por liquidar — deixa de contar no saldo.» |

## Limpar a seleção

| Mudança de vista | Resultado |
|---|---|
| Filtro `kind=expense` com 3 marcados | barra **0**, caixas marcadas **0**, URL `/transacoes?kind=expense` |
| Página 1 → 2 (25 linhas na página, 33 no filtro) | URL `/transacoes?search=T53&page=2`, barra **0**, marcadas **0** |
| `Escape` com 2 marcados | barra **0** |

O mecanismo é um só: `key={buildHref(filters, limit, safePage)}` no `page.tsx`. Mudar a vista
remonta a tabela, logo não há seleção sobrevivente — não é uma guarda repetida em cada consumidor.

## Servidor (pedido direto à ação, com a sessão do utilizador)

| Pedido | Resposta |
|---|---|
| `bulkDelete` com **201** ids | `{ok:false, error:"Podes agir sobre 200 lançamentos de cada vez. Esta seleção tem 201."}` |
| `bulkDelete` com `[id meu, id do utilizador B]` | `{ok:false, error:"Um dos lançamentos escolhidos já não existe ou não é teu. Nada foi alterado."}` — o meu continua na base (5 → 5 linhas) e o de B também (não foi tocado) |

Propriedade e escrita correm na **mesma** `$transaction`: `findMany({ id: { in: ids }, userId })` e, se
`rows.length !== ids.length`, recusa antes de escrever. Teto de 200 validado antes de qualquer consulta,
sobre ids distintos (repetidos não contam duas vezes).

## Acessibilidade a 360 e 1280, com 3 selecionados

| Medida | 1280 | 360 |
|---|---|---|
| `axe` (wcag2a/2aa/21a/21aa/22aa) | **0 violações** | **0 violações** |
| Barra | — | 328 × 194 px, sem transbordo (`scrollWidth` **360**) |
| Alvos da barra | 32 px de altura (denso, como o resto a partir de `sm`) | **44 px** nos cinco |

`aria-live="polite"` numa região **sempre montada** no extrato («Nenhum lançamento selecionado.» →
«1 selecionado» → «3 selecionados»), nome acessível por linha («Selecionar <descrição> <valor> de
<data>», sem o valor quando a privacidade está ativa) e cabeçalho «Selecionar os lançamentos desta
página» — a página, não o filtro.

### Volta de correção (Escape, caixa, anúncio)

**`Escape`.** A primeira versão punha um `onKeyDown` do React na moldura. Os portais do Radix saem do
DOM mas continuam na árvore React, por isso o evento de um diálogo borbulhava até à moldura e limpava
a seleção. O ouvido passou a ser **nativo, no nó da moldura** (`addEventListener('keydown')`): o que
vem de um portal não passa por ali em termos de DOM, e o Radix fecha-o como sempre. Medido com
`relatorios/.qa-t53-desempate/medir.mjs` (o próprio script do QA), seleção antes → depois:

| Caminho | Antes | Depois | Diálogo/menu fechou |
|---|---|---|---|
| A1 `Escape` no `AlertDialog` do apagar em massa | 3 | **3** | sim |
| A2 `Escape` no menu «Mudar categoria» | 3 | **3** | sim |
| A3 `Escape` no diálogo de edição | 2 | **2** | sim |
| A4 `Escape` no `AlertDialog` de apagar individual | 2 | **2** | sim |
| A5 teclado (Enter em «Apagar», Tab, `Escape`) | 3 | **3** | sim |

E `Escape` com o foco **dentro da tabela** continua a limpar (3 → 0, barra desaparece, região anuncia
«Nenhum lançamento selecionado.»).

**Caixa de seleção (volta 2).** A moldura de 44 px da volta anterior era **inerte**: um `div`
à volta não recebe o clique, só ocupa espaço — o clique morria no próprio `div` (não era
`pointer-events`), e só o centro da caixa marcava. O alvo passou a ser o pseudo-elemento que o
primitivo `ui/checkbox.tsx` já usa (`after:-inset-x-3 after:-inset-y-2`, 40×32), alargado com as
**mesmas** utilidades para 14 px de cada lado — `after:-inset-x-3.5 after:-inset-y-3.5` — o que dá
**44×44** em volta dos 16 desenhados, sem tocar no desenho nem noutro ficheiro.

| Medida | 360 | 1280 |
|---|---|---|
| Caixa desenhada | 16 × 16 | 16 × 16 |
| Insets do `::after` | −14 px nos quatro lados | **−8 px na horizontal**, −14 px na vertical |
| Alvo efetivo (caixa + `::after`) | **44 × 44** (x 24→68, y 378→422) | **32 × 44** (x 288→320, y 626→670) |
| Altura da linha | 111 (igual a antes) | 57 (igual a antes) |
| Célula | 52 × 111 | 40 × 57 |

A 1280 a coluna tem 40 px e a caixa 16 centrada: 14 px de cada lado davam 44 de alvo, e os últimos
**6 px caíam já na coluna de datas** (x 320→326) — uma faixa invisível onde um clique selecionava a
linha. Com `sm:after:-inset-x-2` o alvo acaba em **x = 320**, exatamente no bordo da coluna. Provas a
1280: clicar em **x = 323** (sobreposição) a três alturas (631, 648, 666) dá **0 → 0**; a coluna de
datas (x = 350) **0 → 0**; o centro da caixa (304, 705) **0 → 1** e, voltando a medir a posição (a
barra empurra a tabela), **1 → 0**. Folga vertical: **6,5 px** acima e abaixo do alvo.

Cliques a 360, cada um com a geometria medida antes (a barra de ações empurra a tabela quando
aparece, por isso medir uma vez só dava resultados falsos):

| Ponto (centro do alvo = 46, 400) | Antes | Depois | Mesmo ponto outra vez | Diálogo | URL |
|---|---|---|---|---|---|
| Canto superior esquerdo (26, 380) | 0 | **1** | **0** | 0 | `/transacoes` |
| Canto superior direito (66, 380) | 0 | **1** | **0** | 0 | `/transacoes` |
| Canto inferior esquerdo (26, 420) | 0 | **1** | **0** | 0 | `/transacoes` |
| Canto inferior direito (66, 420) | 0 | **1** | **0** | 0 | `/transacoes` |
| Centro da caixa (46, 400) | 0 | **1** | **0** | 0 | `/transacoes` |

Sem duplo-toggle (0 → 1 → 0 no mesmo ponto), sem abrir o diálogo de edição e sem navegar. Vizinhos:
clique na coluna de datas → **0 → 0**; com 3 selecionadas, o menu da linha e o diálogo de edição
abrem e a seleção fica em **3**. A área de 44 px cabe na linha (44 < 57 a 1280, < 111 a 360).

Teclado: foco na caixa (`document.activeElement` = a caixa), `Espaço` → **1**, `Espaço` → **0**.

**Anúncio da primeira seleção.** A região `aria-live` vivia **dentro** da barra, que só existe a
partir de uma seleção — nascia já com texto e a passagem 0 → 1 não era lida. Passou para o extrato,
montada sempre:

| Momento | Texto da região `aria-live` | Barra |
|---|---|---|
| Antes de selecionar | «Nenhum lançamento selecionado.» (nó montado, 1) | 0 |
| 1 marcado | «1 selecionado» | 1 |
| 3 marcados | «3 selecionados» | 1 |

**Duplicação (opinião, uma linha):** `logicalCount` e a família de categoria não são partilháveis
como estão — o cliente parte de `TransactionView` e o servidor de linhas da base, e importar de
`server/transactions-actions.ts` (módulo `'use server'`) traria o módulo do servidor para o bundle;
partilhar obrigaria a um módulo novo, por isso não fiz.

## Achado anterior (fora do âmbito desta tarefa, para o Lead decidir)

`listTransactions` devolve `kind` como o enum do Prisma (`EXPENSE`), sem normalizar
(`server/transactions.ts:138` — o `status` é normalizado logo abaixo, o `kind` não). Consequências
visíveis hoje, sem esta tarefa: as linhas do extrato mostram **«EXPENSE»** em vez de «Gasto», e o
diálogo de edição **esconde o campo Categoria** (`showCategory = kind === 'expense'` é falso para
todos). Não toquei nesse ficheiro (não está na lista). No código desta tarefa a comparação é feita em
minúsculas, por isso a ação de categoria funciona **com as duas formas** e não parte no dia em que a
normalização for feita na origem.

## Gate

`format:check` · `lint` · `typecheck` · `test` (582) · `build` — ver saída colada na resposta.
