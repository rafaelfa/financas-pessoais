/* eslint-disable no-console */
/**
 * T7.5 — Verificação adversarial da importação e exportação (script TEMPORÁRIO).
 *
 * Parte A: aritmética dos parsers (amostras reais + ficheiros construídos).
 * Parte B: importação, idempotência e concorrência contra o Neon, com o
 *          utilizador `qa-*` criado aqui e apagado no fim.
 * Parte C: exportação, ciclo fechado e completude do backup.
 *
 * Onde a Server Action não é importável (depende de `requireUser()`/`next/headers`),
 * o corpo é reproduzido com as **mesmas expressões** do código e cita-se
 * `ficheiro:linha`. O que é puro (parsers, preview, CSV de exportação) é
 * importado e executado a sério.
 *
 * NÃO toca em `rafaelfa.aguiar@gmail.com`.
 * Correr (o `tsx` falha nesta sandbox com `spawn EPERM`):
 *   node --experimental-transform-types --import <hook> verificacao.ts
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Carrega o `.env` da raiz sem depender do `dotenv`: este pacote temporário não
 * tem `node_modules`, e o cliente Prisma rebenta se `DATABASE_URL` não existir no
 * momento do import (por isso isto corre antes do `import()` dinâmico).
 */
function loadEnvFile(path: string): void {
  let text: string;

  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return;
  }

  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);

    if (match?.[1] === undefined || match[2] === undefined) {
      continue;
    }

    let value = match[2].trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[match[1]] === undefined) {
      process.env[match[1]] = value;
    }
  }
}

loadEnvFile(resolve(here, '../../.env'));
loadEnvFile(resolve(here, '../.env'));

const REAL_USER_EMAIL = 'rafaelfa.aguiar@gmail.com';
const RUN = Date.now().toString(36);
const SAMPLES = resolve(here, '../../docs/spec/samples');

const summary: Record<string, unknown> = { run: RUN };
const createdUserIds: string[] = [];

function log(section: string, value: unknown): void {
  summary[section] = value;
  console.log(`[${section}]`, JSON.stringify(value));
}

function readSample(name: string): string {
  return readFileSync(resolve(SAMPLES, name), 'utf8');
}

async function main(): Promise<void> {
  const shared = await import('../shared/src/index');
  const { prisma } = await import('../db/src/client');
  const { isUniqueViolation } = await import('../../apps/web/src/server/errors');
  const { buildImportPreview, resolveFormat } = await import('../../apps/web/src/server/import');
  const { buildTransactionsCsv, labelForKind } = await import('../../apps/web/src/server/export');

  // =========================================================================
  // PARTE A — aritmética dos parsers
  // =========================================================================

  // A1 — somas contra o LEDGERBAL e exatidão em cêntimos.
  const ofxSample = readSample('extrato-ofx1-sgml.ofx');
  const minimalSample = readSample('extrato-ofx1-sgml-minimo.ofx');
  const csvSample = readSample('extrato-csv-pt.csv');

  const ofxStatement = shared.parseOfxDocument(ofxSample);
  const parsedSum = ofxStatement.transactions.reduce(
    (total, transaction) => total + (transaction.amountInCents ?? 0),
    0,
  );

  // Prova de que não há vírgula flutuante: 0,01 + 0,02 lidos como inteiros.
  const centsSum = [0.01, 0.02]
    .map((value) => shared.parseAmountToCents(String(value).replace('.', ',')))
    .reduce((total: number, value: number | null) => total + (value ?? 0), 0);

  // E a prova inversa: o que daria passar por `Number` decimal.
  const floatComparison =
    Math.round(Number.parseFloat('0.01') * 100) + Math.round(Number.parseFloat('0.02') * 100);

  log('A1_somas', {
    amostraPrincipal: {
      movimentos: ofxStatement.transactions.length,
      somaDosMovimentosEmCents: parsedSum,
      ledgerBalanceEmCents: ofxStatement.ledgerBalanceInCents,
      ledgerBalanceRaw: ofxStatement.ledgerBalanceRaw,
      bateExatamente: parsedSum === ofxStatement.ledgerBalanceInCents,
    },
    amostraMinima: {
      movimentos: shared.parseOfxDocument(minimalSample).transactions.length,
      ledgerBalanceEmCents: shared.parseOfxDocument(minimalSample).ledgerBalanceInCents,
    },
    csvContraColunaSaldo: (() => {
      const statement = shared.parseCsvDocument(csvSample);

      return {
        movimentos: statement.rows.length,
        ultimoSaldoLido: statement.lastBalanceInCents,
        somaDosMovimentos: statement.rows.reduce(
          (total, row) => total + (row.amountInCents ?? 0),
          0,
        ),
        linhasSemProblema: statement.issues.length === 0,
      };
    })(),
    zeroVirgulaZeroUmMaisZeroVirgulaZeroDois: {
      porTexto: centsSum,
      porNumberDecimal: floatComparison,
      iguais: centsSum === floatComparison,
    },
    repetidos: (() => {
      let total = 0;

      for (let index = 0; index < 1000; index += 1) {
        total += shared.parseAmountToCents('0,01') ?? 0;
      }

      return { milVezesZeroVirgulaZeroUm: total, esperado: 1000, exato: total === 1000 };
    })(),
  });

  // A2 — datas.
  const dateCases = [
    '20260930',
    '20260930235959',
    '20260930[+000:GMT]',
    '20260930[-03:EST]',
    '20261001000000',
    '20261231235959[-03:EST]',
    '20260101000000[+000:GMT]',
    // OFX 2.x com milissegundos (formato real de vários bancos)
    '20260930101500.000[-3:GMT]',
    '2026-09-30',
    '20261340',
  ].map((raw) => ({ raw, iso: shared.parseOfxDate(raw) }));

  // Ficheiro escrito em UTC cuja hora local a oeste cai no dia anterior.
  const westOfUtc = shared.parseOfxDocument(
    ofxSample.replace('<DTPOSTED>20260901101500', '<DTPOSTED>20260901003000[-03:EST]'),
  );

  log('A2_datas', {
    casos: dateCases,
    ficheiroComHoraLocalAoDiaAnterior: {
      postedAt: westOfUtc.transactions[0]?.postedAt,
      date: westOfUtc.transactions[0]?.date,
      naoDesloca: westOfUtc.transactions[0]?.date === '2026-09-01',
    },
  });

  // A3 — valores.
  const amountCases = [
    '-1.234,56',
    '1.234,56',
    '1234.56',
    '1,234.56',
    '(1.234,56)',
    '(64,37)',
    '+1 250,00',
    '-64,37',
    '0,01',
    '0.005',
    '1.234,567',
    '1.250',
    '12.345',
    '1.234.567',
    '',
    '   ',
    'abc',
    '-',
    '12,5,6',
    '99999999999999999999',
    '90071992547409,99',
  ].map((raw) => ({ raw, cents: shared.parseAmountToCents(raw) }));

  log('A3_valores', {
    casos: amountCases,
    cicloExportarImportar: [-123456, -1, -99, 0, 1, 99, 100, 123456789, -99999999999].map(
      (cents) => ({
        cents,
        texto: shared.formatCentsForCsv(cents),
        deVolta: shared.parseAmountToCents(shared.formatCentsForCsv(cents)),
        fecha: shared.parseAmountToCents(shared.formatCentsForCsv(cents)) === cents,
      }),
    ),
  });

  // A4 — truncagem.
  const cut = (label: string, content: string) => {
    const statement = shared.parseOfxDocument(content);

    return {
      variante: label,
      bytes: content.length,
      movimentos: statement.transactions.length,
      movimentosComValor: statement.transactions.filter((t) => t.amountInCents !== null).length,
      ledgerBalanceEmCents: statement.ledgerBalanceInCents,
      problemas: statement.issues.length,
      primeiroProblema: statement.issues[0]?.message ?? null,
    };
  };

  const amountIndex = ofxSample.indexOf('-1345.67');
  const midValue = ofxSample.slice(0, amountIndex + 4);
  const midValueStatement = shared.parseOfxDocument(midValue);

  log('A4_truncagem', {
    meioDeUmBloco: cut(
      'corta a meio de um STMTTRN',
      ofxSample.slice(0, ofxSample.indexOf('<MEMO>DEBITO DIRETO')),
    ),
    meioDeUmValor: {
      ...cut('corta a meio de um valor (-1345.67 → -134)', midValue),
      valorLidoDoMovimentoTruncadoEmCents: midValueStatement.transactions[4]?.amountInCents ?? null,
      valorRealDoMovimentoEmCents: -134567,
      desvioDeFator:
        (midValueStatement.transactions[4]?.amountInCents ?? 0) === 0
          ? null
          : Math.round(134567 / Math.abs(midValueStatement.transactions[4]?.amountInCents ?? 1)),
      oMovimentoTruncadoFicaMarcadoComoSuspeito:
        midValueStatement.transactions[4]?.amountInCents === null ||
        midValueStatement.transactions[4]?.date === null,
    },
    meioDoCabecalho: cut('corta a meio do cabeçalho SGML', ofxSample.slice(0, 40)),
    zeroBytes: cut('ficheiro com zero bytes', ''),
    semLedgerbal: cut(
      'sem o bloco LEDGERBAL',
      ofxSample.replace(/<LEDGERBAL>[\s\S]*?<\/LEDGERBAL>\r?\n/, ''),
    ),
  });

  // A5 — dialecto sem tags de fecho e hierarquia.
  const noClosers = ofxSample
    .split('\n')
    .filter((line) => !/^\s*<\//.test(line))
    .join('\n');
  const noClosersStatement = shared.parseOfxDocument(noClosers);
  const noClosersSum = noClosersStatement.transactions.reduce(
    (total, transaction) => total + (transaction.amountInCents ?? 0),
    0,
  );

  // Várias contas no mesmo ficheiro: dois extratos (conta à ordem + poupança).
  const secondStatement = `
<STMTTRNRS>
<TRNUID>2
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<STMTRS>
<CURDEF>EUR
<BANKACCTFROM>
<BANKID>9999
<BRANCHID>0002
<ACCTID>0009999999999
<ACCTTYPE>SAVINGS
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20260901000000
<DTEND>20260930235959
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260915120000
<TRNAMT>5000.00
<FITID>POUPANCA-0001
<MEMO>TRANSFERENCIA PARA POUPANCA
</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>5000.00
<DTASOF>20260930235959
</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
`;
  const twoStatements = ofxSample.replace('</BANKMSGSRSV1>', `${secondStatement}</BANKMSGSRSV1>`);
  const twoStatementsStatement = shared.parseOfxDocument(twoStatements);

  // MEMO com um `<` lá dentro (descrição real de um banco pode trazê-lo).
  const memoWithAngle = ofxSample.replace(
    '<MEMO>COMPRA CAFE &amp; PASTELARIA CENTRAL',
    '<MEMO>COMPRA LOJA <M30> CENTRAL',
  );
  const memoWithAngleStatement = shared.parseOfxDocument(memoWithAngle);

  log('A5_dialecto', {
    semTagsDeFecho: {
      movimentos: noClosersStatement.transactions.length,
      somaEmCents: noClosersSum,
      ledgerBalanceEmCents: noClosersStatement.ledgerBalanceInCents,
      igualAoFicheiroBemFormado:
        noClosersStatement.transactions.length === ofxStatement.transactions.length &&
        noClosersSum === parsedSum,
      problemas: noClosersStatement.issues.length,
      primeiroProblema: noClosersStatement.issues[0]?.message ?? null,
    },
    duasContasNoMesmoFicheiro: {
      movimentosLidos: twoStatementsStatement.transactions.length,
      movimentosEsperadosDeUmaConta: 10,
      contaUsadaNosMetadados: twoStatementsStatement.accountId,
      saldoUsadoEmCents: twoStatementsStatement.ledgerBalanceInCents,
      fitIdsDeOutraConta: twoStatementsStatement.transactions
        .filter((transaction) => transaction.fitId?.startsWith('POUPANCA'))
        .map((transaction) => transaction.fitId),
      somaDeTodasAsContasEmCents: twoStatementsStatement.transactions.reduce(
        (total, transaction) => total + (transaction.amountInCents ?? 0),
        0,
      ),
    },
    memoComMenor: {
      movimentos: memoWithAngleStatement.transactions.length,
      descricaoDoUltimoMovimento:
        memoWithAngleStatement.transactions[9]?.memo ??
        memoWithAngleStatement.transactions[9]?.name,
      problemas: memoWithAngleStatement.issues.length,
      primeiroProblema: memoWithAngleStatement.issues[0]?.message ?? null,
    },
  });

  // =========================================================================
  // PARTE B — importação contra o Neon
  // =========================================================================
  const email = `qa-t75-${RUN}@example.com`;
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { id: crypto.randomUUID(), name: 'QA T75', email },
    select: { id: true },
  });
  createdUserIds.push(user.id);

  const account = await prisma.financialAccount.create({
    data: {
      userId: user.id,
      name: `Conta QA ${RUN}`,
      type: 'CHECKING',
      openingBalanceInCents: 0,
      currency: 'EUR',
      origin: 'MANUAL',
    },
    select: { id: true, openingBalanceInCents: true },
  });
  const secondAccount = await prisma.financialAccount.create({
    data: {
      userId: user.id,
      name: `Conta QA 2 ${RUN}`,
      type: 'SAVINGS',
      openingBalanceInCents: 0,
      currency: 'EUR',
      origin: 'MANUAL',
    },
    select: { id: true },
  });
  const otherUser = await prisma.user.create({
    data: {
      id: crypto.randomUUID(),
      name: 'QA T75 outro',
      email: `qa-t75-outro-${RUN}@example.com`,
    },
    select: { id: true },
  });
  createdUserIds.push(otherUser.id);
  const otherAccount = await prisma.financialAccount.create({
    data: {
      userId: otherUser.id,
      name: `Conta do outro ${RUN}`,
      type: 'WALLET',
      openingBalanceInCents: 0,
      currency: 'EUR',
      origin: 'MANUAL',
    },
    select: { id: true },
  });
  const otherCategory = await prisma.category.create({
    data: {
      userId: otherUser.id,
      name: `Categoria do outro ${RUN}`,
      slug: `categoria-do-outro-${RUN}`,
      kind: 'EXPENSE',
      isSystem: false,
      isInternal: false,
    },
    select: { id: true },
  });

  const previewArgs = async (accountId: string, content: string, userId: string) => {
    const existing = await prisma.transaction.findMany({
      where: { userId, financialAccountId: accountId },
      select: { fitId: true, date: true, amountInCents: true, description: true },
      take: 20_000,
      orderBy: { date: 'desc' },
    });
    const rules = await prisma.transactionRule.findMany({ where: { userId, enabled: true } });
    const categories = await prisma.category.findMany({
      where: { userId },
      select: { id: true, name: true },
    });
    const format = resolveFormat(content, undefined);

    return buildImportPreview({
      format,
      content,
      account: {
        id: accountId,
        name: 'Conta QA',
        openingBalanceInCents: 0,
        balanceInCents: null,
      },
      existing,
      rules: [],
      categoryNames: new Map(categories.map((category) => [category.id, category.name])),
    });
  };

  /**
   * Reprodução fiel de `confirmImport` (import-actions.ts:165-237): só a leitura
   * do utilizador (`requireUser`) e a resolução de nomes de conta/categorias são
   * substituídas pelos valores já conhecidos.
   */
  const confirmLikeAction = async (args: {
    userId: string;
    accountId: string;
    rows: ReadonlyArray<{
      date: string | null;
      description: string;
      amountInCents: number | null;
      fitId?: string | null;
      categoryId?: string | null;
    }>;
    ownedCategoryIds: ReadonlySet<string>;
  }): Promise<{ created: number; skipped: number; outcome: string; error: string | null }> => {
    let created = 0;
    let skipped = 0;
    let outcome = 'ok';
    let error: string | null = null;

    try {
      await prisma.$transaction(async (tx) => {
        for (const row of args.rows) {
          const amountCheck = shared.centsSchema.safeParse(row.amountInCents);

          if (row.date === null || !amountCheck.success || amountCheck.data === 0) {
            skipped += 1;
            continue;
          }

          const amountInCents = amountCheck.data;
          const date = new Date(`${row.date}T00:00:00.000Z`);

          try {
            await tx.transaction.create({
              data: {
                userId: args.userId,
                kind: amountInCents < 0 ? 'EXPENSE' : 'INCOME',
                status: 'CONFIRMED',
                amountInCents,
                date,
                description: row.description === '' ? null : row.description,
                financialAccountId: args.accountId,
                categoryId:
                  row.categoryId !== null &&
                  row.categoryId !== undefined &&
                  args.ownedCategoryIds.has(row.categoryId)
                    ? row.categoryId
                    : null,
                settled: true,
                settledOn: date,
                paymentMethod: 'DEBIT',
                paymentCondition: 'SINGLE',
                fitId: row.fitId ?? null,
                origin: 'IMPORTED',
              },
              select: { id: true },
            });

            created += 1;
          } catch (creationError) {
            if (isUniqueViolation(creationError)) {
              skipped += 1;
              continue;
            }

            throw creationError;
          }
        }
      });
    } catch (transactionError) {
      outcome = 'fail';
      error = String(transactionError).split('\n')[0] ?? null;
    }

    return { created, skipped, outcome, error };
  };

  const ownedCategoryIds = new Set(
    (
      await prisma.category.findMany({
        where: { userId: user.id, isInternal: false },
        select: { id: true },
      })
    ).map((category) => category.id),
  );

  const toRows = (
    rows: readonly {
      date: string | null;
      description: string;
      amountInCents: number | null;
      fitId: string | null;
    }[],
  ) =>
    rows.map((row) => ({
      date: row.date,
      description: row.description,
      amountInCents: row.amountInCents,
      fitId: row.fitId,
      categoryId: null as string | null,
    }));

  const countRows = async (accountId: string): Promise<number> =>
    prisma.transaction.count({ where: { financialAccountId: accountId } });

  // B6 — importar duas vezes.
  const preview1 = await previewArgs(account.id, ofxSample, user.id);
  const firstImport = await confirmLikeAction({
    userId: user.id,
    accountId: account.id,
    rows: toRows(preview1.rows.filter((row) => row.status === 'new')),
    ownedCategoryIds,
  });
  const rowsAfterFirst = await countRows(account.id);

  const preview2 = await previewArgs(account.id, ofxSample, user.id);
  const secondImport = await confirmLikeAction({
    userId: user.id,
    accountId: account.id,
    rows: toRows(preview2.rows),
    ownedCategoryIds,
  });
  const rowsAfterSecond = await countRows(account.id);

  // B6b — o duplicado na ÚLTIMA posição (o caso que pode esconder a perda).
  const solo = await prisma.financialAccount.create({
    data: {
      userId: user.id,
      name: `Conta QA solo ${RUN}`,
      type: 'WALLET',
      openingBalanceInCents: 0,
      currency: 'EUR',
      origin: 'MANUAL',
    },
    select: { id: true },
  });
  const soloRows = [
    {
      date: '2026-09-01',
      description: 'NOVO A',
      amountInCents: -1000,
      fitId: 'SOLO-1',
      categoryId: null,
    },
    {
      date: '2026-09-02',
      description: 'NOVO B',
      amountInCents: -2000,
      fitId: 'SOLO-2',
      categoryId: null,
    },
  ];
  const soloFirst = await confirmLikeAction({
    userId: user.id,
    accountId: solo.id,
    rows: soloRows,
    ownedCategoryIds,
  });
  const soloAfterFirst = await countRows(solo.id);
  // Agora uma linha nova seguida de uma duplicada (o duplicado é a última).
  const soloSecond = await confirmLikeAction({
    userId: user.id,
    accountId: solo.id,
    rows: [
      {
        date: '2026-09-03',
        description: 'NOVO C',
        amountInCents: -3000,
        fitId: 'SOLO-3',
        categoryId: null,
      },
      {
        date: '2026-09-01',
        description: 'NOVO A',
        amountInCents: -1000,
        fitId: 'SOLO-1',
        categoryId: null,
      },
    ],
    ownedCategoryIds,
  });
  const soloAfterSecond = await countRows(solo.id);

  // B6c — o duplicado na PRIMEIRA posição.
  const soloThird = await confirmLikeAction({
    userId: user.id,
    accountId: solo.id,
    rows: [
      {
        date: '2026-09-01',
        description: 'NOVO A',
        amountInCents: -1000,
        fitId: 'SOLO-1',
        categoryId: null,
      },
      {
        date: '2026-09-04',
        description: 'NOVO D',
        amountInCents: -4000,
        fitId: 'SOLO-4',
        categoryId: null,
      },
    ],
    ownedCategoryIds,
  });
  const soloAfterThird = await countRows(solo.id);

  log('B6_idempotencia', {
    primeiraImportacao: { ...firstImport, linhasNaConta: rowsAfterFirst },
    segundaImportacao: {
      novos: preview2.newCount,
      duplicados: preview2.duplicateCount,
      suspeitos: preview2.suspiciousCount,
      ...secondImport,
      linhasNaConta: rowsAfterSecond,
      gravouZero: rowsAfterSecond === rowsAfterFirst,
    },
    duplicadoNaUltimaPosicao: {
      primeira: { ...soloFirst, linhasNaConta: soloAfterFirst },
      segunda: { ...soloSecond, linhasNaConta: soloAfterSecond },
      criouMesmoALinhaNova: soloAfterSecond === soloAfterFirst + 1,
      relatouCriadasMasNaoGravou:
        soloSecond.outcome === 'ok' && soloSecond.created > 0 && soloAfterSecond === soloAfterFirst,
    },
    duplicadoNaPrimeiraPosicao: {
      terceira: { ...soloThird, linhasNaConta: soloAfterThird },
    },
  });

  // B7 — mesmo fitId, valor diferente.
  const changedValue = ofxSample.replace('<TRNAMT>-24.90', '<TRNAMT>-2490.00');
  const previewChanged = await previewArgs(account.id, changedValue, user.id);
  const changedRow = previewChanged.rows.find((row) => row.fitId === '20260901000001');
  const confirmChanged = await confirmLikeAction({
    userId: user.id,
    accountId: account.id,
    rows: toRows(previewChanged.rows.filter((row) => row.status === 'new')),
    ownedCategoryIds,
  });
  const storedRow = await prisma.transaction.findFirst({
    where: { financialAccountId: account.id, fitId: '20260901000001' },
    select: { amountInCents: true },
  });
  const rowsAfterChanged = await countRows(account.id);

  log('B7_valor_alterado', {
    statusNaPreview: changedRow?.status ?? null,
    motivo: changedRow?.reason ?? null,
    valorNoFicheiroEmCents: changedRow?.amountInCents ?? null,
    valorNaBaseEmCents: storedRow?.amountInCents ?? null,
    confirmacao: { ...confirmChanged, linhasNaConta: rowsAfterChanged },
    valorAtualizado: storedRow?.amountInCents === -249000,
  });

  // B8 — duas importações em paralelo do mesmo ficheiro, numa conta nova.
  const parallelAccount = await prisma.financialAccount.create({
    data: {
      userId: user.id,
      name: `Conta QA paralela ${RUN}`,
      type: 'WALLET',
      openingBalanceInCents: 0,
      currency: 'EUR',
      origin: 'MANUAL',
    },
    select: { id: true },
  });
  const parallelRows = toRows(
    (await previewArgs(parallelAccount.id, csvSample, user.id)).rows.filter(
      (row) => row.status === 'new',
    ),
  );
  const [parallelA, parallelB] = await Promise.all([
    confirmLikeAction({
      userId: user.id,
      accountId: parallelAccount.id,
      rows: parallelRows,
      ownedCategoryIds,
    }),
    confirmLikeAction({
      userId: user.id,
      accountId: parallelAccount.id,
      rows: parallelRows,
      ownedCategoryIds,
    }),
  ]);
  const parallelRowsInDb = await prisma.transaction.findMany({
    where: { financialAccountId: parallelAccount.id },
    select: { fitId: true, description: true, amountInCents: true },
  });
  const parallelFingerprints = parallelRowsInDb.map(
    (row) => `${row.fitId ?? ''}|${row.description}|${String(row.amountInCents)}`,
  );

  log('B8_paralelo', {
    linhasEnviadasPorCada: parallelRows.length,
    resultadoA: parallelA,
    resultadoB: parallelB,
    linhasNaConta: parallelRowsInDb.length,
    linhasEsperadasSemDuplicar: parallelRows.length,
    duplicou: parallelRowsInDb.length > parallelRows.length,
    duplicadosExatos: parallelFingerprints.filter(
      (value, index) => parallelFingerprints.indexOf(value) !== index,
    ).length,
  });

  // B9 — isolamento: conta e categoria de outro utilizador.
  const foreignAccountAttempt = await prisma.financialAccount.findFirst({
    where: { id: otherAccount.id, userId: user.id },
    select: { id: true },
  });
  const foreignCategoryAttempt = await prisma.category.findFirst({
    where: { id: otherCategory.id, userId: user.id, isInternal: false },
    select: { id: true },
  });
  const isolationImport = await confirmLikeAction({
    userId: user.id,
    accountId: account.id,
    rows: [
      {
        date: '2026-09-05',
        description: 'LINHA COM CATEGORIA DE OUTRO',
        amountInCents: -500,
        fitId: 'ISO-1',
        categoryId: otherCategory.id,
      },
    ],
    ownedCategoryIds,
  });
  const isolationRow = await prisma.transaction.findFirst({
    where: { financialAccountId: account.id, fitId: 'ISO-1' },
    select: { categoryId: true, userId: true },
  });

  log('B9_isolamento', {
    contaDeOutroAceite: foreignAccountAttempt !== null,
    categoriaDeOutroAceite: foreignCategoryAttempt !== null,
    linhaGravada: isolationRow !== null,
    userIdDaLinhaEODaImportacao: isolationRow?.userId === user.id,
    categoryIdFicouNulo: isolationRow?.categoryId === null,
    resultadoDaConfirmacao: isolationImport,
  });

  // B10 — linhas inválidas.
  const invalidRowsInput = [
    { date: null, description: 'SEM DATA', amountInCents: -100, fitId: 'INV-1', categoryId: null },
    {
      date: '2026-09-06',
      description: 'SEM VALOR',
      amountInCents: null,
      fitId: 'INV-2',
      categoryId: null,
    },
    {
      date: '2026-09-07',
      description: 'VALOR ZERO',
      amountInCents: 0,
      fitId: 'INV-3',
      categoryId: null,
    },
    {
      date: '2026-02-31',
      description: 'DATA IMPOSSIVEL',
      amountInCents: -100,
      fitId: 'INV-4',
      categoryId: null,
    },
    {
      date: '2026-09-08',
      description: 'CATEGORIA INEXISTENTE',
      amountInCents: -100,
      fitId: 'INV-5',
      categoryId: 'categoria-que-nao-existe',
    },
  ];
  // A porta real é o schema (import-actions.ts:125); sem ele o `new Date` de
  // `2026-02-31` normaliza para 3 de março em silêncio.
  const invalidSchemaCheck = shared.confirmImportSchema.safeParse({
    accountId: account.id,
    rows: invalidRowsInput,
  });

  const invalidImport = await confirmLikeAction({
    userId: user.id,
    accountId: account.id,
    rows: invalidRowsInput,
    ownedCategoryIds,
  });
  const invalidRows = await prisma.transaction.findMany({
    where: {
      financialAccountId: account.id,
      fitId: { in: ['INV-1', 'INV-2', 'INV-3', 'INV-4', 'INV-5'] },
    },
    select: { fitId: true, date: true, categoryId: true, amountInCents: true },
  });

  // Valor acima do máximo da coluna `Int` (defeito já reportado em T3.3).
  const overflowInput = {
    date: '2026-09-09',
    description: 'VALOR ACIMA DO INT',
    amountInCents: 99_999_999_999,
    fitId: 'INV-6',
    categoryId: null,
  };
  const overflowSchemaCheck = shared.confirmImportSchema.safeParse({
    accountId: account.id,
    rows: [overflowInput],
  });
  const overflowImport = await confirmLikeAction({
    userId: user.id,
    accountId: account.id,
    rows: [overflowInput],
    ownedCategoryIds,
  });

  log('B10_linhas_invalidas', {
    schemaAceitaOPayload: invalidSchemaCheck.success,
    errosDoSchema: invalidSchemaCheck.success
      ? []
      : invalidSchemaCheck.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    resultadoSemSchema: invalidImport,
    linhasGravadas: invalidRows.map((row) => ({
      fitId: row.fitId,
      date: row.date.toISOString().slice(0, 10),
      amountInCents: row.amountInCents,
      categoryId: row.categoryId,
    })),
    dataImpossivelGravada:
      invalidRows
        .find((row) => row.fitId === 'INV-4')
        ?.date.toISOString()
        .slice(0, 10) ?? null,
    valorAcimaDoInt: {
      schemaAceita: overflowSchemaCheck.success,
      resultado: overflowImport,
    },
  });

  // =========================================================================
  // PARTE C — exportação
  // =========================================================================
  const exportRows = await prisma.transaction.findMany({
    where: { userId: user.id },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    select: {
      date: true,
      description: true,
      amountInCents: true,
      fitId: true,
      kind: true,
      category: { select: { name: true } },
      financialAccount: { select: { name: true } },
    },
  });

  const csv = buildTransactionsCsv(
    exportRows.map((row) => ({
      date: row.date,
      description: row.description,
      amountInCents: row.amountInCents,
      fitId: row.fitId,
      kind: row.kind,
      accountName: row.financialAccount?.name ?? null,
      categoryName: row.category?.name ?? null,
    })),
  );

  const reimportPreview = await previewArgs(secondAccount.id, csv, user.id);
  const reimport = await confirmLikeAction({
    userId: user.id,
    accountId: secondAccount.id,
    rows: toRows(reimportPreview.rows.filter((row) => row.status === 'new')),
    ownedCategoryIds,
  });
  const reimported = await prisma.transaction.findMany({
    where: { financialAccountId: secondAccount.id },
    select: { date: true, amountInCents: true, description: true, fitId: true },
    orderBy: { date: 'asc' },
  });

  const originalStats = exportRows.reduce(
    (accumulator, row) => {
      accumulator.count += 1;
      accumulator.sum += row.amountInCents;
      accumulator.keys.add(`${row.date.toISOString().slice(0, 10)}|${String(row.amountInCents)}`);

      return accumulator;
    },
    { count: 0, sum: 0, keys: new Set<string>() },
  );
  const reimportedStats = reimported.reduce(
    (accumulator, row) => {
      accumulator.count += 1;
      accumulator.sum += row.amountInCents;
      accumulator.keys.add(`${row.date.toISOString().slice(0, 10)}|${String(row.amountInCents)}`);

      return accumulator;
    },
    { count: 0, sum: 0, keys: new Set<string>() },
  );

  // Reimportar para a MESMA conta (todos os fitId já existem).
  const rowsInFirstAccountBeforeSameImport = await countRows(account.id);
  const sameAccountPreview = await previewArgs(account.id, csv, user.id);
  const sameAccountReimport = await confirmLikeAction({
    userId: user.id,
    accountId: account.id,
    rows: toRows(sameAccountPreview.rows),
    ownedCategoryIds,
  });
  const rowsInFirstAccountAfter = await countRows(account.id);
  // O caminho que a interface usa: só as linhas marcadas (`new`).
  const sameAccountSelectedReimport = await confirmLikeAction({
    userId: user.id,
    accountId: account.id,
    rows: toRows(sameAccountPreview.rows.filter((row) => row.selected)),
    ownedCategoryIds,
  });
  const emptyRowsCheck = shared.confirmImportSchema.safeParse({ accountId: account.id, rows: [] });

  log('C11_ciclo_csv', {
    linhasExportadas: originalStats.count,
    somaExportadaEmCents: originalStats.sum,
    primeiraLinhaDoFicheiro: csv.split('\r\n')[0]?.slice(0, 80) ?? null,
    linhaDeDados: csv.split('\r\n')[1] ?? null,
    previewDoCsvReimportado: {
      linhas: reimportPreview.rows.length,
      novos: reimportPreview.newCount,
      duplicados: reimportPreview.duplicateCount,
      suspeitos: reimportPreview.suspiciousCount,
      problemas: reimportPreview.issues.length,
    },
    reimportadoParaContaNova: { ...reimport, linhasNaConta: reimportedStats.count },
    somaReimportadaEmCents: reimportedStats.sum,
    fechaAoCENTIMO:
      originalStats.sum === reimportedStats.sum && originalStats.count === reimportedStats.count,
    datasEValoresIguais: (() => {
      const original = [...originalStats.keys];
      const volta = [...reimportedStats.keys];

      return (
        original.length === volta.length && original.every((key, index) => volta[index] === key)
      );
    })(),
    reimportadoParaAMesmaConta: {
      duplicadosNaPreview: sameAccountPreview.duplicateCount,
      novosNaPreview: sameAccountPreview.newCount,
      ...sameAccountReimport,
      linhasNaContaAntes: rowsInFirstAccountBeforeSameImport,
      linhasNaContaDepois: rowsInFirstAccountAfter,
      criouAlguma: rowsInFirstAccountAfter !== rowsInFirstAccountBeforeSameImport,
      caminhoDaInterfaceSoComSelecionadas: {
        linhas: sameAccountPreview.rows.filter((row) => row.selected).length,
        ...sameAccountSelectedReimport,
      },
      confirmarSemLinhasSelecionadas: {
        schemaAceita: emptyRowsCheck.success,
        erro: emptyRowsCheck.success ? null : (emptyRowsCheck.error.issues[0]?.message ?? null),
      },
    },
  });

  log('C13_formato_excel', {
    temBom: csv.startsWith('\uFEFF'),
    separadorPontoEVirgula: (csv.split('\r\n')[0] ?? '').includes(';'),
    terminaCadaLinhaComCrLf: csv.endsWith('\r\n'),
    decimaisComVirgula: /;-?\d+,\d{2};/.test(csv),
    cabecalho: csv.split('\r\n')[0]?.replace('\uFEFF', '') ?? null,
    exemploDeValorFormatado: shared.formatCentsForCsv(-123456),
  });

  // C12 — completude do backup. As linhas que o backup **não** exporta são
  // criadas primeiro, para as contagens as mostrarem.
  const goal = await prisma.goal.create({
    data: {
      userId: user.id,
      name: `Objetivo QA ${RUN}`,
      targetAmountInCents: 100_000,
      initialReservedInCents: 10_000,
      targetDate: new Date('2027-01-01T00:00:00.000Z'),
      contributionFrequency: 'MONTHLY',
    },
    select: { id: true },
  });
  await prisma.goalMovement.create({
    data: {
      userId: user.id,
      goalId: goal.id,
      type: 'DEPOSIT',
      amountInCents: 25_000,
      date: new Date('2026-10-01T00:00:00.000Z'),
    },
  });
  await prisma.lockedBalance.create({
    data: {
      userId: user.id,
      financialAccountId: account.id,
      referenceDate: new Date('2026-10-31T00:00:00.000Z'),
      reportedBalanceInCents: 1000,
      computedBalanceInCents: 900,
      adjustmentInCents: 100,
    },
  });
  await prisma.monthClose.create({
    data: { userId: user.id, periodStart: new Date('2026-10-01T00:00:00.000Z') },
  });

  const modelsWithUserId = [
    'financialAccount',
    'lockedBalance',
    'creditCard',
    'invoice',
    'invoicePayment',
    'category',
    'tag',
    'transaction',
    'transactionRule',
    'recurrence',
    'budget',
    'goal',
    'goalMovement',
    'asset',
    'liability',
    'monthClose',
  ];
  const exportedInBackup = [
    'accounts',
    'categories',
    'tags',
    'transactions',
    'cards',
    'invoices',
    'invoicePayments',
    'goals',
    'goalMovements',
    'budgets',
    'recurrences',
    'rules',
    'assets',
    'liabilities',
  ];
  const counts: Record<string, number> = {};

  for (const [model, name] of [
    ['financialAccount', 'accounts'],
    ['lockedBalance', 'lockedBalances'],
    ['creditCard', 'cards'],
    ['invoice', 'invoices'],
    ['invoicePayment', 'invoicePayments'],
    ['category', 'categories'],
    ['tag', 'tags'],
    ['transaction', 'transactions'],
    ['transactionRule', 'rules'],
    ['recurrence', 'recurrences'],
    ['budget', 'budgets'],
    ['goal', 'goals'],
    ['goalMovement', 'goalMovements'],
    ['asset', 'assets'],
    ['liability', 'liabilities'],
    ['monthClose', 'monthCloses'],
  ] as const) {
    // @ts-expect-error — acesso dinâmico ao delegate do Prisma, só para contagem.
    counts[name] = await prisma[model].count({ where: { userId: user.id } });
  }

  const movementsForGoal = await prisma.goalMovement.findMany({
    where: { userId: user.id, goalId: goal.id },
    select: { type: true, amountInCents: true, date: true },
  });
  const motorGoal = shared.goalProgress({
    goal: {
      id: goal.id,
      targetAmountInCents: 100_000,
      initialReservedInCents: 10_000,
      targetDate: '2027-01-01',
      contributionFrequency: 'monthly',
    },
    movements: movementsForGoal.map((movement) => ({
      goalId: goal.id,
      type: movement.type === 'WITHDRAWAL' ? ('withdrawal' as const) : ('deposit' as const),
      amountInCents: movement.amountInCents,
      date: movement.date.toISOString().slice(0, 10),
    })),
    today: '2026-10-11',
  });

  log('C12_backup', {
    modelosComUserIdNaBase: modelsWithUserId.length,
    entidadesExportadas: exportedInBackup.length,
    contagensNaBase: {
      ...counts,
      lockedBalancesDepois: await prisma.lockedBalance.count({ where: { userId: user.id } }),
      monthClosesDepois: await prisma.monthClose.count({ where: { userId: user.id } }),
      goals: 1,
      goalMovements: 1,
    },
    naoExportados: ['lockedBalance', 'monthClose'],
    preferenciasDoUtilizadorNoBackup: ['id', 'email', 'name', 'currency'],
    preferenciasQueFaltam: ['monthStartDay', 'accountingBasis', 'primaryAccountId'],
    acumuladoDoObjetivoPeloMotorEmCents: motorGoal.accumulatedInCents,
    acumuladoEsperado: 35_000,
    colunaAccumulatedInCentsAindaExiste: false,
  });

  // =========================================================================
  // Limpeza
  // =========================================================================
  const realBefore = await prisma.user.findUnique({
    where: { email: REAL_USER_EMAIL },
    select: { id: true },
  });
  const realCounts =
    realBefore === null
      ? null
      : {
          categories: await prisma.category.count({ where: { userId: realBefore.id } }),
          accounts: await prisma.financialAccount.count({ where: { userId: realBefore.id } }),
          transactions: await prisma.transaction.count({ where: { userId: realBefore.id } }),
        };

  for (const id of [...new Set(createdUserIds)]) {
    await prisma.transaction.deleteMany({ where: { userId: id } });
    await prisma.goalMovement.deleteMany({ where: { userId: id } });
    await prisma.goal.deleteMany({ where: { userId: id } });
    await prisma.lockedBalance.deleteMany({ where: { userId: id } });
    await prisma.monthClose.deleteMany({ where: { userId: id } });
    await prisma.recurrence.deleteMany({ where: { userId: id } });
    await prisma.transactionRule.deleteMany({ where: { userId: id } });
    await prisma.budgetLimit.deleteMany({ where: { userId: id } });
    await prisma.budget.deleteMany({ where: { userId: id } });
    await prisma.invoicePayment.deleteMany({ where: { userId: id } });
    await prisma.invoice.deleteMany({ where: { userId: id } });
    await prisma.creditCard.deleteMany({ where: { userId: id } });
    await prisma.category.deleteMany({ where: { userId: id } });
    await prisma.financialAccount.deleteMany({ where: { userId: id } });
    await prisma.session.deleteMany({ where: { userId: id } });
    await prisma.account.deleteMany({ where: { userId: id } });
    await prisma.user.deleteMany({ where: { id } });
  }

  log('limpeza', {
    utilizadoresApagados: [...new Set(createdUserIds)].length,
    qaRestantes: await prisma.user.count({ where: { email: { startsWith: 'qa-' } } }),
    utilizadoresNaBase: await prisma.user.count(),
    orfaos: {
      transactions: await prisma.transaction.count({ where: { userId: { in: createdUserIds } } }),
      accounts: await prisma.financialAccount.count({ where: { userId: { in: createdUserIds } } }),
      categories: await prisma.category.count({ where: { userId: { in: createdUserIds } } }),
    },
    realCounts,
    realUserExists: realBefore !== null,
  });

  console.log('RESULTADO_JSON_INICIO');
  console.log(JSON.stringify(summary, null, 2));
  console.log('RESULTADO_JSON_FIM');

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('FALHA NA VERIFICAÇÃO:', error);
  process.exitCode = 1;
});
