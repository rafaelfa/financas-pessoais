import { describe, expect, it } from 'vitest';

import { invoiceChain, totalOutstandingByCard } from '../invoice';
import type { FinanceInvoice, FinanceInvoicePayment, FinanceTransaction } from '../types';

/**
 * Cadeia de faturas.
 *
 * É aqui que um pagamento parcial deixa de ser um número guardado e passa a ser
 * um valor derivado. O que estes testes protegem é uma frase: **pagar parte de
 * uma fatura antiga tem de fazer o resto transitar, e tem de se refletir em
 * todas as faturas seguintes** — sem tocar em nenhuma delas à mão.
 */

function invoice(id: string, closingDate: string, dueDate: string): FinanceInvoice {
  return { id, cardId: 'card-1', closingDate, dueDate };
}

function purchase(id: string, invoiceId: string, amountInCents: number): FinanceTransaction {
  return {
    id,
    kind: 'expense',
    status: 'confirmed',
    amountInCents: -amountInCents,
    date: '2026-10-05',
    accountId: 'acc-1',
    categoryId: 'cat-food',
    invoiceId,
    settled: false,
  };
}

function payment(
  invoiceId: string,
  amountInCents: number,
  transactionId?: string,
): FinanceInvoicePayment {
  return { invoiceId, amountInCents, date: '2026-11-05', transactionId };
}

const OCTOBER = invoice('inv-oct', '2026-10-20', '2026-11-10');
const NOVEMBER = invoice('inv-nov', '2026-11-20', '2026-12-10');
const DECEMBER = invoice('inv-dec', '2026-12-20', '2027-01-10');

describe('cadeia de faturas', () => {
  it('ordena por data de fecho, independentemente da ordem recebida', () => {
    const chain = invoiceChain({
      invoices: [DECEMBER, OCTOBER, NOVEMBER],
      transactions: [],
      payments: [],
      today: '2026-10-01',
    });

    expect(chain.map((entry) => entry.invoiceId)).toEqual(['inv-oct', 'inv-nov', 'inv-dec']);
  });

  it('sem pagamentos, o valor por pagar transita todo para a fatura seguinte', () => {
    const chain = invoiceChain({
      invoices: [OCTOBER, NOVEMBER],
      transactions: [purchase('t1', OCTOBER.id, 100_000), purchase('t2', NOVEMBER.id, 50_000)],
      payments: [],
      today: '2026-10-01',
    });

    expect(chain[0]).toMatchObject({
      purchasesInCents: 100_000,
      carriedOverInCents: 0,
      totalInCents: 100_000,
      outstandingInCents: 100_000,
      carriedToNextInCents: 100_000,
    });

    // A fatura de novembro vale as compras dela **mais** o que transitou.
    expect(chain[1]).toMatchObject({
      purchasesInCents: 50_000,
      carriedOverInCents: 100_000,
      totalInCents: 150_000,
      outstandingInCents: 150_000,
    });
  });

  it('um pagamento parcial reduz o que transita para a fatura seguinte', () => {
    const chain = invoiceChain({
      invoices: [OCTOBER, NOVEMBER],
      transactions: [purchase('t1', OCTOBER.id, 100_000), purchase('t2', NOVEMBER.id, 50_000)],
      payments: [payment(OCTOBER.id, 40_000)],
      today: '2026-11-15',
    });

    expect(chain[0]).toMatchObject({
      paidInCents: 40_000,
      outstandingInCents: 60_000,
      carriedToNextInCents: 60_000,
    });
    expect(chain[1]).toMatchObject({ carriedOverInCents: 60_000, totalInCents: 110_000 });
  });

  it('a fatura paga deixa de transitar valor nenhum', () => {
    const chain = invoiceChain({
      invoices: [OCTOBER, NOVEMBER],
      transactions: [purchase('t1', OCTOBER.id, 100_000), purchase('t2', NOVEMBER.id, 50_000)],
      payments: [payment(OCTOBER.id, 100_000)],
      today: '2026-11-15',
    });

    expect(chain[0]?.status).toBe('paid');
    expect(chain[0]?.carriedToNextInCents).toBe(0);
    expect(chain[1]).toMatchObject({ carriedOverInCents: 0, totalInCents: 50_000 });
  });

  it('a transição atravessa várias faturas seguidas', () => {
    const chain = invoiceChain({
      invoices: [OCTOBER, NOVEMBER, DECEMBER],
      transactions: [purchase('t1', OCTOBER.id, 30_000)],
      payments: [],
      today: '2026-10-01',
    });

    expect(chain.map((entry) => entry.carriedOverInCents)).toEqual([0, 30_000, 30_000]);
    expect(chain.map((entry) => entry.totalInCents)).toEqual([30_000, 30_000, 30_000]);
  });

  it('conta também os pagamentos feitos por transação, sem os duplicar', () => {
    const paymentTransaction: FinanceTransaction = {
      id: 'pay-1',
      kind: 'invoice_payment',
      status: 'confirmed',
      amountInCents: -25_000,
      date: '2026-11-05',
      accountId: 'acc-1',
      invoiceId: OCTOBER.id,
      settled: true,
    };

    const viaTransaction = invoiceChain({
      invoices: [OCTOBER],
      transactions: [purchase('t1', OCTOBER.id, 100_000), paymentTransaction],
      payments: [],
      today: '2026-11-15',
    });

    expect(viaTransaction[0]?.paidInCents).toBe(25_000);

    // O mesmo pagamento registado nos dois sítios (ligados por `transactionId`)
    // não pode contar duas vezes.
    const linked = invoiceChain({
      invoices: [OCTOBER],
      transactions: [purchase('t1', OCTOBER.id, 100_000), paymentTransaction],
      payments: [payment(OCTOBER.id, 25_000, 'pay-1')],
      today: '2026-11-15',
    });

    expect(linked[0]?.paidInCents).toBe(25_000);
  });

  it('classifica o estado pela data e pelo pagamento', () => {
    const combined = invoiceChain({
      invoices: [OCTOBER, NOVEMBER],
      transactions: [purchase('t1', OCTOBER.id, 10_000)],
      payments: [],
      today: '2026-10-01',
    });

    expect(combined[0]?.status).toBe('open');
    expect(combined[1]?.status).toBe('open');

    const afterClosing = invoiceChain({
      invoices: [OCTOBER, NOVEMBER],
      transactions: [purchase('t1', OCTOBER.id, 10_000)],
      payments: [],
      today: '2026-11-01',
    });

    expect(afterClosing[0]?.status).toBe('closed');
    expect(afterClosing[1]?.status).toBe('open');
  });

  it('conta as compras de cada fatura e ignora as anuladas', () => {
    const chain = invoiceChain({
      invoices: [OCTOBER],
      transactions: [
        purchase('t1', OCTOBER.id, 10_000),
        purchase('t2', OCTOBER.id, 5_000),
        { ...purchase('t3', OCTOBER.id, 99_000), status: 'ignored' },
        purchase('t4', NOVEMBER.id, 1_000),
      ],
      payments: [],
      today: '2026-10-01',
    });

    expect(chain[0]?.purchaseCount).toBe(2);
    expect(chain[0]?.purchasesInCents).toBe(15_000);
  });

  it('uma fatura sem compras nem transição não vale nada', () => {
    const chain = invoiceChain({
      invoices: [OCTOBER],
      transactions: [],
      payments: [],
      today: '2026-10-01',
    });

    expect(chain[0]).toMatchObject({ totalInCents: 0, outstandingInCents: 0, status: 'open' });
  });
});

describe('total por pagar por cartão', () => {
  it('soma apenas o que resta na última fatura de cada cadeia', () => {
    const totals = totalOutstandingByCard({
      invoices: [OCTOBER, NOVEMBER],
      transactions: [purchase('t1', OCTOBER.id, 100_000), purchase('t2', NOVEMBER.id, 50_000)],
      payments: [payment(OCTOBER.id, 20_000)],
      today: '2026-11-15',
    });

    // 80 000 da fatura de outubro transitam para novembro, que soma 50 000:
    // o total em dívida é 130 000 — não 80 000 + 50 000 + 50 000 por dupla contagem.
    expect(totals.get('card-1')).toBe(130_000);
  });

  it('separa cartões diferentes', () => {
    const otherCard: FinanceInvoice = {
      id: 'inv-other',
      cardId: 'card-2',
      closingDate: '2026-10-20',
      dueDate: '2026-11-10',
    };

    const totals = totalOutstandingByCard({
      invoices: [OCTOBER, otherCard],
      transactions: [
        purchase('t1', OCTOBER.id, 10_000),
        { ...purchase('t2', otherCard.id, 3_000), accountId: 'acc-2' },
      ],
      payments: [],
      today: '2026-10-01',
    });

    expect(totals.get('card-1')).toBe(10_000);
    expect(totals.get('card-2')).toBe(3_000);
  });
});
