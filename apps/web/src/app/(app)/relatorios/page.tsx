import { ChartColumn } from 'lucide-react';
import type { Metadata } from 'next';

import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { basisFromParam } from '@/components/report-basis';
import { ReportCategoryBreakdown } from '@/components/report-category-breakdown';
import { ReportComparison } from '@/components/report-comparison';
import { ReportExportButton } from '@/components/report-export-button';
import { ReportFilters } from '@/components/report-filters';
import { ReportMonthlyEvolution } from '@/components/report-monthly-evolution';
import { ReportSummary } from '@/components/report-summary';
import { comparePeriods, getReport, listPeriods } from '@/server/reports';

export const metadata: Metadata = { title: 'Relatórios' };

type SearchParams = Record<string, string | string[] | undefined>;

/** Quantos meses o seletor oferece. */
const PERIODS_TO_OFFER = 12;

/**
 * Relatórios.
 *
 * O período e o regime vivem no URL. Isso não é só uma preferência de estilo: é
 * o que garante que a **exportação** usa exatamente os dois parâmetros que
 * produziram os números no ecrã. O botão de exportar recebe os valores já
 * resolvidos, nunca o texto cru do URL.
 *
 * O período pedido é validado contra a lista: um `?periodo=` antigo cai no mês
 * mais recente em vez de rebentar, e o que se exporta continua a ser o que está
 * à vista.
 */
export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const periods = await listPeriods(PERIODS_TO_OFFER);

  const requested = typeof params.periodo === 'string' ? params.periodo : undefined;
  const selected = periods.find((period) => period.key === requested) ?? periods[0];
  const basis = basisFromParam(typeof params.regime === 'string' ? params.regime : undefined);

  if (selected === undefined) {
    return (
      <>
        <PageHeader
          title="Relatórios"
          description="O mês em caixa e em competência, com a evolução recente e a comparação com o mês anterior."
        />

        <EmptyState
          icon={ChartColumn}
          title="Ainda não há períodos para relatar"
          description="Um relatório precisa de meses com movimentos. Regista alguns lançamentos e volta aqui: o mês aparece assim que tiver dados para somar."
        />
      </>
    );
  }

  const [report, comparison] = await Promise.all([
    getReport({ periodKey: selected.key, basis }),
    comparePeriods({ periodKey: selected.key, basis }),
  ]);

  return (
    <>
      <PageHeader
        title="Relatórios"
        description="O mesmo mês em dois regimes: caixa (quando o dinheiro se moveu) e competência (quando gastaste). A exportação leva exatamente o que está à vista."
        actions={
          <ReportExportButton periodKey={selected.key} periodLabel={selected.label} basis={basis} />
        }
      />

      <div className="space-y-8">
        <ReportFilters periods={periods} periodKey={selected.key} basis={basis} />

        <ReportSummary report={report} />

        <ReportMonthlyEvolution byMonth={report.byMonth} />

        <ReportCategoryBreakdown report={report} />

        <ReportComparison comparison={comparison} />
      </div>
    </>
  );
}
