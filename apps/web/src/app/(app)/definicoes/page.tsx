import type { Metadata } from 'next';

import { PageHeader } from '@/components/page-header';
import { PreferencesForm } from '@/components/preferences-form';
import { requireUser } from '@/server/session';

export const metadata: Metadata = { title: 'Definições' };

/**
 * Definições que o motor financeiro lê.
 *
 * As duas que se guardam são colunas do utilizador (`monthStartDay`,
 * `accountingBasis`), não um modelo à parte: o painel, os relatórios e a
 * exportação já as leem, faltava a página que as escreve.
 */
export default async function DefinicoesPage() {
  const user = await requireUser();

  return (
    <>
      <PageHeader
        title="Definições"
        description="Como a aplicação conta o teu dinheiro: o início do mês e o regime de contabilização. Ficam guardados na tua conta."
      />

      <PreferencesForm monthStartDay={user.monthStartDay} accountingBasis={user.accountingBasis} />
    </>
  );
}
