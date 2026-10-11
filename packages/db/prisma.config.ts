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
    /*
     * O Prisma 7 deixou de ler o comando de seed do `package.json` e passou a
     * exigi-lo aqui. Sem esta linha, `prisma db seed` não sabe o que correr.
     */
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    /*
     * A ligação **direta**, não a agrupada. O Neon expõe duas URLs para a mesma
     * base: a `-pooler` serve a aplicação, mas um pooler em modo transação não
     * corre migrações (`prisma migrate` precisa de sessão e de um *advisory
     * lock*). A `DIRECT_URL` é a que o `.env.example` já documenta para este
     * fim; o `DATABASE_URL` fica a servir a aplicação.
     */
    url: env('DIRECT_URL'),
  },
});
