# T96 — QA: a borda por omissão passou a decorativa

Data: 2026-11-22 · Base `a6b9276` + `apps/web/src/app/globals.css` por commitar · Build das medições:
`_wwXJ_dHWzqF4_eFBH2-h` (o do Dev); suite de frio: `kKjbrlhWUls4GP8hHlt3n`.

**Veredicto: PASS** — os controlos continuam a 3:1 no claro e as bordas decorativas continuam a
desenhar-se nos dois temas. Com uma ressalva escrita no (d): no escuro o filete é 1,14:1 contra o
cartão e 1,36:1 contra o fundo — existe e vê-se nos píxeis, mas é o ponto mais frágil desta mudança.

---

## (a) Quantas bordas a regra base pintava, por rota — e o que mudou

Método meu, no browser: elementos com **borda visível** (largura > 0, estilo ≠ `none`, `alpha` > 0,
caixa não nula), classificados pelo `class` em **implícita** (sem utilidade de cor de borda → é a
regra base que pinta) e **explícita** (`border-border`, `border-input`, …). O «antes» é o mesmo DOM
com `--border-subtle := var(--border)` em memória (só muda o que a base resolve), com espera de
350 ms para os estilos recalcarem.

| rota (1440, claro) | bordas visíveis | pintadas pela **base** | explícitas | cor **antes** (base) | cor **depois** (base) |
| --- | --- | --- | --- | --- | --- |
| `/contas` | 11 | **3** | 8 | `131,139,141` | **`177,185,188`** |
| `/transacoes` | 88 | **31** | 57 | `131,139,141` | **`177,185,188`** |
| `/cartoes` | 43 | **20** | 23 | `131,139,141` | **`177,185,188`** |
| `/consolidacao-contas` | 12 | **7** | 5 | `131,139,141` | **`177,185,188`** |
| `/calendario` | 37 | **31** | 6 | `131,139,141` | **`177,185,188`** |
| **total** | **191** | **92** | 99 | 191 × `131,139,141` | 97 × `177` + 3 × `0,106,102` + … |

Um cartão concreto (`[data-slot="card"]` em `/contas`, sem classe de cor de borda): **antes
`131,139,141` → depois `177,185,188`**. É a prova pontual da regra.

**Contas do Dev vs as minhas:** ele diz **96 strings em 55 ficheiros** (estático) e **219 elementos**
nas cinco rotas; eu conto **191 bordas visíveis** e **92 pintadas pela base**. A diferença não é um
erro de ninguém: ele contou elementos cuja cor era `--border` **antes**, o que inclui as explícitas
(`border-border`/`border-input` também são `131,139,141` no claro); eu separo as duas famílias pelo
`class` e excluo bordas transparentes (63 em `/transacoes`, por exemplo, são `border-transparent` de
botões). Para o critério — «o que a base pinta mudou» — os dois métodos dizem o mesmo.

Bordas que continuam a `--border` de propósito, no claro: as **explícitas** das quatro famílias de
controlo (ver (b)) — 99 contadas nas cinco rotas.

## (b) A decisão (1) — as quatro famílias já diziam o token — CONFIRMADO

```
$ grep -rn "border-input" apps/web/src/components/ui/{input,textarea,select}.tsx
input.tsx:10:    'h-8 w-full … border border-input …'
textarea.tsx:9:  'flex … border border-input …'
select.tsx:39:   "… rounded-lg border border-input …"
$ grep -n "border-border" apps/web/src/components/ui/button.tsx
button.tsx:13:   'border-border bg-background … dark:border-input …'
```

`border-input` aparece em **9** ficheiros de `ui/` e `border-border` em 5. No browser, o `Input` e o
`Select` de `/transacoes` computam a borda a **`131,139,141`** (não à subtle), e os botões de contorno
também — ou seja, **não dependem da base**: quem é controlo diz o token. A decisão (1) está sustentada
pelo código e pelo DOM.

## (c) Os controlos continuam a 3:1 no claro — PASS

Medido por mim, cor da borda computada e contraste contra o fundo em que o controlo assenta:

| controlo | cor da borda | vs fundo da página | vs fundo do cartão |
| --- | --- | --- | --- |
| `Input` | `131,139,141` | **3,38:1** | **3,48:1** |
| `Select` | `131,139,141` | **3,38:1** | **3,48:1** |
| `Textarea` (diálogo «Nova conta») | `131,139,141` | — | **3,48:1** |
| `Button` de contorno (`Ir para… ⌘K` e ícones outline) | `131,139,141` | **3,38:1** | **3,48:1** |

Nenhum abaixo de 3:1. (O Input do diálogo dá 6,45:1 porque é o campo em foco, com `border-ring` — é o
estado, não a regra.)

## (d) No escuro, as bordas decorativas não desapareceram — PASS com ressalva

Números medidos no browser (escuro): `--border-subtle` = `40,47,53`; cartão `30,37,44`; fundo
`15,20,26`.

| par | contraste |
| --- | --- |
| borda decorativa vs fundo | **1,36:1** |
| borda decorativa vs cartão | **1,14:1** |
| cartão vs fundo (a superfície sem a borda) | 1,19:1 |

**Prova de que o filete é desenhado** (píxeis da minha captura `qa-contas-1440-dark.png`, a atravessar
o bordo esquerdo do 1.º cartão a y=450): `276–278: 15,20,26` → **`279: 38,42,48`** → `280+: 30,37,44`.
No claro, o mesmo corte: `278: 252,252,249` → **`279: 228,229,226`** → `280+: 255,255,255`.

Ou seja: a borda existe, tem 1 px e distingue-se dos dois vizinhos — mas no escuro é um filete
**muito discreto** (1,14:1 contra o cartão, quando antes da T96 era 1,23:1). O cartão lê-se sobretudo
pelo preenchimento (1,19:1 contra o fundo). Não é «desapareceu»; é o ponto mais frágil da mudança e o
sítio onde a dívida do escuro (T78/T91) se nota mais.

## (e) `axe` e suite completa, de frio — PASS

`rm -rf apps/web/.next`, `env -u E2E_REUSE_SERVER pnpm test:e2e`:

```
[e2e] limpeza: 4 utilizador(es) de teste apagado(s); 0 restante(s).
  149 passed (8.8m)
SUITE_EXIT=0     BUILD_ID kKjbrlhWUls4GP8hHlt3n
[axe] /contas: sem violações
[axe] /definicoes: sem violações
[axe] /contas-pagar-receber: sem violações
[axe] /consolidacao-contas: sem violações
```

Nenhuma violação de contraste de borda (o `axe` nem mede 1.4.11, mas o resto do contraste de texto
continua limpo). Gate: `format:check` 0, `lint` 0, `typecheck` 0.

## (f) Layout inalterado — PASS

`/transacoes` a 1440, com o token real e com `--border-subtle := var(--border)` (o «antes»):

| medida | depois | antes (simulado) |
| --- | --- | --- |
| cartão | 1136 × **509,8** | 1136 × **509,8** |
| linha da tabela | **63** | **63** |
| `body.scrollHeight` | **2633** | **2633** |

Só muda a cor.

## (g) `--border` intocado, sem token novo, diff mínimo — PASS (com precisão)

```
$ git diff -U0 -- apps/web/src/app/globals.css | grep -E "^[+-]" | grep -vE "^(\+\+\+|---)"
-  /* Mantido do tema shadcn: …                      (2 linhas de comentário removidas)
+  /* …  T96: a cor por omissão é a **subtle** …      (12 linhas de comentário acrescentadas)
-    @apply border-border outline-ring/50;
+    @apply border-border-subtle outline-ring/50;
```

O **código** mudou **uma linha** (`@apply border-border` → `@apply border-border-subtle`); o resto do
diff são comentários. `--border`/`--input` não foram tocados (continuam `131,139,141` e 3,38/3,48), e
`--border-subtle` **não é novo**: nasceu na T91 (`git log -S` → `2f27d94`).

## (h) As capturas — o que vejo

Cinco ecrãs × dois temas a 1440 (`relatorios/T96/qa-*.png`) mais o canto superior esquerdo.

- **Claro:** é o que a tarefa queria. Cartões, divisórias da tabela e separadores deixam de ter o peso
  de um contorno de campo — a página respira, e a hierarquia passa a ser «campo = 3,38; cartão e
  divisória = 1,99». O `Input` e o `Select` continuam a ser os elementos com contorno mais firme, o
  que é correcto. Nas cinco rotas não vi nenhum sítio onde a borda tenha ficado invisível.
- **Escuro:** os cartões leem-se pela superfície (preenchimento mais claro que o fundo); o filete está
  lá mas quase não se nota (1,14:1). O separador vertical da barra lateral e a linha sob o cabeçalho
  continuam a ver-se; o canto (cabeçalho ↔ sidebar) mantém a leitura. Nada ficou «a flutuar sem
  contorno», mas também não posso dizer que a borda no escuro seja um contorno perceptível: é um
  filete discreto.
- Não vi nenhum ecrã a meio (nenhum cartão com metade do contorno, nenhuma tabela sem linhas).

## Limpeza e ambiente

Demo só a ler (o diálogo foi aberto e fechado com Escape); nenhum dado criado ou apagado. Depois da
suite: **0** utilizadores `e2e-%`. Zero escrita em `apps/` e `e2e/`; o `globals.css` do Dev intocado
por mim; capturas do Dev não tocadas; zero git; porta 3000 **fechada**. Um login do demo expirou por
timeout numa tentativa e passou à seguinte.

## Ficheiros desta volta

`relatorios/T96-qa.md`; capturas em `relatorios/T96/`
(`qa-{contas,transacoes,cartoes,consolidacao,calendario}-1440-{light,dark}.png`,
`qa-canto-{light,dark}.png`); scripts e JSON em `relatorios/.qa-t96/` (`medir.cjs`, `refinar.cjs`,
`antes2.cjs`, `pixeis.cjs`, `medicoes.json`, `refinar.json`, `antes2.json`, `gate.log`, `suite.log`).

---

# Volta 2 — o «Mais» volta a 3,38 e o cabeçalho continua a caber

Data: 2026-11-22 · Mesma árvore; o Dev acrescentou `border-border` ao `summary` do «Mais» e alargou o
comentário do `globals.css` a cinco controlos. Build das medições: `DNYxxC366dLJYNCIgwJga`; suite de
frio: `Tb4MIpXgcBD3FGAkrGPlm`.

**Veredicto da volta 2: PASS.** O «Mais» mede **3,38** no claro, a pílula tem o mesmo peso das
vizinhas, e o cabeçalho continua **sem transbordar a 305** com os seis alvos a 44×44.

## (a) A fila dos cinco (e a sexta, a gaveta) — medido

Borda computada e contraste contra o fundo da página e do cartão, `/transacoes`:

| controlo | claro (borda / página / cartão) | escuro (borda / página / cartão) |
| --- | --- | --- |
| **«Mais»** | `131,139,141` · **3,38** · **3,48** | `45,52,58` · **1,47** · 1,23 |
| busca `⌘K` | `131,139,141` · 3,38 · 3,48 | `50,57,64` · 1,58 · 1,32 |
| ocultar montantes | `131,139,141` · 3,38 · 3,48 | `50,57,64` · 1,58 · 1,32 |
| tema | `131,139,141` · 3,38 · 3,48 | `50,57,64` · 1,58 · 1,32 |
| **sair** | **`border-width: 0`** — não tem limite | idem |
| *(gaveta, a sexta)* | `1px` mas **transparente** (`alpha 0`) — não pinta limite | idem |

O «Mais» passou de 1,94 a **3,38** no claro (era o defeito) e a 1,47 no escuro — é o `--border` do
tema, a dívida da T78, como o Dev disse. Busca/montantes/tema ficaram iguais (usam `border-input`).
O «sair» tem `border-width: 0`, portanto **não há limite a medir** — confirmei a leitura, não a
aceitei por palavra. O mesmo se aplica à gaveta: tem 1 px de borda, mas a cor é transparente.

## (b) O peso visual da pílula — PASS

Nas capturas `cabecalho-320-{light,dark}.png` as quatro pílulas (Mais, busca, montantes, tema) têm
agora o mesmo contorno; a 1440 o «Mais» com rótulo acompanha as vizinhas. No escuro a diferença de
token (`45,52,58` vs `50,57,64`) não se distingue a olho — visualmente é a mesma família.

## (c) O comentário e o diff de uma linha — PASS

`globals.css`: o comentário enumera **cinco** — «Input, Textarea, Select, o Button de contorno e o
gatilho do menu «Mais»» — e os cinco são verdadeiros (os quatro primeiros medidos na volta 1, o
«Mais» agora acima).

`app-shell.tsx`, `git diff`: **uma linha alterada** (`… rounded-lg border px-2.5 …` →
`… rounded-lg border border-border px-2.5 …`), mais nada. `git diff --stat` desse ficheiro: `2 +-`.

## (d) A T93 não regride — PASS

A 320 com a barra forçada (as `launchOptions` do projeto `estreito`, headless com
`ignoreDefaultArgs: ['--hide-scrollbars']`):

```
innerWidth 320 · clientWidth 305 · scrollWidth 305 · diferença 0 · filhos fora []
alvos: gaveta 44×44 · Mais 44×44 · busca 44×44 · montantes 44×44 · tema 44×44 · sair 44×44
```

A classe nova no `summary` não comeu folga nenhuma: a 305 o cabeçalho continua a caber à justa, sem
transbordo, e os seis alvos mantêm o piso.

## (e) Suite completa, de frio — PASS

```
$ rm -rf apps/web/.next && env -u E2E_REUSE_SERVER pnpm test:e2e
[e2e] limpeza: 4 utilizador(es) de teste apagado(s); 0 restante(s).
  149 passed (9.6m)
SUITE_EXIT=0     BUILD_ID Tb4MIpXgcBD3FGAkrGPlm
[axe] /: sem violações · /transacoes: sem violações · /contas: sem violações · /orcamento: sem
violações · /objetivos: sem violações · /importar: sem violações … (todas as rotas do 80)
```

Nenhuma violação de `axe`. Gate: `format:check` 0, `lint` 0, `typecheck` 0.

## (f) O calendário não foi tocado — PASS

`git diff --name-only` não tem nenhum ficheiro de calendário. E a célula continua na cor da T91:
borda `177,185,188` → **1,94:1** contra o fundo (1,99 contra o cartão), exactamente o valor que a
T91/T96 fixaram para decorativo. A decisão D31 (não mexer nas células) está respeitada.

## Limpeza

Demo só a ler; **0** utilizadores `e2e-%`; zero escrita em `apps/` e `e2e/`; zero git; porta 3000
**fechada**.

## Ficheiros desta volta

`relatorios/.qa-t96b/` (`medir.cjs`, `medicoes.json`, `medir.log`, `gate.log`, `suite.log`) e
`relatorios/T96/` (`cabecalho-{1440,320}-{light,dark}.png`, `pagina-320-{light,dark}.png`,
`pagina-320-barra.png`, `calendario-1440-light.png`).
