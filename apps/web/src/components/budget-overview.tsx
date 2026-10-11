import { CircleDollarSign, PiggyBank, TrendingUp, Wallet } from 'lucide-react';

import { Amount } from '@/components/amount';
import {
  BudgetMeter,
  BudgetStateBadge,
  BUDGET_STATE_DESCRIPTIONS,
} from '@/components/budget-status';
import { KpiCard } from '@/components/kpi-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { BudgetView } from '@/server/budgets';

/**
 * Cabeçalho do orçamento do período.
 *
 * O número que responde à pergunta “vou estourar o orçamento?” é a **projeção**,
 * não o gasto: quem já gastou 80% no dia 5 está num caminho diferente de quem
 * gastou 80% no dia 28. Por isso a projeção vem em destaque, com a frase que a
 * explica, e só depois os valores já realizados.
 *
 * Nota de rótulos, para não mentir em nenhum deles:
 * - “Gasto no mês” é o total das despesas do período (`spentAllInCents`);
 * - “Gasto nas categorias com limite” é o que consome os limites — é esse que a
 *   barra e o estado medem;
 * - a projeção é a das **categorias com limite**, como o motor a calcula.
 *
 * Componente de servidor: as ações (criar/editar orçamento) chegam por `actions`.
 */
export function BudgetOverview({
  budget,
  actions,
}: {
  readonly budget: BudgetView;
  readonly actions?: React.ReactNode;
}) {
  const overrunInCents = budget.projectedInCents - budget.totalAmountInCents;
  const hasProjection = budget.spentInCents > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-lg">{budget.name}</CardTitle>
            <p className="text-sm text-muted-foreground">{formatPeriod(budget)}</p>
          </div>
          {actions === undefined ? null : <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Total do orçamento" icon={PiggyBank}>
            <Amount amountInCents={budget.totalAmountInCents} tone="neutral" />
          </KpiCard>

          <KpiCard
            label="Gasto no mês"
            icon={Wallet}
            hint="Todas as despesas do período, incluindo categorias sem limite."
          >
            <Amount amountInCents={budget.spentAllInCents} tone="neutral" />
          </KpiCard>

          <KpiCard
            label="Projetado até ao fim do mês"
            icon={TrendingUp}
            hint="Ao ritmo que levas, só nas categorias com limite."
          >
            <Amount amountInCents={budget.projectedInCents} tone="neutral" />
          </KpiCard>

          <KpiCard label="Sobra do orçamento" icon={CircleDollarSign}>
            <Amount amountInCents={budget.remainingInCents} tone="neutral" />
          </KpiCard>
        </div>

        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm" aria-live="polite">
          {hasProjection ? (
            overrunInCents > 0 ? (
              <>
                Ao ritmo atual, vais gastar{' '}
                <strong>
                  <Amount amountInCents={budget.projectedInCents} tone="neutral" />
                </strong>{' '}
                até ao fim do mês —{' '}
                <strong>
                  <Amount amountInCents={overrunInCents} tone="neutral" />
                </strong>{' '}
                acima do total do orçamento. Aperta agora, ou ajusta o total.
              </>
            ) : (
              <>
                Ao ritmo atual, vais gastar{' '}
                <strong>
                  <Amount amountInCents={budget.projectedInCents} tone="neutral" />
                </strong>{' '}
                até ao fim do mês — dentro do total do orçamento.
              </>
            )
          ) : (
            <>Ainda sem gastos nas categorias com limite, por isso não há ritmo para projetar.</>
          )}
        </p>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium">
              Gastos nas categorias com limite: {budget.usedPct}%
            </span>
            <BudgetStateBadge state={budget.state} />
          </div>

          <BudgetMeter usedPct={budget.usedPct} state={budget.state} label={budget.name} />

          <p className="text-xs text-muted-foreground">
            <Amount amountInCents={budget.spentInCents} tone="neutral" /> de{' '}
            <Amount amountInCents={budget.totalAmountInCents} tone="neutral" /> —{' '}
            {BUDGET_STATE_DESCRIPTIONS[budget.state] ?? ''} A diferença entre este valor e o “Gasto
            no mês” são as categorias que ainda não têm limite.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Período legível.
 *
 * O âmbito vem do servidor (`scope`) e não de uma heurística sobre a data: um
 * orçamento mensal padrão guarda internamente a sentinela `1970-01-01` por causa
 * da chave única da base de dados, e adivinhar por essa data acabaria por
 * mostrar 1970 em algum ecrã.
 */
function formatPeriod(budget: BudgetView): string {
  if (budget.scope === 'monthly_default') {
    return 'Orçamento mensal: vale para todos os meses.';
  }

  if (budget.periodEnd === null) {
    return `Só este mês, a partir de ${formatDay(budget.periodStart)}.`;
  }

  return `Só este mês: de ${formatDay(budget.periodStart)} a ${formatDay(budget.periodEnd)}.`;
}

/** Data de calendário em formato curto, sem deslocação de fuso. */
function formatDay(date: string): string {
  return new Intl.DateTimeFormat('pt-PT', { timeZone: 'UTC', dateStyle: 'short' }).format(
    new Date(`${date}T00:00:00Z`),
  );
}
