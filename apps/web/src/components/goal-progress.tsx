import { CircleCheck, Clock, TriangleAlert } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * “Estou no bom caminho?”
 *
 * A percentagem sozinha não responde a esta pergunta: 10% em outubro com prazo em
 * dezembro é um atraso, e 90% com prazo para o ano que vem é folga. O motor
 * devolve `onTrack` e `requiredContributionInCents`; a interface escreve o
 * veredicto **por palavras**, com a razão, em vez de confiar numa cor.
 */

/** Veredicto de acompanhamento de um objetivo. */
export type GoalVerdict = 'completed' | 'on-track' | 'late';

/** Nome legível de cada veredicto. */
export const GOAL_VERDICT_LABELS: Readonly<Record<GoalVerdict, string>> = {
  completed: 'Concluído',
  'on-track': 'No bom caminho',
  late: 'Atrasado',
};

/** Frequência do aporte, como se diz em português. */
export const GOAL_FREQUENCY_LABELS: Readonly<Record<string, string>> = {
  weekly: 'por semana',
  monthly: 'por mês',
  quarterly: 'por trimestre',
  yearly: 'por ano',
};

/** Substantivo de um período, no singular. */
const GOAL_PERIOD_SINGULAR: Readonly<Record<string, string>> = {
  weekly: 'semana',
  monthly: 'mês',
  quarterly: 'trimestre',
  yearly: 'ano',
};

/** Substantivo de um período, no plural. */
const GOAL_PERIOD_PLURAL: Readonly<Record<string, string>> = {
  weekly: 'semanas',
  monthly: 'meses',
  quarterly: 'trimestres',
  yearly: 'anos',
};

/**
 * Contagem de períodos escrita por extenso.
 *
 * Existe para o ecrã não dizer “3 por mês até lá” nem “3 mês”: a frequência serve
 * dois papéis diferentes (cadência e unidade de contagem) e cada um tem a sua
 * forma.
 */
export function formatPeriodsLeft(count: number, frequency: string): string {
  const singular = GOAL_PERIOD_SINGULAR[frequency] ?? 'período';
  const plural = GOAL_PERIOD_PLURAL[frequency] ?? 'períodos';

  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

/**
 * Veredicto a partir do que o servidor devolve.
 *
 * O estado do objetivo (`active`/`completed`) é do ciclo de vida; o veredicto é
 * sobre o dinheiro. Duas situações dão “concluído”: o utilizador marcou-o como
 * concluído (e a decisão dele manda) ou já lá está o valor todo — mesmo que não
 * o tenha marcado, os números dizem que está feito.
 */
export function goalVerdict(goal: {
  readonly state: string;
  readonly onTrack: boolean;
  readonly remainingInCents: number;
}): GoalVerdict {
  if (goal.state === 'completed' || goal.remainingInCents <= 0) {
    return 'completed';
  }

  return goal.onTrack ? 'on-track' : 'late';
}

/** Frase que explica o veredicto. */
export function goalVerdictSentence(goal: {
  readonly state: string;
  readonly verdict: GoalVerdict;
  readonly movementCount: number;
  readonly accumulatedInCents: number;
  readonly contributionFrequency: string;
}): string {
  const perPeriod = GOAL_FREQUENCY_LABELS[goal.contributionFrequency] ?? 'por período';

  if (goal.state === 'completed') {
    return 'Está marcado como concluído. Reabre-o se ainda queres continuar a juntar.';
  }

  if (goal.verdict === 'completed') {
    return 'Já tens o valor todo. Podes marcar o objetivo como concluído.';
  }

  if (goal.verdict === 'on-track') {
    return 'Ao ritmo de poupança que já mostraste, chegas ao valor antes do prazo.';
  }

  if (goal.movementCount === 0 && goal.accumulatedInCents === 0) {
    return `Ainda não há poupança registada. Para cumprires o prazo, começa a aportar ${perPeriod}.`;
  }

  return `Ao ritmo atual não chegas ao prazo. Para o cumprires, precisas de aportar mais ${perPeriod}.`;
}

export function GoalVerdictBadge({ verdict }: { readonly verdict: GoalVerdict }) {
  const label = GOAL_VERDICT_LABELS[verdict];

  if (verdict === 'completed') {
    return (
      <Badge variant="secondary" className="font-normal">
        <CircleCheck className="size-3" aria-hidden />
        {label}
      </Badge>
    );
  }

  if (verdict === 'late') {
    return (
      <Badge variant="destructive" className="font-normal">
        <TriangleAlert className="size-3" aria-hidden />
        {label}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="font-normal text-income">
      <Clock className="size-3" aria-hidden />
      {label}
    </Badge>
  );
}

/**
 * Barra de progresso do objetivo.
 *
 * A barra passa dos 100% quando o acumulado ultrapassa o alvo (o utilizador pode
 * ter guardado mais do que precisava), mas o valor acessível fica limitado a 100
 * para o leitor de ecrã não anunciar percentagens impossíveis.
 */
export function GoalMeter({
  progressPct,
  verdict,
  label,
  className,
}: {
  readonly progressPct: number;
  readonly verdict: GoalVerdict;
  /** Nome acessível: “Objetivo Férias”. */
  readonly label: string;
  readonly className?: string;
}) {
  const clamped = Math.max(0, Math.min(progressPct, 100));
  const tone =
    verdict === 'completed' ? 'bg-income' : verdict === 'late' ? 'bg-warning' : 'bg-primary';

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${label}: ${progressPct}% do objetivo, ${GOAL_VERDICT_LABELS[verdict]}`}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)}
    >
      <div className={cn('h-full rounded-full', tone)} style={{ width: `${clamped}%` }} />
    </div>
  );
}
