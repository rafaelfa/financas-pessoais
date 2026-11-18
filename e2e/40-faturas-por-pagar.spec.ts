import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { lerCredenciais } from './support/dados';
import {
  apagarCartoesDoSpec,
  contarFaturasFechadasComValor,
  criarLancamentosDoSpec,
  limparDadosDoSpec,
} from './support/db';
import {
  abrirRota,
  escolherNoSelect,
  esperarAviso,
  formularioDeLancamentoRapido,
} from './support/ui';

/**
 * Percurso 40 — «Faturas por pagar» conta a dívida, não as linhas da cadeia (T60).
 *
 * O motor transita o que falta pagar para a fatura seguinte: duas faturas do
 * mesmo cartão com valor por pagar são **uma** dívida. O cartão da Revisão conta
 * só a última fatura de cada cartão; a base tem as duas (e uma terceira do
 * cartão B) — é essa diferença que a spec prende e que a mutação parte.
 */

const PREFIXO = 'T60 prova';

const email = (): string => lerCredenciais().email;

function cartaoDaRevisao(page: Page) {
  return page.locator('main ul li a').nth(3);
}

async function numeroDoCartao(page: Page): Promise<number> {
  return cartaoDaRevisao(page).evaluate((link) => {
    const grande = [...link.querySelectorAll('span')].find((s) => s.className.includes('text-3xl'));
    return grande ? Number(grande.textContent ?? '0') : 0;
  });
}

test.describe('faturas por pagar contam a cadeia uma vez (T60)', () => {
  test.afterAll(async () => {
    await limparDadosDoSpec(email(), PREFIXO);
    await apagarCartoesDoSpec(email(), PREFIXO);
  });

  test.beforeAll(async ({ browser }) => {
    const contexto = await browser.newContext({
      storageState: 'e2e/.auth/utilizador.json',
      locale: 'pt-PT',
    });
    const page = await contexto.newPage();

    const cartao = async (nome: string) => {
      await abrirRota(page, '/cartoes');
      await page
        .getByRole('button', { name: /Criar o primeiro cartão|Novo cartão/ })
        .first()
        .click();
      const d = page.getByRole('dialog');
      await d.getByLabel('Nome', { exact: true }).fill(nome);
      await d.getByLabel('Dia de fecho', { exact: true }).fill('5');
      await d.getByLabel('Dia de vencimento', { exact: true }).fill('12');
      await d.getByRole('button', { name: 'Criar cartão', exact: true }).click();
      await esperarAviso(page, 'Cartão criado.');
    };

    const comprar = async (nome: string, valor: string, data: string, descricao: string) => {
      await abrirRota(page, '/transacoes');
      const r = formularioDeLancamentoRapido(page);
      await r.getByRole('radio', { name: 'Gasto', exact: true }).click();
      await r.getByRole('radio', { name: 'Cartão de crédito', exact: true }).click();
      await r.getByLabel('Cartão', { exact: true }).click();
      await page.getByRole('option', { name: nome, exact: true }).first().click();
      await escolherNoSelect(r.getByLabel('Categoria', { exact: true }), 'Alimentação');
      await r.getByLabel('Valor', { exact: true }).fill(valor);
      await r.getByLabel('Data', { exact: true }).fill(data);
      await r.getByLabel('Descrição', { exact: true }).fill(descricao);
      await r.getByRole('button', { name: 'Lançar', exact: true }).click();
      await esperarAviso(page, 'Gasto registado.');
    };

    await cartao(`${PREFIXO} cartão A`);
    await comprar(`${PREFIXO} cartão A`, '60,00', '2026-09-15', `${PREFIXO} A setembro`);
    await comprar(`${PREFIXO} cartão A`, '45,00', '2026-10-15', `${PREFIXO} A outubro`);
    await cartao(`${PREFIXO} cartão B`);
    await comprar(`${PREFIXO} cartão B`, '70,00', '2026-08-15', `${PREFIXO} B agosto`);

    await contexto.close();
  });

  test('o cartão conta 2 e a base tem 3 faturas fechadas com valor', async ({ page }) => {
    await abrirRota(page, '/revisao');

    const noCartao = await numeroDoCartao(page);
    const naBase = await contarFaturasFechadasComValor(email());

    expect(naBase, 'a base tem as três linhas da cadeia').toBe(3);
    expect(noCartao, 'a Revisão conta a dívida (a última fatura de cada cartão)').toBe(2);
    expect(noCartao, 'e não as linhas da cadeia').toBeLessThan(naBase);

    /* O texto do cartão continua o mesmo. */
    await expect(cartaoDaRevisao(page)).toContainText('Faturas por pagar');
    await expect(cartaoDaRevisao(page)).toContainText('2 faturas por pagar');
  });

  test('pagar a fatura corrente desce a contagem', async ({ page }) => {
    await abrirRota(page, '/revisao');
    expect(await numeroDoCartao(page)).toBe(2);

    /* O cartão A é o primeiro em /cartoes; a fatura corrente dele é a de novembro. */
    await abrirRota(page, '/cartoes');
    await page.getByRole('button', { name: 'Pagar fatura', exact: true }).first().click();
    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();
    const conta = dialogo.getByLabel('Conta de pagamento', { exact: true });
    if ((await conta.count()) > 0) {
      await conta.click();
      await page.getByRole('option').first().click();
    }
    const data = dialogo.getByLabel('Data do pagamento', { exact: true });
    if ((await data.count()) > 0) {
      await data.fill(new Date().toISOString().slice(0, 10));
    }
    await dialogo.getByRole('button', { name: 'Pagar fatura', exact: true }).click();
    await page.waitForTimeout(1500);

    await abrirRota(page, '/revisao');
    expect(await numeroDoCartao(page), 'uma dívida paga, um cartão a menos').toBe(1);
  });

  test('axe 0 a 1280 e a 360, sem transbordo', async ({ page }) => {
    for (const largura of [1280, 360]) {
      await page.setViewportSize({ width: largura, height: largura === 360 ? 800 : 1000 });
      await abrirRota(page, '/revisao');

      const resultado = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();

      expect(
        resultado.violations.map((v) => `${largura}: ${v.id} (${v.nodes.length})`),
        `violações em /revisao a ${largura}`,
      ).toEqual([]);

      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(largura);
    }
  });
});
