import { expect, request, test } from '@playwright/test';

import { NOME_DE_TESTE, PALAVRA_PASSE, emailDeTeste } from './support/dados';
import { abrirRota, entrarPelaInterface } from './support/ui';

/**
 * Percurso 7 — autenticação e autorização de rotas.
 *
 * Duas famílias de verificação:
 * 1. **Sem sessão**, uma rota autenticada redireciona para `/entrar` (a guarda
 *    vive no layout, `apps/web/src/app/(app)/layout.tsx`).
 * 2. **Com sessão**, todas as rotas respondem abaixo de `500` e nenhuma mostra
 *    o ecrã de exceção. Foi exatamente esta classe de falha — um `500` só
 *    visível em execução — que o `smoke.mjs` foi escrito para apanhar.
 */

/** Todas as páginas autenticadas, a mesma lista do fumo. */
const ROTAS = [
  '/',
  '/transacoes',
  '/contas',
  '/categorias',
  '/cartoes',
  '/orcamento',
  '/objetivos',
  '/relatorios',
  '/importar',
  '/regras',
  '/recorrencias',
  '/definicoes',
] as const;

test.describe('Percurso 7 — sem sessão', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('rota autenticada sem sessão redireciona para /entrar', async ({ page }) => {
    const resposta = await page.goto('/transacoes');

    await expect(page).toHaveURL(/\/entrar$/);
    expect(resposta?.status() ?? 0).toBeLessThan(400);

    // O mesmo para a raiz e para um ecrã de leitura.
    await page.goto('/contas');
    await expect(page).toHaveURL(/\/entrar$/);
  });

  test('a rota de entrada responde e não pede sessão', async ({ page }) => {
    const resposta = await page.goto('/entrar');

    expect(resposta?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Entrar', level: 1 })).toBeVisible();
  });

  /**
   * Com credenciais erradas, o erro tem de ser **anunciado no DOM**.
   *
   * **Este teste era um `test.fail`.** As páginas de autenticação comunicavam o
   * erro só por `toast.error(...)`, e o `<Toaster />` existia apenas no shell
   * autenticado (`apps/web/src/components/app-shell.tsx:64`): com uma
   * palavra-passe errada, o botão voltava a ficar disponível e não aparecia
   * mensagem nenhuma. Foi o achado I14 do relatório
   * `docs/spec/T8.4-e2e-e-desempenho.md`.
   *
   * A correção não se ficou pelo toast: `(auth)/entrar/page.tsx` e
   * `(auth)/registar/page.tsx` guardam o erro em estado e renderizam uma região
   * `role="alert"` no DOM — que é o que um leitor de ecrã anuncia e o que fica
   * auditável depois de o toast desaparecer. É essa região que se exige aqui,
   * não o aviso efémero.
   */
  test('o erro de credenciais é anunciado no ecrã de entrada', async ({ page }) => {
    await abrirRota(page, '/entrar');

    await page.getByLabel('E-mail', { exact: true }).fill(emailDeTeste('credenciais'));
    await page.getByLabel('Palavra-passe', { exact: true }).fill(PALAVRA_PASSE);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();

    await expect(page.getByRole('alert').filter({ hasText: 'incorretos' })).toBeVisible({
      timeout: 15_000,
    });

    // E o formulário continua utilizável: o erro não esconde o caminho de volta.
    await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeEnabled();
  });
});

test.describe('Percurso 7 — com sessão', () => {
  test('todas as rotas autenticadas respondem e nenhuma devolve 500', async ({ page }) => {
    for (const rota of ROTAS) {
      await abrirRota(page, rota);
    }
  });
});

test.describe('Sessão — o que o servidor garante e o que a interface oferece', () => {
  test('sair pelo servidor termina mesmo a sessão', async ({ baseURL }) => {
    const alvo = baseURL ?? 'http://localhost:3000';
    const email = emailDeTeste('saida');
    const contexto = await request.newContext({
      baseURL: alvo,
      extraHTTPHeaders: { origin: alvo },
    });

    try {
      const registo = await contexto.post('/api/auth/sign-up/email', {
        data: { email, password: PALAVRA_PASSE, name: NOME_DE_TESTE },
      });
      expect(registo.status(), 'o registo do utilizador auxiliar devia passar').toBeLessThan(400);

      const entrada = await contexto.post('/api/auth/sign-in/email', {
        data: { email, password: PALAVRA_PASSE },
      });
      expect(entrada.status(), 'a entrada do utilizador auxiliar devia passar').toBeLessThan(400);

      const comSessao = await contexto.get('/transacoes', { maxRedirects: 0 });
      expect(comSessao.status(), 'com sessão, /transacoes serve a página').toBe(200);

      const saida = await contexto.post('/api/auth/sign-out', { data: {} });
      expect(saida.status(), 'a rota de saída devia responder').toBeLessThan(400);

      const semSessao = await contexto.get('/transacoes', { maxRedirects: 0 });
      expect(
        [302, 303, 307, 308],
        `depois de sair, /transacoes devia redirecionar e devolveu ${semSessao.status()}`,
      ).toContain(semSessao.status());
    } finally {
      await contexto.dispose();
    }
  });

  /**
   * O controlo tem de existir e de ter nome acessível.
   *
   * Este teste era, até 2026-10-11 à tarde, o contrário: «LACUNA: não existe
   * controlo de saída na interface». O `signOut` estava exportado
   * (`apps/web/src/lib/auth-client.ts:14`) e nunca era usado, e uma aplicação de
   * finanças pessoais sem forma de fechar a sessão é um problema num computador
   * emprestado. O `dev-ui`/Lead acrescentaram
   * `apps/web/src/components/sign-out-button.tsx` e ligaram-no ao rodapé da
   * barra lateral e ao cabeçalho em telemóvel; o teste passou a exigir o que
   * devia ter existido desde o início.
   */
  test('existe um controlo de saída com nome acessível', async ({ page }) => {
    await abrirRota(page, '/');

    await expect(page.getByRole('button', { name: 'Terminar sessão' })).toBeVisible();
  });
});

/**
 * O percurso de saída completo — feito com um utilizador **próprio**.
 *
 * Não pode usar a sessão partilhada: terminar a sessão apaga-a no servidor e os
 * oito specs seguintes ficariam sem sessão. O utilizador é criado pelas rotas de
 * autenticação (o registo **pela interface** tem o spec `10-registar`) e é
 * apagado no fim, como todos os outros.
 */
test.describe('Sessão — terminar sessão pela interface', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('«Terminar sessão» devolve a /entrar e as rotas voltam a exigir entrada', async ({
    page,
    baseURL,
  }) => {
    const alvo = baseURL ?? 'http://localhost:3000';
    const email = emailDeTeste('saida-ui');
    const contexto = await request.newContext({
      baseURL: alvo,
      extraHTTPHeaders: { origin: alvo },
    });

    try {
      const registo = await contexto.post('/api/auth/sign-up/email', {
        data: { email, password: PALAVRA_PASSE, name: NOME_DE_TESTE },
      });

      expect(registo.status(), 'o registo do utilizador da saída devia passar').toBeLessThan(400);
    } finally {
      await contexto.dispose();
    }

    await entrarPelaInterface(page, { email, palavraPasse: PALAVRA_PASSE });

    await page.getByRole('button', { name: 'Terminar sessão' }).click();

    await expect(page).toHaveURL(/\/entrar$/, { timeout: 30_000 });

    // A sessão acabou mesmo do lado do servidor, não é só uma mudança de ecrã.
    await page.goto('/transacoes');
    await expect(page).toHaveURL(/\/entrar$/);
  });
});
