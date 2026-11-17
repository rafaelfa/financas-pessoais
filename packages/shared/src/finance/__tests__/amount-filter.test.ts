import { describe, expect, it } from 'vitest';

import { amountWhereClause, parseAmountFilter } from '../amount-filter';

describe('filtro por valor — leitura do URL', () => {
  it('lê euros com vírgula, com ponto e sem decimais', () => {
    expect(parseAmountFilter({ valor: '25', valorOp: 'gt' })).toEqual({
      operator: 'gt',
      amountInCents: 2_500,
    });
    expect(parseAmountFilter({ valor: '25,50', valorOp: 'lt' })).toEqual({
      operator: 'lt',
      amountInCents: 2_550,
    });
    expect(parseAmountFilter({ valor: '25.50', valorOp: 'eq' })).toEqual({
      operator: 'eq',
      amountInCents: 2_550,
    });
  });

  it('usa o módulo: um valor negativo vale pelo seu tamanho', () => {
    expect(parseAmountFilter({ valor: '-25', valorOp: 'gt' })?.amountInCents).toBe(2_500);
  });

  it('ignora o filtro quando falta uma das metades', () => {
    expect(parseAmountFilter({ valor: '25' })).toBeNull();
    expect(parseAmountFilter({ valorOp: 'gt' })).toBeNull();
    expect(parseAmountFilter({ valor: '', valorOp: 'gt' })).toBeNull();
    expect(parseAmountFilter({ valor: '   ', valorOp: 'gt' })).toBeNull();
  });

  it('ignora o filtro quando o operador ou o valor não servem', () => {
    expect(parseAmountFilter({ valor: 'abc', valorOp: 'gt' })).toBeNull();
    expect(parseAmountFilter({ valor: '25', valorOp: 'xx' })).toBeNull();
    expect(parseAmountFilter({ valor: '25', valorOp: 'GT' })).toBeNull();
  });

  it('recusa o que não cabe num inteiro de 32 bits (a coluna é `Int`)', () => {
    // 21 474 836,47 € é o máximo representável; um cêntimo acima já não entra.
    expect(parseAmountFilter({ valor: '21474836.47', valorOp: 'gt' })?.amountInCents).toBe(
      2_147_483_647,
    );
    expect(parseAmountFilter({ valor: '21474836.48', valorOp: 'gt' })).toBeNull();
    expect(parseAmountFilter({ valor: '30000000', valorOp: 'gt' })).toBeNull();
    expect(parseAmountFilter({ valor: '-30000000', valorOp: 'lt' })).toBeNull();
  });
});

describe('filtro por valor — cláusula que vai para a consulta', () => {
  it('«acima de» é o par de sinais, com limites estritos', () => {
    expect(amountWhereClause({ operator: 'gt', amountInCents: 2_500 })).toEqual({
      OR: [{ amountInCents: { gt: 2_500 } }, { amountInCents: { lt: -2_500 } }],
    });
  });

  it('«abaixo de» é a interseção dos dois lados', () => {
    expect(amountWhereClause({ operator: 'lt', amountInCents: 2_500 })).toEqual({
      AND: [{ amountInCents: { lt: 2_500 } }, { amountInCents: { gt: -2_500 } }],
    });
  });

  it('«igual a» aceita os dois sinais e mais nada', () => {
    expect(amountWhereClause({ operator: 'eq', amountInCents: 2_500 })).toEqual({
      OR: [{ amountInCents: 2_500 }, { amountInCents: -2_500 }],
    });
  });

  it('zero não é um caso especial escondido: cada operador tem a sua cláusula', () => {
    expect(amountWhereClause({ operator: 'gt', amountInCents: 0 })).toEqual({
      amountInCents: { not: 0 },
    });
    expect(amountWhereClause({ operator: 'lt', amountInCents: 0 })).toEqual({
      AND: [{ amountInCents: { lt: 0 } }, { amountInCents: { gt: 0 } }],
    });
    expect(amountWhereClause({ operator: 'eq', amountInCents: 0 })).toEqual({
      OR: [{ amountInCents: 0 }, { amountInCents: 0 }],
    });
  });

  it('o sinal do limite não muda a cláusula: o módulo é aplicado aqui', () => {
    expect(amountWhereClause({ operator: 'gt', amountInCents: -2_500 })).toEqual(
      amountWhereClause({ operator: 'gt', amountInCents: 2_500 }),
    );
  });
});
