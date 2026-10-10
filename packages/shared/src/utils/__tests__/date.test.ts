import { describe, expect, it } from 'vitest';

import { endOfMonth, formatDate, formatDateTime, formatMonth, startOfMonth } from '../date';

/**
 * Todas as datas de teste são construídas ao meio-dia UTC para que a conversão
 * para o fuso local (`Europe/Lisbon`, UTC+1 no verão) nunca mude o dia.
 */
const NOON_UTC = new Date(Date.UTC(2026, 9, 10, 12, 0, 0));

describe('formatação de datas', () => {
  it('formata como dd/mm/aaaa', () => {
    expect(formatDate(NOON_UTC)).toBe('10/10/2026');
  });

  it('formata data e hora', () => {
    expect(formatDateTime(NOON_UTC).replace(/\u00a0/g, ' ')).toBe('10/10/2026, 13:00');
  });

  it('formata o mês por extenso', () => {
    expect(formatMonth(NOON_UTC)).toBe('outubro de 2026');
  });
});

describe('startOfMonth e endOfMonth', () => {
  it('devolvem os limites do mês em UTC, com o fim exclusivo', () => {
    expect(startOfMonth(NOON_UTC).toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(endOfMonth(NOON_UTC).toISOString()).toBe('2026-11-01T00:00:00.000Z');
  });

  it('atravessam a mudança de ano', () => {
    const december = new Date(Date.UTC(2026, 11, 15, 12, 0, 0));

    expect(startOfMonth(december).toISOString()).toBe('2026-12-01T00:00:00.000Z');
    expect(endOfMonth(december).toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('cobrem o dia inteiro, sem lacunas nem sobreposição', () => {
    const lastDay = new Date(Date.UTC(2026, 9, 31, 23, 59, 59, 999));
    const firstDay = startOfMonth(NOON_UTC);

    expect(lastDay.getTime()).toBeGreaterThanOrEqual(firstDay.getTime());
    expect(lastDay.getTime()).toBeLessThan(endOfMonth(NOON_UTC).getTime());
  });

  /**
   * Comportamento atual, documentado de propósito: os limites do mês são
   * calculados em UTC. Um instante no fim do mês em hora local pode cair no mês
   * seguinte em UTC. A Fase 1 fixa a regra definitiva (datas de calendário em
   * `@db.Date`, sem hora) — este teste existe para que a mudança seja
   * deliberada e não silenciosa.
   */
  it('documentam a semântica UTC usada hoje', () => {
    const lastMomentOfOctoberUtc = new Date(Date.UTC(2026, 9, 31, 23, 30, 0));

    expect(startOfMonth(lastMomentOfOctoberUtc).toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(endOfMonth(lastMomentOfOctoberUtc).toISOString()).toBe('2026-11-01T00:00:00.000Z');
  });
});
