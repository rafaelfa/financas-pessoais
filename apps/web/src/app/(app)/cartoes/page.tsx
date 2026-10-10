import { CreditCard } from 'lucide-react';
import type { Metadata } from 'next';

import { CardDialog } from '@/components/card-dialog';
import { CardSummary } from '@/components/card-summary';
import { EmptyState } from '@/components/empty-state';
import { InstallmentList } from '@/components/installment-list';
import { InvoiceDetailDialog, type InvoiceDetailData } from '@/components/invoice-detail-dialog';
import { InvoiceTable, type InvoiceListRow } from '@/components/invoice-table';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { todayInLisbon } from '@/lib/today';
import { listAccounts } from '@/server/accounts';
import { listCards } from '@/server/cards';
import { listInstallmentPlans } from '@/server/installments';
import { getInvoiceDetail, listInvoices } from '@/server/invoices';

export const metadata: Metadata = { title: 'Cartões' };

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Cartões, faturas e parcelamentos.
 *
 * Tudo o que aparece aqui é calculado pelo motor financeiro no servidor: o total
 * de cada fatura, o que transita de uma para a outra e o estado de cada uma. A
 * página junta as quatro consultas em paralelo e entrega os números às partes
 * cliente que precisam de interação.
 *
 * O detalhe de uma fatura abre por URL (`?fatura=<id>`) e é resolvido **aqui**,
 * porque `getInvoiceDetail` é uma consulta de servidor e não pode ser chamada a
 * partir do browser.
 */
export default async function CartoesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const today = todayInLisbon();

  const invoiceParam =
    typeof params.fatura === 'string' && params.fatura.trim() !== ''
      ? params.fatura.trim()
      : undefined;

  const [cards, invoices, plans, accounts] = await Promise.all([
    listCards(),
    listInvoices(),
    listInstallmentPlans(),
    listAccounts(),
  ]);

  /*
   * Um `?fatura=` antigo (link guardado, fatura entretanto apagada) não pode
   * derrubar o ecrã inteiro: sem detalhe, o diálogo explica que já não existe.
   */
  let detail: InvoiceDetailData | null = null;

  if (invoiceParam !== undefined) {
    try {
      detail = await getInvoiceDetail(invoiceParam);
    } catch {
      detail = null;
    }
  }

  const activeCards = cards.filter((card) => !card.archived);
  const archivedCards = cards.filter((card) => card.archived);
  const invoicesByCard = groupByCard(invoices);

  return (
    <>
      <PageHeader
        title="Cartões"
        description="Cartões geridos à mão: faturas com fecho e vencimento, o que transita de uma fatura para a seguinte e os parcelamentos ativos."
        actions={
          cards.length === 0 ? null : (
            <CardDialog
              mode="create"
              accounts={accounts}
              today={today}
              trigger={<Button size="sm">Novo cartão</Button>}
            />
          )
        }
      />

      {cards.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="Ainda não tens cartões"
          description="Acrescenta um cartão com o dia de fecho e o dia de vencimento. A partir daí, cada compra a crédito cai automaticamente na fatura certa — e a primeira fatura nasce com a primeira compra."
          action={
            <CardDialog
              mode="create"
              accounts={accounts}
              today={today}
              trigger={<Button size="sm">Criar o primeiro cartão</Button>}
            />
          }
        />
      ) : (
        <div className="space-y-10">
          {activeCards.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Todos os cartões estão arquivados. Reativa um para voltar a ver as faturas.
            </p>
          ) : (
            activeCards.map((card) => {
              const cardInvoices = invoicesByCard.get(card.id) ?? [];

              return (
                <section
                  key={card.id}
                  id={`cartao-${card.id}`}
                  aria-label={`Cartão ${card.name}`}
                  className="space-y-5"
                >
                  <CardSummary
                    card={card}
                    accounts={accounts}
                    today={today}
                    nextInvoice={nextInvoiceFor(
                      card.openInvoice?.closingDate ?? null,
                      cardInvoices,
                    )}
                  />

                  <InvoiceTable
                    cardName={card.name}
                    invoices={cardInvoices}
                    highlightInvoiceId={card.openInvoice?.id ?? null}
                    accounts={accounts}
                    today={today}
                  />
                </section>
              );
            })
          )}

          {archivedCards.length === 0 ? null : (
            <section aria-labelledby="cartoes-arquivados" className="space-y-4">
              <div className="space-y-1">
                <h2 id="cartoes-arquivados" className="font-heading text-lg font-medium">
                  Arquivados
                </h2>
                <p className="text-sm text-muted-foreground">
                  Saíram da lista, mas as faturas e os movimentos continuam guardados. Reativa um
                  para voltar a acompanhá-lo.
                </p>
              </div>

              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {archivedCards.map((card) => (
                  <li key={card.id}>
                    <CardSummary card={card} accounts={accounts} today={today} nextInvoice={null} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="parcelamentos" className="space-y-4">
            <div className="space-y-1">
              <h2 id="parcelamentos" className="font-heading text-lg font-medium">
                Parcelamentos ativos
              </h2>
              <p className="text-sm text-muted-foreground">
                Compras divididas em parcelas, uma por fatura. Um parcelamento edita-se como um
                todo: a pré-visualização mostra as parcelas e as faturas afetadas antes de guardar.
              </p>
            </div>

            <InstallmentList plans={plans} cards={cards} />
          </section>
        </div>
      )}

      {invoiceParam === undefined ? null : <InvoiceDetailDialog detail={detail} />}
    </>
  );
}

/** Faturas agrupadas por cartão. */
function groupByCard(invoices: readonly InvoiceListRow[]): Map<string, InvoiceListRow[]> {
  const byCard = new Map<string, InvoiceListRow[]>();

  for (const invoice of invoices) {
    byCard.set(invoice.cardId, [...(byCard.get(invoice.cardId) ?? []), invoice]);
  }

  return byCard;
}

/** A fatura seguinte à indicada, dentro do mesmo cartão. */
function nextInvoiceFor(
  closingDate: string | null,
  invoices: readonly InvoiceListRow[],
): { closingDate: string; dueDate: string } | null {
  if (closingDate === null) {
    return null;
  }

  const later = invoices
    .filter((invoice) => invoice.closingDate > closingDate)
    .sort((left, right) => (left.closingDate < right.closingDate ? -1 : 1));
  const next = later[0];

  return next === undefined ? null : { closingDate: next.closingDate, dueDate: next.dueDate };
}
