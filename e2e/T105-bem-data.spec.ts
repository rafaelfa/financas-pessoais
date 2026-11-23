import { createRequire } from 'node:module';
import { resolve } from 'node:path';

import { expect, test } from '@playwright/test';

import { lerCredenciais } from './support/dados';
import { databaseUrl } from './support/env';
import { limparDadosDoSpec } from './support/db';
import { abrirRota, esperarAviso } from './support/ui';

/**
 * Cliente `pg` local ao spec.
 *
 * O `withClient` do `e2e/support/db.ts` não é exportado e o T105 só me deixa
 * escrever `e2e/T105-*.spec.ts`: abro aqui o mesmo cliente, com a mesma
 * `DATABASE_URL` que a suite usa.
 */
const pg = createRequire(resolve(process.cwd(), 'packages', 'db', 'package.json'))('pg') as {
  Client: new (options: { connectionString: string }) => {
    connect: () => Promise<void>;
    end: () => Promise<void>;
    query: <T>(sql: string, values?: unknown[]) => Promise<{ rows: T[]; rowCount: number | null }>;
  };
};

async function comBase<T>(run: (query: ComBase) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: databaseUrl() });
  await client.connect();

  try {
    return await run(<R>(sql: string, values?: unknown[]) => client.query<R>(sql, values));
  } finally {
    await client.end();
  }
}

type ComBase = <T>(
  sql: string,
  values?: unknown[],
) => Promise<{ rows: T[]; rowCount: number | null }>;

/**
 * Percurso T105 — a data de aquisição de um bem nunca fica com o ano 1 (T105/B).
 *
 * O defeito medido em produção: no diálogo «Novo bem» o campo «Adquirido em»
 * gravava `0001-01-05` e o cartão do bem não mostra data, por isso ninguém via.
 * A guarda nova (`dataValida`) trata qualquer coisa fora de `AAAA-MM-DD` ou com
 * ano < 1900 como «sem data».
 *
 * O critério pede a **leitura do registo gravado**, não o ecrã: cada teste lê a
 * coluna `asset."acquiredOn"` na base dos e2e, que é o sítio onde o defeito vivia.
 * O terceiro teste cobre a outra metade — um bem que já tem `0001-01-05` na base
 * sai limpo quando for guardado pelo diálogo.
 */

const PREFIXO = 'T105 QA bem';

/** Lê a data de aquisição gravada (ISO ou null) de um bem do utilizador do spec. */
async function lerAcquiredOn(nome: string): Promise<string | null | undefined> {
  return comBase(async (query) => {
    const result = await query<{ acquiredOn: string | null }>(
      `SELECT to_char(a."acquiredOn", 'YYYY-MM-DD') AS "acquiredOn"
         FROM asset a
         JOIN "user" u ON u.id = a."userId"
        WHERE u.email = $1 AND a.name = $2`,
      [lerCredenciais().email, nome],
    );

    if (result.rowCount === 0) {
      return undefined;
    }

    return result.rows[0]?.acquiredOn ?? null;
  });
}

test.describe('T105 — a data de aquisição do bem', () => {
  test.afterAll(async () => {
    await limparDadosDoSpec(lerCredenciais().email, PREFIXO);
  });

  test('bem novo com a data vazia fica gravado sem data (null, nunca 0001-01-05)', async ({
    page,
  }) => {
    const nome = `${PREFIXO} vazio ${Date.now().toString(36)}`;

    await abrirRota(page, '/patrimonio');
    await page.getByRole('button', { name: 'Novo bem' }).click();

    const dialogo = page.getByRole('dialog');
    await dialogo.getByLabel('Nome', { exact: true }).fill(nome);
    await dialogo.getByLabel('Valor atual', { exact: true }).fill('250,00');

    /* O campo abre vazio — a asserção é do valor do input, não do ecrã pintado. */
    const campo = dialogo.getByLabel('Adquirido em', { exact: true });
    await expect(campo, 'o campo abre vazio').toHaveValue('');

    await dialogo.getByRole('button', { name: 'Registar bem' }).click();
    await esperarAviso(page, 'Bem registado.');

    const lido = await lerAcquiredOn(nome);

    expect(lido, 'o bem tem de existir na base').not.toBeUndefined();
    expect(lido, 'sem data no formulário, a coluna fica NULL — não 0001-01-05').toBeNull();
  });

  test('bem novo com data válida grava a data escolhida', async ({ page }) => {
    const nome = `${PREFIXO} data ${Date.now().toString(36)}`;

    await abrirRota(page, '/patrimonio');
    await page.getByRole('button', { name: 'Novo bem' }).click();

    const dialogo = page.getByRole('dialog');
    await dialogo.getByLabel('Nome', { exact: true }).fill(nome);
    await dialogo.getByLabel('Valor atual', { exact: true }).fill('300,00');
    await dialogo.locator('input[type="date"]').first().fill('2020-05-10');
    await dialogo.getByRole('button', { name: 'Registar bem' }).click();
    await esperarAviso(page, 'Bem registado.');

    expect(await lerAcquiredOn(nome), 'a data escolhida fica gravada').toBe('2020-05-10');
  });

  test('um bem que já tem 0001-01-05 na base fica NULL ao ser guardado (D38 §5)', async ({
    page,
  }) => {
    const nome = `${PREFIXO} lixo ${Date.now().toString(36)}`;

    /* Semeia o registo com o valor que a produção mostrou. */
    await comBase(async (query) => {
      await query(
        `INSERT INTO asset (id, "userId", type, name, "valueInCents", "acquiredOn", "updatedAt")
         SELECT $1, u.id, 'OTHER', $2, 10000, DATE '0001-01-05', now()
           FROM "user" u WHERE u.email = $3`,
        [`t105qa-${Date.now().toString(36)}`, nome, lerCredenciais().email],
      );
    });

    expect(await lerAcquiredOn(nome), 'o lixo entrou na base').toBe('0001-01-05');

    await abrirRota(page, '/patrimonio');
    await page.getByRole('button', { name: `Editar ${nome}` }).click();

    const dialogo = page.getByRole('dialog');
    await expect(dialogo.getByLabel('Nome', { exact: true })).toHaveValue(nome);
    /* A guarda ao abrir: o campo não traz o ano 1. */
    await expect(dialogo.getByLabel('Adquirido em', { exact: true })).toHaveValue('');

    /* Guardar sem tocar na data tem de limpar o registo. */
    await dialogo.getByRole('button', { name: 'Guardar alterações' }).click();
    await esperarAviso(page, 'Bem atualizado.');

    expect(await lerAcquiredOn(nome), 'guardar apaga o ano 1 da base').toBeNull();
  });
});
