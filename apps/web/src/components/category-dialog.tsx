'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createCategory, updateCategory } from '@/server/categories-actions';
import type { CategoryView } from '@/server/categories';
import { toFieldErrors } from '@/server/result';
import { createCategorySchema, updateCategorySchema } from '@repo/shared/schemas/domain';
import { cn } from '@/lib/utils';

/**
 * Criação e edição de categorias.
 *
 * A **natureza** (gasto ou ganho) decide-se na criação e não muda: uma
 * categoria que já classificou movimentos de gasto não pode passar a ganho sem
 * reescrever a leitura de meses anteriores.
 *
 * As categorias de **sistema** não passam por aqui — o cartão da lista nem
 * oferece a ação, e o servidor também as recusaria.
 */

/** Nome legível de cada natureza, com recurso ao valor. */
export const CATEGORY_KIND_LABELS: Readonly<Record<string, string>> = {
  expense: 'Gasto',
  income: 'Ganho',
};

/**
 * Cores de partida.
 *
 * São pontos de partida, não uma paleta fechada: o campo permite qualquer
 * `#RRGGBB` e o seletor nativo do sistema dá acesso ao resto.
 */
export const CATEGORY_COLOR_PRESETS: readonly { value: string; label: string }[] = [
  { value: '#0f766e', label: 'Verde-água' },
  { value: '#1d4ed8', label: 'Azul' },
  { value: '#7c3aed', label: 'Violeta' },
  { value: '#b45309', label: 'Âmbar' },
  { value: '#15803d', label: 'Verde' },
  { value: '#be123c', label: 'Rosa' },
];

/** Cor proposta quando a categoria ainda não tem nenhuma. */
const DEFAULT_CATEGORY_COLOR = '#0f766e';

/** Alvo de toque: 44 px em telemóvel, denso a partir de `sm`. */
const TOUCH = 'min-h-11 sm:min-h-8';

export function CategoryDialog({
  mode,
  category,
  categories,
  defaultKind = 'expense',
  defaultParentId,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  readonly mode: 'create' | 'edit';
  readonly category?: CategoryView;
  /** Todas as categorias, para escolher a mãe e evitar ciclos. */
  readonly categories: readonly CategoryView[];
  readonly defaultKind?: 'expense' | 'income';
  readonly defaultParentId?: string;
  readonly trigger?: React.ReactNode;
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger === undefined ? null : <DialogTrigger asChild>{trigger}</DialogTrigger>}

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create'
              ? defaultParentId === undefined
                ? 'Nova categoria'
                : 'Nova subcategoria'
              : 'Editar categoria'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Uma categoria por assunto. As subcategorias servem para detalhar sem perder o total do conjunto.'
              : 'Muda o nome, a cor, a ordem ou a categoria-mãe.'}
          </DialogDescription>
        </DialogHeader>

        <CategoryForm
          mode={mode}
          category={category}
          categories={categories}
          defaultKind={defaultKind}
          defaultParentId={defaultParentId}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function CategoryForm({
  mode,
  category,
  categories,
  defaultKind,
  defaultParentId,
  onDone,
}: {
  readonly mode: 'create' | 'edit';
  readonly category?: CategoryView;
  readonly categories: readonly CategoryView[];
  readonly defaultKind: 'expense' | 'income';
  readonly defaultParentId?: string;
  readonly onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(category?.name ?? '');
  const [kind, setKind] = useState<'expense' | 'income'>(category?.kind ?? defaultKind);
  const [parentId, setParentId] = useState<string>(category?.parentId ?? defaultParentId ?? '');
  const [color, setColor] = useState<string | null>(category?.color ?? null);
  const [pickerColor, setPickerColor] = useState(category?.color ?? DEFAULT_CATEGORY_COLOR);
  const [sortOrder, setSortOrder] = useState(String(category?.sortOrder ?? 0));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function errorFor(field: string): string | undefined {
    return fieldErrors[field]?.[0];
  }

  /**
   * Categorias-mãe possíveis: raízes do mesmo tipo, sem a própria categoria e
   * sem os seus filhos diretos (uma categoria não pode ser neta de si própria).
   */
  const parentOptions = categories.filter(
    (candidate) =>
      candidate.kind === kind &&
      candidate.parentId === null &&
      candidate.id !== category?.id &&
      candidate.parentId !== category?.id,
  );

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const base = {
      name: name.trim(),
      parentId: parentId === '' ? null : parentId,
      color,
      sortOrder: Number(sortOrder === '' ? 0 : sortOrder),
    };

    const payload = mode === 'create' ? { ...base, kind } : { ...base, id: category?.id ?? '' };

    const parsed =
      mode === 'create'
        ? createCategorySchema.safeParse(payload)
        : updateCategorySchema.safeParse(payload);

    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      return;
    }

    startTransition(async () => {
      const result =
        mode === 'create' ? await createCategory(parsed.data) : await updateCategory(parsed.data);

      if (!result.ok) {
        setFormError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }

      toast.success(mode === 'create' ? 'Categoria criada.' : 'Categoria atualizada.');
      onDone();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field data-invalid={errorFor('name') !== undefined}>
        <FieldLabel htmlFor="categoria-nome">Nome</FieldLabel>
        <Input
          id="categoria-nome"
          value={name}
          required
          autoComplete="off"
          className={TOUCH}
          aria-invalid={errorFor('name') !== undefined}
          aria-describedby={errorFor('name') === undefined ? undefined : 'categoria-nome-erro'}
          onChange={(event) => setName(event.target.value)}
        />
        <FieldError id="categoria-nome-erro">{errorFor('name')}</FieldError>
      </Field>

      {mode === 'create' ? (
        <div className="space-y-1">
          <Label htmlFor="categoria-tipo">Natureza</Label>
          <Select
            value={kind}
            onValueChange={(next) => {
              setKind(next === 'income' ? 'income' : 'expense');
              setParentId('');
            }}
          >
            <SelectTrigger id="categoria-tipo" className={`w-full ${TOUCH}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="expense">Gasto</SelectItem>
              <SelectItem value="income">Ganho</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            Decide-se agora e não muda: os movimentos já classificados deixariam de fazer sentido.
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          <span className="text-sm font-medium">Natureza</span>
          <p className="text-sm text-muted-foreground">
            {CATEGORY_KIND_LABELS[kind] ?? kind} — não se altera depois de criada.
          </p>
        </div>
      )}

      <div className="space-y-1">
        <Label htmlFor="categoria-mae">Categoria-mãe</Label>
        <Select
          value={parentId === '' ? '__sem_mae__' : parentId}
          onValueChange={(next) => setParentId(next === '__sem_mae__' ? '' : next)}
        >
          <SelectTrigger id="categoria-mae" className={`w-full ${TOUCH}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__sem_mae__">Sem mãe (categoria principal)</SelectItem>
            {parentOptions.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          Só categorias principais do mesmo tipo podem ser mães.
        </p>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Cor</legend>
        <div role="radiogroup" aria-label="Cor da categoria" className="flex flex-wrap gap-2">
          {CATEGORY_COLOR_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              role="radio"
              aria-checked={color === preset.value}
              aria-label={preset.label}
              onClick={() => {
                setColor(preset.value);
                setPickerColor(preset.value);
              }}
              className={cn(
                'size-11 rounded-lg border-2 sm:size-8',
                color === preset.value ? 'border-foreground' : 'border-transparent',
              )}
              style={{ backgroundColor: preset.value }}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Label htmlFor="categoria-cor" className="text-sm font-normal">
            Outra cor
          </Label>
          <input
            id="categoria-cor"
            type="color"
            value={pickerColor}
            className="h-11 w-14 cursor-pointer rounded-lg border bg-transparent sm:h-8"
            onChange={(event) => {
              setPickerColor(event.target.value);
              setColor(event.target.value);
            }}
          />
          <span className="font-numeric text-sm text-muted-foreground">{color ?? 'sem cor'}</span>
          {color === null ? null : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={TOUCH}
              onClick={() => setColor(null)}
            >
              Remover a cor
            </Button>
          )}
        </div>

        <FieldError id="categoria-cor-erro">{errorFor('color')}</FieldError>
      </fieldset>

      <Field data-invalid={errorFor('sortOrder') !== undefined}>
        <FieldLabel htmlFor="categoria-ordem">Ordem</FieldLabel>
        <Input
          id="categoria-ordem"
          type="number"
          inputMode="numeric"
          min={0}
          max={9999}
          value={sortOrder}
          className={TOUCH}
          aria-invalid={errorFor('sortOrder') !== undefined}
          aria-describedby={
            errorFor('sortOrder') === undefined ? undefined : 'categoria-ordem-erro'
          }
          onChange={(event) => setSortOrder(event.target.value)}
        />
        <FieldDescription>Números menores aparecem primeiro dentro do mesmo tipo.</FieldDescription>
        <FieldError id="categoria-ordem-erro">{errorFor('sortOrder')}</FieldError>
      </Field>

      {formError === null ? null : (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          className={TOUCH}
          disabled={pending}
          onClick={onDone}
        >
          Cancelar
        </Button>
        <Button type="submit" className={TOUCH} disabled={pending}>
          {pending ? 'A guardar…' : mode === 'create' ? 'Criar categoria' : 'Guardar alterações'}
        </Button>
      </div>
    </form>
  );
}
