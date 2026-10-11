# Finanças Pessoais

Aplicação web de finanças pessoais — uma nova versão, com interface atualizada, das funcionalidades do [Minhas Economias](https://wwws.minhaseconomias.com.br/).

> **Estado: funcional e publicado.** Fases 0 a 7 concluídas
> (autenticação, motor financeiro, contas, lançamentos, categorias, orçamento,
> objetivos, cartões e faturas, recorrências, regras, relatórios, fecho de mês,
> importação/exportação de extratos e PWA). A Fase 8 — endurecimento, testes
> ponta a ponta, integração contínua e entrega — está em curso.
> Produção: <https://financas-pessoais-psi-lac.vercel.app>

## O que é

Uma aplicação para controlar as finanças pessoais do dia a dia, sem depender de integração bancária: contas e carteiras, lançamentos, categorias, orçamento mensal, objetivos, cartões e faturas, recorrências, relatórios e património líquido. Tudo introduzido manualmente ou importado de ficheiros OFX/CSV.

A funcionalidade inspira-se no Minhas Economias, mas corrige limitações conhecidas do original:

- **Importação e exportação de dados** — o sistema original não exporta nem importa ficheiros. Aceita OFX (SGML) e CSV, mostra sempre uma pré-visualização antes de gravar, e permite **desfazer** uma importação.
- **Motor financeiro explícito** — visão de **caixa** e de **competência**, com início do mês configurável; o original só tem caixa, com o mês fixo no dia 1.
- **Operações internas de primeira classe** — pagamento de fatura, transferência, aporte em objetivo e ajuste de saldo nunca contaminam entradas ou saídas; no original o pagamento da fatura entra como "ganho" e a solução oficial é marcar a transação como ignorada.
- **Parcelamentos e séries editáveis** — no original um parcelamento manual não pode ser editado.
- **Assistente de fecho de mês** — checklist acionável e análise multi-período.

## Âmbito

**Dentro:** contas manuais, transações (gasto, ganho, transferência), categorias e subcategorias, orçamentos com alertas, objetivos, cartões e faturas, recorrências, regras de categorização automática, bens e património líquido, relatórios, importação OFX/CSV, exportação CSV/XLSX/PDF, PWA instalável.

**Fora:** integração bancária e Open Finance, multiusuário e partilha familiar, aplicações nativas iOS/Android, login social, assinaturas.

## Stack

| Camada | Tecnologia |
|---|---|
| Monorepo | pnpm workspaces + Turborepo |
| Aplicação | Next.js 16 (App Router) · React 19 · TypeScript 5.9 (estrito) |
| Interface | Tailwind CSS 4 · shadcn/ui · Radix · Recharts · TanStack Table |
| Dados | PostgreSQL (Neon) · Prisma 7 |
| Validação | Zod |
| Autenticação | better-auth (utilizador único, e-mail e palavra-passe) |
| Testes | Vitest (unitários) · Playwright + axe (ponta a ponta e acessibilidade) |
| Integração contínua | GitHub Actions |
| Alojamento | Vercel |

Dinheiro é sempre guardado como **cêntimos inteiros** — nunca em vírgula flutuante. Datas de calendário são `DATE` (`YYYY-MM-DD`), sem fuso; instantes são `timestamptz` em UTC.

## Estrutura do repositório

```
apps/
  web/                 Aplicação Next.js
packages/
  db/                  Esquema Prisma, migrações e seed
  shared/              Schemas Zod, tipos, motor financeiro e utilitários
  verificacao-*/       Arneses de verificação adversarial (não são código de produção)
e2e/                   Testes ponta a ponta (Playwright)
docs/
  analise/             Análise funcional do sistema de referência
  plano/               Plano de execução por fases e runbook de deploy
  spec/                Contratos de cálculo e relatórios de verificação
```

## Arranque

```bash
pnpm install                                    # instalar dependências
cp .env.example .env                            # e preencher (Neon + better-auth)
pnpm db:generate                                # gerar o cliente Prisma
pnpm --filter @repo/db exec prisma migrate deploy   # aplicar migrações
pnpm --filter @repo/db db:seed                  # dados de demonstração (opcional)
pnpm dev                                        # http://localhost:3000
```

Sem uma base Neon à mão, o `docker-compose.yml` serve uma alternativa local:
`docker compose up -d`, e a `DATABASE_URL` do `.env` passa a apontar para
`localhost:5432` (a linha está comentada no `.env.example`). A via primária é o
Neon — o Docker é alternativa, não requisito.

## Verificações

```bash
pnpm format:check    # formatação (pnpm format escreve-a)
pnpm lint
pnpm typecheck
pnpm test            # testes unitários, ~520
pnpm build           # o gate que mais apanha; exige .next limpo
pnpm test:e2e        # ponta a ponta (Playwright) — exige .env e base acessível
```

O fumo autenticado contra um ambiente a correr — cria um utilizador de teste,
pede as 12 páginas autenticadas e apaga-o no fim:

```bash
node packages/db/smoke.mjs https://financas-pessoais-psi-lac.vercel.app
```

O mesmo gate corre em cada `push` e em cada *pull request* pelo GitHub Actions
(`.github/workflows/ci.yml`). O fumo é um workflow separado, à mão, porque escreve
numa base real.

### Duas armadilhas do ambiente de desenvolvimento (Windows)

1. **`spawn EPERM`** em `next build` e em `vitest`: a sandbox bloqueia processos
   filhos com *stdio* em pipe. Fora do CI, estes dois comandos precisam de correr
   com permissões não confinadas.
2. **`.next` sujo** provoca `EPERM: unlink` numa junção do Turbopack. Apagar
   `apps/web/.next` resolve — é saída gerada.

## Documentação

- [Plano de execução](docs/plano/PLANO-EXECUCAO.md) — as fases, com critérios de aceitação e riscos.
- [Estado do projeto e handoff](docs/plano/ESTADO-E-HANDOFF.md) — onde o projeto está e o que falta.
- [Deploy em produção](docs/plano/DEPLOY.md) — Vercel, Neon, variáveis e migrações.
- [Contrato de cálculo](docs/spec/F1-regras-financeiras.md) — as regras financeiras, com glossário.
- [Análise funcional do sistema de referência](docs/analise/01-funcionalidades-minhas-economias.md) — módulos, fluxos e regras.
- [Direção visual e design system](docs/analise/03-direcao-visual-e-design-system.md) — paleta, tipografia e wireframes.
- **Relatórios de verificação adversarial** (`docs/spec/T*.md`): camada de dados
  (T3.3), Fases 5 e 6 (T5.6), importação e exportação (T7.5). Cada um tem os
  achados com `ficheiro:linha`, o cenário e o valor medido.

## Licença

Projeto pessoal. Todos os direitos reservados.
