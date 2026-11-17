import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

import { lerCredenciais } from './support/dados';
import { limparDadosDoSpec } from './support/db';
import { abrirRota, deslocarDias, hojeEmLisboa } from './support/ui';

/**
 * Percurso 32 — contraste da linha vencida em `/contas-pagar-receber` (T50).
 *
 * O `80-acessibilidade` só falha em violações **críticas**, por isso um
 * `color-contrast` *serious* não o faz vermelho. Esta spec prende o que a vaga
 * corrigiu: com uma conta a pagar **vencida criada pela interface**, zero
 * violações `color-contrast` no claro e no escuro, e a borda da vencida a
 * **1 px** (o `border` que faltava deixava-a a 0 px — igual às outras linhas).
 */

/** Prefixo dos dados do spec; a limpeza usa-o no `afterAll`. */
const PREFIXO = 'E2E T50 vencida';

function cartaoDaConta(page: Page, descricao: string) {
  return page.locator('[data-slot="card"]').filter({ hasText: descricao });
}

/** Violações `color-contrast` da página no estado atual. */
async function contrastes(page: Page) {
  const resultado = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();

  return resultado.violations
    .filter((violacao) => violacao.id === 'color-contrast')
    .flatMap((violacao) =>
      violacao.nodes.map((no) => `${no.target.join(' ')} · ${no.failureSummary ?? ''}`),
    );
}

test.describe('contraste da conta vencida', () => {
  test.afterAll(async () => {
    await limparDadosDoSpec(lerCredenciais().email, PREFIXO);
  });

  test('a vencida tem borda de 1 px e zero violações de contraste nos dois temas', async ({
    page,
  }) => {
    const descricao = `${PREFIXO} ${Date.now().toString(36)}`;

    await abrirRota(page, '/contas-pagar-receber');
    await page.getByRole('button', { name: 'Nova Conta', exact: true }).click();

    const dialogo = page.getByRole('dialog').filter({ hasText: 'Nova Conta' });
    await expect(dialogo).toBeVisible();
    await dialogo.getByLabel('Descrição', { exact: true }).fill(descricao);
    await dialogo.getByLabel('Valor (€)', { exact: true }).fill('200,00');
    await dialogo
      .getByLabel('Data de Vencimento', { exact: true })
      .fill(deslocarDias(hojeEmLisboa(), -5));
    await dialogo.getByRole('button', { name: 'Criar Conta', exact: true }).click();
    await expect(dialogo).toBeHidden();

    const cartao = cartaoDaConta(page, descricao);
    await expect(cartao).toBeVisible();
    /* O estado vencido é o que esta spec precisa de exercitar. */
    await expect(cartao.getByText(/Vencida/)).toBeVisible();

    for (const tema of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: tema });
      await abrirRota(page, '/contas-pagar-receber');

      const alvo = cartaoDaConta(page, descricao);
      await expect(alvo).toBeVisible();

      /* A borda que faltava: 0 px tornava a vencida igual a uma linha normal. */
      expect(
        await alvo.evaluate((elemento) => getComputedStyle(elemento).borderTopWidth),
        `borda da vencida no tema ${tema}`,
      ).toBe('1px');

      const achados = await contrastes(page);
      expect(achados, `violações color-contrast (${tema}):\n${achados.join('\n')}`).toEqual([]);
    }
  });
});
