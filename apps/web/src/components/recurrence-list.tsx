'use client';

import { CalendarClock, EllipsisVertical, Pause, Pencil, Play, Repeat, Trash } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Amount } from '@/components/amount';
import { RecurrenceDialog } from '@/components/recurrence-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { AccountView } from '@/server/accounts';
import type { CategoryView } from '@/server/categories';
import type { RecurrenceView } from '@/server/recurrences';
import { deleteRecurrence, setRecurrenceActive } from '@/server/recurrences-actions';
import { cn } from '@/lib/utils';

/**
 * Lista das séries de recorrência.
 *
 * Duas ideias governam este ecrã:
 *
 * 1. **Pausada não é apagada.** Uma série pausada deixa de gerar, mas mantém o
 *    histórico e tudo o que já gerou; por isso fica visível numa secção própria,
 *    com a palavra escrita, e não escondida ou a cinzento.
 * 2. **«A vencer» é um estado, não um alarme.** Uma série que já tem datas por
 *    gerar aparece assinalada e a lista oferece a geração; nada é criado sem o
 *    utilizador pedir.
 */

/** Alvo de toque: 44 px em telemóvel, denso a partir de `sm`. */
const TOUCH = 'min-h-11 sm:min-h-8';
const ICON_TOUCH = 'min-h-11 min-w-11 sm:min-h-7 sm:min-w-7';

/** Nome legível de cada natureza. */
const KIND_LABELS: Readonly<Record<string, string>> = {
  expense: 'Gasto',
  income: 'Ganho',
};

export function RecurrenceList({
  recurrences,
  accounts,
  categories,
  today,
}: {
  readonly recurrences: readonly RecurrenceView[];
  readonly accounts: readonly AccountView[];
  readonly categories: readonly CategoryView[];
  /** Data de hoje em Portugal, como `YYYY-MM-DD`. */
  readonly today: string;
}) {
  const active = recurrences.filter((recurrence) => recurrence.isActive);
  const paused = recurrences.filter((recurrence) => !recurrence.isActive);

  return (
    <div className="space-y-8">
      <section aria-labelledby="recorrencias-ativas" className="space-y-3">
        <div className="space-y-1">
          <h2 id="recorrencias-ativas" className="font-heading text-lg font-medium">
            Ativas
          </h2>
          <p className="text-sm text-muted-foreground">
            As séries que geram lançamentos. As que têm datas por gerar estão assinaladas com
            <strong> A vencer</strong>.
          </p>
        </div>

        {active.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Não tens séries ativas. Cria uma para a aplicação passar a lançar a renda, o salário ou
            uma subscrição sem escreveres tudo outra vez.
          </p>
        ) : (
          <RecurrenceTable
            recurrences={active}
            accounts={accounts}
            categories={categories}
            today={today}
          />
        )}
      </section>

      {paused.length === 0 ? null : (
        <section aria-labelledby="recorrencias-pausadas" className="space-y-3">
          <div className="space-y-1">
            <h2 id="recorrencias-pausadas" className="font-heading text-lg font-medium">
              Pausadas
            </h2>
            <p className="text-sm text-muted-foreground">
              Deixaram de gerar, mas nada foi apagado: o que já geraram continua no extrato e podes
              retomá-las quando quiseres.
            </p>
          </div>

          <RecurrenceTable
            recurrences={paused}
            accounts={accounts}
            categories={categories}
            today={today}
          />
        </section>
      )}
    </div>
  );
}

function RecurrenceTable({
  recurrences,
  accounts,
  categories,
  today,
}: {
  readonly recurrences: readonly RecurrenceView[];
  readonly accounts: readonly AccountView[];
  readonly categories: readonly CategoryView[];
  readonly today: string;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="hidden sm:table-cell">Frequência</TableHead>
              <TableHead>Próxima</TableHead>
              <TableHead className="hidden lg:table-cell">Conta</TableHead>
              <TableHead className="hidden lg:table-cell">Categoria</TableHead>
              <TableHead className="hidden text-right md:table-cell">Geradas</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {recurrences.map((recurrence) => (
              <RecurrenceRow
                key={recurrence.id}
                recurrence={recurrence}
                accounts={accounts}
                categories={categories}
                today={today}
              />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function RecurrenceRow({
  recurrence,
  accounts,
  categories,
  today,
}: {
  readonly recurrence: RecurrenceView;
  readonly accounts: readonly AccountView[];
  readonly categories: readonly CategoryView[];
  readonly today: string;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const isExpense = recurrence.kind === 'expense';

  function toggleActive(next: boolean) {
    startTransition(async () => {
      const result = await setRecurrenceActive({ id: recurrence.id, active: next });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(next ? 'Recorrência retomada.' : 'Recorrência pausada.');
    });
  }

  function confirmDelete() {
    startTransition(async () => {
      const result = await deleteRecurrence({ id: recurrence.id });

      if (!result.ok) {
        toast.error(result.error);
        setDeleteOpen(false);
        return;
      }

      toast.success('Recorrência eliminada. Os lançamentos que já gerou ficam no extrato.');
      setDeleteOpen(false);
    });
  }

  return (
    <TableRow data-due={recurrence.due} className={cn(recurrence.due && 'bg-warning/5')}>
      <TableCell className="max-w-[18rem] whitespace-normal">
        <span className="block truncate font-medium">{recurrence.name}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {KIND_LABELS[recurrence.kind] ?? recurrence.kind}
          {(recurrence.description ?? '').trim() === '' ? null : <> · {recurrence.description}</>}
        </span>
        {/* Em ecrãs estreitos, as colunas escondidas juntam-se aqui. */}
        <span className="mt-0.5 block text-xs text-muted-foreground sm:hidden">
          {capitalize(recurrence.frequencyLabel)}
          {' · '}
          {recurrence.accountName ?? 'Sem conta'}
          {(recurrence.categoryName ?? '').trim() === '' ? null : <> · {recurrence.categoryName}</>}
        </span>
      </TableCell>

      <TableCell className="text-right">
        <span className="whitespace-nowrap">
          <span aria-hidden className={isExpense ? 'text-expense' : 'text-income'}>
            {isExpense ? '−' : '+'}
          </span>{' '}
          <Amount
            amountInCents={recurrence.amountInCents}
            tone={isExpense ? 'expense' : 'income'}
          />
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground sm:hidden">
          {KIND_LABELS[recurrence.kind] ?? recurrence.kind}
        </span>
      </TableCell>

      <TableCell className="hidden sm:table-cell">
        <span className="flex items-center gap-1.5">
          <Repeat className="size-3.5 text-muted-foreground" aria-hidden />
          {capitalize(recurrence.frequencyLabel)}
        </span>
      </TableCell>

      <TableCell>
        <span className="flex flex-col">
          <span className="font-numeric tabular-nums">{formatDay(recurrence.nextRunDate)}</span>
          {recurrence.due ? (
            <Badge variant="outline" className="mt-0.5 w-fit border-warning/50 font-normal">
              <CalendarClock className="size-3" aria-hidden />A vencer
            </Badge>
          ) : null}
        </span>
      </TableCell>

      <TableCell className="hidden lg:table-cell">
        {recurrence.accountName ?? <span className="text-muted-foreground">Sem conta</span>}
      </TableCell>

      <TableCell className="hidden lg:table-cell">
        {(recurrence.categoryName ?? '').trim() === '' ? (
          <span className="text-muted-foreground">Sem categoria</span>
        ) : (
          recurrence.categoryName
        )}
      </TableCell>

      <TableCell className="hidden text-right md:table-cell">
        <span className="text-muted-foreground">
          {recurrence.generatedCount === 0
            ? 'nenhuma'
            : recurrence.generatedCount === 1
              ? '1'
              : recurrence.generatedCount}
        </span>
      </TableCell>

      <TableCell>
        <div className="flex items-center gap-2">
          <Switch
            checked={recurrence.isActive}
            disabled={pending}
            aria-label={
              recurrence.isActive
                ? `Pausar a recorrência ${recurrence.name}`
                : `Retomar a recorrência ${recurrence.name}`
            }
            onCheckedChange={toggleActive}
          />
          <Badge
            variant={recurrence.isActive ? 'secondary' : 'outline'}
            className="font-normal whitespace-nowrap"
          >
            {recurrence.isActive ? 'Ativa' : 'Pausada'}
          </Badge>
        </div>
      </TableCell>

      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={`${TOUCH} hidden sm:inline-flex`}
            disabled={pending}
            onClick={() => toggleActive(!recurrence.isActive)}
          >
            {recurrence.isActive ? (
              <>
                <Pause className="size-3.5" aria-hidden />
                Pausar
              </>
            ) : (
              <>
                <Play className="size-3.5" aria-hidden />
                Retomar
              </>
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className={ICON_TOUCH}
                aria-label={`Ações da recorrência ${recurrence.name}`}
              >
                <EllipsisVertical className="size-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                <Pencil className="size-4" aria-hidden />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => toggleActive(!recurrence.isActive)}>
                {recurrence.isActive ? (
                  <>
                    <Pause className="size-4" aria-hidden />
                    Pausar
                  </>
                ) : (
                  <>
                    <Play className="size-4" aria-hidden />
                    Retomar
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
                <Trash className="size-4" aria-hidden />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>

      <RecurrenceDialog
        mode="edit"
        recurrence={recurrence}
        accounts={accounts}
        categories={categories}
        today={today}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <Trash aria-hidden />
            </AlertDialogMedia>
            <AlertDialogTitle>Eliminar «{recurrence.name}»?</AlertDialogTitle>
            <AlertDialogDescription>
              A série desaparece e deixa de gerar. Os lançamentos que já criou ficam no extrato —
              apagar a série não apaga o histórico. Se só queres suspendê-la, usa «Pausar».
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                confirmDelete();
              }}
            >
              {pending ? 'A eliminar…' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TableRow>
  );
}

/** Primeira letra em maiúscula, para a frase começar bem. */
function capitalize(value: string): string {
  return value.length === 0 ? value : `${value[0]?.toUpperCase() ?? ''}${value.slice(1)}`;
}

/** Data de calendário em formato curto, sem deslocação de fuso. */
function formatDay(date: string): string {
  return new Intl.DateTimeFormat('pt-PT', { timeZone: 'UTC', dateStyle: 'short' }).format(
    new Date(`${date}T00:00:00Z`),
  );
}
