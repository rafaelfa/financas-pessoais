/**
 * Impressão digital de texto para o recibo da importação.
 *
 * -----------------------------------------------------------------------------
 * PORQUE NÃO SE GUARDA O TEXTO
 * -----------------------------------------------------------------------------
 * O recibo da importação é guardado no `localStorage` do browser para a oferta de
 * desfazer sobreviver a um recarregamento. Esse espaço não é nosso, pode ser
 * partilhado ou emprestado, e descrições de extratos são texto financeiro
 * legível ("PAGAMENTO SERVIÇOS MUNICIPAIS - ÁGUA E SANEAMENTO"). Guarda-se o
 * `sha256` da descrição: a comparação da reversão continua **exata** — o servidor
 * calcula a impressão digital do valor que está na base e compara as duas — e o
 * browser deixa de ter o texto.
 *
 * `JSON.stringify` distingue `null` de `''` sem marcadores inventados, para que
 * «sem descrição» e «descrição vazia» não passem por iguais na comparação.
 *
 * Vive aqui, e não repetida no servidor e na interface, para não haver duas
 * implementações de `sha256` que possam divergir — uma divergência aqui traduz-se
 * em movimentos que a reversão nunca aceita apagar.
 */

import { createHash } from 'node:crypto';

/** `sha256` hexadecimal de uma descrição, distinguindo `null` de `''`. */
export function descriptionDigest(value: string | null): string {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}
