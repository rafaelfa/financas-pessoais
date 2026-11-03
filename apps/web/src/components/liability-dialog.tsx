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
import { useToast } from '@/components/ui/use-toast';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import { zodResolver } from '@/lib/zod-resolver';
import { createLiability, updateLiability } from '@/server/patrimonio-actions';
import { createLiabilitySchema } from '@repo/shared';

type LiabilityFormValues = z.infer<typeof createLiabilitySchema>;

export const LIABILITY_TYPE_LABELS: Record<string, string> = {
  LOAN: 'Empréstimo',
  MORTGAGE: 'Crédito habitação',
  CREDIT_LINE: 'Linha de crédito',
  OTHER: 'Outra',
};

/** A taxa viaja em pontos base; o campo mostra e lê percentagem. */
const basisPointsParaTexto = (basisPoints: number | null | undefined): string =>
  basisPoints === null || basisPoints === undefined
    ? ''
    : (basisPoints / 100).toFixed(2).replace('.', ',');

const textoParaBasisPoints = (texto: string): number | undefined => {
  if (texto.trim() === '') {
    return undefined;
  }

  const valor = Number(texto.replace(',', '.'));

  return Number.isFinite(valor) ? Math.round(valor * 100) : undefined;
};

export function LiabilityDialog({
  mode,
  liability,
  trigger,
  open,
  onOpenChange,
  onClose,
}: {
  readonly mode: 'create' | 'edit';
  readonly liability?: {
    id: string;
    type: LiabilityFormValues['type'];
    name: string;
    creditor: string | null;
    principalInCents: number;
    outstandingInCents: number;
    interestRateBasisPoints: number | null;
    totalInstallments: number | null;
    remainingInstallments: number | null;
    installmentAmountInCents: number | null;
    startDate: string | null;
    endDate: string | null;
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

  const [taxaTexto, setTaxaTexto] = useState(() =>
    basisPointsParaTexto(liability?.interestRateBasisPoints),
  );

  const valoresIniciais: LiabilityFormValues = {
    type: liability?.type ?? 'LOAN',
    name: liability?.name ?? '',
    creditor: liability?.creditor ?? '',
    principalInCents: liability?.principalInCents ?? 0,
    outstandingInCents: liability?.outstandingInCents ?? 0,
    interestRateBasisPoints: liability?.interestRateBasisPoints ?? undefined,
    totalInstallments: liability?.totalInstallments ?? undefined,
    remainingInstallments: liability?.remainingInstallments ?? undefined,
    installmentAmountInCents: liability?.installmentAmountInCents ?? undefined,
    startDate: liability?.startDate ?? undefined,
    endDate: liability?.endDate ?? undefined,
  };

  const form = useForm<LiabilityFormValues>({
    resolver: zodResolver(createLiabilitySchema),
    defaultValues: valoresIniciais,
  });

  const setOpen = (next: boolean) => {
    if (!next) {
      form.reset(valoresIniciais);
      setTaxaTexto(basisPointsParaTexto(liability?.interestRateBasisPoints));
    }

    setOpenState(next);
    onOpenChange?.(next);
  };

  /** Põe os erros do servidor no campo que os originou, não só no toast. */
  function applyFieldErrors(fieldErrors?: Record<string, string[]>) {
    for (const field of [
      'type',
      'name',
      'creditor',
      'principalInCents',
      'outstandingInCents',
      'interestRateBasisPoints',
      'totalInstallments',
      'remainingInstallments',
      'installmentAmountInCents',
      'startDate',
      'endDate',
    ] as const) {
      const message = fieldErrors?.[field]?.[0];

      if (message !== undefined) {
        form.setError(field, { type: 'server', message });
      }
    }
  }

  async function onSubmit(data: LiabilityFormValues) {
    setIsSubmitting(true);

    try {
      const limpo = {
        type: data.type,
        name: data.name,
        creditor: data.creditor === '' ? undefined : data.creditor,
        principalInCents: data.principalInCents,
        outstandingInCents: data.outstandingInCents,
        interestRateBasisPoints: data.interestRateBasisPoints,
        totalInstallments: data.totalInstallments,
        remainingInstallments: data.remainingInstallments,
        installmentAmountInCents: data.installmentAmountInCents,
        startDate: data.startDate,
        endDate: data.endDate,
      };

      const result =
        mode === 'edit' && liability !== undefined
          ? await updateLiability({ ...limpo, id: liability.id })
          : await createLiability(limpo);

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
        description: mode === 'create' ? 'Dívida registada.' : 'Dívida atualizada.',
      });

      setOpen(false);
      router.refresh();
      onClose?.();
    } catch (error) {
      toast({
        title: 'Erro',
        description:
          error instanceof Error ? error.message : 'Ocorreu um erro ao guardar a dívida.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const title = mode === 'create' ? 'Nova dívida' : 'Editar dívida';
  const description =
    mode === 'create'
      ? 'Empréstimos e créditos que ainda deves. O saldo em dívida é o que conta para o património líquido.'
      : 'Atualiza o saldo em dívida quando fizeres um pagamento. O património acompanha.';
  const submitLabel = mode === 'create' ? 'Registar dívida' : 'Guardar alterações';

  const numeroOuIndefinido = (texto: string): number | undefined => {
    if (texto.trim() === '') {
      return undefined;
    }

    const valor = Number(texto);

    return Number.isFinite(valor) ? valor : undefined;
  };

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
                {Object.entries(LIABILITY_TYPE_LABELS).map(([valor, etiqueta]) => (
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

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor={fieldId('name')}>Nome</FormLabel>
              <FormControl>
                <Input id={fieldId('name')} placeholder="Ex.: Crédito do carro" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="creditor"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor={fieldId('creditor')}>Credor (opcional)</FormLabel>
              <FormControl>
                <Input
                  id={fieldId('creditor')}
                  placeholder="Ex.: Millennium bcp"
                  {...field}
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="principalInCents"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor={fieldId('principalInCents')}>Capital inicial</FormLabel>
              <FormControl>
                <MoneyInput
                  id={fieldId('principalInCents')}
                  valueInCents={field.value ?? 0}
                  onValueChange={(cents) => field.onChange(cents ?? 0)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="outstandingInCents"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor={fieldId('outstandingInCents')}>Saldo em dívida</FormLabel>
              <FormControl>
                <MoneyInput
                  id={fieldId('outstandingInCents')}
                  valueInCents={field.value ?? 0}
                  onValueChange={(cents) => field.onChange(cents ?? 0)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <FormField
          control={form.control}
          name="interestRateBasisPoints"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor={fieldId('taxa')}>Taxa anual (%)</FormLabel>
              <FormControl>
                <Input
                  id={fieldId('taxa')}
                  inputMode="decimal"
                  placeholder="3,50"
                  value={taxaTexto}
                  onBlur={field.onBlur}
                  onChange={(event) => {
                    setTaxaTexto(event.target.value);
                    field.onChange(textoParaBasisPoints(event.target.value));
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="totalInstallments"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor={fieldId('totalInstallments')}>Prestações</FormLabel>
              <FormControl>
                <Input
                  id={fieldId('totalInstallments')}
                  inputMode="numeric"
                  placeholder="120"
                  value={field.value ?? ''}
                  onBlur={field.onBlur}
                  onChange={(event) => field.onChange(numeroOuIndefinido(event.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="remainingInstallments"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor={fieldId('remainingInstallments')}>A faltar</FormLabel>
              <FormControl>
                <Input
                  id={fieldId('remainingInstallments')}
                  inputMode="numeric"
                  placeholder="48"
                  value={field.value ?? ''}
                  onBlur={field.onBlur}
                  onChange={(event) => field.onChange(numeroOuIndefinido(event.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="installmentAmountInCents"
        render={({ field }) => (
          <FormItem>
            <FormLabel htmlFor={fieldId('installmentAmountInCents')}>
              Prestação mensal (opcional)
            </FormLabel>
            <FormControl>
              <MoneyInput
                id={fieldId('installmentAmountInCents')}
                valueInCents={field.value ?? 0}
                onValueChange={(cents) => field.onChange(cents ?? undefined)}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="startDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor={fieldId('startDate')}>Início</FormLabel>
              <FormControl>
                <Input
                  id={fieldId('startDate')}
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
          name="endDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor={fieldId('endDate')}>Fim</FormLabel>
              <FormControl>
                <Input
                  id={fieldId('endDate')}
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
      <DialogContent className="sm:max-w-2xl">
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
