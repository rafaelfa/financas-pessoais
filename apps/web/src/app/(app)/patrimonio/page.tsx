import type { Metadata } from 'next';

import { Amount } from '@/components/amount';
import { PageHeader } from '@/components/page-header';
import { PatrimonioList } from '@/components/patrimonio-list';
import { getDashboard } from '@/server/dashboard';
import { listAssets, listLiabilities } from '@/server/patrimonio';

export const metadata: Metadata = { title: 'Património' };

/**
 * Bens e dívidas.
 *
 * O número que interessa é o património líquido — contas + bens + objetivos −
 * faturas − dívidas — e vem do **Painel**: é o mesmo `netWorth` com as mesmas
 * entradas, para os dois ecrãs não poderem discordar.
 *
 * Os três totais aparecem **sempre**, mesmo a zero: quem chega aqui sem bens nem
 * dívidas tem, ainda assim, contas, cartões ou objetivos a contar. O convite a
 * registar fica dentro de cada secção, não no lugar da página.
 */
export default async function PatrimonioPage() {
  const [assets, liabilities, dashboard] = await Promise.all([
    listAssets(),
    listLiabilities(),
    getDashboard(),
  ]);

  const bens = assets.filter((asset) => !asset.archived);
  const dividas = liabilities.filter((liability) => !liability.archived);

  const totalBens = bens.reduce((total, asset) => total + asset.valueInCents, 0);
  const totalDividas = dividas.reduce(
    (total, liability) => total + liability.outstandingInCents,
    0,
  );
  const liquido = dashboard.patrimonyInCents;

  return (
    <>
      <PageHeader
        title="Património"
        description="Bens e dívidas: o que tens e o que deves, para além do dinheiro nas contas."
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <h2 className="text-sm font-medium text-muted-foreground">Bens</h2>
          <div className="mt-1 text-2xl font-bold">
            <Amount amountInCents={totalBens} tone="neutral" />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {bens.length === 1 ? '1 bem ativo' : `${bens.length} bens ativos`}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <h2 className="text-sm font-medium text-muted-foreground">Dívidas</h2>
          <div className="mt-1 text-2xl font-bold">
            <Amount amountInCents={totalDividas} tone="neutral" />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {dividas.length === 1 ? '1 dívida ativa' : `${dividas.length} dívidas ativas`}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <h2 className="text-sm font-medium text-muted-foreground">Património líquido</h2>
          <div className={`mt-1 text-2xl font-bold ${liquido < 0 ? 'text-destructive' : ''}`}>
            <Amount amountInCents={liquido} tone="neutral" />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">contas + bens − dívidas</p>
        </div>
      </div>

      <PatrimonioList assets={assets} liabilities={liabilities} />
    </>
  );
}
