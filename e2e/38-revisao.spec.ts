import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { lerCredenciais } from './support/dados';
import { criarLancamentosDoSpec, limparDadosDoSpec } from './support/db';
import { abrirRota } from './support/ui';

/**
 * Percurso 38 — o ecrã de Revisão (T54).
 *
 * A página só conta e salta, mas os números têm de ser os mesmos que os ecrãs
 * para onde salta. Esta spec prende:
 *
 * - a soma do topo é a soma dos quatro cartões;
 * - o cartão «Sem categoria» e o **`total` do extrato com `?semCategoria=1`**
 *   são o mesmo número (é o defeito que a mutação prova);
 * - o filtro vive na URL: sobrevive a recarregar e o chip remove-o;
 * - a paleta tem 17 com `Revisão`, a barra lateral continua com 9 e `/revisao`
 *   não está nela;
 * - `axe` 0 a 1280 e a 360, alvos de 44 px, sem transbordo, e o nome acessível
 *   de cada cartão traz o número.
 *
 * Os dados do cenário levam `T54 prova` e são apagados no `afterAll`.
 */

const PREFIXO = 'T54 prova';
const TOTAL_NO_TOPO = /coisas? por arrumar/;

const email = (): string => lerCredenciais().email;

/** Os quatro cartões, na ordem do documento. */
function cartoes(page: Page) {
  /* Só o conteúdo principal: a barra lateral também tem `ul li a`. */
  return page.locator('main ul li a');
}

/** O número de um cartão: o `<span>` grande à esquerda, ou 0 quando mostra o estado de zero. */
async function numeroDoCartao(page: Page, indice: number): Promise<number> {
  return cartoes(page)
    .nth(indice)
    .evaluate((link) => {
      const grande = [...link.querySelectorAll('span')].find((s) =>
        s.className.includes('text-3xl'),
      );

      return grande ? Number(grande.textContent ?? '0') : 0;
    });
}

/** Os quatro números na ordem: por confirmar, sem categoria, vencidas, faturas. */
async function numeros(page: Page): Promise<number[]> {
  return Promise.all([0, 1, 2, 3].map((i) => numeroDoCartao(page, i)));
}

/** O total do extrato, lido do rodapé da tabela. */
async function totalDoExtrato(page: Page): Promise<number> {
  const texto = await page
    .getByText(/movimentos? no total/)
    .first()
    .innerText();
  const encontrado = /(\d+)\s+movimentos? no total/.exec(texto);

  return encontrado === null ? -1 : Number(encontrado[1]);
}

test.describe('ecrã de Revisão (T54)', () => {
  test.afterAll(async () => {
    await limparDadosDoSpec(email(), PREFIXO);
  });

  test.beforeAll(async () => {
    /* Três sem categoria (um deles PENDING), que é o que a mutação vai separar. */
    await criarLancamentosDoSpec(email(), `${PREFIXO} sem categoria`, 2);
    await criarLancamentosDoSpec(email(), `${PREFIXO} pendente`, 1, { status: 'PENDING' });
    /* Uma linha já categorizada: sem ela a lista completa teria o mesmo tamanho da filtrada. */
    await criarLancamentosDoSpec(email(), `${PREFIXO} categorizada`, 1, { comCategoria: true });
  });

  test('a soma do topo é a soma dos quatro cartões', async ({ page }) => {
    await abrirRota(page, '/revisao');

    const [porConfirmar, semCategoria, vencidas, faturas] = await numeros(page);
    const soma = (porConfirmar ?? 0) + (semCategoria ?? 0) + (vencidas ?? 0) + (faturas ?? 0);

    const topo = await page.getByRole('status').innerText();
    if (soma === 0) {
      expect(topo).toContain('Nada por arrumar');
    } else {
      expect(TOTAL_NO_TOPO.test(topo), `texto do topo: ${topo}`).toBe(true);
      expect(Number(topo.trim().split(' ')[0]), 'o total do topo é a soma dos cartões').toBe(soma);
    }

    /* Os dados do cenário estão lá: o cartão não é zero. */
    expect(
      semCategoria,
      'o cartão «Sem categoria» conta os três do cenário',
    ).toBeGreaterThanOrEqual(3);

    /* E o nome acessível de cada cartão traz o número, não só o título. */
    const nome = await cartoes(page).nth(1).getAttribute('aria-label');
    const texto = await cartoes(page).nth(1).innerText();
    expect(`${nome ?? ''} ${texto}`).toContain(`${semCategoria} lançamentos sem categoria`);
  });

  test('o cartão «Sem categoria» e o total do extrato são o mesmo número', async ({ page }) => {
    await abrirRota(page, '/revisao');
    const semCategoria = await numeroDoCartao(page, 1);

    await cartoes(page).nth(1).click();
    await expect(page).toHaveURL(/semCategoria=1/);
    await expect(
      page.getByRole('button', { name: 'Remover o filtro Sem categoria' }),
    ).toBeVisible();

    expect(await totalDoExtrato(page), 'o extrato conta o mesmo que o cartão').toBe(semCategoria);

    /* Recarregar mantém o filtro. */
    await page.reload();
    await expect(page).toHaveURL(/semCategoria=1/);
    await expect(
      page.getByRole('button', { name: 'Remover o filtro Sem categoria' }),
    ).toBeVisible();
    expect(await totalDoExtrato(page)).toBe(semCategoria);

    /* Limpar o chip devolve a lista completa. */
    await page.getByRole('button', { name: 'Remover o filtro Sem categoria' }).click();
    await expect(page).not.toHaveURL(/semCategoria=1/);
    await expect(page.getByRole('button', { name: 'Remover o filtro Sem categoria' })).toHaveCount(
      0,
    );
    expect(await totalDoExtrato(page), 'sem o filtro volta a lista toda').toBeGreaterThan(
      semCategoria,
    );
  });

  test('a porta existe: paleta 17 com Revisão, barra lateral 9 sem ela', async ({ page }) => {
    await abrirRota(page, '/');

    /* O bloco do Painel leva à revisão. */
    await expect(page.getByRole('link', { name: 'Ver a revisão' })).toHaveAttribute(
      'href',
      '/revisao',
    );

    const lateral = await page.evaluate(() => {
      const barra = document.querySelector('[data-slot="sidebar"]');

      return barra
        ? [...barra.querySelectorAll('a[href]')].map((a) => a.getAttribute('href') ?? '')
        : [];
    });

    /* Nove destinos na navegação (D29); «Definições» vive no rodapé do utilizador (T52). */
    const destinos = lateral.filter((href) => href !== '/definicoes');

    expect(destinos, 'a barra lateral (D7 + D29) continua com 9').toHaveLength(9);
    expect(destinos, '/revisao não entra na barra').not.toContain('/revisao');
    expect(lateral, 'Definições continua no rodapé').toContain('/definicoes');

    await page.keyboard.press('Control+k');
    const paleta = page.getByRole('dialog');
    await expect(paleta).toBeVisible();

    const opcoes = paleta.getByRole('option');
    await expect(opcoes, 'a paleta passa a 17').toHaveCount(17);
    await expect(opcoes.filter({ hasText: 'Revisão' })).toHaveCount(1);
  });

  test('acessibilidade: axe 0, 44 px, sem transbordo, Tab na ordem visual', async ({ page }) => {
    for (const largura of [1280, 360]) {
      await page.setViewportSize({ width: largura, height: largura === 360 ? 800 : 1000 });
      await abrirRota(page, '/revisao');

      const resultado = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();

      expect(
        resultado.violations.map((v) => `${largura}: ${v.id} (${v.nodes.length})`),
        `violações em /revisao a ${largura}`,
      ).toEqual([]);

      const medida = await page.evaluate(() => {
        const cartoes = [...document.querySelectorAll('main ul li a')];

        return {
          scrollWidth: document.documentElement.scrollWidth,
          viewport: window.innerWidth,
          alturas: cartoes.map((a) => Math.round(a.getBoundingClientRect().height)),
        };
      });

      expect(medida.scrollWidth, `sem transbordo a ${largura}`).toBe(medida.viewport);
      expect(
        medida.alturas.every((h) => h >= 44),
        `alvos ≥44 a ${largura}: ${medida.alturas}`,
      ).toBe(true);
    }
  });

  test('a ordem de Tab é a ordem visual dos quatro cartões', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await abrirRota(page, '/revisao');

    const alvos = page.locator('main ul li a');
    await expect(alvos).toHaveCount(4);

    const ordemDoDocumento = await alvos.evaluateAll((links) =>
      links.map((a) => a.getAttribute('href') ?? ''),
    );

    /* Foca o primeiro e segue com Tab: os quatro hão de aparecer por esta ordem. */
    await alvos.first().focus();
    const ordemDoTab = [
      await page.evaluate(() => document.activeElement?.getAttribute('href') ?? ''),
    ];

    for (let i = 1; i < 4; i += 1) {
      await page.keyboard.press('Tab');
      ordemDoTab.push(
        await page.evaluate(() => document.activeElement?.getAttribute('href') ?? ''),
      );
    }

    expect(ordemDoTab).toEqual(ordemDoDocumento);
  });
});
