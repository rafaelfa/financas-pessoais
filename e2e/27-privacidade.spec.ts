import { expect, test, type Page } from '@playwright/test';

import { formularioDeLancamentoRapido, lancarGasto } from './support/ui';

/**
 * Percurso 27 — modo privacidade (T46).
 *
 * O essencial, sem repetir a medição manual do relatório: ligar a máscara
 * troca **todos** os montantes por `••••` sem mudar a altura da página,
 * recarregar mantém a preferência, o atalho faz o mesmo que o botão e não
 * dispara a escrever num campo.
 *
 * A preferência vive em cookie e `localStorage`, por isso o estado tem de
 * ficar desligado no fim: o contexto de cada spec é próprio, mas o teste
 * termina no estado em que começou para não depender da ordem.
 */

/** Texto do botão do cabeçalho, que diz sempre a ação que vai fazer. */
function botaoDaMascara(page: Page) {
  return page.getByRole('button', { name: /Ocultar montantes|Mostrar montantes/ });
}

async function contarMontantes(page: Page) {
  return page.evaluate(() => {
    const todos = [...document.querySelectorAll('[data-amount]')];

    return {
      total: todos.length,
      visiveis: todos.filter((element) => element.getAttribute('data-amount') === 'visivel').length,
      ocultos: todos.filter((element) => element.getAttribute('data-amount') === 'oculto').length,
      /* A máscara tem o texto do leitor de ecrã («montante oculto») ao lado: conta só o visível. */
      textos: todos.map((element) =>
        (
          element.querySelector('[aria-hidden="true"]')?.textContent ??
          element.textContent ??
          ''
        ).trim(),
      ),
    };
  });
}

test.describe('modo privacidade', () => {
  test('mascara os montantes, sobrevive ao F5 e o atalho faz o mesmo que o botão', async ({
    page,
    context,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Painel' })).toBeVisible();

    /*
     * O utilizador partilhado pode não ter lançamentos quando este percurso
     * corre (o das transações vem depois). Sem um montante no ecrã o teste
     * mediria zero e passaria por engano.
     */
    if ((await contarMontantes(page)).total === 0) {
      await page.goto('/transacoes');
      await expect(formularioDeLancamentoRapido(page)).toBeVisible();
      const etiqueta = `E2E T46 ${Date.now().toString(36)}`;
      await lancarGasto(page, { valor: '12,34', descricao: etiqueta, categoria: 'Alimentação' });
      await page.goto('/');
    }

    await expect(page.locator('html')).toHaveAttribute('data-privacidade', 'inativa');
    await expect(botaoDaMascara(page)).toHaveAttribute('aria-pressed', 'false');

    const antes = await contarMontantes(page);
    expect(antes.total, 'sem montantes no Painel não há máscara para provar').toBeGreaterThan(0);
    expect(antes.visiveis).toBe(antes.total);
    expect(antes.ocultos).toBe(0);

    const alturaAntes = await page.evaluate(() => document.body.scrollHeight);

    await botaoDaMascara(page).click();

    await expect(page.locator('html')).toHaveAttribute('data-privacidade', 'ativa');
    await expect(botaoDaMascara(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(botaoDaMascara(page)).toHaveAccessibleName('Mostrar montantes');

    const depois = await contarMontantes(page);
    expect(depois.total).toBe(antes.total);
    expect(depois.ocultos, 'todos os montantes têm de ficar mascarados').toBe(antes.total);
    expect(depois.visiveis).toBe(0);

    /* A máscara tem o mesmo número de caracteres: é isso que impede o salto. */
    for (const [indice, texto] of depois.textos.entries()) {
      const anterior = antes.textos[indice] ?? '';
      expect(texto, `montante ${indice} devia ser só máscara`).toMatch(/^•+$/u);
      expect(texto.length, `montante ${indice} mudou de comprimento`).toBe(anterior.length);
    }

    const alturaDepois = await page.evaluate(() => document.body.scrollHeight);
    expect(
      Math.abs(alturaDepois - alturaAntes),
      'a altura da página não pode saltar',
    ).toBeLessThanOrEqual(2);

    /* Recarregar mantém a máscara: servidor (cookie) e cliente concordam. */
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Painel' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-privacidade', 'ativa');
    expect((await contarMontantes(page)).ocultos).toBe(antes.total);

    /* Outro separador do mesmo contexto vê a mesma preferência. */
    const segundo = await context.newPage();

    try {
      await segundo.goto('/');
      await expect(segundo.locator('html')).toHaveAttribute('data-privacidade', 'ativa');
      expect((await contarMontantes(segundo)).visiveis).toBe(0);
    } finally {
      await segundo.close();
    }

    /* O atalho: livre troca o estado, como o botão. */
    await page.locator('h1').first().click();
    await page.keyboard.press('Control+Shift+H');
    await expect(botaoDaMascara(page)).toHaveAttribute('aria-pressed', 'false');

    await page.keyboard.press('Control+Shift+H');
    await expect(botaoDaMascara(page)).toHaveAttribute('aria-pressed', 'true');

    /* A escrever num campo não dispara. */
    await page.goto('/transacoes');
    await expect(formularioDeLancamentoRapido(page)).toBeVisible();
    await formularioDeLancamentoRapido(page).getByLabel('Valor', { exact: true }).focus();
    await page.keyboard.press('Control+Shift+H');
    await expect(botaoDaMascara(page)).toHaveAttribute('aria-pressed', 'true');

    /* Com a paleta aberta também não. */
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Painel' })).toBeVisible();
    await page.keyboard.press('Control+k');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Control+Shift+H');
    /*
     * Com um diálogo aberto o resto da página fica `aria-hidden` e o botão
     * deixa de ser alcançável por papel: lê-se o DOM em vez do `getByRole`.
     */
    expect(
      await page.evaluate(
        () =>
          document
            .querySelector(
              'button[aria-label="Mostrar montantes"], button[aria-label="Ocultar montantes"]',
            )
            ?.getAttribute('aria-pressed') ?? null,
      ),
    ).toBe('true');
    await page.keyboard.press('Escape');

    /* Desligar devolve os valores e os mesmos N montantes. */
    await botaoDaMascara(page).click();
    await expect(page.locator('html')).toHaveAttribute('data-privacidade', 'inativa');

    const fim = await contarMontantes(page);
    expect(fim.total).toBe(antes.total);
    expect(fim.visiveis).toBe(antes.total);
    expect(fim.ocultos).toBe(0);
  });
});
