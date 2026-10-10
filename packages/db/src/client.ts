import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from './generated/prisma/client';

/**
 * Prisma 7 requires an explicit driver adapter — a bare `new PrismaClient()`
 * throws at construction time.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Copy `.env.example` to `.env` at the repository root before using @repo/db.',
    );
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

/**
 * Shared Prisma client singleton.
 *
 * Reused across hot reloads in development so Next.js does not open a new
 * connection pool on every recompile.
 */
export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export { PrismaClient };
export * from './generated/prisma/client';
