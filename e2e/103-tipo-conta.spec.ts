import { expect, test } from '@playwright/test';

import { lerCredenciais } from './support/dados';
import { limparDadosDoSpec } from './support/db';
import { abrirRota, escolherNoSelect } from './support/ui';

/**
 * Percurso 103 — o cartão de conta diz o tipo em português (T103).
 *
 * O defeito: `server/accounts.ts` entregava o enum do Prisma em maiúsculas
 * (`WALLET`, `CHECKING`, `SAVINGS`) e `ACCOUNT_TYPE_LABELS`/`ACCOUNT_TYPE_ICONS`
 * são indexados por minúsculas — o cartão mostrava o enum cru **e** o ícone de
 * recurso (a balança), igual nos três tipos. Nenhum e2e lia o tipo, e por isso o
 * defeito podia voltar sem ficar vermelho. Este é o sítio que o prende.
 */

const PREFIXO = 'T103 tipo';
const SEGUNDA_CONTA = `${PREFIXO} ordem`;

test.describe('T103 — o tipo de conta no cartão', () => {
  test.afterAll(async () => {
    await limparDadosDoSpec(lerCredenciais().email, PREFIXO);
  });

  test('o cartão mostra o tipo em português e cada tipo tem o seu ícone', async ({ page }) => {
    await abrirRota(page, '/contas');

    const cartaoDaConta = (nome: string) =>
      page
        .locator('[data-slot="card"]')
        .filter({ has: page.getByText(nome, { exact: true }) })
        .first();

    /* A conta provisionada é uma carteira. */
    const carteira = cartaoDaConta('Carteira principal');
    await expect(carteira, 'a carteira diz «Carteira»').toContainText('Carteira');
    await expect(carteira, 'não mostra o enum do Prisma').not.toContainText('WALLET');
    await expect(carteira.locator('svg.lucide-wallet'), 'o ícone é o da carteira').toHaveCount(1);

    /* Uma conta à ordem, criada pela interface (o tipo vai por um select). */
    await page.getByRole('button', { name: 'Nova conta', exact: true }).first().click();
    const dialogo = page.getByRole('dialog');
    await dialogo.waitFor({ state: 'visible' });
    await dialogo.locator('#conta-nome').fill(SEGUNDA_CONTA);
    await escolherNoSelect(dialogo.locator('#conta-tipo'), 'Conta à ordem');
    await dialogo.getByRole('button', { name: 'Criar conta', exact: true }).click();
    await dialogo.waitFor({ state: 'detached', timeout: 30_000 });

    const ordem = cartaoDaConta(SEGUNDA_CONTA);
    await expect(ordem, 'a conta à ordem diz «Conta à ordem»').toContainText('Conta à ordem');
    await expect(ordem, 'não mostra «CHECKING»').not.toContainText('CHECKING');
    await expect(ordem.locator('svg.lucide-landmark'), 'o ícone é o do banco').toHaveCount(1);

    /* O diálogo de edição abre com o tipo preenchido, não vazio. */
    await page
      .getByRole('button', { name: `Ações da conta ${SEGUNDA_CONTA}` })
      .first()
      .click();
    await page.getByRole('menuitem', { name: 'Editar', exact: true }).click();
    const edicao = page.getByRole('dialog');
    await expect(edicao.locator('#conta-tipo'), 'o tipo abre preenchido').toContainText(
      'Conta à ordem',
    );
  });
});
