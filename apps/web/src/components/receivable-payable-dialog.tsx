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
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
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

type ReceivablePayableFormValues = {
  id?: string;
  type: 'PAYABLE' | 'RECEIVABLE';
  description: string;
  amountInCents: number;
  dueDate: string;
  categoryId?: string;
  financialAccountId?: string;
  tags?: string[];
  note?: string;
  status?: 'OPEN' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  action?: string;
};

const receivablePayableSchema = z.object({
  type: z.enum(['PAYABLE', 'RECEIVABLE'], {
    invalid_type_error: 'Selecione o tipo de conta',
  }),
  description: z.string().min(1, 'A descrição é obrigatória').max(255, 'A descrição é muito longa'),
  amountInCents: z.number().min(1, 'O valor deve ser maior que zero'),
  dueDate: z.string().min(1, 'A data de vencimento é obrigatória'),
  categoryId: z.string().optional(),
  financialAccountId: z.string().optional(),
  note: z.string().max(500, 'A nota é muito longa').optional(),
});

type ReceivablePayableDialogProps = {
  children: ReactNode;
  mode: 'create' | 'edit';
  defaultValues?: ReceivablePayableFormValues;
  accounts: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
  onClose?: () => void;
};

export function ReceivablePayableDialog({
  children,
  mode,
  defaultValues,
  accounts,
  categories,
  onClose,
}: ReceivablePayableDialogProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ReceivablePayableFormValues>({
    resolver: zodResolver(receivablePayableSchema),
    defaultValues: defaultValues || {
      type: 'PAYABLE',
      description: '',
      amountInCents: 0,
      dueDate: new Date().toISOString().split('T')[0],
      note: '',
    },
  });

  async function onSubmit(data: ReceivablePayableFormValues) {
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/receivable-payable', {
        method: mode === 'create' ? 'POST' : 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao salvar a conta');
      }

      toast({
        title: 'Sucesso!',
        description: mode === 'create' ? 'Conta criada com sucesso.' : 'Conta atualizada com sucesso.',
      });

      setOpen(false);
      router.refresh();
      onClose?.();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Ocorreu um erro ao salvar a conta.',
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
              {mode === 'create' ? 'Nova Conta a Pagar/Receber' : 'Editar Conta'}
            </Content.Title>
            <Content.Description>
              {mode === 'create' 
                ? 'Registre uma conta que você precisa pagar ou que espera receber.' 
                : 'Atualize os dados da conta.'}
            </Content.Description>
          </Content.Header>

          <Content.Body className="space-y-4">
            <div className="space-y-2">
              <FormLabel>tipo</FormLabel>
              <div className="flex gap-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <radio
                            checked={field.value === 'PAYABLE'}
                            onChange={() => field.onChange('PAYABLE')}
                          />
                        </FormControl>
                        <div className="space-y-1">
                          <div className="font-medium">Conta a Pagar</div>
                          <div className="text-sm text-muted-foreground">
                            Despesa que você precisa pagar
                          </div>
                        </div>
                      </FormItem>
                    )}
                  />
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <radio
                            checked={field.value === 'RECEIVABLE'}
                            onChange={() => field.onChange('RECEIVABLE')}
                          />
                        </FormControl>
                        <div className="space-y-1">
                          <div className="font-medium">Conta a Receber</div>
                          <div className="text-sm text-muted-foreground">
                            Receita que você espera receber
                          </div>
                        </div>
                      </FormItem>
                    )}
                  />
                </label>
              </div>
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Fatura de luz, Aluguel, Salário..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amountInCents"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor (€)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0,00"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) * 100)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Vencimento</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="financialAccountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conta de Pagamento/Recebimento</FormLabel>
                    <FormControl>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        {...field}
                      >
                        <option value="">Selecione uma conta</option>
                        {accounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name}
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
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria</FormLabel>
                    <FormControl>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        {...field}
                      >
                        <option value="">Selecione uma categoria</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nota (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Informações adicionais sobre a conta..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Content.Body>

          <Content.Footer>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === 'create' ? 'Criar Conta' : 'Salvar Alterações'}
              </Button>
            </div>
          </Content.Footer>
        </form>
      </Content.Content>
    </Content>
  );
}
