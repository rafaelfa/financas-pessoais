import { mkdirSync, writeFileSync } from 'node:fs';

import {
  expect,
  request,
  test,
  type Locator,
  type Page,
  type Request,
  type Response,
} from '@playwright/test';

import { NOME_DE_TESTE, PALAVRA_PASSE, emailDeTeste } from './support/dados';
import {
  apagarUtilizador,
  definirStatusDoLancamento,
  idDoLancamento,
  lerLancamento,
} from './support/db';
import {
  abrirRota,
  escolherNoSelect,
  entrarPelaInterface,
  hojeEmLisboa,
  lancarGasto,
} from './support/ui';

/**
 * F8.5 — mudar o estado de um lançamento de «por confirmar» para «confirmado» e
 * «ignorado» funciona?
 *
 * O relato do utilizador é «ainda não consigo mudar o estado da transação de por
 * confirmar para confirmado e ignorado». A pergunta fecha-se com **valores
 * medidos**, não com leitura de código: o `status` HTTP do pedido da Server
 * Action, o `status` na base **antes e depois** do clique, o aviso que aparece e
 * o que fica no ecrã.
 *
 * Este spec cria um utilizador **próprio** (`e2e-…@exemplo.pt`) porque a sessão
 * partilhada dos restantes specs não pode ser contaminada com lançamentos de
 * diagnóstico — e porque o diagnóstico tem de poder correr isolado, com
 * `--grep F8.5`. O utilizador é apagado no `afterAll` (e o `globalTeardown`
 * volta a confirmar que não sobrou nenhum).
 *
 * **A sessão não vem de um `storageState` em ficheiro.** A primeira versão
 * apontava `test.use({ storageState })` a um ficheiro escrito no `beforeAll` e o
 * Playwright tentava lê-lo antes de ele existir (`ENOENT` em
 * `e2e/.auth/estado-transacoes.json`, medido na corrida de 2026-10-11). Cada
 * teste entra pela interface com `entrarPelaInterface`, que é a via que o
 * utilizador próprio do `20-autenticacao.spec.ts` já usa e não depende de ordem
 * nenhuma entre ficheiros. Custa quatro entradas a mais; em troca, o spec corre
 * de uma corrida limpa, sem `e2e/.auth/` pré-existente.
 *
 * A ordem dos passos é a do utilizador: `lancarGasto` cria o lançamento pela
 * interface; para o cenário ficar exatamente «por confirmar», o `status` é
 * forçado na base (`definirStatusDoLancamento`) **antes** de se clicar — é
 * preparação, não a via medida. O que se mede é o clique no menu da tabela.
 */

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const ARTEFACTO = 'e2e/.results/estado-transacoes.json';

/** O que se consegue medir do pedido da Server Action. */
interface MedicaoDeAcao {
  readonly url: string;
  readonly metodo: string;
  readonly statusHttp: number;
  readonly nextAction: string | undefined;
  readonly pedido: string;
  readonly resposta: string;
  readonly temOkVerdadeiroNoCorpo: boolean;
}

/** O que se consegue medir do aviso (toast) na interface. */
interface MedicaoDeAviso {
  readonly apareceu: boolean;
  readonly texto: string | null;
  readonly role: string | null;
  readonly ariaLiveDoAviso: string | null;
  readonly ariaLiveDoContentor: string | null;
  readonly roleStatusComOTexto: number;
}

/** Um passo medido do menu: antes, depois, pedido HTTP e aviso. */
interface PassoMedido {
  readonly item: string;
  readonly antes: string | undefined;
  readonly depois: string | undefined;
  readonly acao: MedicaoDeAcao;
  readonly aviso: MedicaoDeAviso;
}

function truncar(texto: string, limite = 500): string {
  const limpo = texto.replace(/\s+/g, ' ').trim();

  return limpo.length <= limite ? limpo : `${limpo.slice(0, limite)}…`;
}

function corpoDoPedido(pedido: Request): string {
  try {
    return truncar(pedido.postData() ?? '');
  } catch {
    return '(corpo não disponível)';
  }
}

/**
 * Fica à espera do próximo pedido de Server Action e mede-o.
 *
 * O Next marca esses pedidos com o cabeçalho `Next-Action`; é o que distingue o
 * POST da ação dos restantes pedidos da página. Chamar a função **antes** do
 * clique e só depois esperar o resultado é o que evita perder o pedido.
 */
function escutarProximaAcao(page: Page): Promise<MedicaoDeAcao> {
  return page
    .waitForResponse(
      (resposta: Response) =>
        resposta.request().method() === 'POST' &&
        resposta.request().headers()['next-action'] !== undefined,
      { timeout: 30_000 },
    )
    .then(async (resposta: Response) => {
      const corpo = await resposta.text().catch(() => '');

      return {
        url: resposta.url(),
        metodo: resposta.request().method(),
        statusHttp: resposta.status(),
        nextAction: resposta.request().headers()['next-action'],
        pedido: corpoDoPedido(resposta.request()),
        resposta: truncar(corpo),
        temOkVerdadeiroNoCorpo: corpo.includes('"ok":true'),
      };
    });
}

/** Mede o aviso com o texto indicado, sem rebentar se ele não aparecer. */
async function medirAviso(
  page: Page,
  texto: string,
  tempoLimite = 10_000,
): Promise<MedicaoDeAviso> {
  const aviso = page.locator('[data-sonner-toast]').filter({ hasText: texto }).first();
  const apareceu = await aviso
    .waitFor({ state: 'visible', timeout: tempoLimite })
    .then(() => true)
    .catch(() => false);

  const roleStatusComOTexto = await page
    .locator('[role="status"]')
    .filter({ hasText: texto })
    .count()
    .catch(() => -1);

  if (!apareceu) {
    return {
      apareceu: false,
      texto: null,
      role: null,
      ariaLiveDoAviso: null,
      ariaLiveDoContentor: null,
      roleStatusComOTexto,
    };
  }

  const detalhe = await aviso
    .evaluate((elemento) => ({
      texto: (elemento.textContent ?? '').trim(),
      role: elemento.getAttribute('role'),
      ariaLive: elemento.getAttribute('aria-live'),
      ariaLiveDoPai: elemento.parentElement?.getAttribute('aria-live') ?? null,
    }))
    .catch(() => ({ texto: null, role: null, ariaLive: null, ariaLiveDoPai: null }));

  return {
    apareceu: true,
    texto: detalhe.texto,
    role: detalhe.role,
    ariaLiveDoAviso: detalhe.ariaLive,
    ariaLiveDoContentor: detalhe.ariaLiveDoPai,
    roleStatusComOTexto,
  };
}

/** A linha do extrato pela descrição (única na corrida). */
function linhaDoLancamento(page: Page, descricao: string): Locator {
  return page.getByRole('row', { name: new RegExp(descricao) });
}

/** O botão «Ações do lançamento …» dessa linha. */
function menuDa(linha: Locator): Locator {
  return linha.getByRole('button', { name: /^Ações do lançamento/ });
}

/** Abre o menu da linha e escolhe «Confirmar» ou «Ignorar». */
async function escolherEstadoNoMenu(
  page: Page,
  linha: Locator,
  item: 'Confirmar' | 'Ignorar',
): Promise<void> {
  await menuDa(linha).click();
  await page.getByRole('menuitem', { name: item, exact: true }).click();
}

/** Um passo completo: clicar no item do menu e medir tudo o que se consegue. */
async function mudarEstadoPeloMenu(
  page: Page,
  linha: Locator,
  item: 'Confirmar' | 'Ignorar',
  id: string,
): Promise<PassoMedido> {
  const antes = (await lerLancamento(id))?.status;
  const acao = escutarProximaAcao(page);

  await escolherEstadoNoMenu(page, linha, item);

  const medicao = await acao;
  const aviso = await medirAviso(
    page,
    item === 'Confirmar' ? 'Lançamento confirmado.' : 'Lançamento ignorado.',
  );
  const depois = (await lerLancamento(id))?.status;

  return { item, antes, depois, acao: medicao, aviso };
}

/** Texto visível da linha, normalizado (o que fica no ecrã). */
async function textoDaLinha(linha: Locator): Promise<string> {
  return (await linha.innerText().catch(() => '(linha ausente)')).replace(/\s+/g, ' ').trim();
}

/** Texto do rodapé da tabela, normalizado (o total filtrado). */
async function textoDoRodape(page: Page): Promise<string> {
  return (
    await page
      .locator('tfoot')
      .innerText()
      .catch(() => '(sem rodapé)')
  )
    .replace(/\s+/g, ' ')
    .trim();
}

test.describe('F8.5 — o estado do lançamento muda mesmo?', () => {
  /*
   * Sem sessão herdada: cada teste entra pela interface com o utilizador próprio
   * criado no `beforeAll`. O estado vazio é escrito à mão (e não um caminho de
   * ficheiro) precisamente para não haver nada para ler antes de existir.
   */
  test.use({ storageState: { cookies: [], origins: [] } });

  const email = emailDeTeste('estado');
  const medidas: Record<string, unknown> = { email, medidoEm: new Date().toISOString() };
  let sufixo = '';

  test.beforeAll(async () => {
    sufixo = Date.now().toString(36);

    const contexto = await request.newContext({
      baseURL: BASE,
      extraHTTPHeaders: { origin: BASE },
    });

    try {
      const registo = await contexto.post('/api/auth/sign-up/email', {
        data: { email, password: PALAVRA_PASSE, name: NOME_DE_TESTE },
      });

      expect(
        registo.status(),
        `o registo devolveu ${registo.status()}: ${await registo.text()}`,
      ).toBeLessThan(400);
    } finally {
      await contexto.dispose();
    }
  });

  test.afterAll(async () => {
    const removidos = await apagarUtilizador(email);

    medidas['utilizadorApagado'] = removidos;
    mkdirSync('e2e/.results', { recursive: true });
    writeFileSync(ARTEFACTO, `${JSON.stringify(medidas, null, 2)}\n`);

    console.log(
      `[F8.5] utilizador ${email} apagado (${removidos} linha(s)); artefacto: ${ARTEFACTO}`,
    );
  });

  /**
   * Entregável (c) — o estado por omissão de um lançamento criado na interface.
   *
   * O utilizador diz «por confirmar». Se um lançamento manual nascer
   * `CONFIRMED`, o «por confirmar» dele veio de outro caminho (a importação
   * grava `CONFIRMED`, `import-confirm.ts:306`; sobra o diálogo de edição, que
   * tem um `Select` de estado). Isto decide se existe um problema de produto
   * mais fundo.
   */
  test('(c) o estado por omissão de um lançamento criado na interface', async ({ page }) => {
    const descricao = `F85 omissao ${sufixo}`;

    await entrarPelaInterface(page, { email, palavraPasse: PALAVRA_PASSE });
    await abrirRota(page, '/transacoes');
    await lancarGasto(page, {
      valor: '11,11',
      descricao,
      categoria: 'Outros',
      data: hojeEmLisboa(),
    });

    const id = await idDoLancamento(email, descricao);

    expect(id, 'o lançamento criado na interface devia estar na base').toBeTruthy();

    const medido = await lerLancamento(id ?? '');

    medidas['criadoNaInterface'] = medido ?? null;

    console.log(
      `[F8.5] (c) criado na interface → status=${medido?.status} origin=${medido?.origin} liquidado=${medido?.settled}`,
    );

    expect(medido?.status, 'estado por omissão de um lançamento manual, medido na base').toBe(
      'CONFIRMED',
    );
  });

  /**
   * Entregável (a), via 1 — sem filtro, pela tabela.
   *
   * É o percurso direto: menu «Ações do lançamento …» → «Confirmar», e depois
   * «Ignorar». Em cada passo mede-se o pedido HTTP, a base e o aviso.
   */
  test('o menu da tabela muda o estado na base: por confirmar → confirmado → ignorado', async ({
    page,
  }) => {
    const descricao = `F85 menu ${sufixo}`;

    await abrirRota(page, '/transacoes');
    await lancarGasto(page, {
      valor: '22,22',
      descricao,
      categoria: 'Outros',
      data: hojeEmLisboa(),
    });

    const id = await idDoLancamento(email, descricao);

    expect(id, 'o lançamento devia existir na base').toBeTruthy();

    // Cenário do relato: o lançamento está «por confirmar».
    await definirStatusDoLancamento(id ?? '', 'PENDING');

    const antes = await lerLancamento(id ?? '');
    expect(antes?.status, 'o cenário tem de partir de PENDING').toBe('PENDING');

    await abrirRota(page, '/transacoes');

    const linha = linhaDoLancamento(page, descricao);

    await expect(linha).toBeVisible();
    await expect(linha.getByText('Por confirmar', { exact: true })).toBeVisible();

    const textoAntes = await textoDaLinha(linha);

    const confirmar = await mudarEstadoPeloMenu(page, linha, 'Confirmar', id ?? '');

    console.log(
      `[F8.5] «Confirmar» → HTTP ${confirmar.acao.statusHttp} · base ${confirmar.antes} → ${confirmar.depois} · aviso=${confirmar.aviso.apareceu}`,
    );

    await expect(linha.getByText('Confirmado', { exact: true })).toBeVisible();

    const textoDepoisDeConfirmar = await textoDaLinha(linha);

    const ignorar = await mudarEstadoPeloMenu(page, linha, 'Ignorar', id ?? '');

    console.log(
      `[F8.5] «Ignorar» → HTTP ${ignorar.acao.statusHttp} · base ${ignorar.antes} → ${ignorar.depois} · aviso=${ignorar.aviso.apareceu}`,
    );

    await expect(linha.getByText('Ignorado', { exact: true })).toBeVisible();

    const textoDepoisDeIgnorar = await textoDaLinha(linha);

    medidas['menuSemFiltro'] = {
      descricao,
      id,
      textoAntes,
      textoDepoisDeConfirmar,
      textoDepoisDeIgnorar,
      confirmar,
      ignorar,
    };

    expect(confirmar.acao.statusHttp, 'o pedido de «Confirmar» devia ser aceite').toBeLessThan(400);
    expect(confirmar.depois, 'o status na base depois de «Confirmar»').toBe('CONFIRMED');
    expect(ignorar.acao.statusHttp, 'o pedido de «Ignorar» devia ser aceite').toBeLessThan(400);
    expect(ignorar.depois, 'o status na base depois de «Ignorar»').toBe('IGNORED');
  });

  /**
   * Entregável (a), via 2 — com o filtro «Por confirmar» ativo.
   *
   * É o caso em que o utilizador mais tenta isto e onde a linha **desaparece**
   * da lista filtrada ao ser confirmada — o que *parece* que nada aconteceu. O
   * que se mede aqui é exactamente isso: se a base mudou, se o aviso chegou a
   * aparecer e o que fica no ecrã depois.
   */
  test('com o filtro «Por confirmar» ativo a linha sai da lista — e o aviso?', async ({ page }) => {
    const descricao = `F85 filtro ${sufixo}`;

    await abrirRota(page, '/transacoes');
    await lancarGasto(page, {
      valor: '33,33',
      descricao,
      categoria: 'Outros',
      data: hojeEmLisboa(),
    });

    const id = await idDoLancamento(email, descricao);

    expect(id, 'o lançamento devia existir na base').toBeTruthy();

    await definirStatusDoLancamento(id ?? '', 'PENDING');

    // O filtro é posto no próprio controlo do ecrã, não por URL escrito à mão.
    await abrirRota(page, '/transacoes');
    await escolherNoSelect(page.getByLabel('Estado', { exact: true }), 'Por confirmar');
    await expect(page).toHaveURL(/status=pending/);

    const linha = linhaDoLancamento(page, descricao);

    await expect(linha).toBeVisible();

    const rodapeAntes = await textoDoRodape(page);

    const confirmar = await mudarEstadoPeloMenu(page, linha, 'Confirmar', id ?? '');

    const linhaSaiu = await expect(linha)
      .toHaveCount(0, { timeout: 15_000 })
      .then(() => true)
      .catch(() => false);

    const estadoVazio = await page
      .getByText('Nenhum movimento com estes filtros')
      .isVisible()
      .catch(() => false);

    const rodapeDepois = await textoDoRodape(page);
    const urlDepois = page.url();

    console.log(
      `[F8.5] filtro «Por confirmar» → HTTP ${confirmar.acao.statusHttp} · base ${confirmar.antes} → ${confirmar.depois} · aviso=${confirmar.aviso.apareceu} · linha saiu=${linhaSaiu} · ecrã vazio=${estadoVazio}`,
    );

    medidas['comFiltroPorConfirmar'] = {
      descricao,
      id,
      urlDepois,
      rodapeAntes,
      rodapeDepois,
      linhaSaiu,
      estadoVazio,
      passo: confirmar,
    };

    expect(confirmar.acao.statusHttp, 'o pedido devia ser aceite').toBeLessThan(400);
    expect(confirmar.depois, 'o status na base depois de «Confirmar» com o filtro ativo').toBe(
      'CONFIRMED',
    );
  });

  /**
   * A via real da interface para pôr um lançamento «por confirmar».
   *
   * Se este caminho funciona, explica de onde vêm os lançamentos `PENDING` do
   * utilizador (a importação grava `CONFIRMED`): do diálogo de edição.
   */
  test('a via da interface para pôr «por confirmar»: Editar → Estado', async ({ page }) => {
    const descricao = `F85 editar ${sufixo}`;

    await abrirRota(page, '/transacoes');
    await lancarGasto(page, {
      valor: '44,44',
      descricao,
      categoria: 'Outros',
      data: hojeEmLisboa(),
    });

    const id = await idDoLancamento(email, descricao);

    expect(id, 'o lançamento devia existir na base').toBeTruthy();
    expect((await lerLancamento(id ?? ''))?.status, 'nasce confirmado').toBe('CONFIRMED');

    await abrirRota(page, '/transacoes');

    const linha = linhaDoLancamento(page, descricao);

    await menuDa(linha).click();
    await page.getByRole('menuitem', { name: 'Editar', exact: true }).click();

    const dialogo = page.getByRole('dialog', { name: 'Editar lançamento' });

    await expect(dialogo).toBeVisible();
    await escolherNoSelect(dialogo.getByLabel('Estado', { exact: true }), 'Por confirmar');

    const acao = escutarProximaAcao(page);

    await dialogo.getByRole('button', { name: 'Guardar alterações', exact: true }).click();

    const medicao = await acao;
    const aviso = await medirAviso(page, 'Lançamento atualizado.');
    const depois = await lerLancamento(id ?? '');

    console.log(
      `[F8.5] Editar → Estado «Por confirmar» → HTTP ${medicao.statusHttp} · base ${depois?.status} · aviso=${aviso.apareceu}`,
    );

    medidas['porConfirmarPelaEdicao'] = {
      descricao,
      id,
      acao: medicao,
      aviso,
      depois: depois ?? null,
    };

    expect(medicao.statusHttp, 'o pedido de edição devia ser aceite').toBeLessThan(400);
    expect(depois?.status, 'o estado depois de gravar a edição').toBe('PENDING');
  });
});
