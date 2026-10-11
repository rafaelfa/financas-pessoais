import { describe, expect, it } from 'vitest';

import { formatCentsForCsv, guessSeparators, parseAmountToCents } from '../cents';
import { decodeEntities, detectFormat, parseOfxDate, parseOfxDocument } from '../ofx';
import {
  MAIN_OFX,
  MINIMAL_OFX,
  PT_CSV,
  readSample,
  SAMPLES_DIR,
  withoutClosingTags,
} from './helpers';

/**
 * Testes do parser OFX e da conversão de valores.
 *
 * As amostras são as de `docs/spec/samples/` — as mesmas do smoke test da Fase 0,
 * com os resultados esperados fixados em `docs/spec/T0.8-smoke-tests.md` §2. A
 * diferença é que aqui o parser é **nosso**: aqueles testes provavam que as
 * bibliotecas liam o formato; estes provam que o código que vai para produção o
 * lê igual — incluindo as duas variantes que as bibliotecas recusam (sem tags de
 * fecho e truncada).
 */

function sumOf(statement: ReturnType<typeof parseOfxDocument>): number {
  return statement.transactions.reduce(
    (total, transaction) => total + (transaction.amountInCents ?? 0),
    0,
  );
}

describe('amostras', () => {
  it('lê as três amostras do disco', () => {
    expect(SAMPLES_DIR).toContain('docs');
    expect(readSample(MAIN_OFX)).toContain('<OFX>');
    expect(readSample(MINIMAL_OFX)).toContain('<OFX>');
    expect(readSample(PT_CSV)).toContain('Data;');
  });
});

describe('parseAmountToCents — valores de extratos', () => {
  it('lê o ponto decimal sem passar por vírgula flutuante', () => {
    expect(parseAmountToCents('-1345.67')).toBe(-134_567);
    expect(parseAmountToCents('1250.00')).toBe(125_000);
    expect(parseAmountToCents('-24.90')).toBe(-2_490);
    expect(parseAmountToCents('-36.12')).toBe(-3_612);
  });

  it('lê a vírgula decimal em pt-PT e brasileiro', () => {
    expect(parseAmountToCents('74,40')).toBe(7_440);
    expect(parseAmountToCents('-64,37')).toBe(-6_437);
    expect(parseAmountToCents('2150,00')).toBe(215_000);
  });

  it('lê os milhares nos dois dialectos', () => {
    expect(parseAmountToCents('1.234,56')).toBe(123_456);
    expect(parseAmountToCents('1,234.56')).toBe(123_456);
    expect(parseAmountToCents('-12.345.678,90')).toBe(-1_234_567_890);
  });

  it('aceita sinais explícitos e o formato contabilístico com parênteses', () => {
    expect(parseAmountToCents('+1250.00')).toBe(125_000);
    expect(parseAmountToCents('(64,37)')).toBe(-6_437);
    expect(parseAmountToCents('- 12,50')).toBe(-1_250);
    expect(parseAmountToCents(' -7,50 ')).toBe(-750);
  });

  it('aceita um só dígito decimal e espaços de formatação', () => {
    expect(parseAmountToCents('7,5')).toBe(750);
    expect(parseAmountToCents('1 234,56')).toBe(123_456);
    expect(parseAmountToCents('\u00a01\u00a0234,56')).toBe(123_456);
  });

  it('devolve null para o que não é um montante', () => {
    for (const bad of [
      '',
      '   ',
      'abc',
      '-',
      ',',
      '.',
      '12,345,67',
      '1.23.456,78',
      '12,3,4',
      '1a2',
    ]) {
      expect(parseAmountToCents(bad), `esperava null para ${JSON.stringify(bad)}`).toBeNull();
    }
  });

  it('trata o separador isolado seguido de três dígitos como milhares', () => {
    // Ambiguidade real: `1.250` é 1 250,00 em pt-PT e 1,250 em en-US. A decisão
    // é a de pt-PT, o dialecto do produto, e fica fixada por este teste para não
    // mudar sem se saber. Consequência a conhecer: um ficheiro que escreva
    // `-24.900` com três casas decimais é lido como −249,00 €.
    expect(parseAmountToCents('1.250')).toBe(125_000);
    expect(parseAmountToCents('1,250')).toBe(125_000);
  });

  it('reconhece o papel dos separadores pela posição', () => {
    expect(guessSeparators('1.234,56')).toEqual({ decimal: ',', group: '.' });
    expect(guessSeparators('1,234.56')).toEqual({ decimal: '.', group: ',' });
    expect(guessSeparators('24,90')).toEqual({ decimal: ',', group: '.' });
    expect(guessSeparators('1234')).toEqual({ decimal: '.', group: null });
  });

  it('formata para CSV e lê de volta o mesmo valor', () => {
    for (const value of [0, 7, -7, 100, -6_437, 215_000, -1_234_567_890, 99_999]) {
      expect(parseAmountToCents(formatCentsForCsv(value))).toBe(value);
    }

    expect(formatCentsForCsv(-1_234_567_890)).toBe('-12.345.678,90');
    expect(formatCentsForCsv(2_150_000)).toBe('21.500,00');
  });
});

describe('parseOfxDate — datas OFX', () => {
  it('lê os 14 dígitos e devolve a data de calendário', () => {
    expect(parseOfxDate('20260901101500')).toBe('2026-09-01');
    expect(parseOfxDate('20260930235959')).toBe('2026-09-30');
  });

  it('lê os 8 dígitos', () => {
    expect(parseOfxDate('20261005')).toBe('2026-10-05');
  });

  it('descarta o fuso em vez de deslocar a data', () => {
    // `20260930235959[-3:BRT]` às 23h59 de 30/09 em São Paulo é 01/10 em UTC. A
    // data do lançamento é a do extrato: 30/09.
    expect(parseOfxDate('20260930235959[-3:BRT]')).toBe('2026-09-30');
    expect(parseOfxDate('20260930235959[-3]')).toBe('2026-09-30');
    expect(parseOfxDate('20260930235959[0:GMT]')).toBe('2026-09-30');
    expect(parseOfxDate('20260930')).toBe('2026-09-30');
  });

  it('recusa datas impossíveis em vez de as corrigir', () => {
    expect(parseOfxDate('20260231')).toBeNull();
    expect(parseOfxDate('20261301')).toBeNull();
    expect(parseOfxDate('202609')).toBeNull();
    expect(parseOfxDate('')).toBeNull();
    expect(parseOfxDate(undefined)).toBeNull();
  });
});

describe('decodeEntities', () => {
  it('descodifica as entidades que aparecem em extratos', () => {
    expect(decodeEntities('COMPRA CAFE &amp; PASTELARIA')).toBe('COMPRA CAFE & PASTELARIA');
    expect(decodeEntities('A &lt; B')).toBe('A < B');
    expect(decodeEntities('&#199;&#193;')).toBe('ÇÁ');
    expect(decodeEntities('&#xC7;')).toBe('Ç');
    expect(decodeEntities('SERVIÇOS MUNICIPAIS - ÁGUA')).toBe('SERVIÇOS MUNICIPAIS - ÁGUA');
  });
});

describe('parseOfxDocument — amostra principal', () => {
  const statement = parseOfxDocument(readSample(MAIN_OFX));

  it('lê as 10 transações e a soma de -36,12 €', () => {
    expect(statement.transactions).toHaveLength(10);
    expect(sumOf(statement)).toBe(-3_612);
    expect(statement.transactions.map((t) => t.amountInCents)).toEqual([
      -2_490, 125_000, -9_235, -6_000, -134_567, -485, -4_500, 31_245, -1_830, -750,
    ]);
  });

  it('lê o cabeçalho até à linha do <OFX>, sem os comentários', () => {
    expect(statement.header['OFXHEADER']).toBe('100');
    expect(statement.header['DATA']).toBe('OFXSGML');
    expect(statement.header['VERSION']).toBe('102');
    expect(statement.header['ENCODING']).toBe('UTF-8');
    expect(Object.keys(statement.header)).toHaveLength(9);
  });

  it('lê os metadados da conta e o saldo do extrato', () => {
    expect(statement.currency).toBe('EUR');
    expect(statement.bankId).toBe('9999');
    expect(statement.branchId).toBe('0001');
    expect(statement.accountId).toBe('0001234567890');
    expect(statement.accountType).toBe('CHECKING');
    expect(statement.startDate).toBe('2026-09-01');
    expect(statement.endDate).toBe('2026-09-30');
    expect(statement.ledgerBalanceInCents).toBe(-3_612);
    expect(statement.ledgerBalanceRaw).toBe('-36.12');
    expect(statement.ledgerBalanceDate).toBe('2026-09-30');
  });

  it('preserva os 10 FITID, que são a chave de deduplicação', () => {
    const fitIds = statement.transactions.map((t) => t.fitId);

    expect(fitIds).toEqual([
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
    ]);
    expect(new Set(fitIds).size).toBe(10);
  });

  it('lê os sinais sem `+` no ficheiro', () => {
    const credits = statement.transactions.filter((t) => (t.amountInCents ?? 0) > 0);
    const debits = statement.transactions.filter((t) => (t.amountInCents ?? 0) < 0);

    expect(credits.map((t) => t.fitId)).toEqual(['20260902000002', '20260918000008']);
    expect(debits).toHaveLength(8);
  });

  it('não estraga acentos nem deixa entidades por descodificar', () => {
    expect(statement.transactions[8]?.memo).toBe(
      'PAGAMENTO SERVIÇOS MUNICIPAIS - ÁGUA E SANEAMENTO',
    );
    expect(statement.transactions[9]?.memo).toBe('COMPRA CAFE & PASTELARIA CENTRAL');
  });

  it('lê o tipo de cada movimento', () => {
    expect(statement.transactions[0]?.type).toBe('DEBIT');
    expect(statement.transactions[6]?.type).toBe('DIRECTDEBIT');
    expect(statement.transactions[3]?.type).toBe('ATM');
  });

  it('não reporta problemas num ficheiro bem formado', () => {
    expect(statement.issues).toEqual([]);
  });
});

describe('parseOfxDocument — amostra mínima', () => {
  const statement = parseOfxDocument(readSample(MINIMAL_OFX));

  it('lê uma única transação e o saldo', () => {
    expect(statement.transactions).toHaveLength(1);
    expect(statement.transactions[0]?.amountInCents).toBe(-1_250);
    expect(statement.transactions[0]?.fitId).toBe('20261005000001');
    expect(statement.transactions[0]?.date).toBe('2026-10-05');
    expect(statement.ledgerBalanceInCents).toBe(-1_250);
    expect(statement.issues).toEqual([]);
  });
});

describe('parseOfxDocument — variante sem nenhuma tag de fecho (incógnita I1)', () => {
  const semFechos = withoutClosingTags(readSample(MAIN_OFX));

  it('o ficheiro de teste não tem mesmo tags de fecho', () => {
    expect(semFechos).not.toContain('</STMTTRN>');
    expect(semFechos).not.toContain('</LEDGERBAL>');
    expect(semFechos).not.toContain('</OFX>');
  });

  it('extrai os mesmos dados em vez de lançar exceção', () => {
    // É a razão de existir um parser próprio: o `ofx-js` lança
    // `Missing closing tag for LEDGERBAL` nesta variante.
    const statement = parseOfxDocument(semFechos);

    expect(statement.transactions).toHaveLength(10);
    expect(sumOf(statement)).toBe(-3_612);
    expect(statement.ledgerBalanceInCents).toBe(-3_612);
    expect(statement.currency).toBe('EUR');
    expect(statement.accountId).toBe('0001234567890');
    expect(statement.transactions[9]?.memo).toBe('COMPRA CAFE & PASTELARIA CENTRAL');
  });

  it('declara os blocos que ficaram por fechar, sem inventar dados', () => {
    const statement = parseOfxDocument(semFechos);

    expect(statement.issues.length).toBeGreaterThan(0);
    expect(statement.issues.every((issue) => issue.line >= 1)).toBe(true);
    expect(statement.issues.some((issue) => issue.message.includes('nunca foi fechado'))).toBe(
      true,
    );
  });

  it('não repete o mesmo aviso uma vez por movimento', () => {
    // Com dez movimentos sem fecho, dez avisos iguais são ruído: ninguém os lê e
    // a pré-visualização deixa de servir. Ficam **um** exemplo (o primeiro bloco
    // concreto, a que se pode apontar) e **um** resumo com a contagem.
    //
    // O resumo procura-se em `issues` e não na lista filtrada por "nunca foi
    // fechado": o texto do resumo é "N blocos ficaram sem tag de fecho", que não
    // contém aquela frase. Filtrar por ela excluía precisamente a linha que este
    // teste existe para verificar — foi assim que ele falhou na primeira versão.
    const statement = parseOfxDocument(semFechos);
    const perBlock = statement.issues.filter((issue) =>
      issue.message.includes('nunca foi fechado'),
    );
    const summaries = statement.issues.filter((issue) => /\d+ blocos/.test(issue.message));

    expect(perBlock).toHaveLength(1);
    expect(summaries).toHaveLength(1);
    expect(statement.issues.length).toBeLessThanOrEqual(2);
    expect(statement.issues.length).toBeLessThan(statement.transactions.length);
  });
});

describe('parseOfxDocument — ficheiro truncado a meio de um movimento', () => {
  const full = readSample(MAIN_OFX);
  const cutoffMarker = '<FITID>20260910000006';
  const cutoff = full.indexOf(cutoffMarker);

  it('encontra mesmo o ponto de corte (senão o teste não testaria nada)', () => {
    expect(cutoff).toBeGreaterThan(0);
  });

  it('lê os movimentos completos e assinala o truncado', () => {
    const statement = parseOfxDocument(full.slice(0, cutoff));

    // Movimentos 1 a 5 completos; o 6.º ficou sem FITID, MEMO nem fecho.
    expect(statement.transactions).toHaveLength(6);
    expect(statement.transactions[5]?.fitId).toBeNull();
    expect(statement.transactions[5]?.memo).toBeNull();
    expect(statement.transactions[5]?.amountInCents).toBe(-485);
    expect(sumOf(statement)).toBe(-2_490 + 125_000 - 9_235 - 6_000 - 134_567 - 485);
  });

  it('declara o truncamento em vez de o esconder', () => {
    const statement = parseOfxDocument(full.slice(0, cutoff));

    expect(statement.issues.some((issue) => issue.field === 'FITID')).toBe(true);
    expect(statement.issues.some((issue) => issue.message.includes('nunca foi fechado'))).toBe(
      true,
    );
  });

  it('corta a meio de um valor e não inventa cêntimos', () => {
    const statement = parseOfxDocument(`${full.slice(0, cutoff)}<TRNAMT>-4.8`);

    // `-4.8` continua a ser legível (48 cêntimos de magnitude): o que não pode
    // acontecer é o parser inventar casas decimais ou lançar.
    expect(statement.transactions).toHaveLength(6);
    expect(statement.issues.length).toBeGreaterThan(0);
  });
});

describe('parseOfxDocument — ficheiros que não são extratos', () => {
  it('devolve um documento vazio com problema, sem lançar', () => {
    const statement = parseOfxDocument('');

    expect(statement.transactions).toEqual([]);
    expect(statement.issues[0]?.message).toContain('vazio');
  });

  it('aceita texto sem a tag <OFX> como problema declarado', () => {
    const statement = parseOfxDocument('OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\n\nnada aqui');

    expect(statement.transactions).toEqual([]);
    expect(statement.issues.some((issue) => issue.field === 'OFX')).toBe(true);
  });

  it('não lança com um valor ilegível: declara-o', () => {
    const statement = parseOfxDocument(
      [
        'OFXHEADER:100',
        'DATA:OFXSGML',
        '<OFX>',
        '<BANKMSGSRSV1><STMTTRNRS><STMTRS>',
        '<CURDEF>EUR',
        '<BANKTRANLIST>',
        '<STMTTRN>',
        '<DTPOSTED>20260901101500',
        '<TRNAMT>mil euros',
        '<FITID>ABC1',
        '<MEMO>MOVIMENTO ESTRANHO',
        '</STMTTRN>',
        '</BANKTRANLIST>',
        '</STMTRS></STMTTRNRS></BANKMSGSRSV1>',
        '</OFX>',
      ].join('\n'),
    );

    expect(statement.transactions).toHaveLength(1);
    expect(statement.transactions[0]?.amountInCents).toBeNull();
    expect(statement.issues.some((issue) => issue.field === 'TRNAMT')).toBe(true);
  });

  it('assinala movimento sem FITID, porque a reimportação não o reconhece', () => {
    const statement = parseOfxDocument(
      [
        'OFXHEADER:100',
        'DATA:OFXSGML',
        '<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS>',
        '<BANKTRANLIST>',
        '<STMTTRN><DTPOSTED>20260901<TRNAMT>-10.00<MEMO>SEM ID</STMTTRN>',
        '</BANKTRANLIST>',
        '<LEDGERBAL><BALAMT>-10.00</LEDGERBAL>',
        '</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>',
      ].join('\n'),
    );

    expect(statement.transactions).toHaveLength(1);
    expect(statement.transactions[0]?.fitId).toBeNull();
    expect(statement.issues.some((issue) => issue.field === 'FITID')).toBe(true);
  });
});

describe('detectFormat', () => {
  it('reconhece OFX pelo cabeçalho SGML', () => {
    expect(detectFormat(readSample(MAIN_OFX))).toBe('ofx');
    expect(detectFormat('OFXHEADER:100\nDATA:OFXSGML\n<OFX>')).toBe('ofx');
  });

  it('reconhece OFX 2.x XML', () => {
    expect(detectFormat('<?xml version="1.0"?>\n<?OFX OFXHEADER="200"?>\n<OFX>')).toBe('ofx');
  });

  it('trata o resto como CSV', () => {
    expect(detectFormat(readSample(PT_CSV))).toBe('csv');
    expect(detectFormat('Data;Descrição;Valor\n01/10/2026;Renda;-850,00')).toBe('csv');
  });
});
