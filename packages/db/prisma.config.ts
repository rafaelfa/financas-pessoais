import { config as loadEnv } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

/**
 * Prisma 7 configuration.
 *
 * Prisma 7 no longer auto-loads `.env` files and no longer accepts
 * `datasource.url` inside `schema.prisma`, so the connection string is
 * resolved here from `process.env`.
 *
 * The workspace keeps a single canonical `.env` at the repository root.
 * `dotenv` is given both candidate locations so the CLI works whether it is
 * invoked from `packages/db` (the normal case, via `pnpm --filter @repo/db`)
 * or from the repository root.
 */
loadEnv({
  path: ['.env', '../../.env'],
  quiet: true,
});

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
