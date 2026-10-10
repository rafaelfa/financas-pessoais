# Plano de execução — “Finanças Pessoais” (nova versão de Minhas Economias)

- **Data:** 2026-10-10
- **Autor:** Lead (síntese dos documentos de análise produzidos pela equipa)
- **Estado:** **aguarda aprovação do cliente** — nenhuma linha de código de produto será escrita antes disso.
- **Workspace:** `C:\Users\VENOM\Downloads\aplicação Finanças pessoais`

Documentos que sustentam este plano (ler antes de aprovar):

| Documento | Conteúdo | Linhas |
|---|---|---|
| [01 — Funcionalidades do sistema de referência](../analise/01-funcionalidades-minhas-economias.md) | 24 módulos, 10 fluxos, modelo de dados inferido, regras financeiras, lacunas, 5 melhorias | 1 661 |
| [02 — Estado atual do projeto](../analise/02-estado-atual-do-projeto.md) | O que já existe no monorepo, versões, riscos, dívida técnica | 573 |
| [03 — Direção visual e design system](../analise/03-direcao-visual-e-design-system.md) | Paleta medida, tipografia, bibliotecas, wireframes dos 4 ecrãs, tokens prontos | 598 |

---

## 1. Decisões já fixadas pelo cliente

| # | Decisão | Valor |
|---|---|---|
| D1 | Moeda e idioma | **EUR + português de Portugal (pt-PT)** |
| D2 | Âmbito de utilizador | **Utilizador único com login simples** (e-mail + palavra-passe). Sem famílias, membros ou workspaces partilhadas |
| D3 | Base de dados | **PostgreSQL no Neon** (serverless), acessível por Prisma 7 + `@prisma/adapter-pg`. O `docker-compose.yml` fica apenas como alternativa de desenvolvimento *offline* |
| D4 | Formato | **Web responsiva + PWA instalável** (360 px a 1440 px+), com dark mode |
| D5 | Integração bancária | **Fora de âmbito** (o cliente dispensou explicitamente) |

## 2. Não-objetivos (explicitamente fora)

Open Finance e conexão bancária · módulos automáticos de dívidas e investimentos (substituídos por passivos/ativos manuais) · multiusuário, membros e workspaces · apps nativas iOS/Android/macOS · assinatura “Meu Clube” e cobrança por lojas · login social Apple/Google · conector MCP/IA (opcional, fase posterior) · i18n multi-idioma (só pt-PT).

## 3. Princípios de execução

1. **Gate por fase.** Nenhuma fase começa sem a anterior terminar com `lint` + `typecheck` + `build` + `format:check` + testes **verdes** e uma demonstração funcional.
2. **Dinheiro em cêntimos inteiros** (`Int`), nunca `float`. Toda a aritmética passa pelo motor financeiro.
3. **Contratos antes de UI.** Primeiro tipos + schemas Zod + assinaturas de servidor; depois o front-end consome-os.
4. **Motor financeiro puro e testado primeiro.** Saldos, resultados, faturas, orçamentos e património são funções puras em `packages/shared`, cobertas por testes antes de existir ecrã.
5. **Regra dos registos que nunca contaminam totais.** Transferências, pagamento de fatura, depósito em objetivo e ajuste de saldo têm tipo de operação próprio e efeito contabilístico definido (melhoria M4 — no original o utilizador tem de marcar transações como “Ignoradas”).
6. **Git desde a Fase 0.** Um commit por tarefa concluída; sem isto não há reversão nem revisão de diff.
7. **Datas de calendário em `DATE`** (nunca timestamp deslocado por fuso) e **timestamps em `timestamptz` UTC**; formatação sempre com `Intl` em `pt-PT`/`Europe/Lisbon`.
8. **Acessibilidade WCAG 2.2 AA é critério de aceitação**, não polimento.
9. **Nada de dependências a mais.** Cada biblioteca nova é justificada no plano; sem biblioteca de UI concorrente.
10. **Versões fixadas, nunca `@latest`.** O ecossistema está em transição de *major* (`prisma` CLI 8 RC na tag `latest`, TypeScript 7 lançado, TanStack Table 9 com dias de vida). Toda a dependência instalada fica com versão exata no `package.json`.
11. **Nenhuma incógnita estrutural entra na fase em que é usada.** OFX SGML, Turbopack/PWA e migrações Prisma são provados na Fase 0, não na fase que deles depende.

## 4. Equipa e funções (Agent Teams)

| Membro | Função | Âmbito de escrita (exclusivo) |
|---|---|---|
| **Lead** | Arquitetura, contratos entre módulos, integração, revisão do diff, execução dos gates, decisões, aceitação final | `docs/plano/**`, `README.md`, `turbo.json`, `package.json` (raiz), revisão de tudo |
| **dev-dados** | Esquema Prisma, migrações, seed, motor financeiro, server actions/APIs | `packages/db/**`, `packages/shared/src/finance/**`, `packages/shared/src/schemas/domain/**`, `apps/web/src/server/**`, `apps/web/src/app/api/**` |
| **dev-ui** | Design system, shell, ecrãs, componentes à medida | `apps/web/src/components/**`, `apps/web/src/app/(app)/**/*.tsx`, `apps/web/src/app/(auth)/**`, `apps/web/src/app/globals.css`, `apps/web/public/**` |
| **qa-verificador** | Testes unitários/integração/e2e, acessibilidade, revisão adversarial das regras financeiras contra o documento 01, reprodução de bugs | `**/*.test.ts`, `**/*.spec.ts`, `e2e/**`, `vitest.config.*`, `playwright.config.*` |
| **analista-funcional** (já ativo) | Guardião do requisito: especificação por módulo, critérios de aceitação, verificação de paridade com o original | `docs/spec/**` |
| **designer-ux** (já ativo) | Tokens, tipografia, wireframes, revisão visual e de contraste | `docs/design/**` |

Regras de trabalho: âmbitos de escrita disjuntos; quando dois membros precisam do mesmo ficheiro, o Lead serializa (um escreve, o outro espera e re-baseia). Ficheiros partilhados de front-end (`globals.css`, `layout.tsx`) são do `dev-ui`; os contratos que o `dev-ui` consome vêm congelados do `dev-dados` no fim da Fase 1.

---

## 5. Fase 0 — Higiene da fundação e linha de base

**Objetivo:** partir de um estado verificável. Hoje o projeto tem dívida que envenena qualquer trabalho futuro (documento 02, §8).

| Tarefa | Detalhe | Dono |
|---|---|---|
| T0.1 | `git init` + `.gitignore` revisto + **`pnpm format`** antes do primeiro commit, para não arrastar 21 ficheiros de ruído | Lead |
| T0.2 | Commit de linha de base “chore: scaffold verificado” | Lead |
| T0.3 | Corrigir a auto-referência `--font-heading: var(--font-sans)` e aplicar os tokens do Apêndice A do documento 03 | dev-ui |
| T0.4 | Provar a fundação: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm build` (nunca correu) | Lead |
| T0.5 | Criar o projeto no **Neon** e ligar o Prisma: `DATABASE_URL` (com *pooling*, para a aplicação e para o Vercel) + `DIRECT_URL` (direta, para `migrate dev`/`migrate deploy`) + `prisma validate` + **primeira migração versionada** contra o Neon. Se o Prisma 7.10 não expuser `directUrl` no `prisma.config.ts`, usar a URL direta apenas no comando de migração. O `docker-compose.yml` fica como alternativa local *offline* | dev-dados |
| T0.6 | **Fixar versões exatas:** `prisma@7.10.0` (o `latest` do npm é `8.0.0-rc.22` e desalinharia do `@prisma/client@7.10.0`), `lucide-react`, `radix-ui` | Lead |
| T0.7 | **Autenticação:** adotar `better-auth@1.7.7` + `@better-auth/prisma-adapter` (`emailAndPassword`); substituir `NEXTAUTH_SECRET`/`NEXTAUTH_URL` por `BETTER_AUTH_SECRET`/`BETTER_AUTH_URL` no schema de ambiente e no `turbo.json`. **Não usar `next-auth@5` (beta com bugs abertos em Next 16; o Auth.js passou a ser mantido pela equipa do Better Auth)** | dev-dados + Lead |
| T0.8 | **Smoke tests das incógnitas maiores, antes de qualquer UI:** (a) `pnpm build` com Turbopack (default no Next 16) + `app/manifest.ts` mínimo; (b) importar um ficheiro **OFX SGML** real com `ofx-js` e um CSV com `csv-parse`; (c) `prisma migrate dev` real contra o Postgres em Docker | qa-verificador |
| T0.9 | Instalar o runner de testes — `vitest@5` com **`test.projects`** (`workspace` está depreciado), `jsdom`, `@vitejs/plugin-react`, `vite-tsconfig-paths`, `@testing-library/react@16` — e cobrir `packages/shared/src/utils/{currency,date}.ts` | qa-verificador |
| T0.10 | Gerar os componentes shadcn estruturantes (`chart`, `table`, `calendar`) **e fixar as versões que o CLI instala** (`chart` traz `recharts@3.8.0`; `calendar` traz `react-day-picker@10.x`) antes de se escrever UI | dev-ui |
| T0.11 | **Deploy de pré-visualização no Vercel do scaffold, ainda sem funcionalidade** — prova o build do monorepo pnpm, o `prisma generate` a montante e a ligação ao Neon nos *serverless functions*, antes de se investir em UI | Lead |

**Entregável:** repositório com histórico, build verde, base de dados a correr, primeiros testes a passar.
**Gate G0:** `pnpm build` (Turbopack) exit 0 · `pnpm format:check` exit 0 · testes verdes · migração aplicada e revertida **contra o Neon** · os smoke tests (OFX SGML, CSV, PWA/Turbopack) concluídos com veredicto escrito · **deploy de pré-visualização no Vercel a construir com sucesso** · repositório com a linha de base publicada.
**Esforço:** 0,5–1 dia.

---

## 6. Fase 1 — Domínio: esquema, migrações, seed e motor financeiro

**Objetivo:** o coração do produto. Sem isto, a UI seria decorativa.

**Modelo de dados (base: documento 01, §4), em cêntimos inteiros `Int`** — 32 bits, até 21 474 836,47 €, suficiente; **nunca `BigInt`**, que quebra `JSON.stringify` em todas as Server Actions e obrigaria a serializador próprio. Vencimentos e datas de calendário em `@db.Date` (sem hora, evita o deslize de um dia entre UTC e `Europe/Lisbon`); timestamps em `DateTime` UTC. Entidades: `User`, `Account` (+ `LockedBalance`), `CreditCard`, `Invoice`, `InvoicePayment`, `Category` (hierárquica, `system`/`user`, categorias internas), `Tag`, `Transaction` (com par de transferência, série de parcelamento, estado, `settled`), `TransactionRule`, `Recurrence`, `Budget` + `BudgetLimit`, `Goal` + `GoalMovement`, `Asset`, `Liability` (passivo manual, substitui o módulo Dívidas do original).

**Motor financeiro (funções puras, testadas exaustivamente):**

| Cálculo | Regra de origem |
|---|---|
| Saldo da conta | `saldo inicial + ganhos recebidos − gastos pagos`, visão **caixa**, excluindo contas arquivadas, transações `pending`/`ignored` e categorias internas |
| Resultado mensal | `entradas − saídas`; despesa de cartão só conta **quando a fatura é paga** |
| Regimes | **caixa e competência**, comutáveis, e **início do mês configurável** (dia do salário) — melhoria M2, no original é fixo no dia 1 e só existe caixa |
| Fatura | fecho/vencimento, parcelas por fatura, pagamento parcial com arrasto para a fatura seguinte, pagamento antecipado |
| Orçamento | consumo por categoria, 3 estados (<70 % seguro, 70–99 % atenção, ≥100 % excedido), projeção de fim de mês pelo ritmo real |
| Objetivo | progresso, aporte necessário por período, data prevista recalculada |
| Património líquido | `(saldos + ativos + bens) − (faturas abertas + passivos)` |
| Regras de transação | ≥1 condição (descrição/“similar”, contraparte, faixa de valor, intervalo de dias, conta/cartão), com **pré-visualização** antes de aplicar |

**Também nesta fase:** migração inicial versionada (`prisma migrate dev`), seed com as categorias de sistema (17 de gasto + 8 de ganho, adaptadas a Portugal), categorias internas, e a carteira por omissão.

**Gate G1:** migração aplica e reverte limpa · seed idempotente · cobertura ≥ 90 % das funções do motor financeiro · contratos de servidor congelados e documentados em `docs/spec/` pelo analista-funcional.
**Esforço:** 3–5 dias.

---

## 7. Fase 2 — Shell, design system e primitivas

**Objetivo:** a “parte visual mais atualizada” que o cliente pediu, aplicada antes dos ecrãs de produto.

- Tokens verdigris/dark-first do documento 03 (contrastes já medidos), Inter com `tabular-nums`, escala tipográfica, elevação por camadas, movimento com `prefers-reduced-motion`.
- Shell: sidebar em desktop, **bottom nav de 5 destinos em mobile**, área segura, breadcrumb, command palette (⌘K), tema claro/escuro/sistema.
- Componentes shadcn em falta: `table`, `chart`, `sidebar`, `sheet`, `drawer`, `sonner`, `alert`, `alert-dialog`, `popover`, `command`, `combobox`, `calendar`, `field`, `input-group`, `switch`, `slider`, `progress`, `empty`, `kbd`, `item`, `pagination`, `scroll-area`, `collapsible`.
- **Versões decididas pelos geradores, não pelo plano:** o `chart` do shadcn (estilo `radix-nova`) instala `recharts@3.8.0` e o `calendar` instala `react-day-picker@10.x` — fixa-se o que o CLI instalou, subindo o recharts para 3.10.1 só com motivo e re-teste. Cada gráfico é **Client Component**: `dynamic(..., { ssr: false })` **não** é permitido em Server Components no Next 16.
- **Tabelas:** `@tanstack/react-table@8.21.3` (a v9.2.8 é recente, ESM-only e exige a nova opção obrigatória `tableFeatures()`) + `@tanstack/react-virtual@3` acima de ~300 linhas.
- **Descartar `vaul`** do caminho crítico (última publicação em dezembro de 2024): *sheets* e *drawers* usam o `sheet`/`drawer` do shadcn sobre Radix.
- Primitivas à medida: `MoneyInput` (aceita `12,5` / `12.5` / `1 234,56`, cálculo inline sem `eval`, `Enter` guarda, `Esc` cancela), `Amount` (sinal + tom + rótulo acessível), `KpiCard`, `ChartCard` (moldura com título, série, “tabela de dados”, vazio, skeleton), `EmptyState`, `PeriodFilter`, `FilterChips`.

**Gate G2:** revisão visual em 360 px e 1440 px · `@axe-core` sem violações críticas · nenhum token de contraste abaixo de AA para texto · gráfico de demonstração a renderizar com a paleta acessível.
**Esforço:** 3–4 dias.

---

## 8. Fase 3 — Contas, categorias e transações (núcleo transacional)

- **Contas:** corrente, poupança, carteira, dinheiro e ativo manual; conta principal; arquivar (sai dos saldos); **ajuste “travar saldo”** com criação automática do lançamento de ajuste.
- **Categorias e subcategorias:** CRUD, ordenação, ícone/cor, sistema (não editáveis) vs utilizador, categorias internas fora dos totais.
- **Transações:** gasto, ganho e transferência (par com contrapartida); débito/crédito; único/parcelado/recorrente; `pending` / `confirmed` / `ignored`; “já paguei/recebi”; tags; ligação a objetivo; filtros por período, conta, categoria, tag, valor e estado; edição inline; ações em lote; **undo** de operações destrutivas; lançamento rápido por teclado.
- **Passivos manuais** com plano de prestações simples (substitui o módulo Dívidas do original).

**Gate G3:** os 5 fluxos do documento 01 (§3.2–3.5, 3.10) reproduzidos ponta a ponta · invariantes contabilísticos testados (soma dos lançamentos = saldo; transferências neutras; `ignored` fora dos totais) · e2e do lançamento rápido.
**Esforço:** 5–7 dias.

---

## 9. Fase 4 — Cartões, faturas e parcelamentos

- Cartões manuais (marca, conta de pagamento, fecho, vencimento, limite, anuidade); primeira fatura criada automaticamente com o primeiro gasto.
- Faturas com competência ≠ vencimento, estados aberto/fechado/pago, total, pago e arrasto.
- **Pagamento de fatura como operação de primeira classe** (M4): parcial com arrasto automático para a fatura seguinte, encargos explícitos, nunca um “ganho falso”.
- **Parcelamentos editáveis** (M3): alterar valor total, nº de parcelas, data da primeira parcela e descrição, com “aplicar a esta / a todas as seguintes”, propagando às faturas afetadas.

**Gate G4:** matemática de fatura testada (parcial, total, antecipado, arrasto, N parcelas) · parcelamento editado propaga corretamente às faturas futuras · nenhum pagamento de fatura altera entradas/saídas.
**Esforço:** 3–4 dias.

---

## 10. Fase 5 — Orçamento, objetivos, recorrências e regras

- **Orçamentos:** total mensal + distribuição por categoria, “só este mês” ou “padrão mensal”, limiar de alerta configurável (ex.: 80 %), alertas ativos, projeção de fim de mês.
- **Objetivos:** meta pré-definida ou personalizada, valor inicial reservado, movimentos de depósito/resgate/rendimento, frequência de aporte, alerta de prazo, conclusão; **movimentos futuros gerados automaticamente a partir de recorrências** (no original não existem).
- **Recorrências:** frequência, fim de série, geração idempotente de lançamentos futuros, estado pago/previsto/atrasado. O Next 16 **não tem cron**: a geração corre num Route Handler com `export const dynamic = 'force-dynamic'` e segredo no cabeçalho, acionado pelo **Vercel Cron** declarado em `vercel.json`, mais um botão “gerar agora” para desenvolvimento. `after()` e `instrumentation.ts` foram avaliados e rejeitados — não são agendadores. Atenção aos limites do plano Vercel Hobby (frequência mínima de uma execução por dia por cron) e ao facto de o job ter de ser idempotente face a execuções repetidas.
- **Regras de transação:** motor de correspondência com precedência definida e testada, pré-visualização das transações identificadas, aplicação retroativa opcional, ativar/desativar.

**Gate G5:** alerta de orçamento dispara no limiar em teste automatizado · progresso e aporte de objetivo conferidos contra os cálculos do documento 01 (§5.4) · geração de recorrências é idempotente (correr duas vezes não duplica) · precedência de regras documentada e testada.
**Esforço:** 4–6 dias.

---

## 11. Fase 6 — Painel, relatórios e fecho de mês

- **Painel:** hero de património líquido, KPIs (entradas, saídas, sobra), fluxo de 6 meses, donut por categoria com drill-down, próximos 7 dias, seletor de regime caixa/competência.
- **Relatórios:** extrato com os 9 filtros do original, análise por categoria mês/ano, evolução, **projeção de saldo futuro**, comparação mês a mês, médias de 3/6/12 meses.
- **Assistente de fecho de mês (M5):** checklist acionável (transações pendentes, faturas por pagar, orçamentos excedidos, objetivos sem aporte, faturas a vencer) com ligação direta à correção.

**Gate G6:** números do painel conferem com o motor financeiro em teste de integração · projeção de saldo testada com transações agendadas · relatórios exportáveis (prepara a Fase 7).
**Esforço:** 3–5 dias.

---

## 12. Fase 7 — Importação/exportação e PWA

> **Nota importante:** a importação **não existe no sistema original** (pesquisa “OFX” na central de ajuda → 0 resultados) e a exportação é explicitamente inexistente na FAQ. São **funcionalidade nova nossa** (M1), não paridade.

- **Importação OFX e CSV:** carregar ficheiro → deteção de delimitador/encoding (`csv-parse@7` + `iconv-lite` no servidor, `papaparse` apenas na pré-visualização do cliente) → mapeamento de colunas assistido → **deteção de duplicados** → pré-visualização linha a linha → confirmação em lote; sugestão de categorias pelas regras existentes. OFX por `ofx-js@1.1.2` — **o suporte a OFX SGML/1.x é a maior incógnita técnica do projeto** e é provado no smoke test da Fase 0 com um ficheiro real.
- **Exportação** de qualquer vista filtrada: CSV, **XLSX por `exceljs`** (nunca `xlsx@0.18.5` do npm — duas vulnerabilidades conhecidas sem correção publicada) e **PDF por impressão** com `@media print`, evitando o `pdf-lib` (parado desde 2021) e os ~250 MB de Chromium do Puppeteer.
- **Backup/restauro** completo em JSON (portabilidade e confiança).
- **PWA:** `app/manifest.ts` + ícones + **service worker próprio** — é exatamente por onde começa a documentação oficial de PWA do Next 16.4. O `@serwist/next` é baseado em webpack e o **Turbopack é o default no Next 16**, pelo que só se adota `@serwist/turbopack` se o precaching se revelar necessário. Shell offline com fila de sincronização, instalável, safe areas, `100dvh`.

**Gate G7:** ficheiro OFX e CSV reais importados sem duplicar o que já existe · reimportação do mesmo ficheiro não cria duplicados · exportação reimportável · Lighthouse PWA instalável · app utilizável offline para leitura.
**Esforço:** 4–6 dias.

---

## 13. Fase 8 — Endurecimento, testes e entrega

- e2e Playwright dos percursos críticos · acessibilidade automatizada · orçamentos de desempenho.
- Dados de demonstração (seed `demo`) para revisão com o cliente.
- Segurança: política de palavra-passe, sessão, *rate limit* no login, regras de autorização por utilizador em todas as consultas.
- Documentação: `README` de arranque, `docs/spec/` por módulo, guia de decisões.
- **Deploy no Vercel:** `vercel.json` (build com `prisma generate` + `prisma migrate deploy`, e `crons`), variáveis de ambiente na plataforma (`DATABASE_URL` com *pooling*, `DIRECT_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`), *preview deploys* com ramo de base de dados no Neon, domínio e cookies de sessão corretos para produção. **Nada de Docker em produção.**
- Revisão final do diff pelo Lead + execução da aceitação completa por um verificador independente do autor do código.

**Gate G8 (aceitação):** `pnpm install && pnpm build && pnpm format:check && pnpm lint && pnpm typecheck && pnpm test` verdes numa máquina limpa · `pnpm db:migrate && pnpm db:seed` reproduz a aplicação contra uma base de dados Neon nova · o deploy em produção no Vercel serve a aplicação funcional · todos os critérios das Fases 0–7 reconfirmados.
**Esforço:** 3–4 dias.

---

## 14. Onde entram as 5 melhorias face ao original

| Melhoria | Onde | Porque vale a pena |
|---|---|---|
| **M1** Importação/exportação de primeira classe | Fase 7 | O original não exporta nem importa; resolve portabilidade e migração |
| **M2** Motor explícito caixa **e** competência, mês configurável | Fase 1 (motor), Fase 6 (seletor) | O original só tem caixa, com mês fixo no dia 1 e ambiguidade no orçamento |
| **M3** Edição integral de parcelamentos e séries | Fase 4 e 5 | No original um parcelamento manual não pode ser editado |
| **M4** Pagamento de fatura, transferência, aporte e ajuste como operações nativas | Fase 1 e 4 | No original o pagamento da fatura entra como “ganho” e a solução oficial é marcar “Ignorar transação” |
| **M5** Assistente de fecho de mês e análise multi-período | Fase 6 | O original não tem fecho de mês, só uma rotina manual recomendada |

## 15. Riscos e mitigações

| # | Risco | Impacto | Mitigação |
|---|---|---|---|
| R1 | Ecossistema em transição de *major*: `prisma` CLI 8 RC na tag `latest`, TypeScript 7, TanStack Table 9 com dias de vida, Auth.js em beta e absorvido pelo Better Auth | Bloqueio de build a meio de uma fase | Verificação adversarial **já concluída** (Anexo A); versões exatas fixadas; planos B declarados; nenhuma incógnita estrutural entra na fase que dela depende |
| R2 | Regras financeiras ambíguas no original (competência vs caixa no orçamento, encargos de pagamento parcial, campos de bens) | Interpretações divergentes | Decisões escritas em `docs/spec/` pelo analista-funcional antes de implementar; cada regra com teste |
| R3 | Motor financeiro errado contamina tudo | Perda de confiança total no produto | Motor puro, coberto por testes, implementado **antes** de qualquer ecrã; invariantes contabilísticos como testes de propriedade |
| R4 | Dois membros a escrever no mesmo ficheiro de front-end | Conflitos e trabalho perdido | Âmbitos de escrita disjuntos; contratos congelados no fim da Fase 1; Lead serializa sobreposições |
| R5 | Deriva de âmbito (o original tem 24 módulos) | Nunca acabar | Âmbito fechado neste documento; qualquer módulo novo exige aprovação explícita do cliente |
| R6 | Projeto sem testes nem CI no início | Regressões silenciosas | Vitest na Fase 0, e2e na Fase 8, gate de verificação por fase |
| R7 | Docker indisponível para desenvolvimento **offline** | Só afeta o modo local alternativo | A via primária é o Neon; o `docker-compose.yml` é alternativa, não requisito |
| R8 | **OFX SGML/1.x** — investigação concluída: `ofx-js@1.1.2` e `ofx-data-extractor@1.5.0` tratam o estilo que os bancos realmente exportam (**tags de bloco fechadas, tags de valor abertas**), mas **falham** num ficheiro sem nenhuma tag de fecho (`Missing closing tag for LEDGERBAL`) | Fase 7 condicionada, deixou de ser incógnita cega | Amostras sintéticas e resultados esperados já escritos em [docs/spec/](../spec/T0.8-smoke-tests.md); execução do smoke test na Fase 0; plano B: parser próprio do subconjunto SGML (0,5–1 dia para o caminho feliz); falta validar com um extrato português real |
| R9 | Prisma 7.10 sem confirmação pública de compatibilidade com a versão de PostgreSQL que o Neon serve | Fase 1 bloqueada | Em grande parte resolvido pelo Neon (versão gerida pela plataforma; deixa de haver PostgreSQL 18 local); smoke test `migrate dev` na Fase 0 com `DIRECT_URL`; plano B: `postgres:17-alpine` em Docker local |
| R10 | `better-auth` sem declaração oficial para Next 16.4 (o repo testa 16.3.x) e adaptador Prisma 7 recente | Autenticação bloqueada | Spike na Fase 0; plano B: `@node-rs/argon2` + `jose` com cookie httpOnly (assumindo rate-limit, reposição e CSRF) |
| R11 | `@db.Date` lido em UTC e apresentado em `Europe/Lisbon` desloca um dia | Datas de vencimento erradas | Regra fixada na secção 3 (datas de calendário em `@db.Date`, sem hora) + teste dedicado de fronteira de dia |
| R12 | Neon: *pooling* de ligações e migrações em ambiente serverless | Migrações falham, ou *prepared statements* incompatíveis com o pooler | `DIRECT_URL` para migrações e `DATABASE_URL` com *pooling* para a aplicação; smoke test de migração na Fase 0; desativar *prepared statements* no adaptador se necessário |
| R13 | Vercel + monorepo pnpm + Prisma: o `prisma generate` tem de correr no build, e o *service worker* da PWA comporta-se de forma diferente em produção | Deploy falha ou PWA não instala em produção | `db:generate` já é dependência a montante no `turbo.json`; **deploy de pré-visualização obrigatório já na Fase 0 (T0.11)**, muito antes da Fase 7 |
| R14 | Ramo de base de dados por *preview deploy* no Neon multiplica bases e consome o plano gratuito | Custo inesperado | Um único ramo para pré-visualizações, ou usar a base de desenvolvimento nos previews; decidir antes de ligar a integração |

## 16. Decisões que preciso que confirmes

| # | Pergunta | Recomendação |
|---|---|---|
| D6 | Cor de marca | **Verdigris** (verde-água profundo, documento 03 §4.2) — troca-se por azul bancário alterando **um** token |
| D7 | Autenticação | **`better-auth@1.7.7`** + `@better-auth/prisma-adapter`, comprovadamente compatível com Prisma 7. O `next-auth@5` continua em beta, com bugs abertos em Next 16, e o Auth.js foi absorvido pelo Better Auth. Plano B: `@node-rs/argon2` + `jose` |
| D8 | Migrações Prisma | **`prisma migrate dev` versionado** (histórico de esquema), em vez de `db:push` |
| D9 | Microcopy | Tratamento por **“tu”** (informal, próximo) em pt-PT, ou neutro/impessoal |
| D10 | Âmbito das melhorias M1–M5 | **Incluir** — são o principal diferencial face ao original |
| D11 | `git init` e commits por tarefa | **Sim** — já feito: repositório inicializado com `main` |
| D12 | Alojamento da base de dados | **Neon** — `DATABASE_URL` (com *pooling*, usada pela aplicação e pelo Vercel) + `DIRECT_URL` (direta, usada pelas migrações) |
| D13 | Deploy | **Vercel** — `vercel.json` com `crons`, build com `prisma generate` + `prisma migrate deploy`, variáveis de ambiente na plataforma |
| D14 | Repositório | **`rafaelfa/financas-pessoais`** (privado, `main`) — publicado com apenas o `README.md`; o resto do projeto entra na Fase 0 |

## 17. Critérios de aceitação globais (definition of done)

1. Todos os comandos de verificação passam numa máquina limpa, a partir do `README`.
2. Nenhum valor monetário é calculado em vírgula flutuante.
3. Nenhuma operação interna (transferência, fatura, aporte, ajuste) contamina entradas ou saídas.
4. Todos os ecrãs funcionam a 360 px e a 1440 px, em claro e escuro, sem violações críticas de acessibilidade.
5. Nenhuma consulta devolve dados de outro utilizador.
6. Importar o mesmo ficheiro duas vezes não duplica lançamentos.
7. Os números do painel são reproduzíveis a partir do motor financeiro em teste automatizado.
8. O deploy no Vercel reproduz a aplicação a partir do repositório, com as migrações aplicadas e sem qualquer passo manual.

## 18. Esforço estimado

| Fase | Dias de trabalho equivalentes |
|---|---|
| F0 Higiene | 1 |
| F1 Domínio e motor | 3–5 |
| F2 Shell e design system | 3–4 |
| F3 Contas/categorias/transações | 5–7 |
| F4 Cartões e faturas | 3–4 |
| F5 Orçamento/objetivos/recorrências/regras | 4–6 |
| F6 Painel/relatórios/fecho de mês | 3–5 |
| F7 Importação/exportação/PWA | 4–6 |
| F8 Endurecimento e entrega | 3–5 |
| **Total** | **29–43** |

O trabalho paralelo entre membros reduz o tempo de calendário, mas **não** o esforço: os gates de qualidade e a revisão do diff continuam a ser o caminho crítico.

## 19. O que não farei sem nova aprovação tua

- Integração bancária/Open Finance, em qualquer forma.
- Multiusuário, partilha familiar ou workspaces.
- Módulos fora da lista da secção 1 e do âmbito das fases acima.
- Alterações destrutivas na base de dados (perda de dados, `db push --force-reset`).
- Instalação de dependências com licença comercial ou que substituam uma decisão já aprovada.
- Publicação em serviços externos **além** do GitHub (`rafaelfa/financas-pessoais`) e do Vercel.

---

## 20. Anexo A — Verificação adversarial da stack (2026-10-10)

Verificação independente contra o registo npm e documentação oficial, feita **antes** de escrever código. Resultado: **11 correções obrigatórias**, todas já integradas nas fases acima.

| Área | O plano dizia | Veredicto verificado | Decisão |
|---|---|---|---|
| Autenticação | Avaliar `next-auth@5` | **Corrigido** — v5 continua `5.0.0-beta.32`, sem suporte declarado a Next 16, com bugs abertos ([#13388](https://github.com/nextauthjs/next-auth/issues/13388), [#13498](https://github.com/nextauthjs/next-auth/issues/13498)); o Auth.js foi absorvido pelo Better Auth | **`better-auth@1.7.7`** + adaptador Prisma 7 (peer `prisma ^5‖^6‖^7`, documentado com Prisma 7 + PostgreSQL). Plano B: `@node-rs/argon2` + `jose` |
| Prisma CLI | “fixar versões voláteis” | **Corrigido** — a tag `latest` do `prisma` é **`8.0.0-rc.22`**; o 7.10.0 está em `prev` | Fixar `prisma@7.10.0` e `@prisma/client@7.10.0` |
| Cêntimos | `Int`/`BigInt` em aberto | **Corrigido** — `BigInt` faz `JSON.stringify` lançar `TypeError` (verificado em Node) | `Int` (máx. 21 474 836,47 €); datas de calendário em `@db.Date` |
| Gráficos | `recharts@^3.10` | **Corrigido** — o `chart` do shadcn (`radix-nova`) instala `recharts@3.8.0`; `dynamic(ssr:false)` é proibido em Server Components no Next 16 | Manter recharts na versão instalada pelo gerador; gráficos em Client Components |
| Tabelas | `@tanstack/react-table@^9.2` | **Corrigido** — v9.2.8 tem 2 dias e exige `useTable` + `tableFeatures()` obrigatório, ESM-only | **`8.21.3`** (plano B natural e reversível) |
| Calendário | `react-day-picker@9` | **Corrigido** — o gerador instala a **10.0.2** e o template já é v10 | Aceitar a versão do gerador |
| Sheets | `vaul` | **Corrigido** — última publicação em dezembro de 2024, 164 issues abertas | Retirado do caminho crítico |
| XLSX | SheetJS | **Corrigido** — `xlsx` no npm está em 0.18.5 (2022), com duas vulnerabilidades sem correção publicada | **`exceljs@4.4.0`** |
| PDF | biblioteca dedicada | **Corrigido** — `pdf-lib` parado desde 2021; Puppeteer descarrega ~250 MB | **Impressão** com `@media print` |
| PWA | `next-pwa`/Serwist | **Corrigido** — `next-pwa` abandonado em 2022; `@serwist/next` é webpack e o Turbopack é o default no Next 16 | **`app/manifest.ts` + service worker próprio**; `@serwist/turbopack` só se necessário |
| Testes | “instalar Vitest” | **Corrigido** — `workspace` está depreciado desde 3.2 | `vitest@5` com `test.projects`; Playwright para Server Components assíncronos |
| Agendamento | gerar recorrências | **Corrigido** — `after()` não é agendador e `instrumentation.ts` duplica por instância | Route Handler idempotente com `force-dynamic` + segredo, acionado pelo agendador do SO |

**Incógnitas que ficam assumidas e são resolvidas na Fase 0:** `migrate dev` com `prisma.config.ts` e `DIRECT_URL` contra o Neon sem confirmação em primeira fonte, e `better-auth` em Next 16.4. O **OFX SGML deixou de ser incógnita cega**: as duas bibliotecas candidatas tratam o dialeto que os bancos exportam, mas não um ficheiro com zero tags de fecho — ver [docs/spec/T0.8-smoke-tests.md](../spec/T0.8-smoke-tests.md). Cada uma tem plano B na tabela de riscos.

---

## 21. Anexo B — Alojamento: Neon + Vercel

### Variáveis de ambiente

| Variável | Onde se obtém | Para que serve |
|---|---|---|
| `DATABASE_URL` | Neon, ligação **com *pooling*** | Usada pela aplicação em execução, local e no Vercel |
| `DIRECT_URL` | Neon, ligação **direta** | Usada **só** por `prisma migrate dev` / `migrate deploy` — o *pooler* não serve para migrações |
| `BETTER_AUTH_SECRET` | Gerado localmente | Assinatura dos cookies de sessão |
| `BETTER_AUTH_URL` | `http://localhost:3000` em desenvolvimento, domínio de produção no Vercel | *Callbacks* de autenticação |
| `CRON_SECRET` | Gerado localmente | Autoriza as chamadas do Vercel Cron ao Route Handler de geração |
| `NODE_ENV` | Plataforma | — |

O `.env` fica fora do Git (já está no `.gitignore`); o `.env.example` é atualizado e versionado.

### Ciclo de migrações

1. **Desenvolvimento:** `pnpm db:migrate` (usa `DIRECT_URL`) → cria a migração versionada, que é **commitada**.
2. **Deploy:** `prisma migrate deploy` no passo de build do Vercel — aplica o que faltar, sem interação.
3. **Nunca** `db push` contra o Neon de produção: não deixa histórico e pode destruir dados.

### Vercel

- Projeto ligado a `rafaelfa/financas-pessoais`, com `apps/web` como *root directory*.
- Build: `pnpm install` (na raiz) → `prisma generate` (via Turbo) → `next build` → `prisma migrate deploy`.
- `vercel.json` declara os `crons` da geração de recorrências e faturas.
- Um *deploy* de pré-visualização é obrigatório já na **Fase 0 (T0.11)** — não se descobre um problema de monorepo ou de serverless na entrega.
- PWA: verificar instalação e *service worker* **em produção**; o comportamento difere do `next dev`.

### Neon

- Plano gratuito: um projeto com ramos. Decidir cedo entre **um ramo único** para pré-visualizações ou aceitar várias bases por deploy (risco R14).
- O Neon mantém histórico de *backups*; adicionalmente exportamos backup JSON próprio na Fase 7, para não depender de um fornecedor.
- A versão do PostgreSQL é gerida pela plataforma, o que remove a incógnita de compatibilidade local que existia com o Docker.
