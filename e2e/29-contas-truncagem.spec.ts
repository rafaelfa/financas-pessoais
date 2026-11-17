import { expect, test, type Page } from '@playwright/test';

import { lerCredenciais } from './support/dados';
import { limparDadosDoSpec } from './support/db';
import { abrirRota } from './support/ui';

/**
 * Percurso 29 — o nome comprido de uma conta é truncado com «…» (T51).
 *
 * O `CardTitle` tem `truncate`, mas só trunca se a cadeia de flex tiver
 * `min-w-0`: sem isso a track cresce até ao texto (853 px dentro de 328) e a
 * reticência nunca é pintada. É esta a condição que o teste fixa — não o
 * desenho, o `clientWidth < scrollWidth`.
 */

/** Prefixo dos dados do spec; a limpeza usa-o no `afterAll`. */
const PREFIXO = 'E2E T51';

/** 76 caracteres: acima dos 60 pedidos e dentro do máximo de 80 do schema. */
const NOME_LONGO = `${PREFIXO} conta com um nome muito comprido para provar a truncagem do cartão`;

function cartaoDaConta(page: Page, nome: string) {
  return page.locator('[data-slot="card"]').filter({ has: page.getByText(nome, { exact: true }) });
}

/** Lê a truncagem do título do cartão. */
async function lerTruncagem(page: Page, nome: string) {
  return page.evaluate((nomeProcurado) => {
    const titulo = [...document.querySelectorAll('[data-slot="card-title"]')].find(
      (element) => element.textContent === nomeProcurado,
    );

    if (!titulo) {
      return null;
    }

    const estilo = getComputedStyle(titulo);

    return {
      clientWidth: titulo.clientWidth,
      scrollWidth: titulo.scrollWidth,
      textOverflow: estilo.textOverflow,
      whiteSpace: estilo.whiteSpace,
      overflow: estilo.overflow,
      textContent: titulo.textContent,
      documentoScrollWidth: document.documentElement.scrollWidth,
      janela: window.innerWidth,
    };
  }, nome);
}

test.describe('nome comprido de uma conta', () => {
  test.afterAll(async () => {
    await limparDadosDoSpec(lerCredenciais().email, PREFIXO);
  });

  test('trunca com reticência a 1280 e a 360, e o nome completo fica no DOM', async ({ page }) => {
    await abrirRota(page, '/contas');
    await page.getByRole('button', { name: 'Nova conta', exact: true }).click();

    const dialogo = page.getByRole('dialog').filter({ hasText: 'Nova conta' });
    await expect(dialogo).toBeVisible();
    await dialogo.getByLabel('Nome', { exact: true }).fill(NOME_LONGO);
    await dialogo.getByRole('button', { name: 'Criar conta', exact: true }).click();
    await expect(dialogo).toBeHidden();

    await expect(cartaoDaConta(page, NOME_LONGO)).toBeVisible();
    expect(NOME_LONGO.length).toBeGreaterThan(60);

    for (const largura of [1280, 360]) {
      await page.setViewportSize({ width: largura, height: 900 });
      await abrirRota(page, '/contas');

      const medida = await lerTruncagem(page, NOME_LONGO);
      expect(medida, `sem título a ${largura} px`).not.toBeNull();

      if (medida === null) {
        continue;
      }

      /* A reticência só é pintada se o conteúdo for mais largo do que a caixa. */
      expect(medida.clientWidth, `clientWidth a ${largura} px`).toBeLessThan(medida.scrollWidth);
      expect(medida.textOverflow).toBe('ellipsis');
      expect(medida.whiteSpace).toBe('nowrap');
      expect(medida.overflow).toBe('hidden');

      /* O texto completo continua no DOM: um leitor de ecrã não perde o nome. */
      expect(medida.textContent).toBe(NOME_LONGO);
      expect(medida.textContent?.length ?? 0).toBe(NOME_LONGO.length);

      expect(medida.documentoScrollWidth).toBeLessThanOrEqual(medida.janela + 1);
    }
  });
});
