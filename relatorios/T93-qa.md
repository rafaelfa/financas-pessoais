# T93 — QA: alvos de toque do cabeçalho a 320 px

Data: 2026-11-22 · Base `2c1a4e6` + T93 na árvore, sem commit · Build das medições:
`YtDB-fPJfOb3hZIVbrK49` (o do Dev, árvore igual); suite de frio: `KNfY_-7cqRGJ7L6k9Q-j1`.

**Veredicto: PASS** nas cinco alíneas. Duas notas honestas: o `truncate` do nome não trunca a 360
(faz duas linhas) e o «antes» do «Mais» só aparece com 38 px se se tirarem também `px-0`/`justify-center`.

---

## (a) Os seis controlos, um a um, a 320 — PASS

Medidos no browser (`/transacoes`, 320×640), **antes e depois no mesmo build**: o «depois» é o que
está; o «antes» é o mesmo elemento com as classes de toque tiradas em memória (e, no «Mais», também
`max-sm:px-0`/`max-sm:justify-center`, senão a caixa encolhia a 18 em vez dos 38 de antes).

| controlo | antes | depois |
| --- | --- | --- |
| gaveta (`SidebarTrigger`) | **28 × 28** | **44 × 44** |
| «Mais» (`summary`) | **38 × 44** | **44 × 44** |
| busca (`⌘K`) | **38 × 28** | **44 × 44** |
| ocultar montantes | **32 × 32** | **44 × 44** |
| tema | **32 × 32** | **44 × 44** |
| sair | **36 × 36** | **44 × 44** |

Os seis estão presentes (os cinco nomeados no critério mais a gaveta) e todos chegam a 44×44. Os
ícones continuam `size-4`: cresceu a área, não o desenho.

## (b) Sem transbordar — PASS

`/transacoes`, medido por mim nas cinco larguras:

| largura | `document.scrollWidth` | janela | filhos do cabeçalho fora |
| --- | --- | --- | --- |
| 320 | **320** | 320 | **0** |
| 359 | **359** | 359 | **0** |
| 360 | **360** | 360 | **0** |
| 390 | **390** | 390 | **0** |
| 1440 | **1440** | 1440 | **0** |

## (c) Ordem igual, marca presente — PASS (com uma nota)

A sequência é a mesma em todas as larguras: **gaveta · Mais · busca · ocultar montantes · tema ·
sair** (a 1440 o «sair» continua fora do cabeçalho, na barra lateral, como antes). Só mudam os
tamanhos.

O nome da app (o `sr-only … min-[360px]:not-sr-only`):

| largura | largura da marca | estado |
| --- | --- | --- |
| 320 / 359 | **1 px** | `sr-only`, anunciado mas invisível (é o desenho da T88) |
| **360** | **35 px** | visível, **duas linhas**: «Finanças / Pessoais» |
| **390** | **65 px** | visível, **duas linhas**, texto inteiro |
| 1440 | 0 | escondida por `md` |

Não desapareceu nem ficou a zero. **Nota:** o `truncate` que o Dev pôs **não trunca** — o
`min-[360px]:not-sr-only` repõe `white-space: normal` e `overflow: visible` por cima dele. Consequência
medida a 360: a caixa do span tem 35 px, a largura natural do nome é **123,8 px** e os glifos passam o
bordo da caixa até ~133 px, enquanto o controlo seguinte começa em **116 px**. Nada fica coberto (o
vizinho é um `summary` com fundo transparente e pinta por cima do texto) e o alvo do vizinho continua
inteiro — o teste de (iv) confirma-o —, mas a intenção do `truncate` não se cumpre.

## (d) Dois temas, contraste e foco — PASS

Contraste dos ícones contra o fundo do cabeçalho (o mesmo nos dois tamanhos, 320 e 390):
**5,84 a 16,88:1** no claro, **6,95 a 16,88:1** no escuro. Bordas dos controlos: **3,38:1** no claro;
no escuro **1,47 / 1,58:1** — é a dívida conhecida de `--border` no escuro (T78/T91), não uma regressão
desta tarefa.

Foco visível por teclado: com `Tab`, os seis têm `:focus-visible` e **anel de 3 px** com a cor do
`--ring` (o `summary` usa `outline` sólido de 2 px). Igual ao resto da app — as classes de toque não
lhe tocaram. Captura `foco-tab.png`.

## (iv) Alvo real, não só caixa — PASS

Para cada um dos seis, nove pontos no browser a 320 — centro, os quatro meios de aresta a 2 px do
bordo e os quatro cantos a 4 px (a 1 px os cantos ficam fora do raio do canto arredondado, e é normal
que devolvam o pai): **todos os 54 pontos** caem no controlo certo (`elementFromPoint`), nenhum num
vizinho. Sem alvos sobrepostos.

Cliques a sério (o «sair» não se clica — encerrava a sessão; para ele fica só o `elementFromPoint`):

| controlo · ponto | resultado |
| --- | --- |
| gaveta · centro | abre a gaveta (`dialog` 0→1) |
| gaveta · meio da aresta direita (2 px do bordo) | abre a gaveta (0→1) |
| «Mais» · meio da aresta inferior | abre o `<details>` (`open` false→true) |
| busca · centro | abre a paleta (`dialog` 0→1) |
| ocultar montantes · meio da aresta superior | `aria-pressed` false→true (e reposto a false) |
| tema · centro | abre o menu (`[role=menu]` 0→1) |

Nenhum clique foi para o vizinho. O `::after` recusado pelo Dev não faz falta.

## (iii) A guarda morde — PASS

```
$ E2E_REUSE_SERVER=1 T89_MUTAR=toque pnpm test:e2e e2e/89-guarda-320.spec.ts --reporter=line
    Error: «Mostrar ou esconder » com 44 px de largura
    Expected: >= 44
    Received:    28
  1 failed
EXIT=1

$ E2E_REUSE_SERVER=1 pnpm test:e2e e2e/89-guarda-320.spec.ts --reporter=line
[e2e] limpeza: 1 utilizador(es) de teste apagado(s); 0 restante(s).
  1 passed (4.6s)
EXIT=0
```

É a asserção que passa a cobrir T85 (truncate da nav), T88 (nome do cabeçalho) e T93 (44×44).

## Capturas

`relatorios/T93/qa-pagina-{320,390}-{light,dark}.png`, `qa-cabecalho-{320,360,390,1440}-*.png`
(recorte do cabeçalho) e `relatorios/.qa-t93/foco-tab.png`.

## (e) Gate e suite — PASS

```
$ pnpm format:check && pnpm lint && pnpm typecheck && pnpm test
All matched files use Prettier code style!
@repo/shared:test:  Tests 598 passed (598)
GATE_EXIT=0

$ rm -rf apps/web/.next && env -u E2E_REUSE_SERVER pnpm test:e2e
[e2e] limpeza: 4 utilizador(es) de teste apagado(s); 0 restante(s).
  149 passed (8.7m)
SUITE_EXIT=0     BUILD_ID KNfY_-7cqRGJ7L6k9Q-j1
```

**149 passed**, a baseline, sem `0` sobras.

## Limpeza e ambiente

Medi com o utilizador **demo** só a ler (o teste de montantes foi reposto); nenhum dado criado ou
apagado. Depois das corridas: **0** utilizadores `e2e-%`. Zero escrita em `apps/` e `e2e/`, zero git.
Porta 3000 **fechada**. Dois logins do demo expiraram por timeout e passaram à tentativa seguinte.

## Ficheiros desta volta

`relatorios/T93-qa.md`; capturas em `relatorios/T93/` (`qa-*`); scripts, JSON e logs em
`relatorios/.qa-t93/` (`medir.cjs`, `alvo.cjs`, `foco.cjs`, `marca.cjs`, `antes-mais.cjs`,
`medicoes.json`, `alvo.json`, `guarda-*.log`, `gate.log`, `suite.log`).

---

# Volta 2 — o corte da marca mudou para dentro

Data: 2026-11-22 · Mesma árvore; o Dev passou o corte para um `<span class="block truncate">`
**interior** (a caixa de fora mantém `sr-only … min-[360px]:not-sr-only min-w-0 md:hidden`). Build das
medições: `-cNz1v7OgaIEAcz7wlYoO` (o mesmo do Dev); suite de frio: `nTI6yvbZxQQA6iIq5cnn4P`.

**Veredicto da volta 2: PASS.** As reticências são reais, uma linha, e os glifos ficam **8 px antes**
do «Mais» nos dois lados.

## (i) A 360 e a 390: corte real e geométrico — PASS

| | 360 | 390 |
| --- | --- | --- |
| caixa exterior (`header > span`) | **35,0 px** | **65,0 px** |
| `<span class="block truncate">` — `scrollWidth` / `clientWidth` | **124 / 35** | **124 / 65** |
| `text-overflow` efetivo | **ellipsis** | **ellipsis** |
| `white-space` / `overflow` | **nowrap / hidden** | **nowrap / hidden** |
| `getClientRects().length` | **1** (uma linha) | **1** |
| bordo direito dos glifos (onde o texto é cortado) | **108,0** | **138,0** |
| `left` do «Mais» | **116,0** | **146,0** |
| folga glifos ↔ «Mais» | **8,0 px** | **8,0 px** |

Confirma os números do Dev (35/124/35 e «Mais» a 116; 65/124/65 e «Mais» a 146). O `truncate` da volta
1 não cortava porque `not-sr-only` repunha `white-space: normal`/`overflow: visible` na caixa de fora;
agora o corte vive dentro e o texto **não passa** o bordo da caixa, muito menos o «Mais». Capturas
`relatorios/.qa-t93b/cabecalho-{360,390}.png` (via-se «Finan…»).

## (ii) Sem transbordo e `min-w-0` no sítio — PASS

| largura | `document.scrollWidth` | janela | filhos do cabeçalho fora | `min-w-0` na caixa |
| --- | --- | --- | --- | --- |
| 320 | **320** | 320 | **0** | **sim** |
| 359 | **359** | 359 | **0** | sim |
| 360 | **360** | 360 | **0** | sim |
| 390 | **390** | 390 | **0** | sim |
| 1440 | **1440** | 1440 | **0** | sim |

## (iii) A 320 o nome continua na árvore — PASS

`header > span` mede **1 × 1 px** (`sr-only`) e o `ariaSnapshot` devolve
`- text: Finanças Pessoais`. O `<span>` interior, a 320, tem 1 px de largura, `scrollWidth` 124 e
`overflow: hidden` — não pinta nada, mas o nome é anunciado.

## (iv) A 640+ nada mudou — PASS

A 1440 a marca tem `display: none` (0 px) e o «Mais» mede **75,8 × 36** — os mesmos valores da volta 1
e do Dev.

## (v) A prova da volta 1 continua verdadeira — PASS

- Seis controlos a 320: **44 × 44** cada (gaveta, «Mais», busca, montantes, tema, sair).
- **54 pontos** (centro, 4 meios de aresta a 2 px, 4 cantos a 4 px, × 6): todos dentro do controlo
  certo, **zero** fora.
- Guarda: `T89_MUTAR=toque` → `Error: «Mostrar ou esconder » com 44 px de largura`,
  `Expected: >= 44`, `Received: 28`, EXIT=1; limpo → **1 passed (4.5s)**, `0 restante(s)`, EXIT=0.

## (vi) Gate e suite — PASS

```
$ pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build
All matched files use Prettier code style!
@repo/shared:test:  Tests 598 passed (598)
GATE_EXIT=0

$ rm -rf apps/web/.next && env -u E2E_REUSE_SERVER pnpm test:e2e
[e2e] limpeza: 4 utilizador(es) de teste apagado(s); 0 restante(s).
  149 passed (8.7m)
SUITE_EXIT=0     BUILD_ID nTI6yvbZxQQA6iIq5cnn4P
```

**149**, a baseline, com `0` sobras. Porta 3000 **fechada**. Demo só a ler; 0 utilizadores `e2e-%`;
zero escrita em `apps/`/`e2e/`, zero git.

## Ficheiros desta volta

`relatorios/.qa-t93b/` (`medir.cjs`, `medicoes.json`, `medir.log`, `guarda-limpo.log`,
`guarda-toque.log`, `gate.log`, `suite.log`, `cabecalho-{320,360,390}.png`).
