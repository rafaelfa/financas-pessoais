import { defineConfig, devices } from '@playwright/test';

/**
 * Testes ponta a ponta (F8.4).
 *
 * **Onde correm.** Contra o Neon do `.env` da raiz, com o servidor do Next
 * levantado por este ficheiro (`webServer`). Não há Docker nem base local nesta
 * máquina, e é por isso que a limpeza da base de dados é parte do teste: ver
 * `e2e/global.setup.ts` e `e2e/global.teardown.ts`.
 *
 * Três decisões que não são gosto pessoal:
 *
 * 1. **`workers: 1`.** Todos os percursos partilham um utilizador de teste e
 *    escrevem na mesma base. Em paralelo, o percurso do orçamento podia medir as
 *    saídas do mês a meio do percurso das transações. A serialização é o que
 *    torna os números comparáveis; em troca, a suite demora o que demora.
 * 2. **`localhost` e não `127.0.0.1`.** O `BETTER_AUTH_URL` do `.env` é
 *    `http://localhost:3000` e o `better-auth` valida a origem. Tocar no URL é
 *    mudar o contrato da aplicação para servir o teste.
 * 3. **`next dev` e não `next start`.** Nesta sandbox o `next build` falha com
 *    `spawn EPERM` (o `test:e2e` num ambiente normal pode trocar por
 *    `pnpm build && pnpm start`). Os números de desempenho medidos em `dev` são
 *    um limite superior, não o que a produção serve — está declarado no
 *    relatório `docs/spec/T8.4-e2e-e-desempenho.md`.
 *
 * Percursos sem sessão (`registar`, `autenticacao`) trocam o `storageState`
 * dentro do próprio spec.
 */

const PORT = 3000;
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

/** Reutilizar um servidor já a correr (útil quando o `webServer` não pode arrancar). */
const reuseExistingServer = process.env.E2E_REUSE_SERVER === '1';

/**
 * Browser: por omissão o chromium que o Playwright instala
 * (`pnpm exec playwright install chromium`). `E2E_CHANNEL=msedge|chrome` usa um
 * browser já instalado no sistema — existe como alternativa declarada para
 * máquinas onde o download não é possível, não como caminho normal: o número que
 * se mede tem de vir de uma instalação reprodutível noutra máquina.
 */
const canal = process.env.E2E_CHANNEL;

export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/support/**'],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: process.env.CI !== undefined,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  outputDir: 'test-results',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'e2e/.results/resultados.json' }],
  ],
  globalSetup: './e2e/global.setup.ts',
  globalTeardown: './e2e/global.teardown.ts',
  use: {
    baseURL,
    storageState: 'e2e/.auth/utilizador.json',
    locale: 'pt-PT',
    timezoneId: 'Europe/Lisbon',
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: canal === undefined ? 'chromium' : `chromium-${canal}`,
      use: {
        ...devices['Desktop Chrome'],
        ...(canal === undefined ? {} : { channel: canal }),
      },
    },
  ],
  webServer: {
    command: 'pnpm --filter @repo/web dev',
    url: `${baseURL}/entrar`,
    reuseExistingServer,
    timeout: 240_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
