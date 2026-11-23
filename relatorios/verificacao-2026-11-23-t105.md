# Verificação de produção — T105 (2026-11-23)

Commit verificado: **`6bd62ee`** (`main`), deployment `dpl_4QMwN6wt3xxfeV52orSdKPtmiAUV` — estado **READY**,
target `production`. URL: `https://financas-pessoais-psi-lac.vercel.app`. Conta: a de teste do Vault
(`teste@teste.com`), sessão já aberta.

## O que está de pé

| ecrã / item | observado |
| --- | --- |
| Painel | Património líquido **183 608,55 €**, saldo hoje **10 253,55 €**, «Por arrumar **0** coisas … **0** faturas por pagar», fecho 5/6 só com «Saldos por travar» (recomendação), «Nada bloqueia o fecho» |
| Revisão | «Faturas por pagar — **Nenhuma fatura por pagar**», «Nada por arrumar.» |
| Cartões | «Por pagar **945,00 €**», «**Em dívida: 945,00 €**», fatura que fecha a 10/11/27 (por fechar) |
| Transações | **19 movimentos**, soma +808,55 €, zero linhas com o prefixo do teste |
| Objetivos | **1 objetivo**, «Viagem ao Japão» 1 100,00 € de 5 000,00 € |
| Património | 1 bem ativo (180 000 €), 1 dívida (6 800 €), 2 bens arquivados (um antigo «Teste bem verificação», um criado hoje) |

## Os dois defeitos, provados ao vivo

**A — dupla contagem ao apagar um depósito.** Criei o objetivo `e2e-t105-objetivo` (1 000 €), registei um
depósito de **100,00 €** com a conta «Carteira principal» (objetivo → 100,00 €, 10 %; saldo da conta → −100),
apaguei o lançamento em Transações («Lançamento apagado.») e voltei a Objetivos: **0,00 €, «Sem histórico»,
«Movimentos Nenhum»**, e o total dos objetivos voltou a 1 100,00 €. Património depois de apagar o objetivo:
**183 608,55 €** — o valor de partida. O órfão já não existe.

**B — data de aquisição.** «Novo bem» abriu com os dois campos de data **vazios** (`acquiredOn: ""`,
`valuedOn: ""`); gravei «e2e-t105-bem» com 100,00 € **sem data** e apareceu «Bem registado.» sem erro no
campo; o cartão diz «**Sem data de avaliação**» e o património subiu 100,00 € (183 708,55 €). Nenhum
`0001-01-05` em nenhum ponto. Arquivado no fim; património de volta a **183 608,55 €**.

## C — os três ecrãs

Com o dado desta conta, Painel e Revisão dizem **0** e os Cartões dizem **945,00 € em dívida**. Não é
discordância: a única fatura com valor fecha a **10/11/27**, ainda não fechou, e a **D38** diz que «por pagar»
só conta depois do fecho. A dívida do cartão (945) é outra pergunta, com outro rótulo. O contrário — os
6 390 € do Painel — já não aparece em lado nenhum.

## Service worker

4 cargas limpas (`/`, `/contas`, `/orcamento`, `/definições`): em **2** delas 1 registo `activated` a servir
`/sw.js` com `controller` a `true`; nas outras 2 o registo apareceu a **0** — e as duas foram navegações que
o **meu instrumento abortou por timeout**. Estado final: 1 registo, `activated`, `controller` a `/sw.js`.
O aviso `[pwa] não consegui registar o service worker [object Object]` voltou a sair durante a sequência.
Fica **não medido/não reproduzido**, como na T106: não distingo o meu browser do produto, e o log continua a
sair como `[object Object]`.

## 320 px

`document.scrollWidth` = `window.innerWidth` em `/`, `/patrimonio` e `/cartoes` (305 px de área útil a 320
pedidos, 15 px de barra de scroll): **sem transbordo**.

## Limites desta verificação

- Não medi o «Fechar o mês» a bloquear/desbloquear em produção (exigia pagar a fatura de 945 €); está provado
  na base dos e2e pelo QA (`e2e/T105-fecho-mes.spec.ts`).
- As navegações do meu browser deram `Navigation timed out` muitas vezes; numa delas a página ficou **sem
  hidratação** (os botões recebiam foco e não reagiam) até uma recarga dura. Reporto como **limite do meu
  instrumento**, não como defeito: não se viu com a página carregada normalmente.
- Não verifiquei os dois temas nesta passagem.

## Dados que criei e o que ficou

Criei e apaguei: objetivo `e2e-t105-objetivo` (eliminado, com o histórico), depósito de 100 € (lançamento
apagado). Criei e **arquivei**: bem `e2e-t105-bem` 100 € — a app não apaga bens, só arquiva; fica na lista
dos arquivados e fora do património. O «Teste bem verificação» e o «Teste dívida verificação» da varredura
anterior continuam arquivados. Nenhum lançamento, limite ou fatura de teste ficou na conta.

---

# Segunda passagem — gasto real criado e apagado, 17 rotas (2026-11-23, depois do push)

Pedido do utilizador: passar por todas as telas, incluir e tirar um gasto e ver o comportamento. Feito na
mesma conta de teste, no commit `6bd62ee`.

## Um gasto real, e o rasto em cada ecrã

Criei pela interface (Lançamento rápido em `/transacoes`): **37,45 €**, Alimentação, conta «Conta à ordem»,
hoje, descrição `e2e-t105-gasto`.

| ecrã | antes | com o gasto | depois de apagar |
| --- | --- | --- | --- |
| Transações | 19 movimentos · +808,55 € | **20 · +771,10 €** | **19 · +808,55 €** |
| Painel (saldo hoje) | 10 253,55 € | **10 216,10 €** | **10 253,55 €** |
| Contas (Conta à ordem) | 5 253,55 € | **5 216,10 €** | **5 253,55 €** |
| Relatórios (Alimentação) | 84,35 € · 57,6 % | **121,80 € · 66,2 %** (2 movimentos) | **84,35 € · 57,6 %** |
| Orçamento (limites) | 66 % · 204,35 € de 310 € | **78 % · Excedido · 241,80 € de 310 €** | **66 % · 204,35 € de 310 €** |
| Orçamento Alimentação (limite 100 €) | 84,35 € · 84 % Atenção | **121,80 € · 122 % Excedido** | **84,35 %** |
| Calendário, dia 23/11 | 1 item · −300,00 € | **2 itens · −337,45 €** | **1 item · −300,00 €** |
| Património líquido | 183 608,55 € | — | **183 608,55 €** |

Todas as contas fecham à mão: 84,35 + 37,45 = 121,80; 204,35 + 37,45 = 241,80 (78 % de 310); 300 + 37,45 =
337,45; 10 253,55 − 37,45 = 10 216,10; 5 253,55 − 37,45 = 5 216,10. O lançamento saiu do extrato («Lançamento
apagado.») e a conta, o orçamento, os relatórios e o calendário voltaram ao cêntimo. Um gasto novo, com dados
reais, comporta-se como deve.

## As 17 rotas

Todas abrem com título e sem ecrã de erro: `/` (Painel), `/transacoes`, `/calendario`, `/contas`,
`/contas-pagar-receber`, `/cartoes`, `/consolidacao-contas`, `/orcamento`, `/objetivos`, `/patrimonio`,
`/relatorios`, `/definicoes`, `/revisao`, `/recorrencias`, `/regras`, `/categorias`, `/importar`. Também abri
cinco detalhes de fatura em `/cartoes?fatura=…` — cada um com compras, transitado, total, pago e por pagar
coerentes (75 + 570 = 645, por pagar 645).

## O que continua a falhar, e é o mesmo de sempre

- **Service worker:** o aviso `[pwa] não consegui registar o service worker [object Object]` apareceu **6
  vezes** durante a varredura. Todas depois de uma navegação que o **meu** instrumento abortou por timeout. Em
  cargas que completam, o registo fica `activated` com `controller` a `/sw.js`. Continua **não reproduzido**
  fora do meu browser, e o texto continua `[object Object]`.
- **Hidratação depois de uma navegação abortada:** numa página, os botões recebiam foco e não reagiam até uma
  recarga dura. Limite do instrumento, não reproduzido em carga normal.
- Nada disto é regressão da T105: as rotas não foram tocadas por ela além do Painel, da Revisão e dos Cartões.
