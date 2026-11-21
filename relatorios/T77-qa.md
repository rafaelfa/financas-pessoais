# T77 — QA: F9, rodapé móvel de 11 px para 12 px

Data: 2026-11-21 · Base: `main` @ `0f1edd4` + árvore de trabalho (T77 não commitada)
Âmbito verificado: `apps/web/src/components/mobile-nav.tsx` (uma classe)
Ambiente: Windows (Git Bash), Node v24.21.0, Next.js 16.4.6, Playwright 1.64.0,
servidor `pnpm --filter @repo/web start` na **porta 3000**, `.next/BUILD_ID` = `9-iLLCgPZtEi0WL1Bx_Sv`.

Veredicto global: **PASS** (alíneas a–h), com uma ressalva declarada em (d) e uma
diferença face ao relatório do Dev em (d)/(f) explicada abaixo.

---

## a) Diff de uma linha — PASS

```
$ git diff --numstat apps/web/src/components/mobile-nav.tsx
1	1	apps/web/src/components/mobile-nav.tsx

$ git diff apps/web/src/components/mobile-nav.tsx
-                  'flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium transition-colors',
+                  'flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-xs font-medium transition-colors',
```

Só a classe, no `className` do `<Link>` de cada item. `text-xs`/`font-medium` mantêm-se.

## b) Valor proibido — PASS

```
$ grep -rn 'text-\[11px\]' apps/web/src
(sem saída) — exit 1
```

## c) Medição a 390×844, sessão real criada por mim — PASS

Sonda própria (`relatorios/.qa-t77/t77-qa-medir.cjs`): registo de um utilizador novo
(`e2e-t77qa-…@exemplo.pt`), entrada pela interface, viewport 390×844, `locale pt-PT`.
Servidor: porta 3000, `BUILD_ID 9-iLLCgPZtEi0WL1Bx_Sv`. Saída completa em
`relatorios/.qa-t77/t77-medicao-run.log` e `t77-medicao.json`.

`getComputedStyle(<span> do rótulo)` → **`fontSize: 12px`**, `lineHeight: 16px`.

| Rótulo | `rect` do `<span>` (x · y · w · h) | `<a>` (w × h) |
| --- | --- | --- |
| Painel | 21,61 · 820 · **34,78** · 16 | 78 × **56** |
| Transações | 83,63 · 820 · **66,75** · 16 | 78 × **56** |
| Orçamento | 163,19 · 820 · 63,61 · 16 | 78 × **56** |
| Objetivos | 245,91 · 820 · 54,19 · 16 | 78 × **56** |
| Contas | 330,66 · 820 · 40,69 · 16 | 78 × **56** |

`<nav>`: `x 0 · y 787 · w 390 · h 57`, `scrollWidth 390`, `clientWidth 390`.
`document.documentElement.scrollWidth = 390` = `innerWidth 390` → **sem overflow horizontal**.
Os 5 alvos têm **56 px** de altura (≥44) — ver (ii) abaixo.

## d) O «antes» reproduzido no DOM, sem tocar na árvore — PASS com ressalva

Na **mesma página** e no mesmo build, apliquei `span.style.fontSize = '11px'` aos 5 rótulos e
voltei a ler o `rect` (sem `git stash`/`checkout`, a árvore não foi tocada):

| Rótulo | Depois (12 px) w × h | «Antes» simulado (11 px) w × h |
| --- | --- | --- |
| Painel | 34,78 × 16 | **31,89** × 14,66 |
| Transações | 66,75 × 16 | **61,19** × 14,66 |
| Orçamento | 63,61 × 16 | **58,31** × 14,66 |
| Objetivos | 54,19 × 16 | **49,67** × 14,66 |
| Contas | 40,69 × 16 | **37,30** × 14,66 |

As **larguras** batem ao centésimo com o «antes» do Dev (31,89 · 61,19 · 58,31 · 49,67 · 37,30).
A **altura** não: eu medi 14,66 px, o Dev reporta 16,5 px. Causa: a minha simulação troca só o
`font-size` e herda o `line-height` da classe actual; o `text-[11px]` original trazia
`line-height: 1.5em` (16,5 px). Não é divergência de comportamento do produto — é a sonda a não
repor o `line-height` morto. A métrica que decide o encaixe é a largura, e essa é idêntica.

## e) A 1440×900 — PASS

`<nav>`: `display: none` (é `md:hidden`), `rect` 0×0, `scrollWidth 0`.
`document.documentElement.scrollWidth = 1440` = `innerWidth 1440` → sem overflow.
Captura: `relatorios/.qa-t77/qa-nav-1440.png` (a 1440 só prova ausência).

## f) Rótulo mais largo sem corte — PASS

«Transações»: `<span>` **66,75 px**, `scrollWidth 67` = `clientWidth 67`, `overflow: visible`,
`text-overflow: clip`, `class=""` (sem `truncate`). Célula do `<a>`: **78 px** → folga de 11,25 px.
Confirmado no ecrã, não só no número: `qa-nav-390-light.png` e `qa-nav-390-dark.png` mostram os
5 rótulos inteiros, «Transações» incluído, nos dois temas.

## g) Gate pela ordem do AGENTS.md — PASS (5/5, exit 0)

```
$ pnpm format:check   → exit 0   All matched files use Prettier code style!
$ pnpm lint           → exit 0   Tasks: 4 successful, 4 total
$ pnpm typecheck      → exit 0   Tasks: 4 successful, 4 total
$ pnpm test --force   → exit 0   34 passed (34) · 598 passed (598) · Cached: 0 cached, 2 total
$ pnpm build          → exit 0   ✓ Compiled successfully · BUILD_ID 9-iLLCgPZtEi0WL1Bx_Sv
```

Logs: `relatorios/.qa-t77/gate-{format,lint,typecheck,test,build}.log`, exits em `exits.txt`.
O `--force` foi usado de propósito (o `test` simples podia vir de cache; aqui `Cached: 0 cached`).

## h) Suite e2e completa — PASS

```
$ pnpm test:e2e
Running 138 tests using 1 worker
…
[e2e] limpeza: 4 utilizador(es) de teste apagado(s); 0 restante(s).

  138 passed (7.9m)
exit=0
```

Zero `failed`, zero `skipped`, zero `flaky` (138 testes, 1 worker). A linha de limpeza fecha em
`0 restante(s)`.
Log completo: `relatorios/.qa-t77/suite-e2e.log`. A suite arrancou o seu próprio build de
produção na porta 3000 (o meu servidor de medição foi parado antes, porta deixada livre).

---

## As duas decisões de fundo que o Lead pediu para confirmar ou recusar

**(i) 12 px é o valor certo enquanto o T78 não define o token — CONFIRMO o valor, com a dívida
declarada.** O valor medido no browser é 12 px e é o pretendido pelo F9. É verdade que não existe
token de tipografia para 12 px em `globals.css` (`grep -n -- '--text-\|font-size'
apps/web/src/app/globals.css` → sem saída), portanto `text-xs` é o valor da escala Tailwind 4, não
um token do tema; quando o T78 definir o token, esta linha muda-se. Não é razão para esperar: a
dívida fica escrita no `relatorios/T77.md` do Dev e não bloqueia nada.

**(ii) `min-h-14` garante ≥44 px depois da troca — CONFIRMO por medição, não por suposição.** Os
5 `<a>` medem **56 px** de altura a 390×844 (o `min-h-14` = 3,5 rem = 56 px; a altura vem do
`min-h`, não do texto). 56 ≥ 44.

## Capturas (minhas, não do Dev)

| Ficheiro | Viewport | Tema | O que mostra |
| --- | --- | --- | --- |
| `relatorios/.qa-t77/qa-nav-390-light.png` | 390×844 | claro | nav com 5 rótulos a 12 px, sem corte |
| `relatorios/.qa-t77/qa-nav-390-dark.png` | 390×844 | escuro | idem; `html.class = … dark`, fundo do body `lab(6.17 …)` |
| `relatorios/.qa-t77/qa-nav-1440.png` | 1440×900 | claro | nav ausente (`md:hidden`), conteúdo desktop |

Tema confirmado no DOM: `html.class = font-sans JnQPGW_variable light` (fundo `lab(98.87 …)`) vs
`… dark` (fundo `lab(6.17 …)`).

## O que NÃO ficou coberto

- Não medi noutros viewports estreitos (ex. 320 px). O critério era 390 e 1440; a 320 as 5
  células ficariam com ~64 px e «Transações» (66,75) não caberia — **não** foi pedido, mas fica
  registado como risco se algum dia o suporte descer a 320.
- O «antes» foi reproduzido no DOM (por instrução), não a partir de um build antigo; a altura
  difere do relatório do Dev pela razão explicada em (d).
- Não abri os PNG do Dev para os avaliar como prova; tirei os meus.

## Ficheiros que escrevi

`relatorios/T77-qa.md`, `e2e/` (nada alterado nesta tarefa), e `relatorios/.qa-t77/`:
`gate.sh`, `exits.txt`, 5 logs de gate, `suite-e2e.log`, `server.log`, `t77-qa-medir.cjs`,
`t77-medicao-run.log`, `t77-medicao.json`, `dbg.cjs`, `limpar.cjs`, `limpar2.cjs`,
`qa-nav-390-light.png`, `qa-nav-390-dark.png`, `qa-nav-1440.png`.
Zero alterações em `apps/**`. Zero git (sem add/stash/checkout/branch/commit).

Os dois utilizadores de teste que criei para medir (`e2e-t77qa-…`, `e2e-t77dbg-…`) foram
apagados: `DELETE … LIKE 'e2e-t77qa-%' OR … 'e2e-t77dbg-%'` → `apagados: 2`, `restantes: 0`.
