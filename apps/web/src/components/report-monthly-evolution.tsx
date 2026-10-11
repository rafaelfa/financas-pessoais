import { CashflowChart, type CashflowPoint } from '@/components/cashflow-chart';
import { ChartCard } from '@/components/chart-card';
import { Amount } from '@/components/amount';
import type { ReportView } from '@/server/reports';

/**
 * Evolução mensal.
 *
 * O gráfico (o `CashflowChart` do painel) desenha entradas e saídas — é o que ele
 * faz, e não vale a pena ter dois gráficos iguais no projeto. O **resultado** de
 * cada mês, que o gráfico não desenha, aparece na tabela logo abaixo, com os
 * mesmos números: a informação fica toda, e quem não distingue as cores das
 * barras lê a tabela.
 */

/** Nomes curtos dos meses, só para o eixo do gráfico não ficar apertado. */
const SHORT_MONTHS = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

export function ReportMonthlyEvolution({ byMonth }: { readonly byMonth: ReportView['byMonth'] }) {
  const data: CashflowPoint[] = byMonth.map((month) => ({
    mes: shortMonthLabel(month.key, month.label),
    // O gráfico trabalha em euros: o eixo não deve mostrar cêntimos.
    entradas: month.incomeInCents / 100,
    saidas: month.expenseInCents / 100,
  }));

  return (
    <div className="space-y-4">
      <ChartCard
        title="Evolução mensal"
        description="Entradas e saídas dos últimos meses, no regime escolhido. O resultado de cada mês está na tabela abaixo."
        isEmpty={byMonth.length === 0}
        emptyMessage="Ainda não há meses suficientes para desenhar a evolução."
      >
        <CashflowChart data={data} />
      </ChartCard>

      {byMonth.length === 0 ? null : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Entradas, saídas e resultado de cada mês, no regime escolhido
            </caption>
            <thead>
              <tr className="border-b text-left">
                <th scope="col" className="px-3 py-2 font-medium">
                  Mês
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Entradas
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Saídas
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Resultado
                </th>
              </tr>
            </thead>
            <tbody>
              {byMonth.map((month) => (
                <tr key={month.key} className="border-b last:border-0">
                  <th scope="row" className="px-3 py-2 text-left font-normal">
                    {month.label}
                  </th>
                  <td className="px-3 py-2 text-right">
                    <Amount amountInCents={month.incomeInCents} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Amount amountInCents={month.expenseInCents} tone="neutral" />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Amount amountInCents={month.netInCents} withSign />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * Rótulo curto para o eixo do gráfico.
 *
 * A chave do período é `AAAA-MM`, por isso dá para escrever “out/26” sem
 * consultar nada. Se um dia a chave mudar de forma, cai-se no rótulo do servidor
 * em vez de mostrar lixo.
 */
function shortMonthLabel(key: string, fallback: string): string {
  if (!/^\d{4}-\d{2}$/.test(key)) {
    return fallback;
  }

  const month = SHORT_MONTHS[Number(key.slice(5, 7)) - 1] ?? '';

  return `${month}/${key.slice(2, 4)}`;
}
