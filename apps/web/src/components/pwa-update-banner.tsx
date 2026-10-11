'use client';

import { RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * Aviso de nova versão.
 *
 * Quando há um service worker novo à espera, a aplicação **não** se recarrega
 * sozinha: o utilizador pode estar a meio de um lançamento. Aparece esta faixa
 * discreta, com um botão para aplicar a versão nova quando ele quiser — a versão
 * antiga continua a funcionar até lá.
 *
 * A faixa fica acima da navegação inferior do telemóvel (que é fixa) e passa
 * para o canto no ecrã grande.
 */

/** Alvo de toque: 44 px em telemóvel, denso a partir de `sm`. */
const TOUCH = 'min-h-11 sm:min-h-8';

export function PwaUpdateBanner({
  onUpdate,
  onDismiss,
  pending = false,
}: {
  /** Aplica a versão nova (envia `SKIP_WAITING` ao service worker). */
  readonly onUpdate: () => void;
  /** Fecha a faixa sem atualizar. */
  readonly onDismiss: () => void;
  readonly pending?: boolean;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 md:inset-x-auto md:right-4 md:bottom-4 md:w-96"
    >
      <div className="rounded-xl border bg-card p-3 shadow-lg">
        <p className="text-sm font-medium">Há uma versão nova da aplicação</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          A que estás a usar continua a funcionar. Atualiza quando quiseres — nada do que tens em
          curso se perde.
        </p>

        <div className="mt-2 flex flex-wrap gap-2">
          <Button type="button" size="sm" className={TOUCH} disabled={pending} onClick={onUpdate}>
            <RefreshCw className="size-3.5" aria-hidden />
            {pending ? 'A atualizar…' : 'Atualizar'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={TOUCH}
            disabled={pending}
            onClick={onDismiss}
          >
            Mais tarde
          </Button>
        </div>
      </div>
    </div>
  );
}
