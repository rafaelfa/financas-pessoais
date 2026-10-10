import { Target } from 'lucide-react';
import type { Metadata } from 'next';

import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Objetivos' };

export default function ObjetivosPage() {
  return (
    <>
      <PageHeader
        title="Objetivos"
        description="Quanto queres juntar, até quando, e quanto tens de guardar em cada mês."
        actions={<Button size="sm">Novo objetivo</Button>}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Os teus objetivos</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={Target}
            title="Ainda não tens objetivos"
            description="Um objetivo responde a três perguntas: quanto, até quando e quanto por mês. A aplicação calcula o esforço necessário e projeta a data de conclusão ao teu ritmo real de poupança."
          />
        </CardContent>
      </Card>
    </>
  );
}
