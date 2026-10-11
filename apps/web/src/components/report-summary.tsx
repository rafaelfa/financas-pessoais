import { ArrowLeftRight, TrendingDown, TrendingUp, Wallet } from 'lucide-react';

import { Amount } from '@/components/amount';
import { KpiCard } from '@/components/kpi-card';
import {
  REPORT_BASIS_DIFFERENCE,
  REPORT_BASIS_LABELS,
  REPORT_BASIS_SUMMARIES,
} from '@/components/report-basis';
import { Badge } from '@/components/ui/badge';
import type { ReportView } from '@/server/reports';

/**
 * Resumo do período no regime escolhido.
 *
 * As cinco linhas que respondem a “como correu este mês”: o que entrou, o que
 * saiu, o que sobrou, quantos movimentos e quanto se gastou por dia em média.
 *
 * A frase sobre o regime fica **junto aos números**, e não escondida nas opções:
 * é ela que explica porque é que o mesmo mês dá totais diferentes em caixa e em
 * competência.
 */
export function ReportSummary({ report }: { readonly report: ReportView }) {
  return (
    <section aria-label={`Resumo de ${report.label}`} className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-heading text-lg font-medium">{report.label}</h2>
        <Badge variant="secondary">Regime: {REPORT_BASIS_LABELS[report.basis]}</Badge>
      </div>

      <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
        {REPORT_BASIS_SUMMARIES[report.basis]}{' '}
        <span className="text-muted-foreground">{REPORT_BASIS_DIFFERENCE}</span>
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Entradas" icon={TrendingUp} hint="Dinheiro que entrou no período.">
          <Amount amountInCents={report.incomeInCents} />
        </KpiCard>

        <KpiCard label="Saídas" icon={TrendingDown} hint="Dinheiro que saiu no período.">
          <Amount amountInCents={report.expenseInCents} tone="neutral" />
        </KpiCard>

        <KpiCard label="Resultado" icon={Wallet} hint="Entradas menos saídas.">
          <Amount amountInCents={report.netInCents} withSign />
        </KpiCard>

        <KpiCard
          label="Movimentos"
          icon={ArrowLeftRight}
          hint="Lançamentos que contam neste regime."
        >
          <span className="tabular-nums">{report.transactionCount}</span>
        </KpiCard>

        <KpiCard label="Despesa média diária" icon={TrendingDown} hint="Média por dia do período.">
          <Amount amountInCents={report.averageDailyExpenseInCents} tone="neutral" />
        </KpiCard>
      </div>
    </section>
  );
}
