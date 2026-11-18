# T65 — O `flake` da 55: reprodução — prova do QA

**Conclusão: não reproduzível com o que temos.** O que se reproduziu — duas vezes, em duas tarefas
diferentes — foi a **morte do worker do Playwright no Windows**, que mata o teste em curso e deixa
falhas em cascata de 0 ms. Isso transforma a tarefa de «corrigir o diálogo» em «tornar o próximo
flake diagnosticável» (proposta na última secção).

## 1. A hipótese da base fria — **corrida feita, flake não apareceu**

Deixei a base (Neon, `suspend_timeout_seconds: 0`) **10 minutos** sem um único pedido
(10:42 → 10:52 UTC), e corri a **suíte inteira**, não a spec isolada:

```
$ date -u; sleep 600; date -u          # 10:42:01 → 10:52:01
$ pnpm test:e2e
  119 passed (15.0m)
  4 failed
```

- **A 55 passou**: `ok 108 [chromium] › 55-consolidacao-contas.spec.ts:133 › apaga o grupo com
  confirmação (3.2s)` — o teste do flake, na posição da suíte, com a base fria.
- A suíte demorou **15,0 min** (normal: 7,7–8,1 min) — a base fria **atrasa** a corrida, mas não
  produz o vermelho descrito.
- As 4 falhas **não são asserções**: três com **0 ms** e uma com 680 ms, e o relatório diz

```
Error: worker process exited unexpectedly (code=3221225794, signal=null)
```

`3221225794` = `0xC0000142` (falha de inicialização de DLL no Windows). É a mesma família do
`3221226091` (`0xC0000374`, heap) que já tinha morto a suíte na T57 — **dois códigos, dois
episódios, ambos no fim de corridas longas**.

**`trace.zip` guardado antes de qualquer outra corrida:** a primeira falha (45 telemovel) tinha
traço; copiei o `test-results` inteiro para `relatorios/.falhas/fria-1107/`
(`trace.zip` + `error-context.md`). As outras três não têm traço (não chegaram a correr).

## 2. A hipótese da CPU — **não reproduz**

Quatro processos a queimar CPU em paralelo (`while` com `Math.sqrt`) durante 4 minutos e, ao mesmo
tempo, as duas specs × 5 repetições:

```
$ pnpm exec playwright test e2e/45-… e2e/55-… --repeat-each=5
  90 passed (12.9m)
```

**90/90**, sem uma falha, com a máquina saturada (12,9 min contra os ~2 min normais). O clique em
«Novo grupo» abriu o diálogo em todas. (Não injetei `Emulation.setCPUThrottlingRate` porque isso
exigiria alterar `e2e/` ou a config, e esta fase é de reprodução; a saturação da máquina é o mesmo
tipo de pressão, sem tocar em ficheiros.)

## 3. A hipótese da ordem — **a corrida que falhou foi a inteira, e a 55 passou**

A corrida da alínea 1 é a suíte completa, `workers: 1`, na ordem real (a 45 antes, a 55 a seguir,
com os dados que as anteriores deixam). A 55 passou. Nas 79 execuções do Dev (repeats, spec isolada,
suíte) também. Soma: **mais de 170 execuções da 55 sem o vermelho** descrito.

## 4. Observabilidade — o que já existe e porque se perdeu o traço

| item | estado |
|---|---|
| `trace` | **`retain-on-failure`** — o traço **é** guardado quando falha |
| `screenshot` | `only-on-failure` |
| `video` | `off` |
| `outputDir` | `test-results` |
| limpeza | **o Playwright apaga o `outputDir` no arranque da corrida seguinte** — na pasta só ficou `.last-run.json` antes da minha corrida |

Ou seja: o traço do T62 **existiu** e foi apagado pela corrida seguinte. O problema não é a config
guardar — é não haver nada que o **preserve** depois da corrida.

## 5. O que faria o próximo flake diagnosticável (proposta, com custo)

1. **Preservar os artefactos de falha** (o mais barato e o que resolve este caso): um script
   `qa:artefactos` que, no fim de cada corrida, copia `test-results/**/{trace.zip,test-failed-*.png,error-context.md}`
   para `relatorios/.falhas/<data-hora>/`. **Custo:** um `cp` no fim (~0 s, alguns MB por falha);
   não toca em `e2e/` nem no `playwright.config.ts` (pode ser um script npm ou um passo no CI).
2. **Gravar vídeo só nas specs frágeis** (`video: 'retain-on-failure'` no projeto `telemovel` ou
   nas specs 45/55): mostra o ecrã no momento em que o diálogo não abre. **Custo:** ~1–2 MB e alguns
   segundos por falha.
3. **Registar o código de saída do worker**: hoje o relatório diz «exited unexpectedly» sem dizer
   se foi memória, DLL ou tempo. Um passo no CI que corra a suíte **por projeto** (chromium,
   telemovel, escuro) reduz a vida de cada worker e isola o projeto onde morre; **custo:** três
   arranques de `webServer` (ou um servidor partilhado com `E2E_REUSE_SERVER=1`) e ~1 min a mais.
4. **Não aumentara o `expect.timeout`** para «resolver» o flake do diálogo: os 20,6 s do T62 são
   muito acima dos ~1 s normais; se voltar, o problema não é o limite.

## Veredicto

**Não reproduzível.** O vermelho do T62 não voltou em mais de 170 execuções (minhas e do Dev),
incluindo a suíte inteira com a base fria e a máquina saturada. O que **é** reproduzível é a
instabilidade do worker do Playwright no Windows (dois códigos distintos, sempre em corridas longas),
que produz falhas em cascata e apaga a prova. A recomendação é a da secção 5: preservar artefactos
antes de mais nada, e correr a suíte por projeto para isolar o próximo episódio.

## Limpeza

**2 utilizadores / 5 contas / 52 lançamentos**, 0 `e2e-*`, 0 linhas de teste do QA; `:3000`/`:3100`
livres; `next-env.d.ts` revertido; sem commit. Escritos: `relatorios/T65-qa.md`,
`relatorios/.qa-t65/` (logs e contagens) e `relatorios/.falhas/fria-1107/` (o `trace.zip` da única
falha com traço).
