'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type ReactNode, useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { MoneyInput } from '@/components/money-input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import { zodResolver } from '@/lib/zod-resolver';
import { createAsset, updateAsset } from '@/server/patrimonio-actions';
import { createAssetSchema } from '@repo/shared';

type AssetFormValues = z.infer<typeof createAssetSchema>;

export const ASSET_TYPE_LABELS: Record<string, string> = {
  VEHICLE: 'Veículo',
  PROPERTY: 'Imóvel',
  OTHER: 'Outro',
};

export function AssetDialog({
  mode,
  asset,
  trigger,
  open,
  onOpenChange,
  onClose,
}: {
  readonly mode: 'create' | 'edit';
  readonly asset?: {
    id: string;
    type: AssetFormValues['type'];
    name: string;
    description: string | null;
    valueInCents: number;
    acquiredOn: string | null;
    valuedOn: string | null;
  };
  readonly trigger?: ReactNode;
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  readonly onClose?: () => void;
}) {
  const isMobile = useIsMobile();
  const [openState, setOpenState] = useState(false);
  const isOpen = open ?? openState;
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const uid = useId();
  const fieldId = (name: string) => `${uid}-${name}`;

  const valoresIniciais: AssetFormValues = {
    type: asset?.type ?? 'OTHER',
    name: asset?.name ?? '',
    description: asset?.description ?? '',
    valueInCents: asset?.valueInCents ?? 0,
    acquiredOn: asset?.acquiredOn ?? undefined,
    valuedOn: asset?.valuedOn ?? undefined,
  };

  const form = useForm<AssetFormValues>({
    resolver: zodResolver(createAssetSchema),
    defaultValues: valoresIniciais,
  });

  const setOpen = (next: boolean) => {
    if (!next) {
      form.reset(valoresIniciais);
    }

    setOpenState(next);
    onOpenChange?.(next);
  };

  /** Põe os erros do servidor no campo que os originou, não só no toast. */
  function applyFieldErrors(fieldErrors?: Record<string, string[]>) {
    for (const field of [
      'type',
      'name',
      'description',
      'valueInCents',
      'acquiredOn',
      'valuedOn',
    ] as const) {
      const message = fieldErrors?.[field]?.[0];

      if (message !== undefined) {
        form.setError(field, { type: 'server', message });
      }
    }
  }

  async function onSubmit(data: AssetFormValues) {
    setIsSubmitting(true);

    try {
      const limpo = {
        type: data.type,
        name: data.name,
        description: data.description === '' ? undefined : data.description,
        valueInCents: data.valueInCents,
        acquiredOn: data.acquiredOn,
        valuedOn: data.valuedOn,
      };

      const result =
        mode === 'edit' && asset !== undefined
          ? await updateAsset({ ...limpo, id: asset.id })
          : await createAsset(limpo);

      if (!result.ok) {
        applyFieldErrors(result.fieldErrors);
        toast({
          title: 'Não foi possível guardar',
          description: result.error,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Guardado',
        description: mode === 'create' ? 'Bem registado.' : 'Bem atualizado.',
      });

      setOpen(false);
      router.refresh();
      onClose?.();
    } catch (error) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Ocorreu um erro ao guardar o bem.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const title = mode === 'create' ? 'Novo bem' : 'Editar bem';
  const description =
    mode === 'create'
      ? 'Casas, carros e o que mais tiveres: entra no património líquido pelo valor que lhe deres hoje.'
      : 'Atualiza o valor quando reavaliares. O património líquido acompanha.';
  const submitLabel = mode === 'create' ? 'Registar bem' : 'Guardar alterações';

  const fields = (
    <>
      <FormField
        control={form.control}
        name="type"
        render={({ field }) => (
          <FormItem>
            <FormLabel htmlFor={fieldId('type')}>Tipo</FormLabel>
            <FormControl>
              <select
                id={fieldId('type')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                {...field}
              >
                {Object.entries(ASSET_TYPE_LABELS).map(([valor, etiqueta]) => (
                  <option key={valor} value={valor}>
                    {etiqueta}
                  </option>
                ))}
              </select>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel htmlFor={fieldId('name')}>Nome</FormLabel>
            <FormControl>
              <Input id={fieldId('name')} placeholder="Ex.: Casa da praia" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="valueInCents"
        render={({ field }) => (
          <FormItem>
            <FormLabel htmlFor={fieldId('valueInCents')}>Valor atual</FormLabel>
            <FormControl>
              <MoneyInput
                id={fieldId('valueInCents')}
                valueInCents={field.value ?? 0}
                onValueChange={(cents) => field.onChange(cents ?? 0)}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="acquiredOn"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor={fieldId('acquiredOn')}>Adquirido em</FormLabel>
              <FormControl>
                <Input
                  id={fieldId('acquiredOn')}
                  type="date"
                  value={field.value ?? ''}
                  onBlur={field.onBlur}
                  onChange={(event) =>
                    field.onChange(event.target.value === '' ? undefined : event.target.value)
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="valuedOn"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor={fieldId('valuedOn')}>Avaliado em</FormLabel>
              <FormControl>
                <Input
                  id={fieldId('valuedOn')}
                  type="date"
                  value={field.value ?? ''}
                  onBlur={field.onBlur}
                  onChange={(event) =>
                    field.onChange(event.target.value === '' ? undefined : event.target.value)
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel htmlFor={fieldId('description')}>Nota (opcional)</FormLabel>
            <FormControl>
              <Textarea
                id={fieldId('description')}
                className="resize-none"
                placeholder="Ex.: avaliação de 2026, herança, etc."
                {...field}
                value={field.value ?? ''}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );

  const actions = (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button type="button" variant="outline" onClick={() => setOpen(false)}>
        Cancelar
      </Button>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {submitLabel}
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={setOpen}>
        {trigger === undefined ? null : <DrawerTrigger asChild>{trigger}</DrawerTrigger>}
        <DrawerContent>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DrawerHeader>
              <DrawerTitle>{title}</DrawerTitle>
              <DrawerDescription>{description}</DrawerDescription>
            </DrawerHeader>

            <div className="space-y-4 p-4">{fields}</div>

            <DrawerFooter>{actions}</DrawerFooter>
          </form>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger === undefined ? null : <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          {fields}

          <DialogFooter>{actions}</DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
