import { serverEnvSchema, type ServerEnv } from '@repo/shared';

/**
 * Validated server-side environment.
 *
 * The workspace keeps a single `.env` at the repository root; it is loaded by
 * `next.config.ts` before this module is evaluated. Validation runs once at
 * module load so a misconfigured environment fails fast with a precise message
 * instead of throwing somewhere deep inside a request handler.
 */
const parsed = serverEnvSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(raiz)'}: ${issue.message}`)
    .join('\n');

  throw new Error(
    `Variáveis de ambiente inválidas ou ausentes:\n${issues}\n\n` +
      'Copie `.env.example` para `.env` na raiz do repositório e preencha os valores.',
  );
}

export const env: ServerEnv = parsed.data;
