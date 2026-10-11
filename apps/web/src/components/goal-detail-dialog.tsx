'use client';

import { useRouter } from 'next/navigation';

import { Amount } from '@/components/amount';
import {
  GOAL_FREQUENCY_LABELS,
  GoalMeter,
  GoalVerdictBadge,
  formatPeriodsLeft,
  goalVerdict,
  goalVerdictSentence,
} from '@/components/goal-progress';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { GoalView } from '@/server/goals';

/**
 * Detalhe de um objetivo, com o histórico de movimentos.
 *
 * É aqui que se percebe de onde veio o acumulado: cada depósito e cada
 * levantamento, com a data, a nota e a conta (quando o dinheiro se moveu mesmo).
 *
 * Os dados chegam já resolvidos do servidor (`getGoal`); este componente não
 * consulta nada, porque uma consulta de servidor não pode ser chamada a partir
 * do browser. Abre por URL (`?objetivo=<id>`) e fecha voltando à lista.
 */

/** Movimento de objetivo, como o servidor o devolve. */
export interface GoalDetailMovement {
  readonly id: string;
  readonly type: string;
  readonly amountInCents: number;
  readonly date: string;
  readonly note: string | null;
  readonly accountName: string | null;
  readonly transactionId: string | null;
}

/** Objetivo com o histórico. */
export type GoalDetailData = GoalView & { readonly movements: readonly GoalDetailMovement[] };

export function GoalDetailDialog({ detail }: { readonly detail: GoalDetailData | null }) {
  const router = useRouter();

  function close() {
    router.push('/objetivos');
  }

  if (detail === null) {
    return (
      <Dialog open onOpenChange={close}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Objetivo não encontrado</DialogTitle>
            <DialogDescription>
              O objetivo que tentaste abrir já não existe. Fecha esta janela e volta à lista.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button type="button" className="min-h-11 sm:min-h-8" onClick={close}>
              Voltar aos objetivos
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const verdict = goalVerdict(detail);
  const perPeriod = GOAL_FREQUENCY_LABELS[detail.contributionFrequency] ?? 'por período';
  const hasRequiredContribution =
    detail.requiredContributionInCents !== null && detail.requiredContributionInCents > 0;

  return (
    <Dialog open onOpenChange={close}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{detail.name}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            <GoalVerdictBadge verdict={verdict} />
            <span>
              {detail.description === null || detail.description.trim() === ''
                ? 'Sem descrição.'
                : detail.description}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-xl font-semibold">
              <Amount amountInCents={detail.accumulatedInCents} tone="neutral" />
            </span>
            <span className="text-sm text-muted-foreground">
              de <Amount amountInCents={detail.targetAmountInCents} tone="neutral" /> (
              {detail.progressPct}%)
            </span>
          </div>

          <GoalMeter
            progressPct={detail.progressPct}
            verdict={verdict}
            label={`Objetivo ${detail.name}`}
          />

          <p className="text-sm text-muted-foreground">
            {goalVerdictSentence({
              state: detail.state,
              verdict,
              movementCount: detail.movementCount,
              accumulatedInCents: detail.accumulatedInCents,
              contributionFrequency: detail.contributionFrequency,
            })}
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg border bg-muted/40 p-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Falta juntar</dt>
            <dd>
              <Amount amountInCents={detail.remainingInCents} tone="neutral" />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Prazo</dt>
            <dd className="font-numeric tabular-nums">
              {formatDay(detail.targetDate)}
              {detail.periodsLeft > 0 ? (
                <span className="ml-1 text-xs text-muted-foreground">
                  ({formatPeriodsLeft(detail.periodsLeft, detail.contributionFrequency)} até lá)
                </span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Aporte necessário</dt>
            <dd>
              {hasRequiredContribution ? (
                <>
                  <Amount amountInCents={detail.requiredContributionInCents ?? 0} tone="neutral" />
                  <span className="ml-1 text-xs text-muted-foreground">{perPeriod}</span>
                </>
              ) : (
                <span className="text-muted-foreground">Nada a aportar</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Estado</dt>
            <dd>
              {detail.state === 'completed' ? 'Concluído' : 'Ativo'}
              {detail.completedAt === null ? null : (
                <span className="ml-1 text-xs text-muted-foreground">
                  desde {formatDay(detail.completedAt.slice(0, 10))}
                </span>
              )}
            </dd>
          </div>
        </dl>

        <section aria-labelledby="objetivo-movimentos" className="space-y-2">
          <h3 id="objetivo-movimentos" className="font-heading text-sm font-medium">
            Movimentos ({detail.movements.length})
          </h3>

          {detail.movements.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
              Ainda não há movimentos neste objetivo. Regista um depósito no cartão do objetivo para
              começares a somar.
            </p>
          ) : (
            <div className="max-h-64 overflow-y-auto rounded-lg border">
              <ul className="divide-y">
                {detail.movements.map((movement) => {
                  const isDeposit = movement.type !== 'withdrawal';

                  return (
                    <li
                      key={movement.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <p className="font-medium">
                          {isDeposit ? 'Depósito' : 'Levantamento'}
                          <span className="ml-2 font-normal text-muted-foreground">
                            {formatDay(movement.date)}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {movement.note === null || movement.note.trim() === ''
                            ? 'Sem nota'
                            : movement.note}
                          {' · '}
                          {movement.accountName === null
                            ? 'Sem conta: só marca de progresso'
                            : `Conta: ${movement.accountName}`}
                        </p>
                      </div>

                      <Amount
                        amountInCents={isDeposit ? movement.amountInCents : -movement.amountInCents}
                        withSign
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>

        <div className="flex justify-end">
          <Button type="button" variant="outline" className="min-h-11 sm:min-h-8" onClick={close}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Data de calendário em formato curto, sem deslocação de fuso. */
function formatDay(date: string): string {
  return new Intl.DateTimeFormat('pt-PT', { timeZone: 'UTC', dateStyle: 'short' }).format(
    new Date(`${date}T00:00:00Z`),
  );
}
