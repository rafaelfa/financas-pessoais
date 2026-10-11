import { prisma } from '@repo/db/client';
import {
  describeFrequency,
  toIsoDate,
  toRecurrenceFrequency,
  type RecurrenceFrequency,
} from '@repo/shared';

import { todayInLisbon } from '@/lib/today';

import { requireUser } from './session';

/**
 * Recorrências (rendas, salários, subscrições).
 *
 * A consulta devolve a **frequência por extenso** (`frequencyLabel`) além dos
 * campos crus: a interface mostra "todos os meses, dia 5", e essa frase sai do
 * mesmo sítio que o gerador usa para decidir as datas — uma frase escrita à mão
 * na interface acabaria a descrever uma regra diferente da que corre.
 */

export interface RecurrenceView {
  readonly id: string;
  readonly name: string;
  readonly kind: 'expense' | 'income';
  readonly amountInCents: number;
  readonly description: string | null;
  readonly frequency: RecurrenceFrequency;
  readonly interval: number;
  readonly dayOfMonth: number | null;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly nextRunDate: string;
  readonly isActive: boolean;
  readonly accountId: string | null;
  readonly accountName: string | null;
  readonly categoryId: string | null;
  readonly categoryName: string | null;
  readonly generatedCount: number;
  /** Já tem ocorrências por gerar até hoje. */
  readonly due: boolean;
  readonly frequencyLabel: string;
}

/** Séries do utilizador, com a próxima data e quantas ocorrências já geraram. */
export async function listRecurrences(): Promise<RecurrenceView[]> {
  const user = await requireUser();
  const today = todayInLisbon();

  const [recurrences, counts] = await Promise.all([
    prisma.recurrence.findMany({
      where: { userId: user.id },
      orderBy: [{ isActive: 'desc' }, { nextRunDate: 'asc' }],
      include: {
        financialAccount: { select: { name: true } },
        category: { select: { name: true } },
      },
    }),
    prisma.transaction.groupBy({
      by: ['recurrenceId'],
      where: { userId: user.id, recurrenceId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const countByRecurrence = new Map(
    counts
      .filter((row) => row.recurrenceId !== null)
      .map((row) => [row.recurrenceId ?? '', row._count._all]),
  );

  return recurrences.map((recurrence) => {
    const frequency = toRecurrenceFrequency(recurrence.frequency);
    const nextRunDate = toIsoDate(recurrence.nextRunDate);

    return {
      id: recurrence.id,
      name: recurrence.name,
      kind: recurrence.kind === 'INCOME' ? 'income' : 'expense',
      amountInCents: Math.abs(recurrence.amountInCents),
      description: recurrence.description,
      frequency,
      interval: recurrence.interval,
      dayOfMonth: recurrence.dayOfMonth,
      startDate: toIsoDate(recurrence.startDate),
      endDate: recurrence.endDate === null ? null : toIsoDate(recurrence.endDate),
      nextRunDate,
      isActive: recurrence.isActive,
      accountId: recurrence.financialAccountId,
      accountName: recurrence.financialAccount?.name ?? null,
      categoryId: recurrence.categoryId,
      categoryName: recurrence.category?.name ?? null,
      generatedCount: countByRecurrence.get(recurrence.id) ?? 0,
      due: recurrence.isActive && nextRunDate <= today,
      frequencyLabel: describeFrequency({
        frequency,
        interval: recurrence.interval,
        dayOfMonth: recurrence.dayOfMonth ?? undefined,
      }),
    };
  });
}

/** Número de séries ativas com ocorrências por gerar — para avisar no painel. */
export async function dueRecurrenceCount(): Promise<number> {
  const recurrences = await listRecurrences();

  return recurrences.filter((recurrence) => recurrence.due).length;
}
