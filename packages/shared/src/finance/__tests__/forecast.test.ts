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

  it('soma entradas e saídas e devolve o saldo final', () => {
    const forecast = cashFlowForecast({
      accounts: [ACCOUNT],
      transactions: [settledIncome(100_000, '2026-10-01')],
      recurrences: [
        recurrence({ id: 'rec-rent', name: 'Renda', amountInCents: -80_000, nextRunDate: '2026-11-08' }),
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
