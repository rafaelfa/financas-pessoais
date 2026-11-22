# T97 — QA: as preferências de `/definicoes` gravam

Data: 2026-11-22 · Base `ae2deab` (T92) + T97 na árvore, sem commit · Build das medições:
`2_U6qsdBmeLS6IQUONIGP` (o do Dev); suite de frio: `oDBAKvcMoVUtaSLOA1dwX`.

**Veredicto: PASS** em (a)–(h). Sem escrita em `apps/` nem em `e2e/`; os meus dados de teste (dois
utilizadores QA, dois movimentos) foram apagados no fim.

---

## (a) Caminho feliz, com dados meus — PASS

Utilizador novo `qa-t97-…@exemplo.pt` (registo pela UI), dois movimentos lançados por mim (ganho de
500,00 € a 10/11 e gasto de 123,45 € a 19/11), e em `/definicoes` escolhi **Dia 21** + **Competência**
e cliquei «Guardar preferências». Aviso: «Preferências guardadas.».

Na base, a linha **deste** utilizador:

```
antes:   monthStartDay 1,  accountingBasis CASH,  currency EUR
depois:  monthStartDay 21, accountingBasis ACCRUAL, currency EUR
```

`currency` ficou `EUR`. **Repus no fim** (`Dia 1` + `Caixa`) e confirmei na base: `1 / CASH / EUR`
antes de apagar o utilizador QA.

## (b) A preferência chega ao motor — PASS (e o contrário)

Painel, cartões «Entradas do mês» / «Saídas do mês» (texto integral do KPI):

| `monthStartDay` | Entradas | Saídas | Sobra |
| --- | --- | --- | --- |
| **1** (antes) | **500,00 €** | **123,45 €** | +376,55 € |
| **21** (depois de gravar) | **0,00 €** | **0,00 €** | 0,00 € |
| **1** (de volta) | **500,00 €** | **123,45 €** | +376,55 € |

O período passou a 21/11–20/12 e os dois movimentos (10 e 19 de novembro) saíram dele — a acção está
ligada ao motor, não só à coluna. Voltando ao dia 1, os totais voltam exactamente ao que eram.
Capturas `painel-dia1.png`, `painel-dia21.png`, `painel-devolta.png`.

## (c) Validação — PASS (nenhum valor passa)

O formulário só oferece dias 1–28, por isso os inválidos foram enviados **directamente à server
action** (payload capturado do POST real: `next-action: 40f10c4d1c9f…`, corpo
`[{"monthStartDay":21,"accountingBasis":"CASH"}]`, `text/plain`), com a coluna lida antes e depois de
cada tentativa. Estava em `21 / CASH` e ficou sempre em `21 / CASH`:

| tentativa | resposta da acção | coluna mudou? |
| --- | --- | --- |
| `monthStartDay: 0` | «O mês começa entre o dia 1 e o dia 28.» | **não** |
| `monthStartDay: 29` | «O mês começa entre o dia 1 e o dia 28.» | **não** |
| `monthStartDay: 5.5` | «O dia tem de ser um número inteiro.» | **não** |
| `monthStartDay: "abc"` | «Escolhe o dia em que o mês começa.» | **não** |
| `monthStartDay: ""` | «O mês começa entre o dia 1 e o dia 28.» | **não** |
| `{}` (objecto vazio) | «Escolhe o dia em que o mês começa.» | **não** |
| `accountingBasis: "FOO"` | «Escolhe caixa ou competência.» | **não** |

**Erro visível na interface:** interceptei o POST do próprio formulário e troquei-lhe o corpo por
`[{"monthStartDay":29,…}]`; a linha `role="status"` mostrou «O mês começa entre o dia 1 e o dia 28.» e
a coluna não mudou. Captura `erro-visivel.png`.

## (d) Isolamento — PASS

Código: `savePreferences` faz `where: { id: user.id }` com o utilizador da **sessão** (`requireUser()`)
e o `input` só tem `monthStartDay` e `accountingBasis` — não há id de utilizador em lado nenhum do
payload.

Interface, duas sessões em paralelo (dois utilizadores QA): com **A** a gravar 21, a linha de **B**
ficou `1 / CASH`; A ficou `21 / CASH`. Ninguém escreve na linha do outro.

## (e) `currency` intocada — PASS

```
$ grep -rn "currency" apps/web/src/server/preferences-actions.ts apps/web/src/components/preferences-form.tsx
apps/web/src/server/preferences-actions.ts:15: * `User.currency` **não** se toca — é EUR por decisão de produto (D1). …
```

Uma única ocorrência, num comentário. O `data` do `update` tem só `monthStartDay` e `accountingBasis`.
Confirmado na base: `currency` foi `EUR` antes, durante e depois.

## (f) O formulário — PASS

- **Botão:** com o POST atrasado 2,5 s, apanhei o botão `disabled: true` com o rótulo «A guardar…»
  (captura `a-guardar.png`) e voltou a `false` no fim.
- **`role="status"`:** «Preferências guardadas.» após gravar; e a mensagem de erro no mesmo sítio
  quando falha (ver (c)). *Nota:* depois do `revalidatePath` a página volta a renderizar o formulário e
  a mensagem de sucesso dá lugar à dica neutra — aparece, mas não fica. O spec apanha-a a tempo; fica
  registado como nuance de UX, não como falha.
- **Teclado:** dois `role="radio"` (Caixa / Competência); `Tab` leva o foco de um ao outro e `Espaço`
  alterna (`aria-checked` passou de `[true,false]` para `[false,true]`). Não há setas nem *roving
  tabindex* (o padrão ARIA de radiogroup) — os dois são botões tabuláveis; funciona, mas é uma nota.
- **Contraste:** botão activo **6,29:1** (texto `245,254,253` sobre `0,106,102`). Desativado (opacidade
  0,5 sobre o cartão) ≈ **1,54:1**, abaixo de 4,5 — a WCAG isenta controlos desativados (1.4.3), e é o
  mesmo tratamento do resto da app.

## (g) Os specs e a limpeza — PASS

`e2e/92` (frase) e `e2e/97` (grava, recarrega, repõe) passam: corridos juntos → **2 passed (41.4s)**.

**A reposição do `afterAll` foi provada a sério:** corri o spec **97 real** com uma configuração sem
`globalTeardown` (para poder ler a linha antes de o utilizador ser apagado) e, depois do teste que
grava 21/ACCRUAL, a linha estava:

```
[{"email":"e2e-principal-…@exemplo.pt","dia":1,"basis":"CASH","currency":"EUR"}]
```

Ou seja: o `afterAll` repôs `1 / CASH`. Apaguei esse utilizador de teste a seguir (0 restantes) e os
meus (`qa-t97%`, 2 apagados; 0 movimentos `T97 QA%`).

Contagem: `chromium` **134**, `telemovel` 9, `escuro` 5, `estreito` 1 → **149**.

```
$ rm -rf apps/web/.next && env -u E2E_REUSE_SERVER pnpm test:e2e
[e2e] limpeza: 4 utilizador(es) de teste apagado(s); 0 restante(s).
  149 passed (8.7m)
SUITE_EXIT=0     BUILD_ID oDBAKvcMoVUtaSLOA1dwX
```

## (h) Gate — PASS

`pnpm format:check && pnpm lint && pnpm typecheck` → `GATE_EXIT=0`, «All matched files use Prettier
code style!», 4 tarefas ok em lint e typecheck.

## Limpeza e ambiente

Dois utilizadores QA criados por mim (A com dois movimentos, B vazio), apagados no fim — **0**
`qa-t97%`, **0** `e2e-%`, **0** movimentos `T97 QA%`. A demo não foi usada. Zero escrita em `apps/` e
`e2e/`, zero git. `AGENTS.md` e `next-env.d.ts` já vinham sujos — não fui eu. Porta 3000 **fechada**.
Um login falhou por timeout numa tentativa e passou à seguinte.

## Ficheiros desta volta

`relatorios/T97-qa.md`; em `relatorios/T97-qa/`: `medicoes.json`, `painel.json`, `validacao.json`,
`form.json`, `acao-captura.json` e as capturas (`painel-{dia1,dia21,devolta}.png`,
`definicoes-{antes,depois,21}.png`, `formulario.png`, `a-guardar.png`, `erro-visivel.png`). Scripts,
probe e logs em `relatorios/.qa-t97/`.

---

# Volta 2 — o aviso que fica e as setas do regime

Data: 2026-11-22 · Mesma árvore; o Dev mexeu no formulário (`toast`, roving tabindex, setas) e no
spec. Build das medições: `6dG3MKOalBsfiMJwm29DN`; suite de frio: `7Z-xGO4LKmWEyAjPsmMFI`.

**Veredicto da volta 2: PASS.**

## (a) O aviso sobrevive à revalidação — PASS

Utilizador QA meu, «Dia 21» gravado pela interface, esperei o **POST completo** e olhei para o DOM
**3 s depois**:

```
toasts:   ["Preferências guardadas."]        ← ainda lá aos 3 s
combobox: "Dia 21"                            ← o formulário já com o valor novo
base:     monthStartDay 21, accountingBasis CASH, currency EUR
status:   "Ficam guardadas na tua conta e valem para o painel, os relatórios e a exportação."
```

O `toast` do `sonner` vive no `AppShell`, fora do segmento revalidado, e por isso não é desmontado.
Captura `toast-3s.png`.

## (b) Radiogroup por teclado — PASS

Comecei com **Caixa** focada e Carreguei nas setas; em cada passo, `aria-checked`/`tabindex`/foco:

| passo | Caixa | Competência |
| --- | --- | --- |
| início | **checked, tab 0, focado** | unchecked, tab −1 |
| `ArrowRight` | unchecked, tab −1 | **checked, tab 0, focado** |
| `ArrowRight` (circular) | **checked, tab 0, focado** | unchecked, tab −1 |
| `ArrowLeft` | unchecked, tab −1 | **checked, tab 0, focado** |
| `ArrowDown` | **checked, tab 0, focado** | unchecked, tab −1 |
| `ArrowUp` (circular) | unchecked, tab −1 | **checked, tab 0, focado** |

Avança e recua, dá a volta nos dois sentidos, e o **foco acompanha** sempre a opção activa. Captura
`setas.png`.

## (c) Nada regrediu — PASS

Com o id da acção do build novo (`401676e7…`), capturado de um POST real, repeti as validações com a
coluna lida antes e depois de cada uma (estava `21 / CASH` e ficou sempre `21 / CASH`):

| payload | erro devolvido | coluna mudou? |
| --- | --- | --- |
| `monthStartDay: 0` | «O mês começa entre o dia 1 e o dia 28.» | **não** |
| `monthStartDay: 29` | «O mês começa entre o dia 1 e o dia 28.» | **não** |
| `monthStartDay: 5.5` | «O dia tem de ser um número inteiro.» | **não** |
| `monthStartDay: "abc"` | «Escolhe o dia em que o mês começa.» | **não** |
| `accountingBasis: "FOO"` | «Escolhe caixa ou competência.» | **não** |

Repus pela interface e li a base antes de apagar o utilizador: **1 / CASH / EUR**. `currency` esteve
`EUR` em todos os passos.

## (d) A asserção das setas morde — PASS

Cópia do spec 97 real em `relatorios/.qa-t97b/probe/`, com duas mutações em memória antes do teste:
`stopPropagation` do `ArrowRight` na fase de captura (para o React não o ver) e `tabindex` removido
dos dois radios. Resultado:

```
  x  1 …sem-setas.spec.ts:34:7 › T97 — guardar as preferências › muda o dia e o regime, guarda e sobrevive ao recarregar
    Error: expect(locator).toHaveAttribute(expected) failed
    Expected: "true"
    Received: "false"
        43 × locator resolved to <button role="radio" … aria-checked="false" …>
  1 failed
```

Sem a mutação, o spec do projeto passa (está na suite).

## (e) Contagem e suite — PASS

Não aceitei a baseline sem correr: apesar de só terem mudado o componente e o spec, **`e2e/80`
(acessibilidade com axe) e `e2e/16` (largura) observam `/definicoes`**, e o formulário ganhou um
`radiogroup` novo — um teste que olha para o ecrã não fica coberto por «só mudou o componente».
Corri a suite completa de frio:

```
$ rm -rf apps/web/.next && env -u E2E_REUSE_SERVER pnpm test:e2e
[e2e] limpeza: 4 utilizador(es) de teste apagado(s); 0 restante(s).
  149 passed (8.7m)
SUITE_EXIT=0     BUILD_ID 7Z-xGO4LKmWEyAjPsmMFI
```

**149**, a mesma contagem; nenhum teste antigo mudou de resultado (o axe de `/definicoes` continua sem
violações críticas). Gate: `format:check` 0, `lint` 0, `typecheck` 0.

## Limpeza

Um utilizador QA (`qa-t97b-…`), reposto a 1/CASH/EUR antes de apagar → **0** `qa-t97b%`, **0**
`e2e-%`. Demo intocada, zero escrita em `apps/`/`e2e/`, zero git, porta 3000 **fechada**.

## Ficheiros desta volta

`relatorios/.qa-t97b/` (`medir.cjs`, `validacao.cjs`, `repor.cjs`, `probe/`, `medir.log`,
`probe.log`, `gate.log`, `suite.log`); capturas `toast-3s.png`, `setas.png` em `relatorios/T97-qa/`.

---

# Volta 3 — `z.coerce` fora, cast fora, parágrafo sem cara de confirmação

Data: 2026-11-22 · Mesma árvore; o Dev mexeu na validação, no `cast`, no parágrafo e na lista de
revalidação. Build das medições: `YRbq8PlDthHrpWxORXKU8`; suite de frio: `EFeA1cvVjiR4afUB7Qzuz`.

**Veredicto da volta 3: PASS**, com um achado no caminho de erro (ver (c)).

## (a) Tipos errados, com a coluna posta a 5 — PASS

Utilizador QA novo; pus o dia a **5** pela interface (confirmado na base: `5 / CASH / EUR`) e ataquei a
Server Action com o id do build novo (`40427484…`), lendo a coluna **depois de cada** payload:

| payload `monthStartDay` | erro devolvido | coluna depois |
| --- | --- | --- |
| `true` | «Escolhe o dia em que o mês começa.» | **5 / CASH / EUR** |
| `["21"]` | «Escolhe o dia em que o mês começa.» | **5 / CASH / EUR** |
| `[21,22]` | «Escolhe o dia em que o mês começa.» | **5 / CASH / EUR** |
| `""` | «Escolhe o dia em que o mês começa.» | **5 / CASH / EUR** |
| `null` | «Escolhe o dia em que o mês começa.» | **5 / CASH / EUR** |
| `{}` | «Escolhe o dia em que o mês começa.» | **5 / CASH / EUR** |
| `"21abc"` | «Escolhe o dia em que o mês começa.» | **5 / CASH / EUR** |

Nenhum escreveu. **O contrário:** pela interface, `Dia 21` + `Competência` → base `21 / ACCRUAL / EUR`
e toast «Preferências guardadas.». Repus o dia 1 e a base ficou `1 / CASH / EUR` antes de apagar o
utilizador.

## (b) O cast saiu — PASS

```
$ grep -rn "as (typeof AccountingBasis" apps/web/src | wc -l
0
```

E o `grep` de (c) confirma que também não ficou outro cast disfarçado na acção:
`accountingBasis: parsed.data.accountingBasis`. `typecheck` exit **0**.

## (c) O parágrafo já não parece confirmação — PASS, e o erro não é alcançável pela interface

```
$ grep -c 'role="status"' apps/web/src/components/preferences-form.tsx    → 0
$ grep -c "CircleCheck" apps/web/src/components/preferences-form.tsx       → 0
$ grep -n 'role="alert"'  apps/web/src/components/preferences-form.tsx     → 209
```

O sucesso é um `toast`; o erro é um `<p role="alert">` (linha 209) que só existe quando `erro !== null`.
**É verdade que não se alcança pela interface:** o `Select` só oferece 1–28 e o regime só dois
botões, e o `erro` só é preenchido por `resultado.error` (validação) ou pelo `fail()` de escrita. Forçar
a validação pela UI é impossível; só adulterando o POST (como fiz na volta 1).

**Achado, ao tentar a única via restante:** abortei o POST (falha de transporte) e o formulário **não
mostra nada** — o `startTransition` não tem `catch`, e a consola regista
`TypeError: Failed to fetch`. Ou seja, uma falha de rede não dá mensagem ao utilizador; o `role="alert"`
só cobre erros que a acção devolve. Fica registado para o Dev decidir (um `try/catch` no cliente).

## (d) Lista de revalidação — PASS

```
$ grep -n "revalidatePath" apps/web/src/server/preferences-actions.ts
62:    revalidatePath(rota);
$ sed -n 60,63p … → for (const rota of ['/', '/patrimonio', '/orcamento', '/relatorios', '/definicoes'])
```

`/transacoes` saiu, e a cobertura confere com a leitura do código:

| rota | quem lê as colunas |
| --- | --- |
| `/` | `getDashboard` (`dashboard.ts:164,239,360`) e `getMonthClose` (`month-close.ts:100`) |
| `/patrimonio` | `getDashboard` (`page.tsx:26`) |
| `/orcamento` | `currentPeriod({ user })` → `packages/shared/.../budget-period.ts:53-75` (`user.monthStartDay`) |
| `/relatorios` | `reports.ts:147,175` |
| `/definicoes` | o próprio formulário |
| `/transacoes` | **não lê** (grep vazio) |
| `/calendario` | **não lê** (`calendar.ts` sem `monthStartDay`) |

Nenhum leitor ficou de fora.

## (e) Nada regrediu — PASS

- Toast **«Preferências guardadas.»** ainda no DOM aos 3 s.
- Setas: `ArrowRight`/`ArrowRight`/`ArrowLeft` alternam `aria-checked`/`tabindex` com o foco a
  acompanhar (Caixa ↔ Competência, circular).
- `where: { id: user.id }` mantém-se; `currency` = `EUR` em todas as leituras; base final `1/CASH`.

## (f) Contagem e suite — PASS (corri, não aceitei)

Não aceitei a baseline do Dev sem correr: o `e2e/92` assere esta página e o `e2e/80` (axe) observa
`/definicoes` — e a mudança troca um `role="status"` por um `FieldDescription` e um `role="alert"`,
coisas que um teste de ecrã vê. Suite completa de frio:

```
$ rm -rf apps/web/.next && env -u E2E_REUSE_SERVER pnpm test:e2e
[e2e] limpeza: 4 utilizador(es) de teste apagado(s); 0 restante(s).
  149 passed (8.8m)
SUITE_EXIT=0     BUILD_ID EFeA1cvVjiR4afUB7Qzuz
```

**149**, a mesma contagem; nenhum teste antigo mudou de resultado. Gate: `format:check` 0, `lint` 0,
`typecheck` 0.

## Limpeza

Um utilizador QA (`qa-t97c-…`), reposto a 1/CASH/EUR e apagado → **0** `qa-t97c%`, **0** `e2e-%`.
Demo intocada, zero escrita em `apps/`/`e2e/`, zero git, porta 3000 **fechada**.

## Ficheiros desta volta

`relatorios/.qa-t97c/` (`medir.cjs`, `erro.cjs`, `medicoes.json`, `medir.log`, `gate.log`,
`suite.log`, `final.png`, `erro-abort.png`).
