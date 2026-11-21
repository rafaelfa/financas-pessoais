# T76 — QA (F3 + F4 + R2)

Projeto: `D:\openbot\projetos-dev\financas-pessoais` · HEAD `b1b157d` · árvore com o trabalho do Dev por commitar.
Fase: QA (passo 2 da cadeia). Zero git de escrita, zero `apps/web/**` tocado por mim.

**VEREDICTO GLOBAL: PASS** — com duas observações medidas (esqueleto de `/cartoes` maior do que o conteúdo nas contas vazias; corrida da suite do Lead em paralelo no fim). Ver «O que ficou por cobrir».

---

## 1. O que o Dev deixou para o QA — e o que eu mudei

`pnpm test:e2e` dava **4 failed / 134 passed**. Reproduzi-o antes de tocar em nada, com o mesmo conjunto de specs (log `relatorios/.qa-t76/antes.log`):

```
$ E2E_REUSE_SERVER=1 pnpm exec playwright test e2e/29-contas-truncagem.spec.ts e2e/42-revisao-menores.spec.ts e2e/70-exportar.spec.ts --reporter=list
  x  1 … 29-contas-truncagem.spec.ts:57:7 › … trunca com reticência a 1280 e a 360, e o nome completo fica no DOM (2.8s)
  x  3 … 42-revisao-menores.spec.ts:120:7 › … o fuso não muda o vencimento: página e Revisão dizem 1 e 1 (1.8s)
  x  5 … 70-exportar.spec.ts:61:7 › … o CSV exportado tem o formato do Excel português e volta a entrar sem duplicar (23.4s)
  x  6 … 70-exportar.spec.ts:123:7 › … movimentos repetidos fecham o ciclo exportar → reimportar (24.1s)
  4 failed
  2 passed (1.2m)
```

Causa, a mesma nos quatro: com os `loading.tsx`, o primeiro byte é o esqueleto; `abrirRota` devolvia nesse instante e quem lia a página a seguir lia o esqueleto. No 29 o sintoma é outro — `clientWidth 0` medido antes de o bloco existir — mas o mecanismo é o mesmo:

```
1) … 29-contas-truncagem.spec.ts:57:7
   Error: clientWidth a 1280 px
   Expected: < 0
   Received:   0
   82 | expect(medida.clientWidth, `clientWidth a ${largura} px`).toBeLessThan(medida.scrollWidth);
```

**Correção (ficheiro meu, `e2e/support/ui.ts`):**

```diff
@@ -19,6 +19,13 @@
  * O `smoke.mjs` faz o mesmo por HTTP; aqui, além do estado, verifica-se que a
  * página não mostra o ecrã de exceção do Next — que em `dev` chega com o mesmo
  * `200`.
+ *
+ * **Espera pelo conteúdo, não só pela resposta (T76).** Com os `loading.tsx`
+ * (F3), o primeiro byte de uma rota é o **esqueleto**, que chega antes do
+ * conteúdo por streaming. …
  */
 export async function abrirRota(page: Page, rota: string): Promise<void> {
@@ -30,6 +37,9 @@
   await expect(page.locator('body')).not.toContainText('Internal Server Error');
+
+  // O esqueleto de `loading.tsx` não tem `h1`; o conteúdo real tem.
+  await expect(page.locator('main h1').first()).toBeVisible();
 }
```

Sem `waitForTimeout`. `eslint e2e/support/ui.ts` → exit 0.

**Os quatro testes, depois da correção** (`relatorios/.qa-t76/depois-4specs.log`):

```
$ E2E_REUSE_SERVER=1 pnpm exec playwright test e2e/29-contas-truncagem.spec.ts e2e/42-revisao-menores.spec.ts e2e/70-exportar.spec.ts --reporter=list
  ok 1 … 29-contas-truncagem.spec.ts:57:7 › … (3.0s)
  ok 3 … 42-revisao-menores.spec.ts:120:7 › … o fuso não muda o vencimento: página e Revisão dizem 1 e 1 (2.2s)
  ok 5 … 70-exportar.spec.ts:61:7 › … o CSV exportado tem o formato do Excel português e volta a entrar sem duplicar (3.9s)
  ok 6 … 70-exportar.spec.ts:123:7 › … movimentos repetidos fecham o ciclo exportar → reimportar (3.9s)
  6 passed (24.9s)
```

## 2. `29-contas-truncagem-nome` — flake de workers ou regressão do F3?

Três corridas isoladas, workers por omissão (o `playwright.config.ts` tem `workers: 1`, logo o «por omissão» é serial):

```
$ E2E_REUSE_SERVER=1 pnpm exec playwright test e2e/29-contas-truncagem.spec.ts --reporter=list
RUN1 → 1 passed (6.4s)     relatorios/.qa-t76/spec29-run1.log
RUN2 → 1 passed (5.9s)     relatorios/.qa-t76/spec29-run2.log
RUN3 → 1 passed (5.9s)     relatorios/.qa-t76/spec29-run3.log
```

**Não é corrida entre workers.** A suite tem `workers: 1` fixo no config, portanto não há dois workers a tocar no mesmo utilizador; e na minha corrida de base o 29 falhou com `clientWidth 0` — geometria lida no esqueleto, exactamente o mecanismo do F3. Com a espera pelo conteúdo, ficou verde também na suite completa (linha 51, 2.3 s). O «passa isolado e falha na suite» do Dev explica-se pela cache/prefetch: isolado o `goto` chega à página já resolvida, na suite o estado de carregamento é mais provável.

## 3. F3 — `loading.tsx`

```
$ find 'apps/web/src/app/(app)' -name loading.tsx | wc -l
16
$ find apps/web/src/app -name loading.tsx | grep -E '\(auth\)|definicoes'
(sem saída)
$ grep -h '^import' apps/web/src/app/\(app\)/*/loading.tsx apps/web/src/app/\(app\)/loading.tsx | sort | uniq -c
     16 import { Skeleton } from '@/components/ui/skeleton';
```

16 rotas, nenhuma em `(auth)` nem em `definicoes`, todas em cima do `Skeleton` que já existia (nenhuma primitiva nova). Rotas: `calendario, cartoes, categorias, consolidacao-contas, contas-pagar-receber, contas, importar, (app)/loading, objetivos, orcamento, patrimonio, recorrencias, regras, relatorios, revisao, transacoes`.

**Caixas e CLS, medidos por mim** (navegação entre rotas com o pedido RSC atrasado 2,5 s; observador de `layout-shift` instalado antes; log `relatorios/.qa-t76/medicao-f3.log`):

| Rota | Ecrã | Cabeçalho esqueleto | Bloco esqueleto | Conteúdo real (este utilizador) | CLS |
| --- | --- | --- | --- | --- | --- |
| `/transacoes` | 390×844 | 100 px | 777 px | cabeçalho 100 px; 1.º bloco 1785 px (1.º cartão 813) | **0** |
| `/transacoes` | 1440×900 | 80 px | 510 px | cabeçalho 80 px; 1.º bloco 1056 px (1.º cartão 530) | **0** |
| `/cartoes` | 390×844 | 140 px | 1764 px | cabeçalho 100 px; conteúdo 302 px (estado vazio) | **0** |
| `/cartoes` | 1440×900 | 80 px | 1062 px | cabeçalho 80 px; conteúdo 282 px (estado vazio) | **0** |

Os números do esqueleto batem ao pixel com os do relatório do Dev (100/80+777/510 e 140/80+1764/1062). O cabeçalho coincide com o conteúdo real. O **bloco grande** é uma reserva fixa do estado povoado: com uma conta vazia, o conteúdo real é 302/282 px e o esqueleto reserva 1764/1062; com um cartão criado, o conteúdo é 1082/798 px (log, teste `cartoes-com-um-cartão`). O CLS é 0 nos quatro casos porque a diferença é uma **redução abaixo da dobra** — nada visível salta.

As três excepções a 1440 do Dev (CLS 0,0037 em `/`, 0,0004 em `/transacoes` e `/relatorios`): **aceito a explicação** (conteúdo já carregado, não a troca esqueleto→conteúdo) — são 4×10⁻³ e 4×10⁻⁴, muito abaixo do limiar de 0,1, e nas minhas quatro medições de `/transacoes` e `/cartoes` o CLS deu 0. Não reproduzi individualmente aquelas três rotas: fica como aceitação do número, não como verificação minha.

## 4. F4 — órfãos de `FieldError`

Script próprio: `relatorios/.qa-t76/scan-orfaos.mjs` (varre `apps/web/src`, exclui `ui/field.tsx`; um órfão é um `id` de `<FieldError>` cuja string não aparece em mais lado nenhum; a referência legítima é `aria-describedby="…"` ou a prop `describedBy={…}` do `MoneyInput`).

```
$ node relatorios/.qa-t76/scan-orfaos.mjs
ficheiros varridos: 241
<FieldError> encontrados: 80
com id: 80 · sem id: 0
ids distintos: 80
referências por atributo: {"ariaDescribedby":77,"describedBy":3,"outro":0}
ORFAOS (id sem referência fora da declaração): 0
ids referidos fora de aria-describedby/describedBy: 0
TOTAL DE PROBLEMAS: 0
(exit 0)
```

Os dois casos de «id sem referência» passaram a ser referidos pelo controlo, com o id mantido:

```
category-dialog.tsx:310        aria-describedby={errorFor('color') === undefined ? undefined : 'categoria-cor-erro'}
category-dialog.tsx:330        <FieldError id="categoria-cor-erro">{errorFor('color')}</FieldError>
import-export-panel.tsx:149    from !== '' && to !== '' && from > to ? 'exportar-de-erro' : undefined
import-export-panel.tsx:153    <FieldError id="exportar-de-erro">
```

Diff dos 8 componentes: 47 inserções / 12 remoções, só `id` + `aria-describedby` (e o `pagamento-form-erro` no `<form>`, aceite pelo Lead como está).

## 5. R2 — textos de `/cartoes`

Texto medido no ecrã (`relatorios/.qa-t76/r2.log`), igual ao aprovado, nos dois tamanhos e nos dois temas:

```
R2 390 light: cabecalho=true vazio=true
R2 390 dark:  cabecalho=true vazio=true
R2 1440 light: cabecalho=true vazio=true
R2 1440 dark:  cabecalho=true vazio=true
R2 parcelamentos: h2 «Parcelamentos ativos» visivel=true
  5 passed (8.1s)
```

- Cabeçalho: «Cada cartão com as faturas por fechar, o valor que transita de uma fatura para a seguinte e os parcelamentos ativos.»
- Vazio: «Cria um cartão com o dia de fecho e o dia de vencimento: cada compra a crédito cai na fatura certa, e as compras divididas em parcelas aparecem em Parcelamentos ativos.»
- A secção existe com o nome «Parcelamentos ativos» (`h2`, `cartoes/page.tsx:167`), visível assim que há um cartão.
- `git diff` do ficheiro: `2 2` (só as duas linhas de texto).

## 6. Gate (meus comandos, meus exits)

```
$ pnpm format:check   → exit 0   (All matched files use Prettier code style!)
$ pnpm lint           → exit 0   (Tasks: 4 successful, 4 total)
$ pnpm typecheck      → exit 0   (Tasks: 4 successful, 4 total)
$ pnpm test           → exit 0   (cache HIT)
$ pnpm test --force   → exit 0   (@repo/shared:test  Test Files 34 passed (34) · Tests 598 passed (598))  [turbo run test --force]
$ pnpm build          → exit 0   (Tasks: 2 successful, 2 total)
```

Logs: `relatorios/.qa-t76/gate-*.log` e `gate-test-force.log`.

## 7. Suite completa

```
$ pnpm test:e2e        (relatorios/.qa-t76/suite.log)
Running 138 tests using 1 worker
  ok  51 … e2e\29-contas-truncagem.spec.ts:57:7 › … (2.3s)
  ok  97 … e2e\42-revisao-menores.spec.ts:120:7 › … (2.1s)
  ok 113 … e2e\70-exportar.spec.ts:61:7 › … (3.9s)
  ok 114 … e2e\70-exportar.spec.ts:123:7 › … (4.0s)
[e2e] limpeza: 4 utilizador(es) de teste apagado(s); 0 restante(s).
  138 passed (7.8m)
```

138 = os 134 que já passavam + os 4 que falhavam. Zero failed, duração 7.8m, limpeza em 0 restante(s).

## 8. Prova visual

Abri duas das 8 PNG do Dev (`C:/Users/VENOM/OpenBot/Agents/agent-a1662862-…/t76/`):

- `t76-transacoes-skeleton-390-claro.png` — mostra o esqueleto: barra do topo, duas linhas cinzentas (36 e 16 px) e o bloco grande; é o que o `loading.tsx` de `/transacoes` desenha. Mostra o que diz mostrar.
- `t76-cartoes-390-escuro.png` — `/cartoes` real em escuro, com o texto novo do cabeçalho visível e a secção de cartão com fatura e parcelamento. Mostra o que diz mostrar (contém dados do utilizador; fica no disco, fora do índice).

Tirei as minhas para F3 e R2 (8 PNG em `relatorios/.qa-t76/`: `skeleton-transacoes-*`, `skeleton-cartoes-*`, `r2-cartoes-*`), coerentes com as do Dev.

## 9. O que ficou por cobrir

- **Esqueleto de `/cartoes` numa conta vazia:** reserva 1764/1062 px para um conteúdo de 302/282 px. Não é falha do critério (CLS 0 medido) mas é uma diferença grande entre a caixa reservada e a página; candidato a tarefa se se quiser um esqueleto proporcional ao estado vazio. Idem para `/transacoes` com poucos dados (777 vs 1785 não é «a mesma caixa»; é reserva mínima).
- **Três excepções de CLS do Dev** (`/`, `/transacoes`, `/relatorios` a 1440): aceites pelo número, não reproduzidas por mim.
- **Corrida paralela:** às 23:53 apareceu `relatorios/.qa-t76/lead-suite-verificacao.log` (não é meu) e a porta 3000 ficou com um `node` em LISTENING depois da minha suite. Não matei esse processo por não ser meu; a minha corrida terminou antes, com 138 passed.
- **Gate e2e completo** correu uma vez; não repeti para excluir flake.

---

AMBIENTE: Windows (win32) · Node 24.21.0 · pnpm 10.17.1 · Next.js 16.4.6 · Chromium (Playwright) · base Neon branch `testes-e2e` · verificação em `next start` do build de produção.
