import { expect, test, type Page } from '@playwright/test';

import { lerCredenciais } from './support/dados';
import { limparDadosDoSpec } from './support/db';
import {
  escolherNoSelect,
  esperarAviso,
  formularioDeLancamentoRapido,
  abrirRota,
} from './support/ui';

/**
 * Percurso 30 — filtro por valor no extrato (T48).
 *
 * O filtro é sobre o **módulo** e o limite é em euros (`valor=43,21` são
 * 43,21 €). O rodapé tem de somar o conjunto filtrado, e o chip é o critério
 * visível que se remove para voltar ao extrato inteiro.
 */

/** Valor único do percurso, em euros (e em cêntimos: 4 321). */
const VALOR = '43,21';

/** Prefixo das descrições criadas; a limpeza usa-o no `afterAll`. */
const PREFIXO = 'E2E T48 filtro';

/** O total do extrato, lido do rodapé da paginação. */
async function totalDoExtrato(page: Page): Promise<number> {
  /* Sem movimentos o rodapé da paginação não existe: o total é zero. */
  const primeiro = page.getByText(/^A mostrar /).first();

  if ((await primeiro.count()) === 0) {
    return 0;
  }

  const texto = await primeiro.textContent();
  const total = /de (\d+)/.exec(texto ?? '')?.[1];

  return Number(total ?? 0);
}

test.describe('filtro por valor', () => {
  /*
   * O gasto criado é da categoria Alimentação e fica no mês: o percurso do
   * orçamento (40) mede a percentagem dessa categoria e contaria com ele. Sai
   * no fim, para não mudar os números de outro spec.
   */
  test.afterAll(async () => {
    await limparDadosDoSpec(lerCredenciais().email, PREFIXO);
  });

  test('filtra pelo módulo, soma o conjunto e o chip volta ao total', async ({ page }) => {
    await abrirRota(page, '/transacoes');
    const totalSemFiltro = await totalDoExtrato(page);

    /* Um gasto com um valor que mais nenhum lançamento do percurso usa. */
    const descricao = `${PREFIXO} ${Date.now().toString(36)}`;
    const rapido = formularioDeLancamentoRapido(page);

    await expect(rapido).toBeVisible();
    await rapido.getByLabel('Categoria', { exact: true }).click();
    await page.getByRole('option', { name: 'Alimentação', exact: true }).click();
    await rapido.getByLabel('Valor', { exact: true }).fill(VALOR);
    await rapido.getByLabel('Descrição', { exact: true }).fill(descricao);
    await rapido.getByRole('button', { name: 'Lançar', exact: true }).click();
    await esperarAviso(page, 'Gasto registado.');

    /* Pelo controlo da barra: «Igual a» + 43,21 + Enter. */
    await escolherNoSelect(page.getByLabel('Comparação do valor'), 'Igual a');
    const campo = page.getByLabel('Valor (€)', { exact: true });
    await campo.fill(VALOR);
    await campo.press('Enter');

    await expect(page).toHaveURL(/valor=43%2C21&valorOp=eq/);

    const chip = page.getByRole('button', { name: /Remover o filtro Valor: igual a/ });
    await expect(chip).toBeVisible();
    await expect(chip).toContainText('43,21');
    await expect(page.getByText(descricao, { exact: true })).toBeVisible();
    expect(await totalDoExtrato(page), 'o filtro exato devia deixar 1 movimento').toBe(1);

    /* O rodapé soma só o conjunto filtrado: um gasto de 43,21 €. */
    const soma = await page.locator('tfoot [data-amount]').textContent();
    expect(soma?.replace(/\s+/g, ' ').trim()).toBe('-43,21 €');

    /* Remover o chip volta ao extrato inteiro. */
    await chip.click();
    await expect(page).toHaveURL(/\/transacoes$/);
    await expect(page.getByRole('button', { name: /Remover o filtro Valor:/ })).toHaveCount(0);
    expect(await totalDoExtrato(page)).toBe(totalSemFiltro + 1);

    /* Um URL inválido não filtra nem inventa um chip. */
    await abrirRota(page, '/transacoes?valor=abc&valorOp=gt');
    await expect(page.getByRole('button', { name: /Remover o filtro Valor:/ })).toHaveCount(0);
    expect(await totalDoExtrato(page)).toBe(totalSemFiltro + 1);
  });
});
