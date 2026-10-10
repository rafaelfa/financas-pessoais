import type { Metadata } from 'next';

import { ChartCard } from '@/components/chart-card';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Relatórios' };

export default function RelatoriosPage() {
  return (
    <>
      <PageHeader
        title="Relatórios"
        description="Extrato filtrado, evolução mês a mês e comparações entre períodos."
        actions={
          <Button size="sm" variant="outline">
            Exportar
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Evolução do património"
          description="Ativos menos passivos, mês a mês."
          isEmpty
          emptyMessage="Assim que houver alguns meses de movimentos, a evolução aparece aqui."
        />
        <ChartCard
          title="Poupança por mês"
          description="Quanto sobra ao fim de cada mês."
          isEmpty
          emptyMessage="Sem movimentos registados ainda não há poupança para medir."
        />
        <ChartCard
          title="Média por categoria"
          description="Comparação entre os últimos 3, 6 e 12 meses."
          isEmpty
          emptyMessage="As médias precisam de histórico. Aparecem depois do primeiro mês completo."
        />
        <ChartCard
          title="Projeção de saldo"
          description="Onde o saldo estará nos próximos meses, com as recorrências contadas."
          isEmpty
          emptyMessage="A projeção usa as recorrências e as faturas por pagar. Ainda não há nenhumas."
        />
      </div>
    </>
  );
}
