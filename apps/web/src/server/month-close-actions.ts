'use server';

import { prisma } from '@repo/db/client';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { todayInLisbon } from '@/lib/today';

import { periodByKey } from './budget-period';
import { failFromWriteError } from './errors';
import { fail, fromZodError, ok, type ActionResult } from './result';
import { requireUser } from './session';

/**
 * Fecho e reabertura de um mês.
 *
 * O fecho **não bloqueia nada**: é um marco de "conferi este mês", com data. Um
 * fecho que impedisse escrever obrigaria o utilizador a reabrir o mês para
 * corrigir um erro — e a correção passaria a ser mais difícil do que o erro.
 */

const periodSchema = z.object({
  periodKey: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}$/, 'Período inválido.'),
});

function revalidateMonthCloseViews(): void {
  revalidatePath('/');
  revalidatePath('/relatorios');
  revalidatePath('/transacoes');
}

/** Marca o mês como conferido. */
export async function closeMonth(input: unknown): Promise<ActionResult<{ closedAt: string }>> {
  const user = await requireUser();
  const parsed = periodSchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  /*
   * O período resolve-se pela **chave**, e não a partir do dia 1.
   *
   * `periodOf('2026-10-01')` com o mês a começar ao dia 5 devolve **setembro** —
   * o dia 1 pertence ao mês de competência anterior. Era assim que fechar outubro
   * gravava setembro e o mês nunca aparecia como fechado, por mais vezes que se
   * clicasse. Com o início ao dia 1 funcionava, e foi por isso que escapou à
   * verificação. Encontrado pela verificação adversarial das Fases 5 e 6.
   */
  const period = periodByKey({
    key: parsed.data.periodKey,
    user,
    today: todayInLisbon(),
  });

  if (period === null) {
    return fail('Esse mês não está entre os últimos três anos.');
  }
  const periodStart = new Date(`${period.start}T00:00:00.000Z`);

  try {
    const close = await prisma.monthClose.upsert({
      where: { userId_periodStart: { userId: user.id, periodStart } },
      update: { closedAt: new Date() },
      create: { userId: user.id, periodStart },
      select: { closedAt: true },
    });

    revalidateMonthCloseViews();

    return ok({ closedAt: close.closedAt.toISOString().slice(0, 10) });
  } catch (error) {
    return failFromWriteError(error, {
      fallback: 'Não consegui fechar o mês. Tenta outra vez.',
    });
  }
}

/** Reabre o mês, apagando o marco de fecho. */
export async function reopenMonth(input: unknown): Promise<ActionResult<{ periodKey: string }>> {
  const user = await requireUser();
  const parsed = periodSchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  /*
   * O período resolve-se pela **chave**, e não a partir do dia 1.
   *
   * `periodOf('2026-10-01')` com o mês a começar ao dia 5 devolve **setembro** —
   * o dia 1 pertence ao mês de competência anterior. Era assim que fechar outubro
   * gravava setembro e o mês nunca aparecia como fechado, por mais vezes que se
   * clicasse. Com o início ao dia 1 funcionava, e foi por isso que escapou à
   * verificação. Encontrado pela verificação adversarial das Fases 5 e 6.
   */
  const period = periodByKey({
    key: parsed.data.periodKey,
    user,
    today: todayInLisbon(),
  });

  if (period === null) {
    return fail('Esse mês não está entre os últimos três anos.');
  }

  const existing = await prisma.monthClose.findUnique({
    where: {
      userId_periodStart: {
        userId: user.id,
        periodStart: new Date(`${period.start}T00:00:00.000Z`),
      },
    },
    select: { id: true },
  });

  if (existing === null) {
    return fail('Este mês não está fechado.');
  }

  await prisma.monthClose.delete({ where: { id: existing.id } });
  revalidateMonthCloseViews();

  return ok({ periodKey: period.key });
}
