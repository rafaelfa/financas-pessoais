import { expect, test } from '@playwright/test';

import { lerCredenciais } from './support/dados';
import {
  contarContasAPagar,
  contarTransacoes,
  idDaConta,
  lerContaAPagar,
  lerMovimentoDoPagamento,
  limparDadosDoSpec,
} from './support/db';
import { abrirRota, escolherNoSelect, esperarAviso, hojeEmLisboa } from './support/ui';

/**
 * Percurso 45 — contas a pagar / receber, tudo pela interface.
 *
 * O ecrã nunca esteve no e2e: o que existia eram scripts pontuais contra a API.
 * Aqui faz-se o que uma pessoa faria — criar com cêntimos, editar, tentar mudar
 * o tipo, pagar, apagar (cancelando primeiro) e submeter inválido — e confirma-se
 * na base **só** o que a interface acabou de escrever.
 *
 * Cada teste usa uma descrição única (`E2E T3 conta …`) e o `afterEach` apaga o
 * que ficou com esse prefixo, para os percursos seguintes não encontrarem lixo.
 */

const PREFIXO = 'E2E T3 conta';

/** O diálogo de criação/edição, pelo título (há mais do que um `dialog` no DOM). */
function dialogoDaConta(page: import('@playwright/test').Page) {
  return page.getByRole('dialog').filter({ hasText: /Conta a Pagar\/Receber|Editar Conta/ });
}

/** O cartão da lista que contém esta descrição. */
function cartaoDaContaAPagar(page: import('@playwright/test').Page, descricao: string) {
  return page.locator('[data-slot="card"]').filter({ hasText: descricao }).first();
}

/** Cria uma conta a pagar pela interface, com o valor indicado em euros. */
async function criarContaAPagar(
  page: import('@playwright/test').Page,
  opcoes: { readonly descricao: string; readonly valor: string },
): Promise<void> {
  await abrirRota(page, '/contas-pagar-receber');
  await page.getByRole('button', { name: 'Nova Conta', exact: true }).click();

  const dialogo = dialogoDaConta(page);

  await expect(dialogo).toBeVisible();
  await dialogo.getByPlaceholder('Ex: Fatura de luz, Aluguel, Salário...').fill(opcoes.descricao);
  await dialogo.getByPlaceholder('0,00').fill(opcoes.valor);
  await dialogo.getByRole('button', { name: 'Criar Conta', exact: true }).click();
  await expect(dialogo).toBeHidden();
}

test.describe('Percurso 45 — contas a pagar / receber', () => {
  let email = '';

  test.beforeAll(() => {
    email = lerCredenciais().email;
  });

  test.afterEach(async () => {
    await limparDadosDoSpec(email, PREFIXO);
  });

  test('cria com cêntimos: a lista mostra 19,99 € e a base tem 1999', async ({ page }) => {
    const descricao = `${PREFIXO} 19,99 ${Date.now().toString(36)}`;

    await criarContaAPagar(page, { descricao, valor: '19,99' });

    const cartao = cartaoDaContaAPagar(page, descricao);

    await expect(cartao).toBeVisible();
    await expect(cartao).toContainText('19,99 €');

    const medido = await lerContaAPagar(email, descricao);

    expect(medido, 'a conta tem de existir na base').toBeDefined();
    expect(medido?.amountInCents, '19,99 € tem de ser 1999 cêntimos inteiros').toBe(1999);
  });

  test('edita a descrição e o valor: a lista mostra o valor novo', async ({ page }) => {
    const descricao = `${PREFIXO} edição ${Date.now().toString(36)}`;
    const novaDescricao = `${descricao} (nova)`;

    await criarContaAPagar(page, { descricao, valor: '12,34' });

    await cartaoDaContaAPagar(page, descricao)
      .getByRole('button', { name: 'Editar', exact: true })
      .click();

    const dialogo = dialogoDaConta(page);

    await expect(dialogo).toBeVisible();
    await dialogo.getByPlaceholder('Ex: Fatura de luz, Aluguel, Salário...').fill(novaDescricao);
    await dialogo.getByPlaceholder('0,00').fill('25,50');
    await dialogo.getByRole('button', { name: 'Salvar Alterações', exact: true }).click();
    await expect(dialogo).toBeHidden();

    const cartao = cartaoDaContaAPagar(page, novaDescricao);

    await expect(cartao).toBeVisible();
    await expect(cartao).toContainText('25,50 €');

    const medido = await lerContaAPagar(email, novaDescricao);

    expect(medido?.amountInCents ?? -1, '25,50 € tem de ser 2550 cêntimos').toBe(2550);
  });

  test('o tipo não se muda: em edição os rádios estão desativados', async ({ page }) => {
    const descricao = `${PREFIXO} tipo ${Date.now().toString(36)}`;

    await criarContaAPagar(page, { descricao, valor: '10,00' });

    await cartaoDaContaAPagar(page, descricao)
      .getByRole('button', { name: 'Editar', exact: true })
      .click();

    const dialogo = dialogoDaConta(page);

    await expect(dialogo).toBeVisible();
    await expect(dialogo.getByRole('radio', { name: /Conta a Pagar/ })).toBeDisabled();
    await expect(dialogo.getByRole('radio', { name: /Conta a Receber/ })).toBeDisabled();

    const medido = await lerContaAPagar(email, descricao);

    expect(medido?.amountInCents, 'abrir a edição não pode mudar nada').toBe(1000);
  });

  test('pagar: a conta fica «Paga» e nasce 1 movimento na conta escolhida', async ({ page }) => {
    const descricao = `${PREFIXO} pagar ${Date.now().toString(36)}`;

    await criarContaAPagar(page, { descricao, valor: '19,99' });

    const antes = await contarTransacoes(email, 'Carteira principal');

    await cartaoDaContaAPagar(page, descricao)
      .getByRole('button', { name: 'Pagar/Receber', exact: true })
      .click();

    const dialogo = page.getByRole('dialog').filter({ hasText: 'Pagar «' });

    await expect(dialogo).toBeVisible();
    await escolherNoSelect(
      dialogo.getByRole('combobox', { name: 'Conta de pagamento' }),
      'Carteira principal',
    );
    // A data vem pré-preenchida com hoje em Lisboa: é essa que se usa.
    await expect(dialogo.locator('input[type="date"]')).toHaveValue(hojeEmLisboa());
    await dialogo.getByRole('button', { name: 'Confirmar pagamento', exact: true }).click();
    await esperarAviso(page, 'Conta marcada como paga.');
    await expect(dialogo).toBeHidden();

    await abrirRota(page, '/contas-pagar-receber');

    const cartao = cartaoDaContaAPagar(page, descricao);

    await expect(cartao).toBeVisible();
    await expect(cartao.getByText('Paga', { exact: true })).toBeVisible();

    const medido = await lerContaAPagar(email, descricao);

    expect(medido?.status, 'a conta tem de ficar PAID na base').toBe('PAID');
    expect(medido?.paidAmountInCents, 'o valor pago é o valor da conta').toBe(1999);

    const depois = await contarTransacoes(email, 'Carteira principal');

    expect(depois - antes, 'o pagamento cria exatamente 1 movimento na conta escolhida').toBe(1);

    /*
     * O movimento não basta existir: tem de ter o valor da conta (com sinal de
     * despesa), o `kind` certo e a conta escolhida. Era o buraco do primeiro
     * e2e — contava +1 e não olhava ao dinheiro.
     */
    const movimento = await lerMovimentoDoPagamento(email, descricao);

    expect(movimento, 'o movimento do pagamento tem de existir').toBeDefined();
    expect(movimento?.amountInCents, 'despesa de 19,99 € fica em -1999 cêntimos').toBe(-1999);
    expect(movimento?.kind, 'uma conta a pagar gera uma despesa').toBe('EXPENSE');
    expect(movimento?.status).toBe('CONFIRMED');
    expect(movimento?.settled).toBe(true);
    expect(movimento?.financialAccountId, 'o movimento fica na conta escolhida para pagar').toBe(
      await idDaConta(email, 'Carteira principal'),
    );
  });

  test('apagar: cancelar mantém, confirmar remove da lista e da base', async ({ page }) => {
    const descricao = `${PREFIXO} apagar ${Date.now().toString(36)}`;

    await criarContaAPagar(page, { descricao, valor: '7,77' });

    const cartao = cartaoDaContaAPagar(page, descricao);

    await cartao.getByRole('button', { name: 'Apagar', exact: true }).click();

    const confirmacao = page.getByRole('alertdialog');

    await expect(confirmacao).toBeVisible();
    await confirmacao.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(confirmacao).toBeHidden();
    await expect(cartaoDaContaAPagar(page, descricao)).toBeVisible();
    expect(await lerContaAPagar(email, descricao), 'cancelar não pode apagar').toBeDefined();

    await cartaoDaContaAPagar(page, descricao)
      .getByRole('button', { name: 'Apagar', exact: true })
      .click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Apagar conta', exact: true })
      .click();
    await expect(page.getByRole('alertdialog')).toBeHidden();
    await expect(cartaoDaContaAPagar(page, descricao)).toBeHidden();
    expect(await lerContaAPagar(email, descricao), 'confirmar tem de apagar').toBeUndefined();
  });

  test('formulário inválido: mostra o erro e não cria nada', async ({ page }) => {
    const antes = await contarContasAPagar(email, PREFIXO);

    await abrirRota(page, '/contas-pagar-receber');
    await page.getByRole('button', { name: 'Nova Conta', exact: true }).click();

    const dialogo = dialogoDaConta(page);

    await expect(dialogo).toBeVisible();

    // Submeter sem descrição (e com valor a zero) não pode gravar.
    await dialogo.getByRole('button', { name: 'Criar Conta', exact: true }).click();

    await expect(dialogo.getByText('A descrição é obrigatória')).toBeVisible();
    await expect(dialogo.getByText('O valor deve ser maior que zero')).toBeVisible();
    await expect(dialogo).toBeVisible();

    expect(
      await contarContasAPagar(email, PREFIXO),
      'um formulário inválido não pode criar linhas',
    ).toBe(antes);
  });
});
