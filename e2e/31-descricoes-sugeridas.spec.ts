import { expect, test, type Page } from '@playwright/test';

import { lerCredenciais } from './support/dados';
import { contarTransacoes, limparDadosDoSpec } from './support/db';
import { abrirRota, esperarAviso, formularioDeLancamentoRapido } from './support/ui';

/**
 * Percurso 31 — sugestões de descrição a partir do histórico (T49).
 *
 * A lista sugere, não restringe: o texto escrito vale sempre. Fecha três coisas
 * que podem partir em silêncio — a lista não esconde a página (`aria-hidden` em
 * toda a parte), o Enter com a lista aberta escolhe **sem** submeter o
 * formulário, e o Escape fecha mantendo o texto.
 */

/** Prefixo das descrições criadas; a limpeza usa-o no `afterAll`. */
const PREFIXO = 'E2E T49 sugestao';

function campoDaDescricao(page: Page) {
  return page.getByLabel('Descrição', { exact: true }).first();
}

test.describe('sugestões de descrição', () => {
  test.afterAll(async () => {
    await limparDadosDoSpec(lerCredenciais().email, PREFIXO);
  });

  test('sugere do histórico, escolhe com Enter sem submeter e não esconde a página', async ({
    page,
  }) => {
    await abrirRota(page, '/transacoes');

    /* 1. Cria histórico: uma descrição com o prefixo, pela interface. */
    const descricao = `${PREFIXO} ${Date.now().toString(36)}`;
    const rapido = formularioDeLancamentoRapido(page);

    await expect(rapido).toBeVisible();
    await rapido.getByLabel('Categoria', { exact: true }).click();
    await page.getByRole('option', { name: 'Alimentação', exact: true }).click();
    await rapido.getByLabel('Valor', { exact: true }).fill('19,90');
    await rapido.getByLabel('Descrição', { exact: true }).fill(descricao);
    await rapido.getByRole('button', { name: 'Lançar', exact: true }).click();
    await esperarAviso(page, 'Gasto registado.');

    const email = lerCredenciais().email;
    const antes = await contarTransacoes(email);

    /* 2. Escrever o prefixo abre a lista com a descrição de há instantes. */
    await page.reload();
    await expect(campoDaDescricao(page)).toBeVisible();
    await campoDaDescricao(page).fill(PREFIXO);

    const itens = page.locator('[data-slot="combobox-content"] [role="option"]');
    await expect(itens.first()).toBeVisible();
    await expect(itens.filter({ hasText: descricao })).toHaveCount(1);

    /* A lista não é um diálogo: o cabeçalho e a navegação continuam expostos. */
    await expect(page.locator('header')).not.toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('header')).not.toHaveAttribute('inert', '');
    await expect(page.locator('[data-slot="sidebar"]').first()).not.toHaveAttribute(
      'aria-hidden',
      'true',
    );
    await expect(page.getByRole('link', { name: 'Contas', exact: true })).toBeVisible();

    /* 3. Enter com a lista aberta escolhe e **não** submete. */
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('[data-slot="combobox-content"] [data-highlighted]')).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(campoDaDescricao(page)).toHaveValue(descricao);
    await expect(page.locator('[data-slot="combobox-content"]')).toHaveCount(0);
    expect(await contarTransacoes(email), 'o Enter não pode submeter o formulário').toBe(antes);

    /* 4. Escape fecha e mantém o que está escrito. */
    await campoDaDescricao(page).fill(PREFIXO);
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('[data-slot="combobox-content"]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-slot="combobox-content"]')).toHaveCount(0);
    await expect(campoDaDescricao(page)).toHaveValue(PREFIXO);

    /* 5. O texto novo continua a gravar-se (a lista sugere, não restringe). */
    await campoDaDescricao(page).fill(`${PREFIXO} novo`);
    await rapido.getByLabel('Categoria', { exact: true }).click();
    await page.getByRole('option', { name: 'Alimentação', exact: true }).click();
    await rapido.getByLabel('Valor', { exact: true }).fill('7,77');
    await rapido.getByRole('button', { name: 'Lançar', exact: true }).click();
    await esperarAviso(page, 'Gasto registado.');
    expect(await contarTransacoes(email)).toBe(antes + 1);
  });
});
