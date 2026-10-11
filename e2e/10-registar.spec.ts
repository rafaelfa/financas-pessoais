import { expect, test } from '@playwright/test';

import {
  CATEGORIAS_APROVISIONADAS,
  CONTA_PRINCIPAL,
  NOME_DE_TESTE,
  PALAVRA_PASSE,
  emailDeTeste,
} from './support/dados';
import { lerAprovisionamento } from './support/db';
import { abrirRota, entrarPelaInterface, registarPelaInterface } from './support/ui';

/**
 * Percurso 1 — registar → aprovisionamento → entrar.
 *
 * Sem sessão: este spec troca o `storageState` partilhado por um estado vazio,
 * porque o que se prova aqui é o caminho de quem ainda não tem conta.
 */

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Percurso 1 — registo e aprovisionamento', () => {
  test('registar pela interface cria a conta, aprovisiona o catálogo de Portugal e deixa entrar', async ({
    page,
  }) => {
    const email = emailDeTeste('registo');

    await registarPelaInterface(page, {
      nome: NOME_DE_TESTE,
      email,
      palavraPasse: PALAVRA_PASSE,
    });

    /*
     * O aprovisionamento é medido na base, como no `smoke.mjs`: a interface
     * podia mostrar categorias sem elas existirem. Espera-se porque o gancho de
     * criação do utilizador corre depois de a resposta do registo sair.
     */
    await expect
      .poll(async () => (await lerAprovisionamento(email)).categorias, { timeout: 30_000 })
      .toBe(CATEGORIAS_APROVISIONADAS);

    const medido = await lerAprovisionamento(email);

    expect(medido.contas, 'o registo tem de deixar pelo menos uma conta').toBeGreaterThanOrEqual(1);
    expect(medido.contaPrincipal).toBe(CONTA_PRINCIPAL);
    expect(medido.saldoAberturaDaConta).toBe(0);

    // A entrada é um passo explícito, não um efeito do registo.
    await entrarPelaInterface(page, { email, palavraPasse: PALAVRA_PASSE });
    await expect(page.getByRole('heading', { name: 'Painel', level: 1 })).toBeVisible();

    // O catálogo está lá de verdade, não só na base.
    await abrirRota(page, '/categorias');
    await expect(page.getByText('Alimentação', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Salário', { exact: true }).first()).toBeVisible();

    // E a conta existe, com o saldo calculado a zero.
    await abrirRota(page, '/contas');
    await expect(page.getByText(CONTA_PRINCIPAL, { exact: true }).first()).toBeVisible();
    // `exact` é obrigatório: a descrição da página também diz «saldo calculado».
    await expect(page.getByText('Saldo calculado', { exact: true })).toBeVisible();

    // Um ecrã autenticado continua a responder depois de entrar.
    await abrirRota(page, '/transacoes');
    await expect(page.getByRole('heading', { name: 'Transações', level: 1 })).toBeVisible();
  });
});
