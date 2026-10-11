'use client';

import { Download } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';

import { REPORT_BASIS_LABELS, type ReportBasis } from '@/components/report-basis';
import { Button } from '@/components/ui/button';
import { exportReportCsv } from '@/server/reports-export';

/**
 * Exportação do relatório que está no ecrã.
 *
 * O botão recebe o **período e o regime já resolvidos**: são os mesmos que
 * produziram os números visíveis, por isso o CSV não pode dizer outra coisa. Um
 * ficheiro que não bate certo com o que o utilizador acabou de ler é pior do que
 * não haver exportação.
 */

/** Alvo de toque: 44 px em telemóvel, denso a partir de `sm`. */
const TOUCH = 'min-h-11 sm:min-h-8';

export function ReportExportButton({
  periodKey,
  periodLabel,
  basis,
}: {
  readonly periodKey: string;
  /** Rótulo do período, para a confirmação dizer o que foi exportado. */
  readonly periodLabel: string;
  readonly basis: ReportBasis;
}) {
  const [pending, startTransition] = useTransition();

  function onExport() {
    startTransition(async () => {
      const result = await exportReportCsv({ periodKey, basis });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      const { filename, content } = result.data;

      /*
       * O Excel em Portugal assume ANSI quando o ficheiro não traz marca de
       * ordem de bytes: sem ela, “Alimentação” chega com os acentos trocados.
       * Só acrescentamos se o servidor ainda não a tiver posto.
       */
      const csv = content.startsWith('\uFEFF') ? content : `\uFEFF${content}`;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      toast.success(
        `Exportei «${filename}» — ${periodLabel}, ${REPORT_BASIS_LABELS[basis].toLowerCase()}.`,
      );
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={TOUCH}
      disabled={pending}
      onClick={onExport}
    >
      <Download className="size-3.5" aria-hidden />
      {pending ? 'A exportar…' : 'Exportar CSV'}
      <span className="sr-only">
        do relatório de {periodLabel} em {REPORT_BASIS_LABELS[basis].toLowerCase()}
      </span>
    </Button>
  );
}
