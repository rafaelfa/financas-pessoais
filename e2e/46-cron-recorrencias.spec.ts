import { expect, request, test, type APIRequestContext, type Page } from '@playwright/test';

import { NOME_DE_TESTE, PALAVRA_PASSE, emailDeTeste } from './support/dados';
import { apagarUtilizador, contarPorDescricao, limparDadosDoSpec } from './support/db';
import { loadRootEnv } from './support/env';
import { abrirRota, deslocarDias, esperarAviso, hojeEmLisboa } from './support/ui';

/**
 * T70 — `GET /api/cron/recurrences`: a rota que o Vercel Cron chama todos os dias.
 *
 * É o único caminho do produto **sem sessão**: o cron chama por HTTP sem cookies
 * e o segredo no cabeçalho é a única porta. O spec prova as três metades dessa
 * frase — quem não tem o segredo não entra, quem o tem gera o que está em atraso
 * sem duplicar na segunda corrida, e o botão da sessão continua a fazer exatamente
 * o que fazia antes de o gerador passar a ser partilhado.
 *
 * **Um utilizador próprio**, criado pelas rotas de autenticação a sério e apagado
 * no `afterAll`: a rota é global por decisão (D22 — «gera as ocorrências em atraso
 * de todos os utilizadores»), por isso chamar o cron com o utilizador partilhado
 * da suite deixaria lançamentos no estado dos outros specs. Assim, o que esta
 * corrida escreve tem dono e limpa-se com o `limparDadosDoSpec` da T67, sempre em
 * `finally`.
 *
 * **A série nasce pela interface**, não por SQL: é o produto a pôr a data de início
 * no passado, que é exatamente o estado que o cron apanha. Nenhuma escrita
 * arbitrária na base — a regra que a T67 fechou.
 */

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const ROTA = '/api/cron/recurrences';

/** As descrições dos lançamentos criados por este spec começam todas aqui. */
const PREFIXO = 'T70 prova';

/** Os únicos campos que a rota devolve: contagens, nunca conteúdo. */
const CAMPOS_DO_CORPO = ['created', 'failures', 'truncated', 'users'];

/**
 * Quantas ocorrências tem em atraso uma série mensal começada há 70 dias: **três**,
 * seja qual for o mês. O início, +1 mês e +2 meses caiem nos últimos 70 dias;
 * o +3 meses cai sempre 21 a 23 dias **depois** de hoje. É o número que o gerador
 * tem de criar, medido na base e não só no corpo da resposta.
 */
const OCORRENCIAS_EM_ATRASO = 3;

/** O segredo do `.env` da raiz — o mesmo que a Vercel envia em produção. */
function segredoDoCron(): string {
  loadRootEnv();

  const segredo = process.env.CRON_SECRET ?? '';

  if (segredo === '') {
    throw new Error(
      'CRON_SECRET não está no .env da raiz: sem ela a rota fecha a porta, que é o comportamento certo, mas não há o que provar aqui.',
    );
  }

  return segredo;
}

/** Um contexto HTTP **sem cookies**: é assim que o Vercel Cron chama. */
async function contextoSemSessao(): Promise<APIRequestContext> {
  return request.newContext({ baseURL: BASE });
}

test.describe('T70 — o cron diário das recorrências', () => {
  /*
   * Sem a sessão partilhada da suite: a metade sem segredo prova que um pedido
   * anónimo não entra, e as outras duas entram com o cookie do utilizador do
   * spec, obtido por HTTP uma única vez (o *rate limit* do better-auth não perdoa
   * quatro entradas pela interface — a nota do spec 35).
   */
  test.use({ storageState: { cookies: [], origins: [] } });

  const email = emailDeTeste('cron');
  let cookieDaSessao: { readonly name: string; readonly value: string } | undefined;

  test.beforeAll(async () => {
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

      const entrada = await contexto.post('/api/auth/sign-in/email', {
        data: { email, password: PALAVRA_PASSE },
      });

      expect(entrada.status(), `a entrada devolveu ${entrada.status()}`).toBeLessThan(400);

      const cabecalho = entrada
        .headersArray()
        .filter((valor) => valor.name.toLowerCase() === 'set-cookie')
        .map((valor) => valor.value)
        .find((valor) => valor.includes('session_token'));

      if (cabecalho === undefined) {
        throw new Error('a entrada não devolveu o cookie de sessão');
      }

      const [par, ...resto] = cabecalho.split(';')[0]?.split('=') ?? [];

      if (par === undefined || par === '' || resto.join('=') === '') {
        throw new Error('cookie de sessão ilegível');
      }

      cookieDaSessao = { name: par, value: resto.join('=') };
    } finally {
      await contexto.dispose();
    }
  });

  test.afterAll(async () => {
    const removidos = await apagarUtilizador(email);

    console.log(`[T70] utilizador ${email} apagado (${removidos} linha(s)).`);
  });

  /**
   * Sessão do utilizador do spec, numa janela alta.
   *
   * A altura não é gosto: o `DialogContent` é `fixed` e não tem `overflow`, por
   * isso no viewport por omissão do Playwright (1280×720, o `Desktop Chrome`) o
   * formulário da recorrência — o mais comprido da aplicação — fica com o botão
   * «Criar recorrência» fora do viewport e sem barra de deslocamento. Medido à
   * primeira corrida desta spec: 40 tentativas de clique e
   * «element is outside of the viewport». É um achado de produto, apontado no
   * relatório da T70 e não corrigido aqui (`ui/dialog.tsx` não é ficheiro
   * desta tarefa); o spec trabalha na janela em que o percurso é utilizável,
   * como os specs 36 a 38.
   */
  async function entrar(page: Page): Promise<void> {
    if (cookieDaSessao === undefined) {
      throw new Error('o beforeAll não deixou cookie de sessão');
    }

    await page.context().addCookies([
      {
        name: cookieDaSessao.name,
        value: cookieDaSessao.value,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
      },
    ]);
    await page.setViewportSize({ width: 1280, height: 1200 });
  }

  /** Cria, pela interface, uma mensal começada há 70 dias: uma série em atraso. */
  async function criarSerieEmAtraso(page: Page, nome: string, descricao: string): Promise<string> {
    const inicio = deslocarDias(hojeEmLisboa(), -70);

    await abrirRota(page, '/recorrencias');
    await page.getByRole('button', { name: 'Nova recorrência', exact: true }).click();

    const dialogo = page.getByRole('dialog');

    await dialogo.locator('#recorrencia-nome').fill(nome);
    await dialogo.getByLabel('Valor', { exact: true }).fill('25,00');
    await dialogo.locator('#recorrencia-descricao').fill(descricao);
    /*
     * A frequência não é tocada: «Mensal» é a escolha por omissão do formulário.
     * Mudá-la preenche o «dia do mês» com o dia de **hoje**, e a série deixaria
     * de ser a do início — as datas em atraso passariam de três para quatro e o
     * número medido já não seria o da regra que se quis provar.
     */
    await dialogo.locator('#recorrencia-inicio').fill(inicio);
    await dialogo.getByRole('button', { name: 'Criar recorrência', exact: true }).click();
    await esperarAviso(page, 'Recorrência criada.');

    return inicio;
  }

  test('a porta fecha-se a quem não tem o segredo', async () => {
    const contexto = await contextoSemSessao();

    try {
      const semCabecalho = await contexto.get(ROTA);

      expect(semCabecalho.status(), 'sem Authorization não há geração').toBe(401);
      expect(Object.keys(await semCabecalho.json())).not.toContain('created');

      const segredoErrado = await contexto.get(ROTA, {
        headers: { authorization: 'Bearer nao-e-o-segredo' },
      });

      expect(segredoErrado.status(), 'um segredo errado não abre a porta').toBe(401);

      const bearerVazio = await contexto.get(ROTA, {
        headers: { authorization: 'Bearer ' },
      });

      expect(bearerVazio.status(), 'um Bearer sem valor não é um Bearer').toBe(401);
    } finally {
      await contexto.dispose();
    }
  });

  test('com o segredo gera o atraso de uma vez e não duplica na segunda', async ({ page }) => {
    await entrar(page);

    const descricao = `${PREFIXO} renda mensal`;
    const inicio = await criarSerieEmAtraso(page, `${PREFIXO} renda`, descricao);

    const contexto = await contextoSemSessao();

    try {
      // O cron entra com o segredo e gera as três datas em atraso.
      const primeira = await contexto.get(ROTA, {
        headers: { authorization: `Bearer ${segredoDoCron()}` },
      });

      expect(primeira.status(), `a chamada com segredo devolveu ${primeira.status()}`).toBe(200);

      const textoPrimeira = await primeira.text();
      const corpo = JSON.parse(textoPrimeira) as Record<string, unknown>;

      console.log(`[T70] primeira chamada (${inicio}, mensal): ${textoPrimeira}`);

      expect(Object.keys(corpo).sort(), 'só contagens no corpo, nunca conteúdo').toEqual(
        CAMPOS_DO_CORPO,
      );
      expect(typeof corpo['created'], 'created é um número').toBe('number');
      expect(
        Number(corpo['created']),
        'a rota é global: gera pelo menos as séries deste spec',
      ).toBeGreaterThanOrEqual(OCORRENCIAS_EM_ATRASO);
      expect(corpo['failures'], 'nenhum utilizador falhou nesta corrida').toBe(0);

      expect(
        await contarPorDescricao(email, descricao),
        `a base tem de ter as ${OCORRENCIAS_EM_ATRASO} ocorrências em atraso`,
      ).toBe(OCORRENCIAS_EM_ATRASO);

      // A segunda corrida não encontra nada em atraso: é a idempotência da D22.
      const segunda = await contexto.get(ROTA, {
        headers: { authorization: `Bearer ${segredoDoCron()}` },
      });

      expect(segunda.status(), 'a segunda chamada também entra').toBe(200);

      const textoSegunda = await segunda.text();

      console.log(`[T70] segunda chamada (idempotência): ${textoSegunda}`);

      expect(JSON.parse(textoSegunda)['created'], 'criar duas vezes a mesma data é o defeito').toBe(
        0,
      );
      expect(
        await contarPorDescricao(email, descricao),
        'a segunda corrida não acrescentou nada',
      ).toBe(OCORRENCIAS_EM_ATRASO);

      // Nada de conteúdo no corpo: nem o e-mail, nem a descrição, nem o valor.
      expect(textoPrimeira, 'o corpo não pode levar o e-mail de ninguém').not.toContain(email);
      expect(textoPrimeira, 'o corpo não pode levar descrições').not.toContain(descricao);
      expect(textoPrimeira, 'o corpo não pode levar nomes de série').not.toContain(PREFIXO);
    } finally {
      await contexto.dispose();
      // O que este teste criou, com dono, apagado seja o que acontecer: a regra da T67.
      const limpo = await limparDadosDoSpec(email, PREFIXO);

      console.log(`[T70] limpeza do cron: ${JSON.stringify(limpo)}`);
    }
  });

  test('o botão da sessão gera o mesmo atraso, com o mesmo resumo', async ({ page }) => {
    await entrar(page);

    const descricao = `${PREFIXO} subscrição`;

    await criarSerieEmAtraso(page, `${PREFIXO} subscrição`, descricao);

    try {
      const botao = page.getByRole('button', { name: /^Gerar as que estão a vencer/ });

      await expect(botao, 'a página conta uma série em atraso, como antes').toContainText('(1)');

      await botao.click();
      await esperarAviso(page, `${OCORRENCIAS_EM_ATRASO} ocorrências geradas.`);

      const aviso = page
        .locator('[data-sonner-toast]')
        .filter({ hasText: 'ocorrências geradas.' })
        .first();

      expect(await aviso.innerText(), 'o resumo série a série continua a vir do gerador').toContain(
        `${PREFIXO} subscrição`,
      );

      expect(
        await contarPorDescricao(email, descricao),
        'o caminho de sessão cria as mesmas três datas',
      ).toBe(OCORRENCIAS_EM_ATRASO);

      // E a segunda carga volta a não encontrar nada — a idempotência é do núcleo.
      await botao.click();
      await esperarAviso(page, 'Não havia nada a vencer.');

      expect(await contarPorDescricao(email, descricao), 'o segundo clique não duplicou').toBe(
        OCORRENCIAS_EM_ATRASO,
      );
    } finally {
      const limpo = await limparDadosDoSpec(email, PREFIXO);

      console.log(`[T70] limpeza do botão: ${JSON.stringify(limpo)}`);
    }
  });
});
