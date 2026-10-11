import { addDays, daysBetween } from './period';
import type { FinanceGoal, FinanceGoalMovement, RecurrenceFrequency } from './types';

/**
 * Objetivos de poupança.
 *
 * O sistema de referência calcula automaticamente quanto é preciso guardar por
 * período, a partir do valor total, do valor já reservado e da data de
 * conclusão, e mostra um gráfico de evolução (documento 01, §5.4). Só aceita
 * movimentos passados ou do mês atual e trata recorrências e parcelamentos
 * "como únicos", o que quebra a automatização da poupança.
 *
 * Aqui: o progresso considera apenas o que já aconteceu até à data de
 * referência, mas a projeção de conclusão usa o ritmo real de poupança
 * observado — e por isso os movimentos futuros gerados pelas recorrências
 * (melhoria M3) entram naturalmente quando chegar a altura.
 */

export interface GoalProgress {
  readonly goalId: string;
  readonly targetInCents: number;
  /** Reservado inicial + depósitos + rendimentos − resgates, até à data. */
  readonly accumulatedInCents: number;
  /** Percentagem concluída, arredondada a uma casa decimal. */
  readonly progressPct: number;
  readonly remainingInCents: number;
  /** Períodos que faltam até à data-limite, na frequência escolhida. */
  readonly periodsRemaining: number;
  /** Quanto é preciso guardar em cada período que falta (arredondado para cima). */
  readonly requiredPerPeriodInCents: number;
  /** Data prevista de conclusão ao ritmo observado; `null` se não há ritmo. */
  readonly projectedCompletionDate: string | null;
  readonly onTrack: boolean;
}

/** Efeito de um movimento no valor acumulado do objetivo. */
export function movementEffectInCents(movement: FinanceGoalMovement): number {
  return movement.type === 'withdrawal'
    ? -Math.abs(movement.amountInCents)
    : Math.abs(movement.amountInCents);
}

function monthsBetween(from: string, to: string): number {
  const [fromYear, fromMonth] = from.split('-').map(Number) as [number, number];
  const [toYear, toMonth] = to.split('-').map(Number) as [number, number];
  const wholeMonths = (toYear - fromYear) * 12 + (toMonth - fromMonth);

  // Um resto de dias conta como mais um período, para não faltar dinheiro.
  return to > from ? wholeMonths + (to.slice(8, 10) > from.slice(8, 10) ? 1 : 0) : 0;
}

/** Períodos que faltam entre duas datas, na frequência indicada. */
export function periodsBetween(from: string, to: string, frequency: RecurrenceFrequency): number {
  if (to <= from) {
    return 0;
  }

  switch (frequency) {
    case 'weekly':
      return Math.ceil(daysBetween(from, to) / 7);
    case 'monthly':
      return monthsBetween(from, to);
    case 'quarterly':
      return Math.ceil(monthsBetween(from, to) / 3);
  }
}

/** Progresso de um objetivo, com o esforço necessário e a projeção. */
export function goalProgress(args: {
  readonly goal: FinanceGoal;
  readonly movements: readonly FinanceGoalMovement[];
  /** Data de referência (normalmente hoje). */
  readonly today: string;
}): GoalProgress {
  const past = args.movements
    .filter((movement) => movement.goalId === args.goal.id && movement.date <= args.today)
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const accumulatedInCents =
    (args.goal.initialReservedInCents ?? 0) +
    past.reduce((total, movement) => total + movementEffectInCents(movement), 0);

  const targetInCents = args.goal.targetAmountInCents;
  const remainingInCents = Math.max(0, targetInCents - accumulatedInCents);
  const progressPct =
    targetInCents <= 0 ? 100 : Math.round((accumulatedInCents / targetInCents) * 1000) / 10;

  const periodsRemaining = periodsBetween(
    args.today,
    args.goal.targetDate,
    args.goal.contributionFrequency,
  );

  const requiredPerPeriodInCents =
    remainingInCents === 0 || periodsRemaining === 0
      ? 0
      : Math.ceil(remainingInCents / periodsRemaining);

  const projectedCompletionDate = projectCompletion({
    remainingInCents,
    accumulatedInCents,
    firstMovementDate: past[0]?.date,
    today: args.today,
  });

  return {
    goalId: args.goal.id,
    targetInCents,
    accumulatedInCents,
    progressPct,
    remainingInCents,
    periodsRemaining,
    requiredPerPeriodInCents,
    projectedCompletionDate,
    onTrack:
      remainingInCents === 0 ||
      (projectedCompletionDate !== null && projectedCompletionDate <= args.goal.targetDate),
  };
}

function projectCompletion(args: {
  readonly remainingInCents: number;
  readonly accumulatedInCents: number;
  readonly firstMovementDate: string | undefined;
  readonly today: string;
}): string | null {
  if (args.remainingInCents === 0) {
    return args.today;
  }

  if (args.firstMovementDate === undefined || args.accumulatedInCents <= 0) {
    return null;
  }

  const observedDays = daysBetween(args.firstMovementDate, args.today);

  if (observedDays < 1) {
    return null;
  }

  const pacePerDayInCents = args.accumulatedInCents / observedDays;

  if (pacePerDayInCents <= 0) {
    return null;
  }

  return addDays(args.today, Math.ceil(args.remainingInCents / pacePerDayInCents));
}

/** Progresso de todos os objetivos, e o agregado. */
export function goalOverview(args: {
  readonly goals: readonly FinanceGoal[];
  readonly movements: readonly FinanceGoalMovement[];
  readonly today: string;
}): {
  readonly goals: GoalProgress[];
  readonly targetInCents: number;
  readonly accumulatedInCents: number;
  readonly progressPct: number;
  readonly onTrackCount: number;
} {
  const progress = args.goals.map((goal) =>
    goalProgress({ goal, movements: args.movements, today: args.today }),
  );
  const targetInCents = progress.reduce((total, item) => total + item.targetInCents, 0);
  const accumulatedInCents = progress.reduce((total, item) => total + item.accumulatedInCents, 0);

  return {
    goals: progress,
    targetInCents,
    accumulatedInCents,
    progressPct:
      targetInCents <= 0 ? 100 : Math.round((accumulatedInCents / targetInCents) * 1000) / 10,
    onTrackCount: progress.filter((item) => item.onTrack).length,
  };
}
