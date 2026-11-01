import type { FieldError, FieldErrors, FieldValues, Resolver } from 'react-hook-form';
import type { z } from 'zod';

/**
 * Adaptador entre o Zod e o React Hook Form.
 *
 * O `@hookform/resolvers` 3.3.0 lê `error.errors`, que o Zod 4 já não expõe
 * (passou a `error.issues`): perante um formulário inválido rejeitava a promessa
 * e o React Hook Form ficava sem `errors`, ou seja, sem mensagem nenhuma junto
 * ao campo. `safeParse` do próprio Zod chega, e é uma dependência a menos.
 */
export function zodResolver<TFieldValues extends FieldValues>(
  schema: z.ZodType<TFieldValues>,
): Resolver<TFieldValues> {
  return async (values) => {
    const parsed = schema.safeParse(values);

    if (parsed.success) {
      return { values: parsed.data, errors: {} };
    }

    const errors: Record<string, FieldError> = {};

    for (const issue of parsed.error.issues) {
      const field = issue.path.join('.') || 'root';

      // O primeiro problema de um campo é o que o utilizador vê; os seguintes não o tapam.
      errors[field] ??= { type: String(issue.code), message: issue.message };
    }

    /*
     * `FieldErrors` é um tipo mapeado sobre as chaves do formulário: um saco de
     * erros construído a partir de caminhos do Zod não pode ser provado contra
     * ele. A forma de cada valor é `FieldError`, que é o que o React Hook Form lê.
     */
    return { values: {}, errors: errors as FieldErrors<TFieldValues> };
  };
}
