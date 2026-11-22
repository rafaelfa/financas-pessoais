import { expect, test } from '@playwright/test';

import { abrirRota } from './support/ui';

/**
 * Percurso 92 — a frase de `/definicoes` diz a verdade (T92).
 *
 * A página dizia «Guardar preferências fica disponível quando a aplicação
 * estiver ligada à conta» — e não há botão de guardar, nem `action`, nem tabela
 * de preferências (25 modelos, nenhum deles de definições). A frase passou a
 * dizer o estado real; este teste impede que a promessa volte.
 */

test.describe('T92 — a frase de Definições', () => {
  test('não promete guardar preferências que não existem', async ({ page }) => {
    await abrirRota(page, '/definicoes');

    await expect(page.getByRole('heading', { level: 1, name: 'Definições' })).toBeVisible();
    await expect(
      page.getByText(/fica disponível quando a aplicação estiver ligada à conta/i),
    ).toHaveCount(0);
    await expect(page.getByText(/Estes valores são fixos nesta versão/i)).toBeVisible();
  });
});
