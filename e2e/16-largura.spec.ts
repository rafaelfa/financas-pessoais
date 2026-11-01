import { expect, test } from '@playwright/test';

import { ESTADO_DE_SESSAO, lerCredenciais } from './support/dados';
import { limparDadosDoSpec } from './support/db';
import { abrirRota, hojeEmLisboa, lancarGasto } from './support/ui';

/**
 * Percurso 16 — nenhum ecrã obriga a página a rolar para o lado.
 *
 * O defeito que isto guarda (T23): o `SidebarInset` era um *flex item* sem
 * `min-w-0`, e o `min-width: auto` não o deixava encolher abaixo do conteúdo.
 * A tabela de `/transacoes` — células `nowrap` — empurrava o painel para 1309 px
 * num ecrã de 1200: a página inteira ganhava scroll horizontal em vez de ser a
 * tabela a rolar dentro do cartão. Também apareceu em `/recorrencias` e, a
 * 1024 px, em `/cartoes`.
 *
 * **Tem de haver uma transação.** Com a tabela vazia o ecrã não tem largura
 * mínima nenhuma e o teste passaria sem provar nada — foi por isso que este
 * spec criou uma antes de medir, e a apaga no fim.
 *
 * Mede-se a 1200 px e a 1024 px, que é onde o problema se vê com a barra lateral
 * aberta. Tolerância de 1 px para o arredondamento sub-pixel.
 */

/** As 14 rotas autenticadas. */
const ROTAS = [
  '/',
  '/transacoes',
  '/contas',
  '/contas-pagar-receber',
  '/consolidacao-contas',
  '/cartoes',
  '/orcamento',
  '/objetivos',
  '/recorrencias',
  '/regras',
  '/categorias',
  '/relatorios',
  '/importar',
  '/definicoes',
] as const;

const LARGURAS = [1200, 1024] as const;

const PREFIXO = 'E2E T23 largura';

let transacaoCriada = false;

test.beforeAll(async ({ browser }) => {
  const contexto = await browser.newContext({
    storageState: ESTADO_DE_SESSAO,
    locale: 'pt-PT',
    viewport: { width: 1200, height: 900 },
  });
  const page = await contexto.newPage();

  await abrirRota(page, '/transacoes');
  await lancarGasto(page, {
    valor: '12,34',
    descricao: `${PREFIXO}: uma descrição com comprimento de gente`,
    categoria: 'Outros',
    data: hojeEmLisboa(),
  });

  transacaoCriada = true;
  await contexto.close();
});

test.afterAll(async () => {
  if (!transacaoCriada) {
    return;
  }

  const { email } = lerCredenciais();
  await limparDadosDoSpec(email, PREFIXO);
});

for (const largura of LARGURAS) {
  test.describe(`Percurso 16 — sem scroll horizontal a ${largura} px`, () => {
    test.use({ viewport: { width: largura, height: 900 } });

    for (const rota of ROTAS) {
      test(`${rota} cabe na janela`, async ({ page }) => {
        await abrirRota(page, rota);
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();

        const medida = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          inner: window.innerWidth,
        }));

        expect(
          medida.scroll,
          `${rota} a ${largura}px: a página tem ${medida.scroll - medida.inner}px a mais.`,
        ).toBeLessThanOrEqual(medida.inner + 1);
      });
    }
  });
}
