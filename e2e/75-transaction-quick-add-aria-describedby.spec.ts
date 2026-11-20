import { expect, test, type Page } from '@playwright/test';

import { abrirRota, formularioDeLancamentoRapido } from './support/ui';

/**
 * T74 — N2 + N3: mensagens de validação distintas e `aria-describedby`
 * condicional no campo Valor.
 *
 * **Segunda volta (achado 4 do Revisor).** A versão anterior escrevia no campo
 * com `input.value = ...` + `dispatchEvent(new Event('input'))`. Isso não chega
 * ao React: o *value tracker* já tem o valor novo quando o evento chega,
 * `updateValueIfChanged` devolve `false` e o `handleChange` do `MoneyInput`
 * nunca corre. O formulário submetia **vazio** e o teste afirmava a mensagem do
 * campo vazio, não a de um valor inválido. Agora escreve-se com `fill()`, que usa
 * o setter do protótipo e passa pelo React.
 *
 * **Contrato medido nesta árvore (2.ª volta):**
 * - campo vazio → «Escreve o valor.» (guard novo no `onSubmit`);
 * - `0` → «O valor não pode ser zero.» (gasto) / «O valor tem de ser maior que zero.» (transferência);
 * - com erro do formulário, o `<input>` fica `aria-invalid="true"` e
 *   `aria-describedby="lancamento-valor-erro"`; sem erro, o atributo não existe.
 *
 * O `div role="group"` que a 1.ª volta media desapareceu: o `aria-describedby`
 * vive agora no próprio `<input>`, por isso é lá que se lê.
 */

const ID_ERRO_VALOR = 'lancamento-valor-erro';

function campoValor(page: Page) {
  return page.getByLabel('Valor', { exact: true });
}

function erroValor(page: Page) {
  return page.locator(`#${ID_ERRO_VALOR}`);
}

async function descritoPor(page: Page): Promise<string | null> {
  return campoValor(page).getAttribute('aria-describedby');
}

function formulario(page: Page) {
  return formularioDeLancamentoRapido(page);
}

/**
 * Entra no modo transferência. Com uma só conta o botão fica desactivado
 * (`needsTwoAccounts`), por isso cria-se uma segunda conta pela interface — o
 * mesmo caminho que uma pessoa usa. O `global.teardown` apaga o utilizador de
 * teste e as contas dele.
 */
async function modoTransferencia(page: Page): Promise<void> {
  const nome = `T74 destino ${Date.now().toString(36)}`;

  await abrirRota(page, '/contas');
  await page.getByRole('button', { name: 'Nova conta', exact: true }).click();

  const dialogo = page.getByRole('dialog');
  await dialogo.getByLabel('Nome', { exact: true }).fill(nome);
  await dialogo.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await expect(page.getByText(nome, { exact: true }).first()).toBeVisible();

  await abrirRota(page, '/transacoes');
  await page
    .getByRole('radio', { name: 'Transferência' })
    .or(page.getByRole('button', { name: 'Transferência' }))
    .first()
    .click();
}

// --- Os quatro caminhos: {vazio, zero} × {gasto, transferência} ---

test('gasto vazio → «Escreve o valor.» e o input ligado ao erro', async ({ page }) => {
  await abrirRota(page, '/transacoes');

  // Sem erro ainda: nada a descrever.
  expect(await descritoPor(page)).toBeFalsy();

  await formulario(page).getByRole('button', { name: 'Lançar', exact: true }).click();

  await expect(erroValor(page)).toHaveText('Escreve o valor.');
  await expect(campoValor(page)).toHaveAttribute('aria-invalid', 'true');
  await expect(campoValor(page)).toHaveAttribute('aria-describedby', ID_ERRO_VALOR);
});

test('gasto zero → «O valor não pode ser zero.» e o input ligado ao erro', async ({ page }) => {
  await abrirRota(page, '/transacoes');

  await campoValor(page).fill('0');
  await formulario(page).getByRole('button', { name: 'Lançar', exact: true }).click();

  await expect(erroValor(page)).toHaveText('O valor não pode ser zero.');
  await expect(campoValor(page)).toHaveAttribute('aria-invalid', 'true');
  await expect(campoValor(page)).toHaveAttribute('aria-describedby', ID_ERRO_VALOR);
});

test('transferência vazia → «Escreve o valor.» e o input ligado ao erro', async ({ page }) => {
  await modoTransferencia(page);

  await formulario(page).getByRole('button', { name: 'Transferir', exact: true }).click();

  await expect(erroValor(page)).toHaveText('Escreve o valor.');
  await expect(campoValor(page)).toHaveAttribute('aria-invalid', 'true');
  await expect(campoValor(page)).toHaveAttribute('aria-describedby', ID_ERRO_VALOR);
});

test('transferência zero → «O valor tem de ser maior que zero.» e o input ligado ao erro', async ({
  page,
}) => {
  await modoTransferencia(page);

  await campoValor(page).fill('0');
  await formulario(page).getByRole('button', { name: 'Transferir', exact: true }).click();

  await expect(erroValor(page)).toHaveText('O valor tem de ser maior que zero.');
  await expect(campoValor(page)).toHaveAttribute('aria-invalid', 'true');
  await expect(campoValor(page)).toHaveAttribute('aria-describedby', ID_ERRO_VALOR);
});

// --- Escrita real no campo (prova de que o React recebe o valor) ---

test('escrever como o utilizador: 1 → 1, → 12,34 limpa o erro e propaga o valor', async ({
  page,
}) => {
  await abrirRota(page, '/transacoes');

  const campo = campoValor(page);

  // Valor simples: válido, sem erro e sem descrição.
  await campo.fill('1');
  await expect(campo).toHaveAttribute('aria-invalid', 'false');
  expect(await descritoPor(page)).toBeFalsy();

  // Token incompleto: o `MoneyInput` anuncia o erro dele e liga-o ao input.
  await campo.fill('1,');
  await expect(formulario(page).getByRole('alert')).toContainText('Valor inválido.');
  await expect(campo).toHaveAttribute('aria-invalid', 'true');
  expect(await descritoPor(page)).toMatch(/-erro$/);

  // Corrigir para um valor válido limpa o aviso do componente.
  await campo.fill('12,34');
  await expect(formulario(page).getByRole('alert')).toHaveCount(0);
  await expect(campo).toHaveAttribute('aria-invalid', 'false');
  expect(await descritoPor(page)).toBeFalsy();

  /*
   * A prova de que o valor chegou ao formulário (e não só ao texto do input):
   * ao submeter, o erro que aparece é o da **categoria** — a validação do
   * montante passou. Se o `onValueChange` do `MoneyInput` deixasse de correr, o
   * formulário veria `amountInCents === null` e o guard responderia
   * «Escreve o valor.». É esse o assert que fica vermelho nesse cenário.
   */
  await formulario(page).getByRole('button', { name: 'Lançar', exact: true }).click();
  await expect(page.locator('#lancamento-categoria-erro')).toHaveText('Escolhe uma categoria.');
  await expect(erroValor(page)).toHaveCount(0);
});

// --- Estado sem erro ---

test('sem erro activo o input não tem aria-describedby', async ({ page }) => {
  await abrirRota(page, '/transacoes');

  expect(await descritoPor(page)).toBeFalsy();
  await expect(campoValor(page)).toHaveAttribute('aria-invalid', 'false');
});
