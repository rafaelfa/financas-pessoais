import { expect, test } from '@playwright/test';

import { CONTA_PRINCIPAL } from './support/dados';
import {
  abrirRota,
  cartaoDoObjetivo,
  deslocarDias,
  escolherNoSelect,
  esperarAviso,
  hojeEmLisboa,
  lerSaldoDaConta,
} from './support/ui';

/**
 * Percurso 4 — objetivo: criar, aportar, ver o progresso e apagar o movimento.
 *
 * O aporte é feito **com conta**: é o caminho que também cria um lançamento e
 * move o saldo. Apagar o movimento tem de desfazer as duas coisas, e é isso que
 * se mede no fim — o saldo volta ao valor inicial.
 */

test.describe('Percurso 4 — objetivo de poupança', () => {
  test('criar, aportar, ver o progresso e apagar o movimento devolve o saldo', async ({ page }) => {
    const sufixo = Date.now().toString(36);
    const nome = `E2E objetivo ${sufixo}`;
    const prazo = deslocarDias(hojeEmLisboa(), 300);

    await abrirRota(page, '/contas');
    const saldoAntes = await lerSaldoDaConta(page);

    await abrirRota(page, '/objetivos');
    await page.getByRole('button', { name: /Criar o primeiro objetivo|Novo objetivo/ }).click();

    const dialogo = page.getByRole('dialog');

    await dialogo.getByLabel('Nome', { exact: true }).fill(nome);
    await dialogo.getByLabel('Valor a juntar', { exact: true }).fill('1.000,00');
    await dialogo.getByLabel('Prazo', { exact: true }).fill(prazo);
    await dialogo.getByRole('button', { name: 'Criar objetivo' }).click();
    await esperarAviso(page, 'Objetivo criado.');

    const cartao = cartaoDoObjetivo(page, nome);

    await expect(cartao).toBeVisible();
    await expect(
      cartao.getByRole('progressbar', { name: new RegExp(`Objetivo ${nome}: 0% do objetivo`) }),
    ).toBeVisible();

    // Aporte de 100,00 €, com conta: o dinheiro sai do saldo da carteira.
    await cartao.getByRole('button', { name: 'Depositar', exact: true }).click();

    const movimentoDialogo = page.getByRole('dialog');

    await movimentoDialogo.getByLabel('Valor', { exact: true }).fill('100,00');
    await escolherNoSelect(
      movimentoDialogo.getByLabel('Conta (opcional)', { exact: true }),
      CONTA_PRINCIPAL,
    );
    await movimentoDialogo.getByRole('button', { name: 'Registar depósito' }).click();
    await esperarAviso(page, 'Depósito registado. O saldo da conta foi atualizado.');

    // Progresso: 100 de 1.000 = 10%, com um movimento no histórico.
    await expect(
      cartao.getByRole('progressbar', { name: new RegExp(`Objetivo ${nome}: 10% do objetivo`) }),
    ).toBeVisible();
    await expect(cartao).toContainText('100,00');
    await expect(cartao).toContainText('1 movimento');

    await abrirRota(page, '/contas');
    expect((await lerSaldoDaConta(page)) - saldoAntes, 'o aporte sai do saldo da conta').toBe(
      -10_000,
    );

    // Detalhe e remoção do movimento.
    await abrirRota(page, '/objetivos');
    await cartaoDoObjetivo(page, nome)
      .getByRole('link', { name: /Detalhe/ })
      .click();

    const detalhe = page.getByRole('dialog');

    await expect(detalhe).toBeVisible();
    await expect(detalhe.getByRole('heading', { name: nome })).toBeVisible();
    await expect(detalhe.getByText('Movimentos (1)')).toBeVisible();
    await expect(detalhe.getByText('Depósito')).toBeVisible();

    await detalhe.getByRole('button', { name: /^Apagar o depósito de/ }).click();
    await page.getByRole('button', { name: 'Apagar movimento' }).click();

    await esperarAviso(page, 'Movimento apagado. O lançamento na conta também foi apagado.');

    // O histórico fica vazio e o acumulado volta a zero.
    await expect(detalhe.getByText('Movimentos (0)')).toBeVisible();
    await expect(detalhe.getByText('Ainda não há movimentos neste objetivo.')).toBeVisible();

    // E o saldo da conta volta ao valor de partida: não ficou um lançamento órfão.
    await abrirRota(page, '/contas');
    expect(await lerSaldoDaConta(page), 'o saldo volta ao valor inicial').toBe(saldoAntes);
  });
});
