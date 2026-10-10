import { ListTree } from 'lucide-react';
import type { Metadata } from 'next';

import { CategoryDialog } from '@/components/category-dialog';
import { CategoryTree } from '@/components/category-tree';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { listCategories } from '@/server/categories';

export const metadata: Metadata = { title: 'Categorias' };

/**
 * Categorias.
 *
 * A lista mostra as duas distinções que o resto da aplicação assume: categorias
 * **do sistema** (não editáveis, base dos relatórios) e categorias **internas**
 * (aparecem no extrato mas ficam fora dos totais).
 */
export default async function CategoriasPage() {
  const categories = await listCategories();

  return (
    <>
      <PageHeader
        title="Categorias"
        description="Os assuntos pelos quais classificas os movimentos. As subcategorias detalham sem perder o total do conjunto."
        actions={
          <CategoryDialog
            mode="create"
            categories={categories}
            trigger={<Button size="sm">Nova categoria</Button>}
          />
        }
      />

      {categories.length === 0 ? (
        <EmptyState
          icon={ListTree}
          title="Ainda não há categorias"
          description="As categorias de sistema são criadas com a aplicação. Se esta lista está vazia, o seed ainda não correu — podes entretanto criar as tuas."
          action={
            <CategoryDialog
              mode="create"
              categories={categories}
              trigger={<Button size="sm">Criar a primeira categoria</Button>}
            />
          }
        />
      ) : (
        <CategoryTree categories={categories} />
      )}
    </>
  );
}
