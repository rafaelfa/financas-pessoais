'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Amount } from '@/components/amount';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { todayInLisbon } from '@/lib/today';
import { payReceivablePayable } from '@/server/receivable-payable-actions';

/**
 * Pagamento (ou recebimento) de uma conta a pagar/receber.
 *
 * O valor não é pedido: a conta é liquidada pelo montante que já tem. O que o
 * utilizador escolhe é de onde sai (ou entra) o dinheiro, em que data, e se
 * isso deve gerar um movimento na conta.
 */

/** Alvo de toque: 44 px em telemóvel, denso a partir de `sm`. */
const TOUCH = 'min-h-11 sm:min-h-8';

export function ReceivablePayablePayDialog({
  item,
  accounts,
  open,
  onOpenChange,
}: {
  readonly item: {
    id: string;
    description: string;
    amountInCents: number;
    financialAccountId?: string | null;
  };
  readonly accounts: ReadonlyArray<{ id: string; name: string; archived?: boolean }>;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pagar «{item.description}»</DialogTitle>
          <DialogDescription>
            <Amount amountInCents={item.amountInCents} tone="neutral" /> — a conta fica paga por
            este valor.
          </DialogDescription>
        </DialogHeader>

        <PayForm item={item} accounts={accounts} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function PayForm({
  item,
  accounts,
  onDone,
}: {
  readonly item: { id: string; amountInCents: number; financialAccountId?: string | null };
  readonly accounts: ReadonlyArray<{ id: string; name: string }>;
  readonly onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  /*
   * Sem conta escolhida, o pagamento não avança: gravar o movimento numa conta
   * que o utilizador nunca escolheu seria adivinhar. A única sugestão aceitável
   * é a conta que o próprio lançamento já tinha.
   */
  const [accountId, setAccountId] = useState(() => {
    const suggested = item.financialAccountId ?? '';

    return accounts.some((account) => account.id === suggested) ? suggested : '';
  });
  const [date, setDate] = useState(() => todayInLisbon());
  const [createTransaction, setCreateTransaction] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const missingAccount = accountId === '';
  const missingDate = date === '';

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (missingAccount) {
      setFormError('Escolhe a conta por onde o dinheiro sai ou entra.');
      return;
    }

    if (missingDate) {
      setFormError('Indica a data do pagamento.');
      return;
    }

    startTransition(async () => {
      const result = await payReceivablePayable({
        id: item.id,
        financialAccountId: accountId,
        paymentDate: date,
        createTransaction,
      });

      if (!result.ok) {
        setFormError(result.error);
        toast.error(result.error);
        return;
      }

      toast.success('Conta marcada como paga.');
      onDone();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-1">
        <FieldLabel htmlFor="pagar-conta">Conta de pagamento</FieldLabel>
        <Select value={accountId} onValueChange={setAccountId} disabled={accounts.length === 0}>
          <SelectTrigger id="pagar-conta" className={`w-full ${TOUCH}`} aria-required>
            <SelectValue placeholder="Escolhe uma conta" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Não há contas. Cria uma conta antes de registar pagamentos.
          </p>
        ) : null}
      </div>

      <Field>
        <FieldLabel htmlFor="pagar-data">Data do pagamento</FieldLabel>
        <Input
          id="pagar-data"
          type="date"
          value={date}
          required
          className={TOUCH}
          onChange={(event) => setDate(event.target.value)}
        />
      </Field>

      <div className="flex items-center gap-2">
        <Checkbox
          id="pagamento-movimento"
          checked={createTransaction}
          onCheckedChange={(checked) => setCreateTransaction(checked === true)}
        />
        <Label htmlFor="pagamento-movimento" className="font-normal">
          Criar o movimento na conta
        </Label>
      </div>
      <FieldDescription>
        Desliga se o movimento já estiver registado à mão e não quiseres duplicá-lo.
      </FieldDescription>

      <FieldError>{formError}</FieldError>

      <DialogFooter>
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
          <Button
            type="submit"
            className={TOUCH}
            disabled={pending || missingAccount || missingDate || accounts.length === 0}
          >
            {pending ? 'A guardar…' : 'Confirmar pagamento'}
          </Button>
        </div>
      </DialogFooter>
    </form>
  );
}
