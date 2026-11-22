# T91 — QA: os divisores com token próprio

Data: 2026-11-22 · Base `2b475c3` (T90) + T91 na árvore, sem commit · Build das medições:
`f7aVSqgg53PTSPTtUhqpuo` (igual ao do Dev — mesma árvore, cache); suite de frio:
`xjEES-urxYHNJtWZA47pv`.

**Veredicto: FAIL.** (a), (b), (c), (e) e (h) passam, mas duas provas do relatório de entrega **não
se confirmam**: (d) a linha da barra lateral **continua com `--border`**, não com o subtil, e (f) a
paleta **não tem divisor nenhum** — o que o Dev mediu está no cabeçalho, fora do diálogo. (g), como
está escrita, também não se confirma, mas por uma razão que é a própria tarefa (ver abaixo).

---

## (a) Contraste do subtil — PASS

`--border-subtle` resolve para **rgb(177,185,188)** no claro e **rgb(40,47,53)** no escuro (lidos no
browser, convertidos de `oklch` por canvas):

| par | claro | escuro |
| --- | --- | --- |
| vs `background` | **1,94:1** | **1,36:1** |
| vs `card` | **1,99:1** | 1,14:1 |
| vs `muted` | **1,81:1** | 1,03:1 |
| vs `secondary` | **1,77:1** | 1,07:1 |

Dentro da fasquia (≥1,5 e <3 no claro). Bate com o Dev (1,94 / 1,99 / 1,81 / 1,77).

## (b) `--border`/`--input` não desceram — PASS

`--border` = `--input` = **rgb(131,139,141)** no claro:

| par | `--border` (claro) | `--input` (claro) |
| --- | --- | --- |
| vs `background` | **3,38:1** | 3,38:1 |
| vs `card` | **3,48:1** | 3,48:1 |
| vs `muted` | **3,15:1** | 3,15:1 |
| vs `secondary` | **3,09:1** | 3,09:1 |

O remendo não contaminou os controlos.

## (c) Os controlos ficaram com a borda de controlo — PASS

Código: `ui/resizable.tsx:31,36` e `ui/scroll-area.tsx:48` continuam `bg-border`; os seis divisores
estão `bg-border-subtle` (`separator:19`, `combobox:193`, `command:136`, `dropdown-menu:170`,
`select:131`, `navigation-menu:144`).

Runtime: as duas utilities, criadas em memória no browser, resolvem para cores diferentes —

```
bg-border        → rgb(131,139,141)   (a de controlo, 3,38:1)
bg-border-subtle → rgb(177,185,188)   (o divisor, 1,94:1)
```

Nenhuma página monta `Resizable` nem `ScrollArea` (só os dois ficheiros do `ui/` os referem), por isso
não há barra de scroll nem puxador para medir no ecrã — o que se prova é que **a classe que eles usam
resolve para a cor de controlo**. A barra de scroll do browser não é este componente.

## (d) `--sidebar-border` igual ao subtil — **FAIL**

A variável está certa, a **linha desenhada não**:

```
--sidebar-border (variável)  → lab(74.5413% -2.54995 -2.45974)  = rgb(177,185,188) = subtil
border-right de [data-slot="sidebar-container"] → lab(57.1411 -2.5456 -2.45708) = rgb(131,139,141) = --border
elementos no ecrã com a classe border-sidebar-border: []  (nenhum)
```

Causa: `ui/sidebar.tsx:231` põe na `sidebar-container` só `group-data-[side=left]:border-r` — **sem
classe de cor**, portanto o `border-color` cai no predefinido global (`--border`). O único sítio do
código que usa `border-sidebar-border` é o `SidebarMenuSub` (`sidebar.tsx:599`), que não é renderizado
nesta app. Ou seja: mudar `--sidebar-border` para `var(--border-subtle)` **não muda um píxel**; o
relatório mediu a variável, não a linha. Correção mínima (Dev): `border-sidebar-border` junto ao
`border-r`/`border-l` da `sidebar-container`.

## (e) Escuro — PASS (dívida declarada, e os divisores medidos)

O §4 do `T91.md` diz por palavras que `--border`/`--input` ficam **por resolver** — não os apresenta
como resolvidos. Medido: **1,47:1** sobre o fundo e **1,23:1** sobre o cartão (os números da T78,
iguais). Os divisores no escuro desceram a **1,36 / 1,14 / 1,03 / 1,07**.

## (f) O sítio onde a mudança se vê: a paleta — **FAIL**

A paleta `Ctrl+K` **não tem divisor**. No diálogo: 0 elementos com `role="separator"`, 0 com
`bg-border-subtle`, 0 `[cmdk-separator]`; o `CommandPalette` (`components/command-palette.tsx`) tem um
só `CommandGroup` e nenhum `CommandSeparator`. O único `.bg-border-subtle` presente com a paleta
aberta é o separador **do cabeçalho**, fora do diálogo (`foraDaPaleta: true`), com o mesmo
`rgb(177,185,188)` — é esse que o Dev mediu, não um divisor da paleta. A entrada de pesquisa tem uma
borda com alfa (`oklab(0.629998 … / 0.3)`), que não é este token.

Onde a mudança **se vê** de facto (medido no (g)): o `Separator` vertical do cabeçalho, 1×20 px, em
todas as páginas — e, no código, os separadores de `command`/`combobox`/`select`/`dropdown-menu`
quando esses menus os renderizarem.

## (g) `sha256` de `/transacoes` igual à T90 — **FAIL como escrito** (mas sem dano colateral)

As quatro capturas **não** batem com as da T90; e batem, ao byte, com as «depois» do próprio Dev:

| caso | minha | T90 | T91 do Dev |
| --- | --- | --- | --- |
| 1440 claro | `a924758e…` | `55055817…` ≠ | `a924758e…` = |
| 1440 escuro | `952099d7…` | `c3f2065d…` ≠ | `952099d7…` = |
| 390 claro | `424f9e7c…` | `ee8053c4…` ≠ | `424f9e7c…` = |
| 390 escuro | `a9dab053…` | `1aeb8440…` ≠ | `a9dab053…` = |

A diferença, medida pixel a pixel contra a T90, é **exatamente 20 px** por imagem, todos na mesma
coluna e nas mesmas linhas:

```
1440 claro/escuro: 20 px, caixa [316, 0, 316, 19]   (1 px de largura × 20 de altura)
390  claro/escuro: 20 px, caixa [ 52, 0,  52, 19]
```

É o `Separator` vertical do cabeçalho (`!h-5` = 20 px), o tal divisor que passou a subtil. Não há
qualquer outro pixel diferente na página: cartões, tabela, botões e a barra lateral estão iguais.
Portanto a premissa «nada disto devia pintar a página» não se aplica — o divisor do cabeçalho **é** um
dos divisores da tarefa. O critério como está escrito falha; a intenção (nenhuma mudança colateral)
passa, com o diff a prová-lo.

## (h) Gate e suite — PASS

```
$ pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build
All matched files use Prettier code style!
@repo/shared:test:  Tests 598 passed (598)
Tasks: 4 successful · 4 successful · 2 successful · 2 successful
GATE_EXIT=0

$ rm -rf apps/web/.next && env -u E2E_REUSE_SERVER pnpm test:e2e
[e2e] limpeza: 4 utilizador(es) de teste apagado(s); 0 restante(s).
  147 passed (8.7m)
SUITE_EXIT=0     BUILD_ID xjEES-urxYHNJtWZA47pv
```

## O que devolver ao Dev (para fechar a T91)

1. `ui/sidebar.tsx` — a `sidebar-container` precisa de `border-sidebar-border` (senão o token novo
   não pinta nada e o (d) continua vermelho).
2. `relatorios/T91.md` §5 — a paleta não tem divisor; a prova visual é o separador do cabeçalho (ou
   acrescenta-se um `CommandSeparator` à paleta, se se quiser que ela o mostre).
3. O critério (g) pedido pelo Lead tem a premissa errada: o separador do cabeçalho está na página e
   muda de cor de propósito. Ou se aceita o diff de 20 px, ou se exclui o cabeçalho da comparação.

## Limpeza e ambiente

Sessão **demo** só para leitura; nenhum dado criado ou apagado. Depois da suite: **0** utilizadores
`e2e-%`. Zero escrita em `apps/`, zero git. `AGENTS.md`, `next-env.d.ts` e `TASKS.md` já vinham sujos
— não fui eu. Porta 3000 **fechada**.

## Ficheiros desta volta

`relatorios/T91-qa.md`; em `relatorios/T91-qa/`: `qa-{1440,390}-{light,dark}.png`,
`paleta-{light,dark}.png`, `medicoes.json`, `diff-t90.json`. Scripts e logs em `relatorios/.qa-t91/`
(`medir.cjs`, `inspecao.cjs`, `inspecao2.cjs`, `diff.cjs`, `diff2.cjs`, `gate.log`, `suite.log`).

---

# Volta 2 — os três achados

Data: 2026-11-22 · Mesma árvore; o Dev mexeu em `ui/sidebar.tsx` e no `T91.md`. Build das medições:
`pMkNhNwZBrWhx0z6qcgdm`.

**Veredicto da volta 2: PASS.** A linha da barra lateral passou a usar o token novo, a prova da
paleta foi substituída pela prova certa (o menu de `/contas`) e o §5 já não promete hashes iguais.

## (a) A barra lateral, agora a sério — PASS

`ui/sidebar.tsx:231` ganhou `border-sidebar-border` na `sidebar-container`. Medido no browser:

| viewport · tema | `border-right` desenhado | elementos com `border-sidebar-border` |
| --- | --- | --- |
| 1440 claro | **rgb(177,185,188)** (= subtil) | **1**, visível |
| 1440 escuro | **rgb(40,47,53)** (= subtil) | **1**, visível |

Antes: `131,139,141` / `45,52,58` (a `--border`). Agora a linha acompanha o divisor.

A **390** não há `sidebar-container`: no telemóvel a barra é o `Sheet` (`data-mobile="true"`), que
desenha a margem com sombra e nunca teve `border-right` — igual ao que era antes, não é regressão.

## (b) A prova nova, o divisor de `/contas` — PASS

`/contas` → kebab «Ações da conta …» → `DropdownMenuSeparator`:

| tema | classe | rect | `rgb` |
| --- | --- | --- | --- |
| claro | `-mx-1 my-1 h-px bg-border-subtle` | 128×1 px | **177,185,188** |
| escuro | idem | 128×1 px | **40,47,53** |

Um separador, três itens no menu (`Editar`, `Travar saldo`, `Arquivar`), tudo dentro do ecrã.
Capturas `v2-menu-{light,dark}.png`. É o divisor que o relatório passou a citar — e é mesmo
`bg-border-subtle`, não o separador do cabeçalho.

## (c) As frases corrigidas — PASS

`relatorios/T91.md` §5 diz agora, por palavras: a paleta **não tem divisor nenhum** (0
`role=separator`, 0 `bg-border-subtle` no diálogo, sem `CommandSeparator`), o que se tinha medido era
o separador **do cabeçalho**, fora do diálogo; o divisor real mede-se em `/contas`; e «a comparação de
hashes da T90 **não é o critério**», com os meus números (20 px por imagem, `[316,0,316,19]` a 1440 e
`[52,0,52,19]` a 390). Nada a corrigir.

## (d) A suite não precisou de correr — aceito o argumento, com a verificação

Nenhum dos 147 testes observa a cor da linha da barra lateral nem de um divisor:

```
$ grep -rn "border-subtle\|sidebar-border" e2e/           → (vazio)
$ grep -rn "toHaveCSS\|getComputedStyle" e2e/*.ts
  29-contas-truncagem:37  getComputedStyle(titulo)         → textOverflow (texto, não cor)
  32-contraste-contas-pagar:75  borderTopWidth              → largura da borda, não a cor
  39-calendario:184-185  display                           → visibilidade
  89-guarda-320:69  textOverflow                           → corte do rótulo
```

O `32` usa o `axe` para contraste de **texto**; a regra `color-contrast` do axe não olha a bordas, e
nenhum teste faz comparação visual de capturas. Portanto a mudança de uma classe de cor não tem
observador na suite: **a baseline de 147 da volta 1 mantém-se**, sem corrida nova.

## (e) Gate — PASS

`pnpm format:check && pnpm lint && pnpm typecheck` → `GATE_EXIT=0`, «All matched files use Prettier
code style!», 4 tarefas ok em lint e em typecheck.

**T91 volta 2: PASS.** Porta 3000 fechada.
