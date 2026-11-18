# T55 — Calendário de contas: o mês de vencimentos e movimentos previstos (prova do Dev)

Base `160fb69`. Rota nova `/calendario`, só leitura, mês na URL. Dois ficheiros novos
(`server/calendar.ts`, `app/(app)/calendario/page.tsx`), a entrada na paleta (`lib/nav.ts`) e a porta
no Painel (`app/(app)/page.tsx`). Zero tabelas, zero migrações, zero dependências.

## As quatro fontes, e o que cada uma lê

| Fonte | `where` / origem | Valor | Salto |
|---|---|---|---|
| Contas a pagar/receber | `status = 'OPEN'` **e** `dueDate` no mês (o estado `OVERDUE` nunca é gravado — vencida é `OPEN` com o vencimento no passado) | `PAYABLE` → negativo, `RECEIVABLE` → positivo | `/contas-pagar-receber` |
| Faturas de cartão | `listInvoices()` (estado **derivado** pela cadeia) → `status === 'closed'` **e** `outstandingInCents > 0` **e** `dueDate` no mês | `-outstanding` | `/cartoes` |
| Recorrências | `isActive = true` **e** `nextRunDate` no mês | `amountInCents`, sinalizado pela natureza | `/recorrencias` |
| Lançamentos por liquidar | `settled = false`, `status ≠ IGNORED`, `date` no mês, **`invoiceId IS NULL`** | `amountInCents` | `/transacoes` |

O `invoiceId IS NULL` da quarta fonte é deliberado: a compra de cartão já vem pela fatura, no dia do
vencimento; contá-la também no dia da compra somava o mesmo dinheiro duas vezes.

## O mês com dados nas quatro fontes (novembro de 2026)

Semeados: conta a pagar 50,00 € (dia 10), conta a receber 70,00 € (dia 15), fatura do cartão 45,00 €
(dia 12), recorrência «renda» 800,00 € (dia 20), lançamento por liquidar 30,00 € (dia 25) e uma conta
vencida de 60,00 € a 20/10.

| Dia | Item | Origem | Valor no dia |
|---|---|---|---|
| 10 | T55 pagar 2026-11-10 | Conta a pagar → `/contas-pagar-receber` | −50,00 € |
| 12 | Fatura T55 cartão | Fatura do cartão → `/cartoes` | −45,00 € |
| 15 | T55 receber 2026-11-15 | Conta a receber → `/contas-pagar-receber` | +70,00 € |
| 20 | T55 renda | Recorrência → `/recorrencias` | −800,00 € |
| 25 | T55 lançamento por liquidar | Lançamento → `/transacoes` | −30,00 € |

Cada dia mostra o número de itens e o saldo; o nome acessível de cada dia é exatamente isso, medido:
«terça-feira, 10 de novembro: 1 item, saldo -50,00 €».

**Os três totais, com a aritmética:** a pagar **925,00 €** (50 + 45 + 800 + 30) · a receber **70,00 €** ·
saldo previsto **−855,00 €** (70 − 925). Batem com a soma dos itens do mês.

## Em atraso (critério 2)

A conta de 20/10 (60,00 €) aparece na faixa **«Em atraso, de meses anteriores»** de novembro, com a
palavra **«Vencida»** (não só a cor), e **não** aparece em nenhum dia de novembro (na volta 2 a faixa
passou a incluir também faturas vencidas — ver abaixo) — o dia 20 de
novembro tem só a recorrência. A faixa só existe no mês corrente, para não se repetir em todos os
meses ao navegar, e não entra nos três totais do mês (tem o seu valor, e assim a soma continua a
bater com os itens dos dias).

## Volta 2 — dois DEVE e dois pequenos

**DEVE 1 · fatura vencida na faixa.** A faixa «em atraso» passou a juntar **faturas** fechadas com valor
por pagar e vencimento anterior ao mês, com o mesmo mapeamento dos dias (`/cartoes`, valor negativo) e
`overdue: true`. Provado com uma fatura fechada de **300,00 €** vencida a **10/10/2026** e uma conta
vencida a 20/10: a faixa de novembro mostra **as duas** (fatura −300,00 € → `/cartoes`; conta −60,00 € →
`/contas-pagar-receber`), o texto diz «**2 itens** venceram antes deste mês e continuam em aberto», e
uma pesquisa às ligações da grelha não encontra a fatura em nenhum dia de novembro — **não há
duplicação**. O texto da faixa adapta-se: só contas, só faturas, ou «N itens».

**DEVE 2 · todos os itens na grelha.** Saiu o corte `slice(0, 2)` e o «+N» de texto morto. Cada célula
lista **todos** os itens, cada um com **valor e origem** («Conta», «Fatura», «Recorrência»,
«Lançamento») e ligação própria; a célula tem `max-h-28` com scroll interno quando o dia é grande. Dia
18 de novembro com três itens, medido a 1280: «T55b dia cheio A · Conta −10,00 €», «B · Conta
+20,00 €», «C · Conta −30,00 €» — os três alcançáveis, nenhum escondido atrás de um contador.

**Pequeno 1 · `?mes=0099-05`.** `readMonth` ganhou guarda de ano (1900–2999): `0099` mapeava para 1999 e
mostrava um mês vazio com o rótulo desse ano. Agora cai no mês corrente («Novembro de 2026»).

**Pequeno 2 · paragens de `Tab`.** O `tabIndex` ficou só nos dias **com itens**: a grelha de novembro
passou de **30 dias focáveis (29 deles «0 itens, saldo 0,00 €»)** para **1** — o dia 18, o único com
itens nesta semente. Ao lado, a lista a 360 já só mostrava dias com itens.

`axe` re-medido depois destas mudanças: **0** a 1280 e **0** a 360; `scrollWidth` 360.

## Volta 3 — uma só dívida por cartão

A faixa e os dias passaram a usar **só a última fatura da cadeia de cada cartão** (`listInvoices()`
agrupado por `cardId`, ficando a de maior `dueDate`). O que falta pagar transita para a fatura
seguinte (`carriedOverInCents = outstanding`), por isso somar o `outstanding` de duas faturas do mesmo
cartão conta o mesmo dinheiro duas vezes. Custo: é um filtro sobre o que já se lia — zero consultas
novas.

Cenário medido (o mesmo do QA): cartão A com fatura de outubro de **60,00 €** vencida e fatura de
novembro de **105,00 €** (45,00 € de compras + 60,00 € transitados); cartão B com uma única fatura
fechada e vencida de **70,00 €**.

| Onde | Resultado |
|---|---|
| Faixa «em atraso» | **só** o cartão B: «Fatura T55c cartão B · Vencida · −70,00 €» — **nada do cartão A** |
| Dia 12 de novembro | «Fatura T55c cartão A · Vencida · **−105,00 €**», uma vez |
| Soma do que o ecrã mostra do cartão A | **105,00 €** (não 165,00 €) |
| Totais do mês | a pagar **105,00 €** · a receber 0,00 € · saldo previsto **−105,00 €** |
| `/cartoes` (a fonte) | «Compras 45,00 € · Total 105,00 € · Por pagar 105,00 € · + 60,00 € transitados da fatura anterior» |

**O que deixa de aparecer, e é consequência aceite:** a fatura de outubro do cartão A (60,00 € por
pagar) já não aparece em sítio nenhum do calendário — o dinheiro dela está dentro dos 105,00 € da
fatura seguinte, que é a que se paga. E se a **última** fatura de um cartão estiver `open`, o valor
transitado não aparece até essa fatura fechar: a data de pagamento moveu-se para a frente, que é o que
o trânsito significa.

Observação para outra tarefa (não corrigida aqui): a contagem «Faturas por pagar» da T54
(`server/review.ts`) continua a somar **todas** as faturas `closed` com valor por pagar — é uma
contagem de faturas e não de dinheiro, mas neste cenário diria «2 faturas» para a mesma dívida de um
cartão. Se se quiser a mesma regra lá, é o mesmo filtro de uma linha; `server/review.ts` não estava
nos ficheiros desta tarefa.

## Mês na URL (critério 3)

| Pedido | Resultado |
|---|---|
| `/calendario` | Novembro de 2026 (mês corrente) |
| «Mês seguinte» | `/calendario?mes=2026-12` → «Dezembro de 2026» |
| «Mês anterior» | `/calendario?mes=2026-11` → «Novembro de 2026», totais iguais (925 / 70 / −855) |
| Recarregar `?mes=2026-11` | continua novembro |
| `?mes=2026-13` · `?mes=abc` · `?mes=2026-11-30` | caem no **mês corrente** (novembro), sem erro |

## 360 e teclado (critérios 4 e 5)

| Medida | 1280 | 360 |
|---|---|---|
| Vista | grelha de 7 colunas | **lista por dia** (grelha `display: none`) |
| `scrollWidth` / `innerWidth` | 1280 / 1280 | **360 / 360** |
| `axe` (wcag2a/2aa/21a/21aa/22aa) | **0 violações** | **0 violações** |

Cada dia é um `role="group" tabindex="0"` com o nome acessível completo; foco confirmado por teclado
(`role: group`, `label: "terça-feira, 10 de novembro: 1 item, saldo -50,00 €"`). Cada item é uma
ligação para o ecrã onde se resolve. Nenhum estado se comunica só por cor: o vencido tem a palavra
«Vencida».

## Só leitura (critério 6)

Contagem de **todas as 27 tabelas** do schema `public`, somada, **antes e depois** de percorrer o mês,
navegar para dezembro e voltar, recarregar, pedir três `?mes` inválidos e medir a 360:

| Antes | Depois | Diferença |
|---|---|---|
| 257 | 257 | **0** (nenhuma tabela mudou) |

(A primeira medição acusava +1 porque eu fotografava a base antes de fazer login — a linha de
`session` era minha, não do calendário. Corrigido: a fotografia é tirada depois do login.)

## Portas e navegação (critério 7)

| Onde | Medido |
|---|---|
| Paleta (`Ctrl+K`) | **17** itens, com «Calendário» e «Revisão» |
| Barra lateral | **8 destinos** + «Definições» no rodapé; `/calendario` **não** está lá |
| Painel | bloco «Por arrumar» com «Ver a revisão» e **«Ver o calendário»** |

## Gate (critério 8)

`format:check` verde · `lint` 4/4 · `typecheck` 4/4 · `test` **582** · `build` 2/2. A suíte é do QA.

## Ficheiros

| Ficheiro | Linhas |
|---|---|
| `apps/web/src/server/calendar.ts` (novo) | 303 |
| `apps/web/src/app/(app)/calendario/page.tsx` (novo) | 284 |
| `apps/web/src/lib/nav.ts` | +8 |
| `apps/web/src/app/(app)/page.tsx` | +12/−3 |

Capturas: `relatorios/T55-calendario-1280.png` e `T55-calendario-360.png`. Base deixada como estava:
2 utilizadores, 0 `e2e-*`, 0 linhas/contas/cartões/recorrências `T55`.
