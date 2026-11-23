# Verificação completa em produção — 23/11/2026

Produção: https://financas-pessoais-psi-lac.vercel.app (commit `f51dfee` + `d6f75a9`)
Conta: de teste. Browser OpenBot, 1440 → 375/360 → 320.

## 1. Rotas percorridas (17)

Todas abriram, com `<h1>` certo, 0 respostas 4xx/5xx em recursos, 0 ecrã de erro.

| Rota | Estado |
| --- | --- |
| painel, transações, contas, orçamento, património, definições, cartões, categorias, consolidação, importar, recorrências, regras, revisão | carrega, sem transbordo horizontal |
| calendário, contas a pagar/receber, objetivos, relatórios | carrega, mas o documento **nunca atinge «load»** (ver §5) |

- Largura: a 1425, 360 e 320, `scrollWidth` ≤ janela em todas as rotas; 0 filhos do
  cabeçalho fora do bordo a 320.

## 2. Dados criados, medidos e apagados

Estado de partida (conferido): 19 movimentos, soma +808,55 €; saldo 10 253,55 €;
património 183 608,55 €; orçamento 66 % · 204,35 € de 310,00 €; gasto no mês 266,45 €;
objetivo 1 100 € de 5 000 €.

### 2.1 Gasto de 123,45 € (Alimentação, Carteira) — criado e apagado

| Ecrã | Com o gasto | Conta à mão |
| --- | --- | --- |
| Transações | 20 movimentos, +685,10 € | 808,55 − 123,45 ✓ |
| Painel | saldo 10 130,10 € | 10 253,55 − 123,45 ✓ |
| Relatórios (caixa) | 269,90 €, Alimentação 207,80 € (77,0 %) | 146,45+123,45; 84,35+123,45 / 269,90 ✓ |
| Orçamento | bloco 106 % Excedido, 327,80 € de 310,00 €; Alimentação 207,80 de 100 (passaste 107,80) | 204,35+123,45; 310+0 ✓ |
| Património | 183 485,10 € | 183 608,55 − 123,45 ✓ |
| Calendário | 23/11: «2 itens · 0 por liquidar, saldo −423,45 €» | −300 −123,45 ✓ |

Apagado → tudo voltou ao valor de partida (19 movimentos, 10 253,55 €, 66 %, 183 608,55 €,
calendário «1 item · −300,00 €»).

### 2.2 Limite de 50 € em Combustível — criado e removido

Bloco passou a **74 % · Excedido · 266,45 € de 360,00 €**; cartão de Combustível
**Excedido, 62,10 de 50, passaste 12,10, 124 % consumido**. Removido → 66 % de 310 €.
A percentagem vem da soma (74 %), o estado do pior cartão (Excedido) — como a D37 fixou.

### 2.3 Depósito de 100 € no objetivo (conta Poupança) — criado

Objetivo 1 200 € (24 %), saldo da conta 10 153,55 €, património **inalterado** em
183 608,55 € (sai da conta, entra no objetivo). ✓

### 2.4 Bem e dívida — criados e arquivados

Bem 5 000 € → bens 185 000 €, património 188 608,55 € ✓.
Dívida 2 000 € → dívidas 8 800 €, património 186 608,55 € ✓.
Arquivados os dois → 183 608,55 €, 180 000 €, 6 800 € ✓.

## 3. Achados

### A. Apagar o lançamento de um depósito no objetivo não devolve o dinheiro ao objetivo — ALTO

1. Depósito de 100 € no objetivo com conta → objetivo 1 200 €, conta −100 €.
2. Apagar esse lançamento no extrato → a conta recebe os 100 € de volta
   (10 253,55 €), mas o objetivo **continua nos 1 200 €** e o património sobe a
   **183 708,55 €** (partida 183 608,55 €).

O mesmo dinheiro fica contado na conta e no objetivo. O registo de objetivo não é
apagado com o lançamento que o criou. Reconciliado à mão: 10 253,55 + 1 200 + 180 000
− 945 − 6 800 = 183 708,55.

### B. «Adquirido em» de um bem novo nasce em 0001-01-05 — MÉDIO

No diálogo «Novo bem», o campo «Adquirido em» vem preenchido com `0001-01-05` e é
gravado assim. O cartão não mostra a data de aquisição, portanto o erro fica invisível.

### C. Painel, Revisão e Cartões discordam sobre faturas por pagar — MÉDIO

- Painel: «Faturas por pagar — 12 por resolver · 6390,00 €», e é o passo que **bloqueia
  o fecho do mês**.
- Revisão: «Faturas por pagar — Nenhuma fatura por pagar».
- Cartões: «Em dívida: 945,00 €», fatura que fecha a 10/11/**27**.

Os três leem o mesmo dado e dizem coisas diferentes.

### D. Service worker — NÃO MEDIDO até ao fim

- Num separador novo, sem navegações abortadas: 1 registo `activated` a servir `/sw.js`,
  `controller: true`. Regista.
- No separador onde fiz as 17 rotas e as operações, terminou com **0 registos**.
- O aviso `[pwa] não consegui registar o service worker` apareceu 2×, sempre depois de
  uma navegação minha abortada por tempo (o documento é desmontado a meio do registo).
- Não consigo separar o efeito do meu browser do comportamento real: fica como
  «não medido», não como corrigido nem como falha.

### E. Controlos das linhas da tabela não responderam ao meu clique — A CONFIRMAR

`checkbox` de seleção e menu «⋮» das linhas de Transações: o clique sintético não
produzia efeito (o foco chegava, a ação não); a partir daí os diálogos também deixaram
de abrir, até recarregar. Com `element.click()` no DOM funcionaram. Não distingo se é
do meu browser ou da app — precisa de um rato real.

### F. Quatro rotas nunca terminam de carregar — BAIXO (a medir)

Calendário, Contas a pagar/receber, Objetivos e Relatórios: a página renderiza e fica
utilizável, mas o documento não chega a «load» dentro de 30 s (4 de 17). As outras 13
terminam. Pode ser um pedido longo vivo; não medi a causa.

## 4. O que ficou na conta de teste

- Objetivo «Viagem ao Japão»: +100 € (depósito cujo lançamento apaguei) e −100 €
  (levantamento «sem conta» que fiz para desfazer a dupla contagem). Total **1 100 €**,
  igual ao inicial; o histórico do objetivo tem estes dois movimentos.
- Arquivados (não apagados, reativáveis): «Teste bem verificação» 5 000 € e
  «Teste dívida verificação» 2 000 €.
- Zero lançamentos de teste, zero limites de teste; saldos e património iguais aos de
  partida.

## 5. O que não foi medido

- Causa da dupla contagem (§3 A) — só o comportamento.
- Service worker em carga limpa repetida (§3 D).
- Cliques reais nas linhas da tabela (§3 E).
- Duração/pedido pendente das 4 rotas lentas (§3 F).

## 6. Correção de 23/11 14:00Z — o QA mediu D, E e F e os três não se reproduzem

Medido pelo QA em `relatorios/T106-qa.md`; a T106 está fechada.

- **D (service worker): não reproduzido.** 12 de 12 cargas limpas (`/`, `/contas`,
  `/orcamento`, `/definicoes` × 3) com 1 registo `activated` + `controller: true` e
  **0 avisos**; continuou vivo depois de 3 cargas abortadas de propósito e das 17 rotas
  no mesmo separador. O aviso que vi no meu browser fica «não reproduzido».
- **E (cliques nas linhas): o achado cai.** Com rato real do Playwright, a 1440 e a
  390, os checkboxes de duas linhas e o menu ⋮ abrem **à primeira** e o diálogo «Editar»
  abre a seguir, com 0 erros de consola. O problema era o meu clique injetado.
- **F (quatro rotas sem `load`): era o meu instrumento.** As quatro chegam a `load` em
  **342–695 ms**, com `readyState: complete` e **0 pedidos abertos**. A causa: um clique
  na barra lateral é navegação no cliente e **não dispara `load` outra vez** — um
  instrumento que espere `load` depois de um clique espera para sempre.

Consequência para o §3: só os pontos **A, B e C** ficam como defeitos, e seguem na T105.
