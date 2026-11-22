'use client';

import { Eye, EyeOff } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from 'react';

import { Button } from '@/components/ui/button';
import {
  PRIVACY_COOKIE,
  PRIVACY_COOKIE_MAX_AGE,
  PRIVACY_STORAGE_KEY,
} from '@/lib/privacy-preference';

/**
 * Preferência de privacidade do ecrã.
 *
 * A verdade vive no atributo `data-privacidade` do `<html>`, e por uma razão
 * concreta: é o único sítio que é escrito **antes da primeira pintura** (pelo
 * script inline de `app/layout.tsx`), por isso é o único que não deixa escapar
 * um valor ao recarregar. O `localStorage` guarda a preferência e o cookie deixa
 * o servidor servir a página já mascarada; os dois escrevem o mesmo estado.
 */
type PrivacyState = 'ativa' | 'inativa';

const listeners = new Set<() => void>();

function toState(hidden: boolean): PrivacyState {
  return hidden ? 'ativa' : 'inativa';
}

function readAttribute(): PrivacyState {
  return document.documentElement.dataset.privacidade === 'ativa' ? 'ativa' : 'inativa';
}

function writeState(state: PrivacyState): void {
  document.documentElement.dataset.privacidade = state;

  try {
    window.localStorage.setItem(PRIVACY_STORAGE_KEY, state);
  } catch {
    // localStorage bloqueado (modo privado, política do browser): o cookie
    // abaixo continua a servir o servidor. Perde-se a preferência partilhada
    // entre separadores, não a máscara.
  }

  const secure = window.location.protocol === 'https:' ? '; secure' : '';

  document.cookie = `${PRIVACY_COOKIE}=${state}; path=/; max-age=${PRIVACY_COOKIE_MAX_AGE}; samesite=lax${secure}`;

  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  // Outro separador mudou a preferência: o `localStorage` é partilhado e o
  // evento só chega a quem não escreveu.
  function onStorage(event: StorageEvent) {
    if (event.key !== PRIVACY_STORAGE_KEY) {
      return;
    }

    const state = event.newValue === 'ativa' ? 'ativa' : 'inativa';

    if (state !== readAttribute()) {
      writeState(state);
    }
  }

  window.addEventListener('storage', onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.closest('[contenteditable="true"], [role="textbox"]') !== null ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
  );
}

/** Um diálogo aberto (paleta de comandos incluída) trata das teclas que apanha. */
function hasOpenDialog(): boolean {
  return document.querySelector('[role="dialog"][data-state="open"]') !== null;
}

interface PrivacyContextValue {
  readonly hidden: boolean;
  readonly toggle: () => void;
}

const PrivacyContext = createContext<PrivacyContextValue | null>(null);

export function usePrivacy(): PrivacyContextValue {
  const value = useContext(PrivacyContext);

  if (value === null) {
    throw new Error('usePrivacy só funciona dentro de <PrivacyProvider>.');
  }

  return value;
}

export function PrivacyProvider({
  hidden: serverHidden,
  children,
}: {
  readonly hidden: boolean;
  readonly children: React.ReactNode;
}) {
  const state = useSyncExternalStore(
    subscribe,
    readAttribute,
    useCallback(() => toState(serverHidden), [serverHidden]),
  );

  const toggle = useCallback(() => {
    writeState(readAttribute() === 'ativa' ? 'inativa' : 'ativa');
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== 'h' || !event.shiftKey) {
        return;
      }

      if (!event.ctrlKey && !event.metaKey) {
        return;
      }

      if (isEditable(event.target) || hasOpenDialog()) {
        return;
      }

      event.preventDefault();
      toggle();
    }

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggle]);

  const hidden = state === 'ativa';
  const value = useMemo(() => ({ hidden, toggle }), [hidden, toggle]);

  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>;
}

/** Botão do cabeçalho: alterna entre esconder e mostrar os montantes. */
export function PrivacyToggle() {
  const { hidden, toggle } = usePrivacy();
  const label = hidden ? 'Mostrar montantes' : 'Ocultar montantes';

  return (
    <Button
      variant="outline"
      size="icon"
      className="max-sm:min-h-11 max-sm:min-w-11"
      onClick={toggle}
      aria-pressed={hidden}
      aria-label={label}
      title={`${label} (Ctrl+Shift+H)`}
    >
      {hidden ? <Eye className="size-4" aria-hidden /> : <EyeOff className="size-4" aria-hidden />}
    </Button>
  );
}
