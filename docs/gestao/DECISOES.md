# Decisões — financas-pessoais

Registo do que já foi decidido e do que ainda espera pelo utilizador. Cada entrada
diz **quem decide** e **o que trava** enquanto não for decidida.

## Decididas

### D1 — A árvore de trabalho é diagnóstico, não entrega

O Lead clonou, instalou (`--no-frozen-lockfile`) e correu o gate para medir o estado.
Isso deixou três marcas locais, nenhuma commitada:

- `pnpm-lock.yaml` reescrito (+25 linhas, as duas dependências em falta);
- os 12 ficheiros reescritos pelo `pnpm format` (formatação apenas);
- `.env` com valores falsos (git-ignored).
- `core.autocrlf` passou a `false` **neste clone**.

O Dev confirma ou refaz — não se assume que está correto.

### D2 — Ordem das tarefas

T1 (install + formatação) antes de T2 (lint + tipos). São independentes em conteúdo,
mas a T1 é mecânica e verifica-se em minutos; a T2 exige decisões sobre código morto.

### D3 — `pnpm-lock.yaml` atualiza-se com `pnpm install --no-frozen-lockfile`

E não à mão. A única alteração aceitável no lockfile é a que o pnpm escrever sozinho.

### D4 — Commit e push só no fim, e só com autorização — **ordem do utilizador**

**Decidido pelo utilizador em 2026-11-01:** "só faça push e commit quando tudo já
estiver ok e me pergunte antes".

Na prática:

- Nenhum commit durante as tarefas. Trabalha-se na árvore de trabalho.
- Commit e push **só quando o gate estiver inteiro verde** (`format:check`, `lint`,
  `typecheck`, `test`, `build`) e o QA e o Revisor tiverem aprovado.
- **Perguntar antes**, sempre, e sem presumir. Um "sim" anterior não cobre o commit
  seguinte.
- Como o commit é o último passo, a mensagem tem de explicar as tarefas T1–T4 de uma
  vez, e incluir o `.gitattributes` (sem ele o próximo clone no Windows apanha CRLF).
- Commitar com **caminhos explícitos**, nunca `git add -A`: ~320 das ~335 entradas de
  `git status` são fantasma (bytes iguais ao índice).

**Acrescento de 2026-11-01, quando o gate fechou:** o utilizador escolheu **esperar pelo QA**
antes de qualquer commit, e quer a mensagem **curta, num parágrafo** (não uma linha por tarefa).
O commit e o push ficam para quando ele autorizar; o push implica deploy automático na Vercel a
partir de `main`, e isso foi-lhe dito antes de decidir.

**Ficam de fora do commit, por decisão:** `apps/web/AGENTS.md` (o `next dev` reescreve-o a cada
arranque e traz instruções dirigidas a agentes de IA) e `apps/web/next-env.d.ts` (gerado pelo
`next build`, reposto ao original).

### D5 — O guard de conta paga passa a bloquear de verdade — aceite

**Decidido pelo Lead em 2026-11-01.** O `select` de `deleteReceivablePayable` e de
`updateReceivablePayableStatus` não trazia `status`, logo `existing.status` era
`undefined` em runtime e as duas verificações ("não apagar conta paga", "não reabrir
conta paga") nunca disparavam. A T2 acrescentou `status: true` e as verificações
passaram a correr.

É a regra de negócio documentada no próprio ficheiro. Aceite como correção, não como
regressão. Consequência: se alguém estava a apagar contas pagas "com sucesso", deixa
de conseguir — é o pretendido.

### D6 — Badge de conta paga fica `default` por agora

**Decidido pelo Lead em 2026-11-01.** `PAID` apontava para a variante `'success'`, que
não existe em `ui/badge.tsx` nem tem token no `globals.css` — o badge saía sem cor.
A T2 trocou para `'default'` (a mesma cor de `OPEN`), sem inventar variantes.

Um verde para "pago" exige uma variante `success` **e** um token `--success` — dois
ficheiros fora do âmbito da T2. Fica como T6, para depois de a produção estar em dia.

## Resolvidas — decisão do utilizador

### A1 — Terminar ou reter a funcionalidade do commit `b980ed0`? — **TERMINAR**

**Decidido pelo utilizador em 2026-11-01: a funcionalidade fica.**

Juntava "contas a pagar/receber", "grupos de conta" e "consolidação de contas", com
migração de base de dados, sem testes e sem passar o gate.

Consequências aceites:

- A T2 conserta o que impede o build (7 erros de tipo + 51 de lint) **sem mudar
  comportamento**; a T3 prova os ecrãs com e2e e testes puros.
- A migração `20261014192848_add_receivable_payable_and_account_group` **já está
  aplicada** na Neon de produção, e as quatro tabelas novas estão vazias (verificado
  em 2026-11-01 pelo MCP do Neon). **Nenhum trabalho de base de dados é preciso** para
  subir o código novo.
- Reverter o código fica fora de questão: era a alternativa barata e foi rejeitada.

## Abertas — decisão do utilizador

### A1 — Terminar ou reter a funcionalidade do commit `b980ed0`?

**Trava:** T3 inteira. **Decide:** utilizador.

O commit junta "contas a pagar/receber", "grupos de conta" e "consolidação de
contas" — com migração de base de dados, mas sem testes e sem passar o gate.

- **Terminar:** a T2 conserta o que impede o build, a T3 prova com e2e e testes puros,
  e a funcionalidade entra. Custo: ~3 tarefas.
- **Reter:** esconde-se a funcionalidade da navegação (ou apaga-se) e o gate fica verde
  só com a T2 mais pequena. Custo: ~1 tarefa, mas perde-se trabalho já feito.

**Risco a confirmar:** a migração `20261014192848_add_receivable_payable_and_account_group`
já foi aplicada à Neon de produção? Se sim, reter o código deixa tabelas órfãs na base.

### A2 — `.gitattributes` com `* text=auto eol=lf`?

**Trava:** nada — já entrou na T1. **Decide:** utilizador, se tiver opinião sobre o
gate correr ou não em Windows.

Sem ele, qualquer Windows com `core.autocrlf=true` vê 330 ficheiros "mal formatados"
que estão corretos no git.

### A3 — `CRON_SECRET` sem rota que a use

**Trava:** nada. **Decide:** utilizador.

Está no `.env.example`, no `turbo.json` e na Vercel, mas não existe rota de cron.
Ou se escreve a rota que gera as recorrências vencidas, ou se retira a variável.

### A7 — Rodar a palavra-passe da Neon (a fazer depois da T3)

**Decide:** utilizador. **Urgência:** alta, mas depois da T3.

A connection string da Neon foi colada no chat em 2026-11-01 e ficou no histórico da
conversa. É um segredo de produção. Ação, quando a T3 fechar:

1. Neon → projeto `old-fire-26176066` → **Roles** → `neondb_owner` → _Reset password_.
2. Atualizar a `DATABASE_URL` e a `DIRECT_URL` na Vercel (Production e Preview).
3. Redeploy para a aplicação apanhar as novas variáveis.
4. Apagar o `.env` local desta máquina (tem a palavra-passe antiga).

Enquanto não se roda, qualquer pessoa com o histórico da conversa tem acesso total à
base de produção.

### A5 — A base das finanças vive dentro de um projeto de outra app

**Trava:** nada agora; é dívida a limpar quando houver tempo. **Decide:** utilizador.

A base do `financas-pessoais` é o ramo `Financas_Pessoal` dentro do projeto Neon
`old-fire-26176066`, cujo ramo `main` é a app do diário do chofer. Há ainda um segundo
projeto também chamado `diario_chofer` (`patient-field-12858176`), inativo.
Risco: abrir o console e ficar no ramo errado. Cada ramo tem o seu `public`, portanto
não há mistura de dados — mas há risco de operar no sítio errado.

Proposta: criar um projeto Neon próprio (`financas-pessoais`), fazer `pg_dump` + `restore`
do ramo, trocar a `DATABASE_URL`/`DIRECT_URL` na Vercel e apagar o ramo antigo — depois
de confirmar que a app nova está saudável.

### D7 — Navegação: 15 destinos passam a 8 — **delegada pelo utilizador (2026-11-17)**

O utilizador delegou no Lead as quatro decisões do plano de novembro. Fica a **versão
moderada**, não a de seis:

| Grupo       | Destinos                                              |
| ----------- | ----------------------------------------------------- |
| Dia a dia   | Painel · Transações · Contas · Contas a pagar/receber |
| Planeamento | Orçamento · Objetivos · Património                    |
| Análise     | Relatórios                                            |

**Mudam de porta, não desaparecem:** Cartões e Consolidação passam para dentro de
Contas; Recorrências, Regras, Categorias e Importar passam para o menu do cabeçalho de
Transações; Definições passa para o rodapé do utilizador.

**Porque não seis:** o Património é o número principal da aplicação e sai caro escondê-lo.
**O que trava:** a T51. **Risco aceite:** as 87 provas e2e navegam por links — meio dia
da T51 é para elas.

### D8 — Comerciante como entidade: sim, na vaga 4 — **delegada pelo utilizador (2026-11-17)**

Uma tabela de comerciantes e `merchantId` opcional no lançamento. A normalização na
importação **sugere** e o utilizador confirma; nunca decide sozinha, e nunca grava um
comerciante novo sem confirmação.

**Porquê:** hoje o mesmo supermercado é três coisas nos relatórios. **O que trava:** a T60
(única migração da vaga 4) e as regras por comerciante, que ficam para depois.

### D9 — Splits ficam fora das seis semanas — **delegada pelo utilizador (2026-11-17)**

Dividir um lançamento por várias categorias mexe em todos os ecrãs que somam valores
(relatórios, orçamento, donut, faturas, exportações, regras, importação). Não cabe numa
vaga sem pôr em risco as outras cinco.

**Alternativa aceite até lá:** dois lançamentos, um por categoria. **Reabre se:** o
utilizador passar a usar o cartão para compras mistas com regularidade.

### D10 — Ritmo: 3 dias de equipa por semana, revisto no fim da vaga 1 — **delegada (2026-11-17)**

"Dia" é dia de trabalho da equipa (Dev → QA → Revisor → fecho), não dia de calendário.
A 3 dias/semana o plano de 18,5 dias fecha em ~6 semanas. A vaga 1 serve de cronómetro
(não tem schema nem migração) e o ritmo revê-se com a medição real.

### D11 — Quatro tabelas novas em todo o plano, nenhuma na vaga 1 — **delegada (2026-11-17)**

| Vaga | Tabelas                       | Colunas                         |
| ---- | ----------------------------- | ------------------------------- |
| 1    | **nenhuma**                   | nenhuma                         |
| 2    | **nenhuma**                   | nenhuma                         |
| 3    | `NetWorthSnapshot`, `Insight` | `BudgetLimit.rolloverEnabled`   |
| 4    | `Merchant`                    | `Transaction.merchantId`        |
| 5    | `ImportMapping`, `Attachment` | `Transaction.importFingerprint` |

As passkeys (T64) criam a tabela do plugin `better-auth` — não é desenho nosso. Total:
**4 tabelas nossas + 3 colunas + 1 tabela do plugin**, com migração de produção no fim
das vagas 4 e 5, sempre por mão do utilizador.

### D12 — O modo privacidade lê um cookie no servidor — **aceite do Dev (2026-11-17)**

O critério «o HTML servido não traz valores» não se cumpre só com `localStorage`: o
servidor não conhece a preferência e o script inline corre depois do HTML. O Dev passou a
guardar a preferência em cookie (`financas-privacidade`), lido em `app/layout.tsx`, e o
`<html>` leva `data-privacidade="ativa|inativa"` — atributo, não classe, porque a classe
do `<html>` é do `next-themes`.

**Custo aceite:** todas as rotas passam a dinâmicas. As de `(app)` já eram; `/entrar` e
`/registar` deixam de ser estáticas. Numa aplicação de utilizador único são duas páginas
visitadas raramente — aceitável.

**Alternativa registada, não feita:** ler o cookie em `(app)/layout.tsx` com um provider e
pôr o atributo num wrapper. Se um dia as páginas de autenticação precisarem de voltar a ser
estáticas, é aí que se mexe.

### D13 — Gráficos mascarados: eixos e tooltips também — **decisão do Lead (2026-11-17)**

Com a máscara ativa, os três gráficos que mostram dinheiro (fluxo de caixa, donut de
categorias e projeção do Painel) passam a mascarar **valor e eixo**: a forma do gráfico
mantém-se, os números não. Sem isto, o modo privacidade diz que oculta e mostra valores a
passar o rato — vale menos do que promete.

**Não inclui** corrigir a formatação dos tooltips (hoje `toLocaleString()` sem €): é outra
decisão, não se mistura.

### D14 — A máscara é de apresentação; o payload leva os números — **aceite (2026-11-17)**

O `<Amount>` é componente cliente e recebe `amountInCents`; os arrays dos três gráficos
viajam como props. Logo, mesmo com a máscara ativa, os números estão no `self.__next_f` do
HTML servido — só o **texto visível** é que não os tem.

**Aceito, e com uma consequência:** é privacidade de ecrã (quem está ao lado), não segredo
contra quem abre o código-fonte. Nada de notas de lançamento a dizer «os valores não saem do
servidor». Mandar máscara em vez de números obrigaria todos os consumidores a pedir a
preferência ao servidor — custo alto, benefício nenhum face à ameaça real.

### D15 — A máscara cobre montantes; datas, contagens e percentagens ficam — **decisão do Lead (2026-11-17)**

Fechada a T46, o QA levantou a única leitura possível do critério: o eixo X da previsão e
os rótulos do tooltip continuam a mostrar `09/12`, e as percentagens e contagens também
têm dígitos. **Ficam.** O que o modo privacidade protege é o dinheiro de quem está ao lado;
uma data não diz quanto se tem. Esconder datas seria esconder o gráfico, não o saldo.

**Consequência para as próximas tarefas:** o critério de uma tarefa de privacidade é
«zero montantes», não «zero dígitos» — e um texto novo com dígitos entra numa varredura se
for um montante, não por ter algarismos.

### D16 — A sparkline acaba hoje; o saldo do cartão pode incluir amanhã — **aceite (2026-11-17)**

Um lançamento **liquidado com data futura** entra no saldo calculado (`accountBalanceInCents`
sem `upTo`) e não entra na série de 30 dias, que termina em `today`. Logo o último ponto da
linha pode ser diferente do número impresso acima dela.

**Aceito, e a razão:** a linha é histórica — não pode somar o que ainda não aconteceu — e o
glifo não tem eixo nem rótulo, por isso não afirma uma escala. O contrário (esticar a curva
até ao futuro para bater com o número) seria pior: punha um valor de amanhã dentro de um
histórico de 30 dias.

**Consequência:** o critério 1 da T47 não é «iguais sempre» mas «iguais exceto com
liquidados de data futura». Fica um teste a fixar a exceção e o comentário do código a
dizê-la (T47-b). Não há consumidor que assuma igualdade.

### D17 — A sparkline não tem escala: a forma não é magnitude — **decisão do Lead (2026-11-17)**

A linha normaliza no mínimo e no máximo de cada conta. Duas contas com a mesma forma e
escalas diferentes desenham a mesma linha; uma oscilação de 2 € desenha a mesma montanha
que uma de 2 000 €.

**Mantém-se.** Ancorar o domínio no zero achataria qualquer conta com saldo alto numa reta,
e a magnitude já está no número logo acima. A regra de leitura é: **a linha diz a direção,
nunca o tamanho.** Quem precisar de escala abre `/relatorios`.

### D18 — Um prop `undefined` viaja no payload como `"$undefined"` — **facto (2026-11-17)**

O React Flight **não** omite uma chave com valor `undefined`: serializa-a como
`"$undefined"`. Consequência prática: um campo opcional preenchido com `undefined` ocupa
espaço em todas as páginas que recebem o objeto — na T47 eram ~33 B por conta, 99 B por
página, em 7 páginas.

**Regra:** quando um campo é opcional por custo, ele sai por **spread condicional**
(`...(condicao ? {} : { campo })`), não por `undefined`. E uma prova de payload procura
`campo` **e** `"$undefined"`: grep por `null` dá falso negativo.

**Regra irmã, que a T47 mostrou valer mais que a disciplina:** se um ecrã precisa de um
campo que os outros não têm, isso é um **tipo à parte** com o campo obrigatório
(`AccountWithSeries extends AccountView`) e assinaturas sobrecarregadas — assim o esquecimento
é erro de compilação em vez de um ecrã mudo.

### D20 — A lista de sugestões entra no fluxo em vez de flutuar — **decisão do Lead (2026-11-17)**

Duas tentativas de lista flutuante falharam no mesmo sítio, o **espaço**:

1. `absolute` dentro do `Card` (que tem `overflow-hidden`): cortada a 2–3 linhas, as restantes
   sugestões inalcançáveis com o rato. Corrigir com `overflow-visible` no cartão.
2. Com `overflow-visible`: a lista (654 → 888) passou a ficar **por cima da fila de botões**
   (666 → 698). O primeiro clique em «Lançar» escolhia uma sugestão em vez de gravar — a
   escrita deixava de funcionar com a lista aberta.

**Decidido: a lista é um bloco no fluxo, a seguir ao campo.** Empurra os botões para baixo
(cartão de 530 → 776 px quando abre) e não os tapa. O custo é um salto de layout ao escrever;
o benefício é que nenhum controlo fica inalcançável e o recorte por `overflow` deixa de ser
possível por construção.

**Porque não o `Popup` do base-ui com o input lá dentro:** o Dev testou e, nessa estrutura, o
input passa a ser o filtro do popup e o controlo no formulário é um `Trigger` (um botão) — a
descrição deixava de se escrever e submeter como hoje. Isso derruba o requisito de texto livre,
não é um problema de acessibilidade. **Regra que fica:** um componente de biblioteca que obriga
a mudar o modelo de interação do ecrã perde para o ecrã.

**Regra de leitura, para a próxima vez:** uma camada flutuante sobre um formulário tem de
provar **três** coisas, não duas — não é cortada, não tapa outro controlo, e o controlo que
fica por baixo continua a receber o clique. A T49 só falhou a terceira porque ninguém a mediu
até o QA clicar no botão.

**Regra que se juntou a esta, depois de a T49 falhar três vezes:** não basta a camada não
tapar nem ser cortada — **o controlo debaixo do ponteiro não pode mudar de sítio entre o
`mousedown` e o `mouseup`**. Uma lista que fecha no press e empurra o botão faz perder o
clique: o alvo fugiu. Fechar no `pointerdown` é aceitável para uma lista flutuante (o alvo não
se mexe); numa lista no fluxo, o fecho tem de acontecer **depois** do clique, ou o botão tem de
estar fora da zona que se desloca.

### A4 — Contraste de `--border`/`--input`

**Trava:** nada. **Decide:** utilizador.

Medido a 1,31:1 (claro) e 1,46–1,57:1 (escuro); o mínimo WCAG 1.4.11 é 3:1. Os
mínimos que resolvem estão em `docs/plano/ESTADO-E-HANDOFF.md` §6.1. Escurecer os
tokens muda o carácter visual da aplicação — é escolha de produto, não de código.
