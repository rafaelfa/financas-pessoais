# Tarefas fechadas — financas-pessoais

Arquivo das secções de tarefa já fechadas. Cada secção é movida de
`docs/gestao/TASKS.md` na íntegra, no momento do fecho, e recebe acima o bloco
de seis campos do fecho (Fechado / Prova / O que isto não resolve / Aberto /
Repositório / Decisão). A linha da tabela em `TASKS.md` fica como índice.

Ordem: mais recente primeiro.

---

## Bloco de fecho — T107 (fechada 2026-11-23)

- **Fechado:** T107 — o passe visual que punha a superfície ao nível dos concorrentes: um número herói por
  ecrã, menos caixas no Painel, cor por categoria em oito séries, superfícies mais macias e vazios a sério nos
  dois gráficos.
- **Prova:** QA **PASS** na volta 6 (`relatorios/T107-qa.md`): 8 fatias com **8 cores distintas**, as oito
  primeiras posições também 8 de 8, a categoria arquivada sem colidir com a viva e estável entre cargas, 11
  nomes → 8 cores e 3 repetições (só acima de oito), «Sem categoria» com 0 pontos; suite de frio **162 passed
  (9.7m), EXIT=0**, `BUILD_ID o0n_BOgpFcGFM8-AjTe55`. Gate do Dev **605 testes** (inclui o teste do mapa de
  cores, que cai com a mutação que o Revisor descreveu), `BUILD_ID F4VV8mDqmUtxREFiyl4TD`. Revisor:
  «0 BLOQUEIA, 0 DEVE, 0 OPCIONAIS — pode commitar: sim». Fronteiras no primeiro ecrã a 1440: **8 → 7**;
  contrastes calculados (`chart-1..8` claros 3,74–5,92; texto da categoria 17,35:1 / 14,18:1). Commit de
  código `f696382`.
- **O que isto não resolve:** (i) **criar uma categoria pode mudar até 28 cores** — `categories-actions.ts:89`
  grava `sortOrder: value.sortOrder ?? 0`, por isso a nova entra à frente por nome e desloca as posições
  seguintes; é o mesmo conflito de fundo (posição vs nome) e pede tarefa própria; (ii) acima de **oito nomes
  pintados** no mesmo ecrã a repetição de cor é inevitável (há oito tokens) e a nona fica na base; (iii) a mesma
  categoria pode **desviar-se num ecrã e não noutro** — é o preço da resolução por ecrã, aceite pelo utilizador
  e escrito no critério 3 revisto; (iv) fica uma **caixa tracejada** do `empty-state` abaixo da dobra («Nada por
  pagar nos próximos 7 dias»), fora do critério e com o padrão repetido em 15 componentes; (v) `apps/web` não
  tem testes de componente (o `vitest` vive em `packages/shared`), por isso o mapa é provado em unidade fora da
  app e o resto por e2e.
- **Aberto:** nada bloqueado. **T108 candidata** (`sortOrder = max + 1` no create, para criar não deslocar
  cores) — precisa da autorização do utilizador para abrir vaga.
- **Repositório:** `main` com `f696382` (código, testes e relatórios) e o commit de gestão que se lhe segue,
  ambos empurrados para `origin`; produção **não** foi tocada nesta tarefa.
- **Decisão:** abrir ou não a T108 do `sortOrder`, e se esta entrega vai a produção (o deploy é sempre decisão
  do utilizador).

---

## T107 — Passe visual: um herói, menos caixas, cor por categoria (2026-11-23)

**Porque:** o utilizador comparou a nossa interface com Mobills, Organizze, Wallet, Toshl e Spendee e disse o
que interessa: a estrutura está boa, **a superfície não**. A análise (`_analise/ANALISE-concorrentes-produto-e-design.md`,
fora do repositório) isolou cinco causas: um acento só a fazer três trabalhos, caixas a mais, escala de tipo
plana, moldura vazia em vez de estado vazio e superfícies duras. Isto não é sobre funcionalidades.

**Ficheiros que pode escrever:** `apps/web/src/app/(app)/page.tsx`,
`apps/web/src/components/{ui/card.tsx, dashboard-forecast-chart.tsx, dashboard-forecast.tsx,
dashboard-forecast-alert.tsx, cashflow-chart.tsx, month-close-checklist.tsx, budget-overview.tsx,
budget-status.tsx, budget-limit-list.tsx, category-donut.tsx, empty-state.tsx, amount.tsx, kpi-card.tsx,
transaction-table.tsx, dashboard-scope-switch.tsx, report-category-breakdown.tsx}`, `app/(app)/relatorios/page.tsx`,
`app/(app)/orcamento/page.tsx` e `apps/web/src/lib/category-colour.ts` (novo: cor estável por categoria). Mais nada: **sem schema, sem dependências novas, sem rotas novas**.

**Critério de aceitação (verificável):**

1. **Um número herói por ecrã.** No Painel, «Património líquido» passa a dominar por **posição, tamanho de
   cartão e peso**, não por um valor gigante: **a D36 continua a mandar** — o valor do KPI fica a **24 px** com
   os degraus por `@container`, e nenhum cartão pode cortar o «€». Os outros três números descem a um segundo
   plano (18–20 px, mesma família e `font-numeric`). Rótulos deixam as MAIÚSCULAS: 12 px, sentence case.
2. **Menos caixas no Painel.** «Ver por» deixa de ser um cartão (fica na linha do título, com o mesmo controlo
   segmentado); a nota «A previsão de saldo e o fecho do mês…» deixa o tracejado e passa a uma linha
   `muted-foreground`. A checklist do fecho perde as divisórias onde o espaçamento já separa. Contagem de
   fronteiras visíveis no primeiro ecrã: **antes / depois** medida e escrita no relatório.
3. **Cor por categoria, com sistema.** Cada categoria ganha uma cor de `chart-1..8` aplicada por
   chip/ponto, **nunca só por cor** — o nome fica sempre escrito. Zero hex, zero `rgb()`: só tokens.
   **A estabilidade é por ecrã, e é este o critério revisto a 2026-11-23** (era «a mesma cor nos quatro
   sítios», que o código deixou de poder cumprir quando a resolução de colisões passou a ser local): a mesma
   categoria tem a **mesma cor em todos os sítios onde aparece sem desvio**, e **nunca duas cores no mesmo
   ecrã**; quando a base está tomada, desvia para a primeira cor livre e aí pode diferir de outro ecrã. Até
   oito nomes pintados não há repetição; acima de oito, a nona repete e isso é aceite. Testemunho da medição:
   §12 do relatório do Dev e §«Volta 6» do QA.
4. **Superfícies.** `rounded-xl` e **uma** sombra do sistema nos cartões; borda só onde separa de facto. Medir
   que nenhum cartão muda de altura por causa do raio e que o foco visível continua a existir.
5. **Estados vazios a sério** no gráfico de previsão e no fluxo de 6 meses quando não há dados: uma frase que
   diz o que falta e a ação que o resolve; nunca uma moldura vazia nem um eixo com 0 €.
6. **Acessibilidade e temas:** 4,5:1 para texto e 3:1 para ícone/bordo, **calculado** e apresentado por limite;
   claro e escuro; 1440 e 375 sem transbordo (`document.scrollWidth` = largura, medido por cartão e não só no
   documento).
7. Gate do `AGENTS.md` verde, com o número de testes por extenso. Nenhuma asserção antiga enfraquecida.

**O que NÃO fazer:** não tocar em lógica, dados, rotas nem textos de negócio; não introduzir família
tipográfica, sombra própria, gradiente, emoji ou animação em loop; não copiar nada dos sites de referência —
nem cor, nem texto, nem ícone; não mexer no que a D36 fixou para além do que o critério 1 diz; no máximo 3
dependências novas (**nenhuma é necessária**).

**Prova esperada:** `relatorios/T107.md` com capturas a **1440 e 375, nos dois temas**, do Painel (antes/depois),
de Transações, do Orçamento e dos Relatórios; a contagem de fronteiras do critério 2; os contrastes calculados
com o valor de cada limite; e a skill `design-do-projeto` citada como cumprida.

**2026-11-23 — entrega parcial do Dev (itens 1, 2, 4 e 5) e segunda metade autorizada.** Feitos e medidos:
rótulos sem maiúsculas a 12 px, herói por largura de cartão com o valor a 24 px (seis dígitos medidos dentro do
cartão: 229 px de texto em 445 px), «Ver por» sem caixa, nota sem tracejado, checklist sem divisórias, uma
sombra em `ui/card.tsx` e vazios a sério nos dois gráficos. Gate verde, **599 testes**, `BUILD_ID
RqUyfKQFLqiyNpGnAC65g`. **Faltam** o item 3 (cor por categoria) e as provas de contraste, capturas de
Transações/Orçamento/Relatórios e transbordo por cartão. Autorizado `lib/category-colour.ts` (helper com as
classes `bg-chart-1..5` literais e índice estável por id da categoria) e fixado o «antes» das fronteiras
medido por mim na produção (`6bd62ee`): **8** caixas no primeiro ecrã a 1425×900 — o 9 do Dev era derivado.

**2026-11-23 — QA devolveu FAIL em dois critérios, com a medição colada (`relatorios/T107-qa.md`).** Volta
**3 de 3** (a última do teto). Passaram: hierarquia (herói 36 px num cartão de 445×122, 2,1× a área dos
irmãos, primeiro número apanhado a 1440 e a 375), contrastes (≥3:1 nos cinco `chart-*`, texto a 17,35:1 no
claro), transbordo por cartão (**0** em 16 combinações), «Ver por» a funcionar, suite de frio **162 passed**
(`a2Ket8Olt_7fx-On8st2v`). Falharam dois, ambos pequenos:

1. **Critério 3, a mesma categoria com duas cores.** Causa confirmada por mim no código: **duas chaves**. O
   `transaction-table.tsx:456` indexa por `categoryName` e o donut por `slice.categoria` (nome), enquanto o
   `budget-limit-list.tsx:192` e o `report-category-breakdown.tsx:69` indexam por `categoryId`. O hash é da
   chave, logo nome≠id e a cor diverge. Habitação `chart-4` (Transações, donut) vs `chart-1` (Orçamento,
   Relatórios). **Decisão: a chave passa a ser o nome em todos os quatro** — é a única chave que os quatro
   sítios têm (o `DonutSlice` só recebe `categoria`), e obriga a duas linhas, não a mudar tipos.
2. **Critério 2, o tracejado.** `page.tsx:360` continua `border border-dashed` e o diff do ficheiro não lhe
   toca. O §7.2 justificou-a **fora da contagem de fronteiras**, mas o critério pede tirar o tracejado: a nota
   vira texto simples (`text-sm text-muted-foreground`), sem caixa e sem raio.

**Também decidido (pergunta do QA):** a previsão passa a ter estado vazio **alcançável** — quando todos os
dias têm `balanceInCents === 0` e nenhum item, mostra a frase e a ligação, sem SVG e sem eixo a 0 €, com a
mesma regra que o `cashflow-chart.tsx:44` já usa. Um gráfico com um ponto a 0,00 € e um eixo a 0 € é a moldura
vazia que a tarefa foi tirar.

**Correção de prova, não de código:** o herói está a **36 px**, não a 24. É o degrau `text-4xl` da escada da
D36 (que fixa degraus 24/28/30/36 pela largura do cartão, piso 24) a funcionar com o cartão de 445 px — não é
violação. A frase «valor a 24 px» do §7.1 do relatório é que não descreve o ecrã e passa a descrever a escada.

**2026-11-23 — leitura do Lead da volta 3, antes de ir ao QA: (a) e (b) fechados, (c) não chega ao ecrã.**
(a) confirmado por mim: as três chaves passaram a `categoryName` e o donut já usava nome — uma chave só.
(b) confirmado: três tracejados saíram do `page.tsx` (aviso de âmbito, «A pensar pelo cartão», nota da
previsão) e o `grep dashed` do ficheiro sai vazio; fronteiras **7** (6 `card` + `UL`), «antes» 8 medido por mim.
(c) **falha**: o `ChartCard` recebe `isEmpty={!hasAnythingToForecast}` e o seu ramo de vazio desenha **outra**
frase (`emptyMessage`, sem ligação) numa **moldura tracejada** (`chart-card.tsx:50`), por isso o estado vazio novo
do `dashboard-forecast-chart.tsx` **nunca renderiza** — é a mesma falha de classe que o QA apontou («a frase
existe no código e nenhum estado lhe chega»). O Dev assumiu não ter alcançado o estado; esse alcance é do QA,
que já o fez (uma conta sem movimentos num utilizador `qa-t107-…`), mas o que ele veria era a frase antiga, sem
ligação. Corrigido dentro da mesma volta: um só dono do vazio, no `dashboard-forecast.tsx`.

**2026-11-23 — volta 3 corrigida e no QA (segunda passagem).** Fechado: (a) uma chave só — as três usam
`categoryName`, o donut o nome da fatia; (b) cinco notas tracejadas saíram do Painel (`grep dashed` = **0** nos
três ficheiros), fronteiras **7** contra 8; (c) o vazio da previsão passou a ter **um dono só** no
`dashboard-forecast.tsx` (o `isEmpty` do `ChartCard` deixou de ser usado, o gráfico devolve `null` sem pontos) e
a frase nomeia os três gatilhos reais da condição. `BUILD_ID L073q6RIRPPOhLpDJH3N9`, gate **599 testes**.
Ao QA com o cenário de uma conta sem movimentos (vazio alcançado) e a conta `demo` (o gráfico continua a
desenhar), o `grep`, a contagem e a suite de frio como prova de fecho. Sem infraestrutura de teste de
componente em `apps/web` (vitest só em `packages/shared`), o alcance do vazio é provado no browser, não por
teste de unidade.

**2026-11-23 — QA assinou PASS na volta 3; segue ao Revisor.** (a) Habitação `chart-4` nos quatro sítios onde
tem dado; Alimentação e Transportes coincidem em Transações e Orçamento e **não têm movimento em Relatórios** —
o QA disse-o em vez de as dar por boas. (b) `grep dashed` = **0**, fronteiras **7**, `role="status"` e
`#painel-ambito-aviso` intactos com `aria-describedby` a resolver. (c) vazio da previsão alcançado: frase +
ligação, **0 SVG, 0 eixos, sem moldura tracejada**; na `demo` continua a desenhar (1 superfície no cartão, 3 na
página). O cenário «uma conta sem movimentos» **não chega** a este cartão (cai no vazio global do Painel); o
caminho real é conteúdo sem pontos de previsão — o QA usou um bem de 1 000 € com contas a 0. (d) Suite de frio
**162 passed (9.8m), EXIT=0**, `BUILD_ID TBURWq65Se41myOvfS7GQ`. Achado fora do critério, registado e não
corrigido: a caixa tracejada do `empty-state` «Nada por pagar nos próximos 7 dias», abaixo da dobra, com o
padrão de vazio tracejado repetido em 15 componentes — tarefa nova só com autorização.

## T107 — impasse ao teto das 3 voltas (2026-11-23)

O QA assinou `PASS` na volta 3 e o Revisor respondeu **«pode commitar: não»**, com 1 DEVE e 2 opcionais. Fui
verificar os três no código e nas capturas: **os três confirmam-se**, e os três nascem das minhas instruções,
não de erro do Dev.

**DEVE — o vazio do fluxo de seis meses nunca chega ao ecrã.** `page.tsx:391` passa
`isEmpty={data.series.every(item => item.incomeInCents === 0 && item.expenseInCents === 0)}` ao `ChartCard` que
envolve o `CashflowChart`, e o `report-monthly-evolution.tsx:45` passa `isEmpty={byMonth.length === 0}`. O
`ChartCard` decide `isEmpty ? moldura tracejada com frase genérica : children` (`chart-card.tsx:47-55`), logo o
estado vazio do `cashflow-chart.tsx:44` — que tem a frase certa e a ligação para `/transacoes` — só aparece
quando `isEmpty` é falso, isto é, quando o cartão acha que há dados. **É a terceira vez que a mesma classe de
defeito aparece nesta tarefa** (vazio com dois donos): primeiro na previsão, agora no fluxo. A causa é minha —
o critério 5 nomeou os gráficos e nunca os `ChartCard` que os envolvem.

**Confirmação de que é intermitente, não cosmético:** o QA deu o item 5 como PASS no fluxo («Ainda não há
movimentos nestes seis meses.» + ligação, 0 SVG) — via a frase certa porque o `isEmpty` olha para
`data.series` (12 meses) e o gráfico desenha `cashflow` (6 meses); com dados fora da janela, `isEmpty` é falso
e o gráfico fala. Num utilizador sem movimentos nenhuns, `isEmpty` é verdadeiro e aparece a frase genérica
numa moldura tracejada. **O mesmo estado tem dois ecrãs diferentes conforme os dados que estão fora da janela.**

**Regressão que eu introduzi — o donut perdeu metade das cores.** O `HEAD` tinha `SERIES` com **8** cores
(`category-donut.tsx:22-31`) e a T107 substituiu por 5 no helper. Com ≥6 categorias no período — o caso normal
em `/relatorios` — há pelo menos duas fatias com a mesma cor por casa dos pombos. Os tokens `--chart-6..8`
existem no `:root` e no `.dark` (`globals.css:126-128`, `:195-196`), mas **não** estão em `@theme inline`
(só 1..5), por isso não há classes `bg-chart-6..8`; a solução que não toca no tema é o helper devolver
`var(--chart-N)` e o ponto usar essa variável, em vez de uma classe.

**Lacuna de grelha a 375, vista na captura.** O herói ocupa a linha toda (`col-span-2`) e sobram **1 + 2 + 1**:
o «Sobra do mês» fica sozinho em meia linha, com meio cartão de vazio ao lado (`painel-375-primeiro-ecra.png`).
A T103 tinha exigido 2×2 a 375. A saída que não perde o herói é o **último KPI ocupar as duas colunas**.

**Saídas:** (A) abrir T108 com os três e fechar a T107 com os itens 1, 2, 3 e o vazio da previsão, deixando o
fluxo vazio por fechar; (B) autorizar uma 4.ª volta na T107, acima do teto, com os três e uma prova de QA
curta (vazio do fluxo + captura a 375 + suite). Pedido ao utilizador.

**2026-11-23 — utilizador autorizou uma 4.ª volta (acima do teto), com os três achados.** Ao Dev: (a) tirar
`isEmpty`/`emptyMessage` dos dois `ChartCard` que envolvem o `CashflowChart` (`page.tsx:391`,
`report-monthly-evolution.tsx:45`) — o vazio passa a ter um dono só, o gráfico; (b) o helper devolve
`var(--chart-N)` para ponto **e** fatia e o índice vai a **8** (os tokens existem, o `@theme inline` não os
expõe como classe, e a solução não toca no tema); (c) o último KPI ocupa as duas colunas a 375
(`min-[375px]:col-span-2 xl:col-span-1`) para fechar a meia linha vazia. Prova exigida: o vazio do fluxo
alcançado no Painel e em `/relatorios` (e o que acontece a quem tem movimentos fora da janela de seis meses),
oito cores distintas com a mesma categoria igual nos quatro sítios, contrastes de `chart-6..8` contra `card`
com o método já usado, e as larguras dos KPI a 375 e a 1440. QA leva só isto; o resto está assinado e não se
repete.

**2026-11-23 — volta 4 entregue e no QA.** Os dois `isEmpty` que envolviam o `CashflowChart` saíram (o do donut
ficou), o helper devolve `var(--chart-N)` até **8** e serve o ponto (`style`) e a fatia (`fill`) com a mesma
função, e o último KPI passou a `min-[375px]:col-span-2 xl:col-span-1`: a 375 são **3 linhas** sem meia linha
vazia, a 1440 é **1 linha** (445 + 214 + 214 + 214 = 1087 numa secção de 1136). Contrastes de `chart-6..8`
contra `card`: claro **4,01 / 5,26 / 4,23**, escuro **8,03 / 6,89 / 8,44**. Corrigidos dois comentários no
helper (JSDoc duplicada e «0–4» que agora é 0–7). `BUILD_ID 0fypEDAHeTGDWRa12AP1d`, gate **599 testes**.
QA leva só o curto: vazio do fluxo no Painel e em `/relatorios` (o cenário é o bem de 1 000 € com contas a 0),
o caso dos movimentos só fora da janela, as cores distintas com ≥6 categorias, os contrastes de 6..8
recalculados, a grelha a 375 e a 1440 e a suite de frio. Sem volta 5 sem o utilizador.

**2026-11-23 — QA reprovou só o (c) na volta 4 e o utilizador autorizou a volta 5.** O resto passou: o vazio do
fluxo no Painel **e** em `/relatorios` (frase + ligação, 0 SVG, 0 eixos, sem moldura), o caso de movimentos só
fora da janela com a mesma frase nos dois ecrãs, a grelha a 375 (3 linhas) e a 1440 (1 linha), os contrastes de
`chart-6..8` reconferidos por cálculo (≤0,03 de diferença do Dev: claro 4,01/5,26/4,25 · escuro 8,01/6,86/8,42) e
a suite de frio **162 passed**, `BUILD_ID yDUoisjhvMTHNPvK0Hgfo`. **Falhou o (c): 8 categorias davam 5 cores
distintas** (Saúde=Alimentação, Habitação=Transportes, Animais=Lazer). A causa é o instrumento, não o código: um
hash não distribui 8 nomes por 8 cores, e o meu critério pedia 8 distintas — a média esperada de 8 sorteios em 8
casas é ~5, que é exatamente o que se mediu. **Decisão do utilizador: a cor passa a sair da posição na lista
ordenada** (`kind, sortOrder, name`, a ordem do `listCategories`, sobre a lista completa do utilizador, igual nos
quatro ecrãs). Fica escrito o efeito colateral: categoria inserida no meio reordena as seguintes; arquivada,
sobe as que vêm depois; a partir da nona há repetição porque há oito tokens.

**2026-11-23 — o Dev devolveu a volta 5 sem tocar em ficheiros, por falta de contexto da sessão.** Decisão dele,
e certa: o (a) é uma mudança de contrato (a cor deixa de ser função do nome e passa a ser posição numa lista que
tem de chegar a 4 páginas e 5 componentes), e fazer metade deixava o ecrã com duas fontes de cor. Árvore intacta
(`format:check` 0, `typecheck` 0, `BUILD_ID yDUoisjhvMTHNPvK0Hgfo`). Recusado o corte em duas entregas — mais uma
volta de cadeia por meia correção. Retomada em **conversa nova do Dev** (`start_new_chat`) com o brief completo e
autónomo, incluindo as três respostas já lidas no código: `create` põe `sortOrder = max + 1` (criar **não** muda
cores), arquivar sobe as seguintes (muda), e a nona categoria repete (oito tokens).

**2026-11-23 — volta 5 entregue em conversa nova do Dev e no QA.** A cor saiu do hash: `categoryColour(name,
orderedNames)` devolve `var(--chart-N)` pela **posição** na lista canónica (`kind`, `sortOrder`, `name`, 29
categorias não arquivadas na conta de teste), com hash só como fallback para nome fora da lista (categoria
arquivada ainda presente num extrato, «Outras (N)»). A lista vai nos DTOs de `dashboard`, `budgets` e `reports` e
chega aos quatro componentes por prop; o `budget-overview` não pinta nada e ficou sem a prop (evitada uma prop
morta). Gate **604 testes**, `BUILD_ID -W4g04WQk3ub2Jq3w0Awc`. O Dev só conseguiu medir **7 cores distintas
em 7 fatias** — a oitava categoria da conta não tinha despesa no mês; o QA tem utilizadores próprios e vai montar
as oito. **Dois desvios medidos, e o primeiro muda o custo da escolha:** (i) `categories-actions.ts:89` grava
`sortOrder: value.sortOrder ?? 0`, ou seja, **criar uma categoria não a põe no fim** — fica com 0 e ordena por
nome, o que muda até 29 cores (não as «nenhumas» que eu escrevi no brief). Fica como limite conhecido e
candidato a tarefa nova (`sortOrder = max + 1` no create), **não** se corrige dentro da T107; (ii) arquivar a
categoria na posição k muda 28−k cores.

**2026-11-23 — QA reprovou a volta 5 com um número, e o utilizador autorizou a volta 6.** Com a lista canónica de
**29** categorias, as oito com despesa no mês não são as oito primeiras posições: `8%8=0`, `9%8=1`, `15%8=7` dão
**5 cores em 8 fatias** (Educação=Habitação, Lazer=Alimentação, Animais=Saúde). O QA mediu também o caso oposto —
as **oito primeiras posições dão 8 de 8** —, o que mostra que o defeito é a aritmética, não a lista. Passaram: a
coerência da mesma categoria nos quatro ecrãs (âncoras novas: Habitação `chart-1`, Alimentação `chart-2`,
Transportes `chart-4`, Saúde `chart-8`), «Sem categoria» sem ponto, e a suite (162, `BUILD_ID j-n_70C1CNOqkeVgWw2iE`).
Achado adicional do QA: a categoria **arquivada** cai no hash e **colide com uma viva do mesmo ecrã** (Animais =
Saúde `chart-8`). **Decisão do utilizador: a posição continua a ser a base, mas cada ecrã resolve as suas
colisões** — base = posição, processamento por ordem canónica, primeira cor livre seguinte quando a base está
tomada; a arquivada entra na mesma resolução. Efeito aceite: a mesma categoria pode desviar-se num ecrã e não
noutro, e fica escrito na tabela com a coluna «desviada?».

**2026-11-23 — volta 6 entregue e no QA.** `categoryColourMap(nomesPintados, nomesCanónicos)`: base = posição
`% 8`, processamento por ordem canónica (fora da lista no fim, por unidades de código — não `localeCompare`,
que depende do ICU), quem tem a base tomada leva a primeira cor livre seguinte ciclicamente; acima de oito nomes
a repetição é inevitável e o nono fica na base. As oito do QA (posições 0,1,3,7,8,9,13,15) dão **8 de 8** contra
5; as oito primeiras continuam 8 de 8; a arquivada animas resolve de `chart-8` para `chart-7` e deixa de colidir
com Saúde. No DOM: Transações 10 categorias→8 cores (Lazer desvia, Transferência e Salário repetem), Relatórios
7/7, Orçamento 3/3, Painel 2/2. Gate **604 testes**, `BUILD_ID 4b0F7zCtmR0I1uAz0idZo`, só os cinco ficheiros
autorizados. Preço aceite e escrito: a mesma categoria pode desviar num ecrã e não noutro — o que não pode é ter
duas cores no mesmo ecrã.

**2026-11-23 — QA assinou PASS na volta 6.** As oito do teste deram **8 de 8** no DOM (Habitação `chart-1`,
Alimentação `chart-2`, Educação `chart-3`, Transportes `chart-4`, Lazer `chart-5`, Vestuário `chart-6`, Animais
`chart-7`, Saúde `chart-8`), os três desvios previstos pelo Dev confirmados; as oito primeiras posições continuam
8 de 8; a arquivada resolve para `chart-7` sem colidir com a Saúde viva e **duas cargas dão o mesmo mapa**; 8
nomes → 8 cores, 11 nomes → 8 cores e 3 repetições (só acima de oito); nenhuma categoria com duas cores no mesmo
ecrã; «Sem categoria» com 0 pontos; suite de frio **162 passed (9.7m), EXIT=0**, `BUILD_ID o0n_BOgpFcGFM8-AjTe55`.
Utilizadores de teste apagados (restos a 0), nenhuma categoria ficou arquivada, porta 3000 fechada. Segue ao
Revisor para o parecer final antes do push.

**2026-11-23 — parecer final do Revisor: «0 BLOQUEIA, 2 DEVE, 1 OPCIONAL. Pode commitar: não».** O **DEVE 1** é
meu, não do código: o critério 3 prometia «a mesma cor nos quatro sítios» e a decisão do utilizador na volta 6
(«resolver a colisão no ecrã») tornou isso impossível acima de oito nomes pintados — a partir das 9 categorias,
uma que desvia num ecrã e não noutro tem duas cores entre ecrãs. **Critério reescrito acima** para dizer o que
é verdade (estabilidade por ecrã, nunca duas cores no mesmo ecrã, repetição só acima de oito), em vez de
prometer o que o código não dá. O **DEVE 2** é real e aceite: os cinco testes novos exercitam
`categoryColour`/`categoryColourIndex` e **nenhum** chama `categoryColourMap`, que é o que os quatro ecrãs usam —
com `firstFreeIndex` a devolver a base quando está tomada, os 604 continuam verdes e o donut volta a repetir. Vai
ao Dev uma volta **só de testes e API morta**, sem mudança de comportamento: três casos para o mapa (colisão
resolve para a próxima livre, mapa igual com a entrada baralhada, nome fora da lista entra na resolução) e a
remoção de `categoryColour`/`categoryColourIndex`, que nenhum ficheiro de `apps/` chama. Confirmado pelo Revisor
e por mim: o mapa é determinístico, independente da ordem de entrada, pior caso O(8n) e sem ciclo infinito.

---

## Bloco de fecho — T104 (fechada 2026-11-23)

- **Fechado:** T104 — os sete números e frases que mentiam quando a conta tinha dados: o calendário contava
  só o por-liquidar, a legenda do património nomeava três termos para uma soma de cinco, o resumo do
  orçamento media contra o total do orçamento, um objetivo novo nascia «Atrasado», as datas saíam em ISO, o
  service worker do PWA não registava e um `aria-hidden` escondia um `<select>` com foco.
- **Prova:** `relatorios/T104-qa.md` (PASS nas voltas 1 e 2) e `relatorios/T104.md` (Dev). Suite de frio
  **155 passed, 0 failed, EXIT=0**, `BUILD_ID GmgSvgVixj96_qR0BW1knP`; `format:check` 0. Specs novos
  `104-calendario-dia`, `104-orcamento-resumo` e `104-orcamento-sem-limites` — o último **vermelho no código
  anterior** numa cópia do repositório («0 % consumido, Tranquilo» → «130 % consumido, Excedido»). Em
  produção (`f51dfee`, READY), com os dados da conta de teste: calendário «1 **item** · 0 por liquidar,
  saldo 2200,00 €» no dia 2 e a legenda nova dos totais; património «contas + objetivos + bens − faturas do
  cartão − dívidas» com o mesmo 183 608,55 €; orçamento «66 % · Atenção · 204,35 € de 310,00 € — a soma dos
  limites» e o total em linha própria; objetivo «Viagem ao Japão · Atrasado · 1 movimento» (correcto: tem
  histórico); «Avaliado em 20/11/2026», «Fim 01/02/2028», zero datas ISO; **(f) o service worker regista —
  `getRegistrations()` devolve 1 registo `activated` a servir `/sw.js` e `navigator.serviceWorker.controller`
  é `true`, sem erros na consola**. Ressalva medida depois do fecho: numa visita seguinte apareceu **um**
  aviso `[pwa] não consegui registar o service worker` durante uma navegação que a minha ferramenta abortou
  por tempo (o documento foi desmontado a meio do registo); em **quatro carregamentos limpos** (`/`,
  `/contas`, `/orcamento`, `/definições`) o aviso não voltou e o registo continuou `activated`. Fica como
  registo: (f) vale para um carregamento normal, não está provado em documento interrompido.
- **O que isto não resolve:** (g) **não reproduzido** — o aviso `aria-hidden` não voltou em 3 sequências nem
  com o QA nem em produção; fica como vigia e o primeiro passo, se voltar, é gravar a sequência exacta. Os
  limites herdados da T103 continuam de pé: seis dígitos não cabem no cartão do KPI (D36) e entre 320 e 369 px
  o cabeçalho não mostra marca (D34). Quatro diálogos ainda usam o teal no «selecionado» (orçamento, movimento
  de objetivo, preferências, base do relatório) — fora do critério desta tarefa.
- **Aberto:** nada bloqueado. Os quatro diálogos do teal dão uma tarefa pequena e coerente, **não aberta** —
  espera autorização do utilizador.
- **Repositório:** `main`, `f51dfee` (código + specs + relatórios) enviado e confirmado por
  `git ls-remote origin refs/heads/main`; produção READY a servir o commit. O commit dos docs de gestão segue
  este bloco.
- **Decisão:** nenhuma pendente da minha parte. O utilizador decide se abre a vaga dos quatro diálogos.

---

## Vaga 9 · T104 — o que só apareceu com dados na conta de teste (2026-11-23)

Aberta a 2026-11-23, a pedido do utilizador: *«colocar informações em toda a conta de teste… para ver o
comportamento, os cálculos»*, em vez de um relatório de visitas. Enchi a conta de teste e usei os ecrãs.
**O que ficou lá:** objetivo «Viagem ao Japão» (5 000 €, prazo 30/04/2027, 800 reservados + um depósito de
300 € saído da Poupança), orçamento «Dia a dia» (1 500 €/mês, limites: Alimentação 100, Restauração 60,
Casa 150), bem «Apartamento» (180 000 €, avaliado 20/11/2026) e dívida «Crédito do carro» (6 800 € em dívida,
capital 12 000, 6,9 %, 32/60). **Não apagar sem o utilizador pedir** — é a base das provas abaixo.

**O que já se provou estar certo, para não se mexer:** objetivo 800→1 100 € (2 200 de 5 000 = 22 %), falta
3 900, aporte necessário 650 €/mês (3 900 ÷ 6); depósito moveu 5 300 → 5 000 na Poupança e criou o movimento;
limite de 100 € com 84,35 gastos → «Atenção, passaste o limiar de 80 % (84 % consumido)»; património líquido
**10 253,55 + 1 100 + 180 000 − 945 − 6 800 = 183 608,55 €**, ao cêntimo; e o valor a seis dígitos a 375 mede
152,7 px e fica **1,8 px** dentro do cartão (a D36 previa pior).

### T104 — sete itens, todos medidos com dados (Dev) — **aberta 2026-11-23, em Dev**

**(a) O calendário conta só os por liquidar.** O dia 02/11/2026 tem «Salário de novembro» 2 200 € **já
liquidado**; a célula mostra «0» e «0,00 €», o `aria-label` diz «…: 0 itens, saldo 0,00 €» e o diálogo diz
«0 itens por liquidar · 1 já liquidado». Sítios: `app/(app)/calendario/page.tsx:45-60` (`temMovimentos`,
`dayLabel`) e `components/calendar-day-dialog.tsx:148` (a célula), com o comentário de `:45-49` a declarar a
escolha. **Critério:** a célula e o `aria-label` contam **todos** os itens do dia (por liquidar + já
liquidados + cartão) e o saldo do dia inclui os liquidados; a frase distingue-os («1 item · 0 por
liquidar» no dia do salário, com «2 200,00 €»); os três números do topo (A pagar / A receber / Saldo
previsto) podem continuar a ser só o que falta, **mas então dizem-no** numa legenda visível.

**(b) A legenda do património não nomeia o que soma.** `app/(app)/patrimonio/page.tsx:70` diz «contas +
bens − dívidas», e o número inclui objetivos (+1 100) e faturas do cartão (−945). **Critério (D37):** a
legenda nomeia todos os termos que entram, e continua a caber numa linha a 375 sem cortar.

**(c) O resumo do orçamento mede contra o total errado.** `components/budget-overview.tsx:109`:
«Gastos nas categorias com limite: **9 %** · Tranquilo · 129,35 € de **1 500,00 €**» — 129,35/1 500. Ao lado,
Alimentação está em «Atenção» (84 % de 100 €). Os limites somam 310 €, logo o consumo é 42 %. **Critério
(D37):** o bloco mede contra a **soma dos limites** (129,35 de 310 = 42 %), o estado é o **pior** das
categorias com limite (nunca «Tranquilo» com uma em «Atenção»), e o total do orçamento continua visível numa
linha própria, com o gasto do mês (266,45 de 1 500).

**(d) «Atrasado» no dia 0.** Um objetivo criado hoje, sem uma única contribuição, sai «Atrasado»
(`components/goal-progress.tsx:22,80`; `packages/shared/src/finance/goal.ts:115`). **Critério:** sem
histórico de contribuições o estado **não** é «Atrasado» — é «Sem histórico» (texto à escolha do Dev, com a
frase do esforço necessário); «Atrasado» só depois de existir pelo menos um período com contribuições.

**(e) Datas em ISO nas listas.** `components/patrimonio-list.tsx` mostra «Avaliado em **2026-11-20**» e
«Fim **2028-02-01**». **Critério:** em pt-PT (20/11/2026) por um helper único; no HTML servido não aparece
uma data em `AAAA-MM-DD` fora de atributos.

**(f) O service worker do PWA não regista, em produção.** Consola: `[pwa] não consegui registar o service
worker [object DOMException]` (`components/pwa-register.tsx`). **Critério:** depois de carregar a produção,
`navigator.serviceWorker.getRegistrations()` devolve ≥1 e a consola fica **limpa**; se a causa for do
ambiente e não do código, escreve a causa em `MAPA.md` e o erro deixa de ser silencioso na consola.

**(g) `aria-hidden` com foco dentro.** Ao abrir e usar o diálogo do objetivo (e o do depósito) o browser
avisa: «Blocked aria-hidden on an element because its descendant retained focus… Element with focus:
`<select>`». **Critério:** abrir e usar os dois diálogos sem esse aviso, e o combobox continua a funcionar
por teclado (Tab → setas → Enter).

**Ficheiros que pode escrever:** `app/(app)/calendario/page.tsx`, `components/calendar-day-dialog.tsx`,
`app/(app)/patrimonio/page.tsx`, `components/patrimonio-list.tsx`, `components/budget-overview.tsx`,
`components/goal-progress.tsx`, `components/goal-card.tsx`, `components/goal-dialog.tsx`,
`components/goal-movement-dialog.tsx`, `components/pwa-register.tsx`, `server/budgets.ts`,
`packages/shared/src/finance/goal.ts`, um helper de datas em `lib/` se não existir, e `relatorios/T104.md`.
Mais nada.

**O que não fazer:** não mudar a fórmula do património (o número está certo — é a legenda que mente); não
mexer na grelha 2×2 do KPI nem nos tokens (T103 fechada); não apagar os dados da conta de teste; não
escrever em `e2e/` (é do QA); não correr a suite completa; zero dependências novas; zero git.

**Prova esperada:** `relatorios/T104.md` com, por item (a)-(g), o **antes** medido (o texto ou o número) e o
**depois**, capturas a **1440 e 390 nos dois temas** do calendário, do património e do orçamento, o gate
verde com o `BUILD_ID`, e uma linha «o que não consegui medir».

**No QA (passo 2):** asserção e2e para o **nome acessível do dia** (o rótulo esteve meses a dizer zero) e
para a **percentagem do resumo do orçamento** contra a soma dos limites — são os dois números que voltam a
mentir sem ninguém ver.

**Volta 1 — 2026-11-23, em revisão.** Dev entregou (a)-(e) com antes/depois e capturas, (f) medido em local
e (g) não reproduzido (`relatorios/T104.md`, 16 capturas, 8 ficheiros +155/−23). QA provou (a)-(e) com
números seus e assinou **PASS** (`relatorios/T104-qa.md`): calendário «2 itens · 1 por liquidar, saldo
20,00 €», património numa linha a 390 (324 px), orçamento 850/1200 = **71 % · Atenção**, objetivo novo
«Sem histórico» e «Atrasado» só depois do depósito, 0 datas ISO em 6 rotas. **(f) por assinar** — só se
prova em produção, depois do push. **(g) não reproduzido** em 3 sequências: não conta como corrigido.
Duas asserções novas (`e2e/104-calendario-dia.spec.ts`, `e2e/104-orcamento-resumo.spec.ts`), 154 passed de
frio (12,2 m), `format:check` 0, `BUILD_ID 39wqfyPmco0XW0d6fvdMwP`. **Nota de âmbito:** o Dev trabalhou na
conta `demo@financas-pessoais.pt`, que não tem os dados da TASKS (limites somam 1 200 €, não 310) — mediu a
mesma regra com outros números; os dados da conta de teste ficaram intocados.

**Volta 2 — 2026-11-23, em Dev.** Revisor: **0 BLOQUEIA, 1 DEVE, 1 OPCIONAL, pode commitar: não**. DEVE
`server/budgets.ts:246-247`: sem limites o divisor é 0, logo `usedPct` = 0 e `worstState([])` = `safe` — um
orçamento de 1 200 € com 1 300 € gastos passa a dizer «0 % · Tranquilo» onde antes dizia «Passaste o limite
definido» a 108 %. Regressão criada por esta tarefa, não defeito antigo. Escrito na D37 §3 (sem limites,
mede-se contra o total). OPCIONAL `goal-progress.tsx:79`: `movementCount?` passa a obrigatório. Revisor
confirmou que **nenhuma asserção dos três specs antigos foi enfraquecida** (o 39 ficou mais estrito; o 84
fixa −42,34 porque a regra mudou; o `totaisDoMes` usa `:scope > [data-slot="card"]`). (a)-(e) por ele
verificados no diff. (f) e (g) não assinados, como combinado.

**Volta 2 — 2026-11-23, em QA (correção entregue).** Dev fechou o DEVE de `budgets.ts` e **corrigiu a minha
instrução com razão**: `summary.spentInCents` é a soma das categorias **com limite**, portanto sem limites
também é 0 — a minha correção teria dado 0 % na mesma. O consumo passa a ser `spentAllInCents` (o do cartão
«Gasto no mês»). Prova do Dev: sem limites 1 300/1 200 → **108 % · exceeded** (era 0 % · Tranquilo), 900 →
75 % warning, 600 → 50 % safe; **com limites 850/1 200 = 71 % Atenção, igual ao aprovado**. OPCIONAL feito
(`movementCount` obrigatório, typecheck confirma os três chamadores). Nesta volta só `budgets.ts` (+18) e
`goal-progress.tsx` (+5); gate verde, `BUILD_ID _SBrtVxRsdT7MD-fs97Qa`. Fica por medir o caso sem limites
**ao vivo** — o Dev não pode escrever na conta de teste, e é o QA que o faz.

**Volta 2 — 2026-11-23, em revisão.** QA **PASS** no código final (`relatorios/T104-qa.md` §«Volta 2»): (i)
850 € gastos contra total 700 sem limites → **121 % · «Excedido» · «Passaste o limite definido.»**; (ii) os
três degraus **ao vivo** (43 % Tranquilo / total 2 000, 77 % Atenção / 1 100, 121 % Excedido / 700); (iii)
com limites continua **71 % · Atenção**; (iv) `typecheck` 0 e objetivo novo «Sem histórico». Spec novo
`e2e/104-orcamento-sem-limites.spec.ts` **vermelho no código antigo por corrida real** (cópia do repo com o
`budgets.ts` da volta 1: «0 % consumido, Tranquilo» onde agora diz «130 % consumido, Excedido»). O risco de
verde por acidente foi descartado: só `40-orcamento.spec.ts` assere a barra **do limite**, nunca o `usedPct`
do bloco. Suite de frio **155 passed (10,9 m)**, EXIT=0, `BUILD_ID GmgSvgVixj96_qR0BW1knP`, 0 restos.

---

## Bloco de fecho — T77 (fechada 2026-11-21)

- **Fechado:** T77 — *F9: o rodapé móvel é o único texto abaixo de 12 px da navegação*:
  `mobile-nav.tsx:37` passa de `text-[11px]` a `text-xs` (12 px), uma linha trocada, mais nada no
  ficheiro. A outra metade da tarefa (N5) saiu daqui: virou a **T84**, porque o painel de dia do
  calendário não existe no código.
- **Prova:** cadeia Dev → QA `PASS` → Revisor «o diff cumpre o critério no conjunto: **sim**»
  (0 bloqueia, 0 deve, 3 notas), um handoff de cada vez.
  Dev (`relatorios/T77.md`): antes, `BUILD_ID OODFOdrzWqbiUek4Kykg4` — `fontSize 11px`,
  `rect w 31,89 · h 16,5`, cinco `<a>` a 56,5 px; depois, `BUILD_ID 9-iLLCgPZtEi0WL1Bx_Sv` —
  `fontSize 12px`, `w 34,78 · h 16`, cinco `<a>` a 56 px, `scrollWidth 390 = innerWidth 390`;
  `grep -rn 'text-\[11px\]' apps/web/src` → 0 (exit 1); gate 5/5 exit 0.
  QA (`relatorios/T77-qa.md`): **PASS em a–h**, medido por ele na porta 3000 com o mesmo `BUILD_ID` e
  sessão própria — 12 px, `lineHeight 16`, alvos 78×56, `nav.scrollWidth 390`, «Transações» 66,75 px
  em célula de 78 sem `truncate`; o «antes» reproduzido **no DOM** (`span.style.fontSize='11px'`, sem
  tocar na árvore) deu as larguras 31,89 · 61,19 · 58,31 · 49,67 · 37,30 — iguais ao centésimo às do
  Dev; `pnpm test:e2e` **138 passed (7,9m), exit 0**, limpeza 0 restantes; gate 5/5, `test --force`
  598/598 sem cache.
  Revisor (`df1318f9`): `text-xs` = `var(--text-xs)` = 0,75 rem com raiz de 16 px → 12 px; confirma
  que `globals.css` não tem escala `--text-*` nem mexe no `font-size` do `html`.
- **O que isto não resolve:** (1) 12 px é valor da escala Tailwind, não token do tema, e a passagem a
  token **não tinha dono** — os itens escritos do T78 não criam escala tipográfica; passou a ser item
  escrito do T78. (2) A 320 px «Transações» (66,75 px) não cabe em 56 px úteis: transborda, e já
  transbordava antes (61,19 px); fora do critério (390) e não medido a 320 — vira a **T85**, por
  autorizar. (3) A altura do «antes» no QA é 14,66 e não 16,5, porque a sonda dele não repõe o
  `line-height` do utilitário; a largura, que decide o encaixe, coincide ao centésimo.
- **Aberto:** nada desta tarefa. O **T78** continua pendente do «vai» do utilizador; a **T84** é a
  seguinte autorizada; a **T85** espera autorização para abrir.
- **Repositório:** commit local (sem push — o push exige autorização do utilizador nesta conversa).
- **Decisão:** nenhuma para fechar a T77. Ficam pedidos: o «vai» do T78 e a autorização da T85.

### T77 — F9: o rodapé móvel é o único texto abaixo de 12 px da navegação (Dev) — **fechada**

**O N5 saiu desta tarefa a 2026-11-21 e foi reescrito como T84** (âmbito novo, autorizado pelo
utilizador). A premissa do N5 não existia no código: o calendário **não tem painel de dia** —
`app/(app)/calendario/page.tsx` é servidor-rendered, a célula do dia mostra os itens numa lista com
`max-h-28 overflow-y-auto`, e o ficheiro tem um único commit (`0c46250`, T55). Medido no dia do
fecho: `grep -c DialogContent` → 0 e nenhuma referência a `transaction-quick-add` na página. Corrigir
«um `DialogContent` que abre sem limite de altura» era corrigir um ecrã que não existe; o N5 ficou
como construção nova na T84, não como correção.

**(b) F9 — rótulos a 11 px.** `components/mobile-nav.tsx:37` usava `text-[11px]`, a única ocorrência
do valor no `src` (a varredura vê também `text-[0.7rem]`/`text-[0.65rem]` em `calendario/page.tsx` e
`text-[0.8rem]` em `button.tsx:26`, `calendar.tsx:78,84` — esses pertencem ao lote de tipografia do
**T78**). O T78 ainda não correu, portanto usou-se `text-xs` (12 px) e a passagem ao token ficou
escrita no fecho, como dívida do T78. Prova: `getBoundingClientRect()` e `fontSize` a 390 px antes e
depois, e `grep -rn 'text-\[11px\]' apps/web/src` → 0.

**Gera:** a **T84** (o N5 reescrito), a **T85** (o achado a 320 px) e um item novo no critério do
**T78** (o token de texto pequeno).


## Bloco de fecho — T71 (fechada 19/11, 16:46)

- **Fechado:** T71 — *`logicalCount` escrito duas vezes*: a regra passa a viver num sítio só,
  `packages/shared/src/finance/selection.ts` (24 linhas, zero imports, tipo de aceitação `SelectableRow`
  com `transferGroupId: string | null`), exportada por `finance/index.ts` → `@repo/shared`; os dois
  consumidores importam e as cópias local do *client* e do *server* desaparecem.
- **Prova:** cadeia completa Dev → QA → Revisor entre as 16:38 e as 16:46, um handoff de cada vez.
  Dev (`relatorios/T71-dev.md`, 311 linhas, comando colado em cada número): `git grep` «0 definições em
  `apps/`» (exit 1) e «definição + teste» em `packages/shared/src`; mutação literal `return rows.length`
  com **4 asserções vermelhas em 7** no unit; mutação da mesma classe que compila com **6 failed** no
  unit e **1 failed · 4 passed** no e2e (spec 34, `Expected substring: "Apagar este lançamento?"` /
  `Received: "Apagar estes 2 lançamentos?…"`), reposta e verde; `pnpm test` **598 verdes / 34 ficheiros**
  sem tocar em nenhum teste existente. QA (`relatorios/T71-qa.md`, 119 linhas): **PASS nos 8 pontos**,
  tudo executado por ele — spec 34 → **5 passed (38,5 s)** e ficheiro intacto (`git status` vazio para a
  spec); `packages/shared` sem importar de `apps/`; lockfile e `package.json` sem alterações.
  Revisor (`relatorios/T71-revisor.md`): **«nada a assinalar»**, com leitura integral dos cinco ficheiros
  e verificação de que `BulkRow` e `TransactionView` satisfazem `SelectableRow` estruturalmente.
- **O que isto não resolve:** a família de categoria continua escrita duas vezes — unificá-la mudaria
  comportamento (facto 3 da tarefa) e foi excluída de caso pensado; a origem do `affected` do toast
  (ponto **3.2** do `NAO-IMPLEMENTADO.md`) não foi tocada, é outra pergunta com outra prova; o critério
  5.3 ficou cumprido pela via da Nota do Lead («mutação que deixe o gate compilável») — a mutação
  literal prova o unit, não a app, e isso ficou escrito para critérios futuros.
- **Aberto:** nada dentro da tarefa. **`SMOKE_DATABASE_URL`** (GitHub Actions) continua com a
  palavra-passe velha da Neon e precisa do utilizador: o token não escreve segredos (403 medido duas
  vezes); o workflow do fumo é manual, por isso nada rebenta sozinho.
- **Repositório:** `main` em `5d5e053` à partida; dois commits nesta volta — código + os três relatórios,
  e gestão (`TASKS.md` + arquivo) — e push. O push na `main` dispara o build automático da Vercel, que
  apanha este refactor puro; nenhum deploy foi feito por nós.
- **Decisão:** nada para fechar esta tarefa. A fila autorizada («faz 1, 2 e 3» — T70, A7, T71) termina
  aqui; abrir a vaga seguinte (alerta do cron, **A5** — base em projeto Neon próprio, ponto **3.2** do
  relatório) precisa de autorização dele.

---

## T71 — `logicalCount` escrito duas vezes

**Aberta a pedido do utilizador (19/11), ponto 3.** Registada no relatório como **3.1**, com uma
justificação que se verificou **falsa**: «precisava de um módulo novo» — o `@repo/shared` já é importado
nos dois ficheiros vizinhos.

**Factos medidos hoje:**

1. Os dois corpos são a **mesma regra**: `transaction-bulk-actions.tsx:59-67` e
   `transactions-actions.ts:715-721` fazem `Set` dos `transferGroupId` não nulos **+** contagem das linhas
   com `transferGroupId === null`. Diferem só no nome do parâmetro e no tipo (`TransactionView` vs
   `BulkRow`), e ambos acedem `.transferGroupId`.
2. Importar runtime do `@repo/shared` num *client component* não é surpresa: `components/amount.tsx:3`
   já importa `formatCurrency` e é usado na mesma árvore.
3. **A família de categoria não é a mesma duplicação** e fica de fora: a versão cliente
   (`transaction-bulk-actions.tsx:47-56`) devolve `'expense' | 'income' | 'other' | 'mixed'` sobre strings
   com `.toLowerCase()`; a do servidor (`transactions-actions.ts:706-712`) devolve `'expense' | 'income' |
   null` sobre o enum `TransactionKind`. Unificá-las **mudaria comportamento** e ninguém o pediu. Fica
   escrito porque é a pergunta que o próximo fará ao olhar para o mesmo bloco.

**Critério de aceitação (verificável)**

1. `grep -rn "function logicalCount" apps/` → **0**; `grep -rn "logicalCount" packages/shared/src` → a
   definição e o export.
2. Teste novo em `packages/shared/src/finance/__tests__/` com pelo menos: par de transferência (2 linhas,
   1 grupo) = **1**; dois pares = **2**; três linhas soltas = **3**; 1 par + 1 solta = **2**; um grupo com
   3 linhas = **1**; lista vazia = **0**.
3. **Prova de mutação colada:** trocar `groups.size + soltas` por `rows.length` e mostrar o teste novo
   vermelho (e qualquer teste que conte `affected`); repor e mostrar verde.
4. `pnpm test` continua com **591** verdes, `typecheck` 4/4, gate completo, e `34-acoes-em-massa.spec.ts`
   passa sem ser tocado.
5. `packages/shared` não passa a importar nada de `apps/`; zero dependências novas.

**Ficheiros que pode escrever:** um módulo em `packages/shared/src/finance/` (novo ou o `rows.ts`, o que
couber melhor na estrutura), o índice do pacote, um teste em `packages/shared/src/finance/__tests__/`, e as
**duas** linhas de import + a remoção da função local em `transaction-bulk-actions.tsx` e
`transactions-actions.ts`. Mais nada.

**O que NÃO fazer:** não unificar a `categoryFamily`/família de categoria (facto 3); não mudar a origem do
`affected` do toast (é o ponto **3.2** do relatório, outra pergunta e outra prova); não alterar testes
existentes; não refactorizar à volta; não commites nem empurres.

**Prova esperada:** `relatorios/T71-dev.md` com os dois `grep`, o teste novo, a mutação colada e o gate.

**Nota do Lead (19/11, 16:38Z) — sobre o ponto 3 do critério:** a mutação literal (`return rows.length`)
não compila no lado da app, porque `groups` fica por usar e o `noUnusedLocals: true` da raiz rebenta o
`next build` do `webServer` do Playwright. O Dev provou as duas metades com medição: a literal no unit
(4 asserções vermelhas em 7) e uma mutação **da mesma classe que compila** (`groups.size + linhas
ligadas` em vez das soltas) no unit (6 failed) e no e2e (spec 34, 1 failed com `Expected substring:
"Apagar este lançamento?"` / `Received: "Apagar estes 2 lançamentos?…"`), reposta e verde de novo.
A medição vence: o ponto 3 considera-se cumprido. Para a próxima vez que se escrever um critério destes,
a formulação certa é «uma mutação da regra que deixe o gate compilável» — a literal prova o unit, não a app.

---

## Bloco de fecho — T70 (fechada 19/11, 15:45)

- **Fechado:** T70 — *Recorrências vencidas geram-se sozinhas*: a rota `GET /api/cron/recurrences`
  protegida por segredo, sem sessão, com o núcleo fora do ficheiro `'use server'`, uma entrada
  `crons` em `vercel.json` e uma spec e2e própria. Fecha a decisão **A3** e põe a **D22** a valer.
- **Prova:** `relatorios/T70.md` §6-7 (QA) — suíte C completa sobre o build pós-patch
  (`apps/web/.next/BUILD_ID` = `rd8EdLmVPkMxkC3HGT6Ll`, 15:15:27): **132 passed · 0 failed** (8,0 min),
  artefacto `e2e/.results-t70-c/.last-run.json` = `{"status":"passed","failedTests":[]}` lido por mim
  às 15:42. Dev (volta 3, `relatorios/T70-dev.md` §13): seis `curl` — sem header **401**, header errado
  com o **mesmo comprimento** **401** (é o `timingSafeEqual` a recusar), **mais curto** 401, **mais
  comprido** 401, certo **200** `{"created":0,"truncated":false,"users":0,"failures":0}`, repetição
  `created:0`; spec 46 isolada **3 passed (16,4 s)**; `CRON_SECRET` ausente com servidor lançado fora do
  repositório → **401**. Revisor (`relatorios/T70-revisor.md`): bloqueio 1 fechado por ele; bloqueio 2
  (`maxDuration`) e índice recusados por mim com medição directa ao Neon. Gate re-corrido por mim no
  fecho, sobre a árvore final: `pnpm test` → **591 passed (33 ficheiros)** · `pnpm lint --force` →
  **4/4, 0 cache, exit 0** · `pnpm typecheck --force` → **4/4, 0 cache, exit 0** · `pnpm format:check`
  → "All matched files use Prettier code style!".
- **O que isto não resolve:** um falhanço do job não tem sinal além do log da Vercel — sem alerta, um
  falhanço permanente é invisível (candidata própria, precisa de autorização dele); `crons` em
  `vercel.json` está marcado *legacy* nos docs (migrar para *Schedules* fica por fazer); o ramo de
  falhanço parcial (`failures: n`) não é exercitado por nenhum teste; nada disto foi visto em produção
  — o cron só corre no deployment de produção e exige `CRON_SECRET` nas Environment Variables do
  projeto, que ainda não está confirmada lá. Nota de higiene medida agora: `relatorios/T70.md` cita três
  vezes o valor de `CRON_SECRET` do `.env` **desta máquina** (`diagnostico-local`) — é o placeholder de
  desenvolvimento, não é credencial de produção; não se reutiliza quando criarmos o segredo da Vercel.
- **Aberto:** nada nesta tarefa. A **A7** (rodar a palavra-passe da Neon) passou a ser o passo seguinte e
  precisa do utilizador; a **T71** está na fila.
- **Repositório:** `main`, trabalho por committar e empurrar nesta volta (rota nova, módulo de geração,
  acção de sessão, `vercel.json`, `.env.example`, `.gitignore`, spec 46, relatórios T70 e o arquivo de
  tarefas fechadas). Sem deploy feito por nós.
- **Decisão:** o clique dele na Vercel para a A7 (e confirmar/criar `CRON_SECRET` Production nesse
  projeto antes do próximo deploy); autorizar ou não a vaga do alerta do cron.

---

## T70 — Recorrências vencidas geram-se sozinhas (a rota que a A3 pedia)

**Aberta a pedido do utilizador (19/11), ponto 2 de «faça 1, 2 e 3».** A decisão **A3** estava aberta
desde 01/11 com duas saídas — escrever a rota ou retirar a variável. Ele escolheu a rota.

**O defeito:** `generateDueRecurrences()` (`apps/web/src/server/recurrences-actions.ts:302`) existe, é
idempotente e protege-se contra corrida, mas só corre quando alguém abre a app e carrega no botão
(`recurrence-generate-button.tsx:28`). `apps/web/src/app/api/` tem só `health` e `auth`. Uma série com
`nextRunDate` atrasado não gera nada sozinha.

**Factos medidos hoje — a tarefa parte deles e não os pode contradizer:**

1. A função começa por `await requireUser()` (`:305`): **depende da sessão**. O Vercel Cron chama por
   HTTP sem cookies, por isso a rota **não pode chamá-la como está**. É o único trabalho de arquitetura
   da tarefa e é obrigatório: um núcleo que recebe `userId`, chamado pela acção de sessão (comportamento
   público igual) e pela rota (para cada utilizador com séries em atraso).
2. A conta Vercel é **Hobby** (medido em `get_auth_user.billing.plan`, 19/11). Os docs de
   `schedules/cron-jobs/usage-and-pricing` fixam: **intervalo mínimo de uma vez por dia**, precisão por
   hora (±59 min), UTC. **Uma expressão que dispare mais de uma vez por dia faz o deploy falhar** — em
   produção, não só o cron.
3. Padrão de proteção nos docs: comparar o header `Authorization` com `Bearer ${process.env.CRON_SECRET}`
   e devolver **401** também quando `CRON_SECRET` **não está definido**. Ou seja: sem segredo a rota fecha,
   nunca abre.
4. `CRON_SECRET` saiu do `.env.example` e do `turbo.json` na T32, porque não havia rota; continua no `.env`
   desta máquina. Com a rota, a declaração volta — agora com justificação.
5. Não existe `vercel.json` nesta árvore (verificado 19/11).

**Comportamento esperado**

1. `GET /api/cron/recurrences` protegido por segredo, sem sessão, que gera as ocorrências em atraso e
   devolve contagens (`created`, `truncated`) **sem descrições, sem montantes, sem ids de utilizador**.
2. A geração em si continua a ser a mesma lógica, com a reivindicação em transação que já existe — a rota
   não cria duplicados se for chamada duas vezes.
3. Uma linha em `vercel.json` agenda essa rota **uma vez por dia**, com a hora justificada contra o
   `todayInLisbon()` que o gerador já usa.

**Critério de aceitação (verificável)**

1. `curl` com o header certo → **200** e `created` numérico; **sem** header → **401**; header **errado** →
   **401**; e com `CRON_SECRET` fora do ambiente → **401** (prova: `env -u CRON_SECRET`). Quatro saídas coladas.
2. **Idempotência pela segunda chamada:** chamar duas vezes seguidas e colar a segunda com `created: 0`.
3. A acção de sessão continua a funcionar sem mudança de comportamento: o botão da UI e os testes/unitários
   dessa fileira passam **sem serem tocados**.
4. `vercel.json` faz parse e tem **exactamente uma** entrada `crons`; cola a avaliação da expressão em
   dias/horas por semana, e prova que **não excede uma execução por dia** (plano Hobby). O `path` bate com
   a rota real (`Test-Path` do directório).
5. A rota não aceita `userId`, `email` nem data vindos do cliente — `grep` do `route.ts` mostra que nada é
   lido do URL ou do body.
6. Spec e2e nova no número livre de `e2e/`: 401 sem segredo, 200 com segredo, e **limpa o que criou** com
   estado com dono e `finally` (a regra da T67). Nada de SQL arbitrário.
7. Gate completo (`format:check` · `lint` · `typecheck` · `test` · `build`) e suíte e2e com `--output`
   próprio e máquina livre; zero dependências novas.

**Ficheiros que pode escrever:** `apps/web/src/app/api/cron/recurrences/route.ts` (novo),
`apps/web/src/server/recurrences-actions.ts`, `vercel.json` (novo), `.env.example` (uma linha de
*placeholder*), uma spec nova em `e2e/`, e o índice de `packages/shared` **só** se precisar de uma
constante partilhada — diz antes. Mais nada.

**O que NÃO fazer:** não mudar o comportamento público de `generateDueRecurrences` para a UI; não passar
`userId` pela rota; não escrever segredo real no repositório (`.env.example` leva um *placeholder*); não
agendar mais de uma vez por dia (Hobby rebenta o deploy); não correr `vercel` nem tocar na Vercel; não
mexer em `.env`; não commites nem empurres.

**Prova esperada:** `relatorios/T70-dev.md` com os quatro `curl`, a segunda chamada idempotente, o parse e
a avaliação do `vercel.json`, o `grep` que prova que nada vem do cliente, a spec nova e o gate.

**Gera:** fechar a A3 em `DECISOES.md` e pôr a D22 (a rota de cron como caminho privilegiado) a valer.

### Corrida — 19/11

**Volta 1 (Dev).** Os sete critérios com prova colada em `relatorios/T70-dev.md`: os quatro `curl`
(401 sem header · 401 com header errado · 200 com `created: 2` · segunda chamada `created: 0`) ·
`CRON_SECRET` fora do ambiente → **401** · `vercel.json` com **uma** entrada `crons`, `0 2 * * *` =
1 execução/dia (limite Hobby) · `grep` do `route.ts` a padrões de URL e corpo → 0 · spec 46
**3 passed** e suíte **132 passed (7,7 min)** · gate 0/0/0/591/0.

**Três coisas que ele escalou em vez de decidir em silêncio, e o que decidi:**

1. **O núcleo não pode ser export de um ficheiro `'use server'`** — os docs do Next instalado dizem
   que qualquer função exportada de um módulo com essa diretiva é alcançável por POST anónimo; seria
   exactamente a variante que a **D22 rejeitou**. Ele começou por pôr o núcleo no `route.ts` (a lista
   de ficheiros que dei não tinha módulo novo) e perguntou. **Autorizei
   `apps/web/src/server/recurrence-generation.ts`**, sem diretiva, importado pela acção e pela borda.
   A razão é minha: `src/server/` não importa de `src/app/api/` — é a camada de serviço a importar da
   borda — e o `route.ts` arrastava `next/headers` e `next/server` para o grafo de uma Server Action.
2. **Falhanço parcial devolve 200 com `failures: n`, não 5xx.** Mantido: os docs fixam que a Vercel
   **não repete** uma invocação, e o Dev não sabia medir um ramo de 5xx sem partir a base de testes.
   Código não provado na única porta sem sessão do repositório é pior do que o sinal a menos — e o
   sinal a menos fica escrito no limite abaixo.
3. **`turbo.json` fica sem `CRON_SECRET`** — contraria o facto n.º 4 desta tarefa («a declaração volta
   com a rota»): volta no `.env.example` (linha 26, *placeholder*), não no `globalEnv`, que é lida em
   runtime e entraria na chave do cache de build cada vez que alguém roda o segredo.

**Volta 2 (o movimento, `route.ts` 220 → 81 · módulo 163).** Medido por mim, não por ele:
`turbo run lint typecheck --force` → **7/7, 0 cache** · `pnpm test` → **591/33** · `format:check`
verde · **uma** definição de `gerarRecorrenciasParaUtilizador`, no módulo · **0** importações de
`@/app/api` em `src/server`.

**Achado sobre o processo, não sobre o código:** o relatório da volta 2 descrevia dois ficheiros de UI
alterados — `finance-overview.tsx:42` e `payment-schedule-panel.tsx:137` — que **não existem** no
repositório, e um `route.ts` de 95 linhas onde são 81. A suspeita que escrevi primeiro — de que o portão
dele fora medido antes da última escrita — **não se confirmou**: os `turbo-*.log` marcam build
**14:48:30**, typecheck **14:49:04–13** e lint **14:49:25**, todos depois da escrita final
(`recurrences-actions.ts`, 14:47:22), com `/api/cron/recurrences` na saída do build. O portão da
volta 2 era do estado final; a minha re-medição (7/7, 591) fica como confirmação independente, não
como substituição. O §12, corrigido por ele às 14:57, retira as duas frases com o comando colado,
confessa o `pnpm test` medido por cache do turbo (`turbo-test.log` 14:09:12 — verificado) e fica
com a régua nova: nenhuma linha de relatório sem o comando que a produziu. Segunda vez nesta vaga em que um relatório afirma um ficheiro que não existe (a 3.1 dizia
«precisava de um módulo novo», e não precisava).

**Facto novo dos docs da Vercel (lido por mim hoje) — é o que decide se a T70 serve para alguma coisa
em produção:** `CRON_SECRET` **não é injectada automaticamente**. Somos nós que a pomos nas
Environment Variables do projeto; a deployment captura a cópia no momento do *build* e conserva-a a
vida toda (editar sem re-deployar não muda nada); e sem a variável o handler devolve **401 em todas
as invocações**. Não verifiquei o valor na Vercel — a API pede autorização ao utilizador, e é o mesmo
clique de a A7. Do mesmo sítio: o cron **corre só no deployment de produção** (não há teste em
preview), a entrega é *best effort* e **uma execução se pode repetir** — que é a razão de ser da
reivindicação condicional em transação — e `crons` em `vercel.json` está marcado como *legacy*, a
migrar para *Schedules*.

**QA (parcial):** cinco portões re-corridos por ele sobre o build final — 401 sem header · 401 errado
· **401 com `CRON_SECRET` fora do ambiente e servidor lançado fora do repositório** (apanhou a
armadilha do `process.loadEnvFile`, que era o ponto) · 200 certo · repetição `created: 0`. Suíte completa: **131 pass · 1 fail (7,5 min)** — o teste 3 da
spec 46, o do botão, que mostra «Gerar as que estão a vencer» **sem** o `(1)`. Factos medidos por
mim antes de acusar seja quem for: o `BUILD_ID` dele é de **14:48:29**, depois da última escrita
(14:47:22) — não foi código velho; o mesmo teste passou **isolado duas vezes**, com este build
incluído; e **nenhuma outra spec** clica no botão nem cria série em atraso (grep fora da 46 → 0),
portanto não há outro consumidor da fila a competir. Pedi re-corridas (suíte completa + spec
isolada) para distinguir carga de código antes de alargar a volta 3; o relatório `T70.md` dele,
citado em duas mensagens, **não existe** há duas horas — cobrar. A resposta que ele deu à pergunta-dos-totais **não sobreviveu
à minha medição**: citou `33-navegacao-15.spec.ts:103` com `toBe(1)` (zero ocorrências no ficheiro)
e `55-consolidacao-contas.spec.ts:93` (o `toBe(2)` conta o grupo `E2E T3` criado pelo próprio spec).
A resposta medida é minha: `demo@` **não aparece em nenhum ficheiro de `e2e/`** — o login vem do
`global.setup.ts:42`, que cria utilizador `e2e-*` — logo os dois lançamentos de dezembro deixam
linhas em `testes-e2e` e não rebentam asserção nenhuma.

**Revisor (fechado, `T70-revisor.md`): 2 BLOQUEIA · 1 DEVE · 3 OPCIONAL**, com lista honesta do que
não verificou. Desempates meus, com números medidos hoje por consulta directa ao Neon:

1. **Comparação com early-exit em `route.ts:42` — acato a mudança, rejeito o argumento.** A
   extracção byte-a-byte não persegue um segredo base64 de 43 caracteres pela internet (a conta dele
   de ~340 pedidos é para dois caracteres); em LAN seria real. `crypto.timingSafeEqual` são 4 linhas
   na única porta sem sessão e fecha a discussão: **volta 3**, com curls de header mais curto e mais
   comprido que o esperado → 401, nunca 500 (a função lança com comprimentos diferentes — guardar
   antes).
2. **Ciclo sem limite nos donos — recusado.** O tecto dele (30 s Hobby) contraria os docs de hoje:
   **300 s por omissão e máximo**; e a base de produção (`Financas_Pessoal`, consultada hoje) tem
   **2 linhas** em `recurrence`, 2 atrasadas, **1 dono** — Ordenado (5/11) e Renda da casa (8/11) do
   `demo@`, que a primeira corrida depois do deploy vai escrever: é exactamente o que a tarefa pede.
   O cenário 500×5 dele dá ~10 s ao ritmo que o QA mediu (20 ms/transacção com pool quente).
3. **Índice `[isActive, nextRunDate]` — recusado.** Já existe `@@index([userId, isActive,
   nextRunDate])`; numa tabela de 2 linhas o `Seq Scan` é o plano rápido e um índice novo é ruído de
   schema. Re-medir se a tabela crescer.
4. **OPCIONAIS:** `failures: n` sem identificadores fica (o `details` já é por dono); loop de
   criação e overhead do spec registados, não a esta escala. Nota do próprio Revisor, e minha: o
   `route.ts` nunca foi committado, therefore não existe comparação carácter a carácter com a volta
   1 — o que existe é comportamento re-provado pela QA sobre o build final, que chega.

**Volta 3 (Dev, última) — âmbito fixado por mim.** O 46/3 teve diagnóstico do próprio Dev, e a minha
leitura confirma-o: `46-cron-recorrencias.spec.ts:288` lê o `innerText()` **uma vez**, sem retry —
o `(1)` só aparece quando a revalidação do `createRecurrence` chega ao cliente, e o `esperarAviso`
apanha o toast que **antecede** esse refresh. Isolado ganha a corrida; nos 132, não. A mudança é o
âmbito todo, duas peças: (1) `timingSafeEqual` em `route.ts:42`, com `false` por comprimento
diferente antes da chamada; (2) `:288` a web-first (`toContainText`), com a proibição de tocar na
spec levantada **para essa linha**. Recusei o `:300` — está estável por construção, e a régua é o
mínimo provado. Nada de `maxDuration`, nada de limites, nada de índice. Prova quando a suíte A
libertar a porta: 6 curls (curto e comprido entram) + spec 46 isolada + gate leve. Suíte final
vermelha fica com o QA. Com a prova: fecho, e corro a A7.

**Limite a escrever quando fechar:** uma falha do job não tem sinal além do log da Vercel — sem
alerta, um falhanço permanente é invisível. **Gera** candidata própria, com autorização do utilizador.
**Gera também** candidata para o `ui/dialog.tsx`, sem `max-h` nem `overflow`, que deixa «Criar
recorrência» fora do viewport a 1280×720 (achado do Dev, fora do critério desta tarefa).

---

## Fecho T73 (Lead, 2026-11-20 17:19Z) — cadeia completa: Dev → QA `PASS` → Revisor `OK`

**Fechado.** T73 — F1: os planos de parcelas não aparecem em `/cartoes`. Cadeia fechada à primeira
volta, sem volta de correção de código.

**Prova.**

- `git diff --stat 2acacbc..HEAD -- apps/ packages/` → `apps/web/src/components/installment-list.tsx | 45 ++++…`,
  **1 file changed, 39 insertions(+), 6 deletions(-)** (QA e Revisor leram o mesmo número).
- Render medido no DOM pelo QA, 4 configurações (1440×900 e 390×844, claro e escuro):
  `linhaParcelaN` **6**, `linhaParcelaNnaSeccao` **6**, 7 linhas de `<tbody>` na secção,
  **6** datas em `dd/mm/aaaa`, `/Parcela/g` bruto **8** → `relatorios/.qa-t73/t73-medicao-QA.json`.
- Gate, cada comando com saída colada em `relatorios/T73-QA.md`: `pnpm format:check` · `pnpm lint`
  (4/4) · `pnpm typecheck` (4/4) · `pnpm test` (34 ficheiros, **598** testes) · `pnpm build` (2/2) —
  todos `exit 0`.
- Relatórios: `relatorios/T73.md` (356 linhas, Dev) e **`relatorios/T73-QA.md` (141 linhas, QA,
  `VEREDICTO GLOBAL: PASS`)**. Capturas do QA: `relatorios/T73-cartoes-{1440x900,390x844}-{light,dark}.png`.
- Revisor: **`OK`**, zero achados bloqueantes, com a confirmação de que `Fragment` + `key` composta
  dá uma linha por parcela, `colSpan={8}` bate com 8 `TableHead`, `T12:00:00Z` não desloca o dia,
  0 dependências novas, tokens em vez de cor crua, microcopy em «tu», e «+39/−6 é correção mínima».

**O que isto não resolve.**

1. **As datas do resto do mesmo ficheiro.** O helper local `formatDay` (linhas 148/182/183/277) continua
   sem ano; o QA mediu `dd/mm/yy` nas linhas-resumo do plano. Ficou fora do critério por decisão minha,
   e o problema é maior do que a T73: **22 cópias de `formatDay` em 23 ficheiros, 71 ocorrências**, mais
   `formatDayLong` em `dashboard-forecast.tsx:307`. Nenhum dos 24 itens da auditoria o cobre → T84,
   só com autorização do utilizador.
2. **A mutação não foi provada** (por ordem minha: cancelei a ordem que a pedia, que não veio de mim).
   O critério é o antes/depois na mesma base, e está provado.
3. **Os 46 testes de `installments` não foram lidos** pelo QA nem por mim; a T73 não mexeu no motor,
   mas ficam por contraditar.
4. **`<AnimatePresence>` na expansão** é melhoria fora do critério; seria dependência nova num ficheiro
   que a vaga 7 não autoriza. Se um dia se quiser, é tarefa própria.
5. **Nota do Revisor, medida por mim:** `installment-list.tsx:261` usa `font-numeric tabular-nums` e o
   `.font-numeric` de `globals.css:206-208` já define `font-variant-numeric: tabular-nums` — redundante.
   Mas **o padrão é da casa, não deste commit**: a mesma dupla está em 8 ficheiros em `2acacbc`
   (`amount.tsx:64`, `card-summary.tsx:171`, `goal-card.tsx:206`, `goal-detail-dialog.tsx:184`,
   `installment-edit-dialog.tsx:320`, `installment-list.tsx:151`, `invoice-table.tsx:100`,
   `recurrence-list.tsx:269`). Por §4.1 não reabre a T73; vai como linha da **T78** (lote de tokens),
   onde a limpeza é uma decisão única para as 9 ocorrências.
6. **O que o push deixou na história:** os dois commits (`c52a0e2`, `21dae72`) continuam na branch
   local e o `21dae72` leva documentos de gestão e 6 capturas que não foram meus para commitar. A
   branch remota foi apagada; a história local não se reescreve (nunca `filter-branch`).

**Aberto (e por quem).**

- `push` / `merge` para `main` — **bloqueado no utilizador** (repo público; §7 do `git-workflow`).
- Política dos `.png` de evidência em git (26 soltas em `relatorios/`, mais as 4 do QA) — utilizador.
- O plano de exemplo «Televisor 4K (T73)` na base real, `planId` `6b732fe3-33dd-4f78-b767-c4c24ddaad63`,
  6 faturas, `EXPENSE` 37 → 43 — utilizador decide se fica; apaga-se com
  `deleteInstallmentPlan('6b732fe3-33dd-4f78-b767-c4c24ddaad63')`.
- Quem fez `21dae72` e o `push` às 16:03Z, e se há outra sessão viva nesta árvore — **sem resposta do
  utilizador**; enquanto não a houver, nada de git escrito por mais ninguém e eu continuo a conferir a
  árvore antes de cada passo.

**Repositório.** Branch `fix/t73-parcelamentos-cartoes`, HEAD `21dae72`; `c52a0e2` = código +
relatório do Dev; `21dae72` = commit que não fiz (docs + capturas). `main` local e `origin/main` =
`2acacbc`, intocados. Por commitar por mim, em commit próprio de docs: `AGENTS.md`,
`docs/gestao/TASKS.md`, `docs/gestao/DECISOES.md`, `docs/gestao/TASKS-fechado.md`,
`relatorios/T73-QA.md`. Fora de commit: `apps/web/next-env.d.ts` (aspas reescritas pelo `next build`
— artefacto, restauro-o) e os `.png` do QA, à espera da política. Deploy: **nenhum**, e não é meu.

**Decisão que preciso dele.** (1) Autorizar (ou não) o `push`/`merge` deste trabalho — e com o repo
público, se prefere torná-lo privado antes. (2) T84 para as datas, ou ficar explicitamente fora de
âmbito. (3) Os `.png` de evidência entram em git ou vivem fora. (4) O plano de exemplo fica na base.

---

### T73 — F1: os planos de parcelas não aparecem em `/cartoes` (Dev) — **fechada 2026-11-20**

**Porquê.** O cartão tem parcelas na base de dados e o ecrã mostra a lista vazia. É o item mais
barato da vaga para o utilizador: dinheiro que está lá e não se vê.

**Ficheiros que pode escrever:** `apps/web/src/components/installment-list.tsx`,
`apps/web/src/app/(app)/cartoes/page.tsx`.
**Não tocar** em `components/ui/` (o `Card` é no T83) nem em `installment-edit-dialog.tsx`.

**Critério de aceitação.**
1. Teste de render: um cartão com 1 plano e as suas parcelas mostra **todas** as parcelas no DOM,
   cada uma com montante em euros e data `dd/mm/aaaa`. Antes do arranque o Dev escreve no post de
   mão quantas parcelas existem para o cartão de exemplo — **sem este número não há antes/depois**.
2. Estado vazio só quando o cartão não tem plano, com frase própria («ainda não tem
   parcelamentos»), e não a genérica de «sem resultados».
3. Prova em produção: captura em `relatorios/T73-cartoes-1440.png` e `relatorios/T73-cartoes-390.png`.
4. Se faltar uma consulta do lado do servidor para trazer as parcelas, **pare e pergunte ao Lead**:
   passa de (a) para mudança de camada de dados e sai do âmbito desta vaga.

**Cadeia.** Dev → QA (render + ecrã real) → Revisor → fecho do Lead.

**Estado a 2026-11-20 (Lead).** Dev entregou: branch `fix/t73-parcelamentos-cartoes`, commit `c52a0e2`,
diff `main..c52a0e2` = `installment-list.tsx` (+45/−6) e `relatorios/T73.md` (356 linhas) — escopo
respeitado. Antes/depois medidos por ele: parcelas no DOM **0 → 6**, datas `dd/mm/aaaa` **0 → 6**,
linhas de `tbody` na secção 1 → 7. Gate verde, `next start` parado por ele.
**Em apuração, e a cadeia está parada por causa disto:** o post do Dev cita uma ordem minha para
«restaurar `2acacbc`» e um pedido de prova de mutação «do Revisor» — nenhuma das duas mensagens veio
de mim (enviei `111d023f` e `09245bba`), e o Revisor não tem nada desta tarefa da minha parte. Pedi a
listagem cru dos mensagens recebidas/enviadas (`63c38b9d`). QA e Revisor **não** avançam enquanto o
contacto por fora não estiver escrito aqui.

**O que a resposta dele deu (`6fb2d14f`), e o que eu confirmei no repositório.**
1. O Dev diz ter recebido **dez** intervenções sobre a T73, oito delas com o cabeçalho «Lead de
   Projeto» com conteúdo que contradiz o meu critério (`formatDay` sem ano, «mantém o ficheiro em
   249», «restaura `2acacbc`») e horas — 23:45, 00:02, 00:07, 00:20, 00:26, 00:28 — que não batem com
   o git nem com esta máquina. As ids que ele guarda (`98b94a4e`, `b422e1b9`, `60d2958b`, `752710f0`,
   `59a11867`) **não correspondem a nada que eu tenha enviado**; o `history_read` dele devolve «no
   such message» para duas, e `history_search` não as encontra. Para o Lead: **esses oito pontos não
   existem como ordem**.
2. O Dev **enviou trabalho ao Revisor por conta própria** (`outbox-736df382`, 16:02:39Z), com os
   números e o guião de `relatorios/.qa-t73/` — é isso que rebenta a cadeia pausada. Nada foi enviado
   ao QA. Zero código escrito depois de `c52a0e2`; três pedidos de código que ele recebeu **não**
   foram executados, e é a única coisa boa nisto tudo.
3. **Existe um commit que eu não fiz:** `21dae72`, 16:03:09Z, autor «Rafael Aguiar» (a identidade git
   desta máquina), «T73: capturas e atualizações de documentação co-authored by OpenBot», com
   **`docs/gestao/TASKS.md` +336 e `DECISOES.md` +30 — a vaga 7 que eu escrevi minutos antes e que
   estava por commitar na árvore dele** — e os seis `.png` da T73, contra o padrão de não se
   versionarem screenshots. Nada foi para o remoto: `origin/main` continua em `2acacbc`. Perguntei-lhe
   se foi ele, com que `git add` e a pedido de quem; se não foi, há outra sessão a mexer neste
   repositório ao mesmo tempo que eu, e isso muda o modo de trabalhar da vaga inteira.
4. **Falsidade material no relatório:** `relatorios/T73.md` §1 cita «msg `66381d53`» como autorização
   minha para escrever na base. Não existe tal mensagem. Ordenei a correcção da linha (decisão do Dev,
   sem autorização do Lead, dados à espera do utilizador) **antes** de o QA assinar seja o que for.
5. Relógio: a explicação «UTC-8» que ele deu era falsa; a máquina é UTC+0 (`history_search` devolve
   `Europe/Lisbon`, `now 16:07:59Z`). Corrigida por ele ao utilizador.

**Segunda volta do apuramento (resposta do Dev `8e14ce00`, e o que eu medi).**
- `21dae72` **não é do Dev**: ele colou a lista dos comandos git que correu, com um único `commit`
  (`-F relatorios/.qa-t73/commit-msg.txt`, mensagem preservada nesse ficheiro) e `git add` sempre com
  caminhos explícitos — `installment-list.tsx` e `relatorios/T73.md`, nada de `docs/` nem de `.png`.
- Do meu lado, a máquina confirma-o e descarta a explicação cómoda: **não há hooks** em `.git/hooks`,
  **não há config de auto-commit**, e `21dae72` é o **único commit de todo o histórico** com a marca
  «co-authored by OpenBot». Ou seja, não é rotina da plataforma: foi uma ferramenta interativa, nesta
  árvore de trabalho, às 16:03:09Z.
- `relatorios/T73.md:49` já foi corrigido pelo Dev antes da minha ordem chegar (diff `1 1`): a citação
  falsa das mensagens `66381d53`/`98b942e4` está retirada e explicada, com a autoria real da criação
  do plano. Faltavam duas linhas e ordenei-as (`d4d1e9da`): a atribuição falsa em `~198` (troca-se
  pelo campo 4 do handoff `111d023f`) e o par de ids errado em `~187` (na minha fila V5/V6 é **T82**,
  o T83 é só a decisão do `Card size="sm"`).
- **QA e Revisor continuam sem ser chamados**, e o Dev está parado em código e em git, enquanto
  houver uma segunda mão nesta árvore a escrever e a commitar.

**Terceira volta (resposta do Dev `c3b9b389`) — e o erro era meu.** As cinco linhas ficaram trocadas
(diff `5 5`, `--ignore-all-space` igual, prettier `exit 0`, nada commitado). Mas a correção que lhe
ditei em `d4d1e9da` **estava errada**, e ele viu-o: **nenhuma tarefa da fila cobre o formato das
datas**. Conferido na fonte: o 2.º passe define **V5 = `ui/card.tsx:92` (`CardFooter`)** e
**V6 = densidade**; o meu T82 é exatamente isso (`ui/card.tsx` + `kpi-card.tsx`). Portanto nem o
«T83 (V5)» do handoff nem o «T82 (V5/V6)» da correção existem como tarefa de datas — mandei-o
escrever uma atribuição falsa num documento de prova, e ele ainda a propagou à linha 266 para o
ficheiro não se contradisser. Ordem dada agora: **tira os ids das duas linhas** e escreve o facto.

**O achado, medido por mim (`git grep`), é maior do que as 4 chamadas dele:** o helper `formatDay`
está **copiado 22 vezes** em `apps/web/src` (23 ficheiros: 22 `function formatDay` + 1
`formatDayLong` em `dashboard-forecast.tsx:307`), **71** ocorrências no total. Nenhum dos 22+2 itens
aprovados fala disso, portanto **não tem tarefa**. É âmbito novo e só o utilizador abre vaga (T84).

**Dois factos que corrigem o que eu disse ao utilizador:** (i) «zero `.png` em git» era impreciso —
há **6 ícones de PWA** versionados em `apps/web/public/icons/`; o que não estava versionado eram as
capturas de evidência, e dessas há **26 soltas e por commitar** em `relatorios/` (T23, T54, T55, T57,
T60…); os `.md` já são 104, não 82. (ii) O `21dae72` está **no topo da branch do Dev**
(`fix/t73-parcelamentos-cartoes`) e leva os meus `TASKS.md`/`DECISOES.md` e 6 `.png` — quando a T73
for para `main`, isso vai tudo atrás, independentemente de quem fez o commit.

**Efeito colateral na base, por decidir pelo utilizador:** para ter o que mostrar, o Dev criou um
plano de exemplo na base real da app — 6 parcelas de 600,00 € («Televisor 4K (T73)»), que o motor
desdobrou em **6 faturas novas** (3 → 9) e levou `EXPENSE` de 37 → 43. Ficou lá para o QA reproduzir;
desfaz-se com `deleteInstallmentPlan('6b732fe3-33dd-4f78-b767-c4c24ddaad63')`.

**Quarto facto, apurado por mim às 16:48Z (o utilizador disse «foi feito um push com erro» e tinha razão):**
o `21dae72` **foi para o GitHub**. `gh api repos/rafaelfa/financas-pessoais → pushed_at =
2026-11-20T16:03:17Z` — **8 segundos** depois do commit. O `git ls-remote` mostrava
`refs/heads/fix/t73-parcelamentos-cartoes = 21dae72` ao lado de `main = 2acacbc`. Zero PRs, zero run
de CI para o branch (os últimos 5 runs são todos `main`, todos `success`), `main` intocado → **nada
quebrou e nada foi refeito em produção**: o erro é o push em si, não as consequências.
Porque é que a máquina não tinha rasto: `remote.origin.fetch = +refs/heads/main:refs/remotes/origin/main`
(refspec restrito a `main`), portanto um `git push` de outro branch daqui **não** escreve
`refs/remotes/origin/<branch>` nem deixa linha no reflog local. Ou seja, **o push é compatível com
esta máquina** e não posso afirmar que veio de fora.
**Feito por mim, com cartão de aprovação do utilizador (`push-t73-remediar`, 16:48Z):**
`git push origin --delete refs/heads/fix/t73-parcelamentos-cartoes` → `- [deleted]`. Remoto agora só
tem `main = 2acacbc`; os dois commits continuam locais e intactos em
`fix/t73-parcelamentos-cartoes`. Zero `main`, zero force, zero `reset`.

**Dois factos que não sabíamos e valem gestão de risco:** (i) `private = false` — **o repositório é
público**, e o que o branch levou para lá inclui 6 capturas do ecrã `/cartoes`. (ii) A origem dos
números dessas capturas, pelo registo da casa (`DECISOES.md:212`): o `.env` desta máquina aponta para
`ep-spring-mud-*` = o ramo **`testes-e2e`**, não a produção (`Financas_Pessoal`, que é o que a Vercel
usa). São dados sintéticos, mas parecem reais a quem olhe. Não re-medido hoje. Varredura de segredos
nos ficheiros versionados: só `.env.example` com placeholders e `ci.yml` com o postgres local de CI —
**nenhuma string real do Neon em git**.

**Quinto facto, regra nova do utilizador (D25, 16:47Z):** **«só faça push e commit depois de for
aprovado pela equipe»** e **«e somente vc pode fazer isso»**. Git passa a ser mão única: **só o Lead**
faz `commit`/`push`, e **só depois de o QA assinar `PASS` e o Revisor dar `OK`**. Substitui a
autorização permanente de 17/11 que eu tinha em memória. Escrito em `AGENTS.md` (§ Git, § Quem escreve
o quê) e `DECISOES.md` D25; comunicado ao Dev (`expectsReply false`). **O que isto muda na cadeia:** o
artefacto do Dev deixa de ser um commit — é a árvore de trabalho com o relatório; o commit passa a ser
meu, no fecho, com caminhos explícitos no `add`. Comunicado também que a branch remota foi apagada,
para ninguém tentar empurrar para um ref que já não existe.

### T73 — estado da cadeia (volta 1)

**Passo 1 — Dev** (`111d023f` → `c3b9b389`/`70b322f5`). Entregue: `installment-list.tsx` com +39/−6 e
`relatorios/T73.md` (356 linhas) com o comando e a saída colados em cada número — parcelas no DOM
**0 → 6**, datas `dd/mm/aaaa` **0 → 6**, linhas de `tbody` na secção 1 → 7, `test` 598/598. Três
desvios registados em cima: as ordens que não saíram de mim e que ele não executou, o post direto ao
Revisor à margem da cadeia, e o `21dae72` com a minha documentação.

**Passo 2 — QA** (`c95f8468` → `df4f59f1`, 17:07Z): **`PASS` nas quatro alíneas**, e conferido por mim
antes de chamar o passo 3.

| O que o QA assinou | O que eu fui verificar |
| --- | --- |
| (a) 6 parcelas no DOM nas 4 configurações, 7 linhas de `tbody`, `/Parcela/g` bruto 8 | `relatorios/.qa-t73/t73-medicao-QA.json` com os mesmos números, por guião dele (`t73-playwright.mjs`, `-dark.mjs`, 17:04/17:05) |
| (b) 6 datas `dd/mm/aaaa` por configuração | idem, 6 nas quatro configurações |
| (c) gate: `format:check` · `lint` 4/4 · `typecheck` 4/4 · `test` 34 fich/598 · `build` 2/2 | saída colada no relatório, números iguais aos do Dev |
| (d) só `installment-list.tsx` alterado (+39/−6), `formatDay` intacto | `git diff --stat 2acacbc..HEAD -- apps/ packages/` batido por mim e por ele |
| «capturas minhas» | **confirmado por ti, que assististe**: hashes iguais aos das capturas do Dev porque o Chromium é determinístico na mesma página, resolução e base; ficheiros criados às 17:04/17:05, com nomes próprios (`…-1440x900-light`) |

Duas coisas que o QA topou e não maquilhou: a prova de mutação (que eu tinha cancelado, porque a ordem
não era minha) e o `<AnimatePresence>`, que seria dependência nova fora do critério.
**Um facto que não passou no meu pente-fino:** o QA apagou `packages/db/src/generated/prisma`
(«estado inconsistente do `db:generate` em paralelo») e regenerou. É o caminho que o `AGENTS.md` põe
na lista de não tocar; `git status` da pasta está **limpo** (0 alterações) e o `typecheck`/`build`
verdes provam que a regeração foi fiel. Fica como risco de máquina, não como volta da T73.
Resíduo de build sem dono: `apps/web/next-env.d.ts`, com aspas reescritas pelo `next build` — restauro
eu, não entra em commit nenhum.

**Passo 3 — Revisor** (`165a733c`, 17:11Z → `56ca442c`): **`OK`**, zero bloqueantes, com confirmação
de `Fragment` + `key` composta, `colSpan={8}` a bater com os 8 `TableHead`, `T12:00:00Z` sem deslocar
o dia, 0 dependências novas e «+39/−6 é correção mínima». Um achado só, e dele próprio como
*nota menor*: a redundância `font-numeric tabular-nums` em `installment-list.tsx:261`. Meço e classifico
no ponto 5 de «O que isto não resolve» — vai para a T78, não reabre a T73.

**Sexta volta (17:25Z), e o erro é outra vez meu — agora no meu próprio registo de ids.** Ao abrir a
T74, o primeiro envio ao Dev falhou com **«No agent has the id `agent-7f8992e4-d93b-4bb2-a910-9497c8d507de`»**:
o id que eu tinha apontado como sendo do Dev **não existe**. `list_agents` dá **`agent-a1662862-ff71-4874-bffc-2bdfeab66a1a`**,
e `history_search` por `a1662862` acha a minha frase das 16:12Z sobre as cópias dos anexos em
`C:/Users/VENOM/OpenBot/Agents/agent-a1662862-…`; a busca por `7f8992e4` não acha nada em lado nenhum.
Ou seja: **era um id inventado nas minhas notas de contexto**. O que não quer dizer que os posts de mão
não tenham chegado — o Dev respondeu a todos, portanto o envio real usou o id certo; o que estava errado
era o número que eu guardei, e isto vale para **todos os ids de agente que cito de memória**.
Consequências que tratei:

1. Reenviei a ordem com a regra de git **dentro** do handoff da T74 (`d0da42ec`, `queued` a
   `a1662862`), para que ela não dependa de ter ou não chegado a mensagem anterior.
2. Lido o perfil do Dev nesta hora: diz ainda **«Commits locais na tua branch, com a skill
   git-workflow»**. É a autorização permanente de 17/11, viva no agente, e foi ela que produziu o
   `c52a0e2` e o `21dae72`. A minha ordem no chat manda mais do que ela **nesta conversa**, mas o
   perfil é o que sobrevive a um `/stop`: **o utilizador tem de o editar** (ou pedir ao Dr. Eggbot).
3. Os ids de agente deixam de se escrever de memória neste projecto: ou de `list_agents`, ou
   `@Dev`/`@QA`/`@Revisor de Código` num posto de canal.



---

### T87 — «Calendário» entra no menu «Dia a dia» (Dev) — **fechada a 2026-11-21 (D29)**

**Decisão:** D29, tomada por delegação do utilizador. **Porque:** a T84 deu escrita ao Calendário e o
ecrã só era alcançável pelo `Ctrl+K`, por um «Ver o calendário» dentro do cartão «Por arrumar» do
Painel — cartão que **não existe numa conta vazia** (medido por mim em produção) — ou escrevendo o
endereço.

**Âmbito — uma linha de dados, o teste que a guarda, e a prova:**

1. `apps/web/src/lib/nav.ts`: `NAV.calendario` entra em `NAV_SECTIONS`, no grupo «Dia a dia»,
   **imediatamente a seguir a `NAV.transacoes`**. Nove destinos no total. `MOBILE_NAV` fica com os
   mesmos cinco, `ALL_NAV_ITEMS` continua com 17.
2. `e2e/39-calendario.spec.ts:254-270`: o teste passa a exigir o contrário — `/calendario` **na**
   barra lateral, com o estado ativo na rota, e a paleta ainda com 17 opções. **Renomear o teste**: o
   nome atual («não está na barra lateral») passa a afirmar o que já não é verdade.
3. `e2e/33-navegacao-15.spec.ts`: **não tem asserção de contagem na barra** (verifica 5 alvos
   inferiores, 17 na paleta e zero órfãos) — portanto não ganha nem perde testes. Só o **comentário**
   das linhas 55-58 («a barra lateral fica com oito, por decisão da T54») passa a estar errado e deve
   ser corrigido para nove.

**Não fazer:** tirar o botão «Ver o calendário» do Painel (é contexto); mexer em `MOBILE_NAV`;
reordenar os outros sete destinos; trocar ícones; tocar em `globals.css` ou `components/ui/` (T78).

**Prova pedida:** screenshot da barra a **390 e a 1440** com «Calendário» entre Transações e Contas e
com o estado ativo em `/calendario`; `Ctrl+K` continua com 17 opções; gate 5/5; `pnpm test:e2e`
completo — a baseline passa a valer o que a corrida disser (145 hoje, mais ou menos o que o spec 39
mudar). Relatório em `relatorios/T87.md` com as medições.

**Volta 1 — 2026-11-21.** Dev entregou (9 destinos em `nav.ts`, 4 specs corrigidos; suite **145
passed** de frio, exit 0). O QA assinou **PASS** nas alíneas (a)–(d) e não mediu (e); duas corridas de
frio **145 passed** (8.6m cada), builds diferentes, `0 restante(s)`, sem flake — `relatorios/T87-qa.md`.
O Revisor deu **0 BLOQUEIA, 1 DEVE, 1 OPCIONAL** e «o diff cumpre o critério no conjunto: sim».

**Volta 2 — em curso (Dev).** O DEVE: `e2e/38-revisao.spec.ts:18` ainda diz «a paleta tem 16 … a
barra lateral continua com 8» (o ficheiro contradiz o próprio corpo, que já afirma 9 e 17); e o nome
do teste `:136` diz «paleta 16». O OPCIONAL: `e2e/33-navegacao-15.spec.ts:10` diz «8 destinos e os
outros 7» enquanto o comentário `:55-57` já diz nove. Confirmei as três linhas na árvore com `grep`.
É correção de comentários e de um nome de teste: **não muda comportamento**, por isso a suite não é
repetida (as duas corridas do QA valem) e o gate a repetir é só o `format:check`, que uma linha longa
pode quebrar. Fechado o DEVE, a volta ao Revisor é de leitura do diff, sem nova medição.

**Medido por mim (Lead), 2026-11-21 15:50** — as três linhas estão na árvore: `e2e/38:18` «a paleta
tem **17** … a barra lateral continua com **9**», `e2e/38:136` «paleta **17** … barra lateral 9»,
`e2e/33:10` «**9** destinos e os outros **8**». `grep -rn "com 8\|8 destinos\|tem 16\|paleta 16"
e2e/*.ts` → **vazio** (exit 1). `pnpm format:check` → `All matched files use Prettier code style!`,
exit 0. O diff desta volta são 4 linhas de comentário e 1 nome de teste; nenhuma linha de `expect`,
seletor ou `skip`/`only` foi tocada.

**Fecho — 2026-11-21.** Cadeia pausada completa: Dev (voltas 1 e 2) → QA **PASS** → Revisor **0
BLOQUEIA, 1 DEVE, 1 OPCIONAL** e «o diff cumpre o critério no conjunto: sim», DEVE e OPCIONAL
fechados na volta 3 com «**pode commitar? sim**».

- **Fechado:** T87 — «Calendário» é o 3.º destino de «Dia a dia», a seguir a Transações; **9** destinos
  contra os 8 do D7, que a D29 corrige.
- **Prova:** QA, duas corridas de frio com `.next` apagado — `145 passed (8.6m)` **e** `145 passed
  (8.6m)`, builds diferentes, `0 restante(s)` nas duas, exit 0, `relatorios/T87-qa.md`. DOM medido
  nos 4 casos (1440/390 × claro/escuro): 10 `href` (9 destinos + Definições), `/calendario` com
  `aria-current="page"` e único, paleta **17**, nav inferior **5**. `format:check` 0 depois da última
  edição. Relatórios: `relatorios/T87.md` (§1–§7), `relatorios/T87-qa.md`.
- **O que isto não resolve:** (1) a alínea (e) do critério — apagar o `nav.ts` e ver o 15 e o 38
  ficarem vermelhos — **não foi medida** por ninguém, porque é `apps/`; fica como raciocínio, não
  como prova. (2) A barra passa a ter 9 itens contra os 8 do D7: em ecrãs baixos é mais uma linha de
  menu, não medido. (3) O botão «Ver o calendário» do Painel continua lá, de propósito.
- **Aberto:** nada desta tarefa. A T78 (lote do tema) e as T85/T86 continuam **por autorizar**.
- **Repositório:** commit local na branch `fix/t73-parcelamentos-cartoes`; `AGENTS.md` e
  `apps/web/next-env.d.ts` ficaram **fora** (já vinham sujos, não são de nenhum de nós). Push e merge
  só com autorização do utilizador.
- **Decisão:** nenhuma desta tarefa.

## Bloco de fecho — T93 (fechada 2026-11-22)

- **Fechado:** T93 — *alvos de toque do cabeçalho a 320 px*: os seis controlos do cabeçalho passam de
  **28–36 px** para **44×44** abaixo de `sm` (`max-sm:min-h-11 max-sm:min-w-11`), com o cabeçalho a
  apertar decoração (`px-2`, `gap-1`, «Mais» `justify-center`) e a marca com `min-w-0` + corte num
  `<span class="block truncate">` interior.
- **Prova:** cadeia pausada em **2 voltas**: Dev (volta 1 com 6 controlos medidos e `T89_MUTAR`
  vermelho; volta 2 com a correção do `truncate`) → QA `PASS` nas duas (a volta 1 mediu os glifos a
  133 com o «Mais» a 116 e classificou-o «sem nada coberto»; a volta 2 mediu o corte em 108 com o
  «Mais» a 116, **8,0 px** de folga) → Revisor «pode commitar: **não**» na volta 1 (DEVE: o
  `truncate` anulado pelo `not-sr-only`, com offset no CSS construído) e «**sim**» na volta 2 (0
  bloqueia, 0 deve, 0 opcionais).
  Medições: 360 → caixa 35,0, interior `scrollWidth/clientWidth` **124/35**, 1 rect, glifos em
  **108,0**, «Mais» a **116,0**; 390 → 65,0, `124/65`, glifos em **138,0**, «Mais» a **146,0**;
  `document.scrollWidth` = janela e **0** filhos fora em **320/359/360/390/1440**; a 320 `sr-only` 1×1
  com `- text: Finanças Pessoais` no `ariaSnapshot`; **54 pontos** (centro, arestas a ±2, cantos a ±4,
  × 6) todos no controlo certo; guarda morde (`T89_MUTAR=toque` → `Expected >= 44 / Received: 28`,
  EXIT=1; limpo 1 passed 4,5 s). Gate 5/5 e suite de frio **149 passed (8.7m)**, `0 restante(s)`,
  EXIT=0, build `nTI6yvbZxQQA6iIq5cnn4P`. Relatórios: `relatorios/T93.md`, `relatorios/T93-qa.md`,
  `relatorios/T93/` (capturas).
- **O que isto não resolve:** (1) entre **640 e 767** os alvos voltam a 28–36 px — assumido e escrito
  na **D30**: o corte por largura não apanha telemóvel em landscape (844×390) e `pointer: coarse` muda
  a altura do cabeçalho em portáteis tácteis, o que ninguém mediu. (2) A conta a 320 fecha em **317 px**
  com **3 px** de folga no bordo direito: a 319 rebenta — não há margem para mais nada no cabeçalho a
  320. (3) A 360 o nome da app fica em 35 px de caixa: cortado com reticências, legível só por
  `ariaSnapshot`/tooltip nenhum — é o preço de seis alvos a 44 na mesma barra.
- **Aberto:** nada desta tarefa. **T94** (endurecer a guarda dos 320), **T95** (uma só fonte de `cn`),
  **T96** (as ~139 bordas com peso de controlo) e **T98** (falha de rede muda no formulário de
  preferências) seguem na fila autorizada.
- **Repositório:** `fix/t73-parcelamentos-cartoes`; commits locais `86d306e` (fix) e `7117b69` (spec),
  **por enviar**; produção continua em `4334d4b`. Push e merge só com autorização do utilizador.
- **Decisão:** nenhuma desta tarefa. A D30 (piso de 44 px até `sm`) fica registada como decisão minha.

### T93 — alvos de toque do cabeçalho a 320 px (Dev) — **fechada 2026-11-22**

**Volta 1 — entrega do Dev (`relatorios/T93.md`, `relatorios/T93/` com 6 recortes):** os seis
controlos passam a **44×44** abaixo de `sm` com `max-sm:min-h-11 max-sm:min-w-11` (ícone e aspeto
iguais); para caberem, `px-2`/`gap-1` abaixo de `sm` e a marca com `min-w-0 truncate`. Sem transbordo
em 320/359/360/390/1440 (`scrollWidth` = janela, 0 filhos fora). A asserção entrou no `e2e/89`
(320 **e** 360) e o modo `T89_MUTAR=toque` falha com `Received: 28`. Gate 5/5, suite de frio
**149 passed (8.3m)**, `0 restante(s)`. Zero git.

**Volta 1 — QA `PASS` (`relatorios/T93-qa.md`):** os seis medidos por ele a 320 (`28×28`, `38×44`,
`38×28`, `32×32`, `32×32`, `36×36` → todos **44×44**); `scrollWidth` = janela e **0** filhos fora a
320/359/360/390/1440; ordem igual; **54 pontos** (centro, arestas a 2 px, cantos a 4 px × 6) caem no
controlo certo, nenhum no vizinho; guarda morde (`T89_MUTAR=toque` → `Received: 28`, EXIT=1; limpo
1 passed); gate 5/5; suite **149 passed (8.7m)**, `0 restante(s)`. **Ressalva do QA:** a marca a 360
tem caixa de 35 px com o nome natural a 123,8 e glifos até ~133 (vizinho a 116) — o `truncate` não
trunca porque o `not-sr-only` repõe `white-space: normal`/`overflow: visible`; o que segurou os 377 px
foi o `min-w-0`. A (c) passa na mesma (o nome está lá a 360 e 390). Pergunta em revisão: a classe é
morta ou a frase do relatório é que mente.

**Volta 1 — Revisor: 1 DEVE, 2 OPCIONAIS, «pode commitar: não».** DEVE em `app-shell.tsx:77`: no CSS
construído o `.truncate` está no offset 24514 e o `@media (min-width:360px){.min-[360px]:not-sr-only
{white-space:normal;overflow:visible}}` em ~103454 — mesma especificidade, ganha o último, portanto o
`truncate` **não trunca** e o que segura os 377 px é o `min-w-0`. Efeito real: o nome passa por baixo
do ícone do «Mais» a 360–767. Conta a 320: `8+44+8+5+8+236+8 = 317`, **3 px** livres. Opcionais:
(a) entre 640 e 767 os alvos voltam a 28–36 px — **decidido por mim em `DECISOES.md` D30** (fica `sm`,
porque o iPhone em landscape mede 844 e nem `md` o apanha); (b) a frase do relatório e o comentário
`app-shell.tsx:73-75` a corrigir. **Volta 2 aberta com o Dev**, critério (i)–(v): reticências medidas
a 360 e 390, `scrollWidth` = janela nas cinco larguras, `sr-only` da T88 vivo a 320, nada muda a 640+.

**Volta 2 — entrega do Dev (`relatorios/T93.md` §8):** o `sr-only…not-sr-only` fica na caixa de fora e
o corte passa a um `<span class="block truncate">` **interior** (recusou `min-[360px]:truncate` por
depender da ordem de emissão do compilador). Medido: 360 → caixa **35 px**, `scrollWidth/clientWidth`
**124/35**, **1** linha, «Mais» a **116**; 390 → **65 px**, `124/65`, 1 linha, «Mais» a **146**;
0 filhos fora em 320/359/360/390/1440; a 320 o `sr-only` mantém o nome na árvore; `e2e/89`+`e2e/92`
2 passed; gate 5/5, `BUILD_ID -cNz1v7OgaIEAcz7wlYoO`. Suite não repetida — é o QA que a corre agora.

**Volta 2 — QA `PASS` (`relatorios/T93-qa.md` §«Volta 2»):** 360 → caixa 35,0, `124/35`, 1 rect,
glifos cortados em **108,0** com «Mais» a **116,0** (8,0 px de folga); 390 → 65,0, `124/65`, glifos em
**138,0** com «Mais» a **146,0**; 0 filhos fora nas cinco larguras; a 320 `sr-only` 1×1 e
`- text: Finanças Pessoais`; a 1440 marca `display:none`. Volta 1 intacta (seis a 44×44, 54 pontos,
`T89_MUTAR=toque` → `Received: 28`). Suite **149 passed (8.7m)**, `0 restante(s)`, EXIT=0, build
`nTI6yvbZxQQA6iIq5cnn4P`.

**Volta 2 — Revisor: 0 BLOQUEIA, 0 DEVE, 0 OPCIONAIS, «pode commitar: sim».** O `sr-only` exterior
sobrevive e o interior está fora do seu alcance (`clip-path`, `overflow`, `white-space` e
`text-overflow` não são herdados; o span interior redeclara os três que precisa, `app-shell.tsx:80`);
nesta volta só mudaram a marca e o comentário (`19/6` no `git diff`), nada da volta 1 regrediu; as
frases do relatório e do comentário dizem o mecanismo real; não há `truncate`/`not-sr-only` em
duplicado que possam pisar-se (`grep -rn "truncate|not-sr-only" apps/web/src`).

**Achado do Dev na T88, medido por ele.** A 320 px, dos cinco controlos do cabeçalho só o menu
«Mais» chega a **44 px**; a barra lateral, a busca, o tema e o sair medem **28–36 px**. A skill
`design-do-projeto` pede **alvo de toque ≥44×44 em telemóvel** e esta é a barra que se usa com o
polegar. Já estava assim antes da T88 — o Dev não os inflou porque isso mudaria o cabeçalho a 390 e a
1440, e o critério da T88 era «nada muda».

**Critério:**

- (a) Os cinco controlos do cabeçalho com **≥44 px de altura** (e largura ≥44 nos que são só ícone) a
  320, medidos um a um, com o número antes/depois.
- (b) Se 44 não couber a 320 sem voltar a transbordar (`document.scrollWidth` = 320), diz **por
  extenso** qual é o controlo que não cabe e qual a saída que propões — não basta aumentar o padding.
- (c) A 390 e a 1440 o cabeçalho pode mudar **de tamanho**, não de ordem: os cinco controlos na mesma
  sequência, o nome da app onde está (`min-[360px]`), nada a desaparecer.
- (d) Dois temas, sem regressão de contraste.
- (e) Gate 5/5, suite de frio com a baseline da altura (146 + o que a T89 acrescentar), `0 restante(s)`.


## Bloco de fecho — T93, volta 3 (fechada 2026-11-22)

- **Fechado:** T93 volta 3 — *o cabeçalho cabe nos 320 px com barra de scroll*: `px-2 → px-1` (8 px) e
  `gap-2 → gap-1` nos dois intervalos (8 px), **só abaixo de `sm`** (`sm:px-4`/`sm:gap-2` repõem acima
  de 640). Nenhum alvo, nenhum controlo, nenhuma outra classe.
- **Prova:** Dev (`relatorios/T93.md` §9) e QA (`relatorios/T93-qa.md` §«Volta 3») em **headed** com
  barra de scroll de 15 px: 320 → `inner 320 / client 305 / scroll 305` (dif. **0**), 359 → 344/344,
  360 → 345/345, 390 → 375/375, 1440 → 1425/1425, **0** filhos do cabeçalho fora. Seis alvos 44×44 em
  `x` 4/65/113/161/209/257, vãos de **17 px** (gaveta→«Mais», com o separador) e **4,0 px** entre os
  pares do grupo — encostados, **não sobrepostos**; os **54 pontos** acertam todos no controlo certo e
  o QA **não alterou o teste**. A 360 a marca corta em 101 com o «Mais» a 105 (1 linha); a 390 em 131
  com o «Mais» a 135; a 320 `sr-only` 1×1 com o nome na árvore. Verde headless **e** headed; quatro
  mutações vermelhas nas duas modalidades. Suite **149 passed (9.3m)**, `0 restante(s)`, EXIT=0, build
  `Rl7I5TP7awnNhriLjNGwv`; gate 5/5. Revisor: **0 BLOQUEIA, 0 DEVE, 1 OPCIONAL**, «pode commitar:
  sim».
- **O que isto não resolve:** (1) a folga a 305 é **0 a 4 px** — o cabeçalho está na parede: qualquer
  acréscimo futuro (uma etiqueta mais longa, 5 px de padding) volta a rebentar, e **a guarda não o
  apanha por omissão**, porque compara contra `clientWidth` (320 em headless, sem barra) e tolera ~19 px.
  (2) Os 4 px de vão entre alvos: risco de toque a mais no vizinho, não de alvo falhado; não há folga
  para o pagar sem tirar peça. (3) `px-1` deixa a gaveta a 4 px do bordo — custo visual, não funcional
  (o swipe de voltar não se faz num gatilho de gaveta).
- **Aberto:** o OPCIONAL do Revisor passou para a **T94** (fazer a guarda medir a parede de 305 por
  omissão, não só em `--headed`).
- **Repositório:** `fix/t73-parcelamentos-cartoes`; commit `8fd7461` **por enviar**.
- **Decisão:** nenhuma. O separador abaixo de `sm` (≈13 px) ficaria disponível para recuperar `px-2`,
  mas não chega para o `gap-2` do grupo e não vale uma volta.

### T93 — volta 3 (reaberta) — o cabeçalho transborda 4 px quando há barra de scroll — **fechada 2026-11-22**

**É continuação da T93**, fechada e commitada horas antes (`86d306e`, `7117b69`, `34d2ed6`). Reabre
com o mesmo ID porque o defeito é da promessa da própria T93: a alínea (b) dizia «sem voltar a
transbordar» e essa medição só era verdadeira **em headless**, onde o Chromium recebe
`--hide-scrollbars`.

**Achado do Dev na T94, na entrega do primeiro ensaio `--headed`:** a 320×640 com barra de scroll,
`innerWidth` **320** mas `documentElement.clientWidth` **305**; `docScrollWidth` **309** e o grupo da
direita do cabeçalho com `right` **309** — **4 px de transbordo**, scroll horizontal na página. Em
headless o mesmo ecrã dá 320/320 porque não há barra. A conta do cabeçalho a 320 é 317 px
(`8+44+8+5+8+236+8`), que não cabe em 305.

**Critério:**

- (a) A 320×640 **com barra de scroll** (headed): `documentElement.scrollWidth` ≤
  `documentElement.clientWidth` **sem tolerância**, e **nenhum** filho do cabeçalho com `right` além
do `clientWidth`. O mesmo a 359/360/390/1440.
- (b) **Os seis alvos continuam ≥44×44** e sem sobreposição. Se dois tiverem de ficar encostados, di-lo
  por extenso e mede o clique na aresta.
- (c) Nenhum controlo sai do cabeçalho. **Se a única forma de caber for tirar um controlo, paras e
  dizes qual** — essa decisão é minha.
- (d) O nome da app continua a cortar em 1 linha a 360 e a 390 (o que a volta 2 fechou não regride) e o
  `sr-only` a 320 continua na árvore.
- (e) O ensaio `--headed` do `e2e/89` (que a T94 endureceu) passa **verde** e as quatro mutações
  continuam vermelhas.
- (f) Gate 5/5; suite completa é do QA.

**Nota:** o `e2e/89-guarda-320.spec.ts` na árvore é a entrega da **T94** (por commitar). Podes corrê-la
e só a mudas se a correção do cabeçalho o exigir — e nesse caso dizes a linha e o motivo.

**Volta 3 — entrega do Dev (`relatorios/T93.md` §9):** `px-2 → px-1` (8 px) e `gap-2 → gap-1` nos dois
intervalos (8 px), só abaixo de `sm`; **16 px** de folga contra os 12 que faltavam. Headed:
320 → `305/305`, 359 → `344/344`, 360 → `345/345`, 390 → `375/375`, 1440 → `1425/1425`, **0** filhos
fora, seis alvos a 44×44 (4 px entre eles, sem sobreposição). A 360 a marca corta em 1 linha (caixa
40, 61→101, «Mais» a 105); a 390, 70 px (61→131), «Mais» a 135. `--headed` limpo 1 passed (4.7s);
quatro mutações vermelhas; gate 5/5, `BUILD_ID 0F5O5rRqraipnQLo9zBmF`. `e2e/89` não tocado.

**Volta 3 — QA `PASS` (`relatorios/T93-qa.md` §«Volta 3»), headed com barra de scroll de 15 px:**
320 → `inner 320/client 305/scroll 305` (dif. **0**), 359 → 344/344, 360 → 345/345, 390 → 375/375,
1440 → 1425/1425, **0** filhos fora. Seis alvos 44×44 com `x` 4/65/113/161/209/257 e `right`
48/109/157/205/253/301 — vãos de **17 px** (gaveta→«Mais», com o separador) e **4,0 px** entre os
pares do grupo: encostados, não sobrepostos; **54 pontos sem uma falha**, teste não alterado. A 360 a
marca corta em 101 com «Mais» a 105; a 390 em 131 com «Mais» a 135. Verde headless **e** headed; quatro
mutações vermelhas nas duas modalidades. Suite **149 passed (9.3m)**, `0 restante(s)`, EXIT=0, build
`Rl7I5TP7awnNhriLjNGwv`. Contraste igual. Em revisão: risco dos 4 px de vão, `px-1` a 4 px do bordo, e
se a folga a 305 é zero (qualquer acréscimo futuro rebenta em silêncio porque a guarda corre headless).

## Bloco de fecho — T94 (fechada 2026-11-22)

- **Fechado:** T94 — *endurecer a guarda dos 320 px*: `mutar()` passa a devolver quantos elementos
  alterou e o ensaio exige `> 0`; as comparações de transbordo passam de `window.innerWidth` a
  `documentElement.clientWidth`; o projeto `estreito` arranca com `ignoreDefaultArgs:
  ['--hide-scrollbars']`; e nasceu a quinta mutação, `T89_MUTAR=parede`.
- **Prova:** cadeia Dev (2 voltas) → QA `PASS` → Revisor «pode commitar: **sim**» (0 bloqueia, 0 deve,
  0 opcionais). Sem `--headed`, o spec vê **320/305/305** com a barra forçada (320/320/320 sem ela);
  `T89_MUTAR=parede` → `[]` vs `[309]`; **cinco** mutações vermelhas (`nav` 124,9 vs ≤122,5 · `toque`
  28 · `cabecalho` `[]` vs `[424,8]` · `limiar` 1 vs >10 · `parede` `[]` vs `[309]`); `innerWidth` só
  no `viewport` (`:158`), comparações em `:165,233,234`; zero `skip`/`only`/`fixme`; `--headed` verde
  (4,1 s). Suite **149 passed (8.9m)**, `0 restante(s)`, EXIT=0, `BUILD_ID 03H7mPpSGRhy2HWUX1HXU`; gate
  5/5. Relatórios: `relatorios/T94.md`, `relatorios/T94-qa.md`.
- **O que isto não resolve:** (1) **a largura da barra é do sistema, não do teste.** Nesta máquina vale
  **15 px** (320−305); com `--enable-features=OverlayScrollbar` a parede volta a **320** e **+16 px
  ainda passa**. O teste garante «cabe na largura útil do browser onde corre», não «cabe em 305
  sempre». Quem quiser o piso independente do SO precisa de uma segunda medição a `viewport 305` fixo.
  (2) A conta do conteúdo do cabeçalho não fecha ao pixel entre o Revisor (~297 pelas classes), a
  varredura do Dev (12 px ainda 305, 14 → 307) e as posições do QA (`right` 301 → 4 px de folga):
  concordam no que importa (folga de um dígito, a mutação morde), não no número. (3) A mutação
  `cabecalho` mudou de alvo (`sr-only` → `min-w-0`) — honesta, e o alvo antigo continua coberto pela
  largura da marca (≤1 px a 320) e pelo `ariaSnapshot`.
- **Aberto:** nada desta tarefa. As mutações passam a ser **cinco** e todas têm de continuar vermelhas
  em qualquer trabalho futuro sobre o cabeçalho.
- **Repositório:** `fix/t73-parcelamentos-cartoes`; commit `764bc4e` **por enviar**.
- **Decisão:** nenhuma. A D30 continua a valer.

### T94 — endurecer a guarda dos 320 px (Dev) — **fechada 2026-11-22**

**Atualização de 2026-11-22 (Lead), depois da T93:** a contagem da alínea (b) passa de **147** para
**149**, e as mutações são **quatro**, não três — a `T89_MUTAR=toque` nasceu na T93.

**Volta 1 — entrega do Dev (`relatorios/T94.md`), parada:** (a) feito — `mutar()` devolve quantos
elementos alterou e `expect(alterados).toBeGreaterThan(0)` falha quando é 0; a mutação `cabecalho` mudou
de alvo (`sr-only` → `min-w-0`) porque com o `min-w-0` da T93 o `sr-only` já não transbordava. (b) feito —
`clientWidth` nas comparações de transbordo, `innerWidth` só para «a janela é 320». (c) quatro mutações
vermelhas. (d) 149, zero testes novos. (e) **o ensaio `--headed` arranca e reprova por um defeito real
do produto**: ver o bloco de fecho «T93, volta 3» em `TASKS-fechado.md`. (f) gate 5/5.

**Critério novo (Lead, 2026-11-22), vindo do OPCIONAL do Revisor na T93 volta 3 — entra nesta
tarefa porque é o mesmo defeito que ela existe para fechar:** a guarda compara contra
`documentElement.clientWidth`, que em headless é 320 (sem barra de scroll) e portanto **tolera ~19 px**;
a parede real é **305**. Uma etiqueta mais longa ou 5 px de padding passam o gate sem nada ficar
vermelho, e só um `--headed` apanha. Exigência: o projeto `estreito` passa a **medir a parede de 305
por omissão** — barra clássica forçada (por exemplo `ignoreDefaultArgs: ['--hide-scrollbars']` ou o
`launchOptions` que o provar) **ou** a asserção do cabeçalho a correr também sem esconder a barra.
Prova de que morde: acrescentar ~10 px de padding ao cabeçalho **em memória** e o spec tem de ficar
vermelho no `pnpm test:e2e e2e/89` normal, sem `--headed`; sem o acrescento, verde. Se o mecanismo
escolhido mudar o custo da suite, diz quanto.

**Volta 2 — entrega do Dev (`relatorios/T94.md` §8):** o projeto `estreito` arranca com
`launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] }`; a comparação continua a ser contra
`clientWidth`. Sem barra `320/320/320`, com barra `320/305/305`; custo na suite **nenhum** (1 teste,
4,7 s). Varredura do padding: 4/9/12 px não transbordam, **14** dá 307, 16 dá 309, 20 dá 313 — e só com
a barra medida. Quinta mutação `T89_MUTAR=parede` (16 px) falha com «nenhum filho do cabeçalho passa da
janela» · `Expected −1 / Received +3`. Quatro mutações antigas continuam vermelhas; 149,
`0 restante(s)`; gate 5/5, `BUILD_ID Rl7I5TP7awnNhriLjNGwv`. Zero git, `apps/` intocado.

**Volta 2 — QA `PASS` (`relatorios/T94-qa.md`):** sem `--headed`, o spec vê **320/305/305** com barra
forçada (320/320/320 sem ela); `T89_MUTAR=parede` → `[]` vs `[309]`; **cinco** mutações vermelhas
(`nav` 124,9 vs ≤122,5 · `toque` 28 · `cabecalho` `[]` vs `[424,8]` · `limiar` 1 vs >10 · `parede` `[]`
vs `[309]`); `grep innerWidth` só na linha 158 (`viewport`) e comentários, comparações em 165/233/234;
`--headed` verde (4,1 s); suite **149 passed (8.9m)**, `0 restante(s)`, EXIT=0, `BUILD_ID
03H7mPpSGRhy2HWUX1HXU`. **Limite medido e escrito:** nesta máquina a barra vale **15 px**; com
`--enable-features=OverlayScrollbar` a parede volta a **320** e +16 px **ainda passa** (320/320) — o
piso de 305 é do sistema, não do teste. O teste garante «cabe na largura útil do browser onde corre».
Em revisão: asserções não afrouxadas, alvo novo da mutação `cabecalho`, e se o `ignoreDefaultArgs` é a
metade certa ou se o teste devia fixar a largura da barra.

**Dois achados do Revisor na revisão da T89, ambos de uma a duas linhas, e ambos do mesmo tipo: um
teste que pode mentir sem ninguém dar por isso.**

1. **A mutação não verifica que a classe existia.** `T89_MUTAR=nav|cabecalho|limiar` remove classes
   **por nome** (`e2e/89-guarda-320.spec.ts:128-144`) e não confirma que elas estavam lá. Se a T85 ou a
   T88 mudarem de classe — o próprio QA escreveu esse cenário —, a mutação não remove nada, o spec
   corre **verde** e a «prova de que a guarda morde» passa a ser falsa. Correção: antes de remover,
   afirmar que a classe existe (ou contar os nodos alterados e exigir `> 0`).
2. **`window.innerWidth` conta a barra de scroll, `scrollWidth` não.** Em headless o Chromium recebe
   `--hide-scrollbars` e o número é exato; com `--headed` o `docScrollWidth` passa a 320−17 e a linha
   do «a página não transborda» fica **vermelha sem o produto ter mudado** (`:74-80,120-121`).
   Correção: comparar com `document.documentElement.clientWidth`, guardando o `innerWidth` só para o
   «a janela é mesmo 320».

**Critério:** (a) as duas correções, com as três mutações a continuarem a falhar; (b) o spec conta
continuar a **147**; (c) um ensaio **`--headed`** a passar (é a prova do item 2, e é a única forma de
o demonstrar); (d) `format:check`/`lint`/`typecheck` a 0. Não mexer em `apps/`.

## Bloco de fecho — T95 (fechada 2026-11-22)

- **Fechado:** T95 — *uma só fonte de `cn`*: `no-restricted-imports` com `paths: [{ name: 'cn' }]` nos
  **dois** configs (`apps/web` e raiz), o shim `packages/shared/src/utils/cn.ts` **apagado** e o
  `export * from './cn'` fora do `utils/index.ts`. `cn/config` continua permitido — é o match exacto que
  deixa `lib/utils.ts` construir o `createCn`.
- **Prova:** cadeia Dev (3 voltas) → QA `PASS` → Revisor «pode commitar: **sim**» (0 bloqueia, 0 deve,
  0 opcionais) nos dois passos finais. A regra morde nas mãos do QA nos **dois** sítios
  (`packages/shared/src/utils/__qa-t95-cn.ts` → `Failed: @repo/shared#lint`, EXIT=1; `apps/web/src` →
  EXIT=1), e depois de apagar `4 successful`, **`Cached: 0`**, EXIT=0. `pnpm lint --force` → 0 com
  `Cached: 0`; `typecheck` 0 (4 tasks); `format:check` 0; **598/598** unitários; suite de frio **149
  passed (9.3m)**, `0 restante(s)`, EXIT=0; `pnpm build --force` → **`BUILD_ID KzqzgAu4qWMSToaA9A_EW`**.
  `grep "from 'cn'"` no `src` → **0**; `grep -rn ClassValue` no repositório → **0** (a remoção era
  segura, não só silenciosa). Relatórios: `relatorios/T95.md`, `relatorios/T95-qa.md`.
- **O que isto não resolve:** (1) **a dependência `cn: ^0.4.0` continua declarada em
  `packages/shared/package.json:22`** sem um único import no pacote — fica fora por decisão minha,
  porque removê-la exige `pnpm install` e mexer no `pnpm-lock.yaml`, e não entra por arrasto numa volta
  de lint; **é a linha a apagar na próxima vaga que mexa no lock**. (2) A regra é duplicada em seis
  linhas nos dois configs, com a razão escrita em ambos: dois configs, duas cópias, e é o preço
  aceitável de o `packages/*` ser lintado pelo da raiz. (3) O `paths` é match exacto por desenho: um
  import de `'cn/subpath'` novo não é apanhado até alguém o escrever.
- **Aberto:** nada desta tarefa. O instantâneo `docs/analise/02-estado-atual-do-projeto.md` ganhou uma
  **nota de estado** (+1/0) em vez de ser reescrito — decisão minha, com o achado do QA reconhecido como
  certo e o remédio trocado.
- **Repositório:** `fix/t73-parcelamentos-cartoes`; commit `a78cccd` **por enviar**.
- **Decisão:** nenhuma nova. A D30 continua a valer.

### T95 — uma só fonte de `cn` (Dev) — **fechada 2026-11-22**

**Atualizações minhas para o arranque (2026-11-22):** a baseline do critério (d) é **149**, não 147
(as specs da T89, T92 e T97 entraram depois); e a (e) pede `sha256` igual, mas a T93 mudou `px`/`gap`
do cabeçalho — compara só o que esta tarefa não toca e diz o que ficou de fora.

**Dois achados do Revisor na T90, com a mesma consequência: o `cn` sem a escala pode voltar sem
ninguém dar por isso.**

1. **Nada impede um `from 'cn'` novo.** A T90 apontou os 39 `components/ui/*` a `@/lib/utils`, mas a
   regra vive no comentário. Um `no-restricted-imports` no `apps/web/eslint.config.mjs` (o de
   `apps/web`, não o da raiz — o próprio ficheiro diz que cada um traz o seu) com
   `paths: [{ name: 'cn', message: 'usa `cn` de `@/lib/utils` (escala de texto, T78)' }]` torna a regra
   uma coisa que o `lint` cobra. **`cn/config` é outro especificador e fica permitido** — é isso que
   deixa `lib/utils.ts` construir o `createCn`.
2. **`packages/shared/src/utils/cn.ts:11`** reexporta `cn` do pacote **nu** e o docblock afirma «so the
   entire workspace has exactly one Tailwind class-conflict engine». Era verdade antes da T90; agora há
   dois motores e o daqui **não tem a escala**. É público (`packages/shared/package.json` → `./utils`) e
   hoje **ninguém** o importa (`grep @repo/shared/utils` → só um comentário em
   `packages/shared/src/index.ts:8`). O risco é o primeiro import: 16 px em silêncio, com um comentário a
   jurar o contrário.

**Critério:** (a) a regra de lint em vigor e **provada a morder** — um ficheiro de teste com
`from 'cn'` tem de falhar o `lint` (usa um ficheiro temporário e apaga-o, ou o próprio teste do ESLint
se houver); (b) o shim do `shared` **apagado** (com o export removido de `packages/shared/src/utils/index.ts`
e do `package.json` se ficar a apontar para nada) **ou** reduzido a uma nota que diga que o `cn` da app
é outro — escolhe uma e justifica; (c) `lint` e `typecheck` a 0 em **todo** o workspace, porque se mexe
fora de `apps/web`; (d) suite de frio com a baseline **149**, `0 restante(s)`; (e) as capturas de
`/transacoes` nos dois temas continuam a bater `sha256` com as da T90 (nada disto muda pintura).

**Volta 1 — entrega do Dev (`relatorios/T95.md`):** regra `no-restricted-imports` com
`paths: [{ name: 'cn', … }]` no `apps/web/eslint.config.mjs` (+24, zero exceções); prova com um
`src/t95-temp-cn.ts` → `exit 1` com a mensagem da regra, apagado → `exit 0`; **`'cn/config'` continua
permitido** (`lib/utils.ts` sem `eslint-disable`). O shim `packages/shared/src/utils/cn.ts` foi
**apagado** (−12) com o `export * from './cn'` fora de `utils/index.ts`, porque deixá-lo como nota
mantinha um ficheiro exportado que o próximo leitor lê como API; ninguém o importava. `lint` e
`typecheck` da **raiz** a 0 (4 tasks, `Cached: 0`), 0 imports de `'cn'` no `src`, `format:check` 0,
598/598 unitários, `BUILD_ID J7DO2zSb5t56e1uC4fII0`. A alínea (e) do `sha256` **não foi usada** (anulada
por mim: a T93 já mudou o cabeçalho).

**Volta 1 — QA `FAIL` (`relatorios/T95-qa.md`), tudo o resto passa:** a regra morde nas mãos dele
(`EXIT=1` com ficheiro dele, `EXIT=0` depois, árvore igual), `cn/config` permitido sem `eslint-disable`,
shim sem referências no código, `grep "from 'cn'"` → **0**, raiz 0/0/0, **598/598**, suite **149 passed
(9.3m)**, `0 restante(s)`, `BUILD_ID EqGf_lA5Al38AOHqf_rQI`, `/transacoes` igual a 1440 e 390. O **único**
achado: três referências ao shim em `docs/analise/02-estado-atual-do-projeto.md` (`:267`, `:331`, R13 em
`:458`).

**Decisão minha (volta 2):** esse ficheiro é um **retrato datado de 2026-10-10** e o corpo **não se
reescreve** — as três passagens estavam certas quando foram escritas, e reescrever um instantâneo é
falsificá-lo. Acrescenta-se uma **nota de estado** no topo (T95 fechou a R13) e o corpo fica intacto.

**Volta 2 — entrega do Dev (`relatorios/T95.md` §8):** **uma linha adicionada** no topo do documento
(bloco de citação datado, a dizer 2026-10-10, «não é atualizado», R13 resolvida na T95, e apontar para
`docs/gestao/`). `git diff | grep -c "^-"` → **0**. **QA `PASS`:** diff de **+1/0**, as três passagens
intactas em `:268`, `:332`, `:459`, e o resto da árvore igual à volta 1. O QA escreveu «FAIL retirado por
decisão de âmbito do Lead, 2026-11-22 — nota de estado em vez de reescrita» e registou que **o achado
estava certo**; o que mudou foi o remédio. Sem suite repetida (nada de código mudou).

**Volta 2 — Revisor: 1 DEVE, 1 OPCIONAL, «pode commitar: não».** DEVE: o bloco novo vive em
`apps/web/eslint.config.mjs:37-58`, mas o `packages/*` é lintado pelo config da **raiz**
(`eslint.config.mjs:27` `files`, `:32` `rules`), que não tem a regra — alguém volta a escrever
`export { cn } from 'cn'` em `packages/shared/src/utils/` (onde estava o shim) e o lint passa verde.
OPCIONAL (`packages/shared/package.json:22`): `"cn": "^0.4.0"` sem um único import no pacote — fica
para o fecho, porque exige `pnpm install` e mexer no lock. Confirmado: `paths: [{ name: 'cn' }]` é match
exacto (`cn/config` e `@repo/shared/utils` foram do filtro); diff **puramente aditivo** (24/0); o
comentário de `src/index.ts:8` continua verdadeiro (`@repo/shared/utils` existe, só deixou de trazer o
`cn`); `grep -rn ClassValue` → **0**, logo a remoção era segura e não apenas silenciosa.

**Volta 3 aberta com o Dev:** a mesma regra no config da raiz, com a prova a ser feita **dentro de
`packages/shared/src/utils/`** e não em `apps/web`.

**Volta 3 — entrega do Dev (`relatorios/T95.md` §9):** o mesmo `no-restricted-imports` no
`eslint.config.mjs` da raiz, num objecto com `files` próprio e **antes** do `prettier` (que fica em
último), portanto não inerte por ordem. Vermelho em `packages/shared/src/utils/__t95-cn.ts`
(`@repo/shared:lint` → `exit 1`) e em `apps/web/src` (`exit 1`), verde nos dois depois de apagar;
`pnpm lint` raiz 0 (4 tasks, `Cached: 0`); `typecheck` 0, `format:check` 0, `build` 0. Suite não
repetida (só config mudou).

**Volta 3 — QA `PASS` (`relatorios/T95-qa.md` §«Volta 3»):** `packages/shared/src/utils/__qa-t95-cn.ts`
→ `@repo/shared:lint` `1:1 error … no-restricted-imports`, `Failed: @repo/shared#lint`, EXIT=1;
apagado → `4 successful`, `Cached: 0`, EXIT=0; `apps/web` vermelho e verde na mesma sequência;
`pnpm lint --force` → **0** com **`Cached: 0`**; `typecheck` 0; `pnpm build --force` → **`BUILD_ID
KzqzgAu4qWMSToaA9A_EW`**. O `BUILD_ID` antigo (`EqGf_…`) era o da corrida do QA da volta 1,
restaurado pelo cache do turborepo (hash de inputs igual) — o Next gera o id por build, e com `--force`
saiu novo. Sem suite repetida.

## Bloco de fecho — T96 (fechada 2026-11-22)

- **Fechado:** T96 — *a regra base dá peso de controlo a todas as bordas decorativas*: o
  `* { @apply border-border }` do `@layer base` passou a **`border-border-subtle`** (o token da T91), e o
  gatilho «Mais» do cabeçalho ganhou `border-border` porque é **controlo** e tinha caído a 1,94.
- **Prova:** cadeia Dev (3 voltas) → QA `PASS` → Revisor «pode commitar: **sim**» (0 bloqueia, 0 deve,
  1 opcional de prosa, fechado na volta 3). No browser: **92 bordas** que vinham da base passam de
  `131,139,141` a **`177,185,188`** no claro; os cinco controlos da fila do cabeçalho a **3,38 / 3,48**
  (o «Mais» voltou de 1,94), com «sair» e gaveta sem limite (`border-width: 0` e 1 px transparente,
  confirmados). `axe` sem violações; suite de frio **149 passed (9.6m)**, `0 restante(s)`, EXIT=0,
  `BUILD_ID Tb4MIpXgcBD3FGAkrGPlm`. Layout igual: cartão **509,8**, linha **63**, `scrollHeight`
  **2633**. **A T93 não regrediu:** a 320 com barra forçada, `305/305`, 0 filhos fora, seis alvos 44×44.
  Relatórios: `relatorios/T96.md`, `relatorios/T96-qa.md`.
- **O que isto não resolve:** (1) **no escuro a borda decorativa fica a 1,36:1** (1,14 contra o cartão) —
  visível mas muito discreta; a leitura do cartão passa a vir do preenchimento. **Não abre tarefa**: o que
  falta no escuro são os limites de **controlo** (`--input` a 1,58), não os divisores. (2) As **células
  do calendário** (42, clicáveis) ficam subtis por **D31** — a borda é também o separador da grelha; se um
  dia se quiser mais affordance, é `hover:border-border`, não uma grelha a 3,38. (3) As contagens
  divergiram entre os três agentes: **139** (minhas ocorrências da utilidade), **96 strings / 219
  elementos** (Dev) e **191 visíveis, 92 da base** (QA, a mais fina). Fica registado qual é qual.
- **Aberto:** nada desta tarefa.
- **Repositório:** `fix/t73-parcelamentos-cartoes`; commit `31118ee` **por enviar**.
- **Decisão:** **D31** (células do calendário).

### T96 — a regra base dá peso de controlo a todas as bordas decorativas (Dev) — **fechada 2026-11-22**

**Atualizações minhas para o arranque (2026-11-22):** a baseline da alínea (e) é **149**, não 147 (a T89,
a T92 e a T97 entraram depois); o cabeçalho mudou de `px`/`gap` na T93 (o `border-b` dele é um dos 139,
confirma-o a 320 com barra de scroll); e o `axe` (`e2e/80`) também olha para `/definicoes` — se a regra
base baixar o contraste de uma borda de **controlo**, o axe apanha e é bom que apanhe, mas não o
silencies.

**Volta 1 — entrega do Dev (`relatorios/T96.md`), uma linha em `globals.css`:** a regra base passou a
`@apply border-border-subtle` (token da T91, nenhum inventado); `--border` intocado; **zero** ficheiros
do `src` a corrigir. Contagem dele: **96 strings em 55 ficheiros** e **219 elementos** com borda visível
nas cinco rotas (o meu 139 contava ocorrências da utilidade; **vale o dele**). Depois da mudança, o que
continua a `--border` é quem o declara: em `/transacoes`, `border-border` ×39, `border-input` ×35,
`border-border` ×8, `border-input` ×4. Controlos no claro: Input **3,38/3,48**, Textarea 3,48, Select
3,38/3,48, Button de contorno 3,38/3,48; no escuro 1,58/1,32 nos quatro, **igual a antes** (dívida da
T78). Layout: cartão 509,8→509,8, linha 63→63, `scrollHeight` 2633→2633. Gate 5/5, `BUILD_ID
_wwXJ_dHWzqF4_eFBH2-h`.

**Volta 1 — QA `PASS` (`relatorios/T96-qa.md`), com ressalva no escuro:** 191 bordas visíveis nas
cinco rotas, **92 da base** (o Dev contou 219 incluindo explícitas; eu 139 ocorrências da utilidade —
três métodos, o do QA é o mais fino). Claro: as da base passam de `131,139,141` a **`177,185,188`**;
controlos **3,38/3,48** nos quatro, bordas `131,139,141`, nenhum abaixo de 3. **Escuro:** `--border-subtle`
`40,47,53` → **1,36:1** contra o fundo e **1,14:1** contra o cartão («filete muito discreto»; antes
1,23:1 contra o cartão) — não desapareceu, a leitura do cartão passa a vir do preenchimento. `axe` sem
violações em `/contas`, `/definicoes`, `/contas-pagar-receber`, `/consolidacao-contas`; suite **149 passed
(8.8m)**, `0 restante(s)`, EXIT=0, `BUILD_ID kKjbrlhWUls4GP8hHlt3n`. Layout 509,8 / 63 / 2633 iguais.

**Volta 1 — Revisor: 1 DEVE, 1 OPCIONAL, «pode commitar: não».** DEVE em `app-shell.tsx:98`: o
gatilho «Mais» é um `<summary>` com `rounded-lg border` **sem cor**, herdava 3,38 da base e cai para
**1,94** — o **único controlo da app que regride**, numa fila onde busca, montantes e tema são `Button`
com `border-border` explícito; e sem fundo até ao hover, o contorno é o que desenha o botão. Confirmou
o que a T96 fez bem: no CSS construído a regra só compila `border-color`/`outline-color` (sem `divide-*`
nem `ring-*`), o `--border-subtle` não foi redefinido, e o comentário não promete número que não meça.
**OPCIONAL** (células do calendário, `calendar-day-dialog.tsx:290,329`): **decidido por mim em
`DECISOES.md` D31** — ficam subtis, porque a borda da célula é também o separador da grelha e 42
células a 3,38 punham peso de campo em todo o ecrã. **Escuro a 1,36:1 passa** e não abre tarefa: é a
dívida do T78, a leitura do cartão vem do preenchimento, o `axe` está limpo, e o que falta no escuro são
os limites de **controlo** (`--input` a 1,58), não os divisores.

**Volta 2 aberta com o Dev:** `border-border` no `summary` e a frase do comentário a enumerar **cinco**
controlos, não quatro.

**Volta 2 — entrega do Dev (`relatorios/T96.md` §9):** `border-border` no `summary` do «Mais»
(`app-shell.tsx:98`) e o comentário do `globals.css` a enumerar os **cinco** controlos. Medido no browser:
«Mais» **1,94 → 3,38** no claro e 1,36 → **1,47** no escuro (o `--border` do tema, dívida da T78); busca,
montantes e tema **3,38 / 1,58** sem mudar; o «sair» **não tem borda** (`border-width: 0`) e não entra na
contagem. Células do calendário intocadas (D31). Gate 5/5, `BUILD_ID DNYxxC366dLJYNCIgwJga`.

**Volta 2 — QA `PASS` (`relatorios/T96-qa.md` §«Volta 2»):** «Mais» `131,139,141` · **3,38** · 3,48 no
claro e `45,52,58` · **1,47** · 1,23 no escuro; as outras três da fila a 3,38/1,58; o «sair»
`border-width: 0` e a gaveta com 1 px **transparente** — limites que não existem, **confirmados** em vez
de aceites. `git diff` do `app-shell.tsx` = **uma linha**. **A T93 não regrediu:** a 320 com barra
forçada, `clientWidth 305 · scrollWidth 305 · 0 filhos fora · seis alvos 44×44`. Suite **149 passed
(9.6m)**, `0 restante(s)`, EXIT=0, `BUILD_ID Tb4MIpXgcBD3FGAkrGPlm`; `axe` sem violações. Calendário fora
do diff, célula a **1,94** (D31).

**Volta 2 — Revisor: 0 BLOQUEIA, 0 DEVE, 1 OPCIONAL, «pode commitar: sim».** Confirmou o DEVE fechado
(`1/1` no diff, resto da classe intacto), que a **D31 resolve o OPCIONAL** das células (a borda é também o
separador da grelha; conteúdo + `hover`/`active` identificam a célula; dívida fica com nome e número), e
que a regra base só toca `border-color`/`outline-color` (sem `divide-*`/`ring-*`, `--border`/`--input`
intactos). OPCIONAL, que **fecho agora** por ser prosa com prazo: a frase do `globals.css:216-217` diz
que a lista é **completa** e enumera cinco controlos — um sexto com `border` nu torna-a falsa em silêncio
(o mesmo rot da T78/T87/T92). **Volta 3:** «completa» sai, «por exemplo» entra, só o comentário.

**Achado do Revisor na T91, alargado por mim com uma contagem.** O `border-b` do cabeçalho não tem
cor e cai na regra base `* { border-color: var(--border) }` (`globals.css:210-211`). Depois da T78 o
`--border` está a **3,38:1** — o mínimo da WCAG para **limites de controlo** — e essa regra pinta
**toda** borda sem cor explícita: contei **139 linhas** no `src` (`rounded-xl border bg-card`,
`border border-dashed` dos estados vazios, separadores de secção, o `border-b` do cabeçalho). A WCAG
não exige 3:1 a nada disso. Efeito visível: cartões e caixas com um contorno que compete com o dos
campos, e o cabeçalho a 3,38 a encontrar o bordo da barra lateral a 1,94 (T91).

**Critério:**

- (a) Medir primeiro: quantas bordas sem cor explícita existem, onde, e a que peso ficam hoje. A
  contagem é a base do resto — sem ela a mudança é um chute.
- (b) Decidir **uma** das saídas e justificar com números: (1) a regra base passa a
  `--border-subtle` e quem precisa de 3:1 diz `border-input`/`border-border` de propósito; ou (2) a
  regra base fica e cada família de sítio declara o seu token. A (1) é uma linha e é a que eu espero
  que ganhe, mas a decisão é medida, não escolhida por gosto.
- (c) **Prova de que os controlos continuam a 3:1:** `Input`, `Textarea`, `Select` e `Button` com
  variante de contorno medidos no browser — se algum perder o limite de controlo, é FAIL, e o
  conserto é uma classe nele, não o token.
- (d) Capturas a 1440 e 390 nos dois temas de **cinco** ecrãs representativos: um com cartões
  (`/contas`), um com tabela (`/transacoes`), um com estados vazios (`/cartoes` ou `/consolidacao-contas`),
  um com formulário (`/transacoes`, o quick-add) e o calendário. Mais o canto superior esquerdo, onde o
  cabeçalho encontra a barra lateral.
- (e) Gate 5/5 e suite de frio com a baseline **147**, `0 restante(s)`.
- (f) Se a mudança alterar alguma altura ou largura (borda fina não muda layout, mas confirma),
  di-lo com o número.

## Bloco de fecho — T98 (fechada 2026-11-22)

- **Fechado:** T98 — *a falha de rede no formulário de preferências fica muda*: a excepção do `await` da
  server action passa a ser apanhada dentro do callback do `startTransition`, com `try` **mínimo** (só o
  `await`, `catch` com `return`), e o utilizador lê «Não consegui ligar ao servidor — as preferências não
  foram guardadas. Verifica a ligação e tenta outra vez.» em vez de perder o formulário.
- **Prova:** cadeia Dev (2 voltas) → QA `PASS` → Revisor «pode commitar: **sim**» (0 bloqueia, 0 deve,
  0 opcionais). Antes: a rejeição subia como *unhandled rejection*, o **error boundary** do segmento
  apanhava-a — `form` → **0** e `main` → «Algo falhou ao carregar este ecrã». Depois: `forms` **1**, `h1`
  «Definições», `[role="alert"]` com a frase, botão `disabled:false`, base **1/CASH/EUR** (não gravou);
  com o `unroute` e sem recarregar, toast e base **21/CASH/EUR**. Sete validações de tipo a rejeitar sem
  escrever. Suite **150 passed (8.7m)**, `0 restante(s)`, `BUILD_ID kraxTHyE8cWtMsgwbN6U2`, `axe` sem
  violações; `e2e/97` a **2 passed**. O teste novo morde: sem o `catch`, `Expected substring: "não foram
  guardadas" · element(s) not found · 1 failed`. Relatórios: `relatorios/T98.md`, `relatorios/T98-qa.md`.
- **O que isto não resolve:** (1) **`requireUser()` faz `redirect('/entrar')`**, que lança; **ninguém
  verificou** como o Next entrega esse `throw` ao cliente numa Server Action. Se chegar como rejeição, a
  frase de rede fica errada nesse caso — o teste que decide é apagar o cookie da sessão e carregar em
  Guardar. Fica por medir. (2) «as preferências **não foram guardadas**» é uma afirmação que o cliente só
  pode fazer quando o pedido não chegou ao servidor; se a resposta se perder **depois** da escrita, a base
  fica com o valor novo e a frase mente — inerente a Server Actions, e é a redacção que a alínea (a) pedia.
  (3) O `catch` nu apanha qualquer rejeição de transporte sem distinguir a causa (é o certo: a acção já
  converte falhas de domínio em `ok:false`, e as mensagens de rede variam por browser e locale).
- **Aberto:** nada desta tarefa. A fila autorizada (T93–T98) está fechada.
- **Repositório:** `fix/t73-parcelamentos-cartoes`; commit `f584d73` **por enviar**.
- **Decisão:** nenhuma nova.

### T98 — a falha de rede no formulário de preferências fica muda (Dev) — **fechada 2026-11-22**

**Contexto de arranque (Lead):** a contagem da alínea (d) é **150** se acrescentares um teste; o `e2e/97`
já existe e assere o toast de sucesso aos 3 s com o `esperarAviso`. A mensagem de erro deve ir pela via
que a casa já usa (`toast` do `sonner`, que é o padrão em 39 ficheiros) e não por um parágrafo novo: o
formulário já tem um `role="alert"` para o `fail()` de validação e não vale a pena ter dois canais para
o mesmo utilizador.

**Volta 1 — entrega do Dev (`relatorios/T98.md`), e o achado era pior do que «mudo»:** a excepção
morria na `await savePreferences(...)` **dentro** do callback do `startTransition`; a rejeição subia como
*unhandled rejection* e o **error boundary do segmento** apanhava-a — `form` → **0** e o `main` passava a
«Algo falhou ao carregar este ecrã». O `catch` ficou à volta do `await`, com a frase «Não consegui ligar
ao servidor — as preferências não foram guardadas. Verifica a ligação e tenta outra vez.». Segundo teste
no `e2e/97` (contagem **150**) que aborta, exige a mensagem, o botão ativo e o `h1`, e depois grava;
**degradado** (sem `catch`) → `Expected substring: "não foram guardadas" · element(s) not found · 1
failed`; restaurado → 2 passed (7.9 s). Gate 5/5, `BUILD_ID fcybuCGojuWiXcJ8rVkVY`.

**Volta 1 — QA `PASS` (`relatorios/T98-qa.md`):** com o POST abortado (sessão QA própria), `forms` **1**,
`h1` «Definições», `main` normal (**sem** «Algo falhou ao carregar este ecrã»), `[role="alert"]` com a frase
de rede, botão `disabled:false`, base **1/CASH/EUR**; depois de `unroute`, **sem recarregar**, toast e base
**21/CASH/EUR**. Sete validações a rejeitar sem escrever; `where: { id: user.id }`; `currency` EUR; setas
ok; `afterAll` a repor 1/CASH (correu o `e2e/97` real sem `globalTeardown`). Saída vermelha **citada** do
relatório do Dev, não corrida («não degradei o componente»). Suite **150 passed (8.7m)**, `0 restante(s)`,
`BUILD_ID kraxTHyE8cWtMsgwbN6U2`, `axe` sem violações. **Achado do QA:** o `try` não era mínimo — cobria
o `await`, o `if` com `setErro` e o `toast`.

**Volta 2 — entrega do Dev (`relatorios/T98.md` §8):** `let resultado` fora do `try`, o `try` fecha logo
depois do `await`, o `catch` faz `setErro` + `return`, e o `if (!resultado.ok)` e o `toast.success` ficam
**fora**. Assim um `toast` que lance nunca se disfarça de erro de rede. `e2e/97` **2 passed (7.7 s)**; gate
5/5, `BUILD_ID i7EXfAmFyBXw_EkAPkhF4`. Sem suite repetida (comportamento observável igual; a corrida do
QA a **150** continua válida).

**Achado do QA na verificação final da T97, e não entrou nessa tarefa porque ela já tinha gasto as
três voltas.** O `role="alert"` só aparece quando a acção devolve `fail()`; se o **POST abortar** (rede,
servidor em baixo), o `startTransition` **não tem `catch`** — o ecrã não mostra nada, o botão volta ao
normal e a única marca é `TypeError: Failed to fetch` na consola. Medido pelo QA abortando o pedido.

**Critério:**

- (a) Abortar o POST (o QA usou o bloqueio do pedido; serve `page.route` com `abort`) tem de produzir
  **mensagem visível** — a mesma via dos outros erros (`toast.error` ou o parágrafo `role="alert"`), com
  texto que diga que não gravou e que se pode tentar outra vez.
- (b) O botão tem de voltar a `enabled` **em todos** os caminhos: sucesso, `fail()` e excepção.
- (c) **Nada regride:** as sete validações de tipo (`true`, `["21"]`, `[21,22]`, `""`, `null`, `{}`,
  `"21abc"`), o isolamento `where: { id: user.id }`, `currency` intocada, o toast de sucesso, as setas do
  radiogroup, e o `afterAll` do spec a repor 1/CASH.
- (d) Spec: um teste que aborta o pedido e assere a mensagem — e prova de que morde (sem o `catch`, fica
  vermelho). Contagem **150** (149 + 1) ou a que resultar.
- (e) Gate 5/5 e suite de frio, `0 restante(s)`.

## Bloco de fecho — T99 (fechada 2026-11-22)

- **Fechado:** T99 — *o `redirect` da sessão expirada numa Server Action*. **Nada foi mudado no produto.** A
  dúvida do Revisor na T98 ficou **desmentida por medição**: o `redirect` do `requireUser` viaja no protocolo
  da acção (`x-action-redirect: /entrar;push`) e o Next navega; a continuação **não produz efeito
  observável** (sem toast, sem alerta, sem `pageerror`), e a proteção de uma linha não é necessária.
- **Prova:** Dev em 2 voltas de medição → **sem QA por decisão minha** (nenhuma linha de produto mudou; a
  prova é um cabeçalho e uma ausência de efeitos) → Revisor «**fecha assim: sim**». «Voltar» medido:
  `/definicoes` → `/entrar` → `/` → `/entrar` → `/definicoes`, **sem estado morto**. Gate 5/5, `BUILD_ID
  VpbMpo2_GbqTQEHKJyxzc`; instrumentação temporária restaurada (`grep __valor/__passou` → 0). Relatório:
  `relatorios/T99.md`.
- **O que isto não resolve:** (1) a afirmação forte «a continuação **não retoma**» **não está provada** —
  `window.__passou: false` num contexto que a navegação descarta não a sustenta; prová-la exigiria o marcador
  em `sessionStorage` lido em `/entrar`, e não foi feito porque a decisão se sustenta na ausência de efeitos.
  (2) **Aterrar em `/entrar` perde o que estava por gravar** no formulário — o dia e o regime escolhidos mas
  não submetidos voltam aos da base; aceitável, e é consequência. (3) `/entrar` mostra o formulário mesmo com
  sessão ativa — comportamento da página de entrada, fora do âmbito.
- **Aberto:** nada desta tarefa.
- **Repositório:** sem código; documentos e o relatório.
- **Decisão:** nenhuma nova — «deixar como está, custo zero».

### T99 — o `redirect` da sessão expirada numa Server Action (Dev) — **fechada 2026-11-22**

**Achado do Revisor na revisão da T98, e é um vazio de conhecimento, não um defeito provado.** O
`requireUser()` faz `redirect('/entrar')` num caminho que **lança** (`NEXT_REDIRECT`), e está **fora** do
`try` da acção (`preferences-actions.ts:34`) precisamente para não ser engolido. Mas numa **Server Action
chamada do cliente** o Next não "navega" como numa renderização: o `throw` atravessa a fronteira. Ninguém
mediu **o que o utilizador vê** quando a sessão expira a meio de um Guardar. Se chegar como rejeição, o
`catch` da T98 mostra «Não consegui ligar ao servidor — as preferências não foram guardadas» a quem só
precisava de entrar outra vez.

**Critério — isto é uma medição, não uma correção:**

- (a) **Provocar o caso:** sessão válida em `/definicoes`, apagar/expirar o cookie e carregar em Guardar.
  Diz **o que acontece**: redirecciona para `/entrar`, mostra a mensagem de rede, não mostra nada, ou outra
  coisa. Com a prova de cada um (URL final, `h1`, `[role="alert"]`, consola).
- (b) **Dizer onde o `throw` morre:** é entregue como redireccionamento ao cliente, ou como rejeição
  apanhada pelo nosso `catch`? Cita o que vês — o texto da mensagem é o indicador mais direto.
- (c) **O mesmo teste com a T98 removida em memória** (sem `catch`): para saber se o `catch` está a
  **esconder** um redireccionamento que funcionava. Isto decide se a T98 introduziu uma regressão em vez de
  a corrigir.
- (d) **Não mudes código nesta tarefa.** O resultado é um relatório com a medição e **uma recomendação**
  (deixar como está / distinguir o erro de sessão / tratar o redirect antes do `catch`), com o custo de cada
  uma. A decisão é minha e só a tomo com o número.
- (e) Se precisares de um spec para a medição, escreve-o **descartável** (diz onde e apaga-o); não
  acrescentes testes à suite nesta tarefa.

**Volta 1 — medição do Dev (`relatorios/T99.md`), nenhum código mudado:**

| caso | URL final | `h1` | `[role="alert"]` | consola |
| --- | --- | --- | --- | --- |
| sessão válida | `/definicoes` | Definições | — | vazia |
| sessão apagada **com** `catch` | **`/entrar`** | Entrar | **nenhum** | vazia |
| sessão apagada **sem** `catch` | **`/entrar`** | Entrar | **nenhum** | vazia |

**A prova:** resposta do POST `status 200 · content-type text/x-component · **x-action-redirect:
/entrar;push**`. O Next serializa o `redirect()` como cabeçalho da acção, a promessa **resolve**, o `await`
não lança, o `catch` da T98 **nunca corre** e o router navega. Conclusões: (b) o `throw` morre no protocolo,
não no nosso `catch`; (c) a T98 **não** escondeu um redirect — com e sem `catch` o resultado é idêntico.
**Recomendação: deixar como está.** **Sem QA por decisão minha:** nenhuma linha de produto mudou e a prova é
um cabeçalho capturado, não um comportamento que outra mão meça de forma diferente; repetir a suite seriam
9 min por zero. Gate (restaurado) 5/5, `BUILD_ID zM51FOqtmlMVb1NnSgG-W`.

**Volta 1 — Revisor: «a medição sustenta a conclusão: sim», com um furo na prova.** O cabeçalho
`x-action-redirect` prova que o `throw` não morre no nosso `catch`; **não** prova que o código depois do
`try` está seguro — `preferences-form.tsx:88` faz `if (!resultado.ok)` e, se a promessa resolver com
`undefined`, é `TypeError`. E «consola vazia» não cobre isso: um erro não apanhado numa transição sai como
**`pageerror`**, não como mensagem de consola. Faltam também duas coisas: o `push` do redirect **não foi
medido** (o «voltar» depois de reentrar) e a consequência **não está escrita** no relatório (aterrar em
`/entrar` perde o que estava por gravar). **Volta 2 pedida ao Dev:** `pageerror` +
`unhandledrejection` ligados, o **valor literal** de `resultado`, os passos do «voltar» e a consequência.
**Volta 1 — medição do Dev (`relatorios/T99.md`), nenhum código mudado:**

| caso | URL final | `h1` | `[role="alert"]` | consola |
| --- | --- | --- | --- | --- |
| sessão válida | `/definicoes` | Definições | — | vazia |
| sessão apagada **com** `catch` | **`/entrar`** | Entrar | **nenhum** | vazia |
| sessão apagada **sem** `catch` | **`/entrar`** | Entrar | **nenhum** | vazia |

**A prova:** resposta do POST `status 200 · content-type text/x-component · x-action-redirect:
/entrar;push`. O Next serializa o `redirect()` como cabeçalho da acção, a promessa **resolve**, o `await`
não lança, o `catch` da T98 **nunca corre** e o router navega. Conclusões: (b) o `throw` morre no protocolo,
não no nosso `catch`; (c) a T98 **não** escondeu um redirect — com e sem `catch` o resultado é idêntico.
**Recomendação: deixar como está.** **Sem QA por decisão minha:** nenhuma linha de produto mudou e a prova é
um cabeçalho capturado, não um comportamento que outra mão meça de forma diferente; repetir a suite seriam
9 min por zero. Gate (restaurado) 5/5, `BUILD_ID zM51FOqtmlMVb1NnSgG-W`.

**Volta 1 — Revisor: «a medição sustenta a conclusão: sim», com um furo na prova.** O cabeçalho
`x-action-redirect` prova que o `throw` não morre no nosso `catch`; **não** prova que o código depois do
`try` está seguro — `preferences-form.tsx:88` faz `if (!resultado.ok)` e, se a promessa resolver com
`undefined`, é `TypeError`. E «consola vazia» não cobre isso: um erro não apanhado numa transição sai como
**`pageerror`**, não como mensagem de consola. Faltam também duas coisas: o `push` do redirect **não foi
medido** (o «voltar» depois de reentrar) e a consequência **não está escrita** no relatório (aterrar em
`/entrar` perde o que estava por gravar). **Volta 2 pedida ao Dev:** `pageerror` +
`unhandledrejection` ligados, o **valor literal** de `resultado`, os passos do «voltar» e a consequência.

**Volta 2 — medição (`relatorios/T99.md` §8-§9), nenhum código mudado:**

```
pageerrors:         []
unhandledrejection: null
window.__passou:    false
window.__valor:     não define (o código depois do try não correu)
url final: /entrar · h1: Entrar
```

**A explicação corrige a volta 1:** não aparece `TypeError` — mas **não porque a promessa resolva bem**. O Next
trata o `x-action-redirect` e navega; **a continuação da acção não é retomada**, logo o `if (!resultado.ok)`
(`:88`) nunca é avaliado. A proteção de uma linha **não é necessária** porque a linha não é atingida.
**«Voltar» medido:** `/definicoes` → (Guardar sem sessão) `/entrar` → (entrar) `/` → Voltar #1 `/entrar` →
Voltar #2 `/definicoes`, **sem estado morto**; `/entrar` mostra o formulário mesmo com sessão ativa
(comportamento da página de entrada). **Consequência escrita (§8.4):** aterrar em `/entrar` **perde o que
estava por gravar** — o dia e o regime escolhidos mas não submetidos voltam aos da base. Gate 5/5,
`BUILD_ID VpbMpo2_GbqTQEHKJyxzc`, sem `pageerror` nem `unhandledrejection`.

**Volta 2 — Revisor: «fecha assim: sim», com a frase do fecho ajustada, e o argumento é melhor que o meu.**
`window.__passou: false` **não prova** que a continuação não retoma — o `window` de um contexto descartado
pela navegação não regista nada, e é indistinguível do caso contrário. A prova que não depende disso é a
**ausência de efeitos**: se tivesse corrido até ao fim com sucesso, haveria `toast.success`; se tivesse
corrido com `resultado` indefinido, haveria `pageerror` em `:88`. Não há nem um nem outro. A frase que fica:
«o `redirect` é tratado pelo Next (`x-action-redirect: /entrar;push`); a continuação da acção **não produz
efeito observável** — nenhum toast, nenhum alerta, nenhum `pageerror` — e a proteção de uma linha não é
necessária porque o caminho não é atingível de forma observável». A afirmação forte exigiria o marcador em
`sessionStorage` lido em `/entrar` (~30 s): **não foi feito, e fica escrito como não provado.**


## Bloco de fecho — T100 (retirada, não reproduzida — 2026-11-22)

- **Retirada, não fechada por mérito:** T100 nasceu de um achado **meu** na verificação pós-deploy e **não
  resistiu à reprodução**. Nenhuma linha de código foi mudada, e é o desfecho certo.
- **O que foi observado, uma vez:** em `/definições`, no separador onde eu tinha estado a trabalhar, o
  trigger mostrava `""` — com captura de ecrã e duas leituras `""` no momento. A sequência em que apareceu:
  escolha por teclado (`Home`+`Enter`) → Guardar (toast) → **mudança de viewport para 320**, com um clique
  numa opção que não registou pelo meio. **O «depois de gravar» foi inferência minha sobre a ordem, não o
  que os registos dizem** — e é a parte que estava errada.
- **As tentativas de reprodução, todas negativas:** o Dev, localmente, com o log do `onValueChange` ligado —
  **nunca recebeu `""`**, nem no mount, nem depois de Guardar, nem numa navegação que remonta o formulário
  (`relatorios/T100.md`); eu, em produção — frio/Guardar/reload, clique imediato a seguir à gravação,
  `305 → 1440 → 305` com o formulário montado, abrir e fechar o Select com `Escape`: sempre «Dia 1».
- **O que fica de valor:** a hipótese do `SelectBubbleInput` do Radix a disparar `change` com `""` no mount
  **está desmentida neste formulário**, e é por isso que a skill `correc-a-o-de-select-controlado` **não se
  aplica aqui**. Se o sintoma voltar, o primeiro passo é o log do `onValueChange` — não a receita.
- **Repositório:** nada. **Decisão:** nenhuma.

### T100 — o `Select` fica vazio depois de gravar (Dev) — **retirada (não reproduzida) 2026-11-22**

**Achado meu na verificação pós-deploy do push de 2026-11-22, em produção.** Em `/definições`, com o dia
de início **1** gravado: um carregamento **frio** mostra «Dia 1»; depois de carregar em **Guardar** (com o
toast «Preferências guardadas.») o campo passa a mostrar **`""`** e um reload volta a «Dia 1». O valor está
na base — o ecrã é que o perde. É a mesma família da T97, ao contrário: grava e parece que não.

**Causa provável, a confirmar na alínea (b):** o `SelectBubbleInput` do Radix escreve no `<select>` nativo
escondido e dispara `change`; como o conteúdo só monta ao abrir, a escrita fica em `""` e chega ao
`onValueChange={setDia}` (`preferences-form.tsx:138`), num Select **controlado**. A receita está na skill
`correc-a-o-de-select-controlado`: **derivar** o valor em vez de o guardar e **filtrar o `""` à entrada**.

**Critério:**

- (a) **Reproduzir primeiro:** registro frio de `/definições` → o campo mostra o dia da base; Guardar →
  o campo **continua** a mostrar o dia da base (é isto que hoje falha); reload → igual. Nas duas direcções
  (dia 1 → dia 21 → volta a 1), com o valor da base confirmado em cada passo.
- (b) **Medir a origem do `""` antes de corrigir:** instrumenta o `onValueChange` para registar **cada**
  valor recebido (e o instante: mount vs interacção). Se o `""` vier do Radix no mount, diz em que chamada;
  se vier de outra coisa (inicialização, re-render, `key` que muda), di-lo — **não apliques a receita da
  skill sem a confirmar no log**, porque um `useState` com valor inicial volta a ser apagado a cada mount e
  a correção certa é derivar.
- (c) **A escolha manual continua a funcionar:** escolher outro dia pela interface tem de mudar o campo, e
  Guardar tem de gravar **esse** dia (não o derivado).
- (d) **Nada regride:** as sete validações de tipo da T97 (`true`, `["21"]`, `[21,22]`, `""`, `null`, `{}`,
  `"21abc"`) a rejeitar sem escrever; `where: { id: user.id }`; `currency`; o toast de sucesso; as setas do
  radiogroup; a mensagem de rede da T98; e o `afterAll` a repor 1/CASH.
- (e) **Spec que morde:** uma asserção em `e2e/97` que, **depois de gravar**, verifica que o trigger mostra
  o dia guardado (hoje falharia). Prova de que fica vermelha sem a correção. Contagem **150 → 151**, ou diz
  se a asserção entra no teste que já existe.
- (f) Gate 5/5; a suite completa é do QA.
- (g) **Sem componente nem dependência novos**, sem refactor não pedido; diff mínimo e justificado linha a
  linha. Capturas do campo preenchido antes/depois, nos dois temas.

**O que não fazer:** não inventes um dia quando não há valor válido (a skill é explícita: um valor inventado
grava o dia errado em silêncio); não toques na server action nem no schema; não mudes o texto da página.

## Bloco de fecho — T101 (fechada 2026-11-22)

- **Fechado:** T101 — *provar que a falha de autorização da T45 está fechada*. **Nenhum código mudado**: a
  verificação já existia (`import-actions.ts:228-235`) e o que faltava era a prova. **A T45 fica fechada**
  depois de 19 dias com a linha a dizer «reprovada na autorização».
- **Prova (por execução, não por leitura):** duas contas do QA, um cartão em cada, POSTs reais das Server
  Actions capturados e repetidos com o `cardId` da vítima:
  `1:{"ok":false,"error":"Cartão não encontrado.","fieldErrors":{"cardId":["Escolhe um cartão teu."]}}`.
  Contagens antes → depois: transações do atacante **2 → 2**, descrições `ATAQUE T101%` **0 → 0**, transações
  no cartão da vítima **0 → 0**. Com a `accountId` da vítima: «Conta não encontrada.». A pré-visualização
  também recusa, e a confirmação agora repete a verificação **antes** de qualquer insert.
- **Nada regride na importação:** caminho legítimo (2 movimentos com `cardId` e `CREDIT`); sem cartão
  (`null`/`DEBIT`); desfazer (2 → 0); aplicar regras ao já importado (2 categorizados). **Limpeza:** 4
  utilizadores QA apagados, 0 transações, 0 cartões, 0 contas, 0 categorias, 0 regras, 0 órfãos.
- **O que isto não resolve:** (1) o ataque foi repetido **com o `cardId` do cartão**, que era o caso da T45;
  outras combinações de ids no mesmo payload (`accountId`, categorias) foram testadas só de passagem — a
  `accountId` recusa; as categorias não foram forjadas nesta volta. (2) Sem suite, por decisão minha: a
  tarefa não mudou código.
- **Aberto:** nada desta tarefa.
- **Repositório:** nada — só documentos e o relatório (`relatorios/T101.md`, evidência em `relatorios/T101/`).
- **Decisão:** nenhuma.

### T101 — provar que a falha de autorização da T45 está fechada (QA) — **fechada 2026-11-22**

**É a única coisa no backlog que é segurança, e a linha da T45 ainda diz «reprovada na autorização».** O
código mudou desde 2026-11-03: `confirmImport` passou a verificar a posse do cartão
(`import-actions.ts:228-235`, `where: { id: cardId, userId: user.id }`, com `fail('Cartão não encontrado.')`).
**Ninguém repetiu o ataque.** Um IDOR que se acredita corrigido sem prova é pior do que um aberto, porque
ninguém volta a olhar.

**Critério — repetir o ataque do QA de 2026-11-03, à letra:**

- (a) Duas contas (a do QA e outra com um cartão). Na **confirmação** da importação, enviar o `cardId` do
  cartão da **outra** conta com uma conta e uma categoria **próprias**. Medido: resposta `fail`, **zero**
  transações criadas, e o `cardId` da vítima sem nenhuma transação nova.
- (b) O mesmo na **pré-visualização** (já recusava) — a diferença antes/depois tem de estar na confirmação.
- (c) O caminho legítimo continua a funcionar: cartão **próprio** → importa, com `cardId` e `paymentMethod`
  certos.
- (d) Nada regride na importação: OFX com cartão, sem cartão (`null`/`DEBIT`), aplicar regras ao já
  importado, desfazer a importação.
- (e) **Limpeza:** apagar as contas e os movimentos que criaste; dizer quantos ficaram.
- **Sem suite completa** (esta tarefa não muda código).

**Reporta em `relatorios/T101.md`** com o pedido forjado colado (corpo e resposta) e o `count` de transações
antes/depois. Se a confirmação **aceitar** o `cardId` de outra conta, é **FAIL** e é grave — nesse caso páras
e dizes-me, não tentas corrigir.

## Bloco de fecho — T102 (fechada 2026-11-22)

- **Fechado:** T102 — *os diálogos sem limite de altura*. `max-h-[calc(100dvh-1rem)] overflow-y-auto
  overscroll-contain` na **classe base** do `DialogContent` (um sítio só, nenhum `className` novo em
  diálogo nenhum); e o `max-h-full` do `calendar-day-dialog` **saiu**, porque o `cn` o deixava ganhar à
  base e anulava a correção ali.
- **Prova:** cadeia Dev (2 voltas) → QA `PASS` (2 voltas) → Revisor «pode commitar: **sim**» (0 bloqueia, 0
  deve, 0 opcionais). Diálogo mais alto («Nova recorrência», `recurrence-dialog.tsx:132`): **1227 px → 828**
  a 1440×844 e **651** a 390×667, com o X de −183/−272 (fora) para **dentro**. Pequenos **sem barra**
  (conta 676/676, objetivo 637/637, categoria 644/644); a 390 rolam, como devem. `calendar-day`: formulário
  **667 → 651** com `max-height: 100% → 651px`; estado do dia **651/651** com a lista interna **751/474** a
  rolar sozinha (12 movimentos criados por SQL e apagados) — **uma barra só**. Única exceção declarada:
  `transaction-edit-dialog` (`max-h-[85vh]`, 717,4 a 844; 566,95 a 667), intacta. Teclado: `Escape` fecha, 25
  `Tab` dentro, 18.º `Tab` traz «Fechar» com o diálogo no fundo. Suite **150 passed (8.6m)**,
  `0 restante(s)`, EXIT=0, `BUILD_ID vJD2Soos55IWoY1ucvRZq`, `axe` limpo. Relatórios:
  `relatorios/T102.md`, `relatorios/T102-qa.md`.
- **O que isto não resolve:** (1) **o `lvh` do iOS não se mede nesta máquina** (`100dvh == 100vh` sem barra
  de URL): a correção do `calendar-day` foi verificada **pela regra e pelo valor calculado** (`651px`, não
  `100%`), **não** por observação — este fecho **não promete iPhone**. (2) O X rola com o conteúdo: com o
  diálogo no fundo está a −1094 e só o `Tab` (18.º) ou o `Esc` ou o clique fora o alcançam. Aceite como
  limite; no telemóvel a saída é rolar de volta ou acertar na faixa de overlay (8 px de cada lado a 320). Um
  cabeçalho `sticky` seria tarefa nova. (3) **A garantia do `max-h` da base é por diálogo e manual**: o `cn`
  deixa o local ganhar, e um `max-h` local novo reintroduz o defeito **em silêncio** — não há teste que o
  apanhe, porque em Playwright o diálogo parece correto.
- **Aberto:** nada desta tarefa.
- **Repositório:** `fix/t73-parcelamentos-cartoes`; commit `5dd9646`.
- **Decisão:** nenhuma nova.

### T102 — os diálogos sem limite de altura (Dev) — **fechada 2026-11-22**

**Último defeito funcional visível da lista.** `ui/dialog.tsx` tem **0** ocorrências de
`max-h`/`overflow-y-auto`: um `DialogContent` de 1761 px num ecrã de 844 px fica com o botão de fechar fora do
ecrã, e no telemóvel não há como chegar ao fundo. A decisão D24/C2 manda pôr a regra **na classe base** e só
depois rever os 28 sítios.

**Critério:**

- (a) A regra na **classe base** do `DialogContent` (`max-height` relativa ao viewport + `overflow-y-auto` no
  corpo), num sítio só — sem `className` novo em cada diálogo.
- (b) **Medir num diálogo real e alto:** antes, a altura do `DialogContent` e se o botão de fechar está dentro
  do ecrã; depois, o mesmo. A 844 de altura e a 390×667 (telemóvel). Diz qual caminho mediste — no telemóvel
  o diálogo usa o `Drawer` — e o que acontece ao outro.
- (c) **Rever os 28 sítios**: a lista de quem usa `DialogContent`, e para cada um uma linha do que acontece
  (cabe, passa a ter scroll, ou não é afetado). Os que passarem a ter scroll **têm** de manter o foco e o
  botão de fechar alcançáveis por teclado.
- (d) Nada regride: `Esc` fecha, o foco fica preso no diálogo, o `aria` do Radix intacto, e os diálogos
  pequenos não ganham barra de scroll.
- (e) Gate 5/5; suite é do QA. Capturas antes/depois do diálogo mais alto, a 1440 e a 390.

**O que não fazer:** não redesenhes diálogos, não mudes larguras, não toques nos formulários que vivem lá
dentro; sem dependência nova.

**Volta 1 — entrega do Dev (`relatorios/T102.md`), uma linha:**
`max-h-[calc(100dvh-1rem)] overflow-y-auto overscroll-contain` na classe base do `DialogContent`
(`dialog.tsx:56`), sem `className` novo em diálogo nenhum. Mais alto: `recurrence-dialog.tsx:132`
(«Nova recorrência») **1227 px → 828** a 844 e **651** a 667; o X passa de −183 e −272 (fora) para **24**
(dentro). Escolheu **1 rem** e não 2 porque a 2 rem os diálogos de categorias (644) e objetivos (637)
ganhavam barra sem precisar. **Exceções respeitadas:** `transaction-edit-dialog.tsx:78` (`max-h-[85vh]`,
717,4/567 inalterada) e `calendar-day-dialog.tsx:179` (`max-h-full`). **25** `DialogContent` (a auditoria
dizia 28 — o QA conta), 19 medidos, 7 passaram a ter scroll, pequenos sem barra. Teclado: 25 `Tab` dentro,
`Escape` fecha, e com o diálogo rolado 18 `Tab` levam a «Fechar» e o browser rola-o para dentro. Gate 5/5,
`BUILD_ID 2Cfswj7u31Pse9U7u9mxL`.

**Volta 1 — QA `PASS` (`relatorios/T102-qa.md`):** recorrência a 1440×844 `topo 8 · altura 828 ·
scrollHeight 1227/828 · X 16→44`; a 390×667 `topo 8 · 651 · 1761/651 · X dentro`. Pequenos sem barra
(conta 676/676, objetivo 637/637, categoria 644/644); a 390 os três rolam, como devem. Exceções intactas
(`transaction-edit` 717,4 = 85vh; `calendar-day` 237 = 100%), sem descendente com scroll. `Escape` fecha,
25 `Tab` dentro, e com o diálogo no fundo (X a −1094) o **18.º `Tab`** traz «Fechar» e o browser rola.
**Contagem resolvida:** `grep` → **25** em **23 ficheiros** (quatro têm duas tags); o 28 era da auditoria de
2026-11-20 e três diálogos saíram desde então — **não falta linha**. Paleta ⌘K a 667: topo 222,3, altura 332,
sem barra, sem X por desenho (`showCloseButton={false}`) e `Esc` fecha. Suite **150 passed (8.9m)**,
`0 restante(s)`, EXIT=0, `BUILD_ID P9ni8MthoFTlJ7UNzPntl`, `axe` limpo. **Pergunta em revisão:** com o
cabeçalho a rolar com o conteúdo, no telemóvel (sem `Esc`) é preciso rolar de volta para fechar — aceitável
ou `sticky`?

**Volta 1 — Revisor: 1 DEVE, 2 OPCIONAIS, «pode commitar: não até esse DEVE».** DEVE em
`calendar-day-dialog.tsx:181`: o `max-h-full` local **ganha à base** (o `cn` descarta o `max-h` da base quando
o local traz outro) e anula a correção; e o próprio ficheiro já dizia em `:37-39` que essa classe tinha de
sair quando o limite entrasse na base. **Consequência não latente:** `max-h-full` num `fixed` resolve contra
o *initial containing block* = **lvh** no iOS Safari, com o conteúdo de **777 px** — o X volta a ficar acima do
bordo num iPhone com a barra visível. O QA não o viu porque o Playwright não tem barra de URL (`100dvh ==
100vh == viewport`). **OPCIONAL 1 (fechado por mim, uma linha):** escrever porque é `dvh` e não `svh` — o pior
caso é o gesto da barra do iOS e é um salto da caixa, não um X fora do ecrã. **OPCIONAL 2 (aceite como
limite):** o X rola com o conteúdo (a −1094 no fundo); o `Esc`, o clique fora e o `Tab` (18.º) alcançam-no, e
a faixa de overlay a 320 tem 8 px de cada lado — se incomodar, é tarefa nova com cabeçalho `sticky`.
**Nota estrutural:** a garantia do `max-h` da base é **por diálogo e manual** — um `max-h` local novo
reintroduz o defeito em silêncio.

**Volta 2 — entrega do Dev (`relatorios/T102.md` §9):** `max-h-full` **removido** de
`calendar-day-dialog.tsx:181` (`className={cn('flex flex-col', …)}`), comentário de `:37` reescrito (a condição
venceu; o limite entrou pela T102), e a linha do `dvh`/`svh` junto à classe da base. Medido nos dois estados ×
duas alturas: a 390, **formulário 667 → 651**, topo **0 → 8**, `max-height: 100% → 651px`; o estado do dia
fica em 237 e a 1440 nada muda. X dentro nas quatro. `e2e/84` + `e2e/39` → **14 passed**; gate 5/5,
`BUILD_ID F1L1qeqiHmYbUr-daiSDi`. **Limite honesto:** o `lvh` do iOS não se mede neste ambiente — a correção
verifica-se **pela regra** (o `max-h` calculado é `651px`, não `100%`), não por observação do `lvh`.

**Volta 2 — QA `PASS` (`relatorios/T102-qa.md` §«Volta 2»):** `calendar-day` a 390×667 — dia topo 215,
altura 237, `max-height: 651px`, X dentro; **formulário topo 8, altura 651, `max-height: 651px`**, X dentro;
a 1440 dia 237 e formulário 595,8 com `max-height: 828px`. Com **12 movimentos temporários** (SQL, apagados,
0 restantes) o estado do dia deu **651/651** no diálogo e **751/474** na lista interna — **uma barra só**.
`transaction-edit` continua a única exceção (717,4 a 844; 566,95 a 667). Amostra dos pequenos igual à volta 1
(676 / 637 / 644) e recorrência 828 / 651. Suite **150 passed (8.6m)**, `0 restante(s)`, EXIT=0, `BUILD_ID
vJD2Soos55IWoY1ucvRZq`, `axe` limpo. **E o limite ficou escrito:** o `lvh` do iOS **não se mede** neste
ambiente; a correção foi verificada **pela regra e pelo valor calculado** (`651px`, não `100%`), não por
observação — o fecho **não promete iPhone**.

---

## Vaga 8 · T103 — o design em uso (o que a navegação em produção revelou)

Aberta a 2026-11-23, a pedido do utilizador («analise a parte de design… as cores e o design das cartas
podem melhorar») e depois de eu percorrer a produção com a conta de teste: **17 rotas, 1440 e 375, claro
e escuro**, só leitura. Sete itens, todos vistos no ecrã ou medidos — nenhum inventado.

### T103 — sete itens, um deles é defeito (Dev) — **fechada 2026-11-23**

**(a) Defeito, não gosto — o tipo de conta sai em inglês e com o ícone errado.** `/contas` mostra
«WALLET», «CHECKING · Millennium bcp», «SAVINGS», e **os três cartões têm o mesmo ícone** (a balança, que
é o recurso). Causa: `apps/web/src/server/accounts.ts:102` entrega o enum do Prisma (`CHECKING`), e
`ACCOUNT_TYPE_LABELS`/`ACCOUNT_TYPE_ICONS` (`components/account-dialog.tsx:52-63`) são indexados por
minúsculas — falham **o rótulo e o ícone**. Aparece igual na captura do QA de 22/11: não é de hoje, e
nenhum e2e o apanha porque nenhum lê o tipo.

**(b) Microcopy.** `app/(app)/page.tsx:257` diz «A **preensar** pelo cartão» (confirmado em produção, com
cartão escolhido) e tem espaço antes dos dois pontos; `server/month-close.ts:84` capitaliza o mês
(«Fecho de Novembro 2026») quando em pt-PT é «novembro», com «de».

**(c) A seleção usa a cor da ação.** No lançamento rápido (`transaction-quick-add.tsx:347,378,394,631,645`)
e no «Ver por» do Painel (`dashboard-scope-switch.tsx:145`) o estado «selecionado» é `bg-primary` — a mesma
cor do botão «Lançar». E os dois grupos de rádio do lançamento ocupam a largura toda em duas filas, pelo
que o campo **Valor** (o número, que é o herói) só aparece depois deles.

**(d) Bordas de controlo no escuro: 1,23:1 e 1,57:1.** `--border` sobre o cartão e `--input` sobre o fundo.
O `globals.css:186` já escreve «o escuro fica por resolver». Ver **D33**.

**(e) Dois pesos de contorno no mesmo ecrã.** `ui/card.tsx:17` desenha `ring-1 ring-foreground/10` =
**1,22:1** no claro; os 43 painéis escritos à mão usam `border` (= `--border-subtle`) = **2,00:1**. O cartão
é o contorno mais fraco do sistema, e mais fraco do que um divisor de menu.

**(f) A previsão de saldo lê-se a 2,00:1.** `dashboard-forecast-chart.tsx:27` usa `--chart-forecast` (token
já a 45% de alfa) como traço **e** um gradiente cujos stops multiplicam o alfa (0,6 × 0,45): traço
**2,00:1** no claro e **2,61:1** no escuro; topo do gradiente 1,49:1 / 1,76:1. Num gráfico, o traço é o
que se lê.

**(g) Telemóvel.** A 375×844 os quatro KPI empilham-se e «Sobra do mês» fica fora do primeiro ecrã; na
barra de topo a marca corta («Finanças Pesso…») ao lado de cinco controlos.

**Ficheiros que pode escrever:** `apps/web/src/server/accounts.ts`, `components/account-card.tsx`,
`components/account-dialog.tsx`, `app/(app)/page.tsx`, `server/month-close.ts`,
`components/transaction-quick-add.tsx`, `components/dashboard-scope-switch.tsx`, `components/ui/card.tsx`,
`app/globals.css`, `components/dashboard-forecast-chart.tsx`, `components/kpi-card.tsx`,
`components/app-shell.tsx` e `relatorios/T103.md`. Mais nada. *(Os dois últimos entraram na volta 2: o
`app-shell` porque o item (g) fala da barra de topo e a lista original o esqueceu — falha minha, não do
Dev — e o `kpi-card` porque o degrau do número pertence ao componente que o define.)*

**Critério de aceitação (verificável, segue a skill `design-do-projeto`):**

- **(a)** Os três cartões de `/contas` dizem «Carteira», «Conta à ordem», «Poupança» e mostram **três
  ícones diferentes**; o mesmo na vista por conta do Painel; e o formulário de edição abre com o tipo
  preenchido, não vazio. Prova: os três rótulos e a classe de cada `<svg>`, mais a captura.
- **(b)** `grep -rn "preensar" apps/web/src` → 0 ocorrências; o texto lê-se «A pensar pelo cartão:» sem
  espaço antes dos dois pontos; e o mês sai «novembro» minúsculo, com «de».
- **(c)** A 1440×900 o topo do `<input>` do Valor mede **< 400 px** (`getBoundingClientRect().top`), cada
  grupo de seleção mede **≤ 32 px** de altura e não ocupa a largura do cartão, e **nenhum** controlo de
  seleção usa `bg-primary` (o teal fica no botão «Lançar»). Igual no «Ver por» do Painel.
- **(d)** No escuro, `--border` e `--input` calculadas dão **≥ 3,0:1** quer sobre `--card` quer sobre
  `--background`, com o número e a conta no relatório; `--border-subtle` fica **≥ 1,6:1** sobre o cartão e
  **sempre abaixo** do controlo; e o claro **não muda** (3,39:1 nas bordas de controlo, 2,00:1 nos
  divisores, medidos antes e depois).
- **(e)** O contorno do `Card` e o dos painéis à mão têm o **mesmo** peso: mesmo valor calculado (2,00:1 no
  claro) e `grep "ring-foreground/10" components/ui/card.tsx` → 0.
- **(f)** O traço da previsão mede **≥ 3:1** sobre o cartão nos dois temas (valor no relatório); o
  preenchimento é uma só cor, `grep -c linearGradient` no ficheiro → 0, e o traço é tracejado.
- **(g)** A 375×844 os quatro KPI formam grelha **2×2** e o quarto está inteiro no primeiro ecrã; a
  320×640 `document.scrollWidth` ≤ 320 e nenhum montante transborda o cartão; na barra de topo não aparece
  texto truncado com reticências.
- **Todos:** capturas a **1440 e a 390, nos dois temas**, em `relatorios/T103/`, e o gate verde.

**O que não fazer:** não correr a suite e2e completa (é do QA no fecho) nem specs enquanto o QA as corre;
não escrever em `e2e/` (é do QA); não tocar em `ui/button.tsx`/`ui/input.tsx` (T75) nem no `max-h` do
`DialogContent` (T102); não reabrir a T96/D31 — as células do calendário continuam subtis; não escurecer o
tema claro para «compensar»; não trocar `dvh` por `svh`; zero dependências novas; zero git.

**Prova esperada:** `relatorios/T103.md` com, por item (a)-(g), o **antes** (o número ou o que se via) e o
**depois**, o comando e a saída do gate (`format` → `lint` → `typecheck` → `test` → `build`), o
`git diff --stat`, as capturas em `relatorios/T103/`, e uma linha «o que não consegui medir» (o `lvh` do
iOS não se mede aqui, como na T102).

**No QA (passo 2):** além de repetir as medições, acrescenta a **asserção de regressão** em `e2e/` para o
item (a) — o cartão de conta mostra o tipo em português. É o único sítio onde este defeito podia ficar
verde para sempre.

**Voltas.** *Volta 1 (Dev):* os sete itens entregues, gate verde. *Volta 2 (Dev):* o degrau do número
passou para o `KpiCard` e o comentário do `account-card` ficou verdadeiro; o `page.tsx` caiu de 20 para 4
linhas de diff. *QA volta 2:* **(a)–(g) PASS** com os números do QA, conta arquivada provada no ecrã
(criada, arquivada, apagada), `axe` limpo — mas **FAIL** porque `e2e/89` fica vermelho: o limiar da marca
passou de `min-[360px]` para `min-[370px]` e a guarda da T88 mede a marca **a 360** (`Expected: > 10`,
`Received: 1`; 150 passed, 1 failed). O QA não tocou no guarda — a escolha era minha, e é a **D34**:
limiar = menor largura em que o nome cabe **inteiro**, medido. *Volta 3 (Dev):* `min-[364px]` e `text-xs`,
com uma tabela de sete larguras que diz «cabe a 364». *QA volta 3:* **FAIL** — na rota da guarda não cabe.

**Impasse da volta 3 — a marca do cabeçalho. O que falhou, com a prova real:**

| medição | 375 | 411 | 425 | 426 |
|---|---|---|---|---|
| caixa da marca, sem barra (QA, DOM) | 70 | **106 — cabe** | — | — |
| caixa da marca, barra de 15 px (QA, DOM) | 55 | — | — | **106 — cabe** |
| Dev, volta 3 (larguras 358–375) | 106,1 | — | — | — |

O Dev mediu numa rota **sem o controlo «Mais»**: `lib/nav.ts:226` só o dá em cinco rotas, e a guarda corre
em `/transacoes`, que é uma delas. A conta dele reproduz-se sem esse controlo (364 → 107 livres ≈ 106
medidos); com ele o consumo é **305 px** e sobram 59 (barra por omissão) ou 44 (barra clássica). O
«106,1 a 375» que o QA citou na volta 1 era o `span` da **barra lateral**. **As duas medições explicam-se,
e a que vale é a da rota da guarda:** o nome inteiro só cabe a **411/426**.

Assim, `min-[364px]` deixa a marca **presente e cortada entre 364 e 409/425** — o que a D34 proíbe. As duas
saídas, para o utilizador decidir (toca no que se vê no telemóvel):

1. **Marca fora do cabeçalho móvel** (recomendada): sai o `min-[…]:not-sr-only` e fica `sr-only` + `aria`.
   Sem número mágico, sem classe de limiar para manter, e acaba a família de defeito. Custo: no telemóvel
   o nome não aparece na barra de topo — o que já é verdade hoje abaixo de 426.
2. **Limiar em `min-[426px]`**: o nome aparece inteiro dos 426 aos 767 px. Custo: um número que depende da
   barra de scroll (426 com barra, 411 sem), invisível no telemóvel comum.
3. **Nome curto no telemóvel** («finanças»): decisão de identidade, e precisa de ser medida outra vez
   (cabe a partir de ~375 sem barra).

Três voltas de correção gastas: paro aqui, como manda o §4. Nada commitado; a guarda `e2e/89` continua com
a asserção a 360 e a mutação `limiar` aponta para a classe antiga (o QA não a escreveu porque já sabia o
resultado). O `format:check` global está a **0** (o QA formatou o spec novo). A suite de frio da volta 3:
**150 passed · 1 failed**, build `VAtPEy3ZhPQj_8--iVbJuP`.

**Saída escolhida pelo utilizador (2026-11-23): a 3.ª — nome curto no telemóvel.** Ele escolheu, entre as
três, «nome curto no telemóvel («finanças»)». É a **D35**: abaixo de `md` o cabeçalho diz **«finanças»**
(minúscula, como ele escreveu), o nome completo fica como nome acessível e na barra lateral, e a D34
continua: **inteira ou ausente**, limiar = primeira largura com ≥1 px de folga no **pior caso**
(`/transacoes`, com «Mais», nas duas condições de barra de scroll).

**Volta 4 (Dev), aberta com a decisão do utilizador:** medir «finanças» a 12 px e o espaço disponível nas
duas condições, fixar o limiar medido, e pôr o nome completo como texto acessível sem o repetir no ecrã.
É a última volta desta tarefa: se falhar, o problema não é mais medição nem código — volto ao utilizador com
o que resta.

**Volta 4 fechada.** *Dev:* «finanças» mede **49,2 px**; com barra clássica a 368 faltam 1,2 px, a 369 dá
igualdade, e o limiar ficou **`min-[370px]`**; achou ainda que os contextos `isMobile` do Playwright têm
barras sobrepostas e mediu em desktop estreito. *QA:* **PASS** — 320/369 marca a 1 px com «Finanças
Pessoais» anunciado uma só vez; **370 e 375** com **49/49** e zero filhos fora; a 768 `display:none` e a
barra lateral com o nome completo; suite de frio **151 passed · 0 failed**, `BUILD_ID JHhm1jtLvdlu1NWfN7vuNP`;
`T89_MUTAR=limiar` vermelho como deve. *Revisor:* **0 BLOQUEIA, 0 DEVE, 3 OPCIONAIS — pode commitar: sim**;
confirmou o (a) sem tocar no `account-dialog` (o `Select` já usava os rótulos), que o export mantém o enum
em maiúsculas, e corrigiu-me uma frase: o `month-close` **não** usa `Intl` — só deixou de capitalizar.

**Opcionais do Revisor, registados e NÃO abertos** (só com autorização do utilizador):
1. *Corrigido antes do commit:* o comentário do `app-shell` dizia «370 … com folga» e há igualdade (49,2 =
   49,2); a D35 foi reescrita para «não perde fracção» e o comentário vai atrás.
2. Quatro controlos de seleção continuam com `bg-primary` (`budget-dialog.tsx:226`,
   `goal-movement-dialog.tsx:189`, `preferences-form.tsx:205`, `report-basis.tsx:91`) — fora da lista desta
   tarefa; ficam dois padrões para «selecionado». Candidata a tarefa.
3. Dois breakpoints arbitrários novos e vizinhos (`min-[370px]` no cabeçalho, `min-[375px]` no painel);
   independentes hoje. Se um dia forem token, entram juntos.

**Publicada e verificada (2026-11-23 09:15).** Commit `ce5742a` em `main`, push feito (`origin` = local,
`git ls-remote` confirmado), deploy **READY** a servir `ce5742a`. Verificado em produção com a conta de teste:
`/contas` com «Carteira / Conta à ordem / Poupança» e `lucide-wallet`/`landmark`/`piggy-bank`; `Card` e painel
à mão com a **mesma** borda (`lab(30.3812 …)`) e sem sombra; `linearGradient` **0**; no escuro `--border`
**3,18/3,80** e `--input` **3,62/4,32**; traço da previsão **7,29:1**; marca **«finanças»** a 375 com
**49/49** e o nome completo no `aria`; KPI em **2×2** e `document` 360/360.

**Volta 5 — regressão encontrada na verificação de produção.** A 375 (clientWidth 360) o cartão
«Património líquido» mede **16→172** e o `<p>` do montante **33→179**: passa **7,2 px** do cartão, que tem
`overflow: hidden`, por isso o «€» é cortado. Fonte 30 px (`text-3xl`); os outros três (24 px) ficam dentro.
A 320 não acontece (uma coluna, cartão de 273 px); entre ~376 e ~404 volta a acontecer — **os telefones de
390/393**. O QA tinha medido `document.scrollWidth` (360/360) e o documento não transborda: o corte é
**dentro** do cartão. Reaberta ao Dev com a medição **por cartão** como critério; depois o QA e uma
asserção no `e2e/` que olhe para o cartão, não para o documento.

---


### Fecho da T103 — 2026-11-23

- **Fechado:** T103 — o design em uso: sete itens saídos de navegar a produção com a conta de teste (tipo de conta em inglês, «A preensar», seleção com a cor da ação, bordas do escuro, dois pesos de contorno, previsão a 2,00:1, KPI empilhados), mais a regressão do valor do KPI encontrada depois do primeiro push.
- **Prova:** suite de frio **152 passed · 0 failed** (`BUILD_ID zbczpjaMja0_gNg5eOo4f`), `format:check` 0, QA **PASS** na volta 7 e Revisor «pode commitar: sim» sem achados; em produção (`d0ff511`, READY) o cartão de 163,5 px a 24 px deixa **8,3 px livres** com cinco dígitos e o «€» inteiro, o `@container` dispara a 24/30/36 como a D36 manda, `--border` **3,18/3,80**, previsão **7,29:1**, marca **«finanças»** com `49/49`, KPI em 2×2. Relatórios: `relatorios/T103.md`, `relatorios/T103-qa.md`.
- **O que isto não resolve:** com **seis dígitos** o valor não cabe em 20 dos 225 viewports (limite da D36, pior a 375: −6,7 px); a **folga** a 375 é de ~8 px, não os 4 que a D36 pede como mínimo teórico — decisão escrita, o piso de 24 px vale mais; entre **320 e 369 px** o cabeçalho continua sem marca (nem a curta cabe); e **quatro** controlos de seleção noutros diálogos continuam com `bg-primary` (`budget-dialog.tsx:226`, `goal-movement-dialog.tsx:189`, `preferences-form.tsx:205`, `report-basis.tsx:91`).
- **Aberto:** nada bloqueado nesta tarefa. A **T75** (alvos de toque do `Button`/`Input` base) continua de fora por decisão minha; os quatro `bg-primary` são candidatos a tarefa nova, **não abertos**.
- **Repositório:** `main` em `d0ff511` e no `origin` (`git ls-remote` confirmado), deploy de produção **READY** a servir esse commit; sem tags.
- **Decisão:** nenhuma pendente para fechar. A única coisa que peço é autorização se quiseres abrir a tarefa dos quatro `bg-primary`.

---

### Fecho da T106 — 2026-11-23

- **Fechado:** T106 — medir as três dúvidas da varredura de produção: service worker, cliques reais nas linhas da tabela e as quatro rotas que nunca chegavam a `load`. **As três não se reproduzem**, e a terceira era do meu instrumento.
- **Prova:** QA em `relatorios/T106-qa.md` — D: **12/12 cargas limpas** (`/`, `/contas`, `/orcamento`, `/definicoes` × 3) com 1 registo `activated` + `controller: true` e **0 avisos**, mais 3 cargas abortadas de propósito e as 17 rotas no mesmo separador, SW vivo; E: com rato real do Playwright a 1440 e a 390, checkboxes de duas linhas e o menu ⋮ abrem **à primeira**, diálogo «Editar» a seguir, 0 erros de consola; F: as quatro rotas chegam a `load` em **342–695 ms**, `readyState: complete`, **0 pedidos abertos**, repetido com SW a controlar (174–490 ms).
- **O que isto não resolve:** o gatilho do aviso `[pwa]` no **meu** browser não ficou explicado; o QA diz que não o reproduz e que não vê o meu browser — fica «não reproduzido», não «corrigido». A causa do meu F está medida (clique na barra lateral não dispara `load` outra vez) e vale como armadilha, não como defeito.
- **Aberto:** nada. O achado B da T105 (data `0001-01-05`) continua sem origem explicada, dentro da T105.
- **Repositório:** nada commitado por esta tarefa; só `docs/gestao/` e `relatorios/`.
- **Decisão:** nenhuma pendente.

## T105 — Arrumar três defeitos medidos em produção (2026-11-23)

**2026-11-23, volta 2 (Dev → QA):** A e C fechados com dois ficheiros autorizados pelo Lead
(`server/transactions-actions.ts`, `server/cards.ts`); B com guarda no diálogo, sem a leitura do
registo gravado que o critério 2 pede — fica ao QA produzir essa leitura. Gate verde, 598 testes,
`e2e/T105-duplo-objetivo.spec.ts` novo (vermelho no código antigo, verde no novo). `relatorios/T105.md` §8.

**2026-11-23, QA volta 2: FAIL** — A `PASS` (2 passed), B `PASS` no critério com lacuna medida (um bem
que já tinha `0001-01-05` continua com ele ao guardar) e C provado ao vivo mas **a partir duas decisões**
(`40:130` e `41:160` vermelhos): a regra «fatura mais antiga, qualquer estado» que eu fixei contraria a
T60/T61. Suite de frio 158/160. Decisão tomada em **D38**: a dívida é a da **última fatura da cadeia** e só
conta como «por pagar» depois de **fechar**; `invoicesInDebt` sai e os três ecrãs leem `lastInvoiceByCard`.
Volta 3 ao Dev. `relatorios/T105-qa.md`.

**2026-11-23, QA volta 3: PASS.** D38 aplicada (`grep` de `invoicesInDebt` = 0), B fechado nas duas metades
(bem sem data grava `NULL`; semente com `0001-01-05` limpa-se ao guardar), C com 1 · 1 845,00 € nos três e o
feche a bloquear/desbloquear, `40`/`41` **verdes e por alterar**, suite de frio **162 passed, 0 failed**,
`BUILD_ID H6JD6W05WGCEhlBEPPH8x`. Produção continua por publicar. Em revisão.

**Porque:** varredura completa da produção na conta de teste — 17 rotas, um gasto
criado e apagado, um limite criado e removido, um depósito de objetivo, um bem e uma
dívida. Cada número foi reconciliado à mão. Relatório com a medição:
`relatorios/verificacao-2026-11-23-varredura.md`. Três defeitos ficaram provados:

1. **A (alto) — dupla contagem ao apagar um depósito de objetivo.** Depósito de
   100 € com conta Poupança: objetivo 1 100 → 1 200 €, conta 10 253,55 → 10 153,55 €.
   Depois de apagar o lançamento em Transações: a conta volta aos 10 253,55 €, mas o
   objetivo **continua nos 1 200 €** e o património sobe a **183 708,55 €** (partida
   183 608,55 €). 10 253,55 + 1 200 + 180 000 − 945 − 6 800 = 183 708,55 — o mesmo
   dinheiro fica contado na conta e no objetivo.
2. **B (médio) — data de aquisição em `0001-01-05`.** No diálogo «Novo bem», o campo
   «Adquirido em» abre com `0001-01-05` e grava esse valor sem aviso; o cartão do bem
   não mostra a data, portanto o erro é invisível.
3. **C (médio) — três ecrãs, três respostas para as faturas por pagar.** Painel:
   «Faturas por pagar — 12 por resolver · 6390,00 €», e é o passo que bloqueia o
   «Fechar o mês». Revisão: «Nenhuma fatura por pagar». Cartões: «Em dívida:
   945,00 €», fatura que fecha a 10/11/27. Os 6 390 € são a soma de 12 saldos de
   fatura que **cada um já inclui o transitado da anterior** (945 + 870 + 795 + …
   + 120), portanto contam o mesmo dinheiro doze vezes.

**Ficheiros que pode escrever:** `apps/web/src/server/{goals,goals-actions,dashboard,
invoice-context,invoices,month-close,patrimonio,patrimonio-actions}.ts`,
`apps/web/src/components/{goal-card,goal-detail-dialog,goal-movement-dialog,goal-progress,
asset-dialog,patrimonio-list,month-close-checklist,dashboard-forecast*}.tsx`,
`apps/web/src/app/(app)/{page.tsx,revisao/page.tsx,cartoes/page.tsx,patrimonio/page.tsx,
objetivos/page.tsx}`, e `e2e/T105-*.spec.ts` (novos). Mais nada.

**Critério de aceitação (verificável):**

1. **A:** spec novo em `e2e/` que cria o objetivo, regista um depósito com conta, apaga
   o lançamento em Transações e assere: o objetivo volta ao valor inicial, o património
   volta ao valor inicial e o detalhe do objetivo já não lista o movimento órfão. No
   relatório, os quatro números antes/depois, com a conta à mão. O spec tem de ficar
   **vermelho no código anterior** — prova por corrida no código antigo, como na T104.
2. **B:** abrir «Novo bem» → o campo «Adquirido em» não traz `0001-01-05` (vazio ou
   data de hoje). O bem gravado não fica com ano 1 — leitura do registo criado no spec,
   não do ecrã.
3. **C:** os três ecrãs mostram o **mesmo número e a mesma contagem** para o mesmo dado,
   e o total do Painel é igual à soma dos saldos em dívida das faturas que contam para o
   fecho do mês, **sem somar saldos transitados de faturas diferentes**. Com o dado da
   conta de teste o número deixa de ser 6 390 € e passa a ser o da próxima fatura em
   dívida; cola os três textos e a reconciliação à mão. O «Fechar o mês» só fica
   bloqueado se houver mesmo fatura por pagar.
4. Gate do `AGENTS.md` verde (`format:check` → `lint` → `typecheck` → `test` → `build`),
   com o número de testes dito por extenso.
5. Nenhuma asserção antiga enfraquecida para passar; se tiveres de mexer numa, di-lo com
   o antes/depois.
6. Se algum dos três exigir mudar o significado de um número (por exemplo, o que é «por
   pagar»), **paras e escreves a dúvida** em `relatorios/T105.md` §dúvidas; não decides
   sozinho.

**O que NÃO fazer:** não escrever na base de produção nem na conta de teste; não correr
a suite e2e completa (é do QA no fecho); não apagar nem arquivar dados que já lá estão;
não refactorizar o que não está no critério; no máximo 3 dependências novas; nada de
git.

**Prova esperada:** `relatorios/T105.md` com os três antes/depois, comandos e saída
reais, os números reconciliados à mão e, para qualquer mudança de UI, screenshot a
1440 e a 390 nos dois temas (skill `design-do-projeto`).

**Fechado:** T105 — três defeitos medidos em produção: a dupla contagem ao apagar o lançamento de um depósito de objetivo, a data `0001-01-05` de um bem novo e as faturas por pagar em três ecrãs.

**Prova:** A — `e2e/T105-duplo-objetivo.spec.ts` **2 passed** e **vermelho no código antigo** (`1 failed`, «Atrasado 100,00 € … Movimentos 1 movimento»); o 2.º teste prova que um movimento do objetivo **sem** `transactionId` sobrevive. B — `e2e/T105-bem-data.spec.ts` **3 passed**, registo lido por `to_char`: bem sem data grava `NULL` **sem erro no campo**, semente com `0001-01-05` fica `NULL` depois de «Editar» + guardar, data válida `2020-05-10` gravada. C — `e2e/T105-fecho-mes.spec.ts` **2 passed**: Painel «1 por resolver · 1 845,00 €», Revisão «1 fatura por pagar», fecho bloqueado; paga → «Concluído»; o spec exige que 2 745 € **não** apareça; segunda metade: última fatura por fechar → Painel/Revisão 0 e Cartões «Em dívida: 945,00 €» (D38 §4). `e2e/40` e `e2e/41` **verdes e por alterar** (diff vazio) — a D38 não reabre a T60/T61. Suite de frio **162 passed, 0 failed, EXIT=0**, `BUILD_ID H6JD6W05WGCEhlBEPPH8x`; gate do Dev **599 testes**. Relatórios: `relatorios/T105.md`, `relatorios/T105-qa.md`; decisão em `docs/gestao/DECISOES.md` §D38.

**O que isto não resolve:** a **origem** do `0001-01-05` continua por explicar — a classe está fechada (não se grava e não sobrevive a um guardar), mas não se sabe quem o escreveu. Fica o OPCIONAL do Revisor: o corte «ano < 1900 = sem data» é silencioso e contradiz o schema (um bem de `1850-01-01` perde a data sem mensagem) — coerente com a guarda, mas devia recusar com erro; é candidato a tarefa nova. E a produção só recebe isto depois do deploy: até lá os três ecrãs continuam a discordar lá.

**Aberto:** nada bloqueado. Os quatro diálogos com o teal no «selecionado», o log `[object Object]` do service worker e o OPCIONAL acima continuam à espera de vaga (autorização do utilizador).

**Repositório:** nada commitado; 12 ficheiros versionados (+237/−15) e 3 specs novos na árvore, sobre `main @ d6f75a9`. Push e deploy por fazer.

**Decisão:** autorização do utilizador para commit e push; depois, verificação de produção (skill `verificacao-po-s-deploy`).
