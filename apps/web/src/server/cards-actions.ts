'use server';

import { CardBrand, prisma } from '@repo/db/client';
import {
  createCreditCardSchema,
  setCardArchivedSchema,
  updateCreditCardSchema,
} from '@repo/shared';
import { revalidatePath } from 'next/cache';

import { failFromWriteError } from './errors';
import { fail, fromZodError, ok, type ActionResult } from './result';
import { requireUser } from './session';

/**
 * Ações sobre cartões de crédito.
 *
 * Nota de nomenclatura: o schema público chama ao limite `monthlyLimitInCents`
 * (nome fixado na Fase 1) e a coluna da base chama-se `creditLimitInCents`. A
 * conversão faz-se aqui, num sítio só.
 */

const BRAND_BY_INPUT: Record<string, CardBrand> = {
  visa: CardBrand.VISA,
  mastercard: CardBrand.MASTERCARD,
  maestro: CardBrand.MAESTRO,
  american_express: CardBrand.AMERICAN_EXPRESS,
  multibanco: CardBrand.MULTIBANCO,
  other: CardBrand.OTHER,
};

function revalidateCardViews(): void {
  revalidatePath('/cartoes');
  revalidatePath('/contas');
  revalidatePath('/transacoes');
  revalidatePath('/');
}

/**
 * Limite de crédito: vazio ou zero significam "sem limite definido".
 *
 * Zero como limite seria um cartão sem crédito nenhum, o que não é o que quem
 * apaga o campo quer dizer.
 */
function limitOrNull(value: number | null | undefined): number | null {
  return value == null || value === 0 ? null : value;
}

/** Confirma que a conta de pagamento existe e é do utilizador. */
async function ownsAccount(userId: string, accountId: string): Promise<boolean> {
  const account = await prisma.financialAccount.findFirst({
    where: { id: accountId, userId },
    select: { id: true },
  });

  return account !== null;
}

/** Cria um cartão gerido à mão. */
export async function createCreditCard(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = createCreditCardSchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const value = parsed.data;

  if (!(await ownsAccount(user.id, value.paymentAccountId))) {
    return fail('Conta não encontrada.', {
      paymentAccountId: ['Escolhe uma conta tua para pagar a fatura.'],
    });
  }

  const duplicate = await prisma.creditCard.findFirst({
    where: { userId: user.id, name: value.name },
    select: { id: true },
  });

  if (duplicate) {
    return fail('Já tens um cartão com esse nome.', {
      name: ['Já tens um cartão com esse nome.'],
    });
  }

  try {
    const created = await prisma.creditCard.create({
      data: {
        userId: user.id,
        name: value.name,
        brand: BRAND_BY_INPUT[value.brand] ?? CardBrand.OTHER,
        paymentAccountId: value.paymentAccountId,
        closingDay: value.closingDay,
        dueDay: value.dueDay,
        creditLimitInCents: limitOrNull(value.monthlyLimitInCents),
        annualFeeInCents: value.annualFeeInCents ?? null,
      },
      select: { id: true },
    });

    revalidateCardViews();

    return ok({ id: created.id });
  } catch (error) {
    return failFromWriteError(error, {
      fallback: 'Não consegui criar o cartão. Tenta outra vez.',
      unique: 'Já tens um cartão com esse nome.',
    });
  }
}

/** Altera os dados de um cartão. */
export async function updateCreditCard(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = updateCreditCardSchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const value = parsed.data;
  const existing = await prisma.creditCard.findFirst({
    where: { id: value.id, userId: user.id },
    select: { id: true },
  });

  if (!existing) {
    return fail('Cartão não encontrado.');
  }

  if (
    value.paymentAccountId !== undefined &&
    !(await ownsAccount(user.id, value.paymentAccountId))
  ) {
    return fail('Conta não encontrada.', {
      paymentAccountId: ['Escolhe uma conta tua para pagar a fatura.'],
    });
  }

  if (value.name !== undefined) {
    const duplicate = await prisma.creditCard.findFirst({
      where: { userId: user.id, name: value.name, id: { not: value.id } },
      select: { id: true },
    });

    if (duplicate) {
      return fail('Já tens um cartão com esse nome.', {
        name: ['Já tens um cartão com esse nome.'],
      });
    }
  }

  try {
    await prisma.creditCard.update({
      where: { id: value.id },
      data: {
        ...(value.name !== undefined ? { name: value.name } : {}),
        ...(value.brand !== undefined
          ? { brand: BRAND_BY_INPUT[value.brand] ?? CardBrand.OTHER }
          : {}),
        ...(value.paymentAccountId !== undefined
          ? { paymentAccountId: value.paymentAccountId }
          : {}),
        ...(value.closingDay !== undefined ? { closingDay: value.closingDay } : {}),
        ...(value.dueDay !== undefined ? { dueDay: value.dueDay } : {}),
        ...(value.monthlyLimitInCents !== undefined
          ? { creditLimitInCents: limitOrNull(value.monthlyLimitInCents) }
          : {}),
        ...(value.annualFeeInCents !== undefined
          ? { annualFeeInCents: value.annualFeeInCents }
          : {}),
      },
    });

    revalidateCardViews();

    return ok({ id: value.id });
  } catch (error) {
    return failFromWriteError(error, {
      fallback: 'Não consegui guardar o cartão. Tenta outra vez.',
      unique: 'Já tens um cartão com esse nome.',
    });
  }
}

/**
 * Arquiva ou reativa um cartão.
 *
 * Arquivar não apaga nada: as faturas e o histórico continuam lá — o cartão só
 * deixa de aparecer nas escolhas. Apagar é que levaria o histórico atrás, e é
 * por isso que não há apagar.
 */
export async function setCardArchived(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = setCardArchivedSchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const value = parsed.data;
  const existing = await prisma.creditCard.findFirst({
    where: { id: value.id, userId: user.id },
    select: { id: true },
  });

  if (!existing) {
    return fail('Cartão não encontrado.');
  }

  await prisma.creditCard.update({
    where: { id: value.id },
    data: { archivedAt: value.archived ? new Date() : null },
  });

  revalidateCardViews();

  return ok({ id: value.id });
}
