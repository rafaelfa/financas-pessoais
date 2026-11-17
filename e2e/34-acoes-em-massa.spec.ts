import AxeBuilder from '@axe-core/playwright';
import { expect, request, test, type Page } from '@playwright/test';

import { emailDeTeste, lerCredenciais, PALAVRA_PASSE } from './support/dados';
import {
  apagarUtilizador,
  contarPorDescricao,
  contarTransacoes,
  criarLancamentosDoSpec,
  idDoLancamento,
  lerLancamento,
  limparDadosDoSpec,
} from './support/db';
import {
  abrirRota,
  escolherNoSelect,
  esperarAviso,
  formularioDeLancamentoRapido,
} from './support/ui';

/**
 * Percurso 34 — ações em massa no extrato (T53).
 *
 * Prende os três comportamentos que podem partir em silêncio: apagar **uma**
 * perna de uma transferência apaga o par (e a confirmação conta um, não dois),
 * mudar de vista (página, filtro, tamanho) faz desaparecer a seleção — é o
 * `key` da tabela no `page.tsx` — e o servidor recusa um pedido de 201 ids ou
 * uma linha que não é do utilizador **sem** aplicar as válidas.
 *
 * Os dados do cenário levam `T53 prova` no início e são apagados no `afterAll`;
 * o utilizador «outro» é criado pelas rotas de autenticação e apagado no fim.
 */

const PREFIXO = 'T53 prova';
const CONTA_DESTINO = `${PREFIXO} conta destino`;
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] as const;

const email = (): string => lerCredenciais().email;

/** Utilizador criado no teste do servidor, para o `afterAll` o apagar. */
let outroUtilizador: string | undefined;

function barra(page: Page) {
  return page.getByRole('region', { name: 'Ações sobre os lançamentos selecionados' });
}

function caixaDaLinha(page: Page, descricao: string) {
  return page.getByRole('checkbox', { name: new RegExp(`^Selecionar ${descricao}`) });
}

/** Cria a segunda conta pela interface (é preciso duas para uma transferência). */
async function criarContaDestino(page: Page): Promise<void> {
  await abrirRota(page, '/contas');
  await page.getByRole('button', { name: 'Nova conta', exact: true }).click();

  const dialogo = page.getByRole('dialog');
  await dialogo.getByLabel('Nome', { exact: true }).fill(CONTA_DESTINO);
  await dialogo.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await esperarAviso(page, 'Conta criada.');
}

/** Executa a server action por HTTP, com o id que a página usou e um corpo à escolha. */
/** Uma perna da transferência (o par tem duas linhas com a mesma descrição). */
function pernaDaLinha(page: Page, descricao: string) {
  return caixaDaLinha(page, descricao).first();
}

async function chamarAcao(
  page: Page,
  cabecalhos: Record<string, string>,
  corpo: unknown,
): Promise<{ status: number; texto: string }> {
  const origem = new URL(page.url()).origin;
  const resposta = await page.context().request.post(`${origem}/transacoes`, {
    headers: cabecalhos,
    data: JSON.stringify(corpo),
  });

  return { status: resposta.status(), texto: await resposta.text() };
}

test.describe('ações em massa no extrato', () => {
  test.afterAll(async () => {
    await limparDadosDoSpec(email(), PREFIXO);

    if (outroUtilizador !== undefined) {
      await apagarUtilizador(outroUtilizador);
    }
  });

  test('apagar uma perna de uma transferência apaga o par e conta 1 lançamento', async ({
    page,
  }) => {
    const descricao = `${PREFIXO} transferencia ${Date.now().toString(36)}`;

    await criarContaDestino(page);
    await abrirRota(page, '/transacoes');

    const rapido = formularioDeLancamentoRapido(page);
    await rapido.getByRole('radio', { name: 'Transferência' }).click();
    await escolherNoSelect(rapido.getByLabel('Da conta', { exact: true }), 'Carteira principal');
    await escolherNoSelect(rapido.getByLabel('Para a conta', { exact: true }), CONTA_DESTINO);
    await rapido.getByLabel('Valor', { exact: true }).fill('77,00');
    await rapido.getByLabel('Descrição', { exact: true }).fill(descricao);
    await rapido.getByRole('button', { name: 'Transferir', exact: true }).click();
    await esperarAviso(page, 'Transferência registada nas duas contas.');

    /* Um par, duas linhas: é a premissa do critério. */
    expect(await contarPorDescricao(email(), descricao), 'o par tem de nascer com 2 linhas').toBe(
      2,
    );

    await abrirRota(page, '/transacoes');
    const antes = await contarTransacoes(email());

    await pernaDaLinha(page, descricao).check();
    await expect(barra(page)).toContainText('1 selecionado');

    await barra(page).getByRole('button', { name: 'Apagar', exact: true }).click();

    const dialogo = page.getByRole('alertdialog');
    await expect(dialogo).toContainText('Apagar este lançamento?');
    await expect(dialogo).toContainText('1 lançamento');
    await expect(dialogo).toContainText('77,00 €');

    await dialogo.getByRole('button', { name: 'Apagar', exact: true }).click();
    await esperarAviso(page, '1 lançamento apagado, transferências incluídas nas duas contas.');

    expect(await contarPorDescricao(email(), descricao), 'as duas pernas desaparecem').toBe(0);
    expect(await contarTransacoes(email()), 'a base perde 2 linhas, não 1').toBe(antes - 2);
  });

  test('mudar de página, de filtro ou de tamanho limpa a seleção', async ({ page }) => {
    /* 30 lançamentos: o extrato pagina a 25, logo há página 2. */
    await criarLancamentosDoSpec(email(), PREFIXO, 30);

    await abrirRota(page, '/transacoes');
    await expect(page.getByRole('checkbox').first()).toBeVisible();

    const primeiraCaixa = page.getByRole('checkbox').nth(1);
    await primeiraCaixa.check();
    await expect(barra(page)).toContainText('1 selecionado');

    /* Página seguinte: a barra desaparece e não fica seleção escondida. */
    await page.getByRole('link', { name: 'Seguinte', exact: true }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(barra(page)).toHaveCount(0);
    await expect(page.getByRole('checkbox').nth(1)).not.toBeChecked();

    /* Filtro: tipo Ganho não tem estes lançamentos (são gastos). */
    await page.getByRole('link', { name: 'Anterior', exact: true }).click();
    await expect(page).toHaveURL(/\/transacoes$/);
    await page.getByRole('checkbox').nth(1).check();
    await expect(barra(page)).toContainText('1 selecionado');
    await escolherNoSelect(page.getByLabel('Tipo', { exact: true }), 'Ganho');
    await expect(barra(page)).toHaveCount(0);

    /* Tamanho de página: 25 → 50 remonta a tabela. */
    await escolherNoSelect(page.getByLabel('Tipo', { exact: true }), 'Todas');
    await expect(page.getByRole('checkbox').nth(1)).toBeVisible();
    await page.getByRole('checkbox').nth(1).check();
    await expect(barra(page)).toContainText('1 selecionado');
    await escolherNoSelect(page.getByLabel('Por página', { exact: true }), '50');
    await expect(page).toHaveURL(/limit=50/);
    await expect(barra(page)).toHaveCount(0);
  });

  test('o servidor recusa 201 ids e um id alheio sem alterar as linhas válidas', async ({
    page,
  }) => {
    const meus = await criarLancamentosDoSpec(email(), `${PREFIXO} servidor`, 2);
    const outroEmail = emailDeTeste('t53-outro');
    outroUtilizador = outroEmail;

    await abrirRota(page, '/transacoes');

    /* Utilizador «outro» pelas rotas de autenticação; a linha dele é cenário. */
    const origem = new URL(page.url()).origin;
    const api = await request.newContext({
      baseURL: origem,
      extraHTTPHeaders: { origin: origem },
    });
    const registo = await api.post('/api/auth/sign-up/email', {
      data: { email: outroEmail, password: PALAVRA_PASSE, name: 'QA T53 outro' },
    });
    expect(registo.ok(), 'o segundo utilizador tem de ser criado').toBe(true);
    const alheio = (await criarLancamentosDoSpec(outroEmail, `${PREFIXO} alheio`, 1))[0];
    expect(alheio, 'a linha do outro utilizador tem de existir').toBeDefined();

    await caixaDaLinha(page, `${PREFIXO} servidor 01`).check();
    await caixaDaLinha(page, `${PREFIXO} servidor 02`).check();

    /* Captura o id da ação e o corpo reais, no clique verdadeiro. */
    const capturado = page.waitForRequest(
      (pedido) => pedido.method() === 'POST' && pedido.headers()['next-action'] !== undefined,
    );
    await barra(page).getByRole('button', { name: 'Marcar efetivada' }).click();
    const pedido = await capturado;
    const cabecalhos: Record<string, string> = { ...pedido.headers() };
    for (const chave of ['content-length', 'host', 'cookie']) {
      delete cabecalhos[chave];
    }
    expect(cabecalhos['next-action'], 'a página tem de ter enviado uma server action').toBeTruthy();
    await esperarAviso(page, /marcado/);

    const estadoAntes = await lerLancamento(meus[0] as string);
    const totalAntes = await contarTransacoes(email());

    /* 201 ids: recusa antes de consultar. */
    const duzentosEUm = Array.from({ length: 201 }, (_, i) => `qa-${i}-${Date.now()}`);
    const resposta201 = await chamarAcao(page, cabecalhos, [{ ids: duzentosEUm, settled: true }]);
    expect(resposta201.texto).toContain('200 lançamentos de cada vez');
    expect(await contarTransacoes(email())).toBe(totalAntes);

    /* Um id de outro utilizador no meio de válidos: nada é aplicado. */
    const respostaAlheia = await chamarAcao(page, cabecalhos, [
      { ids: [meus[0] as string, alheio as string], settled: true },
    ]);
    expect(respostaAlheia.texto).toContain('não é teu');

    const estadoDepois = await lerLancamento(meus[0] as string);
    expect(estadoDepois?.settled, 'a linha válida não pode ter mudado').toBe(estadoAntes?.settled);
    expect(await lerLancamento(alheio as string), 'a linha do outro continua lá').toBeDefined();
    expect(await contarTransacoes(email())).toBe(totalAntes);

    /*
     * E um id já apagado no mesmo pedido também não deixa metade aplicada.
     * O «apagar» é outra server action (id diferente), por isso o id dela é
     * capturado num apagar verdadeiro pela interface.
     */
    const apagado = meus[1] as string;
    const pedidoApagar = page.waitForRequest(
      (p) => p.method() === 'POST' && p.headers()['next-action'] !== undefined,
    );
    await caixaDaLinha(page, `${PREFIXO} servidor 02`).check();
    await barra(page).getByRole('button', { name: 'Apagar', exact: true }).click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Apagar', exact: true })
      .click();
    await esperarAviso(page, /apagado/);

    const cabecalhosApagar: Record<string, string> = { ...(await pedidoApagar).headers() };
    for (const chave of ['content-length', 'host', 'cookie']) {
      delete cabecalhosApagar[chave];
    }

    expect(await lerLancamento(apagado), 'o id escolhido tem de ficar apagado').toBeUndefined();

    const estadoAntesDeNovo = await lerLancamento(meus[0] as string);
    const respostaMeio = await chamarAcao(page, cabecalhosApagar, [
      { ids: [meus[0] as string, apagado] },
    ]);
    expect(respostaMeio.texto).toContain('já não existe');
    expect((await lerLancamento(meus[0] as string))?.settled).toBe(estadoAntesDeNovo?.settled);
  });

  test('marcar efetivada duas vezes não muda nada nem dá erro', async ({ page }) => {
    const [id] = await criarLancamentosDoSpec(email(), `${PREFIXO} idempotente`, 1);

    await abrirRota(page, '/transacoes');

    await caixaDaLinha(page, `${PREFIXO} idempotente 01`).check();
    await barra(page).getByRole('button', { name: 'Marcar efetivada' }).click();
    await esperarAviso(page, /como liquidado/);

    const primeiro = await lerLancamento(id as string);
    expect(primeiro?.settled).toBe(true);

    await caixaDaLinha(page, `${PREFIXO} idempotente 01`).check();
    await barra(page).getByRole('button', { name: 'Marcar efetivada' }).click();
    await esperarAviso(page, /como liquidado/);

    const segundo = await lerLancamento(id as string);
    expect(segundo?.settled).toBe(true);
    expect(segundo?.date, 'a data do movimento não se perde').toBe(primeiro?.date);
    expect(await page.locator('[data-sonner-toast]').filter({ hasText: /erro|Erro/ })).toHaveCount(
      0,
    );
  });

  test('três selecionados: axe 0, nomes, alvos de 44 px, Escape e contagem anunciada', async ({
    page,
  }) => {
    await criarLancamentosDoSpec(email(), `${PREFIXO} a11y`, 3);
    await page.setViewportSize({ width: 1280, height: 1000 });
    await abrirRota(page, '/transacoes');

    for (const indice of [1, 2, 3]) {
      await page.getByRole('checkbox').nth(indice).check();
    }

    await expect(barra(page)).toBeVisible();
    const residuo = page.locator('[aria-live="polite"]').filter({ hasText: '3 selecionados' });
    await expect(residuo).toHaveText('3 selecionados');

    /* Nome com descrição e valor, como o leitor de ecrã o lê. */
    const nome = await page.getByRole('checkbox').nth(1).getAttribute('aria-label');
    expect(nome).toContain('Selecionar');
    expect(nome).toMatch(/\d+,\d{2}\s€/);
    expect(nome).toMatch(/de \d{2}\/\d{2}\/\d{2}$/);

    /* Escape limpa (com o foco na barra, onde o utilizador está). */
    await barra(page).getByRole('button', { name: 'Limpar' }).focus();
    await page.keyboard.press('Escape');
    await expect(barra(page)).toHaveCount(0);

    const axes: Record<string, string[]> = {};
    for (const largura of [1280, 360]) {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.reload();
      for (const indice of [1, 2, 3]) {
        await page.getByRole('checkbox').nth(indice).check();
      }
      await expect(barra(page)).toBeVisible();
      const { violations } = await new AxeBuilder({ page }).withTags([...TAGS]).analyze();
      axes[largura] = violations.map((v) => `${v.id} (${v.nodes.length})`);

      const geometria = await page.evaluate(() => {
        const barra = document.querySelector('[role="region"][aria-label*="selecionados"]');
        if (!barra) return null;
        const r = barra.getBoundingClientRect();
        return {
          scrollWidth: document.documentElement.scrollWidth,
          viewport: window.innerWidth,
          esquerda: Math.round(r.x),
          direita: Math.round(r.right),
          botoes: [...barra.querySelectorAll('button')].map((b) => {
            const q = b.getBoundingClientRect();
            return {
              texto: b.textContent.trim(),
              largura: Math.round(q.width),
              altura: Math.round(q.height),
            };
          }),
        };
      });

      expect(geometria).not.toBeNull();
      expect(geometria?.scrollWidth).toBe(geometria?.viewport);
      expect(geometria?.esquerda ?? -1).toBeGreaterThanOrEqual(0);
      expect(geometria?.direita ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(
        geometria?.viewport ?? 0,
      );

      if (largura === 360) {
        for (const botao of geometria?.botoes ?? []) {
          expect(botao.altura, `${botao.texto} tem de ter 44 px`).toBeGreaterThanOrEqual(44);
        }
      }
    }

    expect(axes).toEqual({ 1280: [], 360: [] });
  });
});
