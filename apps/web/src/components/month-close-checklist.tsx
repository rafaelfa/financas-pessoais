'use client';

import { CalendarCheck, CircleCheck, CircleDashed, LockOpen } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Amount } from '@/components/amount';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { MonthCloseView } from '@/server/month-close';
import { closeMonth, reopenMonth } from '@/server/month-close-actions';

/**
 * Assistente de fecho de mês.
 *
 * Fechar o mês é o momento em que o utilizador diz «os números deste mês estão
 * conferidos». Por isso o assistente não é um botão: é uma lista de tudo o que
 * ainda pode estar errado (lançamentos por confirmar, por liquidar, faturas por
 * pagar, saldos por travar, orçamentos excedidos, lançamentos sem categoria),
 * cada passo com **ligação para o ecrã onde se resolve**.
 *
 * O botão de fechar só está ativo quando nada bloqueia — e, quando está
 * bloqueado, a razão está escrita ao lado, com os nomes dos passos que faltam.
 * Um botão desativado sem explicação é um beco sem saída.
 */

/** Alvo de toque: 44 px em telemóvel, denso a partir de `sm`. */
const TOUCH = 'min-h-11 sm:min-h-8';

/** Nomes dos passos que faltam, para a frase que explica o estado. */
function listStepTitles(titles: readonly string[]): string {
  const listed = titles
    .slice(0, 3)
    .map((title) => `«${title}»`)
    .join(', ');
  const remaining = titles.length - 3;

  if (remaining <= 0) {
    return listed;
  }

  return `${listed} e mais ${remaining === 1 ? '1 passo' : `${remaining} passos`}`;
}

export function MonthCloseChecklist({ monthClose }: { readonly monthClose: MonthCloseView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reopenOpen, setReopenOpen] = useState(false);

  const openSteps = monthClose.steps.filter((step) => !step.done);
  const isClosed = monthClose.closedAt !== null;
  const { period } = monthClose;

  /*
   * `readyToClose` só olha para os passos que **bloqueiam**: «Saldos por travar» é
   * uma recomendação e não impede fechar. Por isso a frase não pode dizer que
   * todos os passos por resolver bloqueiam — quando o servidor diz que está pronto
   * a fechar, o que sobra são recomendações, e é isso que fica escrito.
   */
  const reason = isClosed
    ? 'O mês está fechado. Reabre-o se encontrares algo para corrigir — nenhum movimento é apagado.'
    : monthClose.steps.length === 0
      ? 'Não há passos a conferir neste mês: podes fechá-lo já.'
      : monthClose.readyToClose
        ? openSteps.length === 0
          ? 'Nada bloqueia o fecho: os passos estão todos concluídos.'
          : `Nada bloqueia o fecho. O que falta — ${listStepTitles(
              openSteps.map((step) => step.title),
            )} — é recomendação, não impede fechar o mês.`
        : `Ainda não podes fechar: há passos por resolver — ${listStepTitles(
            openSteps.map((step) => step.title),
          )}. Trata ${openSteps.length === 1 ? 'dele' : 'deles'} nos links acima e o botão ativa-se.`;

  function confirmClose() {
    startTransition(async () => {
      const result = await closeMonth({ periodKey: period.key });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(`Mês de ${period.label} fechado.`, {
        description:
          'Os números do período ficam dados como conferidos. Podes reabrir se encontrares algo.',
      });
      router.refresh();
    });
  }

  function confirmReopen() {
    startTransition(async () => {
      const result = await reopenMonth({ periodKey: period.key });

      if (!result.ok) {
        toast.error(result.error);
        setReopenOpen(false);
        return;
      }

      toast.success(`Mês de ${period.label} reaberto.`, {
        description: 'Volta a contar como mês em curso e podes corrigir o que for preciso.',
      });
      setReopenOpen(false);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">Fecho de {period.label}</CardTitle>
          {isClosed ? (
            <Badge variant="secondary">
              <CircleCheck className="size-3" aria-hidden />
              Fechado
            </Badge>
          ) : null}
        </div>
        <CardDescription>
          {monthClose.closedAt === null
            ? 'Confere o que ficou por resolver antes de fechar. Cada passo leva-te ao ecrã onde se trata.'
            : `O mês está fechado desde ${formatTimestamp(monthClose.closedAt)}. Os números do período estão dados como conferidos.`}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {monthClose.totalCount === 0 ? (
          <p className="text-sm text-muted-foreground">
            Não há nada por conferir neste mês: podes fechá-lo já.
          </p>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
              <span className="font-medium">
                {monthClose.completedCount} de {monthClose.totalCount} passos
              </span>
              <span className="text-muted-foreground">
                {openSteps.length === 0
                  ? 'Tudo conferido'
                  : openSteps.length === 1
                    ? 'Falta 1 passo'
                    : `Faltam ${openSteps.length} passos`}
              </span>
            </div>

            {/* A barra é um extra: o mesmo número está escrito acima e nos passos. */}
            <Progress
              value={monthClose.completedCount}
              max={monthClose.totalCount}
              aria-label={`Passos concluídos do fecho de ${period.label}`}
              aria-valuetext={`${monthClose.completedCount} de ${monthClose.totalCount} passos concluídos`}
            />
          </div>
        )}

        {monthClose.steps.length === 0 ? null : (
          <ul className="divide-y rounded-lg border">
            {monthClose.steps.map((step) => (
              <li key={step.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
                {step.done ? (
                  <CircleCheck className="size-4 shrink-0 text-income" aria-hidden />
                ) : (
                  <CircleDashed className="size-4 shrink-0 text-warning-foreground" aria-hidden />
                )}

                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{step.title}</span>
                  <span className="block text-xs text-muted-foreground">{step.description}</span>
                  {step.done ? null : (
                    <span className="mt-0.5 block text-xs">
                      {step.count} por resolver
                      {step.amountInCents === null ? null : (
                        <>
                          {' · '}
                          <Amount amountInCents={step.amountInCents} tone="neutral" />
                        </>
                      )}
                    </span>
                  )}
                </span>

                <Badge variant={step.done ? 'secondary' : 'outline'} className="font-normal">
                  {step.done ? 'Concluído' : 'Por resolver'}
                </Badge>

                {/* Com o passo concluído o link desaparece: não há nada a resolver,
                  e um botão que não muda nada é ruído. */}
                {step.done ? null : (
                  <Button asChild variant="outline" size="sm" className={TOUCH}>
                    <Link href={step.href}>
                      Resolver
                      <span className="sr-only"> {step.title}</span>
                    </Link>
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
          <p id="fecho-razao" className="text-sm text-muted-foreground">
            {reason}
          </p>

          {isClosed ? (
            <Button
              type="button"
              variant="outline"
              className={TOUCH}
              disabled={pending}
              onClick={() => setReopenOpen(true)}
            >
              <LockOpen className="size-3.5" aria-hidden />
              Reabrir o mês
            </Button>
          ) : (
            <Button
              type="button"
              className={TOUCH}
              disabled={pending || !monthClose.readyToClose}
              aria-describedby="fecho-razao"
              onClick={confirmClose}
            >
              <CalendarCheck className="size-3.5" aria-hidden />
              {pending ? 'A fechar…' : 'Fechar o mês'}
            </Button>
          )}
        </div>

        {isClosed ? (
          <p className="text-xs text-muted-foreground">
            Os passos continuam visíveis para consulta. Reabrir não apaga nada: só volta a pôr o mês
            em curso.
          </p>
        ) : null}
      </CardContent>

      <AlertDialog open={reopenOpen} onOpenChange={setReopenOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <LockOpen aria-hidden />
            </AlertDialogMedia>
            <AlertDialogTitle>Reabrir {period.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              O mês volta a contar como mês em curso e podes corrigir lançamentos, saldos e
              categorias. Nenhum movimento é apagado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                confirmReopen();
              }}
            >
              {pending ? 'A reabrir…' : 'Reabrir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

/**
 * Instante formatado em português.
 *
 * `closedAt` é um instante, mas o contrato não fixa o formato exato: uma data
 * `YYYY-MM-DD` é lida sem fuso (como todas as datas do domínio) e qualquer outra
 * coisa é lida como instante em Lisboa. Um valor ilegível mostra-se tal como veio
 * em vez de rebentar o ecrã.
 */
function formatTimestamp(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Intl.DateTimeFormat('pt-PT', { timeZone: 'UTC', dateStyle: 'long' }).format(
      new Date(`${value}T00:00:00Z`),
    );
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('pt-PT', {
    timeZone: 'Europe/Lisbon',
    dateStyle: 'long',
  }).format(parsed);
}
