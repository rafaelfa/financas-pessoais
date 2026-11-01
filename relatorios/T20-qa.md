# T20 — prova de que o texto não mente (QA)

Data: 2026-11-01 19:53 (hora local) · Windows 10.0.26300.9818 · Node v24.21.0 · pnpm 10.17.1
Repo: `D:\openbot\projetos-dev\financas-pessoais` · `HEAD` = `2f84384` (nada commitado nem empurrado)

**VEREDICTO: PASS**, com **uma imprecisão menor** (não bloqueante) na frase das execuções de CI
antigas: no intervalo 2026-10-14 → 2026-10-18 há **8 execuções, 7 `failure` e 1 `cancelled`** — não
8 falhas. Todas as restantes afirmações de estado resistiram a medição própria, incluindo as duas
que dizem o que falta (menu por publicar, paleta partida), verificadas **em produção**.

Logs completos em `relatorios/.qa-t20/`.

---

## 1. Rotas em produção (medido agora, sem sessão)

```
$ for p in /contas-pagar-receber /consolidacao-contas /api/health /; do
    printf '%-24s ' "$p"
    curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' "https://financas-pessoais-psi-lac.vercel.app$p"
  done
/contas-pagar-receber    307 https://financas-pessoais-psi-lac.vercel.app/entrar
/consolidacao-contas     307 https://financas-pessoais-psi-lac.vercel.app/entrar
/api/health              200
/                        307 https://financas-pessoais-psi-lac.vercel.app/entrar
```

Bate com `README.md:5-15` («`307` para `/entrar` … `/api/health` responde `200`»). O antigo `404`
desapareceu do texto e da realidade.

## 2. Git

```
$ git rev-parse main origin/main
2f8438410ab1472e559b95bba7c1682581e23530
2f8438410ab1472e559b95bba7c1682581e23530
$ git rev-list --left-right --count origin/main...main
0	0
$ git log --oneline -1
2f84384 fix: contas a pagar/receber e consolidação de contas a funcionar, gate verde
```

`2f84384` e `0 0` — como o README afirma. O trabalho por publicar continua na árvore
(`M apps/web/src/lib/nav.ts`, `?? e2e/15-navegacao.spec.ts`).

## 3. CI

```
$ gh auth status
github.com
  ✓ Logged in to github.com account rafaelfa
$ gh run view 41320502835 --json status,conclusion,event,headSha,headBranch,createdAt,workflowName
{"conclusion":"success","createdAt":"2026-11-01T15:17:56Z","event":"push",
 "headBranch":"main","headSha":"2f8438410ab1472e559b95bba7c1682581e23530",
 "status":"completed","workflowName":"CI"}
```

`success`, `push`, commit `2f84384`, **2026-11-01** — exactamente o que o README e o §0 escrevem.

**A imprecisão.** A frase «As execuções anteriores, de 2026-10-14 a 2026-10-18, falharam» (README) e
a gémea no §0. O que existe entre 2026-10-14 19:30 e 2026-10-18:

```
2026-10-14T19:30:15Z failure    589d488
2026-10-14T19:33:15Z failure    b04bc9a
2026-10-14T19:36:38Z failure    cf21804
2026-10-14T19:39:48Z cancelled  9298813   ← não falhou: foi substituída
2026-10-14T19:39:49Z failure    9298813   (mesmo commit, segunda tentativa)
2026-10-14T19:44:17Z failure    6c3a8b3
2026-10-18T10:46:23Z failure    324c4db
2026-10-18T10:53:05Z failure    b980ed0   ← última falha
  → 8 execuções: 7 failure, 1 cancelled, 0 success
```

O sentido da frase (o CI esteve vermelho nesse intervalo) está certo e «a última delas em `b980ed0`»
está certo. O que não é exacto é o quantificador: foram **7 falhas**, e a oitava foi **cancelada**
(duplicada por um segundo disparo no mesmo commit `9298813`). Só isto separa o texto da medição; não
muda nenhuma conclusão de estado. Sugestão de redacção, se o Lead quiser zero folga:
«As execuções de 2026-10-14 a 2026-10-18 falharam (7 falhas e 1 execução cancelada, num total de 8);
a última falha foi em `b980ed0`.»

## 4. Deploy

```
vercel CLI: "vercel: command not found"  → medição feita pela API da Vercel (ferramenta MCP), não pela CLI

list_deployments(target=production, limit=5):
  dpl_2sqFbHRkwG4ZqP1vNEsRiQFuYcQo  state=READY  target=production  created=1793546277851
     meta.githubCommitSha=2f8438410ab1472e559b95bba7c1682581e23530  githubCommitRef=main
  dpl_82BbaaMQXKcbxFXVwt2sQK9mS9vV  state=ERROR  (b980ed0)
  … restantes ERROR

get_alias(financas-pessoais-psi-lac.vercel.app):
  alias      = financas-pessoais-psi-lac.vercel.app
  deployment = dpl_2sqFbHRkwG4ZqP1vNEsRiQFuYcQo
  deploymentId = dpl_2sqFbHRkwG4ZqP1vNEsRiQFuYcQo
```

`READY`, `target: production`, commit `2f84384`, e o domínio do README aponta para **esse** deploy.
As duas afirmações do README/§0 sobre o deploy estão certas.

## 5. O que o README diz que falta, falta mesmo?

**(a) A entrada no menu não está publicada.**

```
$ git diff --numstat 2f84384 -- apps/web/src/lib/nav.ts
18	1	apps/web/src/lib/nav.ts
$ git diff 2f84384 -- apps/web/src/lib/nav.ts | grep '^+' | grep -E 'href|CONSOLIDACAO|CONTAS_A_PAGAR'
+const CONTAS_A_PAGAR_RECEBER: NavItem = {
+  href: '/contas-pagar-receber',
+const CONSOLIDACAO: NavItem = {
+  href: '/consolidacao-contas',
+    items: [PAINEL, TRANSACOES, CONTAS, CONTAS_A_PAGAR_RECEBER, CONSOLIDACAO, CARTOES],
$ git show 2f84384:apps/web/src/lib/nav.ts | grep 'Dia a dia'
  { title: 'Dia a dia', items: [PAINEL, TRANSACOES, CONTAS, CARTOES] },
```

E medi **em produção**, com a conta demo documentada no README (`demo@financas-pessoais.pt`),
entrando pela interface e lendo a barra lateral (só leitura, nenhuma escrita):

```
entrei na producao: https://financas-pessoais-psi-lac.vercel.app/ com h1 «Painel»
  Dia a dia: ["Painel","Transações","Contas","Cartões"]
  Planeamento: ["Orçamento","Objetivos","Recorrências","Regras"]
  Análise: ["Categorias","Relatórios","Importar","Definições"]
producao: «Dia a dia» tem 4 destinos; tem os dois novos? false
```

12 destinos, sem «Contas a pagar/receber» nem «Consolidação». Confirmado: o menu da T19 **não** está
publicado, como o README diz.

**(b) A paleta `Ctrl+K` falha ao abrir.** Reproduzido por mim, em produção e no build local de
`2f84384`+T19 (`pnpm build` + `next start`):

```
local  → depois de Ctrl+K → dialog=0 input=0 itens=0
         PAGE ERROR: TypeError: Cannot read properties of undefined (reading 'subscribe')
           at L (http://localhost:3000/_next/static/chunks/0riomu2-q0v39.js:1:12682)
         RESULTADO: a paleta FALHA ao abrir

produção → producao: depois de Ctrl+K → dialogos=0; erros novos=1
           PAGE ERROR: Cannot read properties of undefined (reading 'subscribe')
```

Não abre diálogo, não há campo de procura, e o erro é o mesmo que o texto cita. A afirmação é
verdadeira (e, como o texto diz, anterior a esta tarefa — o defeito está em
`components/ui/command.tsx`, que monta os filhos do `CommandDialog` fora do `<Command>`).

## 6. Gate

| comando | exit | excerto real |
| --- | --- | --- |
| `pnpm format:check` | 0 | `All matched files use Prettier code style!` |
| `pnpm lint --force` | 0 | `Tasks: 4 successful, 4 total` · `Cached: 0 cached` |
| `pnpm typecheck --force` | 0 | `Tasks: 4 successful, 4 total` · `Cached: 0 cached` |
| `pnpm test --force` | 0 | `Test Files 28 passed (28)` · `Tests 522 passed (522)` |
| `pnpm build` | 0 | `Tasks: 2 successful, 2 total` · `Cached: 0 cached, 2 total` |
| `pnpm install --frozen-lockfile` | 0 | `Already up to date` |

```
$ pnpm format:check
Checking formatting...
All matched files use Prettier code style!                EXIT=0

$ pnpm lint --force
 Tasks:    4 successful, 4 total
Cached:    0 cached, 4 total                               EXIT=0

$ pnpm typecheck --force
 Tasks:    4 successful, 4 total
Cached:    0 cached, 4 total                               EXIT=0

$ pnpm test --force
@repo/shared:test:  Test Files  28 passed (28)
@repo/shared:test:       Tests  522 passed (522)           EXIT=0

$ rm -rf apps/web/.next && pnpm build
 Tasks:    2 successful, 2 total
Cached:    0 cached, 2 total                               EXIT=0
```

`next build` reescreveu `apps/web/next-env.d.ts`; reposto com `git checkout --`, diff vazio.

**O que o `format:check` verde NÃO prova.** O `.prettierignore:7` tem `*.md`, portanto o `README.md`
e o `ESTADO-E-HANDOFF.md` **não entram** no gate; o `format:check` verde não diz nada sobre a
formatação dos dois ficheiros que esta tarefa muda. Provei-o ao contrário — desligando o ignore:

```
$ pnpm exec prettier --check --ignore-path /dev/null README.md docs/plano/ESTADO-E-HANDOFF.md
[warn] README.md
[warn] docs/plano/ESTADO-E-HANDOFF.md
[warn] Code style issues found in 2 files.
```

Ou seja: os dois `.md` não estão no estilo do Prettier e o gate fica verde na mesma. Não é regressão
(já era assim antes da T20, `*.md` já lá estava) e não tem efeito em build nem em tipos, mas não se
pode citar o `format:check` como prova de formatação do README — e o `T20.md` do Dev, bem como o
Revisor, já o reconhecem.

**A linha nova do `.prettierignore` não tapa código do produto.** É uma linha (`+relatorios/.qa-*/`,
`git diff .prettierignore` → `+1`, sem mais nada) e o padrão só apanha `relatorios/.qa-*`:

```
$ pnpm exec prettier --check apps/web/src/lib/nav.ts e2e/15-navegacao.spec.ts
Checking formatting...
All matched files use Prettier code style!
```

## 7. Âmbito

```
$ git diff --stat README.md docs/plano/ESTADO-E-HANDOFF.md .prettierignore
 .prettierignore                |  1 +
 README.md                      | 25 +++++++++++++---------
 docs/plano/ESTADO-E-HANDOFF.md | 47 ++++++++++++++++++++++++++----------------
 3 files changed, 45 insertions(+), 28 deletions(-)

$ git diff -U0 README.md | grep '^@@'
@@ -5,6 +5,11 @@      ← aviso de estado no topo
@@ -115,4 +120,4 @@   ← parágrafo do CI
$ git diff -U0 docs/plano/ESTADO-E-HANDOFF.md | grep '^@@'
@@ -14,15 +14,25 @@
@@ -31,3 +41,4 @@     ← ambos dentro do §0
```

Só o **estado** mudou. Lista de funcionalidades («O que é»), âmbito («Dentro/Fora»), stack
(tabela), estrutura do repositório, arranque e comandos não têm uma única linha no diff — os únicos
hunks são o aviso do topo e o parágrafo do CI no README, e o §0 no handoff. Confirmado também que o
README continua a não prometer o que falta: diz que o menu está por publicar e que a paleta falha.

Outras afirmações do §0 que verifiquei:

| afirmação | medição |
| --- | --- |
| «Tarefas fechadas: T1, T2, T3, T4, T5, T7, T11, T12, T13 e T19» | `TASKS.md` marca T3, T4, T5 e T19 como **fechada**; T16 com o estado que o §0 descreve («aprovada Revisor; falta re-execução do QA») |
| «Tarefas abertas: T6, T9, T10, T14, T15, T17, T18, T20 e T21» | `TASKS.md`: T6, T9, T10, T14, T15, T17, T18, T20 e T21 abertas |
| «Decisões à espera: A2, A3, A4, A5 e A7; a A1 está decidida» | `DECISOES.md`: A1 «TERMINAR»; A2, A3, A4, A5, A7 presentes |
| «33 testes, 30 verdes na medição da T3» | `relatorios/T3.md:85` → `33 testes · 30 passed (3.3m) · 3 failed` |
| «o CI ainda não viu o trabalho local» | `main` = `origin/main` = `2f84384`; `nav.ts`/spec 15 por commitar |

## O que não medi

- **O ramo Neon.** «A `DATABASE_URL` desta máquina aponta para o ramo de teste, não para produção»:
  confirmei só que é Neon (`host` termina em `.neon.tech`, com `-pooler`, base `neondb`); a
  identidade do ramo não sai do URL e não fui buscar o `branch_id` à API. Não abri o `.env` além
  disso.
- **A suite e2e completa.** Não a re-corri; o §0 limita-se a citar a medição da T3 e diz que não foi
  re-executada depois da T19 — o que é verdade.
- **O conteúdo dos ecrãs em produção além da navegação.** Entrei com a conta demo e li a barra
  lateral e a paleta; não percorri os 14 ecrãs autenticados (isso é do `MAPA.md`/T5).

## Achados

1. **Imprecisão menor (não bloqueante).** README e §0: «As execuções anteriores, de 2026-10-14 a
   2026-10-18, falharam» → no intervalo são **8 execuções: 7 `failure` + 1 `cancelled`** (a
   cancelada é duplicado do `9298813`). Real: 7 falhas, não 8. Nenhuma conclusão muda.
2. **Registo (sem acção, já conhecido).** `*.md` no `.prettierignore` → o README não é verificado
   pelo `format:check`; medido que não está no estilo do Prettier (dois `[warn]`), sem efeito em
   build ou tipos.

Nada foi corrigido, commitado ou empurrado; `.prettierignore` não foi tocado. `HEAD` = `2f84384`.
