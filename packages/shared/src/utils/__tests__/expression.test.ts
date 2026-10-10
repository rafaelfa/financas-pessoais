import { describe, expect, it } from 'vitest';

import { evaluateAmountExpression, isCalculation, parseDecimalLiteral } from '../expression';

describe('leitura de literais decimais', () => {
  it('lê o formato português com milhares e vírgula', () => {
    expect(parseDecimalLiteral('1.234,56')).toBe(1234.56);
    expect(parseDecimalLiteral('1.234.567,89')).toBe(1234567.89);
  });

  it('lê o formato internacional com ponto decimal', () => {
    expect(parseDecimalLiteral('1234.56')).toBe(1234.56);
    expect(parseDecimalLiteral('12.5')).toBe(12.5);
  });

  it('distingue milhares de decimal quando só há pontos', () => {
    expect(parseDecimalLiteral('1.234')).toBe(1234);
    expect(parseDecimalLiteral('1.234.567')).toBe(1234567);
  });

  it('aceita espaços como separador de milhares', () => {
    expect(parseDecimalLiteral('1 234,56')).toBe(1234.56);
  });

  it('recusa literais inválidos', () => {
    expect(parseDecimalLiteral('')).toBeNull();
    expect(parseDecimalLiteral('1.2.3')).toBeNull();
  });
});

describe('avaliação de expressões', () => {
  it('lê um número simples', () => {
    expect(evaluateAmountExpression('12,50')).toBe(1_250);
    expect(evaluateAmountExpression('  7 ')).toBe(700);
  });

  it('soma, subtrai, multiplica e divide', () => {
    expect(evaluateAmountExpression('12,50 + 3,20')).toBe(1_570);
    expect(evaluateAmountExpression('100 - 25,50')).toBe(7_450);
    expect(evaluateAmountExpression('2,5 * 4')).toBe(1_000);
    expect(evaluateAmountExpression('45 / 3')).toBe(1_500);
  });

  it('respeita a precedência dos operadores', () => {
    expect(evaluateAmountExpression('2 + 3 * 4')).toBe(1_400);
    expect(evaluateAmountExpression('(2 + 3) * 4')).toBe(2_000);
  });

  it('trata valores negativos e parênteses aninhados', () => {
    expect(evaluateAmountExpression('-12,50')).toBe(-1_250);
    expect(evaluateAmountExpression('((10 + 5) * (2 - 1))')).toBe(1_500);
  });

  it('arredonda ao cêntimo mais próximo', () => {
    expect(evaluateAmountExpression('10 / 3')).toBe(333);
    expect(evaluateAmountExpression('0,005')).toBe(1);
  });

  it('devolve null em expressões inválidas em vez de rebentar', () => {
    expect(evaluateAmountExpression('')).toBeNull();
    expect(evaluateAmountExpression('   ')).toBeNull();
    expect(evaluateAmountExpression('abc')).toBeNull();
    expect(evaluateAmountExpression('12 +')).toBeNull();
    expect(evaluateAmountExpression('* 3')).toBeNull();
    expect(evaluateAmountExpression('(12 + 3')).toBeNull();
    expect(evaluateAmountExpression('12 + 3)')).toBeNull();
    expect(evaluateAmountExpression('12 / 0')).toBeNull();
  });

  it('não executa código: só aritmética', () => {
    // Se isto alguma vez fosse `eval`, o resultado seria diferente de null.
    expect(evaluateAmountExpression('process.exit(1)')).toBeNull();
    expect(evaluateAmountExpression('alert("x")')).toBeNull();
    expect(evaluateAmountExpression('1;2')).toBeNull();
  });
});

describe('deteção de cálculo', () => {
  it('distingue um número simples de uma conta', () => {
    expect(isCalculation('12,50')).toBe(false);
    expect(isCalculation('-12,50')).toBe(false);
    expect(isCalculation('12,50 + 3,20')).toBe(true);
    expect(isCalculation('(45 + 15) / 3')).toBe(true);
  });
});
