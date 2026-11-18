# T65 — Artefactos de uma falha e2e preservados (prova do Dev)

Base `b7ac423`. Nada de produto: dois scripts novos, duas linhas em `package.json` e uma no
`.gitignore`.

## A forma escolhida, e porquê

| Opção | Porquê não / porquê |
|---|---|
| `playwright.config.ts` com reporter próprio ou `globalTeardown` | mexe no config que o Lead quer estável, e um teardown não sabe se a corrida falhou sem inventar estado |
| **`scripts/qa-e2e.mjs`** (escolhida) | `package.json` passa a ter `"test:e2e": "node scripts/qa-e2e.mjs"`: o wrapper corre o Playwright com `stdio: inherit`, passa todos os argumentos e, **só se o código de saída for ≠ 0**, chama o script de artefactos e sai com **o mesmo código**. `playwright.config.ts` fica igual, zero dependências, zero diferença Windows/Linux (usa `@playwright/test/cli.js` com o próprio `node`) |

`pnpm test:e2e e2e/55-… --project=chromium --reporter=line` continua a funcionar: os argumentos são
repassados tal e qual.

## O que o script faz

`scripts/qa-artefactos.mjs` — copia de `test-results/` para `relatorios/.falhas/<AAAA-MM-DDTHH-mm-ss>/`,
preservando a pasta de cada teste:

- `trace.zip`
- `test-failed-*.png` (e `.jpg`/`.webm`, se existirem)
- `error-context.md`

O Playwright só escreve estes ficheiros em falha (`retain-on-failure`, `only-on-failure`), por isso
«há artefactos» é o mesmo que «houve falha». Sem nada para copiar, diz isso e sai com 0, sem tocar no
código de saída da suíte. Também se pode chamar sozinho — `pnpm qa:artefactos` — para recuperar o que
ainda estiver em `test-results/` **antes** do próximo arranque.

Também entrou `relatorios/.falhas/` no `.gitignore` (mesma linha que a vizinha `relatorios/.qa-*/`):
são zips de vários MB e não podem ir num `git add -A` distraído.

## O comando, e a prova de que funciona

Comando para a próxima falha (é o mesmo que o CI/QA já usava, agora com guarda automática):

```bash
pnpm test:e2e             # a suíte inteira; se falhar, os artefactos ficam guardados
pnpm qa:artefactos        # ou, à mão, para recuperar o que ainda estiver em test-results/
```

Prova com uma falha **provocada e revertida** — spec temporária `e2e/tmp-t65-falha.spec.ts` que abria
`/entrar` e esperava um título inexistente (2 s de `expect`, para falhar depressa):

```
$ pnpm test:e2e e2e/tmp-t65-falha.spec.ts --project=chromium --reporter=line
  1 failed
    [chromium] › e2e\tmp-t65-falha.spec.ts:5:5 › falha provocada para provar os artefactos
[e2e] corrida falhou (código 1) — a guardar os artefactos.
[artefactos] 3 ficheiro(s) → relatorios\.falhas\2026-11-18T11-28-17
  · tmp-t65-falha-…-chromium\error-context.md
  · tmp-t65-falha-…-chromium\test-failed-1.png
  · tmp-t65-falha-…-chromium\trace.zip
ELIFECYCLE  Command failed with exit code 1.
EXIT=1
```

`ls` da pasta (a que ficou guardada é a mesma, recuperada com `pnpm qa:artefactos`):

```
$ find relatorios/.falhas/2026-11-18T11-28-38 -type f
relatorios/.falhas/2026-11-18T11-28-38/tmp-t65-falha-…-chromium/error-context.md
relatorios/.falhas/2026-11-18T11-28-38/tmp-t65-falha-…-chromium/test-failed-1.png
relatorios/.falhas/2026-11-18T11-28-38/tmp-t65-falha-…-chromium/trace.zip
```

- **Código de saída igual**: `EXIT=1` com o wrapper e `1` com `npx playwright test` direto (a suíte
  falha da mesma forma; o wrapper não come o erro).
- **Duração do script**: ~0 s de cópia; `pnpm qa:artefactos` mediu **2,1 s no total**, quase tudo
  arranque do pnpm. A cópia em si são três `copyFileSync`.
- A spec temporária foi **apagada**; `git status` não tem nenhuma alteração em `e2e/`.

## Volta 2 — a interrupção deixa de fingir uma falha

O `qa-e2e.mjs` tratava **qualquer** saída não-zero como falha da suíte. Um `Ctrl+C` matava o
Playwright com `status: null, signal: 'SIGINT'`, o `?? 1` transformava isso em «falhou», a cópia
corria a meio (com um `trace.zip` truncado) e a corrida saía com 1. Uma pasta a dizer «houve uma
falha» que ninguém podia usar — o artefacto a mentir no sítio que existe para provar.

Agora o resultado é classificado **antes** de qualquer cópia (`classificar`, exportada para poder ser
testada sem correr a suíte):

| Resultado do `spawnSync` | Classificação | O que acontece |
|---|---|---|
| `signal: 'SIGINT'` (POSIX: Ctrl+C) | interrompido | mensagem, **exit 130**, nada copiado |
| `signal: 'SIGTERM'` (OOM/kill) | interrompido | idem |
| `status: 3221225786` (`0xC000013A`, Ctrl+C no Windows) | interrompido | idem |
| `status: 130` | interrompido | idem |
| `status: 1` (teste vermelho) | falhou | copia os artefactos, exit 1 |
| `status: 0` | ok | exit 0 |
| `error` (CLI não arrancou) | arranque | imprime o erro, exit 1 — já não sai mudo |

Saída da tabela, corrida contra o próprio `classificar`:

```
interrompido ← Ctrl+C em POSIX (signal SIGINT)
interrompido ← Ctrl+C no Windows (0xC000013A)
interrompido ← SIGTERM (OOM, kill)
interrompido ← interrupção convencional (130)
falhou       ← suíte vermelha (1)
ok           ← suíte verde (0)
arranque     ← CLI não arrancou
```

### A interrupção, **medida** de ponta a ponta

Nesta máquina não há sinais POSIX: `kill -INT`/`Stop-Process` são `TerminateProcess` e um filho
morto assim sai com `code: 1, signal: null` (medido com uma sonda: `{"code":1,"signal":null}`), o
que é indistinguível de um teste vermelho. O Ctrl+C de consola mata com `STATUS_CONTROL_C_EXIT` =
`0xC000013A` = **3221225786**; foi esse o código usado para terminar o filho a meio de uma corrida
`--repeat-each=5` (20 s depois do arranque, com 3 testes já feitos):

```
[3/15] [chromium] › … › apaga o grupo com confirmação: sai da lista e da base
[e2e] corrida interrompida (3221225786) — nada foi guardado.
 ELIFECYCLE  Command failed with exit code 130.
EXIT=130

$ ls relatorios/.falhas | grep -v <antes>
(nenhuma pasta nova)
```

E o caminho normal continua igual (falha provocada, com a página aberta):

```
[e2e] corrida falhou (código 1) — a guardar os artefactos.
[artefactos] 3 ficheiro(s) → D:\openbot\projetos-devinancas-pessoais
elatorios\.falhas6-11-18T11-35-56
  · …-chromium\error-context.md
  · …-chromium	est-failed-1.png
  · …-chromium	race.zip
EXIT=1
```

Terceiro caso, medido por acidente e útil: uma corrida que **falha sem artefactos** (o `webServer`
não arrancou porque a porta 3000 estava ocupada) imprime `[artefactos] nada a guardar: não há trace,
captura nem contexto.`, sai 1 e **não cria pasta nenhuma** — o contrário do defeito desta volta.

### Os três pequenos

| Pequeno | Como ficou | Prova |
|---|---|---|
| `spawnSync` que não arranca o CLI saía 1 mudo | `case 'arranque'` imprime `não consegui arrancar o Playwright: <erro>` | tabela acima, linha `arranque` |
| pasta com data em **UTC** | `marcaTemporal` formata em `Europe/Lisbon` (`hourCycle: 'h23'`) | `23:30 UTC de 15/07 → 2026-07-16T00-30-00` (em UTC seria `2026-07-15T23-30-00`); hoje: `2026-11-18T11-40-07` |
| caminhos relativos ao `cwd` | `RAIZ` sai de `import.meta.url` | `cd /tmp && node …/scripts/qa-artefactos.mjs` → escreveu em `D:\…inancas-pessoais
elatorios\.falhas\…` |

## Volta 3 — a classificação agora tem prova na árvore

Os sete casos estavam provados numa sonda apagada; no que ia ser commitado, mexer no `INTERROMPIDO`
ou trocar a ordem dos ramos **não** fazia o CI ficar vermelho. Passaram para a árvore:

- **`scripts/qa-e2e.test.mjs`** — `node:test`, oito casos com a sua expectativa: `SIGINT`,
  `SIGTERM`, `3221225786`, `130` → `interrompido`; `1` → `falhou`; `0` → `ok`; `{error}` →
  `arranque`; `{status: null, signal: null, error: null}` → `falhou`.
- **`pnpm qa:teste`** = `node --test "scripts/*.test.mjs"` — **8 pass em ~82 ms**.

(Duas notas de forma: `node --test scripts/` não funciona aqui — o Node 24 trata a pasta como um
módulo e falha com `MODULE_NOT_FOUND`; usa-se o padrão de ficheiros. E `qa:teste` fica **fora** do
`turbo`/gate, como pediste: não soma segundos a ninguém, corre-se à mão.)

**Prova de que falha quando deve** — com o código `1` metido no conjunto dos interrompidos:

```
  ✔ SIGINT (Ctrl+C em POSIX) é interrupção, não falha
  ✔ SIGTERM (OOM, kill) é interrupção
  ✔ 0xC000013A (Ctrl+C no Windows) é interrupção
  ✔ o código convencional 130 é interrupção
  ✖ código 1 é uma suíte vermelha
  ✔ código 0 é uma suíte verde
  ✔ erro de arranque do CLI não é falha de teste
  ✖ sem status, sem sinal e sem erro conta como falha
✖ classificar o resultado do Playwright
ℹ pass 6 · ℹ fail 2
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
```

Reposto de seguida (`8 pass`), e `grep` do conjunto: `new Set([130, 3221225786])`.

### O guarda do `argv[1]`

```ts
} else if (process.argv[1] !== undefined && /qa-e2e(\.mjs)?$/.test(process.argv[1])) {
  console.error('[e2e] invocado por um caminho diferente do ficheiro (…?) — nada corrido.');
  process.exit(1);
}
```

Importado pelos testes: silêncio. Invocado por outro caminho que acabe em `qa-e2e.mjs` (um symlink):
mensagem e **exit 1** em vez do 0 mudo de antes. Medido (o symlink não se cria nesta máquina — `ln -s`
copia —, por isso simulei o `argv[1]` diferente):

```
$ node --input-type=module -e "process.argv[1] = 'C:/outro/sitio/qa-e2e.mjs'; await import('./scripts/qa-e2e.mjs');"
[e2e] invocado por um caminho diferente do ficheiro (C:/outro/sitio/qa-e2e.mjs?) — nada corrido.
EXIT=1
```

### Os dois menores que ficam escritos — concordo, e porquê

1. **`taskkill /F`/OOM chegam como `status: 1` no Windows** e caem em «falhou», copiando um
   `test-results/` a meio. Concordo em deixar: no Windows não há sinal nenhum para distinguir, e
   entre «copiar um trace truncado» e «perder o trace» o primeiro é melhor. A alternativa séria é
   inferir pela *saída* do runner (procurar o resumo), que é mais frágil do que o problema.
2. **`process.on('SIGINT', () => {})` desativa o Ctrl+C no invólucro.** Concordo, com uma nota: o
   evento de consola vai para o grupo todo, por isso o Playwright morre com o primeiro Ctrl+C — o
   invólucro é que deixa de morrer por si. Se o filho encravar, só `taskkill`. A correção honesta é
   `spawn` assíncrono com encaminhamento do sinal (`process.kill(filho.pid, signal)`), e isso é outra
   tarefa — não a escondo nesta.

## Uma nota sobre o `flake` da T62

Os artefactos daquela falha já não existem: o `playwright.config.ts` tem `trace: 'retain-on-failure'`
e `screenshot: 'only-on-failure'`, mas o `outputDir` é `test-results/` e o Playwright **limpa-o no
arranque da corrida seguinte**. É exatamente o que este script passa a impedir: a cópia corre no fim
da corrida falhada, antes de qualquer limpeza. O próximo vermelho terá `trace.zip` para abrir com
`pnpm exec playwright show-trace …`.

(Registo do código do worker que o QA viu: `3221225794` = `0xC0000142`, falha de inicialização de
DLL no Windows — família do `3221226091` da T57.)

## Gate

`format:check` verde (os scripts estão formatados) · `lint` 4/4 · `typecheck` 4/4 · `test` **586** ·
`build` 2/2. Zero dependências novas, zero alterações em `apps/`.

## Diff

```
 .gitignore   | 2 ++
 package.json | 3 ++-
 scripts/qa-e2e.mjs        (novo)
 scripts/qa-e2e.test.mjs   (novo, 8 testes)
 scripts/qa-artefactos.mjs (novo)
```
