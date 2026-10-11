'use server';

import { getReport, type ReportBasis } from './reports';
import { fromZodError, ok, type ActionResult } from './result';
import { z } from 'zod';

/**
 * Exportação do relatório para CSV.
 *
 * Duas decisões que fazem a diferença num ficheiro que se abre no Excel em
 * Portugal:
 * - o separador é `;` — com vírgulas, o Excel em pt-PT mete tudo numa coluna;
 * - o ficheiro começa com marca de ordem de bytes (`\uFEFF`), senão os acentos
 *   aparecem trocados ("AlimentaÃ§Ã£o").
 *
 * O conteúdo é gerado a partir do **mesmo** `getReport` que alimenta o ecrã: um
 * CSV com números diferentes dos que o utilizador viu seria pior do que não
 * haver exportação.
 */

const exportSchema = z.object({
  periodKey: z.string().trim().max(20).optional(),
  basis: z.enum(['cash', 'accrual']).optional(),
});

/** Cêntimos para o formato do Excel português: `1234,56`. */
function cents(value: number): string {
  return (value / 100).toFixed(2).replace('.', ',');
}

function cell(value: string): string {
  // Aspas quando o texto tem o separador ou aspas; aspas duplicadas por dentro.
  return /[";\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export async function exportReportCsv(
  input: unknown,
): Promise<ActionResult<{ filename: string; content: string }>> {
  const parsed = exportSchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const basis: ReportBasis = parsed.data.basis === 'cash' ? 'cash' : 'accrual';
  const report = await getReport({ periodKey: parsed.data.periodKey, basis });
  const basisLabel = basis === 'cash' ? 'Caixa' : 'Competência';

  const lines: string[] = [];

  lines.push(['Relatório', report.label].map(cell).join(';'));
  lines.push(['Regime', basisLabel].map(cell).join(';'));
  lines.push(['Período', `${report.start} a ${report.end}`].map(cell).join(';'));
  lines.push('');
  lines.push(['Entradas', cents(report.incomeInCents)].join(';'));
  lines.push(['Saídas', cents(report.expenseInCents)].join(';'));
  lines.push(['Resultado', cents(report.netInCents)].join(';'));
  lines.push(['Movimentos', String(report.transactionCount)].join(';'));
  lines.push(['Despesa média diária', cents(report.averageDailyExpenseInCents)].join(';'));
  lines.push('');
  lines.push(['Categoria', 'Valor', 'Peso', 'Movimentos'].map(cell).join(';'));

  for (const line of report.byCategory) {
    lines.push(
      [
        cell(line.categoryName),
        cents(line.amountInCents),
        `${String(line.sharePct).replace('.', ',')} %`,
        String(line.transactionCount),
      ].join(';'),
    );
  }

  lines.push('');
  lines.push(['Mês', 'Entradas', 'Saídas', 'Resultado'].map(cell).join(';'));

  for (const month of report.byMonth) {
    lines.push(
      [
        cell(month.label),
        cents(month.incomeInCents),
        cents(month.expenseInCents),
        cents(month.netInCents),
      ].join(';'),
    );
  }

  const filename = `relatorio-${report.key}-${basis}.csv`;

  return ok({ filename, content: `\uFEFF${lines.join('\r\n')}\r\n` });
}
