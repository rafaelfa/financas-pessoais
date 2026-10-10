import { z } from 'zod';

/**
 * Environment contract shared by every server-side app in the workspace.
 *
 * Declaring it here keeps a single definition of what a valid environment looks
 * like, so a future second app reuses it instead of drifting.
 */

/** Runtime mode the app is executing in. */
export const nodeEnvSchema = z.enum(['development', 'test', 'production']);

/** Server-side environment variables. */
export const serverEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema.default('development'),

  /**
   * PostgreSQL connection string consumed by Prisma. On Neon this is the
   * **pooled** connection, which is what the application and Vercel should use.
   */
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória.'),

  /**
   * Direct (non-pooled) connection string, used **only** by migrations — a
   * connection pooler cannot run `prisma migrate`. Optional because the local
   * Docker database has no pooler and `DATABASE_URL` serves both purposes.
   */
  DIRECT_URL: z.string().min(1).optional(),

  /** Secret used by better-auth to sign and encrypt session cookies. */
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET deve ter pelo menos 32 caracteres.'),

  /** Public base URL of the web app; better-auth uses it to build callbacks. */
  BETTER_AUTH_URL: z.url('BETTER_AUTH_URL deve ser uma URL válida.'),
});

/** Validated server environment. */
export type ServerEnv = z.infer<typeof serverEnvSchema>;

/** Node environment. */
export type NodeEnv = z.infer<typeof nodeEnvSchema>;
