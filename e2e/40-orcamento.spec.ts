import { expect, test } from '@playwright/test';

import { CATEGORIA_ALIMENTACAO } from './support/dados';
import { eurosParaCentimos } from './support/format';
import { abrirRota, escolherNoSelect, esperarAviso, lancarGasto } from './support/ui';

/**
 * Percurso 3 — orçamento: definir um limite e ver o consumo e o alerta.
 *
 * O valor gasto na categoria é **previsível** porque a única despesa em
 * «Alimentação» deste utilizador é a que este spec cria: as outras usam
 * «Transportes». É isso que permite comparar 45,00 € de 50,00 € = 90% e exigir o
 * aviso dos 80%, em vez de aceitar «alguma coisa apareceu».
 */

test.describe('Percurso 3 — orçamento com limite e alerta', () => {
  test('definir total e limite mostra o consumo, o estado e o aviso do limiar', async ({
    page,
  }) => {
    const sufixo = Date.now().toString(36);
    const nome = `E2E orçamento ${sufixo}`;

    await abrirRota(page, '/orcamento');

    await page.getByRole('button', { name: /Criar o primeiro orçamento|Novo orçamento/ }).click();

    const dialogo = page.getByRole('dialog');

    await dialogo.getByLabel('Nome', { exact: true }).fill(nome);
    await dialogo.getByLabel('Total do orçamento', { exact: true }).fill('100,00');
    await dialogo.getByRole('button', { name: 'Criar orçamento' }).click();
    await esperarAviso(page, 'Orçamento criado.');

    // O cartão do orçamento aparece com o total definido.
    await expect(page.getByRole('region', { name: nome })).toBeVisible();

    // Limite de 50,00 € na categoria principal «Alimentação».
    await page.getByRole('button', { name: 'Novo limite' }).click();

    const limiteDialogo = page.getByRole('dialog');

    await escolherNoSelect(
      limiteDialogo.getByLabel('Categoria', { exact: true }),
      CATEGORIA_ALIMENTACAO,
    );
    await limiteDialogo.getByLabel('Limite', { exact: true }).fill('50,00');
    await limiteDialogo.getByRole('button', { name: 'Definir limite' }).click();
    await esperarAviso(page, 'Limite definido.');

    // Um gasto de 45,00 € na categoria com limite.
    await abrirRota(page, '/transacoes');
    await lancarGasto(page, {
      valor: '45,00',
      descricao: `E2E alimentação ${sufixo}`,
      categoria: CATEGORIA_ALIMENTACAO,
    });

    // O orçamento mede 45,00 de 50,00 = 90% e avisa (limiar por omissão: 80%).
    await abrirRota(page, '/orcamento');

    await expect(
      page.getByRole('progressbar', {
        name: new RegExp(`Limite de ${CATEGORIA_ALIMENTACAO}: 90% consumido, Atenção`),
      }),
    ).toBeVisible();

    await expect(
      page.getByText('Passaste o limiar de aviso de 80% (90% consumido).'),
    ).toBeVisible();

    const linhaDoLimite = page.locator('li').filter({ hasText: 'Limiar de aviso' }).first();

    await expect(linhaDoLimite).toBeVisible();
    await expect(linhaDoLimite).toContainText(CATEGORIA_ALIMENTACAO);
    await expect(linhaDoLimite).toContainText('Atenção');

    const valores = await linhaDoLimite.locator('dd').allInnerTexts();

    // A ordem é a do `<dl>`: Gasto, Limite, Sobra.
    expect(eurosParaCentimos(valores[0] ?? ''), 'gasto do período').toBe(4500);
    expect(eurosParaCentimos(valores[1] ?? ''), 'limite definido').toBe(5000);
    expect(eurosParaCentimos(valores[2] ?? ''), 'sobra').toBe(500);
  });
});
