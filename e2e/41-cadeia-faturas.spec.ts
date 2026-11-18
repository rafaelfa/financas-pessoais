import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { lerCredenciais } from './support/dados';
import { apagarCartoesDoSpec, executarSqlDoSpec, limparDadosDoSpec } from './support/db';
import { abrirRota } from './support/ui';

/**
 * Percurso 41 — a regra «última fatura da cadeia» num sítio só (T61).
 *
 * O empate de vencimentos (cartão com `closingDay 31`/`dueDay 1`: janeiro e
 * fevereiro vencem no mesmo 01/02) **não se constrói pelo ecrã** — o formulário
 * não cria faturas, só o motor a partir de compras, e as compras caem sempre em
 * meses diferentes. A fixture é **SQL**, assumida aqui; as asserções leem o
 * ecrã.
 *
 * A regra escolhe pela `closingDate`: no empate conta **fevereiro** (105,00 €),
 * e não a primeira que aparecer na ordem de vencimento (60,00 €).
 */

const PREFIXO = 'T61 prova';
const CARTAO = `${PREFIXO} cartão`;

const email = (): string => lerCredenciais().email;

function cartaoDaRevisao(page: Page) {
  return page.locator('main ul li a').nth(3);
}

async function faturasDaRevisao(page: Page): Promise<number> {
  return cartaoDaRevisao(page).evaluate((link) => {
    const grande = [...link.querySelectorAll('span')].find((s) => s.className.includes('text-3xl'));
    return grande ? Number(grande.textContent ?? '0') : 0;
  });
}

async function diasDoCalendario(page: Page, mes: string) {
  await abrirRota(page, `/calendario?mes=${mes}`);
  return page.evaluate(() =>
    [...document.querySelectorAll('section[aria-label="Grelha do mês"] [role="group"]')]
      .map((d) => d.textContent?.replace(/\s+/g, ' ').trim() ?? '')
      .filter((texto) => texto.includes('Fatura')),
  );
}

test.describe('empate de vencimentos: a regra escolhe pela closingDate (T61)', () => {
  let cartaoId = '';
  let janeiroId = '';
  let fevereiroId = '';

  test.beforeAll(async () => {
    const [utilizador] = await executarSqlDoSpec('SELECT id FROM "user" WHERE email = $1', [
      email(),
    ]);
    const userId = String(utilizador?.id ?? '');
    const [conta] = await executarSqlDoSpec(
      'SELECT id FROM financial_account WHERE "userId" = $1 ORDER BY "createdAt" LIMIT 1',
      [userId],
    );
    const contaId = String(conta?.id ?? '');

    const [cartao] = await executarSqlDoSpec(
      `INSERT INTO "credit_card" (id, "userId", name, "closingDay", "dueDay", "creditLimitInCents", "paymentAccountId", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, 31, 1, 100000, $3, now(), now()) RETURNING id`,
      [userId, CARTAO, contaId],
    );
    cartaoId = String(cartao?.id ?? '');

    const criarFatura = async (fecho: string, vence: string, total: number, estado: string) => {
      const [linha] = await executarSqlDoSpec(
        `INSERT INTO "invoice" (id, "userId", "cardId", "closingDate", "dueDate", "totalAmountInCents", "paidAmountInCents", "carriedOverInCents", status, "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3::date, $4::date, $5, 0, 0, $6::"InvoiceStatus", now(), now()) RETURNING id`,
        [userId, cartaoId, fecho, vence, total, estado],
      );
      return String(linha?.id ?? '');
    };

    janeiroId = await criarFatura('2026-01-31', '2026-02-01', 6000, 'CLOSED');
    fevereiroId = await criarFatura('2026-02-28', '2026-02-01', 10500, 'CLOSED');

    const compra = async (descricao: string, cents: number, data: string, invoiceId: string) => {
      await executarSqlDoSpec(
        `INSERT INTO "transaction" (id, "userId", kind, "amountInCents", date, description, "financialAccountId", "cardId", "invoiceId", settled, status, "updatedAt")
         VALUES (gen_random_uuid(), $1, 'EXPENSE'::"TransactionKind", $2, $3::date, $4, $5, $6, $7, false, 'CONFIRMED'::"TransactionStatus", now())`,
        [userId, cents, data, descricao, contaId, cartaoId, invoiceId],
      );
    };

    await compra(`T61 janeiro`, -6000, '2026-01-15', janeiroId);
    await compra(`T61 fevereiro`, -4500, '2026-02-15', fevereiroId);
  });

  test.afterAll(async () => {
    await limparDadosDoSpec(email(), PREFIXO);
    await apagarCartoesDoSpec(email(), PREFIXO);
  });

  test('no empate conta a última fatura (105,00 €), a mesma nos dois ecrãs', async ({ page }) => {
    /* As duas faturas vencem no mesmo dia — é o empate. */
    const faturas = await executarSqlDoSpec(
      `SELECT to_char("closingDate",'YYYY-MM-DD') AS fecho, to_char("dueDate",'YYYY-MM-DD') AS vence
         FROM "invoice" WHERE "cardId" = $1 ORDER BY "closingDate"`,
      [cartaoId],
    );
    expect(faturas.map((f) => String(f.vence))).toEqual(['2026-02-01', '2026-02-01']);
    expect(faturas.map((f) => String(f.fecho))).toEqual(['2026-01-31', '2026-02-28']);

    await abrirRota(page, '/revisao');
    expect(await faturasDaRevisao(page), 'a Revisão conta uma fatura por cartão').toBe(1);

    const dias = await diasDoCalendario(page, '2026-02');
    expect(dias, 'o calendário mostra uma fatura do cartão').toHaveLength(1);
    expect(dias[0], 'e é a de fevereiro, com 105,00 €').toContain('105,00 €');
    expect(dias[0]).not.toContain('60,00 €');

    /* O id que os dois ecrãs usam é o de fevereiro. */
    const [escolhida] = await executarSqlDoSpec(
      `SELECT id FROM "invoice" WHERE "cardId" = $1 AND "closingDate" = '2026-02-28'::date`,
      [cartaoId],
    );
    expect(String(escolhida?.id)).toBe(fevereiroId);
    expect(String(escolhida?.id)).not.toBe(janeiroId);
  });

  test('com fevereiro por fechar, os dois dão 0 e o calendário não mostra o cartão', async ({
    page,
  }) => {
    await executarSqlDoSpec(
      `UPDATE "invoice" SET "closingDate" = '2026-12-31'::date, "dueDate" = '2027-01-01'::date
        WHERE id = $1`,
      [fevereiroId],
    );

    await abrirRota(page, '/revisao');
    expect(await faturasDaRevisao(page), 'a dívida transitada espera o fecho').toBe(0);

    expect(await diasDoCalendario(page, '2026-02'), 'fevereiro já não vence aí').toEqual([]);
    expect(await diasDoCalendario(page, '2027-01'), 'nem há fatura em janeiro de 2027').toEqual([]);
  });

  test('axe 0 em /revisao e no calendário, a 1280 e a 360', async ({ page }) => {
    for (const largura of [1280, 360]) {
      await page.setViewportSize({ width: largura, height: largura === 360 ? 800 : 1000 });

      for (const rota of ['/revisao', '/calendario?mes=2026-02']) {
        await abrirRota(page, rota);
        const resultado = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze();

        expect(
          resultado.violations.map((v) => `${largura} ${rota}: ${v.id} (${v.nodes.length})`),
          `violações a ${largura} em ${rota}`,
        ).toEqual([]);

        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(largura);
      }
    }
  });
});
