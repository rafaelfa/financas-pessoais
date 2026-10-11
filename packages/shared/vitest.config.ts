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
 *
 * **O fuso é fixado em `Europe/Lisbon`.** A aplicação formata datas com `Intl`
 * em pt-PT, e um formatador sem `timeZone` explícito usa o fuso da máquina: o
 * mesmo instante dava `13:00` no portátil de desenvolvimento e `12:00` no
 * `ubuntu-latest` do GitHub Actions, que corre em UTC. Foi a primeira coisa que
 * a integração contínua apanhou, e a correção certa não é afrouxar o teste — é
 * fixar o ambiente, para que o resultado seja o mesmo em qualquer máquina e o
 * produto seja determinístico. O fuso é o de `Europe/Lisbon` porque é o que a
 * aplicação usa (§3.7 do plano).
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
    env: {
      TZ: 'Europe/Lisbon',
    },
  },
});
