import { expect, test, type Locator, type Page } from '@playwright/test';

import { extratoCsvDeAmostra } from './support/csv';
import { abrirRota, esperarAviso, hojeEmLisboa, lerSaldoDaConta } from './support/ui';

/**
 * Percurso 5 — importar um extrato CSV até à confirmação e desfazer.
 *
 * Mede-se o efeito nos dois sentidos: o saldo sobe o que o ficheiro diz e volta
 * exatamente ao valor inicial depois de desfazer. É a única forma de provar que
 * a reversão não deixou nada para trás.
 */

/** O `<dd>` que segue o `<dt>` com este rótulo, no resumo da pré-visualização. */
function facto(page: Page, rotulo: string): Locator {
  return page.locator('dt', { hasText: rotulo }).first().locator('xpath=following-sibling::dd[1]');
}

test.describe('Percurso 5 — importar e desfazer', () => {
  test('importar um CSV cria os movimentos e desfazer devolve a conta ao estado inicial', async ({
    page,
  }) => {
    const etiqueta = Date.now().toString(36);
    const extrato = extratoCsvDeAmostra(hojeEmLisboa(), etiqueta);

    await abrirRota(page, '/contas');
    const saldoAntes = await lerSaldoDaConta(page);

    await abrirRota(page, '/importar');

    await expect(page.getByText('Nada é gravado até confirmares')).toBeVisible();

    await page.locator('#importar-ficheiro').setInputFiles({
      name: extrato.nome,
      mimeType: 'text/csv',
      buffer: Buffer.from(extrato.conteudo, 'utf8'),
    });

    await page.getByRole('button', { name: 'Pré-visualizar' }).click();

    // Pré-visualização: o ficheiro é lido e nada foi gravado.
    await expect(page.getByText('Resumo do ficheiro (CSV)')).toBeVisible();
    await expect(
      page.getByText(`${extrato.descricoes.length} linhas lidas do ficheiro`),
    ).toBeVisible();
    await expect(facto(page, 'Novas')).toHaveText(String(extrato.descricoes.length));
    await expect(facto(page, 'Duplicadas')).toHaveText('0');
    await expect(page.getByText('Nada foi gravado ainda.')).toBeVisible();

    // Confirmação.
    await page
      .getByRole('button', { name: `Importar ${extrato.descricoes.length} movimentos` })
      .click();

    await esperarAviso(page, `${extrato.descricoes.length} movimentos importados.`);
    await expect(page.getByText('Importação concluída')).toBeVisible();
    await expect(page.getByText('Importações recentes')).toBeVisible();

    // O extrato mostra os movimentos importados, um a um.
    await abrirRota(page, '/transacoes');

    for (const descricao of extrato.descricoes) {
      await expect(page.getByText(descricao, { exact: true }).first()).toBeVisible();
    }

    // E o saldo subiu exatamente o efeito líquido do ficheiro.
    await abrirRota(page, '/contas');
    expect(
      (await lerSaldoDaConta(page)) - saldoAntes,
      'o saldo tem de subir o efeito líquido do extrato',
    ).toBe(extrato.efeitoNoSaldo);

    // Desfazer a importação.
    await abrirRota(page, '/importar');

    await expect(page.getByText('Importações recentes')).toBeVisible();
    await page.getByRole('button', { name: 'Desfazer importação' }).click();
    await page.getByRole('button', { name: 'Apagar os movimentos importados' }).click();

    await esperarAviso(page, `${extrato.descricoes.length} movimentos apagados.`);

    /*
     * O resultado **não** se procura no DOM: quando a importação é desfeita, o
     * recibo é esquecido e o painel inteiro desaparece no mesmo render
     * (`import-revert.tsx:253-256`), portanto o texto «… foram apagados.» nunca
     * chega a ser lido. O aviso acima é a confirmação; o que se exige a seguir é
     * o rasto no extrato e no saldo.
     */
    await expect(page.getByText('Importações recentes')).toHaveCount(0);

    // Nada ficou: os movimentos desapareceram do extrato...
    await abrirRota(page, '/transacoes');

    for (const descricao of extrato.descricoes) {
      await expect(page.getByText(descricao, { exact: true })).toHaveCount(0);
    }

    // ...e o saldo voltou ao valor de partida, ao cêntimo.
    await abrirRota(page, '/contas');
    expect(await lerSaldoDaConta(page), 'o saldo volta ao valor inicial').toBe(saldoAntes);
  });
});
