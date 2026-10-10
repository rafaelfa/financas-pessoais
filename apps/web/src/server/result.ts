import type { ZodError } from 'zod';

/**
 * Resultado de uma ação de servidor.
 *
 * As ações nunca lançam para a interface: devolvem sempre um resultado
 * discriminado. Sem isto, um erro de validação chegava ao utilizador como um
 * ecrã de erro do Next em vez de uma mensagem junto ao campo.
 */
export type ActionResult<T = undefined> =
  | { readonly ok: true; readonly data: T }
  | {
      readonly ok: false;
      readonly error: string;
      readonly fieldErrors?: Record<string, string[]>;
    };

/** Ação concluída com sucesso. */
export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

/** Ação falhada, com uma mensagem para o utilizador. */
export function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return fieldErrors === undefined ? { ok: false, error } : { ok: false, error, fieldErrors };
}

/** Converte os problemas de um schema Zod em erros por campo. */
export function toFieldErrors(error: ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const field = issue.path.length > 0 ? String(issue.path[0]) : '_form';
    fieldErrors[field] = [...(fieldErrors[field] ?? []), issue.message];
  }

  return fieldErrors;
}

/**
 * Falha de validação, com a primeira mensagem como resumo.
 *
 * O formulário mostra os erros por campo; o resumo serve para o `toast`, que
 * precisa de uma frase só.
 */
export function fromZodError(error: ZodError): ActionResult<never> {
  const fieldErrors = toFieldErrors(error);
  const first = error.issues[0]?.message ?? 'Há dados inválidos no formulário.';

  return fail(first, fieldErrors);
}
