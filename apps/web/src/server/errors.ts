import { Prisma } from '@repo/db/client';

import { fail, type ActionResult } from './result';

/**
 * Erros de escrita.
 *
 * As ações verificam duplicados antes de escrever, mas entre a verificação e a
 * escrita há uma janela real: um duplo clique, um pedido repetido, duas
 * máquinas a correr ao mesmo tempo. Nessa janela quem decide é a base de dados,
 * com uma violação de restrição única — e isso tem de chegar ao utilizador como
 * uma mensagem, não como um erro 500.
 */

const UNIQUE_VIOLATION = 'P2002';

/** `true` quando o erro é uma violação de restrição única do Prisma. */
export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION;
}

/**
 * Traduz um erro de escrita num resultado para o formulário.
 *
 * Erros inesperados são registados no servidor e resumidos ao utilizador: o
 * utilizador não tem de ler uma mensagem do Prisma, e nós não queremos perder
 * o rasto do que aconteceu.
 */
export function failFromWriteError(
  error: unknown,
  options: { readonly fallback: string; readonly unique?: string },
): ActionResult<never> {
  if (isUniqueViolation(error)) {
    return fail(options.unique ?? 'Já existe um registo igual.');
  }

  console.error('[escrita] erro inesperado:', error);

  return fail(options.fallback);
}
