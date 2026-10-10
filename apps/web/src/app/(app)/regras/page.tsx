import { ListFilter } from 'lucide-react';
import type { Metadata } from 'next';

import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Regras' };

export default function RegrasPage() {
  return (
    <>
      <PageHeader
        title="Regras"
        description="Categoriza automaticamente o que se repete: “sempre que aparecer EDP, é Água, luz e gás”."
        actions={<Button size="sm">Nova regra</Button>}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Regras de categorização</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={ListFilter}
            title="Ainda não há regras"
            description="Cada regra precisa de pelo menos uma condição — descrição, contraparte, valor, dia do mês ou conta. Antes de aplicar, podes pré-visualizar exatamente que lançamentos seriam afetados."
          />
        </CardContent>
      </Card>
    </>
  );
}
