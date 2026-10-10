import { describe, expect, it } from 'vitest';

import { DEFAULT_CATEGORIES, DEFAULT_PRIMARY_ACCOUNT_NAME } from '../catalog';
import { slugify } from '../../schemas/domain/categories';

/**
 * O catálogo por omissão é o que um utilizador novo recebe no registo.
 * Se tiver nomes repetidos ou pais inexistentes, o aprovisionamento falha — e
 * falha no pior momento possível: depois de a pessoa ter criado a conta.
 */
describe('catálogo de categorias por omissão', () => {
  it('tem as 17 categorias de gasto e as 8 de ganho previstas', () => {
    const expense = DEFAULT_CATEGORIES.filter(
      (category) => category.kind === 'expense' && category.internal !== true,
    );
    const income = DEFAULT_CATEGORIES.filter((category) => category.kind === 'income');

    expect(expense).toHaveLength(17);
    expect(income).toHaveLength(8);
  });

  it('tem as 4 categorias internas, que nunca contam para os totais', () => {
    const internal = DEFAULT_CATEGORIES.filter((category) => category.internal === true);

    expect(internal.map((category) => category.name)).toEqual([
      'Transferência',
      'Fatura de cartão',
      'Ajuste de saldo',
      'Investimento',
    ]);
  });

  it('não repete nomes dentro do mesmo tipo', () => {
    const keys = DEFAULT_CATEGORIES.map((category) => `${category.kind}:${slugify(category.name)}`);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it('só aponta para categorias-mãe que existem no mesmo tipo', () => {
    const names = new Set(
      DEFAULT_CATEGORIES.map((category) => `${category.kind}:${slugify(category.name)}`),
    );

    for (const category of DEFAULT_CATEGORIES) {
      if (category.parent === undefined) {
        continue;
      }

      expect(names.has(`${category.kind}:${slugify(category.parent)}`)).toBe(true);
    }
  });

  it('tem um nome de carteira por omissão', () => {
    expect(DEFAULT_PRIMARY_ACCOUNT_NAME.length).toBeGreaterThan(0);
  });

  it('gera identificadores estáveis e sem acentos', () => {
    expect(slugify('Água, luz e gás')).toBe('agua-luz-e-gas');
    expect(slugify('Alimentação')).toBe('alimentacao');
    expect(slugify('Outros')).toBe('outros');
  });
});
