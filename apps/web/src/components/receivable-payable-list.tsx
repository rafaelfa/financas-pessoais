'use client';

import { Trash } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { ReceivablePayableDialog } from '@/components/receivable-payable-dialog';
import { ReceivablePayablePayDialog } from '@/components/receivable-payable-pay-dialog';
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
import { Badge, type badgeVariants } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { VariantProps } from 'class-variance-authority';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

import { deleteReceivablePayable } from '@/server/receivable-payable-actions';
import { toDateInputValue } from '@repo/shared';

const STATUS_LABELS = {
  OPEN: 'Aberta',
  PAID: 'Paga',
  OVERDUE: 'Vencida',
  CANCELLED: 'Cancelada',
};

type Status = keyof typeof STATUS_LABELS;
type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>;

const STATUS_COLORS: Record<Status, BadgeVariant> = {
  OPEN: 'default',
  PAID: 'default',
  OVERDUE: 'destructive',
  CANCELLED: 'secondary',
};

const TYPE_LABELS = {
  PAYABLE: 'Conta a Pagar',
  RECEIVABLE: 'Conta a Receber',
};

export type ReceivablePayableRow = {
  id: string;
  type: 'PAYABLE' | 'RECEIVABLE';
  description: string;
  amountInCents: number;
  dueDate: Date;
  paidAt?: Date | null;
  categoryId?: string | null;
  financialAccountId?: string | null;
  tags: string[];
  note?: string | null;
  status: Status;
  paidAmountInCents: number;
  createdAt: Date;
  updatedAt: Date;
};

type ReceivablePayableListProps = {
  items: ReceivablePayableRow[];
  accounts?: Array<{ id: string; name: string; archived?: boolean }>;
  categories?: Array<{ id: string; name: string }>;
};

export function ReceivablePayableList({
  items,
  accounts = [],
  categories = [],
}: ReceivablePayableListProps) {
  const [editing, setEditing] = useState<ReceivablePayableRow | null>(null);
  const [paying, setPaying] = useState<ReceivablePayableRow | null>(null);
  const [deleting, setDeleting] = useState<ReceivablePayableRow | null>(null);
  const [pending, startTransition] = useTransition();

  // Uma conta arquivada não recebe nem paga nada: não se oferece para escolha.
  const activeAccounts = accounts.filter((account) => account.archived !== true);

  function confirmDelete() {
    if (deleting === null) {
      return;
    }

    startTransition(async () => {
      const result = await deleteReceivablePayable({ id: deleting.id });

      if (!result.ok) {
        toast.error(result.error);
        setDeleting(null);
        return;
      }

      toast.success('Conta apagada.');
      setDeleting(null);
    });
  }

  const getAccountName = (accountId?: string | null) => {
    return accounts.find((a) => a.id === accountId)?.name || 'Sem conta';
  };

  const getCategoryName = (categoryId?: string | null) => {
    return categories.find((c) => c.id === categoryId)?.name || 'Sem categoria';
  };

  const getStatusLabel = (status: Status) => STATUS_LABELS[status];

  const getStatusColor = (status: Status) => STATUS_COLORS[status];

  const isOverdue = (dueDate: Date | string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    return due < today;
  };

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <h3 className="text-lg font-medium">Nenhuma conta encontrada</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Começa por adicionar as tuas primeiras contas a pagar ou receber.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const overdue = item.status === 'OPEN' && isOverdue(item.dueDate);
            const isPaid = item.status === 'PAID';

            return (
              <Card key={item.id} className={overdue ? 'border-red-200 bg-red-50' : ''}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={getTypeVariant(item.type)}>{TYPE_LABELS[item.type]}</Badge>
                      <Badge variant={getStatusColor(item.status)}>
                        {getStatusLabel(item.status)}
                        {overdue && ' • Vencida'}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      {item.status !== 'PAID' && !isPaid && (
                        <Button type="button" size="sm" onClick={() => setPaying(item)}>
                          Pagar/Receber
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setEditing(item)}
                      >
                        Editar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleting(item)}
                      >
                        Apagar
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <h4 className="text-lg font-medium">{item.description}</h4>
                    <p className="text-sm text-muted-foreground">
                      Categoria: {getCategoryName(item.categoryId)}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-muted-foreground">Valor</span>
                      <div className="text-lg font-medium">
                        <Amount amountInCents={item.amountInCents} />
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Vencimento</span>
                      <div className={`font-medium ${overdue ? 'text-red-600' : ''}`}>
                        {format(new Date(item.dueDate), "d 'de' MMMM 'de' yyyy", { locale: pt })}
                      </div>
                    </div>
                  </div>

                  {item.paidAt && (
                    <div className="border-t pt-2">
                      <span className="text-xs text-muted-foreground">Data do Pagamento</span>
                      <div className="font-medium text-green-600">
                        {format(new Date(item.paidAt), "d 'de' MMMM 'de' yyyy", { locale: pt })}
                      </div>
                    </div>
                  )}

                  {item.note && (
                    <div className="border-t pt-2">
                      <span className="text-xs text-muted-foreground">Nota</span>
                      <p className="mt-1 text-sm text-muted-foreground">{item.note}</p>
                    </div>
                  )}

                  {item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 border-t pt-2">
                      {item.tags.map((tag, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {item.financialAccountId && (
                    <div className="border-t pt-2">
                      <span className="text-xs text-muted-foreground">Conta</span>
                      <div className="text-sm">{getAccountName(item.financialAccountId)}</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {editing === null ? null : (
        <ReceivablePayableDialog
          mode="edit"
          open
          onOpenChange={(open) => {
            if (!open) {
              setEditing(null);
            }
          }}
          accounts={activeAccounts}
          categories={categories}
          defaultValues={{
            id: editing.id,
            type: editing.type,
            description: editing.description,
            amountInCents: editing.amountInCents,
            dueDate: toDateInputValue(editing.dueDate),
            categoryId: editing.categoryId ?? undefined,
            financialAccountId: editing.financialAccountId ?? undefined,
            note: editing.note ?? undefined,
          }}
        />
      )}

      {paying === null ? null : (
        <ReceivablePayablePayDialog
          item={paying}
          accounts={activeAccounts}
          open
          onOpenChange={(open) => {
            if (!open) {
              setPaying(null);
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
            <AlertDialogTitle>Apagar «{deleting?.description}»?</AlertDialogTitle>
            <AlertDialogDescription>
              A conta e o histórico de pagamentos desaparecem. Os movimentos que já criaste nas
              contas ficam onde estão. Não há forma de recuperar.
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
              {pending ? 'A apagar…' : 'Apagar conta'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function getTypeVariant(type: 'PAYABLE' | 'RECEIVABLE') {
  return type === 'PAYABLE' ? 'default' : 'secondary';
}
