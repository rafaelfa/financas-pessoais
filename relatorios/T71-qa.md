# T71 — `logicalCount` escrito duas vezes (QA passo 2)

**Projeto:** `D:/openbot/projetos-dev/financas-pessoais` · **base:** `5d5e053` · **don:** QA

## 5.1 · `git grep "function logicalCount" -- apps/` → exit 1

```powershell
$ git grep -n --untracked "function logicalCount" -- apps/
exit: 1
```

Zero resultados. A função não está definida em `apps/`.

**Veredicto: PASS.**

## 5.2 · `git grep "logicalCount" -- packages/shared/src` → definição + teste

```powershell
$ git grep -n --untracked "logicalCount" -- packages/shared/src
packages/shared/src/finance/__tests__/selection.test.ts:3:import { logicalCount, type SelectableRow } from '../selection';
packages/shared/src/finance/__tests__/selection.test.ts:19:describe('logicalCount', () => {
… (linhas 21, 25, 29, 33, 38, 42, 46 — as sete asserções)
packages/shared/src/finance/selection.ts:18:export function logicalCount(rows: readonly SelectableRow[]): number {
```

Definição na linha 18 do módulo novo; export no índice (`finance/index.ts:16`).

**Veredicto: PASS.**

## 5.3 · `git grep -E "(import|export).from" packages/shared/src` → exit 1

```powershell
$ git grep -E "^(import|export) .*from '(@/|@repo/web|@repo/db)" -- packages/shared/src
exit: 1
```

Zero resultados. O `shared` não importa de `apps/`, `@repo/web` nem `@repo/db`.

**Veredicto: PASS.**

## 5.4 · `pnpm test` → 598 verdes, 34 ficheiros

Comando: `pnpm test`

Saída (excerto):
```
Test Files  34 passed (34)
Tests       598 passed (598)
```

**Veredicto: PASS.**

## 5.5 · Gate completo

| Comando | Saída | Exit |
|---------|-------|------|
| `pnpm format:check` | All matched files use Prettier code style! | 0 |
| `pnpm lint` | Tasks: 4 successful, 4 total | 0 |
| `pnpm typecheck` | Tasks: 4 successful, 4 total | 0 |
| `pnpm build` | Tasks: 2 successful, 2 total | 0 |

**Veredicto: PASS.**

## 5.6 · `playwright test 34-acoes-em-massa` → 5 passed

Comando: `pnpm exec playwright test 34-acoes-em-massa --output=test-results/t71-qa`

```
ok 1 › ações em massa no extrato › apagar uma perna de uma transferência apaga o par e conta 1 lançamento (6.7s)
ok 2 › ações em massa no extrato › mudar de página, de filtro ou de tamanho limpa a seleção (5.2s)
ok 3 › ações em massa no extrato › o servidor recusa 201 ids e um id alheio sem alterar as linhas válidas (7.9s)
ok 4 › ações em massa no extrato › marcar efetivada duas vezes não muda nada nem dá erro (3.0s)
ok 5 › ações em massa no extrato › três selecionados: axe 0, nomes, alvos de 44 px, Escape e contagem anunciada (6.4s)
5 passed (39.8s)
```

Confirmação de spec intacta: `git status --porcelain -- e2e/34-acoes-em-massa.spec.ts` → saída vazia.

**Veredicto: PASS.**

## 5.7 · Mutations — verificação por leitura de relatorios/T71-dev.md

O Dev colou em `relatorios/T71-dev.md`, secção 4:

(a) **Mutação literal** (`return rows.length`) → unit vermelho: **4 failed / 7 tests**. As 4 falhas são nos casos com pernas ligadas (par → esperava 1, recebeu 2; dois pares → esperava 2, recebeu 4; par+solta → esperava 2, recebeu 3; grupo 3 → esperava 1, recebeu 3). Os outros 3 casos (3 soltas, vazio, grupos diferentes) ficam verdes porque `rows.length` coincide quando não há pernas.

(b) **Mutação compilável** (`groups.size + rows.filter((row) => row.transferGroupId !== null).length`) → unit **6 failed / 7**, typecheck compila. E2E spec 34: **1 failed** — mensagem `Expected substring: "Apagar este lançamento?"` / `Received: "Apagar estes 2 lançamentos?…"` (duas linhas de grupo passaram a dizer 2 em vez de 1).

(c) **Reposição com verde**: gate verde (format:check · lint · typecheck · test 598 · build) + spec 34 com 5 passed. Tudo colado em T71-dev.md.

As três saídas existem. Nenhuma falta.

**Veredicto: PASS.**

## 5.8 · Cobertura do teste novo

`packages/shared/src/finance/__tests__/selection.test.ts`:

| Caso mínimo | Código | Resultado esperado |
|-------------|--------|-------------------|
| Par de transferência (2 linhas, 1 grupo) | `[linha('g1'), linha('g1')]` | `toBe(1)` ✓ |
| Dois pares | `[linha('g1'), linha('g1'), linha('g2'), linha('g2')]` | `toBe(2)` ✓ |
| Três soltas | `[linha(null), linha(null), linha(null)]` | `toBe(3)` ✓ |
| Par + solta | `[linha('g1'), linha('g1'), linha(null)]` | `toBe(2)` ✓ |
| Grupo de 3 | `[linha('g1'), linha('g1'), linha('g1')]` | `toBe(1)` ✓ |
| Vazia | `[]` | `toBe(0)` ✓ |

Os 6 casos mínimos cobertos. Sétimo caso adicional presente: grupos diferentes nunca se somam (`[linha('g1'), linha('g2'), linha(null)]` → `toBe(3)`).

**Veredicto: PASS.**

---

## Veredicto global T71: PASS

Todos os pontos 5.1–5.8 verificados. Sem falhas.

*Prova:* `relatorios/T71-qa.md` · `relatorios/T71-dev.md` (prova do Dev)
*Ambiente:* Node 24.21.0, pnpm 10.17.1, Windows 32-bit, TypeScript 5.9.3 estrito
