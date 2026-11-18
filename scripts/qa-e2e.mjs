import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { guardarArtefactos } from './qa-artefactos.mjs';

/**
 * Corre a suíte e2e e, **se ela falhar**, guarda os artefactos da falha.
 *
 * Porquê um wrapper e não um reporter nem um `globalTeardown`: o
 * `playwright.config.ts` fica igual, o código de saída é o da própria suíte
 * (não se mascara nada) e os argumentos passam todos para o Playwright
 * (`pnpm test:e2e e2e/55-… --reporter=line` continua a funcionar).
 *
 * Usa-se `@playwright/test/cli.js` com o próprio `node`, em vez do shim
 * `.bin/playwright`: um processo a menos na cadeia e nenhuma diferença entre
 * Windows e Linux.
 */

/**
 * Códigos que significam «alguém interrompeu», e não «a suíte falhou».
 *
 * POSIX: o processo morre por sinal (`signal: 'SIGINT'`, `status: null`).
 * Windows: não há sinais — o Ctrl+C mata com `STATUS_CONTROL_C_EXIT`
 * (`0xC000013A` = 3221225786) e o `signal` vem `null`. 130 é o código
 * convencional de interrupção.
 */
const INTERROMPIDO = new Set([130, 3221225786]);

/** Classifica o resultado de um `spawnSync` do Playwright: `ok` | `interrompido` | `falhou` | `arranque`. */
export function classificar(resultado) {
  if (resultado.error !== undefined && resultado.error !== null) {
    return 'arranque';
  }

  if (resultado.signal !== null && resultado.signal !== undefined) {
    return 'interrompido';
  }

  const codigo = resultado.status ?? 1;

  if (INTERROMPIDO.has(codigo)) {
    return 'interrompido';
  }

  return codigo === 0 ? 'ok' : 'falhou';
}

/**
 * Corre a suíte e decide o que fazer com o resultado. Só se executa quando este
 * ficheiro é chamado directamente — `classificar` fica importável (é o que os
 * testes desta correção usam sem correr a suíte).
 */
function correr() {
  /*
   * A resolução do CLI fica **aqui**, não no topo do módulo: `classificar` é uma
   * função pura, e o teste dela não pode falhar porque o `@playwright/test`
   * mudou de layout ou porque o `node_modules` não está instalado. Quem importa
   * este ficheiro para testar não paga o preço de o resolver.
   */
  const require = createRequire(import.meta.url);
  const cli = join(dirname(require.resolve('@playwright/test/package.json')), 'cli.js');

  /*
   * `Ctrl+C` chega ao grupo de processos: o filho morre por sinal e este processo
   * também o receberia. O ouvido evita que o pai morra a meio do tratamento — quem
   * decide o código de saída é o ramo da interrupção, abaixo.
   */
  process.on('SIGINT', () => {});

  const resultado = spawnSync(process.execPath, [cli, 'test', ...process.argv.slice(2)], {
    stdio: 'inherit',
  });

  switch (classificar(resultado)) {
    case 'arranque':
      console.error(`[e2e] não consegui arrancar o Playwright: ${resultado.error?.message}`);
      process.exit(1);
      break;

    /*
     * Morto por sinal (Ctrl+C, SIGTERM, OOM) **não** é falha da suíte: o
     * `test-results/` fica a meio (um `trace.zip` truncado, testes que nem
     * correram) e guardá-lo criava uma pasta de «falha» que ninguém pode usar.
     */
    case 'interrompido':
      console.log(
        `[e2e] corrida interrompida (${resultado.signal ?? resultado.status}) — nada foi guardado.`,
      );
      process.exit(130);
      break;

    case 'falhou':
      /*
       * A cópia tem de acontecer **agora**: o Playwright limpa `test-results/` no
       * arranque da corrida seguinte, e é essa limpeza que fez desaparecer o trace
       * do vermelho da T62 antes de alguém o poder ler.
       */
      console.log(`[e2e] corrida falhou (código ${resultado.status}) — a guardar os artefactos.`);
      guardarArtefactos();
      process.exit(resultado.status ?? 1);
      break;

    default:
      process.exit(0);
  }
}

const invocadoComoScript = process.argv[1] === fileURLToPath(import.meta.url);

if (invocadoComoScript) {
  correr();
} else if (process.argv[1] !== undefined && /qa-e2e(\.mjs)?$/.test(process.argv[1])) {
  /*
   * Chamado como script mas por outro caminho (um symlink, por exemplo): sem isto
   * saía **0 sem correr nada** — um verde silencioso é o pior desfecho para um
   * ficheiro que existe para não deixar nada por provar.
   */
  console.error(
    `[e2e] invocado por um caminho diferente do ficheiro (${process.argv[1]}?) — nada corrido.`,
  );
  process.exit(1);
}
