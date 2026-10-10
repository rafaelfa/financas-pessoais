import { describe, expect, it } from 'vitest';

import {
  centsToDecimal,
  decimalToCents,
  formatCurrency,
  parseCurrencyToCents,
  sumCents,
} from '../currency';

/** `Intl` separa o símbolo da moeda com espaço não separável (U+00A0). */
function normalize(value: string): string {
  return value.replace(/\u00a0/g, ' ');
}

describe('formatCurrency', () => {
  it('formata cêntimos inteiros como euros com separadores portugueses', () => {
    expect(normalize(formatCurrency(123_456, 'EUR'))).toBe('1.234,56 €');
    expect(normalize(formatCurrency(0, 'EUR'))).toBe('0,00 €');
    expect(normalize(formatCurrency(-50_000, 'EUR'))).toBe('-500,00 €');
  });

  it('não perde cêntimos em valores grandes', () => {
    expect(normalize(formatCurrency(999_999_999_99, 'EUR'))).toBe('999.999.999,99 €');
  });
});

describe('parseCurrencyToCents', () => {
  it('aceita o formato português com ponto de milhares e vírgula decimal', () => {
    expect(parseCurrencyToCents('1.234,56')).toBe(123_456);
    expect(parseCurrencyToCents('1.234.567,89')).toBe(123_456_789);
  });

  it('aceita o formato com ponto decimal', () => {
    expect(parseCurrencyToCents('1234.56')).toBe(123_456);
  });

  it('ignora o símbolo da moeda e espaços', () => {
    expect(parseCurrencyToCents(' R$ 1.234,56 ')).toBe(123_456);
    expect(parseCurrencyToCents('1 234,56')).toBe(123_456);
  });

  it('aceita valores negativos e decimais curtos', () => {
    expect(parseCurrencyToCents('-89,90')).toBe(-8_990);
    expect(parseCurrencyToCents('12,5')).toBe(1_250);
    expect(parseCurrencyToCents('0,01')).toBe(1);
  });

  it('devolve null em entradas sem número', () => {
    expect(parseCurrencyToCents('')).toBeNull();
    expect(parseCurrencyToCents('   ')).toBeNull();
    expect(parseCurrencyToCents('-')).toBeNull();
    expect(parseCurrencyToCents('abc')).toBeNull();
  });

  it('faz ida e volta sem deriva de vírgula flutuante', () => {
    for (const value of ['0,10', '19,99', '1.000,00', '1.234,56', '999.999.999,99']) {
      const cents = parseCurrencyToCents(value);
      expect(cents).not.toBeNull();
      expect(parseCurrencyToCents(normalize(formatCurrency(cents as number, 'EUR')))).toBe(cents);
    }
  });
});

describe('conversão entre cêntimos e decimais', () => {
  it('converte nos dois sentidos', () => {
    expect(centsToDecimal(123_456)).toBe(1234.56);
    expect(decimalToCents(1234.56)).toBe(123_456);
  });

  it('arredonda em vez de truncar nas fronteiras conhecidas', () => {
    // 1234.56 * 100 dá 123455.99999999999 em vírgula flutuante.
    expect(decimalToCents(1234.56)).toBe(123_456);
    expect(decimalToCents(0.1 + 0.2)).toBe(30);
  });
});

describe('sumCents', () => {
  it('soma inteiros sem deriva', () => {
    expect(sumCents([1, 2, 3])).toBe(6);
    expect(sumCents([-100, 250])).toBe(150);
  });

  it('devolve zero numa lista vazia', () => {
    expect(sumCents([])).toBe(0);
  });

  it('soma muitos valores mantendo o total exato', () => {
    const amounts = Array.from({ length: 1_000 }, () => 1);
    expect(sumCents(amounts)).toBe(1_000);
  });
});
