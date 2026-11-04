import type { Metadata } from 'next';

import { ImportExportPanel } from '@/components/import-export-panel';
import { ImportWorkflow } from '@/components/import-workflow';
import { PageHeader } from '@/components/page-header';
import { listAccounts } from '@/server/accounts';
import { listCards } from '@/server/cards';
import { listCategories } from '@/server/categories';

export const metadata: Metadata = { title: 'Importar' };

/**
 * Importar e exportar.
 *
 * O ecrã é o mesmo para as duas direções porque respondem à mesma pergunta —
 * “como é que os meus dados entram e saem daqui?” — mas fazem coisas muito
 * diferentes: a importação é a operação mais perigosa da aplicação e por isso
 * passa por uma pré-visualização que não grava nada; a exportação é a porta de
 * saída e não tem risco nenhum.
 *
 * As categorias são carregadas para alimentar a sugestão editável de cada linha
 * (o servidor volta a validar que são do utilizador e não internas).
 */
export default async function ImportarPage() {
  const [accounts, categories, cards] = await Promise.all([
    listAccounts(),
    listCategories(),
    listCards(),
  ]);

  return (
    <>
      <PageHeader
        title="Importar e exportar"
        description="Traz os extratos que já tens e leva os teus dados quando quiseres. A importação mostra tudo antes de gravar, e nada fica preso aqui."
      />

      <div className="space-y-8">
        <ImportWorkflow accounts={accounts} categories={categories} cards={cards} />

        <ImportExportPanel accounts={accounts} />
      </div>
    </>
  );
}
