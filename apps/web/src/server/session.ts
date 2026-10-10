import { prisma } from '@repo/db/client';
import type { AccountingBasis } from '@repo/shared';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';

import { toAccountingBasis } from './mapping';

/**
 * Utilizador da sessão.
 *
 * Todas as consultas e ações do servidor passam por aqui: é o único sítio onde
 * se decide quem está a pedir, e por isso é o único sítio onde o isolamento
 * entre contas pode ser garantido. Nenhuma consulta deve receber um `userId`
 * vindo do cliente.
 */
export interface SessionUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly monthStartDay: number;
  readonly accountingBasis: AccountingBasis;
  /** Conta marcada como principal, ou `null` se ainda não houver nenhuma. */
  readonly primaryAccountId: string | null;
}

/** Devolve o utilizador da sessão, ou `null` se não houver sessão válida. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return null;
  }

  // Ler o utilizador da base de dados, e não da sessão, para trazer as
  // preferências (início do mês e regime) e confirmar que a conta ainda existe.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      monthStartDay: true,
      accountingBasis: true,
      primaryAccountId: true,
    },
  });

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    monthStartDay: user.monthStartDay,
    accountingBasis: toAccountingBasis(user.accountingBasis),
    primaryAccountId: user.primaryAccountId,
  };
}

/**
 * Exige uma sessão. Sem sessão, redireciona para a página de entrada.
 *
 * `redirect` lança uma exceção de controlo de fluxo — nunca deve ser apanhada
 * por um `try/catch` nas páginas.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();

  if (!user) {
    redirect('/entrar');
  }

  return user;
}
