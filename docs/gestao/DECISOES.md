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

1. Neon → projeto `old-fire-26176066` → **Roles** → `neondb_owner` → *Reset password*.
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

### A4 — Contraste de `--border`/`--input`

**Trava:** nada. **Decide:** utilizador.

Medido a 1,31:1 (claro) e 1,46–1,57:1 (escuro); o mínimo WCAG 1.4.11 é 3:1. Os
mínimos que resolvem estão em `docs/plano/ESTADO-E-HANDOFF.md` §6.1. Escurecer os
tokens muda o carácter visual da aplicação — é escolha de produto, não de código.
