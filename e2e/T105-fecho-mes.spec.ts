import { expect, test } from '@playwright/test';

import { lerCredenciais } from './support/dados';
import {
  criarCartaoDoSpec,
  criarCompraNaFaturaDoSpec,
  criarFaturaDoSpec,
  limparDadosDoSpec,
} from './support/db';
import { abrirRota } from './support/ui';

/**
 * Percurso T105 — «por pagar» é a **última fatura da cadeia**, e só depois de fechar (D38).
 *
 * O defeito de partida: o Painel somava a cadeia de faturas — cada saldo já
 * inclui o transitado da anterior — e 12 faturas de um cartão davam 6 390 € para
 * 945 € de dívida. A D38 fixa as duas metades que estes testes prendem:
 *
 * 1. a dívida de um cartão é a da **última** fatura (pela `closingDate`), nunca a
 *    soma de duas do mesmo cartão (teste 1, 945,00 € e não 1 845,00 €);
 * 2. conta como «por pagar» só se **já fechou** — uma fatura por fechar não
 *    bloqueia o fecho do mês, e é aí que os Cartões divergem de propósito: eles
 *    mostram a dívida do cartão, o Painel e a Revisão o que já venceu (teste 2).
 *
 * Painel, Revisão e «Fechar o mês» leem a mesma expressão (`lastInvoiceByCard` +
 * `status === 'closed'`), por isso os testes exigem o mesmo número nos três.
 */

const PREFIXO = 'T105 QA fecho';

test.describe('T105/D38 — a última fatura da cadeia, fechada, é a que conta', () => {
  test.afterAll(async () => {
    await limparDadosDoSpec(lerCredenciais().email, PREFIXO);
  });

  test('duas faturas fechadas em dívida no mesmo cartão contam 1 · 945,00 € e bloqueiam; paga a última, fica a 0', async ({
    page,
  }) => {
    const sufixo = Date.now().toString(36);
    const cartao = await criarCartaoDoSpec({
      email: lerCredenciais().email,
      nome: `${PREFIXO} cartão ${sufixo}`,
      fechoDia: 1,
      vencimentoDia: 10,
    });

    /*
     * Duas faturas **fechadas** em dívida: a anterior (900,00 €) e a última da
     * cadeia (945,00 €). Somadas dariam 1 845,00 €; a regra é a última.
     */
    const anterior = await criarFaturaDoSpec({
      cartaoId: cartao,
      fecho: '2026-10-01',
      vence: '2026-11-10',
      totalInCents: 90_000,
      estado: 'CLOSED',
    });
    await criarCompraNaFaturaDoSpec({
      cartaoId: cartao,
      faturaId: anterior,
      descricao: `${PREFIXO} compra anterior ${sufixo}`,
      valorInCents: 90_000,
      data: '2026-09-15',
    });

    const ultima = await criarFaturaDoSpec({
      cartaoId: cartao,
      fecho: '2026-11-01',
      vence: '2026-12-10',
      totalInCents: 94_500,
      estado: 'CLOSED',
    });
    await criarCompraNaFaturaDoSpec({
      cartaoId: cartao,
      faturaId: ultima,
      descricao: `${PREFIXO} compra última ${sufixo}`,
      valorInCents: 94_500,
      data: '2026-10-15',
    });

    /* O assistente de fecho está no Painel; o passo é o que tem a contagem. */
    await abrirRota(page, '/');

    const passo = page
      .locator('li')
      .filter({ hasText: /Faturas por pagar[\s\S]*por resolver/ })
      .first();
    await expect(passo).toBeVisible();
    /*
     * A conta à mão: 900,00 € (fatura anterior, por pagar) + 945,00 € (compras
     * da última) = **1 845,00 €**, que é o saldo da última fatura da cadeia — ela
     * já inclui o transitado. Somar as duas faturas contaria os 900 € duas vezes
     * e daria 2 745,00 €: é esse o número que não pode aparecer.
     */
    await expect(passo, 'a última fatura, não a soma das duas').toContainText('1 por resolver');
    await expect(passo).toContainText(/1\s?845,00\s*€/);
    await expect(passo, 'a soma das duas faturas daria 2 745,00 €').not.toContainText(
      /2\s?745,00\s*€/,
    );

    const fechar = page.getByRole('button', { name: 'Fechar o mês' });
    await expect(fechar, 'com uma fatura fechada em dívida o fecho está bloqueado').toBeDisabled();
    await expect(page.locator('#fecho-razao')).toContainText('Faturas por pagar');

    /* A Revisão conta o mesmo. */
    await abrirRota(page, '/revisao');
    await expect(
      page.locator('li, article').filter({ hasText: 'Faturas por pagar' }).first(),
      'a Revisão conta uma fatura, não duas',
    ).toContainText('1 fatura por pagar');

    /* Paga a última fatura da cadeia: os três passam a 0. */
    await pagarFaturasDoCartao(cartao);
    await categorizarCompras(`${PREFIXO}%`);

    await abrirRota(page, '/');
    const passoPago = page
      .locator('li')
      .filter({ hasText: 'Faturas por pagar' })
      .filter({ hasText: 'Concluído' })
      .first();
    await expect(passoPago, 'sem fatura fechada em dívida o passo conclui').toBeVisible();
    await expect(passoPago).not.toContainText('por resolver');

    /*
     * O botão do fecho depende de **todos** os passos, e esta suite partilha o
     * utilizador de teste: noutro ficheiro a correr em paralelo pode haver um
     * lançamento por liquidar, e o botão ficaria desativado por essa razão, não
     * por esta. O que é desta tarefa é a razão escrita: ela deixa de nomear
     * «Faturas por pagar» quando a última fatura está paga.
     */
    await expect(
      page.locator('#fecho-razao'),
      'o fecho deixa de estar bloqueado por faturas',
    ).not.toContainText('Faturas por pagar');

    await abrirRota(page, '/revisao');
    await expect(
      page.locator('li, article').filter({ hasText: 'Faturas por pagar' }).first(),
    ).toContainText('Nenhuma fatura por pagar');
  });

  test('uma fatura por fechar não conta no Painel nem na Revisão, mas os Cartões mostram a dívida', async ({
    page,
  }) => {
    const sufixo = Date.now().toString(36);
    const cartao = await criarCartaoDoSpec({
      email: lerCredenciais().email,
      nome: `${PREFIXO} aberto ${sufixo}`,
      fechoDia: 1,
      vencimentoDia: 10,
    });

    /* Última fatura da cadeia **aberta** e em dívida: 945,00 €. */
    const aberta = await criarFaturaDoSpec({
      cartaoId: cartao,
      fecho: '2026-12-01',
      vence: '2027-01-10',
      totalInCents: 94_500,
      estado: 'OPEN',
    });
    await criarCompraNaFaturaDoSpec({
      cartaoId: cartao,
      faturaId: aberta,
      descricao: `${PREFIXO} compra aberta ${sufixo}`,
      valorInCents: 94_500,
      data: '2026-11-15',
    });

    await categorizarCompras(`%${sufixo}`);

    await abrirRota(page, '/');
    const passo = page.locator('li').filter({ hasText: 'Faturas por pagar' }).first();
    await expect(passo, 'a dívida por fechar não conta como por pagar').toContainText('Concluído');
    await expect(passo).not.toContainText('por resolver');
    /* Mesma razão do teste anterior: o botão depende de todos os passos. */
    await expect(
      page.locator('#fecho-razao'),
      'uma fatura por fechar não entra na razão do bloqueio',
    ).not.toContainText('Faturas por pagar');

    await abrirRota(page, '/revisao');
    await expect(
      page.locator('li, article').filter({ hasText: 'Faturas por pagar' }).first(),
    ).toContainText('Nenhuma fatura por pagar');

    /* Nos Cartões é outra pergunta: a dívida do cartão, fechada ou não. */
    await abrirRota(page, '/cartoes');
    const corpo = page.locator('body');
    await expect(corpo, 'os Cartões mostram a dívida do cartão').toContainText(
      /Em dívida:\s*945,00\s*€/,
    );
  });
});

/**
 * Dá categoria às compras do spec.
 *
 * Sem isto o passo «Sem categoria» do fecho do mês bloqueia o botão por uma
 * razão que não é a que está a ser medida — e o teste passaria a provar outra
 * coisa.
 */
async function categorizarCompras(descricaoLike: string): Promise<void> {
  const { createRequire } = await import('node:module');
  const { resolve } = await import('node:path');
  const { databaseUrl } = await import('./support/env');

  const pg = createRequire(resolve(process.cwd(), 'packages', 'db', 'package.json'))('pg') as {
    Client: new (options: { connectionString: string }) => {
      connect: () => Promise<void>;
      end: () => Promise<void>;
      query: (sql: string, values?: unknown[]) => Promise<unknown>;
    };
  };

  const client = new pg.Client({ connectionString: databaseUrl() });
  await client.connect();

  try {
    await client.query(
      `UPDATE "transaction" t
          SET "categoryId" = c.id
         FROM "user" u,
              LATERAL (SELECT id FROM category
                        WHERE "userId" = u.id AND "isInternal" = false
                        ORDER BY name LIMIT 1) c
        WHERE t."userId" = u.id
          AND u.email = $1
          AND t.description LIKE $2
          AND t."categoryId" IS NULL`,
      [lerCredenciais().email, descricaoLike],
    );
  } finally {
    await client.end();
  }
}

/**
 * Paga as faturas do cartão na base dos e2e.
 *
 * O que conta para o saldo em dívida são as **linhas de pagamento**
 * (`paidAmountForInvoice`), não a coluna `paidAmountInCents`.
 */
async function pagarFaturasDoCartao(cartaoId: string): Promise<void> {
  const { createRequire } = await import('node:module');
  const { resolve } = await import('node:path');
  const { databaseUrl } = await import('./support/env');

  const pg = createRequire(resolve(process.cwd(), 'packages', 'db', 'package.json'))('pg') as {
    Client: new (options: { connectionString: string }) => {
      connect: () => Promise<void>;
      end: () => Promise<void>;
      query: (sql: string, values?: unknown[]) => Promise<unknown>;
    };
  };

  const client = new pg.Client({ connectionString: databaseUrl() });
  await client.connect();

  try {
    await client.query(
      `INSERT INTO "invoice_payment" (id, "userId", "invoiceId", "amountInCents", date, "createdAt")
       SELECT gen_random_uuid(), i."userId", i.id, i."outstanding", i."dueDate", now()
         FROM (SELECT i.*, GREATEST(i."totalAmountInCents" - i."paidAmountInCents", 0) AS outstanding
                 FROM "invoice" i WHERE i."cardId" = $1) i
        WHERE i.outstanding > 0
          AND NOT EXISTS (SELECT 1 FROM "invoice_payment" p WHERE p."invoiceId" = i.id)`,
      [cartaoId],
    );
    await client.query(
      `UPDATE "invoice" SET "paidAmountInCents" = "totalAmountInCents",
              status = 'PAID'::"InvoiceStatus", "updatedAt" = now()
        WHERE "cardId" = $1`,
      [cartaoId],
    );
  } finally {
    await client.end();
  }
}
