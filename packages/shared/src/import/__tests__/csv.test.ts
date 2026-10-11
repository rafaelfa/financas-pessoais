import { describe, expect, it } from 'vitest';

import { formatCentsForCsv } from '../cents';
import {
  CSV_EXPORT_HEADERS,
  detectSeparator,
  parseCsvDocument,
  parseDelimited,
  parseStatementDate,
  serializeCsv,
} from '../csv';
import { PT_CSV, readSample } from './helpers';

/**
 * Testes do parser CSV.
 *
 * O caso central é o extrato português de `docs/spec/samples/extrato-csv-pt.csv`,
 * com os valores fixados em `docs/spec/T0.8-smoke-tests.md` §3. O último bloco
 * fecha o ciclo exportar → reimportar, que é o que garante que uma exportação da
 * aplicação volta a entrar sem perder cêntimos e sem duplicar nada.
 */

const sample = parseCsvDocument(readSample(PT_CSV));

describe('parseCsvDocument — amostra portuguesa', () => {
  it('deteta o separador ponto e vírgula', () => {
    expect(sample.separator).toBe(';');
    expect(detectSeparator(readSample(PT_CSV))).toBe(';');
  });

  it('ignora as linhas de comentário e lê as 6 linhas de dados', () => {
    expect(sample.headers).toEqual(['Data', 'Descrição', 'Valor', 'Saldo']);
    expect(sample.rows).toHaveLength(6);
  });

  it('converte os valores portugueses em cêntimos', () => {
    const amounts = sample.rows.map((row) => row.amountInCents);

    expect(amounts).toEqual([215_000, -85_000, -6_437, 120_000, -31_245, -5_000]);
    expect(amounts.reduce<number>((total, value) => total + (value ?? 0), 0)).toBe(207_318);
  });

  it('não parte a descrição que tem ponto e vírgula entre aspas', () => {
    expect(sample.rows[2]?.description).toBe('Compra Continente; Matosinhos');
    expect(sample.rows[5]?.date).toBe('2026-10-09');
    expect(sample.rows[5]?.description).toBe('Levantamento multibanco');
  });

  it('lê as datas no formato dia/mês/ano', () => {
    expect(sample.rows[0]?.date).toBe('2026-10-01');
    expect(sample.rows[5]?.date).toBe('2026-10-09');
  });

  it('confere contra a coluna Saldo do próprio extrato', () => {
    expect(sample.rows[5]?.balanceInCents).toBe(457_318);
    expect(sample.lastBalanceInCents).toBe(457_318);
  });

  it('não reporta problemas nas 6 linhas', () => {
    expect(sample.issues).toEqual([]);
  });
});

describe('parseCsvDocument — dialectos e casos limite', () => {
  it('lê o separador de vírgula com valores en-US', () => {
    const statement = parseCsvDocument(
      ['Date,Description,Amount,Balance', '2026-10-01,Paycheck,"2,150.00","4,650.00"'].join('\n'),
    );

    expect(statement.separator).toBe(',');
    expect(statement.rows[0]?.amountInCents).toBe(215_000);
    expect(statement.rows[0]?.balanceInCents).toBe(465_000);
    expect(statement.rows[0]?.date).toBe('2026-10-01');
  });

  it('aceita cêntimos brasileiros com vírgula decimal', () => {
    const statement = parseCsvDocument(
      ['Data;Descrição;Valor', '05/03/2026;Padaria;-74,40'].join('\n'),
    );

    expect(statement.rows[0]?.amountInCents).toBe(-7_440);
  });

  it('não parte a descrição com aspas escapadas e ponto e vírgula', () => {
    const statement = parseCsvDocument(
      ['Data;Descrição;Valor', '01/10/2026;"Compra ""especial""; Lisboa";-10,00'].join('\n'),
    );

    expect(statement.rows[0]?.description).toBe('Compra "especial"; Lisboa');
  });

  it('lê uma descrição que ocupa duas linhas por estar entre aspas', () => {
    const statement = parseCsvDocument(
      ['Data;Descrição;Valor', '01/10/2026;"Renda\nde outubro";-850,00'].join('\n'),
    );

    expect(statement.rows).toHaveLength(1);
    expect(statement.rows[0]?.description).toBe('Renda\nde outubro');
    expect(statement.rows[0]?.amountInCents).toBe(-85_000);
  });

  it('declara uma data impossível em vez de a inventar', () => {
    const statement = parseCsvDocument(
      ['Data;Descrição;Valor', '31/02/2026;Coisa;-10,00'].join('\n'),
    );

    expect(statement.rows[0]?.date).toBeNull();
    expect(statement.issues.some((issue) => issue.field === 'Data')).toBe(true);
  });

  it('declara um valor ilegível e continua', () => {
    const statement = parseCsvDocument(
      ['Data;Descrição;Valor', '01/10/2026;Bom;-10,00', '02/10/2026;Mau;não sei'].join('\n'),
    );

    expect(statement.rows).toHaveLength(2);
    expect(statement.rows[0]?.amountInCents).toBe(-1_000);
    expect(statement.rows[1]?.amountInCents).toBeNull();
    expect(statement.issues.some((issue) => issue.field === 'Valor')).toBe(true);
  });

  it('cai no posicional quando não reconhece o cabeçalho, e di-lo', () => {
    const statement = parseCsvDocument(['A;B;C;D', '01/10/2026;Coisa;-10,00;100,00'].join('\n'));

    expect(statement.rows).toHaveLength(1);
    expect(statement.rows[0]?.amountInCents).toBe(-1_000);
    expect(statement.rows[0]?.balanceInCents).toBe(10_000);
    expect(statement.issues.some((issue) => issue.field === 'cabeçalho')).toBe(true);
  });

  it('não lança com um ficheiro vazio nem com comentários apenas', () => {
    expect(parseCsvDocument('').rows).toEqual([]);
    expect(parseCsvDocument('').issues[0]?.message).toContain('vazio');
    expect(parseCsvDocument('# só um comentário').rows).toEqual([]);
  });

  it('aceita o ficheiro sem marca de ordem de bytes e com CRLF', () => {
    const statement = parseCsvDocument('Data;Descrição;Valor\r\n01/10/2026;Coisa;-10,00\r\n');

    expect(statement.rows).toHaveLength(1);
    expect(statement.rows[0]?.amountInCents).toBe(-1_000);
  });

  it('lê a coluna Id como fitId, a chave de deduplicação', () => {
    const statement = parseCsvDocument(
      ['Data;Descrição;Valor;Id', '2026-09-01;COMPRA;-24,90;20260901000001'].join('\n'),
    );

    expect(statement.rows[0]?.fitId).toBe('20260901000001');
    expect(statement.rows[0]?.date).toBe('2026-09-01');
  });
});

describe('parseStatementDate', () => {
  it('lê os formatos que os bancos usam', () => {
    expect(parseStatementDate('01/10/2026')).toBe('2026-10-01');
    expect(parseStatementDate('1/10/2026')).toBe('2026-10-01');
    expect(parseStatementDate('2026-10-01')).toBe('2026-10-01');
    expect(parseStatementDate('01-10-2026')).toBe('2026-10-01');
    expect(parseStatementDate('01.10.2026')).toBe('2026-10-01');
    expect(parseStatementDate('01/10/26')).toBe('2026-10-01');
  });

  it('interpreta o dia primeiro, como em pt-PT', () => {
    expect(parseStatementDate('05/10/2026')).toBe('2026-10-05');
    expect(parseStatementDate('10/05/2026')).toBe('2026-05-10');
  });

  it('recusa o que não é data', () => {
    expect(parseStatementDate('')).toBeNull();
    expect(parseStatementDate('ontem')).toBeNull();
    expect(parseStatementDate('2026-13-01')).toBeNull();
    expect(parseStatementDate('2026-02-30')).toBeNull();
  });
});

describe('parseDelimited', () => {
  it('trata aspas, separadores e mudanças de linha', () => {
    const lines = parseDelimited('a;b;"c;d"\n1;2;3', ';');

    expect(lines).toHaveLength(2);
    expect(lines[0]?.fields).toEqual(['a', 'b', 'c;d']);
    expect(lines[1]?.fields).toEqual(['1', '2', '3']);
  });

  it('separa um campo com mudança de linha dentro de aspas', () => {
    const lines = parseDelimited('a;"b\nc";d', ';');

    expect(lines).toHaveLength(1);
    expect(lines[0]?.fields).toEqual(['a', 'b\nc', 'd']);
  });
});

describe('ciclo exportar → importar', () => {
  it('o CSV exportado é aceite pelo importador, cêntimo a cêntimo', () => {
    const rows: string[][] = [
      [...CSV_EXPORT_HEADERS],
      [
        '2026-09-01',
        'COMPRA CARTAO CONTINENTE MATOSINHOS',
        formatCentsForCsv(-2_490),
        '',
        '20260901000001',
      ],
      [
        '2026-09-02',
        'TRANSFERENCIA RECEBIDA ORDEM JOAO SILVA',
        formatCentsForCsv(125_000),
        '',
        '20260902000002',
      ],
      [
        '2026-09-05',
        'Compra Continente; Matosinhos',
        formatCentsForCsv(-6_437),
        '',
        '20260905000003',
      ],
      [
        '2026-09-09',
        'Depósito "especial" — café & pastelaria',
        formatCentsForCsv(0),
        '',
        '20260909000004',
      ],
      [
        '2026-09-15',
        'Linha com ; ponto e vírgula',
        formatCentsForCsv(1_234_567),
        '',
        '20260915000005',
      ],
    ];

    const exported = serializeCsv(rows);
    const imported = parseCsvDocument(exported);

    expect(imported.issues).toEqual([]);
    expect(imported.rows).toHaveLength(5);
    expect(imported.rows.map((row) => row.amountInCents)).toEqual([
      -2_490, 125_000, -6_437, 0, 1_234_567,
    ]);
    expect(imported.rows.map((row) => row.date)).toEqual([
      '2026-09-01',
      '2026-09-02',
      '2026-09-05',
      '2026-09-09',
      '2026-09-15',
    ]);
    expect(imported.rows[2]?.description).toBe('Compra Continente; Matosinhos');
    expect(imported.rows[3]?.description).toBe('Depósito "especial" — café & pastelaria');
    expect(imported.rows.map((row) => row.fitId)).toEqual([
      '20260901000001',
      '20260902000002',
      '20260905000003',
      '20260909000004',
      '20260915000005',
    ]);
  });

  it('exporta uma descrição com aspas sem a estragar', () => {
    const exported = serializeCsv([
      ['Data', 'Descrição', 'Valor'],
      ['2026-09-01', 'Diz "olá"; agora', '-1,00'],
    ]);
    const imported = parseCsvDocument(exported);

    expect(imported.rows[0]?.description).toBe('Diz "olá"; agora');
    expect(imported.rows[0]?.amountInCents).toBe(-100);
  });

  it('escreve a marca de ordem de bytes e o separador que o Excel em pt-PT espera', () => {
    const exported = serializeCsv([
      ['Data', 'Valor'],
      ['2026-09-01', '-1,00'],
    ]);

    expect(exported.startsWith('\uFEFF')).toBe(true);
    expect(exported).toContain('Data;Valor');
    expect(exported.endsWith('\r\n')).toBe(true);
  });
});
