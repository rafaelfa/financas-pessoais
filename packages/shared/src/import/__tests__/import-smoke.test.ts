import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse as parseCsv } from 'csv-parse/sync';
import { parseStrict } from 'ofx-js';
import { describe, expect, it } from 'vitest';

import { parseCurrencyToCents } from '../../utils/currency';

/**
 * Smoke tests de importação de extratos (Fase 0, tarefa T0.8).
 *
 * Não testam código nosso: **provam que as bibliotecas escolhidas leem mesmo**
 * os ficheiros que os bancos portugueses produzem, antes de existir UI. As
 * amostras são sintéticas e os resultados esperados estão fixados em
 * `docs/spec/T0.8-smoke-tests.md`.
 *
 * A Fase 7 substitui isto pelo parser a sério e pelos seus próprios testes;
 * até lá é a única prova de que a importação é viável.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const SAMPLES_DIR = resolve(HERE, '../../../../../docs/spec/samples');

function readSample(name: string): string {
  return readFileSync(resolve(SAMPLES_DIR, name), 'utf8');
}

type Json = Record<string, unknown>;

function asRecord(value: unknown): Json | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Json)
    : undefined;
}

/** O `ofx-js` devolve objeto quando há 1 elemento e array quando há vários (I6). */
function toArray(value: unknown): unknown[] {
  if (value === undefined || value === null) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Valores OFX vêm como texto, com ponto ou vírgula decimal — nunca como número. */
function amountToCents(value: unknown): number {
  if (typeof value === 'number') {
    return Math.round(value * 100);
  }

  const cents = parseCurrencyToCents(text(value));

  if (cents === null) {
    throw new Error(`Valor monetário OFX ilegível: ${JSON.stringify(value)}`);
  }

  return cents;
}

interface OfxTransaction {
  readonly trnType: string;
  readonly postedAt: string;
  readonly amountInCents: number;
  readonly fitId: string;
  readonly memo: string;
}

function parseStatement(ofxText: string) {
  const parsed = parseStrict(ofxText);
  const root = asRecord(parsed.OFX);
  const bankMessages = asRecord(root?.['BANKMSGSRSV1']);
  const statementResponse = asRecord(toArray(bankMessages?.['STMTTRNRS'])[0]);
  const statement = asRecord(statementResponse?.['STMTRS']);
  const transactionList = asRecord(statement?.['BANKTRANLIST']);
  const rawTransactions = transactionList?.['STMTTRN'];
  const ledgerBalance = asRecord(statement?.['LEDGERBAL']);

  const transactions: OfxTransaction[] = toArray(rawTransactions).map((raw) => {
    const entry: Json = asRecord(raw) ?? {};

    return {
      trnType: text(entry['TRNTYPE']),
      postedAt: text(entry['DTPOSTED']),
      amountInCents: amountToCents(entry['TRNAMT']),
      fitId: text(entry['FITID']),
      memo: text(entry['MEMO']),
    };
  });

  return {
    header: parsed.header,
    currency: text(statement?.['CURDEF']),
    accountId: text(asRecord(statement?.['BANKACCTFROM'])?.['ACCTID']),
    ledgerBalanceInCents: amountToCents(ledgerBalance?.['BALAMT']),
    rawTransactions,
    transactions,
  };
}

const EXPECTED_FIT_IDS = [
  '20260901000001',
  '20260902000002',
  '20260903000003',
  '20260904000004',
  '20260907000005',
  '20260910000006',
  '20260915000007',
  '20260918000008',
  '20260922000009',
  '20260928000010',
];

describe('OFX 1.x SGML — ofx-js', () => {
  const statement = parseStatement(readSample('extrato-ofx1-sgml.ofx'));

  it('extrai as 10 transações e a soma correta', () => {
    expect(statement.transactions).toHaveLength(10);
    expect(statement.transactions.reduce((total, t) => total + t.amountInCents, 0)).toBe(-3_612);
  });

  it('lê os metadados da conta e o saldo do extrato', () => {
    expect(statement.currency).toBe('EUR');
    expect(statement.accountId).toBe('0001234567890');
    expect(statement.ledgerBalanceInCents).toBe(-3_612);
  });

  it('lê o cabeçalho SGML antes do <OFX>', () => {
    expect(statement.header['OFXHEADER']).toBe('100');
    expect(statement.header['DATA']).toBe('OFXSGML');
    expect(statement.header['VERSION']).toBe('102');
    expect(Object.keys(statement.header)).toHaveLength(9);
  });

  it('acerta nos sinais das transações', () => {
    const amounts = statement.transactions.map((t) => t.amountInCents);

    expect(amounts).toEqual([
      -2_490, 125_000, -9_235, -6_000, -134_567, -485, -4_500, 31_245, -1_830, -750,
    ]);
  });

  it('normaliza o decimal com ponto sem perder cêntimos', () => {
    expect(statement.transactions[4]?.amountInCents).toBe(-134_567);
  });

  it('preserva os FITID, que são a chave de deduplicação', () => {
    const fitIds = statement.transactions.map((t) => t.fitId);

    expect(fitIds).toEqual(EXPECTED_FIT_IDS);
    expect(new Set(fitIds).size).toBe(10);
  });

  it('lê as datas de 14 dígitos sem sufixo de fuso', () => {
    for (const transaction of statement.transactions) {
      expect(transaction.postedAt).toMatch(/^\d{14}$/);
    }
  });

  it('não estraga acentos nem deixa entidades por descodificar', () => {
    expect(statement.transactions[8]?.memo).toContain('SERVIÇOS MUNICIPAIS');
    expect(statement.transactions[8]?.memo).toContain('ÁGUA');
    expect(statement.transactions[9]?.memo).toBe('COMPRA CAFE & PASTELARIA CENTRAL');
  });
});

describe('OFX 1.x SGML — extrato mínimo', () => {
  it('lê uma única transação', () => {
    const statement = parseStatement(readSample('extrato-ofx1-sgml-minimo.ofx'));

    expect(statement.transactions).toHaveLength(1);
    expect(statement.transactions[0]?.amountInCents).toBe(-1_250);
    expect(statement.transactions[0]?.fitId).toBe('20261005000001');
    expect(statement.ledgerBalanceInCents).toBe(-1_250);
  });

  it('devolve objeto em vez de array quando só há uma transação (ambiguidade a normalizar)', () => {
    const statement = parseStatement(readSample('extrato-ofx1-sgml-minimo.ofx'));

    expect(Array.isArray(statement.rawTransactions)).toBe(false);
  });
});

describe('OFX 1.x SGML — limite conhecido', () => {
  it('recusa um ficheiro sem nenhuma tag de fecho em vez de devolver dados errados', () => {
    const semFechos = readSample('extrato-ofx1-sgml.ofx')
      .split(/\r?\n/)
      .filter((line) => !/^\s*<\/[A-Za-z0-9]+>\s*$/.test(line))
      .join('\n');

    expect(semFechos).not.toContain('</STMTTRN>');
    expect(() => parseStrict(semFechos)).toThrow(/closing tag/i);
  });
});

describe('CSV português — csv-parse', () => {
  const records = parseCsv(readSample('extrato-csv-pt.csv'), {
    delimiter: ';',
    comment: '#',
    bom: true,
    skip_empty_lines: true,
    columns: true,
    trim: true,
  }) as Record<string, string>[];

  const amounts = records.map((record) => {
    const cents = parseCurrencyToCents(record['Valor'] ?? '');

    if (cents === null) {
      throw new Error(`Valor CSV ilegível: ${record['Valor']}`);
    }

    return cents;
  });

  it('ignora os comentários e lê as 6 linhas de dados', () => {
    expect(records).toHaveLength(6);
  });

  it('converte os valores portugueses em cêntimos', () => {
    expect(amounts).toEqual([215_000, -85_000, -6_437, 120_000, -31_245, -5_000]);
    expect(amounts.reduce((total, value) => total + value, 0)).toBe(207_318);
  });

  it('confere contra a coluna Saldo do próprio extrato', () => {
    expect(parseCurrencyToCents(records[5]?.['Saldo'] ?? '')).toBe(457_318);
  });

  it('não parte a descrição que tem ponto e vírgula entre aspas', () => {
    expect(records[2]?.['Descrição']).toBe('Compra Continente; Matosinhos');
    expect(records[5]?.['Data']).toBe('09/10/2026');
    expect(records[5]?.['Descrição']).toBe('Levantamento multibanco');
  });

  it('lê as datas no formato dia/mês/ano', () => {
    for (const record of records) {
      expect(record['Data']).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    }

    expect(records[0]?.['Data']).toBe('01/10/2026');
  });
});
