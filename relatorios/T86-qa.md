# T86 — QA: a transferência abre com a conta de destino preenchida

Data: 2026-11-22 · Base `3297aca` (T87) + T86 na árvore, sem commit · Builds das suites:
`4ZCqPHlt_0fWXUQ1rhuPB` (corrida 1) e `xDqnTDiNSZgfWa-xFeZ0O` (corrida 2).

**Veredicto: PASS no produto**, nas alíneas (a)–(e). **A spec entregue pelo Dev estava vermelha na
suite completa** — duas corridas, `2 failed / 143 passed / 1 did not run` — e foi corrigida por mim
(`e2e/` é minha). Depois da correção: **146 passed** em duas corridas de frio seguidas.

---

## O que se mediu (sessão própria, contas próprias)

Utilizador novo `qa-t86-…@exemplo.pt` (registo pela UI), três contas: `Carteira principal` (origem),
`T86 QA poupança` e `T86 QA terceira`. Medição com `relatorios/.qa-t86/medir.cjs`, valores lidos do
DOM e da base, contagem de POSTs na página. Saída bruta: `relatorios/.qa-t86/medicoes.json`.

### (a) Sem tocar no select, grava — PASS

| Viewport | Destino mostrado | POSTs | Aviso | Pernas na base |
| --- | --- | --- | --- | --- |
| 390×844 | `T86 QA poupança` | **1** | «Transferência registada nas duas contas.» | `+5000` em `T86 QA poupança`, `−5000` em `Carteira principal`, mesmo dia e grupo |
| 1440×900 | `T86 QA poupança` | **1** | idem | idem |

Capturas: `a-transferencia-390.png`, `a-transferencia-1440.png` (o campo «Para a conta» já com a
conta escrita). A conta mostrada é a **primeira ativa que não é a origem**, como o código derivado
diz (`activeAccounts.find(a => a.id !== accountId)`).

### (b) Escolher à mão grava a escolhida — PASS

Nos dois viewports: derivado `T86 QA poupança` → escolhido `T86 QA terceira`; as duas pernas ficaram
em `T86 QA terceira` (`+2500`) e `Carteira principal` (`−2500`), **não** na derivada. Capturas
`b-manual-390.png`, `b-manual-1440.png`.

### (c) Uma só conta ativa: vazio, desativado, zero pedidos — PASS

Arquivei `T86 QA poupança` e `T86 QA terceira` pela interface (`/contas` → menu → Arquivar).

| Medido no DOM | Valor |
| --- | --- |
| Texto do gatilho `#lancamento-destino` | `""` (vazio) |
| Botão | `Transferir` com `disabled: true` |
| Mensagem | «Para transferir precisas de duas contas ativas. Cria ou reativa outra em Contas.» |
| POSTs ao clicar (forçado) | **0** |
| Linhas na base com a descrição usada | **0** |

Captura `c-uma-conta-390.png`. Nada de padrão novo: o destino fica vazio e o formulário explica.

### (d) Gasto e Ganho inalterados — PASS

Nos dois viewports: Gasto `12,34` → `−1234` em `Carteira principal`, aviso «Gasto registado.»; Ganho
`99,99` → `+9999`, aviso «Ganho registado.».

### (e) Diff mínimo, sem `globals.css` nem `components/ui` — PASS

```
$ git diff --stat -- apps/
 apps/web/next-env.d.ts                            |  4 +--
 apps/web/src/components/transaction-quick-add.tsx | 19 +++++++++++---
 2 files changed, 17 insertions(+), 6 deletions(-)

$ git diff --name-only | grep -E "globals.css|components/ui"
(nada)
```

O `transaction-quick-add.tsx` mexe só no destino: `useState` fixo → `chosenToAccountId` + valor
derivado, e o `onValueChange`. `next-env.d.ts` é gerado pelo Next e já vinha alterado. Nenhuma folha
de estilo nem primitivo de UI tocado (T78 intocada).

---

## Os dois vermelhos que a suite apanhou (e a correção, em `e2e/`)

### 1. A spec entregue (86) falhava dentro da suite completa — defeito da spec, não do produto

Nas duas primeiras corridas completas:

```
 2 failed
 1 did not run
 143 passed (9.3m)

  2) › e2e\86-transferencia-destino.spec.ts:29 › … grava sem tocar no select
    Error: o destino abre com a segunda conta, sem escolha
    Expected: "T86 destino secundária"
    Received: "T74 destino mwro8b6f"
```

Causa: o utilizador do e2e é **partilhado** por todas as specs, e a spec 75 deixa lá a conta
`T74 destino …` ativa. A regra do produto é «a primeira conta ativa que não é a origem», portanto o
destino derivado era a conta do T74, não a que a spec 86 criou no `beforeAll`. Isolada passava
(1 passed) porque a única outra conta era a dela; na suite, não. Não é o produto a falhar — o
critério (a) pede «uma conta concreta e grava», e é isso que acontece — é a spec a fixar um nome que
o produto nunca prometeu.

Correção (minha, `e2e/`, sem enfraquecer): a spec lê do ecrã a **origem** e o **destino**, exige
destino não vazio e diferente da origem, e depois exige que as duas pernas da base fiquem
**exatamente nessas duas contas**, com `±5000` e o mesmo `transferGroupId`. Fica vermelha se o
destino vier vazio, se não gravar, ou se a action gravar noutra conta que não a mostrada — é mais
forte do que a versão anterior, não mais fraca.

Prova de que deixou de depender da ordem: `pnpm test:e2e e2e/75-… e2e/86-…` (a spec que deixa a
conta do T74 corre antes) → **7 passed**, com a conta do T74 presente.

### 2. A spec 84 (T84) partiu por causa do `Enter` — consequência real da correção

```
  1) › e2e\84-calendario-painel-dia.spec.ts:280 › uma transferência dá uma linha de 0,00 € …
    TimeoutError: locator.click: Timeout 20000ms exceeded.
    - waiting for getByRole('dialog').getByRole('button', { name: 'Transferir', exact: true })
      295 |     await escolherNoSelect(d.getByLabel('Para a conta', …), `${PREFIXO} poupança`);
    > 297 |     await d.getByRole('button', { name: 'Transferir', exact: true }).click();
```

Causa, lida no componente (`onFormKeyDown`, `transaction-quick-add.tsx:269-285`): **`Enter` em
qualquer campo submete o formulário**. Até à T86 esse `Enter` era inofensivo no modo Transferência
porque o destino vinha vazio e a validação de cliente travava; agora o destino é válido e o `Enter`
submeteu a transferência **antes** de a spec preencher a descrição e o destino, devolvendo o diálogo
ao estado do dia — o `click` seguinte já não encontrava o botão.

É uma mudança de comportamento observável (não um defeito do critério, mas vale a pena saberes):
numa transferência, carregar `Enter` no valor **passa a lançar** o movimento, como nos outros modos.

Correção (minha, `e2e/`): na spec 84 o teste preenche valor, descrição e destino **antes** do `Enter`
e é o `Enter` que submete (saiu o `click` redundante). As asserções não mudaram: continua a exigir
uma linha «Transferência» a 0,00 € em «Já liquidado», as duas pernas `±2500` no mesmo grupo e os
totais do mês iguais. `pnpm test:e2e e2e/84-… e2e/86-…` → **8 passed**.

---

## As duas corridas completas, de frio (finais)

Comando: `rm -rf apps/web/.next` e `env -u E2E_REUSE_SERVER pnpm test:e2e --reporter=line`, em série,
porta 3000 fechada no arranque. Logs: `suite-1.log`, `suite-2.log`.

| Corrida | Testes | Resultado | BUILD_ID | Limpeza | Exit |
| --- | --- | --- | --- | --- | --- |
| 1 | 146 | **146 passed (8.8m)** | `4ZCqPHlt_0fWXUQ1rhuPB` | `4 utilizador(es) … 0 restante(s)` | 0 |
| 2 | 146 | **146 passed (8.7m)** | `xDqnTDiNSZgfWa-xFeZ0O` | `4 utilizador(es) … 0 restante(s)` | 0 |

**Baseline nova: 146** (145 + o teste da T86), igual nas duas. A spec 86 correu verde nas duas
(`[131/146]`, `86-…spec.ts:48`) e a spec 84 também (`[130/146]`, `84-…spec.ts:326`). Sem flake de
infra.

As duas corridas falhadas ficam registadas em `suite-1-falhou.log`, `suite-2-falhou.log`,
`suite-1-falhou2.log`, `suite-2-falhou2.log` — as primeiras com 86 vermelha, as segundas com 84 e 86.

## Limpeza

- Medição: utilizador `qa-t86-…` apagado por SQL (cascata) → **0** `qa-t86-%` restantes, **0**
  movimentos `T86 QA%`/`T86 destino%`. Nada da demo tocado (a demo não foi usada nesta tarefa).
- Depois das suites: **0** utilizadores `e2e-%`. Porta 3000 **fechada**.
- Zero git. `apps/` só com a alteração do Dev; `AGENTS.md`, `next-env.d.ts` e `TASKS.md` já vinham
  modificados — não fui eu.

## O que não medi

- Colisão de contas em simultâneo (duas abas no mesmo formulário) e 320 px.
- A spec 86 não cobre (c); a alínea (c) está medida à mão (acima) e não ficou como teste permanente.

## Ficheiros desta volta

`relatorios/T86-qa.md`, `e2e/86-transferencia-destino.spec.ts` (corrigido), `e2e/84-calendario-painel-dia.spec.ts`
(sequência do `Enter`). Em `relatorios/.qa-t86/`: `medir.cjs`, `medicoes.json`, `medir.log`,
`a-transferencia-{390,1440}.png`, `b-manual-{390,1440}.png`, `c-uma-conta-390.png`,
`duas-corridas.sh`, `runner*.log`, `suite-{1,2}.log`, `suite-*-falhou*.log`, `spec86-1.log`,
`par-84-86.log`, `spec86-par.spec75.log`, `fim.txt`, `build.log`, `servidor.log`.
