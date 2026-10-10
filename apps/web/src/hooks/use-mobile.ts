'use client';

import { useSyncExternalStore } from 'react';

const MOBILE_BREAKPOINT = 768;
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

/**
 * Deteta se o ecrã é de telemóvel.
 *
 * Usa `useSyncExternalStore` em vez de um efeito com `setState`: o React trata
 * a `matchMedia` como o sistema externo que ela é, o valor fica correto logo na
 * primeira renderização do cliente e não há renderizações em cascata. Também
 * não rebenta no servidor, onde `window` não existe.
 */
function subscribe(onStoreChange: () => void): () => void {
  const mediaQuery = window.matchMedia(MOBILE_QUERY);

  mediaQuery.addEventListener('change', onStoreChange);

  return () => mediaQuery.removeEventListener('change', onStoreChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(MOBILE_QUERY).matches;
}

/** No servidor assume-se ecrã grande: o layout de telemóvel aparece na hidratação. */
function getServerSnapshot(): boolean {
  return false;
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
