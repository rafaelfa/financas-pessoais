import { expect, test } from '@playwright/test';

import { abrirRota } from './support/ui';

/**
 * Percurso 92 — a frase de `/definicoes` diz a verdade (T92).
 *
 * A página dizia «Guardar preferências fica disponível quando a aplicação
 * estiver ligada à conta» — sem botão de guardar, sem `action`. Desde a T97 as
 * duas preferências (dia de início do mês e regime) são graváveis de verdade
 * (`server/preferences-actions.ts`), e a frase antiga não pode voltar.
 */

test.describe('T92 — a frase de Definições', () => {
  test('não promete guardar preferências que não existem', async ({ page }) => {
    await abrirRota(page, '/definicoes');

    await expect(page.getByRole('heading', { level: 1, name: 'Definições' })).toBeVisible();
    await expect(
      page.getByText(/fica disponível quando a aplicação estiver ligada à conta/i),
    ).toHaveCount(0);
    await expect(page.getByText(/Estes valores são fixos nesta versão/i)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Guardar preferências' })).toBeVisible();
  });
});
