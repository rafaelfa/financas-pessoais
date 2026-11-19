# T70 — Revisor de Código

Base: `b475f14` · Diff: HEAD da árvore de trabalho (novos `??: cron/recurrences/route.ts`, `recurrence-generation.ts`, `vercel.json`, `e2e/46-cron-recorrencias.spec.ts`; modificado `M: .env.example`, `recurrences-actions.ts`).

## Adenda — volta 3 (`autorizado()`: `crypto.timingSafeEqual`)

O Diff da árvore de trabalho (não stageado — ficheiro novo, permanece `??` no git):

- nova importação `import { timingSafeEqual } from 'node:crypto';`
- `esperado = Buffer.from(\`Bearer ${secret}\`)` construído antes das comparações
- `if (authorization === null)` → `false` (guarda explicita para cabecalho inexistente)
- `if (recebido.length !== esperado.length)` → `false` (comprimento sempre rejeitado ANTES de `timingSafeEqual`)
- `return timingSafeEqual(recebido, esperado)` só executado quando comprimentos iguais

A análise confirma: comprimento diferente é rejeitado numa ramificação O(1) sem acesso ao conteúdo; só dois buffers idênticos em tamanho chegam à chamada constante. Sem caminho lateral de timing. Veredicto anterior: **fechada**.

Adicional: o `await expect(botao).toContainText('(1')` no spec 46:288 muda `innerText()` imediato para web-first retry automático — resolução legítima de flake visual.

---

## Veredicto

BLOQUEIA 1 (timing) fechada na volta 3 com `crypto.timingSafeEqual` + rejeição de comprimento antes da chamada; BLOQUEIA 2 e DEVE 3 recusados pelo Lead (maxDuration 300s, produção tem 2 linhas/1 dono → Seq Scan é optimal).

### OPCIONAL 1

`route.ts:78-80` · falhanço parcial devolve 200 com `failures: n`. Gatilho: 3 utilizadores, um falha → resposta `{created: X, truncated: false, users: 3, failures: 1}`. Consequência: quem chama não sabe *quem* falhou, só quantos. Correção: array `failedUsers: [{userId, reason}]` ou status específico por utilizador. Classificação: **OPCIONAL**.

### OPCIONAL 2

`recurrence-generation.ts:116-137` · criação de transacções em loop dentro de uma transação. Gatilho: série com 12 datas em atraso → 12 `transaction.create` numa única `$transaction`. Consequência: transaction oversized se uma série tiver muitas datas pendentes; poderia ser batch insert. Classificação: **OPCIONAL**.

### OPCIONAL 3

`46-cron-recorrencias.spec.ts:78-119` · spec cria e apaga utilizador próprio em `beforeAll`/`afterAll`. Gatilho: execução standalone deste spec. Consequência: overhead de registo + login + limpeza em cada corrida (~2-3s); em CI com specs paralelos, risco de colisão de email se não for totalmente determinístico. Classificação: **OPCIONAL**.

---

### Nota sobre a reescrita do `route.ts` (220→81)

O ficheiro é novo no git (nunca houve versão anterior commitada), portanto não há como comparar caracter a caracter com a suposta volta 1. O que está na árvore de trabalho é tudo o que existe; não posso verificar se a guarda e o corpo da volta 1 são idênticos.

### Nota (a): `process.loadEnvFile`

Não há qualquer dependência em todo o repositório que faça `delete process.env` ou que dependa desse padrão. A observação do Lead não afeta nada aqui. Zero provas contrárias encontradas.

### Nota (b): rota global

Decisão minha: manter a rota global, tal como D22 determina. Não há mecanismo neste projeto para segmentar por conta multi-tenant — não é uma escolha técnica disponível, é apenas uma decisão operacional (quien tem o segredo tem acesso a tudo).

---

## Não verifiquei

- Construção efetiva (`pnpm build` / `tsc`) — não correu
- Suíte de testes unitários/integração — não correu
- Comportamento real do Playwright nesta máquina
- Contagem real de utilizadores com séries em atraso em produção
- Limites concretos de `maxDuration` no plano Hobby da Vercel (limitado a 30s pela documentação pública)
- Se `vercel.json` passa validação na CLI `vercel` (não tenho a CLI instalada)
- Gate completo (format, lint, typecheck, test, build)
