# T19 — prova independente (QA)

Data: 2026-11-01 · Máquina: Windows, Node v24.21.0, pnpm 10.17.1 · Repo: `D:\openbot\projetos-dev\financas-pessoais`

**VEREDICTO: PASS** — os dois destinos estão na barra lateral pela ordem acordada, abrem os ecrãs
certos por clique, o spec novo falha sem a entrada no `nav.ts` e passa com ela, e o gate completo
está verde. Nada foi corrigido, commitado nem empurrado; `HEAD` continua em `2f84384`.

Prova produzida por mim (não copiada do `relatorios/T19.md` do Dev). Logs completos em
`relatorios/.qa-t19/`.

---

## 1. Gate completo

| comando | exit | excerto real |
| --- | --- | --- |
| `pnpm format:check` | 0 | `All matched files use Prettier code style!` |
| `pnpm lint --force` | 0 | `Tasks: 4 successful, 4 total` · `Cached: 0 cached` |
| `pnpm typecheck --force` | 0 | `Tasks: 4 successful, 4 total` · `Cached: 0 cached` |
| `pnpm test --force` | 0 | `Test Files 28 passed (28)` · `Tests 522 passed (522)` |
| `pnpm build` | 0 | `Tasks: 2 successful, 2 total` · rotas `/contas-pagar-receber` e `/consolidacao-contas` no mapa |

```
$ pnpm format:check            EXIT=0
Checking formatting...
All matched files use Prettier code style!

$ pnpm lint --force            EXIT=0
@repo/web:lint: > eslint .
 Tasks:    4 successful, 4 total
Cached:    0 cached, 4 total
  Time:    19.973s

$ pnpm typecheck --force       EXIT=0
@repo/web:typecheck: > tsc --noEmit
 Tasks:    4 successful, 4 total
Cached:    0 cached, 4 total
  Time:    9.594s

$ pnpm test --force            EXIT=0
@repo/shared:test:  Test Files  28 passed (28)
@repo/shared:test:       Tests  522 passed (522)
 Tasks:    2 successful, 2 total

$ rm -rf apps/web/.next && pnpm build    EXIT=0
@repo/web:build: ├ ƒ /consolidacao-contas
@repo/web:build: ├ ƒ /contas-pagar-receber
 Tasks:    2 successful, 2 total
  Time:    26.87s
```

`lint` e `typecheck` foram corridos com `--force` para não aceitar cache do Turbo.

`next build` reescreveu `apps/web/next-env.d.ts` como o `MAPA.md` prevê; reposto com
`git checkout -- apps/web/next-env.d.ts` e confirmado limpo (`git diff --stat` vazio).

## 2. Percurso humano, sem escrever o URL

Servidor: `pnpm build` + `nohup pnpm --filter @repo/web start` na porta 3000, e2e com
`E2E_REUSE_SERVER=1` (caminho do `MAPA.md`). Script próprio
(`relatorios/.qa-t19/percurso-humano.mjs`): cria sessão pelas rotas de autenticação a sério
(`/api/auth/sign-up/email`, `/api/auth/sign-in/email`), faz `page.goto('/')` **uma só vez** e daí
em diante só clica. Não usa o spec do Dev.

```
PASS  entrei em / com h1 «Painel» (sem escrever outro URL)
PASS  ordem «Dia a dia» = ["Painel","Transações","Contas","Contas a pagar/receber","Consolidação","Cartões"]
PASS  clique «Contas a pagar/receber» → /contas-pagar-receber · h1 «Contas a Pagar / Receber» (esperado /contas-pagar-receber · «Contas a Pagar / Receber») · aria-current=page
PASS  clique «Consolidação» → /consolidacao-contas · h1 «Consolidação de Contas» (esperado /consolidacao-contas · «Consolidação de Contas») · aria-current=page
EXIT=0
```

Entre os dois cliques houve `page.goBack()` para o Painel, também a clicar. Utilizador de QA apagado
no fim (`limpeza: 1 utilizador(es) de QA apagado(s)`).

## 3. O teste guarda mesmo o defeito?

Guardei a versão do Dev em `relatorios/.qa-t19/nav.dev.ts`, repus `nav.ts` do commit
`git checkout 2f84384 -- apps/web/src/lib/nav.ts`, **reconstruí** (o `nav.ts` é compilado para os
chunks do servidor — sem rebuild o teste media o build anterior) e reiniciei o `next start`.

### Sem a entrada no `nav.ts` (commit `2f84384`) — EXIT=1

```
  3 failed
    [chromium] › … a secção «Dia a dia» lista os destinos pela ordem acordada
    [chromium] › … clicar «Contas a pagar/receber» abre \/contas-pagar-receber$ com o título certo
    [chromium] › … clicar «Consolidação» abre \/consolidacao-contas$ com o título certo

    Error: expect(locator).toHaveText(expected) failed
    - Expected  - 2
    + Received  + 0
      Array [
        "Painel",
        "Transações",
        "Contas",
    -   "Contas a pagar/receber",
    -   "Consolidação",
        "Cartões",
      ]
        43 × locator resolved to 4 elements

  2) … Error: expect(locator).toBeVisible() failed
    Locator: … getByRole('link', { name: 'Contas a pagar/receber', exact: true })
    Error: element(s) not found
```

### Com a versão do Dev reposta — EXIT=0

```
[1/3] … a secção «Dia a dia» lista os destinos pela ordem acordada
[2/3] … clicar «Contas a pagar/receber» abre \/contas-pagar-receber$ com o título certo
[3/3] … clicar «Consolidação» abre \/consolidacao-contas$ com o título certo
  3 passed (6.5s)
```

Estado final do ficheiro: `diff relatorios/.qa-t19/nav.dev.ts apps/web/src/lib/nav.ts` → `IDENTICO`,
e `git diff apps/web/src/lib/nav.ts` mostra os dois itens (`+  Layers,`, `+  Receipt,`,
`+const CONTAS_A_PAGAR_RECEBER`, `+const CONSOLIDACAO`,
`+    items: [PAINEL, TRANSACOES, CONTAS, CONTAS_A_PAGAR_RECEBER, CONSOLIDACAO, CARTOES],`).
Nada commitado: `git log --oneline -1` → `2f84384`.

## 4. Nenhum outro destino órfão

Os 14 links da barra lateral, cada um aberto com a sessão do QA:

```
destinos encontrados na barra lateral: 14
  200 /                        ← Painel
  200 /transacoes              ← Transações
  200 /contas                  ← Contas
  200 /contas-pagar-receber    ← Contas a pagar/receber
  200 /consolidacao-contas     ← Consolidação
  200 /cartoes                 ← Cartões
  200 /orcamento               ← Orçamento
  200 /objetivos               ← Objetivos
  200 /recorrencias            ← Recorrências
  200 /regras                  ← Regras
  200 /categorias              ← Categorias
  200 /relatorios              ← Relatórios
  200 /importar                ← Importar
  200 /definicoes              ← Definições
resumo: 14/14 respondem 200; 0 fora de 200
```

Sem achados novos. (A paleta de comandos rebenta ao abrir — defeito conhecido, na T21; fora do âmbito.)

## 5. Âmbito

```
$ git status --short
 M apps/web/src/lib/nav.ts
 M docs/gestao/MAPA.md
 M docs/gestao/TASKS.md
?? apps/web/AGENTS.md
?? e2e/15-navegacao.spec.ts
?? relatorios/.qa-t19/
?? relatorios/T19.md

$ git diff --stat
 apps/web/src/lib/nav.ts | 19 +++++++++-
 docs/gestao/MAPA.md     | 30 ++++++++++++++++
 docs/gestao/TASKS.md    | 96 +++++++++++++++++++++++++++++++++++++++++++++++-
 3 files changed, 143 insertions(+), 2 deletions(-)
```

- Código de produção alterado pela T19: **só** `apps/web/src/lib/nav.ts` (+18/−1). O spec novo
  `e2e/15-navegacao.spec.ts` é o segundo ficheiro da tarefa.
- `docs/gestao/*` e `apps/web/AGENTS.md`: do Lead, não da T19 — não contam.
- `relatorios/T19.md` é o relatório do Dev; `relatorios/.qa-t19/` é a minha prova.
- `MOBILE_NAV` = 5 destinos (`PAINEL, TRANSACOES, ORCAMENTO, OBJETIVOS, CONTAS`), inalterado.
  `NAV_SECTIONS` = 3 secções / 14 itens.

## O que fica por cobrir

- **Paleta de comandos**: os dois destinos estão em `ALL_NAV_ITEMS` (14 itens, derivado de
  `NAV_SECTIONS`), mas não exercitei o diálogo — rebenta ao abrir por defeito anterior
  (`ui/command.tsx`), já na T21. Critério 4 da T19 provado só ao nível dos dados.
- Suite e2e completa (24 percursos) não repetida nesta tarefa: só `e2e/15-navegacao.spec.ts`, mais o
  percurso manual. Os percursos 45/55 já corriam antes e não foram tocados.
- Não validei o telemóvel num dispositivo real; `MOBILE_NAV` verificado por leitura e contagem.
