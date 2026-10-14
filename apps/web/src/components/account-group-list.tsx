import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Amount } from './amount';
import { MoreHorizontal } from 'lucide-react';

export type AccountGroupRow = {
  id: string;
  name: string;
  description?: string | null;
  accountGroupItems: Array<{
    financialAccount: {
      id: string;
      name: string;
      balanceInCents?: number | null;
      archivedAt?: string | null;
    };
  }>;
  createdAt: string;
  updatedAt: string;
};

type AccountGroupListProps = {
  groups: AccountGroupRow[];
  onEdit: (group: AccountGroupRow) => void;
  onDelete: (id: string) => void;
};

export function AccountGroupList({
  groups,
  onEdit,
  onDelete,
}: AccountGroupListProps) {
  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const totalBalance = group.accountGroupItems.reduce(
          (sum, item) => sum + (item.financialAccount.balanceInCents || 0),
          0
        );
        
        const activeAccounts = group.accountGroupItems.filter(
          (item) => !item.financialAccount.archivedAt
        );

        return (
          <Card key={group.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{group.name}</CardTitle>
                  {group.description && (
                    <p className="text-sm text-muted-foreground mt-1">{group.description}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => onEdit(group)}>
                    Editar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onDelete(group.id)}>
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Opções</span>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <span className="text-xs text-muted-foreground">Total de Contas</span>
                  <div className="font-medium">{activeAccounts.length} de {group.accountGroupItems.length}</div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Saldo Consolidado</span>
                  <div className="font-medium text-lg">
                    <Amount amountInCents={totalBalance} />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-2">Contas neste grupo:</h4>
                <div className="space-y-2">
                  {group.accountGroupItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">Nenhuma conta adicionada</p>
                  ) : (
                    group.accountGroupItems.map((item) => (
                      <div key={item.financialAccount.id} className="flex items-center justify-between text-sm">
                        <span className={item.financialAccount.archivedAt ? 'text-muted-foreground' : ''}>
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
    </div>
  );
}
