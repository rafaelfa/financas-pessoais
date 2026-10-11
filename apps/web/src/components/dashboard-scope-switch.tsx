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
import { dashboardViewFromParam, type DashboardView } from '@/server/dashboard-scope';
import type { DashboardScopeEntity } from '@/server/dashboard-scope';

/**
 * Seletor de âmbito do painel: a carteira toda, uma conta ou um cartão.
 *
 * **Estado derivado do URL.** O `viewKind` vem diretamente do parâmetro `vista`
 * no URL — não de `useState`, de modo a que o dropdown apareça **imediatamente**
 * ao clicar num botão, sem esperar pela resposta do servidor.
 *
 * Antes desta abordagem, o `viewKind` vinha da prop `scope` (resultado do
 * `resolveDashboardScope` server-side). O problema: ao clicar em "Conta", o URL
 * ficava `?vista=conta` (sem `id`), e o servidor devolvia `kind: 'tudo'` — o
 * dropdown não aparecia e o utilizador não podia escolher a conta. Agora, enquanto
 * o URL diz `vista=conta`, o dropdown aparece com as contas da base de dados.
 *
 * O `id` (para seleccionar uma entidade) continua a vir validado pelo servidor
 * (prop `scope.id`): um `id` alheio não é encontrado no `Select`, e a prop `scope`
 * traz a explicação da recusa. No entanto, o dropdown só desaparece quando o URL
 * volta a `vista=tudo`.
 */

/** Alvo de toque: 44 px em telemóvel, denso a partir de `sm`. */
const TOUCH = 'min-h-11 sm:min-h-8';

/** Nome do grupo de opções, ligado ao `aria-labelledby` do `radiogroup`. */
const GROUP_LABEL_ID = 'painel-ambito';

/** Valor do `Select` quando ainda não há entidade escolhida. */
const EMPTY_PICKER = '__sem_escolha__';

/** Título curto e ícone de cada vista. */
const VIEWS: ReadonlyArray<{
  readonly kind: DashboardView;
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
    readonly kind: DashboardView;
    readonly id: string | null;
  };
  readonly accounts: readonly DashboardScopeEntity[];
  readonly cards: readonly DashboardScopeEntity[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  /**
   * O estado de UI (qual dropdown está aberto) vem directamente do URL: assim,
   * ao clicar em "Conta", o dropdown aparece antes da ida ao servidor validar.
   */
  const urlView = dashboardViewFromParam(searchParams.get('vista'));
  const viewKind: DashboardView = urlView;
  const urlId = scope.id;

  const entities = viewKind === 'cartao' ? cards : accounts;
  const hasEntities = viewKind === 'tudo' ? true : entities.length > 0;

  /** Reescreve só `vista` e `id`, preservando o resto da query. */
  function push(next: { vista: DashboardView; id?: string }) {
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

  const pickerLabel = viewKind === 'cartao' ? 'Cartão' : 'Conta';

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

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-2">
        <div
          role="radiogroup"
          aria-labelledby={GROUP_LABEL_ID}
          className="flex flex-wrap items-end gap-2"
        >
          {VIEWS.map((view) => {
            const selected = viewKind === view.kind;
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

        {viewKind === 'tudo' ? null : (
          <div className="flex w-full flex-col gap-1 sm:max-w-xs sm:flex-1">
            <Label htmlFor="painel-ambito-entidade" className="text-xs text-muted-foreground">
              {pickerLabel}
            </Label>

            {hasEntities ? (
              <Select
                value={urlId ?? EMPTY_PICKER}
                onValueChange={(value) =>
                  push({
                    vista: viewKind,
                    ...(value === EMPTY_PICKER ? {} : { id: value }),
                  })
                }
              >
                <SelectTrigger id="painel-ambito-entidade" className={`w-full ${TOUCH}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EMPTY_PICKER}>
                    {viewKind === 'cartao' ? 'Escolhe um cartão' : 'Escolhe uma conta'}
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
                {viewKind === 'cartao'
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
