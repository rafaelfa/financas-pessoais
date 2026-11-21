import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { lerCredenciais } from './support/dados';
import {
  apagarCartoesDoSpec,
  criarContaAPagarDoSpec,
  criarLancamentosDoSpec,
  limparDadosDoSpec,
} from './support/db';
import {
  abrirRota,
  escolherNoSelect,
  esperarAviso,
  formularioDeLancamentoRapido,
} from './support/ui';

/**
 * Percurso 39 — calendário do mês (T55).
 *
 * Só leitura: quatro fontes, cada item no seu dia, três totais que batem com os
 * itens, a faixa «em atraso» fora dos totais, o mês na URL e as duas vistas
 * (lista a 360, grelha a partir de `sm`).
 *
 * Os dados do cenário levam `T55 prova` e são apagados no `afterAll`.
 */

const PREFIXO = 'T55 prova';

const email = (): string => lerCredenciais().email;

/** Dia do mês corrente (ou de outro mês) como `YYYY-MM-DD`. */
function diaDoMes(dia: number, mesesDeDeslocamento = 0): string {
  const agora = new Date();
  const data = new Date(
    Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + mesesDeDeslocamento, dia),
  );

  return data.toISOString().slice(0, 10);
}

/**
 * Os itens de cada dia, lidos do controlo que abre o dia (T84).
 *
 * A célula deixou de ser `div[role="group"][tabindex="0"]`: passa a `button`
 * com `aria-haspopup="dialog"` e o mesmo nome acessível (data, itens, saldo).
 * O `li` é o âmbito que ainda contém a lista de itens do dia.
 */
async function diasDaGrelha(page: Page) {
  return page.evaluate(() =>
    [
      ...document.querySelectorAll(
        'section[aria-label="Grelha do mês"] li:has(button[aria-haspopup="dialog"])',
      ),
    ].map((dia) => {
      const controlo = dia.querySelector('button[aria-haspopup="dialog"]');

      return {
        nome: controlo?.getAttribute('aria-label') ?? '',
        texto: (dia.textContent ?? '').replace(/\s+/g, ' ').trim(),
        links: [...dia.querySelectorAll('a[href]')].map((a) => a.textContent?.trim() ?? ''),
      };
    }),
  );
}

/** Os três totais, em cêntimos, lidos do cartão. */
async function totais(page: Page) {
  return page.evaluate(() => {
    const cartoes = [...document.querySelectorAll('section[aria-label="Totais do mês"] > div')];
    const centimos = (texto: string) => {
      const m = /(-?\d[\d\s.]*(?:,\d{2})?)\s*€/.exec(texto);
      if (m === null) return null;
      const limpo = m[1].replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
      return Math.round(Number(limpo) * 100);
    };

    return {
      pagar: centimos(cartoes[0]?.textContent ?? ''),
      receber: centimos(cartoes[1]?.textContent ?? ''),
      saldo: centimos(cartoes[2]?.textContent ?? ''),
    };
  });
}

test.describe('calendário do mês (T55)', () => {
  test.afterAll(async () => {
    await limparDadosDoSpec(email(), PREFIXO);
    await apagarCartoesDoSpec(email(), PREFIXO);
  });

  test.beforeAll(async () => {
    /* Uma conta a pagar e uma a receber no mês corrente, para haver itens. */
    await criarContaAPagarDoSpec(email(), `${PREFIXO} conta`, 'PAYABLE', 5000, diaDoMes(10));
    await criarContaAPagarDoSpec(email(), `${PREFIXO} receber`, 'RECEIVABLE', 7000, diaDoMes(15));
    /* O Painel só desenha o bloco «Por arrumar» (a porta) a quem tem dados. */
    await criarLancamentosDoSpec(email(), `${PREFIXO} linha`, 1);
  });

  test('os itens estão no dia certo, com origem, e os totais batem', async ({ page }) => {
    await abrirRota(page, '/calendario');

    const dias = await diasDaGrelha(page);
    const comItens = dias.filter((dia) => !dia.nome.includes('0 itens'));

    expect(comItens.length, 'há dias com itens').toBeGreaterThanOrEqual(2);

    for (const dia of comItens) {
      /* O nome acessível traz data, número de itens e saldo. */
      expect(dia.nome, 'nome do dia com data, itens e saldo').toMatch(/\d+ items?, saldo/);
    }

    const t = await totais(page);
    expect(t.pagar).not.toBeNull();
    expect(t.receber).not.toBeNull();
    expect(t.saldo, 'saldo = receber - pagar').toBe((t.receber ?? 0) - (t.pagar ?? 0));

    /* A soma dos itens dos dias (pela etiqueta de origem) é o total do mês. */
    const todos = await page.evaluate(() => {
      const linhas = [
        ...document.querySelectorAll('section[aria-label="Grelha do mês"] li a[href]'),
      ];

      return linhas.map((a) => a.textContent?.replace(/\s+/g, ' ').trim() ?? '');
    });

    expect(todos.length, 'a grelha mostra os itens dos dias').toBeGreaterThanOrEqual(2);
  });

  test('em atraso: conta de mês anterior na faixa, fora dos totais, e só no mês corrente', async ({
    page,
  }) => {
    await criarContaAPagarDoSpec(email(), `${PREFIXO} vencida`, 'PAYABLE', 6000, diaDoMes(20, -1));

    await abrirRota(page, '/calendario');
    const faixa = page.getByRole('region', { name: 'Em atraso' });
    await expect(faixa).toBeVisible();
    await expect(faixa).toContainText(`${PREFIXO} vencida`);
    await expect(faixa).toContainText('Vencida');

    /* Não aparece nos dias do mês (não duplicada). */
    const dias = await diasDaGrelha(page);
    expect(dias.some((dia) => dia.texto.includes(`${PREFIXO} vencida`))).toBe(false);

    const agora = await totais(page);
    await page.getByRole('link', { name: 'Mês seguinte' }).click();
    await page.waitForTimeout(400);
    await expect(page.getByRole('region', { name: 'Em atraso' })).toHaveCount(0);
    const seguinte = await totais(page);
    expect(seguinte.pagar, 'a faixa não entra nos totais').not.toBe(agora.pagar);
  });

  test('?mes sobrevive, navega e um mês inválido cai no corrente', async ({ page }) => {
    await abrirRota(page, '/calendario?mes=2026-11');
    await expect(page.getByRole('heading', { name: /novembro de 2026/i })).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(/mes=2026-11/);

    await page.getByRole('link', { name: 'Mês seguinte' }).click();
    await expect(page).toHaveURL(/mes=2026-12/);
    await page.getByRole('link', { name: 'Mês anterior' }).click();
    await expect(page).toHaveURL(/mes=2026-11/);

    for (const invalido of ['2026-13', 'abc', '2026-11-30']) {
      await abrirRota(page, `/calendario?mes=${invalido}`);
      await expect(page.getByRole('heading', { name: /novembro de 2026/i })).toBeVisible();
      await expect(page.locator('body')).not.toContainText('Application error');
    }
  });

  test('360: lista por dia sem transbordo; a partir de sm: grelha', async ({ page }) => {
    for (const largura of [360, 1280]) {
      await page.setViewportSize({ width: largura, height: largura === 360 ? 800 : 1000 });
      await abrirRota(page, '/calendario');

      const medida = await page.evaluate(() => {
        const lista = document.querySelector('section[aria-label="Dias do mês em lista"]');
        const grelha = document.querySelector('section[aria-label="Grelha do mês"]');

        return {
          scrollWidth: document.documentElement.scrollWidth,
          viewport: window.innerWidth,
          lista: lista ? getComputedStyle(lista).display !== 'none' : false,
          grelha: grelha ? getComputedStyle(grelha).display !== 'none' : false,
        };
      });

      expect(medida.scrollWidth).toBe(medida.viewport);

      if (largura === 360) {
        expect(medida.lista, 'a 360 vê-se a lista').toBe(true);
        expect(medida.grelha, 'a 360 a grelha está escondida').toBe(false);
      } else {
        expect(medida.grelha, 'a 1280 vê-se a grelha').toBe(true);
        expect(medida.lista, 'a 1280 a lista está escondida').toBe(false);
      }
    }
  });

  test('axe 0 e teclado: dias alcançáveis, vencido dito por palavra', async ({ page }) => {
    for (const largura of [1280, 360]) {
      await page.setViewportSize({ width: largura, height: largura === 360 ? 800 : 1000 });
      await abrirRota(page, '/calendario');

      const resultado = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();

      expect(
        resultado.violations.map((v) => `${largura}: ${v.id} (${v.nodes.length})`),
        `violações no calendário a ${largura}`,
      ).toEqual([]);
    }

    /*
     * Cada dia alcançável por teclado, com o nome acessível certo (T84: o
     * controlo é um `button[aria-haspopup="dialog"]`, focável por natureza).
     */
    await page.setViewportSize({ width: 1280, height: 1000 });
    await abrirRota(page, '/calendario');

    const dias = page.locator('section[aria-label="Grelha do mês"] button[aria-haspopup="dialog"]');
    await expect(dias.first()).toBeVisible();
    await expect(dias.first()).toHaveAttribute('aria-haspopup', 'dialog');
    await dias.first().focus();
    expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))).toMatch(
      /saldo/,
    );

    /*
     * Um dia vazio não tem controlo nenhum — logo não entra na ordem de `Tab`.
     * A grelha é a 1280; a lista a 360 só desenha dias com itens.
     */
    const vazios = await page.evaluate(() => {
      const celulas = [...document.querySelectorAll('section[aria-label="Grelha do mês"] ol > li')];
      const semControlo = celulas.filter((li) => li.querySelector('button') === null);

      return {
        total: celulas.length,
        semControlo: semControlo.length,
        focaveis: [...document.querySelectorAll('section[aria-label="Grelha do mês"] [tabindex]')]
          .length,
      };
    });

    expect(vazios.semControlo, 'há dias vazios na grelha').toBeGreaterThan(0);
    expect(vazios.focaveis, 'nada com tabindex explícito na grelha').toBe(0);

    /* A palavra «Vencida» está no DOM da faixa, não só a cor. */
    await expect(page.getByRole('region', { name: 'Em atraso' })).toContainText('Vencida');
  });

  test('a paleta tem 17 e /calendario está na barra lateral, a seguir a Transações', async ({
    page,
  }) => {
    await abrirRota(page, '/');

    await expect(
      page.getByRole('link', { name: /calendário|calendario/i }).first(),
    ).toHaveAttribute('href', '/calendario');

    const lateral = await page.evaluate(() => {
      const barra = document.querySelector('[data-slot="sidebar"]');
      return barra ? [...barra.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')) : [];
    });

    /* D29: o Calendário entra no «Dia a dia», imediatamente a seguir a Transações. */
    expect(lateral, '/calendario na barra').toContain('/calendario');
    expect(lateral.indexOf('/calendario'), '/calendario depois de Transações').toBe(
      lateral.indexOf('/transacoes') + 1,
    );

    await page.keyboard.press('Control+k');
    const paleta = page.getByRole('dialog');
    await expect(paleta).toBeVisible();
    await expect(paleta.getByRole('option')).toHaveCount(17);
    await expect(paleta.getByRole('option').filter({ hasText: 'Calendário' })).toHaveCount(1);
  });

  test('a cadeia do cartão conta uma vez: a última fatura nos dias, a vencida na faixa', async ({
    page,
  }) => {
    /* Dois cartões: A com a última fatura no mês (105 = 45 + 60 transitados), B com a última vencida. */
    const cartao = async (nome: string) => {
      await abrirRota(page, '/cartoes');
      await page
        .getByRole('button', { name: /Criar o primeiro cartão|Novo cartão/ })
        .first()
        .click();
      const d = page.getByRole('dialog');
      await d.getByLabel('Nome', { exact: true }).fill(nome);
      await d.getByLabel('Dia de fecho', { exact: true }).fill('5');
      await d.getByLabel('Dia de vencimento', { exact: true }).fill('12');
      await d.getByRole('button', { name: 'Criar cartão', exact: true }).click();
      await esperarAviso(page, 'Cartão criado.');
    };

    const comprar = async (nome: string, valor: string, data: string, descricao: string) => {
      await abrirRota(page, '/transacoes');
      const r = formularioDeLancamentoRapido(page);
      await r.getByRole('radio', { name: 'Gasto', exact: true }).click();
      await r.getByRole('radio', { name: 'Cartão de crédito', exact: true }).click();
      await r.getByLabel('Cartão', { exact: true }).click();
      await page.getByRole('option', { name: nome, exact: true }).first().click();
      await escolherNoSelect(r.getByLabel('Categoria', { exact: true }), 'Alimentação');
      await r.getByLabel('Valor', { exact: true }).fill(valor);
      await r.getByLabel('Data', { exact: true }).fill(data);
      await r.getByLabel('Descrição', { exact: true }).fill(descricao);
      await r.getByRole('button', { name: 'Lançar', exact: true }).click();
      await esperarAviso(page, 'Gasto registado.');
    };

    await cartao(`${PREFIXO} cartão A`);
    await comprar(`${PREFIXO} cartão A`, '60,00', '2026-09-15', `${PREFIXO} A setembro`);
    await comprar(`${PREFIXO} cartão A`, '45,00', '2026-10-15', `${PREFIXO} A outubro`);
    await cartao(`${PREFIXO} cartão B`);
    await comprar(`${PREFIXO} cartão B`, '70,00', '2026-08-15', `${PREFIXO} B agosto`);

    await abrirRota(page, '/calendario?mes=2026-11');

    /* A faixa mostra só o B; a fatura de setembro do A não aparece como dívida separada. */
    const faixa = page.getByRole('region', { name: 'Em atraso' });
    await expect(faixa).toContainText(`${PREFIXO} cartão B`);
    await expect(faixa).not.toContainText(`${PREFIXO} cartão A`);

    /* A fatura do A aparece uma vez, nos dias, com o valor da cadeia (105,00 €). */
    const dias = await page.evaluate(() =>
      [
        ...document.querySelectorAll(
          'section[aria-label="Grelha do mês"] li:has(button[aria-haspopup="dialog"])',
        ),
      ]
        .map((d) => d.textContent?.replace(/\s+/g, ' ').trim() ?? '')
        .filter((t) => t.includes('Fatura')),
    );
    expect(dias.filter((t) => t.includes(`${PREFIXO} cartão A`))).toHaveLength(1);
    expect(dias.join(' ')).toContain('105,00 €');
  });
});
