import { Wallet } from 'lucide-react';
import type { Metadata } from 'next';

import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Contas' };

export default function ContasPage() {
  return (
    <>
      <PageHeader
        title="Contas"
        description="Onde o dinheiro está: conta à ordem, poupança, carteira e dinheiro. Cada uma com o seu saldo."
        actions={<Button size="sm">Nova conta</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">Sem contas</CardTitle>
            <CardDescription>
              Começa pela conta onde recebes o ordenado. Podes acrescentar as outras depois.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="sm" variant="outline">
              Criar a primeira conta
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <EmptyState
          icon={Wallet}
          title="O saldo de cada conta é calculado a partir dos movimentos"
          description="Se o saldo real não bater certo com o calculado, podes travar o saldo numa data e o sistema cria o lançamento de ajuste — o histórico nunca é reescrito."
        />
      </div>
    </>
  );
}
