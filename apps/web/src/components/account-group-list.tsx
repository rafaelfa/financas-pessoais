'use client';

import { MoreHorizontal, Trash } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Amount } from '@/components/amount';
import { AccountGroupDialog } from '@/components/account-group-dialog';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { deleteAccountGroup } from '@/server/account-group-actions';

export type AccountGroupRow = {
  id: string;
  name: string;
  description?: string | null;
  accountGroupItems: Array<{
    financialAccount: {
      id: string;
      name: string;
      balanceInCents?: number | null;
      archivedAt?: Date | null;
    };
  }>;
  createdAt: Date;
  updatedAt: Date;
};

type AccountGroupListProps = {
  groups: AccountGroupRow[];
  accounts?: Array<{ id: string; name: string }>;
};

export function AccountGroupList({ groups, accounts = [] }: AccountGroupListProps) {
  const [editing, setEditing] = useState<AccountGroupRow | null>(null);
  const [deleting, setDeleting] = useState<AccountGroupRow | null>(null);
  const [pending, startTransition] = useTransition();

  function confirmDelete() {
    if (deleting === null) {
      return;
    }

    startTransition(async () => {
      const result = await deleteAccountGroup({ id: deleting.id });

      if (!result.ok) {
        toast.error(result.error);
        setDeleting(null);
        return;
      }

      toast.success('Grupo apagado.');
      setDeleting(null);
    });
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const totalBalance = group.accountGroupItems.reduce(
          (sum, item) => sum + (item.financialAccount.balanceInCents || 0),
          0,
        );

        const activeAccounts = group.accountGroupItems.filter(
          (item) => !item.financialAccount.archivedAt,
        );

        return (
          <Card key={group.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{group.name}</CardTitle>
                  {group.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{group.description}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setEditing(group)}
                  >
                    Editar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeleting(group)}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Opções</span>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4 grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-muted-foreground">Total de Contas</span>
                  <div className="font-medium">
                    {activeAccounts.length} de {group.accountGroupItems.length}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Saldo Consolidado</span>
                  <div className="text-lg font-medium">
                    <Amount amountInCents={totalBalance} />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="mb-2 text-sm font-medium">Contas neste grupo:</h4>
                <div className="space-y-2">
                  {group.accountGroupItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">Nenhuma conta adicionada</p>
                  ) : (
                    group.accountGroupItems.map((item) => (
                      <div
                        key={item.financialAccount.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span
                          className={
                            item.financialAccount.archivedAt ? 'text-muted-foreground' : ''
                          }
                        >
                          {item.financialAccount.name}
                          {item.financialAccount.archivedAt && ' (arquivada)'}
                        </span>
                        <span className="text-muted-foreground">
                          <Amount amountInCents={item.financialAccount.balanceInCents || 0} />
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {editing === null ? null : (
        <AccountGroupDialog
          mode="edit"
          open
          onOpenChange={(open) => {
            if (!open) {
              setEditing(null);
            }
          }}
          accounts={accounts}
          defaultValues={{
            id: editing.id,
            name: editing.name,
            description: editing.description ?? '',
            // Sem isto as caixas abriam vazias e um único clique apagava as outras contas.
            accountIds: editing.accountGroupItems.map((item) => item.financialAccount.id),
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
            <AlertDialogTitle>Apagar «{deleting?.name}»?</AlertDialogTitle>
            <AlertDialogDescription>
              O grupo desaparece e as contas que estavam nele ficam soltas — nenhuma conta é
              apagada. Não há forma de recuperar.
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
              {pending ? 'A apagar…' : 'Apagar grupo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
