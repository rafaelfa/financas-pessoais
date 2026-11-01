# financas-pessoais

## O que é

Aplicação web de finanças pessoais, em pt-PT, de utilizador único: contas,
lançamentos, categorias, orçamento, objetivos, cartões e faturas, recorrências,
relatórios, importação OFX/CSV e PWA. Sem integração bancária. Produção:
`https://financas-pessoais-psi-lac.vercel.app`.

## Stack

- linguagem e versão: TypeScript 5.9.3 (estrito), Node ≥ 20.18.1
- framework: Next.js 16.4.0 (App Router) + React 19.3.0, Tailwind 4.3.3, shadcn/ui
- base de dados: PostgreSQL (Neon) via Prisma 7.10.0 — 25 modelos, 2 migrações
- sistema de pacotes: pnpm 10.17.1 (workspaces `apps/*` e `packages/*`) + Turborepo
- testes: Vitest (`packages/shared`), Playwright + axe (`e2e/`)

## Comandos

- instalar dependências: `pnpm install` (o CI usa `--frozen-lockfile`; se o
  `pnpm-lock.yaml` estiver desatualizado, o install falha de propósito)
- correr: `pnpm dev` → `http://localhost:3000` (exige `.env`)
- testar: `pnpm test` (unitários) · `pnpm test:e2e` (exige `.env` com base real)
- verificar tipos / formato: `pnpm typecheck` · `pnpm lint` · `pnpm format:check`
- gerar cliente Prisma: `pnpm db:generate` (exige `DIRECT_URL` no `.env`)
- o gate que mais apanha: `pnpm build`

Ordem do gate: `format:check` → `lint` → `typecheck` → `test` → `build`.

## Estrutura

- `apps/web/src/app` — 14 ecrãs autenticados + `(auth)` + `api/`
- `apps/web/src/server` — camada fina: consulta, validação, transação
- `apps/web/src/components` — componentes, `ui/` é shadcn
- `packages/shared/src` — motor financeiro puro, schema Zod, importação OFX/CSV
- `packages/db` — `prisma/schema.prisma`, migrações e `seed.ts`
- `e2e/` — Playwright
- `docs/plano`, `docs/spec`, `docs/analise` — plano, contratos e relatórios de verificação
- `docs/gestao` — `MAPA.md`, `TASKS.md`, `DECISOES.md` (Lead)
- `relatorios/` — provas do QA

## Regras deste repo

Estas vêm do projeto e não são negociáveis.

- **Dinheiro é sempre cêntimos inteiros** (`Int`). Nunca `Float`/`Decimal`/`number`
  com casas decimais. Datas de calendário em `@db.Date` e como `YYYY-MM-DD`;
  instantes em `timestamptz` UTC.
- **Lógica pura vive em `packages/shared`** e é lá que é testada. `apps/web/src/server`
  fica fina.
- **Cada correção com um teste que fique vermelho antes.** Modelo:
  `packages/shared/src/finance/__tests__/gate-g6.test.ts`.
- **Não se alteram testes existentes para os fazer passar.** Se um teste contradiz
  uma correção, diz-se qual e porquê.
- Toda a consulta e escrita filtra por `userId` da sessão; todo o id vindo do
  cliente é confirmado como sendo do utilizador antes de ser usado.
- Máximo 3 dependências novas por tarefa, cada uma justificada numa linha.
- Versões exatas, nunca `@latest`.
- Não tocar em: `.env`, `.env*.local`, `node_modules/`, `.next/`,
  `packages/db/src/generated/`, `pnpm-lock.yaml` (só com justificação no commit).
- Não tocar em `packages/verificacao-*` — são arneses históricos, não código de produção.
- Correção mínima: nada de refactor que não foi pedido.
- Comentário só quando o código não se explica sozinho.
- Segredos nunca no repositório.
- Vocabulário fixado no glossário de `docs/spec/F1-regras-financeiras.md` (pt-PT:
  "parcela", "fatura" com fecho e vencimento, "travar saldo"); microcopy em "tu".

## Armadilhas desta máquina (Windows)

- `core.autocrlf=true` global entrega CRLF e faz o `format:check` falhar em ~330
  ficheiros que estão corretos no git. Corrigir com `git config core.autocrlf false`
  e reescrever a árvore, ou ler `docs/gestao/MAPA.md` §3.
- `.next` sujo provoca `EPERM: unlink` no Turbopack. Apagar `apps/web/.next`.
- `pnpm install` sem escalada pode falhar com `ERR_PNPM_EPERM`.

## Quem escreve o quê

- Lead de Projeto: `docs/gestao/MAPA.md`, `docs/gestao/TASKS.md`, `docs/gestao/DECISOES.md`
- Dev: código em `apps/`, `packages/` e configuração do projeto
- QA: `e2e/`, `relatorios/` e os relatórios `docs/spec/T*`
- Revisor: nada (só lê)

Dois membros nunca escrevem no mesmo ficheiro ao mesmo tempo: cada tarefa declara os
ficheiros que pode escrever.

## Estado

- modo: existente
- último fecho: 2026-11-01 — `MAPA.md` escrito; **gate vermelho em `main`**
  (`--frozen-lockfile`, `format:check`, `lint`, `typecheck` e `build` falham; `test`
  verde com 522 testes). Detalhe e provas em `docs/gestao/MAPA.md`.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
