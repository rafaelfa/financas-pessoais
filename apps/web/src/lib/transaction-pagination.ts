/**
 * Paginação do extrato.
 *
 * Estes valores são **constantes puras** e vivem fora de qualquer módulo
 * `'use client'` de propósito. Um Server Component que importe uma constante de
 * um módulo cliente não recebe o valor: recebe uma *client reference*, e o
 * primeiro uso — um `includes`, um índice — rebenta em produção com um erro 500.
 * Foi exatamente o que aconteceu na primeira versão do extrato.
 */
export const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

/** Tamanho de página por omissão. */
export const DEFAULT_PAGE_SIZE = 25;
