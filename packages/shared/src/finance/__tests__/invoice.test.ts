import { describe, expect, it } from 'vitest';

import {
  carriedOverToNextInvoice,
  invoiceDatesFor,
  invoiceTotals,
  splitInstallments,
  unpaidInvoices,
} from '../invoice';
import type { FinanceInvoice, FinanceInvoicePayment, FinanceTransaction } from '../types';

const INVOICE: FinanceInvoice = {
  id: 'inv-1',
  cardId: 'card-1',
  closingDate: '2026-10-20',
  dueDate: '2026-11-10',
  carriedOverInCents: 5_000,
};

function purchase(id: string, amountInCents: number): FinanceTransaction {
  return {
    id,
    kind: 'expense',
    status: 'confirmed',
    amountInCents: -amountInCents,
    date: '2026-10-05',
    accountId: 'acc',
    invoiceId: INVOICE.id,
    settled: false,
  };
}

describe('datas da fatura', () => {
  it('coloca a compra antes do fecho na fatura do próprio mês', () => {
    expect(invoiceDatesFor({ purchaseDate: '2026-10-05', closingDay: 20, dueDay: 10 })).toEqual({
      closingDate: '2026-10-20',
      dueDate: '2026-11-10',
    });
  });

  it('empurra a compra depois do fecho para a fatura seguinte', () => {
    expect(invoiceDatesFor({ purchaseDate: '2026-10-25', closingDay: 20, dueDay: 10 })).toEqual({
      closingDate: '2026-11-20',
      dueDate: '2026-12-10',
    });
  });

  it('vence no próprio mês quando o dia de vencimento é posterior ao do fecho', () => {
    expect(invoiceDatesFor({ purchaseDate: '2026-10-05', closingDay: 10, dueDay: 25 })).toEqual({
      closingDate: '2026-10-10',
      dueDate: '2026-10-25',
    });
  });

  it('limita ao último dia do mês quando o dia não existe', () => {
    expect(invoiceDatesFor({ purchaseDate: '2026-02-05', closingDay: 31, dueDay: 10 })).toEqual({
      closingDate: '2026-02-28',
      dueDate: '2026-03-10',
    });
  });

  it('atravessa a passagem de ano', () => {
    expect(invoiceDatesFor({ purchaseDate: '2026-12-25', closingDay: 20, dueDay: 10 })).toEqual({
      closingDate: '2027-01-20',
      dueDate: '2027-02-10',
    });
  });
});

describe('totais da fatura', () => {
  const transactions = [purchase('t1', 12_000), purchase('t2', 8_000)];

  it('soma as compras ao valor transitado da fatura anterior', () => {
    const totals = invoiceTotals({
      invoice: INVOICE,
      transactions,
      payments: [],
      today: '2026-10-05',
    });

    expect(totals.purchasesInCents).toBe(20_000);
    expect(totals.carriedOverInCents).toBe(5_000);
    expect(totals.totalInCents).toBe(25_000);
    expect(totals.outstandingInCents).toBe(25_000);
    expect(totals.status).toBe('open');
  });

  it('fica aberta até à data de fecho e fechada a partir dela', () => {
    const open = invoiceTotals({
      invoice: INVOICE,
      transactions,
      payments: [],
      today: '2026-10-19',
    });
    const closed = invoiceTotals({
      invoice: INVOICE,
      transactions,
      payments: [],
      today: '2026-10-20',
    });

    expect(open.status).toBe('open');
    expect(closed.status).toBe('closed');
  });

  it('um pagamento parcial transita o restante para a fatura seguinte', () => {
    const payments: FinanceInvoicePayment[] = [
      { invoiceId: INVOICE.id, amountInCents: 10_000, date: '2026-11-05' },
    ];
    const totals = invoiceTotals({
      invoice: INVOICE,
      transactions,
      payments,
      today: '2026-11-05',
    });

    expect(totals.paidInCents).toBe(10_000);
    expect(totals.outstandingInCents).toBe(15_000);
    expect(totals.status).toBe('closed');
    expect(carriedOverToNextInvoice(totals)).toBe(15_000);
  });

  it('um pagamento total deixa a fatura paga e a seguinte a zero', () => {
    const totals = invoiceTotals({
      invoice: INVOICE,
      transactions,
      payments: [{ invoiceId: INVOICE.id, amountInCents: 25_000, date: '2026-11-05' }],
      today: '2026-11-05',
    });

    expect(totals.outstandingInCents).toBe(0);
    expect(totals.status).toBe('paid');
    expect(carriedOverToNextInvoice(totals)).toBe(0);
  });

  it('nunca devolve um valor por pagar negativo, mesmo com pagamento a mais', () => {
    const totals = invoiceTotals({
      invoice: INVOICE,
      transactions,
      payments: [{ invoiceId: INVOICE.id, amountInCents: 30_000, date: '2026-11-05' }],
      today: '2026-11-05',
    });

    expect(totals.outstandingInCents).toBe(0);
  });

  it('ignora compras anuladas e compras de outra fatura', () => {
    const totals = invoiceTotals({
      invoice: INVOICE,
      transactions: [
        purchase('t1', 12_000),
        { ...purchase('t2', 8_000), status: 'ignored' },
        { ...purchase('t3', 9_000), invoiceId: 'outra-fatura' },
      ],
      payments: [],
      today: '2026-10-05',
    });

    expect(totals.purchasesInCents).toBe(12_000);
  });
});

describe('repartição por parcelas', () => {
  it('reparte sem perder nem inventar cêntimos', () => {
    expect(splitInstallments(10_000, 3)).toEqual([3_334, 3_333, 3_333]);
    expect(splitInstallments(100, 3)).toEqual([34, 33, 33]);
    expect(splitInstallments(12_000, 12)).toEqual(Array.from({ length: 12 }, () => 1_000));
  });

  it('a soma das parcelas é sempre exatamente o valor original', () => {
    for (const amount of [1, 2, 7, 999, 10_000, 123_457]) {
      for (const count of [1, 2, 3, 5, 7, 12, 24]) {
        const parcels = splitInstallments(amount, count);

        expect(parcels.reduce((total, value) => total + value, 0)).toBe(amount);
        expect(parcels).toHaveLength(count);
      }
    }
  });

  it('trata valores negativos pela magnitude e recusa um número de parcelas inválido', () => {
    expect(splitInstallments(-10_000, 2)).toEqual([5_000, 5_000]);
    expect(() => splitInstallments(10_000, 0)).toThrow(RangeError);
    expect(() => splitInstallments(10_000, 2.5)).toThrow(RangeError);
  });
});

describe('faturas por pagar', () => {
  it('ordena por data de vencimento e exclui as liquidadas', () => {
    const invoices: FinanceInvoice[] = [
      { id: 'inv-a', cardId: 'c', closingDate: '2026-11-20', dueDate: '2026-12-10' },
      { id: 'inv-b', cardId: 'c', closingDate: '2026-09-20', dueDate: '2026-10-10' },
      { id: 'inv-c', cardId: 'c', closingDate: '2026-10-20', dueDate: '2026-11-10' },
    ];
    const transactions: FinanceTransaction[] = [
      { ...purchase('a1', 1_000), invoiceId: 'inv-a' },
      { ...purchase('b1', 2_000), invoiceId: 'inv-b' },
      { ...purchase('c1', 3_000), invoiceId: 'inv-c' },
    ];
    const payments: FinanceInvoicePayment[] = [
      { invoiceId: 'inv-a', amountInCents: 1_000, date: '2026-12-01' },
    ];

    const unpaid = unpaidInvoices({ invoices, transactions, payments, today: '2026-10-01' });

    expect(unpaid.map((item) => item.invoiceId)).toEqual(['inv-b', 'inv-c']);
  });
});
