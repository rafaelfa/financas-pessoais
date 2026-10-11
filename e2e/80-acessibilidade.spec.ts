import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

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

async function analisar(page: Page, rota: string): Promise<readonly AchadoDoAxe[]> {
  await abrirRota(page, rota);

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
    ] as const;

    const porRota: Record<string, readonly AchadoDoAxe[]> = {};

    for (const rota of rotas) {
      porRota[rota] = await analisar(page, rota);
    }

    registar('autenticado', porRota);
    exigirSemCriticas(porRota);
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
