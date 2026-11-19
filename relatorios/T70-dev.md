# T70 — Recorrências vencidas geram-se sozinhas (prova do Dev)

Base `ae44f81` (= `origin/main`). Escritos: `apps/web/src/app/api/cron/recurrences/route.ts` (novo),
`apps/web/src/server/recurrences-actions.ts`, `vercel.json` (novo), `.env.example` (uma linha),
`e2e/46-cron-recorrencias.spec.ts` (nova). **Nada mais.** Zero dependências novas, nenhum commit.

Stack real medida antes de escrever: `node -p "require('next/package.json').version"` em `apps/web`
→ **16.4.6** (o `AGENTS.md` diz 16.4.0). Documentação seguida, a do pacote instalado:
`node_modules/.pnpm/next@16.4.6_*/node_modules/next/dist/docs/01-app/02-guides/{route-handlers,data-security,server-actions}.md`
e os docs Vercel de `schedules/cron-jobs/manage-cron-jobs` + `project-configuration/vercel-json`.

---

## 1 · A decisão de arquitetura — e a pergunta que fica em aberto

O núcleo que recebe `userId` **não pode viver em `recurrences-actions.ts`**, que é a primeira
leitura natural do «núcleo partilhado». Os docs do Next instalado não deixam margem
(`data-security.md`, secção *Built-in Server Actions Security features*):

> «By default, when a Server Action is created and exported, it is reachable via a direct POST
> request, not just through your application's UI. This means, **even if a Server Action or utility
> function is not imported elsewhere in your code, it can still be called externally**.»

Uma `export async function gerarRecorrenciasParaUtilizador(userId)` num ficheiro `'use server'`
seria, à letra, a variante que a **D22 rejeitou**: quem souber o id escreve na conta alheia por um
POST anónimo, sem o segredo. O `server-actions.md` diz o mesmo em duas linhas («Treat every action
as an untrusted entry point»; «Render-time gating is not a security boundary»).

Escolhi a única opção que **cabe na lista de ficheiros da tarefa**: o núcleo vive no
`route.ts` do cron e a acção de sessão importa-o.

- a rota não é `'use server'`, por isso exportar a função não cria nenhuma porta nova;
- o `recurrences-actions.ts` **não ganhou nenhuma export**: as cinco de antes são as cinco de agora
  (verificado abaixo), portanto a superfície de Server Actions da app é exatamente a mesma;
- o único import novo na app é `gerarRecorrenciasParaUtilizador`, do lado do servidor.

**A alternativa mais limpa, e o custo de a tomar:** um módulo sem `'use server'`, por exemplo
`apps/web/src/server/recurrence-generation.ts`, com o núcleo dentro, importado pela acção **e** pela
rota. É a convenção do Next para partilhar lógica entre um route handler e uma Server Action, e
deixa cair a dependência invertida (uma camada de servidor a importar de `app/api/…`) e a
duplicação de `asDate` (três linhas, uma em cada ficheiro). **Não a tomei porque «Mais nada» na
lista de ficheiros, e um ficheiro novo é teu.** Mudar é mecânico: mover ~120 linhas + dois imports +
o tipo `GenerationDetail`; repito o gate a seguir. Diz-me se queres isso antes do Revisor ver a
inversão.

Prova de que a superfície não mudou:

```
$ Select-String -Path apps/web/src/server/recurrences-actions.ts -Pattern "^export " | % { $_.Line }
export async function createRecurrence(input: unknown): Promise<ActionResult<{ id: string }>> {
export async function updateRecurrence(input: unknown): Promise<ActionResult<{ id: string }>> {
export async function setRecurrenceActive(input: unknown): Promise<ActionResult<{ id: string }>> {
export async function deleteRecurrence(input: unknown): Promise<ActionResult<{ id: string }>> {
export async function generateDueRecurrences(): Promise<
```

## 2 · O que ficou escrito

`route.ts` (220 linhas), em três partes:

1. `gerarRecorrenciasParaUtilizador(userId, today)` — o ciclo tal como estava, com a reserva em
   transação (`updateMany` condicional à data lida, `claimed.count !== 1` → desiste sem escrever),
   a mesma message de falha, o mesmo `console.error`. Não lê nada do pedido: recebe dois argumentos
   calculados pelo chamador.
2. `autorizado(authorization)` — compara com `Bearer ${process.env.CRON_SECRET}` e **falso quando a
   variável não existe ou está vazia** (o padrão dos docs).
3. `GET()` — sem parâmetro `request`: o único valor lido do pedido é o cabeçalho, via
   `headers()`. Os donos das séries em atraso vêm da base
   (`findMany({ where: { isActive, nextRunDate <= today }, select: { userId }, distinct: ['userId'] })`)
   e o corpo devolve **só contagens**.

`today` é passado explicitamente pelos dois chamadores (`todayInLisbon()`), para a lista de
utilizadores e a geração correrem com a **mesma** data — a correrem cada um por sua conta, um
pedido a cavalo da meia-noite de Lisboa gerava umas séries com um dia e outras com o seguinte.

A acção ficou assim, sem mudança de comportamento:

```ts
export async function generateDueRecurrences(): Promise<
  ActionResult<{ created: number; truncated: boolean; details: GenerationDetail[] }>
> {
  const user = await requireUser();
  const outcome = await gerarRecorrenciasParaUtilizador(user.id, todayInLisbon());

  if (outcome.failure !== null) {
    return fail(outcome.failure);
  }

  revalidateRecurrenceViews();

  return ok({ created: outcome.created, truncated: outcome.truncated, details: outcome.details });
}
```

O `revalidateRecurrenceViews()` continua a **não** correr quando uma série falha a meio — é o
comportamento de antes, copiado, não inventado.

**Decisão que é tua de confirmar:** um falhanço parcial devolve **200** com `failures: n`, não 5xx.
Razão medida nos docs: «Vercel will not retry an invocation if a cron job fails» — um código de erro
não faz nada além de mostrar vermelho, e o trabalho já cometido pelos outros utilizadores é real; a
contagem no corpo diz-no. Não escrevi ramo de 5xx precisamente porque **não o sei medir** sem partir
a base de testes: ficou só o caminho que sei correr. É uma linha a mudar se quiseres o contrário.

## 3 · Critério 1 · os quatro `curl` (mais a avaria do ambiente)

Servidor de provas: `pnpm --filter @repo/web start` (build `pnpm build`,
`BUILD_ID` **`BGJvWwlve5jloA8kMrJM7`**, porta **3000**, `curl` com o segredo lido do `.env` — o
valor nunca foi impresso nem copiado para aqui).

```
### a) sem header
$ curl.exe -s -w '%{http_code}' http://localhost:3000/api/cron/recurrences
HTTP 401
corpo: {"error":"Não autorizado."}

### b) header errado
$ curl.exe -s -w '%{http_code}' -H 'Authorization: Bearer nao-e-o-segredo' http://localhost:3000/api/cron/recurrences
HTTP 401
corpo: {"error":"Não autorizado."}

### c) header certo
$ curl.exe -s -w '%{http_code}' -H 'Authorization: Bearer [CRON_SECRET do .env]' http://localhost:3000/api/cron/recurrences
HTTP 200
corpo: {"created":2,"truncated":false,"users":1,"failures":0}

### d) segunda chamada, mesmo header
HTTP 200
corpo: {"created":0,"truncated":false,"users":0,"failures":0}
```

Bytes do corpo (a consola em Windows-1252 mostrava «Nǜo»; o texto é UTF-8 certo):
`7B 22 65 72 72 6F 72 22 3A 22 4E C3 A3 6F 20 …` → `{"error":"Não autorizado."}`.

**e) `CRON_SECRET` fora do ambiente → 401.** A medição honesta custou duas tentativas, e a primeira
falhou por um motivo que vale a pena estar escrito: lançar o servidor sem a variável **não** a põe
fora do ambiente — o `next.config.ts` deste projeto faz `process.loadEnvFile(«raiz»/.env)` ao
arrancar, e um valor *ausente* volta do ficheiro. Medido com Node 24:

```
$ node -e "process.env.PROBE=''; process.loadEnvFile('…/probe.env'); console.log(JSON.stringify(process.env.PROBE))"
com valor vazio definido -> ""
$ node -e "delete process.env.PROBE; process.loadEnvFile('…/probe.env'); console.log(process.env.PROBE)"
sem estar definido -> "do-ficheiro"
```

A prova fiel precisou de dois truques em conjunto: o ambiente do filho com todas as variáveis do
`.env` **menos** `CRON_SECRET`, e o `cwd` posto fora do repositório para o `loadEnvFile` não
encontrar ficheiro. Resultado:

```
variaveis do .env passadas ao filho: 5; CRON_SECRET no env do filho? false
next bin: true; ficheiro D:/openbot/.env existe? false
servidor sem segredo pronto: True (saude HTTP 200)
$ curl.exe -s -w '%{http_code}' -H 'Authorization: Bearer [CRON_SECRET do .env]' http://localhost:3100/api/cron/recurrences
HTTP 401
corpo: {"error":"Não autorizado."}
```

Ou seja: **com o segredo correto mas sem a variável no ambiente, a porta fecha.** (Só matei o
processo que eu lancei: PID 31792, o único a escutar em 3100.)

## 4 · Critério 2 · a segunda chamada não duplica — com o número decomposto

`created: 0` à segunda chamada (alínea d) já está colado acima. O que o `created: 2` da primeira
chamada é, medido na base de testes (`testes-e2e`, `ep-spring-mud-*`) antes e depois:

```
ANTES
{"email":"demo@…","name":"Ordenado","frequency":"MONTHLY","next":"2026-11-05","lancamentos_da_serie":3}
{"email":"demo@…","name":"Renda da casa","frequency":"MONTHLY","next":"2026-11-08","lancamentos_da_serie":3}
lancamentos por utilizador: [{"demo@…":48},{"rafaelfa.aguiar@…":4}]

DEPOIS
{"email":"demo@…","name":"Ordenado","next":"2026-12-05","lancamentos_da_serie":4}
{"email":"demo@…","name":"Renda da casa","next":"2026-12-08","lancamentos_da_serie":4}
lancamentos por utilizador: [{"demo@…":50},{"rafaelfa.aguiar@…":4}]
```

Dois lançamentos, um por série, com `nextRunDate` avançado para dezembro — e `users: 1`, porque os
dois pertencem ao mesmo dono. **Não foi o utilizador real a escrever-se:** quem não tem série em
atraso não é tocado. A idempotência ao nível do dado (e não só do contador) está também ela medida
pela spec: `contarPorDescricao(...) = 3` antes e depois da segunda chamada.

## 5 · Critério 3 · a acção de sessão, sem comportamento mudado

- `pnpm test` → **591 passed / 33 ficheiros**, os mesmos 591 de antes, sem um único teste tocado
  (`git diff` não leva ficheiros de teste);
- o botão da UI está coberto por um teste novo na spec 46 — «o botão da sessão gera o mesmo
  atraso, com o mesmo resumo»: cria uma série pela interface, lê o `(1)` do
  `Gerar as que estão a vencer (1)`, clica, espera o aviso
  **«3 ocorrências geradas.»**, lê o resumo série a série do toast (que é o `details` do
  `ActionResult`), confirma 3 lançamentos na base, clica outra vez e recebe
  **«Não havia nada a vencer.»** com a base nos mesmos 3. `recurrence-generate-button.tsx` não foi
  tocado.

## 6 · Critério 4 · `vercel.json`

```
$ node C:/…/t70-vercel-json.mjs
JSON.parse: ok
chaves de topo: $schema, crons
entradas em crons: 1
path /api/cron/recurrences -> directório existe: true; route.ts existe: true
expressão 0 2 * * * -> minutos=1 horas=1 dias/mês=31 meses=12 dias/semana=7
execuções por dia: 1
execuções por semana: 7
limite Hobby (1/dia): cumprido
0 2 * * * (UTC) em 2026-01-15 -> hora de Lisboa 2026-01-15, 02:00
0 2 * * * (UTC) em 2026-07-15 -> hora de Lisboa 2026-07-15, 03:00
```

```
$ Test-Path apps\web\src\app\api\cron\recurrences
True
```

Ficheiro:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/cron/recurrences",
      "schedule": "0 2 * * *"
    }
  ]
}
```

**Porquê as 02:00 UTC, contra o `todayInLisbon()` do gerador.** No plano Hobby a invocação pode
cair em qualquer momento *dentro da hora* pedida (docs: «Vercel may invoke these cron jobs at any
point within the specified hour»), por isso o que se escolhe não é um minuto mas uma **janela de
60 minutos** — e a janela inteira tem de pertencer ao dia civil de que o gerador vai falar. Lisboa é
UTC+0 no inverno e UTC+1 no verão, portanto as horas 00 a 22 UTC caem todas **dentro do mesmo dia
civil** nos dois estados; não há hora «errada» de entre elas, e dizia-o mal a versão anterior desta
nota. Escolheram-se as 02:00 por três razões que se podem escrever sem inventar:

1. **margem depois da meia-noite**: a janela 02:00–03:00 (inverno) / 03:00–04:00 (verão) está duas
   horas depois de `todayInLisbon()` virar, em vez de apanhar o primeiro minuto do dia;
2. **fora da hora da mudança de fuso**: em Lisboa o relógio muda às 01:00 UTC, e uma janela que
   atravesse esse instante fica com a hora local ambígua em dois dias do ano — as 02:00 UTC estão
   sempre depois dele;
3. **antes de o utilizador abrir a app**: é a noite europeia, e o atraso de quem esteve uma semana
   sem entrar fica resolvido antes do primeiro pedido do dia, que é o caso que a D22 quis fechar.

O que a expressão **não pode** fazer é disparar mais de uma vez por dia: é o limite do plano Hobby,
e a doc diz que a deployment **falha** («Expressions that run more frequently will fail deployment»),
não que o cron fica mudo. `0 2 * * *` dá 1 execução/dia, 7/semana — medido na avaliação acima.

O `dist` pedido está provado por dois caminhos: a avaliação acima (1 execução/dia, 7/semana, e o
`limite Hobby cumprido`) e a doc instalada do pacote, na mesma frase que o Lead mediu —
`manage-cron-jobs`: «Hobby users have two cron job restrictions. First, cron jobs can only run
**once per day** … Expressions that run more frequently **will fail deployment**.». As chaves
`$schema` e `crons`{`path`,`schedule`} são as documentadas em `vercel-json`; nenhuma outra chave
entrou, de propósito: o `buildCommand`/`installCommand` da D13 não é desta tarefa e meter configuração
de build num ficheiro novo era mudar o deploy por fora do pedido.

Dois pormenores dos mesmos docs, que já estão cobertos e ficam ditos para o próximo não os
redescobrir:

- **`export const dynamic = 'force-dynamic'` no `route.ts` não é decoração**: «The job runs but
  doesn't appear in the logs — the endpoint returned a redirect or a cached response … In a Next.js
  route handler, add `export const dynamic = 'force-dynamic'`». É o mesmo que o `api/health` já faz.
- **sem `trailingSlash` no `next.config.ts`** (medido: a chave não existe lá), o `path`
  `/api/cron/recurrences` não apanha 307 — e os cron jobs da Vercel **não seguem redireções**: o job
  completava sem nunca chamar a função.

Nota de plataforma, dos mesmos docs: *Cron Jobs are a legacy feature and will be migrated to
Schedules* (que traz fusos). `vercel.json` + `crons` é hoje o caminho suportado em todos os planos;
quando migrarem, isto é uma chave nova no mesmo ficheiro.

## 7 · Critério 5 · nada vem do URL nem do corpo

```
$ Select-String route.ts -Pattern 'searchParams|request\.|req\.|\.json\(\)|\.formData\(\)|\.text\(\)|\.body|NextRequest|params|url'
0 ocorrencias
```

```
$ Select-String route.ts -Pattern 'headers|authorization|userId|distinct|process\.env'   (extrato)
175:  const secret = process.env.CRON_SECRET;
181:  return authorization === `Bearer ${secret}`;
185:  const authorization = (await headers()).get('authorization');
201:    select: { userId: true },
202:    distinct: ['userId'],
209:  for (const { userId } of owners) {
210:    const outcome = await gerarRecorrenciasParaUtilizador(userId, today);
```

O `GET` não recebe sequer o objeto do pedido: `export async function GET()`. O que entra é o
cabeçalho `authorization` e nada mais; `userId` aparece sempre como coluna lida da base.

## 8 · Critério 6 · a spec nova, verde e vermelha onde deve

`e2e/46-cron-recorrencias.spec.ts` (322 linhas, utilizador próprio `e2e-cron-…`, série criada
**pela interface**, `limparDadosDoSpec` em `finally`, `apagarUtilizador` no `afterAll`, zero SQL
arbitrário, zero ficheiros de suporte alterados).

```
$ pnpm exec playwright test 46-cron-recorrencias --output=test-results/t70c --reporter=list
  ok 1 … a porta fecha-se a quem não tem o segredo (37ms)
[T70] primeira chamada (2026-09-10, mensal): {"created":3,"truncated":false,"users":1,"failures":0}
[T70] segunda chamada (idempotência): {"created":0,"truncated":false,"users":0,"failures":0}
[T70] limpeza do cron: {"movimentos":3,"contasAPagar":0,"grupos":0,"contasFinanceiras":0}
  ok 2 … com o segredo gera o atraso de uma vez e não duplica na segunda (3.6s)
[T70] limpeza do botão: {"movimentos":3,"contasAPagar":0,"grupos":0,"contasFinanceiras":0}
[T70] utilizador e2e-cron-mwnn040s-6qxeo8@exemplo.pt apagado (1 linha(s)).
  ok 3 … o botão da sessão gera o mesmo atraso, com o mesmo resumo (3.7s)
  3 passed (16.7s)
```

Os dois vermelhos, por mutação no `route.ts` (ambos por **asserção**, não por engano nem build
partido; repostos logo a seguir):

```
# MUTAÇÃO A — o guarda passa a aceitar qualquer cabeçalho
$ pnpm exec playwright test 46-cron-recorrencias --grep "porta fecha" --output=test-results/t70-vermelho-a --reporter=list
Error: um segredo errado não abre a porta
    expect(received).toBe(expected) // Object.is equality
    Expected: 401
    Received: 200
  1 failed

# MUTAÇÃO B — o corpo passa a levar `ids` de utilizador
$ pnpm exec playwright test 46-cron-recorrencias --grep "com o segredo" --output=test-results/t70-vermelho-b --reporter=list
Error: só contagens no corpo, nunca conteúdo
    expect(received).toEqual(expected) // deep equality
    - Expected  - 0
    + Received  + 1
  1 failed
```

Depois de repor: `3 passed`. As quatro chaves do corpo (`created`, `failures`, `truncated`, `users`)
são a asserção que morde: acrescentar-lhe uma quinta, como na mutação B, já é vermelho. Sem ela,
levar descrições ou montantes seria verde.

## 9 · Critério 7 · gate e suíte

Gate corrido **depois** de repor as duas mutações (nada de código pendurado entre a mutação e o
número):

```
$ pnpm format:check   → All matched files use Prettier code style!
$ pnpm lint           → Tasks: 4 successful, 4 total
$ pnpm typecheck      → Tasks: 4 successful, 4 total
$ pnpm test           → Test Files 33 passed · Tests 591 passed
$ pnpm build          → Tasks: 2 successful, 2 total
                        (a rota nova aparece: ├ ƒ /api/cron/recurrences)
```

Suíte completa pela via do invólucro da T65, com `--output` próprio e a máquina livre (porta 3000
verificada livre antes de cada corrida; `BUILD_ID` declarado, porque nesta máquina o servidor serve
o build que estiver em `.next`):

```
$ pnpm test:e2e -- --output=test-results/t70-suite --reporter=list
[e2e] utilizador de teste e2e-principal-mwnn6fp3-8j4r1i@exemplo.pt: 29 categorias, 1 conta(s).
Running 132 tests using 1 worker
  ok 105 … T70 — o cron diário das recorrências › a porta fecha-se a quem não tem o segredo (29ms)
  ok 106 … T70 — o cron diário das recorrências › com o segredo gera o atraso de uma vez e não duplica na segunda (2.7s)
  ok 107 … T70 — o cron diário das recorrências › o botão da sessão gera o mesmo atraso, com o mesmo resumo (3.6s)
[e2e] limpeza: 4 utilizador(es) de teste apagado(s); 0 restante(s).
  132 passed (7.7m)
```

Build desta corrida `fUAv139xmza4s3gxC8ZVg`; os `curl` das secções 3 e 4 correm contra
`BGJvWwlve5jloA8kMrJM7`, o build anterior do mesmo código. Zero dependências novas: `package.json` e
`pnpm-lock.yaml` não estão no diff.

Na corrida da suíte, o `created` da primeira chamada voltou a ser **3** com `users` **1**: os dois
lançamentos do `demo` já tinham sido gerados pelas minhas chamadas manuais (§4), por isso a suite não
escreveu em nenhum utilizador fora dos `e2e-*`.

## 10 · O que vi e **não** corrigi

1. **O diálogo da recorrência não cabe em 720 px e não tem barra de deslocamento.**
   `ui/dialog.tsx:56` faz `DialogContent` `fixed top-1/2` sem `max-h` nem `overflow`; a primeira
   corrida desta spec falhou ao clicar «Criar recorrência» com
   `40 tentativas … element is outside of the viewport` no viewport por omissão do Playwright
   (1280×720). É utilizável em janela alta, inatingível em janela curta. A spec trabalha a
   1280×1200, como os specs 36–38 já fazem; a correção é do `ui/dialog.tsx`, ficheiro que não é
   meu. Apontado, não remendado.
2. **`MAPA.md:54` passa a estar falso** com este trabalho: «só `health` e `auth/[...all]` — **não
   existe rota de cron**». O mapa é teu.
3. **`CRON_SECRET` falta no `turbo.json` (`globalEnv`)** — saiu na T32 e a TASKS diz que a
   declaração volta com a rota. Não toquei: `turbo.json` é o ficheiro em que combinámos que eu não
   mexia sem to dizer antes. Consequência prática: nenhuma para o comportamento (a variável só é
   lida em runtime) e até é *desejável* que não entre na chave do cache de build; mas é uma linha
   que falta para o `.env.example` e o `turbo.json` dizerem a mesma coisa.
4. **A base `testes-e2e` tem dois utilizadores para além dos specs**: `demo@financas-pessoais.pt`
   (48 lançamentos, o seed) e `rafaelfa.aguiar@gmail.com` (4). O primeiro tem duas séries ativas —
   é por isso que a primeira corrida do cron **contra esta base** escreveu para ele (medido: 2
   lançamentos, §4) e o `globalTeardown` não o limpa (só apaga `e2e-*`). Depois de as datas
   avançarem para dezembro, cada corrida da spec 46 gera **zero** linhas fora do seu utilizador —
   confirmado na suíte completa, onde o `created` foi 3 com `users` 1. É consequência direta da
   D22 (a rota é global), não um defeito dela; se preferires uma suite sem esta escrita cruzada, a
   decisão é da base de testes, não do código.
5. `relatorios/*.png` e os dois `docs/gestao/*.md` modificados são trabalho de outros; não toquei.

## 11 · Diff

```
$ git diff --stat
 .env.example                               |   1 +
 apps/web/next-env.d.ts                     |   4 +-
 apps/web/src/server/recurrences-actions.ts | 132 +++++------------------------
 3 files changed, 24 insertions(+), 113 deletions(-)

$ git status --porcelain   (sem os png do QA, que não toquei)
 M .env.example
 M apps/web/next-env.d.ts
 M apps/web/src/server/recurrences-actions.ts
?? apps/web/src/app/api/cron/
?? e2e/46-cron-recorrencias.spec.ts
?? vercel.json
```

Novos: `route.ts` 220 linhas · `46-cron-recorrencias.spec.ts` 322 linhas · `vercel.json` 9 linhas.
O `-113 / +24` do `recurrences-actions.ts` é o ciclo que saiu daqui e foi para o `route.ts` — não é
código apagado, é código movido, e é a razão de a acção ter ficado em 15 linhas.

`apps/web/next-env.d.ts` está modificado **pelos `next build`** (a armadilha 2 do `MAPA.md`: o Next
reescreve as aspas), não por mim; reverte-se antes do commit, e o commit não é meu, por isso deixei
a linha à vista em vez de descartar um ficheiro que não criei de propósito.

Nada em `packages/`, `turbo.json`, `pnpm-lock.yaml`, `.env`, `playwright.config.ts` ou `scripts/`.

---

## 12 · Volta 2 — o módulo partilhado (autorizado pelo Lead)

Os números das secções 1 a 11 são da volta 1 e continuam a ser verdade sobre essa volta. O que
mudou está aqui, e nesta secção **não há uma linha que não tenha o comando colado**: cada número
foi conferido com `Get-Content`/`Select-String` antes de ser escrito.

### O que moveu

`apps/web/src/server/recurrence-generation.ts` (novo, 163 linhas, **sem diretiva nenhuma**) leva
`asDate`, `GenerationDetail`, `GenerationOutcome` e `gerarRecorrenciasParaUtilizador`. A borda fica
fina: `route.ts` **81 linhas** (era 220), só com `export const dynamic`, `autorizado()` e `GET()`.
O ficheiro de acções tem 320 linhas, e o `asDate` local — que estava duplicado entre os dois lados
— desapareceu: passou a importar do módulo.

Primeira linha do módulo novo (é a prova de que não há `'use server'` lá):

```
$ Get-Content apps/web/src/server/recurrence-generation.ts -TotalCount 1
import { prisma } from '@repo/db/client';
```

Os dois greps do critério (as etiquetas `### criterio …` e a linha `ocorrencias:` são o meu
`Write-Output` em volta do comando, para o zero ficar explícito):

```
### criterio 1: src/server a importar da borda
$ Select-String -Path apps\web\src\server\*.ts -Pattern "from '@/app/api"
ocorrencias: 0

### criterio 2: o modulo nao tem 'use server'
$ Select-String -Path apps\web\src\server\recurrence-generation.ts -Pattern "use server" -SimpleMatch
ocorrencias: 0
```

À superfície, `route.ts` exporta duas coisas e o módulo quatro:

```
$ Select-String -Path apps/web/src/app/api/cron/recurrences/route.ts -Pattern "^export" | ForEach-Object { $_.LineNumber.ToString() + ": " + $_.Line }
22: export const dynamic = 'force-dynamic';
45: export async function GET(): Promise<NextResponse> {

$ Select-String -Path apps/web/src/server/recurrence-generation.ts -Pattern "^export" | ForEach-Object { $_.LineNumber.ToString() + ": " + $_.Line }
25: export function asDate(value: string): Date {
30: export interface GenerationDetail {
36: export interface GenerationOutcome {
53: export async function gerarRecorrenciasParaUtilizador(
```

As **cinco exports de `recurrences-actions.ts` são as cinco de sempre**, antes e depois da volta 2:

```
$ Select-String -Path apps/web/src/server/recurrences-actions.ts -Pattern "^export " | ForEach-Object { $_.Line }
export async function createRecurrence(input: unknown): Promise<ActionResult<{ id: string }>> {
export async function updateRecurrence(input: unknown): Promise<ActionResult<{ id: string }>> {
export async function setRecurrenceActive(input: unknown): Promise<ActionResult<{ id: string }>> {
export async function deleteRecurrence(input: unknown): Promise<ActionResult<{ id: string }>> {
export async function generateDueRecurrences(): Promise<
```

O tipo **não é re-exportado** por lado nenhum e **nenhum ficheiro de UI o importa**. Os dois
comandos, com a saída tal e qual:

```
$ Select-String -Path apps\web\src\server\*.ts,apps\web\src\app\api\cron\recurrences\route.ts -Pattern "from './recurrence-generation'|from '@/server/recurrence-generation'" | ForEach-Object { (Split-Path $_.Path -Leaf) + ":" + $_.LineNumber + ": " + $_.Line.Trim() }
recurrences-actions.ts:22: } from './recurrence-generation';
route.ts:6: import { asDate, gerarRecorrenciasParaUtilizador } from '@/server/recurrence-generation';

$ Get-ChildItem -Recurse apps\web\src -Include *.ts,*.tsx | Select-String -Pattern "GenerationDetail" | ForEach-Object { (Split-Path $_.Path -Leaf) + ":" + $_.LineNumber + ": " + $_.Line.Trim() }
recurrence-generation.ts:30: export interface GenerationDetail {
recurrence-generation.ts:39: readonly details: GenerationDetail[];
recurrence-generation.ts:66: const details: GenerationDetail[] = [];
recurrences-actions.ts:21: type GenerationDetail,
recurrences-actions.ts:308: ActionResult<{ created: number; truncated: boolean; details: GenerationDetail[] }>
```

Dois importadores, ambos do servidor. É também por isto que nenhum ficheiro de interface está
modificado: `git diff --name-only` dá `.env.example`, `apps/web/next-env.d.ts` (o build),
`apps/web/src/server/recurrences-actions.ts` e `docs/gestao/TASKS.md` — esse último é teu.

### Correção ao que escrevi na mensagem da volta 2

Disse que `finance-overview.tsx:42` e `payment-schedule-panel.tsx:137` tinham passado a importar o
tipo. **É falso: esses ficheiros não existem.**

```
$ Get-ChildItem -Recurse -Include finance-overview*,payment-schedule* -Path apps | Measure-Object | Select-Object -ExpandProperty Count
0
```

Também disse «route.ts 220 → 95»; são **81**. As duas frases saíram daqui e ficam registadas como
erro meu: descrevi imports que não medi. Nada noutra linha desta secção vem de memória — os
comandos estão colados com a saída.

### Gate, e em que estado da árvore

Aqui a árvore final está datada, porque é a pergunta certa. Comando 1, os três ficheiros:

```
$ Get-Item apps/web/src/server/recurrences-actions.ts, apps/web/src/server/recurrence-generation.ts, apps/web/src/app/api/cron/recurrences/route.ts | ForEach-Object { $_.LastWriteTime.ToUniversalTime().ToString('HH:mm:ss') + "  " + $_.Name }
14:47:22  recurrences-actions.ts
14:45:43  recurrence-generation.ts
14:46:04  route.ts
```

Comando 2, os registos do turbo (a hora de cada tarefa que correu):

```
$ Get-ChildItem -Recurse -Filter turbo-*.log | Where-Object { $_.FullName -like '*\.turbo\*' } | Sort-Object LastWriteTime | ForEach-Object { $_.LastWriteTime.ToUniversalTime().ToString('HH:mm:ss') + "  " + $_.FullName.Replace("$PWD\", '') }
14:09:12  packages\shared\.turbo\turbo-test.log
14:48:30  apps\web\.turbo\turbo-build.log
14:49:04  packages\shared\.turbo\turbo-typecheck.log
14:49:07  packages\shared\.turbo\turbo-lint.log
14:49:07  packages\db\.turbo\turbo-typecheck.log
14:49:10  packages\db\.turbo\turbo-lint.log
14:49:13  apps\web\.turbo\turbo-typecheck.log
14:49:25  apps\web\.turbo\turbo-lint.log
```

Leitura: `build` às 14:48:30 e `lint`/`typecheck` entre 14:49:04 e 14:49:25 — todos **depois** da
última escrita do `recurrences-actions.ts`, às 14:47:22. Os números abaixo são da árvore final, e o
Lead re-meziu essa mesma árvore por outra via (`turbo run lint typecheck --force` → 7/7, zero cache;
`pnpm test` → 591/33; `format:check` verde), que é a prova que interessa.

Uma exceção dita em voz alta, porque é o género de coisa que faz uma prova significar o contrário
do que parece: o `pnpm test` desta volta apanhou **cache** do turbo — o registo de `test` ficou em
14:09:12, porque `packages/shared` não foi tocado na volta 2. O número que vale para a árvore final
é o da re-medição do Lead: 591 em 33.

```
$ pnpm exec prettier --check apps/web/src/server/recurrence-generation.ts apps/web/src/server/recurrences-actions.ts apps/web/src/app/api/cron/recurrences/route.ts
All matched files use Prettier code style!

$ pnpm format:check   → All matched files use Prettier code style!
$ pnpm lint           → Tasks: 4 successful, 4 total
$ pnpm typecheck      → Tasks: 4 successful, 4 total
$ pnpm build          → Tasks: 2 successful, 2 total  (e ├ ƒ /api/cron/recurrences)
$ pnpm test           → Tests 591 passed (591) · 33 ficheiros
```

### Spec 46 na árvore final

```
$ pnpm exec playwright test 46-cron-recorrencias --output=test-results/t70-volta2 --reporter=list
  ok 1 … a porta fecha-se a quem não tem o segredo (43ms)
[T70] primeira chamada (2026-09-10, mensal): {"created":3,"truncated":false,"users":1,"failures":0}
[T70] segunda chamada (idempotência): {"created":0,"truncated":false,"users":0,"failures":0}
[T70] limpeza do cron: {"movimentos":3,"contasAPagar":0,"grupos":0,"contasFinanceiras":0}
  ok 2 … com o segredo gera o atraso de uma vez e não duplica na segunda (3.8s)
[T70] limpeza do botão: {"movimentos":3,"contasAPagar":0,"grupos":0,"contasFinanceiras":0}
[T70] utilizador e2e-cron-mwno1cou-16htqm@exemplo.pt apagado (1 linha(s)).
  ok 3 … o botão da sessão gera o mesmo atraso, com o mesmo resumo (4.0s)
  3 passed (18.5s)
```

Os corpos são **idênticos** aos da volta 1, o que é o critério: mesma rota, mesmo `created`, mesma
idempotência, mesma limpeza, mesmo caminho de sessão. Não corri a suíte completa — ficou no QA.

### Diff

Volta 2 assente em `b475f14` (= `origin/main`; o `ae44f81` da volta 1 ficou para trás com os teus
commits de `docs/gestao`). Só os meus ficheiros:

```
$ git diff --stat -- .env.example apps/web
 .env.example                               |   1 +
 apps/web/next-env.d.ts                     |   4 +-
 apps/web/src/server/recurrences-actions.ts | 137 +++++------------------------
 3 files changed, 25 insertions(+), 117 deletions(-)

$ git diff --numstat -- apps/web/src/server/recurrences-actions.ts
22      115     apps/web/src/server/recurrences-actions.ts

$ git status --porcelain (sem os png do QA)
 M .env.example
 M apps/web/next-env.d.ts
 M apps/web/src/server/recurrences-actions.ts
?? apps/web/src/app/api/cron/
?? apps/web/src/server/recurrence-generation.ts
?? e2e/46-cron-recorrencias.spec.ts
?? vercel.json
```

Um `git diff --stat` sem âmbito mostra hoje mais uma linha, `docs/gestao/TASKS.md` (+58), que é
**teu** trabalho registado na árvore, não meu; por isso a medição acima é feita com o âmbito dos
meus três ficheiros.

O `recurrences-actions.ts` passou de 132 para 137 linhas de diff (21/111 → 22/115). A conta é
esta: as quatro linhas do `asDate` local saíram (3 da função + 1 em branco) e entrou uma linha no
bloco de import, `asDate,`. Nenhum comportamento, nenhuma asserção, nenhum `where` mexido. Os
outros ficheiros da volta 1 — `e2e/46-cron-recorrencias.spec.ts`, `vercel.json`, `.env.example` —
não foram tocados nesta volta, e o `apps/web/next-env.d.ts` fica como está para tu reverteres antes
do commit.

---

## 13 · Volta 3 — comparação em tempo constante e uma asserção web-first

Âmbito fixado pelo Lead: **duas mudanças, e só duas**. Nada foi corrido nesta volta — a porta 3000
está ocupada com a suíte A do QA e o `--output` dele também é disco. Por isso esta secção tem duas
metades: o que está escrito e verificado por leitura, e o que ainda **não** está medido.

### 1 · `route.ts:42` — `crypto.timingSafeEqual`

Antes, uma comparação com `===` (a linha que o Revisor classificou de BLOQUEIA):

```ts
  return authorization === `Bearer ${secret}`;
```

Depois:

```ts
import { timingSafeEqual } from 'node:crypto';

function autorizado(authorization: string | null): boolean {
  const secret = process.env.CRON_SECRET;

  if (secret === undefined || secret === '') {
    return false;
  }

  const esperado = Buffer.from(`Bearer ${secret}`);

  if (authorization === null) {
    return false;
  }

  const recebido = Buffer.from(authorization);

  if (recebido.length !== esperado.length) {
    return false;
  }

  return timingSafeEqual(recebido, esperado);
}
```

O comprimento decide **antes** da chamada, como pediste: `timingSafeEqual` lança com buffers de
tamanhos diferentes, e a diferença de comprimento não é segredo que valha um 500. A comparação dos
dois buffers é o que passa a custar o mesmo tempo seja qual for o prefixo certo.

Verificação por leitura, com o comando:

```
$ Select-String -Path apps/web/src/app/api/cron/recurrences/route.ts -Pattern "node:crypto|timingSafeEqual|Buffer\.from|length" | ForEach-Object { $_.LineNumber.ToString() + ": " + $_.Line.Trim() }
1: import { timingSafeEqual } from 'node:crypto';
33: * A comparação é em tempo constante (`timingSafeEqual`), não por `===`: é a
50: const esperado = Buffer.from(`Bearer ${secret}`);
56: const recebido = Buffer.from(authorization);
58: if (recebido.length !== esperado.length) {
62: return timingSafeEqual(recebido, esperado);
100: return NextResponse.json({ created, truncated, users: owners.length, failures });

$ (Select-String -Path apps/web/src/app/api/cron/recurrences/route.ts -Pattern 'authorization ===' -SimpleMatch | Measure-Object).Count
1
```

A única `authorization ===` que resta é o `=== null` da guarda de tipo (linha 52); a comparação com
o segredo desapareceu. A rota continua a exportar só `dynamic` e `GET()` — `route.ts` passou de 81
para 101 linhas, tudo dentro de `autorizado()` e do comentário que explica o porquê.

### 2 · `spec :288` — a asserção do `(1)` passa a web-first

Antes (leitura única, a causa do 46/3 na suíte):

```ts
expect(await botao.innerText(), 'a página conta uma série em atraso, como antes').toContain(
  '(1)',
);
```

Depois, uma linha:

```ts
await expect(botao, 'a página conta uma série em atraso, como antes').toContainText('(1)');
```

```
$ Get-Content e2e/46-cron-recorrencias.spec.ts | Select-Object -Skip 285 -First 5
      const botao = page.getByRole('button', { name: /^Gerar as que estão a vencer/ });

      await expect(botao, 'a página conta uma série em atraso, como antes').toContainText('(1)');

      await botao.click();

$ Select-String -Path e2e/46-cron-recorrencias.spec.ts -Pattern "innerText|toContainText" | ForEach-Object { $_.LineNumber.ToString() + ": " + $_.Line.Trim() }
288: await expect(botao, 'a página conta uma série em atraso, como antes').toContainText('(1)');
298: expect(await aviso.innerText(), 'o resumo série a série continua a vir do gerador').toContain(
```

O `:298` ficou como estava: **recusado pelo Lead** com razão de estabilidade (o aviso já foi
esperado antes da leitura, portanto não há corrida para resolver, e mexer seria risco sem ganho).
A spec passou de 322 para 320 linhas — três linhas de asserção dentro de uma.

Estado da árvore nestas duas voltas de escrita (o `git diff` não mostra `route.ts` nem a spec porque
são ficheiros **novos**, não suividos; o mtime é a prova de que só estes dois mexeram):

```
$ Get-Item apps/web/src/app/api/cron/recurrences/route.ts, e2e/46-cron-recorrencias.spec.ts, apps/web/src/server/recurrences-actions.ts | ForEach-Object { $_.LastWriteTime.ToUniversalTime().ToString('HH:mm:ss') + "  " + $_.Name }
15:10:43  route.ts
15:11:18  46-cron-recorrencias.spec.ts
14:47:22  recurrences-actions.ts
```

### 3 · Medições da volta 3 (sinal do Lead na mensagem `c8592f92`; primeiro comando às 15:18:25, último registo às 15:25:03, ambos por `Get-Date`)

Ordem fixada por ele: build → gate → 6 curls → spec isolada. Foi essa a ordem, e nada da suíte
completa foi corrido por mim (é a C do QA sobre este build).

**1 · `build`, e a prova de que o bundle servido contém o patch**

```
$ pnpm build
@repo/web:build: ├ ƒ /api/cron/recurrences
 Tasks:    2 successful, 2 total
Cached:    1 cached, 2 total

$ Get-Item apps/web/.next/BUILD_ID | ForEach-Object { $_.LastWriteTime.ToUniversalTime().ToString('HH:mm:ss') + "  " + (Get-Content apps/web/.next/BUILD_ID) }
15:15:27  rd8EdLmVPkMxkC3HGT6Ll
```

O `BUILD_ID` é de **15:15:27**, posterior às duas escritas da volta 3 (`route.ts` 15:10:43,
`46-cron-recorrencias.spec.ts` 15:11:18) — o critério que pediste. E o `1 cached` tem de ser lido
com cuidado, porque não é o que parece: o mtime do `BUILD_ID` **não mudou** com o meu `pnpm build`
(ficou 15:15:27), portanto a tarefa em cache era mesmo `@repo/web:build` e aquela listagem de rotas
foi o registo reproduzido do cache, não um build novo. Como o cache do turbo é keyed pelas entradas,
um golpe de cache só acontece se o código for o mesmo que estava na árvore às 15:15:27 — que já é
depois do patch. Para isso não ficar em raciocínio, fui ver o bundle servido:

```
$ (Get-ChildItem -Recurse apps/web/.next/server -Include *.js,*.js.map -File | Select-String -Pattern "timingSafeEqual" -List | Measure-Object).Count
5
```

Cinco ficheiros do `.next/server` contêm a string (chunks e mapas). Para não ficar na palavra do
Prettier nem no mapa:

```
$ Get-Item apps/web/.next/server/chunks/_1yex6i9b8f_8g._.js, apps/web/.next/BUILD_ID | ForEach-Object { $_.LastWriteTime.ToUniversalTime().ToString('HH:mm:ss') + "  " + $_.Name }
15:15:19  _1yex6i9b8f_8g._.js
15:15:27  BUILD_ID

$ (Select-String -Path apps/web/.next/server/chunks/_1yex6i9b8f_8g._.js -Pattern "timingSafeEqual" | Measure-Object).Count
1
```

Ou seja: o `timingSafeEqual` está no **código do chunk** (não só no sourcemap), escrito às 15:15:19,
depois do meu patch. É esse `.next` que o `next start` serviu nos curls abaixo, e o `=== Bearer`
desapareceu do fonte.

**2 · `format:check` está vermelho — e não é do meu código**

```
$ pnpm format:check
[warn] e2e/.results-t70-b-iso/.last-run.json
[warn] e2e/.results-t70-b/.last-run.json
[warn] e2e/.results-t70/.last-run.json
Code style issues found in 3 files. Run Prettier with --write to fix.
 ELIFECYCLE  Command failed with exit code 1.
```

Os três são artefactos do Playwright escritos por corridas de outra pessoa — não atribuo cada pasta
a uma suíte; o que está medido são os mtimes e o conteúdo:

```
$ Get-ChildItem -Recurse -Force -Filter ".last-run.json" -Path e2e | ForEach-Object { $_.FullName.Replace("$PWD\", '') + "  " + $_.LastWriteTime.ToUniversalTime().ToString('HH:mm:ss') }
e2e\.results-t70\.last-run.json        15:02:12
e2e\.results-t70-b\.last-run.json      15:14:50
e2e\.results-t70-b-iso\.last-run.json  15:15:52

$ Get-Content e2e/.results-t70/.last-run.json -Raw
{
  "status": "failed",
  "failedTests": [
    "a23f68d40981f1841590-a726f274266400163bcb"
  ]
}
```

A razão é de ignore-path, não de conteúdo — e é uma experiência controlada: **dois** dos três
artefactos queixados são byte-idênticos ao meu (mesmo SHA256), com veredictos opostos; o terceiro
só difere por ter `failedTests` preenchido:

```
$ (Get-FileHash test-results/t70-volta3/.last-run.json).Hash; (Get-FileHash e2e/.results-t70-b/.last-run.json).Hash; (Get-FileHash e2e/.results-t70-b-iso/.last-run.json).Hash; (Get-FileHash e2e/.results-t70/.last-run.json).Hash
91D1C43004802CD49950D78EB11C8FA7D05DA8FFFFE219A8B13B2F561BC00903
91D1C43004802CD49950D78EB11C8FA7D05DA8FFFFE219A8B13B2F561BC00903   <- queixado
91D1C43004802CD49950D78EB11C8FA7D05DA8FFFFE219A8B13B2F561BC00903   <- queixado
6541AF868DA321D24A5D16E3CE3BB46FEB7DD266F134C6B4797CE5890A1B560B   <- queixado (96 bytes, um falho)

$ pnpm exec prettier --check test-results/t70-volta3/.last-run.json          # omissao: .gitignore + .prettierignore
Checking formatting...
All matched files use Prettier code style!

$ pnpm exec prettier --check --ignore-path .prettierignore test-results/t70-volta3/.last-run.json
Checking formatting...
[warn] test-results/t70-volta3/.last-run.json
[warn] Code style issues found in the above file.

$ pnpm exec prettier --check e2e/.results-t70-b/.last-run.json
[warn] e2e/.results-t70-b/.last-run.json

$ $b = [System.IO.File]::ReadAllBytes("$PWD\test-results\t70-volta3\.last-run.json"); $b[-1].ToString('X2')
7D
```

Tres leituras, e cada uma delas é um comando:

1. **o Prettier 3 consulta o `.gitignore` por omissão** — com `--ignore-path .prettierignore` (só o
   outro ficheiro) o mesmo `test-results/…/.last-run.json` passa a ser queixado; por omissão é
   ignorado porque a linha 49 cobre `test-results/`. Confirmado também com `git check-ignore -v`, que
   devolve regra para `test-results/` (49), `e2e/.results/` (53), `relatorios/.qa-*/` (57) e
   `relatorios/.falhas/` (59), e **nenhuma** regra para os três `e2e/.results-t70*`:

   ```
   $ git check-ignore -v e2e/.results-t70/.last-run.json e2e/.results-t70-b/.last-run.json e2e/.results-t70-b-iso/.last-run.json
   exit 1 (nenhum dos tres esta ignorado)
   ```

2. **o queixa-se é da falta de newline final** — o último byte é `7D` (`}`) e o Prettier exige `0A`.
   O Playwright escreve `.last-run.json` sem newline, por isso ele nunca esteve «formatado»: estava
   simplesmente fora do caminho do `prettier --check .`.

3. **nenhum dos três é meu**: os meus `--output` foram sempre `test-results/t70…` (linha 49 do
   `.gitignore`), e os directórios queixados pertencem a corridas que não lancei — mtimes 15:02:12,
   15:14:50 e 15:15:52, nenhum dentro das minhas janelas medidas (14:16-14:32 na volta 1, 14:49 na
   volta 2, 15:18-15:25 nesta).

Correção à versão anterior desta secção: escrevi «É a primeira vez que um `--output` fora desses
padrões entra na árvore» sem o medir. Não medi a história; o que está medido é que os três directórios
actuais não são meus e que o Prettier os apanha por não estarem ignorados.

Como os três ficheiros **não são seguidos**, o `format:check` do CI (clone limpo) não os vê: o
vermelho é desta máquina, não do `main`.

Com âmbito nos meus três ficheiros, a mesma ferramenta diz outra coisa:

```
$ pnpm exec prettier --check apps/web/src/app/api/cron/recurrences/route.ts e2e/46-cron-recorrencias.spec.ts vercel.json
Checking formatting...
All matched files use Prettier code style!
```

Dois cuidados para quem repetir o comando: `.env.example` **não entra** (o Prettier não lhe
infere parser — `error: No parser could be inferred`), e este relatório também não, porque a linha 9
do `.prettierignore` é `*.md`. Por isso o `format:check` nunca viu um `.md` mal formatado.

Não apaguei nem movi os três directórios: não são meus. **Decisão do Lead, 2026-11-19: a segunda
via — uma linha `e2e/.results*/` no `.gitignore`, à linha 54** (`git diff --numstat -- .gitignore`
→ 1/0). Com a regra escrita, as duas saídas que ele pediu: `git check-ignore -v` devolve agora
`.gitignore:54:e2e/.results*/` para os três `.last-run.json` (exit 0; antes era exit 1) e
`pnpm format:check` volta a `All matched files use Prettier code style!` (exit 0). O `format:check`
do fecho será re-corrido por ele, com a suíte C do QA em curso.

E o `2 cached` não é o `apps/web` a vir de um estado antigo — medi os registos por pacote:

```
$ Get-ChildItem -Recurse -Filter "turbo-*.log" | Where-Object { $_.FullName -like '*\.turbo\*' } | Sort-Object FullName | ForEach-Object { $_.LastWriteTime.ToUniversalTime().ToString('HH:mm:ss') + "  " + $_.FullName.Replace("$PWD\", '') }
15:15:28  apps\web\.turbo\turbo-build.log
15:19:40  apps\web\.turbo\turbo-lint.log
15:19:47  apps\web\.turbo\turbo-typecheck.log
14:49:10  packages\db\.turbo\turbo-lint.log
14:49:07  packages\db\.turbo\turbo-typecheck.log
14:49:07  packages\shared\.turbo\turbo-lint.log
14:09:12  packages\shared\.turbo\turbo-test.log
14:49:04  packages\shared\.turbo\turbo-typecheck.log
```

`lint` e `typecheck` do `apps/web` correram **agora** (15:19:40 e 15:19:47), depois das duas
escritas da volta 3 (15:10:43 e 15:11:18). Os dois cache são `packages/db` e `packages/shared`, que a
volta 3 não tocou — logo, o que está verde foi mesmo medido neste código.

```
$ pnpm lint
 Tasks:    4 successful, 4 total
Cached:    2 cached, 4 total

$ pnpm typecheck
 Tasks:    4 successful, 4 total
Cached:    2 cached, 4 total
```

**3 · Os seis `curl` contra o servidor do build novo**

`pnpm --filter @repo/web start` (BUILD_ID `rd8EdLmVPkMxkC3HGT6Ll`, porta 3000 livre antes de
levantar; confirmei `porta 3000 livre: True` e `Get-Item … BUILD_ID` impresso pelo próprio script).
O segredo tem 17 caracteres no `.env` desta máquina — os três casos de comprimento foram construídos
a partir dele sem nunca imprimir o valor:

```
servidor pronto (HTTP 200 em /api/health, 0 tentativas)
BUILD_ID servido: rd8EdLmVPkMxkC3HGT6Ll  mtime 15:15:27
CRON_SECRET do .env: 17 caracteres (valor nunca impresso)

--- 1) sem header
$ curl.exe -s -w '%{http_code}' http://localhost:3000/api/cron/recurrences
HTTP 401
corpo: {"error":"Não autorizado."}
--- 2) header errado, MESMO comprimento (passa pelo timingSafeEqual)
$ curl.exe -s -w '%{http_code}' -H 'Authorization: Bearer [xxx do mesmo comprimento]' http://localhost:3000/api/cron/recurrences
HTTP 401
corpo: {"error":"Não autorizado."}
--- 3) header MAIS CURTO (3 caracteres a menos)
$ curl.exe -s -w '%{http_code}' -H 'Authorization: Bearer [CRON_SECRET sem 3 caracteres]' http://localhost:3000/api/cron/recurrences
HTTP 401
corpo: {"error":"Não autorizado."}
--- 4) header MAIS COMPRIDO (3 caracteres a mais)
$ curl.exe -s -w '%{http_code}' -H 'Authorization: Bearer [CRON_SECRET + zzz]' http://localhost:3000/api/cron/recurrences
HTTP 401
corpo: {"error":"Não autorizado."}
--- 5) header certo
$ curl.exe -s -w '%{http_code}' -H 'Authorization: Bearer [CRON_SECRET do .env]' http://localhost:3000/api/cron/recurrences
HTTP 200
corpo: {"created":0,"truncated":false,"users":0,"failures":0}
--- 6) repeticao, header certo
HTTP 200
corpo: {"created":0,"truncated":false,"users":0,"failures":0}
```

O ponto novo são os casos 2, 3 e 4: o 2 tem **o mesmo comprimento** do segredo, por isso atravessa
a guarda de comprimento e é o `timingSafeEqual` que o recusa; o 3 e o 4 param na guarda, antes da
chamada — que é onde a função teria lançado (` RangeError`) se o `if (recebido.length !== …)` não
estivesse lá. Todos os quatro dão 401 com o mesmo corpo, nenhum deu 500.

Os `created: 0` das chamadas 5 e 6 não são um vazio de prova: àquela hora não havia **nada** em
atraso nesta base (as corridas minhas e do QA já tinham gerado o backlog do `demo` para 05/12 e
08/12, e cada spec apaga o seu utilizador). A geração em si fica medida no ponto 4 abaixo, com
`created: 3` → `created: 0`.

**4 · `spec 46` isolada, com `--output` meu**

```
$ pnpm exec playwright test 46-cron-recorrencias --output=test-results/t70-volta3 --reporter=list
  ok 1 … a porta fecha-se a quem não tem o segredo (36ms)
[T70] primeira chamada (2026-09-10, mensal): {"created":3,"truncated":false,"users":1,"failures":0}
[T70] segunda chamada (idempotência): {"created":0,"truncated":false,"users":0,"failures":0}
[T70] limpeza do cron: {"movimentos":3,"contasAPagar":0,"grupos":0,"contasFinanceiras":0}
  ok 2 … com o segredo gera o atraso de uma vez e não duplica na segunda (3.6s)
[T70] limpeza do botão: {"movimentos":3,"contasAPagar":0,"grupos":0,"contasFinanceiras":0}
[T70] utilizador e2e-cron-mwnp83ws-zibg82@exemplo.pt apagado (1 linha(s)).
  ok 3 … o botão da sessão gera o mesmo atraso, com o mesmo resumo (3.6s)
  3 passed (16.4s)
```

O teste 3 é **exatamente** o que a suíte A do QA viu falhar (`46/3`), e passou com a linha web-first
sobre o build novo — que era a condição que faltava para o remédio contar. Não re-corri a mutação:
deixar o `route.ts` mutado enquanto a suíte C do QA está na fila seria pior do que o ganho.

### 4 · Estado final e um caveat

Nada committido; porta 3000 livre (`porta 3000 livre: True`, e o único PID que matei foi o do
servidor que levantei, 21232, com o launcher 35380). `apps/web/next-env.d.ts` continua modificado
pelos builds, como combinado.

Caveat honesto sobre o `timingSafeEqual`: exige runtime Node. Não há nada neste projeto a declarar
Edge, por isso hoje corre; se um dia a rota for para Edge, o `import { timingSafeEqual } from
'node:crypto'` rebenta no build — e aí é conversa de arquitetura, não linha de remendo. Não está
medido (não sei fazer esta rota correr em Edge sem mudar o projeto).


