# T92 — QA: a frase de `/definicoes` que prometia um botão inexistente

Data: 2026-11-22 · Base `2f27d94` (T91) + T92 na árvore, sem commit · Build das medições:
`gTJn10ha8Mg_oNCh-Tu8E`; suite de frio: `42Eq9MxS7j5bPQlQXPD_fP`.

**Veredicto: PASS** nas alíneas. Mas a alínea (c) encontrou um problema que o Dev não viu: **a frase
que está logo acima da nova continua a prometer a preferência que não existe** (ver (c)).

---

## (a) Não há persistência de definições — PASS, com uma precisão

```
$ grep -nE "action=|<form|use client|useState|onValueChange|onChange" "apps/web/src/app/(app)/definicoes/page.tsx"
  (nenhum)
$ grep -n "@/server" "apps/web/src/app/(app)/definicoes/page.tsx"
  (nenhum)
$ grep -c "^model " packages/db/prisma/schema.prisma
25
$ grep -nE "^model .*(Preference|Setting|Config)" packages/db/prisma/schema.prisma
  (nenhum)
$ grep -rnE "updatePreference|savePreference|upsertPreference|setPreference" apps/web/src
  (nenhum)
```

A página é um componente de servidor sem tratadores, não importa `@/server/*`, e não há modelo de
preferências. As únicas ocorrências de «preference» são a **preferência de privacidade**
(`lib/privacy-preference`, cookie + `localStorage`), que não é isto.

**Precisão que o relatório não faz:** o `model User` **tem** as colunas `currency`, `monthStartDay` e
`accountingBasis` (`schema.prisma:93-98`), e o motor lê-as (`dashboard.ts:164,239,360`). O que não
existe é **quem as escreva**: os únicos `user.update` são `primaryAccountId` (`accounts-actions.ts:95,
166,201`) e o provisionamento (`provision.ts:75`) — nenhum toca nas três. Ou seja: «não há
persistência» é verdade **na interface** (nada grava), mas há armazenamento à espera; a frase nova
(«Ainda não há preferências guardadas») continua verdadeira e não muda nada.

## (b) A frase antiga saiu, a nova está lá — PASS

`/definicoes` a 1440 e 390 × claro e escuro:

| caso | `/fica disponível quando/i` | `/Estes valores são fixos nesta versão/i` |
| --- | --- | --- |
| 1440 claro | **0** | **1** |
| 1440 escuro | **0** | **1** |
| 390 claro | **0** | **1** |
| 390 escuro | **0** | **1** |

Texto visível: «Estes valores são fixos nesta versão: euro e mês a começar no dia 1. Ainda não há
preferências guardadas.» Capturas `definicoes-{1440,390}-{light,dark}.png`.

## (c) A frase nova é verdadeira — mas a página continua a prometer o mesmo, uma frase acima

A frase nova corresponde ao estado real: euro fixo, mês no dia 1, nada guardado.

**Achado:** o cartão «Período mensal», imediatamente acima, diz:

> «Se recebes a meio do mês, **podes começar o teu mês nesse dia**. Todos os totais e orçamentos
> passam a seguir esse calendário.»

e mostra um `Select` **activo** (um `button` Radix, sem `disabled` nem `aria-disabled`) com «Dia 1»,
que abre e deixa escolher Dia 5/10/15/20/25 sem gravar nada. A frase nova diz «mês a começar no dia 1»
e a de cima convida a mudá-lo: **a página contradiz-se a si própria**, e a promessa que a T92 queria
matar continua lá, noutra frase. O `Select` morto é a T97 (o Lead já a abriu); a **descrição do
cartão** não está em nenhuma das duas.

Restantes textos, verificados:
- «Moeda — Os valores são guardados em cêntimos inteiros e apresentados em euros»: é sobre
  **armazenamento de dinheiro**, e é verdade (cêntimos inteiros, `formatCurrency`). Não promete
  preferências.
- «Regime de contabilização — Podes ver os dois no painel»: verdade (o Painel mostra competência e
  caixa); «os orçamentos usam competência» bate com o `basis` passado ao motor.

## (d) O spec novo morde — PASS

Repus a frase antiga **em memória** (cópia do spec em `relatorios/.qa-t92/probe/`, com um `<p>` com o
texto antigo acrescentado ao DOM antes das asserções — equivalente a reverter o `page.tsx`):

```
  x  1 …frase-antiga.spec.ts:15:7 › T92 — a frase de Definições › não promete guardar preferências que não existem
    Error: expect(locator).toHaveCount(expected) failed
    Expected: 0
    Received: 1
  1 failed
EXIT=1
```

Sem mutação, o spec do projeto passa (está na suite, 148).

## (e) Contagem e suite — PASS

| projeto | testes |
| --- | --- |
| `chromium` | **133** (o `92` incluído, 1 vez) |
| `telemovel` | 9 |
| `escuro` | 5 |
| `estreito` | 1 |
| **total** | **148** |

```
$ rm -rf apps/web/.next && env -u E2E_REUSE_SERVER pnpm test:e2e
[e2e] limpeza: 4 utilizador(es) de teste apagado(s); 0 restante(s).
  148 passed (8.7m)
SUITE_EXIT=0     BUILD_ID 42Eq9MxS7j5bPQlQXPD_fP
```

## (f) Gate — PASS

`pnpm format:check && pnpm lint && pnpm typecheck` → `GATE_EXIT=0`, «All matched files use Prettier
code style!», 4 tarefas ok em lint e typecheck.

## O que fica para o Lead decidir

O achado do (c) é a mesma classe de defeito que a T92 veio corrigir, uma frase acima. Duas saídas
baratas: incluir a descrição do «Período mensal» na T97 (que já trata do `Select` morto), ou abrir
tarefa nova para a reescrever («Nesta versão o mês começa sempre no dia 1»). Não é FAIL da T92 — o
critério era a frase e a ausência de persistência, e ambas estão certas.

## Limpeza e ambiente

Sessão **demo** só para leitura; nenhum dado criado ou apagado. Depois da suite: **0** utilizadores
`e2e-%`. Zero escrita em `apps/` e `e2e/`, zero git. `AGENTS.md` e `next-env.d.ts` já vinham sujos —
não fui eu. Porta 3000 **fechada**.

## Ficheiros desta volta

`relatorios/T92-qa.md`; em `relatorios/T92-qa/`: `definicoes-{1440,390}-{light,dark}.png`,
`medicoes.json`. Scripts, probe e logs em `relatorios/.qa-t92/` (`medir.cjs`, `probe/`, `probe.log`,
`gate.log`, `suite.log`).
