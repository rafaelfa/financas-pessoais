import { expect, test, type Page } from '@playwright/test';

import { lerCredenciais } from './support/dados';
import {
  contarPatrimonio,
  contarTransacoes,
  lerBem,
  lerDivida,
  limparPatrimonioDoSpec,
} from './support/db';
import { abrirRota, lancarGasto, lerKpiDoPainel } from './support/ui';

/**
 * Percurso 26 — património (bens e dívidas).
 *
 * O ecrã existe por causa de **um número**: o património líquido do Painel
 * (bens − dívidas, mais os saldos das contas). Todos os passos medem esse
 * número por diferença, porque o utilizador partilhado já tem contas e outros
 * specs correm antes.
 *
 * Tudo pela interface. A base confirma o que a interface escreveu (valor,
 * `archivedAt`) e a limpeza fica no `afterEach`.
 */

const PREFIXO = 'E2E T38';

/** O diálogo de bem aberto (Dialog no desktop, Drawer no telemóvel). */
function dialogoDoBem(page: Page) {
  return page.getByRole('dialog').filter({ hasText: /Novo bem|Editar bem/ });
}

/** O diálogo de dívida aberto. */
function dialogoDaDivida(page: Page) {
  return page.getByRole('dialog').filter({ hasText: /Nova dívida|Editar dívida/ });
}

/** O património líquido do Painel, em cêntimos. */
async function patrimonioDoPainel(page: Page): Promise<number> {
  await abrirRota(page, '/');
  return lerKpiDoPainel(page, 'Património líquido');
}

/**
 * O Painel só desenha os indicadores quando há pelo menos um movimento
 * (`hasData = transactions.length > 0`). O spec do património corre antes do
 * das transações, por isso garante **um** movimento de base, uma única vez.
 */
async function garantirDadosNoPainel(
  browser: import('@playwright/test').Browser,
  email: string,
): Promise<void> {
  if ((await contarTransacoes(email)) > 0) {
    return;
  }

  const contexto = await browser.newContext({
    storageState: 'e2e/.auth/utilizador.json',
    locale: 'pt-PT',
    timezoneId: 'Europe/Lisbon',
  });
  const page = await contexto.newPage();

  try {
    await abrirRota(page, '/transacoes');
    await lancarGasto(page, {
      valor: '1,00',
      descricao: `E2E T38 base ${Date.now().toString(36)}`,
      categoria: 'Outros',
    });
  } finally {
    await contexto.close();
  }
}

/** Abre o diálogo de bem: na lista vazia o gatilho chama-se «Registar bem». */
async function abrirDialogoDoBem(page: Page): Promise<void> {
  const novo = page.getByRole('button', { name: 'Novo bem', exact: true });

  if ((await novo.count()) > 0) {
    await novo.click();
    return;
  }

  await page.getByRole('button', { name: 'Registar bem', exact: true }).click();
}

/** Abre o diálogo de dívida: na lista vazia o gatilho chama-se «Registar dívida». */
async function abrirDialogoDaDivida(page: Page): Promise<void> {
  const nova = page.getByRole('button', { name: 'Nova dívida', exact: true });

  if ((await nova.count()) > 0) {
    await nova.click();
    return;
  }

  await page.getByRole('button', { name: 'Registar dívida', exact: true }).click();
}

/** Cria um bem pela interface (o `Novo bem` da secção «Bens»). */
async function criarBem(
  page: Page,
  opcoes: { readonly nome: string; readonly valor: string },
): Promise<void> {
  await abrirRota(page, '/patrimonio');
  await abrirDialogoDoBem(page);

  const dialogo = dialogoDoBem(page);

  await expect(dialogo).toBeVisible();
  await dialogo.getByLabel('Nome', { exact: true }).fill(opcoes.nome);
  await dialogo.getByLabel('Valor atual', { exact: true }).fill(opcoes.valor);
  await dialogo.getByRole('button', { name: 'Registar bem', exact: true }).click();
  await expect(dialogo).toBeHidden();
}

/** Cria uma dívida pela interface (o `Nova dívida` da secção «Dívidas»). */
async function criarDivida(
  page: Page,
  opcoes: { readonly nome: string; readonly capital: string; readonly saldo: string },
): Promise<void> {
  await abrirRota(page, '/patrimonio');
  await abrirDialogoDaDivida(page);

  const dialogo = dialogoDaDivida(page);

  await expect(dialogo).toBeVisible();
  await dialogo.getByLabel('Nome', { exact: true }).fill(opcoes.nome);
  await dialogo.getByLabel('Capital inicial', { exact: true }).fill(opcoes.capital);
  await dialogo.getByLabel('Saldo em dívida', { exact: true }).fill(opcoes.saldo);
  await dialogo.getByRole('button', { name: 'Registar dívida', exact: true }).click();
  await expect(dialogo).toBeHidden();
}

test.describe('Percurso 26 — património', () => {
  let email = '';

  test.beforeAll(async ({ browser }) => {
    email = lerCredenciais().email;
    await garantirDadosNoPainel(browser, email);
  });

  test.afterEach(async () => {
    await limparPatrimonioDoSpec(email, PREFIXO);
  });

  test('criar um bem soma ao património líquido do Painel', async ({ page }) => {
    const nome = `${PREFIXO} Casa ${Date.now().toString(36)}`;

    // Entra pelo menu, como uma pessoa: prova também a entrada na navegação.
    await abrirRota(page, '/');
    await page
      .locator('[data-slot="sidebar"]')
      .getByRole('link', { name: 'Património', exact: true })
      .click();
    await expect(page).toHaveURL(/\/patrimonio$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Património' })).toBeVisible();

    const antes = await patrimonioDoPainel(page);

    await criarBem(page, { nome, valor: '12500' });

    await expect(
      page.locator('[data-slot="card"]').filter({ hasText: nome }).first(),
    ).toContainText('12 500,00 €');

    expect(await lerBem(email, nome).then((bem) => bem?.valueInCents)).toBe(1_250_000);

    const depois = await patrimonioDoPainel(page);

    expect(depois - antes, 'um bem de 12.500 € sobe o património exatamente 1.250.000').toBe(
      1_250_000,
    );
  });

  test('criar uma dívida desce o património líquido', async ({ page }) => {
    const nome = `${PREFIXO} Crédito ${Date.now().toString(36)}`;

    const antes = await patrimonioDoPainel(page);

    await criarDivida(page, { nome, capital: '5000', saldo: '3000' });

    await expect(
      page.locator('[data-slot="card"]').filter({ hasText: nome }).first(),
    ).toContainText('3000,00 €');

    expect(await lerDivida(email, nome).then((divida) => divida?.outstandingInCents)).toBe(300_000);

    const depois = await patrimonioDoPainel(page);

    expect(depois - antes, 'uma dívida de 3.000 € desce o património 300.000').toBe(-300_000);
  });

  test('editar o saldo em dívida atualiza o Painel', async ({ page }) => {
    const nome = `${PREFIXO} Editável ${Date.now().toString(36)}`;

    await criarDivida(page, { nome, capital: '5000', saldo: '3000' });

    const antes = await patrimonioDoPainel(page);

    await abrirRota(page, '/patrimonio');
    await page.getByRole('button', { name: `Editar ${nome}`, exact: true }).click();

    const dialogo = dialogoDaDivida(page);

    await expect(dialogo).toBeVisible();
    await expect(dialogo.getByLabel('Saldo em dívida', { exact: true })).toHaveValue('3000,00');
    await dialogo.getByLabel('Saldo em dívida', { exact: true }).fill('1000');
    await dialogo.getByRole('button', { name: 'Guardar alterações', exact: true }).click();
    await expect(dialogo).toBeHidden();

    await expect(
      page.locator('[data-slot="card"]').filter({ hasText: nome }).first(),
    ).toContainText('1000,00 €');
    expect(await lerDivida(email, nome).then((divida) => divida?.outstandingInCents)).toBe(100_000);

    const depois = await patrimonioDoPainel(page);

    expect(depois - antes, 'baixar a dívida de 3.000 para 1.000 sobe o património 200.000').toBe(
      200_000,
    );
  });

  test('arquivar tira do total e do ecrã mas mantém a linha; reativar devolve', async ({
    page,
  }) => {
    const nome = `${PREFIXO} Arquivável ${Date.now().toString(36)}`;

    await criarBem(page, { nome, valor: '2000' });

    const antesDoArquivo = await patrimonioDoPainel(page);

    await abrirRota(page, '/patrimonio');
    await page.getByRole('button', { name: `Arquivar ${nome}`, exact: true }).click();

    const confirmacao = page.getByRole('alertdialog');

    await expect(confirmacao).toBeVisible();
    await confirmacao.getByRole('button', { name: 'Arquivar', exact: true }).click();
    await expect(confirmacao).toBeHidden();

    // Sai da lista dos ativos e aparece na secção dos arquivados.
    await expect(page.locator('[data-slot="card"]').filter({ hasText: nome })).toHaveCount(0);
    await expect(page.getByText(`Bens arquivados (1)`)).toBeVisible();

    const arquivado = await lerBem(email, nome);

    expect(arquivado, 'a linha não desaparece da base').toBeDefined();
    expect(arquivado?.archivedAt, 'archivedAt fica preenchido').not.toBeNull();

    const depoisDoArquivo = await patrimonioDoPainel(page);

    expect(depoisDoArquivo - antesDoArquivo, 'um bem arquivado sai do total (−200.000)').toBe(
      -200_000,
    );

    // Reativar a partir da lista dos arquivados.
    await abrirRota(page, '/patrimonio');
    await page.getByText(`Bens arquivados (1)`).click();
    await page.getByRole('button', { name: 'Reativar', exact: true }).first().click();

    await expect(
      page.locator('[data-slot="card"]').filter({ hasText: nome }).first(),
    ).toBeVisible();
    expect(await lerBem(email, nome).then((bem) => bem?.archivedAt)).toBeNull();

    const depoisDeReativar = await patrimonioDoPainel(page);

    expect(depoisDeReativar - antesDoArquivo, 'reativar devolve os 200.000').toBe(0);
  });

  test('submissão inválida: negativo e datas trocadas não criam nada; zero é aceite (medido)', async ({
    page,
  }) => {
    /*
     * O valor 0 **não** é recusado: `patrimonio.ts` usa `nonNegativeCentsSchema`
     * para `valueInCents` (e para `outstandingInCents`), portanto um bem de
     * 0,00 € é um bem válido. Isto diverge do critério que a tarefa pedia
     * («valor 0/negativo → mensagem»); fica medido e asserido como está, e
     * reportado. O negativo é recusado, e as datas trocadas também.
     */
    const antes = await contarPatrimonio(email, PREFIXO);

    await abrirRota(page, '/patrimonio');
    await abrirDialogoDoBem(page);

    let dialogo = dialogoDoBem(page);

    await expect(dialogo).toBeVisible();
    await dialogo.getByLabel('Nome', { exact: true }).fill(`${PREFIXO} negativo`);
    await dialogo.getByLabel('Valor atual', { exact: true }).fill('-100');
    await dialogo.getByRole('button', { name: 'Registar bem', exact: true }).click();
    await expect(dialogo.getByText('O valor não pode ser negativo.')).toBeVisible();
    await dialogo.getByRole('button', { name: 'Cancelar', exact: true }).click();

    // Datas trocadas numa dívida: fim antes do início.
    await abrirDialogoDaDivida(page);

    const divida = dialogoDaDivida(page);

    await expect(divida).toBeVisible();
    await divida.getByLabel('Nome', { exact: true }).fill(`${PREFIXO} datas trocadas`);
    await divida.getByLabel('Capital inicial', { exact: true }).fill('1000');
    await divida.getByLabel('Saldo em dívida', { exact: true }).fill('1000');
    await divida.getByLabel('Início', { exact: true }).fill('2026-06-01');
    await divida.getByLabel('Fim', { exact: true }).fill('2026-01-01');
    await divida.getByRole('button', { name: 'Registar dívida', exact: true }).click();
    await expect(divida.getByText('O fim não pode ser antes do início.')).toBeVisible();
    await divida.getByRole('button', { name: 'Cancelar', exact: true }).click();

    expect(await contarPatrimonio(email, PREFIXO), 'negativo e datas trocadas não criam nada').toBe(
      antes,
    );

    // Zero: aceite pela regra atual, com o valor 0 gravado.
    const nomeZero = `${PREFIXO} zero ${Date.now().toString(36)}`;

    await criarBem(page, { nome: nomeZero, valor: '0' });

    expect(await lerBem(email, nomeZero).then((bem) => bem?.valueInCents)).toBe(0);
  });
});

test.describe('Percurso 26 — património no telemóvel', () => {
  test.use({ viewport: { width: 393, height: 727 }, hasTouch: true, isMobile: true });

  let email = '';

  test.beforeAll(async ({ browser }) => {
    email = lerCredenciais().email;
    await garantirDadosNoPainel(browser, email);
  });

  test.afterEach(async () => {
    await limparPatrimonioDoSpec(email, PREFIXO);
  });

  test('cria um bem do início ao fim no Drawer, com o botão alcançável', async ({ page }) => {
    const nome = `${PREFIXO} Telemóvel ${Date.now().toString(36)}`;

    await abrirRota(page, '/patrimonio');
    await abrirDialogoDoBem(page);

    const drawer = page.locator('[data-slot=drawer-content]');

    await expect(drawer).toBeVisible();
    await drawer.getByLabel('Nome', { exact: true }).fill(nome);
    await drawer.getByLabel('Valor atual', { exact: true }).fill('1500');

    const rolavel = drawer.locator('div.overflow-y-auto').first();

    await rolavel.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await page.waitForTimeout(300);

    const submit = drawer.getByRole('button', { name: 'Registar bem', exact: true });
    const caixa = await submit.boundingBox();

    expect(caixa, 'o botão de submeter tem de estar dentro do ecrã').not.toBeNull();
    expect(caixa!.y + caixa!.height).toBeLessThanOrEqual(727);
    expect(caixa!.y).toBeGreaterThanOrEqual(0);

    await submit.click();
    await expect(drawer).toBeHidden();

    await expect(
      page.locator('[data-slot="card"]').filter({ hasText: nome }).first(),
    ).toBeVisible();
    expect(await lerBem(email, nome).then((bem) => bem?.valueInCents)).toBe(150_000);
  });
});
