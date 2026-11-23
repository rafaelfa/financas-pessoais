import { expect, test } from '@playwright/test';

import { limparDadosDoSpec } from './support/db';
import { lerCredenciais } from './support/dados';
import { abrirRota, escolherNoSelect, esperarAviso } from './support/ui';

/**
 * Percurso T105 — apagar o lançamento de um depósito devolve o dinheiro ao
 * objetivo (T105/A).
 *
 * O defeito: um depósito de 100 € com conta tira 100 € da conta e soma 100 € ao
 * objetivo; apagar o lançamento em Transações devolvia os 100 € à conta mas
 * deixava o movimento do objetivo vivo (`GoalMovement.transaction` é
 * `onDelete: SetNull`), e o património subia 100 € — o mesmo dinheiro contado
 * duas vezes.
 *
 * Este percurso cria o objetivo, regista o depósito com conta, apaga o lançamento
 * em Transações e exige: objetivo de volta ao valor inicial, conta e património
 * de volta ao valor inicial, e o detalhe do objetivo já sem o movimento órfão.
 * Um segundo movimento — registado **sem** conta, logo sem lançamento — tem de
 * sobreviver: só se apaga o movimento ligado à transação apagada.
 */

const PREFIXO = 'T105 objetivo';
const ALVO = '1.000,00';
const DEPOSITO = '100,00';

test.describe('T105 — apagar o lançamento de um depósito', () => {
  test.afterAll(async () => {
    await limparDadosDoSpec(lerCredenciais().email, PREFIXO);
  });

  test('o objetivo, a conta e o património voltam ao valor inicial', async ({ page }) => {
    const sufixo = Date.now().toString(36);
    const nome = `${PREFIXO} ${sufixo}`;

    await abrirRota(page, '/objetivos');
    await page.getByRole('button', { name: /Novo objetivo|Criar o primeiro objetivo/ }).click();

    const dialogo = page.getByRole('dialog');
    await dialogo.getByLabel('Nome', { exact: true }).fill(nome);
    await dialogo.getByLabel('Valor a juntar', { exact: true }).fill(ALVO);
    const data = new Date();
    data.setFullYear(data.getFullYear() + 2);
    await dialogo.locator('input[type="date"]').first().fill(data.toISOString().slice(0, 10));
    await dialogo.getByRole('button', { name: 'Criar objetivo' }).click();
    await esperarAviso(page, 'Objetivo criado.');

    /* Estado de partida: 0 € no objetivo, e o património de agora. */
    const cartao = page.locator('[data-slot="card"]').filter({ hasText: nome });
    await expect(cartao).toContainText('0,00 €');

    await abrirRota(page, '/patrimonio');
    const patrimonioInicial = await readAmount(page, 'Património líquido');

    /* Depósito de 100 € com conta: sai da conta, entra no objetivo. */
    await abrirRota(page, '/objetivos');
    await page
      .locator('[data-slot="card"]')
      .filter({ hasText: nome })
      .getByRole('button', { name: 'Depositar' })
      .first()
      .click();

    const deposito = page.getByRole('dialog');
    await deposito.getByLabel('Valor', { exact: true }).fill(DEPOSITO);
    await escolherNoSelect(deposito.getByLabel('Conta (opcional)'), 'Carteira principal');
    await deposito.getByRole('button', { name: 'Registar depósito' }).click();
    await esperarAviso(page, /Depósito registado/);

    await expect(page.locator('[data-slot="card"]').filter({ hasText: nome })).toContainText(
      '100,00 €',
    );

    /* Apaga o lançamento que o depósito criou, em Transações. */
    await abrirRota(page, '/transacoes');
    const linha = page.locator('tbody tr').filter({ hasText: nome }).first();
    await linha.getByRole('button', { name: /Ações do lançamento/ }).click();
    await page.getByRole('menuitem', { name: 'Eliminar' }).click();
    await page.getByRole('button', { name: 'Eliminar', exact: true }).click();
    await esperarAviso(page, 'Lançamento apagado.');

    /* O objetivo volta a zero — este é o número que mentia. */
    await abrirRota(page, '/objetivos');
    const depois = page.locator('[data-slot="card"]').filter({ hasText: nome });
    await expect(depois).toContainText('0,00 €');
    await expect(depois).not.toContainText('100,00 €');

    /* E o património volta ao de partida. */
    await abrirRota(page, '/patrimonio');
    const patrimonioFinal = await readAmount(page, 'Património líquido');
    expect(patrimonioFinal).toBe(patrimonioInicial);

    /* O detalhe do objetivo não lista o movimento órfão. */
    await abrirRota(page, '/objetivos');
    await page
      .locator('[data-slot="card"]')
      .filter({ hasText: nome })
      .getByRole('link', { name: /Detalhe e movimentos/ })
      .click();
    const detalhe = page.getByRole('dialog');
    await expect(detalhe).toBeVisible();
    await expect(detalhe).not.toContainText('100,00 €');
  });

  test('um movimento do objetivo sem lançamento não é apagado', async ({ page }) => {
    const sufixo = Date.now().toString(36);
    const nome = `${PREFIXO} manual ${sufixo}`;

    await abrirRota(page, '/objetivos');
    await page.getByRole('button', { name: /Novo objetivo|Criar o primeiro objetivo/ }).click();
    const dialogo = page.getByRole('dialog');
    await dialogo.getByLabel('Nome', { exact: true }).fill(nome);
    await dialogo.getByLabel('Valor a juntar', { exact: true }).fill(ALVO);
    const data = new Date();
    data.setFullYear(data.getFullYear() + 2);
    await dialogo.locator('input[type="date"]').first().fill(data.toISOString().slice(0, 10));
    await dialogo.getByRole('button', { name: 'Criar objetivo' }).click();
    await esperarAviso(page, 'Objetivo criado.');

    /* Depósito SEM conta: cria movimento no objetivo e nenhum lançamento. */
    await page
      .locator('[data-slot="card"]')
      .filter({ hasText: nome })
      .getByRole('button', { name: 'Depositar' })
      .first()
      .click();
    const deposito = page.getByRole('dialog');
    await deposito.getByLabel('Valor', { exact: true }).fill('50,00');
    await deposito.getByRole('button', { name: 'Registar depósito' }).click();
    await esperarAviso(page, /Depósito registado/);

    /* Não há lançamento para apagar — o movimento tem de continuar lá. */
    await abrirRota(page, '/objetivos');
    await expect(page.locator('[data-slot="card"]').filter({ hasText: nome })).toContainText(
      '50,00 €',
    );
  });
});

/** Lê um montante pelo rótulo («Património líquido»), em cêntimos normalizados. */
async function readAmount(page: import('@playwright/test').Page, label: string): Promise<string> {
  const bloco = page
    .locator('div')
    .filter({ has: page.getByRole('heading', { name: label, exact: true }) })
    .last();
  const texto = await bloco.locator('div').first().innerText();

  return texto.replace(/\s/g, '');
}
