'use client';

import { CalendarClock } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { generateDueRecurrences } from '@/server/recurrences-actions';

/**
 * «Gerar as que estão a vencer».
 *
 * A geração é **idempotente**: cria as ocorrências em atraso e avança a próxima
 * data na mesma transação, por isso carregar duas vezes não cria a renda duas
 * vezes. O botão diz isso antes de ser usado — e o resultado diz exatamente
 * quantas ocorrências nasceram e em que datas, para o utilizador conseguir
 * conferir em vez de confiar.
 */

/** Alvo de toque: 44 px em telemóvel, denso a partir de `sm`. */
const TOUCH = 'min-h-11 sm:min-h-8';

export function RecurrenceGenerateButton({ dueCount }: { readonly dueCount: number }) {
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const result = await generateDueRecurrences();

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      const { created, details, truncated } = result.data;

      if (created === 0) {
        toast.info('Não havia nada a vencer.', {
          description:
            'Nada foi criado. Podes carregar outra vez à vontade: a geração nunca duplica a mesma data.',
        });
        return;
      }

      const message = created === 1 ? '1 ocorrência gerada.' : `${created} ocorrências geradas.`;

      /*
       * O gerador tem um limite de segurança por série: uma série com uma data de
       * início errada não deve criar dez mil lançamentos de uma vez. Quando o
       * limite é atingido, o utilizador tem de saber — em silêncio, ficaria a
       * achar que faltam lançamentos por causa de um defeito.
       */
      if (truncated) {
        toast.warning(message, {
          description: `${describeDetails(details)} Uma série antiga atingiu o limite de segurança e ficou a meio: confirma a data de início dela e volta a gerar.`,
          duration: 15_000,
        });
        return;
      }

      toast.success(message, {
        description: describeDetails(details),
        duration: 12_000,
      });
    });
  }

  return (
    <Button
      type="button"
      variant={dueCount > 0 ? 'default' : 'outline'}
      size="sm"
      className={TOUCH}
      disabled={pending}
      onClick={run}
    >
      <CalendarClock className="size-3.5" aria-hidden />
      {pending
        ? 'A gerar…'
        : dueCount > 0
          ? `Gerar as que estão a vencer (${dueCount})`
          : 'Gerar as que estão a vencer'}
    </Button>
  );
}

/**
 * Resumo das ocorrências criadas, série a série.
 *
 * Um resumo sem fim não se lê: mostra as primeiras quatro séries e diz quantas
 * ficaram por listar, em vez de cortar em silêncio.
 */
function describeDetails(
  details: readonly { readonly recurrenceName: string; readonly dates: readonly string[] }[],
): string {
  const shown = details.slice(0, 4).map((detail) => {
    const dates = detail.dates.slice(0, 3).map(formatDay).join(', ');
    const extra = detail.dates.length > 3 ? ` e mais ${detail.dates.length - 3}` : '';

    return `${detail.recurrenceName}: ${dates}${extra}`;
  });

  const remaining = details.length - shown.length;

  return remaining > 0
    ? `${shown.join(' · ')} · e mais ${remaining} ${remaining === 1 ? 'série' : 'séries'}.`
    : `${shown.join(' · ')}.`;
}

/** Data de calendário em formato curto, sem deslocação de fuso. */
function formatDay(date: string): string {
  return new Intl.DateTimeFormat('pt-PT', { timeZone: 'UTC', dateStyle: 'short' }).format(
    new Date(`${date}T00:00:00Z`),
  );
}
