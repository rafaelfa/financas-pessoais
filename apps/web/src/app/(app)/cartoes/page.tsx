import { CreditCard } from 'lucide-react';
import type { Metadata } from 'next';

import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Cartões' };

export default function CartoesPage() {
  return (
    <>
      <PageHeader
        title="Cartões"
        description="Faturas, limites e compras a prestações. O pagamento da fatura é uma operação própria — nunca um ganho."
        actions={<Button size="sm">Adicionar cartão</Button>}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Faturas por pagar</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={CreditCard}
            title="Nenhuma fatura registada"
            description="Ao criar um cartão, defines o dia de fecho e o de vencimento. A primeira fatura nasce com a primeira compra, e um pagamento parcial transita automaticamente para a fatura seguinte."
          />
        </CardContent>
      </Card>
    </>
  );
}
