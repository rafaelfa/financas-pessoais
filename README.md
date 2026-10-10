# Finanças Pessoais

Aplicação web de finanças pessoais — uma nova versão, com interface atualizada, das funcionalidades do [Minhas Economias](https://wwws.minhaseconomias.com.br/).

> **Estado: em planeamento.** Ainda não existe código de produto neste repositório. O que está publicado é o plano de execução; a implementação começa na Fase 0.

## O que é

Uma aplicação para controlar as finanças pessoais do dia a dia, sem depender de integração bancária: contas e carteiras, lançamentos, categorias, orçamento mensal, objetivos, cartões e faturas, recorrências, relatórios e património líquido. Tudo introduzido manualmente ou importado de ficheiros OFX/CSV.

A funcionalidade inspira-se no Minhas Economias, mas corrige limitações conhecidas do original:

- **Importação e exportação de dados** — o sistema original não exporta nem importa ficheiros.
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
| Alojamento | Vercel |

Dinheiro é sempre guardado como **cêntimos inteiros** — nunca em vírgula flutuante.

## Estrutura do repositório

```
apps/
  web/                 Aplicação Next.js
packages/
  db/                  Esquema Prisma, migrações e seed
  shared/              Schemas Zod, tipos, motor financeiro e utilitários
docs/
  analise/             Análise funcional do sistema de referência
  plano/               Plano de execução por fases
```

## Documentação

- [Análise funcional do sistema de referência](docs/analise/01-funcionalidades-minhas-economias.md) — módulos, fluxos, regras financeiras e modelo de dados inferido.
- [Estado atual do projeto](docs/analise/02-estado-atual-do-projeto.md) — o que já existe no monorepo e o que falta.
- [Direção visual e design system](docs/analise/03-direcao-visual-e-design-system.md) — paleta, tipografia, bibliotecas e wireframes.
- [Plano de execução](docs/plano/PLANO-EXECUCAO.md) — as fases, com critérios de aceitação e riscos.

## Desenvolvimento

O projeto ainda não está pronto a correr. Depois da Fase 0, o arranque será:

```bash
pnpm install          # instalar dependências
cp .env.example .env  # configurar o ambiente (Neon, better-auth)
pnpm db:migrate       # aplicar migrações
pnpm dev              # arrancar em http://localhost:3000
```

Verificações:

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm format:check
pnpm test
```

## Licença

Projeto pessoal. Todos os direitos reservados.
