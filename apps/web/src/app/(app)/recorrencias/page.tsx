import { Repeat } from 'lucide-react';
import type { Metadata } from 'next';

import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { RecurrenceDialog } from '@/components/recurrence-dialog';
import { RecurrenceGenerateButton } from '@/components/recurrence-generate-button';
import { RecurrenceList } from '@/components/recurrence-list';
import { Button } from '@/components/ui/button';
import { todayInLisbon } from '@/lib/today';
import { listAccounts } from '@/server/accounts';
import { listCategories } from '@/server/categories';
import { listRecurrences } from '@/server/recurrences';

export const metadata: Metadata = { title: 'Recorrências' };

/**
 * Recorrências: as séries que geram lançamentos sozinhas.
 *
 * A página junta as três consultas em paralelo (séries, contas e categorias) e
 * entrega a lista à parte cliente, que precisa de interação para pausar, editar
 * e eliminar. A geração é sempre pedida pelo utilizador: nada é criado só por
 * abrir o ecrã.
 */
export default async function RecorrenciasPage() {
  const today = todayInLisbon();

  const [recurrences, accounts, categories] = await Promise.all([
    listRecurrences(),
    listAccounts(),
    listCategories(),
  ]);

  const dueCount = recurrences.filter((recurrence) => recurrence.isActive && recurrence.due).length;

  const createDialog = (
    <RecurrenceDialog
      mode="create"
      accounts={accounts}
      categories={categories}
      today={today}
      trigger={<Button size="sm">Nova recorrência</Button>}
    />
  );

  return (
    <>
      <PageHeader
        title="Recorrências"
        description="Contas fixas e rendimentos que se repetem: renda, subscrições, seguros e salário. A geração de ocorrências é idempotente — podes gerar as vezes que quiseres sem criar duas vezes a mesma data."
        actions={
          <>
            <RecurrenceGenerateButton dueCount={dueCount} />
            {createDialog}
          </>
        }
      />

      {recurrences.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="Ainda não tens recorrências"
          description="Uma recorrência é uma série: defines uma vez («todos os meses, dia 5») e a aplicação cria os lançamentos até hoje, sem duplicar nada. Serve para a renda, o salário, os seguros e as subscrições — e faz com que a projeção de saldo do painel conte com eles."
          action={
            <RecurrenceDialog
              mode="create"
              accounts={accounts}
              categories={categories}
              today={today}
              trigger={<Button size="sm">Criar a primeira recorrência</Button>}
            />
          }
        />
      ) : (
        <RecurrenceList
          recurrences={recurrences}
          accounts={accounts}
          categories={categories}
          today={today}
        />
      )}
    </>
  );
}
