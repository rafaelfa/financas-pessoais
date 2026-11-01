# T23 — prova independente (QA): polimento visual

Data: 2026-11-01 · Windows 10.0.26300.9818 · Node v24.21.0 · pnpm 10.17.1
Repo: `D:\openbot\projetos-dev\financas-pessoais` · `HEAD` = `ca44dfd` (tudo por commitar)

**VEREDICTO: PASS no que a T23 mudou; um critério não cumprido à letra.**

- **Scroll: PASS.** 14/14 rotas a 1200 e a 1024 px, com dois conjuntos de dados diferentes: zero
  excesso em todos. Prova ao contrário feita com rebuild: sem o `min-w-0` o spec falha (1024,
  `/transacoes`, 101 px a mais) e com ele passa 28/28.
- **Contraste no escuro: PASS.** Texto sobre o cartão 14,18:1 e rótulos `muted` 5,82:1 (≥ 4,5). Tema
  claro **intacto** (fundo L\* 98,89, cartão L\* 100, contraste 17,35:1; `--card` do `:root` não
  mudou).
- **Hierarquia: PASS.** Painel: `h1` 30 px, património 36 px, os outros três 28 px. Orçamento 5 KPIs a
  28 px, Relatórios 5 a 28 px — o `prominent` não se espalhou.
- **pt-BR: NÃO é zero.** A minha varredura larga encontra **7 strings de produto visíveis** em pt-BR,
  não 1. Três já estavam registadas (T25); **quatro não estavam** (dois «ao salvar», «registrar o
  pagamento», «Aluguel» no placeholder). Nenhuma foi introduzida pela T23 — são todas anteriores —,
  mas o critério «zero pt-BR no texto de produto» não se verifica.
- Âmbito e regressão visual: limpos.

Logs e imagens em `relatorios/.qa-t23/`.

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

`next-env.d.ts` reescrito pelo build, reposto com `git checkout --` em todas as rondas (diff vazio).

## 2. Scroll horizontal — 14 rotas × 1200/1024

Servidor: `pnpm build` + `nohup pnpm --filter @repo/web start`, com o `next start` anterior morto
antes de cada medição (nesta ronda matei os PID 24164, 13324 e 33200 — havia sempre um velho na
porta 3000).

### Com a conta demo (dados a sério: 25 transações, 2 recorrências)

```
=== 1200 px ===
/                        scrollWidth=1200  innerWidth=1200 excesso=0  OK
/transacoes              scrollWidth=1200  innerWidth=1200 excesso=0  OK
/contas                  scrollWidth=1200  innerWidth=1200 excesso=0  OK
/contas-pagar-receber    scrollWidth=1200  innerWidth=1200 excesso=0  OK
/consolidacao-contas     scrollWidth=1200  innerWidth=1200 excesso=0  OK
/cartoes                 scrollWidth=1200  innerWidth=1200 excesso=0  OK
/orcamento               scrollWidth=1200  innerWidth=1200 excesso=0  OK
/objetivos               scrollWidth=1200  innerWidth=1200 excesso=0  OK
/recorrencias            scrollWidth=1200  innerWidth=1200 excesso=0  OK
/regras                  scrollWidth=1200  innerWidth=1200 excesso=0  OK
/categorias              scrollWidth=1200  innerWidth=1200 excesso=0  OK
/relatorios              scrollWidth=1200  innerWidth=1200 excesso=0  OK
/importar                scrollWidth=1200  innerWidth=1200 excesso=0  OK
/definicoes              scrollWidth=1200  innerWidth=1200 excesso=0  OK
RESUMO 1200px: 14 rotas medidas, 14 OK, 0 com excesso; pior excesso 0px (-)
RESUMO 1024px: 14 rotas medidas, 14 OK, 0 com excesso; pior excesso 0px (-)
```

A largura a sério existe e é o conteúdo que a cria, não a janela:

```
/transacoes      linhas=25  contentor: clientWidth=896  scrollWidth=1005  (+109 dentro da tabela)
/recorrencias    linhas=2   contentor: clientWidth=896  scrollWidth=990   (+94)
/cartoes         linhas=3   contentor: clientWidth=896  scrollWidth=896   (0)
```

### Com dados próprios (5 contas a pagar/receber com descrições longas + 3 lançamentos)

Conta nova criada pelas rotas de autenticação e pela interface, apagada no fim
(`limpeza: 1 utilizador(es) de QA apagado(s)`):

```
RESUMO 1200px: 14 medidas, 14 OK, 0 com excesso; pior 0px (-)
RESUMO 1024px: 14 medidas, 14 OK, 0 com excesso; pior 0px (-)
```

**Total: 14 rotas × 2 larguras × 2 conjuntos de dados = 56 medições, zero com excesso. O pior excesso
encontrado é 0 px.**

Também confirmei que o que sai da vista está **dentro** de um contentor que rola, não cortado: os
elementos com `right > 1200` em `/transacoes` e `/recorrencias` são todos `table`, `thead`, `tr`,
`td`, `button` com `cortado por: div[table-container] overflowX=auto`. Nada fica inalcançável.

### Prova ao contrário (com rebuild)

Guardei a versão do Dev (`relatorios/.qa-t23/sidebar.dev.tsx`), repus
`git checkout ca44dfd -- apps/web/src/components/ui/sidebar.tsx` (ficou `'relative flex w-full
flex-1 …'`, sem `min-w-0`), **reconstruí** e levantei novo `next start`.

Spec 16 — **EXIT=1**:

```
[16/28] … 1024 px › /transacoes cabe na janela
  Error: /transacoes a 1024px: a página tem 101px a mais.
    94 |   `${rota} a ${largura}px: a página tem ${medida.scroll - medida.inner}px a mais.`,
  1 failed
  27 passed (26.0s)
```

Com a **conta demo** no mesmo build antigo, o defeito aparece também a 1200 — e é este o "antes":

```
=== 1200 px ===
/transacoes     scrollWidth=1309 innerWidth=1200 excesso= 109  FALHA
/recorrencias   scrollWidth=1294 innerWidth=1200 excesso=  94  FALHA
RESUMO 1200px: 14 rotas medidas, 12 OK, 2 com excesso; pior excesso 109px (/transacoes)
=== 1024 px ===
/transacoes     scrollWidth=1280 innerWidth=1024 excesso= 256  FALHA
/cartoes        scrollWidth=1148 innerWidth=1024 excesso= 124  FALHA
/recorrencias   scrollWidth=1280 innerWidth=1024 excesso= 256  FALHA
RESUMO 1024px: 14 rotas medidas, 11 OK, 3 com excesso; pior excesso 256px (/transacoes)
```

Culpados: o próprio `main[data-slot="sidebar-inset"]` (`right=1309`, `w=1053`) e o `header` — o *flex
item* a crescer acima do conteúdo, exactamente a causa descrita.

Reposta a versão do Dev (`diff` → `IDENTICO`), novo `pnpm build`, novo `next start`:

```
  28 passed (22.8s)                                            EXIT=0
```

`git diff apps/web/src/components/ui/sidebar.tsx` final → `1 1`, com
`+ … w-full min-w-0 flex-1 …`.

## 3. Contraste (tema escuro e claro)

Medido com `getComputedStyle` + rasterização das cores computadas (saem em `lab(…)`) num canvas 1×1, o
que dá o sRGB efetivamente desenhado; contraste WCAG 2.x pela luminância relativa.

```
=== TEMA ESCURO (cartao de /transacoes) ===
  fundo   lab(6.1716 -1.10191 -4.94371)  → rgb(15 20 26)   · L*=6.11
  cartao  lab(14.1339 -1.50354 -5.59948) → rgb(30 37 44)   · L*=14.29
  texto   lab(96.5162 -0.553399 -1.78931) → rgb(243 245 248)
  muted   lab(65.1777 -2.07776 -7.08538)  → rgb(149 160 171)
  contrasteTextoCartao  = 14.18   (≥ 4.5) PASS
  contrasteMutedCartao  =  5.82   (≥ 4.5) PASS
  diferencaCartaoFundo  =  8.18 L* (antes: 11.23 − 6.17 = 5.06, pelo valor do T23.md)

=== TEMA CLARO (cartao de /transacoes) ===
  fundo   lab(98.8652 -0.128925 1.5182) → rgb(252 252 249) · L*=98.89
  cartao  lab(100 0 0)                   → rgb(255 255 255) · L*=100
  contrasteTextoCartao = 17.35
  contrasteMutedCartao =  6.00
```

Claro **não mudou**: fundo L\* 98,89 / cartão L\* 100 / 17,35:1 batem com os valores de referência
(98,87 / 100 / 17,38) dentro do arredondamento do canvas. E o diff de `globals.css` é **uma linha**,
dentro do `.dark` (`--card: oklch(0.235 …) → oklch(0.26 …)`); o `:root` não aparece no diff.

## 4. Hierarquia tipográfica

```
=== / (Painel) ===
  36px  Património líquido
  28px  Entradas do mês
  28px  Saídas do mês
  28px  Sobra do mês
[Painel] h1=30px

=== /orcamento ===
  28px  Orçamento mensal
  28px  Total do orçamento
  28px  Gasto no mês
  28px  Projetado até ao fim do mês
  28px  Sobra do orçamento
[Orcamento] h1=30px

=== /relatorios ===
  28px  Entradas   28px  Saídas   28px  Resultado
  28px  Movimentos 28px  Despesa média diária
[Relatorios] h1=30px
```

36 / 28 / 28 / 28 no Painel, 5 KPIs a 28 px em Orçamento e 5 em Relatórios — o `prominent` não se
espalhou. `h1` a 30 px em todos os ecrãs medidos (Painel, Transações, Contas a pagar/receber,
Objetivos, Orçamento, Relatórios), no escuro e no claro.

## 5. pt-BR — varredura larga própria

Corri duas passagens em `apps/web/src` (`--include=*.ts,*.tsx`, sem test/spec) com um padrão largo e
classifiquei cada acerto à mão, separando comentários e código de texto de produto: `você/vocês`,
`aplicativo`, `celular`, `tela`, `cadastr*`, `planejamento`, `gerenciar`, `gerenciamento`, `excluir`,
`salvar/salvo`, `em uma/em um`, `conosco`, `registrar`, `acessar`, `deletar`, `alterações`, `time`,
`equipe`, `usuário`, `grátis`, `senha`, `aluguel`, `registros`, `planejar`, `bacana`, `a gente`,
`legal`, `ônibus`, `café`, `geladeira`, `banheiro`, `no momento`.

`você/vocês` → **0**. `Selecione` (o padrão que o Dev perseguiu) → **0**.

Sobram **7 strings de produto visíveis** (o resto são comentários ou `console.error`):

| # | ficheiro:linha | texto | onde aparece | antes da T23? |
| - | --- | --- | --- | --- |
| 1 | `account-group-dialog.tsx:135` | «Ocorreu um erro ao salvar o grupo.» | toast de erro | sim |
| 2 | `account-group-dialog.tsx:146` | «…várias contas em uma visualização.» | descrição do estado vazio | sim (T25) |
| 3 | `account-group-dialog.tsx:148` | «Salvar Alterações» | rótulo do botão | sim (T25) |
| 4 | `receivable-payable-dialog.tsx:152` | «Ocorreu um erro ao salvar a conta.» | toast de erro | sim |
| 5 | `receivable-payable-dialog.tsx:165` | «Salvar Alterações» | rótulo do botão | sim (T25) |
| 6 | `receivable-payable-dialog.tsx:235` | `placeholder="Ex: Fatura de luz, Aluguel, Salário..."` | placeholder do campo Descrição | sim |
| 7 | `server/receivable-payable-actions.ts:252` | «Não consegui registrar o pagamento. Tenta outra vez.» | `fallback:` → `result.error` → toast de erro | sim |

Confirmei que são visíveis: #1/#4 no `toast({ description: … })` do `catch`; #7 chega ao ecrã por
`toast({ title: 'Não foi possível guardar', description: result.error })`
(`receivable-payable-dialog.tsx:125-131`); #6 é o placeholder usado pelos próprios e2e.

Fica de fora, e está bem: `app/(app)/api/receivable-payable/route.ts:66`
(`console.error('Erro ao registrar pagamento:', error)`) é log de programador, e
`route.ts:53` / `page-header.tsx:4` têm «registrar»/«em uma» só em comentários.

**Conclusão da varredura: 7, não 1.** O Dev acertou nas 15 frases que mudou e a varredura dele deu
zero no padrão que usou, mas uma varredura larga encontra mais quatro que não estão registadas:
«ao salvar» (2), «registrar o pagamento» (1) e «Aluguel» (1). Nenhuma foi introduzida pela T23 (o
diff não toca nestas linhas) — são dívida anterior que deve entrar na T25.

## 6. Âmbito

```
$ git diff --name-only
apps/web/src/app/(app)/consolidacao-contas/page.tsx
apps/web/src/app/(app)/contas-pagar-receber/page.tsx
apps/web/src/app/(app)/page.tsx
apps/web/src/app/globals.css
apps/web/src/components/account-group-dialog.tsx
apps/web/src/components/kpi-card.tsx
apps/web/src/components/page-header.tsx
apps/web/src/components/receivable-payable-dialog.tsx
apps/web/src/components/receivable-payable-list.tsx
apps/web/src/components/ui/sidebar.tsx
docs/gestao/TASKS.md          ← quadro do Lead, não é produto

$ git diff --numstat -- apps/web
6  6   …/consolidacao-contas/page.tsx      1 1  …/contas-pagar-receber/page.tsx
1  1   …/(app)/page.tsx                    1 1  globals.css
1  1   account-group-dialog.tsx            9 1  kpi-card.tsx
1  1   page-header.tsx                     6 10 receivable-payable-dialog.tsx
1  1   receivable-payable-list.tsx         1 1  ui/sidebar.tsx
```

- Os **10 ficheiros de produto** são exactamente os previstos; `e2e/16-largura.spec.ts` é o único
  novo (`??`).
- `git status --short apps/web/src/lib/nav.ts apps/web/src/components/ui/card.tsx
  e2e/80-acessibilidade.spec.ts e2e/90-desempenho.spec.ts` → **vazio** (intocados).
- `MOBILE_NAV` = **5** destinos (`PAINEL, TRANSACOES, ORCAMENTO, OBJETIVOS, CONTAS`).
- Os e2e da microcopy: nenhum teste assere as 15 frases mudadas (o gate passa e o Revisor confirmou o
  `grep`); `Salvar Alterações` continua assertado em `45`/`55`, e é por isso que mudá-lo exige tocar
  nos specs — fora do âmbito desta tarefa.

## 7. Regressão visual mínima

12 imagens novas do build final em `relatorios/.qa-t23/corrigido-*.png`, e olhei uma a uma para
Painel, Transações, Contas a pagar/receber e Objetivos no **escuro e no claro**, mais Orçamento
(escuro) e Relatórios (escuro). Nada partido:

- `h1` a 30 px cabe numa linha em todos; «Contas a Pagar / Receber» continua numa linha a 1200, com o
  botão «Nova Conta» à direita sem sobreposição.
- Cartões do escuro visivelmente acima do fundo (L\* 14,3 vs 6,1) sem estridência; no claro
  exactamente como antes (branco sobre `rgb(252 252 249)`).
- Formulário de lançamento rápido, filtros, tabela de 25 linhas, cartões de objetivos, KPIs e
  gráficos: sem cortes, sem sobreposição, sem texto a transbordar.
- **Nota de registo (não é defeito):** no escuro, as superfícies aninhadas ficaram mais planas — o
  rodapé da tabela (`bg-muted/50`) e o hover de linha quase se fundem com o cartão, como o Revisor
  tinha previsto. Visualmente aceitável; se se quiser mais separação, sobe-se `--muted`/`--secondary`
  no `.dark`, não se baixa o cartão.
- Cuidado com as imagens antigas `T23-antes-*.png` / `T23-depois-*.png` do Dev — as minhas são as
  `corrigido-*`; a primeira vaga que tirei (sem prefixo) foi sobrescrita durante a prova ao contrário
  e não serve de prova final.

## O que não cobri

- **Telemóvel.** Não medi 375/640/768 px; o spec 16 e as minhas medições são 1200 e 1024. O Revisor
  amostrou 375/640/768 e não viu excesso, mas não é medição minha.
- **Leitor de ecrã e contraste medido à mão** (o axe/80 não foi corrido nesta tarefa).
- **Suite e2e completa** — só o `16-largura`; não re-corri os 24 percursos.
- **Produção.** Tudo medido no build local de produção; o `ca44dfd` publicado não tem a T23.
