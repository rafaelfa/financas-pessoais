import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { expect, test, type Locator, type Page } from '@playwright/test';

import { CONTA_PRINCIPAL, lerCredenciais } from './support/dados';
import { contarTransacoes } from './support/db';
import { abrirRota, lancarGasto } from './support/ui';

/**
 * Percurso 6 — exportar os movimentos em CSV e reimportar o próprio ficheiro.
 *
 * O que se prova: o CSV que a aplicação escreve **volta a entrar** pelo
 * importador sem criar uma segunda cópia de nada. A verificação é feita em dois
 * sítios: na pré-visualização (nenhuma linha nova) e na base de dados (a
 * contagem de movimentos da conta não muda).
 *
 * O ficheiro descarregado é guardado em `e2e/.tmp/` e lido como texto: o BOM, o
 * separador `;` e os fins de linha CRLF fazem parte do contrato com o Excel
 * português, e um teste que só olhasse para o ecrã não os via.
 */

/** O `<dd>` que segue o `<dt>` com este rótulo, no resumo da pré-visualização. */
function facto(page: Page, rotulo: string): Locator {
  return page.locator('dt', { hasText: rotulo }).first().locator('xpath=following-sibling::dd[1]');
}

/** Exporta os lançamentos e devolve o caminho e o conteúdo do ficheiro. */
async function exportarCsv(
  page: Page,
  etiqueta: string,
): Promise<{ caminho: string; conteudo: string }> {
  const pasta = resolve(process.cwd(), 'e2e', '.tmp');

  mkdirSync(pasta, { recursive: true });

  // O painel de exportação vive em `/importar` — não em `/transacoes`.
  await abrirRota(page, '/importar');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exportar lançamentos (CSV)' }).click(),
  ]);

  const caminho = resolve(pasta, `${etiqueta}-${download.suggestedFilename()}`);

  await download.saveAs(caminho);

  return { caminho, conteudo: readFileSync(caminho, 'utf8') };
}

/** Reimporta um ficheiro pela interface e para na pré-visualização. */
async function reimportar(page: Page, caminho: string): Promise<void> {
  await abrirRota(page, '/importar');
  await page.locator('#importar-ficheiro').setInputFiles(caminho);
  await page.getByRole('button', { name: 'Pré-visualizar' }).click();
  await expect(page.getByText('Resumo do ficheiro (CSV)')).toBeVisible();
}

test.describe('Percurso 6 — exportar e reimportar', () => {
  test('o CSV exportado tem o formato do Excel português e volta a entrar sem duplicar', async ({
    page,
  }) => {
    const etiqueta = Date.now().toString(36);
    const credenciais = lerCredenciais();

    // Um movimento próprio, com descrição e valor únicos, para o ficheiro ter
    // algo que não pode ser confundido com nada.
    await abrirRota(page, '/transacoes');
    await lancarGasto(page, {
      valor: '41,17',
      descricao: `E2E exportação ${etiqueta}`,
      categoria: 'Lazer',
    });

    const antes = await contarTransacoes(credenciais.email, CONTA_PRINCIPAL);

    const { caminho, conteudo } = await exportarCsv(page, etiqueta);

    // Contrato do ficheiro: BOM, separador `;`, CRLF e o cabeçalho fixo.
    expect(conteudo.startsWith('\uFEFF'), 'o CSV tem de começar pelo BOM').toBe(true);
    expect(conteudo).toContain('Data;Descrição;Valor;Saldo;Id;Conta;Categoria');
    expect(conteudo).toContain('\r\n');
    expect(conteudo).toContain(`E2E exportação ${etiqueta}`);

    const linhas = conteudo.split('\r\n').filter((linha) => linha.trim() !== '');

    expect(linhas.length - 1, 'uma linha de dados por movimento exportado').toBe(antes);

    // Reimportar o próprio ficheiro para a mesma conta: nada pode ser novo.
    await reimportar(page, caminho);

    await expect(facto(page, 'Novas')).toHaveText('0');
    await expect(facto(page, 'Duplicadas')).toHaveText(String(antes));
    await expect(page.getByRole('button', { name: 'Nenhuma linha escolhida' })).toBeDisabled();

    // E, medido na base: nenhum movimento novo.
    expect(await contarTransacoes(credenciais.email, CONTA_PRINCIPAL)).toBe(antes);
  });

  /**
   * Movimentos repetidos no ciclo exportar → reimportar.
   *
   * Dois movimentos **manuais** com a mesma data, o mesmo valor e a mesma
   * descrição (a mesma impressão digital). A exportação distingue-os como manda
   * a convenção — o primeiro leva a impressão digital, o segundo leva `…:2`
   * (`apps/web/src/server/export.ts:109-124`) — e a base não tem `fitId` nenhum,
   * porque foram lançados à mão.
   *
   * **Este teste era um `test.fail`.** A primeira versão do importador só
   * conhecia a impressão base derivada (`packages/shared/src/import/preview.ts`),
   * pelo que o `…:2` do ficheiro aparecia como **novo e selecionado** e confirmar
   * duplicava o segundo café. Foi o achado I11a do relatório
   * `docs/spec/T8.4-e2e-e-desempenho.md`; a correção passou a **contar** os
   * movimentos existentes com a mesma impressão base e a indexar `base:1..base:N`.
   * O teste ficou a guardar o comportamento certo.
   *
   * A verificação pura do mesmo cenário, sem browser, está em
   * `e2e/support/verificar-identificadores.mjs` — incluindo o contra-exemplo que
   * impede a correção de ser boa demais (um café na conta, dois no ficheiro: o
   * segundo **tem** de entrar).
   */
  test('movimentos repetidos fecham o ciclo exportar → reimportar', async ({ page }) => {
    const etiqueta = Date.now().toString(36);

    await abrirRota(page, '/transacoes');
    await lancarGasto(page, {
      valor: '12,30',
      descricao: `E2E café ${etiqueta}`,
      categoria: 'Lazer',
    });
    await lancarGasto(page, {
      valor: '12,30',
      descricao: `E2E café ${etiqueta}`,
      categoria: 'Lazer',
    });

    const { caminho, conteudo } = await exportarCsv(page, `${etiqueta}-repetidos`);

    /*
     * A expectativa sai do **próprio ficheiro**, não de um número fixo.
     *
     * A exportação sem filtros leva todos os movimentos da conta — incluindo os
     * que os percursos anteriores deixaram lá, porque o utilizador é partilhado.
     * A primeira versão deste teste esperava `Duplicadas = 2` (só os dois cafés)
     * e falhou com `Received: "6"` na corrida de 2026-10-11 16:2x: era uma
     * premissa minha sobre o estado da conta, não um defeito do produto. O que o
     * teste tem de provar é que **o ficheiro inteiro volta a ser reconhecido como
     * já existente**, seja qual for o tamanho dele.
     */
    const linhasDoFicheiro = conteudo.split('\r\n').filter((linha) => linha.trim() !== '');

    await reimportar(page, caminho);

    // Nenhum movimento novo e todas as linhas do ficheiro reconhecidas: os dois
    // cafés iguais incluídos, que é o caso que o I11a media.
    await expect(facto(page, 'Novas')).toHaveText('0');
    await expect(facto(page, 'Duplicadas')).toHaveText(String(linhasDoFicheiro.length - 1));
    await expect(page.getByRole('button', { name: 'Nenhuma linha escolhida' })).toBeDisabled();
  });
});
