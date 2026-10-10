import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import type { NextConfig } from 'next';

/**
 * The workspace keeps a single canonical `.env` at the repository root, but
 * Next.js only auto-loads env files from the app directory (`apps/web`).
 * Loading the root file here makes it available to `next dev`, `next build`
 * and `next start` alike. A local `apps/web/.env` still works and takes effect
 * afterwards.
 */
const rootEnvFile = resolve(process.cwd(), '..', '..', '.env');

if (existsSync(rootEnvFile)) {
  process.loadEnvFile(rootEnvFile);
}

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Compile the internal workspace packages from TypeScript source instead of
  // treating them as pre-built runtime code. Turbopack already transpiles
  // workspace packages automatically, but being explicit keeps this correct if
  // the project is ever built with `--webpack`.
  transpilePackages: ['@repo/db', '@repo/shared'],
};

export default nextConfig;
