import { Target } from 'lucide-react';
import type { Metadata } from 'next';

import { Amount } from '@/components/amount';
import { EmptyState } from '@/components/empty-state';
import { GoalCard } from '@/components/goal-card';
import { GoalDetailDialog, type GoalDetailData } from '@/components/goal-detail-dialog';
import { GoalDialog } from '@/components/goal-dialog';
import { goalVerdict } from '@/components/goal-progress';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { listAccounts } from '@/server/accounts';
import { getGoal, listGoals } from '@/server/goals';
import { todayInLisbon } from '@/lib/today';

export const metadata: Metadata = { title: 'Objetivos' };

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Objetivos de poupança.
 *
 * Cada cartão diz se está no bom caminho por palavras, além da percentagem, e
 * quanto é preciso guardar em cada período. O histórico de movimentos abre por
 * URL (`?objetivo=<id>`) e é resolvido no servidor, porque `getGoal` é uma
 * consulta de servidor e não pode ser chamada a partir do browser.
 */
export default async function ObjetivosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const today = todayInLisbon();

  const goalParam =
    typeof params.objetivo === 'string' && params.objetivo.trim() !== ''
      ? params.objetivo.trim()
      : undefined;

  const [goals, accounts] = await Promise.all([listGoals(), listAccounts()]);

  /*
   * Um `?objetivo=` antigo (link guardado, objetivo entretanto apagado) não pode
   * derrubar o ecrã: sem detalhe, o diálogo explica que já não existe.
   */
  let detail: GoalDetailData | null = null;

  if (goalParam !== undefined) {
    try {
      detail = await getGoal(goalParam);
    } catch {
      detail = null;
    }
  }

  const accumulatedInCents = goals.reduce((total, goal) => total + goal.accumulatedInCents, 0);
  const targetInCents = goals.reduce((total, goal) => total + goal.targetAmountInCents, 0);
  const onTrackCount = goals.filter((goal) => goalVerdict(goal) === 'on-track').length;
  const completedCount = goals.filter((goal) => goalVerdict(goal) === 'completed').length;

  return (
    <>
      <PageHeader
        title="Objetivos"
        description="Quanto queres juntar, até quando, e quanto é preciso guardar em cada período. Ao ritmo real de poupança, dizemos-te se estás no bom caminho."
        actions={
          goals.length === 0 ? null : (
            <GoalDialog mode="create" trigger={<Button size="sm">Novo objetivo</Button>} />
          )
        }
      />

      {goals.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Ainda não tens objetivos"
          description="Um objetivo responde a três perguntas: quanto, até quando e quanto por período. A partir daí calculamos o esforço necessário, projetamos a data de conclusão ao teu ritmo e avisamos quando o prazo aperta."
          action={
            <GoalDialog
              mode="create"
              trigger={<Button size="sm">Criar o primeiro objetivo</Button>}
            />
          }
        />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border bg-muted/30 px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              {goals.length === 1 ? '1 objetivo' : `${goals.length} objetivos`}
              {onTrackCount > 0 ? ` · ${onTrackCount} no bom caminho` : ''}
              {completedCount > 0 ? ` · ${completedCount} concluído(s)` : ''}
            </span>
            <span>
              <strong>
                <Amount amountInCents={accumulatedInCents} tone="neutral" />
              </strong>{' '}
              <span className="text-muted-foreground">
                de <Amount amountInCents={targetInCents} tone="neutral" />
              </span>
            </span>
          </div>

          <ul className="grid gap-4 lg:grid-cols-2">
            {goals.map((goal) => (
              <li key={goal.id}>
                <GoalCard
                  goal={goal}
                  accounts={accounts}
                  today={today}
                  detailHref={`/objetivos?objetivo=${encodeURIComponent(goal.id)}`}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {goalParam === undefined ? null : <GoalDetailDialog detail={detail} />}
    </>
  );
}
