import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Acesso às amostras de `docs/spec/samples/`.
 *
 * As amostras são as mesmas do smoke test da Fase 0 (`T0.8`), com os resultados
 * esperados fixados em `docs/spec/T0.8-smoke-tests.md`. Usar exatamente os
 * mesmos ficheiros é o que permite comparar o comportamento das bibliotecas
 * (registado naquele documento) com o do parser próprio.
 */

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * `docs/spec/samples/` a partir deste ficheiro.
 *
 * A contagem de `..` é a mesma que o smoke test da Fase 0 já usa e está fixada
 * por um teste (`lê as amostras`): um caminho errado falha alto em vez de
 * devolver um ficheiro vazio e deixar os testes passarem por engano.
 */
export const SAMPLES_DIR = resolve(HERE, '../../../../../docs/spec/samples');

export const MAIN_OFX = 'extrato-ofx1-sgml.ofx';
export const MINIMAL_OFX = 'extrato-ofx1-sgml-minimo.ofx';
export const PT_CSV = 'extrato-csv-pt.csv';

export function readSample(name: string): string {
  return readFileSync(resolve(SAMPLES_DIR, name), 'utf8');
}

/**
 * Remove todas as linhas que são apenas uma tag de fecho.
 *
 * Produz a variante que a Fase 0 registou como incógnita I1 — o extrato SGML
 * **sem nenhuma** tag de fecho, em que as duas bibliotecas candidatas falham
 * (o `ofx-js` lança `Missing closing tag for LEDGERBAL`).
 */
export function withoutClosingTags(content: string): string {
  return content
    .split(/\r?\n/)
    .filter((line) => !/^\s*<\/[A-Za-z0-9.]+>\s*$/.test(line))
    .join('\n');
}
