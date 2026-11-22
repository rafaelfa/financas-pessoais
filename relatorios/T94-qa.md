# T94 — QA: endurecer a guarda dos 320 px (volta 2)

Data: 2026-11-22 · Base `faad336` + `e2e/89-guarda-320.spec.ts` e `playwright.config.ts` por commitar
· Build das corridas: `Rl7I5TP7awnNhriLjNGwv`; suite de frio: `03H7mPpSGRhy2HWUX1HXU`.

**Veredicto: PASS.** A guarda passou a medir a **parede de 305** por omissão (sem `--headed`), as
**cinco** mutações mordem e o `--headed` continua verde. O limite que o Lead pediu por escrito está na
secção (g), medido: com barras **overlay** a parede volta a 320 e a guarda tolera até 15 px de
conteúdo a mais **sem ficar vermelha**.

---

## (a) A guarda mede a parede por omissão — PASS

Comando (sem `--headed`, projeto `estreito` por `testMatch`):

```
$ pnpm test:e2e e2e/89-guarda-320.spec.ts
[e2e] limpeza: 1 utilizador(es) de teste apagado(s); 0 restante(s).
  1 passed (5.1s)
EXIT=0
```

Os três números **tal como o spec os vê** (mesmas `launchOptions` do projeto, sonda
`relatorios/.qa-t94/probe.cjs`):

| modo | `innerWidth` | `clientWidth` | `scrollWidth` | filhos fora |
| --- | --- | --- | --- | --- |
| **headless + `ignoreDefaultArgs: ['--hide-scrollbars']`** (o `estreito`) | 320 | **305** | **305** | 0 |
| headless por omissão (barra escondida) | 320 | 320 | 320 | 0 |

É a diferença que a T94 corrige: com a barra escondida a parede era 320 e o teste tolerava 15 px.

## (b) A prova de que morde — PASS

```
$ T89_MUTAR=parede pnpm test:e2e e2e/89-guarda-320.spec.ts      (sem --headed)
    Error: nenhum filho do cabeçalho passa da janela
    - Array []
    + Array [
    +   309,
    + ]
  1 failed                                                        EXIT=1

$ pnpm test:e2e e2e/89-guarda-320.spec.ts                       (sem --headed)
  1 passed (5.1s)                                                 EXIT=0
```

Com a barra forçada, 16 px de padding dão `scrollWidth` **309** > `clientWidth` **305** → vermelho. Na
sonda, com a barra escondida, os mesmos 16 px davam `320/320` (verde) — é exactamente o furo que esta
volta fecha.

## (c) As cinco mutações — PASS (e sem falsos)

Todas sem `--headed`:

| mutação | saída |
| --- | --- |
| `nav` | «Transações» `Expected <= 122.5 / Received 124.9` |
| `toque` | «Mostrar ou esconder…» `Expected >= 44 / Received 28` |
| `cabecalho` | «nenhum filho do cabeçalho passa da janela», `[]` vs `[424.8]` |
| `limiar` | «a 360 a marca da app aparece», `Expected > 10 / Received 1` |
| `parede` | «nenhum filho do cabeçalho passa da janela», `[]` vs `[309]` |

`cabecalho` continua a acusar **filhos fora do cabeçalho** (o `424.8` do bloco da direita), não um
transbordo de documento — a distinção que o Lead pediu. Nenhuma passa em falso; o spec limpo passa.

## (d) Nenhuma comparação de transbordo usa `innerWidth` — PASS

```
$ grep -n "innerWidth" e2e/89-guarda-320.spec.ts
40:  /** `window.innerWidth`: a janela É mesmo 320/360 (não serve para transbordo). */
45:   * o `innerWidth` inclui a barra e comparar o `scrollWidth` com ele dava um
158:      viewport: window.innerWidth,
228:   * T94: comparar com a largura útil (`clientWidth`), não com `innerWidth`. Em
229:   * `--headed` o Chromium mostra a barra de scroll e o `innerWidth` é 17 px
```

O único uso de código é a linha **158** (`viewport`, que serve a asserção «a janela é mesmo 320/360»);
as comparações de transbordo são todas com `clientWidth`: linha **165** (`right > clientWidth + 0.5`),
**233** (`navScrollWidth === clientWidth`) e **234** (`docScrollWidth === clientWidth`).

## (e) O `--headed` continua a passar — PASS

```
$ pnpm test:e2e e2e/89-guarda-320.spec.ts --project=estreito --headed
  1 passed (4.1s)                                                  EXIT=0
```

E a medição headed da T93 continua verdadeira com este código (sonda, viewport 320 headed):
`innerWidth 320 / clientWidth 305 / scrollWidth 305`, filhos fora `[]`.

## (f) Suite completa, de frio — PASS

```
$ rm -rf apps/web/.next && env -u E2E_REUSE_SERVER pnpm test:e2e
[e2e] limpeza: 4 utilizador(es) de teste apagado(s); 0 restante(s).
  149 passed (8.9m)
SUITE_EXIT=0     BUILD_ID 03H7mPpSGRhy2HWUX1HXU
```

**149**, e o `estreito` correu por último (`[149/149]`) já com a barra forçada. Gate:
`format:check` 0, `lint` 0, `typecheck` 0.

## (g) O limite que a guarda tem — escrito, medido (não é FAIL)

**A largura da barra é do sistema, não do teste.** Nesta máquina mede **15 px** (`innerWidth` 320 −
`clientWidth` 305), tanto em headless com `ignoreDefaultArgs` como em `--headed`.

Com **barras overlay** (`--enable-features=OverlayScrollbar`, a omissão em muitos macOS/telemóveis),
a sonda dá:

| | `clientWidth` | `scrollWidth` com +12 px | `scrollWidth` com +16 px |
| --- | --- | --- | --- |
| barra clássica (15 px) | 305 | **305** (cabe) | **309** → **vermelho** |
| **overlay (0 px)** | **320** | 320 | **320** — **passa** |

Ou seja: numa máquina com barras overlay a parede volta a ser **320** e a guarda aceita até **15 px**
de conteúdo a mais (a diferença 320 − 305) sem nada ficar vermelho — no caso extremo, o cabeçalho da
volta 3 da T93 (que transbordava 4 px) **passaria**. O valor 15 é desta máquina; o que a guarda
garante é «cabe na largura útil do browser onde corre», não «cabe nos 305 de um Windows com barra
clássica». Quem ler a guarda tem de saber isto: **o piso de 305 é o desta máquina**, e o teste não o
fixa.

## Limpeza e ambiente

Demo só a ler; nenhum dado criado ou apagado. Depois da suite: **0** utilizadores `e2e-%`. Zero escrita
em `apps/`, `e2e/` ou no config; zero git. Porta 3000 **fechada**. O limite de entrada do login de
teste (`/sign-in/email`, 10 por 60 s) fez uma sonda esperar 75 s — sem efeito nos números.

## Ficheiros desta volta

`relatorios/T94-qa.md`; em `relatorios/.qa-t94/`: `sem-headed-{limpo,nav,toque,cabecalho,limiar,parede}.log`,
`headed-limpo.log`, `probe.cjs`, `probe.json`, `probe.log`, `gate.log`, `suite.log`.
