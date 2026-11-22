# T78 — QA: o lote do tema (A4 + V3 + V7 + texto pequeno)

Data: 2026-11-22 · Base `6af91c5` (T85) + T78 na árvore, sem commit · Build das medições:
`iSELMihZazl03rh4EMaEz` (meu, `next start` na 3000); o da suite: `qc78P2omnUtQSZY5zLu5K` (frio).

**Veredicto: PASS** em (a)–(d) e (f)–(g); (e) é parecer visual. O **tema escuro continua por
resolver** (bordas a 1,47:1 sobre o fundo) — está na alínea (a) como não resolvido, **não** como
falha, como pediste.

---

## (a) A4 — bordas do claro ≥3:1, escuro não tocado — PASS

Cores lidas do `:root` no browser e convertidas para sRGB pelo canvas (o `getComputedStyle` devolve
`oklch`), razões pela fórmula WCAG. `--border` e `--input` têm o mesmo valor no claro.

| Superfície | Cor | `--border` | `--input` |
| --- | --- | --- | --- |
| fundo (`--background`) | `252,252,249` | **3,38:1** | **3,38:1** |
| cartão (`--card`) | `255,255,255` | **3,48:1** | **3,48:1** |
| `muted` | `239,245,245` | **3,15:1** | **3,15:1** |
| `secondary` | `236,243,244` | **3,09:1** | **3,09:1** |

`--border`/`--input` resolvem para **rgb(131,139,141)** — o `oklch(0.63 0.01 220)`. Os quatro pares
passam 3:1; o `secondary` dá **3,09**, contra os 3,06 que o Dev declarou (diferença de arredondamento
na conversão, ambos acima do limite).

**Escuro: NÃO RESOLVIDO** (o `.dark` não foi tocado — `git diff` do `globals.css` tem só dois hunks,
ambos antes da linha 141, onde começa `.dark`):

| Escuro | `--border` | `--input` |
| --- | --- | --- |
| vs fundo | **1,47:1** | 1,58:1 |
| vs cartão | **1,23:1** | 1,32:1 |
| vs muted | 1,04:1 | 1,12:1 |
| vs secondary | 1,00:1 | 1,08:1 |

Confere com os 1,47 / 1,23 do Dev. Um campo com contorno `--input` no escuro fica abaixo dos 3:1 da
WCAG 1.4.11 — é dívida conhecida, fora do âmbito desta volta.

## (b) V3 — raios por tokens — PASS

```
$ grep -rn "rounded-\[" apps/web/src --include=*.tsx --include=*.ts --include=*.css | grep -v "components/ui/" | wc -l
0
$ grep -rn "rounded-\[" apps/web/src/components/ui | wc -l
13
```

Os **13 estão todos em `components/ui/`**, como o §5 declara. Verifiquei um a um no código e a
justificação é verificável: `chart.tsx:206,310` e `tooltip.tsx:46` são `2px` de geometria (ponto da
legenda, marcador, seta); `checkbox.tsx:13` é `4px` fixo; `input-group.tsx:26,69,71` derivam de
`calc(var(--radius) ± px)`; `scroll-area.tsx:20` é `inherit`; `button.tsx:25,26,30,32` e
`select.tsx:39` são `min(var(--radius-md), 10|12px)` — o raio do tema limitado pela altura. Nenhum
valor solto numa superfície de conteúdo.

**Raios renderizados e derivados do token** (medi no browser, no `/transacoes`):

| | valor normal | `--radius: 0` | `--radius: 20px` |
| --- | --- | --- | --- |
| cartão (`[data-slot=card]`) | **16,8 px** | **0 px** | **28 px** |
| botão | **9,6 px** | **0 px** | **16 px** |

Mexer só em `--radius` na raiz muda os dois → as famílias vêm de tokens (16,8 = `--radius` 12 × 1,4
para `rounded-xl`; 9,6 = 12 × 0,8 para `rounded-md`).

## (c) V7 — sem dupla `font-numeric tabular-nums` — PASS

```
$ grep -rn "font-numeric" apps/web/src | grep -c "tabular-nums"
0
```

Corri eu o `grep` (não citei o dele); 52 elementos com `font-numeric` na página, nenhum com a dupla.

**A linha renderizada não mudou** (célula de data da tabela, «20/04/27»):

| | `font-variant-numeric` | largura |
| --- | --- | --- |
| com `font-numeric` | `tabular-nums` | **96,00 px** |
| sem a classe (medido no mesmo build) | `normal` | **96,00 px** |

`igual: true` — o `font-numeric` já traz `tabular-nums`, tirar a classe duplicada não muda a pintura
nem a largura. Confirma os 96 px e o `igual: true` do Dev.

## (d) Texto pequeno a 12 px e nav intacta — PASS (com uma nota)

A 320 e a 390, `/transacoes`, os cinco links da nav:

| | classes no `<a>` | `font-size` | `line-height` | cor |
| --- | --- | --- | --- | --- |
| Painel, Orçamento, Objetivos, Contas | `text-caption` **+** `text-muted-foreground` | **12 px** | **16 px** | `lab(65.1777 -2.07776 -7.08538)` = `--muted-foreground` (igual ao token) |
| Transações (ativo) | `text-caption` + `text-primary` | **12 px** | **16 px** | `text-primary` (por desenho do estado ativo) |

Nota: o link **ativo** não leva `text-muted-foreground` — leva `text-primary`, como já levava antes
desta tarefa; o que a correção do `cn` tinha de garantir (o tamanho não ser descartado quando há uma
classe `text-*` de cor no mesmo `className`) está provado nos cinco: **12 px em todos**.

`<span>` continua com `max-w-full truncate` nos cinco. A 320: «Transações» **56,0 / `scrollWidth`
67** (11 ocultos), «Orçamento» 56/64, **zero sobreposições**, `nav.scrollWidth` **320**. A T85 não
regrediu. Faixa: `nav-320.png`, `nav-390.png`.

## (e) Desenho — parecer visual (não é veredicto)

Capturas em `relatorios/T78-qa/`: `/` (Painel), `/transacoes`, `/contas` a **1440 e 390**, claro e
escuro (12), mais a tabela de `/transacoes` (`tabela-*`) e um botão `disabled` (`disabled-*`), nos
dois temas.

**O que vi, no claro:**

- **Cartões**: a borda nova dá-lhes contorno firme mas não pesado; os cartões de conta em `/contas`
  continuam a ler-se como superfícies separadas e não como caixas. Nada de «cartões encostados».
- **Separadores de tabela**: continuam finos e discretos; a linha lê-se, não compete com o texto nem
  com os valores. A densidade da tabela de 25 linhas não ficou mais ruidosa.
- **Campos e botões de contorno**: é onde a mudança mais se nota — os `input`/`select` passam a ter
  limite percetível, que era o objetivo da A4. Não achei nenhum ecrã «duro».
- **`disabled`**: o «Anterior» desativado tem opacidade 0,5; com a borda nova o contorno fica mais
  escuro do que a média, mas a opacidade repõe-no claramente abaixo dos ativos e o texto continua
  legível. Por cálculo, a borda a 50 % sobre o cartão dá ≈1,7:1 — abaixo de 3:1, mas a WCAG isenta
  controlos desativados; registo-o, não o trato como falha.
- **Escuro**: igual ao que era (o `.dark` não mudou); é o tema onde as bordas continuam quase
  invisíveis, como a alínea (a) diz.

Nenhum sítio com borda «a mais» que eu tenha achado: não vi cartão dentro de cartão com contorno
duplo, nem separador duplicado.

## (f) Suite completa, de frio — PASS

`rm -rf apps/web/.next` e `env -u E2E_REUSE_SERVER pnpm test:e2e`, porta 3000 livre no arranque:

```
[e2e] limpeza: 4 utilizador(es) de teste apagado(s); 0 restante(s).
  146 passed (8.9m)
EXIT=0          BUILD_ID qc78P2omnUtQSZY5zLu5K
```

**146 passed**, baseline. Specs de tema/nav contadas à parte, todas verdes: `15-navegacao` **10**
testes (5 × dois temas), `33-navegacao-15` **2**, `39-calendario` **7** — 19 no total.

## (g) Gate — `format:check` a 0 — PASS

```
$ pnpm format:check
Checking formatting...
All matched files use Prettier code style!
FORMAT_EXIT=0
```

Com o `.prettierignore` a ignorar `relatorios/*-qa/` (e `relatorios/.qa-*/`), os meus JSON de prova
não pintam o gate. Não voltou a 1.

## Limpeza e ambiente

Só leitura com o utilizador **demo**: nenhum dado criado ou apagado; `localStorage.theme` e a
propriedade `--radius` foram mexidos só no browser efémero (a segunda reposta de imediato). Depois da
suite: **0** utilizadores `e2e-%`. Zero escrita em `apps/` e `e2e/`, zero git. `AGENTS.md`,
`next-env.d.ts`, `TASKS.md` e `mobile-nav.tsx` já vinham sujos — não fui eu. Porta 3000 **fechada**.
Um login do demo expirou por timeout numa tentativa e passou à seguinte; sem efeito nos números.

## Ficheiros desta volta

`relatorios/T78-qa.md`; em `relatorios/T78-qa/`: `medicoes.json` e **20 PNG** —
`painel|transacoes|contas-{1440,390}-{light,dark}.png` (12), `tabela-{1440,390}-{light,dark}.png`
(4), `nav-{320,390}.png` (2), `disabled-{light,dark}.png` (2).
Scripts e logs em `relatorios/.qa-t78/`: `medir.cjs`, `tabela.cjs`, `disabled.cjs`, `build.log`,
`servidor.log`, `medir.log`, `suite.log`, `format.log`.
