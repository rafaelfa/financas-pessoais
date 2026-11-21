# T84 — QA: painel de dia do calendário

Data: 2026-11-21 · Base: `main` @ `57d0985` + T84 na árvore (não commitada)
Âmbito verificado: `calendario/page.tsx`, `calendar-day-dialog.tsx` (novo),
`transaction-quick-add.tsx` (+5/−1), `server/calendar.ts` (+37/−2), `e2e/39` e `e2e/41`.
Ambiente: Windows (Git Bash) · Node v24.21.0 · Next.js 16.4.6 · Playwright 1.64.0 ·
`pnpm --filter @repo/web start` na **porta 3000** · `.next/BUILD_ID` = `V3hhrAHcvKPI4Knmhe1twC`
(o mesmo que o Dev mediu). Conta usada nas medições: a **demo** (`demo@financas-pessoais.pt`).

**Veredicto global: PASS** nas alíneas a–d e f–h; alínea e **passa no critério** mas com um
**achado de alvo de toque** para o Lead decidir (não bloqueia o PASS). Zero alterações em `apps/`.

---

## a) Os três totais não mexeram — PASS

Cenário: 18 contas a pagar temporárias (`T84 QA item 1..18`) em **2026-12-10**, criadas por SQL na
base de desenvolvimento com o prefixo `T84 QA`; soma 414,27 €.

| Momento | A pagar | A receber | Saldo previsto |
| --- | --- | --- | --- |
| Antes de criar os 18 itens (dados originais de dezembro) | **750,00 €** | **1850,00 €** | **+1100,00 €** |
| Com os 18 itens temporários | 1164,27 € | 1850,00 € | +685,73 € |
| Depois de lançar 12,34 € pelo painel (dia 10) | **1164,27 €** | **1850,00 €** | **+685,73 €** |
| Depois de apagar os 18 itens e o lançamento | **750,00 €** | **1850,00 €** | **+1100,00 €** |

Leitura do DOM: `section[aria-label="Totais do mês"] > div` (o mesmo seletor do spec 39).
O lançamento é `settled: true`, portanto cai em `settledItems` e não em `items` — os três totais e o
**saldo do dia** (`-414,27 €`, igual antes e depois) ficam exatamente iguais:

```
depoisDoSubmit390.descricao = "18 itens por liquidar · 1 já liquidado · saldo -414,27 €"
grupos = [ {nome:"Por liquidar", itens:18}, {nome:"Já liquidado", itens:1, labels:["T84 QA lançamento"]} ]
```

O item novo aparece **só** em «Já liquidado»; «Por liquidar» continua com 18.
Ficheiro: `relatorios/.qa-t84/lancamento.json`.

## b) A data do lançamento é o dia X, não hoje — PASS

Lançado pelo painel do dia **10/12/2026** (formulário com `initialDate`, data mostrada `10/12/2026`)
e lido da base pelo id:

```
{"id":"78a3c4a8-d883-4d86-80ce-2ea97a0af2bf","description":"T84 QA lançamento",
 "amountInCents":-1234,"dia":"2026-12-10","settled":true,"status":"CONFIRMED"}
```

Apagado no fim: `apagados: contas=18 lancamentos=1 · restantes={"contas":0,"lancamentos":0}`.
Depois da limpeza, os totais de dezembro voltaram a 750,00 / 1850,00 / +1100,00 e o dia 10 voltou a
não ter itens (grelha com 2 dias accionáveis: 5 e 8).

## c) Os quatro estados, 390×844 e 1440×900, dois temas — PASS

Dia medido: **10 de dezembro**, com **18 por liquidar** (e, depois do lançamento, **1 já liquidado**).

| Estado | 390×844 | 1440×900 |
| --- | --- | --- |
| **Dia** — `DialogContent` | `x16 · y0 · 358×844` | `x496 · y0 · 448×900` |
| corpo (rolável) | `scrollHeight 1117 / clientHeight 687` → **rola** | `1117 / 743` → **rola** |
| `DialogFooter` | `y 779–844` → **visível** | `y 835–900` → **visível** |
| «Lançar neste dia» | `y 796–828` → inteiro | `y 852–884` → inteiro |
| **A lançar** — `DialogContent` | `358×801,3`, `y 21,4` | `448×595,8`, `y 152,1` |
| único scroller | `777 / 777` → **zero scroll** | `572 / 572` → **zero scroll** |
| botão «Lançar» | `y 750,6–794,6` (h 44) → **inteiro** | `y 687,9–719,9` → **inteiro** |
| **Erro** | campo com `aria-invalid="true"`, `aria-describedby="lancamento-valor-erro"`, alvo `role="alert"` «Escreve o valor.», **0 toasts** | mesmo componente, captura `estado-erro-1440-*.png` |
| **Dia vazio** | não alcançável pela interface (ver abaixo) | 29 de 32 células sem controlo |

`document.documentElement.scrollWidth` = 390 (390×844) e 1440 (1440×900): **sem overflow**.

**Rodapé fixo com a lista rolada** (prova própria): com o corpo em `scrollTop 430` (fim),
rodapé `top 779 · bottom 844`, visível, botão inteiro — o scroll fica no corpo e não engole o rodapé.

**Dia vazio:** a grelha só desenha controlo nos dias com `items.length > 0` — 3 controlos em 32
células (5, 8, 10), **29 células sem `<button>`**; `[tabindex]` na grelha = **0**. Clicar no centro
de uma célula vazia (dia 11, 158,9×194,8) → **0 diálogos**. O parágrafo do estado vazio existe no
corpo do diálogo (`calendar-day-dialog.tsx`), mas não há gatilho na interface: só é alcançável por
código, como o critério previa. **Confirmado e dito.**

Capturas novas (minhas, não as do Dev), 19 ficheiros em `relatorios/.qa-t84/`:
`estado-dia-{390,1440}-{light,dark}.png`, `estado-lancar-*`, `estado-erro-*`, `lancado-*`.

## d) Acessibilidade — PASS

- Controlo do dia: `button[aria-haspopup="dialog"]`, nome acessível
  `"quinta-feira, 10 de dezembro: 18 itens, saldo -414,27 €. Abrir o dia"` (data + itens + saldo).
- Dias vazios: sem controlo e sem `tabindex` (ver c) → **fora da ordem de `Tab`**.
- Nome do diálogo por estado: **dia** → `"quinta-feira, 10 de dezembro"` (título visível);
  **a lançar** → `"Lançar em quinta-feira, 10 de dezembro"` (título `sr-only`, `DialogHeader className="sr-only"`).
- Erro de validação: `aria-invalid="true"` no `<input>` do Valor,
  `aria-describedby="lancamento-valor-erro"` → elemento com `role="alert"` e texto «Escreve o valor.»,
  dentro do diálogo; **0 `[data-sonner-toast]`**. Não é toast.

## e) Alvo de toque — PASS no critério, com ACHADO registado

A 1440×900, dia 11 (vazio, para medir a célula): `li` **158,9 × 194,8**; dia 10:
célula **158,9 × 194,8**, `<button>` **144,9 × 44** (`min-height: 44px`), proporção de altura
**0,23** (23 % da célula). A largura do botão é a da célula menos o `p-1.5`.

**ACHADO (UX, para o Lead decidir; não é falha do critério 5).** A zona accionável é a **faixa
superior** da célula (número do dia + contagem), 144,9×44; os ~77 % restantes da célula não abrem
nada — excepto as ligações dos itens. O botão não tem affordance visual própria (sem sublinhado,
sem chevron, sem `hover` além da cor herdada), portanto a célula *parece* toda clicável e só o topo
o é. Rect na mão: célula `158,9×194,8` vs botão `144,9×44`. O critério 5 («passa a controlo com
`aria-haspopup="dialog"` e nome acessível») está cumprido; o que fica em aberto é se a **área**
deve ser a célula inteira. Deixo a decisão ao Lead; não alterei nada.

## f) Os quatro specs re-apontados, sem enfraquecer — PASS

`134 passed / 4 failed` → **10 passed** nos dois ficheiros:

```
$ pnpm test:e2e e2e/39-calendario.spec.ts e2e/41-cadeia-faturas.spec.ts --reporter=list
  ok  1 … 39-calendario.spec.ts:88  os itens estão no dia certo, com origem, e os totais batem
  ok  5 … 39-calendario.spec.ts:201 axe 0 e teclado: dias alcançáveis, vencido dito por palavra
  ok  7 … 39-calendario.spec.ts:276 a cadeia do cartão conta uma vez: a última fatura nos dias…
  ok  8 … 41-cadeia-faturas.spec.ts:122 no empate conta a última fatura (105,00 €), a mesma nos dois ecrãs
  …
[e2e] limpeza: 1 utilizador(es) de teste apagado(s); 0 restante(s).
  10 passed (41.3s)
exit=0
```

O que mudou (só o âmbito do seletor, não a asserção):

| Antes | Depois |
| --- | --- |
| `section[aria-label="Grelha do mês"] [role="group"]` | `section[aria-label="Grelha do mês"] li:has(button[aria-haspopup="dialog"])` |
| `expect(dias.first()).toHaveAttribute('tabindex','0')` + `focus()` | `expect(dias.first()).toHaveAttribute('aria-haspopup','dialog')` + `focus()`; e a mais: 29 células sem controlo, `[tabindex]` = 0 |
| filtro de texto `includes('Fatura')` sobre `[role=group]` | o mesmo filtro sobre o `li` do controlo do dia |

Nenhuma asserção foi apagada ou alargada a `body`; o nome acessível (data, itens, saldo) continua
exigido, e a soma dos itens dos dias continua a ser comparada com o total do mês.
`git diff --stat e2e/` → `39-calendario.spec.ts | 62 +++++---`, `41-cadeia-faturas.spec.ts | 14 +-`.

## g) Gate pela ordem do AGENTS.md — PASS (5/5, exit 0)

```
$ pnpm format:check   → exit 0   All matched files use Prettier code style!
$ pnpm lint           → exit 0   Tasks: 4 successful, 4 total
$ pnpm typecheck      → exit 0   Tasks: 4 successful, 4 total
$ pnpm test --force   → exit 0   34 passed (34) · 598 passed (598) · Cached: 0 cached, 2 total
$ pnpm build          → exit 0   ✓ Compiled successfully · BUILD_ID V3hhrAHcvKPI4Knmhe1twC
```

Logs em `relatorios/.qa-t84/gate-*.log`, exits em `exits.txt`. O primeiro `format:check` falhou
(o meu seletor novo partia a linha); corrigi com `prettier --write` nos dois specs e voltei a correr
o gate de início: 5/5 exit 0.

## h) Suite e2e completa — PASS

```
$ pnpm test:e2e
[e2e] limpeza: 4 utilizador(es) de teste apagado(s); 0 restante(s).

  138 passed (7.9m)
exit=0
```

Zero `failed`, `skipped` ou `flaky`. Log: `relatorios/.qa-t84/suite-e2e.log`.

---

## O que NÃO ficou coberto / fica registado

1. **Não há spec novo permanente para o painel do dia.** O critério da T84 fala em «o spec novo do
   dia», mas o Dev não o escreveu e o Lead pediu explicitamente **138/138**, número que um spec novo
   mudaria. A prova do painel é este relatório + 19 capturas + o JSON de medições; se quiserem
   durabilidade, o spec a acrescentar é curto (abrir dia → dois grupos → lançar com data X) e eu
   escrevo-o numa volta seguinte.
2. **Estado «dia vazio» não é alcançável pela interface** (por desenho). Provei que não há gatilho e
   que clicar numa célula vazia não abre nada; não consegui capturar o diálogo vazio no ecrã sem
   forçar estado no código, e não o fiz.
3. O achado do alvo de toque (e) fica para decisão do Lead.
4. A 1440 o grupo «Já liquidado» aparece abaixo da área visível do corpo (o diálogo tem 900 px e a
   lista 18 itens); está no DOM e alcança-se rolando. Não é falha — é consequência dos 18 itens
   temporários; com os dados normais (1 item/dia) não acontece.

## Ficheiros que escrevi

`relatorios/T84-qa.md`; `e2e/39-calendario.spec.ts` e `e2e/41-cadeia-faturas.spec.ts` (re-apontados);
`relatorios/.qa-t84/` (sondas `recon*.cjs`, `medir.cjs`, `lancar2.cjs`, `scroll-e-vazio.cjs`,
`dados.cjs`, `diag.cjs`; `medicoes.json`, `lancamento.json`, `*.log`, 19 PNG).
Zero alterações em `apps/**`, zero git (sem add/stash/checkout/branch/commit).
Dados de teste: 18 contas a pagar + 1 lançamento criados por mim, **todos apagados**
(`restantes={"contas":0,"lancamentos":0}`), totais de dezembro de volta a 750/1850/+1100.
Porta 3000 fechada.

---

# Volta 1 — zona accionável da célula e spec permanente (2026-11-21, mais tarde)

O que mudou no código (só `apps/web/src/components/calendar-day-dialog.tsx`): a célula da grelha e o
cartão da lista têm `onClick={abrirDia}`, e `abrirDia` sai quando `event.target.closest('a') !== null`;
classes `cursor-pointer hover:bg-muted/50 active:bg-muted` (grelha) e `hover:bg-muted/40
active:bg-muted/60` (cartão). O botão do topo mantém `aria-haspopup="dialog"`, o nome acessível e o
`focus-visible`. **Não toquei em `apps/`.** Build medido: `BUILD_ID jCK2JFoS1B2-x0b18iVrm`.

## (a) Cinco toques, página nova em cada — PASS

A 390×844 (cartão da lista, dia 5 de dezembro) e a 1440×900 (célula da grelha, o mesmo dia), com
`page.mouse.click` num contexto novo por toque (o `elementFromPoint` diz o que recebeu o clique):

| Toque | 390 — alvo | 390 resultado | 1440 — alvo | 1440 resultado |
| --- | --- | --- | --- | --- |
| centro | `DIV` (cartão) | **abriu** (`sábado, 5 de dezembro`) | `P` | **abriu** |
| meio de baixo (92 %) | `DIV` | **abriu** | `SPAN` dentro de `<a>` | **navegou** para `/recorrencias` |
| canto inferior esquerdo (5 %/95 %) | `DIV` | **abriu** | `DIV` | **abriu** |
| botão do topo | `SPAN`/`BUTTON` | **abriu** | `BUTTON` | **abriu** |
| em cima da ligação | `SPAN` dentro de `<a>` | **navegou** para `/recorrencias` | `SPAN` dentro de `<a>` | **navegou** para `/recorrencias` |

A 390: 4 abrem + 1 navega, igual ao Dev. A 1440, o «meio de baixo» cai **dentro da ligação** e navega —
a excepção prevista; os outros três pontos e o botão abrem. Em nenhum toque abriu dois diálogos.

## (b) Proporção da área que abre — PASS

Método: amostragem de 2 em 2 px sobre o `rect` da célula com `document.elementFromPoint`; conta como
«abre» todo o ponto cujo elemento está na célula e **não** tem `closest('a')`. É o mesmo critério do
`onClick`. 390 = cartão da lista, 1440 = célula da grelha; dia 5 tem 1 item, dia 8 tem 4 (criei 3
contas temporárias e apaguei-as).

| Viewport | Itens | Célula (`rect`) | Abre | Ligação (navega) | Botão (incluído em «abre») |
| --- | --- | --- | --- | --- | --- |
| 390 | 1 | **358 × 146** | **79,0 %** | 21,0 % | 30,0 % (332×44) |
| 390 | 4 | **358 × 317** | **58,2 %** | 41,8 % | 13,7 % (332×44) |
| 1440 | 1 | **158,9 × 109,8** | **76,0 %** | 24,0 % | 39,5 % (144,9×44) |
| 1440 | 4 | **158,9 × 194,8** | **50,4 %** | 49,6 % | 21,9 % (144,9×44) |

Falsificação dos números do Dev: 78,0 → 79,0 · 77,6 → 76,0 · 59,4 → 58,2 · 49,4 → 50,4. As
diferenças são de 1–2 pontos percentuais (método de amostragem e `links` que não ocupam a largura
toda do cartão); a conclusão é a mesma. **O achado da volta anterior está fechado:** com 1 item,
~3/4 da célula abre; com 4 itens, ~1/2 (o resto são as ligações dos itens, que navegam por desenho).

## (c) Célula vazia — PASS

Dia 11 a 1440 (célula `DIV` de 158,9 × 96): `cursor: auto`; `onclick === null`; fundo antes **e**
com o rato em cima = `rgba(0, 0, 0, 0)` (sem mudança); sem `tabindex`; clique no centro →
**0 diálogos**, URL fica `/calendario`.

## (d) Sem efeitos colaterais — PASS

- Clique no botão do topo (posição 10,10 dentro do `<button>`) → **1** diálogo, não dois.
- Teclado: `focus()` no botão + `Enter` → 1 diálogo; `Escape`; `focus()` + `Espaço` → 1 diálogo.
- `focus-visible`: `outline-style: solid`, `outline-width: 2px`, `outline-color: lab(39,54 …)` e o
elemento é `document.activeElement`.
- Consola: **0** mensagens `error` e **0** `pageerror` em todas as páginas das medições.
- Grelha de dezembro: 7 focáveis (2 botões + 5 ligações), `[tabindex]` = 0, `[role]` = 0 nas células.
  (O Dev contou 13 com 5 dias com itens; aqui dezembro só tem 2 dias com itens — o que interessa é
  que não há `tabindex` nem `role` na célula e que o botão é o único caminho de teclado do dia.)

## (e) Spec permanente do painel — PASS (4/4 verde)

`e2e/84-calendario-painel-dia.spec.ts` (179 linhas, 4 testes, mês isolado `2027-03`, prefixo
`T84 dia`, tudo apagado no `afterAll`):

```
$ pnpm test:e2e e2e/84-calendario-painel-dia.spec.ts --reporter=list
  ok 1 … 84-calendario-painel-dia.spec.ts:57  abre por toque na célula (fora do botão e das ligações) e mostra «Por liquidar»
  ok 2 … 84-calendario-painel-dia.spec.ts:91  abre pelo teclado: nome acessível, Enter e Espaço
  ok 3 … 84-calendario-painel-dia.spec.ts:108 lança com a data do dia, o item cai em «Já liquidado» e o saldo do dia não muda
  ok 4 … 84-calendario-painel-dia.spec.ts:150 um dia vazio não tem controlo, não abre por toque e fica fora do Tab
[e2e] limpeza: 1 utilizador(es) de teste apagado(s); 0 restante(s).
  4 passed (14.1s)
```

Porque é que fica vermelho se o comportamento desaparecer (não alterei `apps/` para o provar, como
pediste; a prova é geométrica e de contraste):

- **`onClick` da célula:** o toque é feito em `(x+8, bottom−8)` do cartão. Medido com
  `elementFromPoint`: o elemento que recebe o clique é **o próprio `DIV` do cartão**
  (`igualAoCartao: true`), `dentroDeLink: false`, `dentroDeBotao: false`. O `<button>` do
  `DialogTrigger` é irmão, não antepassado — o handler do trigger não corre nesse ponto. Sem o
  `onClick` da célula não há nenhum handler nesse caminho: o diálogo não abre e o teste 1 falha.
- **`initialDate`:** o teste 3 exige `Data === '2027-03-13'` **e** que o item apareça em «Já
  liquidado» do dia 13. O mesmo formulário em `/transacoes` abre com **`2026-11-21`** (hoje); sem a
  prop, o painel mostraria hoje e o movimento cairia noutro dia — as duas asserções falham.
- O `saldo -30,00 €` é comparado **antes e depois** do lançamento; o teste também exige 2 itens em
  «Por liquidar» e 1 em «Já liquidado», e que o novo item **não** esteja em «Por liquidar».

## (f) Gate e suite — PASS

```
$ pnpm format:check   → exit 0
$ pnpm lint           → exit 0
$ pnpm typecheck      → exit 0
$ pnpm test --force   → exit 0   34 passed (34) · 598 passed (598) · Cached: 0 cached, 2 total
$ pnpm build          → exit 0   ✓ Compiled successfully · BUILD_ID jCK2JFoS1B2-x0b18iVrm
```

```
$ pnpm test:e2e
Running 142 tests using 1 worker
[e2e] limpeza: 4 utilizador(es) de teste apagado(s); 0 restante(s).

  142 passed (7.9m)
exit=0
```

**142 e não 139:** o spec novo tem **4** testes (um por garantia: toque, teclado, lançamento com a
nota, dia vazio), e 138 + 4 = 142. O número a fixar como baseline é **142**, não 139. Zero
`failed`/`skipped`/`flaky`. Log: `relatorios/.qa-t84/v1-suite-e2e.log`.

## O que não consegui medir

- Toque **real** em telemóvel: usei `page.mouse.click` a 390×844 (o caminho que o `onClick` partilha
  com o toque). Não testei gesto táctil nativo nem 320 px.
- Não mutei `apps/` para ver o spec vermelho (proibido nesta volta); a demonstração é a de (e).

## Ficheiros desta volta

`e2e/84-calendario-painel-dia.spec.ts` (novo); `relatorios/T84-qa.md` (esta secção);
`relatorios/.qa-t84/` (`v1-toques.cjs`, `v1-toques.json`, `v1-medicoes.json`, `discrimina.cjs`,
`sobras.cjs`, `v1-spec84c.log`, `v1-gate-*.log`, `exits-v1.txt`, `v1-suite-e2e.log`).
Dados: 3 contas a pagar temporárias criadas e apagadas (`apagados=3 restantes=0`); nenhuma sobra de
`T84 dia`/`T84v1 QA`/`T84 QA` na base (`{"lancamentos":0,"contas":0}`). Porta 3000 fechada, zero git,
`apps/` intocado.

---

# Volta 2 — compras no cartão e transferências no painel do dia (2026-11-21, fim)

O que mudou (só `apps/web/src/server/calendar.ts` + o diálogo): a leitura dos movimentos passa a
`OR: [{ settled: true, invoiceId: null }, { invoiceId: { not: null } }]`, com `invoiceId` e
`transferGroupId` no `select`, e o resultado separa-se em **dois** grupos fora de `items`:
`settledItems` («Já liquidado») e `cardItems` («No cartão», com «Compra no cartão — entra na fatura
de DD/MM»); transferências com o mesmo `transferGroupId` dão **uma** linha «Transferência» a 0,00 €.
Microcopy do vazio: «Não há movimentos neste dia.». **Não toquei em `apps/`.** Build medido:
`BUILD_ID 8gGui_ACtXXJxUbNZAfT6`.

## (a) Caminho do cartão, pela interface — PASS

Cenário meu (demo, `2026-12`): uma conta a pagar de 10,06 € no dia 15 (saldo do dia −10,06 €) e um
lançamento já liquidado de 30,00 € no mesmo dia. Depois, no painel do dia 15: «Lançar neste dia» →
**Cartão de crédito** → cartão «Cartão Millennium» → 99,90 € → descrição `T84v2 QA cartão` → categoria
→ «Lançar». O formulário abriu com `Data = 2026-12-15`.

| | Antes | Depois |
| --- | --- | --- |
| descrição do dia | «1 item por liquidar · 1 já liquidado · saldo -10,06 €» | «1 item por liquidar · **1 no cartão** · 1 já liquidado · saldo -10,06 €» |
| grupos | `Por liquidar:1` · `Já liquidado:1` | `Por liquidar:1` · **`No cartão:1`** · `Já liquidado:1` |
| linha em «No cartão» | — | «T84v2 QA cartão · Lançamento · Compra no cartão — entra na fatura de 05/01 · -99,90 €» |
| saldo do dia | −10,06 € | **−10,06 €** |
| totais 2026-12 | 760,06 / 1850,00 / +1089,94 | **iguais** |
| 1440 (reaberto) | — | o mesmo grupo e o mesmo texto |

A compra **não** aparece em «Por liquidar» nem em «Já liquidado»; o diálogo voltou sozinho ao estado
do dia. Linha na base (lida por SQL, apagada depois):

```
{"id":"0181a7c8-…","description":"T84v2 QA cartão","amountInCents":-9990,"dia":"2026-12-15",
 "settled":false,"invoiceId":"c87b1ba4-982a-4664-b9bf-c7dc27905719","cardId":"c95db648-…","transferGroupId":null}
```

`settled = false` e `invoiceId` não nulo — como o critério pedia.

## (b) Transferência — PASS

No mesmo dia 15, modo **Transferência**, 25,00 €, destino «Poupança» (a conta de destino abre
**vazia**; escolhi-a à mão). Painel depois: uma linha
«Transferência · Lançamento · T84v2 QA transferência · **0,00 €**» em «Já liquidado»; descrição do
dia «1 item por liquidar · 1 no cartão · **2 já liquidados** · saldo -10,06 €» — **o saldo do dia não
muda**. Base: duas pernas com o mesmo grupo

```
-2500 € · transferGroupId 2df1317a-28c4-415b-aa59-83795ea1f1c6 · settled true
+2500 € · transferGroupId 2df1317a-28c4-415b-aa59-83795ea1f1c6 · settled true
```

## (c) Nada soma — PASS por medição

Os três totais do mês foram lidos do DOM antes e depois de **cada** operação e ficaram iguais:
760,06 / 1850,00 / +1089,94 (antes, depois do cartão, depois da transferência). O saldo do dia ficou
−10,06 € nas três leituras. Nenhum dos dois grupos entra em `items`, que é a base dos totais.

## (d) Spec permanente — PASS (6/6 verde)

`e2e/84-calendario-painel-dia.spec.ts` cresceu para **313 linhas e 6 testes**: os 4 da volta 1 mais
o cartão e a transferência. Duas fixtures aditivas em `e2e/support/db.ts` (`invoiceId` em
`lerPorDescricao`, que já devolvia `settled`/`transferGroupId`; e `criarContaDoSpec` para a segunda
conta). Nada existente foi alterado.

```
$ pnpm test:e2e e2e/84-calendario-painel-dia.spec.ts --reporter=list
  ok 1 … abre por toque na célula (fora do botão e das ligações) e mostra «Por liquidar»
  ok 2 … abre pelo teclado: nome acessível, Enter e Espaço
  ok 3 … lança com a data do dia, o item cai em «Já liquidado» e o saldo do dia não muda
  ok 4 … um dia vazio não tem controlo, não abre por toque e fica fora do Tab
  ok 5 … uma compra a crédito cai em «No cartão», não soma e regressa ao dia (2.8s)
  ok 6 … uma transferência dá uma linha de 0,00 € e duas pernas na base (2.4s)
[e2e] limpeza: 1 utilizador(es) de teste apagado(s); 0 restante(s).
  6 passed (22.5s)
```

As **quatro** afirmações do §12 do Dev estão no teste 5 e no 6:

1. volta ao **estado do dia** e o grupo «No cartão» contém a compra e «entra na fatura»;
2. saldo do dia (`/saldo\s*-10,06\s*€/`) e os **três** totais (`toEqual` do array) iguais;
3. base com `settled === false` e `invoiceId !== null` (`lerPorDescricao`);
4. transferência: **uma** linha «Transferência» de `0,00 €` e **duas** pernas com o mesmo
   `transferGroupId` (`toEqual([-2500, 2500])`).

**Fica vermelho se `cardItems` desaparecer:** o teste exige a região «No cartão» com 1 item e o
texto «entra na fatura» — região que **não existe** antes do lançamento (o próprio teste exige
`toHaveCount(0)` antes) e que só é desenhada a partir de `day.cardItems`. Sem `cardItems`, a compra
não teria grupo, a região teria contagem 0 e o teste falha na primeira asserção após o lançamento.
Não mutei `apps/` para o demonstrar (proibido nesta volta).

**Novo baseline: 144 testes** (138 + 6). Não 139 nem 142: o spec tem agora 6 testes.

## (e) Gate e suite — PASS

```
$ pnpm format:check   → exit 0
$ pnpm lint           → exit 0
$ pnpm typecheck      → exit 0
$ pnpm test --force   → exit 0   34 passed (34) · 598 passed (598) · Cached: 0 cached, 2 total
$ pnpm build          → exit 0   ✓ Compiled successfully · BUILD_ID 8gGui_ACtXXJxUbNZAfT6

$ pnpm test:e2e
Running 144 tests using 1 worker
[e2e] limpeza: 4 utilizador(es) de teste apagado(s); 0 restante(s).

  144 passed (8.2m)
exit=0
```

**Passou à primeira**, sem a instabilidade que o Dev viu (nenhum `33-navegacao-15`, nenhum
`29-contas-truncagem`, zero DNS do Neon). Não invento: esta corrida foi limpa.

## Achado fora do âmbito (confirmado, não corrigido)

Em `/transacoes`, modo **Transferência**, a conta de destino («Para a conta») abre **vazia**
(`inputValue === ""`); submeter devolve o alerta **«Falta o identificador.»** e não cria nada. Igual
no painel do calendário — o problema está no `TransactionQuickAdd`, não na T84. Fica para a tarefa
nova do Lead; não mexi em `apps/`.

## O que não consegui medir

- Toque táctil nativo (usei `page.mouse.click`) e 320 px.
- Não mutei `apps/` para ver o spec vermelho (proibido); a prova de dependência é a de (d).

## Ficheiros desta volta

`e2e/84-calendario-painel-dia.spec.ts` (6 testes), `e2e/support/db.ts` (2 fixtures aditivas),
`relatorios/T84-qa.md` (esta secção). Em `relatorios/.qa-t84/`: `v2-medir.cjs`,
`v2-transferir.cjs`, `v2-dados.cjs`, `v2-medicoes.json`, `v2-transferencia.json`,
`v2-cartao-390.png`, `v2-cartao-1440.png`, `v2-transferencia-390.png`,
`v2-transacoes-destino-vazio.png`, `v2-spec84d.log`, `v2-gate-*.log`, `exits-v2.txt`,
`v2-suite-e2e.log`.
Dados: cenário do dia 15 (1 conta + 1 lançamento liquidado) e tudo o que os testes criaram,
apagados — sobras `{"lancamentos":0,"contas":0}`. Zero git, `apps/` intocado, porta 3000 fechada.

---

# Volta 3 — pagamento de fatura, dias só-com-cartão e entra/saiu (2026-11-21, fecho)

O que mudou (só `server/calendar.ts` e o diálogo): `INVOICE_PAYMENT` com `invoiceId` **e**
`settled: true` passa a «Já liquidado» («Pagamento de fatura liquidado») e sai de `cardItems`; a
grelha e a lista abrem o dia quando `items + cardItems + settledItems > 0`, com o nome acessível a
contar **só** os por liquidar; o rótulo da compra no cartão é «entra na fatura» ou «**saiu** na
fatura» conforme a fatura esteja por pagar ou paga. **Não toquei em `apps/`.** Build medido:
`BUILD_ID vLC7Oy5p5CGxUwfPDp3PL`.

## (a) Pagamento de fatura pela interface — PASS

Cenário na demo: compra no cartão de 10,00 € datada de **10/03/2027** (fatura do cartão Millennium
com fecho a 20/03 e vencimento a 05/04) e pagamento dessa fatura em `/cartoes` («Pagar fatura»,
data por omissão = hoje, **21/11/2026**). O dia do pagamento, medido a 390 e a 1440:

```
descrição: "0 itens por liquidar · 1 já liquidado · saldo 0,00 €"
grupos:    [ {nome:"Já liquidado", itens:1,
              linha:"Pagamento da fatura de Cartão Millennium (2027-04-05) · Lançamento ·
                     Pagamento de fatura liquidado · -310,00 €"} ]
           (nenhum grupo «No cartão» — 0 itens)
```

- **Em «Já liquidado»** com o rótulo «Pagamento de fatura liquidado»: sim.
- **Ausente de «No cartão»**: sim — a região nem é desenhada (`No cartão` = 0 itens). É esta a
  exceção que a volta 3 acrescentou; sem ela o pagamento (que tem `invoiceId` **e** `settled: true`)
  cairia em «No cartão».
- **Saldo do dia**: 0,00 € — um pagamento de fatura não é despesa nova.
- **Três totais**: novembro 0,00 / 0,00 / 0,00 **antes e depois**; dezembro 750,00 / 1850,00 /
  +1100,00 **antes e depois** (medido na mesma sessão).
- A fatura foi reposta e o pagamento apagado no fim (ver «Limpeza»).

## (b) Dia só com compras no cartão — PASS

Dia 10/03/2027 com uma única compra no cartão (0 por liquidar):

| | 390×844 | 1440×900 |
| --- | --- | --- |
| a célula é controlo | **sim** (`button[aria-haspopup="dialog"]`) | **sim**, `[tabindex]` na grelha = 0 |
| nome acessível | «quarta-feira, 10 de março: **0 itens**, saldo 0,00 €. Abrir o dia» | igual |
| diálogo | «0 itens por liquidar · **1 no cartão** · saldo 0,00 €» | igual |
| grupo | `No cartão:1` — «T84v3 QA compra 10/03 · Compra no cartão — entra na fatura de 05/04 · -10,00 €» | igual |

O mesmo se mediu no dia 15/12 (compra de 10,00 €, controlo com «0 itens») antes de a fatura ser
paga. O nome acessível continua a contar só os por liquidar, como o critério pedia.

## (c) Rótulo «entra» / «saiu» — PASS

A **mesma** compra, antes e depois de a fatura ser paga:

| Estado da fatura | Linha em «No cartão» |
| --- | --- |
| por pagar | «Compra no cartão — **entra** na fatura de 05/04» |
| paga | «Compra no cartão — **saiu** na fatura de 05/04» |

## (d) Spec permanente — PASS (7/7 verde)

`e2e/84-calendario-painel-dia.spec.ts` → **7 testes**. O novo:
`um pagamento de fatura cai em «Já liquidado» e não em «No cartão»`.

```
$ pnpm test:e2e e2e/84-calendario-painel-dia.spec.ts --reporter=list
  ok 1 … abre por toque na célula …            ok 5 … uma compra a crédito cai em «No cartão» …
  ok 2 … abre pelo teclado …                   ok 6 … uma transferência dá uma linha de 0,00 € …
  ok 3 … lança com a data do dia …             ok 7 … um pagamento de fatura cai em «Já liquidado»
  ok 4 … um dia vazio não tem controlo …           e não em «No cartão» (5.3s)
[e2e] limpeza: 1 utilizador(es) de teste apagado(s); 0 restante(s).
  7 passed (27.8s)
```

O teste cria a compra a 10/03, confirma o dia só-com-cartão (controlo com «0 itens», `No cartão:1`,
«entra»), paga a fatura em `/cartoes` com data **21/03/2027** (dia fixo, não «hoje»), e exige:
a mesma compra com «saiu na fatura»; no dia 21/03 a linha em «Já liquidado» com
«Pagamento de fatura liquidado»; **`No cartão` = 0**; e os três totais do mês iguais.

**Fica vermelho se a exceção do `INVOICE_PAYMENT` desaparecer:** o pagamento tem `invoiceId` não nulo
e `settled: true`; sem a exceção é classificado em `cardItems`, portanto (i) «Já liquidado» deixa de
ter a linha (contagem 1 → 0) e (ii) «No cartão» deixa de ser 0. O teste exige as duas coisas. Não
mutei `apps/` para o ver vermelho (proibido nesta volta).

**Novo baseline: 145 testes** (138 + 7). Contado da suite, não estimado.

## (e) Gate e suite — PASS

```
$ pnpm format:check  → 0 · lint → 0 · typecheck → 0
$ pnpm test --force  → 0   34 passed (34) · 598 passed (598) · Cached: 0 cached, 2 total
$ pnpm build         → 0   ✓ Compiled successfully · BUILD_ID vLC7Oy5p5CGxUwfPDp3PL

$ pnpm test:e2e
Running 145 tests using 1 worker
[e2e] limpeza: 4 utilizador(es) de teste apagado(s); 0 restante(s).

  145 passed (8.2m)
exit=0
```

Corrida limpa à primeira (sem `33-navegacao-15`, sem DNS do Neon).

## Limpeza e reposição da demo (importante)

O primeiro ensaio pagou a fatura errada: o botão «Pagar fatura» de `/cartoes` pertence à fatura
**corrente** do cartão (05/04), não à de 05/01. Repus a demo ao instantâneo tirado antes do ensaio —
as **9 faturas** do cartão Millennium voltaram aos valores originais (estado, total, pago,
transitado, `paidAt`, `closedAt`), o pagamento e a compra foram apagados, e repeti o ensaio com a
compra datada no período da fatura que o botão paga (10/03). Verificação final:

```
{"pagamentosApagados":1,"comprasApagadas":1,"faturasRepostas":true,"sobras":0}
7e67894d PAID 35580/35580 · bc3f23ca CLOSED 41230/0 · 2382f191 CLOSED 49650/0 · 9c882946 CLOSED 59650/0
c87b1ba4 OPEN 69650/0 · 7429c4b1 OPEN 13333/0 · f944ec2e OPEN 23333/0 · 2f06b9cd OPEN 33333/0
a533d9ef PAID 43333/109650  (idêntico ao início do turno)
```

Dezembro: **750,00 / 1850,00 / +1100,00**, dias 5 e 8 com 1 item — igual ao início. Sobras de
`T84v3`/`T84v2`/`T84 QA` na demo: **0**. Pagamentos de fatura na demo com data de hoje: **0**.
Porta 3000 fechada, zero git, `apps/` intocado.

## O que não consegui medir

- Toque táctil nativo (usei rato/`page.mouse.click`) e 320 px.
- As capturas `v3-pagamento-*.png` e `v3-saiu-*.png` foram tiradas durante a animação de entrada do
  diálogo (ficaram desfocadas); o texto que provam está no JSON de medições e no spec, não nas
  imagens.

## Ficheiros desta volta

`e2e/84-calendario-painel-dia.spec.ts` (7 testes), `relatorios/T84-qa.md` (esta secção). Em
`relatorios/.qa-t84/`: `v3-medir.cjs`, `v3b-medir.cjs`, `v3-invoice.cjs`, `v3-restaurar.cjs`,
`v3-invoices-antes.json`, `v3-medicoes.json`, `v3b-medicoes.json`, `v3-spec84.log`,
`v3-gate-*.log`, `exits-v3.txt`, `v3-suite-e2e.log`, `v3-so-cartao-*.png`, `v3-entra-*.png`,
`v3-saiu-*.png`, `v3-pagamento-*.png`, `v3-cartoes-depois.png`.

---

# Volta 4 — a `INVOICE_PAYMENT` órfã do teste 7 (correção do spec)

**PASS.** O defeito era real no mecanismo, mas **a órfã já não existia na base** quando fui limpar:
o `globalTeardown` apaga os utilizadores `e2e-*` e a cascata leva a `Transaction` com eles. Dito de
outra forma, a segunda corrida só falharia se o utilizador de teste sobrevivesse entre corridas
(ou numa corrida interrompida a meio); a correção é a mesma e fica feita.

## A correção (1 linha de teste, `apps/` intocado)

`e2e/84-calendario-painel-dia.spec.ts`, teste 7: o pagamento passa a levar a **Nota**
(`pagar-nota`) com `${PREFIXO} pagamento`. O servidor grava a nota como `description`
(`invoices-actions.ts:85`, `value.notes ?? 'Pagamento da fatura de …'`), portanto a linha deixa de
escapar ao `limparDadosDoSpec` — que apaga por `description LIKE 'T84 dia%'` ou por conta `T84%`
(`db.ts:843-855`). A asserção do dia 21/03 passou de `/Pagamento da fatura/` para
`T84 dia pagamento`: continua a exigir a linha do pagamento, agora pelo texto que o próprio teste
escreveu.

```diff
     await pagar.getByLabel('Data do pagamento', { exact: true }).fill('2027-03-21');
+    await pagar.getByLabel('Nota', { exact: true }).fill(`${PREFIXO} pagamento`);
     await pagar.getByRole('button', { name: /^Pagar fatura$/ }).click();
...
-    await expect(jaLiquidado).toContainText(/Pagamento da fatura/);
+    await expect(jaLiquidado).toContainText(`${PREFIXO} pagamento`);
```

## Estado da órfã (antes → depois)

Sonda `relatorios/.qa-t84/v4-orfa.cjs` (leitura da base do ramo de teste):

```
antes:  dia 21/03/2027: 0 linhas · utilizadores e2e-*: 0 · contas T84%: 0
        INVOICE_PAYMENT existentes: 1 (demo, 2026-09-04, invoiceId não nulo — não é órfã)
depois: dia 21/03/2027: 0 linhas · utilizadores e2e-*: 0 · contas T84%: 0
        INVOICE_PAYMENT existentes: 1 (a mesma da demo)
```

Não houve linha a apagar: **0 apagadas**, e por isso também não há saldo de −10,00 a repor (a
`financial_account` do spec morreu com o utilizador). A prova do mecanismo é a spec: o teste 7, com
a nota, deixa a limpeza a apanhar o pagamento — `limpeza: 4 utilizador(es) … 0 restante(s)` nas
duas corridas e o dia 21/03 a nascer vazio.

## As duas corridas completas, de frio

`env -u E2E_REUSE_SERVER pnpm test:e2e --reporter=line`, build do zero em cada uma, porta 3000
livre no arranque (`0` listeners), sem servidor reaproveitado.

| Corrida | Testes | Resultado | Limpeza | Exit |
| --- | --- | --- | --- | --- |
| 1 | 145 | **145 passed (8.1m)** | `4 utilizador(es) … 0 restante(s)` | 0 |
| 2 | 145 | **145 passed (8.1m)** | `4 utilizador(es) … 0 restante(s)` | 0 |

O teste que falhava na segunda passagem correu verde **nas duas** (`84-…spec.ts:319` › «um
pagamento de fatura cai em «Já liquidado» e não em «No cartão»», `[130/145]` em ambas), e a primeira
asserção dele é `Já liquidado` com `toHaveCount(1)` — logo o dia 21/03/2027 teve **1** liquidado nas
duas corridas, não 2.

Sem flake nem falha de infra: nenhuma das corridas deu DNS do Neon nem `/importar` a expirar.
`pnpm format:check` depois da alteração: `All matched files use Prettier code style!` (exit 0).

**Baseline: 145**, igual nas duas corridas. Porta 3000 fechada no fim (`FECHADA`).

## Ficheiros desta volta

`e2e/84-calendario-painel-dia.spec.ts` (nota do pagamento; 7 testes), `relatorios/T84-qa.md`.
Em `relatorios/.qa-t84/`: `v4-orfa.cjs`, `v4-orfa-antes.log`, `v4-spec84-1.log`,
`v4-duas-corridas.sh`, `v4-runner.log`, `v4-suite-1.log`, `v4-suite-2.log`, `v4-fim.txt`.
`apps/**` intocado, zero git.
