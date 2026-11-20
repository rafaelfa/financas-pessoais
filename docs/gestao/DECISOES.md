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

### A3 — `CRON_SECRET` sem rota que a use — **RESOLVIDA pelo utilizador (2026-11-19): a rota**

**Decisão dele:** escreve-se a rota que gera as recorrências vencidas. Vai como **T70** (`TASKS.md`) e o
caminho sem sessão fica registado como **D22** logo abaixo.

**Estado medido da variável:** saiu do `.env.example` e do `turbo.json` na T32, porque então não havia rota;
continua no `.env` desta máquina. Com a T70, a declaração volta ao `.env.example` como *placeholder*.

### D22 — A rota de cron é um caminho privilegiado sem sessão — **decisão do utilizador (2026-11-19)**

**A decisão:** há um `GET /api/cron/recurrences` protegido **só** por `Authorization: Bearer ${CRON_SECRET}`,
que gera as ocorrências em atraso **de todos os utilizadores** que as tenham. É o único sítio do código fora
de `(app)` em que uma escrita não parte do `userId` da sessão: parte de `userId` lidos da própria base,
utilizador a utilizador. O plano é **Hobby**, por isso a agenda é **uma vez por dia**, no máximo.

**A alternativa rejeitada, e porquê:** ficar pelo botão da UI (o estado de hoje). Foi rejeitada porque deixa
uma regra de negócio — «o que está em atraso gera-se» — dependente de alguém abrir a app; com um utilizador
único, uma semana fora acumula atrasos que só se corrigem à mão. Rejeitada também a variante «a rota recebe
o `userId` do chamador»: dava a quem chama o poder de escrever na conta alheia, que é exactamente o que a
regra do `userId` da sessão impede em todo o resto do repositório.

**O que a torna irreversível:** o `vercel.json` entra na configuração de produção e `CRON_SECRET` passa a ter
efeito real. A partir daqui (a) uma agenda que dispare mais de uma vez por dia **rebenta o deploy** no plano
Hobby, não só o cron, e (b) a rota é superfície pública: quem tiver o segredo escreve na base de todos. As
duas coisas mordem em produção, e por isso ficam escritas antes de o código existir.

### A7 — Rodar a palavra-passe da Neon — **EXECUTADA (19/11, 15:59Z → 16:12Z)**

**Como correu, e a correção ao mapa de consumidores:** a sequência inteira está em
`relatorios/A7-rotacao.md`, com a hora de cada passo. O ponto que muda o que estava escrito abaixo:
**a palavra-passe é por ramo, não por projeto.** As três ligações de `old-fire-26176066` saíam da API
com o mesmo valor porque os ramos o copiaram na criação — mas rodar um ramo **não** roda os outros,
medido durante a execução (depois de rodar o do diário, os outros dois ainda abriam com a palavra-passe
velha). A janela de «as duas produções em baixo» só aconteceu porque rodei os três ramos um a um, e o
primeiro foi o do diário, por engano: o passo 1 dizia «Reset password de `neondb_owner`» sem nomear o
ramo. **Ficou provado:** `/api/health` 200 com `database.reachable: true` às 16:09Z, os três casos não
autenticados da rota de cron em produção a devolver 401, `run_sql` no ramo do diário com a palavra-passe
nova, e a spec 46 **3 passed** contra o ramo `testes-e2e` rotacionado. **Não ficou feito:**
`SMOKE_DATABASE_URL` nos segredos do GitHub Actions — o token do `gh` e a integração do OpenBot não
escrevem segredos (`403 “Resource not accessible by integration”`), e o workflow é manual, por isso nada
rebenta sozinho. **Peça nova no procedimento:** alterar variáveis na Vercel não toca na instância que
está a servir; sem `redeploy` as apps ficam em baixo mesmo com as variáveis repostas.

**Correcção de 19/11, 18:45Z — o nº 3 não estava «desactualizado», nunca existiu.** Medido: o workflow
`Fumo em produção` tem **0 execuções** desde que entrou no repositório (`gh api …/workflows/smoke.yml/runs`
→ `total_count: 0`; o ficheiro vem do commit `b980ed0`, 18/10), e a lista de segredos do utilizador não
tinha a entrada. O `SMOKE_DATABASE_URL` foi **criado agora, pelo utilizador**, no ecrã
*Settings → Secrets and variables → Actions*, com a *pooled connection string* do ramo `Financas_Pessoal`.
Nunca foi lido por nós para confirmar o que lá ficou (`403`), por isso o valor só se prova à primeira
corrida do fumo. **Duas peças novas no procedimento de rotação:** (a) variáveis escritas na Vercel como
`sensitive` **não se voltam a ler** — nem pela consola, nem pela API (devolve `value: ""`); em rotação, a
fonte do valor é o **Neon**, nunca a Vercel; (b) o `gh secret set` com os tokens desta máquina **não
escreve** segredos — são precisos uns `403` à partida; fica a ser passo do utilizador, ou de um
*fine-grained token* com *Secrets: read and write*.

---

**O que estava escrito antes da execução (19/11, com a inferência que se provou errada):**

**Decisão dele, no bloco de confirmação de 19/11:** autorizou a sequência inteira, com duas condições
escolhidas por ele — **(a)** rodo **depois de a T70 fechar**, não já, para não partir a meio uma corrida da
suíte que o Dev e o QA possam estar a fazer contra `testes-e2e`; **(b)** o passo da Vercel faço-o **eu**,
depois de ele autorizar o scope `rafaelfa-projects` no link de consentimento.

**O que fica combinado e não se discute à frente:** entre o *reset* e o `.env` local a produção está em
baixo; se o passo 2 falhar a meio, continua em baixo até se resolver, e é por isso que o link se pede no
momento, não com horas de antecedência (é de uma vez e expira em 10 minutos). Se a T70 se arrastar, a A7
arrasta-se com ela — e a ligação de 01/11 continua viva nesse tempo todo, o que é o custo de adiar.

**Reconfirmada com o preço real (19/11, segundo bloco):** apresentei a tabela de consumidores — a janela
derruba **as duas produções**, esta e a do diário — e propus a alternativa A5 (projeto Neon próprio primeiro,
que fecha a fuga para os nossos dados sem tocar no diário). **A escolha dele foi rodar a palavra-passe quando
a T70 fechar**, aceitando os minutos das duas apps em baixo. A **A5 continua aberta** como dívida: é a coisa
que torna a próxima rotação barata, não é o remédio desta.

Urgência: alta. Não é código — é produção, e por isso não segue a fila das tarefas.

**Medido hoje (19/11), através da API do Neon:** a `neondb_owner` do projeto `old-fire-26176066` tem **uma
palavra-passe para os três ramos** — `production` (o diário do chofer: `app_users`, `driving_sessions`,
`work_days`, …), `Financas_Pessoal` (a base de produção **desta** app) e `testes-e2e`. O API devolve as três
ligações com a mesma palavra-passe, só com endpoints diferentes (`ep-frosty-water-*`, `ep-young-poetry-*`,
`ep-spring-mud-*`). **Rodar a palavra-passe parte os três ao mesmo tempo** — o que a nota de 01/11 não dizia.

**Continua viva:** a suíte e2e corre contra `testes-e2e` com ela (129/129 a 18/11), pelo que o segredo colado
a 01/11 **não foi rodado**. E agravou-se hoje: ao pedir as três ligações para comparar, o valor voltou a
aparecer no histórico desta conversa. Rota-lo deixou de ser uma recomendação e passou a ser a única coisa que
serve — a conversa velha e a nova têm-no.

**Consumidores conhecidos da palavra-passe** (todos verificados hoje, cada um com a fonte):

| # | Onde | Como se ligam | O que parte quando rodar |
| - | ---- | ------------- | ------------------------ |
| 1 | `financas-pessoais\.env` desta máquina | `DATABASE_URL` + `DIRECT_URL` → `ep-spring-mud-*` (`testes-e2e`) | `pnpm dev`, `db:studio` e a suíte e2e |
| 2 | Vercel desta app | produção no ramo `Financas_Pessoal` | a app em produção, até as variáveis serem repostas |
| 3 | **GitHub Actions deste repo** | `secrets.SMOKE_DATABASE_URL` (`smoke.yml:56-57`), usado por `packages/db/smoke.mjs`, que **apaga** o utilizador de teste que cria | o fumo em produção falha; corre só à mão, por isso não parte sozinho |
| 4 | **O diário do chofer** | o README dele diz «a produção atual roda na Vercel com banco Neon», no ramo `production` do mesmo projeto | a produção **de outra app**, até as variáveis dele serem repostas |
| 5 | CI deste repo | **não usa Neon** — `ci.yml:37-56` sobe `postgres:18-alpine` com `postgresql://postgres:postgres@localhost:5432/financas` | nada; fica de fora da janela |

Fontes: tabela de ramos acima; `gh api repos/rafaelfa/diario_chofer/contents/README.md` (a linha do
parágrafo inicial, consultada 19/11); `gh secret list` responde **403 “Resource not accessible by
integration”**, por isso o segredo nº 3 está confirmado por *referência no workflow*, não por listagem.
~~e o fumo já correu (T8.2), o que diz que ele existe.~~ — **inferência retirada em 19/11:** a T8.2 é a
auditoria de autorização e o limite de tentativas (`docs/spec/T8.2-auditoria-autorizacao.md`, 11 POST
seguidos a `/api/auth/sign-in/email`); não corre o workflow do fumo. Medido nesse dia: **0 execuções** de
`smoke.yml`. O nº 3 existia como linha num ficheiro, não como segredo na conta.

O nº 4 é o que a nota de 01/11 não previa: rodar a palavra-passe **derruba a produção do diário** com a
desta app, e a janela deixa de ser «minutos desta aplicação» para ser «duas aplicações em baixo até às
variáveis de ambas serem repostas». Continua na mão dele decidir se vale o custo — o que se poupa é o
facto de a ligação colada a 01/11 dar acesso total às duas bases.

**A sequência, quando for autorizada** — entre o passo 1 e o passo 4 há **duas** aplicações em baixo:

1. Neon → `old-fire-26176066` → **Reset password** de `neondb_owner` (o Neon derruba as ligações em curso).
2. Escrever `DATABASE_URL` e `DIRECT_URL` novas na Vercel **das duas apps** (production **e** preview onde
   existir) — as do diário só se escrevem depois do link do scope, porque hoje não sei o nome do projecto.
3. Actualizar `SMOKE_DATABASE_URL` neste repo — **pelo browser, pelo utilizador**: os tokens desta máquina
   levam `403` na API de segredos, por isso `gh secret set` não escreve. Valor copiado do **Neon**
   (ramo `Financas_Pessoal` → *pooled connection string*), nunca da Vercel, que o guarda como `sensitive`.
4. `.env` desta máquina atualizado com a mesma palavra-passe → verificar: `/api/health` com
   `database.reachable: true` em produção, e uma corrida e2e local.
5. Escrever aqui a data, o que ficou coberto e o que não (se o diário não foi apanhado, diz-se).

**Estado de antes da janela, medido às 13:51 UTC de 19/11** — é com isto que se compara o depois, para não
haver «penso que voltou»: `GET https://financas-pessoais-psi-lac.vercel.app/api/health` → **200**,
`environment: production`, `dependencies.database = { provider: postgresql, configured: true,
reachable: true }`.

**Não se roda antes de o passo 2 estar pronto:** sem ele, o passo 1 deita a produção abaixo sem saída à vista.
O gatilho passa a ser **a T70 fechada** — e nessa altura peço-lhe o link outra vez, porque o de hoje expira.

### A5 — A base das finanças vive dentro de um projeto de outra app — **EXECUTADA (19/11, ~19:25Z → 19:52Z)**

**Trava:** nada agora; é dívida a limpar quando houver tempo. **Decide:** utilizador.

**Estado a 19/11, 20:06Z: executada e provada.** A base desta app passou para o projeto `Financas_Pessoal`
(`cold-pond-15149007`, `ep-wispy-sky-b4e0sr8e`) e a Vercel foi reposta **e** reimplantada; o QA deu **PASS**
(`relatorios/A5-qa.md`) e eu contra-provei os hash e o objecto deployment (`TASKS.md`, vaga 6). Execução,
prova e o que falhou em `relatorios/A5-neon.md`. Ficam por ele:
o `SMOKE_DATABASE_URL` (ponto 5 — o valor actual aponta para a origem e a palavra-passe da origem foi
rodada hoje) e o ramo de `testes-e2e` (ponto 6 — perguntei se entrava nesta vaga e ficou sem resposta).
**Nada foi apagado**: o ramo `Financas_Pessoal` de `old-fire` fica vivo até **26/11**.

A base do `financas-pessoais` era o ramo `Financas_Pessoal` dentro do projeto Neon
`old-fire-26176066`, cujo ramo `main` é a app do diário do chofer. Há ainda um segundo
projeto também chamado `diario_chofer` (`patient-field-12858176`), inativo.
Risco: abrir o console e ficar no ramo errado. Cada ramo tem o seu `public`, portanto
não há mistura de dados — mas há risco de operar no sítio errado.

**Mapa completo, medido por API a 19/11 às 18:20Z** (deixa de haver «penso que é este»):

| Projeto Neon | Região | Ramo | Endpoint | Conteúdo | Quem o usa |
| --- | --- | --- | --- | --- | --- |
| `old-fire-26176066` `diario_chofer` | eu-central-1 | `production` (`br-snowy-dew`) | `ep-frosty-water-b1nyzzpu` | — | diário do chofer (produção dele) |
| `old-fire-26176066` `diario_chofer` | eu-central-1 | `Financas_Pessoal` (`br-patient-mud`) | `ep-young-poetry-b1nqzwit` | **27 tabelas, 2 utilizadores** | **esta app, produção e o `SMOKE_DATABASE_URL`** |
| `old-fire-26176066` `diario_chofer` | eu-central-1 | `testes-e2e` (`br-damp-math`) | `ep-spring-mud-b11fe546` | — | `.env` desta máquina, suíte e2e |
| `cold-pond-15149007` `Financas_Pessoal` | us-east-2 | `production` (`br-rough-bird`) | `ep-wispy-sky-b4e0sr8e` | **0 tabelas em `public`**, 9 em `neon_auth` | **ninguém** — projeto nosso, vazio desde 01/11 |

Consequência prática, corrigida pela execução: **o projeto próprio já existia e tinha a Neon Auth
montada** — não havia nada para criar. O que se fez foi copiar o `public` por `postgres_fdw` (não por
`pg_dump`: sem cliente Postgres nesta máquina e sem daemon do Docker), repor as duas variáveis da Vercel
e reimplantar. **O apagamento do ramo emprestado não faz parte desta execução**: vive até 26/11 e só se
apaga com ele a pedir, como estava escrito no critério 7. E é esse o motivo estrutural da janela de
19/11 ter derrubado duas apps: os dados do `financas-pessoais` estavam dentro do projeto do chofer.
**Depois de hoje, rodar a nossa palavra-passe volta a ser uma janela de uma aplicação só.**

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

### D21 — O Next sobe de 16.4.0 para 16.4.6 depois da T53 — **decisão do utilizador (2026-11-17)**

O `apps/web/package.json` fixa `next: 16.4.0` (sem `^`). O registo de avisos do npm, consultado
em 2026-11-17, devolve para 16.4.0: duas falhas **críticas** de execução remota de código
(`GHSA-2464-fhr4-w9xw`, otimização de imagens com SVG; `GHSA-673q-mjm6-r5xr`, funções
`use cache` a devolver typed arrays), uma **alta** de negação de serviço em Server Actions
(`GHSA-p3m5-59mp-jv5r`) e duas moderadas de fuga de cache entre root params. Para 16.4.6 o mesmo
registo não devolve nada.

**Porque não é teórico neste projeto:** a app não usa `next/image` nem `use cache`, mas o
endpoint `/_next/image` é servido por omissão e responde **sem autenticação** — a via do RCE
está aberta mesmo sem uso de `next/image`. Server Actions são usadas nas mutações, portanto a
de DoS também é alcançável.

**Decidido: subir para 16.4.6 (T56), logo a seguir à T53, na mesma vaga.** A alternativa
rejeitada foi subir já, antes da T53: custaria ~30 min e interrompia o encadeamento para
resolver um risco que não cresce com o código desta vaga. Subir **depois** da T53 e **antes de
qualquer produção**.

**O que a torna irreversível:** o pin sem `^` é deliberado e a subida é de patch (16.4.0 →
16.4.6, sem mudança de API), por isso reverte-se num commit. O irreversível é o contrário: um
deploy para produção a partir de 16.4.0 expõe um RCE sem autenticação. **Regra que fica: uma
versão de framework com aviso crítico aberto não vai para produção, e o aviso verifica-se no
registo do npm, não na memória de quem o leu.**

**Nota de ambiente, para não voltar a assustar ninguém:** `next build` corrido diretamente
falha com `SecurityFatalError` nesta máquina; `pnpm build` (turbo) passa, porque o `nudge` do
Next só corre quando `config.experimental.agentUpgrade` ou `__NEXT_AGENT_UPGRADE` estão
definidos, e o turbo não propaga essa variável ao filho. Não é configuração do repositório.

### A4 — Contraste de `--border`/`--input`

**Trava:** nada. **Decide:** utilizador.

Medido a 1,31:1 (claro) e 1,46–1,57:1 (escuro); o mínimo WCAG 1.4.11 é 3:1. Os
mínimos que resolvem estão em `docs/plano/ESTADO-E-HANDOFF.md` §6.1. Escurecer os
tokens muda o carácter visual da aplicação — é escolha de produto, não de código.

### D23 — A cópia fez-se por `postgres_fdw`, e as duas palavras-passe rodaram na mesma janela — **decisão do Lead (2026-11-19)**

**O que se decidiu:** mover os dados com uma ponte `postgres_fdw` montada no destino
(`create server` → `import foreign schema` → `insert into … select`), e rodar a palavra-passe
do destino **antes** do corte e a da origem **depois** dele, dentro da mesma execução da A5.

**Alternativa rejeitada e porquê:** `pg_dump`/`psql` em Docker, como estava escrito no critério de
fecho. Foi medida antes de se começar e não existe nesta máquina — os três binários estão ausentes e
o daemon do Docker devolve `500 … dockerDesktopLinuxEngine` (`com.docker.service` e o WSL
`docker-desktop` ambos em `Stopped`). A segunda alternativa rejeitada foi despejar o `public` em
ficheiro e carregá-lo statement a statement pelo MCP: funciona para 158 linhas, mas **cada linha de
dados e cada palavra-passe passava pelo chat**, e foi precisamente por uma palavra-passe ter caído no
chat que a rotação de hoje deixou de ser opcional. A ponte deixa os dados e as credenciais dentro do
servidor; foi desmontada a seguir (`0` esquemas, `0` servidores, `0` tabelas estrangeiras).

**O que a torna irreversível:** a palavra-passe antiga da origem **deixou de abrir a base da origem**,
e era ela que estava neste chat. A partir de agora o ramo `Financas_Pessoal` de `old-fire-26176066` só
se alcança pelo console do Neon ou por uma ligação pedida pela API — fica como cópia de segurança
muda, não como cópia de segurança acessível a quem leia a conversa. Reversível é o resto: `git revert`
dos commits desta vaga repõe as ligações antigas na Vercel, e a origem não foi apagada até 26/11.

**Regra que fica:** uma ferramenta de ligação devolve **host, comprimento e booleanos**, nunca o texto
do segredo — nem com máscara, porque a máscara falha. Escrita de segredo em variável da Vercel faz-se
dentro do mesmo `execute`, e a verificação é `updatedAt`, não o valor.



### D24 — A vaga 7 é a lista completa da auditoria de design, com os passos (b) à espera de confirmação um a um — **decisão do utilizador (2026-11-20)**

**O que se decidiu.** Avançar para implementação com **os 22 itens + 2 recuperadas**, sem cortar
nada, na ordem de prova B1 → B2 → B3 → B5 → B4 → B6 → B7 → B8 → B9. Três escolhas que vinham como
(c) saíram assim: **C2** — o limite de altura dos diálogos entra **na classe base**
`components/ui/dialog.tsx`, o que baixa o item de tamanho de M para S e transforma os 28 ecrãs sem
limite em **re-verificação**, não em edição; **C1** — o contraste das bordas não textuais (A4)
resolve-se **só no tema claro**, duas linhas de tokens no `:root`, e o tema escuro (1,32:1) fica
escrito como **não resolvido** em cada relatório; **C3** — o `Card size="sm"` **não se toca agora**,
decide-se no bloco da densidade (T82 → T83) com o custo dos dois caminhos medido.

**Alternativa rejeitada e porquê.** Fazer só o balde (a) e deixar a biblioteca para depois: barata
de aprovar, mas deixa os dois piores defeitos (diálogos de 1761 px e alvos de toque a 32 px) onde
estão, porque ambos só se curam na base — remendar 28 ecrãs à mão é o que produziu as **37 cópias**
locais da constante `TOUCH` e os **84** `min-h-11` desalinhados que a varredura de hoje contou.

**O que trava.** Os passos que escrevem `components/ui/` ou `app/globals.css` ou o shell dos 17
ecrãs — **T72, T75, T78, T79, T80, T81, T82, T83** — têm número, ficheiros e lugar na fila, mas só
abrem mão com o «vai» explícito do Dr. Eggbot no post de handoff. Correm já, sem nova aprovação,
**T73, T74, T76, T77**.

**Regras que ficam da preparação desta fila.** (1) Zero deploy: o `next start` de verificação pára
no fim de cada bloco, porque no Windows ele bloqueia o `next build` seguinte. (2) Nenhuma migração e
nenhuma consulta nova nesta vaga — um item que precise de dados do servidor volta para o Lead
(T73). (3) Itens que mudam a régua visual (toque, raios, tipografia) só entram em commit com o
«antes» medido; «subjetivo» não é critério de aceitação. (4) Uma string pt-BR encontrada a meio do
caminho **não** reabre a T23 nem a T25: é tarefa nova. (5) A definição de cada item tem de sair do
chat e ir para `docs/gestao/` antes de o bloco dela abrir.

---

### D25 — Git é uma mão só: só o Lead commita e faz push, e só depois de QA `PASS` + Revisor `OK` — **decisão do utilizador (2026-11-20)**

**O que mudou.** A 17/11 tinha ficado autorização permanente para eu empurrar trabalho já provado
sem voltar a pedir. Hoje, depois de um push que ninguém autorizou, o utilizador substituiu-a por
**«só faça push e commit depois de for aprovado pela equipe»** e **«e somente vc pode fazer isso»**.
Ou seja: a autorização deixou de ser sobre *empurrar depressa* e passou a ser sobre *quem empurra e
quando*.

**Regras que ficam.** (1) `git commit`, `git push`, `add`, `merge`, `rebase` e `reset` são
exclusivamente do Lead. Dev, QA e Revisor trabalham na árvore de trabalho e entregam prova — diff,
números, capturas — sem tocar na história do repositório. (2) A ordem é fixa: Dev entrega → QA assina
`PASS` com a saída do comando → Revisor dá `OK` contra o critério → **só então** o Lead commita e,
com o gate verde, faz push. Sem assinatura não há commit, nem para os meus `docs/gestao/`. (3) Nunca
`--force`, nunca `reset --hard`, nunca reescrever história partilhada. (4) O `git add` do Lead usa
caminhos explícitos, nunca `-A`. (5) Verificar `local` vs `origin` depois de cada push. Escrito em
`AGENTS.md` § Git e § Quem escreve o quê.

**O que a motivou, medido.** `pushed_at = 2026-11-20T16:03:17Z`, **8 segundos** depois do commit
`21dae72` que nem eu nem o Dev fizemos; o branch `fix/t73-parcelamentos-cartoes` ficou no GitHub com
a minha vaga 7 e 6 capturas dentro. `main` não se mexeu (`2acacbc`), zero PRs, zero runs de CI para o
branch, zero redeploy. O branch foi apagado do remoto por mim às 16:48Z com cartão de aprovação dele
(`push-t73-remediar`); os dois commits continuam locais.

**Consequência prática na cadeia.** Os artefactos que o Dev entregava em commit passam a ser a árvore
de trabalho mais o relatório. Isto fecha o risco de `21dae72` — uma mão a commitar docs alheios no
commit de outra — mas abre outro: **a árvore partilhada tem de estar limpa de escrita cruzada antes
de o QA medir**, e quem a limpa sou eu.

**Alternativa rejeitada.** Manter o commit no Dev e proibir só o push: não serve, porque foi o commit
de outra mão que levou os meus documentos para dentro do trabalho dele, e o push foi consequência
automática do mesmo mecanismo.
