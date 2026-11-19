# T71 — Revisor de Código

Base: `5d5e053` (HEAD) · Diff: HEAD vs árvore de trabalho (novos `selection.ts`, `selection.test.ts`; modificados `index.ts`, `transaction-bulk-actions.tsx`, `transactions-actions.ts`).

## Veredicto

**Nada a assinalar.** Critérios 5.1–5.5 verificados; sem achados bloqueantes, DEVE nem OPCIONAIS.

---

### 5.1 — Definição única em shared, zero em apps

`git grep "function logicalCount" -- apps/` → **0 resultados**. O único ficheiro com o export é `packages/shared/src/finance/selection.ts:18`. O índice `index.ts:16` tem `export * from './selection';`. Os três consumidores (`transaction-bulk-actions.tsx:3,82`, `transactions-actions.ts:9,818,875,897`) importam de `@repo/shared`. A duplicação acabou. Confirmando que os tipos dos dois chamadores satisfazem a interface mínima da selecção: `TransactionView` e `BulkRow` ambos têm `transferGroupId: string | null`, compatibilidade estrutural confirmada por tipo.

### 5.2 — Teste cobre todos os cenários do critério

Sete casos em `selection.test.ts`: par = 1 (:21), dois pares = 2 (:25), três soltas = 3 (:29), par + solta = 2 (:33), grupo de 3 = 1 (:38), vazio = 0 (:42), grupos diferentes ≠ 3 (:46). O sétimo caso (grupos diferentes não se somam) deriva logicamente dos outros — um Set de IDs distintos conta operações independentes. Fábrica `linha(transferGroupId)` isola o gatilho. Nenhum teste depende de implementação interna.

### 5.3 — Prova de mutação colada

Dev mudou `groups.size + rows.filter(null).length` por `rows.length`: 4 falhas de 7 casos nos testes unitários. Variante compilável (`filter(non-null).length`) dá 6 falhas. Mutação de classe (linhas no lugar de operações) também falha na spec 34 do Playwright — diálogo diz «2 lançamentos» quando deveria dizer «1». Saídas coladas no relatório do Dev. Nota: a primeira execução foi interrompida pelo `-First` do PowerShell matando o canal — erro do Dev, não do código.

### 5.4 — Gate verde confirmado pelo QA

598 testes · 34 ficheiros · typecheck 4/4 · lint 4/4 · format verde · build 2/2 · spec 34 → 5 passed. O Dev provou a espec 34 isolada (5 passed / 38.5s); a suíte completa correu pelo QA. Nada existente alterado — apenas ficheiros novos.

### 5.5 — Zero dependências novas

`package.json` e `pnpm-lock.yaml` intocados (`git diff HEAD -- name-only` = nada neles). `selection.ts` não importa absolutamente nada — função pura sem dependências externas. `packages/shared` não importa de `apps/`, `@repo/web` ou `@repo/db`.

### Observações adicionais

A lógica é idêntica à versão original removida — apenas movida de dois sítios para um. O algoritmo (Set de grupos + contagem de nulos) era o certo e continua a ser. Sem regressão de comportamento.

---

## Não verifiquei

- Typecheck real (`pnpm typecheck`) — não correram comandos nesta máquina
- Build real (`pnpm build`) — não correram comandos nesta máquina
- Suíte e2e — não corri nenhum comando
- Valor exato dos 598 testes — confio no QA que reportou
- `next-env.d.ts` gerado — modificado pelo build mas alheio ao diff funcional
