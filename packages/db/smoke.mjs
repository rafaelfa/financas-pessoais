/**
 * Teste de fumo autenticado da aplicação.
 *
 * Vive aqui, e não na raiz, por uma razão prática: precisa do `pg` para apagar o
 * utilizador de teste no fim, e é neste pacote que ele está instalado.
 *
 * **Porque é que isto existe.** O `pnpm build` compila as páginas mas não as
 * executa com sessão. Um erro que só acontece em execução — como importar uma
 * constante de um módulo `'use client'` num Server Component, que fez
 * `/transacoes` devolver 500 em produção durante uma fase inteira — passa por um
 * gate de `lint` + `typecheck` + `test` + `build` sem que nada se queixe. Este
 * teste cria um utilizador a sério, entra, pede todas as páginas e falha se
 * alguma responder com erro de servidor.
 *
 * Uso:
 *   node packages/db/smoke.mjs http://localhost:3000
 *   node packages/db/smoke.mjs https://financas-pessoais-psi-lac.vercel.app
 *
 * Deixa sempre a base como a encontrou: o utilizador de teste é apagado no fim,
 * mesmo que uma verificação falhe.
 */
import { fileURLToPath } from 'node:url';

import { config as loadEnv } from 'dotenv';
import pg from 'pg';

loadEnv({ path: [fileURLToPath(new URL('../../.env', import.meta.url)), '.env'], quiet: true });

const target = (process.argv[2] ?? process.env.SMOKE_URL ?? 'http://localhost:3000').replace(
  /\/$/,
  '',
);

/** Todas as páginas autenticadas da aplicação. */
const ROUTES = [
  '/',
  '/transacoes',
  '/contas',
  '/categorias',
  '/cartoes',
  '/orcamento',
  '/objetivos',
  '/relatorios',
  '/importar',
  '/regras',
  '/recorrencias',
  '/definicoes',
];

const PREFIX = 'smoke-';
const email = `${PREFIX}${Date.now().toString(36)}@exemplo.pt`;
const password = 'palavra-de-fumo-para-teste-123';
const EXPECTED_CATEGORIES = 29;

let failures = 0;

function pass(message) {
  console.log(`  ok    ${message}`);
}

function fail(message) {
  failures += 1;
  console.log(`  FALHA ${message}`);
}

async function deleteTestUsers() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

  try {
    await client.connect();
    const result = await client.query('DELETE FROM "user" WHERE email LIKE $1', [`${PREFIX}%`]);
    console.log(`\nlimpeza: ${result.rowCount} utilizador(es) de fumo apagado(s)`);
  } catch (error) {
    console.log(`\nlimpeza falhou (apaga à mão os utilizadores ${PREFIX}*): ${error.message}`);
    failures += 1;
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function main() {
  console.log(`teste de fumo contra ${target}\n`);

  const signUp = await fetch(`${target}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: target },
    body: JSON.stringify({ email, password, name: 'Teste de fumo' }),
  });

  if (!signUp.ok) {
    fail(`o registo devolveu ${signUp.status}`);
    return;
  }

  pass(`registo de ${email}`);

  // O registo não cria sessão de propósito (autoSignIn desligado): entrar é um
  // passo explícito, e é por isso que aqui também o é.
  const signIn = await fetch(`${target}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: target },
    body: JSON.stringify({ email, password }),
  });

  if (!signIn.ok) {
    fail(`a entrada devolveu ${signIn.status}`);
    return;
  }

  const cookie = signIn.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');

  if (cookie === '') {
    fail('a entrada não devolveu cookie de sessão');
    return;
  }

  pass('entrada com cookie de sessão');

  console.log('\npáginas autenticadas:');

  for (const route of ROUTES) {
    const startedAt = Date.now();

    try {
      const response = await fetch(`${target}${route}`, {
        headers: { cookie },
        redirect: 'manual',
      });
      const ms = Date.now() - startedAt;

      if (response.status >= 500) {
        fail(`${route} devolveu ${response.status} (${ms} ms)`);
      } else {
        pass(`${route} → ${response.status} (${ms} ms)`);
      }
    } catch (error) {
      fail(`${route} rebentou: ${error.message}`);
    }
  }

  console.log('\nsem sessão:');

  const anonymous = await fetch(`${target}/transacoes`, { redirect: 'manual' });

  if (anonymous.status === 307 || anonymous.status === 302 || anonymous.status === 303) {
    pass(`/transacoes → ${anonymous.status} para ${anonymous.headers.get('location') ?? '?'}`);
  } else {
    fail(`/transacoes sem sessão devolveu ${anonymous.status} (esperava um redirecionamento)`);
  }

  console.log('\naprovisionamento do utilizador novo:');

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

  try {
    await client.connect();

    const user = await client.query('SELECT id FROM "user" WHERE email = $1', [email]);
    const userId = user.rows[0]?.id;

    if (userId === undefined) {
      fail('o utilizador de teste não existe na base de dados');
    } else {
      const categories = await client.query(
        'SELECT count(*)::int AS total FROM category WHERE "userId" = $1',
        [userId],
      );
      const accounts = await client.query(
        'SELECT count(*)::int AS total FROM financial_account WHERE "userId" = $1',
        [userId],
      );
      const total = categories.rows[0]?.total ?? 0;

      if (total === EXPECTED_CATEGORIES) {
        pass(`${total} categorias`);
      } else {
        fail(`${total} categorias (esperava ${EXPECTED_CATEGORIES})`);
      }

      if ((accounts.rows[0]?.total ?? 0) >= 1) {
        pass(`${accounts.rows[0].total} conta(s)`);
      } else {
        fail('nenhuma conta criada no registo');
      }
    }
  } catch (error) {
    fail(`consulta à base de dados falhou: ${error.message}`);
  } finally {
    await client.end().catch(() => undefined);
  }
}

try {
  await main();
} catch (error) {
  fail(`erro inesperado: ${error?.message ?? error}`);
} finally {
  await deleteTestUsers();
}

if (failures > 0) {
  console.log(`\n${failures} verificação(ões) falharam.`);
  process.exitCode = 1;
} else {
  console.log('\nTodas as verificações passaram.');
}
