import { expect, test } from '@playwright/test';

import { abrirRota, esperarAviso } from './support/ui';

/**
 * Percurso 97 — as preferências de Definições gravam (T97).
 *
 * O motor lê `User.monthStartDay` e `User.accountingBasis`; até aqui ninguém as
 * escrevia. Este percurso muda o dia e o regime pela interface, confirma o aviso,
 * recarrega e verifica que ficou — e repõe os valores originais no fim, porque a
 * suite inteira partilha o mesmo utilizador e o painel depende deles.
 */

const DIA_ORIGINAL = 'Dia 1';
const REGIME_ORIGINAL = 'Caixa';

test.describe('T97 — guardar as preferências', () => {
  test.afterAll(async ({ browser }) => {
    /* Reposição por segurança: um teste falhado não pode deixar o dia a 21. */
    const contexto = await browser.newContext({
      storageState: 'e2e/.auth/utilizador.json',
      locale: 'pt-PT',
    });
    const page = await contexto.newPage();
    await page.goto('/definicoes');
    await page.getByRole('combobox', { name: 'O mês começa no dia' }).click();
    await page.getByRole('option', { name: DIA_ORIGINAL, exact: true }).click();
    await page.getByRole('radio', { name: REGIME_ORIGINAL }).click();
    await page.getByRole('button', { name: 'Guardar preferências' }).click();
    await esperarAviso(page, 'Preferências guardadas.');
    await contexto.close();
  });

  test('muda o dia e o regime, guarda e sobrevive ao recarregar', async ({ page }) => {
    await abrirRota(page, '/definicoes');

    /* Teclado a sério: setas mudam e o foco segue (roving tabindex). */
    await page.getByRole('radio', { name: 'Caixa' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('radio', { name: 'Competência' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(page.getByRole('radio', { name: 'Competência' })).toHaveAttribute('tabindex', '0');
    await expect(page.getByRole('radio', { name: 'Caixa' })).toHaveAttribute('tabindex', '-1');

    await page.getByRole('combobox', { name: 'O mês começa no dia' }).click();
    await page.getByRole('option', { name: 'Dia 21', exact: true }).click();
    await page.getByRole('button', { name: 'Guardar preferências' }).click();

    /*
     * A confirmação é um aviso fora do segmento revalidado (o `revalidatePath`
     * desmonta o formulário e um estado local morria). Continua presente depois
     * do pedido completo.
     */
    await esperarAviso(page, 'Preferências guardadas.');

    await page.reload();
    await page.waitForSelector('main h1');

    await expect(page.getByRole('combobox', { name: 'O mês começa no dia' })).toContainText(
      'Dia 21',
    );
    await expect(page.getByRole('radio', { name: 'Competência' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  test('um POST abortado diz que não gravou e deixa tentar outra vez', async ({ page }) => {
    /*
     * T98: se o pedido abortar (rede, servidor em baixo) a promessa da Server
     * Action rejeita dentro do `startTransition`; sem `try/catch` no sítio certo
     * o ecrã era substituído pelo error boundary — «Algo falhou ao carregar este
     * ecrã» — e nada dizia que não gravou.
     */
    await page.route('**/definicoes', (rota) =>
      rota.request().method() === 'POST' ? rota.abort('failed') : rota.continue(),
    );

    await abrirRota(page, '/definicoes');
    await page.getByRole('button', { name: 'Guardar preferências' }).click();

    await expect(page.locator('form [role="alert"]')).toContainText('não foram guardadas');
    await expect(page.getByRole('button', { name: 'Guardar preferências' })).toBeEnabled();
    await expect(page.getByRole('heading', { level: 1, name: 'Definições' })).toBeVisible();

    /* E o mesmo botão volta a funcionar quando a rede volta. */
    await page.unroute('**/definicoes');
    await page.getByRole('button', { name: 'Guardar preferências' }).click();
    await esperarAviso(page, 'Preferências guardadas.');
  });
});
