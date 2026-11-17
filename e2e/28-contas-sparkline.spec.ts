import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * Percurso 28 — sparkline do saldo em `/contas` (T47).
 *
 * O essencial: cada cartão de conta tem **uma** linha de 30 pontos, com o mesmo
 * tamanho em todos, e a linha não desaparece quando a máscara de privacidade
 * está ligada (a máscara é do texto, não da forma).
 */

/** Os cartões de conta: os únicos que têm sparkline. */
function cartoesComSparkline(page: Page): Locator {
  return page.locator('[data-slot="card"]').filter({ has: page.locator('[data-sparkline]') });
}

/** Os pontos de uma polilinha, já separados. */
async function pontosDoCartao(cartao: Locator): Promise<readonly string[]> {
  const pontos = await cartao.locator('[data-sparkline] polyline').getAttribute('points');

  return (pontos ?? '').trim().split(/\s+/).filter(Boolean);
}

test.describe('sparkline das contas', () => {
  test('30 pontos por conta, um só tamanho, e a linha sobrevive à máscara', async ({ page }) => {
    await page.goto('/contas');
    await expect(page.getByRole('heading', { level: 1, name: 'Contas' })).toBeVisible();

    const cartoes = cartoesComSparkline(page);
    const total = await cartoes.count();
    expect(total, 'sem contas não há sparkline para provar').toBeGreaterThan(0);

    const alturas = new Set<number>();
    const larguras = new Set<number>();

    for (let indice = 0; indice < total; indice += 1) {
      const cartao = cartoes.nth(indice);
      const svg = cartao.locator('[data-sparkline]');

      await expect(svg).toHaveAttribute('data-points', '30');
      await expect(svg).toHaveAttribute('aria-hidden', 'true');
      expect((await pontosDoCartao(cartao)).length, `cartão ${indice} sem 30 pontos`).toBe(30);
      await expect(cartao.locator('.sr-only')).toHaveText(
        'Tendência do saldo nos últimos 30 dias.',
      );

      const caixa = await svg.boundingBox();
      expect(caixa).not.toBeNull();
      if (caixa) {
        alturas.add(Math.round(caixa.height));
        larguras.add(Math.round(caixa.width));
      }
    }

    /* Todos os cartões da mesma coluna têm a mesma altura desenhada. */
    expect([...alturas], 'a sparkline não tem uma só altura').toHaveLength(1);
    expect([...larguras], 'a sparkline não tem uma só largura').toHaveLength(1);

    /* Com a máscara ligada, nenhum valor visível e a forma no sítio. */
    await page.getByRole('button', { name: 'Ocultar montantes' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-privacidade', 'ativa');
    await expect(page.locator('[data-amount="visivel"]')).toHaveCount(0);
    await expect(cartoesComSparkline(page)).toHaveCount(total);

    for (let indice = 0; indice < total; indice += 1) {
      expect((await pontosDoCartao(cartoesComSparkline(page).nth(indice))).length).toBe(30);
    }

    await page.getByRole('button', { name: 'Mostrar montantes' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-privacidade', 'inativa');
  });

  test('a 360 px a página não ganha scroll horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/contas');
    await expect(page.getByRole('heading', { level: 1, name: 'Contas' })).toBeVisible();
    await expect(cartoesComSparkline(page).first()).toBeVisible();

    const medidas = await page.evaluate(() => ({
      documento: document.documentElement.scrollWidth,
      janela: window.innerWidth,
    }));
    expect(medidas.documento).toBeLessThanOrEqual(medidas.janela + 1);
  });
});
