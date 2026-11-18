# T68 — O teste do invólucro entra no CI (prova do Dev)

Base `23ee3e5`. Uma alteração: `.github/workflows/ci.yml`.

## O passo

```yaml
      # O teste do invólucro dos e2e (`scripts/qa-e2e.test.mjs`). `pnpm test` é
      # `turbo run test` e só percorre os scripts dos pacotes — sem este passo,
      # apagar um ramo do `classificar` deixava o CI inteiro verde (T68). É
      # `node --test`: não precisa de base nem de browser, e não toca na app.
      - name: Testes do invólucro dos e2e (`node --test`)
        run: pnpm qa:teste
```

Entrou no **job `gate`**, entre «Tipos» e «Testes» — a ordem segue a regra que o próprio
workflow declara («o que é mais barato falhar primeiro»): custa ~0,2 s, muito antes do `pnpm test`.

```
$ grep -n "qa:teste" .github/workflows/ci.yml
106:        run: pnpm qa:teste
```

## Dependência de instalação — dito, não acidente

O passo **precisa do `pnpm install` antes dele**, e já o tem: o job instala com
`--frozen-lockfile` no passo 4 de 11. `qa:teste` importa `classificar` de `scripts/qa-e2e.mjs`, e esse
módulo resolve `@playwright/test/package.json` com `createRequire` **no topo** (é assim que encontra o
CLI). Sem `node_modules` o import rebentava — mas não por acaso: é a mesma dependência que qualquer
outro passo do job já tem.

## Volta 2 — o teste deixou de arrastar o Playwright, e o job diz o que corre

1. **Resolução do CLI para dentro do `correr()`.** `createRequire` e o caminho do `cli.js` estavam no
   topo do módulo: importar `classificar` arrastava o `@playwright/test`. Agora vivem dentro de
   `correr()` — o teste de uma função pura já não pode falhar porque o pacote mudou de layout ou
   porque o `node_modules` não está instalado.

   Prova: os dois scripts copiados para uma pasta **sem `node_modules`** nenhum (`/tmp/t68-semsmods`)
   correm os oito casos verdes — se a resolução ainda acontecesse no import, isto dava
   `MODULE_NOT_FOUND`:

   ```
   $ cd /tmp/t68-semsmods && node --test "*.test.mjs"
   ℹ pass 8 · ℹ fail 0 · ℹ duration_ms 72.9887
   ```

   E o `grep` mostra o sítio: `scripts/qa-e2e.mjs:62-63` (dentro de `correr()`), e não no topo.

2. **O nome do job passa a dizer a verdade** (`ci.yml:32`): «format · lint · typecheck · **qa** · test ·
   build». O passo chama-se «Testes do invólucro dos e2e (`node --test`)» em vez da tradução literal.

## O YAML é válido

```
$ python -c "import yaml; d=yaml.safe_load(open('.github/workflows/ci.yml',encoding='utf-8')); …"
job: format · lint · typecheck · qa · test · build · passos: 11 · runs: pnpm install --frozen-lockfile · db:validate/db:generate ·
      format:check · lint · typecheck · qa:teste · test · build
```

O parse devolve o `gate` com os 11 passos e o `pnpm qa:teste` na lista — não há passos novos a mais nem
nomes repetidos.

## O passo morde

Mutação numa cópia (o `1` metido no `INTERROMPIDO` de `scripts/qa-e2e.mjs`, que é exactamente o
exemplo do Revisor):

```
$ pnpm qa:teste            # com o 1 no conjunto
  ✖ código 1 é uma suíte vermelha (0.7ms)
  ✖ sem status, sem sinal e sem erro conta como falha (0,2ms)
ℹ pass 6 · ℹ fail 2
EXIT do pnpm qa:teste com a mutação = 1      ← é o que o CI veria: passo vermelho

$ pnpm qa:teste            # reposto
ℹ pass 8 · ℹ fail 0
EXIT reposto = 0
```

Ficheiro reposto (`grep const INTERROMPIDO` → `new Set([130, 3221225786])`) e `git status` só com o
`ci.yml` (mais o `TASKS.md`, que é teu).

## Tempo local

| Comando | Tempo |
|---|---|
| `pnpm qa:teste` (arranque do pnpm incluído) | **660 ms** |
| `node --test "scripts/*.test.mjs"` (o passo a correr) | **180 ms** |

Não instala nada, não abre base nem browser.

## Gate

`format:check` verde (o `ci.yml` também passa o Prettier) · `lint` 4/4 · `typecheck` 4/4 · `test`
**591** · `build` 2/2. Zero dependências novas.

## Diff

```
 .github/workflows/ci.yml |  9 ++++++++-
 scripts/qa-e2e.mjs      | 12 +++++++++---
2 files changed, 18 insertions(+), 3 deletions(-)
```

Não mexi no script `test` do `package.json` (continua a ser o `turbo run test`) nem no `smoke.yml`.
