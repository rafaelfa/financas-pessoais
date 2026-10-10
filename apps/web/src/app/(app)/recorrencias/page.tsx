import { Repeat } from 'lucide-react';
import type { Metadata } from 'next';

import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Recorrências' };

export default function RecorrenciasPage() {
  return (
    <>
      <PageHeader
        title="Recorrências"
        description="Contas fixas e lançamentos que se repetem: renda, subscrições, seguros e salário."
        actions={<Button size="sm">Nova recorrência</Button>}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lançamentos automáticos</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={Repeat}
            title="Ainda não há recorrências"
            description="Uma recorrência gera os lançamentos futuros sozinha, sem duplicar nada se correr duas vezes. A projeção de saldo do painel passa a contar com elas."
          />
        </CardContent>
      </Card>
    </>
  );
}
