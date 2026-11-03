'use server';

import { prisma } from '@repo/db/client';
import {
  archivePatrimonySchema,
  createAssetSchema,
  createLiabilitySchema,
  updateAssetSchema,
  updateLiabilitySchema,
} from '@repo/shared';
import { revalidatePath } from 'next/cache';

import { failFromWriteError } from './errors';
import { fail, fromZodError, ok, type ActionResult } from './result';
import { requireUser } from './session';

/**
 * Ações de bens e dívidas.
 *
 * Tudo filtrado por `userId` da sessão: o identificador vem do cliente e não é
 * de confiança. **Arquivar, não apagar** — é o que as contas fazem, e apagar
 * reescreveria o histórico do património (o Painel passaria a mostrar outro
 * passado, não o real).
 */

function revalidatePatrimonioViews() {
  revalidatePath('/patrimonio');
  // O património líquido aparece no Painel: sem isto o número ficava velho.
  revalidatePath('/');
}

/** Cria um bem. */
export async function createAsset(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = createAssetSchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const value = parsed.data;

  try {
    const criado = await prisma.asset.create({
      data: {
        userId: user.id,
        type: value.type,
        name: value.name,
        description: value.description ?? null,
        valueInCents: value.valueInCents,
        acquiredOn: value.acquiredOn === undefined ? null : new Date(value.acquiredOn),
        valuedOn: value.valuedOn === undefined ? null : new Date(value.valuedOn),
      },
      select: { id: true },
    });

    revalidatePatrimonioViews();

    return ok({ id: criado.id });
  } catch (error) {
    return failFromWriteError(error, {
      fallback: 'Não consegui guardar o bem. Tenta outra vez.',
    });
  }
}

/** Altera um bem. */
export async function updateAsset(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = updateAssetSchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const value = parsed.data;
  const existing = await prisma.asset.findFirst({
    where: { id: value.id, userId: user.id },
    select: { id: true },
  });

  if (!existing) {
    return fail('Bem não encontrado.');
  }

  try {
    await prisma.asset.update({
      where: { id: value.id },
      data: {
        ...(value.type !== undefined ? { type: value.type } : {}),
        ...(value.name !== undefined ? { name: value.name } : {}),
        ...(value.description !== undefined ? { description: value.description } : {}),
        ...(value.valueInCents !== undefined ? { valueInCents: value.valueInCents } : {}),
        ...(value.acquiredOn !== undefined ? { acquiredOn: new Date(value.acquiredOn) } : {}),
        ...(value.valuedOn !== undefined ? { valuedOn: new Date(value.valuedOn) } : {}),
      },
    });
  } catch (error) {
    return failFromWriteError(error, {
      fallback: 'Não consegui alterar o bem. Tenta outra vez.',
    });
  }

  revalidatePatrimonioViews();

  return ok({ id: value.id });
}

/** Arquiva ou reativa um bem. */
export async function setAssetArchived(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = archivePatrimonySchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const value = parsed.data;
  const existing = await prisma.asset.findFirst({
    where: { id: value.id, userId: user.id },
    select: { id: true },
  });

  if (!existing) {
    return fail('Bem não encontrado.');
  }

  await prisma.asset.update({
    where: { id: value.id },
    data: { archivedAt: value.archived ? new Date() : null },
  });

  revalidatePatrimonioViews();

  return ok({ id: value.id });
}

/** Cria uma dívida. */
export async function createLiability(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = createLiabilitySchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const value = parsed.data;

  try {
    const criada = await prisma.liability.create({
      data: {
        userId: user.id,
        type: value.type,
        name: value.name,
        creditor: value.creditor ?? null,
        principalInCents: value.principalInCents,
        outstandingInCents: value.outstandingInCents,
        interestRateBasisPoints: value.interestRateBasisPoints ?? null,
        totalInstallments: value.totalInstallments ?? null,
        remainingInstallments: value.remainingInstallments ?? null,
        installmentAmountInCents: value.installmentAmountInCents ?? null,
        startDate: value.startDate === undefined ? null : new Date(value.startDate),
        endDate: value.endDate === undefined ? null : new Date(value.endDate),
      },
      select: { id: true },
    });

    revalidatePatrimonioViews();

    return ok({ id: criada.id });
  } catch (error) {
    return failFromWriteError(error, {
      fallback: 'Não consegui guardar a dívida. Tenta outra vez.',
    });
  }
}

/** Altera uma dívida. */
export async function updateLiability(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = updateLiabilitySchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const value = parsed.data;
  const existing = await prisma.liability.findFirst({
    where: { id: value.id, userId: user.id },
    select: { id: true },
  });

  if (!existing) {
    return fail('Dívida não encontrada.');
  }

  try {
    await prisma.liability.update({
      where: { id: value.id },
      data: {
        ...(value.type !== undefined ? { type: value.type } : {}),
        ...(value.name !== undefined ? { name: value.name } : {}),
        ...(value.creditor !== undefined ? { creditor: value.creditor } : {}),
        ...(value.principalInCents !== undefined
          ? { principalInCents: value.principalInCents }
          : {}),
        ...(value.outstandingInCents !== undefined
          ? { outstandingInCents: value.outstandingInCents }
          : {}),
        ...(value.interestRateBasisPoints !== undefined
          ? { interestRateBasisPoints: value.interestRateBasisPoints }
          : {}),
        ...(value.totalInstallments !== undefined
          ? { totalInstallments: value.totalInstallments }
          : {}),
        ...(value.remainingInstallments !== undefined
          ? { remainingInstallments: value.remainingInstallments }
          : {}),
        ...(value.installmentAmountInCents !== undefined
          ? { installmentAmountInCents: value.installmentAmountInCents }
          : {}),
        ...(value.startDate !== undefined ? { startDate: new Date(value.startDate) } : {}),
        ...(value.endDate !== undefined ? { endDate: new Date(value.endDate) } : {}),
      },
    });
  } catch (error) {
    return failFromWriteError(error, {
      fallback: 'Não consegui alterar a dívida. Tenta outra vez.',
    });
  }

  revalidatePatrimonioViews();

  return ok({ id: value.id });
}

/** Arquiva ou reativa uma dívida. */
export async function setLiabilityArchived(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = archivePatrimonySchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const value = parsed.data;
  const existing = await prisma.liability.findFirst({
    where: { id: value.id, userId: user.id },
    select: { id: true },
  });

  if (!existing) {
    return fail('Dívida não encontrada.');
  }

  await prisma.liability.update({
    where: { id: value.id },
    data: { archivedAt: value.archived ? new Date() : null },
  });

  revalidatePatrimonioViews();

  return ok({ id: value.id });
}
