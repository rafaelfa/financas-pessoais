'use client';

import { CircleOff, EllipsisVertical, Pencil, Plus, Trash } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { CATEGORY_KIND_LABELS, CategoryDialog } from '@/components/category-dialog';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { deleteCategory } from '@/server/categories-actions';
import type { CategoryView } from '@/server/categories';
import { cn } from '@/lib/utils';

/**
 * Árvore de categorias, por natureza e com as mães a arrastar os filhos.
 *
 * A distinção que a interface tem de deixar clara:
 * - **Do sistema**: vêm com a aplicação, são a base partilhada dos relatórios e
 *   não se editam nem se apagam;
 * - **Fora dos totais** (internas): aparecem no extrato mas nunca contam como
 *   ganho nem gasto.
 *
 * São duas coisas diferentes e é por isso que têm distintivos diferentes.
 */

/** Alvo de toque: 44 px em telemóvel, denso a partir de `sm`. */
const ICON_TOUCH = 'min-h-11 min-w-11 sm:min-h-7 sm:min-w-7';

export function CategoryTree({ categories }: { readonly categories: readonly CategoryView[] }) {
  const roots = categories.filter(
    (category) =>
      category.parentId === null ||
      !categories.some((candidate) => candidate.id === category.parentId),
  );

  return (
    <div className="space-y-8">
      {(['expense', 'income'] as const).map((kind) => {
        const kindRoots = sortCategories(roots.filter((category) => category.kind === kind));

        return (
          <section key={kind} aria-labelledby={`categorias-${kind}`} className="space-y-3">
            <div className="space-y-1">
              <h2 id={`categorias-${kind}`} className="font-heading text-lg font-medium">
                {`${CATEGORY_KIND_LABELS[kind] ?? kind}s`}
              </h2>
              <p className="text-sm text-muted-foreground">
                As categorias do sistema não se editam nem se apagam — são a base partilhada dos
                relatórios. As marcadas como <strong>fora dos totais</strong> aparecem no extrato
                mas não contam como ganho nem gasto.
              </p>
            </div>

            {kindRoots.length === 0 ? (
              <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                Ainda não tens categorias de {kind === 'expense' ? 'gasto' : 'ganho'}.
              </p>
            ) : (
              <ul className="divide-y rounded-xl border">
                {kindRoots.map((root) => (
                  <li key={root.id}>
                    <CategoryRow
                      category={root}
                      categories={categories}
                      childrenOf={sortCategories(
                        categories.filter((category) => category.parentId === root.id),
                      )}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function CategoryRow({
  category,
  categories,
  childrenOf,
}: {
  readonly category: CategoryView;
  readonly categories: readonly CategoryView[];
  readonly childrenOf: readonly CategoryView[];
}) {
  const hasChildren = childrenOf.length > 0;
  const canDelete = !category.isSystem && category.transactionCount === 0 && !hasChildren;

  return (
    <div>
      <CategoryLine category={category} categories={categories} canDelete={canDelete} />

      {hasChildren ? (
        <ul className="divide-y border-t bg-muted/20">
          {childrenOf.map((child) => (
            <li key={child.id}>
              <CategoryLine
                category={child}
                categories={categories}
                canDelete={!child.isSystem && child.transactionCount === 0}
                indented
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function CategoryLine({
  category,
  categories,
  canDelete,
  indented = false,
}: {
  readonly category: CategoryView;
  readonly categories: readonly CategoryView[];
  readonly canDelete: boolean;
  readonly indented?: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [createChildOpen, setCreateChildOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirmDelete() {
    startTransition(async () => {
      const result = await deleteCategory({ id: category.id });

      if (!result.ok) {
        toast.error(result.error);
        setDeleteOpen(false);
        return;
      }

      toast.success('Categoria apagada.');
      setDeleteOpen(false);
    });
  }

  return (
    <div
      className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2', indented && 'pl-8')}
    >
      <span
        aria-hidden
        className="size-3 shrink-0 rounded-full border border-foreground/10"
        style={category.color === null ? undefined : { backgroundColor: category.color }}
      />

      <span className="min-w-0 flex-1 truncate text-sm font-medium">{category.name}</span>

      <span className="flex flex-wrap items-center gap-1.5">
        {category.isSystem ? <Badge variant="outline">Do sistema</Badge> : null}
        {category.internal ? (
          <Badge variant="secondary">
            <CircleOff className="size-3" aria-hidden />
            Fora dos totais
          </Badge>
        ) : null}
      </span>

      <span className="text-xs text-muted-foreground">
        {category.transactionCount === 0
          ? 'sem movimentos'
          : category.transactionCount === 1
            ? '1 movimento'
            : `${category.transactionCount} movimentos`}
      </span>

      {/* Sem esta frase, um item de menu desativado parece uma avaria. */}
      {category.isSystem || canDelete ? null : (
        <span className="w-full text-xs text-muted-foreground sm:w-auto">
          {category.transactionCount > 0
            ? 'Move os movimentos para outra categoria antes de apagar.'
            : 'Tem subcategorias: apaga-as ou move-as primeiro.'}
        </span>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className={ICON_TOUCH}
            aria-label={`Ações da categoria ${category.name}`}
          >
            <EllipsisVertical className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {indented ? null : (
            <DropdownMenuItem onSelect={() => setCreateChildOpen(true)}>
              <Plus className="size-4" aria-hidden />
              Nova subcategoria
            </DropdownMenuItem>
          )}
          <DropdownMenuItem disabled={category.isSystem} onSelect={() => setEditOpen(true)}>
            <Pencil className="size-4" aria-hidden />
            Editar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={!canDelete} onSelect={() => setDeleteOpen(true)}>
            <Trash className="size-4" aria-hidden />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CategoryDialog
        mode="edit"
        category={category}
        categories={categories}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <CategoryDialog
        mode="create"
        categories={categories}
        defaultKind={category.kind}
        defaultParentId={category.id}
        open={createChildOpen}
        onOpenChange={setCreateChildOpen}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <Trash aria-hidden />
            </AlertDialogMedia>
            <AlertDialogTitle>Apagar «{category.name}»?</AlertDialogTitle>
            <AlertDialogDescription>
              A categoria desaparece da lista. Nenhum movimento é apagado nem alterado — só é
              possível apagar categorias sem movimentos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                confirmDelete();
              }}
            >
              {pending ? 'A apagar…' : 'Apagar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Ordena por ordem explícita e, em empate, por nome. */
function sortCategories(categories: readonly CategoryView[]): CategoryView[] {
  return [...categories].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    return left.name.localeCompare(right.name, 'pt-PT');
  });
}
