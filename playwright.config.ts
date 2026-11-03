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
 * 3. **Build de produção, não `next dev`.** O `webServer` corre
 *    `pnpm build && pnpm --filter @repo/web start`, para o teste exercitar o
 *    mesmo binário que vai para o ar. O `next dev` foi abandonado por um motivo
 *    concreto: o indicador de desenvolvimento do Next («1 Insight», no canto
 *    inferior) fica por cima do «Terminar sessão», no rodapé da barra lateral, e
 *    o clique expirava aos 20 s — um falso negativo em `20-autenticacao.spec.ts`,
 *    não um defeito da aplicação. O `spawn EPERM` que esta nota citava era desta
 *    sandbox e já não se aplica: o `next build` corre aqui sem problema.
 *    Consequência para os números: como agora se mede o build de produção, os
 *    valores de `docs/spec/T8.4-e2e-e-desempenho.md` — medidos em `dev` à época —
 *    deixaram de ser um «limite superior» e estão desatualizados; o que a suite
 *    mede hoje é o que a produção serve.
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

/** O canal declarado aplica-se a todos os projetos, ou a um deles fica sem browser. */
const comCanal = canal === undefined ? {} : { channel: canal };

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
      use: { ...devices['Desktop Chrome'], ...comCanal },
    },
    /*
     * Dois projetos a mais, de propósito estreitos: só os ecrãs novos e um
     * percurso. Multiplicar a suite inteira não provava mais nada e triplicava o
     * tempo. O de telemóvel existe para exercitar o ramo `Drawer` dos diálogos
     * (a 393 px o `useIsMobile` diz que sim); o escuro, para o tema.
     */
    {
      name: 'telemovel',
      use: { ...devices['Pixel 5'], ...comCanal },
      testMatch: /(45-contas-pagar-receber|55-consolidacao-contas)\.spec\.ts/,
    },
    {
      name: 'escuro',
      use: { ...devices['Desktop Chrome'], colorScheme: 'dark', ...comCanal },
      testMatch: /15-navegacao\.spec\.ts/,
    },
  ],
  webServer: {
    /*
     * Build de produção e não `next dev`: o indicador de desenvolvimento do Next
     * ficava por cima do «Terminar sessão» no rodapé da barra lateral e o clique
     * expirava — falso negativo em `20-autenticacao.spec.ts`. O build demora, mas
     * um `pnpm test:e2e` num clone limpo passa a arrancar sozinho e a correr o
     * mesmo código que vai para o ar.
     */
    command: 'pnpm build && pnpm --filter @repo/web start',
    url: `${baseURL}/entrar`,
    reuseExistingServer,
    timeout: 240_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
