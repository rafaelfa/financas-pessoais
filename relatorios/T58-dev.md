# T58 — A árvore de dependências: CLI fora do runtime e o zod fechado (prova do Dev)

Base `ededd87`. Zero alterações de código de aplicação; o diff toca **dois** ficheiros.

## O que mudou

| Ficheiro | Mudança |
|---|---|
| `apps/web/package.json` | `shadcn@4.21.4` saiu de `dependencies` para `devDependencies` (mesma versão); `zod` `4.6.5` → **`4.6.6`** (patch) |
| `pnpm-lock.yaml` | `shadcn` no bloco `devDependencies` do importador; `zod@4.6.5` → `zod@4.6.6`; as chaves com peer `zod` (`better-call`, `zod-validation-error`, `@better-auth/*`) re-sufixadas para `(zod@4.6.6)`. Nenhuma outra versão muda e não entra nenhum pacote novo |

`zod` instalado: **`apps/web` 4.6.6** e **`packages/shared` 4.6.6** (`node_modules/.pnpm/` só tem
`zod@4.6.6` em 4.x; o `zod@3.25.76` que resta é do `shadcn`, agora dev-only).

**Como o `packages/shared` foi para 4.6.6 sem lhe tocar no manifesto:** o `package.json` de
`packages/shared` declara `zod: ^4.6.5` e está fora dos ficheiros que podia escrever. Como `^4.6.5`
**satisfaz** 4.6.6, fixei a resolução desse range no `pnpm-lock.yaml` (a entrada do importador passou
a `version: 4.6.6` e a cópia `zod@4.6.5` foi removida do lock). Validação:
`pnpm install --frozen-lockfile` → `Lockfile is up to date, resolution step is skipped`, `Packages: -1`,
e as duas cópias passaram a dizer 4.6.6. O `pnpm dedupe` faria o mesmo mas também reescrevia três
pacotes de `eslint` (só peers), o que o método desta tarefa não aceita.

## `pnpm audit --prod`, antes e depois

| | Antes | Depois |
|---|---|---|
| Instâncias vulneráveis | **31** (3 low · 16 moderate · 12 high) | **8** (2 low · 3 moderate · 3 high) |
| Avisos únicos (`--json`) | 29 | 8 |
| Módulos | `@hono/node-server`, `body-parser`, `deepmerge-ts`, `fast-uri` ×2, `hono` ×2, `ip-address`, `minimatch`, `mysql2` ×2, `picomatch`, `qs`, `systeminformation`, `undici` ×4, `zod` | `deepmerge-ts`, `fast-uri` ×4, `mysql2` ×2, `picomatch` |

Fecharam todos os do `shadcn` (`systeminformation`, `undici` ×4, `body-parser`, `hono` ×2,
`@hono/node-server`, `qs`, `minimatch`, `ip-address`, `fast-uri` do ramo do `shadcn`) **e o do
`zod`** (high, 4.6.5 → 4.6.6).

## `shadcn` fora da árvore de produção

```
$ pnpm --filter @repo/web why shadcn
Legend: production dependency, optional only, dev only

@repo/web@0.0.0 … (PRIVATE)

devDependencies:
shadcn 4.21.4

$ pnpm --filter @repo/web why shadcn --prod
(vazio)
```

O pacote **continua na árvore** (dev/build), de propósito: `globals.css:3` importa
`shadcn/tailwind.css`, que define os nove `@custom-variant` usados 158 vezes. Portar isso é outra
tarefa.

## O que fica, e porquê

Todos os avisos restantes entram pelo `better-auth`:

| Pacote | Versão | Severidade | Cadeia | Porque não se corrige aqui |
|---|---|---|---|---|
| `deepmerge-ts` | 7.1.5 | high | `better-auth > prisma > @prisma/config` | correção é `>=8.0.0` (major); exige subir o `better-auth`/Prisma — fora do âmbito |
| `mysql2` | 3.15.3 | high + moderate | `better-auth` (peer opcional) | protocolo MySQL numa base **PostgreSQL**: não alcançável; sair exige mexer no `better-auth` |
| `fast-uri` | 3.1.8 | 2 low + 2 moderate | `better-auth > prisma > @prisma/dev > … > ajv` | correção 3.1.9 vem por ferramenta de desenvolvimento do Prisma; exige subir o `better-auth` |
| `picomatch` | 4.0.7 | high | `better-auth > vitest` | **sem correção publicada** (`patched: <0.0.0`) |

## Gate

`format:check` verde · `lint` 4/4 · `typecheck` 4/4 · `test` **582** · `build` (turbo, `--force`) 2/2.
Suíte fica para o QA, como combinado.

## Diff

```
 apps/web/package.json |  4 +--
 pnpm-lock.yaml        | 78 +++++++++++++++++++++++++--------------------------
 2 files changed, 41 insertions(+), 41 deletions(-)
```

Zero ficheiros de código, zero dependências novas, zero migrações, sem `overrides`, sem tocar no
`globals.css`. O `apps/web/next-env.d.ts` reescrito pelo build foi revertido.
