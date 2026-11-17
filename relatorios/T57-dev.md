# T57 — Dois defeitos herdados do extrato (prova do Dev)

Base `844c43e`. Os dois defeitos são anteriores à T52/T53. Medições contra a base de desenvolvimento,
build de produção em `:3000`, utilizador próprio `e2e-t57@exemplo.pt` (apagado no fim).

## 1. O `kind` saía do servidor em maiúsculas

**Correção, na origem:** `apps/web/src/server/transactions.ts:138` — `kind: row.kind.toLowerCase()`,
ao lado do `status` que já o fazia, com um comentário único a explicar os dois. Nada foi corrigido em
minúsculas nos componentes: o `TransactionKindBadge`, o `TransactionKindIcon` e o `showCategory` do
diálogo voltaram a estar certos sem lhes tocar.

| Onde | Antes | Depois |
|---|---|---|
| `TransactionView.kind` | `EXPENSE`, `INCOME`, `TRANSFER` | `expense`, `income`, `transfer` |
| Selo da linha (1280 e 360) | «EXPENSE» (sem ícone: o `TransactionKindIcon` compara em minúsculas) | «Gasto», «Ganho», «Transferência», **com ícone** |
| Texto da página inteira | `EXPENSE` presente | **0** ocorrências de `EXPENSE`/`INCOME`/`TRANSFER`; «Gasto», «Ganho», «Transferência» presentes |

Capturas: `relatorios/transacoes-1280.png` e `relatorios/transacoes-360.png`.

Sobre «com o ícone»: o `TransactionKindIcon` devolve ícone para transferência, pagamento de fatura,
objetivos e ajuste, e `null` para gasto e ganho (é o desenho do componente, não um defeito). Medido
por linha a 1280: as duas de transferência têm o ícone (4 `svg`), a de ganho tem 3 — antes, com o
`kind` cru, o ramo do `default` apanhava tudo e nenhuma tinha ícone. Dar ícone a gasto/ganho seria uma
mudança de desenho em `transaction-kind-badge.tsx`, fora dos ficheiros desta tarefa; não a fiz.

**Diálogo de edição** (`transaction-edit-dialog.tsx` **não foi tocado** — depois da origem certa,
`showCategory` volta a ser verdadeiro para despesa e ganho, e continua falso para transferência):

| Lançamento | Campos do diálogo | Categoria |
|---|---|---|
| Despesa («T57 despesa») | Valor · Data · Descrição · Conta · **Categoria** · Estado · Já está liquidado | **presente** |
| Ganho («T57 ganho») | igual ao anterior | **presente** |
| Transferência («T57 transferência saída») | Valor · Data · Descrição · Conta · Estado · Já está liquidado | **ausente** |

Capturas: `relatorios/dialogo-T57-despesa.png`, `dialogo-T57-ganho.png`,
`dialogo-T57-transfer-ncia-sa-da.png`.

**O que ficou por simplificar (fora dos ficheiros desta tarefa):**
`transaction-bulk-actions.tsx:47` normaliza `kind` com `.toLowerCase()` por conta própria — depois
desta correção podia voltar a comparar diretamente, mas esse ficheiro não está na lista da T57. Fica
correto na mesma (a operação é idempotente). Em `transactions-actions.ts:868` o `.toLowerCase()` é
sobre `category.kind` vindo do Prisma, e **tem** de ficar.

## 2. O gatilho do separador de `/importar`

**Ficheiro e linha:** `apps/web/src/components/ui/tabs.tsx:58` — o `TabsTrigger` usava
`text-foreground/60` (cor de texto a 60 % sobre o fundo `bg-muted` da lista). Passou a
`text-muted-foreground`, o token que o tema escuro já usava neste mesmo gatilho (`dark:text-muted-foreground`).
Não houve alteração de paleta nem de `globals.css`; só este controlo mudou. Hoje o `Tabs` só é usado
em `import-file-picker.tsx` (`/importar`).

Rácios medidos com a aritmética do `axe` (`getContrast`), com a cor convertida para sRGB pelo próprio
browser — o mesmo método devolve **4,42** para o par antigo `#6c7276` sobre `#eff5f5`, o que valida a
conta:

| Tema | Antes | Depois |
|---|---|---|
| Claro | 4,42:1 (`rgb(108,114,118)` sobre `rgb(239,245,245)`) | **5,45:1** (`rgb(91,100,111)` sobre `rgb(239,245,245)`) |
| Escuro | 4,94:1 (já usava o token) | **4,94:1** (`rgb(149,160,171)` sobre `rgb(42,49,57)`) |

`axe` em `/importar` (wcag2a/2aa/21a/21aa/22aa), **sem exceções escritas**:

| Tema | Violações |
|---|---|
| Claro | **0** |
| Escuro | **0** |

Capturas: `relatorios/importar-light.png` e `relatorios/importar-dark.png`.

## Nota sobre a spec

O critério 4 (uma spec que guarde as duas coisas e fique vermelha ao repor o `kind` cru ou a cor
antiga) é de `e2e/`, que o contrato atribui ao QA — não a escrevi. O que esta tarefa entrega é o
comportamento medido acima, nas duas larguras e nos dois temas.

## Gate

`format:check` verde · `lint` 4/4 · `typecheck` 4/4 · `test` **582** · `build` 2/2.
