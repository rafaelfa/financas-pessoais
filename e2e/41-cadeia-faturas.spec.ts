import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { lerCredenciais } from './support/dados';
import {
  apagarCartoesDoSpec,
  criarCartaoDoSpec,
  criarCompraNaFaturaDoSpec,
  criarFaturaDoSpec,
  lerFaturasDoCartao,
  limparDadosDoSpec,
  moverFechoDaFatura,
} from './support/db';
import { abrirRota } from './support/ui';

/**
 * Percurso 41 — a regra «última fatura da cadeia» num sítio só (T61).
 *
 * O empate de vencimentos (cartão com `closingDay 31`/`dueDay 1`: janeiro e
 * fevereiro vencem no mesmo 01/02) **não se constrói pelo ecrã** — o formulário
 * não cria faturas, só o motor a partir de compras, e as compras caem sempre em
 * meses diferentes. Monta-se com as **fixtures com nome** de `support/db.ts`
 * (`criarCartaoDoSpec`, `criarFaturaDoSpec`, `criarCompraNaFaturaDoSpec`): cada
 * uma escreve os campos que o produto escreveria e não aceita SQL à escolha de
 * quem chama — foi o que a T67 fechou. As asserções leem o ecrã.
 *
 * A regra escolhe pela `closingDate`: no empate conta **fevereiro** (105,00 €),
 * e não a primeira que aparecer na ordem de vencimento (60,00 €).
 */

const PREFIXO = 'T61 prova';
/*
 * Nome único por corrida: com `--repeat-each`, o `beforeAll` volta a correr com o
 * cartão da passagem anterior ainda na base (o `afterAll` só corre no fim) e o
 * nome fixo colidia em `credit_card_userId_name_key`. O prefixo continua a ser o
 * da limpeza.
 */
const CARTAO = `${PREFIXO} cartão ${Date.now().toString(36)}`;

const email = (): string => lerCredenciais().email;

function cartaoDaRevisao(page: Page) {
  return page.locator('main ul li a').nth(3);
}

async function faturasDaRevisao(page: Page): Promise<number> {
  return cartaoDaRevisao(page).evaluate((link) => {
    const grande = [...link.querySelectorAll('span')].find((s) => s.className.includes('text-3xl'));
    return grande ? Number(grande.textContent ?? '0') : 0;
  });
}

async function diasDoCalendario(page: Page, mes: string) {
  await abrirRota(page, `/calendario?mes=${mes}`);
  return page.evaluate(() =>
    [...document.querySelectorAll('section[aria-label="Grelha do mês"] [role="group"]')]
      .map((d) => d.textContent?.replace(/\s+/g, ' ').trim() ?? '')
      .filter((texto) => texto.includes('Fatura')),
  );
}

test.describe('empate de vencimentos: a regra escolhe pela closingDate (T61)', () => {
  let cartaoId = '';
  let janeiroId = '';
  let fevereiroId = '';

  test.beforeAll(async () => {
    cartaoId = await criarCartaoDoSpec({
      email: email(),
      nome: CARTAO,
      fechoDia: 31,
      vencimentoDia: 1,
    });

    /* As duas faturas vencem no mesmo dia — é o empate. */
    janeiroId = await criarFaturaDoSpec({
      cartaoId,
      fecho: '2026-01-31',
      vence: '2026-02-01',
      totalInCents: 6000,
    });
    fevereiroId = await criarFaturaDoSpec({
      cartaoId,
      fecho: '2026-02-28',
      vence: '2026-02-01',
      totalInCents: 10500,
    });

    await criarCompraNaFaturaDoSpec({
      cartaoId,
      faturaId: janeiroId,
      descricao: `${PREFIXO} compra janeiro`,
      valorInCents: 6000,
      data: '2026-01-15',
    });
    await criarCompraNaFaturaDoSpec({
      cartaoId,
      faturaId: fevereiroId,
      descricao: `${PREFIXO} compra fevereiro`,
      valorInCents: 4500,
      data: '2026-02-15',
    });
  });

  test.afterAll(async () => {
    await limparDadosDoSpec(email(), PREFIXO);
    await apagarCartoesDoSpec(email(), PREFIXO);
  });

  test('no empate conta a última fatura (105,00 €), a mesma nos dois ecrãs', async ({ page }) => {
    const faturas = await lerFaturasDoCartao(cartaoId);

    expect(faturas.map((f) => f.vence)).toEqual(['2026-02-01', '2026-02-01']);
    expect(faturas.map((f) => f.fecho)).toEqual(['2026-01-31', '2026-02-28']);

    await abrirRota(page, '/revisao');
    expect(await faturasDaRevisao(page), 'a Revisão conta uma fatura por cartão').toBe(1);

    const dias = await diasDoCalendario(page, '2026-02');
    expect(dias, 'o calendário mostra uma fatura do cartão').toHaveLength(1);
    expect(dias[0], 'e é a de fevereiro, com 105,00 €').toContain('105,00 €');
    expect(dias[0]).not.toContain('60,00 €');

    /* A fatura que os dois ecrãs usam — pela closingDate — é a de fevereiro. */
    const escolhida = faturas.find((f) => f.fecho === '2026-02-28');

    expect(escolhida?.id).toBe(fevereiroId);
    expect(escolhida?.id).not.toBe(janeiroId);
  });

  test('com fevereiro por fechar, os dois dão 0 e o calendário não mostra o cartão', async ({
    page,
  }) => {
    /*
     * A fatura é a mesma do `beforeAll` (o cenário é este cartão), por isso o
     * fecho é reposto no fim: sem isto o teste de `axe`, que corre a seguir,
     * olhava para um estado diferente e o ficheiro passava a depender da ordem.
     */
    await moverFechoDaFatura({
      email: email(),
      faturaId: fevereiroId,
      fecho: '2026-12-31',
      vence: '2027-01-01',
    });

    try {
      await abrirRota(page, '/revisao');
      expect(await faturasDaRevisao(page), 'a dívida transitada espera o fecho').toBe(0);

      expect(await diasDoCalendario(page, '2026-02'), 'fevereiro já não vence aí').toEqual([]);
      expect(await diasDoCalendario(page, '2027-01'), 'nem há fatura em janeiro de 2027').toEqual(
        [],
      );
    } finally {
      await moverFechoDaFatura({
        email: email(),
        faturaId: fevereiroId,
        fecho: '2026-02-28',
        vence: '2026-02-01',
      });
    }
  });

  test('axe 0 em /revisao e no calendário, a 1280 e a 360', async ({ page }) => {
    for (const largura of [1280, 360]) {
      await page.setViewportSize({ width: largura, height: largura === 360 ? 800 : 1000 });

      for (const rota of ['/revisao', '/calendario?mes=2026-02']) {
        await abrirRota(page, rota);
        const resultado = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze();

        expect(
          resultado.violations.map((v) => `${largura} ${rota}: ${v.id} (${v.nodes.length})`),
          `violações a ${largura} em ${rota}`,
        ).toEqual([]);

        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(largura);
      }
    }
  });
});
