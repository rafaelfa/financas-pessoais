import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { lerCredenciais } from './support/dados';
import { limparDadosDoSpec } from './support/db';
import { abrirRota } from './support/ui';

/**
 * Acessibilidade automatizada com o axe.
 *
 * Complementa a passagem manual do `dev-ui` (`docs/spec/T8.3-acessibilidade.md`):
 * o axe apanha o que é demonstrável por regra — nome acessível, contraste
 * calculável, `label` ligado, papéis e atributos ARIA coerentes. O que ele
 * **não** apanha (ordem de foco razoável, sentido do texto, qualidade dos nomes)
 * fica declarado no relatório, não é dado como verificado.
 *
 * O critério de aceitação é zero violações **críticas/sérias**. Este teste falha
 * com as críticas; as sérias ficam registadas no artefacto
 * `e2e/.results/axe-*.json` e resumidas no relatório T8.4 — o que resta fica
 * declarado com o seletor e a razão, em vez de escondido.
 */

/** Regras WCAG 2.2 AA, que é o critério de aceitação do projeto. */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] as const;

interface AchadoDoAxe {
  readonly id: string;
  readonly impact: string | null | undefined;
  readonly help: string;
  readonly helpUrl: string;
  readonly nos: readonly { readonly seletor: string; readonly resumo: string }[];
}

/** Analisa o estado atual da página (sem navegar) — para os diálogos abertos. */
async function analisarEstado(page: Page): Promise<readonly AchadoDoAxe[]> {
  const resultado = await new AxeBuilder({ page }).withTags([...TAGS]).analyze();

  return resultado.violations.map((violacao) => ({
    id: violacao.id,
    impact: violacao.impact,
    help: violacao.help,
    helpUrl: violacao.helpUrl,
    nos: violacao.nodes.map((no) => ({
      seletor: no.target.join(' '),
      resumo: no.failureSummary ?? '',
    })),
  }));
}

async function analisar(page: Page, rota: string): Promise<readonly AchadoDoAxe[]> {
  await abrirRota(page, rota);

  return analisarEstado(page);
}

/** Escreve o artefacto e devolve o resumo legível para o relatório. */
function registar(nome: string, porRota: Record<string, readonly AchadoDoAxe[]>): void {
  const pasta = resolve(process.cwd(), 'e2e', '.results');

  mkdirSync(pasta, { recursive: true });
  writeFileSync(
    resolve(pasta, `axe-${nome}.json`),
    `${JSON.stringify(porRota, null, 2)}\n`,
    'utf8',
  );

  for (const [rota, achados] of Object.entries(porRota)) {
    const porImpacto = new Map<string, number>();

    for (const achado of achados) {
      const chave = `${achado.impact ?? 'sem impacto'}:${achado.id}`;
      porImpacto.set(chave, (porImpacto.get(chave) ?? 0) + 1);
    }

    const resumo =
      achados.length === 0
        ? 'sem violações'
        : [...porImpacto].map(([chave, total]) => `${chave} ×${String(total)}`).join(', ');

    console.log(`[axe] ${rota}: ${resumo}`);
  }
}

/** Falha com as violações críticas, listando o seletor e o motivo. */
function exigirSemCriticas(porRota: Record<string, readonly AchadoDoAxe[]>): void {
  const criticas: string[] = [];

  for (const [rota, achados] of Object.entries(porRota)) {
    for (const achado of achados) {
      if (achado.impact !== 'critical') {
        continue;
      }

      for (const no of achado.nos) {
        criticas.push(`${rota} · ${achado.id} · ${no.seletor} · ${achado.help}`);
      }
    }
  }

  expect(criticas, `violações críticas do axe:\n${criticas.join('\n')}`).toEqual([]);
}

test.describe('Acessibilidade — ecrãs autenticados', () => {
  test('os ecrãs principais não têm violações críticas', async ({ page }) => {
    const rotas = [
      '/',
      '/transacoes',
      '/contas',
      '/orcamento',
      '/objetivos',
      '/importar',
      '/relatorios',
      '/categorias',
      '/cartoes',
      '/definicoes',
      '/contas-pagar-receber',
      '/consolidacao-contas',
    ] as const;

    const porRota: Record<string, readonly AchadoDoAxe[]> = {};

    for (const rota of rotas) {
      porRota[rota] = await analisar(page, rota);
    }

    registar('autenticado', porRota);
    exigirSemCriticas(porRota);
  });
});

test.describe('Acessibilidade — diálogos dos ecrãs novos', () => {
  test('criar conta, pagar e criar grupo não têm violações críticas', async ({ page }) => {
    const descricao = `E2E T3 a11y ${Date.now().toString(36)}`;
    const porDialogo: Record<string, readonly AchadoDoAxe[]> = {};

    // Criar conta a pagar/receber: o diálogo de criação é analisado aberto e
    // depois usado para criar a conta que o diálogo de pagamento precisa.
    await abrirRota(page, '/contas-pagar-receber');
    await page.getByRole('button', { name: 'Nova Conta', exact: true }).click();

    const criar = page.getByRole('dialog').filter({ hasText: 'Nova Conta a Pagar/Receber' });

    await expect(criar).toBeVisible();
    porDialogo['/contas-pagar-receber · criar'] = await analisarEstado(page);

    await criar.getByPlaceholder('Ex: Fatura de luz, Aluguel, Salário...').fill(descricao);
    await criar.getByPlaceholder('0,00').fill('1,00');
    await criar.getByRole('button', { name: 'Criar Conta', exact: true }).click();
    await expect(criar).toBeHidden();

    // Pagar: abre com a conta criada acima.
    await page
      .locator('[data-slot="card"]')
      .filter({ hasText: descricao })
      .first()
      .getByRole('button', { name: 'Pagar/Receber', exact: true })
      .click();

    const pagar = page.getByRole('dialog').filter({ hasText: 'Pagar «' });

    await expect(pagar).toBeVisible();
    porDialogo['/contas-pagar-receber · pagar'] = await analisarEstado(page);
    await pagar.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(pagar).toBeHidden();

    // Criar grupo.
    await abrirRota(page, '/consolidacao-contas');
    await page.getByRole('button', { name: 'Novo Grupo', exact: true }).click();

    const grupo = page.getByRole('dialog').filter({ hasText: 'Novo Grupo de Contas' });

    await expect(grupo).toBeVisible();
    porDialogo['/consolidacao-contas · criar grupo'] = await analisarEstado(page);
    await grupo.getByRole('button', { name: 'Cancelar', exact: true }).click();

    await limparDadosDoSpec(lerCredenciais().email, 'E2E T3 a11y');

    registar('dialogos', porDialogo);
    exigirSemCriticas(porDialogo);
  });
});

test.describe('Acessibilidade — ecrãs de autenticação', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('entrar e registar não têm violações críticas', async ({ page }) => {
    const porRota: Record<string, readonly AchadoDoAxe[]> = {};

    for (const rota of ['/entrar', '/registar'] as const) {
      porRota[rota] = await analisar(page, rota);
    }

    registar('publico', porRota);
    exigirSemCriticas(porRota);
  });
});
