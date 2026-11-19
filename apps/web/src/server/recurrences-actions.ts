'use server';

import { prisma } from '@repo/db/client';
import {
  createRecurrenceSchema,
  deleteByIdSchema,
  seriesDayOfMonth,
  setActiveSchema,
  toIsoDate,
  toRecurrenceFrequency,
  updateRecurrenceSchema,
} from '@repo/shared';
import { revalidatePath } from 'next/cache';

import { todayInLisbon } from '@/lib/today';

import { failFromWriteError } from './errors';
import {
  asDate,
  gerarRecorrenciasParaUtilizador,
  type GenerationDetail,
} from './recurrence-generation';
import { fail, fromZodError, ok, type ActionResult } from './result';
import { requireUser } from './session';

/**
 * Ações sobre séries recorrentes, incluindo o gerador.
 *
 * O gerador é **idempotente por construção**: cria as ocorrências em atraso e
 * avança `nextRunDate` na mesma transação de base de dados. Correr duas vezes no
 * mesmo dia não cria a renda duas vezes — a segunda corrida já não encontra nada
 * em atraso. É isso que permite dispará-la sem medo de dois lados: do painel,
 * pelo botão, e uma vez por dia pelo Vercel Cron (`/api/cron/recurrences`).
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
        /*
         * O dia do mês fica **gravado** na criação, a partir do dia da data de
         * início quando o utilizador não o indica. É a única memória do dia
         * contratado: sem ela, o motor reconstrói o dia alvo a partir da última
         * data gerada e, depois de a série passar por fevereiro, o 31 perde-se
         * para sempre (31/01 → 28/02 → 28/03). Numa série semanal o dia não faz
         * parte da regra e fica nulo.
         */
        dayOfMonth: seriesDayOfMonth({
          frequency: value.frequency,
          startDate: value.startDate,
          dayOfMonth: value.dayOfMonth,
        }),
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
    select: { id: true, startDate: true, endDate: true, frequency: true, dayOfMonth: true },
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

  /*
   * Uma série que não é semanal mantém sempre um dia gravado.
   *
   * A edição é parcial: quando o cliente **omite** o campo, mantém-se o que está
   * na base; quando envia `null` (o formulário limpa-o ao mudar de natureza), o
   * dia é reconstruído a partir da data de início em vez de desaparecer. Sem
   * isto, gravar uma edição voltava a deixar a série dependente do dia da última
   * data gerada — que é precisamente a informação que se perde.
   */
  const effectiveFrequency = value.frequency ?? toRecurrenceFrequency(existing.frequency);
  const dayOfMonth = seriesDayOfMonth({
    frequency: effectiveFrequency,
    startDate,
    dayOfMonth: value.dayOfMonth === undefined ? existing.dayOfMonth : value.dayOfMonth,
  });

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
        // Sempre escrito: o dia da série nunca volta a ficar nulo por uma edição.
        dayOfMonth,
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

/**
 * Gera as ocorrências em atraso de todas as séries ativas **do utilizador da
 * sessão**. Idempotente.
 *
 * O ciclo de geração vive em `./recurrence-generation`, partilhado com o Vercel
 * Cron (`/api/cron/recurrences`, T70). A partilha é só do corpo: a origem do
 * `userId` continua a ser a única diferença — aqui é a sessão, na rota é a base,
 * e nada do que o chamador envia chega ao gerador. O comportamento público é o
 * de sempre: mesmas mensagens, mesma contagem, mesma revalidação, e nada é
 * revalidado quando uma série falhou a meio.
 */
export async function generateDueRecurrences(): Promise<
  ActionResult<{ created: number; truncated: boolean; details: GenerationDetail[] }>
> {
  const user = await requireUser();
  const outcome = await gerarRecorrenciasParaUtilizador(user.id, todayInLisbon());

  if (outcome.failure !== null) {
    return fail(outcome.failure);
  }

  revalidateRecurrenceViews();

  return ok({ created: outcome.created, truncated: outcome.truncated, details: outcome.details });
}
