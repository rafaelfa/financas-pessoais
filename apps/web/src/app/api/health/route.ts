import { NextResponse } from 'next/server';

import { prisma } from '@repo/db';
import { healthCheckSchema, type HealthCheck } from '@repo/shared';

import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

/** `SELECT 1` probe so the endpoint reports connectivity, not just config. */
async function isDatabaseReachable(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

/**
 * `GET /api/health`
 *
 * Setup smoke test: proves `@repo/web` can consume both `@repo/shared`
 * (validation + inferred types) and `@repo/db` (Prisma client + adapter).
 */
export async function GET() {
  const databaseReachable = await isDatabaseReachable();

  const payload: HealthCheck = healthCheckSchema.parse({
    status: databaseReachable ? 'ok' : 'degraded',
    service: '@repo/web',
    version: '0.0.0',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    uptimeInSeconds: Math.round(process.uptime()),
    dependencies: {
      database: {
        provider: 'postgresql',
        configured: Boolean(env.DATABASE_URL),
        reachable: databaseReachable,
      },
    },
  });

  return NextResponse.json(payload, { status: databaseReachable ? 200 : 503 });
}
