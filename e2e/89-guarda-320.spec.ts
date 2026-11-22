import { expect, test, type Page } from '@playwright/test';

import { abrirRota } from './support/ui';

/**
 * Percurso 89 — a guarda dos 320 px (T89).
 *
 * Não há nenhum projeto Playwright tão estreito como 320 (o `telemovel` é Pixel 5,
 * 393), e por isso o `max-w-full truncate` do rodapé móvel (T85) e o
 * `sr-only … min-[360px]` do cabeçalho (T88) podiam ser apagados por qualquer
 * alteração de classes sem um único teste vermelho. Esta é a asserção que os
 * guarda: geometria, não texto.
 *
 * Mede a **320** (o piso) e a **360** (onde a marca do cabeçalho volta e o
 * `min-[360px]` tem de ser exatamente 360): mudar o limiar para 380 deixaria a
 * marca escondida sem necessidade entre 360 e 379, e era invisível para um teste
 * só a 320.
 *
 * Desde a T93 também mede a **área de toque** dos seis controlos do cabeçalho
 * (≥44×44 em telemóvel), que é a barra que se usa com o polegar.
 *
 * `T89_MUTAR=nav|cabecalho|toque` só existe para a prova de que a guarda morde —
 * tira as classes em memória e o teste tem de falhar. Sem a variável, não faz nada.
 */

const MUTAR = process.env.T89_MUTAR ?? '';

interface Rotulo {
  readonly texto: string;
  readonly esquerda: number;
  readonly direita: number;
  readonly celulaEsquerda: number;
  readonly celulaDireita: number;
  readonly scrollWidth: number;
  readonly clientWidth: number;
  readonly textOverflow: string;
}

interface Medido {
  readonly viewport: number;
  readonly navScrollWidth: number;
  readonly docScrollWidth: number;
  readonly rotulos: readonly Rotulo[];
  readonly headerFilhosFora: readonly number[];
  readonly marcaLargura: number;
  readonly alvosToque: readonly { readonly nome: string; readonly w: number; readonly h: number }[];
}

/** Mede a nav inferior, o cabeçalho e a marca na largura atual. */
async function medir(page: Page): Promise<Medido> {
  return page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Navegação principal"]');
    const header = document.querySelector('header');
    const marca = document.querySelector('header > span');

    if (nav === null || header === null || marca === null) {
      throw new Error('a página não tem nav inferior ou cabeçalho');
    }

    const rotulos = [...nav.querySelectorAll('li')].map((li) => {
      const span = li.querySelector('span');
      const celula = li.getBoundingClientRect();
      const caixa = span?.getBoundingClientRect() ?? celula;

      return {
        texto: span?.textContent ?? '',
        esquerda: Math.round(caixa.left * 10) / 10,
        direita: Math.round(caixa.right * 10) / 10,
        celulaEsquerda: Math.round(celula.left * 10) / 10,
        celulaDireita: Math.round(celula.right * 10) / 10,
        scrollWidth: span?.scrollWidth ?? 0,
        clientWidth: span?.clientWidth ?? 0,
        textOverflow: span === null ? '' : getComputedStyle(span).textOverflow,
      };
    });

    return {
      viewport: window.innerWidth,
      navScrollWidth: nav.scrollWidth,
      docScrollWidth: document.documentElement.scrollWidth,
      rotulos,
      headerFilhosFora: [...header.children]
        .map((filho) => Math.round(filho.getBoundingClientRect().right * 10) / 10)
        .filter((right) => right > window.innerWidth + 0.5),
      marcaLargura: Math.round(marca.getBoundingClientRect().width * 10) / 10,
      alvosToque: [...header.querySelectorAll('button, summary')]
        .filter((el) => el.getBoundingClientRect().width > 0)
        .map((el) => {
          const caixa = el.getBoundingClientRect();
          return {
            nome: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 20),
            w: Math.round(caixa.width * 10) / 10,
            h: Math.round(caixa.height * 10) / 10,
          };
        }),
    };
  });
}

/** Tudo o que a guarda afirma sobre a nav e o cabeçalho, numa largura. */
function verificar(medido: Medido, largura: number): void {
  expect(medido.viewport, 'a janela onde se mediu').toBe(largura);
  expect(medido.rotulos, 'os 5 destinos da nav').toHaveLength(5);

  for (const rotulo of medido.rotulos) {
    expect(rotulo.texto.trim(), 'cada rótulo tem texto').not.toBe('');
    expect(rotulo.direita, `«${rotulo.texto}» não passa da célula`).toBeLessThanOrEqual(
      rotulo.celulaDireita + 0.5,
    );
    expect(rotulo.esquerda, `«${rotulo.texto}» começa dentro da célula`).toBeGreaterThanOrEqual(
      rotulo.celulaEsquerda - 0.5,
    );

    /*
     * Quando o texto não cabe, tem de estar cortado de forma intencional (T85):
     * sem `truncate`, o span cresce e a asserção acima apanha-o.
     */
    if (rotulo.scrollWidth > rotulo.clientWidth) {
      expect(rotulo.textOverflow, `«${rotulo.texto}» cortado com reticências`).toBe('ellipsis');
    }
  }

  for (let i = 1; i < medido.rotulos.length; i += 1) {
    const anterior = medido.rotulos[i - 1];
    const atual = medido.rotulos[i];

    expect(
      anterior?.direita,
      `«${anterior?.texto}» e «${atual?.texto}» não se tocam`,
    ).toBeLessThanOrEqual((atual?.esquerda ?? 0) + 0.5);
  }

  expect(medido.headerFilhosFora, 'nenhum filho do cabeçalho passa da janela').toEqual([]);
  /*
   * T93: em telemóvel os seis controlos do cabeçalho têm de ter 44×44 de área
   * clicável. A 1440 não se aplica — lá usa-se rato e o alvo é menor de propósito.
   */
  if (largura < 640) {
    expect(medido.alvosToque, 'os seis controlos do cabeçalho em telemóvel').toHaveLength(6);

    for (const alvo of medido.alvosToque) {
      expect(alvo.w, `«${alvo.nome}» com 44 px de largura`).toBeGreaterThanOrEqual(44);
      expect(alvo.h, `«${alvo.nome}» com 44 px de altura`).toBeGreaterThanOrEqual(44);
    }
  }
  expect(medido.navScrollWidth, 'a nav não transborda').toBe(largura);
  expect(medido.docScrollWidth, 'a página não transborda (T88)').toBe(largura);
}

test.describe('T89 — a 320 px nada transborda', () => {
  test('a 320 cabe tudo, e a 360 a marca volta sem transbordar', async ({ page }) => {
    await abrirRota(page, '/transacoes');

    if (MUTAR === 'nav') {
      /* Prova da guarda: sem `truncate`, o mesmo teste tem de ficar vermelho. */
      await page.evaluate(() => {
        for (const span of document.querySelectorAll(
          'nav[aria-label="Navegação principal"] span',
        )) {
          span.classList.remove('max-w-full', 'truncate');
        }
      });
    }

    if (MUTAR === 'toque') {
      /* Prova: sem as classes de toque, os alvos voltam a 28–36 px. */
      await page.evaluate(() => {
        for (const el of document.querySelectorAll('header button, header summary')) {
          el.classList.remove('max-sm:min-h-11', 'max-sm:min-w-11');
        }
      });
    }

    if (MUTAR === 'cabecalho') {
      /* O mesmo para o nome da app: sem `sr-only` a 320, o cabeçalho transborda. */
      await page.evaluate(() => {
        document.querySelector('header > span')?.classList.remove('sr-only');
      });
    }

    const a320 = await medir(page);

    verificar(a320, 320);

    /* A 320 o nome da app está escondido mas continua a ser anunciado. */
    await expect(page.locator('header > span'), 'o nome da app existe no DOM').toHaveCount(1);
    expect(
      await page.locator('header > span').ariaSnapshot(),
      'o nome da app é anunciado a 320',
    ).toContain('Finanças Pessoais');
    expect(a320.marcaLargura, 'a 320 a marca não ocupa largura').toBeLessThanOrEqual(1);

    /* 360 é o limiar do `min-[360px]`: aqui a marca tem de voltar e caber. */
    await page.setViewportSize({ width: 360, height: 640 });
    await page.waitForTimeout(150);

    if (MUTAR === 'limiar') {
      /* Prova: com o limiar mudado, a marca fica em `sr-only` (1 px) e a 360 tem de falhar. */
      await page.evaluate(() => {
        document.querySelector('header > span')?.classList.remove('min-[360px]:not-sr-only');
      });
      await page.waitForTimeout(150);
    }

    const a360 = await medir(page);

    verificar(a360, 360);
    /*
     * 1 px é o que o `sr-only` deixa — e 1 > 0 deixava passar o limiar mudado. O
     * real a 360 é 63 px; 10 separa os dois estados com folga sem ser um número
     * decorado do dia.
     */
    expect(a360.marcaLargura, 'a 360 a marca da app aparece').toBeGreaterThan(10);
  });
});
