'use client';

import { CreditCard, LayoutGrid, Wallet } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ComponentType } from 'react';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { DashboardScopeEntity } from '@/server/dashboard-scope';

/**
 * Seletor de âmbito do painel: a carteira toda, uma conta ou um cartão.
 *
 * O estado vive no **URL** (`?vista=conta&id=<uuid>`), não em `useState`: um
 * painel filtrado por conta é uma vista que se partilha e que sobrevive a
 * recarregar a página. Como o servidor lê os mesmos parâmetros, o que está no
 * ecrã é exatamente o que o endereço diz — e um `id` de outra pessoa é recusado
 * lá, não aqui.
 *
 * Num cartão não se escolhe um "cartão" sem se escolher qual: a lista de
 * seleção faz parte do botão. Escolher o botão troca a vista e abre a lista com
 * as opções desse tipo; escolher uma opção fecha-a. Sem cartões (ou sem contas),
 * o botão abre com a explicação do que fazer no ecrã que os cria.
 */

/** Alvo de toque: 44 px em telemóvel, denso a partir de `sm`. */
const TOUCH = 'min-h-11 sm:min-h-8';

/** Nome do grupo de opções, ligado ao `aria-labelledby` do `radiogroup`. */
const GROUP_LABEL_ID = 'painel-ambito';

/** Valor do `Select` quando ainda não há entidade escolhida. */
const EMPTY_PICKER = '__sem_escolha__';

/** Título curto e ícone de cada vista. */
const VIEWS: ReadonlyArray<{
  readonly kind: 'tudo' | 'conta' | 'cartao';
  readonly title: string;
  readonly icon: ComponentType<{ className?: string }>;
}> = [
  { kind: 'tudo', title: 'Tudo', icon: LayoutGrid },
  { kind: 'conta', title: 'Conta', icon: Wallet },
  { kind: 'cartao', title: 'Cartão', icon: CreditCard },
];

export function DashboardScopeSwitch({
  scope,
  accounts,
  cards,
}: {
  readonly scope: {
    readonly kind: 'tudo' | 'conta' | 'cartao';
    readonly id: string | null;
  };
  readonly accounts: readonly DashboardScopeEntity[];
  readonly cards: readonly DashboardScopeEntity[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const entities = scope.kind === 'cartao' ? cards : accounts;
  const hasEntities = scope.kind === 'tudo' ? true : entities.length > 0;

  /** Reescreve só `vista` e `id`, preservando o resto da query. */
  function push(next: { vista: 'tudo' | 'conta' | 'cartao'; id?: string }) {
    const params = new URLSearchParams(searchParams.toString());

    if (next.vista === 'tudo') {
      params.delete('vista');
      params.delete('id');
    } else {
      params.set('vista', next.vista);

      if (next.id === undefined) {
        params.delete('id');
      } else {
        params.set('id', next.id);
      }
    }

    const query = params.toString();
    router.push(query === '' ? pathname : `${pathname}?${query}`);
  }

  const pickerLabel = scope.kind === 'cartao' ? 'Cartão' : 'Conta';

  return (
    <section
      aria-labelledby={GROUP_LABEL_ID}
      className="mb-6 rounded-xl border p-4"
      data-testid="painel-ambito"
    >
      <p id={GROUP_LABEL_ID} className="text-sm font-medium">
        Ver por
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        A vista fica no endereço: podes guardá-la nos favoritos ou partilhá-la com quem quiseres.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <div role="radiogroup" aria-labelledby={GROUP_LABEL_ID} className="flex flex-wrap gap-2">
          {VIEWS.map((view) => {
            const selected = scope.kind === view.kind;
            const Icon = view.icon;

            return (
              <button
                key={view.kind}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  if (!selected) {
                    push({ vista: view.kind });
                  }
                }}
                className={cn(
                  'inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors sm:min-h-8',
                  selected
                    ? 'border-transparent bg-primary text-primary-foreground'
                    : 'border-border bg-background hover:bg-muted',
                )}
              >
                <Icon className="size-3.5" aria-hidden />
                {view.title}
              </button>
            );
          })}
        </div>

        {scope.kind === 'tudo' ? null : (
          <div className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-xs">
            <Label htmlFor="painel-ambito-entidade" className="text-xs text-muted-foreground">
              {pickerLabel}
            </Label>

            {hasEntities ? (
              <Select
                value={scope.id ?? EMPTY_PICKER}
                onValueChange={(value) =>
                  push({
                    vista: scope.kind,
                    ...(value === EMPTY_PICKER ? {} : { id: value }),
                  })
                }
              >
                <SelectTrigger id="painel-ambito-entidade" className={`w-full ${TOUCH}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EMPTY_PICKER}>
                    {scope.kind === 'cartao' ? 'Escolhe um cartão' : 'Escolhe uma conta'}
                  </SelectItem>
                  {entities.map((entity) => (
                    <SelectItem key={entity.id} value={entity.id}>
                      {entity.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="rounded-lg border border-dashed px-3 py-1.5 text-xs text-muted-foreground">
                {scope.kind === 'cartao'
                  ? 'Ainda não tens cartões. Cria um em Cartões para veres aqui os lançamentos dele.'
                  : 'Ainda não tens contas. Cria uma em Contas para veres aqui os movimentos dela.'}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
