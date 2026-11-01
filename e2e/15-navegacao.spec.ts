import { expect, test, type Page } from '@playwright/test';

/**
 * Percurso 15 — chega-se aos ecrãs pelo menu.
 *
 * Os percursos 45 e 55 abrem `/contas-pagar-receber` e `/consolidacao-contas`
 * escrevendo o endereço (`abrirRota`). Por isso não viram que os dois ecrãs não
 * tinham entrada na navegação: existiam e funcionavam, mas só para quem soubesse
 * o URL. Este percurso faz o que uma pessoa faz — entra e clica — e é o único
 * que falha se uma entrada do `nav.ts` desaparecer do menu ou da paleta: os
 * testes da barra lateral exigem os rótulos desta, e os da paleta exigem os dois
 * destinos em `ALL_NAV_ITEMS`.
 *
 * Tudo o que aqui se verifica vem do próprio `nav.ts`: a ordem da secção, o
 * link da barra lateral e os itens da paleta de comandos (`ALL_NAV_ITEMS`).
 *
 * A paleta (`Ctrl+K`) teve de ficar de fora na T19: o `CommandDialog` de
 * `components/ui/command.tsx` montava os filhos sem os envolver no `<Command>` do
 * `cmdk`, e o diálogo rebentava ao abrir com `Cannot read properties of
 * undefined (reading 'subscribe')`. A T21 corrigiu-o e o teste entrou aqui: abre
 * a paleta, confirma que não há erro na página, filtra e navega pelos dois
 * destinos.
 */

interface Destino {
  readonly rotulo: string;
  readonly url: RegExp;
  readonly titulo: string;
  /** O que se escreve na paleta para chegar a este destino. */
  readonly consulta: string;
}

/** Os dois destinos novos, na ordem acordada para a secção «Dia a dia». */
const NOVOS_DESTINOS: readonly Destino[] = [
  {
    rotulo: 'Contas a pagar/receber',
    url: /\/contas-pagar-receber$/,
    titulo: 'Contas a Pagar / Receber',
    consulta: 'contas a pagar',
  },
  {
    rotulo: 'Consolidação',
    url: /\/consolidacao-contas$/,
    titulo: 'Consolidação de Contas',
    consulta: 'consolida',
  },
];

/** A secção inteira, pela ordem em que aparece na barra lateral. */
const SECAO_DIA_A_DIA = [
  'Painel',
  'Transações',
  'Contas',
  'Contas a pagar/receber',
  'Consolidação',
  'Cartões',
];

/** A barra lateral de secretária (no telemóvel a navegação é o `MobileNav`). */
function barraLateral(page: Page) {
  return page.locator('[data-slot="sidebar"]').first();
}

/** O grupo «Dia a dia» da barra lateral. */
function grupoDiaADia(page: Page) {
  return barraLateral(page).locator('[data-slot="sidebar-group"]').filter({ hasText: 'Dia a dia' });
}

/** O link do menu, pelo rótulo — o mesmo nome acessível que um leitor de ecrã usa. */
function itemDoMenu(page: Page, rotulo: string) {
  return grupoDiaADia(page).getByRole('link', { name: rotulo, exact: true });
}

/**
 * Recolhe os erros da página (exceções e mensagens de consola de nível `error`).
 *
 * Fica vazio enquanto a aplicação não rebenta. Foi assim que o defeito da paleta
 * apareceu na T19: a exceção não deixava rasto no DOM, só na consola.
 */
function errosDaPagina(page: Page): string[] {
  const erros: string[] = [];

  page.on('pageerror', (erro) => erros.push(`pageerror: ${erro.message}`));
  page.on('console', (mensagem) => {
    if (mensagem.type() === 'error') {
      erros.push(`console: ${mensagem.text()}`);
    }
  });

  return erros;
}

/**
 * Entra na aplicação com a sessão do `globalSetup`.
 *
 * É o único endereço escrito no percurso: daqui em diante anda-se a clicar.
 */
async function entrar(page: Page): Promise<void> {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: 'Painel' })).toBeVisible();
}

test.describe('Percurso 15 — navegação da barra lateral', () => {
  test('a secção «Dia a dia» lista os destinos pela ordem acordada', async ({ page }) => {
    await entrar(page);

    await expect(grupoDiaADia(page).getByRole('link')).toHaveText(SECAO_DIA_A_DIA);
  });

  for (const destino of NOVOS_DESTINOS) {
    test(`clicar «${destino.rotulo}» abre ${destino.url.source} com o título certo`, async ({
      page,
    }) => {
      await entrar(page);

      const item = itemDoMenu(page, destino.rotulo);

      await expect(item).toBeVisible();
      await item.click();

      await expect(page).toHaveURL(destino.url);
      await expect(page.getByRole('heading', { level: 1, name: destino.titulo })).toBeVisible();
      await expect(itemDoMenu(page, destino.rotulo)).toHaveAttribute('aria-current', 'page');
    });
  }
});

test.describe('Percurso 15 — paleta de comandos', () => {
  for (const destino of NOVOS_DESTINOS) {
    test(`«${destino.consulta}» filtra e abre ${destino.url.source}`, async ({ page }) => {
      const erros = errosDaPagina(page);

      await entrar(page);

      await page.keyboard.press('Control+k');

      const paleta = page.getByRole('dialog');

      await expect(paleta).toBeVisible();

      const opcoes = paleta.getByRole('option');
      const antes = await opcoes.count();

      expect(antes, 'A paleta tem de listar os destinos do menu.').toBeGreaterThan(1);

      await page.keyboard.type(destino.consulta);

      const item = paleta.getByRole('option', { name: destino.rotulo, exact: false });

      await expect(item).toBeVisible();
      await expect
        .poll(async () => opcoes.count(), {
          message: `Escrever «${destino.consulta}» tem de reduzir a lista.`,
        })
        .toBeLessThan(antes);

      await item.click();

      await expect(page).toHaveURL(destino.url);
      await expect(page.getByRole('heading', { level: 1, name: destino.titulo })).toBeVisible();

      expect(erros, `A página lançou erros:\n${erros.join('\n')}`).toEqual([]);
    });
  }
});
