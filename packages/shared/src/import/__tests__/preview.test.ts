import { describe, expect, it } from 'vitest';

import { parseCsvDocument } from '../csv';
import { parseOfxDocument } from '../ofx';
import { fingerprintOf, previewFromCsv, previewFromOfx } from '../preview';
import type { FinanceTransactionRule } from '../../finance/types';
import { MAIN_OFX, readSample } from './helpers';

/**
 * Testes da pré-visualização: estados das linhas, duplicados e sugestões.
 *
 * É a camada onde um erro custa mais caro — é ela que decide o que a pessoa vê
 * antes de aceitar, e um duplicado que passe por "novo" duplica o extrato inteiro
 * no saldo da conta. Por isso os casos aqui são de fronteira: duplicado por
 * `fitId`, duplicado sem `fitId` (CSV), repetido dentro do próprio ficheiro,
 * linha sem valor e divergência de saldo.
 */

const ACCOUNT = {
  id: 'acc-1',
  name: 'Conta ordenado',
  openingBalanceInCents: 0,
  balanceInCents: 100_000,
};

const RULES: readonly FinanceTransactionRule[] = [
  {
    id: 'rule-renda',
    name: 'Renda',
    priority: 1,
    kind: 'expense',
    descriptionContains: 'renda',
    targetCategoryId: 'cat-habitacao',
  },
  {
    id: 'rule-salario',
    name: 'Salário',
    priority: 2,
    kind: 'income',
    descriptionContains: 'vencimento',
    targetCategoryId: 'cat-salario',
  },
];

const CATEGORY_NAMES = new Map([
  ['cat-habitacao', 'Habitação'],
  ['cat-salario', 'Salário'],
]);

describe('fingerprintOf', () => {
  it('junta data, valor e descrição normalizada', () => {
    expect(fingerprintOf('2026-10-01', -85_000, 'Renda  CASA outubro')).toBe(
      '2026-10-01|-85000|renda casa outubro',
    );
  });

  it('devolve null quando falta a data ou o valor', () => {
    expect(fingerprintOf(null, -100, 'x')).toBeNull();
    expect(fingerprintOf('2026-10-01', null, 'x')).toBeNull();
  });
});

describe('previewFromOfx — amostra principal', () => {
  const statement = parseOfxDocument(readSample(MAIN_OFX));

  it('marca as 10 linhas como novas e soma débitos e créditos', () => {
    const preview = previewFromOfx({
      account: ACCOUNT,
      statement,
      existing: [],
      rules: { rules: [], categoryNames: new Map() },
    });

    expect(preview.rows).toHaveLength(10);
    expect(preview.newCount).toBe(10);
    expect(preview.duplicateCount).toBe(0);
    expect(preview.suspiciousCount).toBe(0);
    expect(preview.rows.every((row) => row.selected)).toBe(true);
    // 8 débitos = 159 857 cêntimos; 2 créditos = 156 245 cêntimos.
    expect(preview.totalDebitsInCents).toBe(159_857);
    expect(preview.totalCreditsInCents).toBe(156_245);
    expect(preview.impliedEndBalanceInCents).toBe(-3_612);
  });

  it('reconhece um duplicado pelo fitId e deixa-o desmarcado', () => {
    const preview = previewFromOfx({
      account: ACCOUNT,
      statement,
      existing: [
        {
          fitId: '20260901000001',
          date: new Date(Date.UTC(2026, 8, 1)),
          amountInCents: -2_490,
          description: 'COMPRA CARTAO CONTINENTE MATOSINHOS',
        },
      ],
      rules: { rules: [], categoryNames: new Map() },
    });

    expect(preview.duplicateCount).toBe(1);
    expect(preview.newCount).toBe(9);
    expect(preview.rows[0]?.status).toBe('duplicate');
    expect(preview.rows[0]?.selected).toBe(false);
    expect(preview.rows[0]?.reason).toContain('identificador do banco');
  });

  it('reimportar o mesmo ficheiro marca tudo como duplicado', () => {
    const existing = statement.transactions.map((transaction) => ({
      fitId: transaction.fitId,
      date: new Date(`${transaction.date ?? '2026-01-01'}T00:00:00.000Z`),
      amountInCents: transaction.amountInCents ?? 0,
      description: transaction.memo,
    }));

    const preview = previewFromOfx({
      account: ACCOUNT,
      statement,
      existing,
      rules: { rules: [], categoryNames: new Map() },
    });

    expect(preview.newCount).toBe(0);
    expect(preview.duplicateCount).toBe(10);
    expect(preview.rows.every((row) => !row.selected)).toBe(true);
  });

  it('sugere categorias pelo motor de regras, e não por heurística nova', () => {
    const preview = previewFromCsv({
      account: ACCOUNT,
      statement: parseCsvDocument(
        [
          'Data;Descrição;Valor',
          '01/10/2026;Renda casa outubro;-850,00',
          '05/10/2026;Vencimento outubro;2.150,00',
          '06/10/2026;Compra Continente;-64,37',
        ].join('\n'),
      ),
      existing: [],
      rules: { rules: RULES, categoryNames: CATEGORY_NAMES },
    });

    expect(preview.rows[0]?.suggestedCategoryId).toBe('cat-habitacao');
    expect(preview.rows[0]?.suggestedCategoryName).toBe('Habitação');
    expect(preview.rows[1]?.suggestedCategoryId).toBe('cat-salario');
    // Sem regra que corresponda, não se inventa sugestão.
    expect(preview.rows[2]?.suggestedCategoryId).toBeNull();
  });

  it('não sugere categoria a linhas suspeitas nem duplicadas', () => {
    const preview = previewFromCsv({
      account: ACCOUNT,
      statement: parseCsvDocument(
        [
          'Data;Descrição;Valor;Id',
          '01/10/2026;Renda casa outubro;;SEM-VALOR',
          '02/10/2026;Renda de setembro;-850,00;JA-EXISTE',
        ].join('\n'),
      ),
      existing: [
        {
          fitId: 'JA-EXISTE',
          date: new Date(Date.UTC(2026, 9, 2)),
          amountInCents: -85_000,
          description: 'Renda de setembro',
        },
      ],
      rules: { rules: RULES, categoryNames: CATEGORY_NAMES },
    });

    expect(preview.rows[0]?.status).toBe('suspicious');
    expect(preview.rows[0]?.suggestedCategoryId).toBeNull();
    expect(preview.rows[1]?.status).toBe('duplicate');
    expect(preview.rows[1]?.suggestedCategoryId).toBeNull();
  });
});

describe('previewFromCsv — duplicados sem fitId', () => {
  const statement = parseCsvDocument(
    ['Data;Descrição;Valor', '01/10/2026;Renda casa outubro;-850,00'].join('\n'),
  );

  it('reconhece o duplicado pela data, valor e descrição', () => {
    const preview = previewFromCsv({
      account: ACCOUNT,
      statement,
      existing: [
        {
          fitId: null,
          date: new Date(Date.UTC(2026, 9, 1)),
          amountInCents: -85_000,
          description: 'renda  CASA outubro',
        },
      ],
      rules: { rules: [], categoryNames: new Map() },
    });

    expect(preview.rows[0]?.status).toBe('duplicate');
    expect(preview.rows[0]?.reason).toContain('data, valor e descrição');
    expect(preview.rows[0]?.reason).toContain('data, valor e descrição');
  });

  it('não confunde um valor diferente no mesmo dia', () => {
    const preview = previewFromCsv({
      account: ACCOUNT,
      statement,
      existing: [
        {
          fitId: null,
          date: new Date(Date.UTC(2026, 9, 1)),
          amountInCents: -85_001,
          description: 'Renda casa outubro',
        },
      ],
      rules: { rules: [], categoryNames: new Map() },
    });

    expect(preview.rows[0]?.status).toBe('new');
  });

  it('marca um movimento repetido dentro do próprio ficheiro', () => {
    const duplicated = parseCsvDocument(
      [
        'Data;Descrição;Valor',
        '01/10/2026;Renda casa outubro;-850,00',
        '01/10/2026;Renda casa outubro;-850,00',
      ].join('\n'),
    );

    const preview = previewFromCsv({
      account: ACCOUNT,
      statement: duplicated,
      existing: [],
      rules: { rules: [], categoryNames: new Map() },
    });

    expect(preview.rows[0]?.status).toBe('new');
    expect(preview.rows[1]?.status).toBe('duplicate');
    expect(preview.rows[1]?.reason).toContain('próprio ficheiro');
    // Só a primeira conta para os totais. Contar as duas punha o saldo implícito
    // a somar duas vezes o mesmo movimento — foi um defeito apanhado em revisão.
    expect(preview.totalDebitsInCents).toBe(85_000);
    expect(preview.impliedEndBalanceInCents).toBe(100_000 - 85_000);
  });

  it('conta nos totais apenas o que seria criado', () => {
    const statement = parseCsvDocument(
      [
        'Data;Descrição;Valor;Id',
        '01/10/2026;Já existe;-92,35;EDP-1',
        '02/10/2026;Renda casa outubro;-850,00;RENDA-1',
        '05/10/2026;Vencimento outubro;2.150,00;VEN-1',
      ].join('\n'),
    );

    const preview = previewFromCsv({
      account: ACCOUNT,
      statement,
      existing: [
        {
          fitId: 'EDP-1',
          date: new Date(Date.UTC(2026, 9, 1)),
          amountInCents: -9_235,
          description: 'Já existe',
        },
      ],
      rules: { rules: [], categoryNames: new Map() },
    });

    expect(preview.duplicateCount).toBe(1);
    expect(preview.newCount).toBe(2);
    expect(preview.totalDebitsInCents).toBe(85_000);
    expect(preview.totalCreditsInCents).toBe(215_000);
    expect(preview.impliedEndBalanceInCents).toBe(100_000 + 215_000 - 85_000);
  });
});

describe('preview — linhas suspeitas e saldo', () => {
  it('marca como suspeita a linha sem valor ou sem data', () => {
    const statement = parseCsvDocument(
      ['Data;Descrição;Valor', ';Sem data;-10,00', '02/10/2026;Sem valor;'].join('\n'),
    );

    const preview = previewFromCsv({
      account: ACCOUNT,
      statement,
      existing: [],
      rules: { rules: [], categoryNames: new Map() },
    });

    expect(preview.suspiciousCount).toBe(2);
    expect(preview.newCount).toBe(0);
    expect(preview.rows.every((row) => !row.selected)).toBe(true);
    expect(preview.rows[0]?.reason).not.toBeNull();
  });

  it('usa o saldo do ficheiro quando ele existe e avisa se divergir', () => {
    const statement = parseCsvDocument(
      ['Data;Descrição;Valor;Saldo', '01/10/2026;Coisa;-10,00;990,00'].join('\n'),
    );

    // Saldo da conta 1 020,00 € menos os 10,00 € lidos daria 1 010,00 €; o
    // ficheiro diz 990,00 €, portanto há 20,00 € que não batem certo.
    const divergente = previewFromCsv({
      account: { ...ACCOUNT, balanceInCents: 102_000 },
      statement,
      existing: [],
      rules: { rules: [], categoryNames: new Map() },
    });

    expect(divergente.impliedEndBalanceInCents).toBe(99_000);
    expect(divergente.warnings.some((warning) => warning.includes('não'))).toBe(true);

    // Com o saldo coerente, não há aviso.
    const coerente = previewFromCsv({
      account: { ...ACCOUNT, balanceInCents: 100_000 },
      statement,
      existing: [],
      rules: { rules: [], categoryNames: new Map() },
    });

    expect(coerente.warnings.some((warning) => warning.includes('não'))).toBe(false);
  });

  it('calcula o saldo implícito a partir do saldo da conta quando o ficheiro não o traz', () => {
    const preview = previewFromOfx({
      account: { ...ACCOUNT, openingBalanceInCents: 50_000, balanceInCents: null },
      statement: parseOfxDocument(
        [
          'OFXHEADER:100',
          'DATA:OFXSGML',
          '<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS>',
          '<BANKTRANLIST><STMTTRN>',
          '<DTPOSTED>20261001<TRNAMT>100.00<FITID>A1<MEMO>ENTRADA</STMTTRN>',
          '</BANKTRANLIST>',
          '</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>',
        ].join('\n'),
      ),
      existing: [],
      rules: { rules: [], categoryNames: new Map() },
    });

    expect(preview.impliedEndBalanceInCents).toBe(60_000);
  });

  it('avisa quando é um CSV com vírgula como separador', () => {
    const preview = previewFromCsv({
      account: ACCOUNT,
      statement: parseCsvDocument(
        ['Date,Description,Amount', '2026-10-01,Coisa,-10.00'].join('\n'),
      ),
      existing: [],
      rules: { rules: [], categoryNames: new Map() },
    });

    expect(preview.warnings.some((warning) => warning.includes('vírgula como separador'))).toBe(
      true,
    );
  });
});
