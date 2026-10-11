import { prisma } from '@repo/db/client';
import {
  goalProgress,
  toIsoDate,
  toRecurrenceFrequency,
  type RecurrenceFrequency,
} from '@repo/shared';

import { todayInLisbon } from '@/lib/today';

import { requireUser } from './session';

/**
 * Objetivos de poupança.
 *
 * Duas coisas que esta camada tem de dizer ao utilizador e que o ecrã não pode
 * inventar:
 *
 * 1. **Quanto falta por período.** Não basta a percentagem: com um prazo a
 *    aproximar-se, o que interessa é quanto é preciso guardar em cada período que
 *    falta. Vem do motor (`requiredPerPeriodInCents`), arredondado para cima.
 * 2. **Se está no bom caminho.** O motor compara a data prevista de conclusão ao
 *    ritmo observado com o prazo. Um objetivo sem movimentos ainda não tem
 *    ritmo, por isso `onTrack` é `false` — mas isso **não é um atraso**, é a
 *    ausência de dados. A interface distingue os dois casos com `movementCount`.
 */

export type GoalState = 'active' | 'completed';

export interface GoalMovementView {
  readonly id: string;
  readonly type: 'deposit' | 'withdrawal';
  readonly amountInCents: number;
  readonly date: string;
  readonly note: string | null;
  readonly accountName: string | null;
  readonly transactionId: string | null;
}

export interface GoalView {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly isPreset: boolean;
  readonly targetAmountInCents: number;
  readonly accumulatedInCents: number;
  readonly remainingInCents: number;
  readonly progressPct: number;
  readonly targetDate: string;
  readonly contributionFrequency: RecurrenceFrequency;
  readonly initialReservedInCents: number;
  readonly periodsLeft: number;
  readonly requiredContributionInCents: number | null;
  readonly projectedCompletionDate: string | null;
  readonly state: GoalState;
  readonly completedAt: string | null;
  readonly movementCount: number;
  readonly onTrack: boolean;
  readonly createdAt: string;
}

/** Objetivos do utilizador, com o progresso calculado pelo motor. */
export async function listGoals(): Promise<GoalView[]> {
  const user = await requireUser();
  const today = todayInLisbon();

  const [goals, movements] = await Promise.all([
    prisma.goal.findMany({
      where: { userId: user.id },
      orderBy: [{ state: 'asc' }, { targetDate: 'asc' }],
    }),
    prisma.goalMovement.findMany({ where: { userId: user.id }, orderBy: [{ date: 'asc' }] }),
  ]);

  const financeMovements = movements.map((movement) => ({
    goalId: movement.goalId,
    type: movement.type === 'WITHDRAWAL' ? ('withdrawal' as const) : ('deposit' as const),
    amountInCents: movement.amountInCents,
    date: toIsoDate(movement.date),
    ...(movement.transactionId !== null ? { transactionId: movement.transactionId } : {}),
  }));

  const countByGoal = new Map<string, number>();

  for (const movement of movements) {
    countByGoal.set(movement.goalId, (countByGoal.get(movement.goalId) ?? 0) + 1);
  }

  return goals.map((goal) => {
    const progress = goalProgress({
      goal: {
        id: goal.id,
        targetAmountInCents: goal.targetAmountInCents,
        initialReservedInCents: goal.initialReservedInCents,
        targetDate: toIsoDate(goal.targetDate),
        contributionFrequency: toRecurrenceFrequency(goal.contributionFrequency),
      },
      movements: financeMovements,
      today,
    });

    const movementCount = countByGoal.get(goal.id) ?? 0;

    return {
      id: goal.id,
      name: goal.name,
      description: goal.description,
      isPreset: goal.isPreset,
      targetAmountInCents: progress.targetInCents,
      accumulatedInCents: progress.accumulatedInCents,
      /**
       * O valor já reservado à criação. A interface precisa dele para o
       * formulário de edição não aparecer vazio: um campo vazio significa "não
       * mexer", mas um zero apagaria o ponto de partida do progresso.
       */
      initialReservedInCents: goal.initialReservedInCents,
      remainingInCents: progress.remainingInCents,
      progressPct: progress.progressPct,
      targetDate: toIsoDate(goal.targetDate),
      contributionFrequency: toRecurrenceFrequency(goal.contributionFrequency),
      periodsLeft: progress.periodsRemaining,
      // Nada a aportar quando já está completo: `null` e não zero, para a
      // interface não escrever "0,00 € por mês".
      requiredContributionInCents:
        progress.remainingInCents === 0 ? null : progress.requiredPerPeriodInCents,
      projectedCompletionDate: progress.projectedCompletionDate,
      state: goal.state === 'COMPLETED' ? 'completed' : 'active',
      completedAt: goal.completedAt === null ? null : toIsoDate(goal.completedAt),
      movementCount,
      onTrack: progress.onTrack,
      createdAt: toIsoDate(goal.createdAt),
    };
  });
}

/** Um objetivo com o histórico de movimentos. */
export async function getGoal(
  goalId: string,
): Promise<(GoalView & { movements: GoalMovementView[] }) | null> {
  const user = await requireUser();
  const goals = await listGoals();
  const goal = goals.find((entry) => entry.id === goalId);

  if (goal === undefined) {
    return null;
  }

  const movements = await prisma.goalMovement.findMany({
    where: { userId: user.id, goalId },
    orderBy: [{ date: 'desc' }],
    // O movimento não guarda a conta: quem a sabe é o lançamento que ele gerou.
    include: { transaction: { select: { financialAccountId: true } } },
  });

  const accountIds = [
    ...new Set(
      movements
        .map((movement) => movement.transaction?.financialAccountId ?? null)
        .filter((id): id is string => id !== null),
    ),
  ];
  const accounts =
    accountIds.length === 0
      ? []
      : await prisma.financialAccount.findMany({
          where: { id: { in: accountIds } },
          select: { id: true, name: true },
        });
  const accountNameById = new Map(accounts.map((account) => [account.id, account.name]));

  return {
    ...goal,
    movements: movements.map((movement) => {
      const accountId = movement.transaction?.financialAccountId ?? null;

      return {
        id: movement.id,
        type: movement.type === 'WITHDRAWAL' ? 'withdrawal' : 'deposit',
        amountInCents: movement.amountInCents,
        date: toIsoDate(movement.date),
        note: movement.note,
        accountName: accountId === null ? null : (accountNameById.get(accountId) ?? null),
        transactionId: movement.transactionId,
      };
    }),
  };
}

/** Resumo de todos os objetivos, para o cabeçalho do ecrã. */
export async function goalsSummary(): Promise<{
  readonly targetInCents: number;
  readonly accumulatedInCents: number;
  readonly progressPct: number;
  readonly onTrackCount: number;
  readonly activeCount: number;
  readonly completedCount: number;
}> {
  const goals = await listGoals();

  const targetInCents = goals.reduce((total, goal) => total + goal.targetAmountInCents, 0);
  const accumulatedInCents = goals.reduce((total, goal) => total + goal.accumulatedInCents, 0);

  return {
    targetInCents,
    accumulatedInCents,
    progressPct:
      targetInCents <= 0 ? 0 : Math.round((accumulatedInCents / targetInCents) * 1000) / 10,
    onTrackCount: goals.filter((goal) => goal.state === 'active' && goal.onTrack).length,
    activeCount: goals.filter((goal) => goal.state === 'active').length,
    completedCount: goals.filter((goal) => goal.state === 'completed').length,
  };
}
