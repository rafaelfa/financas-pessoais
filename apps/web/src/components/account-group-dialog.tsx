'use client';

import { type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import { zodResolver } from '@hookform/resolvers/zod';
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
});

type AccountGroupDialogProps = {
  children: ReactNode;
  mode: 'create' | 'edit';
  defaultValues?: AccountGroupFormValues;
  accounts: Array<{ id: string; name: string }>;
  onClose?: () => void;
};

export function AccountGroupDialog({
  children,
  mode,
  defaultValues,
  accounts,
  onClose,
}: AccountGroupDialogProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
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

  async function onSubmit(data: AccountGroupFormValues) {
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/account-group', {
        method: mode === 'create' ? 'POST' : 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao salvar o grupo');
      }

      toast({
        title: 'Sucesso!',
        description: mode === 'create' ? 'Grupo criado com sucesso.' : 'Grupo atualizado com sucesso.',
      });

      setOpen(false);
      router.refresh();
      onClose?.();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Ocorreu um erro ao salvar o grupo.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const trigger = typeof children === 'function' ? children({ open: setOpen }) : children;

  const Content = isMobile ? Drawer : Dialog;

  return (
    <Content open={open} onOpenChange={setOpen}>
      {trigger}
      <Content.Content>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Content.Header>
            <Content.Title>
              {mode === 'create' ? 'Novo Grupo de Contas' : 'Editar Grupo'}
            </Content.Title>
            <Content.Description>
              {mode === 'create' 
                ? 'Crie um grupo para consolidar várias contas em uma visualização.' 
                : 'Atualize os dados do grupo.'}
            </Content.Description>
          </Content.Header>

          <Content.Body className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Grupo</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Contas Principais, Emergência..." {...field} />
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
                  <FormLabel>Descrição (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
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
                <div className="border rounded-md p-4 max-h-40 overflow-y-auto">
                  <p className="text-sm text-muted-foreground mb-2">
                    Selecione as contas que deseja incluir neste grupo:
                  </p>
                  <div className="space-y-2">
                    {accounts.map((account) => (
                      <label key={account.id} className="flex items-center space-x-2 cursor-pointer">
                        <FormField
                          control={form.control}
                          name="accountIds"
                          render={({ field }) => {
                            const isChecked = field.value?.includes(account.id);
                            return (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={isChecked}
                                    onCheckedChange={(checked) => {
                                      const currentValue = field.value || [];
                                      if (checked) {
                                        field.onChange([...currentValue, account.id]);
                                      } else {
                                        field.onChange(
                                          currentValue.filter((id) => id !== account.id)
                                        );
                                      }
                                    }}
                                  />
                                </FormControl>
                                <div className="space-y-1">
                                  <div className="font-medium text-sm">{account.name}</div>
                                </div>
                              </FormItem>
                            );
                          }}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </Content.Body>

          <Content.Footer>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === 'create' ? 'Criar Grupo' : 'Salvar Alterações'}
              </Button>
            </div>
          </Content.Footer>
        </form>
      </Content.Content>
    </Content>
  );
}
