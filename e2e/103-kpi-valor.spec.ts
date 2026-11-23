import { expect, test, type Page } from '@playwright/test';

import { lerCredenciais } from './support/dados';
import { limparDadosDoSpec } from './support/db';
import { abrirRota, lancarGasto } from './support/ui';

/**
 * Percurso 103 — o dinheiro dos KPI cabe no cartão (T103).
 *
 * O defeito que a verificação de produção apanhou: em duas colunas o cartão
 * encolhe e o valor proeminente saía **cortado dentro do cartão**
 * (`overflow: hidden`), o que o `document.scrollWidth` nunca vê — a página não
 * transborda, o dinheiro é que fica cortado. Este teste mede **por cartão**.
 *
 * O texto mede-se por `Range`, não por `scrollWidth`: o montante é um `<span>`
 * inline, e `scrollWidth`/`clientWidth` de um inline são 0 — a comparação antiga
 * (`scrollWidth <= clientWidth`) passava sempre sem medir nada (achado do
 * Revisor na T103 volta 5). A folga é `cartao.right − texto.right ≥ 4`.
 *
 * As larguras são as três que importam: 375 (o caso relatado), 500 e 780 (as
 * faixas onde o `px-4` antigo comia o texto a 36 px — DEVE do Revisor).
 */

const CINCO_DIGITOS = '12\u00A0345,67\u00A0€';
const PREFIXO = 'T103 KPI QA';
const LARGURAS = [375, 500, 780];

type Medida = {
  readonly texto: string;
  readonly folga: number;
  readonly textoW: number;
  readonly contentorW: number;
  readonly overflow: string;
};

const medirCartoes = (page: Page) =>
  page.evaluate(() => {
    const seccao = document.querySelector('section[aria-label="Indicadores principais"]');

    return [...(seccao?.children ?? [])].map((cartao) => {
      const paragrafo = cartao.querySelector('p');
      const montante = cartao.querySelector('[data-amount]');
      const caixa = cartao.getBoundingClientRect();

      /* A largura real do texto, por Range — num span inline o scrollWidth é 0. */
      const intervalo = document.createRange();
      if (montante !== null) {
        intervalo.selectNodeContents(montante);
      }
      const texto = intervalo.getBoundingClientRect();

      return {
        texto: (montante?.textContent ?? '').trim(),
        folga: +(caixa.right - texto.right).toFixed(1),
        textoW: +texto.width.toFixed(1),
        contentorW: paragrafo?.clientWidth ?? 0,
        overflow: getComputedStyle(cartao).overflow,
      };
    });
  });

function exigirInteiros(medidas: readonly Medida[], largura: number): void {
  expect(medidas, `os quatro KPI a ${largura}`).toHaveLength(4);

  for (const medida of medidas) {
    expect(medida.overflow, 'o cartão esconde o que sair').toBe('hidden');
    expect(
      medida.folga,
      `a ${largura} «${medida.texto}» acaba 4 px antes do bordo do cartão`,
    ).toBeGreaterThanOrEqual(4);
    expect(
      medida.textoW,
      `a ${largura} «${medida.texto}» não é mais largo do que o contentor`,
    ).toBeLessThanOrEqual(medida.contentorW);
  }
}

/** Substitui o montante do 1.º cartão pelo mais longo que a app mostra, e repõe. */
async function comCincoDigitos(page: Page, correr: () => Promise<void>): Promise<void> {
  const guardado = await page.evaluate((valor) => {
    const montante = document.querySelector(
      'section[aria-label="Indicadores principais"] [data-amount]',
    );
    const anterior = montante?.innerHTML ?? '';
    if (montante !== null) {
      montante.textContent = valor;
    }
    return anterior;
  }, CINCO_DIGITOS);

  try {
    await correr();
  } finally {
    await page.evaluate((anterior) => {
      const montante = document.querySelector(
        'section[aria-label="Indicadores principais"] [data-amount]',
      );
      if (montante !== null) {
        montante.innerHTML = anterior;
      }
    }, guardado);
  }
}

test.describe('T103 — o dinheiro dos KPI cabe no cartão', () => {
  test.afterAll(async () => {
    await limparDadosDoSpec(lerCredenciais().email, PREFIXO);
  });

  test('a 375, 500 e 780 cada valor cabe no cartão, com e sem um valor de cinco dígitos', async ({
    page,
  }) => {
    /*
     * Um lançamento de aquecimento, no viewport por omissão: sem movimentos o
     * Painel mostra o estado vazio e não tem cartões de KPI (o mesmo aquecimento
     * do `30-transacoes`).
     */
    await abrirRota(page, '/transacoes');
    await lancarGasto(page, {
      valor: '10,00',
      descricao: `${PREFIXO} aquecimento`,
      categoria: 'Outros',
    });

    for (const largura of LARGURAS) {
      await page.setViewportSize({ width: largura, height: 900 });
      await abrirRota(page, '/');
      await expect(
        page.locator('section[aria-label="Indicadores principais"] > *'),
        `os quatro KPI a ${largura}`,
      ).toHaveCount(4);

      exigirInteiros(await medirCartoes(page), largura);

      await comCincoDigitos(page, async () => {
        exigirInteiros(await medirCartoes(page), largura);
      });
    }
  });
});
