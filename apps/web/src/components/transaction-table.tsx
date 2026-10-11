'use client';

import {
  Ban,
  CircleCheck,
  CreditCard,
  EllipsisVertical,
  ArrowLeftRight,
  Pencil,
  Trash,
  Wallet,
  RefreshCw,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Amount } from '@/components/amount';
import { EmptyState } from '@/components/empty-state';
import {
  TRANSACTION_KIND_LABELS,
  TransactionKindBadge,
  TransactionStatusBadge,
} from '@/components/transaction-kind-badge';
import { TransactionEditDialog } from '@/components/transaction-edit-dialog';
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
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  deleteTransaction,
  setTransactionStatus,
  updateTransaction,
} from '@/server/transactions-actions';
import type { AccountView } from '@/server/accounts';
import type { CategoryView } from '@/server/categories';
import type { TransactionView } from '@/server/transactions';

/**
 * Extrato denso.
 *
 * Cada linha diz o que é em **palavras** (natureza, estado, “por liquidar”), não
 * só por cor: o sinal está no número, o estado está escrito e a categoria interna
 * vem assinalada como fora dos totais.
 *
 * Os diálogos de edição e de eliminação são únicos para a tabela inteira: montar
 * um por linha seria dezenas de diálogos escondidos à espera de um clique.
 */

/** Alvo de toque: 44 px em telemóvel, denso a partir de `sm`. */
const TOUCH = 'min-h-11 sm:min-h-8';
const ICON_TOUCH = 'min-h-11 min-w-11 sm:min-h-7 sm:min-w-7';

export function TransactionTable({
  items,
  total,
  sumInCents,
  accounts,
  categories,
  hasActiveFilters,
}: {
  readonly items: readonly TransactionView[];
  readonly total: number;
  readonly sumInCents: number;
  readonly accounts: readonly AccountView[];
  readonly categories: readonly CategoryView[];
  readonly hasActiveFilters: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<TransactionView | null>(null);
  const [deleting, setDeleting] = useState<TransactionView | null>(null);

  /**
   * Estado local optimista para o estado de confirmação de cada lançamento.
   * Quando o utilizador clica em "Confirmar", o badge muda **imediatamente** —
   * não espera pelo `router.refresh()` — para haver feedback visual sem latência.
   * O valor do servidor sobrescreve este estado no próximo refresh.
   */
  const [optimisticStatuses, setOptimisticStatuses] = useState<Record<string, string>>({});

  /** Estado effectivamente exibido: optimismo local ou valor do servidor. */
  function visibleStatus(transaction: TransactionView): string {
    return optimisticStatuses[transaction.id] ?? transaction.status;
  }

  /**
   * Marca como liquidado ou por liquidar.
   *
   * É o interruptor que decide se o movimento **move o saldo**: só o que está
   * liquidado conta. Estava só no diálogo de edição — escondido — e o utilizador
   * via um "Por liquidar" que não conseguia tirar, porque o menu só oferecia
   * mudar o *estado* (confirmado/ignorado), que é outra coisa.
   */
  function changeSettled(transaction: TransactionView, settled: boolean) {
    setBusyId(transaction.id);

    startTransition(async () => {
      const result = await updateTransaction({ id: transaction.id, settled });
      setBusyId(null);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(
        settled
          ? 'Marcado como liquidado — já conta no saldo.'
          : 'Marcado como por liquidar — deixa de contar no saldo.',
      );
      router.refresh();
    });
  }

  function changeStatus(transaction: TransactionView, status: 'confirmed' | 'ignored' | 'pending') {
    setBusyId(transaction.id);

    // Optimismo: o badge muda antes de o servidor responder.
    setOptimisticStatuses((prev) => ({ ...prev, [transaction.id]: status }));

    startTransition(async () => {
      const result = await setTransactionStatus({ id: transaction.id, status });
      setBusyId(null);

      if (!result.ok) {
        // Reverte o optimismo se o servidor recusar.
        setOptimisticStatuses((prev) => {
          const next = { ...prev };
          delete next[transaction.id];
          return next;
        });
        toast.error(result.error);
        return;
      }

      const messages: Record<string, string> = {
        ignored: 'Lançamento ignorado.',
        confirmed: 'Lançamento confirmado.',
        pending: 'Lançamento marcado como por confirmar.',
      };
      toast.success(messages[status]);
      router.refresh();
    });
  }

  function confirmDelete() {
    const transaction = deleting;

    if (transaction === null) {
      return;
    }

    setBusyId(transaction.id);

    startTransition(async () => {
      const result = await deleteTransaction({ id: transaction.id });
      setBusyId(null);
      setDeleting(null);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(
        transaction.transferGroupId === null
          ? 'Lançamento apagado.'
          : 'Transferência apagada nas duas contas.',
      );
      router.refresh();
    });
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            icon={ArrowLeftRight}
            title={
              hasActiveFilters ? 'Nenhum movimento com estes filtros' : 'Ainda não há movimentos'
            }
            description={
              hasActiveFilters
                ? 'Os filtros ativos não deixam passar nenhum lançamento. Limpa-os para voltares a ver o extrato completo.'
                : 'Regista o primeiro lançamento no formulário acima — ou importa um extrato em OFX/CSV mais tarde — e ele aparece aqui, do mais recente para o mais antigo.'
            }
            action={
              hasActiveFilters ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={TOUCH}
                  onClick={() => router.push('/transacoes')}
                >
                  Limpar filtros
                </Button>
              ) : null
            }
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="hidden md:table-cell">Conta</TableHead>
                <TableHead className="hidden lg:table-cell">Categoria</TableHead>
                <TableHead className="hidden sm:table-cell">Estado</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-12 text-right">
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {items.map((transaction) => {
                const isInternal = isInternalCategory(categories, transaction.categoryId);

                return (
                  <TableRow key={transaction.id} data-status={visibleStatus(transaction)}>
                    <TableCell className="font-numeric text-muted-foreground tabular-nums">
                      {formatDay(transaction.date)}
                    </TableCell>

                    <TableCell className="max-w-[16rem] whitespace-normal">
                      <span className="block truncate font-medium">
                        {displayDescription(transaction.description)}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5 sm:hidden">
                        <TransactionKindBadge kind={transaction.kind} />
                        <TransactionStatusBadge status={visibleStatus(transaction)} />
                        {transaction.cardName === null ? null : (
                          <Badge variant="secondary" className="font-normal">
                            <CreditCard className="size-3" aria-hidden />
                            {transaction.cardName}
                            {transaction.installmentCount === null
                              ? ''
                              : ` · ${transaction.installmentNumber ?? 1}/${transaction.installmentCount}`}
                          </Badge>
                        )}
                        {transaction.settled ? null : (
                          <Badge variant="outline" className="font-normal text-muted-foreground">
                            Por liquidar
                          </Badge>
                        )}
                      </span>
                    </TableCell>

                    <TableCell className="hidden md:table-cell">
                      <span className="flex flex-wrap items-center gap-1.5">
                        {transaction.accountName ?? '—'}
                        {transaction.cardName === null ? null : (
                          <Badge variant="secondary" className="font-normal">
                            <CreditCard className="size-3" aria-hidden />
                            {transaction.cardName}
                            {transaction.installmentCount === null
                              ? ''
                              : ` · ${transaction.installmentNumber ?? 1}/${transaction.installmentCount}`}
                          </Badge>
                        )}
                      </span>
                    </TableCell>

                    <TableCell className="hidden lg:table-cell">
                      {transaction.categoryName === null ? (
                        <span className="text-muted-foreground">Sem categoria</span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          {transaction.categoryName}
                          {isInternal ? (
                            <Badge variant="secondary" className="font-normal">
                              Fora dos totais
                            </Badge>
                          ) : null}
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="hidden sm:table-cell">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <TransactionStatusBadge status={visibleStatus(transaction)} />
                        {transaction.settled ? null : (
                          <Badge variant="outline" className="font-normal text-muted-foreground">
                            Por liquidar
                          </Badge>
                        )}
                      </span>
                    </TableCell>

                    <TableCell className="text-right">
                      <span className="flex flex-col items-end gap-1">
                        <Amount amountInCents={transaction.amountInCents} withSign />
                        <span className="hidden text-xs text-muted-foreground sm:inline">
                          {TRANSACTION_KIND_LABELS[transaction.kind] ?? transaction.kind}
                        </span>
                      </span>
                    </TableCell>

                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className={ICON_TOUCH}
                            disabled={pending && busyId === transaction.id}
                            aria-label={`Ações do lançamento ${displayDescription(transaction.description)}`}
                          >
                            <EllipsisVertical className="size-4" aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            disabled={visibleStatus(transaction) === 'confirmed'}
                            onSelect={() => changeStatus(transaction, 'confirmed')}
                          >
                            <CircleCheck className="size-4" aria-hidden />
                            Confirmar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={visibleStatus(transaction) === 'ignored'}
                            onSelect={() => changeStatus(transaction, 'ignored')}
                          >
                            <Ban className="size-4" aria-hidden />
                            Ignorar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={visibleStatus(transaction) === 'pending'}
                            onSelect={() => changeStatus(transaction, 'pending')}
                          >
                            <RefreshCw className="size-4" aria-hidden />
                            Marcar como por confirmar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onSelect={() => changeSettled(transaction, !transaction.settled)}
                          >
                            <Wallet className="size-4" aria-hidden />
                            {transaction.settled
                              ? 'Marcar como por liquidar'
                              : 'Marcar como liquidado'}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => setEditing(transaction)}>
                            <Pencil className="size-4" aria-hidden />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setDeleting(transaction)}>
                            <Trash className="size-4" aria-hidden />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>

            <TableFooter>
              <TableRow>
                <TableCell colSpan={6} className="whitespace-normal">
                  <span className="block font-medium">Soma de tudo o que está filtrado</span>
                  <span className="block text-xs font-normal text-muted-foreground">
                    {total === 1 ? '1 movimento' : `${total} movimentos`} no total
                    {items.length < total ? `, ${items.length} nesta página` : ''}. Inclui os
                    ignorados e os que ainda não estão liquidados.
                  </span>
                </TableCell>
                <TableCell className="text-right align-top">
                  <Amount amountInCents={sumInCents} withSign />
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      {editing === null ? null : (
        <TransactionEditDialog
          transaction={editing}
          accounts={accounts}
          categories={categories}
          open
          onOpenChange={(open) => {
            if (!open) {
              setEditing(null);
            }
          }}
        />
      )}

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <Trash aria-hidden />
            </AlertDialogMedia>
            <AlertDialogTitle>Eliminar este lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting !== null && deleting.transferGroupId !== null
                ? 'Este lançamento faz parte de uma transferência: as duas pernas são apagadas, para o dinheiro não desaparecer de uma conta e continuar a aparecer na outra.'
                : 'O movimento desaparece do extrato e o saldo da conta recalcula-se sem ele. Não há forma de o recuperar.'}
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
              {pending ? 'A apagar…' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Descrição legível, mesmo quando o campo está vazio. */
function displayDescription(description: string | null): string {
  return description === null || description.trim() === '' ? 'Sem descrição' : description;
}

/** Se a categoria do lançamento é interna (nunca conta para os totais). */
function isInternalCategory(
  categories: readonly CategoryView[],
  categoryId: string | null,
): boolean {
  if (categoryId === null) {
    return false;
  }

  return categories.find((category) => category.id === categoryId)?.internal ?? false;
}

/** Data de calendário em formato curto, sem deslocação de fuso. */
function formatDay(date: string): string {
  return new Intl.DateTimeFormat('pt-PT', { timeZone: 'UTC', dateStyle: 'short' }).format(
    new Date(`${date}T00:00:00Z`),
  );
}
