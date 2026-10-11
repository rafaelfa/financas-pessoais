import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * O `.env` da raiz, lido à mão.
 *
 * O Next carrega-o sozinho (`apps/web/next.config.ts`), mas os testes também
 * precisam dele fora do servidor: para apagar os utilizadores de teste no fim.
 * Ler oito linhas evita uma dependência nova na raiz só para isto — e o
 * `dotenv` já existe, mas vive em `packages/db`, fora do alcance dos specs.
 */

let loaded = false;

/** Remove as aspas que o `.env` usa à volta dos valores. */
function unquote(value: string): string {
  const trimmed = value.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

/** Carrega `«raiz»/.env` sem sobrepor variáveis já definidas no processo. */
export function loadRootEnv(): void {
  if (loaded) {
    return;
  }

  loaded = true;

  const path = resolve(process.cwd(), '.env');

  if (!existsSync(path)) {
    return;
  }

  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);

    if (match === null) {
      continue;
    }

    const [, key, rawValue] = match;

    if (key === undefined || rawValue === undefined || process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = unquote(rawValue);
  }
}

/** A ligação à base de dados do `.env`, ou um erro explícito se faltar. */
export function databaseUrl(): string {
  loadRootEnv();

  const url = process.env.DATABASE_URL;

  if (url === undefined || url === '') {
    throw new Error(
      'DATABASE_URL não está definido: copia o .env.example para .env na raiz antes de correr os e2e.',
    );
  }

  return url;
}
