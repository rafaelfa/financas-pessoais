import { Plus } from 'lucide-react';
import type { Metadata } from 'next';

import { AccountGroupDialog } from '@/components/account-group-dialog';
import { AccountGroupList } from '@/components/account-group-list';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Amount } from '@/components/amount';
import { listAccounts } from '@/server/accounts';
import { listAccountGroups } from '@/server/account-groups';

export const metadata: Metadata = { title: 'Consolidação de Contas' };

export default async function AccountGroupPage() {
  const [accounts, groups] = await Promise.all([listAccounts(), listAccountGroups()]);

  return (
    <>
      <PageHeader
        title="Consolidação de Contas"
        description="Agrupa as tuas contas para ver saldos consolidados por finalidade (ex.: Contas Principais, Contas de Emergência)."
        actions={
          <AccountGroupDialog
            mode="create"
            accounts={accounts}
            trigger={
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Novo Grupo
              </Button>
            }
          />
        }
      />

      <div className="space-y-8">
        {/* Resumo */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border bg-card p-4">
            <h3 className="text-sm font-medium text-muted-foreground">Total de Grupos</h3>
            <div className="text-2xl font-bold">{groups.length}</div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <h3 className="text-sm font-medium text-muted-foreground">Contas Consolidadas</h3>
            <div className="text-2xl font-bold">
              {groups.reduce((sum, group) => sum + group.accountGroupItems.length, 0)}
            </div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <h3 className="text-sm font-medium text-muted-foreground">Saldo Total</h3>
            <div className="text-2xl font-bold">
              <Amount
                amountInCents={groups.reduce((sum, group) => {
                  return (
                    sum +
                    group.accountGroupItems.reduce(
                      (innerSum, item) => innerSum + (item.financialAccount.balanceInCents || 0),
                      0,
                    )
                  );
                }, 0)}
              />
            </div>
          </div>
        </div>

        {/* Lista de Grupos */}
        {groups.length > 0 ? (
          <section aria-labelledby="grupos">
            <h2 id="grupos" className="sr-only">
              Grupos de Contas
            </h2>
            <AccountGroupList groups={groups} accounts={accounts} />
          </section>
        ) : (
          <EmptyState
            icon={Plus}
            title="Ainda não há grupos"
            description="Cria grupos para consolidar as tuas contas por finalidade e ver saldos agrupados."
            action={
              <AccountGroupDialog
                mode="create"
                accounts={accounts}
                trigger={
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Criar primeiro grupo
                  </Button>
                }
              />
            }
          />
        )}

        {/* Informação adicional */}
        <div className="rounded-xl border bg-muted p-4 text-sm">
          <h3 className="mb-2 font-medium">Como usar os grupos?</h3>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>
              Cria grupos por finalidade (ex.: &quot;Contas Principais&quot;,
              &quot;Emergência&quot;, &quot;Investimentos&quot;)
            </li>
            <li>Adiciona contas aos grupos para ver o saldo consolidado</li>
            <li>Usa grupos para ter uma visão geral de áreas específicas das tuas finanças</li>
          </ul>
        </div>
      </div>
    </>
  );
}
