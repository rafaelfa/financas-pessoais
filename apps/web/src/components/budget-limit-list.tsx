'use client';

import { Pencil, PiggyBank, Plus, Trash, TriangleAlert } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Amount } from '@/components/amount';
import { BudgetLimitDialog } from '@/components/budget-limit-dialog';
import { BudgetMeter, BudgetStateBadge } from '@/components/budget-status';
import { EmptyState } from '@/components/empty-state';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { removeBudgetLimit } from '@/server/budgets-actions';
import type { BudgetLimitView, BudgetView } from '@/server/budgets';

/**
 * Limites por categoria.
 *
 * Cada linha diz, por palavras, quanto já foi gasto, quanto sobra e em que estado
 * está — a barra é um reforço, não a mensagem. Um limite excedido mostra a sobra
 * **negativa**, porque “quanto é que passei” é a pergunta certa nesse momento.
 *
 * No fim, as categorias que ainda não têm limite aparecem com o gasto do período:
 * é a lista de onde se decide onde apertar.
 */

/** Limiar por omissão do motor quando o limite não define nenhum. */
const DEFAULT_THRESHOLD_PCT = 80;

/** Alvo de toque: 44 px em telemóvel, denso a partir de `sm`. */
const TOUCH = 'min-h-11 sm:min-h-8';
const ICON_TOUCH = 'min-h-11 min-w-11 sm:min-h-7 sm:min-w-7';

export function BudgetLimitList({ budget }: { readonly budget: BudgetView }) {
  const [addingCategoryId, setAddingCategoryId] = useState<string | null>(null);

  /** Categorias que ainda podem receber um limite. */
  const categoryOptions = budget.withoutLimit.map((category) => ({
    value: category.categoryId,
    label: category.categoryName,
  }));

  return (
    <section aria-labelledby="orcamento-limites" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 id="orcamento-limites" className="font-heading text-lg font-medium">
            Limites por categoria
          </h2>
          <p className="text-sm text-muted-foreground">
            A soma dos limites pode passar do total do orçamento: avisamos, mas não bloqueamos —
            pode ser exatamente o que queres.
          </p>
        </div>

        <BudgetLimitDialog
          budgetId={budget.id}
          categoryOptions={categoryOptions}
          trigger={
            <Button size="sm" disabled={categoryOptions.length === 0}>
              <Plus className="size-3.5" aria-hidden />
              Novo limite
            </Button>
          }
        />
      </div>

      {budget.limits.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title="Ainda não há limites por categoria"
          description="O total do orçamento diz quanto queres gastar; os limites dizem onde. Define um limite nas categorias que queres controlar e o consumo aparece aqui, com aviso antes de passar."
        />
      ) : (
        <ul className="space-y-3">
          {budget.limits.map((limit) => (
            <li key={limit.id}>
              <LimitRow budgetId={budget.id} limit={limit} categoryOptions={categoryOptions} />
            </li>
          ))}
        </ul>
      )}

      {budget.withoutLimit.length === 0 ? null : (
        <div className="space-y-3 rounded-xl border border-dashed p-4">
          <div className="space-y-1">
            <h3 className="font-heading text-base font-medium">Categorias sem limite</h3>
            <p className="text-sm text-muted-foreground">
              O que gastaste nelas não está a ser contido por nada. Escolhe uma para lhe definir um
              limite.
            </p>
          </div>

          <ul className="flex flex-wrap gap-2">
            {budget.withoutLimit.map((category) => (
              <li key={category.categoryId}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={TOUCH}
                  onClick={() => setAddingCategoryId(category.categoryId)}
                >
                  {category.categoryName}
                  {category.spentInCents === undefined ? null : (
                    <>
                      {' · '}
                      <Amount amountInCents={category.spentInCents} tone="neutral" />
                    </>
                  )}
                  <Plus className="size-3.5" aria-hidden />
                  <span className="sr-only">Definir limite em {category.categoryName}</span>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {addingCategoryId === null ? null : (
        <BudgetLimitDialog
          budgetId={budget.id}
          categoryOptions={categoryOptions}
          defaultCategoryId={addingCategoryId}
          open
          onOpenChange={(open) => {
            if (!open) {
              setAddingCategoryId(null);
            }
          }}
        />
      )}
    </section>
  );
}

function LimitRow({
  budgetId,
  limit,
  categoryOptions,
}: {
  readonly budgetId: string;
  readonly limit: BudgetLimitView;
  readonly categoryOptions: readonly { value: string; label: string }[];
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const threshold = limit.alertThresholdPct ?? DEFAULT_THRESHOLD_PCT;
  const alertTriggered = limit.alertsEnabled && limit.usedPct >= threshold;
  const exceeded = limit.remainingInCents < 0;

  function confirmRemove() {
    startTransition(async () => {
      const result = await removeBudgetLimit({
        budgetId,
        categoryId: limit.categoryId,
      });

      if (!result.ok) {
        toast.error(result.error);
        setRemoveOpen(false);
        return;
      }

      toast.success('Limite removido. Os gastos ficam onde estavam.');
      setRemoveOpen(false);
    });
  }

  return (
    <div className="space-y-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="font-medium">{limit.categoryName}</p>
          <p className="text-xs text-muted-foreground">
            Limiar de aviso: {threshold}%{limit.alertsEnabled ? null : ' · alertas desligados'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <BudgetStateBadge state={limit.state} />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={ICON_TOUCH}
            aria-label={`Editar o limite de ${limit.categoryName}`}
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="size-4" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={ICON_TOUCH}
            aria-label={`Remover o limite de ${limit.categoryName}`}
            onClick={() => setRemoveOpen(true)}
          >
            <Trash className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      <BudgetMeter
        usedPct={limit.usedPct}
        state={limit.state}
        thresholdPct={limit.alertsEnabled ? threshold : null}
        label={`Limite de ${limit.categoryName}`}
      />

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted-foreground">Gasto</dt>
          <dd>
            <Amount amountInCents={limit.spentInCents} tone="neutral" />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Limite</dt>
          <dd>
            <Amount amountInCents={limit.amountInCents} tone="neutral" />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{exceeded ? 'Passaste' : 'Sobra'}</dt>
          <dd>
            <Amount
              amountInCents={exceeded ? Math.abs(limit.remainingInCents) : limit.remainingInCents}
              tone="neutral"
            />
          </dd>
        </div>
      </dl>

      {alertTriggered ? (
        <p className="flex items-center gap-1.5 text-xs text-warning-foreground">
          <TriangleAlert className="size-3.5" aria-hidden />
          Passaste o limiar de aviso de {threshold}% ({limit.usedPct}% consumido).
        </p>
      ) : null}

      <BudgetLimitDialog
        budgetId={budgetId}
        limit={{
          categoryId: limit.categoryId,
          categoryName: limit.categoryName,
          amountInCents: limit.amountInCents,
          alertThresholdPct: limit.alertThresholdPct,
          alertsEnabled: limit.alertsEnabled,
        }}
        categoryOptions={categoryOptions}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <Trash aria-hidden />
            </AlertDialogMedia>
            <AlertDialogTitle>Remover o limite de «{limit.categoryName}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Deixas de acompanhar esta categoria, mas nenhum lançamento é alterado: o que gastaste
              fica exatamente onde está. Podes voltar a definir o limite quando quiseres.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                confirmRemove();
              }}
            >
              {pending ? 'A remover…' : 'Remover limite'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
