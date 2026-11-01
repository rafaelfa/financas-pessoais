'use client';

import { useSyncExternalStore } from 'react';

const MOBILE_QUERY = '(max-width: 767px)';

/**
 * Deteta se o ecrã é de telemóvel.
 *
 * `matchMedia` é o sistema externo, por isso lê-se com `useSyncExternalStore`:
 * sem `setState` dentro de um efeito e sem renderizações em cascata.
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
