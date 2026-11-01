import { Plus } from 'lucide-react';
import type { Metadata } from 'next';

import { ReceivablePayableDialog } from '@/components/receivable-payable-dialog';
import { ReceivablePayableList } from '@/components/receivable-payable-list';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { listAccounts } from '@/server/accounts';
import { listCategories } from '@/server/categories';
import { listReceivablePayables } from '@/server/receivable-payables';

export const metadata: Metadata = { title: 'Contas a Pagar / Receber' };

export default async function ReceivablePayablePage() {
  const [accounts, categories, items] = await Promise.all([
    listAccounts(),
    listCategories(),
    listReceivablePayables(),
  ]);

  // Uma conta arquivada não serve para lançamentos novos: não se oferece na criação.
  const activeAccounts = accounts.filter((account) => !account.archived);

  const unpaidItems = items.filter((item) => item.status !== 'PAID');
  const paidItems = items.filter((item) => item.status === 'PAID');

  return (
    <>
      <PageHeader
        title="Contas a Pagar / Receber"
        description="Gere as tuas despesas e receitas recorrentes. Contas pendentes aparecem aqui."
        actions={
          <ReceivablePayableDialog
            mode="create"
            accounts={activeAccounts}
            categories={categories}
            trigger={
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Nova Conta
              </Button>
            }
          />
        }
      />

      <div className="space-y-8">
        {/* Resumo */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border bg-card p-4">
            <h3 className="text-sm font-medium text-muted-foreground">Total de Contas</h3>
            <div className="text-2xl font-bold">{items.length}</div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <h3 className="text-sm font-medium text-muted-foreground">Contas Pendentes</h3>
            <div className="text-2xl font-bold text-amber-600">{unpaidItems.length}</div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <h3 className="text-sm font-medium text-muted-foreground">Contas Pagas</h3>
            <div className="text-2xl font-bold text-green-600">{paidItems.length}</div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <h3 className="text-sm font-medium text-muted-foreground">Valor Pendente</h3>
            <div className="text-2xl font-bold text-amber-600">
              {unpaidItems.reduce((sum, item) => sum + item.amountInCents, 0) / 100} €
            </div>
          </div>
        </div>

        {/* Contas Pendentes */}
        {unpaidItems.length > 0 && (
          <section aria-labelledby="pendentes">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="pendentes" className="font-heading text-lg font-medium">
                Contas Pendentes
              </h2>
            </div>
            <ReceivablePayableList
              items={unpaidItems}
              accounts={accounts}
              categories={categories}
            />
          </section>
        )}

        {/* Contas Pagas */}
        {paidItems.length > 0 && (
          <section aria-labelledby="pagas">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="pagas" className="font-heading text-lg font-medium">
                Contas Pagas
              </h2>
            </div>
            <ReceivablePayableList items={paidItems} accounts={accounts} categories={categories} />
          </section>
        )}

        {/* Estado vazio */}
        {items.length === 0 && (
          <EmptyState
            icon={Plus}
            title="Ainda não há contas"
            description="Regista as tuas primeiras contas a pagar ou receber para começares a controlar as tuas despesas e receitas."
            action={
              <ReceivablePayableDialog
                mode="create"
                accounts={activeAccounts}
                categories={categories}
                trigger={
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Criar primeira conta
                  </Button>
                }
              />
            }
          />
        )}
      </div>
    </>
  );
}
