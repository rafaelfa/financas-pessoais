import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { ESTADO_DE_SESSAO, lerCredenciais } from './support/dados';
import { limparDadosDoSpec } from './support/db';
import {
  abrirRota,
  escolherNoSelect,
  esperarAviso,
  formularioDeLancamentoRapido,
} from './support/ui';

/**
 * Percurso 36 — os dois defeitos herdados do extrato (T57).
 *
 * 1. `listTransactions` devolvia o `kind` do Prisma em **maiúsculas**: o selo caía
 *    no `?? kind` e o ecrã mostrava «EXPENSE»/«INCOME»/«TRANSFER» em inglês, sem
 *    ícone, e o diálogo de edição escondia o campo Categoria em todos os
 *    lançamentos (`showCategory` compara com 'expense'/'income').
 * 2. O gatilho inativo do separador de `/importar` estava a 4,42:1, abaixo dos
 *    4,5:1 de AA.
 *
 * A spec falha se qualquer um voltar: `kind: row.kind` cru deixa o selo em
 * inglês e esconde a Categoria; `text-foreground/60` volta a pôr o `axe` com uma
 * violação `color-contrast` em `/importar`.
 */

const PREFIXO = 'T57 prova';
const CONTA_DESTINO = `${PREFIXO} conta destino`;
const CRUS = ['EXPENSE', 'INCOME', 'TRANSFER', 'GOAL_DEPOSIT', 'GOAL_WITHDRAWAL'];

const email = (): string => lerCredenciais().email;

function linhaDoExtrato(page: Page, descricao: string) {
  return page.getByRole('row', { name: new RegExp(descricao) }).first();
}

async function lancar(
  page: Page,
  opcoes: {
    readonly modo: 'Gasto' | 'Ganho' | 'Transferência';
    readonly descricao: string;
    readonly valor: string;
    readonly categoria?: string;
  },
): Promise<void> {
  const rapido = formularioDeLancamentoRapido(page);

  await rapido.getByRole('radio', { name: opcoes.modo, exact: true }).click();

  if (opcoes.modo === 'Transferência') {
    await escolherNoSelect(rapido.getByLabel('Da conta', { exact: true }), 'Carteira principal');
    await escolherNoSelect(rapido.getByLabel('Para a conta', { exact: true }), CONTA_DESTINO);
  } else if (opcoes.categoria !== undefined) {
    await escolherNoSelect(rapido.getByLabel('Categoria', { exact: true }), opcoes.categoria);
  }

  await rapido.getByLabel('Valor', { exact: true }).fill(opcoes.valor);
  await rapido.getByLabel('Descrição', { exact: true }).fill(opcoes.descricao);
  await rapido
    .getByRole('button', {
      name: opcoes.modo === 'Transferência' ? 'Transferir' : 'Lançar',
      exact: true,
    })
    .click();
  await esperarAviso(
    page,
    opcoes.modo === 'Transferência' ? 'Transferência registada nas duas contas.' : /registad[oa]/,
  );
}

test.describe('extrato: rótulos humanos e campo Categoria (T57)', () => {
  test.afterAll(async () => {
    await limparDadosDoSpec(email(), PREFIXO);
  });

  test.beforeAll(async ({ browser }) => {
    const contexto = await browser.newContext({ storageState: ESTADO_DE_SESSAO, locale: 'pt-PT' });
    const page = await contexto.newPage();
    await abrirRota(page, '/contas');
    await page.getByRole('button', { name: 'Nova conta', exact: true }).click();
    const dialogo = page.getByRole('dialog');
    await dialogo.getByLabel('Nome', { exact: true }).fill(CONTA_DESTINO);
    await dialogo.getByRole('button', { name: 'Criar conta', exact: true }).click();
    await esperarAviso(page, 'Conta criada.');

    await abrirRota(page, '/transacoes');
    await lancar(page, {
      modo: 'Gasto',
      descricao: `${PREFIXO} despesa`,
      valor: '31,00',
      categoria: 'Alimentação',
    });
    await lancar(page, {
      modo: 'Ganho',
      descricao: `${PREFIXO} receita`,
      valor: '32,00',
      categoria: 'Salário',
    });
    await lancar(page, {
      modo: 'Transferência',
      descricao: `${PREFIXO} transferencia`,
      valor: '33,00',
    });
    await contexto.close();
  });

  test('o selo mostra o rótulo humano e o ícone da natureza, nunca o enum', async ({ page }) => {
    for (const largura of [1280, 360]) {
      await page.setViewportSize({ width: largura, height: largura === 360 ? 800 : 1000 });
      await abrirRota(page, '/transacoes');
      await expect(page.getByRole('checkbox').first()).toBeVisible();

      const texto = await page.evaluate(() => document.body.innerText);

      for (const cru of CRUS) {
        expect(texto, `o texto da página não pode conter «${cru}»`).not.toContain(cru);
      }

      const seloDespesa = linhaDoExtrato(page, `${PREFIXO} despesa`)
        .locator('[data-slot="badge"]')
        .first();
      const seloReceita = linhaDoExtrato(page, `${PREFIXO} receita`)
        .locator('[data-slot="badge"]')
        .first();
      const seloTransferencia = linhaDoExtrato(page, `${PREFIXO} transferencia`)
        .locator('[data-slot="badge"]')
        .first();

      await expect(seloDespesa).toHaveText('Gasto');
      await expect(seloReceita).toHaveText('Ganho');
      await expect(seloTransferencia).toHaveText('Transferência');

      /* Despesa e ganho não têm ícone por desenho; a transferência tem. */
      await expect(seloDespesa.locator('svg')).toHaveCount(0);
      await expect(seloReceita.locator('svg')).toHaveCount(0);
      await expect(seloTransferencia.locator('svg')).toHaveCount(1);

      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(largura);
    }
  });

  test('o diálogo de edição tem Categoria numa despesa e num ganho, e não numa transferência', async ({
    page,
  }) => {
    const casos: readonly [string, string, boolean][] = [
      [`${PREFIXO} despesa`, 'despesa', true],
      [`${PREFIXO} receita`, 'ganho', true],
      [`${PREFIXO} transferencia`, 'transferência', false],
    ];

    for (const [descricao, nome, temCategoria] of casos) {
      await abrirRota(page, '/transacoes');
      await expect(page.getByRole('checkbox').first()).toBeVisible();

      await linhaDoExtrato(page, descricao).getByRole('button', { name: /Ações/ }).click();
      await page.getByRole('menuitem', { name: 'Editar', exact: true }).click();

      const dialogo = page.getByRole('dialog');
      await expect(dialogo).toBeVisible();

      const campo = dialogo.getByLabel('Categoria', { exact: true });

      if (temCategoria) {
        await expect(campo, `a ${nome} tem de mostrar a Categoria`).toHaveCount(1);
      } else {
        await expect(campo, `a ${nome} não pode mostrar a Categoria`).toHaveCount(0);
      }

      await page.keyboard.press('Escape');
      await expect(dialogo).toHaveCount(0);
    }
  });

  test('/importar não tem violações de contraste nos dois temas', async ({ page }) => {
    for (const tema of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: tema });
      await abrirRota(page, '/importar');
      await expect(page.getByRole('tab').first()).toBeVisible();

      const resultado = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();

      expect(
        resultado.violations.map((v) => `${tema}: ${v.id} (${v.nodes.length})`),
        `violações em /importar no tema ${tema}`,
      ).toEqual([]);
    }

    await page.emulateMedia({ colorScheme: 'light' });
  });
});
