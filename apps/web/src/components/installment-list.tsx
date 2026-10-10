'use client';

import { CalendarDays, Pencil } from 'lucide-react';
import { useState } from 'react';

import { Amount } from '@/components/amount';
import { EmptyState } from '@/components/empty-state';
import { InstallmentEditDialog } from '@/components/installment-edit-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { CardView } from '@/server/cards';

/**
 * Planos de parcelamento ativos.
 *
 * Um parcelamento é uma decisão única (uma compra dividida em N parcelas, uma
 * por fatura) e é editado como um todo — que é precisamente o que o sistema de
 * referência não permitia.
 *
 * Vocabulário: **parcela**, não “prestação”. O glossário de `docs/spec` reserva
 * “prestação” para o passivo manual da Fase 5.
 */

/** Uma parcela já colocada numa fatura. */
export interface InstallmentInvoiceRef {
  readonly id: string;
  readonly closingDate: string;
  readonly dueDate: string;
  readonly amountInCents: number;
  readonly installmentNumber: number;
  readonly paid: boolean;
}

/** Plano de parcelamento, como o servidor o devolve. */
export interface InstallmentPlanView {
  readonly planId: string;
  readonly cardId: string;
  readonly cardName: string;
  readonly description: string;
  readonly totalAmountInCents: number;
  readonly installmentCount: number;
  readonly perInstallmentInCents: number;
  readonly firstDate: string;
  readonly nextInstallmentNumber: number;
  readonly nextInvoice: {
    readonly id: string;
    readonly closingDate: string;
    readonly dueDate: string;
    readonly amountInCents: number;
  } | null;
  readonly remainingInCents: number;
  readonly invoices: readonly InstallmentInvoiceRef[];
}

/** Alvo de toque: 44 px em telemóvel, denso a partir de `sm`. */
const TOUCH = 'min-h-11 sm:min-h-8';

export function InstallmentList({
  plans,
  cards,
}: {
  readonly plans: readonly InstallmentPlanView[];
  readonly cards: readonly CardView[];
}) {
  if (plans.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Ainda não há parcelamentos ativos"
        description="Um parcelamento nasce quando registas uma compra dividida em várias parcelas: cada parcela cai numa fatura, e o plano fica aqui para poderes corrigi-lo."
      />
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descrição</TableHead>
              <TableHead className="hidden sm:table-cell">Cartão</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Parcelas</TableHead>
              <TableHead className="hidden text-right md:table-cell">Cada</TableHead>
              <TableHead className="hidden md:table-cell">Próxima parcela</TableHead>
              <TableHead className="text-right">Por pagar</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {plans.map((plan) => (
              <InstallmentRow
                key={plan.planId}
                plan={plan}
                card={cards.find((candidate) => candidate.id === plan.cardId)}
              />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function InstallmentRow({
  plan,
  card,
}: {
  readonly plan: InstallmentPlanView;
  readonly card: CardView | undefined;
}) {
  const [editOpen, setEditOpen] = useState(false);

  /*
   * O servidor recusa reescrever um plano que já tenha faturas com pagamentos —
   * mudaria valores que o utilizador já confirmou com o banco. Isso fica visível
   * aqui antes de tentar: o botão desativa-se e a razão está escrita na linha.
   */
  const hasPaidInstallments = plan.invoices.some((invoice) => invoice.paid);

  return (
    <TableRow>
      <TableCell className="max-w-[16rem] whitespace-normal">
        <span className="block truncate font-medium">{displayDescription(plan.description)}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground md:hidden">
          {plan.nextInvoice === null
            ? 'Sem próxima parcela'
            : `#${plan.nextInstallmentNumber} de ${plan.installmentCount} · ${formatDay(plan.nextInvoice.closingDate)} → ${formatDay(plan.nextInvoice.dueDate)}`}
        </span>
      </TableCell>

      <TableCell className="hidden sm:table-cell">{plan.cardName}</TableCell>

      <TableCell className="text-right font-medium">
        <Amount amountInCents={plan.totalAmountInCents} tone="neutral" />
      </TableCell>

      <TableCell className="text-right">
        <span className="font-numeric tabular-nums">
          {`${Math.min(plan.nextInstallmentNumber, plan.installmentCount)} de ${plan.installmentCount}`}
        </span>
      </TableCell>

      <TableCell className="hidden text-right md:table-cell">
        <Amount
          amountInCents={plan.perInstallmentInCents}
          tone="neutral"
          className="text-muted-foreground"
        />
      </TableCell>

      <TableCell className="hidden md:table-cell">
        {plan.nextInvoice === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className="flex flex-col">
            <span>
              #{plan.nextInstallmentNumber} ·{' '}
              <Amount amountInCents={plan.nextInvoice.amountInCents} tone="neutral" />
            </span>
            <span className="text-xs text-muted-foreground">
              fecha {formatDay(plan.nextInvoice.closingDate)} · vence{' '}
              {formatDay(plan.nextInvoice.dueDate)}
            </span>
          </span>
        )}
      </TableCell>

      <TableCell className="text-right">
        <Amount amountInCents={plan.remainingInCents} tone="neutral" />
      </TableCell>

      <TableCell className="text-right">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={TOUCH}
          disabled={hasPaidInstallments}
          onClick={() => setEditOpen(true)}
          aria-label={`Editar o parcelamento ${displayDescription(plan.description)}`}
        >
          <Pencil className="size-3.5" aria-hidden />
          Editar
        </Button>

        {hasPaidInstallments ? (
          <span className="mt-1 block text-xs text-muted-foreground">
            Já tem parcelas em faturas pagas: não se reescreve. Elimina as parcelas e cria um plano
            novo.
          </span>
        ) : null}

        {card === undefined ? (
          <span className="mt-1 block text-xs text-muted-foreground">
            Cartão não encontrado: sem pré-visualização de faturas.
          </span>
        ) : null}

        {editOpen && !hasPaidInstallments ? (
          <InstallmentEditDialog
            plan={{
              planId: plan.planId,
              cardName: plan.cardName,
              description: plan.description,
              totalAmountInCents: plan.totalAmountInCents,
              installmentCount: plan.installmentCount,
              perInstallmentInCents: plan.perInstallmentInCents,
              firstDate: plan.firstDate,
            }}
            closingDay={card?.closingDay ?? null}
            dueDay={card?.dueDay ?? null}
            open
            onOpenChange={(open) => {
              if (!open) {
                setEditOpen(false);
              }
            }}
          />
        ) : null}
      </TableCell>
    </TableRow>
  );
}

/** Descrição legível, mesmo quando o campo está vazio. */
function displayDescription(description: string): string {
  return description.trim() === '' ? 'Sem descrição' : description;
}

/** Data de calendário em formato curto, sem deslocação de fuso. */
function formatDay(date: string): string {
  return new Intl.DateTimeFormat('pt-PT', { timeZone: 'UTC', dateStyle: 'short' }).format(
    new Date(`${date}T00:00:00Z`),
  );
}
