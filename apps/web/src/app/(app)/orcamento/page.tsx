import { PiggyBank } from 'lucide-react';
import type { Metadata } from 'next';

import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Orçamento' };

export default function OrcamentoPage() {
  return (
    <>
      <PageHeader
        title="Orçamento"
        description="Um limite por categoria, com três estados: seguro, atenção e excedido."
        actions={<Button size="sm">Definir limites</Button>}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Consumo deste mês</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={PiggyBank}
            title="Ainda não há limites definidos"
            description="O consumo é medido por competência (o dinheiro conta quando se gasta), para que uma compra no cartão não desapareça do orçamento. O aviso dispara no limiar que escolheres — 80% por omissão."
          />
        </CardContent>
      </Card>
    </>
  );
}
