import { expect, test, type Page } from '@playwright/test';

import { lerCredenciais } from './support/dados';
import { contarItensDoGrupo, limparDadosDoSpec } from './support/db';
import { abrirRota } from './support/ui';

/**
 * Percurso 55 — consolidação de contas (grupos), pela interface.
 *
 * O ecrã nunca esteve no e2e. O percurso cria uma segunda conta (para haver duas
 * para agrupar), cria o grupo com as duas, desmarca uma e apaga o grupo com
 * confirmação — e confirma na base os itens de cada passo.
 *
 * O `afterEach` apaga grupos e contas com o prefixo do spec; a conta que o
 * `beforeAll` cria também cai no `afterAll`, para os percursos seguintes não
 * encontrarem contas a mais.
 */

const PREFIXO_GRUPO = 'E2E T3 grupo';
const PREFIXO_CONTA = 'E2E T3 Conta';

/** O diálogo do grupo (criar ou editar), pelo título. */
function dialogoDoGrupo(page: Page) {
  return page.getByRole('dialog').filter({ hasText: /Novo Grupo de Contas|Editar Grupo/ });
}

/** O cartão do grupo na lista, pelo nome. */
function cartaoDoGrupo(page: Page, nome: string) {
  return page.locator('[data-slot="card"]').filter({ hasText: nome }).first();
}

test.describe('Percurso 55 — consolidação de contas', () => {
  let email = '';
  let contaExtra = '';

  test.beforeAll(async ({ browser }) => {
    email = lerCredenciais().email;
    contaExtra = `${PREFIXO_CONTA} ${Date.now().toString(36)}`;

    /*
     * A conta do utilizador partilhado é uma só («Carteira principal»); um grupo
     * precisa de duas para se poder marcar/desmarcar. Criar a segunda pela
     * interface é o que uma pessoa faria, e evita escrever na base o que o
     * percurso diz medir.
     */
    const contexto = await browser.newContext({
      storageState: 'e2e/.auth/utilizador.json',
      locale: 'pt-PT',
      timezoneId: 'Europe/Lisbon',
    });
    const page = await contexto.newPage();

    try {
      await abrirRota(page, '/contas');
      await page.getByRole('button', { name: 'Nova conta', exact: true }).click();

      const dialogo = page.getByRole('dialog').filter({ hasText: 'Nova conta' });

      await expect(dialogo).toBeVisible();
      await dialogo.getByLabel('Nome', { exact: true }).fill(contaExtra);
      await dialogo.getByRole('button', { name: 'Criar conta', exact: true }).click();
      await expect(dialogo).toBeHidden();
      await expect(page.getByText(contaExtra, { exact: true })).toBeVisible();
    } finally {
      await contexto.close();
    }
  });

  test.afterAll(async () => {
    await limparDadosDoSpec(email, PREFIXO_GRUPO);
    await limparDadosDoSpec(email, PREFIXO_CONTA);
  });

  test('cria um grupo com 2 contas: aparece na lista e a base tem 2 itens', async ({ page }) => {
    const nome = `${PREFIXO_GRUPO} dois ${Date.now().toString(36)}`;

    await abrirRota(page, '/consolidacao-contas');
    await page.getByRole('button', { name: 'Novo Grupo', exact: true }).click();

    const dialogo = dialogoDoGrupo(page);

    await expect(dialogo).toBeVisible();
    await dialogo.getByPlaceholder('Ex: Contas Principais, Emergência...').fill(nome);
    await dialogo.getByRole('checkbox', { name: 'Carteira principal', exact: true }).check();
    await dialogo.getByRole('checkbox', { name: contaExtra, exact: true }).check();
    await dialogo.getByRole('button', { name: 'Criar Grupo', exact: true }).click();
    await expect(dialogo).toBeHidden();

    const cartao = cartaoDoGrupo(page, nome);

    await expect(cartao).toBeVisible();
    await expect(cartao).toContainText('2 de 2');
    expect(await contarItensDoGrupo(email, nome), '2 contas marcadas, 2 itens').toBe(2);
  });

  test('edita o grupo desmarcando uma conta: fica com 1 item', async ({ page }) => {
    const nome = `${PREFIXO_GRUPO} editar ${Date.now().toString(36)}`;

    // Grupo com as duas contas.
    await abrirRota(page, '/consolidacao-contas');
    await page.getByRole('button', { name: 'Novo Grupo', exact: true }).click();

    let dialogo = dialogoDoGrupo(page);

    await expect(dialogo).toBeVisible();
    await dialogo.getByPlaceholder('Ex: Contas Principais, Emergência...').fill(nome);
    await dialogo.getByRole('checkbox', { name: 'Carteira principal', exact: true }).check();
    await dialogo.getByRole('checkbox', { name: contaExtra, exact: true }).check();
    await dialogo.getByRole('button', { name: 'Criar Grupo', exact: true }).click();
    await expect(dialogo).toBeHidden();
    expect(await contarItensDoGrupo(email, nome)).toBe(2);

    // Abre a edição: as duas contas têm de vir marcadas e desmarca-se uma.
    await cartaoDoGrupo(page, nome).getByRole('button', { name: 'Editar', exact: true }).click();

    dialogo = dialogoDoGrupo(page);

    await expect(dialogo).toBeVisible();
    await expect(
      dialogo.getByRole('checkbox', { name: 'Carteira principal', exact: true }),
    ).toBeChecked();
    await expect(dialogo.getByRole('checkbox', { name: contaExtra, exact: true })).toBeChecked();

    await dialogo.getByRole('checkbox', { name: contaExtra, exact: true }).uncheck();
    await dialogo.getByRole('button', { name: 'Salvar Alterações', exact: true }).click();
    await expect(dialogo).toBeHidden();

    // O grupo passa a ter 1 item no total: «1 de 1» (ativos de itens).
    await expect(cartaoDoGrupo(page, nome)).toContainText('1 de 1');
    expect(await contarItensDoGrupo(email, nome), 'desmarcar uma conta deixa 1 item').toBe(1);
  });

  test('apaga o grupo com confirmação: sai da lista e da base', async ({ page }) => {
    const nome = `${PREFIXO_GRUPO} apagar ${Date.now().toString(36)}`;

    await abrirRota(page, '/consolidacao-contas');
    await page.getByRole('button', { name: 'Novo Grupo', exact: true }).click();

    const dialogo = dialogoDoGrupo(page);

    await expect(dialogo).toBeVisible();
    await dialogo.getByPlaceholder('Ex: Contas Principais, Emergência...').fill(nome);
    await dialogo.getByRole('checkbox', { name: 'Carteira principal', exact: true }).check();
    await dialogo.getByRole('button', { name: 'Criar Grupo', exact: true }).click();
    await expect(dialogo).toBeHidden();
    await expect(cartaoDoGrupo(page, nome)).toBeVisible();

    // O apagar vive no botão «Opções» (ícone) do cartão; abre a confirmação.
    await cartaoDoGrupo(page, nome).getByRole('button', { name: 'Opções', exact: true }).click();

    const confirmacao = page.getByRole('alertdialog');

    await expect(confirmacao).toBeVisible();
    await confirmacao.getByRole('button', { name: 'Apagar grupo', exact: true }).click();
    await expect(confirmacao).toBeHidden();

    await expect(cartaoDoGrupo(page, nome)).toBeHidden();
    expect(await contarItensDoGrupo(email, nome), 'o grupo tem de sair da base').toBe(0);
  });
});
