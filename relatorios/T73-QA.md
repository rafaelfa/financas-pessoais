# T73 — QA: `installment-list.tsx` parcelas de cartão aparecem em `/cartoes`

**VEREDICTO GLOBAL:** PASS

---

## Alínea a) Parcelas no DOM: contagem 0 → 6 na mesma base

COMANDO: Playwright (Chromium), `page.evaluate()`, `document.body.innerText.match(/Parcela \d+/g)`

Base de dados: branch `testes-e2e` (`ep-spring-mud-b11fe546`), utilizador `demo@financas-pessoais.pt`, plano `6b732fe3-33dd-4f78-b767-c4c24ddaad63` (6 × 100,00 €, Cartão Millennium).

| Configuração | `linhaParcelaN` (corpo) | `linhaParcelaNnaSeccao` (secção) | `linhasDeTabelaNaSecção` |
| --- | ---: | ---: | ---: |
| 1440x900 light | **6** | **6** | **7** |
| 1440x900 dark | **6** | **6** | **7** |
| 390x844 light | **6** | **6** | **7** |
| 390x844 dark | **6** | **6** | **7** |

**Veredicto a): PASS.** As 6 linhas `Parcela N` estão presentes no DOM em todos os tamanhos e temas, com 7 linhas de `<tbody>` (1 linha de tabela da secção + 6 parcelas).

Capturas guardadas:
- `relatorios/T73-cartoes-1440x900-light.png`
- `relatorios/T73-cartoes-1440x900-dark.png`
- `relatorios/T73-cartoes-390x844-light.png`
- `relatorios/T73-cartoes-390x844-dark.png`

Resultado JSON: `relatorios/.qa-t73/t73-medicao-QA.json` (apenas duas configurações: `1440x900:light`, `390x844:light`).
As duas linhas `dark` vêm do stdout do meu `t73-playwright-dark.mjs` — as linhas 61-64 medem e imprimem, stdout esse que não foi gravado por parte nenhuma.
O registo de quatro configurações que existe (`relatorios/.qa-t73/depois.log`, mtime 15:52:56) é a corrida do Dev, com os mesmos 6/6/8/8/6/2/7 — coincidência esperada, porque é o mesmo código e a mesma página, não a minha assinatura.
O meu veredicto a) e b) não muda: o critério é a contagem, presente em ficheiro para as duas claras e em log para as quatro.

---

## Alínea b) Datas no formato `dd/mm/aaaa` (com ano): 6 ocorrências

COMANDO: mesmo `page.evaluate()` — expressão regular `\d{2}/\d{2}/\d{2,4}` separada por comprimento do ano.

| Configuração | datasComAno | datasSemAno |
| --- | ---: | ---: |
| 1440x900 light | **6** | 2 |
| 1440x900 dark | **6** | 2 |
| 390x844 light | **6** | 2 |
| 390x844 dark | **6** | 2 |

As 2 datas sem ano são do cabeçalho da secção `#1 · 100,00 €` / `fecha 20/11/26 · vence 05/12/26` (formato curto). As 6 com ano vêm das parcelas individuais: `05/12/2026`, `05/01/2027`, `05/02/2027`, `05/03/2027`, `05/04/2027`, `05/05/2027`.

**Veredicto b): PASS.** 6 ocorrências de `dd/mm/aaaa` em todas as configurações.

---

## Alínea c) Gate completo verde

Todos os comandos corridos num único pipeline após limpeza de artefactos gerados (`packages/db/src/generated/prisma` corrompido por conflito EEXIST/ENOENT de duas execuções concorrentes do `db:generate`). Após correção, gate limpo:

```
pnpm format:check
→ All matched files use Prettier code style!
→ exit 0

pnpm lint
→ turbo run lint
→ Tasks: 4 successful, 4 total
→ @repo/shared:lint ✓ · @repo/db:lint ✓ · @repo/web:lint ✓ · @repo/db:db:generate ✓
→ exit 0

pnpm typecheck
→ turbo run typecheck
→ Tasks: 4 successful, 4 total
→ @repo/shared:typecheck ✓ · @repo/db:typecheck ✓ · @repo/web:typecheck ✓ · @repo/db:db:generate ✓
→ exit 0

pnpm test
→ turbo run test
→ 34 ficheiros · 598 testes
→ src/finance/__tests__/selection.test.ts (7 tests) ✓ · currency.test.ts (14) ✓ · engine.verification.test.ts (143) ✓ · ...
→ exit 0

pnpm build
→ turbo run build
→ @repo/db:db:generate ✓ · @repo/web:build ✓
→ Next.js 16.4.6 · Compiled successfully in ~8s
→ Tasks: 2 successful, 2 total
→ exit 0
```

**Nota técnica:** os comandos `typecheck`, `test` e `build` falharam nos dois primeiros ensaios devido a ficheiros gerados pelo Prisma corrompidos (`EEXIST: file already exists, mkdir ...prisma/models` e `ENOENT: no such file or directory, open ...prismaNamespaceBrowser.ts`). Causa provável: turborepo executou `db:generate` em paralelo numa execução anterior deixando estado inconsistente. Limpeza `Remove-Item -Recurse -Force packages/db/src/generated/prisma` e nova geração resolveram. Os resultados finais são válidos porque cada comando foi executado após a limpeza e produziu exit 0.

**Veredicto c): PASS.** Todos os 5 comandos saíram com exit 0. Contagens exatas acima.

---

## Alínea d) Âmbito: apenas `installment-list.tsx` alterado

COMANDO: `git diff --stat 2acacbc..HEAD -- apps/ packages/`

SAÍDA literal:
```
apps/web/src/components/installment-list.tsx | 45 ++++++++++++++++++++++++----
 1 file changed, 39 insertions(+), 6 deletions(-)
```

Um único ficheiro. Diff `+39/−6`, conforme especificado.

### Helper `formatDay` intacto

COMANDO: `grep "formatDay" apps/web/src/components/installment-list.tsx`

```
Line 148:  ... ${formatDay(plan.nextInvoice.closingDate)} → ${formatDay(plan.nextInvoice.dueDate)}
Line 182:   fecha {formatDay(plan.nextInvoice.closingDate)} · vence{' '}
Line 183:   {formatDay(plan.nextInvoice.dueDate)}
Line 277: function formatDay(date: string): string {
```

4 chamadas + 1 definição. Assinatura: `formatDay(date: string): string` — recebe apenas uma string de data, sem parâmetro de ano. Usa `Intl.DateTimeFormat('pt-PT', { dateStyle: 'short' })` que produz `dd/mm/yy`. Este helper está fora de âmbito da tarefa e não foi modificado.

**Veredicto d): PASS.** Apenas um ficheiro de código alterado (+39/−6); helper `formatDay` intacto com 4 chamadas + 1 definição.

---

## Resumo por alínea

| Alínea | Critério | Veredicto |
| --- | --- | --- |
| a) | 6 parcelas na base → 6 no DOM | **PASS** |
| b) | 6 datas `dd/mm/aaaa` | **PASS** |
| c) | format:check · lint · typecheck · test (598) · build (2/2) todos exit 0 | **PASS** |
| d) | Só `installment-list.tsx` alterado (+39/−6); `formatDay` intacto | **PASS** |

**VEREDICTO GLOBAL: PASS**

---

AMBIENTE: Windows (win32) · Node 24.21.0 · pnpm 10.17.1 · Next.js 16.4.6 · Prisma 7.10.0 · PostgreSQL 18.7 · Chromium (via `@playwright/test`) · Base Neon branch `testes-e2e` (`ep-spring-mud-b11fe546`) · porta 3000 desocupada após medição.

Ficheiros escritos nesta pasta:
- `relatorios/T73-QA.md` (este relatório)
- `relatorios/.qa-t73/t73-medicao-QA.json` (resultado JSON da medição)
- `relatorios/.qa-t73/build-verify.log` (log do build de verificação)
- `relatorios/.qa-t73/t73-playwright.mjs` (script Playwright leve/médio)
- `relatorios/.qa-t73/t73-playwright-dark.mjs` (script Playwright escuro)

Capturas: `relatorios/T73-cartoes-{1440x900,390x844}-{light,dark}.png`
