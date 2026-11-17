'use client';

import { Tags, Trash, Wallet, WalletMinimal } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Amount } from '@/components/amount';
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
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { buildCategoryOptions } from '@/components/transaction-quick-add';
import { cn } from '@/lib/utils';
import { bulkDelete, bulkSetCategory, bulkSetSettled } from '@/server/transactions-actions';
import type { CategoryView } from '@/server/categories';
import type { TransactionView } from '@/server/transactions';

/** Alvo de toque: 44 px em telemóvel, denso a partir de `sm`. */
const TOUCH = 'min-h-11 sm:min-h-8';

type Family = 'expense' | 'income' | 'mixed' | 'other';

/** Família da seleção: só gastos, só ganhos, os dois, ou lançamentos sem categoria. */
function selectionFamily(selected: readonly TransactionView[]): Family {
  /*
   * `kind` chega do servidor como o enum do Prisma (`EXPENSE`) — o extrato nunca
   * o normalizou. Compara-se em minúsculas para a regra valer nos dois casos e
   * continuar certa no dia em que a normalização seja feita na origem.
   */
  const families = new Set(selected.map((transaction) => transaction.kind.toLowerCase()));

  if (families.size > 1) {
    return 'mixed';
  }

  const [kind] = [...families];

  return kind === 'expense' || kind === 'income' ? kind : 'other';
}

/** Quantas operações a seleção representa: o par de uma transferência conta como uma. */
function logicalCount(selected: readonly TransactionView[]): number {
  const groups = new Set(
    selected.flatMap((transaction) =>
      transaction.transferGroupId === null ? [] : [transaction.transferGroupId],
    ),
  );

  return groups.size + selected.filter((t) => t.transferGroupId === null).length;
}

/**
 * Barra de ações da seleção do extrato.
 *
 * Aparece quando há pelo menos um lançamento escolhido e age **só** sobre o que
 * está à vista: limpar a seleção ao mudar de página ou de filtro é feito pelo
 * extrato, que é quem sabe o que está à vista.
 */
export function TransactionBulkActions({
  selected,
  categories,
  onClear,
}: {
  readonly selected: readonly TransactionView[];
  readonly categories: readonly CategoryView[];
  readonly onClear: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const ids = selected.map((transaction) => transaction.id);
  const count = selected.length;
  const totalInCents = selected.reduce((sum, transaction) => sum + transaction.amountInCents, 0);
  const logical = logicalCount(selected);
  const hasTransfer = selected.some((transaction) => transaction.transferGroupId !== null);

  const family = selectionFamily(selected);
  const categoryOptions =
    family === 'expense' || family === 'income' ? buildCategoryOptions(categories, family) : [];
  const categoryBlockedReason =
    family === 'mixed'
      ? 'A seleção mistura gastos e ganhos: escolhe só de um tipo para mudar a categoria.'
      : family === 'other'
        ? 'Mudar a categoria só se aplica a gastos e ganhos — transferências e ajustes não têm categoria.'
        : null;
  const canChangeCategory = categoryBlockedReason === null && categoryOptions.length > 0;

  function run(
    action: () => Promise<{ ok: true; data: { affected: number } } | { ok: false; error: string }>,
    message: (affected: number) => string,
  ) {
    startTransition(async () => {
      const result = await action();

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(message(result.data.affected));
      onClear();
      router.refresh();
    });
  }

  /** «1 lançamento» / «3 lançamentos», sem o clássico «1 lançamentos». */
  function plural(count: number, singular: string, plural: string): string {
    return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
  }

  function settle(settled: boolean) {
    run(
      () => bulkSetSettled({ ids, settled }),
      (affected) =>
        settled
          ? `${plural(affected, 'lançamento marcado', 'lançamentos marcados')} como liquidado${affected === 1 ? '' : 's'} — já conta${affected === 1 ? '' : 'm'} no saldo.`
          : `${plural(affected, 'lançamento marcado', 'lançamentos marcados')} como por liquidar — deixa${affected === 1 ? '' : 'm'} de contar no saldo.`,
    );
  }

  function changeCategory(categoryId: string, label: string) {
    run(
      () => bulkSetCategory({ ids, categoryId }),
      (affected) =>
        `Categoria «${label}» aplicada a ${plural(affected, 'lançamento', 'lançamentos')}.`,
    );
  }

  function confirmDelete() {
    run(
      () => bulkDelete({ ids }),
      (affected) =>
        hasTransfer
          ? `${plural(affected, 'lançamento apagado', 'lançamentos apagados')}, transferências incluídas nas duas contas.`
          : `${plural(affected, 'lançamento apagado', 'lançamentos apagados')}.`,
    );
  }

  return (
    <div
      role="region"
      aria-label="Ações sobre os lançamentos selecionados"
      className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-2"
    >
      {/*
        Contagem visível. O anúncio vive no extrato, numa região `aria-live`
        sempre montada: aqui a barra nasce com a primeira seleção, e uma região
        criada já com texto não lê essa primeira mudança.
      */}
      <p className="text-sm font-medium">
        {count === 1 ? '1 selecionado' : `${count} selecionados`}
      </p>

      <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={TOUCH}
          disabled={pending}
          onClick={() => settle(true)}
        >
          <Wallet className="size-4" aria-hidden />
          Marcar efetivada
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className={TOUCH}
          disabled={pending}
          onClick={() => settle(false)}
        >
          <WalletMinimal className="size-4" aria-hidden />
          Marcar por liquidar
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={TOUCH}
              disabled={pending || !canChangeCategory}
              aria-describedby={
                categoryBlockedReason === null ? undefined : 'selecao-sem-categoria'
              }
            >
              <Tags className="size-4" aria-hidden />
              Mudar categoria
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
            <DropdownMenuLabel>Mudar a categoria da seleção</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {categoryOptions.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onSelect={() => changeCategory(option.value, option.label)}
              >
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/*
          Contorno e não o `variant="destructive"`: naquele o texto vermelho fica
          sobre um fundo vermelho a 10%, e a 12,8 px dá 4,35:1 — abaixo do
          mínimo. Aqui o vermelho é texto sobre o fundo da barra.
        */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(TOUCH, 'text-destructive')}
          disabled={pending}
          onClick={() => setConfirming(true)}
        >
          <Trash className="size-4" aria-hidden />
          Apagar
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={TOUCH}
          disabled={pending}
          onClick={onClear}
        >
          Limpar
        </Button>
      </div>

      {/*
        A razão fica visível, não só no `title` nem no `aria-describedby`: quem
        usa o ecrã sem leitor de ecrã também tem de saber porque é que o botão
        está desligado.
      */}
      {categoryBlockedReason === null ? null : (
        <p id="selecao-sem-categoria" className="w-full text-xs text-muted-foreground">
          {categoryBlockedReason}
        </p>
      )}

      <AlertDialog
        open={confirming}
        onOpenChange={(open) => {
          if (!open) {
            setConfirming(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <Trash aria-hidden />
            </AlertDialogMedia>
            <AlertDialogTitle>
              {logical === 1 ? 'Apagar este lançamento?' : `Apagar estes ${logical} lançamentos?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {logical === 1 ? '1 lançamento' : `${logical} lançamentos`}, no total de{' '}
              <Amount amountInCents={totalInCents} withSign />. O saldo das contas recalcula-se sem
              eles.
              {hasTransfer
                ? ' As transferências incluídas são apagadas nas duas contas — apagar só uma perna faria o dinheiro desaparecer de um lado e continuar no outro.'
                : ''}{' '}
              Não há forma de os recuperar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                setConfirming(false);
                confirmDelete();
              }}
            >
              {pending ? 'A apagar…' : 'Apagar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
