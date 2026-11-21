# T87 — QA: «Calendário» entra no menu «Dia a dia» (D29)

Data: 2026-11-21 · Branch `fix/t73-parcelamentos-cartoes` @ `4f632ec` (T84) + T87 na árvore
(não commitada) · Builds **meus**, de frio: `myFcpra6qtn5xVuO4MOLL` e `3VPPmrDgIwkuJVzyBMS5G`
(o do Dev era `iFGspEkMBAhmK4ws7vHKV` — não reutilizei nada).

**Veredicto: PASS** nas cinco alíneas (a)–(d) medidas; a (e) não foi medida por proibição —
explicado abaixo.

---

## (a) Nove destinos, dez `href`, na ordem pedida — PASS

Lidos do **DOM** (`[data-slot="sidebar"] a[href]`), com a gaveta aberta a 390 e a barra visível a
1440, nos dois temas. Fonte: `relatorios/.qa-t87/medicoes.json`.

| Viewport · tema | `href` (na ordem) | total |
| --- | --- | --- |
| 1440 claro | `/` `/transacoes` `/calendario` `/contas` `/contas-pagar-receber` `/orcamento` `/objetivos` `/patrimonio` `/relatorios` `/definicoes` | 10 |
| 1440 escuro | idêntico | 10 |
| 390 claro | idêntico | 10 |
| 390 escuro | idêntico | 10 |

`Definições` é o último link e vive no rodapé do utilizador (`/definicoes`), fora dos três grupos —
visível como tal na captura `gaveta-390-dark.png`. Os nove destinos são os nove primeiros; o
décimo é `/definicoes`.

Código de suporte (`apps/web/src/lib/nav.ts`): `NAV_SECTIONS` = «Dia a dia»
`[painel, transacoes, calendario, contas, contasAPagarReceber]` (5) + «Planeamento»
`[orcamento, objetivos, patrimonio]` (3) + «Análise» `[relatorios]` (1) = **9**.

## (b) `/calendario` ativo (`aria-current="page"`) — PASS

Em `/calendario`, o link do Calendário na barra tem `aria-current="page"` e é o **único** link da
barra com esse atributo, nos quatro casos:

```
1440-light  {"href":"/calendario","texto":"Calendário","atual":"page","visivel":true}  aria-current: ["/calendario"]  gaveta: false
1440-dark   {"href":"/calendario","texto":"Calendário","atual":"page","visivel":true}  aria-current: ["/calendario"]  gaveta: false
390-light   {"href":"/calendario","texto":"Calendário","atual":"page","visivel":true}  aria-current: ["/calendario"]  gaveta: true
390-dark    {"href":"/calendario","texto":"Calendário","atual":"page","visivel":true}  aria-current: ["/calendario"]  gaveta: true
```

A 390 o `aria-current` foi lido **com a gaveta aberta** (`gaveta: true`), portanto sobre o link
visível, não sobre um nó escondido. Capturas: `calendario-gaveta-390-light.png`,
`calendario-gaveta-390-dark.png` (Calendário destacado a seguir a Transações).

## (c) Paleta 17, navegação inferior 5, «Ver o calendário» presente — PASS

Nos quatro casos, no mesmo `medicoes.json`:

```
paletaOpcoes: 17   (1440-light, 1440-dark, 390-light, 390-dark)
navInferior: display "block" a 390 / "none" a 1440, 5 alvos a 390:
  / · /transacoes · /orcamento · /objetivos · /contas   (altura de cada alvo: 56 px)
verOcalendario: 1  (o link «Ver o calendário» do Painel existe nos quatro casos)
```

`MOBILE_NAV` continua com os cinco de sempre e **não** inclui `/calendario` — em `/calendario` a
navegação inferior não tem nenhum `aria-current` (o Calendário entra pela gaveta, como manda a D29).
Zero erros de consola em todas as medições (`erros: []`).

## (d) As quatro specs passaram ao nove sem afrouxar — PASS

`git diff` dos quatro ficheiros (só estas alterações, nada mais):

| Ficheiro | Alteração | Estrita? |
| --- | --- | --- |
| `15-navegacao.spec.ts:62` | `SECAO_DIA_A_DIA` passa a 5 rótulos com `Calendário` na 3.ª posição | **sim** — o teste faz `toHaveText(SECAO_DIA_A_DIA)` sobre os links do grupo: lista exata, por ordem, 5 elementos. Um 4.º/6.º link ou outra ordem falha. |
| `38-revisao.spec.ts:136,156` | comentário + `toHaveLength(8)` → `toHaveLength(9)`; nome do teste «barra lateral 8» → «9» | **sim** — `toHaveLength(9)` exato (não `toBeGreaterThan`), com `not.toContain('/revisao')` e `toContain('/definicoes')` mantidos |
| `39-calendario.spec.ts:254` | nome invertido; `not.toContain('/calendario')` → `toContain` + `indexOf('/calendario') === indexOf('/transacoes') + 1` | **sim** — exige presença **e** posição imediata; a paleta continua `toHaveCount(17)` |
| `33-navegacao-15.spec.ts:55-58` | **só o comentário** (oito → nove desde a D29) | n/a — nenhuma asserção tocada |

Não há `skip`, `only`, `test.fixme`, regex alargada, `toBeGreaterThan`/`toBeGreaterThanOrEqual`, nem
qualquer asserção que aceite 8 ou 9 conforme o dia:

```
$ git diff -U0 -- e2e/15-navegacao.spec.ts e2e/38-revisao.spec.ts e2e/39-calendario.spec.ts e2e/33-navegacao-15.spec.ts | grep -E "^\+" | grep -vE "^\+\+\+"
+ * Desde a T52 a barra tem nove destinos: «Consolidação» e «Cartões» saíram para
+ * os separadores de `/contas`, os quatro ecrãs de análise para o menu «Mais» de
+ * `/transacoes`, e a D29 devolveu «Calendário» ao «Dia a dia». As rotas não
+ * mudaram.
+const SECAO_DIA_A_DIA = ['Painel', 'Transações', 'Calendário', 'Contas', 'Contas a pagar/receber'];
+     * fica com nove desde a D29 — «Calendário» entrou no «Dia a dia» — e não a
+     * inclui, por decisão da T54), por isso o bloco entra aqui como qualquer
+     * outro menu.
+  test('a porta existe: paleta 16 com Revisão, barra lateral 9 sem ela', async ({ page }) => {
+    /* Nove destinos na navegação (D29); «Definições» vive no rodapé do utilizador (T52). */
+    expect(destinos, 'a barra lateral (D7 + D29) continua com 9').toHaveLength(9);
+  test('a paleta tem 17 e /calendario está na barra lateral, a seguir a Transações', async ({
+    page,
+  }) => {
+
+    /* D29: o Calendário entra no «Dia a dia», imediatamente a seguir a Transações. */
+    expect(lateral, '/calendario na barra').toContain('/calendario');
+    expect(lateral.indexOf('/calendario'), '/calendario depois de Transações').toBe(
+      lateral.indexOf('/transacoes') + 1,
+    );
```

São **todas** as linhas acrescentadas; o resto do diff são remoções (`not.toContain`, `toHaveLength(8)`, o
`test(` antigo).

As quatro correram verdes **nas duas** corridas completas:

```
[2/145]   › 15-navegacao.spec.ts:110 › a secção «Dia a dia» lista os destinos pela ordem acordada
[79/145]  › 38-revisao.spec.ts:136   › a porta existe: paleta 16 com Revisão, barra lateral 9 sem ela
[87/145]  › 39-calendario.spec.ts:254 › a paleta tem 17 e /calendario está na barra lateral, a seguir a Transações
[141/145] › 15-navegacao.spec.ts:110 (tema escuro) idem
```

**Observação (não é falha desta tarefa):** o nome do teste `38:136` ainda diz «paleta 16» enquanto o
corpo afirma `toHaveCount(17)`. É anterior ao diff (o `16` vem da T54, quando a paleta tinha 16) e o
diff só lhe mudou o «8» da barra; fica registado, não corrigido — `e2e/` é meu, mas mexer no nome
para 17 é fora do que a T87 pediu e não há asserção errada.

## (e) Apagar `NAV.calendario` põe o 15 e o 38 vermelhos — NÃO MEDIDO

Não o fiz: apagar a linha é `apps/`, proibido nesta tarefa, e voltar a pô-la deixaria a árvore com
outro estado. Pela leitura, o mecanismo é direto: `15` compara a lista **exata** de rótulos do grupo
(`['Painel','Transações','Calendário','Contas','Contas a pagar/receber']`) e `38` conta
`toHaveLength(9)` sobre os `href` da barra — sem `calendario` no `NAV_SECTIONS`, `15` vê 4 rótulos e
`38` vê 8. Fica como raciocínio, **não** como medição.

---

## As duas corridas completas, de frio

Comando: `rm -rf apps/web/.next` e `env -u E2E_REUSE_SERVER pnpm test:e2e --reporter=line`, em série,
porta 3000 fechada antes de cada uma. Logs: `relatorios/.qa-t87/suite-1.log`, `suite-2.log`.

| Corrida | Testes | Resultado | BUILD_ID | Limpeza | Exit |
| --- | --- | --- | --- | --- | --- |
| 1 | 145 | **145 passed (8.6m)** | `myFcpra6qtn5xVuO4MOLL` | `4 utilizador(es) … 0 restante(s)` | 0 |
| 2 | 145 | **145 passed (8.6m)** | `3VPPmrDgIwkuJVzyBMS5G` | `4 utilizador(es) … 0 restante(s)` | 0 |

Duas corridas, dois builds diferentes (logo cada uma compilou do zero), o mesmo número: **145**, o
baseline recebido. Sem `skip`, sem retry, sem falha de infra em nenhuma das duas. Base depois das
corridas: `select count(*) from "user" where email like 'e2e-%'` → **0**. Porta 3000: `FECHADA`.

## Ambiente e limpeza

- Servidor de medição: build meu em `:3000` (o mesmo `.env` do projeto), encerrado antes das
  suites; `BUILD_ID` das suites acima. A medição usou o utilizador **demo** só para leitura
  (nenhum lançamento, nenhum dado criado ou apagado). `localStorage.theme` foi mexido só no browser
  de teste, por contexto efémero.
- Um login do demo expirou por timeout de 90 s na primeira tentativa de medição e passou à segunda;
  nenhuma implicação para a suite (que usa os seus próprios utilizadores).
- Nada em `apps/` da minha parte, zero git. `AGENTS.md` e `apps/web/next-env.d.ts` já vinham
  modificados na árvore — não fui eu. `git status` mostra apenas as alterações do Dev + o `T87.md`
  dele; o meu trabalho vive em `relatorios/` (a pasta `.qa-t87/` é ignorada pelo git).

## Ficheiros desta volta

`relatorios/T87-qa.md`. Em `relatorios/.qa-t87/`: `medir.cjs`, `medicoes.json`, `medir.log`,
`duas-corridas.sh`, `runner.log`, `suite-1.log`, `suite-2.log`, `fim.txt`, `build.log`,
`servidor.log`, `diff-adicoes.log`, `diff-asserts.log`, e 10 PNG — `painel-1440-{light,dark}.png`,
`gaveta-390-{light,dark}.png`, `calendario-1440-{light,dark}.png`, `calendario-390-{light,dark}.png`,
`calendario-gaveta-390-{light,dark}.png`.
