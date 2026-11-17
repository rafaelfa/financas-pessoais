# T59 — Editar uma transferência falha sempre (prova do Dev)

Base `6c9319e`. Um ficheiro de código: `apps/web/src/components/transaction-edit-dialog.tsx`. O
servidor **não** foi tocado — a validação que recusa `accountId` numa transferência continua igual e
é isso que a tarefa queria.

## (i) Antes e depois, no mesmo passo

Lançamento usado: uma transferência de −300,00 € / +300,00 € entre duas contas (criada por SQL para
o teste), com o diálogo aberto em «Editar».

| | Antes da correção | Depois |
|---|---|---|
| Campos do diálogo na transferência | Valor · Data · Descrição · **Conta** · Estado · Já está liquidado | Valor · Data · Descrição · Estado · Já está liquidado |
| O que era enviado no `submit` | `accountId` sempre | sem `accountId` quando `kind === 'transfer'` |
| Mensagem ao gravar (só a descrição mudada) | **«Numa transferência não podes mudar a conta nem a categoria. Elimina-a e cria outra.»** | nenhuma — grava |
| Base depois de gravar | intacta (`T59 transferência saída`, −30000) | `T59 transferência saída — corrigida`, −30000 |

O utilizador passa a ver, no lugar do campo Conta: «Numa transferência a conta não se altera: para
mover o dinheiro a partir de outra conta, elimina esta transferência e cria outra.» A nota do valor
(«O valor é espelhado automaticamente na outra conta.») continua lá.

## (ii) O par continua espelhado

Mudar o valor de 300,00 € para **412,50 €** no diálogo:

| Perna | Antes | Depois |
|---|---|---|
| Saída (conta A) | −30000 | **−41250** |
| Entrada (conta B) | +30000 | **+41250** |

Cada perna mantém a sua conta (`…e58572` e `…59255c`). Sem erro no diálogo. O espelhamento já existia
no servidor (`transactions-actions.ts`, `updateMany` do par com `-value.amountInCents`) — não escrevi
nada lá.

Nota de comportamento observado (não mudado): a descrição, a data, o estado e a liquidação também são
espelhados nas duas pernas, como antes.

## (iii) Os campos que o diálogo mostra numa transferência

A 1280 e a 360, iguais: `Valor`, `Data`, `Descrição`, `Estado`, `Já está liquidado` — **sem `Conta`**
e sem `Categoria` (a categoria já não aparecia numa transferência, por desenho).
Capturas: `relatorios/dialogo-transferencia-1280.png`, `relatorios/dialogo-transferencia-360.png`.

## (iv) Despesa, ganho e linha de fatura não mudaram

| Lançamento | Campos (com Conta) | Gravar | Conta no fim |
|---|---|---|---|
| Despesa | Valor · Data · Descrição · **Conta** · Categoria · Estado · Já está liquidado | grava a descrição | **mudada** pelo diálogo: `…e58572` → `…59255c` (conta B), como antes |
| Ganho | idem | grava | mantém-se |
| Linha de fatura (`INVOICE_PAYMENT`) | Valor · Data · Descrição · **Conta** · Estado · Já está liquidado | grava | mantém-se |

## O servidor continua a recusar (prova directa, sem passar pela interface)

Pedido directo à Server Action `updateTransaction` com `{ id: <perna de saída>, accountId: <conta B> }`:

```
{"ok":false,"error":"Numa transferência não podes mudar a conta nem a categoria. Elimina-a e cria outra."}
```

## `axe`

Diálogo aberto numa transferência, `wcag2a/2aa/21a/21aa/22aa`: **0 violações** a 1280 e **0** a 360.

## Gate

`format:check` verde · `lint` 4/4 · `typecheck` 4/4 · `test` **582** · `build` 2/2. O `next-env.d.ts`
reescrito pelo build foi revertido; base limpa (utilizador e linhas `T59 %` apagados).

## Diff

`apps/web/src/components/transaction-edit-dialog.tsx` apenas: um `isTransfer`, o `accountId` fora do
`submit` numa transferência, o campo Conta trocado por uma nota, e a nota do valor a usar a mesma
flag. Nada mais.
