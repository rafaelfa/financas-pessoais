import { expect, test, type Page } from '@playwright/test';

import { lerCredenciais } from './support/dados';
import {
  apagarCartoesDoSpec,
  criarCartaoDoSpec,
  criarContaAPagarDoSpec,
  criarContaDoSpec,
  lerPorDescricao,
  limparDadosDoSpec,
} from './support/db';
import {
  abrirRota,
  escolherNoSelect,
  esperarAviso,
  formularioDeLancamentoRapido,
} from './support/ui';

/**
 * Percurso 84 — o painel de dia do calendário (T84).
 *
 * Cobre o que a T84 acrescentou e o que pode desaparecer sem ninguém dar por
 * isso: a **célula inteira** abrir o dia (o `onClick` que ignora as ligações),
 * o caminho de teclado, os dois grupos de itens, e o **lançamento com a data do
 * dia** (`initialDate`), com o saldo do dia a não mexer.
 *
 * Se o `onClick` da célula desaparecer, o primeiro teste falha (não abre); se o
 * `initialDate` desaparecer, o terceiro falha duas vezes: o campo «Data» deixa
 * de vir preenchido com o dia e o movimento cai em «hoje» em vez de «Já
 * liquidado» do dia.
 *
 * Os dados levam `T84 dia` e são apagados no `afterAll`. A 390 a grelha está
 * escondida e o dia abre pelo cartão da lista; a 1440 pelo botão da célula.
 */

const PREFIXO = 'T84 dia';
const MES = '2027-03';
const DIA = '2027-03-13';
const DIA_LONGO = /13 de março/;
/* Dia do caminho do cartão e da transferência; o saldo do dia é o desta conta. */
const DIA_CARTAO_LONGO = /15 de março/;
const SALDO_DO_DIA = /saldo\s*-10,06\s*€/;

test.use({ viewport: { width: 390, height: 844 } });
test.describe.configure({ mode: 'serial' });

const email = (): string => lerCredenciais().email;

/** O cartão do dia na lista móvel (a vista que existe a 390). */
function cartaoDoDia(page: Page) {
  return page
    .locator('section[aria-label="Dias do mês em lista"] li')
    .filter({ has: page.getByRole('button', { name: DIA_LONGO }) })
    .first();
}

/** Os três totais do cartão do mês, tal como estão escritos no ecrã. */
async function totaisDoMes(page: Page): Promise<string[]> {
  /*
   * A **primeira** secção: durante uma transição o Next pode deixar duas no DOM
   * (a antiga e a nova) e as duas trazem os mesmos três números. Ler a primeira e
   * exigir três valores evita comparar uma lista de seis com uma de três.
   */
  return page.evaluate(() => {
    const seccao = document.querySelector('section[aria-label="Totais do mês"]');

    return [...(seccao?.children ?? [])].map((d) =>
      (d.textContent ?? '').replace(/\s+/g, ' ').trim(),
    );
  });
}

/** Abre o dia 15 pelo controlo (a lista a 390, a grelha a 1440). */
async function abrirDia15(page: Page): Promise<void> {
  const controlo = page.getByRole('button', { name: DIA_CARTAO_LONGO }).first();
  await controlo.scrollIntoViewIfNeeded();
  await controlo.click();
  await expect(dialogo(page)).toBeVisible();
}

function dialogo(page: Page) {
  return page.getByRole('dialog');
}

test.describe('painel de dia do calendário (T84)', () => {
  test.beforeAll(async () => {
    /* Duas contas a pagar no dia 13: o dia tem 2 itens e saldo -30,00 €. */
    await criarContaAPagarDoSpec(email(), `${PREFIXO} água`, 'PAYABLE', 1000, DIA);
    await criarContaAPagarDoSpec(email(), `${PREFIXO} luz`, 'PAYABLE', 2000, DIA);
    /* Dia 15: uma conta a pagar de 10,06 € (saldo do dia -10,06 €), um cartão e
     * uma segunda conta para a transferência. */
    await criarContaAPagarDoSpec(email(), `${PREFIXO} cartão conta`, 'PAYABLE', 1006, '2027-03-15');
    await criarCartaoDoSpec({
      email: email(),
      nome: `${PREFIXO} cartão`,
      fechoDia: 20,
      vencimentoDia: 5,
    });
    await criarContaDoSpec(email(), `${PREFIXO} poupança`);
  });

  test.afterAll(async () => {
    await limparDadosDoSpec(email(), PREFIXO);
    await apagarCartoesDoSpec(email(), PREFIXO);
  });

  test('abre por toque na célula (fora do botão e das ligações) e mostra «Por liquidar»', async ({
    page,
  }) => {
    await abrirRota(page, `/calendario?mes=${MES}`);

    const cartao = cartaoDoDia(page);
    await expect(cartao).toBeVisible();

    /*
     * O toque é no canto inferior esquerdo do cartão — dentro do `onClick` da
     * célula, fora do botão do topo e fora das ligações dos itens. Se o handler
     * da célula desaparecer, aqui não abre nada e o teste falha.
     */
    const caixa = await cartao.boundingBox();
    expect(caixa, 'o cartão do dia tem caixa').not.toBeNull();
    await cartao.click({ position: { x: 8, y: (caixa?.height ?? 48) - 8 } });

    const d = dialogo(page);
    await expect(d).toBeVisible();
    await expect(d.getByRole('heading', { name: DIA_LONGO })).toBeVisible();

    const porLiquidar = d.getByRole('region', { name: 'Por liquidar' });
    await expect(porLiquidar).toBeVisible();
    await expect(porLiquidar.getByRole('listitem')).toHaveCount(2);
    await expect(porLiquidar).toContainText(`${PREFIXO} água`);
    await expect(porLiquidar).toContainText(`${PREFIXO} luz`);

    /* Ainda não há liquidados: o grupo não é desenhado. */
    await expect(d.getByRole('region', { name: 'Já liquidado' })).toHaveCount(0);

    /* O saldo do dia é o dos itens por liquidar. */
    await expect(d.locator('[data-slot="dialog-description"]')).toContainText(/saldo\s*-30,00\s*€/);
  });

  test('abre pelo teclado: nome acessível, Enter e Espaço', async ({ page }) => {
    await abrirRota(page, `/calendario?mes=${MES}`);

    const controlo = page.getByRole('button', { name: DIA_LONGO });
    await expect(controlo).toHaveAttribute('aria-haspopup', 'dialog');
    /* O nome acessível traz a data, o número de itens e o saldo. */
    await expect(controlo).toHaveAttribute('aria-label', /2 itens, saldo\s*-30,00\s*€/);

    for (const tecla of ['Enter', ' ']) {
      await controlo.focus();
      await page.keyboard.press(tecla);
      await expect(dialogo(page)).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(dialogo(page)).toHaveCount(0);
    }
  });

  test('lança com a data do dia, o item cai em «Já liquidado» e o saldo do dia não muda', async ({
    page,
  }) => {
    await abrirRota(page, `/calendario?mes=${MES}`);

    const cartao = cartaoDoDia(page);
    const caixa = await cartao.boundingBox();
    await cartao.click({ position: { x: 8, y: (caixa?.height ?? 48) - 8 } });

    const d = dialogo(page);
    await expect(d).toBeVisible();
    const descricao = d.locator('[data-slot="dialog-description"]');
    await expect(descricao).toContainText(/saldo\s*-30,00\s*€/);

    await d.getByRole('button', { name: 'Lançar neste dia' }).click();

    /* O formulário é o mesmo de /transacoes, com a data do dia (initialDate). */
    const valor = d.getByLabel('Valor', { exact: true });
    await expect(d.getByLabel('Data', { exact: true })).toHaveValue(DIA);
    await expect(d.getByRole('heading', { name: /Lançar em .*13 de março/ })).toHaveCount(1);

    await valor.fill('12,34');
    await valor.press('Enter');
    await d.getByLabel('Descrição', { exact: true }).fill(`${PREFIXO} lançamento`);
    await escolherNoSelect(d.getByLabel('Categoria', { exact: true }), 'Alimentação');
    await d.getByRole('button', { name: 'Lançar', exact: true }).click();

    await esperarAviso(page, 'Gasto registado.');

    /* Depois do refresh o diálogo volta ao dia: os dois grupos, com o novo item. */
    await expect(d.getByRole('heading', { name: DIA_LONGO })).toBeVisible();
    const porLiquidar = d.getByRole('region', { name: 'Por liquidar' });
    const jaLiquidado = d.getByRole('region', { name: 'Já liquidado' });
    await expect(porLiquidar.getByRole('listitem')).toHaveCount(2);
    await expect(jaLiquidado.getByRole('listitem')).toHaveCount(1);
    await expect(jaLiquidado).toContainText(`${PREFIXO} lançamento`);
    await expect(porLiquidar).not.toContainText(`${PREFIXO} lançamento`);

    /* O saldo do dia continua a ser o dos itens por liquidar: não muda. */
    await expect(descricao).toContainText(/saldo\s*-30,00\s*€/);
  });

  test('um dia vazio não tem controlo, não abre por toque e fica fora do Tab', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await abrirRota(page, `/calendario?mes=${MES}`);

    const vazia = page
      .locator('section[aria-label="Grelha do mês"] ol > li')
      .filter({ hasText: /^20$/ })
      .first();
    await expect(vazia).toBeVisible();

    /* Sem controlo nenhum dentro da célula. */
    await expect(vazia.getByRole('button')).toHaveCount(0);
    await expect(vazia.locator('a')).toHaveCount(0);

    /* Nada na grelha tem `tabindex` explícito (os botões são focáveis por natureza). */
    const comTabindex = await page.evaluate(
      () => document.querySelectorAll('section[aria-label="Grelha do mês"] [tabindex]').length,
    );
    expect(comTabindex, 'nada com tabindex na grelha').toBe(0);

    /* Um toque no centro da célula vazia não abre diálogo. */
    const caixa = await vazia.boundingBox();
    expect(caixa).not.toBeNull();
    await page.mouse.click(
      (caixa?.x ?? 0) + (caixa?.width ?? 0) / 2,
      (caixa?.y ?? 0) + (caixa?.height ?? 0) / 2,
    );
    await expect(dialogo(page)).toHaveCount(0);
  });

  test('uma compra a crédito cai em «No cartão», não soma e regressa ao dia', async ({ page }) => {
    await abrirRota(page, `/calendario?mes=${MES}`);
    const totaisAntes = await totaisDoMes(page);
    expect(totaisAntes).toHaveLength(3);
    await abrirDia15(page);

    const d = dialogo(page);
    const descricao = d.locator('[data-slot="dialog-description"]');
    await expect(descricao).toContainText(SALDO_DO_DIA);
    await expect(d.getByRole('region', { name: 'No cartão' })).toHaveCount(0);

    await d.getByRole('button', { name: 'Lançar neste dia' }).click();
    await d.getByRole('radio', { name: 'Cartão de crédito', exact: true }).click();

    const valor = d.getByLabel('Valor', { exact: true });
    await expect(d.getByLabel('Data', { exact: true })).toHaveValue('2027-03-15');
    await valor.fill('99,90');
    await valor.press('Enter');
    await d.getByLabel('Descrição', { exact: true }).fill(`${PREFIXO} compra crédito`);
    await escolherNoSelect(d.getByLabel('Cartão', { exact: true }), `${PREFIXO} cartão`);
    await escolherNoSelect(d.getByLabel('Categoria', { exact: true }), 'Alimentação');
    await d.getByRole('button', { name: 'Lançar', exact: true }).click();

    await esperarAviso(page, 'Gasto registado.');

    /* (1) O diálogo voltou ao dia e a compra está em «No cartão», com a fatura. */
    await expect(d.getByRole('heading', { name: DIA_CARTAO_LONGO })).toBeVisible();
    const noCartao = d.getByRole('region', { name: 'No cartão' });
    await expect(noCartao.getByRole('listitem')).toHaveCount(1);
    await expect(noCartao).toContainText(`${PREFIXO} compra crédito`);
    await expect(noCartao).toContainText(/entra na fatura/);

    /* Não aparece nos outros dois grupos. */
    await expect(d.getByRole('region', { name: 'Por liquidar' })).not.toContainText(
      `${PREFIXO} compra crédito`,
    );
    await expect(d.getByRole('region', { name: 'Já liquidado' })).toHaveCount(0);

    /* (2) O saldo do dia e os três totais do mês não mudam. */
    await expect(descricao).toContainText(SALDO_DO_DIA);
    expect(await totaisDoMes(page), 'os três totais do mês iguais').toEqual(totaisAntes);

    /* (3) A base tem a linha com `settled = false` e `invoiceId` preenchido. */
    const naBase = await lerPorDescricao(email(), `${PREFIXO} compra crédito`);
    expect(naBase).toHaveLength(1);
    expect(naBase[0]?.amountInCents).toBe(-9990);
    expect(naBase[0]?.settled, 'a compra a crédito não está liquidada').toBe(false);
    expect(naBase[0]?.invoiceId, 'a compra entrou numa fatura').not.toBeNull();
  });

  test('uma transferência dá uma linha de 0,00 € e duas pernas na base', async ({ page }) => {
    await abrirRota(page, `/calendario?mes=${MES}`);
    const totaisAntes = await totaisDoMes(page);
    await abrirDia15(page);

    const d = dialogo(page);
    const descricao = d.locator('[data-slot="dialog-description"]');
    await expect(descricao).toContainText(SALDO_DO_DIA);

    await d.getByRole('button', { name: 'Lançar neste dia' }).click();
    await d.getByRole('radio', { name: 'Transferência', exact: true }).click();
    const valor = d.getByLabel('Valor', { exact: true });
    await valor.fill('25,00');
    await valor.press('Enter');
    await d.getByLabel('Descrição', { exact: true }).fill(`${PREFIXO} transferência`);
    /* A conta de destino começa vazia (achado fora do âmbito); escolhe-se à mão. */
    await escolherNoSelect(d.getByLabel('Para a conta', { exact: true }), `${PREFIXO} poupança`);
    await d.getByRole('button', { name: 'Transferir', exact: true }).click();

    await esperarAviso(page, 'Transferência registada nas duas contas.');

    /* (4) Uma só linha «Transferência», a 0,00 €, em «Já liquidado». */
    await expect(d.getByRole('heading', { name: DIA_CARTAO_LONGO })).toBeVisible();
    const jaLiquidado = d.getByRole('region', { name: 'Já liquidado' });
    await expect(jaLiquidado.getByRole('listitem')).toHaveCount(1);
    await expect(jaLiquidado).toContainText('Transferência');
    await expect(jaLiquidado).toContainText(/0,00\s*€/);
    await expect(jaLiquidado).toContainText(`${PREFIXO} transferência`);

    /* As duas pernas têm o mesmo grupo; o dia não ganha nem perde. */
    const pernas = await lerPorDescricao(email(), `${PREFIXO} transferência`);
    expect(pernas).toHaveLength(2);
    expect(pernas.map((p) => p.amountInCents).sort((a, b) => a - b)).toEqual([-2500, 2500]);
    expect(pernas[0]?.transferGroupId).not.toBeNull();
    expect(pernas[1]?.transferGroupId).toBe(pernas[0]?.transferGroupId);
    await expect(descricao).toContainText(SALDO_DO_DIA);
    expect(await totaisDoMes(page), 'os três totais do mês iguais').toEqual(totaisAntes);
  });

  test('um pagamento de fatura cai em «Já liquidado» e não em «No cartão»', async ({ page }) => {
    /*
     * O pagamento de fatura é um `INVOICE_PAYMENT` com `invoiceId` **e**
     * `settled: true`. Sem a exceção no servidor caía em «No cartão» (o grupo das
     * compras) e não aparecia em «Já liquidado» — este teste exige as duas coisas
     * ao contrário: a linha em «Já liquidado» e `No cartão` a zero.
     */
    await abrirRota(page, `/calendario?mes=${MES}`);
    const totaisAntes = await totaisDoMes(page);
    expect(totaisAntes).toHaveLength(3);

    /* Uma compra no cartão datada de 10/03: fatura fecha a 20/03 e vence a 05/04. */
    await abrirRota(page, '/transacoes');
    const formulario = formularioDeLancamentoRapido(page);
    await formulario.getByRole('radio', { name: 'Cartão de crédito', exact: true }).click();
    const valorCompra = formulario.getByLabel('Valor', { exact: true });
    await valorCompra.fill('10,00');
    await valorCompra.press('Enter');
    await formulario.getByLabel('Data', { exact: true }).fill('2027-03-10');
    await formulario.getByLabel('Descrição', { exact: true }).fill(`${PREFIXO} compra 10/03`);
    await escolherNoSelect(formulario.getByLabel('Cartão', { exact: true }), `${PREFIXO} cartão`);
    await escolherNoSelect(formulario.getByLabel('Categoria', { exact: true }), 'Alimentação');
    await formulario.getByRole('button', { name: 'Lançar', exact: true }).click();
    await esperarAviso(page, 'Gasto registado.');

    /* O dia só tem compras no cartão: é controlo, conta 0 por liquidar e abre. */
    await abrirRota(page, `/calendario?mes=${MES}`);
    const controlo10 = page.getByRole('button', { name: /10 de março/ }).first();
    await expect(controlo10).toHaveAttribute('aria-label', /0 itens, saldo 0,00\s*€/);
    await controlo10.click();

    let d = dialogo(page);
    await expect(d.getByRole('heading', { name: /10 de março/ })).toBeVisible();
    const noCartaoAntes = d.getByRole('region', { name: 'No cartão' });
    await expect(noCartaoAntes.getByRole('listitem')).toHaveCount(1);
    await expect(noCartaoAntes).toContainText(`${PREFIXO} compra 10/03`);
    await expect(noCartaoAntes).toContainText(/entra na fatura/);
    await expect(d.getByRole('region', { name: 'Já liquidado' })).toHaveCount(0);
    await pEscape(page);

    /* Paga a fatura em /cartoes, com data dentro de março para o dia ser fixo. */
    await abrirRota(page, '/cartoes');
    await page
      .getByRole('button', { name: /Pagar fatura/i })
      .first()
      .click();
    const pagar = dialogo(page);
    await expect(pagar.getByRole('heading', { name: /Pagar a fatura/ })).toBeVisible();
    await pagar.getByLabel('Data do pagamento', { exact: true }).fill('2027-03-21');
    /*
     * A nota passa a ser a descrição do `INVOICE_PAYMENT` (o servidor usa
     * `notes ?? 'Pagamento da fatura de …'`). Sem ela, a linha não caía em
     * `limparDadosDoSpec` — que só apaga descrições `T84 dia%` — e sobrava uma
     * liquidação órfã no dia 21/03: a segunda corrida encontrava 2.
     */
    await pagar.getByLabel('Nota', { exact: true }).fill(`${PREFIXO} pagamento`);
    await pagar.getByRole('button', { name: /^Pagar fatura$/ }).click();
    await esperarAviso(page, 'Fatura paga.');

    /* A compra passa a «saiu» na fatura. */
    await abrirRota(page, `/calendario?mes=${MES}`);
    await page
      .getByRole('button', { name: /10 de março/ })
      .first()
      .click();
    d = dialogo(page);
    const noCartaoDepois = d.getByRole('region', { name: 'No cartão' });
    await expect(noCartaoDepois.getByRole('listitem')).toHaveCount(1);
    await expect(noCartaoDepois).toContainText(/saiu na fatura/);
    await pEscape(page);

    /* O dia do pagamento: em «Já liquidado», com o rótulo, e NADA em «No cartão». */
    await page
      .getByRole('button', { name: /21 de março/ })
      .first()
      .click();
    d = dialogo(page);
    await expect(d.getByRole('heading', { name: /21 de março/ })).toBeVisible();
    const jaLiquidado = d.getByRole('region', { name: 'Já liquidado' });
    await expect(jaLiquidado.getByRole('listitem')).toHaveCount(1);
    await expect(jaLiquidado).toContainText(/Pagamento de fatura liquidado/);
    await expect(jaLiquidado).toContainText(`${PREFIXO} pagamento`);
    await expect(d.getByRole('region', { name: 'No cartão' })).toHaveCount(0);
    await expect(d.locator('[data-slot="dialog-description"]')).toContainText(
      /0 itens por liquidar · 1 já liquidado/,
    );

    /* Nada disto soma: os três totais do mês iguais. */
    await pEscape(page);
    expect(await totaisDoMes(page), 'os três totais do mês iguais').toEqual(totaisAntes);
  });
});

/** Fecha o diálogo com Escape e espera que saia do DOM. */
async function pEscape(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(dialogo(page)).toHaveCount(0);
}
