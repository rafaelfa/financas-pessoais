# T90 — QA: os 39 `components/ui/*` passam a usar o `cn` do projeto

Data: 2026-11-22 · Base `b259ac1` (T89) + T90 na árvore, sem commit · Suite de frio:
`BUILD_ID WT7PV41_u9V9BsAl5qUdm`; build das capturas: `TwoCjETi13PwNLVLbYH6N`.

**Veredicto: PASS.** O `grep` dá 0/39, o `numstat` é +39/−39, o `cn` devolve as duas classes em
runtime e as minhas capturas são **byte a byte iguais** às do Dev. Há um **comentário desatualizado**
em `lib/utils.ts` que devia ser corrigido (achado, não falha do critério).

---

## (a) Os greps e o diff — PASS

```
$ grep -rl "from 'cn'" apps/web/src | wc -l
0
$ grep -rl "@/lib/utils" apps/web/src/components/ui | wc -l
39
$ git diff --numstat -- apps/web/src/components/ui | awk '{a+=$1;d+=$2;n++} END {print n" ficheiros, +"a"/-"d}'
39 ficheiros, +39/-39
```

Cada uma das 39 linhas é `1 1` (nenhum ficheiro ganhou mais do que a linha do import). Exemplo do
topo da lista: `alert-dialog.tsx`, `alert.tsx`, `avatar.tsx`, `badge.tsx`, `button.tsx` — todos `1 1`.

## (b) O mecanismo em runtime — PASS

```
$ cd apps/web && node --experimental-strip-types -e "import('./src/lib/utils.ts').then(m=>console.log(m.cn('text-caption','text-muted-foreground')))"
text-caption text-muted-foreground
```

As duas classes ficam: o `text-caption` já não é confundido com uma cor. E a escala normal não mudou
(último valor vence, como sempre):

```
$ node --experimental-strip-types -e "import('./src/lib/utils.ts').then(m=>console.log(m.cn('text-2xl','text-muted-foreground','p-4','p-2')))"
text-2xl text-muted-foreground p-2
```

O aviso do Node sobre `"type": "module"` é do carregador `--experimental-strip-types`, não do código.

## (c) A resolução é a mesma dos `ui/*`, sem ciclo — PASS

`apps/web/tsconfig.json`:

```json
"baseUrl": ".",
"paths": { "@/*": ["./src/*"] }
```

`@/lib/utils` resolve para `apps/web/src/lib/utils.ts` — o mesmo módulo que os `ui/*` passam a
importar. `lib/utils.ts` importa **só** `cn/config` (`import { createCn } from 'cn/config';`); a única
menção a «components/» no ficheiro é um comentário. Sem ciclo novo: `components/` → `lib/utils.ts` →
`cn/config`.

## (d) Sem mudança visual — PASS (reproduzido com hash igual)

Build meu, sessão demo, `/transacoes`, e as quatro capturas (`relatorios/T90-qa/qa-*.png`) comparadas
com as «depois» do Dev (`relatorios/T90/t90-depois-*.png`):

| caso | sha256 (minha) | sha256 (Dev, depois) | igual? |
| --- | --- | --- | --- |
| 1440 claro | `55055817…31eabef` | `55055817…31eabef` | **sim** |
| 1440 escuro | `c3f2065d…3d079a70` | `c3f2065d…3d079a70` | **sim** |
| 390 claro | `ee8053c4…75f258de` | `ee8053c4…75f258de` | **sim** |
| 390 escuro | `1aeb8440…f72b1c` | `1aeb8440…f72b1c` | **sim** |

O build era outro (`TwoCjETi13PwNLVLbYH6N` aqui, não o do Dev) e a página é a real (`/transacoes`
com o extrato, `Card`, `Button`, `Input`, `Select`), por isso a igualdade de bytes não é um
acidente de build: o mesmo píxel com código-fonte diferente nos 39 imports. Confirmei também, com
`sha256sum`, que os pares antes/depois do próprio Dev são idênticos entre si (8 ficheiros, 4 pares) —
ou seja, a alteração não mexeu em pintura nenhuma.

Limite desta prova: um hash igual mostra que a **pintura** não mudou; não mostra, por si, que o
código mudou entre as duas capturas — isso é provado pelo diff do (a).

## (e) Gate e suite — PASS

```
$ pnpm format:check && pnpm lint && pnpm typecheck
All matched files use Prettier code style!
 Tasks:    4 successful, 4 total     (lint)
 Tasks:    4 successful, 4 total     (typecheck)
GATE_EXIT=0

$ rm -rf apps/web/.next && env -u E2E_REUSE_SERVER pnpm test:e2e
[e2e] limpeza: 4 utilizador(es) de teste apagado(s); 0 restante(s).
  147 passed (8.7m)
SUITE_EXIT=0     BUILD_ID WT7PV41_u9V9BsAl5qUdm
```

**147 passed**, baseline (o `estreito` da T89 incluído: `[147/147]`), `0 restante(s)`.

## Achado (não é falha do critério): o comentário do `utils.ts` ficou a mentir

`apps/web/src/lib/utils.ts:10-13` não foi tocado pela T90 (o `git diff` do ficheiro está vazio) e
continua a dizer:

> Vale para quem importa `cn` daqui. **Os 39 `components/ui/*` importam `cn` de `'cn'` e não têm a
> extensão** — lá a classe continua a desaparecer. Nenhum usa `text-caption` hoje; o risco é o
> próximo (a T82/T83 escrevem no `ui/card.tsx`).

Depois desta tarefa é o contrário do que diz: os 39 já importam daqui e já têm a extensão. É uma
frase a reescrever (por exemplo: «Os 39 `ui/*` importam daqui desde a T90; a extensão vale para
todos»), sem tocar em código. Fica para o Dev — não é meu, e não altera o veredicto.

## Limpeza e ambiente

Sessão **demo** só para leitura; nenhum dado criado ou apagado. Depois da suite: **0** utilizadores
`e2e-%`. Zero escrita em `apps/`, zero git. `AGENTS.md`, `next-env.d.ts` e `TASKS.md` já vinham
sujos — não fui eu. Porta 3000 **fechada**.

## Ficheiros desta volta

`relatorios/T90-qa.md`; capturas em `relatorios/T90-qa/qa-{1440,390}-{light,dark}.png`; logs e
script em `relatorios/.qa-t90/` (`gate.log`, `suite.log`, `build.log`, `servidor.log`, `cap.cjs`).
