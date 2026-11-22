# T98 — QA: a falha de rede no formulário de preferências

Data: 2026-11-22 · Base `a9c336d` + `apps/web/src/components/preferences-form.tsx` e o teste novo do
`e2e/97` por commitar · Build das medições: `fcybuCGojuWiXcJ8rVkVY`; suite de frio:
`kraxTHyE8cWtMsgwbN6U2`.

**Veredicto: PASS.** O formulário **já não desaparece**: com o POST abortado há mensagem, o `<form>`
continua na página e o `h1` também. As sete validações continuam a rejeitar, a gravação volta a
funcionar sem recarregar, e o `afterAll` deixa a conta de teste em **1/CASH**.

---

## (a) POST abortado — o formulário sobrevive — PASS

Sessão de QA própria (`qa-t98-…`), `/definicoes`, `page.route(...)` a abortar o POST, valores
`Dia 21` seleccionados antes de submeter:

| medido 2,5 s depois do abort | valor |
| --- | --- |
| `document.querySelectorAll('form').length` | **1** (não 0) |
| `h1` | **«Definições»** |
| `main` | o ecrã normal (título, cartões, regime), **sem** «Algo falhou ao carregar este ecrã» |
| `form [role="alert"]` | **«Não consegui ligar ao servidor — as preferências não foram guardadas. Verifica a ligação e tenta outra vez.»** |
| botão «Guardar preferências» | `disabled: false` |
| base depois do abort | `1 / CASH / EUR` — **não gravou** |
| consola | só `Failed to load resource: net::ERR_FAILED`; **nenhum** `pageerror` |

Captura `relatorios/T98/abortado.png`: o cartão do regime com a mensagem vermelha ao lado do botão, a
página inteira no sítio. O error boundary já não apanha nada.

## (b) O botão volta a `enabled` nos três caminhos

| caminho | resultado | como |
| --- | --- | --- |
| **excepção** (POST abortado) | **`disabled: false`** | medido |
| **sucesso** | **`disabled: false`** | medido |
| **`fail()` de validação** | por leitura — não alcançável pela interface | ver abaixo |

O `Select` só oferece 1–28 e o regime só dois botões, por isso a validação da acção não se provoca
pela UI (forçá-la seria adulterar o POST, e aí o estado do botão é o do caminho de excepção). Por
leitura: `if (!resultado.ok) { setErro(resultado.error); return; }` está **dentro** do callback da
transição, e o `return` termina o callback → `pending` volta a `false` → botão habilitado. Não inventei
uma medição para este caminho.

## (c) Desbloquear e gravar de verdade — PASS

Sem recarregar: `page.unroute`, clique em «Guardar preferências» com `Dia 21` ainda seleccionado →

```
toast: ["Preferências guardadas."]
base:  21 / CASH / EUR      (o dia 21 ficou mesmo na coluna)
```

## (d) Nada regrediu — PASS

- **Sete validações de tipo** (payload directo à acção, com o `next-action` capturado do build):
  `true`, `["21"]`, `[21,22]`, `""`, `null`, `{}`, `"21abc"` → **todas rejeitadas, nenhuma escreveu**
  (a coluna ficou em `5/CASH` durante todo o lote).
- `where: { id: user.id }` — `preferences-actions.ts:42`, inalterado.
- `currency` = **EUR** em todas as leituras; a acção só escreve as duas colunas.
- **Toast** de sucesso: presente (acima).
- **Setas** do radiogroup: `ArrowRight` levou `aria-checked`/`tabindex`/foco de Caixa para
  Competência.
- **`afterAll` a repor 1/CASH**: corri o `e2e/97` real **sem `globalTeardown`** (para poder ler a linha
  antes de o utilizador ser apagado) — **2 passed (6.2s)**, e a linha ficou
  `dia 1 / CASH / EUR`. Apaguei o utilizador de teste a seguir (`0 restantes`).

## (e) O spec morde — citado, não corrido

Não degradei o componente para provocar o vermelho. A saída é a do Dev (`relatorios/T98.md:94-96`),
**citada** e não medida por mim:

```
Expected substring: "não foram guardadas"
Error: element(s) not found
1 failed
```

O que **medi** foi o contrário: o teste novo passa (`ok … «um POST abortado diz que não gravou e deixa
tentar outra vez» (735ms)`, no `2 passed` do parágrafo anterior).

## (f) Suite completa, de frio — PASS

```
$ rm -rf apps/web/.next && env -u E2E_REUSE_SERVER pnpm test:e2e
[e2e] limpeza: 4 utilizador(es) de teste apagado(s); 0 restante(s).
  150 passed (8.7m)
SUITE_EXIT=0     BUILD_ID kraxTHyE8cWtMsgwbN6U2
[axe] /definicoes: sem violações
```

**150** (149 + o teste novo), `0 restante(s)`, e o `axe` de `/definicoes` continua limpo (o `e2e/92`
também passou — está dentro dos 150). Gate: `format:check` 0, `lint` 0, `typecheck` 0.

## A pergunta: o `try` tem o âmbito mínimo?

**Não totalmente, e digo onde.** O `try` cobre:

1. o `await savePreferences(...)` — é o que se quer apanhar;
2. o `if (!resultado.ok) { setErro(...); return; }` — o `return` não é excepção, mas o `setErro` está
   dentro;
3. o `toast.success(...)`.

O mínimo seria só o **(1)** (a leitura do resultado não lança). A consequência de englobar o (2)/(3) é
estreita: se `setErro` ou o `toast` lançassem, o utilizador veria «Não consegui ligar ao servidor» em
vez do erro real — uma mensagem errada, não um dado errado; e nenhum dos dois mexe em dados. Não é um
bloqueio, é uma sugestão de uma linha: manter dentro do `try` só o `await`, com o `if` e o `toast`
fora.

## Limpeza e ambiente

Um utilizador QA (`qa-t98-…`), apagado no fim (0 restantes); o utilizador de teste do spec também
(0 `e2e-%`). Demo não usada. Zero escrita em `apps/` e `e2e/`; zero git; porta 3000 **fechada**.

## Ficheiros desta volta

`relatorios/T98-qa.md`; capturas em `relatorios/T98/` (`abortado.png`, `gravado.png`); scripts, logs e
o probe em `relatorios/.qa-t98/` (`medir.cjs`, `medicoes.json`, `spec97-sem-teardown.log`, `probe/`,
`gate.log`, `suite.log`).
