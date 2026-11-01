'use client';

import { type ReactNode, useId } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { createAccountGroup, updateAccountGroup } from '@/server/account-group-actions';
import { zodResolver } from '@/lib/zod-resolver';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

type AccountGroupFormValues = {
  id?: string;
  name: string;
  description?: string;
  accountIds?: string[];
};

const accountGroupSchema = z.object({
  name: z.string().min(1, 'O nome é obrigatório').max(100, 'O nome é muito longo'),
  description: z.string().max(500, 'A descrição é muito longa').optional(),
  accountIds: z.array(z.string()).optional(),
});

type AccountGroupDialogProps = {
  trigger?: ReactNode;
  mode: 'create' | 'edit';
  defaultValues?: AccountGroupFormValues;
  accounts: Array<{ id: string; name: string }>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
};

export function AccountGroupDialog({
  trigger,
  mode,
  defaultValues,
  accounts,
  open,
  onOpenChange,
  onClose,
}: AccountGroupDialogProps) {
  const isMobile = useIsMobile();
  const [openState, setOpenState] = useState(false);
  const isOpen = open ?? openState;
  const setOpen = (next: boolean) => {
    setOpenState(next);
    onOpenChange?.(next);
  };
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<AccountGroupFormValues>({
    resolver: zodResolver(accountGroupSchema),
    defaultValues: defaultValues || {
      name: '',
      description: '',
    },
  });

  /* `ui/form.tsx` não gera ids; cada instância do diálogo gera os seus. */
  const uid = useId();
  const fieldId = (name: string) => `${uid}-${name}`;

  /** Põe os erros do servidor no campo que os originou, não só no toast. */
  function applyFieldErrors(fieldErrors?: Record<string, string[]>) {
    for (const field of ['name', 'description', 'accountIds'] as const) {
      const message = fieldErrors?.[field]?.[0];

      if (message !== undefined) {
        form.setError(field, { type: 'server', message });
      }
    }
  }

  async function onSubmit(data: AccountGroupFormValues) {
    setIsSubmitting(true);

    try {
      const result =
        mode === 'edit' && defaultValues?.id !== undefined
          ? await updateAccountGroup({ ...data, id: defaultValues.id })
          : await createAccountGroup(data);

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
        description:
          mode === 'create' ? 'Grupo criado com sucesso.' : 'Grupo atualizado com sucesso.',
      });

      setOpen(false);
      router.refresh();
      onClose?.();
    } catch (error) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Ocorreu um erro ao salvar o grupo.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const title = mode === 'create' ? 'Novo Grupo de Contas' : 'Editar Grupo';
  const description =
    mode === 'create'
      ? 'Crie um grupo para consolidar várias contas em uma visualização.'
      : 'Atualize os dados do grupo.';
  const submitLabel = mode === 'create' ? 'Criar Grupo' : 'Salvar Alterações';

  const fields = (
    <>
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel htmlFor={fieldId('name')}>Nome do Grupo</FormLabel>
            <FormControl>
              <Input
                id={fieldId('name')}
                placeholder="Ex: Contas Principais, Emergência..."
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel htmlFor={fieldId('description')}>Descrição (opcional)</FormLabel>
            <FormControl>
              <Textarea
                id={fieldId('description')}
                placeholder="Descreva o propósito deste grupo..."
                className="resize-none"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {accounts.length > 0 && (
        <div className="space-y-2">
          <FormLabel>Adicionar Contas ao Grupo</FormLabel>
          {/* Um único campo para todas as caixas: um erro só, no sítio certo. */}
          <FormField
            control={form.control}
            name="accountIds"
            render={({ field }) => (
              <FormItem>
                <div className="max-h-40 overflow-y-auto rounded-md border p-4">
                  <p className="mb-2 text-sm text-muted-foreground">
                    Selecione as contas que deseja incluir neste grupo:
                  </p>
                  <div className="space-y-2">
                    {accounts.map((account) => {
                      const currentValue = field.value ?? [];

                      return (
                        <label
                          key={account.id}
                          className="flex cursor-pointer items-center space-x-2"
                        >
                          <Checkbox
                            checked={currentValue.includes(account.id)}
                            onCheckedChange={(checked) => {
                              field.onChange(
                                checked === true
                                  ? [...currentValue, account.id]
                                  : currentValue.filter((id) => id !== account.id),
                              );
                            }}
                          />
                          <span className="text-sm font-medium">{account.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
    </>
  );

  const actions = (
    <div className="flex justify-end space-x-2">
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

            <div className="space-y-4">{fields}</div>

            <DrawerFooter>{actions}</DrawerFooter>
          </form>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger === undefined ? null : <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-md">
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">{fields}</div>

          <DialogFooter>{actions}</DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
