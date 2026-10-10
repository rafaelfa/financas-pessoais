import { Wallet } from 'lucide-react';
import type { Metadata } from 'next';

import { AccountCard } from '@/components/account-card';
import { AccountDialog } from '@/components/account-dialog';
import { Amount } from '@/components/amount';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { todayInLisbon } from '@/lib/today';
import { listAccounts } from '@/server/accounts';

export const metadata: Metadata = { title: 'Contas' };

/**
 * Contas.
 *
 * Tudo o que aparece aqui é calculado no servidor a partir dos movimentos. A
 * página não guarda nem recalcula saldos: mostra o que o motor financeiro diz.
 */
export default async function ContasPage() {
  const accounts = await listAccounts();
  const today = todayInLisbon();

  const active = accounts.filter((account) => !account.archived);
  const archived = accounts.filter((account) => account.archived);
  const totalInCents = active.reduce((total, account) => total + account.balanceInCents, 0);

  return (
    <>
      <PageHeader
        title="Contas"
        description="Onde o dinheiro está: conta à ordem, poupança, carteira e dinheiro. Cada uma com o saldo calculado a partir dos movimentos."
        actions={
          accounts.length === 0 ? null : (
            <AccountDialog mode="create" trigger={<Button size="sm">Nova conta</Button>} />
          )
        }
      />

      {accounts.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Ainda não tens contas"
          description="Começa pela conta onde recebes o ordenado. Podes acrescentar as outras depois — e o saldo inicial é o que tens hoje nessa conta."
          action={
            <AccountDialog
              mode="create"
              trigger={<Button size="sm">Criar a primeira conta</Button>}
            />
          }
        />
      ) : (
        <div className="space-y-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border bg-muted/30 px-4 py-3">
            <span className="text-sm text-muted-foreground">
              Saldo total das contas ativas
              {archived.length === 0 ? null : (
                <>
                  {' '}
                  — {archived.length === 1 ? '1 arquivada' : `${archived.length} arquivadas`} de
                  fora
                </>
              )}
            </span>
            <span className="text-xl font-semibold">
              <Amount amountInCents={totalInCents} tone="neutral" />
            </span>
          </div>

          {active.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Todas as contas estão arquivadas. Reativa uma para voltar a lançar movimentos.
            </p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {active.map((account) => (
                <li key={account.id}>
                  <AccountCard account={account} today={today} />
                </li>
              ))}
            </ul>
          )}

          {archived.length === 0 ? null : (
            <section aria-labelledby="contas-arquivadas" className="space-y-3">
              <div className="space-y-1">
                <h2 id="contas-arquivadas" className="font-heading text-lg font-medium">
                  Arquivadas
                </h2>
                <p className="text-sm text-muted-foreground">
                  Saíram dos saldos, mas os movimentos continuam guardados. Reativa uma para voltar
                  a contá-la.
                </p>
              </div>

              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {archived.map((account) => (
                  <li key={account.id}>
                    <AccountCard account={account} today={today} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </>
  );
}
