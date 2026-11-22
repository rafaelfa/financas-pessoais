# T89 — QA: a guarda automática dos 320 px

Data: 2026-11-22 · Base `bea25f6` (T88 fechada) + T89 na árvore, sem commit · Suite de frio:
`BUILD_ID TFIcpBUomVgKcpaVbTpSe`.

**Veredicto: PASS.** A guarda morde nas duas mutações (falha com elas, passa sem elas), o projeto
`estreito` custa **+1 teste**, e a alínea (d) está no fim com os limites que encontrei.

---

## (a) O spec sozinho, a 320 — PASS

```
$ rm -rf apps/web/.next && env -u E2E_REUSE_SERVER pnpm test:e2e --project=estreito --reporter=line
[1/1] [estreito] › e2e\89-guarda-320.spec.ts:21:7 › T89 — a 320 px nada transborda › o rodapé móvel e o cabeçalho cabem na janela de 320
[e2e] limpeza: 1 utilizador(es) de teste apagado(s); 0 restante(s).
  1 passed (40.4s)
EXIT=0
```

O próprio teste exige `viewport === 320` (linha 76) e passou — a janela é mesmo 320, não 393 nem
1280. Os 40,4 s incluem o build de frio e o `globalSetup`.

## (b) As duas mutações, reproduzidas por mim — PASS

Com um servidor meu (`pnpm start`) e `E2E_REUSE_SERVER=1`, para isolar o teste da compilação:

**`T89_MUTAR=nav` → falha, como tem de falhar:**

```
$ E2E_REUSE_SERVER=1 T89_MUTAR=nav pnpm test:e2e --project=estreito --reporter=line
    Error: «Transações» não passa da célula
    expect(received).toBeLessThanOrEqual(expected)
    Expected: <= 128.5
    Received:    129.4
    > 88 |       expect(rotulo.direita, `«${rotulo.texto}» não passa da célula`).toBeLessThanOrEqual(
  1 failed
EXIT=1
```

**`T89_MUTAR=cabecalho` → falha, como tem de falhar:**

```
$ E2E_REUSE_SERVER=1 T89_MUTAR=cabecalho pnpm test:e2e --project=estreito --reporter=line
    Error: nenhum filho do cabeçalho passa dos 320
    expect(received).toEqual(expected) // deep equality
    - Expected  - 1
    + Received  + 3
    - Array []
    + Array [
    +   341.3,
    + ]
    > 114 |     expect(medido.headerFilhosFora, 'nenhum filho do cabeçalho passa dos 320').toEqual([]);
  1 failed
EXIT=1
```

**Sem variável → verde:** o (a) acima (1 passed) e a suite completa no (e) (147 passed).

Nota de precisão: a mutação `cabecalho` tira `sr-only` ao span do cabeçalho — e a T88 que está
commitada usa `sr-only text-sm font-medium min-[360px]:not-sr-only md:hidden` (li a classe no DOM do
build). É essa a classe que a mutação ataca; se um dia a implementação passar a `hidden …
min-[360px]:inline`, esta mutação deixa de morder (ver (d)).

## (c) Custo do projeto novo — PASS (+1 teste, dentro do ruído)

`--list` por projeto, na árvore com a T89:

| projeto | testes | inclui `89-guarda-320`? |
| --- | --- | --- |
| `chromium` | 132 | **0** (`testIgnore` funciona) |
| `telemovel` | 9 | 0 |
| `escuro` | 5 | 0 |
| `estreito` | **1** | **1** |
| **total** | **147** | |

Suite completa: **147 passed (8.8m)** — 146 + o teste novo, que correu por último (`[147/147]
[estreito]`). O tempo das minhas corridas anteriores de 146 foi 8,6 m (T88) e 8,9 m (T78), portanto o
teste a mais não se distingue do ruído da máquina; isolado, o projeto leva ~2 s de execução (os 40,4 s
do (a) são quase todos build e `globalSetup`).

Não está saltado por engano noutro projeto: o teste aparece uma só vez e no `estreito`. Se o
`testIgnore` do `chromium` desaparecesse, o spec corria também a 1280 e o `viewport === 320` ficava
vermelho — a proteção é a asserção, não o silêncio.

## (d) O que a guarda **não** apanha — achado para a próxima volta

A guarda olha para **uma** largura (320) e para **duas** coisas (a nav e o cabeçalho). Fica de fora:

| Mudança | Passa? | Porquê, com o valor |
| --- | --- | --- |
| `min-[360px]` → `min-[380px]` | **passa** | o teste nunca avalia os 360; a 320 a marca continua escondida e o `docScrollWidth` é 320. A promessa «volta aos 360» fica sem guarda. |
| Marca apagada do `<header>` (span removido) | **passa** | deixa de haver um filho a transbordar; nada exige que a marca exista. |
| Rótulos da nav vazios (`<span></span>`) | **passa** | 5 `<li>` com caixas de 0 px, `navScrollWidth` 320. Nada exige texto. |
| Nav escondida com `visibility:hidden` | **passa** | os rects mantêm-se e `scrollWidth` continua 320; com `display:none` já falhava (`scrollWidth` 0 ≠ 320 — esse está coberto). |
| Transbordo entre 321 e 359 | não medido | o projeto só existe a 320. Uma largura fixa de 340 px transbordaria a 320 e seria apanhada; um caso que só rebente a 350 escaparia. |

A asserção que falta, concretamente: **um segundo teste no mesmo projeto (`estreito`), a 360×640**,
com `expect(marca.getBoundingClientRect().width, 'a marca volta aos 360').toBeGreaterThan(0)` e o
mesmo par `docScrollWidth === 360` / `headerFilhosFora === []`; mais um `toHaveText` não vazio em cada
um dos 5 rótulos da nav. É uma decisão de âmbito (custa um teste e um viewport a mais), não um defeito
da guarda que existe — devolve-se ao Lead.

## (e) Suite completa, de frio — PASS

`rm -rf apps/web/.next` e `env -u E2E_REUSE_SERVER pnpm test:e2e`, porta 3000 livre no arranque:

```
[e2e] limpeza: 4 utilizador(es) de teste apagado(s); 0 restante(s).
  147 passed (8.8m)
EXIT=0          BUILD_ID TFIcpBUomVgKcpaVbTpSe
```

**147 passed**, baseline nova. Nenhum teste antigo mudou de resultado (0 failed, 0 skipped, 0 flaky);
o último a correr é o da T89.

## (f) Gate — PASS

```
$ pnpm format:check && pnpm lint && pnpm typecheck
All matched files use Prettier code style!
 Tasks:    4 successful, 4 total     (lint)
 Tasks:    4 successful, 4 total     (typecheck)
GATE_EXIT=0
```

## Limpeza e ambiente

Sessão **demo** e o utilizador de teste das corridas; nenhum dado meu na base. Depois da suite: **0**
utilizadores `e2e-%`. Zero escrita em `apps/`, `e2e/` ou no config; zero git. `AGENTS.md`,
`next-env.d.ts` e `TASKS.md` já vinham sujos — não fui eu. Porta 3000 **fechada**.

## Ficheiros desta volta

`relatorios/T89-qa.md`. Em `relatorios/.qa-t89/`: `spec-sozinho.log`, `mutar-nav.log`,
`mutar-cabecalho.log`, `suite.log`, `gate.log`, `servidor.log`, `inspecao.cjs`. Sem capturas (não as
pediste nesta volta).

---

# Volta 2 — a asserção dos 360 px

Data: 2026-11-22 · Mesma árvore (`bea25f6` + T89 por commitar); só o spec mudou. Servidor meu em
`:3000`, `E2E_REUSE_SERVER=1` para isolar as provas do build.

**Veredicto da volta 2: FAIL em (b).** A guarda nova **não morde** quando o limiar muda de 360 para
380: a marca fica com **1 px** a 360 e a asserção é `toBeGreaterThan(0)` — 1 > 0 é verdade, o teste
fica verde. As outras alíneas passam.

## (a) O buraco do 360 — medido por mim — PASS (a medição), ver (b) para a guarda

`/transacoes`, sessão demo, valores lidos do DOM:

| | classe do `<span>` | largura da marca | `docScrollWidth` | filhos do header fora |
| --- | --- | --- | --- | --- |
| **320** | `sr-only text-sm font-medium min-[360px]:not-sr-only md:hidden` | **1 px** | **320** | `[]` |
| **360** | igual | **63 px** | **360** | `[]` |

Os três números do Dev batem (1 px a 320, 63 px a 360, `docScrollWidth` 360). A 320 o `ariaSnapshot`
do span é `- text: Finanças Pessoais` — continua anunciado.

## (b) A prova nova: tirar `min-[360px]:not-sr-only` a 360 — **NÃO FALHA (FAIL)**

Medição direta, no browser, a 360 depois de tirar a classe em memória:

```
360 sem min-[360px]:not-sr-only {"viewport":360,"classe":"sr-only text-sm font-medium md:hidden",
  "marcaLargura":1,"docSW":360,"filhosFora":[]}
  > 0 ? true   > 1 ? false
```

`sr-only` não é `display:none` — deixa **1 px** de caixa. A asserção da volta 2 é
`expect(a360.marcaLargura, 'a 360 a marca da app aparece').toBeGreaterThan(0)`, e **1 > 0**, portanto
passa. Confirmei correndo a spec (cópia com a mesma asserção, a classe tirada a 360, em
`relatorios/.qa-t89/probe/mut360.spec.ts` + `pw.config.ts`):

```
  ok 1 …mut360.spec.ts:125:7 › T89 — a 320 px nada transborda › a 320 cabe tudo, e a 360 a marca volta sem transbordar (1.2s)
  1 passed (4.5s)
```

**A guarda do 360 continua aberta.** O par de asserções está inconsistente: a 320 exige `<= 1` e a 360
exige `> 0`; **1 px satisfaz as duas**. A correção mínima é `toBeGreaterThan(1)` — ou, mais legível,
`toBeGreaterThan(10)` (o valor real é 63) ou `toBeGreaterThan(a320.marcaLargura)`. Nota: o
`ariaSnapshot` não serve de discriminador — a 320 já contém «Finanças Pessoais» (é `sr-only` de
propósito), por isso a largura é o único sinal.

## (c) As duas mutações antigas continuam a morder — PASS

```
$ E2E_REUSE_SERVER=1 T89_MUTAR=nav pnpm test:e2e --project=estreito --reporter=line
    Error: «Transações» não passa da célula
    Expected: <= 128.5
    Received:    129.4

$ E2E_REUSE_SERVER=1 T89_MUTAR=cabecalho pnpm test:e2e --project=estreito --reporter=line
    Error: nenhum filho do cabeçalho passa da janela
    +   341.3,

$ E2E_REUSE_SERVER=1 pnpm test:e2e --project=estreito --reporter=line
  1 passed (3.6s)
```

## (d) Rótulo vazio — PASS (a asserção existe e morde)

`expect(rotulo.texto.trim(), 'cada rótulo tem texto').not.toBe('')` está no `verificar`. Com um
`<span>` da nav esvaziado em memória (cópia `probe/rotulo-vazio.spec.ts`):

```
  x 2 …rotulo-vazio.spec.ts:125:7 › T89 …
    Error: cada rótulo tem texto
    Expected: not ""
  1 failed
```

## (e) Contagem e projetos — inalterados

| projeto | testes | inclui `89-guarda-320`? |
| --- | --- | --- |
| `chromium` | 132 | 0 |
| `telemovel` | 9 | 0 |
| `escuro` | 5 | 0 |
| `estreito` | **1** | 1 |
| **total** | **147** | |

Spec continua a correr **uma vez**, no `estreito`. **Não repeti a suite de 8 min**: a contagem não
mudou e nenhum outro teste consome este spec, como disseste; a corrida de frio de **147 passed
(8.8m)** do fecho continua válida.

## (f) Gate — PASS

`pnpm format:check && pnpm lint && pnpm typecheck` → `GATE_EXIT=0`, `All matched files use Prettier
code style!`, 4 tarefas ok em lint e em typecheck.

## O que fazer com isto

Uma linha no spec: `toBeGreaterThan(1)` (ou `> 10`) na asserção da marca a 360. Depois disso, a
mutação de (b) fica vermelha — é a prova que falta. Não toquei no spec nem em `apps/`; as cópias das
provas vivem em `relatorios/.qa-t89/probe/`. Porta 3000 fechada no fim.

---

# Volta 3 — a asserção dos 360 fechada

Data: 2026-11-22 · Mesma árvore; só o spec mudou outra vez. Servidor meu em `:3000`,
`E2E_REUSE_SERVER=1` para isolar as provas do build.

**Veredicto da volta 3: PASS.** A asserção passou a `toBeGreaterThan(10)` e a **mesma** mutação que
deu verde na volta 2 fica agora vermelha.

## (a) A linha mudou e morde — PASS

No ficheiro: `expect(a360.marcaLargura, 'a 360 a marca da app aparece').toBeGreaterThan(10);` (linha
178), com um modo novo `T89_MUTAR=limiar` que tira `min-[360px]:not-sr-only` a 360.

```
$ E2E_REUSE_SERVER=1 T89_MUTAR=limiar pnpm test:e2e --project=estreito --reporter=line
    Error: a 360 a marca da app aparece
    Expected: > 10
    Received:   1
  1 failed
EXIT=1
```

É exatamente o caso que na volta 2 passava (`> 0` contra 1 px): agora falha com `> 10` contra **1**.
O valor real a 360 continua 63 px, medido por mim na volta 2.

## (b) Limpo e as outras duas mutações — PASS

```
$ E2E_REUSE_SERVER=1 pnpm test:e2e --project=estreito --reporter=line
[e2e] limpeza: 1 utilizador(es) de teste apagado(s); 0 restante(s).
  1 passed (3.7s)                                           EXIT=0

$ … T89_MUTAR=nav …
    Error: «Transações» não passa da célula
    Expected: <= 128.5
    Received:    129.4                                      EXIT=1

$ … T89_MUTAR=cabecalho …
    Error: nenhum filho do cabeçalho passa da janela
    +   341.3,                                              EXIT=1
```

Usei o modo do Dev (`T89_MUTAR=limiar`), não uma mutação minha.

## (c) Contagem — inalterada, sem projeto novo

| projeto | testes | inclui `89-guarda-320`? |
| --- | --- | --- |
| `chromium` | 132 | 0 |
| `telemovel` | 9 | 0 |
| `escuro` | 5 | 0 |
| `estreito` | **1** | 1 |
| **total** | **147** | |

Spec uma vez, no `estreito`; **não repeti a suite de 8 minutos** — a corrida de frio de 147
(8.8 m) do fecho mantém-se válida.

## (d) Gate — PASS

`pnpm format:check && pnpm lint && pnpm typecheck` → `GATE_EXIT=0`, `All matched files use Prettier
code style!`, 4 tarefas ok em lint e typecheck.

**T89: PASS** (volta 3). Porta 3000 fechada.
