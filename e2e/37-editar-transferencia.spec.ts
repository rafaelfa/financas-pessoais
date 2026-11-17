import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { ESTADO_DE_SESSAO, lerCredenciais } from './support/dados';
import { idDaConta, lerPorDescricao, limparDadosDoSpec } from './support/db';
import {
  abrirRota,
  escolherNoSelect,
  esperarAviso,
  formularioDeLancamentoRapido,
} from './support/ui';

/**
 * Percurso 37 — editar uma transferência (T59).
 *
 * O diálogo enviava **sempre** `accountId`, e o servidor recusa `accountId` numa
 * transferência: gravar falhava em todos os casos, mesmo mudando só a descrição.
 * A spec prende as duas metades — a conta deixa de ser oferecida nem enviada, e
 * a descrição e o valor gravam (o valor espelhado na outra perna) — e é a prova
 * da mutação: com o `accountId` de volta, o diálogo mostra a recusa real
 * («Numa transferência não podes mudar a conta nem a categoria…») e as linhas
 * não mudam.
 */

const PREFIXO = 'T59 prova';
const CONTA_DESTINO = `${PREFIXO} conta destino`;
const RECUSA = 'Numa transferência não podes mudar a conta nem a categoria.';

const email = (): string => lerCredenciais().email;

function linhaDoExtrato(page: Page, descricao: string) {
  return page.getByRole('row', { name: new RegExp(descricao) }).first();
}

async function abrirEdicao(page: Page, descricao: string) {
  await abrirRota(page, '/transacoes');
  await expect(page.getByRole('checkbox').first()).toBeVisible();
  await linhaDoExtrato(page, descricao).getByRole('button', { name: /Ações/ }).click();
  await page.getByRole('menuitem', { name: 'Editar', exact: true }).click();
  const dialogo = page.getByRole('dialog');
  await expect(dialogo).toBeVisible();
  return dialogo;
}

test.describe('editar uma transferência (T59)', () => {
  test.afterAll(async () => {
    await limparDadosDoSpec(email(), PREFIXO);
  });

  test.beforeAll(async ({ browser }) => {
    const contexto = await browser.newContext({ storageState: ESTADO_DE_SESSAO, locale: 'pt-PT' });
    const page = await contexto.newPage();

    await abrirRota(page, '/contas');
    await page.getByRole('button', { name: 'Nova conta', exact: true }).click();
    const criar = page.getByRole('dialog');
    await criar.getByLabel('Nome', { exact: true }).fill(CONTA_DESTINO);
    await criar.getByRole('button', { name: 'Criar conta', exact: true }).click();
    await esperarAviso(page, 'Conta criada.');

    await abrirRota(page, '/transacoes');
    const rapido = formularioDeLancamentoRapido(page);
    await rapido.getByRole('radio', { name: 'Transferência', exact: true }).click();
    await escolherNoSelect(rapido.getByLabel('Da conta', { exact: true }), 'Carteira principal');
    await escolherNoSelect(rapido.getByLabel('Para a conta', { exact: true }), CONTA_DESTINO);
    await rapido.getByLabel('Valor', { exact: true }).fill('412,50');
    await rapido.getByLabel('Descrição', { exact: true }).fill(`${PREFIXO} transferencia`);
    await rapido.getByRole('button', { name: 'Transferir', exact: true }).click();
    await esperarAviso(page, 'Transferência registada nas duas contas.');

    await contexto.close();
  });

  test('a conta não é oferecida nem enviada, e a descrição grava nas duas pernas', async ({
    page,
  }) => {
    const dialogo = await abrirEdicao(page, `${PREFIXO} transferencia`);

    /* Campos: Conta e Categoria fora; a nota que explica porquê, dentro. */
    await expect(dialogo.getByLabel('Conta', { exact: true })).toHaveCount(0);
    await expect(dialogo.getByLabel('Categoria', { exact: true })).toHaveCount(0);
    await expect(dialogo.getByText(/Numa transferência a conta não se altera/)).toBeVisible();
    for (const campo of ['Valor', 'Data', 'Descrição', 'Estado']) {
      await expect(dialogo.getByLabel(campo, { exact: true }), campo).toHaveCount(1);
    }

    const descricao = `${PREFIXO} transferencia editada`;
    await dialogo.getByLabel('Descrição', { exact: true }).fill(descricao);
    await dialogo.getByRole('button', { name: 'Guardar alterações', exact: true }).click();

    /*
     * Espera pelo desfecho (aviso de sucesso **ou** a recusa do servidor) e só
     * depois julga: com o `accountId` de volta a mensagem aparece em menos de um
     * segundo, e a falha traz o texto real — nunca um timeout de 20 s.
     */
    await page.waitForFunction(
      (recusa) => {
        const corpo = document.body.innerText;
        return corpo.includes('Lançamento atualizado.') || corpo.includes(recusa);
      },
      RECUSA,
      { timeout: 20_000 },
    );

    const corpo = await page.locator('body').innerText();
    expect(corpo, 'o servidor não pode recusar a gravação de uma transferência').not.toContain(
      RECUSA,
    );
    await expect(page.getByText('Lançamento atualizado.')).toBeVisible();

    const pernas = await lerPorDescricao(email(), descricao);
    expect(pernas, 'as duas pernas ficam com a descrição nova').toHaveLength(2);
    expect(new Set(pernas.map((perna) => perna.transferGroupId)).size).toBe(1);
  });

  test('mudar o valor grava e espelha o sinal na outra perna', async ({ page }) => {
    const dialogo = await abrirEdicao(page, `${PREFIXO} transferencia editada`);
    await dialogo.getByLabel('Valor', { exact: true }).fill('500,00');
    await dialogo.getByRole('button', { name: 'Guardar alterações', exact: true }).click();
    await esperarAviso(page, 'Lançamento atualizado.');

    const pernas = await lerPorDescricao(email(), `${PREFIXO} transferencia editada`);
    expect(pernas).toHaveLength(2);
    expect(pernas.map((perna) => perna.amountInCents)).toEqual([-50000, 50000]);
  });

  test('uma despesa continua a mostrar a Conta e a gravá-la', async ({ page }) => {
    const descricao = `${PREFIXO} despesa`;
    await abrirRota(page, '/transacoes');
    const rapido = formularioDeLancamentoRapido(page);
    await rapido.getByRole('radio', { name: 'Gasto', exact: true }).click();
    await escolherNoSelect(rapido.getByLabel('Categoria', { exact: true }), 'Alimentação');
    await rapido.getByLabel('Valor', { exact: true }).fill('12,00');
    await rapido.getByLabel('Descrição', { exact: true }).fill(descricao);
    await rapido.getByRole('button', { name: 'Lançar', exact: true }).click();
    await esperarAviso(page, 'Gasto registado.');

    const dialogo = await abrirEdicao(page, descricao);
    const conta = dialogo.getByLabel('Conta', { exact: true });
    await expect(conta, 'a despesa continua a mostrar a Conta').toHaveCount(1);
    await escolherNoSelect(conta, CONTA_DESTINO);
    await dialogo.getByRole('button', { name: 'Guardar alterações', exact: true }).click();
    await esperarAviso(page, 'Lançamento atualizado.');

    const linhas = await lerPorDescricao(email(), descricao);
    const idDestino = await idDaConta(email(), CONTA_DESTINO);
    expect(linhas, 'a despesa continua a ser uma linha').toHaveLength(1);
    expect(linhas[0]?.accountId, 'a conta gravada é a escolhida').toBe(idDestino);
  });

  test('axe 0 com o diálogo de uma transferência aberto, a 1280 e a 360', async ({ page }) => {
    for (const largura of [1280, 360]) {
      await page.setViewportSize({ width: largura, height: largura === 360 ? 800 : 1000 });
      const dialogo = await abrirEdicao(page, `${PREFIXO} transferencia`);
      await expect(dialogo.getByText(/Numa transferência a conta não se altera/)).toBeVisible();

      const resultado = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();

      expect(
        resultado.violations.map((v) => `${largura}: ${v.id} (${v.nodes.length})`),
        `violações com o diálogo aberto a ${largura}`,
      ).toEqual([]);

      await page.keyboard.press('Escape');
      await expect(dialogo).toHaveCount(0);
    }
  });
});
