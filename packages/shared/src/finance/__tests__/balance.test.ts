import { describe, expect, it } from 'vitest';

import {
  accountBalanceInCents,
  accountBalanceSeries,
  balanceAdjustmentInCents,
  balanceByAccount,
  hasMatchingAdjustment,
  projectedBalanceInCents,
  projectedTotalBalanceInCents,
  totalBalanceInCents,
} from '../balance';
import type { FinanceAccount, FinanceTransaction } from '../types';

const CHECKING: FinanceAccount = { id: 'acc-checking', openingBalanceInCents: 200_000 };
const SAVINGS: FinanceAccount = { id: 'acc-savings', openingBalanceInCents: 500_000 };
const ARCHIVED: FinanceAccount = { id: 'acc-old', openingBalanceInCents: 100_000, archived: true };

function transaction(overrides: Partial<FinanceTransaction> & { id: string }): FinanceTransaction {
  return {
    kind: 'expense',
    status: 'confirmed',
    amountInCents: -1_000,
    date: '2026-10-05',
    accountId: CHECKING.id,
    settled: true,
    ...overrides,
  };
}

describe('saldo de uma conta', () => {
  it('aplica a fórmula oficial: saldo inicial + ganhos recebidos − gastos pagos', () => {
    const transactions: FinanceTransaction[] = [
      transaction({ id: 't1', kind: 'income', amountInCents: 350_000 }),
      transaction({ id: 't2', kind: 'expense', amountInCents: -280_000 }),
    ];

    expect(accountBalanceInCents(CHECKING, transactions)).toBe(200_000 + 350_000 - 280_000);
  });

  it('ignora o que ainda não foi pago ou recebido', () => {
    const transactions: FinanceTransaction[] = [
      transaction({ id: 't1', kind: 'income', amountInCents: 100_000, settled: false }),
      transaction({ id: 't2', kind: 'expense', amountInCents: -50_000, settled: false }),
    ];

    expect(accountBalanceInCents(CHECKING, transactions)).toBe(200_000);
  });

  it('ignora transações marcadas como ignoradas', () => {
    const transactions: FinanceTransaction[] = [
      transaction({ id: 't1', kind: 'income', amountInCents: 100_000 }),
      transaction({ id: 't2', kind: 'expense', amountInCents: -100_000, status: 'ignored' }),
    ];

    expect(accountBalanceInCents(CHECKING, transactions)).toBe(300_000);
  });

  it('não confunde contas diferentes', () => {
    const transactions: FinanceTransaction[] = [
      transaction({ id: 't1', amountInCents: -25_000 }),
      transaction({ id: 't2', accountId: SAVINGS.id, amountInCents: -75_000 }),
    ];

    expect(accountBalanceInCents(CHECKING, transactions)).toBe(175_000);
    expect(accountBalanceInCents(SAVINGS, transactions)).toBe(425_000);
  });

  it('respeita uma data-limite inclusiva', () => {
    const transactions: FinanceTransaction[] = [
      transaction({ id: 't1', amountInCents: -10_000, date: '2026-10-05' }),
      transaction({ id: 't2', amountInCents: -20_000, date: '2026-10-20' }),
    ];

    expect(accountBalanceInCents(CHECKING, transactions, { upTo: '2026-10-05' })).toBe(190_000);
    expect(accountBalanceInCents(CHECKING, transactions, { upTo: '2026-10-19' })).toBe(190_000);
    expect(accountBalanceInCents(CHECKING, transactions, { upTo: '2026-10-20' })).toBe(170_000);
  });
});

describe('totais e transferências', () => {
  it('exclui contas arquivadas dos totais', () => {
    const accounts = [CHECKING, SAVINGS, ARCHIVED];

    expect(balanceByAccount(accounts, [])).toHaveLength(2);
    expect(totalBalanceInCents(accounts, [])).toBe(700_000);
  });

  it('não altera o total quando há uma transferência entre contas', () => {
    const transactions: FinanceTransaction[] = [
      transaction({
        id: 'out',
        kind: 'transfer',
        amountInCents: -100_000,
        transferGroupId: 'pair-1',
      }),
      transaction({
        id: 'in',
        kind: 'transfer',
        amountInCents: 100_000,
        accountId: SAVINGS.id,
        transferGroupId: 'pair-1',
      }),
    ];

    expect(totalBalanceInCents([CHECKING, SAVINGS], transactions)).toBe(700_000);
    expect(accountBalanceInCents(CHECKING, transactions)).toBe(100_000);
    expect(accountBalanceInCents(SAVINGS, transactions)).toBe(600_000);
  });
});

describe('projeção de saldo futuro', () => {
  it('inclui o que está agendado e ainda não liquidado', () => {
    const transactions: FinanceTransaction[] = [
      transaction({ id: 't1', amountInCents: -10_000, date: '2026-10-05' }),
      transaction({ id: 't2', amountInCents: -30_000, date: '2026-10-25', settled: false }),
      transaction({ id: 't3', amountInCents: -50_000, date: '2026-11-10', settled: false }),
    ];

    expect(accountBalanceInCents(CHECKING, transactions)).toBe(190_000);
    expect(projectedBalanceInCents(CHECKING, transactions, '2026-10-31')).toBe(160_000);
    expect(projectedBalanceInCents(CHECKING, transactions, '2026-11-30')).toBe(110_000);
    // A projeção nunca inclui transações ignoradas.
    expect(
      projectedBalanceInCents(
        CHECKING,
        [transaction({ id: 't4', amountInCents: -99_999, settled: false, status: 'ignored' })],
        '2026-12-31',
      ),
    ).toBe(200_000);
  });

  it('projeta o total das contas não arquivadas e ignora as arquivadas', () => {
    const accounts = [CHECKING, SAVINGS, ARCHIVED];
    const transactions: FinanceTransaction[] = [
      transaction({ id: 't1', amountInCents: -50_000, settled: false, date: '2026-10-20' }),
    ];

    expect(projectedTotalBalanceInCents(accounts, transactions, '2026-10-31')).toBe(650_000);
  });
});

describe('ajuste de saldo ("travar saldo")', () => {
  it('calcula a diferença entre o saldo real informado e o calculado', () => {
    expect(
      balanceAdjustmentInCents({
        reportedBalanceInCents: 270_000,
        computedBalanceInCents: 250_000,
      }),
    ).toBe(20_000);

    expect(
      balanceAdjustmentInCents({
        reportedBalanceInCents: 240_000,
        computedBalanceInCents: 250_000,
      }),
    ).toBe(-10_000);

    expect(
      balanceAdjustmentInCents({
        reportedBalanceInCents: 250_000,
        computedBalanceInCents: 250_000,
      }),
    ).toBe(0);
  });

  it('deteta um ajuste já existente para não o duplicar', () => {
    const transactions: FinanceTransaction[] = [
      transaction({
        id: 'adj',
        kind: 'balance_adjust',
        amountInCents: 20_000,
        date: '2026-10-10',
      }),
    ];

    expect(
      hasMatchingAdjustment(transactions, {
        accountId: CHECKING.id,
        date: '2026-10-10',
        amountInCents: 20_000,
      }),
    ).toBe(true);

    expect(
      hasMatchingAdjustment(transactions, {
        accountId: CHECKING.id,
        date: '2026-10-11',
        amountInCents: 20_000,
      }),
    ).toBe(false);
  });
});

describe('série diária do saldo', () => {
  it('dá um ponto por dia, do 30.º dia atrás até hoje', () => {
    const series = accountBalanceSeries(CHECKING, [], { today: '2026-11-15' });

    expect(series).toHaveLength(30);
    expect(series[0]?.date).toBe('2026-10-17');
    expect(series[29]?.date).toBe('2026-11-15');
  });

  it('o último ponto é o saldo do motor, sem caminho paralelo', () => {
    const transactions: FinanceTransaction[] = [
      transaction({ id: 't1', kind: 'income', amountInCents: 350_000, date: '2026-10-20' }),
      transaction({ id: 't2', amountInCents: -70_000, date: '2026-11-02' }),
      transaction({ id: 't3', amountInCents: -12_500, date: '2026-11-14' }),
      transaction({ id: 't4', amountInCents: -9_900, date: '2026-11-15', settled: false }),
    ];

    const series = accountBalanceSeries(CHECKING, transactions, { today: '2026-11-15' });

    expect(series[series.length - 1]?.balanceInCents).toBe(
      accountBalanceInCents(CHECKING, transactions),
    );
  });

  it('cada ponto é o saldo até esse dia, não o saldo de hoje', () => {
    const transactions: FinanceTransaction[] = [
      transaction({ id: 't1', amountInCents: -50_000, date: '2026-10-20' }),
      transaction({ id: 't2', amountInCents: -25_000, date: '2026-11-10' }),
    ];

    const series = accountBalanceSeries(CHECKING, transactions, { today: '2026-11-15' });
    const porData = new Map(series.map((point) => [point.date, point.balanceInCents]));

    expect(porData.get('2026-10-19')).toBe(200_000);
    expect(porData.get('2026-10-20')).toBe(150_000);
    expect(porData.get('2026-11-09')).toBe(150_000);
    expect(porData.get('2026-11-10')).toBe(125_000);
  });

  it('uma conta sem movimentos é uma reta no saldo inicial', () => {
    const series = accountBalanceSeries(SAVINGS, [], { today: '2026-11-15' });

    expect(new Set(series.map((point) => point.balanceInCents))).toEqual(new Set([500_000]));
  });

  it('uma transferência entre contas move cada lado uma vez, na data dela', () => {
    // O par de uma transferência são duas linhas, uma por conta, com sinais opostos.
    const transactions: FinanceTransaction[] = [
      transaction({
        id: 'ida',
        kind: 'transfer',
        amountInCents: -80_000,
        date: '2026-11-05',
        accountId: CHECKING.id,
      }),
      transaction({
        id: 'volta',
        kind: 'transfer',
        amountInCents: 80_000,
        date: '2026-11-05',
        accountId: SAVINGS.id,
      }),
    ];

    const origem = accountBalanceSeries(CHECKING, transactions, { today: '2026-11-15' });
    const destino = accountBalanceSeries(SAVINGS, transactions, { today: '2026-11-15' });

    expect(origem[origem.length - 1]?.balanceInCents).toBe(120_000);
    expect(destino[destino.length - 1]?.balanceInCents).toBe(580_000);
    // Nem uma conta conta o lado da outra, nem o par se soma duas vezes.
    expect(origem[origem.length - 1]?.balanceInCents).toBe(
      accountBalanceInCents(CHECKING, transactions),
    );
    expect(destino[destino.length - 1]?.balanceInCents).toBe(
      accountBalanceInCents(SAVINGS, transactions),
    );
  });

  it('um movimento liquidado com data futura fica fora da série, que acaba hoje', () => {
    // O motor sem `upTo` soma tudo o que está liquidado, mesmo com data à frente;
    // a série pára em `today`. Fica escrito para não surpreender ninguém.
    const transactions: FinanceTransaction[] = [
      transaction({ id: 'futuro', amountInCents: -10_000, date: '2026-12-01' }),
    ];

    const series = accountBalanceSeries(CHECKING, transactions, { today: '2026-11-15' });

    expect(series[series.length - 1]?.balanceInCents).toBe(200_000);
    expect(accountBalanceInCents(CHECKING, transactions)).toBe(190_000);
  });

  it('aceita um número de dias diferente para os testes', () => {
    const series = accountBalanceSeries(CHECKING, [], { today: '2026-11-15', days: 3 });

    expect(series.map((point) => point.date)).toEqual(['2026-11-13', '2026-11-14', '2026-11-15']);
  });
});
