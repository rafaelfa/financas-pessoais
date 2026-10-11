'use client';

import { ArchiveRestore, EllipsisVertical, Eye, Pencil, Plus, Trash, Undo2 } from 'lucide-react';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Amount } from '@/components/amount';
import { GoalDialog } from '@/components/goal-dialog';
import { GoalMovementDialog } from '@/components/goal-movement-dialog';
import {
  GOAL_FREQUENCY_LABELS,
  GoalMeter,
  GoalVerdictBadge,
  formatPeriodsLeft,
  goalVerdict,
  goalVerdictSentence,
} from '@/components/goal-progress';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { deleteGoal, setGoalCompleted } from '@/server/goals-actions';
import type { AccountView } from '@/server/accounts';
import type { GoalView } from '@/server/goals';

/**
 * Cartão de um objetivo.
 *
 * A percentagem não chega para responder a “estou no bom caminho?”: o veredicto
 * vem escrito por palavras e com a razão, e o esforço necessário por período
 * aparece ao lado — vazio quando não há nada a aportar, porque “0,00 € por mês”
 * é ruído, não informação.
 *
 * O detalhe (histórico de movimentos) abre por URL, porque a consulta que o
 * junta vive no servidor.
 */

/** Alvo de toque: 44 px em telemóvel, denso a partir de `sm`. */
const TOUCH = 'min-h-11 sm:min-h-8';
const ICON_TOUCH = 'min-h-11 min-w-11 sm:min-h-7 sm:min-w-7';

export function GoalCard({
  goal,
  accounts,
  today,
  detailHref,
}: {
  readonly goal: GoalView;
  readonly accounts: readonly AccountView[];
  /** Data de hoje em Portugal, como `YYYY-MM-DD`. */
  readonly today: string;
  readonly detailHref: string;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawalOpen, setWithdrawalOpen] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const verdict = goalVerdict(goal);
  const isCompleted = goal.state === 'completed';
  const perPeriod = GOAL_FREQUENCY_LABELS[goal.contributionFrequency] ?? 'por período';
  const hasRequiredContribution =
    goal.requiredContributionInCents !== null && goal.requiredContributionInCents > 0;

  function toggleCompleted() {
    startTransition(async () => {
      const result = await setGoalCompleted({ id: goal.id, completed: !isCompleted });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(isCompleted ? 'Objetivo reaberto.' : 'Objetivo marcado como concluído.');
      setCompletedOpen(false);
    });
  }

  function confirmDelete() {
    startTransition(async () => {
      const result = await deleteGoal({ id: goal.id });

      if (!result.ok) {
        toast.error(result.error);
        setDeleteOpen(false);
        return;
      }

      toast.success('Objetivo eliminado.');
      setDeleteOpen(false);
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <CardTitle className="truncate">{goal.name}</CardTitle>
            {goal.description === null || goal.description.trim() === '' ? null : (
              <p className="text-sm text-muted-foreground">{goal.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <GoalVerdictBadge verdict={verdict} />
              {goal.isPreset ? <Badge variant="outline">Sugerido</Badge> : null}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className={ICON_TOUCH}
                aria-label={`Ações do objetivo ${goal.name}`}
              >
                <EllipsisVertical className="size-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                <Pencil className="size-4" aria-hidden />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setWithdrawalOpen(true)}>
                <Undo2 className="size-4" aria-hidden />
                Registar levantamento
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setCompletedOpen(true)}>
                {isCompleted ? (
                  <ArchiveRestore className="size-4" aria-hidden />
                ) : (
                  <Plus className="size-4" aria-hidden />
                )}
                {isCompleted ? 'Reabrir objetivo' : 'Marcar como concluído'}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDeleteOpen(true)}>
                <Trash className="size-4" aria-hidden />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-lg font-semibold">
              <Amount amountInCents={goal.accumulatedInCents} tone="neutral" />
            </span>
            <span className="text-sm text-muted-foreground">
              de <Amount amountInCents={goal.targetAmountInCents} tone="neutral" /> (
              {goal.progressPct}
              %)
            </span>
          </div>

          <GoalMeter
            progressPct={goal.progressPct}
            verdict={verdict}
            label={`Objetivo ${goal.name}`}
          />

          <p className="text-sm text-muted-foreground">
            {goalVerdictSentence({
              state: goal.state,
              verdict,
              movementCount: goal.movementCount,
              accumulatedInCents: goal.accumulatedInCents,
              contributionFrequency: goal.contributionFrequency,
            })}
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Falta juntar</dt>
            <dd>
              <Amount amountInCents={goal.remainingInCents} tone="neutral" />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Prazo</dt>
            <dd className="font-numeric tabular-nums">
              {formatDay(goal.targetDate)}
              {goal.periodsLeft > 0 ? (
                <span className="ml-1 text-xs text-muted-foreground">
                  ({formatPeriodsLeft(goal.periodsLeft, goal.contributionFrequency)} até lá)
                </span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Aporte necessário</dt>
            <dd>
              {hasRequiredContribution ? (
                <>
                  <Amount amountInCents={goal.requiredContributionInCents ?? 0} tone="neutral" />
                  <span className="ml-1 text-xs text-muted-foreground">{perPeriod}</span>
                </>
              ) : (
                <span className="text-muted-foreground">Nada a aportar</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Movimentos</dt>
            <dd className="text-muted-foreground">
              {goal.movementCount === 0
                ? 'Nenhum'
                : goal.movementCount === 1
                  ? '1 movimento'
                  : `${goal.movementCount} movimentos`}
            </dd>
          </div>
        </dl>
      </CardContent>

      <div className="flex flex-wrap gap-2 px-(--card-spacing)">
        <Button asChild variant="outline" size="sm" className={TOUCH}>
          <Link href={detailHref}>
            <Eye className="size-3.5" aria-hidden />
            Detalhe
            <span className="sr-only"> e movimentos de {goal.name}</span>
          </Link>
        </Button>

        <Button
          type="button"
          size="sm"
          className={TOUCH}
          onClick={() => setDepositOpen(true)}
          disabled={pending}
        >
          <Plus className="size-3.5" aria-hidden />
          Depositar
        </Button>
      </div>

      <GoalDialog
        mode="edit"
        goal={{
          id: goal.id,
          name: goal.name,
          description: goal.description,
          targetAmountInCents: goal.targetAmountInCents,
          targetDate: goal.targetDate,
          contributionFrequency: goal.contributionFrequency,
          initialReservedInCents: goal.initialReservedInCents,
        }}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      {depositOpen ? (
        <GoalMovementDialog
          goal={{
            id: goal.id,
            name: goal.name,
            accumulatedInCents: goal.accumulatedInCents,
          }}
          defaultType="deposit"
          accounts={accounts}
          today={today}
          open
          onOpenChange={(open) => {
            if (!open) {
              setDepositOpen(false);
            }
          }}
        />
      ) : null}

      {withdrawalOpen ? (
        <GoalMovementDialog
          goal={{
            id: goal.id,
            name: goal.name,
            accumulatedInCents: goal.accumulatedInCents,
          }}
          defaultType="withdrawal"
          accounts={accounts}
          today={today}
          open
          onOpenChange={(open) => {
            if (!open) {
              setWithdrawalOpen(false);
            }
          }}
        />
      ) : null}

      <AlertDialog open={completedOpen} onOpenChange={setCompletedOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              {isCompleted ? <ArchiveRestore aria-hidden /> : <Plus aria-hidden />}
            </AlertDialogMedia>
            <AlertDialogTitle>
              {isCompleted ? `Reabrir «${goal.name}»?` : `Marcar «${goal.name}» como concluído?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isCompleted
                ? 'O objetivo volta a contar como ativo e os aportes continuam a somar.'
                : 'O objetivo fica marcado como concluído. Os movimentos e o valor acumulado não se perdem, e podes reabri-lo depois.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                toggleCompleted();
              }}
            >
              {pending ? 'A guardar…' : isCompleted ? 'Reabrir' : 'Marcar como concluído'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <Trash aria-hidden />
            </AlertDialogMedia>
            <AlertDialogTitle>Eliminar «{goal.name}»?</AlertDialogTitle>
            <AlertDialogDescription>
              O objetivo e o seu histórico de movimentos desaparecem. Os lançamentos que já criaste
              nas contas ficam onde estão — só deixam de estar ligados a um objetivo. Não há forma
              de recuperar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                confirmDelete();
              }}
            >
              {pending ? 'A eliminar…' : 'Eliminar objetivo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

/** Data de calendário em formato curto, sem deslocação de fuso. */
function formatDay(date: string): string {
  return new Intl.DateTimeFormat('pt-PT', { timeZone: 'UTC', dateStyle: 'short' }).format(
    new Date(`${date}T00:00:00Z`),
  );
}
