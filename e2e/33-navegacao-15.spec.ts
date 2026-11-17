import { expect, test, type Page } from '@playwright/test';

import { abrirRota } from './support/ui';

/**
 * Percurso 33 — o contrato das 15 rotas (T52).
 *
 * A barra tem 8 destinos e os outros 7 vivem noutras portas (separadores de
 * `/contas`, menu «Mais» do cabeçalho, rodapé do utilizador, navegação
 * inferior). A paleta (`Ctrl+K`) continua com os 15, mas `ALL_NAV_ITEMS` é
 * **escrito à mão** — duas listas para manter. Esta spec é a asserção que
 * apanha a divergência futura:
 *
 * - todo o `href` que aparece num menu pertence às 15 rotas conhecidas;
 * - todas as 15 rotas têm pelo menos uma porta (nenhum órfão);
 * - a paleta lista exatamente as 15, sem faltar e sem sobrar.
 */

/** As 15 rotas e o rótulo de cada uma — o contrato que a navegação promete. */
const ROTAS: readonly (readonly [string, string])[] = [
  ['/', 'Painel'],
  ['/transacoes', 'Transações'],
  ['/contas', 'Contas'],
  ['/contas-pagar-receber', 'Contas a pagar/receber'],
  ['/consolidacao-contas', 'Consolidação'],
  ['/patrimonio', 'Património'],
  ['/cartoes', 'Cartões'],
  ['/orcamento', 'Orçamento'],
  ['/objetivos', 'Objetivos'],
  ['/recorrencias', 'Recorrências'],
  ['/regras', 'Regras'],
  ['/categorias', 'Categorias'],
  ['/relatorios', 'Relatórios'],
  ['/importar', 'Importar'],
  ['/definicoes', 'Definições'],
];

const HREFS = ROTAS.map(([href]) => href);

/** Todos os `href` internos que a página oferece numa das portas de navegação. */
async function hrefsDosMenus(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const raizes = [
      document.querySelector('[data-slot="sidebar"]'),
      ...document.querySelectorAll('nav[aria-label="Secções de contas"]'),
      document.querySelector('details'),
      ...document.querySelectorAll('nav[aria-label="Ferramentas do extrato"]'),
      ...document.querySelectorAll('nav[aria-label*="inferior" i], nav[data-slot="mobile-nav"]'),
    ].filter((el): el is Element => el !== null);

    const hrefs = raizes.flatMap((raiz) =>
      [...raiz.querySelectorAll('a[href]')].map((a) => a.getAttribute('href') ?? ''),
    );

    return [...new Set(hrefs.filter((href) => href.startsWith('/')))];
  });
}

test.describe('contrato de navegação das 15 rotas', () => {
  test('nenhum órfão: cada rota tem uma porta, e nenhum menu aponta para fora das 15', async ({
    page,
  }) => {
    const encontrados = new Map<string, string>();

    for (const [rota] of ROTAS) {
      await abrirRota(page, rota);

      for (const href of await hrefsDosMenus(page)) {
        if (!encontrados.has(href)) {
          encontrados.set(href, rota);
        }
      }
    }

    /* A navegação inferior só existe a 393 px; recolhe-se à parte. */
    await page.setViewportSize({ width: 393, height: 851 });
    await abrirRota(page, '/');
    const inferiores = await page.evaluate(() => {
      const nav = [...document.querySelectorAll('nav')].find(
        (n) => n.querySelectorAll('a[href]').length === 5,
      );
      return nav
        ? [...nav.querySelectorAll('a[href]')].map((a) => a.getAttribute('href') ?? '')
        : [];
    });

    const todos = [...new Set([...encontrados.keys(), ...inferiores])];
    const foraDoContrato = todos.filter((href) => !HREFS.includes(href));
    const orfaos = HREFS.filter((href) => !todos.includes(href));

    expect(inferiores, 'a navegação inferior tem de ter 5 alvos').toHaveLength(5);
    expect(foraDoContrato, 'menus com destinos que já não existem').toEqual([]);
    expect(orfaos, 'rotas sem porta nenhuma').toEqual([]);
  });

  test('a paleta lista exatamente as 15 rotas', async ({ page }) => {
    await abrirRota(page, '/');
    await page.keyboard.press('Control+k');

    const paleta = page.getByRole('dialog');
    await expect(paleta).toBeVisible();

    const opcoes = paleta.getByRole('option');
    await expect(opcoes).toHaveCount(15);

    const textos = await opcoes.allInnerTexts();
    const nomes = textos.map((texto) => texto.split('\n')[0]?.trim() ?? '');

    for (const [, rotulo] of ROTAS) {
      expect(
        nomes.filter((nome) => nome === rotulo),
        `«${rotulo}» na paleta`,
      ).toHaveLength(1);
    }
  });
});
