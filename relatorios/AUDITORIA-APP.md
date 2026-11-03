# Auditoria da aplicação — segurança, função e cálculos

**Data:** 2026-11-01 · **Commit auditado:** `30f44d8` (publicado) · **Autor:** Dev
**Âmbito:** toda a aplicação `apps/web` + `packages/shared` + `packages/db` (281 ficheiros, ~51 mil linhas).
**Nenhuma alteração de código foi feita** — este documento é só diagnóstico.

---

## Veredicto em uma linha

A **engenharia é sólida** — isolamento por utilizador consistente, dinheiro em cêntimos inteiros, datas sem
fuso, concorrência tratada e 522 testes verdes — mas há **um problema crítico de dependências** (Next.js
16.4.0 com duas falhas de execução remota conhecidas), **uma dependência de produção que não devia lá estar**
(`shadcn`, um CLI), **um bug de dinheiro real** na edição de parcelamentos, e uma **incoerência entre o
limite de validação e o da coluna** em dois sítios. Nada disto exige redesenho: são correções pequenas e
localizadas.

---

## 1. Achados, por severidade

| # | Sev. | O que | Onde | Esforço |
|---|---|---|---|---|
| 1 | **Crítica** | Next.js 16.4.0 tem 2 CVE críticas (RCE na otimização de imagens com SVG; RCE em funções `use cache` que devolvem typed arrays) e 1 alta (DoS em Server Actions) | `apps/web/package.json` (`next 16.4.0`) | horas (upgrade + gate) |
| 2 | **Alta** | `shadcn` (CLI) está em `dependencies` e **nunca é importado**; arrasta express, body-parser, undici, systeminformation para a árvore de produção — 10 dos 25 avisos do `pnpm audit --prod` vêm daqui | `apps/web/package.json` | minutos |
| 3 | **Alta** | Editar um parcelamento força o sinal negativo: um plano de **estorno** (entrada) passa a despesa depois de editado | `apps/web/src/server/installments-actions.ts:150` | baixo |
| 4 | Média | Duas validações aceitam ±99 999 999 999 cêntimos (≈1 mil milhões €) mas a coluna é `Int` (máx. 21 474 836,47 €): valor nesse intervalo passa a validação e falha no `INSERT` com 500 | `packages/shared/src/schemas/domain/transactions.ts:44-47`, `.../accounts.ts:61-62` | baixo |
| 5 | Média | Sem cabeçalhos de segurança: não há `middleware.ts`, nem CSP, `X-Frame-Options`, `Referrer-Policy` ou `Permissions-Policy` | `apps/web/next.config.ts` / ausência de middleware | baixo |
| 6 | Baixa | Exportação CSV não neutraliza fórmulas: uma descrição a começar por `=`, `+`, `-` ou `@` (que pode entrar por importação OFX/CSV) abre como fórmula no Excel | `apps/web/src/server/reports-export.ts:31-34` | baixo |
| 7 | Baixa | Dois arrays de entrada sem limite (`tags`, `accountIds`) — vetor conhecido de exaustão de memória no Zod | `packages/shared/src/schemas/domain/receivable-payable.ts:28,65` | baixo |
| 8 | Baixa | Duas rotas HTTP existem só para integrações/testes e não têm consumidor na interface; herdam a autorização das ações, mas são superfície a mais (sem CSRF explícito, sem limite de pedidos próprio) | `apps/web/src/app/(app)/api/account-group/route.ts`, `.../receivable-payable/route.ts` | baixo |
| 9 | Info | `parseCurrencyToCents("1,005")` → 100 cêntimos: arredonda 3+ casas em silêncio | `packages/shared/src/utils/currency.ts:63-73` | — |

### 1.1 Dependências — a parte que exige ação (medida agora)

```text
$ pnpm audit --prod
25 vulnerabilidades: 2 critical | 10 high | 10 moderate | 3 low

CRITICAL | next | RCE in Image Optimization API when SVG files are used
CRITICAL | next | RCE in `use cache` functions returning typed arrays
HIGH     | next | Denial of Service in App Router using Server Actions
HIGH     | deepmerge-ts  ← better-auth > prisma > @prisma/config
HIGH     | mysql2        ← better-auth (driver de MySQL, não usado: a app é Postgres)
HIGH     | zod           ← zod directo + cópia dentro de shadcn
HIGH     | body-parser / undici ×4 / systeminformation  ← todos por dentro de `shadcn`
```

Duas notas que interessam:

- **`shadcn` em `dependencies`.** É uma ferramenta de linha de comandos (`npx shadcn add …`). Não é
  importada em lado nenhum do produto (`grep -rn "from 'shadcn'"` → 0 resultados). Como está em
  `dependencies`, entra na árvore de produção: `express`, `body-parser`, `undici`, `systeminformation`,
  `@modelcontextprotocol/sdk` e uma segunda cópia de `zod`. Passá-la para `devDependencies` remove ~10
  dos 25 avisos sem tocar em código.
- **`mysql2`** vem por arrasto do `better-auth` (que suporta vários motores); não é usado, mas não se
  remove sem `overrides` no `pnpm`. Fica registado.

### 1.2 O bug de dinheiro: parcelamento editado troca de sinal

O caminho de **criação** está correto e explicitamente comentado:

```ts
// apps/web/src/server/transactions-actions.ts:294-296
const magnitudes = splitInstallments(value.amountInCents, count);
// O sinal do movimento é o do valor original: um estorno parcelado continua a ser uma entrada.
const sign = value.amountInCents < 0 ? -1 : 1;
```

O caminho de **edição** não:

```ts
// apps/web/src/server/installments-actions.ts:150
amountInCents: -amount,   // sempre negativo
```

E o total é recalculado por magnitude, perdendo o sinal:

```ts
// apps/web/src/server/installments-actions.ts:99-101
const totalAmountInCents =
  value.totalAmountInCents ?? rows.reduce((total, row) => total + Math.abs(row.amountInCents), 0);
```

Consequência: um parcelamento cujo valor original é uma **entrada** (estorno no cartão, `kind: 'income'`,
valor positivo) é gravado pela criação com parcelas positivas; ao ser editado, todas as parcelas passam a
negativas. O saldo da fatura e o resultado do mês mudam de sinal — sem aviso. `splitInstallments` devolve
magnitudes por contrato (`split(-1000,3) = [334,333,333]`, verificado), portanto quem chama **tem** de
reaplicar o sinal; a criação faz, a edição não.

**Correção proposta (sem a executar):** derivar o sinal das parcelas existentes
(`Math.sign(first.amountInCents)`) e aplicá-lo na escrita; somar o total com o sinal, não com `Math.abs`.
**Cobertura:** não existe nenhum teste e2e que mencione «parcela» ou «parcelamento» — é por isso que passa.

### 1.3 Limite de validação ≠ limite da coluna

```ts
// packages/shared/src/schemas/domain/primitives.ts:34
export const MAX_AMOUNT_IN_CENTS = 2_147_483_647;   // Int do Postgres

// mas em dois sítios o limite foi escrito à mão, 47× acima:
// transactions.ts:44-47 e accounts.ts:61-62
value <= 999_999_999_99 && value >= -999_999_999_99
```

Um valor entre 21 474 836,47 € e 999 999 999,99 € passa a validação e só falha no `INSERT` — devolvendo
um erro de base de dados em vez de uma mensagem de campo. **Correção:** usar `centsSchema`
(ou `MAX_AMOUNT_IN_CENTS`) nos dois sítios.

### 1.4 Cabeçalhos de segurança

Não existe `middleware.ts`. A Vercel acrescenta `strict-transport-security` e o Next já envia
`x-content-type-options`/`x-frame-options` por omissão em algumas rotas, mas **não há CSP nem
`Referrer-Policy`** declaradas pelo projeto. Como há um `dangerouslySetInnerHTML` legítimo em
`components/ui/chart.tsx:88` (CSS injetado pelo componente de gráficos), uma CSP teria de permitir
`style-src 'unsafe-inline'` — pelo que a CSP aqui vale pelo resto (`script-src 'self'`, `frame-ancestors`).

---

## 2. O que está sólido (e como o verifiquei)

Não é cortesia: são coisas que medi e que justificam **não** mexer.

**Isolamento entre contas.** Há uma única guarda (`apps/web/src/server/session.ts` → `requireUser`) e o
layout autenticado é que a aplica — «é impossível acrescentar um ecrã novo e esquecer-se de o proteger».
Nenhuma ação aceita `userId` do cliente (`grep` a `userId` em assinaturas/parâmetros → 0). Analisei as
**193 chamadas** ao Prisma em `server/*.ts`: 28 mutavam por `id` sem `userId` na própria consulta e
amostrei 6 (`budgets`, `categories`, `goals`, `receivable-payable`, `account-group`, `transactions`); todas
são precedidas de `findFirst({ where: { id, userId } })` e falham antes de escrever. O padrão é correto,
embora frágil: vive da disciplina de quem escreve a próxima ação.

**Dinheiro.** Tudo em cêntimos inteiros; `splitInstallments` reparte sem perder nem inventar cêntimos
(`split(9999,7)` soma exatamente 9999, verificado). Não há `parseFloat` no motor financeiro; a conversão de
texto para cêntimos é feita num sítio só (`currency.ts`).

**Datas.** Datas de calendário são `YYYY-MM-DD` e toda a aritmética é em UTC (`period.ts`), com
`addMonths` a **limitar** ao último dia do mês (`2026-01-31 + 1 mês = 2026-02-28`) em vez de transbordar.
«Hoje» vem de `todayInLisbon()` com `timeZone: 'Europe/Lisbon'` — não de `toISOString()`. Verifiquei a
passagem da hora de verão (`2026-03-29 + 1 dia = 2026-03-30`, `daysBetween = 1`).

**Concorrência.** O pagamento de uma conta a pagar usa `updateMany` condicional
(`status: { not: 'PAID' }`) e recusa quando `count === 0` (`receivable-payable-actions.ts:198-209`) — a
guarda da T16 continua no sítio.

**Autenticação.** `better-auth` com limite de tentativas **explícito e justificado** (`lib/auth.ts`:
10/min para entrada, 20/min para registo), mínimo de 8 caracteres, sem entrada automática após registo.

**Segredos.** `.env` nunca esteve no histórico (`git log --all -- .env` → vazio), está no `.gitignore` e a
ambiente é validada com Zod no arranque (`lib/env.ts`), falhando alto com mensagem útil. Nenhuma chave,
token ou palavra-passe escrita no código.

**Qualidade do gate.** `format:check`, `lint`, `typecheck`, `build` — todos exit 0 agora; `test` → **28
ficheiros, 522 testes**, incluindo um teste de verificação do motor financeiro com geração aleatória de
casos. Não há `catch {}` que engula erro de escrita: os seis que existem são quedas deliberadas para
estado vazio (JSON local corrompido, fatura apagada num link antigo, sonda de saúde).

---

## 3. Melhorias sugeridas (por ordem de valor por esforço)

1. **Subir o Next** (`next upgrade --agent=security`), correr o gate e republicar. É a única coisa
   crítica desta lista e resolve 3 avisos (2 críticos).
2. **Tirar o `shadcn` das dependências de produção** (ou removê-lo). Nove avisos caem com uma linha.
3. **Corrigir o sinal na edição de parcelamentos** (ver §1.2) e escrever o teste que faltava: um plano de
   entrada editado tem de continuar entrada. É o único bug funcional encontrado.
4. **Alinhar os limites de valor** com `MAX_AMOUNT_IN_CENTS` (§1.3) — evita um 500 por um número grande.
5. **Adicionar `middleware.ts` com CSP mínima + `Referrer-Policy` + `Permissions-Policy`**, e decidir
   `X-Frame-Options: DENY` (a app não é para ser embutida).
6. **Neutralizar fórmulas no CSV** (prefixar `'` quando a célula começa por `= + - @`), nos dois
   exportadores.
7. **Limitar arrays de entrada** (`.max(20)` em `tags`, `.max(200)` em `accountIds`).
8. **Documentar no `splitInstallments`** que devolve magnitudes e que o sinal é do chamador — a assinatura
   convida ao erro que o §1.2 mostra.
9. **Fechar as duas rotas HTTP sem consumidor** (`/api/account-group`, `/api/receivable-payable`) ou
   assumi-las como API pública, com limite de pedidos e teste próprio.
10. **Escrever o primeiro e2e de parcelamentos** — hoje é a funcionalidade com mais aritmética e menos
    cobertura de ponta a ponta.

---

## 4. O que não cobri

- **Não testei a produção** nesta auditoria (só o build local). A verificação em produção da T23 foi feita
  antes, no commit `30f44d8`, e está descrita em `relatorios/T23.md`.
- **Não fiz teste de intrusão**: não tentei explorar as CVE do Next, nem forçar IDOR com dois
  utilizadores reais em paralelo. As conclusões de isolamento vêm de leitura + amostragem das chamadas.
- **Não auditei o `packages/db`** linha a linha (índices, migrações, `onDelete`): vi o esquema e as
  relacões usadas pelos serviços, não a política de retenção nem o desempenho das consultas com volume.
- **Não avaliei acessibilidade nem desempenho** — são os specs 80 e 90, que correm no CI e têm histórico
  próprio.
- **Não revisei os microtextos restantes** (T25) nem a acessibilidade da paleta (T22/T24): já estão
  registados no quadro.

**Ficheiros deste relatório:** nada foi alterado no código. O documento é o único artefacto.
