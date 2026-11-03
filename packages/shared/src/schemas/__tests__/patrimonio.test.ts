import { describe, expect, it } from 'vitest';

import {
  archivePatrimonySchema,
  createAssetSchema,
  createLiabilitySchema,
  updateAssetSchema,
  updateLiabilitySchema,
} from '../domain/patrimonio';

/**
 * Bens e dívidas: dinheiro em cêntimos e taxa em pontos base.
 *
 * Os casos que interessam são os que já morderam neste projeto: valor vazio (0),
 * valor negativo, datas trocadas, e a garantia de que a edição parcial não
 * rebenta — o `.partial()` sobre um schema refinado lançava no Zod 4 (T26).
 */

describe('createAssetSchema', () => {
  const bem = {
    type: 'VEHICLE' as const,
    name: 'Carro',
    valueInCents: 1_250_000,
  };

  it('aceita um bem mínimo', () => {
    expect(createAssetSchema.parse(bem)).toMatchObject(bem);
  });

  it('aceita valor zero — um bem sem valor de mercado continua a ser um bem', () => {
    expect(createAssetSchema.safeParse({ ...bem, valueInCents: 0 }).success).toBe(true);
  });

  it('recusa valor negativo', () => {
    expect(createAssetSchema.safeParse({ ...bem, valueInCents: -100 }).success).toBe(false);
  });

  it('recusa cêntimos com casas decimais', () => {
    expect(createAssetSchema.safeParse({ ...bem, valueInCents: 1250.5 }).success).toBe(false);
  });

  it('recusa nome vazio e tipo desconhecido', () => {
    expect(createAssetSchema.safeParse({ ...bem, name: '   ' }).success).toBe(false);
    expect(createAssetSchema.safeParse({ ...bem, type: 'BARCO' }).success).toBe(false);
  });

  it('recusa data que não é data de calendário', () => {
    expect(createAssetSchema.safeParse({ ...bem, acquiredOn: '2026-13-01' }).success).toBe(false);
    expect(createAssetSchema.safeParse({ ...bem, acquiredOn: '2026-02-30' }).success).toBe(false);
  });

  it('aceita datas opcionais válidas', () => {
    expect(
      createAssetSchema.safeParse({ ...bem, acquiredOn: '2020-05-31', valuedOn: '2026-11-01' })
        .success,
    ).toBe(true);
  });
});

describe('updateAssetSchema', () => {
  it('aceita só o identificador — edição parcial tem de funcionar', () => {
    expect(updateAssetSchema.safeParse({ id: 'a1' }).success).toBe(true);
  });

  it('valida o valor quando ele vem, e o zero é válido', () => {
    expect(updateAssetSchema.safeParse({ id: 'a1', valueInCents: 0 }).success).toBe(true);
    expect(updateAssetSchema.safeParse({ id: 'a1', valueInCents: -1 }).success).toBe(false);
    expect(updateAssetSchema.safeParse({ id: 'a1', valueInCents: 500 }).success).toBe(true);
  });

  it('exige identificador', () => {
    expect(updateAssetSchema.safeParse({ valueInCents: 500 }).success).toBe(false);
  });
});

describe('createLiabilitySchema', () => {
  const divida = {
    type: 'MORTGAGE' as const,
    name: 'Crédito habitação',
    principalInCents: 15_000_000,
    outstandingInCents: 300_000,
  };

  it('aceita uma dívida mínima', () => {
    expect(createLiabilitySchema.parse(divida)).toMatchObject(divida);
  });

  it('aceita saldo em dívida zero — um crédito liquidado é um estado normal', () => {
    expect(createLiabilitySchema.safeParse({ ...divida, outstandingInCents: 0 }).success).toBe(
      true,
    );
  });

  it('recusa saldo em dívida negativo e capital zero', () => {
    expect(createLiabilitySchema.safeParse({ ...divida, outstandingInCents: -1 }).success).toBe(
      false,
    );
    expect(
      createLiabilitySchema.safeParse({ ...divida, outstandingInCents: 0, principalInCents: 0 })
        .success,
    ).toBe(false);
  });

  it('aceita prestação a zero, mas não negativa', () => {
    expect(
      createLiabilitySchema.safeParse({ ...divida, installmentAmountInCents: 0 }).success,
    ).toBe(true);
    expect(
      createLiabilitySchema.safeParse({ ...divida, installmentAmountInCents: -1 }).success,
    ).toBe(false);
  });

  it('recusa taxa em percentagem decimal — a taxa é em pontos base', () => {
    expect(
      createLiabilitySchema.safeParse({ ...divida, interestRateBasisPoints: 3.5 }).success,
    ).toBe(false);
    expect(
      createLiabilitySchema.safeParse({ ...divida, interestRateBasisPoints: 350 }).success,
    ).toBe(true);
  });

  it('recusa taxa acima de 100 %', () => {
    expect(
      createLiabilitySchema.safeParse({ ...divida, interestRateBasisPoints: 10_001 }).success,
    ).toBe(false);
  });

  it('recusa fim antes do início, com o erro no campo do fim', () => {
    const resultado = createLiabilitySchema.safeParse({
      ...divida,
      startDate: '2026-05-01',
      endDate: '2026-04-01',
    });

    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.path).toEqual(['endDate']);
    expect(resultado.error?.issues[0]?.message).toBe('O fim não pode ser antes do início.');
  });

  it('aceita fim no mesmo dia do início', () => {
    expect(
      createLiabilitySchema.safeParse({
        ...divida,
        startDate: '2026-05-01',
        endDate: '2026-05-01',
      }).success,
    ).toBe(true);
  });
});

describe('updateLiabilitySchema', () => {
  it('não rebenta na construção e aceita edição parcial', () => {
    // O caso T26: `.partial()` sobre um schema com `superRefine` lançava aqui.
    expect(() => updateLiabilitySchema.safeParse({ id: 'l1' })).not.toThrow();
    expect(updateLiabilitySchema.safeParse({ id: 'l1' }).success).toBe(true);
  });

  it('continua a validar as datas quando ambas vêm', () => {
    const resultado = updateLiabilitySchema.safeParse({
      id: 'l1',
      startDate: '2026-05-01',
      endDate: '2026-01-01',
    });

    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.path).toEqual(['endDate']);
  });
});

describe('archivePatrimonySchema', () => {
  it('exige o estado como booleano', () => {
    expect(archivePatrimonySchema.safeParse({ id: 'a1', archived: true }).success).toBe(true);
    expect(archivePatrimonySchema.safeParse({ id: 'a1', archived: 'sim' }).success).toBe(false);
    expect(archivePatrimonySchema.safeParse({ id: 'a1' }).success).toBe(false);
  });
});
