# 02 — Estado atual do projeto (auditoria do monorepo)

> **Âmbito:** retrato exato do ponto de partida do monorepo em `C:\Users\VENOM\Downloads\aplicação Finanças pessoais`.
> **Método:** auditoria apenas de leitura — `read`, `grep`, `glob`, `git status`/`git log`, listagens, `Get-ChildItem`, leitura de `package.json` instalados em `node_modules` e `pnpm-lock.yaml`, `eslint` e `prettier --check` (ambos não mutantes).
> **Data da auditoria:** 2026-10-10.
> **Não executado (por regra da tarefa):** `pnpm install`, `prisma generate/migrate/push`, `pnpm build`, `pnpm typecheck`.
> **Convenção de evidência:** cada afirmação refere o caminho relativo do ficheiro que a sustenta. Onde não foi possível confirmar por execução, está marcado **[a confirmar]**.

---

## 1. Estrutura de pastas relevante

### 1.1 Raiz

| Caminho | Bytes | Nota |
|---|---:|---|
| `.editorconfig` | 220 | charset utf-8, LF, 2 espaços |
| `.env` | 227 | **existe em disco** (4 variáveis), git-ignored |
| `.env.example` | 842 | modelo documentado das 4 variáveis |
| `.gitignore` | 499 | deps, build, `.env`, `src/generated/`, logs, editores, coverage |
| `.prettierignore` | 70 | `node_modules`, `.next`, `.turbo`, `dist`, `build`, `out`, `coverage`, `pnpm-lock.yaml`, `*.md` |
| `.prettierrc.json` | 334 | ver §7.2 |
| `docker-compose.yml` | 628 | PostgreSQL 18 local |
| `eslint.config.mjs` | 1223 | flat config do workspace (packages + raiz) |
| `package.json` | 1074 | raiz, privado, `packageManager: pnpm@10.17.1` |
| `pnpm-lock.yaml` | 328 196 | `lockfileVersion: '9.0'`, 8 984 linhas, 4 importers |
| `pnpm-workspace.yaml` | 812 | `apps/*`, `packages/*` + políticas |
| `tsconfig.json` | 714 | base partilhada (strict) |
| `turbo.json` | 1001 | tasks, `globalEnv`, `globalDependencies` |

**Não existem** (confirmado por listagem + `Test-Path`): `.git/`, `.github/`, `.vscode/`, `README*`, `LICENSE*`, `CHANGELOG*`, `.npmrc`, `docs/`, `.turbo/`, `.next/`.
Isto significa que **o projeto não está sob controlo de versões próprio**: `git rev-parse --show-toplevel` devolve `C:/Users/VENOM` (o repositório do perfil do utilizador) e `git log` responde `fatal: your current branch 'master' does not have any commits yet`. Não existe qualquer commit que sirva de linha de base.

### 1.2 Fontes do workspace

```
apps/web/
  components.json  eslint.config.mjs  next.config.ts  package.json
  postcss.config.mjs  tsconfig.json  tsconfig.tsbuildinfo
  src/
    app/
      globals.css            (129 linhas — tokens de tema)
      layout.tsx             (49 linhas)
      page.tsx               (110 linhas — página de estado do scaffold)
      api/health/route.ts    (46 linhas)
    components/
      mode-toggle.tsx        (42 linhas)
      theme-provider.tsx     (17 linhas)
      ui/                    (15 componentes shadcn, 1 229 linhas)
    lib/
      env.ts                 (24 linhas)
      utils.ts               (1 linha)
packages/db/
  package.json  prisma.config.ts  tsconfig.json  tsconfig.tsbuildinfo
  prisma/schema.prisma           (19 linhas)
  src/index.ts  src/client.ts
  src/generated/prisma/**        (8 ficheiros, 31,7 KB — código gerado)
packages/shared/
  package.json  tsconfig.json  tsconfig.tsbuildinfo
  src/index.ts  src/schemas/{index,api,env,money,primitives}.ts
  src/types/index.ts  src/utils/{index,cn,currency,date}.ts
```

Volumes medidos:

- `apps/web/src`: **23 ficheiros, 1 647 linhas** (dos quais 15 componentes `ui/` com 1 229 linhas); somando os 6 ficheiros de configuração na raiz de `apps/web` (`components.json`, `eslint.config.mjs`, `next.config.ts`, `package.json`, `postcss.config.mjs`, `tsconfig.json`), **29 ficheiros e 1 809 linhas**.
- `packages/shared/src`: **11 ficheiros, 413 linhas** — o pacote com lógica real.
- `packages/db` (sem `src/generated`): **4 ficheiros, 103 linhas**.
- `packages/db/src/generated/prisma`: **8 ficheiros, 31,7 KB** (`client.ts`, `models.ts`, `enums.ts`, `commonInputTypes.ts`, `browser.ts`, `internal/{class,prismaNamespace,prismaNamespaceBrowser}.ts`). Ignorado por `.gitignore:25` (`packages/db/src/generated/`) e por `eslint.config.mjs` (`**/src/generated/**`). Está presente ⇒ `prisma generate` já correu com sucesso.

### 1.3 `node_modules` (referência de volume, não detalhado)

- `node_modules/` da raiz: **851,3 MB**; conteúdo direto reduzido a 12 entradas — `eslint`, `eslint-config-prettier`, `prettier`, `prettier-plugin-tailwindcss`, `rimraf`, `turbo`, `typescript`, `typescript-eslint`, `.bin`, `.pnpm`, `.modules.yaml`, `.pnpm-workspace-state-v1.json`.
- `node_modules/.pnpm`: **822 entradas** (armazém virtual do pnpm).
- `apps/web/node_modules`: 21 entradas, com **18 symlinks** + `@repo/{db,shared}` ligados por `link:` para `packages/*` (pnpm com isolamento estrito — as dependências de app não estão hoisted para a raiz).
- `packages/db/node_modules`: `prisma`, `@prisma/client`, `@prisma/adapter-pg`, `pg`, `dotenv`. `packages/shared/node_modules`: `zod`.

### 1.4 Artefactos de verificação já presentes

- `apps/web/tsconfig.tsbuildinfo` (194 163 B, 2026-10-08 23:15:30), `packages/db/tsconfig.tsbuildinfo` (50 363 B, 23:06:11), `packages/shared/tsconfig.tsbuildinfo` (33 316 B, 23:15:27). Provam que `tsc` já correu nos três pacotes; são `incremental: true` (`tsconfig.json:21`), ignorados por `.gitignore:16` (`*.tsbuildinfo`).
- **`apps/web/next-env.d.ts` NÃO existe** e não há `.next/`. Conclusão: `next dev` / `next build` **nunca correram** neste checkout.
- Cronologia dos mtimes: 22:42–22:46 (raiz + shared primitives), 23:05–23:06 (db + generate), 23:12–23:15:22 (shadcn, layout, health, env). Último toque em ficheiro de código: `packages/shared/src/schemas/env.ts`, `apps/web/src/lib/env.ts` (23:15:22). Última escrita: `pnpm-lock.yaml` (23:15:08) e os `tsbuildinfo` (23:15:27/30).

---

## 2. Versões exatas, runtime e scripts

### 2.1 Runtime e gestor de pacotes

| Item | Valor | Fonte |
|---|---|---|
| `packageManager` | `pnpm@10.17.1` | `package.json:5` |
| `engines.node` | `>=20.18.1` | `package.json:6-8` |
| Node instalado | `v24.21.0` | `node --version` |
| pnpm instalado | `10.17.1` | `pnpm --version` |
| Gestor de pacotes efetivo | pnpm workspaces + Turborepo | `pnpm-workspace.yaml`, `turbo.json` |

### 2.2 Dependências — declarado vs. instalado

Valores instalados lidos de `apps/web/node_modules/<pkg>/package.json`, `packages/*/node_modules/<pkg>/package.json` e conferidos com `pnpm-lock.yaml`.

**`apps/web` (`apps/web/package.json`)**

| Pacote | Declarado | Instalado |
|---|---|---|
| `next` | `16.4.0` | **16.4.0** |
| `react` / `react-dom` | `19.3.0` | **19.3.0** |
| `tailwindcss` (dev) | `4.3.3` | **4.3.3** |
| `@tailwindcss/postcss` (dev) | `4.3.3` | **4.3.3** |
| `typescript` (dev) | `5.9.3` | **5.9.3** |
| `radix-ui` | `^1.7.0` | **1.7.0** (pacote unificado, não `@radix-ui/*`) |
| `shadcn` | `^4.21.4` | **4.21.4** |
| `lucide-react` | `^1.53.0` | **1.53.0** |
| `next-themes` | `^0.4.6` | **0.4.6** |
| `tw-animate-css` | `^1.4.0` | **1.4.0** |
| `cn` | `^0.4.0` | **0.4.0** |
| `class-variance-authority` | `^0.7.1` | **0.7.1** |
| `eslint` (dev) | `^9.39.5` | **9.39.5** |
| `eslint-config-next` (dev) | `16.4.0` | **16.4.0** |
| `@types/node` (dev) | `^26.6.4` | **26.6.4** |
| `@types/react`, `@types/react-dom` (dev) | `^19.3.0` | **19.3.0** |

**`packages/db`** — `prisma` `7.10.0` → **7.10.0**; `@prisma/client` `7.10.0` → **7.10.0**; `@prisma/adapter-pg` `7.10.0` → **7.10.0**; `pg` `^8.23.1` → **8.23.1**; `dotenv` `^18.0.6` → **18.0.6** (há também `dotenv@17.4.2` transitivo); `@types/pg` `^8.23.1`.

**`packages/shared`** — `zod` `^4.6.5` → **4.6.5** (existe `zod@3.25.76` transitivo no lockfile); `cn` `^0.4.0` → **0.4.0**.

**Raiz (devDependencies)** — `turbo` `^2.11.7` → **2.11.7**; `prettier` `3.9.9` (fixo) → **3.9.9**; `prettier-plugin-tailwindcss` `^0.8.1` → **0.8.1**; `eslint` `^9.39.5` → **9.39.5**; `eslint-config-prettier` `^10.1.8` → **10.1.8**; `typescript-eslint` `^8.71.1` → **8.71.1**; `rimraf` `^6.0.1` → **6.1.3**.

`prisma@7.10.0` no lockfile traz peers de `react`/`react-dom` (Prisma Studio), o que explica React 19 aparecer também sob `packages/db`; não é dependência de runtime da app.

### 2.3 Scripts disponíveis

**Raiz — `package.json:9-24`**

```
dev          turbo run dev
build        turbo run build
start        turbo run start
lint         turbo run lint
typecheck    turbo run typecheck
format       prettier --write .
format:check prettier --check .
db:generate  pnpm --filter @repo/db db:generate
db:push      pnpm --filter @repo/db db:push
db:studio    pnpm --filter @repo/db db:studio
db:migrate   pnpm --filter @repo/db db:migrate
db:format    pnpm --filter @repo/db db:format
db:validate  pnpm --filter @repo/db db:validate
clean        turbo run clean && rimraf node_modules .turbo
```

**`@repo/web` — `apps/web/package.json:5-12`**

```
dev        next dev --port 3000
build      next build
start      next start --port 3000
lint       eslint .            ← nota: `next lint` foi removido no Next 16
typecheck  tsc --noEmit
clean      rimraf .turbo .next node_modules
```

**`@repo/db` — `packages/db/package.json:10-20`**

```
db:generate  prisma generate
db:push      prisma db push
db:studio    prisma studio
db:migrate   prisma migrate dev
db:format    prisma format
db:validate  prisma validate
lint         eslint .
typecheck    prisma generate && tsc --noEmit   ← encadeia generate
clean        rimraf .turbo node_modules src/generated
```

**`@repo/shared` — `packages/shared/package.json:12-16`**

```
lint       eslint .
typecheck  tsc --noEmit
clean      rimraf .turbo node_modules
```

Nenhum pacote tem script `test`. Nenhum package.json declara `vitest`, `jest`, `playwright`, `cypress` ou `@testing-library/*` — confirmado também por `grep` ao `pnpm-lock.yaml` (as únicas ocorrências de `@playwright/test` são um **peer opcional do Next** em `pnpm-lock.yaml:3411`, não instalado; `@visx/*` aparece apenas como transitivo do CLI `shadcn`). **Não existe infraestrutura de testes de qualquer tipo.**

---

## 3. Conteúdo e estado de `apps/web/src`

### 3.1 `src/app/layout.tsx` (49 linhas)

- Server component; `import type { Metadata } from 'next'` e `Geist` de `next/font/google` com `variable: '--font-sans'` (linha 11). **A fonte é carregada da Google em runtime de build** — sem `next/font/local`, logo o build exige rede.
- `metadata` fixa: `title: 'Finanças Pessoais'`, descrição "Monorepo de finanças pessoais — Next.js, Prisma e PostgreSQL." (linhas 13-16).
- `<html lang="pt-BR" suppressHydrationWarning className={cn('font-sans', geist.variable)}>` (linhas 22-26). **`lang="pt-BR"`** — inconsistente com o objetivo de produto em português de Portugal.
- Cadeia de providers: `ThemeProvider` (`attribute="class"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`) → `TooltipProvider` → `<div className="flex min-h-svh flex-col">` com header mínimo (`Finanças Pessoais` + `<ModeToggle />`) e `<div className="flex-1">{children}</div>`.
- **Não há sidebar, navegação de produto, breadcrumbs, Toaster nem área de conteúdo de app** — apenas um header de 1 linha.

### 3.2 `src/app/page.tsx` (110 linhas)

Página de estado do scaffold, auto-documentada no próprio ficheiro: *"This is intentionally not a product feature — it only proves that the monorepo wiring works"* (linhas 13-19). Conteúdo real:

- const `PACKAGES` com 3 cartões (`@repo/web`, `@repo/db`, `@repo/shared`); o texto do `@repo/db` diz literalmente **"Schema vazio — apenas a datasource `postgresql` declarada."** (linha 29).
- Renderiza um `Badge variant="secondary"` com o texto **`setup`** e o parágrafo "Monorepo configurado. Nenhuma funcionalidade de produto foi implementada ainda." (linhas 46-50).
- Prova de integração: `formatCurrency(123_456, DEFAULT_CURRENCY)` → usa `@repo/shared` (linha 79) e `formatDate(new Date())`.
- Cartão informativo sobre claro/escuro (`next-themes` via classe `.dark`).
- Rodapé com o atalho `GET /api/health`.

Ou seja: **a única rota de produto (`/`) é uma página de diagnóstico.** Não há rotas `/(auth)`, `/dashboard`, `/transacoes`, `/orcamento`, etc.

### 3.3 `src/app/globals.css` (129 linhas)

- Imports (linhas 1-3): `@import 'tailwindcss';` + `@import "tw-animate-css";` + `@import "shadcn/tailwind.css";`. O terceiro resolve para `apps/web/node_modules/shadcn/dist/tailwind.css` (declarado em `shadcn@4.21.4` como `"./tailwind.css": "./dist/tailwind.css"`); esse ficheiro define apenas `@keyframes accordion-down/up`. **[a confirmar]** que o resolver de `@import` do Tailwind 4 honra o `exports` do pacote — só um `next build` o prova.
- Dark mode: `@custom-variant dark (&:is(.dark *));` (linha 5) — **exige `.dark` num ancestral**, ou seja `dark:` nunca se aplica ao próprio `<html>`, só aos seus descendentes. Compatível com `next-themes` `attribute="class"`, mas é uma armadilha latente.
- `@theme inline` (linhas 7-48): mapeia todos os tokens shadcn (`--color-*`) — incluindo `--color-sidebar-*`, `--color-chart-1..5` — e define escala de raios derivada de `--radius` (`--radius-sm: calc(var(--radius) * 0.6)` … `--radius-4xl: calc(var(--radius) * 2.6)`).
- `:root` (linhas 50-83): paleta **neutra/acromática**, `--radius: 0.625rem`, `--destructive: oklch(0.577 0.245 27.325)`. `--chart-1..5` são todos cinzentos: `oklch(0.87 0 0)` … `oklch(0.269 0 0)`.
- `.dark` (linhas 85-117): espelho escuro; `--border: oklch(1 0 0 / 10%)`, `--input: oklch(1 0 0 / 15%)`; `--sidebar-primary: oklch(0.488 0.243 264.376)` (único tom com matiz).
- Tipografia: `--font-sans: var(--font-sans)` e `--font-heading: var(--font-sans)` (linhas 8-9) — **autorreferência**; funciona porque `@theme inline` injeta o valor em vez de emitir a variável, e `Geist` escreve `--font-sans` no `<html>`; é frágil e vale a pena simplificar para um nome distinto (ex.: `--font-geist-sans`).
- `@layer base` (linhas 119-128): `* { @apply border-border outline-ring/50 }`, `body { @apply bg-background text-foreground }`, `html { @apply font-sans }`.
- **Não há** `@media (prefers-color-scheme)` nem `color-scheme` declarado; **não há tokens semânticos de finanças** (receita/despesa/positivo/negativo/alerta/meta) nem paleta de gráficos com cor — os 5 tokens de chart são grayscale.
- **Indentação de 4 espaços** nos blocos `:root`/`.dark`/`@theme inline`, contra `tabWidth: 2` do Prettier → contribui para a falha de `format:check` (§7.2).

### 3.4 Componentes `components/ui` (15 ficheiros, 1 229 linhas)

Estilo shadcn `radix-nova` (`components.json:3`), `rsc: true`, `tailwind.config: ""` (Tailwind 4 sem ficheiro de config), `baseColor: neutral`, `cssVariables: true`, `iconLibrary: lucide`, aliases `@/components`, `@/lib/utils`, `@/components/ui`, `@/lib`, `@/hooks`.

| Componente | Linhas | Em uso? |
|---|---:|---|
| `dropdown-menu.tsx` | 8 821 B | **sim** — `mode-toggle.tsx:12` |
| `select.tsx` | 6 669 B | não |
| `dialog.tsx` | 4 225 B | não |
| `tabs.tsx` | 3 562 B | não |
| `button.tsx` | 3 375 B | **sim** — `mode-toggle.tsx:6`, `dialog.tsx:7` |
| `avatar.tsx` | 3 088 B | não |
| `card.tsx` | 2 620 B | **sim** — `page.tsx:10` |
| `tooltip.tsx` | 2 101 B | **sim** — `layout.tsx:6` (`TooltipProvider`) |
| `badge.tsx` | 1 855 B | **sim** — `page.tsx:3` |
| `checkbox.tsx` | 1 572 B | não |
| `input.tsx` | 958 B | não |
| `textarea.tsx` | 832 B | não |
| `separator.tsx` | 634 B | **sim** — `page.tsx:11` |
| `label.tsx` | 596 B | não |
| `skeleton.tsx` | 266 B | não |

Padrão de imports destes ficheiros: `import { cn } from "cn"` e primitivas do **pacote único `radix-ui`** (`{ Dialog as DialogPrimitive } from "radix-ui"`), ícones de `lucide-react`. Aspas **duplas** e **sem ponto-e-vírgula** (output do CLI), contra o estilo do resto do repositório.

**9 dos 15 componentes nunca são importados** (`avatar`, `checkbox`, `dialog`, `input`, `label`, `select`, `skeleton`, `tabs`, `textarea`) — foram instalados à frente do uso. Faltam os que a app vai exigir: `form`, `table`, `toast/sonner`, `sheet`, `popover`, `calendar`, `date-picker`, `progress`, `alert`, `command`, `chart`.

Não existe o diretório `src/hooks/` apesar do alias `"hooks": "@/hooks"` em `components.json:20`.

### 3.5 `src/components/mode-toggle.tsx` e `theme-provider.tsx`

- `mode-toggle.tsx` (42 linhas, `'use client'`): `DropdownMenu` + `Button variant="outline" size="icon"` com `aria-label="Alternar tema"`; opções **Claro / Escuro / Sistema** com `Monitor`, `Moon`, `Sun` (linhas 14-18) e `setTheme(value)`. Não usa estado `mounted` — como ambos os ícones estão sempre no DOM (alternados por CSS `dark:`), não há mismatch de texto em hidratação.
- `theme-provider.tsx` (17 linhas, `'use client'`): wrapper fino de `next-themes`, documentado como compatível com `@custom-variant dark (&:is(.dark *))`.

### 3.6 `src/app/api/health/route.ts` (46 linhas)

- `export const dynamic = 'force-dynamic'` (linha 8) — sem cache.
- `isDatabaseReachable()`: `await prisma.$queryRaw\`SELECT 1\`` dentro de `try/catch` → boolean (linhas 11-18).
- `GET()` monta o payload com `healthCheckSchema.parse({...})` importado de `@repo/shared` (linhas 29-43), incluindo `service: '@repo/web'`, `version: '0.0.0'`, `timestamp: new Date().toISOString()`, `uptimeInSeconds: Math.round(process.uptime())` e `dependencies.database = { provider: 'postgresql', configured: Boolean(env.DATABASE_URL), reachable }`.
- Devolve `200` quando a BD responde e `503` quando não (linha 45). **É a única rota de API existente.**

### 3.7 `src/lib/env.ts` (24 linhas) e `src/lib/utils.ts` (1 linha)

- `env.ts`: `serverEnvSchema.safeParse(process.env)` **no carregamento do módulo** (linha 11); em falha lança `Error` com a lista de `issue.path` e a instrução "Copie `.env.example` para `.env` na raiz do repositório e preencha os valores." (linhas 13-22). Exporta `env: ServerEnv`.
  Consequência dura: **como o schema exige `NEXTAUTH_SECRET` (mín. 32) e `NEXTAUTH_URL` válido, a app não arranca sem variáveis de NextAuth — apesar de não existir nenhuma biblioteca de autenticação instalada.**
- `utils.ts`: `export { cn } from "cn"` — duplica `packages/shared/src/utils/cn.ts`, que faz exatamente o mesmo. Duas fontes para o mesmo helper.

---

## 4. `packages/db` e `packages/shared`

### 4.1 `packages/db/prisma/schema.prisma` (19 linhas) — **0 modelos, 0 enums, 0 índices**

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
  importFileExtension = ""
}
datasource db {
  provider = "postgresql"
}
```

- O cabeçalho do ficheiro é explícito: *"Prisma schema — intentionally empty. Only the datasource (provider) and the client generator are declared; no models yet."* (linhas 1-5).
- O `url` **não** está no schema — Prisma 7 moveu-o para `prisma.config.ts`.
- `provider = "prisma-client"` (não `prisma-client-js`) gera TypeScript em `src/generated/prisma`, e `importFileExtension = ""` existe para não emitir extensões nos imports relativos sob `moduleResolution: "Bundler"`.
- **Não existe `packages/db/prisma/migrations/`** (verificado: `prisma/` contém apenas `schema.prisma`). Há, portanto, **zero migrações e nenhum histórico de migração**; a estratégia preparada nos scripts é `db:push`.
- Logo: **não existe uma única tabela** de utilizador, conta, transação, categoria, orçamento, objetivo, dívida ou recorrência.

### 4.2 `packages/db/prisma.config.ts` (29 linhas)

```ts
loadEnv({ path: ['.env', '../../.env'], quiet: true });
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DATABASE_URL') },
});
```

Resolve a ausência de `dotenv` automático no Prisma 7 e admite invocação a partir de `packages/db` **ou** da raiz. `migrations.path` já aponta para a pasta inexistente.

### 4.3 `packages/db/src/client.ts` (40 linhas) e `src/index.ts` (15 linhas)

- `client.ts`: `PrismaPg` de `@prisma/adapter-pg` é **obrigatório** (*"Prisma 7 requires an explicit driver adapter — a bare `new PrismaClient()` throws at construction time"*, linhas 5-8). Se `DATABASE_URL` faltar, lança erro explícito (linhas 16-20). Singleton em `globalThis` para sobreviver a hot reload (linhas 9-11, 33-37). Exporta `prisma`, `PrismaClient` e `export * from './generated/prisma/client'`.
- `index.ts`: `export * from './client'`.
- Nota de higiene: a mesma mensagem de erro (*"Copy `.env.example` to `.env`…"*) aparece em `client.ts:18` e `packages/shared` não valida `DATABASE_URL` na app — há duplicação de validação de ambiente entre `apps/web/src/lib/env.ts` (Zod) e `packages/db/src/client.ts` (check manual).

### 4.4 `packages/shared` — schemas

**`src/schemas/primitives.ts` (43 linhas)** — `uuidSchema` (`z.uuid()`), `cuidSchema` (`z.string().startsWith('c').min(25).max(30)`), `idSchema`, `emailSchema` (`z.email`), `isoDateSchema` (`z.iso.date()`), `isoDateTimeSchema` (`z.iso.datetime({offset:true})`), **`currencySchema = z.enum(['BRL','USD','EUR'])`**, `sortOrderSchema`, `paginationSchema` (`page`/`perPage` 1-100 default 20/`order` desc, com `z.coerce`), `nullableStringSchema`. Comentário-chave nas linhas 3-9: *"Everything exported from `@repo/shared` is the single source of truth for runtime validation. Types are always derived from these schemas with `z.infer` instead of being hand written."*

**`src/schemas/money.ts` (32 linhas)** — regra central: **dinheiro é sempre inteiro em cêntimos** (*"Money is always stored and transported as an integer number of cents to avoid the floating point rounding errors"*). `amountInCentsSchema` = `z.int()` entre `-999_999_999_99` e `999_999_999_99`; `moneySchema` com `currency` default `'BRL'`; `positiveMoneySchema` (receita) e `negativeMoneySchema` (despesa). Duas observações concretas:
1. a mensagem de `.min(...)` é *"Valor acima do limite suportado."*, ou seja errada para valores demasiado baixos (deveria dizer "abaixo do mínimo");
2. a convenção de sinal (**despesa negativa, receita positiva**) só existe no comentário — não há convenção reforçada por tipo/documentação de produto.

**`src/schemas/env.ts` (33 linhas)** — `nodeEnvSchema` (`development|test|production`), `serverEnvSchema` com `NODE_ENV` (default `development`), `DATABASE_URL` (`min(1)`), `NEXTAUTH_SECRET` (`min(32)`), `NEXTAUTH_URL` (`z.url()`). Exporta `ServerEnv` e `NodeEnv`. **O `NEXTAUTH_*` está aqui apesar de não haver NextAuth/Auth.js instalado nem qualquer rota de autenticação.**

**`src/schemas/api.ts` (58 linhas)** — `apiErrorCodeSchema` com 7 códigos (`BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `VALIDATION_ERROR`, `INTERNAL_ERROR`), `apiErrorSchema` (com `fieldErrors` por caminho), `apiResponseSchema<T>(data)`, `apiErrorResponseSchema(error)`, e `healthCheckSchema` (`status: ok|degraded`, `timestamp: z.iso.datetime({offset:true})`, `dependencies.database.configured/reachable`). **Os envelopes estão definidos mas nenhuma rota os usa** — `api/health/route.ts` devolve o payload cru com `NextResponse.json`, sem envelope.

**`src/schemas/index.ts`** — re-exporta `api`, `env`, `money`, `primitives`.

### 4.5 `packages/shared` — utils e tipos

**`src/utils/currency.ts` (85 linhas)** — `DEFAULT_CURRENCY: Currency = 'BRL'` (linha 4) e **`DEFAULT_LOCALE = 'pt-BR'`** (linha 7). Mapa `CURRENCY_LOCALE`: `BRL → pt-BR`, `USD → en-US`, **`EUR → de-DE`** (linha 12) — formata euros com convenções alemãs (`.`) e não PT-PT. `formatCurrency(amountInCents, currency = DEFAULT_CURRENCY)` divide por 100 e usa `Intl.NumberFormat` com cache em `Map`. `parseCurrencyToCents` normaliza `"1.234,56"` e `"1234.56"` (remove separadores de milhar, troca vírgula por ponto, `Math.round(parsed*100)`) e devolve `null` para input inválido. `centsToDecimal`, `decimalToCents`, `sumCents` (soma inteira sem drift). Exemplo documentado: `formatCurrency(123456)` → `"R$ 1.234,56"`.

**`src/utils/date.ts` (64 linhas)** — formatters `Intl` em `pt-BR`: `formatDate` → `dd/MM/yyyy`, `formatDateTime` → `dd/MM/yyyy HH:mm`, `formatMonth` → `outubro de 2026`; `toDateInputValue` para `<input type="date">`; `startOfMonth`/`endOfMonth` **em UTC** (`Date.UTC`, `endOfMonth` é limite superior exclusivo). Não há suporte a fuso horário de Lisboa nem a semanas/meses fiscais.

**`src/utils/cn.ts` (12 linhas)** — `export { cn } from 'cn'` e `export type { ClassValue } from 'cn'`, com a justificação de haver "exactly one Tailwind class-conflict engine". O pacote `cn@0.4.0` é o *"Drop-in replacement for clsx + tailwind-merge"* mantido em `github.com/shadcn-ui/cn` — é escolha intencional, não erro de dependência.

**`src/types/index.ts` (67 linhas)** — derivados por `z.infer`: `Currency`, `SortOrder`, `AmountInCents`, `Money`, `Email`, `IsoDate`, `IsoDateTime`, `Pagination`, `ApiErrorCode`, `ApiError`, `HealthCheck`; e interfaces manuais `ApiSuccess<T>`, `ApiFailure`, `ApiResult<T>`.

**`src/index.ts` (12 linhas)** — re-exporta `schemas`, `types`, `utils`; entry points granulares declarados em `package.json` (`./schemas`, `./types`, `./utils`).

---

## 5. Infraestrutura, ambiente e o que é exigido para arrancar

### 5.1 `docker-compose.yml` (27 linhas)

`services.postgres`: imagem **`postgres:18-alpine`**, `container_name: financas-postgres`, `restart: unless-stopped`, `POSTGRES_USER: postgres`, `POSTGRES_PASSWORD: postgres`, `POSTGRES_DB: financas`, portas `5432:5432`, volume nomeado `postgres-data:/var/lib/postgresql/data`, healthcheck `pg_isready -U postgres -d financas` (5s/5s/10 retries). O comentário confirma que as credenciais coincidem com o `DATABASE_URL` de `.env.example`.

### 5.2 `.env` / `.env.example`

`.env.example` documenta 4 chaves (18 linhas): `DATABASE_URL`, `NEXTAUTH_SECRET` (com sugestão de geração por `crypto.randomBytes(32).toString('hex')`), `NEXTAUTH_URL="http://localhost:3000"`, `NODE_ENV="development"`.

O `.env` **existe em disco** e define as 4 chaves com valores preenchidos (valores não reproduzidos aqui; `DATABASE_URL` coerente com o compose, `NEXTAUTH_SECRET` com 64 caracteres hexadecimais, `NEXTAUTH_URL="http://localhost:3000"`). Está coberto por `.gitignore:20` (`.env`) com a exceção `!.env.example` (linha 22).

`apps/web/next.config.ts:13-17` faz `process.loadEnvFile(resolve(process.cwd(), '..', '..', '.env'))` quando o ficheiro existe — não é uma variável de ambiente de processo, é leitura explícita do `.env` da raiz. `packages/db/prisma.config.ts:16-19` faz o equivalente via `dotenv`. **Nota:** `apps/web/src/lib/env.ts` valida `process.env` no carregamento do módulo; a ordem `next.config.ts` → módulo depende de `loadEnvFile` já ter corrido.

### 5.3 Pré-requisitos para arrancar (nada disto está verificado por execução)

1. **Node ≥ 20.18.1** (`package.json:6-8`; local: v24.21.0). `process.loadEnvFile` exige Node ≥ 20.12, pelo que o `engines` é o limite efetivo.
2. **pnpm 10.17.1** (`packageManager`); `.env` presente na raiz com as 4 chaves válidas.
3. **Docker + Docker Compose** para o PostgreSQL 18 (porta 5432 livre).
4. `pnpm install` — bloqueado por política da tarefa; a instalação **já existe** (`node_modules` de 851,3 MB e `pnpm-lock.yaml` de 8 984 linhas coerente com os `package.json`).
5. `docker compose up -d` e, para criar o esquema, `pnpm db:push` (não há migrações) ou `pnpm db:migrate` para iniciar o histórico.
6. `pnpm dev` — mas atenção: a task `dev` do Turbo tem `dependsOn: ["^db:generate"]` (`turbo.json:18`), logo **`pnpm dev`, `pnpm lint`, `pnpm typecheck` e `pnpm build` executam `prisma generate`** primeiro (`packages/db` → script `db:generate`).

Evidência de que os passos 1-5 já correram parcialmente: `packages/db/src/generated/prisma` existe (generate OK) e os `tsconfig.tsbuildinfo` existem (tsc OK). Evidência de que **não** chegaram ao fim: ausência de `.next/`, `apps/web/next-env.d.ts`, `.turbo/` e `packages/db/prisma/migrations/`.

---

## 6. O que está feito vs. o que falta (por módulo, 8 módulos do pedido)

| Módulo | Estado | Evidência no código |
|---|---|---|
| **auth** | **NÃO INICIADO** | Nenhuma dependência (`next-auth`/`@auth/*`/`better-auth` ausentes do `package.json` e do lockfile), nenhuma rota, nenhum middleware (`apps/web` não tem `middleware.ts`), nenhum modelo `User` (`schema.prisma` vazio). Existe apenas o *contrato de ambiente* `NEXTAUTH_SECRET`/`NEXTAUTH_URL` em `packages/shared/src/schemas/env.ts:21-26`, o que cria a obrigação sem a funcionalidade. |
| **contas/carteiras** | **NÃO INICIADO** | Sem modelo, sem rota, sem UI. O `healthCheckSchema.dependencies.database.provider` é a única menção a "provider". |
| **transações** | **NÃO INICIADO** | Sem modelo, sem rota, sem página. Os únicos helpers úteis já prontos são `formatCurrency`/`parseCurrencyToCents`/`sumCents` (`packages/shared/src/utils/currency.ts`) e `startOfMonth`/`endOfMonth` para filtros por período. |
| **categorias** | **NÃO INICIADO** | Sem modelo, sem enum, sem UI de categorias/subcategorias. Não existe nenhuma taxonomia seed. |
| **orçamento** | **NÃO INICIADO** | Sem modelo, sem cálculos de previsto vs. realizado, sem UI. Nenhum token de tema para sinalizar ultrapassagem do orçamento. |
| **objetivos** | **NÃO INICIADO** | Sem modelo `Goal`, sem progresso, sem UI. Nada de contribuições/percentagens. |
| **relatórios** | **NÃO INICIADO** | Nenhuma biblioteca de gráficos nos `package.json` (sem `recharts`, `echarts`, `chart.js`, `nivo`, `tremor`; `@visx/*` só aparece como transitivo do CLI `shadcn` no lockfile). `--chart-1..5` existem em `globals.css`, mas **todos em grayscale** e sem componentes que os usem. |
| **importação (OFX/CSV)** | **NÃO INICIADO** | Sem `papaparse`/`ofx-js`/equivalente, sem rota de upload, sem parser. Não há `formidable`/`busboy` nem `route.ts` de upload. |

**Resumo:** **nenhum** dos 8 módulos tem uma única linha de funcionalidade de produto. O que existe é a *fundação técnica* (workspace, temas, primitivas de validação, client Prisma, uma rota de saúde) e um contrato de dados partilhado pronto a ser estendido.

Ficheiros que **realmente** contêm lógica reutilizável hoje: `packages/shared/src/schemas/{primitives,money,api,env}.ts`, `packages/shared/src/utils/{currency,date,cn}.ts`, `packages/shared/src/types/index.ts`, `packages/db/src/client.ts`, `apps/web/src/app/api/health/route.ts`, `apps/web/src/lib/env.ts`. Todo o resto é scaffold, tema ou UI genérica.

---

## 7. Convenções vigentes (o que o código demonstra)

### 7.1 ESLint — dois flat configs

- **Raiz** `eslint.config.mjs` (46 linhas): `globalIgnores` (`**/node_modules/**`, `.next`, `.turbo`, `dist`, `build`, `coverage`, `next-env.d.ts`, **`**/src/generated/**`**), `...tseslint.configs.recommended`, bloco para `**/*.{ts,tsx,mjs,js}` com `ecmaVersion: 2023`, `sourceType: 'module'`, e duas regras explícitas:
  - `'@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports', fixStyle: 'inline-type-imports' }]`
  - `'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]`
  - `prettier` **por último**, com o comentário "Must stay last so formatting-related rules never fight Prettier."
- **`apps/web/eslint.config.mjs`** (38 linhas): `...nextVitals` (`eslint-config-next/core-web-vitals`) + `...nextTs` (`eslint-config-next/typescript`) + `...tseslint.configs.recommended` + as mesmas duas regras + `globalIgnores(['.next/**','out/**','build/**','next-env.d.ts','dist/**'])` + `prettier` no fim. Documenta que **`next lint` foi removido no Next.js 16** e o lint passa a correr pelo CLI do ESLint.
- O comentário da raiz afirma que "ESLint resolves the nearest config file for each lint run, so `pnpm --filter <pkg> lint` always picks the right one" — verdade no fluxo por pacote (que é o que o Turbo faz).
- **Resultado medido:** `pnpm --filter @repo/web exec eslint .` → exit `0`, sem output; `@repo/shared` → exit `0`; `@repo/db` → exit `0`. **O código existente passa o lint nos três pacotes.**

### 7.2 Prettier — configurado mas **a falhar no estado atual**

- `.prettierrc.json`: `semi: true`, `singleQuote: true`, `trailingComma: "all"`, `printWidth: 100`, `tabWidth: 2`, `useTabs: false`, `arrowParens: "always"`, `endOfLine: "lf"`, `plugins: ["prettier-plugin-tailwindcss"]` e `tailwindStylesheet: "./apps/web/src/app/globals.css"` (plugin Tailwind apontado ao CSS de tema — correto para Tailwind 4 sem ficheiro de config).
- `.prettierignore`: `node_modules`, `.next`, `.turbo`, `dist`, `build`, `out`, `coverage`, `pnpm-lock.yaml`, `*.md`.
- **Resultado medido:** `pnpm exec prettier --check .` → **exit 1**, *"Code style issues found in 21 files"*:
  `apps/web/src/app/{globals.css,layout.tsx,page.tsx}`, `apps/web/src/components/mode-toggle.tsx`, os **15 componentes `components/ui/*.tsx`**, `apps/web/src/lib/utils.ts`, `packages/shared/src/schemas/env.ts`.
  Causa identificada: o CLI do shadcn escreve aspas duplas, sem ponto-e-vírgula e com indentação diferente do `.prettierrc.json`, e ninguém correu `pnpm format` depois de instalar componentes. **Consequência prática: `pnpm format:check` é um gate que falha hoje e `pnpm format` reescreve 21 ficheiros de uma vez** (ruído enorme no primeiro commit real).
- Convenção de strings observada: **aspas simples + ponto-e-vírgula** no código escrito à mão (raiz, `packages/shared`, `apps/web/src/app`, `apps/web/src/lib`, `mode-toggle`, `theme-provider`) e **aspas duplas + sem ponto-e-vírgula** nos ficheiros gerados pelo shadcn. **Não existe regra ESLint a impor aspas** — a única autoridade é o Prettier, que está desalinhado com o output do gerador. Não existe também `lint-staged`, `husky` ou `simple-git-hooks` no projeto (só aparecem dentro do `package.json` do próprio `tw-animate-css`).

### 7.3 TypeScript

- `tsconfig.json` (raiz, 25 linhas) — base partilhada com modo estrito e higiene agressiva: `strict`, **`noUncheckedIndexedAccess`**, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters`, `allowUnreachableCode: false`, `forceConsistentCasingInFileNames`, `esModuleInterop`, `resolveJsonModule`, `isolatedModules`, `skipLibCheck`, `incremental: true`, `target: ES2022`, `lib: ["ES2023"]`, `module: ESNext`, `moduleResolution: Bundler`, `moduleDetection: force`, `jsx: preserve`. `exclude`: `node_modules`, `dist`, `.next`, `.turbo`.
- `apps/web/tsconfig.json`: estende a base; `lib: ["DOM","DOM.Iterable","ES2023"]`, `allowJs`, `baseUrl: "."`, **`paths: { "@/*": ["./src/*"] }`**, `plugins: [{ name: "next" }]`, `types: ["node"]`, `include` com `next-env.d.ts` e `.next/types/**/*.ts` (ambos ainda inexistentes — serão gerados pelo Next).
- `packages/db/tsconfig.json`: `types: ["node"]`, `include: ["src/**/*.ts", "prisma.config.ts"]` — **inclui `src/generated/**` no typecheck**.
- `packages/shared/tsconfig.json`: `rootDir: "src"`, `types: []`, `include: ["src/**/*.ts"]`.
- **Não existem `paths` para `@repo/*`** em nenhum tsconfig: a resolução de `@repo/db` e `@repo/shared` é feita pelos symlinks do pnpm em `node_modules` + `transpilePackages` no `next.config.ts:26`. O `exports` de `@repo/db`/`@repo/shared` aponta **diretamente para ficheiros `.ts`** (`"./src/index.ts"`), o que só funciona porque o Next compila código-fonte de workspace.
- `packages/db/package.json` e `packages/shared/package.json` têm `"type": "module"`.

### 7.4 Turborepo

`turbo.json` (40 linhas): `ui: "stream"`, `globalDependencies: ["tsconfig.json", ".env", ".env.example"]`, `globalEnv: ["NODE_ENV","DATABASE_URL","NEXTAUTH_SECRET","NEXTAUTH_URL"]`.

| Task | Definição |
|---|---|
| `db:generate` | `cache: false` (sem `outputs`) |
| `build` | `dependsOn: ["^build", "^db:generate"]`, `inputs: [$TURBO_DEFAULT$, "!**/*.md"]`, `outputs: [".next/**","!.next/cache/**","!.next/dev/**","dist/**"]` |
| `dev` | `cache: false`, `persistent: true`, `dependsOn: ["^db:generate"]` |
| `lint` | `dependsOn: ["^lint","^db:generate"]`, `outputs: []` |
| `typecheck` | `dependsOn: ["^typecheck","^db:generate"]`, `outputs: []` |
| `format` / `format:check` / `clean` | conforme §2.3 (`format` sem cache; `format:check` com `outputs: []`) |

Não há tasks `test` nem `e2e`. `db:push`/`db:migrate`/`db:studio` **não** são tasks do Turbo — correm por `pnpm --filter @repo/db`.

### 7.5 Política de dependências (pnpm)

`pnpm-workspace.yaml` (22 linhas): `packages: ['apps/*','packages/*']`; `onlyBuiltDependencies: [prisma, '@prisma/engines', esbuild, unrs-resolver]` com comentário a explicar que o pnpm 10 bloqueia scripts de ciclo de vida por omissão e que só estes quatro precisam de correr (`prisma`/`@prisma/engines` → binários dos engines; `esbuild` → binário de plataforma; `unrs-resolver` → transitivo de `eslint-config-next`); **`strictPeerDependencies: false`** — mas o comentário imediatamente acima diz *"Fail loudly instead of silently accepting a peer range mismatch"*, ou seja **o comentário contradiz o valor** (com `false` o pnpm não falha); `virtualStoreDirMaxLength: 60` para respeitar o limite de 260 caracteres de caminho do Windows.

### 7.6 Convenções de língua e moeda (registado como está, não como desejado)

- **UI e comentários em pt-BR**: `layout.tsx:23` `lang="pt-BR"`, `mode-toggle.tsx` "Claro/Escuro/Sistema", mensagens de erro Zod em português do Brasil ("Informe um e-mail válido.", "O valor deve ser um número inteiro de centavos."), `DEFAULT_LOCALE = 'pt-BR'`, `formatMonth` → "outubro de 2026".
- **Moeda por omissão BRL** (`DEFAULT_CURRENCY`), com `EUR` já admitido no enum e a mapear para locale **`de-DE`**.
- Não há qualquer `i18n`/dicionário: as strings estão inline nos componentes.

---

## 8. Riscos técnicos concretos e dívida técnica

| # | Risco / dívida | Gravidade | Evidência e impacto |
|---|---|---|---|
| R1 | **`pnpm format:check` falha hoje em 21 ficheiros** | Alta | Medido: exit 1. Os 15 componentes shadcn + 3 ficheiros da app + `env.ts` + `globals.css` não respeitam `.prettierrc.json`. Qualquer pipeline de CI que adicione `format:check` fica vermelho antes de existir produto. |
| R2 | **Sem migrações Prisma e sem histórico** | Alta | `packages/db/prisma/` só tem `schema.prisma`; `migrations.path` aponta para pasta inexistente. Toda a evolução de schema será `db:push` (sem versionamento, sem rollback, sem reprodutibilidade entre máquinas). Decidir `push` vs `migrate dev` **antes** de escrever o primeiro modelo. |
| R3 | **Zero testes e zero CI** | Alta | Nenhum script `test`, nenhuma dependência de teste no lockfile, nenhuma pasta `tests/`/`e2e/`, sem `.github/`. Não há forma automatizada de detetar regressões, incluindo nas regras de dinheiro em cêntimos. |
| R4 | **Projeto sem Git próprio** | Alta | `git rev-parse --show-toplevel` → `C:/Users/VENOM`; `git log` → "does not have any commits yet". Não há `.git`, `.gitignore` só funciona depois de `git init`. Sem linha de base não há revisão de diff nem reversão. |
| R5 | **Auth exigida no ambiente mas inexistente** | Alta | `packages/shared/src/schemas/env.ts:21-26` obriga `NEXTAUTH_SECRET` (≥32) e `NEXTAUTH_URL`; `apps/web/src/lib/env.ts:11-22` lança no load se faltarem. Não há `next-auth`/Auth.js, nem rota, nem middleware, nem modelo `User`. Ou se implementa auth, ou se reduz o contrato — hoje é um bloqueio de arranque acoplado a uma decisão por tomar. |
| R6 | **`pnpm dev`/`lint`/`typecheck`/`build` disparam `prisma generate`** | Média | `turbo.json:11,18,21,26` usam `^db:generate`. Escreve em `packages/db/src/generated` a cada arranque e, se `DATABASE_URL` faltar, `prisma.config.ts` falha antes de qualquer tarefa correr. Cuidado ao paralelizar builds. |
| R7 | **`next-env.d.ts` e `.next/` ausentes** | Média | Prova que `next dev`/`next build` nunca correram. **Não há qualquer confirmação de que a app compila**, nem de que `@import "shadcn/tailwind.css"` resolve, nem de que a cadeia `next/font` + Tailwind 4 + Radix + React 19 constrói. Primeiro passo de execução obrigatório: `pnpm build`. |
| R8 | **Tokens de gráficos em grayscale e sem semântica de finanças** | Média | `globals.css:69-73` e `104-108`: `--chart-1..5` são todos `oklch(x 0 0)`. Não existem tokens para receita/despesa/positivo/negativo/alerta/meta. Qualquer gráfico ou badge de sinal financeiro nasce ilegível/inacessível até o tema ser revisto. |
| R9 | **`EUR → de-DE` e default `BRL`** | Média | `packages/shared/src/utils/currency.ts:4,12`. Se o produto for PT-PT/EUR, faltam: default `EUR`, locale `pt-PT`, formatação de grande números e de negativos, e uma decisão explícita sobre sufixo/prefixo. `lang="pt-BR"` em `layout.tsx:23` reforça a incoerência. |
| R10 | **`lucide-react@1.53.0` e `radix-ui@1.7.0` (pacotes unificados, majors recentes)** | Média | Declarados como `^1.53.0` e `^1.7.0`. `lucide-react` saltou de `0.x` para `1.x` e `radix-ui` é o agregador novo (substitui os `@radix-ui/react-*` individuais); ambos funcionam instalados, mas qualquer `upgrade` de `^` pode trazer alterações de API e nenhum teste o deteta. Fixar versões exatas é a mitigação barata. |
| R11 | **`next-themes` + `dark:` dependente de `.dark *`** | Baixa/Média | `globals.css:5` `@custom-variant dark (&:is(.dark *))` exige ancestral `.dark`; funciona com `attribute="class"` no `<html>`, mas `dark:` aplicado ao próprio `<html>` não tem efeito. Além disso `disableTransitionOnChange` e `suppressHydrationWarning` mascaram problemas de FOUC/hidratação em vez de os resolver. |
| R12 | **`--font-sans: var(--font-sans)` autorreferente** | Baixa | `globals.css:8-9`. Só funciona por causa do comportamento de `@theme inline`; qualquer refactor do tema pode partir tipografia de forma silenciosa. Renomear a variável do `next/font` elimina a ambiguidade. |
| R13 | **Duplicação de `cn` em dois caminhos** | Baixa | `apps/web/src/lib/utils.ts:1` e `packages/shared/src/utils/cn.ts:11`. Dois imports válidos para a mesma função; risco de divergência futura e de confusão nos imports dos componentes shadcn. |
| R14 | **Envelopes de API definidos e não usados** | Baixa | `packages/shared/src/schemas/api.ts` define `apiResponseSchema`/`apiErrorResponseSchema`/`apiErrorCodeSchema`, mas `apps/web/src/app/api/health/route.ts:45` devolve o payload cru, sem envelope e sem `code`. Padronizar antes de escrever mais rotas. |
| R15 | **`cuidSchema` demasiado restritivo** | Baixa | `packages/shared/src/schemas/primitives.ts:15`: `startsWith('c').min(25).max(30)`. Um `cuid2` canónico tem ~24 caracteres e seria rejeitado; um UUID passaria a validar a menos que se use `uuidSchema`. Definir uma única estratégia de ids (recomendado: `uuid`/`cuid` do Prisma + schema alinhado). |
| R16 | **Mensagem de erro errada em `amountInCentsSchema`** | Baixa | `packages/shared/src/schemas/money.ts:15`: o `.min(-999_999_999_99, 'Valor acima do limite suportado.')` devolve "acima" para valores demasiado baixos. Confunde quem depurar importações. |
| R17 | **`strictPeerDependencies: false` contradiz o comentário** | Baixa | `pnpm-workspace.yaml:18-19`. O comentário promete falhar ruidosamente; a configuração faz o oposto. Além disso não existe `.npmrc`, pelo que toda a política vive em `pnpm-workspace.yaml` (fácil de ignorar). |
| R18 | **`packages/db` faz typecheck de código gerado** | Baixa | `packages/db/tsconfig.json:7` inclui `src/**/*.ts`, e `db:clean` apaga `src/generated` (`package.json:19`). Depois de `clean`, `tsc --noEmit` isolado falha até correr `db:generate` — motivo pelo qual `typecheck` encadeia `prisma generate`. |
| R19 | **Sem PWA/manifest, sem acessibilidade auditada** | Média | Não há `manifest.ts`, `app/icon`, `sw.ts`, `next-pwa`/Serwist, nem `viewport`/`theme-color`. `next.config.ts` tem apenas `reactStrictMode` e `transpilePackages`. Nada de mobile-first está preparado além dos `sm:`/`lg:` pontuais em `page.tsx`. |
| R20 | **Dependências transitivas perigosas de confundir com disponíveis** | Baixa | `@visx@4.0.1-alpha.0` e `@playwright/test` aparecem no `pnpm-lock.yaml` — o primeiro como transitivo do CLI `shadcn`, o segundo como **peer opcional do Next** (`pnpm-lock.yaml:3411`). Nenhum está instalado para uso da app; usá-los exigirá dependência direta. `zod@3.25.76` também coexiste com `zod@4.6.5`. |

---

## 9. Comandos exatos (instalar, desenvolver, verificar, base de dados)

Todos a partir da raiz `C:\Users\VENOM\Downloads\aplicação Finanças pessoais`.

### 9.1 Instalação

```bash
node --version            # exige >= 20.18.1 (auditado: v24.21.0)
pnpm --version            # exige 10.17.1 (auditado: 10.17.1)
pnpm install              # NÃO executado nesta auditoria
```

### 9.2 Base de dados

```bash
docker compose up -d                  # PostgreSQL 18 em localhost:5432 (financas/postgres)
docker compose ps                     # confirmar healthy (pg_isready, 10 retries)

# esquema — hoje só existe a via push (não há migrações)
pnpm db:validate                      # prisma validate
pnpm db:generate                      # prisma generate -> packages/db/src/generated/prisma
pnpm db:push                          # prisma db push  (cria tabelas; ZERO modelos hoje)
pnpm db:format                        # prisma format
pnpm db:studio                        # prisma studio (UI de BD)

# quando se decidir versionar o esquema, iniciar o histórico:
pnpm db:migrate                       # prisma migrate dev (aplica + cria migração)
```

### 9.3 Desenvolvimento

```bash
pnpm dev                              # turbo run dev  -> next dev --port 3000 (dispara ^db:generate)
pnpm --filter @repo/web dev           # apenas a app web
pnpm --filter @repo/db db:generate    # regenerar o client Prisma isoladamente
```

Verificação manual do único endpoint: `GET http://localhost:3000/api/health` → `200` com `status: "ok"` se a BD responder, `503` com `status: "degraded"` caso contrário.

### 9.4 Verificação (lint / typecheck / build / formatação)

```bash
pnpm lint                             # turbo run lint  -> eslint . em cada pacote (auditado: exit 0)
pnpm typecheck                        # turbo run typecheck -> @repo/db corre prisma generate && tsc --noEmit
pnpm build                            # turbo run build  -> next build (NUNCA executado; ver R7)
pnpm start                            # next start --port 3000

pnpm format                           # prettier --write .
pnpm format:check                     # prettier --check .  (auditado: exit 1, 21 ficheiros)

# isolado, sem passar pelo Turbo
pnpm --filter @repo/web typecheck
pnpm --filter @repo/web lint
pnpm --filter @repo/db typecheck      # inclui prisma generate
pnpm --filter @repo/shared typecheck
```

### 9.5 Limpeza

```bash
pnpm clean                            # turbo run clean && rimraf node_modules .turbo
pnpm --filter @repo/web clean         # rimraf .turbo .next node_modules
pnpm --filter @repo/db clean          # rimraf .turbo node_modules src/generated
```

---

## 10. O que falta — rigor por módulo

Classificação: **FEITO** (funcional e verificável), **PARCIAL** (há fundação real mas falta o essencial), **NÃO INICIADO** (nenhuma linha de produto).

| Módulo | Estado | Justificação no código |
|---|---|---|
| **auth** | **NÃO INICIADO** | Sem dependência de auth no `package.json`/lockfile, sem `middleware.ts`, sem rota, sem modelo `User` (`schema.prisma` = 0 modelos), sem UI de login/registo. Existe só o *contrato* `NEXTAUTH_SECRET`/`NEXTAUTH_URL` em `packages/shared/src/schemas/env.ts:21-26` e a sua imposição em `apps/web/src/lib/env.ts`. Detalhe relevante: `apiErrorCodeSchema` já prevê `UNAUTHORIZED`/`FORBIDDEN` (`api.ts:10-11`), mas nada os produz. |
| **contas/carteiras** | **NÃO INICIADO** | Zero modelos e zero enums em `packages/db/prisma/schema.prisma`; nenhuma rota além de `api/health`; nenhum ecrã além da página de scaffold `apps/web/src/app/page.tsx`. Não há noção de saldo, tipo de conta (corrente/poupança/carteira/cartão) nem transferência entre contas. |
| **transações** | **NÃO INICIADO** | Sem modelo, sem rota CRUD, sem tabela/lista, sem filtros de período. **PARCIAL** apenas ao nível de *utilidades*: `amountInCentsSchema` / `moneySchema` / `positiveMoneySchema` + `negativeMoneySchema` (`money.ts`), `formatCurrency`/`parseCurrencyToCents`/`sumCents` (`currency.ts`) e `startOfMonth`/`endOfMonth`/`formatDate` (`date.ts`) estão prontos e testáveis só por inspeção — **sem um único teste**. |
| **categorias** | **NÃO INICIADO** | Sem entidade `Category`, sem hierarquia pai/filho (subcategorias), sem enum de tipo, sem seed e sem UI de gestão. Também não há regras de auto-categorização nem mapeamento importação→categoria. |
| **orçamento** | **NÃO INICIADO** | Sem entidade de orçamento mensal por categoria, sem agregação previsto vs. realizado, sem percentagens, sem alertas. Sem tokens de tema para estados de orçamento (`globals.css` não tem `--success`/`--warning`/`--destructive` no contexto de metas). |
| **objetivos** | **NÃO INICIADO** | Sem entidade `Goal`, sem contribuições, sem cálculo de progresso, sem UI. Não há sequer a biblioteca de gráficos que o progresso exigiria (nenhuma lib de charts nos `package.json`). |
| **dívidas** | **NÃO INICIADO** | Sem entidade de dívida/financiamento, sem taxa de juro, sem plano de prestações, sem cálculo de amortização, sem UI. Zero referências no código. |
| **recorrentes** | **NÃO INICIADO** | Sem entidade de recorrência, sem regra de frequência (mensal/semanal/anual), sem motor de geração de lançamentos futuros, sem estado "pago/pendente". Não existe nenhuma dependência de agendamento (cron/queue) nem `route.ts` de job. |
| **relatórios** | **NÃO INICIADO** | Nenhuma biblioteca de gráficos ou de tabelas instalada (sem TanStack Table, sem Recharts/visx/ECharts/Nivo/Chart.js; `@visx/*` no lockfile é transitivo do CLI `shadcn` e não está ligado à app). Os 5 tokens `--chart-1..5` de `globals.css` são todos grayscale e nenhum componente os consome. Sem endpoints de agregação. |
| **importação OFX/CSV** | **NÃO INICIADO** | Sem parser (`papaparse`/`csv-parse`/`ofx-js` ausentes), sem rota de upload, sem `zod` schema específico de linha importada, sem ecrã de pré-visualização/conciliação, sem deduplicação. A única base reutilizável é `parseCurrencyToCents` (`currency.ts:52-70`), que já lida com `"1.234,56"`. |
| **PWA / mobile** | **NÃO INICIADO** | Sem `app/manifest.ts`, sem `public/`, sem service worker, sem `next-pwa`/Serwist, sem `viewport`/`theme-color`, sem ícones. `next.config.ts` tem apenas `reactStrictMode` e `transpilePackages`. O layout usa `min-h-svh` e a página tem `sm:grid-cols-2 lg:grid-cols-3`, mas não há navegação inferior, gestos, offline nem área segura. |
| **testes** | **NÃO INICIADO** | Nenhum ficheiro `*.test.*`/`*.spec.*`, nenhum runner (`vitest`/`jest`/`playwright`/`cypress` ausentes do `package.json` e do lockfile), nenhuma pasta `tests/`/`e2e/`, nenhum script `test`, nenhuma config de cobertura (apesar de `.gitignore:43` já ignorar `coverage/`). A lógica financeira em cêntimos e as regras Zod estão completamente sem rede de segurança. |
| **tema/dark mode (fundação)** | **PARCIAL** | `next-themes` ligado (`theme-provider.tsx`, `mode-toggle.tsx`), tokens claro/escuro completos e escala de raios em `globals.css`, `@custom-variant dark` declarado. Falta: tokens semânticos financeiros, paleta de charts com cor e acessibilidade, `color-scheme`, e validação por build (R7/R8). |
| **camada de dados (fundação)** | **PARCIAL** | `packages/db` compila e gera client (`prisma-client` + `PrismaPg` adapter + singleton), `prisma.config.ts` resolve o `.env` da raiz e o `migrations.path`. Falta **tudo o resto**: 0 modelos, 0 enums, 0 índices, 0 relações, 0 migrações. |
| **contratos partilhados (fundação)** | **PARCIAL** | `@repo/shared` tem 413 linhas de schemas/utils/tipos coerentes (dinheiro em cêntimos, paginação, envelopes de API, formatação pt-BR), todos passam `eslint` e `tsc` (tsbuildinfo presente). Falta: schemas de domínio (conta, transação, categoria, orçamento, objetivo, dívida, recorrência), `EUR`/`pt-PT` como default, e qualquer teste. |
| **UI base (fundação)** | **PARCIAL** | 15 componentes shadcn `radix-nova` (1 229 linhas) + `cn` + `lucide-react` + `cva`, com `components.json` e plugin Prettier do Tailwind configurados. 9 dos 15 nunca são usados; faltam `form`, `table`, `toast/sonner`, `sheet`, `popover`, `calendar`, `progress`, `alert`, `chart`; **todos os 15 falham `prettier --check`** (R1). |
| **conformidade/verificação (fundação)** | **PARCIAL** | `eslint` passa nos 3 pacotes (medido, exit 0), `tsc` já correu (tsbuildinfo nos 3 pacotes), `docker-compose.yml` com healthcheck está pronto. Falha: `pnpm format:check` (21 ficheiros), `next build` nunca executado, sem CI, sem testes, sem migrações. |

### 10.1 Ordem de desbloqueio sugerida (derivada dos riscos, não da funcionalidade)

1. `git init` + primeiro commit do scaffold (R4) — sem isto não há reversão nem revisão.
2. Confirmar que a app constrói: `pnpm build` (R7) + `pnpm format` (R1) antes do commit.
3. Decidir `prisma migrate dev` vs `db:push` e criar a migração inicial (R2).
4. Resolver o contrato de ambiente: implementar auth **ou** tornar `NEXTAUTH_*` opcionais (R5).
5. Fixar versões exatas de `lucide-react`/`radix-ui`/`prisma` (R10) e introduzir o runner de testes com cobertura mínima sobre `packages/shared/src/utils` (R3).
6. Só então modelar o domínio: `User → Account → Category → Transaction` (+ `Budget`, `Goal`, `Debt`, `Recurrence`) e os respetivos schemas Zod em `@repo/shared`, mantendo a regra dos cêntimos inteiros.

---

### Nota final de fidelidade

Todas as contagens, versões e resultados de verificação deste documento foram lidos dos ficheiros indicados ou medidos com comandos não mutantes (`git status`/`git log`, `node --version`, `pnpm --version`, `Get-ChildItem`, `Test-Path`, leitura de `node_modules/*/package.json`, `pnpm --filter ... exec eslint .`, `pnpm exec prettier --check .`). Nenhum ficheiro do projeto foi criado, alterado ou removido além deste documento. Não foram executados `pnpm install`, `prisma generate/migrate/push`, `pnpm build`, `pnpm typecheck` nem `next dev`. Os pontos marcados **[a confirmar]** exigem execução de build e estão sinalizados em R7.
