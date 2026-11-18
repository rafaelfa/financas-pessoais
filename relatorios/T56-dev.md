# T56 — Next 16.4.0 → 16.4.6 (prova do Dev)

Base `4997718`. Patch de segurança (D21). Zero alterações de código de aplicação.

## Versão instalada e árvore

| Onde | Antes | Depois |
|---|---|---|
| `apps/web/node_modules/next/package.json` | 16.4.0 | **16.4.6** |
| `apps/web/package.json` (`next` e `eslint-config-next`, pin exato) | `16.4.0` | **`16.4.6`** |
| `pnpm-lock.yaml` — `next@16.4.0` | 1 entrada | **0** (`grep -c "next@16.4.0" pnpm-lock.yaml` → 0) |
| Cópias de `next` instaladas | 1 | **1** (`node_modules/.pnpm/next@16.4.6_…`; não há `next@16.4.0` na store) |

`pnpm --filter @repo/web why next`:

```
@repo/web@0.0.0 D:\openbot\projetos-dev\financas-pessoais\apps\web (PRIVATE)

dependencies:
better-auth 1.7.7
└── next 16.4.6 peer
next 16.4.6
```

## Registo do npm, com o comando

`POST https://registry.npmjs.org/-/npm/v1/security/advisories/bulk` com `{"next":["<versão>"]}`:

**next@16.4.0 — 5 avisos**

```
1242818  high      Next.js: Denial of Service in App Router using Server Actions | >=16.0.0 <=16.4.0
1242816  critical  Next.js: Unauthenticated Remote Code Execution in Image Optimization | >=16.0.0 <=16.4.0
1242859  critical  Next.js: Unauthenticated Remote Code Execution in `use cache` functions | >=16.0.0 <=16.4.0
1247486  moderate  Next.js: Information disclosure across root params when a 'use cache' … | >=16.3.0 <=16.4.4
1247712  moderate  Next.js: Cache leak across root param values in nested 'use cache' … | >=16.2.0 <=16.4.4
```

**next@16.4.6 — 0 avisos**

```
avisos: 0
```

São os cinco que a D21 registou: duas críticas de RCE, uma alta de DoS em Server Actions e duas
moderadas de fuga de cache entre root params.

## `next build` directo (o `nudge` que disparava o `SecurityFatalError`)

`cd apps/web && rm -rf .next && npx next build` — **exit 0**, `0` ocorrências de `SecurityFatalError`,
todas as rotas construídas (`/transacoes`, `/contas`, …, `manifest.webmanifest`). Sem
`__NEXT_AGENT_UPGRADE` e sem tocar em `next.config.ts`.

## Gate

`format:check` verde · `lint` 4/4 · `typecheck` 4/4 · `test` **582** · `build` (turbo, `--force`) 2/2.
A suíte fica para o QA, como combinado.

`pnpm audit --prod` depois da subida: **31 avisos** (3 low · 16 moderate · 12 high) — os cinco do
Next desapareceram; o que resta é a árvore do CLI `shadcn` (T58) e o protocolo MySQL do `better-auth`.

## Diff

```
 apps/web/package.json |   4 +-
 pnpm-lock.yaml        | 106 +++++++++++++++++++++++-------------------------
 2 files changed, 55 insertions(+), 55 deletions(-)
```

Só estas duas entradas no lockfile mudam de versão — `next`, `@next/eslint-plugin-next`,
`eslint-config-next` e as chaves com `peer next` (`better-auth@1.7.7(next@16.4.6(…))`). Nenhuma
dependência nova, nenhuma migração, nenhum ficheiro de aplicação tocado. O `apps/web/next-env.d.ts`
que o build reescreve foi revertido.
