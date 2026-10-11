# Estado do projeto e handoff

Documento escrito no fim de uma sessão longa, para quem continuar. Existe porque o
contexto de uma sessão acaba e o projeto não: **tudo o que interessa está no
repositório, nos documentos e no quadro de tarefas**, e este ficheiro diz onde
olhar primeiro.

## 1. Onde estamos

- Repositório: `https://github.com/rafaelfa/financas-pessoais` (privado), ramo `main`.
- Último commit conhecido no momento em que isto foi escrito: `b3762b5` — importação
  de extratos, exportação e as correções médias das Fases 5 e 6.
- **Há trabalho por commitar** (ver §3): a árvore de trabalho está à frente do último
  commit e **não está verde**.
- Deploy: Vercel, com Neon como base de dados. O URL de produção está nas variáveis
  do projeto.

Fases concluídas e publicadas: **F0 a F6** e, da Fase 7, a importação/exportação
(F7.1), o ecrã de importação (F7.2), a PWA (F7.3), a remoção da frequência anual e a
gravação do dia da série (T7.4) e a reversão de uma importação (T7.6).

## 2. O que fazer a seguir, por ordem

1. **Fechar a task-26 no quadro de tarefas** (`team_task_list`): é a correção dos
   dez achados da verificação adversarial da importação, a cargo do `dev-dados`.
   Enquanto não fechar, **a árvore está vermelha** e nada deve ser publicado.
2. **Correr o gate completo** (ver §4) e só publicar se estiver verde.
3. **Correr o fumo em produção**: `node packages/db/smoke.mjs <url>`.
4. **Commit e push** de tudo o que estiver por commitar.
5. **Fase 8** (endurecimento, testes ponta a ponta, CI e entrega) — ver
   `docs/plano/PLANO-EXECUCAO.md`, secção 13.

## 3. Estado exato da árvore (vermelha, e porque)

Quatro problemas, **todos do mesmo autor** e todos do refactor a meio da task-26:

| Onde | O que é |
|---|---|
| `apps/web/src/server/import-actions.ts:229` | O tipo da transação passada às funções puras não corresponde a `ConfirmTx` |
| `apps/web/src/components/import-revert.tsx:21` | `ImportedTransactionRef` **não está exportado** de `import-actions.ts` — falta um `export` numa linha, e sem ele o ecrã da reversão não compila |
| `packages/shared/src/import/__tests__/preview.test.ts` | 2 testes falham na **impressão digital** (`fingerprintOf` e «movimento repetido dentro do próprio ficheiro») |
| — | O resto está limpo: `lint` 4/4 e **500 testes passam**, incluindo os 19 da reversão |

Estes factos foram verificados com o gate corrido pelo Lead, não relatados por
terceiros. Se ao retomar já estiverem resolvidos, melhor: confirma com o gate antes
de assumir.

## 4. Comandos: o gate e as armadilhas do ambiente

```powershell
pnpm format          # escreve a formatação
pnpm lint            # 4 tasks
pnpm typecheck       # 4 tasks
pnpm test            # 26-27 ficheiros, ~500 testes
pnpm build           # o gate que mais apanha; exige .next limpo e permissões
node packages/db/smoke.mjs https://<url-de-producao>   # fumo autenticado
```

Armadilhas já conhecidas nesta máquina (todas documentadas por terem custado tempo):

- **`spawn EPERM`** em `next build` e em `vitest`: a sandbox bloqueia processos filhos
  com stdio em pipe. O `build` e os testes exigem
  `sandbox_permissions: "danger-full-access"`. Os membros da equipa não têm essa
  escalada — **estes dois gates são sempre do Lead**.
- **`.next` sujo** provoca `EPERM: unlink` numa junção do Turbopack. Apagar
  `apps/web/.next` resolve; é saída gerada.
- **pnpm com store fora do workspace**: usar
  `--store-dir "C:\Users\VENOM\AppData\Local\pnpm\store\v10"` e `$env:CI='true'`.
- **Prisma**: `prisma db push --accept-data-loss` quando se remove uma coluna;
  regenerar o cliente (`prisma generate`) antes de concluir que um campo novo não
  existe.
- **`tsx`** falha com `spawn EPERM`; os membros resolveram-no com um carregador de
  TypeScript do Node (método descrito no §5 de `docs/spec/T3.3-verificacao-camada-dados.md`).

## 5. Convenções do projeto (não são preferências, são regras)

1. **Dinheiro é sempre cêntimos inteiros** (`Int`). Nunca vírgula flutuante, nunca
   `Float`/`Decimal`. Datas de calendário em `@db.Date` e como `YYYY-MM-DD`.
2. **A lógica pura vive em `packages/shared`** e é lá que é testada. A camada de
   `apps/web/src/server` é fina: consulta, validação, transação. Foi por isso que a
   construção do período do orçamento mudou para o domínio — o defeito do gate G6
   estava lá e nenhum teste alcançava a camada de servidor.
3. **Cada correção com um teste que fique vermelho antes.** O modelo a seguir é
   `packages/shared/src/finance/__tests__/gate-g6.test.ts`.
4. **Não se alteram testes existentes para os fazer passar.** Se um teste contradiz
   uma correção, diz-se qual e porquê.
5. **Toda a consulta e escrita filtra por `userId` da sessão**, e todo o
   identificador vindo do cliente é confirmado como sendo do utilizador antes de ser
   usado. A verificação T3.3 mostrou o que acontece sem isto.
6. **Cada fase fecha com gate verde + fumo em produção + verificação adversarial.**
   As quatro verificações adversárias feitas até hoje encontraram, em todas as
   ocasiões, defeitos reais que os testes verdes não viam — incluindo um erro 500 que
   bloqueou o utilizador durante uma fase inteira e um orçamento que media um dia a
   menos por mês.
7. **Os documentos não são decoração.** O contrato de cálculo está em
   `docs/spec/F1-regras-financeiras.md`; os relatórios de verificação em
   `docs/spec/T*.md`; o plano em `docs/plano/PLANO-EXECUCAO.md`.
8. **Vocabulário**: o glossário do `F1-regras-financeiras.md` fixa os termos em
   pt-PT ("parcela" e não "prestação" para compras parceladas, "fatura" com fecho e
   vencimento, "travar saldo"). A microcopy usa "tu".
9. **Escrita por âmbito disjunto.** Cada tarefa declara os ficheiros que pode
   escrever; dois membros nunca escrevem no mesmo ficheiro ao mesmo tempo. A única
   vez que isso aconteceu nesta sessão, apareceu uma gralha que nenhum teste apanhava
   (um schema que exigia texto enquanto o browser enviava um hash).

## 6. Decisões abertas que são do utilizador

1. **Fase 8** — endurecimento, testes ponta a ponta (Playwright) e CI. É o que falta
   para o projeto estar "entregue" em vez de "a funcionar".
2. **Validar a importação com um extrato real de um banco português.** É a única
   lacuna que nenhuma verificação minha fecha: as amostras são sintéticas. Vale
   sobretudo para o dialecto OFX **sem nenhuma tag de fecho**.
3. **`GoalMovementType` admite `yield`** no motor sem coluna correspondente na base —
   o mesmo padrão que a frequência anual tinha, e que foi removida. Fica registado
   como suspeito; alguém deve verificar se é alcançável.
4. **Bens e dívidas (património) não têm ecrã.** O património líquido contabiliza-os,
   mas não há forma de os registar.
5. **A interface de importação pode colar o extrato** (textarea): o schema aceita, a
   interface não oferece. São cerca de 15 linhas.

## 7. Onde está o resto do estado

- **Quadro de tarefas partilhado**: `team_task_list` — cada tarefa tem o dono, o
  âmbito de escrita, os entregáveis e o critério de aceitação.
- **Histórico de decisões**: as mensagens de commit contam o *porquê*, não só o *quê*.
  Ler `git log` é a forma mais rápida de recuperar contexto.
- **Relatórios de verificação**: `docs/spec/T3.3-*` (camada de dados), `T5.6-*`
  (Fases 5 e 6), `T7.5-*` (importação e exportação). Cada um tem os achados com
  ficheiro:linha, o cenário concreto e o valor medido.
