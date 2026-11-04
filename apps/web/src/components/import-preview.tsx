'use client';

import { CircleAlert, Info, TriangleAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Amount } from '@/components/amount';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { confirmImport } from '@/server/import-actions';
import type { ConfirmImportResult } from '@/server/import-actions';
import type { ImportPreview } from '@/server/import';
import type { CategoryView } from '@/server/categories';
import { MAX_IMPORT_ROWS, confirmImportSchema } from '@repo/shared/schemas/domain';
import { cn } from '@/lib/utils';

/**
 * Pré-visualização linha a linha e confirmação.
 *
 * É o ecrã onde a importação deixa de ser um ato de fé:
 *
 * - **nada foi gravado ainda** — está escrito junto ao botão que grava, não só no
 *   ecrã anterior;
 * - as **duplicadas vêm desmarcadas** com o motivo à vista, porque o `fitId`
 *   existe exatamente para reimportar o mesmo ficheiro sem duplicar nada;
 * - as linhas que o parser não conseguiu interpretar (sem data ou sem valor) não
 *   podem ser escolhidas, em vez de falharem em silêncio na gravação;
 * - a categoria sugerida é **editável por linha**, e o servidor volta a validar
 *   que a categoria é do utilizador e não é interna.
 */

/** Valor sentinela: o Radix Select reserva a string vazia. */
const NO_CATEGORY = '__sem_categoria__';

/** Alvo de toque: 44 px em telemóvel, denso a partir de `sm`. */
const TOUCH = 'min-h-11 sm:min-h-8';
const ICON_TOUCH = 'min-h-11 min-w-11 sm:min-h-7 sm:min-w-7';

type ImportRow = ImportPreview['rows'][number];

/** Uma linha só é importável se tiver data e um valor diferente de zero. */
function isImportable(row: ImportRow): boolean {
  return row.date !== null && row.amountInCents !== null && row.amountInCents !== 0;
}

export function ImportPreviewPanel({
  preview,
  categories,
  onConfirmed,
  onCancel,
}: {
  readonly preview: ImportPreview;
  readonly categories: readonly CategoryView[];
  /**
   * Recebe o resultado da confirmação **com o recibo** do que foi criado: é com
   * ele que a reversão consegue provar o que apagar sem adivinhar.
   */
  readonly onConfirmed: (result: ConfirmImportResult) => void;
  readonly onCancel: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<ReadonlySet<number>>(
    () =>
      new Set(
        preview.rows.filter((row) => row.selected && isImportable(row)).map((row) => row.index),
      ),
  );
  const [categoryByIndex, setCategoryByIndex] = useState<Record<number, string>>(() =>
    Object.fromEntries(preview.rows.map((row) => [row.index, row.suggestedCategoryId ?? ''])),
  );
  const [formError, setFormError] = useState<string | null>(null);

  const importable = preview.rows.filter(isImportable);
  const chosen = importable.filter((row) => selected.has(row.index));
  const chosenTotalInCents = chosen.reduce((total, row) => total + (row.amountInCents ?? 0), 0);
  /*
   * O limite por importação existe no schema do servidor. Apanhamo-lo aqui antes
   * de enviar, para a pessoa ler uma frase em português em vez da mensagem
   * genérica do Zod — e para saber exatamente o que fazer: dividir em duas vezes.
   */
  const exceedsRowLimit = chosen.length > MAX_IMPORT_ROWS;

  const expenseCategories = categories.filter(
    (category) => category.kind === 'expense' && !category.internal,
  );
  const incomeCategories = categories.filter(
    (category) => category.kind === 'income' && !category.internal,
  );

  function toggle(row: ImportRow, next: boolean) {
    setSelected((previous) => {
      const copy = new Set(previous);

      if (next) {
        copy.add(row.index);
      } else {
        copy.delete(row.index);
      }

      return copy;
    });
  }

  function selectAllNew() {
    setSelected(
      new Set(
        preview.rows
          .filter((row) => row.status === 'new' && isImportable(row))
          .map((row) => row.index),
      ),
    );
  }

  function confirm() {
    setFormError(null);

    if (exceedsRowLimit) {
      setFormError(
        `O limite por importação é ${MAX_IMPORT_ROWS} linhas e escolheste ${chosen.length}. Importa em duas vezes.`,
      );
      return;
    }

    const rows = chosen.map((row) => ({
      date: row.date,
      description: row.description,
      amountInCents: row.amountInCents,
      fitId: row.fitId,
      categoryId:
        categoryByIndex[row.index] === undefined || categoryByIndex[row.index] === ''
          ? null
          : categoryByIndex[row.index],
    }));

    // Mesmo schema que o servidor aplica: a mensagem que aparece é a que ele daria.
    const parsed = confirmImportSchema.safeParse({
      accountId: preview.accountId,
      ...(preview.cardId === null ? {} : { cardId: preview.cardId }),
      rows,
    });

    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Há linhas inválidas na seleção.');
      return;
    }

    startTransition(async () => {
      const result = await confirmImport(parsed.data);

      if (!result.ok) {
        setFormError(result.error);
        toast.error(result.error);
        return;
      }

      onConfirmed(result.data);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <ImportSummary
        preview={preview}
        chosenCount={chosen.length}
        chosenTotalInCents={chosenTotalInCents}
      />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Linhas do extrato</CardTitle>
              <p className="text-sm text-muted-foreground">
                {preview.rows.length} linhas lidas do ficheiro. Desmarca as que não queres importar.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={TOUCH}
                onClick={selectAllNew}
                disabled={preview.newCount === 0}
              >
                Marcar todas as novas
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={TOUCH}
                onClick={() => setSelected(new Set())}
                disabled={chosen.length === 0}
              >
                Desmarcar todas
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <span className="sr-only">Importar</span>
                </TableHead>
                <TableHead className="w-28">Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="hidden md:table-cell">Estado</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="hidden lg:table-cell">Categoria</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {preview.rows.map((row) => {
                const importableRow = isImportable(row);
                const isSelected = selected.has(row.index);
                const options = (row.amountInCents ?? 0) < 0 ? expenseCategories : incomeCategories;

                return (
                  <TableRow key={row.index} data-status={row.status}>
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        disabled={!importableRow}
                        className={cn(ICON_TOUCH, 'items-center justify-center')}
                        aria-label={`Importar a linha ${row.sourceLine} do ficheiro`}
                        onCheckedChange={(value) => toggle(row, value === true)}
                      />
                    </TableCell>

                    <TableCell className="font-numeric text-muted-foreground tabular-nums">
                      {row.date === null ? '—' : formatDay(row.date)}
                    </TableCell>

                    <TableCell className="max-w-[20rem] whitespace-normal">
                      <span className="block truncate font-medium">
                        {row.description.trim() === '' ? 'Sem descrição' : row.description}
                      </span>

                      {/* Em telemóvel, o estado e o motivo ficam sob a descrição. */}
                      <span className="mt-1 flex flex-wrap items-center gap-1.5 md:hidden">
                        <RowStatusBadge status={row.status} />
                        {row.reason === null ? null : (
                          <span className="text-xs text-muted-foreground">{row.reason}</span>
                        )}
                      </span>

                      {importableRow ? null : (
                        <span className="mt-1 block text-xs text-destructive">
                          Sem data ou sem valor: esta linha não pode ser importada.
                        </span>
                      )}

                      {/* A categoria sugerida é editável — e o servidor valida-a outra vez. */}
                      {isSelected && importableRow ? (
                        <span className="mt-2 block lg:hidden">
                          <Label
                            htmlFor={`importar-categoria-${row.index}`}
                            className="text-xs text-muted-foreground"
                          >
                            Categoria
                          </Label>
                          <CategorySelect
                            id={`importar-categoria-${row.index}`}
                            value={categoryByIndex[row.index] ?? ''}
                            options={options}
                            onChange={(next) =>
                              setCategoryByIndex((previous) => ({
                                ...previous,
                                [row.index]: next,
                              }))
                            }
                          />
                        </span>
                      ) : null}
                    </TableCell>

                    <TableCell className="hidden md:table-cell">
                      <span className="flex flex-col gap-1">
                        <RowStatusBadge status={row.status} />
                        {row.reason === null ? null : (
                          <span className="max-w-[16rem] text-xs text-muted-foreground">
                            {row.reason}
                          </span>
                        )}
                      </span>
                    </TableCell>

                    <TableCell className="text-right">
                      {row.amountInCents === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <Amount amountInCents={row.amountInCents} withSign />
                      )}
                    </TableCell>

                    <TableCell className="hidden lg:table-cell">
                      {isSelected && importableRow ? (
                        <CategorySelect
                          id={`importar-categoria-larga-${row.index}`}
                          value={categoryByIndex[row.index] ?? ''}
                          options={options}
                          onChange={(next) =>
                            setCategoryByIndex((previous) => ({ ...previous, [row.index]: next }))
                          }
                        />
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {row.suggestedCategoryName ?? 'Sem sugestão'}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {preview.issues.length === 0 ? null : (
        <details className="rounded-xl border p-4">
          <summary className="cursor-pointer text-sm font-medium">
            {preview.issues.length === 1
              ? '1 problema de leitura no ficheiro'
              : `${preview.issues.length} problemas de leitura no ficheiro`}
          </summary>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {preview.issues.map((issue) => (
              <li key={`${issue.line}-${issue.field}-${issue.message}`}>
                Linha {issue.line} ({issue.field}): {issue.message}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="space-y-3 rounded-xl border bg-muted/40 p-4">
        <p className="flex items-start gap-2 text-sm">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <strong>Nada foi gravado ainda.</strong> Ao confirmar, os{' '}
            {chosen.length === 1 ? 'movimento escolhido entra' : 'movimentos escolhidos entram'} na
            conta «{preview.accountName}».
          </span>
        </p>

        {exceedsRowLimit ? (
          <p role="alert" className="text-sm text-destructive">
            O limite por importação é {MAX_IMPORT_ROWS} linhas e escolheste {chosen.length}.
            Desmarca algumas ou importa em duas vezes.
          </p>
        ) : null}

        {formError === null ? null : (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className={TOUCH}
            disabled={pending}
            onClick={onCancel}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className={TOUCH}
            disabled={pending || chosen.length === 0 || exceedsRowLimit}
            onClick={confirm}
          >
            {pending
              ? 'A importar…'
              : chosen.length === 0
                ? 'Nenhuma linha escolhida'
                : `Importar ${chosen.length} ${chosen.length === 1 ? 'movimento' : 'movimentos'}`}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Cartão de resumo: o que vem no ficheiro e o que está escolhido. */
function ImportSummary({
  preview,
  chosenCount,
  chosenTotalInCents,
}: {
  readonly preview: ImportPreview;
  readonly chosenCount: number;
  readonly chosenTotalInCents: number;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">
            Resumo do ficheiro ({preview.format.toUpperCase()})
          </CardTitle>
          <Badge variant="secondary">Conta: {preview.accountName}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
          <Fact label="Novas" value={String(preview.newCount)} />
          <Fact label="Duplicadas" value={String(preview.duplicateCount)} />
          <Fact label="Suspeitas" value={String(preview.suspiciousCount)} />
          <Fact label="Total de débitos" amountInCents={preview.totalDebitsInCents} />
          <Fact label="Total de créditos" amountInCents={preview.totalCreditsInCents} />
          <Fact
            label="Saldo final implícito"
            amountInCents={preview.impliedEndBalanceInCents}
            fallback="Sem saldo no ficheiro"
          />
        </dl>

        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          Escolheste <strong>{chosenCount}</strong> {chosenCount === 1 ? 'linha' : 'linhas'} para
          importar, com um efeito líquido de{' '}
          <strong>
            <Amount amountInCents={chosenTotalInCents} withSign tone="neutral" />
          </strong>
          .
        </p>

        {preview.warnings.length === 0 ? null : (
          <div className="space-y-2 rounded-lg border border-warning/40 p-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <TriangleAlert className="size-4 text-warning-foreground" aria-hidden />O que tens de
              saber sobre este ficheiro
            </p>
            <ul className="space-y-1 text-sm">
              {preview.warnings.map((warning) => (
                <li key={warning} className="flex items-start gap-2">
                  <CircleAlert
                    className="mt-0.5 size-3.5 shrink-0 text-warning-foreground"
                    aria-hidden
                  />
                  <span>{warning}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Fact({
  label,
  value,
  amountInCents,
  fallback = '—',
}: {
  readonly label: string;
  readonly value?: string;
  readonly amountInCents?: number | null;
  readonly fallback?: string;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">
        {value ??
          (amountInCents === null || amountInCents === undefined ? (
            <span className="text-muted-foreground">{fallback}</span>
          ) : (
            <Amount amountInCents={amountInCents} tone="neutral" />
          ))}
      </dd>
    </div>
  );
}

/** Estado da linha, em palavras. */
function RowStatusBadge({ status }: { readonly status: string }) {
  if (status === 'duplicate') {
    return (
      <Badge variant="outline" className="font-normal text-muted-foreground">
        Duplicada
      </Badge>
    );
  }

  if (status === 'suspicious') {
    return (
      <Badge variant="outline" className="border-warning/50 font-normal text-warning-foreground">
        Suspeita
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="font-normal">
      Nova
    </Badge>
  );
}

/** Escolha da categoria de uma linha. */
function CategorySelect({
  id,
  value,
  options,
  onChange,
}: {
  readonly id: string;
  readonly value: string;
  readonly options: readonly CategoryView[];
  readonly onChange: (value: string) => void;
}) {
  return (
    <Select
      value={value === '' ? NO_CATEGORY : value}
      onValueChange={(next) => onChange(next === NO_CATEGORY ? '' : next)}
    >
      <SelectTrigger id={id} className={`w-full ${TOUCH}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_CATEGORY}>Sem categoria</SelectItem>
        {options.map((category) => (
          <SelectItem key={category.id} value={category.id}>
            {category.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Data de calendário em formato curto, sem deslocação de fuso. */
function formatDay(date: string): string {
  return new Intl.DateTimeFormat('pt-PT', { timeZone: 'UTC', dateStyle: 'short' }).format(
    new Date(`${date}T00:00:00Z`),
  );
}
