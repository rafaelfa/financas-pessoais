'use client';

import { Archive, ArchiveRestore, Pencil, Scale, EllipsisVertical } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import {
  AccountDialog,
  ACCOUNT_TYPE_ICONS,
  ACCOUNT_TYPE_LABELS,
} from '@/components/account-dialog';
import { AccountLockDialog } from '@/components/account-lock-dialog';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { setAccountArchived } from '@/server/accounts-actions';
import type { AccountView } from '@/server/accounts';
import { cn } from '@/lib/utils';

/**
 * Cartão de uma conta.
 *
 * O saldo mostrado é sempre o **calculado** pelo motor a partir dos movimentos
 * liquidados — nunca um número guardado à parte, que divergiria em silêncio.
 */

/** Alvo de toque: 44 px em telemóvel, denso a partir de `sm`. */
const TOUCH = 'min-h-11 sm:min-h-8';
const ICON_TOUCH = 'min-h-11 min-w-11 sm:min-h-7 sm:min-w-7';

export function AccountCard({
  account,
  today,
}: {
  readonly account: AccountView;
  readonly today: string;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [lockOpen, setLockOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const Icon = ACCOUNT_TYPE_ICONS[account.type];

  function confirmArchive() {
    startTransition(async () => {
      const result = await setAccountArchived({
        id: account.id,
        archived: !account.archived,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(account.archived ? 'Conta reativada.' : 'Conta arquivada.');
      setArchiveOpen(false);
    });
  }

  return (
    <Card data-archived={account.archived} className={cn(account.archived && 'opacity-70')}>
      <CardHeader>
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
          >
            {Icon === undefined ? <Scale className="size-4" /> : <Icon className="size-4" />}
          </span>

          <div className="min-w-0 flex-1 space-y-1">
            <CardTitle className="truncate">{account.name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {ACCOUNT_TYPE_LABELS[account.type] ?? account.type}
              {account.institution === null || account.institution === '' ? null : (
                <> · {account.institution}</>
              )}
            </p>
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {account.isPrimary ? <Badge variant="secondary">Principal</Badge> : null}
              {account.archived ? <Badge variant="outline">Arquivada</Badge> : null}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className={ICON_TOUCH}
                aria-label={`Ações da conta ${account.name}`}
              >
                <EllipsisVertical className="size-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                <Pencil className="size-4" aria-hidden />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem disabled={account.archived} onSelect={() => setLockOpen(true)}>
                <Scale className="size-4" aria-hidden />
                Travar saldo
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setArchiveOpen(true)}>
                {account.archived ? (
                  <ArchiveRestore className="size-4" aria-hidden />
                ) : (
                  <Archive className="size-4" aria-hidden />
                )}
                {account.archived ? 'Reativar' : 'Arquivar'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-1">
        <p className="text-xs text-muted-foreground">Saldo calculado</p>
        <p className="text-2xl font-semibold">
          <Amount amountInCents={account.balanceInCents} tone="neutral" />
        </p>
        <p className="text-sm text-muted-foreground">
          {account.transactionCount === 0
            ? 'Ainda sem movimentos.'
            : account.transactionCount === 1
              ? '1 movimento.'
              : `${account.transactionCount} movimentos.`}
        </p>
      </CardContent>

      <div className="flex flex-wrap gap-2 px-(--card-spacing)">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={TOUCH}
          onClick={() => setLockOpen(true)}
          disabled={account.archived}
        >
          <Scale className="size-3.5" aria-hidden />
          Travar saldo
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={TOUCH}
          onClick={() => setEditOpen(true)}
        >
          <Pencil className="size-3.5" aria-hidden />
          Editar
        </Button>
      </div>

      <AccountDialog mode="edit" account={account} open={editOpen} onOpenChange={setEditOpen} />

      <AccountLockDialog
        account={account}
        today={today}
        open={lockOpen}
        onOpenChange={setLockOpen}
      />

      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              {account.archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
            </AlertDialogMedia>
            <AlertDialogTitle>
              {account.archived ? `Reativar «${account.name}»?` : `Arquivar «${account.name}»?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {account.archived
                ? 'A conta volta a contar para os saldos e a aparecer nos lançamentos.'
                : 'A conta sai dos saldos e das listas. Os movimentos ficam guardados e podes reativá-la quando quiseres.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant={account.archived ? 'default' : 'destructive'}
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                confirmArchive();
              }}
            >
              {pending ? 'A guardar…' : account.archived ? 'Reativar' : 'Arquivar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
