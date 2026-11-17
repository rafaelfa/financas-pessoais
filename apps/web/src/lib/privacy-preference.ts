/**
 * Preferência de privacidade: os nomes que o servidor e o cliente têm de dizer
 * exatamente igual.
 *
 * Vive fora de `privacy-mode.tsx` (que é `'use client'`) porque o `layout.tsx` é
 * um componente de servidor: uma constante exportada de um módulo de cliente
 * chega ao servidor como referência, não como texto. Se os dois divergirem em
 * silêncio, o servidor serve a página num estado e o cliente aplica o outro.
 */

/** Cookie lido pelo servidor para servir a página já mascarada. */
export const PRIVACY_COOKIE = 'financas-privacidade';

/** Chave do `localStorage`, a preferência que o script inline aplica. */
export const PRIVACY_STORAGE_KEY = 'financas:privacidade';

/** Um ano: a preferência não é um dado de sessão. */
export const PRIVACY_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
