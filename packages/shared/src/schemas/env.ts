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

  /** PostgreSQL connection string consumed by Prisma. */
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória.'),

  /** Secret used by NextAuth to sign and encrypt tokens. */
  NEXTAUTH_SECRET: z.string().min(32, 'NEXTAUTH_SECRET deve ter pelo menos 32 caracteres.'),

  /** Public base URL of the web app. */
  NEXTAUTH_URL: z.url('NEXTAUTH_URL deve ser uma URL válida.'),
});

/** Validated server environment. */
export type ServerEnv = z.infer<typeof serverEnvSchema>;

/** Node environment. */
export type NodeEnv = z.infer<typeof nodeEnvSchema>;
