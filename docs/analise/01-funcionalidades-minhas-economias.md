# Análise funcional — Minhas Economias (sistema de referência)

> **Documento:** `docs/analise/01-funcionalidades-minhas-economias.md`
> **Tarefa:** task-1 (R1 — Análise funcional profunda do Minhas Economias)
> **Autor:** analista-funcional
> **Data de consulta das fontes:** 2026-10-10
> **Objetivo:** mapear por completo a funcionalidade do sistema de referência brasileiro
> [Minhas Economias](https://wwws.minhaseconomias.com.br/) para servir de base à reconstrução
> com visual moderno, **sem integração bancária/Open Finance** (decisão do cliente).
> **Idioma do documento:** português de Portugal. Nomes de ecrãs, botões e campos do produto
> original são mantidos em PT-BR e entre `“aspas”`, porque são identificadores funcionais.

---

## 0. Convenções de leitura

| Marca | Significado |
|---|---|
| `[FONTE: <link>]` | Afirmação extraída de fonte pública; o link aponta para a página exata. |
| `[INFERÊNCIA]` | Dedução minha (analista) a partir de factos, não afirmada explicitamente por nenhuma fonte. |
| `[NÃO ENCONTRADO]` | Não existe informação sobre o ponto em fontes públicas consultadas; **não foi inventado**. |
| `[FORA DE ÂMBITO]` | Funcionalidade existente no original mas **excluída** da nossa nova versão por decisão do cliente (ver secção 8). |
| **FACTOS** | Qualquer linha sem `[INFERÊNCIA]` é facto com fonte citada. |

Fontes primárias usadas: central de ajuda oficial (Zendesk) em
[faq.minhaseconomias.com.br](https://faq.minhaseconomias.com.br/hc/pt-br) — consultada também através
da API pública `…/api/v2/help_center/pt-br/articles/<id>.json`, que devolve o corpo integral dos artigos;
fichas nas lojas de aplicações; portal institucional; Reclame Aqui; artigos comparativos de terceiros.
O registo completo de fontes está no **Anexo A**.

> **Nota metodológica:** a central de ajuda do produto foi integralmente atualizada em agosto/setembro de
> 2026 e descreve a **nova experiência** (a antiga foi descontinuada). Toda a análise abaixo refere-se à
> nova experiência, exceto onde indicado.

---

## 1. Visão geral, proposta de valor e público-alvo

### 1.1 O que é

O Minhas Economias é um **aplicativo de gestão financeira pessoal** que ajuda o utilizador a
“entender e controlar melhor o seu dinheiro, de forma simples e organizada”.
[FONTE: [O que é o Minhas Economias?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593611981595)]

A declaração de intenção do produto é explícita: *“O objetivo do app é te ajudar a construir consciência
financeira e, com o tempo, se tornar um investidor mais preparado.”*
[FONTE: [O que é o Minhas Economias?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593611981595)]

Na App Store brasileira a app é descrita como *“o seu organizador financeiro ideal para uma gestão
financeira sem complicações… Diga adeus às planilhas complicadas!”*, categoria de finanças, `Grátis ·
Compras dentro do app`, com **4,6 de 5 em 58 mil classificações** (iOS, loja BR).
[FONTE: [App Store BR — Minhas Economias](https://apps.apple.com/br/app/minhas-economias/id520869873)]
No Google Play a nota indicada nos resultados de pesquisa é **4,2 estrelas**
[FONTE: [Google Play — Minhas Economias](https://play.google.com/store/apps/details?id=com.minhaseconomias&hl=pt-BR)].

### 1.2 Proposta de valor

Capacidades enumeradas oficialmente pelo produto
[FONTE: [O que é o Minhas Economias?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593611981595)]:

| # | Capacidade declarada | Módulo correspondente |
|---|---|---|
| 1 | Conectar automaticamente contas de diversos bancos via **Open Finance** | `[FORA DE ÂMBITO]` — secção 8 |
| 2 | Adicionar **contas manuais** para ter tudo no mesmo lugar | Contas (2.1) |
| 3 | Criar **limites de gastos mensais** e acompanhar orçamento | Orçamentos (2.7) |
| 4 | **Categorias e subcategorias** personalizáveis | Categorias (2.4) |
| 5 | Gerir **cartões de crédito** (manual ou por conexão automática) | Cartões (2.2) |
| 6 | Estabelecer e acompanhar **objetivos financeiros** | Objetivos (2.8) |
| 7 | **Alertas personalizados** ao atingir determinados limites | Alertas (2.17) |
| 8 | **Extrato completo** com filtros inteligentes | Extrato/relatórios (2.12) |
| 9 | Criar **membros** para acompanhar finanças da família | `[FORA DE ÂMBITO]` — secção 8 |
| 10 | **Tags** para identificar e organizar transações | Tags (2.5) |
| — | *“…e muito mais!”* (produto não enumera o resto) | — |

**Entrega de valor para a nova versão [INFERÊNCIA]:** o núcleo replicável sem banco é
*contas manuais + transações + categorias + orçamento + objetivos + cartões manuais + recorrências +
regras de categorização automática + bens/património + relatórios*. É exatamente o conjunto que o Lead
identificou como prioritário.

### 1.3 Público-alvo

| Segmento | Evidência |
|---|---|
| Utilizadores brasileiros de finanças pessoais, com foco em **controlo manual** (quem já usa planilhas/cadernos) | Artigo comparativo classifica o Minhas Economias como app de **preenchimento manual**: *“Dois excelentes são o Money Lover e o Minhas Economias.”* [FONTE: [my-best — Top 10 Apps de Finanças Pessoais](https://br.my-best.com/18262)] |
| **Famílias e casais** (via “Membros”, sem multiusuário real) | *“Ideal para famílias, casais, finanças compartilhadas…”* [FONTE: [O que é a funcionalidade Membros?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610319457947)] |
| Utilizadores **iniciantes** que precisam de criar disciplina financeira | Recomendação do planejador CFP® consultado pelo comparativo: apps manuais são melhores para quem está a criar o hábito [FONTE: [my-best](https://br.my-best.com/18262)] |
| Utilizadores que querem **poupar para objetivos** (viagens, aposentadoria, carro/casa, estudos) | [FONTE: [O que é a ferramenta de Objetivos?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35615605707163)] |

### 1.4 Plataformas

| Plataforma | Estado | Fonte |
|---|---|---|
| App iOS / iPadOS / macOS | Existente (App Store) | [App Store BR](https://apps.apple.com/br/app/minhas-economias/id520869873) |
| App Android | Existente (Google Play) | [Google Play](https://play.google.com/store/apps/details?id=com.minhaseconomias&hl=pt-BR) |
| **Portal web** | Existente, sem instalação: `portal.minhaseconomias.com.br`, mesmo login do app | [FONTE: [Existe versão para desktop?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680188496795)] |
| Legado web (experiência antiga) | Ainda referenciado em `wwws.minhaseconomias.com.br`; `robots.txt` bloqueia `/home.do`, `/principal.do`, `/usuariologout.do` | [FONTE: [robots.txt](https://wwws.minhaseconomias.com.br/robots.txt)] |
| Tema claro/escuro | Existente no app | [FONTE: [Como mudar entre tema claro e escuro?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680159351451)] (título e existência; conteúdo não consultado integralmente) |

> **Relevância para a nova versão:** o original já é *web-first* no portal e o cliente pediu apenas
> **PWA instalável**. Isto reduz o esforço de paridade: não há que replicar apps nativos.
> `[INFERÊNCIA]` a app nativa do original suporta gestos próprios (arrastar gráficos, biometria) que
> não são requisito nosso.

### 1.5 Modelo de negócio

| Item | Detalhe | Fonte |
|---|---|---|
| Plano gratuito | Sim. Permite registar gastos e contas **manualmente, sem integração via Open Finance** | [FONTE: [O app tem versão gratuita?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/48054818496411)] |
| Período de avaliação | **7 dias grátis** para conhecer todas as funcionalidades do Meu Clube | [FONTE: [O app tem versão gratuita?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/48054818496411)] |
| Plano mensal “Meu Clube” | **R$ 24,90 / mês** | [FONTE: [Qual o valor e forma de pagamento da assinatura Meu Clube?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35615401810715)] |
| Plano anual “Meu Clube” | **R$ 199,90 / ano** | [FONTE: idem] |
| Cobrança | Exclusivamente pela loja do dispositivo (Google Play / App Store), com renovação automática; cancelável a qualquer momento na loja | [FONTE: idem] |
| PIX | Não suportado para assinatura recorrente | [FONTE: idem] |
| Benefícios pagos | Conexão automática **ilimitada** via Open Finance; **dicas personalizadas** com base no perfil financeiro; otimização do uso da app e conselhos de saúde financeira | [FONTE: [Quais são os benefícios da assinatura Meu Clube?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35615315682587)] |
| Reembolso | Gerido pela loja, não pelo produto; avaliado com base na conta da loja (Google/Apple) | [FONTE: [Como funciona o reembolso de assinaturas?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35612785182619)] |
| Reativação | Sempre pela loja; a app não reativa sozinha | [FONTE: [Como reativar assinatura?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/45806869923227)] (título e conteúdo parcial via pesquisa) |

`[INFERÊNCIA]` **Consequência de desenho:** no original, o *paywall* está essencialmente na automação
bancária. Ao retirar Open Finance, o modelo de monetização do original deixa de fazer sentido para nós —
a nossa versão pode ser integralmente gratuita ou monetizar valor acrescentado (relatórios, importação,
multi-período), nunca sincronização bancária.

### 1.6 Duas gerações de produto e migração de dados

A experiência antiga **foi descontinuada**; existe um fluxo de migração de dados para a nova versão,
disponível no app (deep link) e na web (`Minhas contas → Adicionar conta bancária → Importar dados da
antiga exp`).
[FONTE: [Como realizar a migração da antiga experiência para a nova?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/49967806140315)]

Regras de migração declaradas:
[FONTE: [Como realizar a migração da antiga experiência para a nova?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/49967806140315)]

- Migram os dados existentes **até ao momento da migração**; **não migram dados futuros** (recorrências e parcelamentos ficam de fora).
- **Categorias não são migradas** (“na nova versão temos uma lista mais completa”).
- **Contas inativas não são migradas.**
- As duas experiências **não são sincronizadas**.
- A migração **não é cancelável sem apagar os dados migrados** da nova experiência
  [FONTE: [Posso cancelar minha migração?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/47985790171547)].

`[INFERÊNCIA]` Este é o **ponto mais frágil** do original em termos de confiança: perda silenciosa de
recorrências/parcelamentos e divergências de saldo após migração — reconhecido pela própria empresa
[FONTE: [Migrei meus dados, mas meu saldo não veio ou está errado](https://faq.minhaseconomias.com.br/hc/pt-br/articles/47986170743323)].
Na nossa versão, importação/migração deve ser **idempotente, reversível e com pré-visualização**.

---

## 2. Inventário exaustivo de módulos e funcionalidades

### 2.0 Tabela mestra de módulos

| # | Módulo | Existe no original? | Depende de banco? | Âmbito na nova versão |
|---|---|---|---|---|
| 1 | Contas e carteiras | Sim | Não (manual) | **Núcleo** |
| 2 | Cartões de crédito e faturas | Sim | Não (manual) | **Núcleo** |
| 3 | Transações (gastos / ganhos / transferências) | Sim | Não | **Núcleo** |
| 4 | Categorias e subcategorias | Sim | Não | **Núcleo** |
| 5 | Tags | Sim | Não | **Núcleo** (custo baixo, valor alto) |
| 6 | Orçamentos mensais por categoria | Sim | Não | **Núcleo** |
| 7 | Objetivos / metas | Sim | Não | **Núcleo** |
| 8 | Recorrências | Sim | Não | **Núcleo** |
| 9 | Regras de transação (categorização automática) | Sim | Não | **Núcleo** |
| 10 | Bens patrimoniais / património líquido | Sim | Não | **Núcleo** |
| 11 | Dívidas / financiamentos | Só via Open Finance | **Sim** | Fora (substituir por passivos manuais) |
| 12 | Investimentos | Só via Open Finance | **Sim** | Fora (substituir por conta/ativo manual) |
| 13 | Desempenho / gráficos / projeções de saldo | Sim | Não | **Núcleo** |
| 14 | Extrato, filtros e relatórios | Sim | Não | **Núcleo** |
| 15 | Exportação de dados | **Não existe** | Não | Melhoria nossa |
| 16 | Importação OFX/CSV | **Não encontrada** | Não | Melhoria nossa |
| 17 | Membros / multiusuário / workspaces | Sim (membros, workspaces); multiusuário não | Não | `[FORA DE ÂMBITO]` |
| 18 | Notificações e alertas | Sim (alertas/lembretes) | Não | **Núcleo** |
| 19 | Open Finance | Sim | **Sim** | `[FORA DE ÂMBITO]` |
| 20 | Plano gratuito vs pago | Sim | — | Repensar (secção 1.5) |
| 21 | Connector MCP / IA | Sim | Não | Opcional (fora do núcleo) |
| 22 | Conta, autenticação e segurança | Sim | Não | **Núcleo** (simplificado a login único) |
| 23 | App nativo iOS/Android | Sim | — | `[FORA DE ÂMBITO]` (só PWA) |
| 24 | Migração entre gerações | Sim | — | Parcial: importação de dados |

### 2.1 Contas e carteiras

**O que faz.** Mantém o registo das contas onde o dinheiro está, com saldo próprio, e serve de origem/
destino de transações. Existem contas **manuais** (alimentadas pelo utilizador) e **integradas** (sincronizadas
via Open Finance, `[FORA DE ÂMBITO]`).
[FONTE: [Como criar uma conta manual no Minhas Economias?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35592690788251)]

**Criar conta manual (app).** `Minhas contas → registo manual → “vou seguir manualmente”`. O produto
mostra de seguida uma **lista de bancos que é apenas referência visual** e não cria conexão: o utilizador
escolhe qualquer banco ou `“Outros”` e pode usar `“Indique um banco”`.
[FONTE: [Como criar uma conta manual no Minhas Economias?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35592690788251)]
Na web: menu lateral `Minhas Contas → Adicionar conta bancária → “Vou seguir manualmente”`. [FONTE: idem]

**Campos.** `[INFERÊNCIA]` obtidos do artigo de edição de conta (2.ª fonte abaixo), que enumera o que é
alterável: **instituição financeira, saldo disponível, tipo de conta, apelido, descrição** e a opção
**“Essa é minha conta principal”**.

**Editar.** `Detalhes da conta → menu 3 pontos → “Editar conta” → alterar → “Salvar alterações”`.
A **conta principal** é a pré-selecionada quando se registam transações manuais e **só uma conta pode
ocupar essa posição**.
[FONTE: [Como editar os dados de uma conta?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54641521378331)]
[FONTE: [Glossário](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680196652187)]

**Entradas / saídas.**

| Aspeto | Detalhe | Fonte |
|---|---|---|
| Entradas | instituição, apelido, tipo de conta, saldo inicial/disponível, descrição, flag conta principal | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54641521378331) |
| Saídas | saldo por conta, evolução do saldo (gráfico diário/mensal), **projeções de saldo futuro** com base em transações agendadas | [FONTE: [Onde vejo o saldo das minhas contas?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610326600603)] |
| Onde ver | tela inicial → `“Detalhes”` ao lado do saldo total → `“Detalhes do saldo”`; ou aba `“Minhas Contas”` (barra inferior) | [FONTE: idem] |

**Regras de negócio conhecidas.**
- O saldo exibido é o **valor real disponível**, considerando saldo inicial + entradas registadas − saídas
  efetivamente realizadas. [FONTE: [Como é calculado o meu saldo?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610430068123)]
- O saldo **exclui contas arquivadas**. [FONTE: idem]
- Transações **não pagas/não recebidas não entram no saldo** até serem confirmadas. [FONTE: idem]
- Existe uma carteira por omissão chamada **“Minha Carteira”**: se o utilizador não rolar o formulário e
  escolher a conta, o lançamento cai lá. [FONTE: [Meu saldo está divergente. O que fazer?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54675849670043)]
- **Arquivar ≠ apagar:** arquivar oculta a conta da tela principal sem perder histórico (a conta sai do
  saldo e do extrato) e pode ser revertido. `Meu Patrimônio`/`Patrimônio → 3 pontos → “Arquivar conta”`;
  desarquivar em `Arquivados` (fim da página) → `“Desarquivar contas”`.
  [FONTE: [Como arquivar e desarquivar uma conta bancária](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54214140659227)]
- **Apagar** remove a conta e faz **desaparecer transações e cartões associados** do app.
  [FONTE: [Como excluir uma conta e o que acontece com o histórico?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54641577139227)]

**Ajuste de saldo (“travar saldo”).** `Detalhes da conta → lápis ao lado de “Saldo atual”` abre
`“Ajuste de saldo”`: o utilizador informa **data de referência** e **saldo real nessa data**; o app
**calcula a diferença e cria o ajuste automaticamente**; `“Travar saldo”`. Os ajustes anteriores ficam em
`“Saldos travados”`. [FONTE: [Meu saldo está desatualizado…](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54641534088859)]

**Estados de erro / limite conhecidos.**

| Situação | Comportamento documentado | Fonte |
|---|---|---|
| Saldo divergente | Causas: lançamento na conta errada (foi para “Minha Carteira”), gasto no cartão tratado como passivo, conta migrada da experiência antiga | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54675849670043) |
| Moeda | **Não é possível alterar**: “o real (R$) é a única opção disponível” | [FONTE: [Consigo alterar a moeda informada no saldo?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/42745695987611)] |
| Início do mês | **Não alterável**: “O período é padronizado, considerando sempre do dia 1º até o dia 30 ou 31” | [FONTE: [Posso alterar a data que começa a valer o mês…?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/42745902816283)] |
| Instituição em falta na lista | Usar `“Outros”` + `“Indique um banco”` | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35592690788251) |
| Falha persistente | Enviar prints para `contato@minhaseconomias.com.br` (sem resolução automática) | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54675849670043) |

### 2.2 Cartões de crédito e faturas

**O que faz.** Gestão completa de fatura, limite e transações vinculadas ao cartão — o produto afirma
explicitamente que isto **não era possível na versão antiga**.
[FONTE: [Como utilizar o cartão de crédito na nova experiência…](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610978972187)]

**Criar cartão manual.** `Minhas Contas → aba Passivos → “+ Adicionar Cartão de Crédito” → adicionar
manualmente` (a opção automática via Open Finance aparece recomendada mas não é obrigatória).
Campos: **nome do cartão**, **conta vinculada** (conta de onde a fatura será paga), **bandeira**
(Visa, MasterCard, HiperCard, American Express, Elo ou Outra), **data de fechamento**, **limite mensal**
(opcional). `“Adicionar cartão”`. A **primeira fatura é criada automaticamente** quando se lança o
primeiro gasto. [FONTE: [Como criar um cartão de crédito manual?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54640095465115)]

Na versão “nova experiência” os campos incluem ainda **data de vencimento da fatura** e **valor de
anuidade** (opcional). [FONTE: [Como utilizar o cartão de crédito na nova experiência…](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610978972187)]

**Pagar fatura.** `Cartão de Crédito → 3 pontos do cartão → “Pagar fatura”` → campos **Valor pago**,
**Conta de origem**, **Data do pagamento**, **Descrição** (opcional) → `“Confirmar”`. Também é possível
entrar no cartão e tocar na fatura. [FONTE: [Como registrar o pagamento da fatura…](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593174621083)]

**Regras de negócio da fatura.**

| Regra | Texto/comportamento | Fonte |
|---|---|---|
| Fatura em aberto + pagamento → **antecipação** | “o pagamento será considerado uma antecipação, e o status do cartão continuará como ‘Aberto’ até cerca de **10 dias antes da data de vencimento**” | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593174621083) |
| Pagamento parcial | “Se pagar **menos que o total**, o valor restante será transferido para a próxima fatura” (ex.: fatura R$ 250, pago R$ 200 → R$ 50 vão para a fatura seguinte) | [FONTE: idem] |
| Pagamento total | A próxima fatura começa em **R$ 0,00** | [FONTE: [Por que o pagamento da minha fatura aparece como ganho…?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35615686421019)] |
| Gasto no cartão | “entra como **passivo** assim que é lançado e só sai do saldo geral quando a fatura é paga” | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54675849670043) |
| Fatura vs competência | **Fatura** = total de gastos no cartão num período, com data de fechamento e de pagamento. **Competência** = mês em que a compra foi feita, que pode diferir do mês de vencimento da fatura | [FONTE: [Glossário](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680196652187)] |
| Dívida do cartão no património | A fatura **não** aparece na secção de Dívidas; “entra apenas como passivo no cálculo do seu património” | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54641577264155) |

**Compra parcelada.** `“+” → aba Gasto → valor, nome, categoria, forma de pagamento Crédito, cartão →
Parcelado + nº de parcelas → “Qual é o mês da fatura?” → “Registrar gasto”`. As parcelas seguintes entram
automaticamente nas faturas dos meses seguintes.
[FONTE: [Como registrar uma compra parcelada?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54675849794203)]

> ⚠️ **Limitação explícita:** *“depois de criado, um parcelamento manual não pode ser editado. O app
> exibe o aviso **‘Não é possível editar parcelamento manual’**. Para corrigir valor, categoria ou número
> de parcelas, exclua a compra e registre de novo.”*
> [FONTE: [Como registrar uma compra parcelada?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54675849794203)]

**Estado de erro conhecido — confusão do pagamento de fatura.** O pagamento da fatura aparece no extrato
como **“crédito”/ganho** (“o sistema interpreta isso como um ‘crédito’ porque você está quitando uma
dívida”), o que **não é um ganho real** e “pode confundir seu controle financeiro”. A solução oficial
sugerida é o utilizador marcar a transação como **“Ignorar Transação”**.
[FONTE: [Por que o pagamento da minha fatura… aparece como ganho…?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35615686421019)]

`[INFERÊNCIA]` Este é um **defeito de modelação de dados** do original: o sistema não distingue
“liquidação de passivo” de “receita”, e remete a correção ao utilizador. Na nossa versão deve existir um
tipo de transação próprio (ex.: `INVOICE_PAYMENT`) com **categoria interna** e efeito nulo no resultado.

### 2.3 Transações (gastos, ganhos, transferências)

**Registar um gasto.** `Tela inicial → “+” → “Gasto”`.
[FONTE: [Como registrar um gasto manualmente?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35592699159707)]

| Campo | Obrigatório? | Valores |
|---|---|---|
| Valor do gasto | Sim | monetário |
| Categoria | Sim | lista + criação inline |
| Forma de pagamento | Sim | **débito** ou **crédito** |
| Condição de pagamento | Sim | **único**, **parcelado**, **recorrente** |
| Conta ou Cartão | Sim | — |
| Data | Sim | — |
| Fatura | Sim, **se crédito** | mês de fatura |
| Descrição | Não | texto livre |
| “Já paguei” | Não | booleano (“marca se o valor já foi descontado”) |
| Membro | Não | `[FORA DE ÂMBITO]` |
| Tags | Não | múltiplas |

Ação final: `“Registrar gasto”`; a transação aparece na secção **Extrato**. [FONTE: idem]

**Registar um ganho.** `“+” → “Ganho”`; obrigatórios: **valor, categoria, conta, data**; opcionais:
**descrição**, **“Já recebi”**, **membro**, **“Repetir esse ganho”** (para rendas recorrentes), **tags**.
Ação final: `“Registrar ganho”`. [FONTE: [Como registrar um ganho manualmente?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35592824502171)]

**Transferência entre contas.** `“+” → transferência`; campos: **valor**, **descrição** (opcional),
**conta de origem**, **conta de destino**, **data**, **“Já transferi”**, **tags**. A transferência é
registada **duas vezes** — como **saída** na origem e **entrada** no destino — e *“não afeta seus ganhos
ou gastos, apenas o fluxo entre contas”*. [FONTE: [Como registrar uma transferência entre contas?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35611866010523)]

**Estados de uma transação** (extraídos do glossário e dos filtros):
[FONTE: [Glossário](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680196652187)]

| Estado | Significado |
|---|---|
| **Pendente** | transação ainda não confirmada |
| **Consolidada** | marcada como “Já paguei”/“Já recebi”; decide se entra no saldo do mês |
| **Ignorada** | continua visível no histórico mas **fora** dos cálculos de ganhos e gastos |

**Ignorar transação.** Serve para excluir uma transação automática da soma de ganhos/gastos (útil para
duplicados, ajustes internos, valores que não devem influenciar relatórios). A transação “ainda
aparecerá na lista, mas com um visual diferente e **não somará**”. Vê-se através do filtro de situação.
[FONTE: [O que é “Ignorar Transação”?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35611907399835)]

**Apagar transação manual.** `Extrato → tocar na transação → rolar até ao fim → “Apagar transação”`.
[FONTE: [Como excluir um registro de transação manual?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/42747006542107)]

**Alterar categoria de uma transação.** `Extrato → transação → clicar na categoria atual → escolher nova
categoria e, opcionalmente, nova subcategoria`. Pode criar-se categoria/subcategoria com o botão `“+”`.
Deixar a subcategoria em branco é permitido.
[FONTE: [Como alterar a categoria das minhas transações…?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35611021770651)]

### 2.4 Categorias e subcategorias

**Definição.** “As **categorias** são classificações que te ajudam a entender para onde vai seu dinheiro
(gastos) e de onde ele vem (ganhos)”; as **subcategorias** são divisões dentro de uma categoria,
“permitindo um nível mais detalhado de controlo”.
[FONTE: [O que são e como funcionam as categorias e subcategorias…?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610890624539)]

**Categorias pré-definidas (lista completa, conforme a fonte).** [FONTE: idem]

| Tipo | Categorias |
|---|---|
| **Gastos** (17) | Alimentação · Assinaturas · Casa · Dívidas · Educação · Lazer · Objetivos de vida · Pessoal · Pet · Saúde · Serviços · Taxas · Transferências · Transporte · Vestuário · Viagem · Outros |
| **Ganhos** (8) | Salário · Receitas Variáveis · Investimento · Presente · Prêmio · Transferências · Cashback · Outros |

**Categorias internas.** “Categorias como **Interna, Fatura ou Investimento**, usadas em transferências,
pagamento de fatura e aportes. Elas ficam **fora do cálculo de ganhos e gastos reais**.”
[FONTE: [Glossário](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680196652187)]

**Criar / editar / apagar.** `Perfil → “Categorias” → “Criar categoria”`; para subcategoria, entrar numa
categoria existente e escolher `“Criar subcategoria”`; editar/apagar nas opções `“Editar”`/`“Apagar”` no
fim do ecrã. Também é possível criar **diretamente durante o registo de uma transação**, no campo
`“Categoria”`, sem sair do formulário.
[FONTE: [Como criar categorias ou subcategorias…?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35592900823451)]

**Regra/limite importante:**

> *“As **categorias já existentes no sistema não podem ser editadas**. Você só pode **editar ou excluir
> as categorias criadas por você**.”*
> [FONTE: [Como editar ou excluir categorias no aplicativo?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/40534935060123)]

`[INFERÊNCIA]` Implica um modelo com dois níveis de propriedade (`system` vs `user`) e uma verificação de
autorização por registo. Na nossa versão vale a pena permitir **ocultar** categorias de sistema (sem as
apagar) — melhoria face ao original.

### 2.5 Tags

**O que faz.** “Etiquetas personalizadas” que se adicionam às transações para **complementar a
categorização** e agrupar transações de categorias diferentes. Exemplo oficial: usar `#viagemRJ` em
passagens, alimentação e transporte para ver o custo total da viagem.
[FONTE: [O que são e como funcionam as tags…?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610801539355)]

| Aspeto | Detalhe |
|---|---|
| Como adicionar | ao registar uma transação manual, escrever o nome no campo de tag; em transações automáticas, abrir o extrato → transação → adicionar tag |
| Quantas por transação | “**quantas tags quiser** em uma mesma transação” |
| Como consultar | `Extrato → “Filtro” → escolher a tag → “Aplicar filtro”` |
| Nota | A lista de tags é derivada das já usadas (“escolha por tags já usadas”, no filtro do extrato) [FONTE: [Como aplicar filtros no extrato?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35612043640475)] |

### 2.6 Membros e partilha — `[FORA DE ÂMBITO]`

> Decisão do cliente: **sem multiusuário, sem membros de família, sem workspaces partilhadas**. A nova
> versão é de **utilizador único com login simples**. Mapeado aqui apenas para conhecimento do original.

**Membros.** Permite acompanhar gastos e ganhos “relacionados a outras pessoas, como membros da sua
família, filhos, parceiro(a), colegas ou até dependentes financeiros”. Funcionalidades: criar perfis
individuais; vincular transações a cada membro; ver quanto cada membro consumiu num mês; acompanhar a
evolução por pessoa. Acesso: `“Perfil” > “Membros”` ou card na tela inicial. Ao registar um gasto/ganho
existe a opção `“Escolher membro”`; transações já registadas podem ser editadas no extrato. Na tela
inicial há um **resumo por membro** com entradas/saídas e filtros mensais.
[FONTE: [O que é a funcionalidade Membros?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610319457947)]
As iniciais do membro aparecem ao lado da transação no extrato e na tela inicial.
[FONTE: [Como vincular uma transação a um membro?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35611924835483)]

**Multiusuário real — não existe.** *“Hoje o Minhas Economias não tem compartilhamento de conta entre
pessoas diferentes, no sentido de contas separadas enxergando os mesmos dados.”* A única forma de mais do
que uma pessoa ver os mesmos dados é **usar o mesmo login**, o que a empresa não recomenda; o acesso
multiusuário está registado como **sugestão de melhoria**.
[FONTE: [Posso compartilhar minha conta com outra pessoa da família?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680188601243)]

**Workspaces personalizadas.** A web tem abas de workspaces no topo (`Padrão`, `Para começar`,
`Mercado`, `Pro`, `Teste`…) e um ícone `“+”` para criar. No app: `perfil → “Personalizar página inicial”`.
Podem criar-se **quantas forem necessárias**, cada uma configurada com elementos diferentes; ficam
associadas à conta e disponíveis em web e app.
[FONTE: [Como criar uma workspace personalizada](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54213018161947)]

`[INFERÊNCIA]` As “workspaces” do original não são espaços de dados separados, são **perfis de layout do
dashboard**. Mesmo sendo fora de âmbito como *workspaces*, a ideia de **dashboard configurável** é
reaproveitável como funcionalidade de utilizador único (ver secção 9).

### 2.7 Orçamentos (limites mensais por categoria)

**O que faz.** Permite controlar gastos mensais definindo **limites para cada categoria**
(Alimentação, Saúde, Lazer, Educação, Transporte, entre outras).
[FONTE: [O que é a ferramenta de orçamentos?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610172368667)]

**Diferenciais declarados:** acompanhamento de gastos **em tempo real** (não só histórico); funciona com
**contas bancárias, cartões de crédito e transações manuais**; envia **alertas quando o utilizador se
aproxima do limite**; mostra o **total gasto no mês e no ano** por categoria.
[FONTE: idem]

**Acesso:** `tela inicial → “Controle Financeiro” → card da secção “Orçamentos”`. [FONTE: idem]

**Criar orçamento.** Dois caminhos: botão `“Criar Orçamento Mensal”` na tela inicial, ou
`Controle financeiro → card de orçamento`. Etapas:
[FONTE: [Como criar um orçamento mensal…?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593494651163)]

| # | Etapa | Detalhe |
|---|---|---|
| 1 | **Definir o valor total do orçamento** | ex.: R$ 2.000 para o mês |
| 2 | **Escolher as categorias de gastos** | ex.: Alimentação, Transporte, Lazer |
| 3 | **Distribuir o valor entre as categorias** | ex.: Alimentação R$ 800, Transporte R$ 400, Lazer R$ 300, Outras R$ 500 |
| 4 | **Escolher a duração** | `Apenas para este mês` **ou** `Fixar como orçamento mensal padrão para os próximos meses` |
| 5 | **Ativar alertas** (opcional) | ex.: “Receber alerta ao atingir **80%** do valor de alguma categoria” |
| 6 | `“Concluir limites”` | orçamento ativo |

**Editar orçamento.** `Controle financeiro → “Ver mais” → 3 pontos (⋮) no canto superior do orçamento →
“Editar orçamento total”`. É possível editar: **valor total**, **limites por categoria**,
**configurações de repetição (mensal ou pontual)** e **lembretes/alertas**. Guardar com
`“Salvar alterações”`. [FONTE: [Como editar um orçamento mensal…?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593544566427)]

**Regras de negócio.**

| Regra | Detalhe | Fonte |
|---|---|---|
| Âmbito | Orçamento por **categoria** (não por subcategoria, `[INFERÊNCIA]` — não documentado) | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610172368667) |
| Repetição | Um orçamento é **pontual (só este mês)** ou **padrão mensal** | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593494651163) |
| Alertas | Limiar configurável por categoria; exemplo oficial 80% | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593494651163) |
| Janela temporal | Total gasto no **mês** e no **ano** por categoria | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610172368667) |
| Fonte dos gastos | Contas + cartões + transações manuais (ou seja, o orçamento **não distingue** a origem) | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610172368667) |
| Comportamento ao exceder o limite | `[NÃO ENCONTRADO]` — nenhum artigo descreve o que acontece após exceder (bloqueio, aviso, vermelho) | — |
| Conflito com visão caixa | `[NÃO ENCONTRADO]` — não é dito se o orçamento consome pelo critério de **competência** (data da compra) ou de **caixa** (pagamento). Ambiguidade relevante: para gastos no cartão os dois diferem | — |

`[INFERÊNCIA]` A ambiguidade competência/caixa no orçamento é uma **lacuna documental e provável fonte de
perceção de erro** pelos utilizadores. Na nossa versão deve ser explícita e configurável.

### 2.8 Objetivos (metas financeiras)

**O que faz.** Ajuda a alcançar metas financeiras como viagens, aposentadoria, compra de carro ou casa,
estudo. Com ela o utilizador pode **acompanhar depósitos**, **definir quanto e até quando** quer juntar e
**ativar lembretes mensais** para economizar.
[FONTE: [O que é a ferramenta de Objetivos?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35615605707163)]

**Criar objetivo.** `Perfil → “Objetivos” → “+ Outro objetivo”` (ou escolher uma **meta pré-definida**).
[FONTE: [Como criar um objetivo…?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593908723355)]

| # | Campo / passo | Detalhe |
|---|---|---|
| 1 | **Nome do objetivo** | ex.: “Férias na praia” → `“Ir para o valor”` |
| 2 | **Valor total** e **valor já reservado** | ex.: R$ 3.000 e R$ 500 → `“Ir para data de conclusão”` |
| 3 | **Data de conclusão** | ex.: 30/12/2025. Com estes dados “o app **calcula automaticamente quanto você precisa guardar por período**” |
| 4 | **Lembretes** | frequência para guardar dinheiro (mensal, semanal etc.) + alerta quando estiver próximo do prazo final |
| 5 | `“Salvar objetivo”` | — |

[FONTE: [Como criar um objetivo…?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593908723355)]

**Acompanhar progresso (detalhe do objetivo).** Mostra **valor total e valor já acumulado**, **data final
(ajustável)**, **gráfico de evolução** e **histórico de movimentações (depósitos, resgates, rendimentos)**.
Menu de 3 pontos: **Editar · Concluir · Excluir · Registrar resgate · Ajustar rendimentos**.
[FONTE: [O que é a ferramenta de Objetivos?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35615605707163)]

**Vincular movimentações — duas vias:**
1. **Pelo próprio objetivo:** registar **depósitos ou resgates**; usar o extrato para **selecionar uma
   transação existente** ou registar uma nova.
2. **Pelo detalhe de uma transação:** abrir a transação no extrato → no campo **“Objetivos”** selecionar o
   objetivo → confirmar.

[FONTE: idem]

**Limitações explícitas:**

> ⚠️ *“Só é possível registrar **movimentações passadas ou do mês atual**”* e *“Transações **recorrentes ou
> parceladas** serão lançadas **como únicas** no objetivo (não se repetem automaticamente)”*.
> [FONTE: [O que é a ferramenta de Objetivos?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35615605707163)]

**Editar objetivo.** `Perfil → Objetivos → tocar no objetivo → 3 pontos (⋮) → “Editar objetivo”`. Alterável:
**nome**, **valor total e valor já reservado**, **data de conclusão**, **lembretes e frequência de alertas**
→ `“Confirmar”`/`“Salvar”`. [FONTE: [Como editar um objetivo?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593961296539)]

**Tipos de movimento do objetivo:** depósito · resgate · rendimento (este último com ação explícita
“Ajustar rendimentos”). [FONTE: [O que é a ferramenta de Objetivos?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35615605707163)]

### 2.9 Dívidas e financiamentos

**O que existe.** *“A seção de **Dívidas** mostra operações de crédito formais, como empréstimos e
financiamentos, sincronizadas via **Open Finance**. Hoje **não existe cadastro manual de dívidas**.”*
[FONTE: [Posso cadastrar dívidas (empréstimos, financiamentos) no app?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54641577264155)]

| Aspeto | Estado | Fonte |
|---|---|---|
| Cadastro manual de dívidas | **Não existe** | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54641577264155) |
| Detalhamento de contratos, saldo devedor, parcelas e taxas | **Em desenvolvimento** (não disponível) | [FONTE: idem] |
| Fatura do cartão nesta secção | Não aparece; entra apenas como **passivo** no património | [FONTE: idem] |
| Dívidas formais no património líquido | “desconta faturas abertas e **dívidas formais**” | [FONTE: [Glossário](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680196652187)] |
| Categoria de sistema “Dívidas” | Existe na lista de categorias de gasto | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610890624539) |

`[INFERÊNCIA]` Como o cliente dispensou Open Finance, o módulo equivalente na nossa versão tem de ser
**passivos manuais** (empréstimo/financiamento com saldo devedor, taxa, nº de parcelas, data de fim),
agregados ao **património líquido**. Isto é simultaneamente paridade parcial e **melhoria clara** face ao
original, que não tem sequer cadastro manual.

### 2.10 Bens patrimoniais e património líquido

**Bens.** *“Sim, temos o cadastro de bens. Via web fica no menu ‘Meus bens’ como veículos e imóveis, nem
manual nem via Open Finance. Via mobile, acesse suas iniciais > Meus bens e clique em registrar bens.”*
[FONTE: [Posso cadastrar bens patrimoniais (carro, imóvel)?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54641566798107)]

`[INFERÊNCIA]` A frase do artigo é ambígua/possivelmente mal redigida (“nem manual nem via Open Finance”);
a leitura mais coerente com o resto do produto é que o registo de bens é **manual e independente de Open
Finance**. O artigo não enumera os campos do bem — daí `[NÃO ENCONTRADO]` para o esquema exato.

**Património líquido.** *“Patrimônio líquido: ativos menos passivos. Inclui saldos em conta, investimentos
e bens, e desconta faturas abertas e dívidas formais.”*
[FONTE: [Glossário](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680196652187)]

**Investimentos.** *“Hoje os investimentos entram no Minhas Economias pela conexão via Open Finance: a
instituição informa a posição automaticamente. **Não existe uma funcionalidade de lançamento manual de
investimento**, diferente do que acontece com contas e cartões.”* O detalhamento por ativo “ainda não está
disponível”. [FONTE: [Tenho um investimento. Como faço o lançamento?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54675828123419)]

**Menu onde aparece.** `Meu Patrimônio` (web) / `Patrimônio` (app) — é também onde se arquivam contas.
[FONTE: [Como arquivar e desarquivar uma conta bancária](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54214140659227)]

### 2.11 Desempenho, gráficos e projeções

**Ferramenta “Desempenho”.** Acompanha o equilíbrio financeiro ao longo do tempo com **visão caixa**.
Acesso: tela inicial → secção `“Desempenho”`. Analisa: **entradas e saídas diárias ou mensais**;
**resultado financeiro do período** (entradas − saídas); **comparações ao arrastar o gráfico
horizontalmente**.
[FONTE: [Como avalio o meu desempenho financeiro?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610246287515)]

**Análise por categoria.** `Tela inicial → gráfico de “Controle Financeiro”` mostra a **distribuição dos
gastos por categoria do mês atual**; abaixo do gráfico, `“Ver mais”` expande a lista completa de categorias
e valores; um toggle na parte superior alterna entre `“Gastos”` e `“Ganhos”`; tocar numa categoria mostra o
**detalhamento por subcategoria**; é possível ver **todas as transações** de uma categoria específica e
aplicar **filtros** por status (paga/não paga), conta bancária, membro e **mês desejado**.
[FONTE: [Como analisar meus gastos e ganhos por categoria?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610843369755)]

**Evolução e projeção de saldo.** `Tela inicial → “Detalhes” → “Detalhes do saldo”` mostra a **evolução
do saldo**, um gráfico com **visão diária ou mensal** (`“Diário”`/`“Mensal”`) e **projeções de saldo
futuro com base nas transações agendadas**.
[FONTE: [Onde vejo o saldo das minhas contas?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610326600603)]

`[INFERÊNCIA]` O produto **não tem** (ou não documenta) relatórios exportáveis, comparativos entre
períodos, nem análise de tendência por categoria. É uma das maiores oportunidades de melhoria.

### 2.12 Extrato, filtros e relatórios

**Acesso.** Abrir `Meus Gastos` e tocar em `“Ver extrato”`.
[FONTE: [Como consultar e filtrar um relatório de transações?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680180177563)]

**Filtros disponíveis** (lista exaustiva conforme a fonte):
[FONTE: [Como aplicar filtros no extrato?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35612043640475)]

| Categoria de filtro | Opções |
|---|---|
| **Ordenação** | Mais recentes primeiro · Mais antigas primeiro |
| **Tipo de transação** | ganho · gasto no débito · gasto no crédito |
| **Condição de pagamento** | à vista · parcelada · recorrente |
| **Situação da transação** | confirmadas · pendentes · **ignoradas** |
| **Conta** | entre as contas cadastradas |
| **Cartão** | entre os cartões cadastrados |
| **Categoria** | (ex.: alimentação, lazer, investimentos) |
| **Membros** | `[FORA DE ÂMBITO]` |
| **Tags** | por tags já usadas |
| Ação | `“Aplicar”` |

**Relatório de transações.** “A consulta das suas transações é feita no **Extrato**… Pelos **Filtros**
consegue recortar a lista por conta, cartão, categoria, situação, tipo, forma de pagamento, membro ou tag.
Combinando filtros, dá para montar praticamente qualquer visão.”
[FONTE: [Como consultar e filtrar um relatório de transações?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680180177563)]

`[NÃO ENCONTRADO]` O produto **não documenta** relatórios agregados por período (trimestre/ano), exportação,
comparação entre meses, nem relatórios por membro/objetivo.

### 2.13 Recorrências

**O que faz.** “**Recorrência** (ícone de calendário no topo da tela inicial): **cria lançamentos repetidos
automaticamente**, com base em **nome, valor e frequência**. Serve para o aluguel que entra todo mês.”
[FONTE: [Qual a diferença entre Recorrência e categorização automática?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680210829723)]

**Como criar.** `Abrir a transação já registada → tocar no ícone (calendário) → ecrã “Recorrências” →
“+ Adicionar nova recorrência” → ecrã “Criar Recorrência” → “Confirmar”`.
[FONTE: [Como crio uma recorrência na minha conta?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/40282064756379)]

**Indícios adicionais de campos** (dos formulários de transação): a opção **“Repetir esse ganho”** nos
ganhos e a condição de pagamento **“recorrente”** nos gastos; o filtro do extrato distingue
`recorrente` de `à vista`/`parcelada`.
[FONTE: [Como registrar um ganho manualmente?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35592824502171)]
[FONTE: [Como aplicar filtros no extrato?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35612043640475)]

`[NÃO ENCONTRADO]` Frequências suportadas (semanal/quinzenal/mensal/anual), número de ocorrências, data de
fim, tratamento de feriados/fins de semana e edição de uma série não estão documentados.

### 2.14 Regras de transação (categorização automática)

**O que faz.** “Regras de transação permitem **categorizar automaticamente** seus gastos ou ganhos sempre
que uma transação se encaixar nas condições que você definir.” **Não cria lançamentos** — apenas organiza
e categoriza os que já existem.
[FONTE: [Como criar uma Regra de Transação](https://faq.minhaseconomias.com.br/hc/pt-br/articles/53292545975067)]
[FONTE: [Qual a diferença entre Recorrência e categorização automática?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680210829723)]

**Como criar.** `Perfil (ícone no canto superior direito) → “Regras de transação” → “+” → escolher tipo
“Ganhos” ou “Gastos” → dar nome (obrigatório) → preencher pelo menos uma condição → “Ver transações
identificadas” → escolher a categoria de destino → “Criar Regra”`.
[FONTE: [Como criar uma Regra de Transação](https://faq.minhaseconomias.com.br/hc/pt-br/articles/53292545975067)]

**Condições disponíveis** (tabela da própria fonte):

| Campo | O que faz |
|---|---|
| **Descrição** | identifica pela palavra-chave na transação (ex.: “padaria”), com opção de busca **“Similar”** |
| **CNPJ/CPF** | identifica pelo documento do estabelecimento |
| **Valores entre** | define uma faixa de valor (ex.: R$ 0,00 a R$ 50,00) |
| **Entre os dias** | define um intervalo de dias do mês |
| **Conta/Cartão** | vincula a regra a uma conta ou cartão específico |

[FONTE: [Como criar uma Regra de Transação](https://faq.minhaseconomias.com.br/hc/pt-br/articles/53292545975067)]

**Pré-visualização:** existe um passo `“Ver transações identificadas”` que **mostra as transações que já
se encaixam** antes de gravar a regra. [FONTE: idem]

`[NÃO ENCONTRADO]` Prioridade/ordem de aplicação quando várias regras coincidem; se a regra se aplica
retroativamente a transações antigas; se é possível desativar uma regra temporariamente; se é possível
definir subcategoria de destino.

`[INFERÊNCIA]` Este é, a par do orçamento e dos objetivos, o módulo de **maior valor não bancário** do
original, e é totalmente replicável. O pré-visualizador de impacto é uma boa prática a manter.

### 2.15 Workspaces personalizadas — `[FORA DE ÂMBITO]`

Coberto em 2.6. Relevante apenas como inspiração para **dashboard configurável** de utilizador único.

### 2.16 Painel inicial (dashboard) — mapa de ecrãs inferido

`[INFERÊNCIA]` Consolidando as referências dispersas por ~20 artigos, a tela inicial da nova experiência
contém, no mínimo:

| Bloco | Evidência |
|---|---|
| **Saldo total** com link `“Detalhes”` para `“Detalhes do saldo”` (evolução + projeção) | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610326600603) |
| **Secção “Controle Financeiro”** com gráfico de distribuição por categoria e toggle Gastos/Ganhos, card de **Orçamentos** e `“Ver mais”` | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610172368667) · [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610843369755) |
| **Secção “Desempenho”** (entradas/saídas, resultado do período) | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610246287515) |
| **Secção “Contas Bancárias”** com `+ Adicionar` (role para baixo) | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35592567734683) |
| **Secção “Cartão de Crédito”** com cartões e respetivas faturas | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593174621083) |
| **“Meus Gastos”** (entrada para o extrato via `“Ver extrato”`) | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680180177563) |
| Botão **“+”** (gasto, ganho, transferência) | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35592699159707) |
| Ícone de **calendário** no topo (recorrências) | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680210829723) |
| Botão **“Criar Orçamento Mensal”** | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593494651163) |
| **Resumo por membro** `[FORA DE ÂMBITO]` | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610319457947) |
| **Cards de funcionalidades** (ex.: Membros) | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610319457947) |

Barra de navegação inferior: `Extrato`, `Minhas Contas`, `Perfil`. Menu de perfil:
`Objetivos`, `Categorias`, `Membros`, `Minhas contas`, `Meus bens`, `Regras de transação`, `Meu Clube`,
`Personalizar página inicial`.
[FONTE: consolidado de [Como criar categorias…](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35592900823451) · [Como criar um objetivo…](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593908723355) · [Como aplicar filtros no extrato?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35612043640475) · [Como criar uma Regra de Transação](https://faq.minhaseconomias.com.br/hc/pt-br/articles/53292545975067)]

### 2.17 Alertas, lembretes e notificações

| Tipo | Detalhe | Fonte |
|---|---|---|
| Alertas de limite | “Receber alertas personalizados ao atingir determinados limites” | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593611981595) |
| Alertas de orçamento | configuráveis por categoria; exemplo oficial: **80% do valor** de alguma categoria | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593494651163) |
| Lembretes de orçamento | editáveis em “lembretes/alertas de gastos” | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593544566427) |
| Lembretes de objetivo | frequência de aporte (mensal, semanal…) + “alerta quando estiver próximo do prazo final”; o produto promete “notificações para manter o foco na sua meta” | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593908723355) |

**Nota importante:** `[NÃO ENCONTRADO]` — uma pesquisa na central de ajuda pelo termo “notificação”
devolveu **0 resultados**. O produto fala de “alertas” e “notificações” mas **não documenta** canais
(push, e-mail), horários, nem como desativar. Também não há artigo sobre **alertas de fatura a vencer**.

### 2.18 Importação e exportação de dados

**Exportação — não existe.**

> *“O app **ainda não tem um botão de exportar que gera arquivo em CSV ou PDF**.”*
> Caminhos alternativos: (1) pedir ao assistente de IA ligado por MCP que liste/resuma/monte um relatório;
> (2) contactar `contato@minhaseconomias.com.br` para períodos antigos.
> *“A exportação nativa está registada como pedido de melhoria.”*
> [FONTE: [Consigo exportar o extrato da minha conta?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680203879963)]

**Importação OFX/CSV — `[NÃO ENCONTRADO]`.**

- Pesquisa na central de ajuda pelo termo **“OFX”**: **0 resultados** (verificável em
  `…/api/v2/help_center/articles/search.json?query=OFX`).
- Nenhum artigo consultado menciona importação de ficheiros de extrato (OFX, CSV, QIF).
- A única “importação” documentada é a **migração interna** da experiência antiga
  (`Importar dados da antiga exp`), que importa dados da própria base do produto e não ficheiros
  [FONTE: [Como realizar a migração…](https://faq.minhaseconomias.com.br/hc/pt-br/articles/49967806140315)].

> ✅ **Conclusão factual:** **a importação OFX/CSV não existe no Minhas Economias** segundo as fontes
> públicas consultadas. O cliente (via Lead) pediu-a como funcionalidade nuclear da nossa versão — ou seja,
> é **funcionalidade nova nossa**, não paridade. Isto reforça a prioridade de a especificar bem.

`[INFERÊNCIA]` A ausência de exportação numa app de finanças é uma **falha grave de portabilidade e de
confiança** (dados do utilizador sem saída) e é uma das melhorias mais baratas de implementar.

### 2.19 Open Finance — `[FORA DE ÂMBITO]`

Mapeado para conhecimento, excluído por decisão do cliente.

| Aspeto | Detalhe | Fonte |
|---|---|---|
| O que é | “conexão automática e regulada com bancos e instituições financeiras, sem compartilhar a senha do banco com o app” | [FONTE: [Glossário](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680196652187)] |
| Fluxo (app) | `Contas Bancárias → + Adicionar → selecionar instituição → “Quero Conectar” → autorizar no site do banco → aguardar` | [FONTE: [Como conectar uma conta bancária via Open Finance?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35592567734683)] |
| Fluxo (web) | igual, com **pedido de CPF** e envio de **código de verificação por e-mail** na primeira conexão | [FONTE: idem] |
| Atualizações | **diárias**; o tempo varia por instituição | [FONTE: idem] |
| Segurança | ambientes seguros e criptografados; acesso **somente em modo de visualização**; a app “não tem permissão para movimentar valores, realizar transações ou alterar dados” | [FONTE: [A conexão com meu banco é segura?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593186092571)] |
| Obrigatoriedade | **Não**: “A conexão com bancos é opcional. Você pode usar o aplicativo apenas com registros manuais” | [FONTE: [A conexão com bancos é obrigatória?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/48054754522523)] |
| Monetização | conexão ilimitada é benefício do plano **Meu Clube** | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35615315682587) |
| Dados dependentes | **Dívidas** e **Investimentos** só existem via Open Finance | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54641577264155) · [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54675828123419) |

### 2.20 Conector MCP / assistentes de IA

| Aspeto | Detalhe | Fonte |
|---|---|---|
| O que é | conector **MCP (Model Context Protocol)** que liga a conta a assistentes de IA; permite “consultar e organizar suas finanças conversando com o assistente, sem abrir o app” | [FONTE: [O que é a integração com assistentes de IA (MCP)?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680197324443)] |
| Assistentes suportados | **Claude, ChatGPT, Grok e Perplexity** | [FONTE: idem] |
| Endpoint | `https://mcp.minhaseconomias.com.br/mcp` | [FONTE: idem] |
| Exemplos de uso | “qual é o meu saldo consolidado?”, “quanto gastei este mês por categoria?” | [FONTE: idem] |
| Restrição de plataforma | conexão apenas pela **versão web** de cada IA, não pelo aplicativo; usa login **OAuth** e pode ser revogada | [FONTE: [Como Conectar no ChatGPT](https://faq.minhaseconomias.com.br/hc/pt-br/articles/52224936261147)] |
| Custo | grátis nas versões gratuitas de Claude, ChatGPT e Grok; **Perplexity exige Pro** (limitação da plataforma); MCP disponível no plano gratuito e pago do app | [FONTE: [Preciso pagar pela IA?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/52221571431963)] |
| Serve como exportação | sim, é o caminho oficial recomendado para “levar dados para fora” | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680203879963) |

`[INFERÊNCIA]` É uma funcionalidade diferenciadora, mas não núcleo. Para a nossa versão (UTILIZADOR único,
PWA, EUR/pt-PT) não é prioritária; se for feita, requer um servidor MCP com autenticação.

### 2.21 Conta, autenticação e segurança

| Aspeto | Detalhe | Fonte |
|---|---|---|
| Registo | **Nome completo, e-mail, senha, confirmação da senha** | [FONTE: [Quais dados preciso informar para me cadastrar…?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593326940571)] |
| Login social | **Apple** e **Google** (“dispensa o preenchimento manual dos dados”) | [FONTE: idem] |
| Segurança adicional | **Token de segurança**; troca de senha; **biometria (Face ID, Touch ID)**; artigos “Não consigo entrar no app” e “Posso acessar minha conta em outro celular?” | [FONTE: [Cadastro e Conta — categoria](https://faq.minhaseconomias.com.br/hc/pt-br/categories/35590937576859-Cadastro-e-Conta)] (títulos; conteúdo integral não consultado) |
| Sessão | Existe artigo “O app desloga com frequência…”, indicando problema conhecido de expiração de sessão em segundo plano | [FONTE: [Funcionalidade, membros, aplicativo — secção](https://faq.minhaseconomias.com.br/hc/pt-br/sections/35610346042779-Funcionalidade-membros-aplicativo)] |
| Conta PJ | Existe artigo “Posso ter uma conta PJ vinculada?” | [FONTE: [Perguntas frequentes — secção](https://faq.minhaseconomias.com.br/hc/pt-br/sections/35587261331099-Perguntas-frequentes)] |
| Cancelamento | Existe artigo “Como cancelar minha conta?” | [FONTE: [O que é o Minhas Economias? — artigos relacionados](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593611981595)] |

`[NÃO ENCONTRADO]` Não foram encontrados detalhes públicos sobre: política de password, expiração de
sessão, MFA, RGPD/LGPD na central de ajuda, nem prazos de retenção.

`[INFERÊNCIA]` Para a nossa versão, o requisito do Lead é **utilizador único com login simples** — ou seja,
o registo do original (nome + e-mail + senha + login social) é mais do que suficiente; biometria e token
podem ficar para fase 2.

### 2.22 Assinatura “Meu Clube”

Coberto em 1.5. Notas de operação relevantes:
- Contratação: `Perfil → “Meu Clube” → “Quero assinar”`; processamento pela loja.
  [FONTE: [Como contratar o plano Meu Clube?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35615351675547)]
- **Modo de falha documentado:** “Utilizo iOS, contratei o Meu Clube mas minha conta não ativou”.
  [FONTE: [Assinatura Meu Clube — categoria](https://faq.minhaseconomias.com.br/hc/pt-br/categories/35590959417371-Assinatura-Meu-Clube)]
- Reativação **sempre** pela loja (Google Play ou App Store), nunca pela app.
  [FONTE: [Como reativar assinatura?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/45806869923227)]

`[INFERÊNCIA]` A dependência das lojas de aplicações para cobrança é um custo de operação (comissão,
reações lentas, suporte cruzado) que **não precisamos de replicar** num produto web/PWA — podemos usar
Stripe/pagamento próprio se decidirmos monetizar.

### 2.23 Aplicação web vs app

- Não existe programa de desktop instalável; o acesso no computador é por navegador em
  `portal.minhaseconomias.com.br` com o **mesmo login do app**.
  [FONTE: [Existe versão para desktop?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680188496795)]
- Nomes de menu diferem entre app e web: `Patrimônio` (app) vs `Meu Patrimônio` (web); `Minhas contas` é
  menu lateral na web e barra inferior no app.
  [FONTE: [Como arquivar e desarquivar uma conta bancária](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54214140659227)]
- As **workspaces** criadas na web aparecem no app e vice-versa (associadas à conta).
  [FONTE: [Como criar uma workspace personalizada](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54213018161947)]
- Tema claro/escuro disponível. [FONTE: [Como mudar entre tema claro e escuro?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680159351451)]

`[INFERÊNCIA]` A divergência de nomenclatura entre plataformas (Patrimônio/Meu Patrimônio) é **dívida de
consistência** que devemos evitar: uma única taxonomia de navegação para web e PWA.

---

## 3. Fluxos do utilizador passo a passo

> Todos os fluxos abaixo são reconstruídos a partir das fontes citadas. Onde a sequência não é
> documentada, está marcada `[INFERÊNCIA]`.

### 3.1 Onboarding e registo

1. Criar conta com **nome completo, e-mail, senha e confirmação** — ou **login social Apple/Google**.
   [FONTE: [Quais dados preciso informar…?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593326940571)]
2. O produto propõe **conectar um banco via Open Finance** (`Ver bancos`, lupa ao lado de
   `“Conecte seu banco”`). `[FORA DE ÂMBITO]`
   [FONTE: [Tudo que você precisa saber sobre a Migração…](https://faq.minhaseconomias.com.br/hc/pt-br/articles/47985512965915)]
3. Alternativa explícita: **seguir manualmente** (`“Vou seguir manualmente”`), escolher banco (lista
   meramente visual) ou `“Outros”` + `“Indique um banco”`.
   [FONTE: [Como criar uma conta manual…?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35592690788251)]
4. Definir a **conta principal** (pré-selecionada nos lançamentos manuais) e o saldo disponível.
   [FONTE: [Como editar os dados de uma conta?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54641521378331)]
5. `[INFERÊNCIA]` O produto **não documenta** um wizard de boas-vindas, tour guiado ou ecrã de estado
   vazio com sugestões — o onboarding parece ser: *criar conta → escolher banco ou “seguir manualmente”
   → começar a lançar*. Não há artigo “primeiros passos” na central de ajuda.
6. Utilizadores com dados na experiência antiga podem executar a **migração** (ver 1.6).

### 3.2 Criar a primeira conta manual

1. Menu inferior `Minhas contas`. [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35592690788251)
2. Escolher registo manual → `“vou seguir manualmente”`.
3. Selecionar qualquer banco da lista (é só referência visual) ou `“Outros”`.
4. Preencher dados (instituição, apelido, tipo, saldo disponível, descrição) e marcar
   `“Essa é minha conta principal”` se aplicável. `[INFERÊNCIA — campos derivados do artigo de edição]`
5. Guardar. Resultado: conta visível em `Minhas Contas` e incluída no saldo total.
   [FONTE: [Onde vejo o saldo das minhas contas?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610326600603)]

### 3.3 Registar uma despesa (gasto)

1. Tela inicial → botão `“+”` → opção `“Gasto”`. [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35592699159707)
2. Preencher obrigatórios: **valor, categoria, forma de pagamento (débito/crédito), condição de pagamento
   (único/parcelado/recorrente), conta ou cartão, data** e, **se crédito, a fatura**.
3. Preencher opcionais: **descrição, “Já paguei”, membro `[FORA DE ÂMBITO]`, tags**.
4. `“Registrar gasto”`.
5. Verificação: transação aparece no **Extrato**; se `“Já paguei”` não estiver marcada fica **pendente** e
   **não afeta o saldo** até ser confirmada.
   [FONTE: [Como é calculado o meu saldo?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610430068123)]

### 3.4 Registar um rendimento (ganho)

1. `“+” → “Ganho”`; obrigatórios: **valor, categoria, conta, data**; opcionais: descrição, `“Já recebi”`,
   membro `[FORA DE ÂMBITO]`, `“Repetir esse ganho”`, tags. [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35592824502171)
2. `“Registrar ganho”` → disponível no Extrato.
3. Se `“Já recebi”` estiver marcado → entra no saldo; caso contrário fica pendente.
   [FONTE: [Como é calculado o meu saldo?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610430068123)]

### 3.5 Transferir entre contas

1. `“+” → transferência`. [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35611866010523)
2. Preencher **valor, descrição (opcional), conta de origem, conta de destino, data, “Já transferi”, tags**.
3. `“Registrar transferência”` → mensagem de sucesso.
4. Resultado: **dois lançamentos** (saída na origem, entrada no destino) que **não alteram ganhos nem gastos**.

### 3.6 Criar o primeiro orçamento mensal

1. Tela inicial → `“Criar Orçamento Mensal”`, ou `Controle financeiro → card de orçamento`.
   [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593494651163)
2. Definir o **valor total** do orçamento.
3. Escolher as **categorias de gastos** a incluir.
4. **Distribuir** o valor pelas categorias.
5. Escolher **duração**: só este mês ou **orçamento mensal padrão** para os meses seguintes.
6. (Opcional) Ativar **alertas** — ex.: 80% do valor de uma categoria.
7. `“Concluir limites”`.
8. Acompanhamento: totais do **mês** e do **ano** por categoria, em tempo real, no card de orçamentos.
   [FONTE: [O que é a ferramenta de orçamentos?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610172368667)]

### 3.7 Criar e alimentar um objetivo

1. `Perfil → Objetivos → “+ Outro objetivo”` (ou meta pré-definida). [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593908723355)
2. **Nomear** → `“Ir para o valor”`.
3. Informar **valor total** e **valor já reservado** → `“Ir para data de conclusão”`.
4. Definir **data de conclusão** → o app **calcula o esforço por período**.
5. Configurar **lembretes** (frequência de aporte, alerta de prazo).
6. `“Salvar objetivo”`.
7. Alimentar: no detalhe do objetivo registar **depósito**/**resgate** (escolhendo transação existente ou
   criando nova) — ou no detalhe de uma transação, campo `“Objetivos”`, escolher o objetivo.
8. Acompanhar: valor acumulado, data final, **gráfico de evolução**, histórico de movimentações;
   3 pontos → `Editar / Concluir / Excluir / Registrar resgate / Ajustar rendimentos`.
   [FONTE: [O que é a ferramenta de Objetivos?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35615605707163)]
9. Limites: apenas **movimentações passadas ou do mês atual**; recorrentes/parceladas entram **como únicas**.

### 3.8 Comprar a prestações no cartão

1. `“+” → Gasto` → valor, nome, categoria, forma de pagamento **Crédito**, cartão. [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54675849794203)
2. Escolher **Parcelado** e o **número de parcelas**.
3. Responder `“Qual é o mês da fatura?”` (fatura da 1.ª parcela).
4. `“Registrar gasto”` → parcelas seguintes entram automaticamente nas faturas seguintes.
5. ⚠️ Se algo estiver errado: **não é possível editar** — apagar e recriar (aviso
   `“Não é possível editar parcelamento manual”`).

### 3.9 Pagar a fatura do cartão

1. `Cartão de Crédito → 3 pontos → “Pagar fatura”` (ou tocar na fatura dentro do cartão).
   [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593174621083)
2. Preencher **valor pago, conta de origem, data do pagamento, descrição (opcional)** → `“Confirmar”`.
3. Verificar no **Extrato**: aparece como **crédito/“ganho”** técnico — se poluir a análise, marcar
   **“Ignorar Transação”**. [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35615686421019)
4. Efeitos: pagamento total → próxima fatura começa em R$ 0,00; pagamento parcial → restante
   transferido para a fatura seguinte; pagamento antes do fecho → **antecipação**, cartão continua
   `“Aberto”` até ~10 dias antes do vencimento.

### 3.10 Fechar o mês (revisão)

`[INFERÊNCIA]` O produto **não tem um “fecho de mês” formal** (não existe artigo). O procedimento que a
própria empresa recomenda é uma **rotina**:

> *“Lance os gastos diariamente, confira categorização e faturas abertas uma vez por semana, e revise
> **resumo, projeção e patrimônio** uma vez por mês.”*
> [FONTE: [Como usar o app para controlar 100% das minhas finanças?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680210954395)]

Fluxo prático implícito:
1. **Diário:** lançar gastos. [FONTE: idem]
2. **Semanal:** conferir categorização e faturas abertas. [FONTE: idem]
3. **Mensal:** abrir `Desempenho` (entradas/saídas e resultado do período)
   [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610246287515); abrir
   `Detalhes do saldo` para ver **projeção** [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610326600603);
   abrir `Patrimônio` para ver o **patrimônio líquido**
   [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680196652187).
4. Verificar orçamento: totais do mês e do ano por categoria
   [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610172368667).
5. Ajustar saldos divergentes com **“Travar saldo”** em vez de lançar tudo manualmente
   [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54641534088859).
6. Se for preciso levar dados para fora: **não há exportação** — usar o conector de IA ou o atendimento
   [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680203879963).

**Oportunidade clara [INFERÊNCIA]:** um **assistente de fecho de mês** nativo (checklist: transações
pendentes, faturas por pagar, orçamentos excedidos, objetivos sem aporte) é uma funcionalidade que o
original não tem e que responde diretamente à rotina que ele próprio recomenda.

---

## 4. Modelo de dados inferido

> **Aviso:** o produto **não publica o seu esquema de dados**. As entidades abaixo foram **inferidas** a
> partir dos campos, ecrãs e regras documentados. Cada tabela indica se os campos derivam de fonte
> explícita ou de `[INFERÊNCIA]`.

### 4.1 Diagrama textual de relações

```
User (1) ──< Workspace                 [FORA DE ÂMBITO]
User (1) ──< Account                   (uma marcada como principal)
User (1) ──< CreditCard
User (1) ──< Category (parent_id → Category)   system | user
User (1) ──< Tag
User (1) ──< TransactionRule
User (1) ──< Recurrence
User (1) ──< Budget ──< BudgetLimit >── Category
User (1) ──< Goal ──< GoalMovement
User (1) ──< Asset
User (1) ──< Member                    [FORA DE ÂMBITO]
User (1) ──< Subscription

Account (1) ──< Transaction
Account (1) ──< LockedBalance          ("Saldos travados")
Account (1) ──< CreditCard             (conta vinculada = conta de pagamento)

CreditCard (1) ──< Invoice (Fatura)
Invoice (1) ──< Transaction            (gastos por competência/fatura)
Invoice (1) ──< InvoicePayment         [INFERÊNCIA — o original usa uma transação-crédito]

Transaction >── Category               (categoria + subcategoria)
Transaction >── Tag[]                  (N:N)
Transaction >── Goal                   (campo "Objetivos")
Transaction ── Transaction            (par de transferência: origem ↔ destino)
Transaction ── Recurrence              (gerada por)
```
`[INFERÊNCIA]` para as cardinalidades e para a existência de `InvoicePayment` como entidade própria.

### 4.2 Entidades, campos e enums

#### `Account` (Conta / Carteira)

| Campo | Tipo | Notas | Origem |
|---|---|---|---|
| `id` | uuid | | `[INFERÊNCIA]` |
| `institution` | string | “instituição financeira” | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54641521378331) |
| `nickname` | string | “apelido” | [FONTE: idem] |
| `account_type` | enum | “tipo de conta” (valores não documentados) | [FONTE: idem] + `[INFERÊNCIA]` |
| `description` | string? | “descrição” | [FONTE: idem] |
| `initial_balance` | decimal | “saldo inicial informado ao cadastrar suas contas” | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610430068123) |
| `available_balance` | decimal | “saldo disponível” (editável) | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54641521378331) |
| `is_primary` | boolean | “Essa é minha conta principal”; **exclusivo: uma por utilizador** | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54641521378331) |
| `archived_at` | timestamp? | contas arquivadas saem do saldo e do extrato | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54214140659227) |
| `origin` | enum | `manual` \| `integrated` (Open Finance) | [FONTE: [Glossário](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680196652187)] |
| `currency` | const | **R$ fixo** no original | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/42745695987611) |

Carteira por omissão **“Minha Carteira”**: `[INFERÊNCIA]` uma `Account` com `account_type = wallet`
criada automaticamente no registo; a ela vão os lançamentos sem conta escolhida.
[FONTE: [Meu saldo está divergente…](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54675849670043)]

#### `LockedBalance` (“Saldo travado”, ajuste de saldo)

| Campo | Tipo | Notas | Origem |
|---|---|---|---|
| `account_id` | fk | conta ajustada | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54641534088859) |
| `reference_date` | date | “data de referência” | [FONTE: idem] |
| `reported_balance` | decimal | “qual era o saldo real naquela data” | [FONTE: idem] |
| `computed_balance` | decimal | saldo calculado pelo sistema na data | `[INFERÊNCIA]` |
| `adjustment` | decimal | “o app calcula a diferença e cria o ajuste automaticamente” | [FONTE: idem] |
| `created_at` | timestamp | listado em “Saldos travados” | [FONTE: idem] |

#### `CreditCard`

| Campo | Tipo | Notas | Origem |
|---|---|---|---|
| `name` | string | “Nome do cartão” | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54640095465115) |
| `payment_account_id` | fk → Account | “Conta vinculada: a conta de onde a fatura será paga” | [FONTE: idem] |
| `brand` | enum | **Visa, MasterCard, HiperCard, American Express, Elo, Outra** | [FONTE: idem] |
| `closing_day` | int | “Data de fechamento” | [FONTE: idem] |
| `due_day` | int | “vencimento da fatura” | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610978972187) |
| `monthly_limit` | decimal? | “Limite mensal (opcional)” | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54640095465115) |
| `available_limit` | decimal? | “Limite disponível” | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610978972187) |
| `annual_fee` | decimal? | “Valor de anuidade (opcional)” | [FONTE: idem] |
| `origin` | enum | `manual` \| `integrated` | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54640095465115) |
| `status` | enum | `Aberto` \| (outros não documentados) | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593174621083) |

#### `Invoice` (Fatura)

| Campo | Tipo | Notas | Origem |
|---|---|---|---|
| `card_id` | fk | | `[INFERÊNCIA]` |
| `competence_month` | month | “Competência: o mês em que a compra foi feita” | [FONTE: [Glossário](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680196652187)] |
| `closing_date` | date | “data de fechamento” | [FONTE: idem] |
| `due_date` | date | “data de pagamento” | [FONTE: idem] |
| `total_amount` | decimal | “o total de gastos no cartão em um período” | [FONTE: idem] |
| `paid_amount` | decimal | soma dos pagamentos | `[INFERÊNCIA]` |
| `carried_over` | decimal | valor restante transferido para a fatura seguinte | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593174621083) |
| `status` | enum | `Aberto` \| `Fechado` \| `Pago` `[INFERÊNCIA]` (só “Aberto” é explicitamente citado) | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593174621083) |

Regras: a **primeira fatura é criada automaticamente** com o primeiro gasto
[FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54640095465115); o status só passa a fechado
“cerca de **10 dias antes** da data de vencimento”
[FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593174621083).

#### `Category`

| Campo | Tipo | Notas | Origem |
|---|---|---|---|
| `name` | string | | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610890624539) |
| `kind` | enum | `expense` \| `income` (listas distintas no original) | [FONTE: idem] |
| `parent_id` | fk → Category? | subcategorias | [FONTE: idem] |
| `is_internal` | boolean | **Interna / Fatura / Investimento** — fora do cálculo de ganhos e gastos | [FONTE: [Glossário](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680196652187)] |
| `is_system` | boolean | categorias do sistema **não podem ser editadas nem apagadas** | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/40534935060123) |

Valores iniciais: ver 2.4 (17 categorias de gasto + 8 de ganho).

#### `Transaction`

| Campo | Tipo | Obrigatório | Origem |
|---|---|---|---|
| `kind` | enum `expense` \| `income` \| `transfer` | Sim | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35592699159707) · [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35611866010523) |
| `amount` | decimal | Sim | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35592699159707) |
| `date` | date | Sim | [FONTE: idem] |
| `description` | string? | Não (“Descrição”) | [FONTE: idem] |
| `category_id` | fk → Category | Sim (gasto/ganho) | [FONTE: idem] |
| `subcategory_id` | fk → Category? | Opcional (“deixar o campo em branco… não impede a organização”) | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35611021770651) |
| `account_id` | fk → Account | Sim (gasto/ganho/transferência) | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35592699159707) |
| `card_id` | fk → CreditCard? | Sim se crédito | [FONTE: idem] |
| `invoice_id` | fk → Invoice? | Sim se crédito (“Fatura”) | [FONTE: idem] |
| `payment_method` | enum `debit` \| `credit` | Sim | [FONTE: idem] |
| `payment_condition` | enum `single` \| `installment` \| `recurring` | Sim | [FONTE: idem] |
| `installment_count` | int? | Se parcelado | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54675849794203) |
| `settled` | boolean | `“Já paguei”` / `“Já recebi”` → “Consolidada” | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35592699159707) |
| `status` | enum `pending` \| `confirmed` \| `ignored` | “Pendente”, “confirmadas”, “Ignorada” | [FONTE: [Glossário](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680196652187)] · [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35612043640475) |
| `tag_ids` | N:N → Tag | Opcional, múltiplas (“quantas tags quiser”) | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610801539355) |
| `member_id` | fk → Member? | `[FORA DE ÂMBITO]` | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35611924835483) |
| `goal_id` | fk → Goal? | Campo `“Objetivos”` | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35615605707163) |
| `recurrence_id` | fk → Recurrence? | Gerada por recorrência | `[INFERÊNCIA]` |
| `counterpart_transaction_id` | fk → Transaction? | Par da transferência (saída ↔ entrada) | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35611866010523) |
| `origin` | enum `manual` \| `imported` \| `recurrence` | | `[INFERÊNCIA]` |
| `computed_month` | month | Derivado de `date`; mês de calendário fixo (1 → 30/31) | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/42745902816283) |

#### `Recurrence`

| Campo | Tipo | Notas | Origem |
|---|---|---|---|
| `name` | string | “com base em nome, valor e frequência” | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680210829723) |
| `amount` | decimal | idem | [FONTE: idem] |
| `frequency` | enum | valores não documentados → `[NÃO ENCONTRADO]` | — |
| `template_transaction` | referência | criada a partir de uma transação existente | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/40282064756379) |

#### `TransactionRule`

| Campo | Tipo | Notas | Origem |
|---|---|---|---|
| `name` | string | **obrigatório** | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/53292545975067) |
| `kind` | enum `income` \| `expense` | “Selecione o tipo: Ganhos ou Gastos” | [FONTE: idem] |
| `description_contains` | string? | palavra-chave + busca **“Similar”** | [FONTE: idem] |
| `document` | string? | “CNPJ/CPF” | [FONTE: idem] |
| `amount_min` / `amount_max` | decimal? | “Valores entre” | [FONTE: idem] |
| `day_min` / `day_max` | int? | “Entre os dias” (intervalo de dias do mês) | [FONTE: idem] |
| `account_id` / `card_id` | fk? | “Conta/Cartão” | [FONTE: idem] |
| `target_category_id` | fk → Category | “Escolha a categoria de destino” | [FONTE: idem] |
| Restrição | — | “é necessário preencher **pelo menos uma**” condição | [FONTE: idem] |

#### `Budget` e `BudgetLimit`

| Entidade | Campo | Tipo | Notas | Origem |
|---|---|---|---|---|
| `Budget` | `total_amount` | decimal | “Defina o valor total do orçamento” | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593494651163) |
| `Budget` | `scope` | enum `single_month` \| `monthly_default` | “Apenas para este mês” ou “Fixar como orçamento mensal padrão” | [FONTE: idem] |
| `Budget` | `period` | month | mês/ano do orçamento | `[INFERÊNCIA]` |
| `BudgetLimit` | `category_id` | fk → Category | distribuição por categoria | [FONTE: idem] |
| `BudgetLimit` | `amount` | decimal | ex.: Alimentação R$ 800 | [FONTE: idem] |
| `BudgetLimit` | `alert_threshold_pct` | int? | ex.: **80%** | [FONTE: idem] |
| `BudgetLimit` | `alerts_enabled` | boolean | “Ative os alertas de controle de gastos (opcional)” | [FONTE: idem] |

#### `Goal` e `GoalMovement`

| Entidade | Campo | Tipo | Notas | Origem |
|---|---|---|---|---|
| `Goal` | `name` | string | ex.: “Férias na praia” | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593908723355) |
| `Goal` | `is_preset` | boolean | “meta pré-definida” vs personalizada | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35615605707163) |
| `Goal` | `target_amount` | decimal | “valor total do objetivo” | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593908723355) |
| `Goal` | `initial_reserved` | decimal | “valor já reservado (se houver)” | [FONTE: idem] |
| `Goal` | `accumulated_amount` | decimal | “valor já acumulado” | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35615605707163) |
| `Goal` | `target_date` | date | “data de conclusão” (ajustável) | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593908723355) |
| `Goal` | `contribution_frequency` | enum | “mensal, semanal etc.” | [FONTE: idem] |
| `Goal` | `deadline_alert` | boolean | “alerta quando estiver próximo do prazo final” | [FONTE: idem] |
| `Goal` | `state` | enum `active` \| `completed` | ação “Concluir” | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35615605707163) |
| `GoalMovement` | `goal_id` | fk | | [FONTE: idem] |
| `GoalMovement` | `type` | enum `deposit` \| `withdrawal` \| `yield` | “depósitos, resgates, rendimentos” | [FONTE: idem] |
| `GoalMovement` | `amount` | decimal | | `[INFERÊNCIA]` |
| `GoalMovement` | `date` | date | só passado ou mês atual | [FONTE: idem] |
| `GoalMovement` | `transaction_id` | fk → Transaction? | “selecionar uma transação existente” | [FONTE: idem] |

#### `Tag`

| Campo | Tipo | Notas | Origem |
|---|---|---|---|
| `name` | string | ex.: `#viagemRJ` | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610801539355) |
| Relação | N:N com Transaction | “quantas tags quiser” | [FONTE: idem] |
| `color` | string? | `[NÃO ENCONTRADO]` — não documentado | — |

#### `Asset` (Bens)

| Campo | Tipo | Notas | Origem |
|---|---|---|---|
| `type` | enum `vehicle` \| `property` | “como veículos e imóveis” | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54641566798107) |
| `description` | string | `[INFERÊNCIA]` | — |
| `value` | decimal | `[INFERÊNCIA]` | — |
| Menu | — | web: `Meus bens`; app: iniciais → `Meus bens` → registrar bens | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54641566798107) |

`[NÃO ENCONTRADO]` lista completa de campos de um bem.

#### `Debt` e `Investment` — `[FORA DE ÂMBITO]`, só via Open Finance

| Entidade | Estado | Origem |
|---|---|---|
| `Debt` | mostra operações formais (empréstimos, financiamentos); **sem cadastro manual**; detalhe de contratos/saldo devedor/parcelas/taxas **em desenvolvimento** | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54641577264155) |
| `Investment` | entrada automática via Open Finance; **sem lançamento manual**; sem detalhe por ativo | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54675828123419) |

#### `User`, `Subscription`, `Workspace`, `Member`, `MCPConnection`

| Entidade | Campos conhecidos | Origem |
|---|---|---|
| `User` | nome completo, e-mail, senha (hash), provedor social (`Apple`/`Google`), *token de segurança*, biometria ativa, tema, `primary_account_id` | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593326940571) · [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35590937576859-Cadastro-e-Conta) |
| `Subscription` | plano (`monthly` R$ 24,90 / `annual` R$ 199,90), loja (`google_play`/`app_store`), renovação automática, estado | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35615401810715) |
| `Workspace` | nome, elementos visíveis na página inicial, associada à conta, ilimitadas — `[FORA DE ÂMBITO]` | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54213018161947) |
| `Member` | nome (ex.: “Lucas”, “Filho”, “Casa”), iniciais — `[FORA DE ÂMBITO]` | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610319457947) |
| `MCPConnection` | assistente (Claude/ChatGPT/Grok/Perplexity), OAuth, revogável | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680197324443) |

### 4.3 Enums consolidados

| Enum | Valores | Origem |
|---|---|---|
| `PaymentMethod` | `debit`, `credit` | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35592699159707) |
| `PaymentCondition` | `single` (único), `installment` (parcelado), `recurring` (recorrente) | [FONTE: idem] |
| `TransactionStatus` | `pending`, `confirmed`, `ignored` | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35612043640475) |
| `SettlementFlag` | `“Já paguei”`, `“Já recebi”` → consolidada | [FONTE: [Glossário](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680196652187)] |
| `CardBrand` | Visa, MasterCard, HiperCard, American Express, Elo, Outra | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54640095465115) |
| `CategoryKind` | ganhos \| gastos | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610890624539) |
| `InternalCategory` | Interna, Fatura, Investimento | [FONTE: [Glossário](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680196652187)] |
| `GoalMovementType` | depósito, resgate, rendimento | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35615605707163) |
| `BudgetScope` | só este mês \| padrão mensal | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593494651163) |
| `AccountOrigin` | manual, integrada | [FONTE: [Glossário](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680196652187)] |
| `InvoiceStatus` | “Aberto” (+ valores não documentados) | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593174621083) |
| `AssetType` | veículo, imóvel | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54641566798107) |

### 4.4 Índices e restrições inferidos `[INFERÊNCIA]`

- `Account.is_primary` — restrição de **unicidade parcial** por utilizador.
- `Category.is_system = true` — bloqueio de UPDATE/DELETE.
- `Transaction` filtrado por `status` e `computed_month` — índices compostos em
  `(user_id, computed_month, kind, status)` para desempenho do extrato e dos orçamentos.
- `Tag` — índice único em `(user_id, lower(name))`.
- **Transferências** devem ser atómicas (par de lançamentos) e nunca entrar em agregações de
  resultado; o mesmo para **categorias internas**.
- `GoalMovement` — restrição temporal: `date <= mês atual`.

---

## 5. Cálculos e regras financeiras

### 5.1 Saldo de uma conta

> **Fórmula oficial:** `Saldo atual = Saldo inicial + Total de Ganhos (recebidos) − Total de Gastos (pagos)`
> Exemplo da fonte: `R$ 2.000 + R$ 3.500 − R$ 2.800 = R$ 2.700`.
> [FONTE: [Como é calculado o meu saldo?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610430068123)]

| Regra | Efeito |
|---|---|
| Critério | **Visão caixa**: conta quando o dinheiro realmente entra/sai [FONTE: [Como é calculado meu resultado mensal?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610239079067)] |
| Contas arquivadas | **Excluídas** do saldo [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610430068123) |
| Transações não pagas/recebidas | **Não entram** até serem confirmadas [FONTE: idem] |
| Transferências | Não alteram o total (saída + entrada anulam-se) [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35611866010523) |
| Categorias internas | Fora do cálculo de ganhos e gastos reais [FONTE: [Glossário](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680196652187)] |
| Transações ignoradas | Não somam [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35611907399835) |
| **Ajuste de saldo** | `diferença = saldo_real_informado − saldo_calculado_na_data`; o app cria o lançamento de ajuste (`[INFERÊNCIA]` sobre a mecânica contabilística: gera transação de ajuste, não altera lançamentos antigos) [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54641534088859) |
| Saldo total do app | soma das contas não arquivadas; detalhe por conta em `“Detalhes do saldo”` [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610326600603) |
| Projeção futura | “Projeções de saldo **futuro** com base nas transações agendadas” [FONTE: idem] |

### 5.2 Resultado mensal (entradas − saídas)

> **Fórmula oficial:** `Resultado = Total de Entradas (ganhos) − Total de Saídas (gastos)`, em **visão caixa**.
> Exemplo: R$ 3.500 − R$ 3.000 = **+R$ 500**. Se negativo, “está gastando mais do que ganha”.
> Regra crítica do cartão: *“Se você comprou algo em novembro no cartão de crédito, a despesa só será
> contabilizada quando pagar a fatura, mesmo que isso ocorra em dezembro.”*
> [FONTE: [Como é calculado meu resultado mensal?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610239079067)]

**Implicação para a nossa versão `[INFERÊNCIA]`:** a **visão caixa** é a única que o original implementa.
Muitos utilizadores raciocinam por **competência**. Devemos suportar **ambas** com um seletor explícito —
é uma melhoria de alto valor e baixo custo.

### 5.3 Percentagens e alertas de orçamento

| Cálculo | Definição | Origem |
|---|---|---|
| Consumo por categoria | `gasto_categoria_no_periodo / limite_categoria` | `[INFERÊNCIA]` a partir de “limites para cada categoria” + “total gasto no mês e no ano por categoria” [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610172368667) |
| Alerta | dispara ao atingir percentual configurado (exemplo oficial: **80%**) | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593494651163) |
| Verificação | “acompanhar gastos **em tempo real**, não apenas históricos” → cálculo incremental a cada transação | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610172368667) |
| Âmbito temporal | total do **mês** e do **ano** por categoria | [FONTE: idem] |
| Critério de contagem (competência vs caixa) | **`[NÃO ENCONTRADO]`** — não documentado; ambiguidade real | — |
| Comportamento ao exceder 100% | **`[NÃO ENCONTRADO]`** | — |

### 5.4 Progresso de objetivos

| Cálculo | Definição | Origem |
|---|---|---|
| Progresso | `valor_acumulado / valor_total` — mostrado como “valor total e valor já acumulado” + “gráfico de evolução” | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35615605707163) |
| Esforço necessário | *“o app calcula automaticamente quanto você precisa guardar por período”* a partir de valor total, valor já reservado e data de conclusão | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593908723355) |
| `[INFERÊNCIA]` fórmula provável | `aporte_por_periodo = (valor_total − valor_reservado) / nº_periodos_entre_hoje_e_data_final`, com `nº_periodos` derivado da frequência escolhida (mensal/semanal) | — |
| Rendimentos | ajustáveis manualmente (“Ajustar rendimentos”); entram no acumulado | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35615605707163) |
| Restrição temporal | apenas movimentações **passadas ou do mês atual** | [FONTE: idem] |
| Recorrências/parcelamentos | entram **como movimento único** (não geram aportes futuros automáticos) | [FONTE: idem] |

### 5.5 Fatura e cartão

| Cálculo / regra | Definição | Origem |
|---|---|---|
| Total da fatura | “o total de gastos no cartão de crédito em um período, com data de fechamento e de pagamento” | [FONTE: [Glossário](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680196652187)] |
| Competência vs vencimento | “o mês em que a compra foi feita, que pode ser diferente do mês em que a fatura vence” | [FONTE: idem] |
| Pagamento parcial | `fatura_seguinte = total − pago` (“o valor restante será transferido para a próxima fatura”) | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593174621083) |
| Pagamento total | próxima fatura = **R$ 0,00** | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35615686421019) |
| Pagamento antecipado | tratado como **antecipação**; cartão permanece `“Aberto”` até ~**10 dias antes** do vencimento | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593174621083) |
| Parcelamento | N parcelas distribuídas uma por fatura, a partir do mês indicado | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54675849794203) |
| Encargos/juros | No exemplo de pagamento parcial, a fonte menciona “possíveis encargos e juros” na fatura seguinte, mas **não** descreve como são calculados → `[NÃO ENCONTRADO]` | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35615686421019) |
| Pagamento gera “crédito” | o pagamento de fatura entra no extrato como crédito/ganho técnico; recomendação oficial é marcá-lo como **ignorado** | [FONTE: idem] |

### 5.6 Património líquido

> **Fórmula oficial:** `Patrimônio líquido = ativos − passivos`, onde **ativos** = saldos em conta +
> investimentos + bens, e **passivos** = faturas abertas + dívidas formais.
> [FONTE: [Glossário](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680196652187)]

| Componente | Inclui | Origem |
|---|---|---|
| Ativos | saldos em conta, investimentos, bens (veículos, imóveis) | [FONTE: idem] |
| Passivos | faturas **abertas** do cartão, dívidas formais | [FONTE: idem] |
| Excluído | contas arquivadas (saem do saldo) | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54214140659227) |

`[INFERÊNCIA]` Não é documentado se os bens são valorizados automaticamente (depreciação) ou por valor
manual fixo; nem se há histórico de património ao longo do tempo.

### 5.7 Categorização automática (algoritmo)

`[INFERÊNCIA]` com base nas condições documentadas:

```
para cada transação:
    para cada regra do utilizador (tipo = transação.kind):
        se (regra.descrição matches transação.descrição  [opção "Similar"])
        ou (regra.CNPJ/CPF == transação.contraparte)
        ou (regra.valor_min <= transação.valor <= regra.valor_max)
        ou (regra.dia_min <= dia(transação.data) <= regra.dia_max)
        ou (regra.conta/cartão == transação.conta/cartão):
            aplicar regra.target_category
```

**Lacunas:** ordem/precedência entre regras, reaplicação retroativa, desativação e conflitos são
`[NÃO ENCONTRADO]`. O produto oferece **pré-visualização** (`“Ver transações identificadas”`), o que
sugere aplicação **a posteriori** sobre transações existentes
[FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/53292545975067).

### 5.8 Regras transversais (a replicar em qualquer cálculo)

| Regra | Efeito nos cálculos | Origem |
|---|---|---|
| Mês de calendário fixo (dia 1 → 30/31), não configurável | Agregações mensais e orçamentos | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/42745902816283) |
| Moeda única (R$), não configurável | Sem conversão cambial | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/42745695987611) |
| Categorias internas (Interna, Fatura, Investimento) | Nunca entram em ganhos/gastos reais | [FONTE: [Glossário](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680196652187)] |
| Transferências | Par neutro; nunca entram no resultado | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35611866010523) |
| Estado `ignored` | Excluído de ganhos/gastos, visível no histórico | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35611907399835) |
| Estado `pending` | Excluído do saldo até confirmação | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610430068123) |
| Contas arquivadas | Excluídas do saldo | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54214140659227) |

---

## 6. Pontos fracos de UX e limitações relatados

### 6.1 Limitações funcionais confirmadas pela própria documentação

| # | Limitação | Impacto | Fonte |
|---|---|---|---|
| L1 | **Sem exportação CSV/PDF** — “ainda não tem um botão de exportar que gera arquivo em CSV ou PDF”; registado como pedido de melhoria | Aprisionamento de dados; sem contabilidade externa | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680203879963) |
| L2 | **Parcelamento manual não editável** — aviso “Não é possível editar parcelamento manual”; corrigir obriga a apagar e recriar | Erro do utilizador é caro e propaga-se pelas faturas | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54675849794203) |
| L3 | **Sem cadastro manual de dívidas**; detalhe de contratos/saldo devedor/parcelas/taxas “em desenvolvimento” | Não se consegue planear o pagamento de dívidas | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54641577264155) |
| L4 | **Sem lançamento manual de investimentos**; detalhe por ativo inexistente | Património incompleto para quem não liga o banco | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54675828123419) |
| L5 | **Moeda fixa em R$**, não alterável | Inutilizável fora do Brasil | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/42745695987611) |
| L6 | **Início do mês fixo** no dia 1, não configurável | Não cobre quem recebe a meio do mês (realidade muito comum) | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/42745902816283) |
| L7 | **Multiusuário inexistente**; única alternativa é partilhar login, o que a empresa desaconselha | Bloqueia uso familiar real | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680188601243) |
| L8 | **Categorias de sistema não editáveis nem apagáveis** | Não se adapta ao vocabulário do utilizador | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/40534935060123) |
| L9 | **Migração incompleta** — não migra recorrências, parcelamentos, categorias nem contas inativas | Perda silenciosa de planeamento futuro | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/49967806140315) |
| L10 | **Objetivos só aceitam movimentos passados ou do mês atual**; recorrentes/parceladas entram “como únicas” | Quebra a automatização de poupança | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35615605707163) |
| L11 | **Lançamento vai para “Minha Carteira”** se a conta não for escolhida | Fonte nº 1 de divergências de saldo, segundo a própria FAQ | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54675849670043) |
| L12 | **Pagamento de fatura lançado como “ganho”** | Polui entradas; solução é o utilizador marcar “Ignorar” | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35615686421019) |
| L13 | **Contas migradas com saldo desatualizado** (defeito assumido) | Desconfiança no saldo | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54675849670043) |
| L14 | **Assinatura 100% dependente da loja** (cobrança, reembolso, reativação); existe artigo para falha de ativação no iOS | Atrito de suporte; comissões | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/45806869923227) · [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/categories/35590959417371-Assinatura-Meu-Clube) |
| L15 | **Sessão expira com frequência** — artigo dedicado (“O app desloga com frequência…”) | Fricção diária | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/sections/35610346042779-Funcionalidade-membros-aplicativo) |
| L16 | **Sem notificações documentadas** (canais, horários, preferências) | Alertas existem mas a gestão é uma caixa negra | `[NÃO ENCONTRADO]` (pesquisa “notificação” → 0 resultados) |
| L17 | **Sem importação OFX/CSV** | Quem já tem dados noutro sistema não os traz | `[NÃO ENCONTRADO]` (pesquisa “OFX” → 0 resultados) |
| L18 | **Sem relatórios agregados por período** (trimestre/ano), só mensal e por categoria | Análise limitada | `[NÃO ENCONTRADO]` na secção de funcionalidades/relatórios |

### 6.2 Limitações relatadas por utilizadores

| Limitação relatada | Detalhe | Fonte |
|---|---|---|
| Erros de saldo e **desaparecimento de contas** | “Aplicativo de finanças com erros de saldo e desaparecimento de contas, sem resolução após contato com suporte” | [FONTE: Reclame Aqui — reclamação](https://www.reclameaqui.com.br/minhas-economias/aplicativo-de-financas-com-erros-de-saldo-e-desaparecimento-de-contas-sem-resolucao-apos-contato-com-suporte_ATQYaJHBBJqZuRDR/) |
| **Não atualiza lançamentos** + dificuldade de cancelamento/reembolso | “Aplicativo não funciona, não atualiza lançamentos e solicitação de cancelamento e devolução do valor pago” | [FONTE: Reclame Aqui — reclamação](https://www.reclameaqui.com.br/minhas-economias/aplicativo-nao-funciona-nao-atualiza-lancamentos-e-solicitacao-de-cancelamento-e-devolucao-do-valor-pago_C4gGDdKAOZpbGqVT/) |
| “Aplicativo bugado” | Reclamação listada com este título | [FONTE: Reclame Aqui — reclamação](https://www.reclameaqui.com.br/minhas-economias/aplicativo-bugado_2wO_BxNtAQ4LhPDs/) |
| Taxa de resolução | “Resolve **70,1%** das reclamações” (o que implica ~30% sem resolução) | [FONTE: Reclame Aqui — lista de reclamações](https://www.reclameaqui.com.br/empresa/minhas-economias/lista-reclamacoes/) |
| Nota média | App Store BR **4,6**/5 (58 mil classificações); Google Play **4,2**/5 | [FONTE: App Store](https://apps.apple.com/br/app/minhas-economias/id520869873) · [FONTE: Google Play](https://play.google.com/store/apps/details?id=com.minhaseconomias&hl=pt-BR) |
| Perceção de que a app é “100% gratuita” | Comparativos descrevem “O aplicativo Minhas Economias é 100% gratuito”, o que **contradiz** o modelo Meu Clube — indica comunicação pouco clara do *paywall* | [FONTE: my-best](https://br.my-best.com/18262) (excerto de resultado de pesquisa) vs [FONTE: preços Meu Clube](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35615401810715) |

> **Nota de rigor:** os textos integrais das reclamações do Reclame Aqui não foram acessíveis
> (páginas com carregamento dinâmico); foram confirmados **títulos, existência e URLs**. Os detalhes
> internos de cada caso são `[NÃO ENCONTRADO]`.

### 6.3 Padrões de UX problemáticos inferidos

`[INFERÊNCIA]` com base nas regras documentadas:

1. **Formulário único longo e com scroll** para registar uma despesa (7 campos obrigatórios, incluindo
   ordem “conta/cartão” que, se não percorrida, produz um destino errado) → erro humano sistemático.
2. **Correção em vez de prevenção:** erros estruturais (parcelamento, pagamento de fatura, categorias de
   sistema) devolvem ao utilizador a tarefa de contornar com *workarounds* (“Ignorar transação”,
   “apagar e recriar”).
3. **Vocabulário instável entre plataformas** (`Patrimônio` vs `Meu Patrimônio`).
4. **Ausência de estados vazios/onboarding** documentados — nenhum artigo de “primeiros passos”.
5. **Ausência de “fecho de mês”** apesar de a própria empresa recomendar uma rotina mensal.
6. **Duas “experiências” concorrentes** com migração unilateral e não sincronizada — o maior risco de
   confiança do produto.

---

## 7. O que a análise permite concluir para o nosso produto

| Conclusão | Base |
|---|---|
| O núcleo replicável e de maior valor **não depende de banco** | Secções 2.1–2.14, 2.19 |
| O modelo de dados do original é **relacional e simples**, com dois pontos de modelação frágeis: pagamento de fatura como “ganho” e ausência de `Debt`/`Investment` manuais | 4.2, 5.5 |
| A **visão caixa** domina todos os cálculos e é a única implementada | 5.1–5.2 |
| A **exportação** e a **importação de ficheiros** são as lacunas mais citáveis do original | 6.1 (L1, L17) |
| **Multiusuário, Open Finance, workspaces e apps nativos** podem sair sem perda de núcleo | Decisão do cliente + secção 8 |
| O original serve de referência funcional, **não de referência visual** (interface é de app móvel de 2013–2020, com duas gerações coexistentes) | 1.6, 2.23, `[INFERÊNCIA]` |

---

## 8. Funcionalidades fora de âmbito

> Decisões aprovadas pelo cliente (transmitidas pelo Lead). Estas funcionalidades **continuam mapeadas**
> nas secções acima porque é útil saber o que fazem; **não serão implementadas** na nova versão.

| # | Funcionalidade do original | Decisão | Justificação / impacto |
|---|---|---|---|
| F1 | **Integração bancária / Open Finance** (conexão automática de contas, cartões, dívidas, investimentos; atualização diária; fluxo OAuth + CPF + código por e-mail) | **FORA DE ÂMBITO** | Dispensada explicitamente pelo cliente [FONTE: [Como conectar uma conta bancária via Open Finance?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35592567734683)] |
| F2 | **Módulo Dívidas** (só existe via Open Finance; sem cadastro manual) | **FORA**, mas substituir por **passivos manuais** | Sem Open Finance a secção ficaria vazia [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54641577264155) |
| F3 | **Módulo Investimentos** (só via Open Finance; sem lançamento manual) | **FORA**, mas prever **conta/ativo manual** | [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54675828123419) |
| F4 | **Multiusuário real / partilha de conta** (não existe no original; só login partilhado) | **FORA DE ÂMBITO** | Cliente: utilizador único com login simples [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680188601243)] |
| F5 | **Membros** (perfis de pessoas para atribuir transações) | **FORA DE ÂMBITO** | Depende conceptualmente de uso familiar [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610319457947) |
| F6 | **Workspaces personalizadas** (múltiplos perfis de dashboard) | **FORA DE ÂMBITO** | Evitar complexidade; possível evolução futura [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54213018161947) |
| F7 | **Moeda BRL / idioma pt-BR** | **Substituir** por **EUR + pt-PT** | Decisão do cliente; note-se que no original a moeda é fixa e não configurável [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/42745695987611) |
| F8 | **Apps nativas iOS/Android/macOS** | **FORA**; apenas **PWA instalável** | Decisão do cliente; o original usa recursos nativos (biometria Face ID/Touch ID, partilha pela App Store) [FONTE: [Cadastro e Conta — categoria](https://faq.minhaseconomias.com.br/hc/pt-br/categories/35590937576859-Cadastro-e-Conta)] |
| F9 | **Assinatura “Meu Clube”** com cobrança pelas lojas | **FORA** (não replicar o mecanismo) | Sem apps nativas nem Open Finance, o paywall do original perde objeto; se houver monetização, deve ser própria (não via loja) [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35615401810715) |
| F10 | **Conector MCP / ChatGPT, Claude, Grok, Perplexity** | **Fora do núcleo** (opcional, fase posterior) | Exige serviço adicional autenticado [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680197324443) |
| F11 | **Login social Apple/Google** | **Fora** (não é necessário) | Cliente pediu login simples [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593326940571) |
| F12 | **Migração da experiência antiga** | **Fora** (não aplicável) | Conceito específico do original [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/49967806140315) |
| F13 | **Contas PJ / ligação a pessoa jurídica** | **Fora** | Fora do foco pessoal; artigo existente mas não consultado [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/sections/35587261331099-Perguntas-frequentes) |

### 8.1 Núcleo confirmado (dentro de âmbito, por prioridade de detalhe)

| Prioridade | Módulo | Porque é prioritário |
|---|---|---|
| P0 | Contas manuais + saldo + ajuste de saldo | Base de tudo; o “travar saldo” do original é uma boa ideia a manter |
| P0 | Transações (gasto/ganho/transferência) + estados (pendente/confirmada/ignorada) | Núcleo transacional |
| P0 | Categorias e subcategorias (com categorias internas) | Estrutura de toda a análise |
| P0 | Orçamentos mensais por categoria com alertas | Valor percebido mais alto |
| P0 | Objetivos com movimentos e cálculo de esforço | Diferenciador emocional |
| P1 | Cartões manuais + faturas + parcelamentos (editáveis!) | Necessário para a realidade PT |
| P1 | Recorrências | Automação de lançamentos |
| P1 | Regras de categorização automática com pré-visualização | Poupança de tempo |
| P1 | Relatórios: extrato com filtros, por categoria, evolução e projeção de saldo | Análise |
| P1 | Bens e património líquido | Visão global |
| P2 | Tags | Baixo custo, alto valor analítico |
| P2 | Importação OFX/CSV e exportação CSV/PDF | **Funcionalidade nova nossa** (não existe no original) |
| P2 | Passivos manuais (substituto de Dívidas) | Cobre a lacuna deixada pelo Open Finance |
| P3 | Dashboard configurável (utilizador único) | Substitui “workspaces” sem a complexidade |

---

## 9. Cinco melhorias concretas face ao sistema original

> Estas são as cinco oportunidades de maior impacto encontradas na análise, todas justificadas por
> limitações documentadas do original (secção 6).

### M1 — Importação e exportação de dados de primeira classe

O original **não exporta** (“não tem um botão de exportar que gera arquivo em CSV ou PDF” —
[FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680203879963)) e **não importa** OFX/CSV
(pesquisa por “OFX” na central de ajuda → **0 resultados**).
**Melhoria:** importação de extratos **OFX/CSV** com assistente de mapeamento, deteção de duplicados e
**pré-visualização**, mais **exportação CSV/PDF/XLSX** de qualquer vista filtrada. Isto resolve
portabilidade, migração de outros sistemas e confiança — e é simultaneamente o pedido explícito do
cliente (importação OFX/CSV como núcleo).

### M2 — Motor financeiro explícito: competência **e** caixa, com mês configurável

O original implementa **apenas** visão caixa
([FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610239079067)), tem o **mês fixo no dia 1**
sem possibilidade de alteração ([FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/42745902816283))
e **não documenta** sequer se o orçamento consome por competência ou caixa.
**Melhoria:** um único motor de cálculo que suporta **dois regimes** (competência/caixa) com seletor
visível no dashboard, **início do mês configurável** (ex.: dia do salário) e **regras documentadas e
testáveis**. Elimina a principal ambiguidade do sistema de referência e adapta-se à realidade portuguesa
(subsídios, recibos verdes, vencimento a meio do mês).

### M3 — Edição integral de parcelamentos e séries recorrentes

O original bloqueia: *“depois de criado, um parcelamento manual **não pode ser editado**”*
([FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54675849794203)). Objetivos também só aceitam
movimentos passados/do mês atual e tratam recorrentes “como únicas”
([FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35615605707163)).
**Melhoria:** séries de primeira classe — editar **valor total, nº de parcelas, data da primeira parcela e
descrição**, propagando às parcelas futuras e às faturas afetadas, com opção “aplicar a esta parcela /
a todas as seguintes”; reagendamento de recorrências; e **movimentos futuros de objetivo** gerados
automaticamente a partir da recorrência.

### M4 — Pagamento de fatura como operação de primeira classe (sem “workarounds”)

No original, o pagamento da fatura é registado como **“crédito”/ganho**, “não é um ganho real” e “pode
confundir seu controle financeiro”, com a solução oficial a ser o utilizador marcar a transação como
**“Ignorar Transação”**
([FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35615686421019)).
O mesmo problema existe nas **transferências** e nas **categorias internas**.
**Melhoria:** tipos de operação nativos (`INVOICE_PAYMENT`, `TRANSFER`, `GOAL_DEPOSIT`, `BALANCE_ADJUST`)
com **efeito contabilístico definido** — aparecem no extrato mas **nunca** contaminam entradas/saídas —,
pagamento **parcial** explícito com arrasto automático para a fatura seguinte e cálculo de encargos.
O utilizador deixa de precisar de “ignorar” transações para obter números certos.

### M5 — Assistente de fecho de mês e análise multi-período

O original **não tem** fecho de mês; recomenda ao utilizador uma rotina manual (“revise resumo, projeção e
patrimônio uma vez por mês” — [FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680210954395)),
não tem relatórios agregados por período e não tem recomendações acionáveis (as “dicas personalizadas” são
benefício do plano pago, sem detalhe público —
[FONTE](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35615315682587)).
**Melhoria:** um **assistente de fecho de mês** com checklist acionável (transações pendentes, faturas por
pagar, orçamentos excedidos, objetivos sem aporte, faturas a vencer) e **análise multi-período**
(comparação mês a mês, tendência por categoria, média de 3/6/12 meses, projeção de fim de mês com base no
ritmo real de gasto). Transforma a app de *registo* em *aconselhamento*.

---

## 10. Lacunas de informação (o que não foi encontrado)

Registo explícito para evitar invenção, e como pista do que teremos de **decidir nós**:

| Ponto | Estado |
|---|---|
| Importação OFX/CSV | `[NÃO ENCONTRADO]` — pesquisa “OFX” na FAQ: 0 resultados |
| Notificações: canais (push/e-mail), horários, preferências, desativação | `[NÃO ENCONTRADO]` — pesquisa “notificação”: 0 resultados |
| Alerta de fatura a vencer | `[NÃO ENCONTRADO]` |
| Frequências suportadas nas recorrências; fim de série; tratamento de feriados | `[NÃO ENCONTRADO]` |
| Precedência/desativação/reaplicação retroativa de regras de transação | `[NÃO ENCONTRADO]` |
| Comportamento do orçamento ao exceder 100%; competência vs caixa | `[NÃO ENCONTRADO]` |
| Cálculo de encargos/juros por pagamento parcial de fatura | `[NÃO ENCONTRADO]` |
| Campos exatos de um bem patrimonial (veículo/imóvel) e sua valorização | `[NÃO ENCONTRADO]` |
| Tipos de conta disponíveis (corrente, poupança, investimento, benefícios…) | `[NÃO ENCONTRADO]` — só referidos exemplos |
| Política de palavra-passe, MFA, expiração de sessão, retenção/LGPD | `[NÃO ENCONTRADO]` |
| Esquema de dados oficial do produto | `[NÃO ENCONTRADO]` — todo o modelo da secção 4 é inferido |
| Conteúdo integral das reclamações do Reclame Aqui | `[NÃO ENCONTRADO]` — páginas dinâmicas; confirmados títulos e URLs |
| Página pública de preços/planos em `minhaseconomias.com.br` | `[NÃO ENCONTRADO]` — o site institucional devolve conteúdo mínimo; preços obtidos na FAQ |
| Reviews individuais das lojas (texto) | `[NÃO ENCONTRADO]` — App Store devolveu HTTP 429 ao pedir avaliações; Google Play devolveu conteúdo vazio |

---

## Anexo A — Registo de fontes

### A.1 Central de ajuda — páginas de inventário (`[FONTE]` para a existência e taxonomia dos módulos)

| Recurso | URL |
|---|---|
| Início da central de ajuda | https://faq.minhaseconomias.com.br/hc/pt-br |
| Todas as funcionalidades | https://faq.minhaseconomias.com.br/hc/pt-br/categories/35587216443547-Todas-as-funcionalidades |
| Perguntas frequentes (10 artigos) | https://faq.minhaseconomias.com.br/hc/pt-br/sections/35587261331099-Perguntas-frequentes |
| Planejamento (Orçamento, Objetivos, Membros) | https://faq.minhaseconomias.com.br/hc/pt-br/categories/35590968779419-Planejamento-Or%C3%A7amento-Objetivos-Membros |
| Controle manual (20 artigos) | https://faq.minhaseconomias.com.br/hc/pt-br/sections/35591617109019-Controle-manual |
| Aplicativo e Funcionalidades (14 artigos) | https://faq.minhaseconomias.com.br/hc/pt-br/sections/35610346042779-Funcionalidade-membros-aplicativo |
| Cartão de crédito e faturas | https://faq.minhaseconomias.com.br/hc/pt-br/categories/35593130057371-Cart%C3%A3o-de-cr%C3%A9dito |
| Cadastro e Conta (11 artigos) | https://faq.minhaseconomias.com.br/hc/pt-br/categories/35590937576859-Cadastro-e-Conta |
| Assinatura Meu Clube (7 artigos) | https://faq.minhaseconomias.com.br/hc/pt-br/categories/35590959417371-Assinatura-Meu-Clube |
| Conexão automática via Open Finance (8 artigos) | https://faq.minhaseconomias.com.br/hc/pt-br/categories/35590946751131-Conex%C3%A3o-automatica-via-Open-finance |
| Conecte sua IA favorita / MCP (11 artigos) | https://faq.minhaseconomias.com.br/hc/pt-br/categories/52221380840603-Conecte-sua-IA-favorita |
| Migração Antiga Experiência (9 artigos) | https://faq.minhaseconomias.com.br/hc/pt-br/categories/47981575725595-Migra%C3%A7%C3%A3o-Antiga-Experi%C3%AAncia |

### A.2 Artigos consultados integralmente (via `html_url` canónico)

| ID | Artigo | Título |
|---|---|---|
| 35593611981595 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593611981595) | O que é o Minhas Economias? |
| 54680196652187 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680196652187) | Glossário: termos usados no Minhas Economias |
| 54680210954395 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680210954395) | Como usar o app para controlar 100% das minhas finanças? |
| 54680210829723 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680210829723) | Qual a diferença entre Recorrência e categorização automática? |
| 54213018161947 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54213018161947) | Como criar uma workspace personalizada |
| 53292545975067 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/53292545975067) | Como criar uma Regra de Transação |
| 40282064756379 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/40282064756379) | Como crio uma recorrência na minha conta? |
| 35615614905883 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35615614905883) | O que é um planejador financeiro? |
| 35610172368667 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610172368667) | O que é a ferramenta de orçamentos? |
| 35610239079067 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610239079067) | Como é calculado meu resultado mensal? |
| 35615605707163 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35615605707163) | O que é a ferramenta de Objetivos? |
| 35593908723355 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593908723355) | Como criar um objetivo no Minhas Economias? |
| 35593961296539 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593961296539) | Como editar um objetivo? |
| 35593494651163 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593494651163) | Como criar um orçamento mensal no Minhas Economias? |
| 35593544566427 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593544566427) | Como editar um orçamento mensal no Minhas Economias? |
| 54641566798107 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54641566798107) | Posso cadastrar bens patrimoniais (carro, imóvel)? |
| 54641577264155 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54641577264155) | Posso cadastrar dívidas (empréstimos, financiamentos) no app? |
| 35592690788251 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35592690788251) | Como criar uma conta manual no Minhas Economias? |
| 54675849670043 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54675849670043) | Meu saldo está divergente. O que fazer? |
| 54641577139227 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54641577139227) | Como excluir uma conta e o que acontece com o histórico? |
| 54641521378331 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54641521378331) | Como editar os dados de uma conta? |
| 54641534088859 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54641534088859) | Meu saldo está desatualizado. Posso ajustar sem lançar tudo manualmente? |
| 42747006542107 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/42747006542107) | Como excluir um registro de transação manual? |
| 42745902816283 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/42745902816283) | Posso alterar a data que começa a valer o mês de gastos e ganhos? |
| 42745695987611 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/42745695987611) | Consigo alterar a moeda informada no saldo? |
| 35611907399835 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35611907399835) | O que é "Ignorar Transação"? |
| 35611866010523 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35611866010523) | Como registrar uma transferência entre contas? |
| 35611021770651 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35611021770651) | Como alterar a categoria das minhas transações no Minhas Economias? |
| 35610890624539 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610890624539) | O que são e como funcionam as categorias e subcategorias? |
| 35610843369755 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610843369755) | Como analisar meus gastos e ganhos por categoria? |
| 35610430068123 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610430068123) | Como é calculado o meu saldo? |
| 35610326600603 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610326600603) | Onde vejo o saldo das minhas contas? |
| 35610246287515 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610246287515) | Como avalio o meu desempenho financeiro? |
| 35592900823451 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35592900823451) | Como criar categorias ou subcategorias no Minhas Economias? |
| 35592824502171 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35592824502171) | Como registrar um ganho manualmente? |
| 35592699159707 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35592699159707) | Como registrar um gasto manualmente? |
| 35610319457947 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610319457947) | O que é a funcionalidade Membros? |
| 35611924835483 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35611924835483) | Como vincular uma transação a um membro? |
| 35610801539355 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610801539355) | O que são e como funcionam as tags no Minhas Economias? |
| 54680203879963 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680203879963) | Consigo exportar o extrato da minha conta? |
| 54680180177563 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680180177563) | Como consultar e filtrar um relatório de transações? |
| 54680188496795 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680188496795) | Existe versão para desktop? |
| 54214140659227 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54214140659227) | Como arquivar e desarquivar uma conta bancária |
| 48054818496411 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/48054818496411) | O app tem versão gratuita? |
| 40534935060123 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/40534935060123) | Como editar ou excluir categorias no aplicativo? |
| 35612043640475 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35612043640475) | Como aplicar filtros no extrato? |
| 54680188601243 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680188601243) | Posso compartilhar minha conta com outra pessoa da família? |
| 35615351675547 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35615351675547) | Como contratar o plano Meu Clube? |
| 35615401810715 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35615401810715) | Qual o valor e forma de pagamento da assinatura Meu Clube? |
| 35615315682587 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35615315682587) | Quais são os benefícios da assinatura Meu Clube? |
| 35612785182619 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35612785182619) | Como funciona o reembolso de assinaturas? |
| 54680197324443 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680197324443) | O que é a integração com assistentes de IA (MCP)? |
| 52224936261147 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/52224936261147) | Como Conectar no ChatGPT |
| 52221571431963 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/52221571431963) | Preciso pagar pela IA? |
| 35593186092571 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593186092571) | A conexão com meu banco pelo Minhas Economias é segura? |
| 35592567734683 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35592567734683) | Como conectar uma conta bancária via Open Finance? |
| 48054754522523 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/48054754522523) | A conexão com bancos é obrigatória? |
| 54675828123419 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54675828123419) | Tenho um investimento. Como faço o lançamento? |
| 54640095465115 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54640095465115) | Como criar um cartão de crédito manual? |
| 35593174621083 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593174621083) | Como registrar o pagamento da fatura do cartão de crédito? |
| 35615686421019 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35615686421019) | Por que o pagamento da minha fatura aparece como ganho no extrato? |
| 35610978972187 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35610978972187) | Como utilizar o cartão de crédito na nova experiência? |
| 54675849794203 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54675849794203) | Como registrar uma compra parcelada? |
| 49967806140315 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/49967806140315) | Como realizar a migração da antiga experiência para a nova? |
| 47985512965915 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/47985512965915) | Tudo que você precisa saber sobre a Migração de dados |
| 47985790171547 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/47985790171547) | Posso cancelar minha migração? |
| 47986170743323 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/47986170743323) | Migrei meus dados, mas meu saldo não veio ou está errado |
| 35593326940571 | [link](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35593326940571) | Quais dados preciso informar para me cadastrar? |

### A.3 Artigos com **apenas título/existência confirmados** (conteúdo não consultado integralmente)

| Artigo | Onde foi usado |
|---|---|
| [54680159351451 — Como mudar entre tema claro e escuro?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680159351451) | 1.4, 2.23 |
| [54675842452763 — Como fazer pesquisa por tag?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54675842452763) | inventário de tags |
| [42746474541467 — O app desloga com frequência…](https://faq.minhaseconomias.com.br/hc/pt-br/articles/42746474541467) | 6.1 (L15) |
| [40676704845467 — Posso acessar minha conta em outro celular?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/40676704845467) | 2.21 |
| [40290731808923 — Como acessar o aplicativo pela web?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/40290731808923) | 2.23 |
| [40281993342491 — Posso ter uma conta PJ vinculada?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/40281993342491) | 2.21, 8 (F13) |
| [54680202474011 — O que é o Token de segurança?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680202474011) | 2.21 |
| [54680158928411 — Posso usar biometria (Face ID, Touch ID)?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/54680158928411) | 2.21, 8 (F8) |
| [35592157208091 — Como cancelar minha conta?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/35592157208091) | 2.21 |
| [40282322165531 — Período histórico do Open Finance](https://faq.minhaseconomias.com.br/hc/pt-br/articles/40282322165531) | 2.19 (não detalhado) |
| [45806869923227 — Como reativar assinatura?](https://faq.minhaseconomias.com.br/hc/pt-br/articles/45806869923227) | 1.5, 2.22, 6.1 (L14) |
| [44727074028315 — iOS: Meu Clube não ativou](https://faq.minhaseconomias.com.br/hc/pt-br/articles/44727074028315) | 2.22, 6.1 (L14) |

### A.4 Fontes externas

| Fonte | URL | Uso |
|---|---|---|
| App Store BR (iOS) | https://apps.apple.com/br/app/minhas-economias/id520869873 | nota 4,6 / 58 mil classificações; descrição; preço “Grátis · Compras dentro do app” |
| Google Play (Android) | https://play.google.com/store/apps/details?id=com.minhaseconomias&hl=pt-BR | nota 4,2 (conteúdo da página não acessível) |
| Reclame Aqui — empresa | https://www.reclameaqui.com.br/empresa/minhas-economias/lista-reclamacoes/ | “Resolve 70,1% das reclamações”; segmento |
| Reclame Aqui — reclamação 1 | https://www.reclameaqui.com.br/minhas-economias/aplicativo-de-financas-com-erros-de-saldo-e-desaparecimento-de-contas-sem-resolucao-apos-contato-com-suporte_ATQYaJHBBJqZuRDR/ | erros de saldo e desaparecimento de contas |
| Reclame Aqui — reclamação 2 | https://www.reclameaqui.com.br/minhas-economias/aplicativo-nao-funciona-nao-atualiza-lancamentos-e-solicitacao-de-cancelamento-e-devolucao-do-valor-pago_C4gGDdKAOZpbGqVT/ | não atualiza lançamentos |
| Reclame Aqui — reclamação 3 | https://www.reclameaqui.com.br/minhas-economias/aplicativo-bugado_2wO_BxNtAQ4LhPDs/ | “aplicativo bugado” |
| my-best — Top 10 apps de finanças | https://br.my-best.com/18262 | classificação do Minhas Economias como app manual; afirmação de “100% gratuito” |
| Portal institucional | https://minhaseconomias.com.br/ | conteúdo mínimo (site dinâmico) |
| Portal web do produto | https://wwws.minhaseconomias.com.br/ e https://portal.minhaseconomias.com.br | portal web; página de login |
| robots.txt | https://wwws.minhaseconomias.com.br/robots.txt | rotas legadas `/home.do`, `/principal.do`; permite indexação geral |

---

## Anexo B — Matriz de cobertura do entregável

| Ponto exigido | Secção | Coberto |
|---|---|---|
| 1. Visão geral, proposta de valor, público-alvo | §1 | ✅ |
| 2. Inventário exaustivo de módulos e funcionalidades | §2.0–§2.23 | ✅ |
| 3. Por funcionalidade: o que faz, entradas, saídas, regras, erros/limites | §2.1–§2.22 (tabelas por módulo) | ✅ |
| 4. Fluxos passo a passo (onboarding, orçamento, objetivo, despesa/receita, fechar o mês) | §3.1–§3.10 | ✅ |
| 5. Modelo de dados inferido (entidades, campos, relações, enums) | §4.1–§4.4 | ✅ (marcado como inferido) |
| 6. Cálculos e regras financeiras | §5.1–§5.8 | ✅ |
| 7. Pontos fracos de UX/limitações relatados | §6.1–§6.3 | ✅ |
| 8. Funcionalidades fora de âmbito | §8 (+ menções `[FORA DE ÂMBITO]` em §2.6, §2.15, §2.19) | ✅ |
| Distinção facto/fonte vs inferência | convenções §0; marcas em todo o documento | ✅ |
| Sem invenção: registo do que não foi encontrado | §10 | ✅ |
| Cinco melhorias face ao original | §9 | ✅ |

---

*Fim do documento.*
