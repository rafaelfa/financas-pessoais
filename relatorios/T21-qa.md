# T21 — prova independente (QA): a paleta de comandos

Data: 2026-11-01 · Windows 10.0.26300.9818 · Node v24.21.0 · pnpm 10.17.1
Repo: `D:\openbot\projetos-dev\financas-pessoais` · `HEAD` = `2f84384` (nada commitado nem empurrado)

**VEREDICTO: PASS** — com o build de produção a paleta abre sem qualquer erro, lista os 14 destinos,
filtra e navega para os dois ecrãs; o spec novo falha sem a correção e passa com ela (com rebuild em
ambos os sentidos); o gate está verde; o axe não encontra uma única violação com a paleta aberta.
Nada foi corrigido por mim.

Prova em `relatorios/.qa-t21/` (`paleta.log`, `paleta-final.log`, `axe-paleta.log`,
`erro-sem-fix.log`, `spec-sem-fix.log`, `spec-com-fix.log`, `build*.log`).

---

## 1. Gate (tudo exit 0)

```
$ pnpm format:check
Checking formatting...
All matched files use Prettier code style!                     EXIT=0

$ pnpm lint --force
 Tasks:    4 successful, 4 total
Cached:    0 cached, 4 total                                   EXIT=0

$ pnpm typecheck --force
 Tasks:    4 successful, 4 total
Cached:    0 cached, 4 total                                   EXIT=0

$ pnpm test --force
@repo/shared:test:  Test Files  28 passed (28)
@repo/shared:test:       Tests  522 passed (522)               EXIT=0

$ rm -rf apps/web/.next && pnpm build
 Tasks:    2 successful, 2 total
Cached:    0 cached, 2 total                                   EXIT=0
```

`lint`/`typecheck`/`test`/`build` forçados (`--force`), sem cache. `next build` reescreveu
`apps/web/next-env.d.ts`; reposto com `git checkout --`, diff vazio em todas as rondas.

## 2. A paleta, no browser, com o build de produção

Servidor: `rm -rf apps/web/.next && pnpm build` + `nohup pnpm --filter @repo/web start`. Matei
primeiro qualquer `next start` antigo (havia um, PID 33004, de ronda anterior — `next start` novo
confirmado por `curl /api/health` = `200` depois de cada build).

Script meu (`relatorios/.qa-t21/paleta.mjs`), sessão criada pelas rotas de autenticação a sério,
`pageerror` e `console.error` recolhidos **desde o início**, antes de abrir a paleta:

```
PASS  entrei em / com h1 «Painel»
PASS  Ctrl+K abriu: dialog=1 input=1 listbox=1 opcoes=14
PASS  os dois destinos estao na lista (["Painel","Transações","Contas","Contas a pagar/receber"]…)
PASS  sem erros ao abrir (erros=0)
PASS  «consolida» filtrou: 14 → 1 opcoes
PASS  a opcao «Consolidação» esta visivel depois do filtro (["Consolidação"])
PASS  clique na paleta → /consolidacao-contas · h1 «Consolidação de Contas»
PASS  «contas a pagar» filtrou: 14 → 1 opcoes
PASS  a opcao «Contas a pagar/receber» esta visivel depois do filtro (["Contas a pagar/receber"])
PASS  clique na paleta → /contas-pagar-receber · h1 «Contas a Pagar / Receber»
PASS  sem pageerror/console.error em todo o percurso (erros=0)
EXIT=0
```

Catorze opções no início — os 12 antigos mais os dois da T19 —, uma depois de filtrar, zero
`pageerror` e zero `console.error` em abrir, filtrar e navegar. Corrido **duas vezes** (antes e
depois da ida e volta do `command.tsx`), mesmo resultado: `paleta.log` e `paleta-final.log`.

## 3. O spec guarda mesmo o defeito?

Guardei a versão do Dev em `relatorios/.qa-t21/command.dev.tsx`, repus
`git checkout 2f84384 -- apps/web/src/components/ui/command.tsx` (ficou `{children}` cru, diff vazio
contra o commit), **reconstruí** (`rm -rf apps/web/.next && pnpm build`) e levantei **novo**
`next start`.

### Sem a correção — EXIT=1

```
Running 5 tests using 1 worker
[1/5] … a secção «Dia a dia» lista os destinos pela ordem acordada
[2/5] … clicar «Contas a pagar/receber» abre \/contas-pagar-receber$ com o título certo
[3/5] … clicar «Consolidação» abre \/consolidacao-contas$ com o título certo
[4/5] … paleta de comandos › «contas a pagar» filtra e abre \/contas-pagar-receber$
  1) Error: expect(locator).toBeVisible() failed
     Locator: getByRole('dialog')
     Expected: visible
     Error: element(s) not found
       > 138 | await expect(paleta).toBeVisible();
[5/5] … paleta de comandos › «consolida» filtra e abre \/consolidacao-contas$   (mesmo erro)
  2 failed
    … «contas a pagar» filtra e abre \/contas-pagar-receber$
    … «consolida» filtra e abre \/consolidacao-contas$
  3 passed (49.2s)
```

E a causa, medida por mim nesse mesmo build (script `erro-sem-fix.mjs`):

```
depois de Ctrl+K → dialogos=0 opcoes=0 erros novos=1
  pageerror: Cannot read properties of undefined (reading 'subscribe')
```

É o defeito original, não outra coisa. Os três testes da barra lateral continuam a passar — o spec
distingue bem o que é menu do que é paleta.

### Com a correção reposta — EXIT=0

`cp relatorios/.qa-t21/command.dev.tsx apps/web/src/components/ui/command.tsx` (`diff` com o
entregue → `IDENTICO`), novo `pnpm build`, novo `next start`:

```
[1/5] … a secção «Dia a dia» lista os destinos pela ordem acordada
[2/5] … clicar «Contas a pagar/receber» abre \/contas-pagar-receber$ com o título certo
[3/5] … clicar «Consolidação» abre \/consolidacao-contas$ com o título certo
[4/5] … paleta de comandos › «contas a pagar» filtra e abre \/contas-pagar-receber$
[5/5] … paleta de comandos › «consolida» filtra e abre \/consolidacao-contas$
  5 passed (8.9s)                                               EXIT=0
```

`git diff apps/web/src/components/ui/command.tsx` no fim:

```diff
-        {children}
+        {/*
+         * O `<Command>` é o que cria o contexto do `cmdk`. Sem ele, os
+         * `CommandInput`/`CommandList`/`CommandItem` que a paleta passa como
+         * filhos leem `undefined.subscribe` e a página rebenta ao abrir.
+         */}
+        <Command>{children}</Command>
```

`git diff --numstat` → `6 1 apps/web/src/components/ui/command.tsx`.

## 4. Acessibilidade da paleta (axe, agora que abre)

Script meu (`relatorios/.qa-t21/axe-paleta.mjs`) com o mesmo construtor e as mesmas etiquetas do
`e2e/80-acessibilidade.spec.ts` — `AxeBuilder … withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'])`
— aplicado a `/` com a paleta **fechada** e **aberta**, para separar o que já existia do que a paleta
traz:

```
--- Painel, paleta FECHADA: 0 violacao(oes) ---
--- Painel, paleta ABERTA (Ctrl+K): 0 violacao(oes) ---
novas por abrir a paleta: 0
criticas/serias com a paleta aberta: 0
```

Zero violações, zero novas. O diálogo tem nome acessível (o `aria-dialog-name`/`aria-required-children`
fazem parte das regras WCAG aplicadas e não dispararam), apesar de o `DialogHeader` continuar fora do
`DialogContent` — a ligação Radix `aria-labelledby` resolve. **Sem achados novos.**

Limite honesto: o axe prova o que é demonstrável por regra (nomes, papéis, contraste calculável,
`label` ligado). Não prova ordem de foco, nem se o foco fica preso no diálogo — não testei isso com
teclado além do `Ctrl+K` + escrever + clicar, e não o dou por verificado.

## 5. Âmbito

```
$ git status --short
 M .prettierignore
 M README.md
 M apps/web/src/components/ui/command.tsx
 M apps/web/src/lib/nav.ts
 M docs/gestao/MAPA.md
 M docs/gestao/TASKS.md
 M docs/plano/ESTADO-E-HANDOFF.md
?? apps/web/AGENTS.md
?? e2e/15-navegacao.spec.ts
?? relatorios/.qa-t19/
?? relatorios/.qa-t20/
?? relatorios/.qa-t21/
?? relatorios/T19.md  T19-qa.md  T20.md  T20-qa.md  T21.md  T21-qa.md

$ git diff --numstat
1  0   .prettierignore
16 10  README.md
6  1   apps/web/src/components/ui/command.tsx   ← T21
18 1   apps/web/src/lib/nav.ts                   ← T19
30 0   docs/gestao/MAPA.md                       ← Lead
131 1  docs/gestao/TASKS.md                      ← Lead
30 18  docs/plano/ESTADO-E-HANDOFF.md
```

- **Código de produção da T21:** só `apps/web/src/components/ui/command.tsx` (+6/−1: uma linha de
  código, `<Command>{children}</Command>`, e cinco de comentário). O outro ficheiro da tarefa é o
  spec `e2e/15-navegacao.spec.ts` (untracked, com o bloco da paleta).
- `nav.ts` (18/1) é da T19 e está igual ao que o QA da T19 aprovou.
- `README.md`, `ESTADO-E-HANDOFF.md` e `.prettierignore` são da T20 e **não** foram tocados nesta
  tarefa: o `.prettierignore` continua com uma só linha nova (`+relatorios/.qa-*/`), e o README
  mantém a frase já corrigida («sete falharam e uma foi cancelada por ser duplicada», linha 122);
  os hunks são os mesmos dois de antes (README `@@ -5,6` e `@@ -115,4`; handoff `@@ -14,15` e
  `@@ -31,3`, ambos no §0).
- `MAPA.md` e `TASKS.md` são do Lead (30/0 e 131/1), como antes.
- `HEAD` = `2f84384`; sem commit nem push.

## Achados

Nenhum. A paleta abre, filtra, navega e não tem violações do axe; o spec é um guarda fiável do defeito
(falha com `getByRole('dialog')` inexistente sem a correção, passa com ela, e a causa medida é o
`subscribe` de sempre).

## O que não cobri

- **Foco no teclado dentro da paleta** (Tab/Shift+Tab, foco preso, Esc a fechar, devolução do foco ao
  botão «Ir para…»): só usei `Ctrl+K`, escrever e clicar. O axe não cobre isto.
- **Leitor de ecrã real** e contraste medido à mão — fora do axe.
- **Suite e2e completa** (24 percursos): corri só o `e2e/15-navegacao.spec.ts`, que é o da tarefa.
- **Build local de `2f84384` + T19 sem a T21**, além do usado no ponto 3 (mesmo assim medido).
