import { defineConfig } from 'vitest/config';

/**
 * Testes unitários de `@repo/shared`.
 *
 * Este pacote é TypeScript puro, sem DOM e sem JSX, portanto não precisa de
 * plugins: basta o ambiente `node`. Os testes ficam ao lado do código que
 * testam, em `__tests__/`, e só cobrem lógica determinística — as Server
 * Components assíncronas são testadas com Playwright na Fase 8.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: false,
  },
});
