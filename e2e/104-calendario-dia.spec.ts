import { expect, test } from '@playwright/test';

import { lerCredenciais } from './support/dados';
import { criarContaAPagarDoSpec, criarContaDoSpec, limparDadosDoSpec } from './support/db';
import { abrirRota, lancarGasto } from './support/ui';

/**
 * Percurso 104 — o nome acessível do dia conta **tudo** o que lá está (T104/D37).
 *
 * O defeito: a célula e o `aria-label` contavam só os itens por liquidar, e um
 * dia com uma entrada já liquidada dizia «0 itens, saldo 0,00 €». Em leitor de
 * ecrã isso é pior do que na célula — quem não vê não tem a linha para
 * desmentir o rótulo. Este teste prende os dois formatos (singular/plural) e os
 * dois casos (com e sem pendentes): o dia tem 2 itens, 1 por liquidar, e o saldo
 * inclui o liquidado.
 */

const PREFIXO = 'T104 QA';
const MES = '2027-05';
const DIA = '2027-05-10';
const CONTA = `${PREFIXO} conta`;

test.describe('T104 — o nome acessível do dia conta todos os itens', () => {
  test.beforeAll(async () => {
    await criarContaDoSpec(lerCredenciais().email, CONTA);
    /* Um item por liquidar (conta a pagar) no dia 10/05/2027. */
    await criarContaAPagarDoSpec(
      lerCredenciais().email,
      `${PREFIXO} pendente`,
      'PAYABLE',
      3000,
      DIA,
    );
  });

  test.afterAll(async () => {
    await limparDadosDoSpec(lerCredenciais().email, PREFIXO);
  });

  test('um dia com um liquidado e um pendente diz «2 itens · 1 por liquidar» e o saldo inclui os dois', async ({
    page,
  }) => {
    /* Um gasto de 10,00 € no mesmo dia: o quick-add grava-o já liquidado. */
    await abrirRota(page, '/transacoes');
    await lancarGasto(page, {
      valor: '10,00',
      descricao: `${PREFIXO} liquidado`,
      categoria: 'Alimentação',
      data: DIA,
    });

    await abrirRota(page, `/calendario?mes=${MES}`);

    const dia = page.getByRole('button', { name: /10 de maio/ }).first();
    await expect(dia, 'o dia tem controlo porque tem itens').toBeVisible();

    /* O rótulo: total de itens, por liquidar e o saldo do dia (−30 −10 = −40). */
    await expect(dia).toHaveAttribute(
      'aria-label',
      /10 de maio: 2 itens · 1 por liquidar, saldo -40,00\s*€/,
    );

    await dia.click();

    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();
    await expect(dialogo.locator('[data-slot="dialog-description"]')).toContainText(
      /2 itens · 1 por liquidar · 1 já liquidado · saldo -40,00\s*€/,
    );
  });
});
