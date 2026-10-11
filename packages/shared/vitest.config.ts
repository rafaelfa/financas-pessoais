import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

/**
 * Testes unitários de `@repo/shared`.
 *
 * Este pacote é TypeScript puro, sem DOM e sem JSX, portanto não precisa de
 * plugins: basta o ambiente `node`. Os testes ficam ao lado do código que
 * testam, em `__tests__/`, e só cobrem lógica determinística — as Server
 * Components assíncronas são testadas com Playwright na Fase 8.
 *
 * O alias `@/` aponta para `apps/web/src` (o mesmo do `tsconfig` da aplicação)
 * para que um teste deste pacote possa exercitar o núcleo puro que vive na
 * camada de servidor — hoje o `import-confirm.ts`, que tem de ser testado com um
 * duplo do PostgreSQL e não pode ser importado por caminho relativo sem partir o
 * `rootDir` deste pacote (`TS6059`). Sem esta linha, o teste não corre em CI.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, '../../apps/web/src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: false,
  },
});
