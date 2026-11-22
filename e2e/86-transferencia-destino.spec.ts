import { expect, test, type Page } from '@playwright/test';

import { lerCredenciais } from './support/dados';
import {
  contarPorDescricao,
  criarContaDoSpec,
  idDaConta,
  lerPorDescricao,
  limparDadosDoSpec,
} from './support/db';
import { abrirRota, esperarAviso } from './support/ui';

/**
 * Percurso 86 — a transferência abre com a conta de destino preenchida (T86).
 *
 * O `Select` de destino monta quando se muda para Transferência e avisa com `""`
 * ao montar sem os itens no DOM; o formulário ficava sem destino e respondia
 * «Falta o identificador.». O spec não toca no select: preenche o valor, submete
 * e confirma na base as duas pernas com a descrição do teste.
 *
 * O destino **não** é o nome de uma conta fixa: a regra do produto é «a primeira
 * conta ativa que não é a de origem», e o utilizador do e2e é partilhado — outros
 * specs deixam lá contas ativas. Por isso o teste lê o destino e a origem do
 * ecrã e exige que as duas pernas fiquem exatamente nessas contas: continua
 * vermelho se o destino vier vazio (o `toHaveText` contra o origem deixa de
 * bater porque nada é mostrado), se a transferência não gravar, ou se a action
 * gravar numa conta diferente da que apareceu no select.
 */

const PREFIXO = 'T86 destino';
const SEGUNDA_CONTA = `${PREFIXO} secundária`;

/** O texto de um `Select` fechado (o `SelectValue` dentro do gatilho). */
async function valorDoSelect(page: Page): Promise<string> {
  return (await page.locator('#lancamento-destino').innerText()).trim();
}

test.describe('T86 — transferência com o destino preenchido', () => {
  test.beforeAll(async () => {
    /* O utilizador do e2e nasce com uma conta; a transferência precisa de duas. */
    await criarContaDoSpec(lerCredenciais().email, SEGUNDA_CONTA);
  });

  test.afterAll(async () => {
    await limparDadosDoSpec(lerCredenciais().email, PREFIXO);
  });

  test('o destino mostra uma conta ativa concreta e grava sem tocar no select', async ({
    page,
  }) => {
    await abrirRota(page, '/transacoes');

    const formulario = page.locator('form').filter({ hasText: 'Natureza' }).first();
    await formulario.getByRole('radio', { name: 'Transferência' }).click();

    const origem = (await formulario.locator('#lancamento-conta').innerText()).trim();
    const destino = await valorDoSelect(page);

    /* O que se pede à correção: um destino concreto, sem tocar no select. */
    expect(destino, 'o destino abre preenchido, sem escolha').not.toBe('');
    expect(destino, 'o destino não é a própria conta de origem').not.toBe(origem);

    await formulario.getByRole('textbox', { name: 'Valor', exact: true }).fill('50,00');
    await formulario.getByRole('combobox', { name: 'Descrição' }).fill(PREFIXO);
    await formulario.getByRole('button', { name: 'Transferir', exact: true }).click();

    await esperarAviso(page, 'Transferência registada nas duas contas.');

    await expect
      .poll(() => contarPorDescricao(lerCredenciais().email, PREFIXO), {
        message: 'a transferência deixa duas pernas na base',
      })
      .toBe(2);

    /* As pernas ficam nas duas contas que o ecrã mostrou — não noutras. */
    const pernas = await lerPorDescricao(lerCredenciais().email, PREFIXO);
    const contaOrigem = await idDaConta(lerCredenciais().email, origem);
    const contaDestino = await idDaConta(lerCredenciais().email, destino);

    expect(contaOrigem, 'a conta de origem existe na base').toBeDefined();
    expect(contaDestino, 'a conta de destino mostrada existe na base').toBeDefined();
    expect(
      pernas.map((perna) => perna.accountId).sort(),
      'uma perna em cada conta do ecrã',
    ).toEqual([contaOrigem, contaDestino].sort());
    expect(
      pernas.map((perna) => perna.amountInCents).sort((a, b) => a - b),
      'as duas pernas somam zero',
    ).toEqual([-5000, 5000]);
    expect(new Set(pernas.map((perna) => perna.transferGroupId)).size, 'o mesmo grupo').toBe(1);
  });
});
