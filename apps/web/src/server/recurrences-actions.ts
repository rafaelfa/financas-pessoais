'use server';

import { prisma } from '@repo/db/client';
import {
  createRecurrenceSchema,
  deleteByIdSchema,
  dueOccurrences,
  setActiveSchema,
  toIsoDate,
  updateRecurrenceSchema,
} from '@repo/shared';
import { revalidatePath } from 'next/cache';

import { todayInLisbon } from '@/lib/today';

import { failFromWriteError } from './errors';
import { fail, fromZodError, ok, type ActionResult } from './result';
import { requireUser } from './session';

/**
 * Ações sobre séries recorrentes, incluindo o gerador.
 *
 * O gerador é **idempotente por construção**: cria as ocorrências em atraso e
 * avança `nextRunDate` na mesma transação de base de dados. Correr duas vezes no
 * mesmo dia não cria a renda duas vezes — a segunda corrida já não encontra nada
 * em atraso. É essa a razão de a geração poder ser disparada sem medo a partir do
 * painel, e não apenas por uma tarefa agendada.
 */

function revalidateRecurrenceViews(): void {
  revalidatePath('/recorrencias');
  revalidatePath('/transacoes');
  revalidatePath('/');
}

const FREQUENCY_BY_INPUT = {
  weekly: 'WEEKLY',
  monthly: 'MONTHLY',
  quarterly: 'QUARTERLY',
} as const;

function asDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/** Confirma que a conta existe e é do utilizador. */
async function ownsAccount(userId: string, accountId: string): Promise<boolean> {
  const account = await prisma.financialAccount.findFirst({
    where: { id: accountId, userId },
    select: { id: true },
  });

  return account !== null;
}

async function ownsCategory(userId: string, categoryId: string): Promise<boolean> {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId },
    select: { id: true },
  });

  return category !== null;
}

export async function createRecurrence(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = createRecurrenceSchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const value = parsed.data;

  if (!(await ownsAccount(user.id, value.accountId))) {
    return fail('Conta não encontrada.', { accountId: ['Escolhe uma conta tua.'] });
  }

  if (value.categoryId != null && !(await ownsCategory(user.id, value.categoryId))) {
    return fail('Categoria não encontrada.', { categoryId: ['Escolhe uma categoria tua.'] });
  }

  const startDate = asDate(value.startDate);

  try {
    const created = await prisma.recurrence.create({
      data: {
        userId: user.id,
        name: value.name,
        kind: value.kind === 'income' ? 'INCOME' : 'EXPENSE',
        // A coluna guarda o sinal, como nos lançamentos: um gasto é negativo.
        amountInCents: value.kind === 'income' ? value.amountInCents : -value.amountInCents,
        description: value.description ?? null,
        frequency: FREQUENCY_BY_INPUT[value.frequency],
        interval: value.interval,
        dayOfMonth: value.dayOfMonth ?? null,
        startDate,
        endDate: value.endDate == null ? null : asDate(value.endDate),
        // A primeira ocorrência a gerar é a data de início: quem cria uma série
        // que já começou espera ver a ocorrência do início, não a do mês seguinte.
        nextRunDate: startDate,
        isActive: true,
        financialAccountId: value.accountId,
        categoryId: value.categoryId ?? null,
      },
      select: { id: true },
    });

    revalidateRecurrenceViews();

    return ok({ id: created.id });
  } catch (error) {
    return failFromWriteError(error, {
      fallback: 'Não consegui criar a série. Tenta outra vez.',
      unique: 'Já tens uma série com esse nome.',
    });
  }
}

export async function updateRecurrence(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = updateRecurrenceSchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const value = parsed.data;
  const existing = await prisma.recurrence.findFirst({
    where: { id: value.id, userId: user.id },
    select: { id: true, startDate: true, endDate: true },
  });

  if (!existing) {
    return fail('Série não encontrada.');
  }

  if (value.accountId != null && !(await ownsAccount(user.id, value.accountId))) {
    return fail('Conta não encontrada.', { accountId: ['Escolhe uma conta tua.'] });
  }

  if (value.categoryId != null && !(await ownsCategory(user.id, value.categoryId))) {
    return fail('Categoria não encontrada.', { categoryId: ['Escolhe uma categoria tua.'] });
  }

  // O fim tem de ser depois do início — validado aqui contra o que está gravado,
  // porque o formulário pode enviar só um dos dois.
  const startDate = value.startDate === undefined ? toIsoDate(existing.startDate) : value.startDate;
  const endDate =
    value.endDate === undefined
      ? existing.endDate === null
        ? null
        : toIsoDate(existing.endDate)
      : value.endDate;

  if (endDate !== null && endDate < startDate) {
    return fail('O fim da série não pode ser antes do início.', {
      endDate: ['O fim tem de ser depois do início.'],
    });
  }

  try {
    await prisma.recurrence.update({
      where: { id: value.id },
      data: {
        ...(value.name !== undefined ? { name: value.name } : {}),
        ...(value.kind !== undefined
          ? {
              kind: value.kind === 'income' ? 'INCOME' : 'EXPENSE',
              // O sinal acompanha a natureza: mudar de gasto para ganho tem de
              // inverter o valor, senão a série gerava despesas com sinal oposto.
              amountInCents:
                value.amountInCents !== undefined
                  ? value.kind === 'income'
                    ? value.amountInCents
                    : -value.amountInCents
                  : undefined,
            }
          : value.amountInCents !== undefined
            ? { amountInCents: value.amountInCents }
            : {}),
        ...(value.description !== undefined ? { description: value.description } : {}),
        ...(value.frequency !== undefined
          ? { frequency: FREQUENCY_BY_INPUT[value.frequency] }
          : {}),
        ...(value.interval !== undefined ? { interval: value.interval } : {}),
        ...(value.dayOfMonth !== undefined ? { dayOfMonth: value.dayOfMonth } : {}),
        ...(value.startDate !== undefined ? { startDate: asDate(value.startDate) } : {}),
        ...(value.endDate !== undefined
          ? { endDate: value.endDate == null ? null : asDate(value.endDate) }
          : {}),
        ...(value.accountId !== undefined ? { financialAccountId: value.accountId } : {}),
        ...(value.categoryId !== undefined ? { categoryId: value.categoryId } : {}),
      },
    });

    revalidateRecurrenceViews();

    return ok({ id: value.id });
  } catch (error) {
    return failFromWriteError(error, {
      fallback: 'Não consegui guardar a série. Tenta outra vez.',
      unique: 'Já tens uma série com esse nome.',
    });
  }
}

/** Pausa ou retoma uma série. */
export async function setRecurrenceActive(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = setActiveSchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const existing = await prisma.recurrence.findFirst({
    where: { id: parsed.data.id, userId: user.id },
    select: { id: true },
  });

  if (!existing) {
    return fail('Série não encontrada.');
  }

  await prisma.recurrence.update({
    where: { id: parsed.data.id },
    data: { isActive: parsed.data.active },
  });

  revalidateRecurrenceViews();

  return ok({ id: parsed.data.id });
}

/**
 * Apaga a série.
 *
 * Os lançamentos que já gerou **ficam**: aconteceram, e apagá-los reescreveria o
 * histórico de meses já conferidos. O que desaparece é a repetição futura.
 */
export async function deleteRecurrence(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = deleteByIdSchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const existing = await prisma.recurrence.findFirst({
    where: { id: parsed.data.id, userId: user.id },
    select: { id: true },
  });

  if (!existing) {
    return fail('Série não encontrada.');
  }

  await prisma.recurrence.delete({ where: { id: parsed.data.id } });
  revalidateRecurrenceViews();

  return ok({ id: parsed.data.id });
}

export interface GenerationDetail {
  readonly recurrenceName: string;
  readonly dates: string[];
}

/** Gera as ocorrências em atraso de todas as séries ativas. Idempotente. */
export async function generateDueRecurrences(): Promise<
  ActionResult<{ created: number; truncated: boolean; details: GenerationDetail[] }>
> {
  const user = await requireUser();
  const today = todayInLisbon();

  const recurrences = await prisma.recurrence.findMany({
    where: {
      userId: user.id,
      isActive: true,
      nextRunDate: { lte: new Date(`${today}T00:00:00.000Z`) },
    },
    orderBy: [{ nextRunDate: 'asc' }],
  });

  const details: GenerationDetail[] = [];
  let created = 0;
  let truncated = false;

  for (const recurrence of recurrences) {
    const frequency =
      recurrence.frequency === 'WEEKLY'
        ? 'weekly'
        : recurrence.frequency === 'QUARTERLY'
          ? 'quarterly'
          : 'monthly';

    const result = dueOccurrences({
      nextRunDate: toIsoDate(recurrence.nextRunDate),
      frequency,
      interval: recurrence.interval,
      dayOfMonth: recurrence.dayOfMonth ?? undefined,
      endDate: recurrence.endDate === null ? undefined : toIsoDate(recurrence.endDate),
      today,
    });

    if (result.dates.length === 0) {
      continue;
    }

    truncated = truncated || result.truncated;

    try {
      const claimed = await prisma.$transaction(async (tx) => {
        /*
         * Reserva a série **antes** de criar nada.
         *
         * A leitura das séries em atraso acontece fora da transação, por isso duas
         * gerações em paralelo (dois separadores, um duplo clique, o painel e o
         * botão ao mesmo tempo) viam as duas a mesma `nextRunDate` e criavam as
         * mesmas ocorrências: a verificação adversarial mediu **18 lançamentos em
         * vez de 10**. Um avanço condicional na data que foi lida resolve-o sem
         * esquema novo — a segunda transação avança zero linhas e desiste sem
         * escrever. Sem esta condição, o comentário do motor ("gerar nunca pode
         * duplicar") era verdade sequencial e falso concorrente.
         */
        const claimed = await tx.recurrence.updateMany({
          where: { id: recurrence.id, nextRunDate: recurrence.nextRunDate },
          data: { nextRunDate: asDate(result.nextRunDate) },
        });

        if (claimed.count !== 1) {
          return false;
        }

        for (const date of result.dates) {
          await tx.transaction.create({
            data: {
              userId: user.id,
              kind: recurrence.kind,
              status: 'CONFIRMED',
              amountInCents: recurrence.amountInCents,
              date: asDate(date),
              description: recurrence.description ?? recurrence.name,
              financialAccountId: recurrence.financialAccountId,
              categoryId: recurrence.categoryId,
              recurrenceId: recurrence.id,
              paymentMethod: 'DEBIT',
              paymentCondition: 'RECURRING',
              // Uma ocorrência gerada é um movimento que já aconteceu: conta no
              // saldo. Séries que ainda não ocorreram têm `nextRunDate` no
              // futuro e por isso não são geradas.
              settled: true,
              settledOn: asDate(date),
            },
          });
        }

        return true;
      });

      // Não reclamada: outra geração chegou primeiro. Não é um erro, e não se
      // conta nada — quem perdeu a corrida não criou lançamento nenhum.
      if (!claimed) {
        continue;
      }

      created += result.dates.length;
      details.push({ recurrenceName: recurrence.name, dates: result.dates });
    } catch (error) {
      console.error(`[recorrências] falhou a série ${recurrence.name}:`, error);

      return fail(
        `Não consegui gerar as ocorrências de "${recurrence.name}". Nada foi alterado nessa série.`,
      );
    }
  }

  revalidateRecurrenceViews();

  return ok({ created, truncated, details });
}
