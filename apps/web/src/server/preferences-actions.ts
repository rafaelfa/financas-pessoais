'use server';

import { prisma } from '@repo/db/client';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { fail, fromZodError, ok, type ActionResult } from './result';
import { requireUser } from './session';

/**
 * As duas preferências que o motor lê: início do mês financeiro e regime de
 * contabilização.
 *
 * `User.currency` **não** se toca — é EUR por decisão de produto (D1). O schema
 * aceita `monthStartDay` de 1 a 28 (um mês começa sempre num dia que existe em
 * todos os meses) e o regime em `CASH`/`ACCRUAL`.
 */
const preferencesSchema = z.object({
  monthStartDay: z
    .number({ error: 'Escolhe o dia em que o mês começa.' })
    .int({ error: 'O dia tem de ser um número inteiro.' })
    .min(1, { error: 'O mês começa entre o dia 1 e o dia 28.' })
    .max(28, { error: 'O mês começa entre o dia 1 e o dia 28.' }),
  accountingBasis: z.enum(['CASH', 'ACCRUAL'], {
    error: 'Escolhe caixa ou competência.',
  }),
});

export type PreferencesInput = z.input<typeof preferencesSchema>;

/** Grava as preferências do utilizador da sessão. */
export async function savePreferences(input: unknown): Promise<ActionResult<null>> {
  const user = await requireUser();
  const parsed = preferencesSchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        monthStartDay: parsed.data.monthStartDay,
        accountingBasis: parsed.data.accountingBasis,
      },
    });
  } catch {
    return fail('Não consegui guardar as preferências. Tenta outra vez.');
  }

  /*
   * O motor lê estas duas colunas no servidor: sem revalidar, o painel e os
   * totais continuariam com o período e o regime antigos até à próxima visita.
   */
  /*
   * Quem lê estas colunas: o painel e o património (`getDashboard`), o
   * orçamento e os relatórios. `/transacoes` não as lê — uma lista que inclui
   * quem não lê é a próxima a enganar alguém.
   */
  for (const rota of ['/', '/patrimonio', '/orcamento', '/relatorios', '/definicoes']) {
    revalidatePath(rota);
  }

  return ok(null);
}
