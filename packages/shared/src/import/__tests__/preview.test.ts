import { describe, expect, it } from 'vitest';

import { parseCsvDocument } from '../csv';
import { parseOfxDocument } from '../ofx';
import { fingerprintOf, importFitId, previewFromCsv, previewFromOfx } from '../preview';
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
  it('junta data, valor e descrição normalizada, com a versão do formato', () => {
    // O prefixo `imp1|` não é decorativo: esta cadeia é **gravada** como
    // identificador de importação (`fitId`), e uma alteração à fórmula tem de
    // poder conviver com os identificadores que já estão na base de dados.
    expect(fingerprintOf('2026-10-01', -85_000, 'Renda  CASA outubro')).toBe(
      'imp1|2026-10-01|-85000|renda casa outubro',
    );
  });

  it('trunca a descrição para caber no limite da coluna', () => {
    const long = 'x'.repeat(200);
    const fingerprint = fingerprintOf('2026-10-01', -100, long);

    expect(fingerprint).not.toBeNull();
    expect(fingerprint?.length).toBeLessThanOrEqual(80);
  });

  /*
   * O caso que a fórmula anterior falhava não era a descrição de 200 caracteres:
   * era o **valor máximo** da coluna somado a uma descrição longa. O prefixo
   * `imp1|` mais a data mais dez dígitos de cêntimos gasta 30 caracteres, e uma
   * descrição truncada a 60 dava 90. O identificador é gravado na coluna
   * `fitId`, pelo que o limite tem de valer para o pior caso, não para o caso
   * confortável de um valor pequeno.
   */
  it('cabe no limite com o valor máximo de um inteiro de 32 bits', () => {
    const fingerprint = fingerprintOf('2026-10-01', 2_147_483_647, 'x'.repeat(200));

    expect(fingerprint?.length).toBeLessThanOrEqual(80);
  });

  it('mantém a data e o valor inteiros e cede só na descrição', () => {
    const fingerprint = fingerprintOf('2026-10-01', -85_000, 'Renda '.repeat(40));

    // Os dois campos que identificam o movimento não podem ser truncados, senão
    // dois movimentos de dias ou valores diferentes passavam a ser o mesmo.
    expect(fingerprint?.startsWith('imp1|2026-10-01|-85000|')).toBe(true);
    expect(fingerprint?.length).toBe(80);
  });

  /*
   * A correção não pode quebrar a reimportação, que é o que a impressão digital
   * existe para impedir. Duas propriedades têm de valer com a truncagem:
   * o cálculo é **idempotente** (a mesma linha dá sempre o mesmo identificador,
   * seja qual for o número de passagens) e descrições que diferem antes do corte
   * continuam a ser identificadores distintos. Sem a segunda, dois movimentos do
   * mesmo dia e valor colidiriam e o segundo era recusado pela restrição única.
   */
  it('o identificador derivado é estável e não depende do número de passagens', () => {
    const description = 'Compra ' + 'muito longa '.repeat(20);
    const first = importFitId(null, '2026-10-01', -12_345, description);
    const second = importFitId(null, '2026-10-01', -12_345, description);

    expect(first).not.toBeNull();
    expect(first?.length).toBeLessThanOrEqual(80);
    expect(second).toBe(first);
  });

  it('duas descrições diferentes não colidem no identificador derivado', () => {
    const first = importFitId(null, '2026-10-01', -12_345, 'Compra na loja A, referência 111');
    const second = importFitId(null, '2026-10-01', -12_345, 'Compra na loja A, referência 222');

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(first).not.toBe(second);
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

  it('dois movimentos iguais no mesmo dia entram os dois (I4 da verificação)', () => {
    /*
     * Este teste mudou de expectativa de propósito, e a razão é o I4.
     *
     * A versão anterior marcava o segundo como "repetido dentro do próprio
     * ficheiro" e desmarcava-o — e era isso que fazia o ciclo exportar →
     * reimportar perder movimentos: 27 exportados voltavam como 21, porque dois
     * cafés iguais no mesmo dia só deixavam entrar um. Sem identificador do banco,
     * o importador não tem como saber que são movimentos diferentes, e descartar
     * um perde dados do utilizador; importar os dois é recuperável (a reversão
     * apaga), perder um não é.
     *
     * Cada linha recebe o seu identificador derivado (`imp1|…` e `imp1|…:2`), pelo
     * que reimportar o mesmo ficheiro continua a não duplicar nada — o teste
     * seguinte prova-o.
     */
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
    expect(preview.rows[1]?.status).toBe('new');
    expect(preview.newCount).toBe(2);
    expect(preview.rows.every((row) => row.selected)).toBe(true);
    // Os identificadores são distintos, senão a restrição única recusaria o segundo.
    expect(preview.rows[0]?.fitId).not.toBe(preview.rows[1]?.fitId);
    expect(preview.rows[1]?.fitId).toMatch(/:2$/);
    // Os dois contam: são dois movimentos, não um.
    expect(preview.totalDebitsInCents).toBe(170_000);
    expect(preview.impliedEndBalanceInCents).toBe(100_000 - 170_000);
  });

  it('reimportar o ficheiro com movimentos repetidos não duplica nenhum', () => {
    const duplicated = parseCsvDocument(
      [
        'Data;Descrição;Valor',
        '01/10/2026;Renda casa outubro;-850,00',
        '01/10/2026;Renda casa outubro;-850,00',
      ].join('\n'),
    );

    // O que a primeira importação gravou: os dois identificadores derivados.
    const first = previewFromCsv({
      account: ACCOUNT,
      statement: duplicated,
      existing: [],
      rules: { rules: [], categoryNames: new Map() },
    });

    const second = previewFromCsv({
      account: ACCOUNT,
      statement: duplicated,
      existing: (first.rows ?? []).map((row) => ({
        fitId: row.fitId,
        date: new Date(`${row.date ?? '2026-01-01'}T00:00:00.000Z`),
        amountInCents: row.amountInCents ?? 0,
        description: row.description,
      })),
      rules: { rules: [], categoryNames: new Map() },
    });

    expect(second.newCount).toBe(0);
    expect(second.duplicateCount).toBe(2);
    expect(second.totalDebitsInCents).toBe(0);
  });

  /*
   * O ciclo completo exportar → reimportar, que é o cenário real do utilizador.
   *
   * O teste anterior é generoso de mais: passa as linhas que já existem com o
   * `fitId` derivado, mas o CSV exportado traz o identificador na coluna `Id` e
   * **também** os valores, pelo que a reimportação passa pela mesma indexação que
   * a produção. O que faltava era o sufixo de ocorrência: a exportação escreve
   * `impressão:2` para o segundo café igual, e o índice só reconhecia a impressão
   * base, pelo que a segunda cópia aparecia como **nova e já selecionada** —
   * confirmar duplicava o movimento. Foi o I11, medido pelo qa-verificador.
   *
   * Este teste reproduz a exportação pela mesma função (`fingerprintOf`) e a
   * convenção de sufixo de `apps/web/src/server/export.ts`, para não depender de
   * um ficheiro de amostra que ninguém atualiza quando a fórmula muda.
   */
  it('reimportar o CSV exportado reconhece os dois movimentos iguais (I11)', () => {
    const description = 'cafe e2e';
    const base = fingerprintOf('2026-10-05', -1_230, description);

    expect(base).not.toBeNull();

    // O que a exportação escreveu: dois `Id` distintos para dois movimentos iguais,
    // o segundo com o sufixo de ocorrência.
    const exported = [`${base ?? ''}`, `${base ?? ''}:2`];

    const statement = parseCsvDocument(
      [
        'Data;Descrição;Valor;Id',
        `05/10/2026;${description};-12,30;${exported[0] ?? ''}`,
        `05/10/2026;${description};-12,30;${exported[1] ?? ''}`,
      ].join('\n'),
    );

    const preview = previewFromCsv({
      account: ACCOUNT,
      statement,
      existing: exported.map((fitId) => ({
        fitId,
        date: new Date('2026-10-05T00:00:00.000Z'),
        amountInCents: -1_230,
        description,
      })),
      rules: { rules: [], categoryNames: new Map() },
    });

    expect(preview.duplicateCount).toBe(2);
    expect(preview.newCount).toBe(0);
    expect(preview.rows.every((row) => !row.selected)).toBe(true);
    expect(preview.totalDebitsInCents).toBe(0);
  });

  /*
   * A primeira volta do ciclo, que o teste anterior não cobre: na conta estão
   * movimentos **manuais** iguais — sem `fitId`, que é o caso normal de quem lança
   * dois cafés iguais à mão e só depois exporta. O índice antigo só derivava a
   * impressão base (uma vez), pelo que o `:2` **do ficheiro** não encontrava nada
   * e era oferecido como novo. O `qa-verificador` mediu-o como I11a, depois de a
   * correção do I11b já estar feita — as duas metades do mesmo defeito.
   */
  it('reimportar um ficheiro com repetições quando os movimentos são manuais (I11a)', () => {
    const description = 'cafe e2e';
    const statement = parseCsvDocument(
      [
        'Data;Descrição;Valor',
        `05/10/2026;${description};-12,30`,
        `05/10/2026;${description};-12,30`,
      ].join('\n'),
    );

    // Dois movimentos lançados à mão: nada de `fitId` gravado.
    const manualRows = [1, 2].map(() => ({
      fitId: null,
      date: new Date('2026-10-05T00:00:00.000Z'),
      amountInCents: -1_230,
      description,
    }));

    const preview = previewFromCsv({
      account: ACCOUNT,
      statement,
      existing: manualRows,
      rules: { rules: [], categoryNames: new Map() },
    });

    expect(preview.duplicateCount).toBe(2);
    expect(preview.newCount).toBe(0);
    expect(preview.rows.every((row) => !row.selected)).toBe(true);
  });

  /*
   * O contra-exemplo, que impede a correção de ser boa demais: se na conta só
   * existe **um** café, um ficheiro com dois tem de continuar a aceitar o segundo
   * — é mesmo um movimento novo. Sem este teste, contar ocorrências poderia
   * transformar-se em "descartar repetições", que foi o defeito I4.
   */
  it('um segundo café igual continua a entrar quando só existe um na conta', () => {
    const description = 'cafe e2e';
    const statement = parseCsvDocument(
      [
        'Data;Descrição;Valor',
        `05/10/2026;${description};-12,30`,
        `05/10/2026;${description};-12,30`,
      ].join('\n'),
    );

    const preview = previewFromCsv({
      account: ACCOUNT,
      statement,
      existing: [
        {
          fitId: null,
          date: new Date('2026-10-05T00:00:00.000Z'),
          amountInCents: -1_230,
          description,
        },
      ],
      rules: { rules: [], categoryNames: new Map() },
    });

    expect(preview.duplicateCount).toBe(1);
    expect(preview.newCount).toBe(1);
    expect(preview.totalDebitsInCents).toBe(1_230);
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
