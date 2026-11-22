# T85 — QA: o rodapé móvel a 320 px não transborda

Data: 2026-11-22 · Base `2b5065a` (T86) + T85 na árvore, sem commit · Build medido:
`BUILD_ID ec6cizRozW0UFC8_iHX3U` (o do Dev; o build local reutilizou a cache) e o da suite
`nH9P0ddGrXsJh47yBKMPU` (frio).

**Veredicto: PASS** em (a)–(e). (f) é opinião medida, não bloqueio. O transbordo de página a 320
(341 px) **não é da nav** — está confirmado e fica na secção «fora do âmbito».

---

## (a) 320×640, `/transacoes` — PASS

| Medido no DOM | Valor |
| --- | --- |
| Célula (`<li>`) / link | **64,0 px** de largura |
| Link `scrollWidth` / `clientWidth` | **64 / 64** (sem transbordo do link) |
| `<span>` «Transações» | **56,0 px** de caixa, `scrollWidth` **67** → **11 px ocultos** |
| `<span>` «Orçamento» | **56,0** / `scrollWidth` **64** → 8 px ocultos |
| «Painel», «Objetivos», «Contas» | 34,8 / 54,2 / 40,7 — cabem inteiros |
| Sobreposição com a célula vizinha | **nenhuma** (`sobreposicoes: []`); folga de **8,0 px** entre o fim de «Transa…» (124,0) e o início de «Orçam…» (132,0) |
| `<nav>` `scrollWidth` | **320** = viewport |
| Altura dos 5 alvos | **56 px** cada |
| `overflow` / `text-overflow` / `white-space` no span | `hidden` / `ellipsis` / `nowrap` |

**Antes/depois no mesmo build** (tirei a classe ao span em memória, medi, repus — reproduz o markup
antigo sem tocar em `apps/`):

| | «Transações» | fim do rótulo | «Orçamento» começa | resultado |
| --- | --- | --- | --- | --- |
| sem a classe (antes) | **66,8** | 129,4 | 128,2 | **sobrepõe 1,2 px** |
| com `truncate` (depois) | **56,0** | 124,0 | 132,0 | folga 8,0 px |

Confere com o Dev (span 56, texto 67, 11 ocultos, link 64/64, sem sobreposição); o valor exato da
sobreposição antiga é **1,2 px**, não uma sobreposição larga.

## (b) Nada muda a 390 e a 1440 — PASS

**390×844** (`/transacoes`): links de **78 px**, spans inteiros («Transações» 66,8/67, «Orçamento»
63,6/64), zero sobreposições, `<nav>` `scrollWidth` **390** = viewport, `document` 390, altura **56**
em cada um dos 5 alvos. Igual nos dois temas.

**1440×900**: a nav existe no DOM mas `display: none`, altura **0**, rects dos links **0×0**,
`scrollWidth` 0 — não é visível nem clicável; o `document` mede 1440, sem transbordo.

## (c) Dois temas a 320 e a 390 — PASS

Contraste calculado com as cores efetivas (conversão `oklch`→sRGB por canvas e composição de alfa,
`relatorios/T85-qa/contraste.json`):

| Caso | Fundo | Inativo | Ativo («Transações») |
| --- | --- | --- | --- |
| 320 claro | `252,252,249` | `91,100,111` → **5,84:1** | `0,106,102` → **6,28:1** |
| 320 escuro | `15,20,26` | `149,160,171` → **6,95:1** | `61,187,174` → **7,86:1** |
| 390 claro | idem 320 claro | 5,84:1 | 6,28:1 |
| 390 escuro | idem 320 escuro | 6,95:1 | 7,86:1 |

Todos acima de 4,5:1 (AA). O ativo distingue-se pela cor (verde-água contra cinza) e tem razão
**maior** que os inativos. A cor do rótulo é **bit a bit igual com e sem a classe** (`comClasse ===
semClasse` nos quatro casos): a T85 não tocou em cor nenhuma, logo o contraste é o de antes. Capturas
`320-{light,dark}.png`, `390-{light,dark}.png` e as faixas `nav-*.png`.

## (d) Nome acessível inteiro — PASS

Pelo `role=link` + `name` exato do Playwright, com a página a 320 (o caso do corte):

```
getByRole('link', { name: 'Transações', exact: true }) → 1
getByRole('link', { name: 'Orçamento', exact: true }) → 1
getByRole('link', { name: 'Painel',     exact: true }) → 1
getByRole('link', { name: 'Contas',     exact: true }) → 1
getByRole('link', { name: 'Objetivos',  exact: true }) → 1
```

O `truncate` corta a pintura, não o texto: o nome acessível continua «Transações» e «Orçamento»
inteiros. A 390, os mesmos cinco, todos a 1. (A 1440 o `getByRole` não conta a nav, que está
escondida.)

## (e) Sem regressões — PASS

Suite completa, **uma corrida de frio** (`.next` apagado antes, `env -u E2E_REUSE_SERVER`), nesta
árvore com a T85:

```
[e2e] limpeza: 4 utilizador(es) de teste apagado(s); 0 restante(s).
  146 passed (8.8m)
EXIT=0          BUILD_ID nH9P0ddGrXsJh47yBKMPU
```

**146 passed**, o baseline. As specs da nav correram **12 testes, todos verdes**: 10 de
`15-navegacao.spec.ts` (5 testes × dois temas) e 2 de `33-navegacao-15.spec.ts` (`nenhum órfão: cada
rota tem uma porta…` e `a paleta lista exatamente as 17 rotas`). Confirma os 12 do Dev, com a minha
corrida. Porta 3000 **fechada** no fim.

## (f) Julgamento de desenho — opinião medida (não é veredicto)

A 320 os rótulos ficam **«Transa…»** e **«Orçam…»**, cada um a 12 px com reticências. O que observei:

- **Não há ambiguidade entre vizinhos**: os cinco rótulos começam por P, T, O, O(bjetivos), C —
  «Transa…» só pode ser Transações, e «Orçam…» distingue-se de «Objetivos» pela segunda letra e pelo
  ícone (porquinho vs alvo).
- **Os ícones continuam a fazer o trabalho**: setas ↔ para Transações, porquinho para Orçamento —
  quem já usa a app reconhece o alvo antes de ler.
- **O dano é de 11 px num rótulo e 8 no outro**, e só abaixo de ~360 px.

Recomendação: **manter**. Se a equipa quiser zero corte a 320, a única alternativa honesta é um
rótulo mais curto só no móvel (por exemplo «Extrato» para Transações) — muda vocabulário e obriga a
manter duas listas; ou esconder o rótulo abaixo de 360 e deixar só o ícone — pior para leitores de
ecrã que não navegam por ícone. Para 8–11 px, nenhuma das duas compensa.

## Fora do âmbito — o transbordo de 341 px a 320 não é da nav (achado novo, medido)

A 320 o `document.scrollWidth` é **341** e `body.scrollWidth` também, **antes e depois** da T85 (tirei
a classe e o valor não mudou) — a T85 não o causou nem o resolve. Elementos que passam os 320 px:

| Elemento | rect | scrollWidth |
| --- | --- | --- |
| `div.ml-auto.flex.items-center.gap-2` (cabeçalho, menu «Mais») | x **133,3** · w **208** · right **341,3** | 208 |
| `ul.absolute.right-0.w-52.…max-sm:left-0` (conteúdo desse menu) | x 133,3 · w 208 · right **341,3** | 206 |
| último `button` do grupo (o do menu) | x **305,3** · w **36** · right **341,3** | 36 |

A nav não aparece na lista: `nav.scrollWidth` = 320 e `overflow-x: visible` sem nada além da largura.
O culpado é o bloco `ml-auto` do cabeçalho, que a 320 não cabe — o último botão fica 21,3 px fora do
ecrã (visível na captura `320-light.png`, o botão cortado no canto superior direito). Precisa de vaga
autorizada própria.

## Limpeza e ambiente

Medi com o utilizador **demo**, só a ler (nenhum dado criado ou apagado; `localStorage.theme` mexido
só no browser efémero). Depois da suite: **0** utilizadores `e2e-%`. Nada escrito em `apps/` nem em
`e2e/`; zero git. `AGENTS.md`, `next-env.d.ts` e `TASKS.md` já vinham modificados — não fui eu.
Um login do demo expirou por timeout na primeira tentativa de medição e passou à segunda; sem efeito
nos números.

## Ficheiros desta volta

`relatorios/T85-qa.md`; capturas e JSON em `relatorios/T85-qa/` (`320/390/1440-{light,dark}.png`,
`nav-320/390-{light,dark}.png`, `medicoes.json`, `contraste.json`); scripts e logs em
`relatorios/.qa-t85/` (`medir.cjs`, `contraste.cjs`, `build.log`, `servidor.log`, `suite.log`).
