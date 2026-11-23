import { expect, test } from '@playwright/test';

import { lerCredenciais } from './support/dados';
import { apagarOrcamentosDoSpec, limparDadosDoSpec } from './support/db';
import { abrirRota, lancarGasto } from './support/ui';

/**
 * Percurso 104 — sem limites de categoria, o resumo mede contra o **total** (T104/D37).
 *
 * O defeito que este teste prende: o resumo passou a dividir pela soma dos
 * limites, e sem limites essa soma é 0 — o orçamento dizia «0 % · Tranquilo»
 * com o total estourado. Sem categorias com limite não há outra medida possível
 * senão o gasto do mês contra o total do orçamento.
 *
 * Cria um orçamento de 100,00 € **sem nenhum limite** e gasta 130,00 €: o bloco
 * tem de dizer 130 % e «Passaste o limite definido», nunca «Tranquilo».
 */

const PREFIXO = 'T104 QA orçamento sem limites';

test.describe('T104 — orçamento sem limites mede o gasto contra o total', () => {
  test.afterAll(async () => {
    await apagarOrcamentosDoSpec(lerCredenciais().email, PREFIXO);
    await limparDadosDoSpec(lerCredenciais().email, PREFIXO);
  });

  test('130 € gastos num orçamento de 100 € sem limites dá 130%, «Excedido» e não «Tranquilo»', async ({
    page,
  }) => {
    const sufixo = Date.now().toString(36);
    const nome = `${PREFIXO} ${sufixo}`;

    await abrirRota(page, '/orcamento');
    await page.getByRole('button', { name: /Criar o primeiro orçamento|Novo orçamento/ }).click();

    const dialogo = page.getByRole('dialog');
    await dialogo.getByLabel('Nome', { exact: true }).fill(nome);
    await dialogo.getByLabel('Total do orçamento', { exact: true }).fill('100,00');
    await dialogo.getByRole('button', { name: 'Criar orçamento' }).click();
    await expect(page.getByText('Orçamento criado.')).toBeVisible();

    /* Um único limite existe? Não: o orçamento fica sem categorias com limite. */
    await expect(page.getByRole('button', { name: 'Novo limite' })).toBeVisible();

    await abrirRota(page, '/transacoes');
    await lancarGasto(page, {
      valor: '130,00',
      descricao: `${PREFIXO} gasto ${sufixo}`,
      categoria: 'Lazer',
    });

    await abrirRota(page, '/orcamento');

    const regiao = page.getByRole('region', { name: nome });
    await expect(regiao).toBeVisible();

    /*
     * A medida é 130/100 = 130 % — não 0 % (a soma dos limites vazia) — e o
     * estado vem do consumo contra o total: «Excedido», com a frase que o diz.
     */
    await expect(
      regiao.getByRole('progressbar', { name: new RegExp(`${nome}: 130% consumido, Excedido`) }),
    ).toBeVisible();
    await expect(regiao, 'o bloco diz que passou o limite').toContainText(
      'Passaste o limite definido.',
    );
    await expect(regiao, 'o bloco não tranquiliza').not.toContainText('Tranquilo');
    await expect(regiao, 'sem limite nenhum, não há 0 %').not.toContainText(
      /Gastos nas categorias com limite: 0%/,
    );

    /* O total e o gasto do mês continuam na linha própria. */
    await expect(regiao).toContainText(/130,00\s*€ de 100,00\s*€ este mês/);
  });
});
