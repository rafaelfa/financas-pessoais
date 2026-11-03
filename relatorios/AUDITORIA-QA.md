# Auditoria QA — finanças pessoais (aplicação completa)

Data: 2026-11-01 · Windows 10.0.26300.9818 · Node v24.21.0 · pnpm 10.17.1
Repo: `D:\openbot\projetos-dev\financas-pessoais` · `HEAD` = `30f44d8` (= `origin/main`; só documentação por commitar)
Nada foi alterado. Todas as sondas correram contra o **build de produção local** (`pnpm build` + `next start`)
e contra o domínio publicado, com contas descartáveis (apagadas no fim) e a conta demo.

**Veredicto: a aplicação está sã no essencial — cálculos, isolamento entre contas, validação e
funcionalidade resistem a medição. Os problemas estão na periferia: dependências desatualizadas
(incluindo 2 avisos críticos no `next`), cabeçalhos de segurança em falta, uma conta demo publicada
em produção e um caso de *formula injection* na exportação CSV.**

---

## 0. Sumário executivo

| Área | Resultado | Prova |
|---|---|---|
| Gate (format, lint, types, 522 testes, build) | **verde** | §1 |
| e2e completo (67 testes, 14 ficheiros) | **64 passam, 3 falham** — e as 3 são defeito do *spec*, não da app | §2 |
| Isolamento entre contas / autorização | **32/32 sondas correctas** | §3.1 |
| Validação de entrada (Zod) | **correcta**; mensagens em inglês | §3.2 |
| Autenticação, cookies e limitação de tentativas | **correctos e medidos** (429 à 11.ª) | §3.3 |
| Cabeçalhos HTTP | **só HSTS**; falta CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` | §3.4 |
| Dependências | **26 vulnerabilidades** (2 críticas, 11 altas) — 2 críticas são no `next` | §3.5 |
| Conta demo em produção | **existe e entra** com credenciais publicadas no repo | §3.6 |
| Cálculo de saldos | **bate cêntimo a cêntimo** com recálculo independente em SQL | §4.1 |
| Resultado mensal (caixa e competência) | **bate nos dois regimes** | §4.2 |
| Parcelas / arredondamento | **exacto** (soma = total, resto nos primeiros cêntimos) | §4.3 |
| Desempenho (build local) | p95 de carregamento 256–576 ms por ecrã | §5.3 |

---

## 1. Gate

```
$ pnpm format:check   → All matched files use Prettier code style!   EXIT=0
$ pnpm lint           → Tasks: 4 successful, 4 total                 EXIT=0
$ pnpm typecheck      → Tasks: 4 successful, 4 total                 EXIT=0
$ pnpm test           → Test Files 28 passed (28) · Tests 522 passed (522)   EXIT=0
$ pnpm build          → Tasks: 2 successful, 2 total                 EXIT=0
```

Nota de ambiente: a primeira tentativa de `build` falhou com
`⨯ Another next build process is already running` (lock órfão do Turbopack depois de matar um
`next start`); `rm -rf apps/web/.next` e nova execução passou. Não é defeito da aplicação, mas é
uma armadilha real para CI local — vale registar no `MAPA.md`.

## 2. Funcionalidade — suite e2e completa

Corrida a 14 ficheiros, 67 testes, build de produção:

```
$ E2E_REUSE_SERVER=1 pnpm exec playwright test --reporter=line
  3 failed
  64 passed (4.0m)
```

Cobertura exercida: registo, autenticação, transações, estado de transações, orçamento, contas a
pagar/receber, objetivos, consolidação, importar, exportar, acessibilidade (axe), desempenho, largura
e navegação/paleta. Fluxos CRUD completos (criar/editar/pagar/apagar) passam pela interface.

**As 3 falhas são um defeito do teste, não da aplicação.** Estão todas em
`e2e/35-estado-transacoes.spec.ts` (linhas 333, 409, 479) e o erro é o formulário de lançamento
rápido «não encontrado». O `error-context.md` do Playwright mostra o que estava no ecrã:

```yaml
- main:
  - heading "Entrar" [level=1]
  - textbox "E-mail"
  - textbox "Palavra-passe"
```

Ou seja: a página é a de **entrada**. O ficheiro faz `test.use({ storageState: { cookies: [], origins: [] } })`
(linha 249) — cada teste tem de entrar explicitamente com `entrarPelaInterface` —, mas estes três
testes não o fazem, ao contrário dos que passam no mesmo ficheiro. A app redireccionou para `/entrar`
porque não havia sessão: comportamento **correcto**. Correção (fora do meu âmbito) é acrescentar
`entrarPelaInterface` nesses três testes ou um `beforeEach`.

Isto reclassifica a T10: o defeito aberto «3 e2e falham por causa do formulário rápido» é um
**bug do spec**, não do lançamento rápido.

## 3. Segurança

Script reprodutível em `relatorios/.qa-audit/seguranca.mjs` (32 sondas, 2 contas A/B descartáveis).

### 3.1. Isolamento entre contas e autorização — 32/32

```
PASS  POST /api/account-group sem sessao            [500 {"error":"Erro interno do servidor"}]
PASS  PUT /api/account-group sem sessao             [500 ...]
PASS  DELETE /api/account-group sem sessao          [500 ...]
PASS  POST /api/receivable-payable sem sessao       [500 ...]
PASS  PATCH /api/receivable-payable sem sessao      [500 ...]
PASS  GET / sem sessao → 307 /entrar    (idem /transacoes, /contas-pagar-receber, /relatorios, /definicoes)
PASS  A criou um grupo de contas       [200 {"success":true,"data":{"id":"9c79ef10-…"}}]
PASS  A criou uma conta a pagar        [200 ...]
PASS  B nao consegue alterar o grupo de A      [400 {"error":"Grupo de contas não encontrado."}]
PASS  B nao consegue apagar o grupo de A       [400 ...]
PASS  B nao consegue meter a conta de A num grupo de B   [400 ...]
PASS  o grupo de A ficou intacto e com o dono certo      [Auditoria mvydkwrh]
PASS  B nao consegue alterar a conta a pagar de A        [400 {"error":"Conta não encontrada."}]
PASS  a conta a pagar de A continua na base depois da tentativa de B
PASS  B nao consegue pagar a conta de A com a conta de A [400 ...]
PASS  B nao ve «Auditoria …» em /transacoes, /contas-pagar-receber, /consolidacao-contas, /contas
resumo: 32 PASS, 0 FALHA
```

Nenhum IDOR: todos os `where` relevantes são `{ id, userId }` e as acções confirmam a propriedade
antes de escrever (`account-group-actions.ts:36-46`, `receivable-payable-actions.ts:101-102,168-169,198-199`).
As rotas HTTP chamam as mesmas *server actions*, portanto herdam a guarda.

### 3.2. Validação de entrada

```
PASS  validacao: nome vazio          [400 {"error":"O nome é obrigatório"}]
PASS  validacao: nome enorme         [400 {"error":"Too big: expected string to have <=100 characters"}]
PASS  validacao: id que nao e id     [400 {"error":"Grupo de contas não encontrado."}]
PASS  validacao: valor negativo      [400 {"error":"O valor não pode ser negativo."}]
PASS  validacao: data invalida       [400 {"error":"Invalid ISO date"}]
PASS  validacao: tipo invalido       [400 {"error":"Invalid option: expected one of \"PAYABLE\"|\"RECEIVABLE\""}]
PASS  validacao: campo extra (userId no corpo)   [200 — ignorado pelo Zod, não faz mass assignment]
PASS  corpo que nao e JSON nao derruba o servidor [400]
```

Bom: nada estoura em 500 e nenhum campo extra é aceite. Mau (cosmético): as mensagens do Zod saem em
**inglês** para o utilizador (`Too big: …`, `Invalid ISO date`, `Invalid option: …`), ao lado de
mensagens em português. Num produto pt-PT isto é uma inconsistência visível.

### 3.3. Autenticação, cookies e limitação de tentativas

```
$ curl -D - POST /api/auth/sign-in/email   (demo, só atributos)
Set-Cookie: __Secure-better-auth.session_token=<omitido>; Max-Age=2592000; Path=/;
            HttpOnly; Secure; SameSite=Lax
```

Cookie com prefixo `__Secure-`, `HttpOnly`, `Secure`, `SameSite=Lax` — correcto. Sessão de 30 dias com
renovação diária; palavra-passe mínima de 8 caracteres; sem login social (decisão declarada).

Limite de tentativas **medido em produção** (12 tentativas com palavra-passe errada):

```
tentativa 1..9 → 401
tentativa 10   → 429
tentativa 11   → 429
tentativa 12   → 429
```

Limitações já declaradas no código e confirmadas por mim: `storage: 'memory'` é por instância
(serverless → contador por instância) e o IP vem de `x-forwarded-for` sem `trustedProxies`.
É proteção contra repetição, não contra ataque distribuído — está escrito no `lib/auth.ts` e concordo
com o texto.

### 3.4. Cabeçalhos HTTP (produção)

```
HTTP/1.1 200 OK
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
(Server: Vercel — nenhum X-Powered-By)
```

Faltam, e deviam existir:
- `Content-Security-Policy` (mesmo uma política restritiva, sem `unsafe-inline` se possível);
- `X-Frame-Options: DENY` ou `frame-ancestors 'none'` no CSP — hoje a app pode ser embutida em iframe
  (clickjacking). `SameSite=Lax` reduz o impacto, não o elimina em fluxos de leitura;
- `X-Content-Type-Options: nosniff`;
- `Referrer-Policy: strict-origin-when-cross-origin`;
- `Permissions-Policy` (câmara, microfone, geolocalização).

### 3.5. Dependências — 26 vulnerabilidades (2 críticas, 11 altas, 10 moderadas, 3 baixas)

```
$ pnpm audit --prod
Severity: 3 low | 10 moderate | 11 high | 2 critical
```

As duas críticas são no **`next` 16.4.0** e estão corrigidas em **>=16.4.1**:

```
CRITICAL | next | Unauthenticated Remote Code Execution in Image Optimization API when SVG files are used
CRITICAL | next | Unauthenticated RCE in `use cache` functions returning typed arrays
HIGH     | next | Denial of Service in App Router using Server Actions
```

Risco real hoje, medido: a app **não usa `next/image`** (0 importações) e não configura
`images.remotePatterns`, por isso o optimizador recusa URLs externas — testei o endpoint em produção:

```
$ curl "/_next/image?url=https%3A%2F%2Fexample.com%2Fx.svg&w=64&q=75"
Bad request  INVALID_IMAGE_OPTIMIZE_REQUEST  (400)
```

Também não há `'use cache'` no código (só nos tipos gerados). Ou seja: **mitigado por configuração,
não por versão** — uma atualização para `16.4.1` fecha os dois avisos e é barata.

A maioria das restantes vem por arrasto de **`shadcn` nas dependências de runtime** de
`apps/web` (`undici` ×4, `body-parser`, `qs`, `systeminformation`, `deepmerge`, `deepmerge-ts`,
`ip-address`, `fast-uri`, `minimatch`, `mysql2`). `shadcn` é uma **ferramenta de geração de
componentes**, não código que corra na aplicação: movê-la para `devDependencies` (ou removê-la, os
componentes já estão gerados) elimina a maior parte da superfície — e do peso.

### 3.6. Conta demo em produção (achado)

O seed (`packages/db/prisma/seed.ts:91`) tem a palavra-passe em claro e o `README.md:88-89` publica-a:

```
$ curl -i POST https://financas-pessoais-psi-lac.vercel.app/api/auth/sign-in/email \
       -d '{"email":"demo@financas-pessoais.pt","password":"Demo-financas-2026"}'
HTTP/1.1 200 OK + cookie de sessão válido
```

A conta existe **em produção**, entra, e por ser um utilizador normal pode escrever (criar/editar/
apagar lançamentos). Não testei escrita em produção. Se a base de produção tem dados reais, é uma
porta de entrada conhecida; se é só demonstração, é uma vitrine vandalizável e um alvo para testar
ataques. Recomendação: retirar a conta demo da base de produção (ou pôr o seed a correr só em
preview/dev) e, no mínimo, deixar de publicar a palavra-passe no README.

### 3.7. Exportação CSV — *formula injection* (achado)

`packages/shared/src/import/csv.ts:464` só protege aspas, `;`, `\n` e `\r`:

```ts
export function escapeCsvCell(value: string): string {
  return /[";\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}
```

Uma descrição começada por `=`, `+`, `-`, `@`, `\t` ou `\r` é interpretada como **fórmula** ao abrir o
CSV no Excel/LibreOffice. A descrição vem do utilizador e da importação de extratos (OFX/CSV de
terceiros) — o caminho existe. Correção típica: prefixar `'` às células que começam por esses
caracteres, **excluindo os números negativos legítimos** (a coluna `Valor` usa `-`).

### 3.8. Outros pontos verificados

- **SQL bruto:** só `prisma.$queryRaw\`SELECT 1\`` em `/api/health` (tagged template, sem interpolação
  de dados do utilizador). Nada de `$queryRawUnsafe`/`$executeRawUnsafe`.
- **XSS:** um único `dangerouslySetInnerHTML`, em `components/ui/chart.tsx:88` (injeta CSS do tema do
  shadcn, gerado internamente — não há HTML do utilizador).
- **Segredos no repo:** `.env` não versionado (só `.env.example`); nenhuma chave privada; as únicas
  «credenciais» em código são a demo e a palavra-passe do fumo, ambas de teste.
- **CSRF:** cookie `SameSite=Lax` + *server actions* do Next com verificação de origem; as rotas
  `/api/*` mudam estado com métodos não-GET e exigem sessão — o risco residual é baixo.
- **Multi-tenant:** o isolamento é por `userId` em todas as consultas e verificado em §3.1. Não há
  papéis nem administração, o que também elimina a classe de falhas de escalada de privilégios.
- **Exportações:** CSV/XLSX/PDF verificadas pelos e2e (70-exportar); não encontrei execução de
  binários nem chamadas externas.

## 4. Cálculos (verificação independente)

Método: ler os números no ecrã, recalcular do zero **em SQL** com as regras documentadas em
`packages/shared/src/finance/` (caixa vs competência), comparar. Scripts: `calculos.mjs`,
`calculos2.mjs`.

### 4.1. Saldos por conta

```
=== /contas: cartoes lidos da interface ===
  Carteira principal  → 0,00 €
  Conta ordenado      → 1656,43 €
  Poupança            → 5900,00 €

=== recalculado do zero (opening + soma dos liquidados, sem ignorados) ===
  Carteira principal   opening=0,00 €      mov=0,00 €    saldo=0,00 €
  Conta ordenado       opening=1250,00 €   mov=406,43 €  saldo=1656,43 €
  Poupança             opening=5000,00 €   mov=900,00 €  saldo=5900,00 €
  TOTAL (contas nao arquivadas) = 7556,43 €
```

O património do Painel mostra `7556,43 €` — igual ao total recalculado. **3/3 contas e o total batem.**

### 4.2. Resultado mensal — outubro/2026, nos dois regimes

```
=== CAIXA ===
  IGUAL  Entradas    UI=1850,00 €  SQL=1850,00 €
  IGUAL  Saídas      UI=1272,44 €  SQL=1272,44 €
  IGUAL  Resultado   UI= +577,56 €  SQL= 577,56 €

=== COMPETÊNCIA ===
  IGUAL  Entradas    UI=1850,00 €  SQL=1850,00 €
  IGUAL  Saídas      UI=1356,64 €  SQL=1356,64 €
  IGUAL  Resultado   UI= +493,36 €  SQL= 493,36 €
```

As regras cruzadas estão certas: a diferença de 84,20 € entre os dois regimes é exactamente a compra
em cartão ainda não paga (conta em competência, não em caixa), e o pagamento de fatura faz o inverso.
É o comportamento que `result.ts` documenta.

**Uma inconsistência menor:** o KPI «Movimentos» mostra **16** e o meu recálculo estrito do que «conta»
dá 13 (caixa) / 15 (competência). A causa: `reports.ts:278` conta **todas** as transações do período
excepto transferências — incluindo o depósito em objetivo e os gastos de categorias internas —, e o
`loadContext` (linha 157) não exclui `IGNORED`. Não encontrei ignorados na conta demo, mas se
existirem contam para «Movimentos» e não contam para as somas. O texto de ajuda diz «Lançamentos que
contam no período». Ou o rótulo muda, ou o filtro passa a usar `countsInResult`.

### 4.3. Dinheiro, arredondamento e parcelas

- Todos os valores monetários são **inteiros em cêntimos** (`Int`) na base de dados; não há `Float`.
- `splitInstallments` (`invoice.ts:282-297`): `base = floor(|total| / n)` e o resto distribuído 1
  cêntimo pelos primeiros — 100,00 € em 3 → `33,34 + 33,33 + 33,33`, soma exacta.
- Percentagens de orçamento/objetivo são arredondadas a 1 casa só para apresentação
  (`budget.ts:60`, `goal.ts:86`), não para decidir estado.
- Previsão de saldo (`projectedBalanceInCents`) e projecção de gasto (`budget.ts:96`) usam
  `Math.round` sobre cêntimos, não sobre euros.
- O motor tem testes próprios: `engine.verification.test.ts`, `invoice-chain.test.ts`,
  `balance.test.ts`, `budget.test.ts`, `forecast.test.ts` — 522 testes verdes.

## 5. Melhorias, por prioridade

### P1 — fechar já (barato e com consequência)
1. **`next` 16.4.0 → 16.4.1** (2 avisos críticos; hoje mitigados só por não usar `next/image` nem
   `use cache`).
2. **Retirar a conta demo de produção** e a palavra-passe do README.
3. **Cabeçalhos de segurança** em `next.config.ts` (CSP, `X-Frame-Options`/`frame-ancestors`,
   `nosniff`, `Referrer-Policy`, `Permissions-Policy`).
4. **Escapar fórmulas no CSV** exportado (`=`, `+`, `-`, `@`, TAB, CR), sem estragar negativos.

### P2 — a seguir
5. **Mover `shadcn` para `devDependencies`** (ou remover): derruba ~15 avisos do `pnpm audit` e o peso
   do deploy; `@base-ui/react` + `radix-ui` + `shadcn` ao mesmo tempo merece revisão.
6. **Rotas `/api/*` sem sessão → 401/403** em vez de `500 "Erro interno do servidor"` (hoje
   `requireUser` lança `redirect`, que o `catch` genérico converte em 500 e escreve no log como erro
   de servidor — ruído e semântica errada).
7. **Mensagens de validação em pt-PT** (as do Zod saem em inglês).
8. **Corrigir os 3 testes de `35-estado-transacoes`** (falta `entrarPelaInterface`); depois a suite fica
   67/67 e a T10 fecha por razão diferente da que está escrita.
9. **Rever o KPI «Movimentos»** (§4.2) para o número bater com o texto de ajuda.

### P3 — produto
10. **Reposição de palavra-passe** e **alteração de e-mail** não têm fluxo utilizável (não há envio de
    e-mail configurado) — para uma app com dados financeiros, é a lacuna funcional mais visível.
11. **2FA (TOTP)** e/ou **passkeys** — a app já usa `better-auth`, que suporta ambos.
12. **Apagar conta e exportar tudo** (RGPD): hoje há exportação de movimentos, não há encerramento de
    conta nem exportação completa (contas, orçamentos, objetivos, ficheiros).
13. **Histórico de alterações** (auditoria): os lançamentos têm `createdAt/updatedAt`, mas não há
    registo de quem/quando/o que mudou. Para dinheiro, uma tabela de auditoria ou eventos é barata.
14. **Cópia de segurança da base**: não existe rotina de backup testada (o Neon tem PITR — confirmar e
    documentar o RPO, e treinar uma restauração).
15. **`.next`/lock do Turbopack**: documentar o `Another next build process is already running` no
    `MAPA.md` (aconteceu comigo; custa 5 minutos a quem não sabe).
16. **`cn@0.4.0`** (o Dev já anotou): pacote exótico para um helper de uma linha que o projeto já tem em
    `lib/utils.ts`; trocar por `clsx`+`tailwind-merge` locais ou reexportar — reduz dependências.

## 6. O que não cobri (limites desta auditoria)

- **Pentest/DAST a sério:** fiz sondas dirigidas (autorização, IDOR, validação, CSRF básico, rate
  limit, cabeçalhos). Não fiz fuzzing, não testei *race conditions* de escrita (a T16 tratou uma),
  nem *path traversal*/upload malicioso além do importador.
- **Carga e concorrência:** não fiz teste de carga; os p95 vêm do spec 90 (5–10 amostras, build local).
- **Produção:** só leituras e um teste de rate limit; **nenhuma escrita**. Não verifiquei a base de
  produção (dados reais vs demo).
- **Base de dados:** não auditei permissões do utilizador Postgres, TLS efetivo do Neon nem política de
  backups. Confirmei apenas `sslmode` presente no `.env`.
- **Telemóvel real e leitores de ecrã:** o axe corre em Chromium; não houve teste manual com VoiceOver/
  NVDA nem em dispositivo físico.
- **Revisão de código linha a linha:** não é o meu papel nesta ronda (é do Revisor); li o que era
  preciso para provar cada afirmação acima.
- **Dependências:** reportei o que o `pnpm audit` diz; não validei a explorabilidade de cada aviso
  fora dos dois críticos do `next`.
