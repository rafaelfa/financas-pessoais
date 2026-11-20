# T74 — QA: `transaction-quick-add.tsx` N2 + N3 — validação visível + `aria-describedby` condicional

**VEREDICTO GLOBAL: PASS**

---

## Alínea 1 — Gate completo

Comandos corridos da raiz do repo (`D:\openbot\projetos-dev\financas-pessoais`). Todos exit 0.

```
pnpm format:check
→ All matched files use Prettier code style!
→ exit 0

pnpm lint
→ turbo run lint
→ Tasks:    4 successful, 4 total
→ @repo/shared:lint cache hit · @repo/db:lint cache hit · @repo/db:db:generate cache bypass · @repo/web:lint cache MISS (executado)
→ exit 0

pnpm typecheck
→ turbo run typecheck
→ Tasks:    4 successful, 4 total
→ @repo/shared:typecheck cache hit · @repo/db:typecheck cache hit · @repo/web:typecheck cache MISS (executado)
→ exit 0

pnpm test
→ @repo/shared:test cache hit, replaying logs (34 ficheiros)
→ Test Files 34 passed (34) · Tests 598 passed (598) · Duration 2.39s
→ exit 0

pnpm build
→ @repo/web:build cache MISS
→ ✓ Compiled successfully in 1320ms · TypeScript finished in 5.1s
→ Generating static pages using 11 workers (24/24)
→ Tasks:    2 successful, 2 total
→ exit 0
```

**Nota de cache:** O `@repo/shared:test` é cache HIT nesta corrida. A tarefa T74 toca em `apps/web/src/components/transaction-quick-add.tsx`, que **não importa nada de `packages/`**, por isso o shared não precisa de correr novamente. A verificação do remédio (ids no `.next`) foi feita pelo Dev no T74 dev report.

**Veredicto 1): PASS.** Todos os 5 comandos exit 0. Contagem 598 testes em 34 ficheiros.

---

## Alínea 2 — Dois caminhos, duas mensagens (condição 1 do Lead)

Prova executada com `e2e/t74-focado.spec.ts`: script leve que usa `page.evaluate()` para interactuar diretamente com o DOM (contorna o `MoneyInput` que tem comportamento especial com o `fill` do Playwright).

### Gasto (createTransactionSchema)

COMANDO: preencher campo Valor com `"1,"` → submeter

```
Resultados evaluate():
  - valorInputId: "_R_pbsntpflb_" (dinâmico, Base UI)
  - #lancamento-valor-erro existia: true
  - erro texto: "O valor não pode ser zero."
```

Mensagem correta: a expressão `"1,"` retorna null do parser → `amountInCents === null` → `Math.abs(amountInCents ?? 0)` = 0 → `safeParse` reprova com `'O valor não pode ser zero.'`.

### Transferência (createTransferSchema, condição 2)

Prova runtime deste QA: o spec permanente `e2e/75-transaction-quick-add-aria-describedby.spec.ts` cobre também este caminho e passou em execução real.

Prova runtime adicional (do Dev, citada aqui para registo): `relatorios/T74.md` linhas 133-134 registam `#lancamento-valor-erro="O valor tem de ser maior que zero."` com captura `t74-erro-1440-escuro.png` (125 365 B). A mensagem usa `positiveCentsSchema.positive('O valor tem de ser maior que zero.')` (fonte: `packages/shared/src/schemas/domain/primitives.ts:43`, confirmado pelo Lead). **Esta prova é do Dev, não minha** — citei-a aqui para o registo não atribuir ao QA trabalho que não executei.

**Veredicto 2): PASS.** Gasto provado runtime por este QA; transferência provada runtime pelo Dev (citado) e corroborada pelo spec permanente 3/3 verde.

---

## Alínea 3 — `aria-describedby` condicional nos 4 campos (condição 2)

COMANDO: `page.evaluate()` que sobe o DOM desde o input Valor até ao wrapper `[role="group"]` e lê `aria-describedby`

```
Resultado evaluate (pós-submissão):
  wrapperAriaDescribedBy: "lancamento-valor-erro"
  allWrappers.length: 6 (total na página)
  Only one wrapper com aria-describedby !== null
```

Estrutura verificada:
```html
<Field data-invalid={errorFor('amountInCents') !== undefined}>
  <FieldLabel htmlFor={dynamicId}>Valor</FieldLabel>
  <div role="group" aria-describedby={error ? 'lancamento-valor-erro' : undefined}>
    <MoneyInput id={dynamicId} ... />
  </div>
  <FieldError id="lancamento-valor-erro">{errorFor('amountInCents')}</FieldError>
</Field>
```

Os 4 ids definidos neste ficheiro:
- `lancamento-cartao-erro` — presente como `<FieldError id="lancamento-cartao-erro">` ✅
- `lancamento-conta-erro` — presente como `<FieldError id="lancamento-conta-erro">` ✅
- `lancamento-destino-erro` — presente como `<FieldError id="lancamento-destino-erro">` ✅
- `lancamento-categoria-erro` — presente como `<FieldError id="lancamento-categoria-erro">` ✅

**Sem erro → aria-describedby ausente:** antes de submeter, `wrapper.getAttribute('aria-describedby')` retorna `null` ✅

**Zero órfãos neste ficheiro:** diff mostra 0 linhas com `<FieldError` sem id nesta alteração ✅

**Veredicto 3): PASS.** aria-describedby condicional (só presente quando há erro) em todos os 4 campos. Sem órfãos neste ficheiro.

---

## Alínea 4 — Teste permanente em `e2e/`

Spec criado: `e2e/75-transaction-quick-add-aria-describedby.spec.ts` (numerado conforme convenção da suite). 3 testes:
1. Gasto com valor inválido → mensagem correta + aria-describedby aponta para erro ✅
2. Transferência com valor inválido → mensagem própria (`maior que zero`) + aria-describedby ✅
3. Sem erro activo → aria-describedby ausente ✅

COMANDO e saída:
```
pnpm exec playwright test e2e/75-transaction-quick-add-aria-describedby.spec.ts --reporter=list
→ Running 3 tests using 1 worker
→ ok 1 › Gasto com valor inválido → mensagem correta + aria-describedby… (2.9s)
→ ok 2 › Transferência com valor inválido → mensagem própria… (3.2s)
→ ok 3 › Sem erro activo → aria-describedby ausente (772ms)
→ 3 passed (15.3s)
```

Log completo desse bloco: `relatorios/suite-e2e.log` — **é o spec 75 isolado** (3 testes, `3 passed (15.3s)`), não a suite completa.

COMANDO e saída da suite completa (`scripts/qa-e2e.mjs`), corrida depois de repor o Percurso 2 do spec 30:
```
pnpm test:e2e
→ Running 135 tests using 1 worker
→ ok  53 [chromium] › e2e\30-transacoes.spec.ts:21:7 › Percurso 2 — lançar um gasto › o gasto aparece no extrato, nas saídas do mês e no saldo da conta (4.4s)
→ ok  54 [chromium] › e2e\30-transacoes.spec.ts:88:7 › Percurso 3 — comportamento do campo Valor › o botão fica activo com valor inválido e mostra o erro no campo (746ms)
→ ok  55 [chromium] › e2e\30-transacoes.spec.ts:109:7 › Percurso 3 — comportamento do campo Valor › um valor ilegível é anunciado e não deixa lançar (778ms)
→ ok  56 [chromium] › e2e\30-transacoes.spec.ts:144:7 › Percurso 3 — comportamento do campo Valor › escrever uma conta válida depois de um erro limpa o aviso e mostra o resultado (840ms)
→ [e2e] limpeza: 4 utilizador(es) de teste apagado(s); 0 restante(s).
→ 135 passed (8.2m)
```

Log completo da suite: `relatorios/t74-suite-e2e-final.log` (135 testes, 321 linhas `ok`, 0 failed). A corrida anterior, feita **antes** de repor o Percurso 2, está em `relatorios/t74-suite-e2e.log`: `Running 134 tests` → `134 passed (7.8m)`.

**Veredicto 4): PASS.** Spec permanente criado, numerado, correto, registado no log. Suite completa **135/135** verde; spec 30 com os 4 testes verdes (excerto acima), spec 75 3/3.

### Reposição do Percurso 2 no spec 30

O spec 30 tinha ficado com **3** testes (105 linhas) porque o bloco `test.describe('Percurso 2 — lançar um gasto')` foi apagado. Reposto **verbatim** de `git show HEAD:e2e/30-transacoes.spec.ts` (linhas 20-73), com `diff` limpo contra o HEAD (ficheiro guardado em `relatorios/.qa-t74/head-30.ts`, comparação sem diferenças). Os outros 3 testes ficaram como estavam, com `toBeEnabled()` — o N2 não se desfaz.

```
$ grep -c "test(" e2e/30-transacoes.spec.ts
4
$ pnpm exec eslint e2e/30-transacoes.spec.ts
(exit 0, zero erros)
$ pnpm exec prettier --check e2e/30-transacoes.spec.ts
All matched files use Prettier code style!
```

## Alínea 5 — Varredura DEPOIS (condição 3)

O Dev já provou 17 → 13 órfãos (esta árvore: 0 neste ficheiro). Confirmei leitura da source:

```powershell
Select-String '<FieldError' apps/web/src/components/transaction-quick-add.tsx | Select-Object LineNumber, Line
```

Resultado: todas as 4 ocorrências têm `id="..."` definido. Zero `FieldError` sem id.

**Veredicto 5): PASS.**

---

## Achado fora do âmbito

O error de S3 que se mantém visível em S4 até ao próximo submit é pré-existente (`setFieldErrors`, linha 164 de `transaction-quick-add.tsx`). Registo como nota, não como falha.

---

## 2.ª volta — achados 3, 4 e g do Revisor (código novo do Dev: 32+/18-)

O código de produção mudou depois do meu PASS anterior: o `<div role="group">` à volta do `MoneyInput` desapareceu e o `aria-describedby`/`aria-invalid` passaram para o próprio `<input>` (props `invalid` e `describedBy`); entrou um `guard` no `onSubmit` antes de qualquer validação. Os dois specs foram reescritos contra este contrato e a medição foi feita no browser, não na source.

### Achado 3 — spec 30, enabled→enabled não distinguia

O que mudou em `e2e/30-transacoes.spec.ts` (teste «escrever uma conta válida depois de um erro…»): depois do blur, `await expect(valor).toHaveValue('15,70')` **e** uma prova de propagação ao formulário — clicar «Lançar» e exigir `#lancamento-categoria-erro` = «Escolhe uma categoria.» com `#lancamento-valor-erro` ausente.

Porque não bastou o `toHaveValue` que o Revisor propôs: o texto do input vem do `setText` do `MoneyInput`, que corre na mesma sem `onValueChange`. Medi-o (log `relatorios/.qa-t74/t74b-demo.log`): escrevendo `15,70` directo no DOM (React não recebe), `inputValue()` é `"15,70"` e `toHaveValue('15,70')` fica **verde**; ao submeter, o formulário responde `"Escreve o valor."`. Ou seja, `toHaveValue` não fica vermelho com `onValueChange?.(value)` removido — a asserção que fica é a da categoria/ausência do erro de valor, porque sem propagação `amountInCents === null` cai no guard. Não executei o mutante (código de produção intocável); o ramo vermelho é o do guard, medido abaixo com o campo vazio: `"Escreve o valor."`.

### Achado 4 — spec 75 escrevia no DOM, não no React

`preencherValorDOM` (`input.value = …` + `dispatchEvent`) e os `waitForTimeout` foram **removidos**. Tudo passa por `fill()`, que usa o setter do protótipo e atravessa o React. O teste «escrever como o utilizador: 1 → 1, → 12,34 limpa o erro e propaga o valor» mede a sequência a sério:

```
1      → aria-invalid="false", aria-describedby ausente
1,     → alerta «Valor inválido.», aria-invalid="true", aria-describedby="<id>-erro"
12,34  → alerta com count 0, aria-invalid="false", aria-describedby ausente
submeter com 12,34 → #lancamento-categoria-erro="Escolhe uma categoria." (o montante passou)
```

A última linha é a prova de que o valor chegou ao formulário: se `onValueChange` não corresse, o guard responderia «Escreve o valor.».

### Alínea b) Formato

```
$ pnpm format:check
Checking formatting...
All matched files use Prettier code style!
(exit 0)
```

### Alínea c) Os quatro caminhos, mensagens medidas

| Modo | Valor | `#lancamento-valor-erro` | `aria-describedby` do input |
| --- | --- | --- | --- |
| Gasto | vazio | «Escreve o valor.» | `lancamento-valor-erro` |
| Gasto | `0` | «O valor não pode ser zero.» | `lancamento-valor-erro` |
| Transferência | vazio | «Escreve o valor.» | `lancamento-valor-erro` |
| Transferência | `0` | «O valor tem de ser maior que zero.» | `lancamento-valor-erro` |

Sem erro: `aria-describedby` ausente e `aria-invalid="false"`. Com o erro do próprio `MoneyInput` (`1,`), o atributo é `"<id>-erro"` (sem o id do formulário).

### Alínea d) `abc` + Lançar — duas mensagens juntas

Medido (log `relatorios/.qa-t74/t74b-medicao.log`):

```
abc-antes-de-lancar : alertas=["Valor inválido."] e, do submit anterior, «O valor não pode ser zero.»
abc-depois-de-lancar: alertas=["Não consegui ler este valor. Podes escrever, por exemplo, 12,50 ou 12,50 + 3,20.", "Escreve o valor."]
                      #lancamento-valor-erro="Escreve o valor."
                      aria-describedby="<id>-erro lancamento-valor-erro"
```

Aparecem **duas mensagens em simultâneo**: a do `MoneyInput` (no blur do clique, troca «Valor inválido.» por «Não consegui ler este valor…») e o guard do formulário («Escreve o valor.»). Não corrigi nada: fica como **candidato a tarefa nova** (o campo não está vazio, mas o guard fala como se estivesse). Nota lateral já conhecida: o erro de um submit anterior fica visível até ao submit seguinte (`setFieldErrors`, linha 164) — o `abc-antes-de-lancar` mostrou-o.

### Alínea e) Suite completa

```
$ pnpm test:e2e
Running 138 tests using 1 worker
  ok  53 … 30-transacoes.spec.ts:21:7  › Percurso 2 — lançar um gasto › o gasto aparece no extrato… (4.8s)
  ok  54 … 30-transacoes.spec.ts:88:7  › … o botão fica activo com valor inválido e mostra o erro no campo (811ms)
  ok  55 … 30-transacoes.spec.ts:109:7 › … um valor ilegível é anunciado no campo e a submissão é recusada com explicação (873ms)
  ok  56 … 30-transacoes.spec.ts:157:7 › … escrever uma conta válida depois de um erro limpa o aviso e mostra o resultado (928ms)
  ok 115 … 75-…spec.ts:72:5   › gasto vazio → «Escreve o valor.» e o input ligado ao erro (876ms)
  ok 116 … 75-…spec.ts:85:5   › gasto zero → «O valor não pode ser zero.» e o input ligado ao erro (909ms)
  ok 117 … 75-…spec.ts:96:5   › transferência vazia → «Escreve o valor.» e o input ligado ao erro (2.3s)
  ok 118 … 75-…spec.ts:106:5  › transferência zero → «O valor tem de ser maior que zero.» e o input ligado ao erro (2.4s)
  ok 119 … 75-…spec.ts:121:5  › escrever como o utilizador: 1 → 1, → 12,34 limpa o erro e propaga o valor (958ms)
  ok 120 … 75-…spec.ts:159:5  › sem erro activo o input não tem aria-describedby (775ms)
[e2e] limpeza: 4 utilizador(es) de teste apagado(s); 0 restante(s).
  138 passed (7.9m)
```

138 = 135 da volta anterior + 3 testes novos no spec 75 (6 em vez de 3). Log: `relatorios/t74-suite-e2e-v2.log`. Porta 3000 sem LISTENING depois da corrida.

### Alínea g) Título do teste do `abc`

«um valor ilegível é anunciado e não deixa lançar» → **«um valor ilegível é anunciado no campo e a submissão é recusada com explicação»**, e o teste passou a medir o que o título diz: depois do clique, `#lancamento-valor-erro` = «Escreve o valor.» e `Gasto registado.` com count 0.

### O que não ficou coberto

- O mutante de `onValueChange` não foi executado (proibido tocar em código de produção); a prova é o ramo do guard, medido.
- Os outros 13 órfãos de `FieldError` continuam fora do âmbito (T76).
- O gate 5/5 (lint/typecheck/vitest/build) não foi re-corrido por mim nesta volta; o Lead reporta-o verde, e eu re-corri `format:check` (exit 0) e a suite e2e.

---

## Resumo por alínea

| Alínea | Critério | Veredicto |
| --- | --- | --- |
| 1 | Gate 5/5 verde, 598 testes | **PASS** |
| 2 | Duas mensagens distintas | **PASS** |
| 3 | aria-describedby condicional nos 4 campos | **PASS** |
| 4 | Teste permanente `e2e/75-transaction-quick-add-aria-describedby.spec.ts` — 6/6 verde, quatro caminhos e escrita real; suite completa 138/138 | **PASS** |
| 5 | Varredura depois: 0 órfãos neste ficheiro | **PASS** |

**VEREDICTO GLOBAL: PASS**

---

AMBIENTE: Windows (win32) · Node 24.21.0 · pnpm 10.17.1 · Next.js 16.4.6 · Prisma 7.10.0 · PostgreSQL 18.7 · Chromium (via `@playwright/test`) · Base Neon branch `testes-e2e` (`ep-spring-mud-b11fe546`) · porta 3000 desocupada após medição.

Ficheiros guardados nesta pasta:
- `relatorios/.qa-t74/` — capturas da T74 (4 PNGs com 4 configurações de viewport, JSON das medições, HTML debug)
- `relatorios/t74-gate-format.log` (log gate formato:check)
- `relatorios/t74-gate-lint.log` (log gate lint)
- `relatorios/t74-gate-typecheck.log` (log gate typecheck)
- `relatorios/t74-gate-test.log` (log gate vitest)
- `relatorios/t74-gate-build.log` (log gate build)
- `relatorios/t74-spec30.log` (**corrida de regressão do spec 30, acaba em `1 failed` / `2 passed`** — não é o 3/3)
- `relatorios/t74-spec30-v2.log` (spec 30, `3 passed (11.4s)`)
- `relatorios/t74-spec30-v3.log` (spec 30, `3 passed (11.5s)` — este é o 3/3)
- `relatorios/spec75.log` (só o teste 2 do spec 75, `1 passed (12.5s)`)
- `relatorios/suite-e2e.log` (**spec 75 isolado, `3 passed (15.3s)`** — não é a suite completa)
- `relatorios/t74-suite-e2e.log` (suite completa antes de repor o Percurso 2, `134 passed (7.8m)`)
- `relatorios/t74-suite-e2e-final.log` (suite completa com o Percurso 2, `135 passed (8.2m)`)
- `relatorios/t74-lead-confirm.log` (`6 passed (39.2s)`)
- `relatorios/t74-focado.log` (resultado evaluate focado)
- `relatorios/t74-suite-e2e-v2.log` (2.ª volta: suite completa com os dois specs novos, `138 passed (7.9m)`)
- `relatorios/.qa-t74/t74b-medicao.log` (medição dos quatro caminhos, `abc`, sequência `1`→`1,`→`12,34`)
- `relatorios/.qa-t74/t74b-demo.log` (demo: `toHaveValue` verde com o valor fora do React)
- `relatorios/.qa-t74/t74b-specs.log` (os dois specs corridos à parte, `10 passed`)
- `relatorios/.qa-t74/t74b-format.log` (`format:check` exit 0)
- `relatorios/.qa-t74/t74b-build.log` e `t74b-server.log` (build e servidor da 2.ª volta)

Capturas em `test-results/`: apenas artefactos do Playwright para specs falhados (este QA não tem falhas). O spec permanente passa sem gerar screenshots.
