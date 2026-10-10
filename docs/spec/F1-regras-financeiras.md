# F1 — Contrato escrito das regras financeiras e critérios de aceitação

> **Documento:** `docs/spec/F1-regras-financeiras.md` · **Tarefa:** task-6 (F1.3)
> **Autor:** analista-funcional · **Data:** 2026-10-10
> **Estado:** congela a Fase 1. Alterar qualquer linha desta tabela obriga a alterar o motor
> (`packages/shared/src/finance/`) **e** os seus testes.
>
> **Objeto:** o motor financeiro puro em `packages/shared/src/finance/` — `period`, `balance`,
> `result`, `budget`, `invoice`, `goal`, `netWorth`, `rules` — implementado e coberto por 148 testes
> verdes. Este documento é a especificação contra a qual um verificador independente pode testar.
>
> **Âmbito:** Fase 1. EUR + pt-PT. **Fora de âmbito, por decisão do cliente** (doc 01 §8): integração
> bancária/Open Finance, multiusuário, apps nativas. Não há critérios de aceitação para nada disso.
>
> **Fonte de verdade funcional:** [doc 01 — Análise funcional](../analise/01-funcionalidades-minhas-economias.md),
> sobretudo §5 (cálculos) e §5.8 (regras transversais), que por sua vez cita a FAQ oficial do sistema
> de referência. **Nada é inventado aqui:** cada regra é `[FONTE]` (vem do original, com o URL) ou
> `[DECISÃO]` (escolha nossa, com justificação e risco).

## 0. Convenções

| Marca | Significado |
|---|---|
| `[FONTE: …]` | Regra herdada do sistema de referência, com o link do doc 01 ou da FAQ. |
| `[DECISÃO: …]` | Regra que **não** vem do original: escolha nossa. Inclui justificação; o risco está na §4. |
| **caixa** | Regime em que o movimento conta quando o dinheiro se move de facto. |
| **competência** | Regime em que o movimento conta quando a obrigação nasce, mesmo sem pagamento. |
| **período** | Intervalo mensal `[início, fim)` — o fim é **exclusivo**. |
| **magnitude** | Valor absoluto em cêntimos, usado em somas de saídas e entradas. |

Unidades, sempre: **montantes em cêntimos inteiros** (`Int`), **datas de calendário** em `YYYY-MM-DD`,
aritmética em **UTC**. Nenhum cálculo deste contrato usa vírgula flutuante.

---

## 1. Tabela de decisões de cálculo

Regime indicado como **caixa**, **competência**, **ambos** (comutável) ou **n/a** (aritmética neutra).

| # | Regra | Fórmula | Regime | O que exclui | Origem |
|---|---|---|---|---|---|
| 1 | **Saldo de conta** | `saldo_inicial + Σ efeito_assinado(lançamentos da conta)` | caixa | `ignored`; não liquidados (`settled = false`); lançamentos de outras contas; datas > data-limite | [FONTE: doc 01 §5.1 — `Saldo = saldo inicial + ganhos recebidos − gastos pagos`](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610430068123)] |
| 2 | **Saldo total** | `Σ saldo_conta` das contas **não arquivadas** | caixa | contas arquivadas; o resto igual à regra 1 | [FONTE: doc 01 §5.1 — “o saldo exibido exclui contas arquivadas”](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610430068123)] |
| 3 | **Projeção de saldo futuro** | `saldo_inicial + Σ efeito(lançamentos com data ≤ data-alvo)` | caixa **estendida** | `ignored`; contas arquivadas (no total). **Inclui** o que ainda não está liquidado (agendado, fatura por pagar) | [FONTE: doc 01 §5.1 — “projeções de saldo futuro com base nas transações agendadas”](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610326600603)] · a decisão de relaxar `settled` é `[DECISÃO: projetar o futuro sem `settled` é a única leitura que faz a projeção ter conteúdo]` |
| 4 | **Ajuste de saldo (“travar saldo”)** | `ajuste = saldo_real_informado − saldo_calculado_na_data`; cria-se **um lançamento** `balance_adjust` com esse valor | n/a | não reescreve nem apaga histórico; nunca entra no resultado (regra 7) | [FONTE: doc 01 §5.1 — “o app calcula a diferença e cria o ajuste automaticamente”](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54641534088859)] |
| 5 | **Anti-duplicado do ajuste** | existe ajuste se há lançamento `balance_adjust` com a **mesma conta + data + valor** e não `ignored` → não criar outro | n/a | ajustes `ignored` | `[DECISÃO: repetir “travar saldo” no mesmo dia com o mesmo valor criaria um segundo lançamento e um saldo errado; o original não documenta este caso]` |
| 6 | **Resultado mensal em caixa** | `entradas − saídas`, com `entradas = Σ magnitude(income que conta)` e `saídas = Σ magnitude(restantes que contam)` | caixa | `ignored`; categorias internas em gastos/ganhos; gasto de cartão (com `invoiceId`); ganho não recebido; transferências; aportes/resgates de objetivo; ajustes de saldo | [FONTE: doc 01 §5.2 — `Resultado = Total de Entradas − Total de Saídas`, “visão caixa”](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610239079067) · [FONTE: doc 01 §5.2 — despesa do cartão só conta “quando pagar a fatura”](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610239079067) |
| 7 | **Pagamento de fatura no resultado** | em **caixa** conta como **saída** (é a materialização da compra a crédito); em **competência** é **neutro** | caixa / competência | contaminações de entradas: **nenhuma** — é `invoice_payment`, um tipo próprio | [DECISÃO: M4 — no original o pagamento entra como “ganho” e a solução oficial é o utilizador marcar “Ignorar Transação”; aqui é operação nativa](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35615686421019)] |
| 8 | **Resultado mensal em competência** | igual à regra 6, mas: gasto de cartão conta **na data da compra**; ganho conta na data; pagamento de fatura **não** conta | competência | `ignored`; categorias internas; transferências; aportes/resgates; ajustes | `[DECISÃO: M2 — o original só tem caixa; competência é o regime que a maioria dos utilizadores espera. Base por omissão do motor: **caixa**]` |
| 9 | **Consumo de orçamento** | `consumo = Σ magnitude(expense que conta na categoria-mãe) + Σ (subcategorias diretas)` | caixa (base do motor) — ver §4-D1 | `ignored`; categorias internas; gastos sem categoria; sub-subcategorias (só filhos diretos) | [FONTE: doc 01 §5.3 — limites por categoria e consumo “em tempo real”](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610172368667)] · o regime por omissão é `[DECISÃO]` — §4-D1 |
| 10 | **Estado e alerta do orçamento** | `usedPct = round(consumo/limite × 1000)/10`; `≥100% → excedido`, `≥70% → atenção`, resto `seguro`; `alerta = alertas_ativos ≠ false ∧ usedPct ≥ limiar` (limiar por omissão **80**) | ambos (herda o regime) | `usedPct` com limite ≤ 0: `100` se consumo > 0, senão `0` | (limiar 80%) [FONTE: doc 01 §5.3 — exemplo oficial “alerta ao atingir 80% do valor de alguma categoria”](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593494651163)] · as fronteiras 70/100 e os três estados são `[DECISÃO: o original não documenta o que acontece acima de 100%]` |
| 11 | **Projeção de fim de mês** | `round(consumo / dias_decorridos × dias_totais)`, com `dias_decorridos` limitado a `[0, dias_totais]` | ambos | menos de **1 dia** decorrido → devolve o consumo atual (não extrapola); período degenerado → idem | `[DECISÃO: extrapolar de um único dia produziria números absurdos; o original não documenta projeção de consumo]` |
| 12 | **Totais de fatura** | `total = compras + arrasto_anterior`; `pago = Σ pagamentos`; `em_dívida = max(0, total − pago)` | n/a | compras `ignored`; compras de outro cartão/fatura | [FONTE: doc 01 §5.5 — “o total de gastos no cartão em um período, com data de fechamento e de pagamento”](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680196652187)] |
| 13 | **Estado da fatura** | `pago` se `total > 0 ∧ em_dívida = 0`; senão `fechado` se `hoje ≥ data_de_fecho`; senão `aberto` | n/a | fatura sem compras e sem arrasto fica **aberta** | `[DECISÃO: o original só nomeia o estado “Aberto” e menciona o fecho “cerca de 10 dias antes do vencimento”; a tríade aberto/fechado/pago é a nossa formalização]` |
| 14 | **Transição de saldo entre faturas** | o que transita para a fatura seguinte é exatamente `em_dívida` da fatura anterior; pagamento total ⇒ próxima fatura começa em `0` | n/a | nada é perdido nem arredondado: o arrasto é um valor inteiro de cêntimos | [FONTE: doc 01 §5.5 — “Se pagar menos que o total, o valor restante será transferido para a próxima fatura”](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593174621083) · [FONTE: pagamento total ⇒ próxima fatura em R$ 0,00](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35615686421019)] |
| 15 | **Datas de fecho e vencimento** | compra até ao dia de fecho (inclusive) ⇒ fatura desse mês; depois ⇒ do mês seguinte. Vencimento no mês do fecho se `dia_vencimento > dia_fecho`, senão no mês seguinte. Dia inexistente ⇒ **limitado ao último dia do mês** | n/a | nunca transborda para o mês seguinte | [FONTE: doc 01 §5.5 — competência pode diferir do vencimento](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680196652187)] · `[DECISÃO: truncar em vez de transbordar; transbordar é um erro caro em datas financeiras]` |
| 16 | **Repartição de parcelas** | `base = ⌊|total| / n⌋`; `resto = |total| − base × n`; as **primeiras `resto`** parcelas recebem `+1` cêntimo | n/a | `n` não inteiro ou < 1 ⇒ erro; o sinal não é devolvido (as parcelas são magnitudes) | [FONTE: doc 01 §5.5 — N parcelas, uma por fatura](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54675849794203)] · `[DECISÃO: a sobra vai para as primeiras parcelas para que a soma seja exatamente o total, sem inventar nem perder cêntimos]` |
| 17 | **Progresso de objetivo** | `acumulado = reservado_inicial + Σ efeito(movimentos com data ≤ hoje)`; `restante = max(0, meta − acumulado)`; `progresso = round(acumulado/meta × 1000)/10` | n/a | movimentos **futuros** (data > hoje); movimentos de outros objetivos | [FONTE: doc 01 §5.4 — valor total e valor acumulado + gráfico de evolução](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35615605707163)] |
| 18 | **Efeito de um movimento de objetivo** | `depósito` e `rendimento` somam a magnitude; `resgate` **subtrai** a magnitude | n/a | — | [FONTE: doc 01 §5.4 — movimentos de “depósitos, resgates, rendimentos”](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35615605707163)] · o sinal do resgate é `[DECISÃO]` |
| 19 | **Esforço por período** | `períodos = nº de períodos entre hoje e a data-limite, na frequência do objetivo`; `esforço = ⌈restante / períodos⌉`; `0` se `restante = 0` ou `períodos = 0` | n/a | datas-limite no passado ⇒ `períodos = 0` ⇒ esforço `0` | [FONTE: doc 01 §5.4 — “o app calcula automaticamente quanto você precisa guardar por período”](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593908723355)] · o **arredondamento para cima** é `[DECISÃO: faltar um cêntimo é pior do que sobrar um]` |
| 20 | **Contagem de períodos por frequência** | semanal `⌈dias/7⌉`; mensal `meses_inteiros (+1 se o dia final > o dia inicial)`; trimestral `⌈meses/3⌉`; anual `⌈meses/12⌉` | n/a | `0` se a data-limite ≤ hoje | `[DECISÃO: o original não documenta frequências (doc 01 §10)]` |
| 21 | **Data prevista de conclusão** | `hoje + ⌈restante / ritmo_diário⌉`, com `ritmo_diário = acumulado / dias_observados` desde o **primeiro** movimento | n/a | devolve “sem previsão” se: objetivo já cumprido ⇒ **hoje**; sem movimentos, `acumulado ≤ 0`, `dias_observados < 1` ou ritmo ≤ 0 ⇒ nulo | `[DECISÃO: recálculo pelo ritmo real; o original não tem data prevista]` |
| 22 | **Em curso (“on track”)** | verdadeiro se `restante = 0` **ou** (há previsão **e** previsão ≤ data-limite) | n/a | previsão nula ⇒ falso | `[DECISÃO]` |
| 23 | **Património líquido** | `ativos = saldos de conta + objetivos acumulados + bens`; `passivos = faturas em dívida + passivos manuais`; `líquido = ativos − passivos` | caixa para saldos | contas arquivadas; faturas já liquidadas saem do passivo | [FONTE: doc 01 §5.6 — `Patrimônio líquido = ativos − passivos`, com “ativos = saldos em conta + investimentos + bens” e “passivos = faturas abertas + dívidas formais”](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680196652187)] |
| 24 | **Objetivos no património** | o valor acumulado nos objetivos conta como **ativo** | n/a | — | `[DECISÃO: o dinheiro reservado saiu da conta mas continua a ser do utilizador; sem isto, cada aporte faria o património cair artificialmente]` |
| 25 | **Bens no património** | valor **manual**, fixo; não há depreciação automática | n/a | — | `[DECISÃO: a depreciação exigiria uma tabela de mercado que o produto não tem; o original não documenta valorização (doc 01 §10)]` |
| 26 | **Correspondência de regras de categorização** | todas as condições **preenchidas** têm de se verificar (**conjunção**); comparação de texto sem acentos, em minúsculas e sem espaços nas pontas; `contém` na descrição, **igualdade** na contraparte; faixas de valor e de dia **inclusivas**; magnitude para o valor; dia do **mês de calendário** (não do período) | n/a | `ignored`; transações que não sejam `expense`/`income`; tipo diferente do tipo da regra; regras sem nenhuma condição | [FONTE: doc 01 §5.7 — “é necessário preencher pelo menos uma” condição, condições descrição/CNPJ-CPF/valores/dias/conta](https://faq.minhaseconomias.com.br/hc/pt-br/articles/53292545975067)] · conjunção, prioridade e normalização são `[DECISÃO]` — §4-D2 |
| 27 | **Precedência de regras** | ordena por `prioridade` **ascendente**; a **primeira** que corresponder ganha; devolve-se o motivo (`nome` + `prioridade`) | n/a | regras inválidas nunca correspondem | [FONTE: doc 01 §5.7 — pré-visualização “Ver transações identificadas”](https://faq.minhaseconomias.com.br/hc/pt-br/articles/53292545975067)] · a precedência é `[DECISÃO: o original não a documenta (doc 01 §5.7/§10)]` |
| 28 | **Pré-visualização de categorização** | devolve o que **seria** aplicado, por transação; **não** altera nada | n/a | transações sem correspondência não aparecem | [FONTE: doc 01 §5.7 — pré-visualização antes de criar a regra](https://faq.minhaseconomias.com.br/hc/pt-br/articles/53292545975067)] |
| 29 | **Período mensal com início configurável** | `início` = dia configurável (1–28); data com dia ≥ início pertence ao mês; caso contrário, ao mês anterior. `fim` = início do período seguinte (**exclusivo**); `chave` = `AAAA-MM` do início | n/a | dia fora de `1..28` ⇒ erro (acima de 28 haveria meses sem esse dia) | [FONTE: o original **fixa** o mês no dia 1 e não o permite alterar](https://faq.minhaseconomias.com.br/hc/pt-br/articles/42745902816283)] · a configurabilidade é `[DECISÃO: M2 — quem recebe a meio do mês não é servido pelo original]` |
| 30 | **Aritmética de meses** | somar meses trunca o dia ao último dia do mês de destino (31 jan + 1 mês = 28/29 fev) | n/a | nunca transborda para o mês seguinte | `[DECISÃO: mesma razão da regra 15]` |

### 1.1 Como o resultado é somado (regra 6/8, precisão)

| Operação | Caixa | Competência |
|---|---|---|
| Gasto em débito/dinheiro | conta quando **liquidado** (`settled`) | conta na data |
| Gasto em cartão (`invoiceId` preenchido) | **não** conta — conta o pagamento da fatura | conta na data da compra |
| Pagamento de fatura (`invoice_payment`) | conta como **saída** quando liquidado | **não** conta |
| Ganho | conta quando **recebido** | conta na data |
| Transferência, aporte/resgate de objetivo, ajuste de saldo | **nunca** conta | **nunca** conta |
| Gasto/ganho em categoria interna | **nunca** conta | **nunca** conta |
| `ignored` | **nunca** conta | **nunca** conta |

Consequência testável: uma compra de cartão de 100 € paga na fatura seguinte aparece **exatamente uma
vez** como saída — na data do pagamento em caixa, na data da compra em competência.

---

## 2. Regras transversais

Aplicam-se a **todos** os cálculos. Uma violação de qualquer uma destas regras é um erro de motor, não
uma diferença de interpretação.

### 2.1 Categoria interna — nunca conta

Uma categoria interna (`Transferência`, `Fatura de cartão`, `Ajuste de saldo`, `Investimento`) tem
`internal = true`. Se um lançamento `expense` ou `income` estiver categorizado numa categoria interna,
**não entra** em entradas, saídas nem orçamento.
[FONTE: doc 01 §5.8 e [Glossário](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680196652187) — “Elas ficam fora do cálculo de ganhos e gastos reais”]

**Exceção deliberada e verificável:** a exclusão por categoria interna aplica-se a `expense` e `income`
categorizados — **não** ao `invoice_payment`. O pagamento de fatura não é um gasto categorizado: é a
operação que, em caixa, **é** a saída da compra a crédito.
[DECISÃO: M4 — sem esta exceção, em caixa a compra a crédito nunca apareceria como saída em lado nenhum, porque o gasto de cartão é excluído e o pagamento também seria.]

### 2.2 Transferência — par neutro

Uma transferência é **sempre duas linhas** com o mesmo `transferGroupId` e sinais opostos. Efeitos:

- cada conta envolvida muda de saldo (uma sobe, outra desce);
- o **saldo total não muda** — as duas linhas anulam-se por construção, sem necessidade de exclusão;
- **nunca** entra no resultado mensal, no orçamento, nem no património.

[FONTE: doc 01 §5.8 e [transferências](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35611866010523) — “não afeta seus ganhos ou gastos, apenas o fluxo entre contas”]

Invariante testável: `Σ saldos por conta` é invariante a acrescentar ou remover um par de transferência.

### 2.3 Estados `pending` / `confirmed` / `ignored`

| Estado | Efeito no saldo | Efeito no resultado/orçamento | Visibilidade |
|---|---|---|---|
| `pending` | **não** move o saldo (não liquidado) | não conta | visível no extrato, filtro “pendentes” |
| `confirmed` | move, quando `settled` | conta, segundo o regime e o tipo | visível |
| `ignored` | **nunca** | **nunca** | **continua visível**, com marca visual; o filtro de situação permite mostrá-la |

[FONTE: doc 01 §5.8 e [Ignorar Transação](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35611907399835) — “ainda aparecerá na lista… não somará”]

`settled` (“Já paguei”/“Já recebi”) e `status` são **eixos independentes**: um lançamento `confirmed` mas
não liquidado existe e está visível, mas não move o saldo.
[FONTE: doc 01 §5.1 — “Transações não pagas ou não recebidas não entram no cálculo do saldo até que sejam confirmadas”]

### 2.4 Contas arquivadas

Conta arquivada **sai** do saldo total, do extrato agregado e do património, mas o seu histórico **não é
apagado** e continua consultável individualmente; desarquivar repõe tudo. Apagar é diferente de arquivar:
apagar remove a conta e o histórico associado visível.
[FONTE: doc 01 §2.1 e [arquivar](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54214140659227)]

Regra de motor: a exclusão por arquivo vive **nas funções de total**, não na função de saldo individual —
uma conta arquivada continua a poder ser consultada.

### 2.5 Datas de calendário, sem hora

Todas as datas são `YYYY-MM-DD`, sem hora, e toda a aritmética é feita em **UTC**. Razões:
(1) uma data de vencimento não tem hora; (2) o resultado não pode depender do fuso de quem executa;
(3) o risco R11 do plano (`@db.Date` lido em UTC e apresentado em `Europe/Lisbon` a deslocar um dia) é
resolvido na origem: se não há hora, não há deslocamento.
[DECISÃO: o original não documenta o tratamento de fuso.]

Consequência: comparações são comparações de **strings** `YYYY-MM-DD`, e todos os limites de período são
`início inclusivo`, `fim exclusivo`.

### 2.6 Montantes em cêntimos inteiros

Todos os montantes são inteiros de cêntimos. Toda a aritmética é inteira. Consequências:

- nunca se usa vírgula flutuante para dinheiro (critério global nº 2 do plano §17);
- percentagens são derivadas e arredondadas **na apresentação** (`round(x × 1000)/10`, uma casa decimal);
- o único ponto onde existe divisão é o **esforço por período** (regra 19), resolvido com arredondamento
  para cima, e a **projeção de consumo** (regra 11), arredondada ao cêntimo;
- repartições de parcelas têm de reconstruir o total **exatamente** (regra 16).

---

## 3. Critérios de aceitação por módulo

Os módulos são os do núcleo em doc 01 §8.1. Cada critério é verificável por um teste automatizado.

> **Nota de contagem:** o enunciado fala de “13 módulos”; a tabela de §8.1 do doc 01 tem **14 linhas**
> (5 P0, 5 P1, 3 P2, 1 P3). Cobri as 14 para não deixar nada de fora. Ver §4-D8.

### 3.1 Contas manuais, saldo e ajuste de saldo (P0)

1. Dado uma conta com saldo inicial 1 000,00 € e um ganho liquidado de 200,00 €, quando se consulta o saldo, então o resultado é 1 200,00 €.
2. Dada a mesma conta e um gasto de 300,00 € com `settled = false`, quando se consulta o saldo, então o resultado continua 1 200,00 €.
3. Dado um lançamento com estado `ignored`, quando se calcula o saldo, então esse lançamento não é somado.
4. Dado um lançamento com data posterior à data-limite, quando se calcula o saldo com essa data-limite, então o lançamento é excluído (limite **inclusivo**).
5. Dada uma conta arquivada, quando se calcula o saldo **total**, então a conta não contribui; quando se calcula o saldo **dessa conta**, então o valor continua a ser devolvido.
6. Dada uma conta com saldo calculado 980,00 € e saldo real informado de 1 000,00 €, quando se trava o saldo, então é criado um ajuste de **+20,00 €** e não se altera nenhum lançamento anterior.

### 3.2 Transações: gasto, ganho e transferência (P0)

1. Dado um gasto de 50,00 € num cartão (`invoiceId` preenchido), quando se calcula o resultado em **caixa**, então esse gasto não é saída.
2. Dado o mesmo gasto, quando se calcula o resultado em **competência**, então é saída de 50,00 €.
3. Dada uma transferência de 100,00 € entre duas contas, quando se calcula o saldo total antes e depois, então o total é **igual**; e cada conta isolada muda no valor correto.
4. Dada uma transferência, quando se calcula o resultado mensal, então não há qualquer contribuição para entradas nem para saídas.
5. Dado um ganho de 1 000,00 € com `settled = false`, quando se calcula o resultado em caixa, então não é entrada; com `settled = true`, então é entrada de 1 000,00 €.
6. Dada uma transação na véspera do início do período, no dia do início, no último dia e no dia do fim, quando se calcula o resultado do período, então só as **três primeiras** contam (fim exclusivo).

### 3.3 Categorias e subcategorias, incluindo internas (P0)

1. Dado um gasto categorizado numa categoria interna, quando se calcula o resultado, então não é saída.
2. Dada uma categoria-mãe com duas subcategorias, quando se calcula o consumo do orçamento da mãe, então somam-se os gastos da mãe **e** os das subcategorias diretas.
3. Dado um gasto numa sub-subcategoria (filha de uma subcategoria), quando se calcula o consumo da categoria-mãe de topo, então esse gasto **não** é contado (só filhos diretos).
4. Dado um gasto sem categoria, quando se calcula o resultado, então conta para o total mas **não** para nenhum orçamento.
5. Dada uma categoria marcada como interna, quando se listam as categorias sem limite de orçamento, então a categoria interna não é sugerida.

### 3.4 Orçamentos mensais com alertas (P0)

1. Dado um limite de 60 000 cêntimos e consumo de 41 999 cêntimos, quando se calcula o estado, então `usedPct = 70,0` e o estado é **atenção**.
2. Dado um limite de 60 000 e consumo de 59 999, quando se calcula o estado, então é **atenção** (99,9 %).
3. Dado consumo exatamente igual ao limite, quando se calcula o estado, então é **excedido** (100 %).
4. Dado um limite de 0 com consumo > 0, quando se calcula `usedPct`, então é 100; com consumo 0, então é 0.
5. Dado `alertsEnabled = false` e consumo acima do limiar, quando se calcula o alerta, então `alertTriggered = false`.
6. Dado que o consumo já atingiu o limiar configurado, quando se avalia o alerta, então `alertTriggered = true`.

### 3.5 Objetivos, aporte e conclusão (P0)

1. Dado um objetivo de 3 000,00 € com 500,00 € reservados e sem movimentos, quando se calcula o progresso, então `progresso = 16,7 %` e `restante = 2 500,00 €`.
2. Dado um resgate superior aos depósitos, quando se calcula o acumulado, então o valor é negativo e `restante` é limitado a `max(0, meta − acumulado)`.
3. Dado um movimento com data posterior a hoje, quando se calcula o progresso, então esse movimento é ignorado.
4. Dado `restante = 2 500,00 €` e 3 períodos por cumprir, quando se calcula o esforço, então é `⌈2500/3⌉ = 833,34 €` (para cima).
5. Dada uma data-limite no passado com valor em falta, quando se calcula o esforço, então `períodos = 0` e o esforço é `0` (não é erro nem divisão por zero).
6. Dado um objetivo já cumprido, quando se calcula a data prevista de conclusão, então é **hoje** e `onTrack = true`.

### 3.6 Cartões manuais, faturas e parcelamentos (P1)

1. Dado `dia_fecho = 31` numa compra em fevereiro, quando se calcula o fecho, então a data é o **último dia de fevereiro** (não transborda para março).
2. Dada uma compra no próprio dia de fecho, quando se determina a fatura, então pertence à fatura desse mês; uma compra no dia seguinte pertence à seguinte.
3. Dada uma fatura com 250,00 € e pagamento de 200,00 €, quando se calcula a transição, então 50,00 € transitam para a fatura seguinte.
4. Dada uma fatura totalmente paga, quando se calcula o arrasto, então é 0 e o estado é **pago**.
5. Dado um pagamento superior ao total, quando se calcula o valor em dívida, então é 0 (nunca negativo).
6. Dado um total de 100,00 € em 24 parcelas, quando se reparte, então a soma das parcelas é **exatamente** 100,00 € e a diferença entre parcelas é de 1 cêntimo no máximo.

### 3.7 Recorrências (P1)

1. Dada uma recorrência mensal, quando o gerador corre duas vezes no mesmo dia, então não duplica lançamentos (idempotência).
2. Dada uma recorrência com data de fim de série, quando a data de geração ultrapassa o fim, então não é gerado nenhum lançamento novo.
3. Dada uma recorrência cujo dia não existe no mês (dia 31 em fevereiro), quando se gera a ocorrência, então a data é limitada ao último dia do mês.
4. Dado que a mesma recorrência produziu um lançamento `pending`, quando o utilizador o confirma, então não é criado um segundo lançamento.
5. Dadas as frequências suportadas (semanal, mensal, trimestral, anual), quando se gera uma série, então os intervalos correspondem à frequência escolhida.

### 3.8 Regras de categorização com pré-visualização (P1)

1. Dada uma regra com duas condições preenchidas, quando só uma se verifica, então a regra **não** corresponde (conjunção).
2. Dadas duas regras com a mesma prioridade que correspondem à mesma transação, quando se classifica, então ganha consistentemente a primeira na ordem de prioridade (resultado determinístico).
3. Dada uma regra com `prioridade` menor que corresponde, e outra com `prioridade` maior que também corresponde, quando se classifica, então ganha a de prioridade **menor**.
4. Dada uma regra com texto `"PAGAMENTO SERVIÇOS"` e uma transação com descrição `"pagamento servicos"`, quando se compara, então corresponde (sem acentos e sem maiúsculas).
5. Dada uma regra sem nenhuma condição, quando se valida, então é **inválida** e nunca corresponde.
6. Dada uma transação de transferência ou pagamento de fatura, quando se classificam, então nunca recebem categoria por regra.
7. Dada uma pré-visualização, quando o utilizador a pede, então nenhum dado é alterado.

### 3.9 Relatórios: extrato, categoria, evolução e projeção (P1)

1. Dado um conjunto de lançamentos, quando se pede o extrato filtrado por dois filtros combinados, então o resultado é a interseção (não a união).
2. Dado um período com gastos em três categorias, quando se pede o total por categoria, então só aparecem categorias com movimento e a soma é igual ao total de saídas que contam.
3. Dado `resultSeries` entre duas datas, quando o intervalo abrange três períodos, então devolvem-se exatamente três resultados, incluindo períodos sem movimento.
4. Dado um intervalo em que `to` < `from`, quando se pede a série, então a lista é vazia (não é erro).
5. Dado que existem lançamentos futuros ou não liquidados, quando se calcula a projeção de saldo para uma data futura, então os previstos são incluídos e os `ignored` não.

### 3.10 Bens e património líquido (P1)

1. Dados ativos de 10 000 € e passivos de 3 000 €, quando se calcula o património, então o líquido é 7 000 €.
2. Dados passivos maiores que os ativos, quando se calcula o património, então o líquido é **negativo** (não é limitado a zero).
3. Dada uma fatura totalmente paga, quando se calcula o património, então ela não contribui para o passivo (em dívida = 0).
4. Dado um objetivo com dinheiro acumulado, quando se calcula o património, então esse valor conta como ativo e o património **não cai** ao fazer um aporte (apenas a composição muda).
5. Dado um passivo manual com valor em dívida, quando se calcula o património, então é somado aos passivos sem data de vencimento (não é ignorado).

### 3.11 Tags (P2)

1. Dada uma transação com várias tags, quando se filtra por uma delas, então a transação é devolvida uma única vez (sem duplicados).
2. Duas tags com grafias que diferem em maiúsculas/acentos não criam duas etiquetas distintas na apresentação.
3. Dada uma tag sem transações, quando se lista, então não aparece na lista de tags em uso.
4. Dado um filtro por tag combinado com filtro por período, quando se aplica, então o resultado respeita ambos.

### 3.12 Importação OFX/CSV e exportação (P2)

1. Dado um ficheiro importado, quando se reimporta o **mesmo** ficheiro, então não é criado nenhum lançamento duplicado (critério global nº 6 do plano §17).
2. Dado um lançamento com `fitId` já existente na conta, quando se importa, então é reconciliado em vez de inserido.
3. Dada uma pré-visualização de importação, quando o utilizador não confirma, então nada é escrito.
4. Dada uma exportação de uma vista filtrada, quando se reimporta o ficheiro exportado, então não se duplicam lançamentos.
5. Dado um ficheiro com acentos e encoding não-UTF-8, quando se importa, então as descrições chegam legíveis (sem mojibake).
6. Dada uma exportação de valores, quando se soma a coluna de montantes, então o total coincide ao cêntimo com o motor (sem perdas por formatação decimal).

### 3.13 Passivos manuais (substituto de Dívidas) (P2)

1. Dado um passivo manual de 5 000 €, quando se calcula o património, então entra integralmente nos passivos.
2. Dado um pagamento de prestação, quando se registra, então o valor em dívida diminui exatamente no valor pago e nunca fica negativo.
3. Dado um passivo liquidado (valor em dívida 0), quando se calcula o património, então não contribui.
4. Dada uma prestação em atraso, quando se lista o passivo, então a situação de atraso é distinguível do valor em dívida.
5. Dado que o original **não tem** cadastro manual de dívidas, quando se cria um passivo, então nenhuma regra do contrato depende de Open Finance.
   [FONTE: doc 01 §2.9 — “Hoje não existe cadastro manual de dívidas”](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54641577264155)]

### 3.14 Dashboard configurável (P3)

1. Dada uma preferência de blocos visíveis guardada, quando se abre o dashboard, então são mostrados exatamente os blocos escolhidos.
2. Dado o mesmo agregado pedido em dois sítios diferentes (painel e relatório), quando ambos são calculados, então os números são **idênticos** (mesma função de motor).
3. Dado o seletor de regime, quando se alterna caixa/competência, então **todos** os agregados do dashboard mudam de regime de forma coerente (nenhum bloco fica no regime antigo).
4. Dada a ausência de dados, quando se abre o dashboard, então mostra estados vazios e não erros nem zeros enganadores.

---

## 4. Decisões em aberto

Cada linha é uma ambiguidade que o sistema de referência **não** resolve (doc 01 §5.3, §5.5, §5.7, §10)
ou uma divergência entre documentos que precisa de confirmação. Nenhuma está escondida.

| # | Ambiguidade / divergência | Nossa decisão | Risco | O que a faria mudar |
|---|---|---|---|---|
| **D1** | **Regime por omissão do orçamento — CONTRADIÇÃO REAL entre intenção e código.** O comentário de topo de `budget.ts` afirma “o consumo por omissão é por **competência**”, mas o orçamento não define base própria: herda o `cash` por omissão de `result.ts`. Efeito: um gasto de cartão não conta para o orçamento sem que o chamador peça `accrual` explicitamente. Os 148 testes só exercitam o orçamento com `accrual` explícito, pelo que o comportamento por omissão está **não testado** | Manter o código como está (**caixa** por omissão, comutável) **ou** alinhar com o comentário (competência por omissão para orçamento). Precisa de decisão do Lead | Alto: o orçamento pode mostrar 0 % a quem gasta tudo no cartão, ou divergir do resultado mensal mostrado ao lado. Contradiz o princípio declarado no próprio código de que “o orçamento e o painel nunca discordem” | Adicionar um teste que fixe o regime por omissão do orçamento; ou dar ao orçamento uma base própria por omissão = `accrual`; ou corrigir o comentário para “caixa” |
| **D2** | Conjunção vs disjunção das condições de uma regra; precedência entre regras | **Conjunção**; prioridade numérica ascendente, primeira ganha | Médio: uma regra com duas condições fica mais restrita do que o utilizador pode esperar | Feedback de utilizadores a dizer que “a regra não apanhava o que devia” com mais de uma condição |
| **D3** | Dias do mês nas regras: mês de calendário ou “dia do período” | **Dia do mês de calendário** (aceita-se a incoerência com o período configurável; é o que o original mostra) | Médio: com início de mês ≠ 1, as regras por dia não acompanham o período | Se o produto passar a mostrar tudo em “dia do período”, alinhar as regras |
| **D4** | Movimentos de objetivo: doc 01 diz “passadas **ou do mês atual**”; o motor aceita apenas `data ≤ hoje` | **Aceitar apenas até hoje** (mais restritivo) | Baixo: no dia 5, um movimento datado de 20 do mesmo mês é recusado | Pedido legítimo de agendar um aporte dentro do próprio mês; resolveria-se com os movimentos futuros de M3 |
| **D5** | Encargos e juros de pagamento parcial: o plano (Fase 4) promete “encargos explícitos”, o original menciona-os sem os definir, e o motor da Fase 1 **não** os modela | Nada é calculado automaticamente; o arrasto é exatamente o valor em dívida | Médio: a fatura seguinte pode subestimar o que o utilizador pagará | Decidir o modelo de encargos (taxa mensal? valor manual?) antes da Fase 4 |
| **D6** | Regras de categorização: o esquema Prisma tem `TransactionRuleAction` (`SET_CATEGORY`, `SET_TAGS`, `SET_DESCRIPTION`, `MARK_IGNORED`) e o plano prevê ativar/desativar e aplicação retroativa; o motor da Fase 1 só atribui **categoria** | Congelar agora **só** a categoria; o resto é Fase 5 e terá de ser acrescentado ao contrato | Médio: risco de o contrato ficar desatualizado se a Fase 5 acrescentar ações sem atualizar este documento | Implementação da Fase 5; nessa altura este documento é revisto e re-congelado |
| **D7** | Aritmética de meses: somar meses podia transbordar (31 jan + 1 mês = 3 mar) | **Truncar** ao último dia do mês | Baixo: um vencimento “31” passa a 28/29 em fevereiro, o que é o comportamento bancário habitual | Se se quiser preservar a intenção “último dia do mês” de forma explícita (dia `-1`), modelar isso como regra própria |
| **D8** | Contagem dos módulos do núcleo: o enunciado diz 13; doc 01 §8.1 tem 14 linhas | Cobrir as **14** (nenhuma linha fica sem critérios) | Baixo: apenas numérico | Confirmação do Lead sobre qual linha não conta como módulo |
| **D9** | Rotina de fecho de mês: o original não a tem e recomenda uma rotina manual (doc 01 §3.10); M5 introduz um assistente | O fecho de mês é um **agregado de leitura**; não altera estados nem fecha períodos | Baixo: se no futuro “fechar” passar a bloquear edições, é preciso modelo de período fechado | Se surgir requisito de imutabilidade pós-fecho (auditoria) |
| **D10** | Valores de bens: valorização por mercado vs manual | **Manual e fixa**, sem depreciação | Baixo/Médio: o património pode ficar otimista ao longo dos anos | Se o produto introduzir atualização de valor de bens |
| **D11** | Objetivos contam como ativo no património | **Sim** | Baixo: dupla contagem se o dinheiro do objetivo ainda estiver numa conta incluída nos saldos | Se os objetivos passarem a ter “conta dedicada” que já entra nos saldos, é preciso excluir um dos lados |

**Divergências assinaladas e resolvidas (sem ação pendente):** o pagamento de fatura como operação nativa
(M4) é **intencionalmente diferente** do original, que o lança como ganho — está fixado na regra 7;
o mês configurável (regra 29) e o regime de competência (regra 8) são intencionalmente diferentes do
original (M2); a importação/exportação (doc 01 §2.18) **não existe** no original e não é contradição,
é funcionalidade nova.

---

## 5. Glossário pt-PT (para a microcopy da Fase 2)

Uma palavra para uma coisa. Esta tabela é normativa: a microcopy usa **exatamente** o termo da coluna 1.

| Termo | Definição no produto | Não usar |
|---|---|---|
| **Conta** | Onde o dinheiro está (corrente, poupança, carteira, dinheiro, ativo manual). | “banco”, “wallet” |
| **Carteira** | Tipo de conta para dinheiro físico/digital sem instituição. Não é sinónimo de “conta”. | — |
| **Conta principal** | A conta pré-selecionada ao lançar. Existe **uma** de cada vez. | “conta por omissão” |
| **Saldo** | Dinheiro disponível numa conta: inicial + entradas liquidadas − saídas liquidadas. | “balanço” |
| **Saldo travado** | Saldo fixado pelo utilizador numa data, por ajuste: o sistema calcula a diferença e cria um lançamento de ajuste. | “saldo bloqueado”, “conciliar” |
| **Ajuste de saldo** | O lançamento criado pelo saldo travado. Aparece no extrato e **nunca** conta como ganho ou gasto. | “correção” |
| **Lançamento** | Registo de um movimento. Termo genérico que inclui gasto, ganho, transferência, pagamento de fatura, aporte e ajuste. | “transação” (aceita-se em contexto técnico) |
| **Gasto** | Lançamento que representa consumo. | “despesa”, “saída” (saída é o total agregado) |
| **Ganho** | Lançamento que representa entrada de valor. | “receita”, “entrada” (entrada é o total agregado) |
| **Entradas** / **Saídas** | Os **totais** agregados de um período, em magnitude. São resultados, não lançamentos. | — |
| **Transferência** | Movimento entre duas contas próprias. Gera **duas** linhas e é neutra no resultado. | “transfer” |
| **Pagamento de fatura** | Lançamento que liquida o passivo do cartão. Nunca é um ganho. | “pagamento do cartão” |
| **Caixa** | Regime em que o movimento conta quando o dinheiro se move. | “cash”, “regime de pagamento” |
| **Competência** | Regime em que o movimento conta quando a obrigação nasce (ex.: compra no cartão conta na compra). | “accrual”, “regime de competência contabilística” |
| **Regime** | O seletor caixa/competência que o utilizador controla. | “modo” |
| **Período** | Intervalo mensal `[início, fim)` com início configurável (1–28). O fim é **exclusivo**. | “mês” (o mês de calendário é só o caso em que o início é 1) |
| **Início do mês** | Dia em que o período começa; por omissão 1. | “dia de corte” |
| **Fecho** (da fatura) | Dia em que a fatura deixa de aceitar compras. Compra até ao fecho entra nessa fatura. | “corte”, “closing” |
| **Vencimento** (da fatura) | Dia em que a fatura tem de ser paga. Pode cair em mês diferente do fecho. | “pagamento”, “due date” |
| **Fatura** | Conjunto de compras do cartão num ciclo, com fecho e vencimento. Estados: **aberta**, **fechada**, **paga**. | “extrato do cartão” |
| **Em dívida** | Valor da fatura ainda por pagar. Nunca negativo. | “saldo devedor”, “outstanding” |
| **Arrasto** | Valor em dívida que transita para a fatura seguinte. | “transição”, “rollover” |
| **Parcela** | Uma das N partes de uma compra parcelada; ocupa uma fatura. | “prestação” (prestação é de passivo manual) |
| **Prestação** | Pagamento periódico de um **passivo manual** (empréstimo, financiamento). | “parcela” |
| **Passivo manual** | Dívida registada à mão, com valor em dívida. Substitui o módulo Dívidas do original. | “dívida bancária” (não há ligação a banco) |
| **Bem** | Ativo patrimonial de valor manual (veículo, imóvel, outro). Não se deprecia automaticamente. | “investimento” |
| **Património líquido** | Ativos (saldos + objetivos + bens) − passivos (faturas em dívida + passivos manuais). | “net worth”, “saldo total” (são coisas distintas) |
| **Objetivo** | Meta de poupança com valor, data-limite e frequência de aporte. | “meta”, “goal” |
| **Aporte** | Movimento de dinheiro **para** um objetivo. | “depósito” (depósito é o tipo técnico), “poupança” |
| **Resgate** | Movimento de dinheiro **de volta** de um objetivo. | “levantamento”, “withdrawal” |
| **Rendimento** (do objetivo) | Ajuste positivo do valor acumulado por rendimento do dinheiro reservado. | “juro”, “yield” |
| **Progresso** | Percentagem concluída de um objetivo. | “percentagem” |
| **Esforço por período** | Quanto é preciso guardar em cada período que falta, arredondado para cima. | “prestação do objetivo” |
| **Em curso** | Estado de um objetivo cuja previsão de conclusão não ultrapassa a data-limite. | “on track” |
| **Orçamento** | Total mensal distribuído por categorias, com limites. | “budget”, “plano de gastos” |
| **Limite** | Valor máximo atribuído a **uma** categoria dentro do orçamento. | “teto” |
| **Consumo** | Soma dos gastos que contam para um limite (categoria + subcategorias diretas). | “gasto do orçamento” |
| **Seguro / Atenção / Excedido** | Os três estados do orçamento: < 70 %, 70–99,9 %, ≥ 100 %. | “verde/amarelo/vermelho” na microcopy |
| **Alerta** | Aviso disparado ao atingir o limiar configurado (por omissão 80 %). | “notificação” (é o canal, não a regra) |
| **Recorrência** | Regra que gera lançamentos repetidos automaticamente. | “repetição”, “subscrição” |
| **Regra de categorização** | Regra que atribui categoria a lançamentos existentes. **Não cria** lançamentos. | “regra automática”, “categorização” isolada |
| **Pré-visualização** | O que uma regra faria, mostrado antes de aplicar; não altera nada. | “simulação” |
| **Categoria interna** | Categoria técnica (transferência, fatura, ajuste, investimento) que **nunca** conta como ganho ou gasto real. | “categoria do sistema” (sistema é outra coisa: não editável) |
| **Categoria do sistema** | Categoria pré-definida, **não** editável nem apagável pelo utilizador. | “categoria fixa” |
| **Subcategoria** | Categoria filha de outra. O consumo soma para a mãe. | “sub-tipo” |
| **Etiqueta** (tag) | Marca livre numa transação, transversal às categorias. | “label” |
| **Pendente / Confirmado / Ignorado** | Os três estados de um lançamento. “Ignorado” continua visível mas não soma. | “anulado” (ignorado não é anulado) |
| **Liquidado** | “Já paguei” / “Já recebi”: o que move o saldo. | “pago” (pago é da fatura), “efetivado” |
| **Arquivada** (conta) | Conta oculta dos totais, com histórico intacto e reversível. Diferente de apagar. | “eliminada”, “inativa” |

---

## 6. Cobertura e limites deste documento

| Ponto exigido | Onde |
|---|---|
| 1. Tabela de decisões de cálculo (17 regras obrigatórias) | §1 — regras 1-30, todas as 17 pedidas presentes |
| 2. Regras transversais | §2.1-§2.6 |
| 3. Critérios de aceitação por módulo | §3.1-§3.14 (14 módulos, 76 critérios) |
| 4. Decisões em aberto com risco | §4 (D1-D11) |
| 5. Glossário pt-PT | §5 (49 termos) |

**O que este documento não cobre, por estar fora de âmbito:** Open Finance e tudo o que dele dependia
(dívidas e investimentos por sincronização), multiusuário/membros e workspaces partilhadas, apps nativas
iOS/Android, moeda BRL e um mês fixo no dia 1, e a assinatura “Meu Clube” com cobrança pelas lojas.
[FONTE: doc 01 §8 — decisões do cliente](https://faq.minhaseconomias.com.br/hc/pt-br)

**O que fica para o contrato das fases seguintes:** ações de regra além da categoria (D6),
modelo de encargos da fatura (D5), geração de recorrências no agendador (Fase 5), importação/exportação
(§3.12, Fase 7), e os critérios de mapa de ecrãs e acessibilidade (Fases 2 e 6).

*Fim do documento.*
