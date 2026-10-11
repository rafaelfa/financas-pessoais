'use client';

import { usePathname, useRouter } from 'next/navigation';

import { basisToParam, ReportBasisSwitch, type ReportBasis } from '@/components/report-basis';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { PeriodOption } from '@/server/reports';

/**
 * Filtros do relatório: período e regime.
 *
 * O estado vive no **URL**, tal como no extrato: um relatório filtrado pode ser
 * guardado nos favoritos e reenviado, e — o que importa nesta fase — o botão de
 * exportação lê exatamente os mesmos dois parâmetros, por isso o CSV nunca pode
 * dizer uma coisa diferente do que está no ecrã.
 */

/** Alvo de toque: 44 px em telemóvel, denso a partir de `sm`. */
const TOUCH = 'min-h-11 sm:min-h-8';

export function ReportFilters({
  periods,
  periodKey,
  basis,
}: {
  readonly periods: readonly PeriodOption[];
  readonly periodKey: string;
  readonly basis: ReportBasis;
}) {
  const router = useRouter();
  const pathname = usePathname();

  /** Reescreve os dois parâmetros de uma vez: nunca fica um sem o outro. */
  function push(next: { periodo?: string; regime?: string }) {
    const params = new URLSearchParams({
      periodo: next.periodo ?? periodKey,
      regime: next.regime ?? basisToParam(basis),
    });

    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <section
      aria-label="Filtros do relatório"
      className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2"
    >
      <div className="space-y-1">
        <Label htmlFor="relatorio-periodo">Período</Label>
        <Select value={periodKey} onValueChange={(value) => push({ periodo: value })}>
          <SelectTrigger id="relatorio-periodo" className={`w-full ${TOUCH}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {periods.map((period) => (
              <SelectItem key={period.key} value={period.key}>
                {period.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ReportBasisSwitch value={basis} onChange={(next) => push({ regime: basisToParam(next) })} />
    </section>
  );
}
