import { PiggyBank } from 'lucide-react';
import type { Metadata } from 'next';

import { BudgetDialog } from '@/components/budget-dialog';
import { BudgetLimitList } from '@/components/budget-limit-list';
import { BudgetOverview } from '@/components/budget-overview';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { listBudgets } from '@/server/budgets';

export const metadata: Metadata = { title: 'Orçamento' };

/**
 * Orçamento do período.
 *
 * Tudo o que aparece aqui vem calculado do servidor: o gasto do período, a
 * projeção ao ritmo observado e o estado de cada limite. O período não se
 * escolhe nesta página — é o mês do utilizador, com o dia de início que ele
 * definiu nas preferências.
 */
export default async function OrcamentoPage() {
  const budgets = await listBudgets();

  return (
    <>
      <PageHeader
        title="Orçamento"
        description="Quanto queres gastar no mês e onde. O projetado diz-te se o ritmo atual te leva a passar o orçamento antes do fim do período."
        actions={
          budgets.length === 0 ? null : (
            <BudgetDialog mode="create" trigger={<Button size="sm">Novo orçamento</Button>} />
          )
        }
      />

      {budgets.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title="Ainda não tens orçamento"
          description="Começa por um total para o mês — por exemplo, o que costumas gastar — e depois distribui por categorias: alimentação, transportes, lazer. Com limites definidos, vês o consumo a subir e recebes o aviso antes de passar."
          action={
            <BudgetDialog
              mode="create"
              trigger={<Button size="sm">Criar o primeiro orçamento</Button>}
            />
          }
        />
      ) : (
        <div className="space-y-10">
          {budgets.map((budget) => (
            <section key={budget.id} aria-label={budget.name} className="space-y-6">
              <BudgetOverview
                budget={budget}
                actions={
                  <BudgetDialog
                    mode="edit"
                    budget={{
                      id: budget.id,
                      name: budget.name,
                      scope: budget.scope,
                      totalAmountInCents: budget.totalAmountInCents,
                      alertsEnabled: budget.alertsEnabled,
                    }}
                    trigger={
                      <Button size="sm" variant="outline">
                        Editar orçamento
                      </Button>
                    }
                  />
                }
              />

              <BudgetLimitList budget={budget} />
            </section>
          ))}
        </div>
      )}
    </>
  );
}
