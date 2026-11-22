# T95 — QA: uma só fonte de `cn`

Data: 2026-11-22 · Base `6bd1d78` + `apps/web/eslint.config.mjs`, `packages/shared/src/utils/cn.ts`
(apagado) e `packages/shared/src/utils/index.ts` por commitar · Suite de frio (build **sem cache**):
`EqGf_lA5Al38AOHqf_rQI`.

**Veredicto: FAIL — por uma razão só, e é documental.** A regra morde nas minhas mãos, o shim saiu
sem órfãos de código e todo o gate passa. Mas ficaram **três referências ao shim apagado** em
`docs/analise/02-estado-atual-do-projeto.md` (`utils/cn.ts`), e o critério que me deste diz que uma
nota em `docs/` que aponte para o shim é FAIL. Ver a secção «O achado» no fim, com as linhas e a
minha leitura.

---

## (a) A regra morde — PASS

Criei `apps/web/src/__qa-t95-cn-proibido.ts` com `import { cn } from 'cn';`:

```
$ pnpm --filter @repo/web lint
  1:1  error  'cn' import is restricted from being used. Importa `cn` de '@/lib/utils' — é o que
  tem a escala de texto do tema. O motor `'cn'` só se toca em `lib/utils.ts`, por `'cn/config'`
  no-restricted-imports
✖ 1 problem (1 error, 0 warnings)
EXIT=1
```

Apaguei o ficheiro e repeti:

```
$ pnpm --filter @repo/web lint
EXIT=0
```

`ls` do ficheiro: não existe. `git status` depois: as mesmas cinco entradas do início (config, TASKS,
o `cn.ts` apagado, `utils/index.ts`, `T95.md`) — **nenhum ficheiro de teste ficou**.

## (b) `'cn/config'` continua permitido, sem exceções — PASS

```
$ grep -rn "eslint-disable" apps/web/src/lib/utils.ts apps/web/eslint.config.mjs
(nada)
$ grep -rn "from 'cn/config'" apps/web/src
apps/web/src/lib/utils.ts:1:import { createCn } from 'cn/config';
```

A regra restringe o especificador `cn`; `cn/config` é outro e passa. `lib/utils.ts` continua sem
`eslint-disable`, e o lint do `web` (que o inclui) está verde.

## (c) O shim não deixou órfãos de código — PASS

```
$ ls packages/shared/src/utils/cn.ts
ls: cannot access …: No such file or directory
$ git diff -- packages/shared/src/utils/index.ts
-export * from './cn';
$ grep -rn "@repo/shared/utils" apps packages        (sem node_modules)
packages/shared/src/index.ts:8: * `@repo/shared/schemas`, `@repo/shared/types`, `@repo/shared/utils`.
```

A única ocorrência de `@repo/shared/utils` é um **comentário** a listar os subcaminhos, e o subcaminho
existe mesmo (`packages/shared/package.json` → `"./utils": "./src/utils/index.ts"`). Nenhum import
aponta para `utils/cn`. O `pnpm build` da raiz compilou `@repo/shared` sem cache (ver (e)/(f)).

## (d) 0 imports de `'cn'` — PASS

```
$ grep -rn "from 'cn'" apps/web/src | wc -l
0
```

## (e) Gate da raiz — PASS

```
$ pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build
All matched files use Prettier code style!
Tasks: 4 successful (lint) · 4 successful (typecheck)
@repo/shared:test: Tests 598 passed (598)
Tasks: 2 successful · 2 successful (build)
GATE_EXIT=0
```

O `lint` e o `typecheck` são os **da raiz** (turborepo, incluem `packages/`), não só o `web`.

## (f) Suite completa, de frio, com build real — PASS

Apaguei `.turbo` (2,2 GB de cache) e `apps/web/.next` antes de correr, para o build do `shared` **não**
vir de cache:

```
[WebServer] @repo/web:build: cache miss, executing 8588d5fe86a58881
[e2e] limpeza: 4 utilizador(es) de teste apagado(s); 0 restante(s).
  149 passed (9.3m)
SUITE_EXIT=0     BUILD_ID EqGf_lA5Al38AOHqf_rQI
```

**149**, `0 restante(s)`, e o `BUILD_ID` é **o da minha corrida** (`EqGf…`), não o do Dev
(`J7DO2zSb5t56e1uC4fII0`). O cache miss é a prova de que o `shared` foi mesmo recompilado.

## (g) Sem mudança visual — PASS

`/transacoes` a 1440 e 390: a página é a mesma de antes (mesmo cabeçalho, mesmos cartões, mesma
tabela), `h1` «Transações», `document.scrollWidth` 1440/390, **zero** erros de consola ou de página.
Nada nesta tarefa toca em JSX, CSS ou classes. Capturas `relatorios/.qa-t95/transacoes-{1440,390}.png`.

## O achado — três referências ao shim em `docs/` (é o motivo do FAIL)

`grep -rn "utils/cn" apps packages docs`:

```
docs/analise/02-estado-atual-do-projeto.md:267: - `utils.ts`: `export { cn } from "cn"` — duplica
  `packages/shared/src/utils/cn.ts`, que faz exatamente o mesmo. Duas fontes para o mesmo helper.
docs/analise/02-estado-atual-do-projeto.md:331: **`src/utils/cn.ts` (12 linhas)** — `export { cn } from
  'cn'` e `export type { ClassValue } from 'cn'`, com a justificação de haver "exactly one Tailwind
  class-conflict engine". …
docs/analise/02-estado-atual-do-projeto.md:458: | R13 | **Duplicação de `cn` em dois caminhos** | …
  `apps/web/src/lib/utils.ts:1` e `packages/shared/src/utils/cn.ts:11`. …
```

**A minha leitura, para não passares por cima do contexto:** esse documento abre com «**Âmbito:**
retrato exato do ponto de partida do monorepo» e «**Data da auditoria:** 2026-10-10» — é um
retrato histórico, e a frase das linhas 267/331 era verdadeira nessa data. Não é um import nem um
README que mande usar o shim; é uma auditoria datada. Mas a tabela de riscos (R13) lê-se hoje como
estado presente («duplicação… dois caminhos»), e o critério que me deste trata qualquer nota em
`docs/` como referência órfã. Por isso assino **FAIL**, com esta nuance escrita.

**Correção mínima** (uma linha, no Dev): no `02-estado-atual-do-projeto.md`, marcar as três passagens
como históricas — por exemplo, uma nota no topo ou junto à R13: «R13 resolvido na T95: o shim
`packages/shared/src/utils/cn.ts` foi apagado e `cn` vive só em `apps/web/src/lib/utils.ts`». Se
preferires tratá-lo como documento histórico intocável, é decisão tua e o FAIL cai.

## Limpeza e ambiente

Ficheiro de teste criado e apagado (o `git status` ficou igual); a demo foi só lida; **0**
utilizadores `e2e-%`; zero escrita em `apps/`/`packages/`/configs além do ficheiro temporário já
removido; zero git; porta 3000 **fechada**. Apaguei o cache do turborepo (`.turbo`, artefacto de
build) para forçar o build de (f) — é regenerável, não é dado.

## Ficheiros desta volta

`relatorios/T95-qa.md`; em `relatorios/.qa-t95/`: `lint-vermelho.log`, `lint-verde.log`, `gate.log`,
`suite.log`, `servidor.log`, `cap.cjs`, `transacoes-{1440,390}.png`.

---

# Volta 2 — a nota de estado no topo do retrato

Data: 2026-11-22 · Só documentação. Sem suite e sem gate (nada de código mudou desde a corrida de
`149 passed (9.3m)`, `BUILD_ID EqGf_lA5Al38AOHqf_rQI`).

**Veredicto da volta 2: PASS.** O **FAIL anterior é retirado por decisão de âmbito do Lead,
2026-11-22 — nota de estado em vez de reescrita.** O achado estava certo (as três passagens existiam e
liam-se como estado presente); o que muda é o remédio: um retrato datado não se reescreve, avisa-se o
leitor.

## (a) O diff é uma linha acrescentada — PASS

```
$ git diff --stat -- docs/analise/02-estado-atual-do-projeto.md
 docs/analise/02-estado-atual-do-projeto.md | 1 +
$ git diff -- docs/analise/02-estado-atual-do-projeto.md | grep -c "^-[^-]"
0
```

Uma única adição, no bloco de citação do cabeçalho (depois da linha «Convenção de evidência» e antes
do `---`). **Nenhuma** linha do corpo foi removida ou alterada.

## (b) As três passagens continuam intactas — PASS

```
$ grep -n "R13\|utils/cn" docs/analise/02-estado-atual-do-projeto.md
  8: > **Nota de estado (2026-11-22):** …
268: - `utils.ts`: `export { cn } from "cn"` — duplica `packages/shared/src/utils/cn.ts`, …
332: **`src/utils/cn.ts` (12 linhas)** — `export { cn } from 'cn'` e `export type { ClassValue } from 'cn'`, …
459: | R13 | **Duplicação de `cn` em dois caminhos** | Baixa | `apps/web/src/lib/utils.ts:1` e `packages/shared/src/utils/cn.ts:11`. … |
```

Deslocadas exactamente uma linha (`:268`, `:332`, `:459`), com o texto igual ao que citei na volta 1.

## (c) A nota diz os quatro pontos — PASS

> «**Nota de estado (2026-11-22):** este documento é um retrato de **2026-10-10** e **não** é atualizado
> — o corpo abaixo descreve o ponto de partida. O que mudou desde então está em `docs/gestao/`
> (`TASKS.md`, `DECISOES.md`, `MAPA.md`). Em particular, a **R13** (`duplicação de cn em dois caminhos`,
> `packages/shared/src/utils/cn.ts:11`) foi **resolvida na T95**: o shim foi apagado e um
> `no-restricted-imports` em `apps/web/eslint.config.mjs` impede o próximo `from 'cn'` (o motor só se usa
> por `cn/config`, em `lib/utils.ts`).»

Data de 2026-10-10 ✓ · documento não atualizado ✓ · R13 resolvida na T95 ✓ · aponta para
`docs/gestao/` ✓.

## (d) O resto da árvore — PASS, com uma nota

```
$ git status --short
 M apps/web/eslint.config.mjs
 M docs/analise/02-estado-atual-do-projeto.md
 M docs/gestao/TASKS.md
 D packages/shared/src/utils/cn.ts
 M packages/shared/src/utils/index.ts
?? relatorios/T95-qa.md
?? relatorios/T95.md

$ git diff --numstat
24  0  apps/web/eslint.config.mjs
 1  0  docs/analise/02-estado-atual-do-projeto.md
22  1  docs/gestao/TASKS.md
 0 12  packages/shared/src/utils/cn.ts
 0  1  packages/shared/src/utils/index.ts
```

Os mesmos ficheiros da volta 1, mais o documento desta volta; nenhum ficheiro novo além dos relatórios
(`T95.md` do Dev e o meu `T95-qa.md`). **Nota:** o `TASKS.md` cresceu de `+12/−1` para `+22/−1` — são
as tuas linhas da volta 1 e da decisão da volta 2 (registo da fila), não código; fica dito porque o
critério pedia «igual aos de antes, tirando este ficheiro».

## Limpeza

Não corri suite nem gate (nada de código mudou); não editei o documento nem o `eslint.config.mjs`;
zero git; porta 3000 não foi aberta nesta volta.

---

# Volta 3 — a regra vale no workspace todo

Data: 2026-11-22 · Só `eslint.config.mjs` da raiz mudou nesta volta. Sem suite e sem `test` (o código
da app e das packages não mudou desde a corrida de **149 passed (9.3m)**, `BUILD_ID
EqGf_lA5Al38AOHqf_rQI`, que continua a valer).

**Veredicto da volta 3: PASS.** A regra morde **dentro de `packages/`**, que era o buraco, e continua a
morder em `apps/web`.

## (a) A regra morde em `packages/` — PASS

Ficheiro `packages/shared/src/utils/__qa-t95-cn.ts` com `export { cn } from 'cn';`, `pnpm lint` (raiz):

```
@repo/shared:lint: D:\openbot\projetos-dev\financas-pessoais\packages\shared\src\utils\__qa-t95-cn.ts
@repo/shared:lint:   1:1  error  'cn' import is restricted from being used. Importa `cn` de
'@/lib/utils' — é o que tem a escala de texto do tema. …  no-restricted-imports
@repo/shared:lint: ✖ 1 problem (1 error, 0 warnings)
Failed:    @repo/shared#lint
EXIT=1
```

Apagado e repetido:

```
 Tasks:    4 successful, 4 total
Cached:    0 cached, 4 total
EXIT=0
```

O `git status` ficou nas mesmas oito entradas (configs, documentos, `cn.ts` apagado,
`utils/index.ts`, os dois relatórios) e o `ls` de `packages/shared/src/utils/` não tem o temporário.

## (b) E continua a morder em `apps/web` — PASS

```
$ pnpm --filter @repo/web lint      (com apps/web/src/__qa-t95-cn.ts)
  1:1  error  'cn' import is restricted …  no-restricted-imports
✖ 1 problem (1 error, 0 warnings)                                    EXIT=1

$ pnpm --filter @repo/web lint      (depois de apagar)
EXIT=0
```

O config do `web` não foi tocado nesta volta — a regra de lá é a mesma da volta 1.

## (c) Zero falsos positivos, sem cache — PASS

O `pnpm lint --force` da raiz, sem temporários, deu `4 successful` com **`Cached: 0 cached, 4 total`**
e `EXIT=0` — não veio de cache.

## (d) O bloco da raiz não é inerte por ordem — PASS

`git diff eslint.config.mjs`: o objecto novo tem `files: ['**/*.{ts,tsx,mjs,js}']` próprio e entra
**antes** do `prettier` (que fica último, como deve). Não há nada depois dele a repor a regra, e o
`@repo/shared#lint` a acusar o ficheiro de `packages/` prova-o por execução, não só por leitura.

## (e) Nada da app regrediu, e o build é novo — PASS

```
$ pnpm format:check && pnpm typecheck && pnpm build --force
All matched files use Prettier code style!
 Tasks:    4 successful, 4 total   (typecheck, 3 cached)
Cached:    0 cached, 2 total      (build, forçado)
EXIT=0
BUILD_ID KzqzgAu4qWMSToaA9A_EW
```

Sobre o número: o `EqGf_lA5Al38AOHqf_rQI` que o Dev citou é **o meu da volta 1**, e aparecia porque o
`pnpm build` restaurava o `.next` do cache do turborepo com o hash de inputs igual. Com `--force`
(`Cached: 0`) o `next build` correu mesmo e emitiu um `BUILD_ID` **novo** — `KzqzgAu4qWMSToaA9A_EW`.
É o comportamento normal do Next (o id é gerado por build, não derivado do conteúdo); não é preciso
desconfiar do número antigo, mas também não se deve citá-lo como «o build desta volta».

## (f) Suite — não repetida, por decisão

Só o `eslint.config.mjs` da raiz mudou. A corrida de frio da volta 1 — **149 passed (9.3m)**,
`4 utilizador(es) … 0 restante(s)`, `BUILD_ID EqGf_lA5Al38AOHqf_rQI` — continua a ser a prova válida,
e o `test` unitário não foi repetido (598/598 na volta 1).

## Limpeza

Temporários criados e apagados nos dois sítios (o `git status` ficou igual); zero escrita nos dois
`eslint.config.mjs`; zero git; porta 3000 não foi aberta.
