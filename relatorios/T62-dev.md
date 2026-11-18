# T62 — O `MAPA.md` dizia a verdade de 01/11 (prova do Dev)

Base `16ae678`. Só documentação: `docs/gestao/MAPA.md`, `README.md`,
`docs/plano/ESTADO-E-HANDOFF.md`. Zero código, zero dependências.

## A tabela que importa — os dez itens de «Onde dói»

Tudo medido a **2026-11-18** nesta árvore. Comando entre aspas, saída resumida.

| # | Item da lista de 01/11 | Comando | Saída de hoje (2026-11-18) | Veredicto |
|---|---|---|---|---|
| 1 | Lockfile desatualizado (`react-hook-form`/`@hookform/resolvers` ausentes) | `pnpm install --frozen-lockfile` · `grep -c react-hook-form pnpm-lock.yaml` | `Already up to date` · **3** ocorrências | **removido** (fechado) |
| 2 | 12 ficheiros não formatados | `pnpm format:check` | `All matched files use Prettier code style!` | **removido** (fechado) |
| 3 | Sem `.gitattributes`, CRLF do Windows | `ls .gitattributes` · `git config --get core.autocrlf` | existe (19 B) · `false` | **removido** (fechado; mantida a armadilha no texto) |
| 4 | `next-env.d.ts` reescrito parte o `format:check` | `grep -n next-env .prettierignore` | `10:apps/web/next-env.d.ts` | **removido** (fechado) |
| 5 | 51 erros de lint (incl. `jsx-no-undef` em runtime) | `pnpm lint` | 4/4 tarefas, **0 erros** | **removido** (fechado) |
| 6 | 80 erros de tipo em 7 ficheiros | `pnpm typecheck` | 4/4 tarefas, **0 erros** | **removido** (fechado) |
| 7 | `test:e2e` não corre sem base real | `ls .env` · `pnpm test:e2e` | `.env` existe (base Neon real) · **não corrido aqui** (é do QA) | **mantém** (como requisito, não defeito) |
| 8 | `consolidacao-contas` e `contas-pagar-receber` sem teste | `ls e2e/ \| grep -E "45-contas-pagar\|55-consolidacao"` | `45-contas-pagar-receber.spec.ts`, `55-consolidacao-contas.spec.ts` | **removido** (fechado) |
| 9 | `README`/handoff mentem sobre o estado | leitura dos dois + esta tarefa | reescritos com a data e a saída de hoje | **corrigido** |
| 10 | Produção 8 commits atrás | `curl -o /dev/null -w '%{http_code}'` em `…/revisao`, `…/calendario`, `…/caminho-inventado-t62` e `…/api/health` | `/revisao` e `/calendario` **307** · inventado **404** · `/api/health` **200**, base `reachable` | **corrigido** (estava ao contrário) |

## Volta 2 — quatro correções de precisão

1. **O «Mapa de ficheiros» voltou.** Ao substituir o bloco entre «Como se corre» e
   «Onde dói» levei comigo essa secção inteira (~20 linhas, num sítio que o Revisor
   foi procurar e não achou em mais lado nenhum). Voltou como **estrutura**, sem
   volumes nem contagens de linhas, e datada: `## Mapa de ficheiros — estrutura
   verificada a 2026-11-18`. Foi a única coisa que se perdeu, e perdê-la não estava no
   contrato.
2. **A prova da linha 93 (era 84) estava fraca.** A célula citava o **registo** do
   deploy (`16ae678` = `HEAD`), que não é um deploy a servir. Passou a citar o que
   fecha o item, remedido agora do lado de fora: `/revisao` e `/calendario` **307**,
   caminho inventado (`/caminho-inventado-t62`) **404**, `/api/health` **200** com
   `reachable: true`. O registo do deploy fica na secção própria, onde é legítimo.
3. **A linha «Dados reais presentes» não tinha comando** — passou a ter a saída do
   `count(*)` por tabela (`user 2 · financial_account 5 · transaction 52 · invoice 4 ·
   recurrence 2 · category 58 · budget 1 · receivable_payable 0 · account_group 0`).
4. **A lista da stack não tinha data própria** — o cabeçalho passou a «## Stack real —
   verificada a 2026-11-18».

Nada mais foi tocado: os oito itens remediados, as armadilhas em prosa, o `README.md` e
o handoff ficaram como estavam.

## O que ninguém sabia, ou que estava pior do que dizia

1. **O item 10 estava invertido, não desatualizado.** O mapa dizia «a produção está 8
   commits atrás»; hoje a produção serve `/revisao` e `/calendario` (**307**, atrás da
   sessão — um caminho inexistente dá 404, como aconteceu a 01/11) e o último deploy
   registado no GitHub é do próprio `HEAD`. Era o item com mais cara de problema e era
   o mais resolvido de todos.
2. **O mapa conhecia duas migrações; a base tem três.** `_prisma_migrations` lista
   também `20261103203748_remove_goal_movement_yield`, que o documento nunca
   mencionou e que já está em `main`. Corrigido na ficha da base.
3. **A linha da stack também estava atrasada** em sítios que ninguém procurava: dizia
   Next **16.4.0**, Zod **4.6.5**, `shadcn` em `dependencies` e **522 testes**. Hoje é
   Next **16.4.6**, Zod **4.6.6**, `shadcn` em `devDependencies` e **582 testes**.
4. **O «último verde conhecido» (`468a138`, CI `41346236265`) que os dois documentos
   citavam** não é o último: o CI correu com sucesso a 2026-11-18 (`8d084dd`, run
   `44272978670`). O registo antigo não estava errado — estava parado.

## O que ficou como «não verificado daqui»

| Coisa | Porque não se verifica daqui | O que seria preciso |
|---|---|---|
| Estado `READY`/`ERROR` do deploy de `16ae678` e conteúdo exato do build publicado | exigiria a API/CLI da Vercel com token; esta tarefa não corre `vercel` (proibido no contrato) | `vercel ls`/API da Vercel, ou um deploy de leitura |
| Conteúdo autenticado das páginas em produção | exigiria sessão em produção; não foi feita nesta passagem | sessão com a conta demo e um percurso só de leitura |
| Resultado da suíte e2e | é a suíte do QA (29 ficheiros de spec) | correr `E2E_REUSE_SERVER=1 pnpm exec playwright test` |
| Estado do CI neste minuto | a execução de `16ae678` estava `in_progress` quando medi | `gh run list -L 5` |

## As três alterações

- **`docs/gestao/MAPA.md`** — «Como se corre» remedido a 2026-11-18 (tabela de comandos
  com a saída de hoje); «Onde dói» passou a ter **um item verdadeiro** (o requisito do
  `test:e2e`/`db:seed`), a tabela dos nove resolvidos com comando e saída, e a lista do
  que não se verifica daqui; secção de produção/CI reescrita com os números de hoje; a
  secção de produção de 01/11 ficou marcada como **histórica**; ficha da base com 3
  migrações e as contagens de hoje; nota final a dizer que a lista foi remedida e
  quando.
- **`README.md`** — bloco «Estado» reescrito com a data, os comandos e as saídas de
  hoje, o run do CI de 2026-11-18 e a ressalva do deploy não verificado.
- **`docs/plano/ESTADO-E-HANDOFF.md`** — cabeçalho de revisão a 2026-11-18 e secção 0
  reescrita com os números de hoje; o resto do documento declarado histórico.

## Diff

```
 README.md                      |  31 +++--
 docs/gestao/MAPA.md            | 298 ++++++++++++++++++-----------------------
 docs/plano/ESTADO-E-HANDOFF.md |  76 ++++-------
 3 files changed, 174 insertions(+), 231 deletions(-)
```

Uma nota de honestidade sobre o `MAPA.md`: o diff é grande porque a lista antiga
(catorze parágrafos de problemas numerados) deu lugar a uma tabela. O mapa não ficou
mais pequeno por ser simpático — ficou mais pequeno porque nove dos dez itens já não
eram verdade.

## Gate

`format:check` verde (`*.md` está no `.prettierignore`; os restantes ficheiros foram
verificados) · `lint` 4/4 · `typecheck` 4/4 · `test` **582** · `build` 2/2.
Zero alterações a `apps/` ou `packages/`, zero dependências, zero migrações.
