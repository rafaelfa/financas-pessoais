# O que não foi implementado, e porquê

**Data:** 2026-11-18 · **`main`:** `8e1817d` · **Vagas 1–4 fechadas** (T52–T68)

Este relatório reúne tudo o que ficou **escrito e não feito**, com a razão de cada caso. Não é uma
lista de desejos: cada linha existe numa secção de `docs/gestao/TASKS.md`, num item de
`docs/gestao/MAPA.md` ou numa decisão de `docs/gestao/DECISOES.md`, e cada uma foi registada por quem
a encontrou — Dev, QA, Revisor ou eu.

**A regra que se aplicou em todas:** só se deixou por fazer o que tinha uma razão escrita e verificável.
O que não a tinha, foi feito. As razões agrupam-se em cinco famílias:

| Família | Significado |
| --- | --- |
| **Decisão tua** | muda produto, gosto ou risco; não é minha para tomar |
| **Fora de âmbito** | é outro assunto, com outra prova; fazer aqui esconderia a autoria |
| **Risco maior que o ganho** | a correção mexe em algo que hoje está provado |
| **Ambiente, não produto** | depende da máquina; o CI corre noutro sistema |
| **Sem sintoma reproduzido** | corrigir sem provar seria adivinhar |

---

## 1. Funcionalidade que não existe

### 1.1 Recorrências vencidas só se geram à mão — não há cron

**O quê:** `generateDueRecurrences()` existe e é idempotente (`recurrences-actions.ts:303`), mas é
chamada por uma acção do utilizador. **Não há rota de cron** — `apps/web/src/app/api/` só tem `health`
e `auth`. Uma recorrência cujo `nextRunDate` passou não gera nada sozinha; gera quando alguém abre a
app e pede.

**Porquê:** decisão **A3** de `DECISOES.md`, em aberto desde 01/11: ou se escreve a rota que gera as
recorrências vencidas, ou se retira a variável `CRON_SECRET`. As duas são escolha de produto.

**Custo:** uma rota `api/cron/recurrences` com segredo + uma entrada na Vercel. Médio, e mexe em
produção.

### 1.2 Uma fatura antiga não pode ser paga pela interface

**O quê:** em `/cartoes?fatura=<id>`, uma fatura de um ciclo anterior abre o detalhe com o botão
**«Fechar»** apenas. «Pagar fatura» existe só na fatura corrente de cada cartão.

**Porquê:** **não é defeito, é a regra do trânsito.** O que falta pagar de uma fatura entra no total
da seguinte (`invoice.ts:239`); a dívida da antiga já está na nova, e pagar a antiga pagaria o mesmo
duas vezes. Ficou medido na T60 e escrito na secção.

**Custo:** nenhum, enquanto a regra for esta. Se um dia se quiser pagamento por fatura, é outra
arquitetura e outra tarefa.

---

## 2. Acessibilidade e interface — herdado da vaga 1, ainda aberto

Estes seis vêm da lista que a vaga 1 deixou escrita. **Não foram tocados por nenhuma das vagas
seguintes** porque cada um é um defeito pequeno com risco próprio.

| # | O que | Onde | Porque não | Custo |
| --- | --- | --- | --- | --- |
| 2.1 | **22 px de transbordo a 360** | `/relatorios` | apareceu na T46 e nunca foi atribuído; mediria-se com `scrollWidth` | pequeno |
| 2.2 | **Barra de scroll do diálogo invisível a 568 px de altura** | overlay do diálogo de edição | anterior à T49; é desenho de overlay, mexe em todos os diálogos | médio |
| 2.3 | **Toast do `sonner` a 4,25:1** | `components/ui/sonner.tsx` | contraste abaixo de 4,5:1; mexe no tema e não num ecrã | pequeno |
| 2.4 | **Polaridade de `warning` invertida** face a `success`/`expense` | `globals.css` | pede um `--warning-text` novo e uma passagem pelo tema todo | médio |
| 2.5 | **`--chart-grid` sem consumidor** | `globals.css` | a grelha do fluxo usa `border/50`, que já é temática; é limpeza, não defeito | pequeno |
| 2.6 | **Contraste `/importar` 4,42:1** no gatilho de um *tab* Radix | `/importar` | achado da T52, anterior a ela, mesmo nó a 360 e a 1280 | pequeno |

### 2.7 A4 — o contraste de `--border`/`--input` é decisão tua

**O quê:** 1,31:1 (claro) e 1,46–1,57:1 (escuro) contra o mínimo **3:1** da WCAG 1.4.11.

**Porquê:** escurecer estes tokens **muda o carácter visual da aplicação** — é escolha de produto, não
de código. Está na lista de decisões abertas desde a vaga 1 e continua do teu lado. Os mínimos que
resolvem estão em `docs/plano/ESTADO-E-HANDOFF.md` §6.1.

---

## 3. Dívida de código registada e não corrigida

Cada linha foi lida por alguém com ficheiro e linha. Nenhuma parte nada hoje.

| # | O que | Onde | Porque não |
| --- | --- | --- | --- |
| 3.1 | `logicalCount` e a família de categoria **escritos duas vezes** (cliente e servidor) | `transaction-bulk-actions.tsx` / `transactions-actions.ts` | a justificação inicial («precisava de módulo novo») era **falsa** — `packages/shared` já está importado. Ficou por âmbito. **É partilhável** com uma assinatura de cinco linhas |
| 3.2 | O toast diz «3 apagados» com base em `logicalCount(rows)`, não no `count` da escrita | `transactions-actions.ts` | com duas abas, a base pode ter apagado 2 |
| 3.3 | `sm:after:-inset-x-2` acoplado a `w-10` + `sm:min-w-8` | `transaction-table.tsx` | se a coluna mudar de largura, o alvo de toque invade a coluna de datas **em silêncio** |
| 3.4 | Comentário diz que o `kind` chega em maiúsculas | `transaction-bulk-actions.tsx:43` | desactualizado desde a T57, sem efeito |
| 3.5 | `dark:text-muted-foreground` redundante com a base | `ui/tabs.tsx:58` | cosmético |
| 3.6 | `TransactionView.kind` não é união tipada | `server/transactions.ts` | tipá-lo impediria a repetição do defeito da T57 (maiúsculas) |
| 3.7 | Pluralização escrita à mão em três sítios | `calendario/page.tsx:43,168,208` | existe `plural()` em `transaction-bulk-actions.tsx:125` como precedente |
| 3.8 | Guarda morto em `leadingBlanks` (`days` nunca tem 0) | `calendario/page.tsx:131` | inofensivo |
| 3.9 | `rel` do `MonthLink` decidido pelo texto do filho | `calendario/page.tsx:51` | funciona; é frágil |
| 3.10 | `dayLabel` e o `<h3>` repetem a data | `calendario/page.tsx` | o leitor de ecrã ouve a data duas vezes |
| 3.11 | Pesquisa com mais de 120 caracteres é **descartada**, não truncada | schema do extrato | antes derrubava tudo; agora cai só ela — o mesmo silêncio, mais pequeno |
| 3.12 | `catch` torna um valor inválido **indistinguível de ausente** | schema do extrato | hoje não custa (só serve `listTransactions`); no dia em que servir entrada de fora, o `success` não dirá nada sobre os campos |
| 3.13 | `definirStatusDoLancamento` escreve **sem dono no `WHERE`** | `e2e/support/db.ts:220` | a única excepção à regra; ganhou `rowCount` para não falhar em silêncio. Fechá-la obriga a mudar a assinatura e duas chamadas da spec 35 |

---

## 4. Testes e infraestrutura

| # | O que | Porque não | Estado |
| --- | --- | --- | --- |
| 4.1 | **O `flake` do «apaga o grupo» nunca foi explicado** | não reproduziu em **>170 execuções** (79 do Dev, base fria e CPU carregada do QA). Corrigir sem sintoma seria adivinhar | **a T65 mudou de objectivo**: em vez de corrigir, tornou o próximo diagnosticável (preserva `trace.zip`, screenshots e `error-context`) |
| 4.2 | **O worker morre com `0xC0000142`** — 4 testes não chegaram a correr numa corrida a frio | é Windows; o CI corre em Linux. Um worker que morre produz qualquer sintoma, **incluindo o `flake` 4.1** | **T69 proposta**, não aberta |
| 4.3 | Um `Ctrl+C` **real** nunca foi injetado | o `kill -INT` do Git Bash não chega ao filho do invólucro; o `taskkill` mata com outro código. O ramo POSIX está provado pela **tabela de 8 casos**, não por uma corrida | declarado |
| 4.4 | O `process.on('SIGINT', () => {})` **tira o Ctrl+C ao invólucro** | corrigir exige `spawn` assíncrono com encaminhamento de sinal — outra arquitetura | registado |
| 4.5 | Um `taskkill /F` ou OOM chegam como `status: 1` e copiam um `test-results` a meio | no Windows não há sinal para os distinguir de um vermelho real. Entre copiar um trace truncado e perdê-lo, ficou copiar | registado |
| 4.6 | `scripts/` está **fora dos workspaces**: `lint` e `typecheck` não vêem os três ficheiros | só o Prettier os cobre. Incluí-los exige mexer no `turbo.json` e nos workspaces | registado |
| 4.7 | O glob `scripts/*.test.mjs` não apanha um teste novo fora dessa pasta | fica em silêncio. Fechá-lo é uma convenção, não código | registado |
| 4.8 | O `<details>` da T52 não fecha com `Escape` nem com clique fora | é comportamento nativo de *disclosure*; acrescentar handlers reabriria a classe de defeitos da T49 | por desenho |
| 4.9 | Salto de ~135 px na fronteira 639→640 | só se vê a arrastar a janela; sem corte nem overflow | registado |

---

## 5. Decisões que ficaram do teu lado

De `docs/gestao/DECISOES.md`, com o estado real a 18/11 — **duas estão desactualizadas no documento**,
e di-lo-ia mesmo que não perguntasses.

| # | Decisão | Estado real |
| --- | --- | --- |
| **A1** | Terminar ou reter a funcionalidade do `b980ed0` (contas a pagar/receber, grupos, consolidação) | **Feito, na prática: terminou.** Os três ecrãs existem, estão na paleta e têm specs (`45-`, `55-`). A decisão continua escrita como aberta — devia ser fechada no documento |
| **A2** | `.gitattributes` com `* text=auto eol=lf` | **Feito.** Existe (19 B) e `core.autocrlf=false` |
| **A3** | `CRON_SECRET` sem rota que a use | **Aberto.** Ver 1.1. A variável já não está no `.env.example` desta árvore, mas a rota continua a não existir |
| **A4** | Contraste de `--border`/`--input` | **Aberto.** Ver 2.7. É o único que muda o aspecto da aplicação |
| **A5** | A base das finanças vive dentro de um projeto Neon de outra app (`old-fire-26176066`, ramo `Financas_Pessoal`) | **Aberto.** Dívida de arrumação; risco de operar no ramo errado |
| **A7** | **Rodar a palavra-passe da Neon** — a connection string foi colada no chat a 01/11 | **Não verificável daqui.** Se ainda não foi feito, é **o item mais urgente de toda esta lista**: quem tiver o histórico tem acesso total à base de produção |

---

## 6. O que se decidiu não fazer, e a razão não é «falta de tempo»

Estas não são dívidas: são recusas com argumento, e ficam aqui para não serem reabertas como se
ninguém tivesse pensado nelas.

| O que | Razão de não fazer |
| --- | --- |
| **Subir o piso do `zod`** para `^4.6.6` no `packages/shared` (proposto pelo Revisor na T58) | `^4.6.5` **nunca** resolve para 4.6.5 enquanto existir 4.6.6 — o range pede a versão mais alta que o satisfaz. O piso só valeria contra um *downgrade* deliberado, que é o risco de qualquer dependência |
| **Tirar o `shadcn` da árvore** | o `globals.css` importa `shadcn/tailwind.css`, que define nove `@custom-variant` usados 158 vezes. Saiu do **runtime** (T58), que era o problema; portar o CSS é outra tarefa, com prova visual |
| **`workers: 1` ou `retries` para estabilizar a suíte** | é esconder a colisão, não resolvê-la. A correção honesta foi tornar as falhas observáveis |
| **Confiar no registo de deploy como prova de produção** | um registo prova publicação, não serviço. A prova que ficou no mapa é o **307 numa rota real contra o 404 de um caminho inventado** |
| **Um `waitForTimeout` para o diálogo da spec 55** | um vermelho intermitente tapado com uma espera fica verde e continua intermitente, agora invisível |

---

## 7. O que não se pode verificar daqui

Não é trabalho por fazer — é trabalho que esta máquina não consegue provar, e que por isso **não está
escrito como verde** em lado nenhum:

1. Estado `READY` do último deploy na Vercel e conteúdo exato do build publicado (a API deu **403** por *scope*).
2. Páginas autenticadas em produção (exigiria sessão em produção).
3. Contagens de dados de produção além do que o `/api/health` diz.

---

## Resumo por prioridade

Se tiveres de escolher três coisas desta lista:

1. **A7 — rodar a palavra-passe da Neon.** É a única com consequência de segurança, e a única que não
   depende de código nem de gosto.
2. **A3 — a rota de cron.** Hoje as recorrências só geram quando o utilizador se lembra de pedir: é a
   única lacuna de funcionalidade com efeito real no dia-a-dia.
3. **3.1 — `logicalCount` partilhado.** A justificação que a deixou por fazer era falsa, e é o caso em
   que a dívida cresce sozinha: dois sítios a calcular a mesma coisa vão divergir.

O resto é pequeno, está escrito com ficheiro e linha, e não se estraga por esperar.
