import { describe, expect, it } from 'vitest';

import { confirmImportSchema, previewImportSchema } from '../domain/import';

/**
 * O cartão do extrato é opcional nos dois pedidos.
 *
 * Obrigatório seria errado (um extrato de conta não tem cartão) e proibido seria
 * pior (o utilizador não podia dizer que o ficheiro é de um cartão). O que estes
 * testes fixam é isso: presente é aceite, ausente continua válido, e um id vazio
 * não passa.
 */

const LINHA = {
  date: '2026-10-02',
  description: 'compra',
  amountInCents: -350,
  fitId: null,
  categoryId: null,
};

describe('confirmImportSchema', () => {
  it('aceita sem cartão', () => {
    expect(confirmImportSchema.safeParse({ accountId: 'a1', rows: [LINHA] }).success).toBe(true);
  });

  it('aceita com cartão', () => {
    const resultado = confirmImportSchema.safeParse({
      accountId: 'a1',
      cardId: 'c1',
      rows: [LINHA],
    });

    expect(resultado.success).toBe(true);
    expect(resultado.data?.cardId).toBe('c1');
  });

  it('recusa um cartão vazio', () => {
    expect(
      confirmImportSchema.safeParse({ accountId: 'a1', cardId: '', rows: [LINHA] }).success,
    ).toBe(false);
  });

  it('continua a exigir linhas', () => {
    expect(confirmImportSchema.safeParse({ accountId: 'a1', rows: [] }).success).toBe(false);
  });
});

describe('previewImportSchema', () => {
  it('aceita sem cartão e com cartão', () => {
    expect(previewImportSchema.safeParse({ accountId: 'a1', content: 'x' }).success).toBe(true);
    expect(
      previewImportSchema.safeParse({ accountId: 'a1', content: 'x', cardId: 'c1' }).success,
    ).toBe(true);
  });

  it('recusa cartão vazio', () => {
    expect(
      previewImportSchema.safeParse({ accountId: 'a1', content: 'x', cardId: '' }).success,
    ).toBe(false);
  });
});
