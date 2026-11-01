# Estado do projeto e handoff

> **Revisão de 2026-11-01 — ler esta secção primeiro.** Tudo o que vem depois foi
> escrito em 2026-10-11 e descreve o estado dessa altura. Fica como histórico — é
> útil precisamente por contar o que aconteceu —, mas já não é verdade em vários
> pontos: a árvore não estava verde (tinha 80 erros de tipo e 51 de lint), o CI não
> passava em `main` e a produção ficou atrás do trabalho de outubro.

## 0. Estado real — 2026-11-01

- **Gate local verde** nesta árvore: `pnpm format:check`, `pnpm lint`,
  `pnpm typecheck`, `pnpm test` (**522 testes**, 28 ficheiros) e `pnpm build`, todos
  com código de saída 0. O `pnpm install --frozen-lockfile` também passa.
- **Publicado: `2f84384`.** Em 2026-11-01, `main` e `origin/main` estão no mesmo
  commit (`2f84384`), com o CI verde na execução `41320502835`, e o deploy
  `dpl_2sqFbHRkwG4ZqP1vNEsRiQFuYcQo` está `READY` em produção, a servir
  `https://financas-pessoais-psi-lac.vercel.app` (o domínio está nas *aliases* desse
  deploy).
- **Produção responde.** Medido agora nesse domínio: `/api/health` dá `200`; `/`,
  `/contas-pagar-receber` e `/consolidacao-contas` dão `307` para `/entrar` — as duas
  rotas novas existem e pedem sessão, já não dão `404`.
- **Por publicar: a entrada no menu.** A T19 pôs «Contas a pagar/receber» e
  «Consolidação» no `nav.ts`, e esse trabalho está na árvore de trabalho, por
  commitar (`git diff 2f84384 -- apps/web/src/lib/nav.ts` → 18 inserções, 1
  remoção), pelo que não está em produção. A decisão D4 continua a ser commitar e
  fazer push com autorização do utilizador.
- **Paleta de comandos avariada.** `Ctrl+K`/`⌘K` rebenta ao abrir
  (`Cannot read properties of undefined (reading 'subscribe')`): o `CommandDialog`
  de `components/ui/command.tsx` monta os filhos sem os envolver no `<Command>` do
  `cmdk`. É anterior a nós, atinge os 14 destinos e tem tarefa aberta (T21).
- **CI**: verde em `2f84384` (execução `41320502835`, 2026-11-01). As oito execuções
  anteriores, de 2026-10-14 a 2026-10-18, não passaram — sete falharam e uma foi
  cancelada por ser duplicada; a última delas foi em `b980ed0`.
- **Tarefas fechadas**: T1, T2, T3, T4, T5, T7, T11, T12, T13 e T19 — mais a T16,
  que espera a re-execução do QA (o código e a prova do Dev estão fechados: 12/12,
  um sucesso em dois pedidos simultâneos). A T8 foi absorvida na T7. O quadro está em
  `TASKS.md`.
- **Tarefas abertas**: T6, T9, T10, T14, T15, T17, T18, T20 e T21. O que espera o
  utilizador é o commit e o push (D4).
- **Decisões à espera do utilizador** (`DECISOES.md`): **A2, A3, A4, A5 e A7**.
  A A1 está decidida: a funcionalidade do `b980ed0` fica.
- **Testes ponta a ponta**: 33 testes, 30 verdes na medição da T3; as 3 falhas eram
  as pré-existentes de `35-estado-transacoes` (T10). Prova em `relatorios/T3.md`. A
  suite completa não foi re-executada depois da T19, que acrescentou o spec
  `e2e/15-navegacao.spec.ts` (3 testes; prova em `relatorios/T19-qa.md`).
- **Base de dados**: Neon. A `DATABASE_URL` desta máquina aponta para o ramo de
  teste, não para produção — os relatórios do QA foram medidos lá.
- **Onde olhar**: `docs/gestao/MAPA.md` (o que foi medido, com números),
  `docs/gestao/TASKS.md` (o quadro), `docs/gestao/DECISOES.md` e
  `relatorios/T*.md` (as provas de cada tarefa).

---

Documento escrito no fim de uma sessão longa, para quem continuar. Existe porque o
contexto de uma sessão acaba e o projeto não: **tudo o que interessa está no
repositório, nos documentos e no quadro de tarefas**, e este ficheiro diz onde
olhar primeiro.

## 1. Onde estamos — escrito em 2026-10-11 (histórico)

- Repositório: `https://github.com/rafaelfa/financas-pessoais` (privado), ramo `main`.
- **Estado: a árvore está verde, tudo commitado, o CI passa em `main` e o que está
  publicado funciona.** Fases 0 a 8 fechadas; o que falta são decisões e lacunas que
  não fecham por código sozinho (§6) e cobertura que se sabe em falta (§7).
- Últimos commits: `3df0ed2` (fuso dos testes + relatório T8.4), `f9cfe9c` (handoff
  e README), `213058c` (Fase 8: CI, migrações, seed demo, segurança, acessibilidade
  e e2e) e `c43eaa7` (verificação da importação, I1–I10, reversão, PWA, exportação).
- **Integração contínua verde em `main`** (`.github/workflows/ci.yml`, 2m48s no
  runner de Ubuntu): instalar com `--frozen-lockfile`, validar o esquema Prisma,
  format, lint, tipos, testes e build. O fumo em produção é um workflow à mão
  (`smoke.yml`) porque escreve numa base real.
- Deploy: Vercel, com Neon. Produção:
  `https://financas-pessoais-psi-lac.vercel.app`. O runbook está em
  `docs/plano/DEPLOY.md` (e diz explicitamente o que não foi possível verificar).

## 2. O gate, e como se corre

```powershell
pnpm format          # escreve a formatação
pnpm format:check
pnpm lint            # 4 tasks
pnpm typecheck       # 4 tasks
pnpm test            # 522 testes, 28 ficheiros
pnpm build           # o gate que mais apanha; exige .next limpo
pnpm test:e2e        # 20 percursos (Playwright), contra a Neon do .env
node packages/db/smoke.mjs https://<url-de-producao>   # fumo autenticado
```

Resultado da última passagem completa (2026-10-11, antes do trabalho de outubro): tudo verde — 522 testes,
`build` 2/2, `test:e2e` **20/20**, fumo em produção **12/12** páginas a 200,
`db:seed` idempotente e o CI verde em `main`.

**A CI já pagou o que custou.** Na primeira corrida apanhou um defeito que nenhum
gate local apanhava: o teste de formatação de datas dependia do fuso da máquina
(`13:00` em `Europe/Lisbon`, `12:00` em UTC), porque o `Intl` sem `timeZone`
explícito usa o fuso do sistema. A correção fixa `TZ=Europe/Lisbon` na
configuração do Vitest — não se afrouxou a asserção.

**Armadilhas do ambiente (já custaram tempo a vários):**

- **`spawn EPERM`** em `next build`, `next dev`, `vitest`, `tsx` e no arranque dos
  browsers: a sandbox bloqueia processos filhos com *stdio* em pipe. Estes comandos
  exigem `sandbox_permissions: "danger-full-access"`. **Os membros da equipa não têm
  essa escalada** — build, testes, e2e e fumo são sempre do Lead.
- **`.next` sujo** provoca `EPERM: unlink` numa junção do Turbopack. Apagar
  `apps/web/.next` resolve; é saída gerada.
- **pnpm com store fora do workspace**: `--store-dir` e `$env:CI='true'`, ou
  escalada — sem ela, `pnpm install` falha com `ERR_PNPM_EPERM`.
- **`prisma generate`** deixa de funcionar se o `node_modules` ficar a meio: um
  `pnpm install --force` interrompido desliga os *links* e o erro que aparece é
  `proper-lockfile`/`signal-exit`. A reparação é `pnpm install --no-frozen-lockfile`
  com escalada, não mexer no esquema.
- **Quedas de energia corrompem ficheiros em silêncio.** Aconteceu duas vezes nesta
  sessão: `packages/db/prisma/seed.ts` ficou com 48 077 bytes NULOS e os binários do
  Chromium ficaram «danificados e ilegíveis» (`spawn UNKNOWN` no Playwright). Se algo
  falhar de forma estranha e sem relação com o diff, **medir o ficheiro antes de
  duvidar do código** (`(Get-Item x).Length`, executar o binário diretamente).

## 3. O que a Fase 8 deixou pronto

- **CI**: `.github/workflows/ci.yml` (gate completo, com PostgreSQL em serviço e
  `--frozen-lockfile`) e `smoke.yml` (fumo em produção, à mão).
- **Migrações versionadas**: `packages/db/prisma/migrations/` com a linha de base,
  marcada como aplicada contra a Neon. O `prisma.config.ts` usa a `DIRECT_URL` e
  declara `migrations.seed`.
- **Seed de demonstração**: `pnpm --filter @repo/db db:seed` → utilizador
  `demo@financas-pessoais.pt` (idempotente: 97 linhas na 1.ª passagem, 0 na 2.ª).
- **Segurança**: rate limit no `better-auth`, posse do `cardId` confirmada, e
  `docs/spec/T8.2-auditoria-autorizacao.md` com as 193 chamadas inventariadas.
- **Acessibilidade**: `docs/spec/T8.3-acessibilidade.md`, com o que foi corrigido e
  o que ficou declarado.
- **Ponta a ponta e desempenho**: `e2e/` (20 percursos: registo, autenticação e
  logout, transações, orçamento, objetivos, importar e desfazer, exportar e
  reimportar, axe e desempenho) e `docs/spec/T8.4-e2e-e-desempenho.md`.
- **Documentação**: `README.md` reescrito (estava factualmente errado: dizia que não
  existia código) e `docs/plano/DEPLOY.md`.

## 4. O quadro de tarefas

`team_task_list` tem as tarefas da Fase 8 (task-1 a task-4). O quadro **não
sobrevive a uma sessão nova**: as tarefas desta sessão foram criadas neste
processo. Se o quadro aparecer vazio, o estado real está nos commits e nos
relatórios `docs/spec/T8.*` — este documento é o índice.

## 5. Convenções do projeto (não são preferências, são regras)

1. **Dinheiro é sempre cêntimos inteiros** (`Int`). Nunca vírgula flutuante, nunca
   `Float`/`Decimal`. Datas de calendário em `@db.Date` e como `YYYY-MM-DD`.
2. **A lógica pura vive em `packages/shared`** e é lá que é testada. A camada de
   `apps/web/src/server` é fina: consulta, validação, transação.
3. **Cada correção com um teste que fique vermelho antes.** O modelo a seguir é
   `packages/shared/src/finance/__tests__/gate-g6.test.ts`.
4. **Não se alteram testes existentes para os fazer passar.** Se um teste contradiz
   uma correção, diz-se qual e porquê.
5. **Toda a consulta e escrita filtra por `userId` da sessão**, e todo o
   identificador vindo do cliente é confirmado como sendo do utilizador antes de ser
   usado.
6. **Cada fase fecha com gate verde + fumo em produção + verificação adversarial.**
   As cinco verificações adversárias feitas até hoje encontraram defeitos reais que
   os testes verdes não viam — incluindo um erro 500 que bloqueou o utilizador
   durante uma fase inteira, um orçamento que media um dia a menos por mês, e o
   ciclo exportar → reimportar a duplicar movimentos iguais.
7. **Os documentos não são decoração.** O contrato de cálculo está em
   `docs/spec/F1-regras-financeiras.md`; os relatórios de verificação em
   `docs/spec/T*.md`; o plano em `docs/plano/PLANO-EXECUCAO.md`.
8. **Vocabulário**: o glossário do `F1-regras-financeiras.md` fixa os termos em
   pt-PT ("parcela" e não "prestação" para compras parceladas, "fatura" com fecho e
   vencimento, "travar saldo"). A microcopy usa "tu".
9. **Escrita por âmbito disjunto.** Cada tarefa declara os ficheiros que pode
   escrever; dois membros nunca escrevem no mesmo ficheiro ao mesmo tempo.
10. **Versões exatas, nunca `@latest`**, e os números de um ambiente não se
    inventam: mede-se e escreve-se o valor.

## 6. Decisões abertas — são do utilizador, não minhas

1. **Contraste de `--border`/`--input`** (`apps/web/src/app/globals.css:94-95`,
   `:154-155`): medido a **1,31:1** (claro) e 1,46–1,57:1 (escuro) contra o fundo;
   o mínimo WCAG para limites de controlo (1.4.11) é 3:1. Não corrigi de propósito:
   estes tokens também desenham separadores de tabelas e cartões, e escurecê-los
   muda o carácter visual da aplicação. Mínimos medidos que resolvem, mantendo croma
   e matiz: claro `L≈0,66` (`#8C9497`), escuro `L≈0,49` (`#5B626A`).
2. **Validar a importação com um extrato real de um banco português.** É a única
   lacuna que nenhuma verificação fecha: as amostras são sintéticas. Vale sobretudo
   para o dialecto OFX **sem nenhuma tag de fecho**.
3. **`CRON_SECRET` não tem quem a use.** Está declarada no `.env.example` e no
   `turbo.json`, mas não existe rota de cron (as únicas rotas de API são
   `/api/health` e `/api/auth/[...all]`). Ou se cria a rota que gera as recorrências
   vencidas e se acrescenta a entrada `crons`, ou se retira a variável — manter uma
   variável que promete uma tarefa agendada inexistente é um documento que mente.
4. **Bens e dívidas (património) não têm ecrã.** O património líquido contabiliza-os,
   mas não há forma de os registar.
5. **`GoalMovementType` admite `yield`** no motor e na base, mas nenhum caminho o
   cria (nem interface nem importação). Fica registado como código morto: ou ganha
   uso, ou desaparece — o padrão é o da frequência anual, que foi removida.
6. **A regra morta do `cardId`**: o schema de regras aceita `cardId` como condição, a
   interface oferece-o e mostra-o, e o motor ignora-o em silêncio (a regra aparece
   como inválida, e a ação e a interface discordam). A proposta está no §3.3 de
   `docs/spec/T8.2-auditoria-autorizacao.md` e recomenda dar a condição ao motor, não
   apagá-la da interface. São 8 pontos, 5 deles em `packages/shared`.

## 7. O que ainda não está coberto nos testes

Declarado em `docs/spec/T8.4-e2e-e-desempenho.md` §7, e não é uma lista de desculpas
— é o que alguém deve atacar a seguir:

- **Telemóvel e WebKit**: os e2e correm só em Chromium, a 1280 px. A aplicação é
  responsiva (360 px a 1440 px+) e há componentes que só aparecem em telemóvel (a
  navegação inferior, o botão de saída do cabeçalho).
- **Tema escuro**: o axe correu só no tema claro.
- **Concorrência**: dois pedidos em paralelo não são exercitados pela interface
  (a classe de falha que a T5.6 e a T7.5 encontraram por medição direta).
- **Ecrãs sem percurso**: categorias, regras, cartões, recorrências e definições só
  são visitados pelo fumo (que confirma que respondem, não que escrevem bem).
- **Limitador de entrada por HTTP**: não foi exercitado (está desligado em
  desenvolvimento, de propósito, para não partir os e2e). A receita está no §5 do
  T8.2: 11 POST seguidos a `/api/auth/sign-in/email` em produção, e o 11.º deve
  devolver 429.

## 8. Onde está o resto do estado

- **Histórico de decisões**: as mensagens de commit contam o *porquê*, não só o
  *quê*. Ler `git log` é a forma mais rápida de recuperar contexto.
- **Relatórios de verificação**: `docs/spec/T3.3-*` (camada de dados), `T5.6-*`
  (Fases 5 e 6), `T7.5-*` (importação e exportação) e `T8.2-*`/`T8.3-*`/`T8.4-*`
  (Fase 8). Cada um tem os achados com `ficheiro:linha`, o cenário concreto e o
  valor medido.
- **Ficheiros que se perderam**: existiu um `packages/verificacao-t75/` (arnês de
  verificação da importação, commitado) e scripts de medição pontuais que foram
  apagados depois de cumprirem a função — não são dívida, são ferramentas.
