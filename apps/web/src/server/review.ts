import { prisma } from '@repo/db/client';

import { todayInLisbon } from '@/lib/today';
import { listInvoices } from '@/server/invoices';
import { requireUser } from '@/server/session';

/**
 * O que está por arrumar, em quatro números (T54).
 *
 * A página `/revisao` e o bloco do Painel leem **daqui**, e não cada um da sua
 * consulta: são o mesmo número mostrado em dois sítios, e duas consultas
 * parecidas divergem à primeira alteração.
 *
 * Nenhuma destas contagens corrige nada — a correção faz-se no ecrã de cada
 * coisa, e é para lá que os cartões apontam.
 */

export interface ReviewCounts {
  /** Lançamentos à espera de confirmação (`PENDING`). */
  readonly pending: number;
  /** Gastos e ganhos sem categoria, fora os ignorados. */
  readonly uncategorized: number;
  /** Contas a pagar/receber abertas com o vencimento no passado. */
  readonly overdue: number;
  /** Faturas de cartão fechadas e ainda por pagar. */
  readonly unpaidInvoices: number;
  /** A soma dos quatro. */
  readonly total: number;
}

export async function getReviewCounts(): Promise<ReviewCounts> {
  const user = await requireUser();
  const today = todayInLisbon();

  const [pending, uncategorized, overdue, invoices] = await Promise.all([
    prisma.transaction.count({ where: { userId: user.id, status: 'PENDING' } }),

    // O mesmo `where` do filtro `semCategoria=1` do extrato, para o cartão e o
    // total do extrato dizerem o mesmo número.
    prisma.transaction.count({
      where: {
        userId: user.id,
        kind: { in: ['EXPENSE', 'INCOME'] },
        categoryId: null,
        status: { not: 'IGNORED' },
      },
    }),

    /*
     * «Vencida» como a página de contas a pagar/receber a mostra: aberta e com o
     * vencimento no passado. O estado `OVERDUE` existe no esquema mas nunca é
     * gravado — contá-lo daria sempre zero enquanto a página mostra contas
     * vencidas.
     */
    prisma.receivablePayable.count({
      where: { userId: user.id, status: 'OPEN', dueDate: { lt: new Date(today) } },
    }),

    /*
     * «Fatura fechada e por pagar» vem do mesmo cálculo que a página de cartões
     * usa (`loadInvoiceContext`): o estado da fatura é **derivado** da data de
     * fecho e do que já foi pago, não lido da coluna `status`.
     */
    listInvoices(),
  ]);

  /*
   * `closed` **e** com valor por pagar. Uma fatura cujo ciclo ficou sem compras
   * também sai `closed` (o `invoiceChain` só a marca `paid` quando há total e
   * está tudo pago), mas tem `outstandingInCents: 0` — e em `/cartoes` essa linha
   * tem o botão «Paga» desativado, ou seja, não há ação que a tire daqui. Sem a
   * segunda condição o cartão dizia «1 fatura por pagar» para 0,00 €.
   */
  const unpaidInvoices = invoices.filter(
    (invoice) => invoice.status === 'closed' && invoice.outstandingInCents > 0,
  ).length;

  return {
    pending,
    uncategorized,
    overdue,
    unpaidInvoices,
    total: pending + uncategorized + overdue + unpaidInvoices,
  };
}
