'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { PwaUpdateBanner } from '@/components/pwa-update-banner';

/**
 * Registo do service worker.
 *
 * Três decisões que valem a pena explicar:
 *
 * 1. **Não bloqueia o primeiro render.** O registo corre depois de a página
 *    estar montada (`useEffect`), e o componente devolve `null` enquanto não há
 *    nada para mostrar. Se o `serviceWorker` não existir no browser, ou o registo
 *    falhar, a aplicação funciona exatamente igual — a PWA é uma melhoria, não
 *    um requisito.
 * 2. **Em desenvolvimento não se registra — desregistra-se.** Um service worker
 *    registado por um `next start` anterior continuaria a servir pedaços em
 *    cache no `next dev`, e o *hot reload* pareceria avariado. Em
 *    desenvolvimento removem-se os registos e as caches do shell.
 * 3. **Nunca se recarrega a página por baixo do utilizador.** Quando há uma
 *    versão nova à espera aparece a faixa (`PwaUpdateBanner`); a recarga só
 *    acontece depois de o utilizador carregar em «Atualizar».
 */
export function PwaRegister() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [applying, setApplying] = useState(false);
  // Só se recarrega quando a troca de versão foi pedida pelo utilizador: a
  // primeira instalação também dispara `controllerchange` e não deve recarregar.
  const reloadWhenControlled = useRef(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    if (process.env.NODE_ENV !== 'production') {
      void cleanUpDevelopmentServiceWorkers();
      return;
    }

    let cancelled = false;

    function onControllerChange() {
      if (reloadWhenControlled.current) {
        window.location.reload();
      }
    }

    function trackInstalling(registration: ServiceWorkerRegistration) {
      const installing = registration.installing;

      if (installing === null) {
        return;
      }

      installing.addEventListener('statechange', () => {
        if (cancelled) {
          return;
        }

        /*
         * `controller` não nulo significa que já havia uma versão a controlar a
         * página: isto é uma **atualização**, não a primeira instalação (nesse
         * caso não há nada para avisar — a aplicação abre já na versão nova).
         */
        if (installing.state === 'installed' && navigator.serviceWorker.controller !== null) {
          setWaiting(installing);
        }
      });
    }

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        if (cancelled) {
          return;
        }

        // Já havia uma versão à espera (de uma visita anterior).
        if (registration.waiting !== null && navigator.serviceWorker.controller !== null) {
          setWaiting(registration.waiting);
        }

        registration.addEventListener('updatefound', () => trackInstalling(registration));
      })
      .catch((error: unknown) => {
        console.warn('[pwa] não consegui registar o service worker', error);
      });

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    if (waiting === null) {
      return;
    }

    reloadWhenControlled.current = true;
    setApplying(true);
    waiting.postMessage({ type: 'SKIP_WAITING' });
  }, [waiting]);

  const dismiss = useCallback(() => setWaiting(null), []);

  if (waiting === null) {
    return null;
  }

  return <PwaUpdateBanner onUpdate={applyUpdate} onDismiss={dismiss} pending={applying} />;
}

/**
 * Limpeza em desenvolvimento.
 *
 * Remove registos e caches do shell deixados por um `next start`. Sem isto, o
 * `next dev` serviria pedaços antigos e o *hot reload* pareceria avariado — um
 * problema que se diagnostica mal, porque o código está certo.
 */
async function cleanUpDevelopmentServiceWorkers(): Promise<void> {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();

    await Promise.all(registrations.map((registration) => registration.unregister()));

    const names = await caches.keys();

    await Promise.all(
      names.filter((name) => name.startsWith('financas-shell-')).map((name) => caches.delete(name)),
    );
  } catch (error) {
    console.warn('[pwa] não consegui limpar o service worker de desenvolvimento', error);
  }
}
