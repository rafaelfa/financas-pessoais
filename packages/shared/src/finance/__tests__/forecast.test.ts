import { describe, expect, it } from 'vitest';

import { cashFlowForecast, type ForecastRecurrence } from '../forecast';
import type { FinanceAccount, FinanceTransaction } from '../types';

/**
 * Previsão de saldo.
 *
 * O que estes testes protegem: a previsão só pode contar o que está contratado
 * (recorrências ativas e faturas por pagar), tem de usar as mesmas datas que o
 * gerador vai usar, e tem de avisar **antes** de o saldo ficar negativo.
 */

const ACCOUNT: FinanceAccount = { id: 'acc-1', openingBalanceInCents: 0, archived: false };

/** Movimento liquidado que dá saldo inicial à previsão. */
function settledIncome(amountInCents: number, date: string): FinanceTransaction {
  return {
    id: `t-${date}-${amountInCents}`,
    kind: 'income',
    status: 'confirmed',
    amountInCents,
    date,
    accountId: ACCOUNT.id,
    settled: true,
  };
}

function recurrence(overrides: Partial<ForecastRecurrence> = {}): ForecastRecurrence {
  return {
    id: 'rec-1',
    name: 'Renda',
    kind: 'expense',
    amountInCents: -80_000,
    frequency: 'monthly',
    dayOfMonth: 8,
    nextRunDate: '2026-11-08',
    isActive: true,
    ...overrides,
  };
}

describe('previsão de saldo', () => {
  it('sem nada agendado, o saldo mantém-se em todos os dias do horizonte', () => {
    const forecast = cashFlowForecast({
      accounts: [ACCOUNT],
      transactions: [settledIncome(100_000, '2026-10-01')],
      recurrences: [],
      unpaidInvoices: [],
      from: '2026-10-11',
      days: 5,
    });

    // Hoje mais cinco dias: seis pontos, todos com o mesmo saldo.
    expect(forecast.days).toHaveLength(6);
    expect(forecast.days.every((day) => day.balanceInCents === 100_000)).toBe(true);
    expect(forecast.goesNegative).toBe(false);
    expect(forecast.lowestDate).toBeNull();
  });

  it('desconta a recorrência no dia em que ela cai', () => {
    const forecast = cashFlowForecast({
      accounts: [ACCOUNT],
      transactions: [settledIncome(100_000, '2026-10-01')],
      recurrences: [recurrence()],
      unpaidInvoices: [],
      from: '2026-11-01',
      days: 10,
    });

    const before = forecast.days.find((day) => day.date === '2026-11-07');
    const onDueDate = forecast.days.find((day) => day.date === '2026-11-08');

    expect(before?.balanceInCents).toBe(100_000);
    expect(onDueDate?.balanceInCents).toBe(20_000);
    expect(onDueDate?.outflowInCents).toBe(80_000);
    expect(onDueDate?.items[0]?.label).toBe('Renda');
  });

  it('a fatura por pagar sai no dia do vencimento', () => {
    const forecast = cashFlowForecast({
      accounts: [ACCOUNT],
      transactions: [settledIncome(50_000, '2026-10-01')],
      recurrences: [],
      unpaidInvoices: [
        { id: 'inv-1', cardName: 'ActivoBank', dueDate: '2026-10-20', outstandingInCents: 30_000 },
      ],
      from: '2026-10-11',
      days: 15,
    });

    expect(forecast.days.find((day) => day.date === '2026-10-19')?.balanceInCents).toBe(50_000);
    expect(forecast.days.find((day) => day.date === '2026-10-20')?.balanceInCents).toBe(20_000);
    expect(forecast.totalOutflowInCents).toBe(30_000);
  });

  it('avisa antes de o saldo ficar negativo, com a data', () => {
    const forecast = cashFlowForecast({
      accounts: [ACCOUNT],
      transactions: [settledIncome(50_000, '2026-10-01')],
      recurrences: [recurrence({ amountInCents: -80_000, nextRunDate: '2026-11-08' })],
      unpaidInvoices: [],
      from: '2026-11-01',
      days: 15,
    });

    expect(forecast.goesNegative).toBe(true);
    expect(forecast.firstNegativeDate).toBe('2026-11-08');
    expect(forecast.lowestBalanceInCents).toBe(-30_000);
    expect(forecast.lowestDate).toBe('2026-11-08');
  });

  it('ignora séries pausadas', () => {
    const forecast = cashFlowForecast({
      accounts: [ACCOUNT],
      transactions: [settledIncome(100_000, '2026-10-01')],
      recurrences: [recurrence({ isActive: false })],
      unpaidInvoices: [],
      from: '2026-11-01',
      days: 15,
    });

    expect(forecast.days.every((day) => day.balanceInCents === 100_000)).toBe(true);
    expect(forecast.goesNegative).toBe(false);
  });

  it('para de gerar quando a série acaba — a data de fim é um limite, não uma ocorrência', () => {
    const forecast = cashFlowForecast({
      accounts: [ACCOUNT],
      transactions: [settledIncome(500_000, '2026-10-01')],
      recurrences: [recurrence({ endDate: '2026-11-30' })],
      unpaidInvoices: [],
      from: '2026-11-01',
      days: 60,
    });

    const debits = forecast.days.filter((day) => day.outflowInCents > 0).map((day) => day.date);

    // A ocorrência de 8 de novembro cai; a seguinte seria 8 de dezembro, já depois
    // do fim da série, e por isso não acontece. O dia 30 de novembro não gera nada
    // só por ser a data-limite.
    expect(debits).toEqual(['2026-11-08']);
  });

  it('conta como de hoje as ocorrências já vencidas e ainda não geradas', () => {
    const forecast = cashFlowForecast({
      accounts: [ACCOUNT],
      transactions: [settledIncome(100_000, '2026-10-01')],
      // A próxima data por gerar é 8 de outubro: a renda de outubro **e** a de
      // novembro estão em atraso, e são duas obrigações que já existem.
      recurrences: [recurrence({ nextRunDate: '2026-10-08' })],
      unpaidInvoices: [],
      from: '2026-11-11',
      days: 3,
    });

    expect(forecast.days[0]?.date).toBe('2026-11-11');
    expect(forecast.days[0]?.outflowInCents).toBe(160_000);
    // Nada é contado no passado: as atrasadas caem todas em hoje.
    expect(forecast.days.filter((day) => day.outflowInCents > 0)).toHaveLength(1);
  });

  it('agenda as obrigações já registadas mas por liquidar', () => {
    /*
     * Uma conta de luz lançada hoje e por pagar para a semana é uma obrigação
     * conhecida. Sem isto, a previsão dizia que estava tudo bem enquanto havia
     * dinheiro para sair nos próximos dias — e o aviso de saldo negativo, que é o
     * ponto da funcionalidade, não disparava.
     */
    const pendingBill: FinanceTransaction = {
      id: 't-luz',
      kind: 'expense',
      status: 'confirmed',
      amountInCents: -6_000,
      date: '2026-10-15',
      description: 'Conta da luz',
      accountId: ACCOUNT.id,
      settled: false,
    };

    const forecast = cashFlowForecast({
      accounts: [ACCOUNT],
      transactions: [settledIncome(5_000, '2026-10-01'), pendingBill],
      recurrences: [],
      unpaidInvoices: [],
      from: '2026-10-11',
      days: 10,
    });

    const onDueDate = forecast.days.find((day) => day.date === '2026-10-15');

    expect(onDueDate?.outflowInCents).toBe(6_000);
    expect(onDueDate?.balanceInCents).toBe(-1_000);
    expect(forecast.goesNegative).toBe(true);
    expect(onDueDate?.items[0]?.source).toBe('pending');
    expect(onDueDate?.items[0]?.label).toBe('Conta da luz');
  });

  it('não conta duas vezes uma compra de cartão por liquidar', () => {
    // A dívida do cartão entra pela fatura; o lançamento da compra tem de ficar
    // de fora, senão a previsão descontava-a duas vezes.
    const cardPurchase: FinanceTransaction = {
      id: 't-cartao',
      kind: 'expense',
      status: 'confirmed',
      amountInCents: -5_000,
      date: '2026-10-15',
      description: 'Compra no cartão',
      accountId: ACCOUNT.id,
      invoiceId: 'inv-1',
      settled: false,
    };

    const forecast = cashFlowForecast({
      accounts: [ACCOUNT],
      transactions: [settledIncome(100_000, '2026-10-01'), cardPurchase],
      recurrences: [],
      unpaidInvoices: [
        { id: 'inv-1', cardName: 'ActivoBank', dueDate: '2026-10-20', outstandingInCents: 5_000 },
      ],
      from: '2026-10-11',
      days: 15,
    });

    expect(forecast.totalOutflowInCents).toBe(5_000);
    expect(forecast.days.find((day) => day.date === '2026-10-15')?.outflowInCents).toBe(0);
    expect(forecast.days.find((day) => day.date === '2026-10-20')?.outflowInCents).toBe(5_000);
  });

  it('soma entradas e saídas e devolve o saldo final', () => {
    const forecast = cashFlowForecast({
      accounts: [ACCOUNT],
      transactions: [settledIncome(100_000, '2026-10-01')],
      recurrences: [
        recurrence({
          id: 'rec-rent',
          name: 'Renda',
          amountInCents: -80_000,
          nextRunDate: '2026-11-08',
        }),
        recurrence({
          id: 'rec-salary',
          name: 'Ordenado',
          kind: 'income',
          amountInCents: 150_000,
          nextRunDate: '2026-11-25',
          dayOfMonth: 25,
        }),
      ],
      unpaidInvoices: [],
      from: '2026-11-01',
      days: 30,
    });

    expect(forecast.totalInflowInCents).toBe(150_000);
    expect(forecast.totalOutflowInCents).toBe(80_000);
    expect(forecast.endingBalanceInCents).toBe(170_000);
  });
});

/**
 * O que vence **hoje** também é futuro.
 *
 * A previsão tratava as recorrências vencidas como obrigações de hoje, mas
 * descartava (`date <= from`) as faturas e os lançamentos por liquidar do próprio
 * dia. No mesmo ecrã, o bloco dos «próximos 7 dias» mostrava-os e a previsão não
 * os contava: o saldo projetado ficava 120,00 € acima do real, medido pela
 * verificação adversarial das Fases 5 e 6. As três fontes passam a ter o mesmo
 * critério — o que já venceu conta como sendo de hoje.
 */
describe('previsão de saldo — obrigações do próprio dia', () => {
  it('conta a fatura que vence hoje, e não só as de amanhã', () => {
    const forecast = cashFlowForecast({
      accounts: [ACCOUNT],
      transactions: [settledIncome(50_000, '2026-10-01')],
      recurrences: [],
      unpaidInvoices: [
        {
          id: 'inv-hoje',
          cardName: 'ActivoBank',
          dueDate: '2026-10-11',
          outstandingInCents: 7_000,
        },
        {
          id: 'inv-amanha',
          cardName: 'ActivoBank',
          dueDate: '2026-10-12',
          outstandingInCents: 2_000,
        },
      ],
      from: '2026-10-11',
      days: 10,
    });

    expect(forecast.days[0]?.date).toBe('2026-10-11');
    expect(forecast.days[0]?.outflowInCents).toBe(7_000);
    expect(forecast.days[0]?.balanceInCents).toBe(43_000);
    expect(forecast.days[1]?.outflowInCents).toBe(2_000);
    expect(forecast.totalOutflowInCents).toBe(9_000);
  });

  it('conta o lançamento por liquidar com data de hoje', () => {
    const billToday: FinanceTransaction = {
      id: 't-hoje',
      kind: 'expense',
      status: 'confirmed',
      amountInCents: -5_000,
      date: '2026-10-11',
      description: 'Conta da luz',
      accountId: ACCOUNT.id,
      settled: false,
    };

    const forecast = cashFlowForecast({
      accounts: [ACCOUNT],
      transactions: [settledIncome(100_000, '2026-10-01'), billToday],
      recurrences: [],
      unpaidInvoices: [],
      from: '2026-10-11',
      days: 5,
    });

    expect(forecast.days[0]?.outflowInCents).toBe(5_000);
    expect(forecast.days[0]?.balanceInCents).toBe(95_000);
    expect(forecast.days[0]?.items[0]?.source).toBe('pending');
  });

  it('não perde os 120,00 € de saídas de hoje medidos na verificação', () => {
    // O cenário exato do relatório T5.6 §B9: fatura de 70,00 € a vencer hoje e
    // uma obrigação de 50,00 € por liquidar também hoje.
    const billToday: FinanceTransaction = {
      id: 't-obrigacao-hoje',
      kind: 'expense',
      status: 'confirmed',
      amountInCents: -5_000,
      date: '2026-10-11',
      description: 'Obrigação de hoje',
      accountId: ACCOUNT.id,
      settled: false,
    };

    const forecast = cashFlowForecast({
      accounts: [ACCOUNT],
      transactions: [settledIncome(100_000, '2026-10-01'), billToday],
      recurrences: [],
      unpaidInvoices: [
        {
          id: 'inv-hoje',
          cardName: 'ActivoBank',
          dueDate: '2026-10-11',
          outstandingInCents: 7_000,
        },
      ],
      from: '2026-10-11',
      days: 5,
    });

    expect(forecast.days[0]?.outflowInCents).toBe(12_000);
    expect(forecast.endingBalanceInCents).toBe(88_000);
  });

  it('conta como de hoje o que já venceu, tal como uma recorrência vencida', () => {
    const overdueBill: FinanceTransaction = {
      id: 't-atrasado',
      kind: 'expense',
      status: 'confirmed',
      amountInCents: -3_000,
      date: '2026-10-01',
      description: 'Conta atrasada',
      accountId: ACCOUNT.id,
      settled: false,
    };

    const forecast = cashFlowForecast({
      accounts: [ACCOUNT],
      transactions: [settledIncome(100_000, '2026-10-01'), overdueBill],
      recurrences: [],
      unpaidInvoices: [
        {
          id: 'inv-atrasada',
          cardName: 'ActivoBank',
          dueDate: '2026-10-02',
          outstandingInCents: 4_000,
        },
      ],
      from: '2026-10-11',
      days: 5,
    });

    // Nada é contado no passado: as duas obrigações vencidas caem ambas em hoje.
    expect(forecast.days[0]?.outflowInCents).toBe(7_000);
    expect(forecast.days.filter((day) => day.outflowInCents > 0)).toHaveLength(1);
  });

  it('continua a ignorar o que vence depois do horizonte', () => {
    const forecast = cashFlowForecast({
      accounts: [ACCOUNT],
      transactions: [settledIncome(100_000, '2026-10-01')],
      recurrences: [],
      unpaidInvoices: [
        {
          id: 'inv-longe',
          cardName: 'ActivoBank',
          dueDate: '2026-12-01',
          outstandingInCents: 9_000,
        },
      ],
      from: '2026-10-11',
      days: 5,
    });

    expect(forecast.totalOutflowInCents).toBe(0);
    expect(forecast.endingBalanceInCents).toBe(100_000);
  });

  it('sem dayOfMonth, a série mensal não deriva do dia 31', () => {
    /*
     * Com a coluna `dayOfMonth` nula, o dia alvo era lido da data **já ajustada**:
     * 31/01 → 28/02 → 28/03 para sempre. A previsão tem de usar o dia da data
     * original, como o gerador (`dueOccurrences`).
     */
    const forecast = cashFlowForecast({
      accounts: [ACCOUNT],
      transactions: [settledIncome(500_000, '2026-01-01')],
      recurrences: [
        recurrence({
          dayOfMonth: undefined,
          amountInCents: -10_000,
          nextRunDate: '2026-01-31',
        }),
      ],
      unpaidInvoices: [],
      from: '2026-03-01',
      days: 40,
    });

    const debits = forecast.days.filter((day) => day.outflowInCents > 0).map((day) => day.date);

    // As duas ocorrências em atraso caem em hoje; a série volta ao dia 31 em março.
    expect(debits).toEqual(['2026-03-01', '2026-03-31']);
  });
});
