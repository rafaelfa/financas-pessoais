import { expect, test } from '@playwright/test';

import { CATEGORIA_ALIMENTACAO } from './support/dados';
import { apagarOrcamentosDoSpec, limparDadosDoSpec } from './support/db';
import { lerCredenciais } from './support/dados';
import { abrirRota, escolherNoSelect, esperarAviso, lancarGasto } from './support/ui';

/**
 * Percurso 104 — o resumo do orçamento mede contra a soma dos limites (T104/D37).
 *
 * O defeito: «Gastos nas categorias com limite: 23% · Tranquilo» ao lado de uma
 * categoria a 90 % do limite. O denominador era o **total do orçamento** (200 €)
 * e o estado era o da média. A regra: consumo = gasto ÷ soma dos limites
 * (100 €), estado = o pior das categorias. Este teste cria os dois limites, gasta
 * 45 € num deles e exige **45%** e **Atenção**; o total continua visível na sua
 * própria linha, com o gasto do mês.
 */

const PREFIXO = 'T104 QA orçamento';
const TOTAL = '200,00';
const LIMITE = '50,00';

test.describe('T104 — o resumo do orçamento mede contra a soma dos limites', () => {
  test.afterAll(async () => {
    await apagarOrcamentosDoSpec(lerCredenciais().email, PREFIXO);
    await limparDadosDoSpec(lerCredenciais().email, PREFIXO);
  });

  test('45 € de 100 € de limites é 45% e o estado é «Atenção» (não «Tranquilo»)', async ({
    page,
  }) => {
    const sufixo = Date.now().toString(36);
    const nome = `${PREFIXO} ${sufixo}`;

    await abrirRota(page, '/orcamento');
    await page.getByRole('button', { name: /Criar o primeiro orçamento|Novo orçamento/ }).click();

    const dialogo = page.getByRole('dialog');
    await dialogo.getByLabel('Nome', { exact: true }).fill(nome);
    await dialogo.getByLabel('Total do orçamento', { exact: true }).fill(TOTAL);
    await dialogo.getByRole('button', { name: 'Criar orçamento' }).click();
    await esperarAviso(page, 'Orçamento criado.');

    /* Dois limites de 50 €: a soma (100) é metade do total (200). */
    for (const categoria of [CATEGORIA_ALIMENTACAO, 'Transportes']) {
      await page.getByRole('button', { name: 'Novo limite' }).click();
      const limiteDialogo = page.getByRole('dialog');
      await escolherNoSelect(limiteDialogo.getByLabel('Categoria', { exact: true }), categoria);
      await limiteDialogo.getByLabel('Limite', { exact: true }).fill(LIMITE);
      await limiteDialogo.getByRole('button', { name: 'Definir limite' }).click();
      await esperarAviso(page, 'Limite definido.');
    }

    /* 45 € em Alimentação = 90% desse limite (limiar de aviso: 80%). */
    await abrirRota(page, '/transacoes');
    await lancarGasto(page, {
      valor: '45,00',
      descricao: `${PREFIXO} alimentação ${sufixo}`,
      categoria: CATEGORIA_ALIMENTACAO,
    });

    await abrirRota(page, '/orcamento');

    const regiao = page.getByRole('region', { name: nome });
    await expect(regiao).toBeVisible();

    /*
     * A percentagem é 45/100 = 45% — não 45/200 = 23% (o denominador antigo) —
     * e o estado é o pior da categoria: «Atenção», com a descrição do aviso, e
     * não «Tranquilo»/«Tudo dentro do limite».
     */
    /*
     * O bloco do resumo é o `div` interior que tem a percentagem, o estado e a
     * frase dos limites; `.last()` apanha o mais fundo (o cartão inteiro também
     * contém esse texto, mas inclui a lista de limites, onde «Tranquilo» é
     * legítimo para outra categoria).
     */
    const resumo = regiao
      .locator('div')
      .filter({ hasText: /Gastos nas categorias com limite: \d+%[\s\S]*a soma dos limites/ })
      .last();

    await expect(resumo, 'a percentagem é a dos limites').toContainText(
      /Gastos nas categorias com limite: 45%/,
    );
    await expect(resumo, 'o gasto e a soma dos limites').toContainText(/45,00\s*€ de 100,00\s*€/);
    await expect(resumo, 'o estado é o pior das categorias').toContainText(
      /Já passaste dos 70% do limite/,
    );
    await expect(resumo, 'o resumo não diz Tranquilo').not.toContainText('Tranquilo');
    await expect(resumo, 'o bloco mostra Atenção').toContainText('Atenção');

    /* O total do orçamento continua visível, na sua linha própria. */
    const linhaDoTotal = regiao
      .locator('p')
      .filter({ hasText: /Orçamento “/ })
      .first();
    await expect(linhaDoTotal).toContainText(/45,00\s*€ de 200,00\s*€/);
  });
});
