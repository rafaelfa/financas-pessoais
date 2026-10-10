import { describe, expect, it } from 'vitest';

import {
  addDays,
  addMonths,
  daysBetween,
  isWithinPeriod,
  periodOf,
  periodRange,
  previousPeriod,
} from '../period';

describe('periodOf com o mês a começar no dia 1', () => {
  it('devolve o mês de calendário', () => {
    const period = periodOf('2026-10-10');

    expect(period).toEqual({ start: '2026-10-01', end: '2026-11-01', key: '2026-10' });
  });

  it('trata o fim como exclusivo', () => {
    const period = periodOf('2026-10-10');

    expect(isWithinPeriod(period, '2026-10-01')).toBe(true);
    expect(isWithinPeriod(period, '2026-10-31')).toBe(true);
    expect(isWithinPeriod(period, '2026-11-01')).toBe(false);
    expect(isWithinPeriod(period, '2026-09-30')).toBe(false);
  });

  it('atravessa a passagem de ano', () => {
    expect(periodOf('2026-12-31')).toEqual({
      start: '2026-12-01',
      end: '2027-01-01',
      key: '2026-12',
    });
  });
});

describe('periodOf com o mês a começar no dia do salário', () => {
  it('coloca o dia anterior ao início no período do mês anterior', () => {
    expect(periodOf('2026-10-24', 25)).toEqual({
      start: '2026-09-25',
      end: '2026-10-25',
      key: '2026-09',
    });
  });

  it('coloca o próprio dia de início no período novo', () => {
    expect(periodOf('2026-10-25', 25)).toEqual({
      start: '2026-10-25',
      end: '2026-11-25',
      key: '2026-10',
    });
  });

  it('funciona em janeiro, recuando a dezembro do ano anterior', () => {
    expect(periodOf('2027-01-05', 25)).toEqual({
      start: '2026-12-25',
      end: '2027-01-25',
      key: '2026-12',
    });
  });

  it('recusa um dia de início impossível', () => {
    expect(() => periodOf('2026-10-10', 31)).toThrow(RangeError);
    expect(() => periodOf('2026-10-10', 0)).toThrow(RangeError);
  });
});

describe('periodRange', () => {
  it('cobre todos os meses do intervalo, inclusive nas pontas', () => {
    const periods = periodRange('2026-10-15', '2027-01-02');

    expect(periods.map((period) => period.key)).toEqual([
      '2026-10',
      '2026-11',
      '2026-12',
      '2027-01',
    ]);
  });

  it('devolve um único período quando as duas datas caem no mesmo mês', () => {
    expect(periodRange('2026-10-01', '2026-10-31')).toHaveLength(1);
  });

  it('devolve vazio quando o fim é anterior ao início', () => {
    expect(periodRange('2026-10-01', '2026-09-01')).toEqual([]);
  });

  it('respeita o início configurável do mês', () => {
    const periods = periodRange('2026-09-25', '2026-11-24', 25);

    expect(periods.map((period) => period.key)).toEqual(['2026-09', '2026-10']);
  });
});

describe('previousPeriod', () => {
  it('recua um mês', () => {
    expect(previousPeriod(periodOf('2026-10-10')).key).toBe('2026-09');
    expect(previousPeriod(periodOf('2027-01-10')).key).toBe('2026-12');
  });

  it('mantém o início configurável', () => {
    expect(previousPeriod(periodOf('2026-10-25', 25), 25).key).toBe('2026-09');
  });
});

describe('aritmética de datas', () => {
  it('soma dias e meses', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addMonths('2026-10-15', 3)).toBe('2027-01-15');
  });

  it('limita ao último dia do mês em vez de transbordar para o mês seguinte', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-08-31', 1)).toBe('2026-09-30');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
  });

  it('conta dias entre datas, incluindo negativos', () => {
    expect(daysBetween('2026-10-01', '2026-11-01')).toBe(31);
    expect(daysBetween('2026-11-01', '2026-10-01')).toBe(-31);
    expect(daysBetween('2026-10-10', '2026-10-10')).toBe(0);
  });

  it('recusa datas mal formadas ou impossíveis em vez de as corrigir em silêncio', () => {
    expect(() => addDays('10/10/2026', 1)).toThrow(TypeError);
    expect(() => periodOf('2026-13-01')).toThrow(RangeError);
    expect(() => periodOf('2026-02-30')).toThrow(RangeError);
    expect(() => periodOf('2026-00-10')).toThrow(RangeError);
    expect(() => daysBetween('2026-10-32', '2026-11-01')).toThrow(RangeError);
  });
});
