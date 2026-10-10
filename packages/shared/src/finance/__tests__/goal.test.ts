import { describe, expect, it } from 'vitest';

import { goalOverview, goalProgress, movementEffectInCents, periodsBetween } from '../goal';
import type { FinanceGoal, FinanceGoalMovement } from '../types';

const GOAL: FinanceGoal = {
  id: 'goal-trip',
  targetAmountInCents: 300_000,
  initialReservedInCents: 50_000,
  targetDate: '2027-04-01',
  contributionFrequency: 'monthly',
};

const TODAY = '2026-10-10';

const MOVEMENTS: FinanceGoalMovement[] = [
  { goalId: GOAL.id, type: 'deposit', amountInCents: 100_000, date: '2026-08-01' },
  { goalId: GOAL.id, type: 'withdrawal', amountInCents: 20_000, date: '2026-09-01' },
  { goalId: GOAL.id, type: 'yield', amountInCents: 5_000, date: '2026-10-01' },
  { goalId: GOAL.id, type: 'deposit', amountInCents: 50_000, date: '2026-12-01' },
];

describe('efeito dos movimentos', () => {
  it('depósitos e rendimentos somam, resgates subtraem', () => {
    expect(
      movementEffectInCents({ goalId: 'g', type: 'deposit', amountInCents: 100, date: TODAY }),
    ).toBe(100);
    expect(
      movementEffectInCents({ goalId: 'g', type: 'yield', amountInCents: 100, date: TODAY }),
    ).toBe(100);
    expect(
      movementEffectInCents({ goalId: 'g', type: 'withdrawal', amountInCents: 100, date: TODAY }),
    ).toBe(-100);
  });
});

describe('períodos que faltam', () => {
  it('conta por frequência, arredondando para cima', () => {
    expect(periodsBetween('2026-10-10', '2026-11-01', 'weekly')).toBe(4);
    expect(periodsBetween('2026-10-10', '2027-04-01', 'monthly')).toBe(6);
    expect(periodsBetween('2026-10-10', '2027-04-01', 'quarterly')).toBe(2);
    expect(periodsBetween('2026-10-10', '2028-10-10', 'yearly')).toBe(2);
  });

  it('devolve zero quando a data-limite já passou', () => {
    expect(periodsBetween('2026-10-10', '2026-10-01', 'monthly')).toBe(0);
    expect(periodsBetween('2026-10-10', '2026-10-10', 'monthly')).toBe(0);
  });
});

describe('progresso de um objetivo', () => {
  const progress = goalProgress({ goal: GOAL, movements: MOVEMENTS, today: TODAY });

  it('acumula reservado inicial, depósitos e rendimentos, e subtrai resgates', () => {
    expect(progress.accumulatedInCents).toBe(135_000);
  });

  it('ignora movimentos futuros no que já está acumulado', () => {
    const withoutFuture = goalProgress({
      goal: GOAL,
      movements: MOVEMENTS.filter((movement) => movement.date <= TODAY),
      today: TODAY,
    });

    expect(withoutFuture.accumulatedInCents).toBe(progress.accumulatedInCents);
  });

  it('calcula a percentagem e o que falta', () => {
    expect(progress.progressPct).toBe(45);
    expect(progress.remainingInCents).toBe(165_000);
  });

  it('calcula o esforço por período arredondado para cima', () => {
    expect(progress.periodsRemaining).toBe(6);
    expect(progress.requiredPerPeriodInCents).toBe(27_500);
  });

  it('projeta a conclusão ao ritmo real e considera o objetivo dentro do prazo', () => {
    expect(progress.projectedCompletionDate).toBe('2027-01-04');
    expect(progress.onTrack).toBe(true);
  });
});

describe('objetivo já cumprido', () => {
  it('fica a 100%, sem esforço e dentro do prazo', () => {
    const reached = goalProgress({
      goal: { ...GOAL, targetAmountInCents: 100_000 },
      movements: MOVEMENTS,
      today: TODAY,
    });

    expect(reached.remainingInCents).toBe(0);
    expect(reached.requiredPerPeriodInCents).toBe(0);
    expect(reached.progressPct).toBe(135);
    expect(reached.projectedCompletionDate).toBe(TODAY);
    expect(reached.onTrack).toBe(true);
  });
});

describe('objetivo sem ritmo', () => {
  it('não projeta conclusão quando não houve nenhum depósito', () => {
    const stalled = goalProgress({
      goal: { ...GOAL, initialReservedInCents: 0 },
      movements: [],
      today: TODAY,
    });

    expect(stalled.projectedCompletionDate).toBeNull();
    expect(stalled.onTrack).toBe(false);
    expect(stalled.requiredPerPeriodInCents).toBe(50_000);
  });
});

describe('visão agregada dos objetivos', () => {
  it('soma metas e acumulados e conta os que estão no prazo', () => {
    const second: FinanceGoal = {
      id: 'goal-car',
      targetAmountInCents: 200_000,
      targetDate: '2028-01-01',
      contributionFrequency: 'monthly',
    };
    const overview = goalOverview({
      goals: [GOAL, second],
      movements: MOVEMENTS,
      today: TODAY,
    });

    expect(overview.goals).toHaveLength(2);
    expect(overview.targetInCents).toBe(500_000);
    expect(overview.accumulatedInCents).toBe(135_000);
    expect(overview.progressPct).toBe(27);
    expect(overview.onTrackCount).toBe(1);
  });
});
