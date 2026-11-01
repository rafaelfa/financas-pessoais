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
import {
  createReceivablePayable,
  updateReceivablePayable,
} from '@/server/receivable-payable-actions';
import { zodResolver } from '@/lib/zod-resolver';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
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
    error: 'Selecione o tipo de conta',
  }),
  description: z.string().min(1, 'A descrição é obrigatória').max(255, 'A descrição é muito longa'),
  amountInCents: z.number().min(1, 'O valor deve ser maior que zero'),
  dueDate: z.string().min(1, 'A data de vencimento é obrigatória'),
  categoryId: z.string().optional(),
  financialAccountId: z.string().optional(),
  note: z.string().max(500, 'A nota é muito longa').optional(),
});

type ReceivablePayableDialogProps = {
  trigger?: ReactNode;
  mode: 'create' | 'edit';
  defaultValues?: ReceivablePayableFormValues;
  accounts: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
};

export function ReceivablePayableDialog({
  trigger,
  mode,
  defaultValues,
  accounts,
  categories,
  open,
  onOpenChange,
  onClose,
}: ReceivablePayableDialogProps) {
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
  /*
   * O formulário guarda cêntimos inteiros; o campo mostra euros. Em edição o
   * valor chega em cêntimos (1234) e é lido pelo utilizador como 12,34.
   */
  /* `ui/form.tsx` não gera ids; cada instância do diálogo gera os seus. */
  const uid = useId();
  const fieldId = (name: string) => `${uid}-${name}`;

  const [amountText, setAmountText] = useState(() => {
    const initial = defaultValues?.amountInCents ?? 0;

    return initial > 0 ? centsToEuros(initial) : '';
  });

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
      const result =
        mode === 'edit' && defaultValues?.id !== undefined
          ? await updateReceivablePayable({ ...data, id: defaultValues.id })
          : await createReceivablePayable(data);

      if (!result.ok) {
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
          mode === 'create' ? 'Conta criada com sucesso.' : 'Conta atualizada com sucesso.',
      });

      setOpen(false);
      router.refresh();
      onClose?.();
    } catch (error) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Ocorreu um erro ao salvar a conta.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const title = mode === 'create' ? 'Nova Conta a Pagar/Receber' : 'Editar Conta';
  const description =
    mode === 'create'
      ? 'Registre uma conta que você precisa pagar ou que espera receber.'
      : 'Atualize os dados da conta.';
  const submitLabel = mode === 'create' ? 'Criar Conta' : 'Salvar Alterações';

  const fields = (
    <>
      <div className="space-y-2">
        <FormLabel>tipo</FormLabel>
        <div className="flex gap-4">
          <label className="flex cursor-pointer items-center space-x-2">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-y-0 space-x-3 rounded-md border p-4">
                  <FormControl>
                    <input
                      type="radio"
                      checked={field.value === 'PAYABLE'}
                      disabled={mode === 'edit'}
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

          <label className="flex cursor-pointer items-center space-x-2">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-y-0 space-x-3 rounded-md border p-4">
                  <FormControl>
                    <input
                      type="radio"
                      checked={field.value === 'RECEIVABLE'}
                      disabled={mode === 'edit'}
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

        {mode === 'edit' ? (
          <p className="text-sm text-muted-foreground">
            O tipo não pode ser alterado depois de a conta estar criada.
          </p>
        ) : null}
      </div>

      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel htmlFor={fieldId('description')}>Descrição</FormLabel>
            <FormControl>
              <Input
                id={fieldId('description')}
                placeholder="Ex: Fatura de luz, Aluguel, Salário..."
                {...field}
              />
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
              <FormLabel htmlFor={fieldId('amountInCents')}>Valor (€)</FormLabel>
              <FormControl>
                <Input
                  id={fieldId('amountInCents')}
                  inputMode="decimal"
                  placeholder="0,00"
                  value={amountText}
                  onChange={(e) => {
                    const text = e.target.value;
                    setAmountText(text);
                    field.onChange(eurosToCents(text));
                  }}
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
              <FormLabel htmlFor={fieldId('dueDate')}>Data de Vencimento</FormLabel>
              <FormControl>
                <Input id={fieldId('dueDate')} type="date" {...field} />
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
              <FormLabel htmlFor={fieldId('financialAccountId')}>
                Conta de Pagamento/Recebimento
              </FormLabel>
              <FormControl>
                <select
                  id={fieldId('financialAccountId')}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  {...field}
                  value={field.value ?? ''}
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
              <FormLabel htmlFor={fieldId('categoryId')}>Categoria</FormLabel>
              <FormControl>
                <select
                  id={fieldId('categoryId')}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  {...field}
                  value={field.value ?? ''}
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
            <FormLabel htmlFor={fieldId('note')}>Nota (opcional)</FormLabel>
            <FormControl>
              <Textarea
                id={fieldId('note')}
                placeholder="Informações adicionais sobre a conta..."
                className="resize-none"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
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

/** `1234` cêntimos → `12,34`, como o utilizador português escreve. */
function centsToEuros(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

/** `12,34` ou `12.34` → `1234` cêntimos inteiros. Texto inválido conta como zero. */
function eurosToCents(text: string): number {
  const parsed = Number(text.replace(',', '.'));

  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}
