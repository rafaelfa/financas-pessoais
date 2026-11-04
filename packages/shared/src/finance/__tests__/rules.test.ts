import { describe, expect, it } from 'vitest';

import {
  classifyTransaction,
  invalidRules,
  matchesRule,
  normalizeText,
  previewClassification,
  ruleHasCondition,
} from '../rules';
import type { FinanceTransaction, FinanceTransactionRule } from '../types';

function rule(overrides: Partial<FinanceTransactionRule> & { id: string }): FinanceTransactionRule {
  return {
    name: 'Regra',
    priority: 1,
    kind: 'expense',
    targetCategoryId: 'cat-food',
    ...overrides,
  };
}

function transaction(overrides: Partial<FinanceTransaction> & { id: string }): FinanceTransaction {
  return {
    kind: 'expense',
    status: 'confirmed',
    amountInCents: -9_235,
    date: '2026-10-03',
    accountId: 'acc-checking',
    description: 'PAGAMENTO SERVIÇOS EDP COMERCIAL',
    settled: true,
    ...overrides,
  };
}

describe('normalização de texto', () => {
  it('ignora maiúsculas, acentos e espaços nas pontas', () => {
    expect(normalizeText('  PAGAMENTO SERVIÇOS  ')).toBe('pagamento servicos');
    expect(normalizeText('Água')).toBe('agua');
  });
});

describe('validação das regras', () => {
  it('exige pelo menos uma condição', () => {
    expect(ruleHasCondition(rule({ id: 'r1' }))).toBe(false);
    expect(ruleHasCondition(rule({ id: 'r2', descriptionContains: 'edp' }))).toBe(true);
    expect(ruleHasCondition(rule({ id: 'r3', dayMin: 1, dayMax: 5 }))).toBe(true);
  });

  it('lista as regras inválidas para a interface as assinalar', () => {
    const invalid = invalidRules([
      rule({ id: 'vazia' }),
      rule({ id: 'valida', amountMinInCents: 100 }),
    ]);

    expect(invalid.map((item) => item.id)).toEqual(['vazia']);
  });
});

describe('correspondência de uma regra', () => {
  it('encontra a descrição sem distinguir maiúsculas nem acentos', () => {
    const matches = matchesRule(
      transaction({ id: 't1' }),
      rule({ id: 'r1', descriptionContains: 'pagamento servicos' }),
    );

    expect(matches).toBe(true);
  });

  it('não corresponde quando a descrição não contém o texto', () => {
    expect(
      matchesRule(transaction({ id: 't1' }), rule({ id: 'r1', descriptionContains: 'continente' })),
    ).toBe(false);
  });

  it('corresponde por contraparte exata', () => {
    const withCounterparty = transaction({ id: 't1', counterparty: '500123456' });

    expect(matchesRule(withCounterparty, rule({ id: 'r1', counterparty: '500123456' }))).toBe(true);
    expect(matchesRule(withCounterparty, rule({ id: 'r2', counterparty: '500999999' }))).toBe(
      false,
    );
  });

  it('respeita a faixa de valores sobre a magnitude', () => {
    expect(
      matchesRule(transaction({ id: 't1' }), rule({ id: 'r1', amountMinInCents: 9_000 })),
    ).toBe(true);
    expect(
      matchesRule(transaction({ id: 't1' }), rule({ id: 'r2', amountMaxInCents: 5_000 })),
    ).toBe(false);
  });

  it('respeita o intervalo de dias do mês', () => {
    const early = transaction({ id: 't1', date: '2026-10-03' });
    const late = transaction({ id: 't2', date: '2026-10-25' });

    expect(matchesRule(early, rule({ id: 'r1', dayMin: 1, dayMax: 5 }))).toBe(true);
    expect(matchesRule(late, rule({ id: 'r1', dayMin: 1, dayMax: 5 }))).toBe(false);
  });

  it('respeita a conta', () => {
    expect(
      matchesRule(transaction({ id: 't1' }), rule({ id: 'r1', accountId: 'acc-checking' })),
    ).toBe(true);
    expect(
      matchesRule(transaction({ id: 't1' }), rule({ id: 'r2', accountId: 'acc-savings' })),
    ).toBe(false);
  });

  it('combina as condições por conjunção: basta uma falhar para não corresponder', () => {
    const combined = rule({
      id: 'r1',
      descriptionContains: 'edp',
      amountMinInCents: 1,
      amountMaxInCents: 5_000,
    });

    expect(matchesRule(transaction({ id: 't1' }), combined)).toBe(false);
    expect(matchesRule(transaction({ id: 't2', amountInCents: -4_000 }), combined)).toBe(true);
  });

  it('não corresponde a tipos diferentes nem a operações sem categoria', () => {
    expect(
      matchesRule(
        transaction({ id: 't1', kind: 'income' }),
        rule({ id: 'r1', kind: 'expense', descriptionContains: 'edp' }),
      ),
    ).toBe(false);

    for (const kind of ['transfer', 'invoice_payment', 'goal_deposit', 'balance_adjust'] as const) {
      expect(
        matchesRule(
          transaction({ id: 't1', kind }),
          rule({ id: 'r1', descriptionContains: 'edp' }),
        ),
      ).toBe(false);
    }
  });

  it('nunca corresponde a transações ignoradas', () => {
    expect(
      matchesRule(
        transaction({ id: 't1', status: 'ignored' }),
        rule({ id: 'r1', descriptionContains: 'edp' }),
      ),
    ).toBe(false);
  });
});

describe('precedência e pré-visualização', () => {
  const transactions = [
    transaction({ id: 't1' }),
    transaction({ id: 't2', description: 'COMPRA CONTINENTE MATOSINHOS', amountInCents: -2_490 }),
  ];
  const rules = [
    rule({ id: 'generic', name: 'Genérica', priority: 90, descriptionContains: 'compra' }),
    rule({
      id: 'specific',
      name: 'Específica',
      priority: 10,
      descriptionContains: 'continente',
      targetCategoryId: 'cat-groceries',
    }),
  ];

  it('ganha a regra com prioridade mais baixa', () => {
    const match = classifyTransaction(transactions[1] as FinanceTransaction, rules);

    expect(match?.ruleId).toBe('specific');
    expect(match?.categoryId).toBe('cat-groceries');
  });

  it('devolve null quando nenhuma regra corresponde', () => {
    expect(classifyTransaction(transactions[0] as FinanceTransaction, [])).toBeNull();
  });

  it('pré-visualiza todos os pares sem alterar nada', () => {
    const preview = previewClassification(transactions, rules);

    // Só a segunda transação corresponde a alguma regra: a primeira tem a
    // descrição "PAGAMENTO SERVIÇOS EDP COMERCIAL" e nenhuma regra a apanha.
    expect(preview.map((match) => match.transactionId)).toEqual(['t2']);
    expect(preview[0]?.ruleName).toBe('Específica');
    expect(preview[0]?.categoryId).toBe('cat-groceries');
  });
});

describe('condição por cartão', () => {
  const regraDoCartao = rule({ id: 'r-card', cardId: 'card-1' });

  it('uma regra só com cartão é uma regra válida', () => {
    expect(ruleHasCondition(regraDoCartao)).toBe(true);
    expect(invalidRules([regraDoCartao])).toEqual([]);
  });

  it('aplica-se a uma transação desse cartão', () => {
    expect(matchesRule(transaction({ id: 't1', cardId: 'card-1' }), regraDoCartao)).toBe(true);
  });

  it('não se aplica a uma transação de outro cartão', () => {
    expect(matchesRule(transaction({ id: 't2', cardId: 'card-2' }), regraDoCartao)).toBe(false);
  });

  /*
   * Uma transação sem cartão é dinheiro que não passou por cartão nenhum: a
   * condição «só neste cartão» não se verifica. É a mesma semântica do
   * `accountId`, que exige igualdade e não «ausente conta como tudo».
   */
  it('não se aplica a uma transação sem cartão', () => {
    expect(matchesRule(transaction({ id: 't3' }), regraDoCartao)).toBe(false);
  });

  it('com cartão e descrição, exigem-se as duas condições', () => {
    const regra = rule({ id: 'r-card-desc', cardId: 'card-1', descriptionContains: 'edp' });

    expect(
      matchesRule(transaction({ id: 'a', cardId: 'card-1', description: 'EDP Comercial' }), regra),
    ).toBe(true);
    // a descrição bate, o cartão não
    expect(
      matchesRule(transaction({ id: 'b', cardId: 'card-2', description: 'EDP Comercial' }), regra),
    ).toBe(false);
    // o cartão bate, a descrição não
    expect(
      matchesRule(transaction({ id: 'c', cardId: 'card-1', description: 'Águas do Porto' }), regra),
    ).toBe(false);
  });
});
