import { Amount } from '@/components/amount';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

const STATUS_LABELS = {
  OPEN: 'Aberta',
  PAID: 'Paga',
  OVERDUE: 'Vencida',
  CANCELLED: 'Cancelada',
};

const STATUS_COLORS = {
  OPEN: 'default',
  PAID: 'success',
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
  dueDate: string;
  paidAt?: string | null;
  categoryId?: string | null;
  financialAccountId?: string | null;
  tags: string[];
  note?: string | null;
  status: 'OPEN' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  paidAmountInCents: number;
  createdAt: string;
  updatedAt: string;
};

type ReceivablePayableListProps = {
  items: ReceivablePayableRow[];
  onPay: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (item: ReceivablePayableRow) => void;
  accounts?: Array<{ id: string; name: string }>;
  categories?: Array<{ id: string; name: string }>;
};

export function ReceivablePayableList({
  items,
  onPay,
  onDelete,
  onEdit,
  accounts = [],
  categories = [],
}: ReceivablePayableListProps) {
  const getAccountName = (accountId?: string | null) => {
    return accounts.find((a) => a.id === accountId)?.name || 'Sem conta';
  };

  const getCategoryName = (categoryId?: string | null) => {
    return categories.find((c) => c.id === categoryId)?.name || 'Sem categoria';
  };

  const getStatusLabel = (status: string) => {
    return STATUS_LABELS[status as keyof typeof STATUS_LABELS] || status;
  };

  const getStatusColor = (status: string) => {
    return STATUS_COLORS[status as keyof typeof STATUS_COLORS] || 'default';
  };

  const isOverdue = (dueDate: string) => {
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
          <p className="text-sm text-muted-foreground mt-2">
            Comece adicionando suas primeiras contas a pagar ou receber.
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
                      <Badge variant={getTypeVariant(item.type)}>
                        {TYPE_LABELS[item.type]}
                      </Badge>
                      <Badge variant={getStatusColor(item.status)}>
                        {getStatusLabel(item.status)}
                        {overdue && ' • Vencida'}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      {item.status !== 'PAID' && !isPaid && (
                        <Button size="sm" onClick={() => onPay(item.id)}>
                          Pagar/Receber
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => onEdit(item)}>
                        Editar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => onDelete(item.id)}>
                        Apagar
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <h4 className="font-medium text-lg">{item.description}</h4>
                    <p className="text-sm text-muted-foreground">
                      Categoria: {getCategoryName(item.categoryId)}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-muted-foreground">Valor</span>
                      <div className="font-medium text-lg">
                        <Amount amountInCents={item.amountInCents} />
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Vencimento</span>
                      <div className={`font-medium ${overdue ? 'text-red-600' : ''}`}>
                        {format(new Date(item.dueDate), 'd \'de\' MMMM \'de\' yyyy', { locale: pt })}
                      </div>
                    </div>
                  </div>

                  {item.paidAt && (
                    <div className="pt-2 border-t">
                      <span className="text-xs text-muted-foreground">Data do Pagamento</span>
                      <div className="font-medium text-green-600">
                        {format(new Date(item.paidAt), 'd \'de\' MMMM \'de\' yyyy', { locale: pt })}
                      </div>
                    </div>
                  )}

                  {item.note && (
                    <div className="pt-2 border-t">
                      <span className="text-xs text-muted-foreground">Nota</span>
                      <p className="text-sm text-muted-foreground mt-1">{item.note}</p>
                    </div>
                  )}

                  {item.tags.length > 0 && (
                    <div className="pt-2 border-t flex flex-wrap gap-1">
                      {item.tags.map((tag, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {item.financialAccountId && (
                    <div className="pt-2 border-t">
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
    </div>
  );
}

function getTypeVariant(type: 'PAYABLE' | 'RECEIVABLE') {
  return type === 'PAYABLE' ? 'default' : 'secondary';
}
