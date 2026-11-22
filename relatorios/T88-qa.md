# T88 — QA: o cabeçalho cabe a 320 px

Data: 2026-11-22 · Base `12a1463` + T88 na árvore, sem commit · Build das medições:
`lq8mdrQHJV36jYOWuap` — saiu **igual ao do Dev**, porque o `pnpm build` reutilizou a cache sobre a
mesma árvore (a suite abaixo correu um build **frio** próprio: `rTojzcpFu_5s0l_scYU34`).

**Veredicto: PASS** em (a)–(g). Os alvos de toque do cabeçalho ficam registados (não é falha desta
tarefa, como disseste).

---

## (a) As oito larguras, em `/transacoes` — PASS

`document.scrollWidth` medido no browser, marca visível ou não, e o maior `right` de um filho visível
do `<header>`:

| viewport | `document.scrollWidth` | marca «Finanças Pessoais» | maior `right` |
| --- | --- | --- | --- |
| **320** | **320** | escondida | **304** |
| **359** | **359** | escondida | 343 |
| **360** | **360** | **visível** (63 px) | 344 |
| **375** | **375** | visível (78 px) | 359 |
| **390** | **390** | visível (93 px) | 374 |
| **767** | **767** | visível (123,8 px) | 751 |
| **768** | **768** | escondida (`md`) | 744 |
| **1440** | **1440** | escondida (`md`) | 1416 |

Nenhuma largura transborda: `document.scrollWidth` = viewport nos oito casos. A fronteira é segura
dos dois lados — a 359 cabe sem a marca (343, folga 16), a 360 cabe **com** a marca (344, folga 16).
Confirma os 304 do Dev (o 341,3 do antes é o nome a mais: 60,3 + `gap` 2 + … = 341,3).

## (b) Três rotas a 320 — PASS

| rota | tem menu «Mais»? | `document.scrollWidth` | maior `right` |
| --- | --- | --- | --- |
| `/transacoes` | **sim** | **320** | 304 |
| `/` (Painel) | não | **320** | 304 |
| `/contas` | não | **320** | 304 |

A rota que transbordava antes (a do «Mais») é a que mais mudou; as outras duas já cabiam e continuam
a caber, agora com a mesma folga de 16 px.

## (c) 390 e 1440: nada muda — PASS

| | 390×844 | 1440×900 |
| --- | --- | --- |
| marca | **visível**, 93 px, quebra em duas linhas | **escondida** (`md:hidden`), 0 px |
| `document.scrollWidth` | 390 | 1440 |
| controlos visíveis, pela ordem | navegação (28×28) · Mais (38×44) · Ir para… (38×28) · Ocultar montantes (32×32) · Alternar tema (32×32) · Terminar sessão (36×36) | navegação (28×28) · Mais (75,8×36) · Ir para… (134,2×28) · Ocultar montantes (32×32) · Alternar tema (32×32) |

Nenhum controlo desapareceu. A 1440 o «Terminar sessão» tem **0×0** dentro do `<header>` — vive na
barra lateral, como antes desta tarefa.

## (d) Controlos a 320, um a um — PASS

| controlo | abriu? | medido |
| --- | --- | --- |
| barra lateral (gaveta) | **sim** | gaveta 240 px de largura, `right` 240 — dentro do ecrã |
| «Mais» | **sim** | painel 208 px, x 96 → **right 304**; 4 itens (`Recorrências`, `Regras`, `Categorias`, `Importar`), cada um 198×44, **right 299** |
| busca (paleta) | **sim** | diálogo 288 px, x 16 → **right 304**; 17 opções |
| tema | **sim** | menu `Claro · Escuro · Sistema`; escolher «Escuro» → `html.class` com `dark` (`true`); reposto o claro (`true`) |
| sair | **presença e tamanho** | **36×36**, right **304**; **não cliquei** — encerrava a sessão das outras provas |

Capturas: `controlo-gaveta-320.png`, `controlo-mais-320.png`, `controlo-paleta-320.png`,
`controlo-tema-320.png`, `controlo-tema-escuro-320.png`. Os 299 e 304 batem com os do Dev.

## (e) Dois temas — PASS (sem regressão; o escuro é dívida conhecida)

Contraste do cabeçalho (borda inferior e texto/ícones) medido nas quatro larguras × dois temas:

| tema | fundo efetivo | borda | texto do controlo |
| --- | --- | --- | --- |
| claro | `252,252,249` | `131,139,141` → **3,38:1** | **16,88:1** |
| escuro | `15,20,26` | `45,52,58` → **1,47:1** | **16,94:1** |

O claro é o valor da T78 (3,38:1), sem regressão; o escuro continua em 1,47:1 — a mesma dívida já
registada na T78, não uma regressão desta tarefa. Texto e ícones com folga nos dois temas.
Capturas `transacoes-{320,360,390,1440}-{light,dark}.png` e `contas-320-{light,dark}.png`.

**Alvos de toque do cabeçalho a 320** (medidos, não é FAIL desta tarefa — vai como tarefa nova T93):
gaveta **28×28**, «Mais» **38×44** (o único com 44 de altura), busca **38×28**, montantes **32×32**,
tema **32×32**, sair **36×36**. Só o «Mais» cumpre os 44×44 da skill; os restantes já estavam assim.

## (f) Suite completa, de frio — PASS

`rm -rf apps/web/.next` e `env -u E2E_REUSE_SERVER pnpm test:e2e`, porta 3000 livre no arranque:

```
[e2e] limpeza: 4 utilizador(es) de teste apagado(s); 0 restante(s).
  146 passed (8.6m)
SUITE_EXIT=0     BUILD_ID rTojzcpFu_5s0l_scYU34
```

**146 passed**, baseline e `0 restante(s)`. Specs de nav/calendário contadas à parte, todas verdes:
`15-navegacao` **10** (5 × dois temas), `33-navegacao-15` **2**, `39-calendario` **7** — 19.

## (g) Gate — PASS

```
$ pnpm format:check
Checking formatting...
All matched files use Prettier code style!
FORMAT_EXIT=0
```

## O que não medi

- **Clique em «sair»**: medido só o `rect` (36×36, right 304); clicar encerrava a sessão das outras
  provas.
- **Barra de scroll nas capturas**: o Chromium do Playwright não pinta a barra de scroll clássica; o
  transbordo está provado pelo `document.scrollWidth`, não pela imagem.
- **Aparelho físico** (telemóvel real) e leitor de ecrã.
- O build de medição coincidiu com o do Dev (cache); a prova independente é o build frio da suite.

## Limpeza e ambiente

Sessão **demo** só para leitura; nenhum dado criado ou apagado. `localStorage.theme` mexido no browser
efémero (repus o claro). Depois da suite: **0** utilizadores `e2e-%`. Zero escrita em `apps/` e
`e2e/`, zero git. `AGENTS.md` e `next-env.d.ts` já vinham sujos — não fui eu. Porta 3000
**fechada**. Um login do demo expirou por timeout numa tentativa e passou à seguinte.

## Ficheiros desta volta

`relatorios/T88-qa.md`; em `relatorios/T88-qa/`: `medicoes.json`, `controlos.json` e 15 PNG
(`transacoes-{320,360,390,1440}-{light,dark}.png`, `contas-320-{light,dark}.png`,
`controlo-{gaveta,mais,paleta,tema,tema-escuro}-320.png`). Scripts e logs em `relatorios/.qa-t88/`.
