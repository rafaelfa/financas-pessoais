import { describe, expect, it } from 'vitest';

import { confirmImportSchema, revertImportSchema } from '../../schemas/domain/import';
import {
  evaluateRevertCandidate,
  planRevert,
  type RevertCandidateRow,
  type RevertExpectedRow,
} from '../revert';

/**
 * Testes do planificador da reversão.
 *
 * A reversão é a operação mais destrutiva da aplicação: apaga de uma vez o que
 * uma importação criou. Estes testes existem para provar três coisas:
 *
 * 1. **Nunca apaga o que não é desta importação** — de outra importação, de outra
 *    conta ou de outro utilizador;
 * 2. **Nunca apaga o que foi alterado depois** — a comparação é de conteúdo
 *    exato, e qualquer diferença faz o movimento sobreviver;
 * 3. **Não anuncia sucesso quando não apagou** — o que já não existe é reportado
 *    à parte, para um segundo clique não parecer que fez alguma coisa.
 */

const CONTEXT = { accountId: 'acc-1', userId: 'user-1' } as const;

/** Impressões digitais de 64 hexadecimais, como as que o servidor calcula. */
const DIGEST_CONTINENTE = 'a1'.repeat(32);
const DIGEST_OUTRA = 'b2'.repeat(32);

function expectedRow(overrides: Partial<RevertExpectedRow> = {}): RevertExpectedRow {
  return {
    transactionId: 'tx-1',
    fitId: 'FIT-1',
    date: '2026-10-05',
    amountInCents: -2550,
    // A descrição viaja como impressão digital: o browser nunca guarda o texto.
    descriptionDigest: DIGEST_CONTINENTE,
    categoryId: 'cat-alimentacao',
    ...overrides,
  };
}

function candidateRow(overrides: Partial<RevertCandidateRow> = {}): RevertCandidateRow {
  return {
    id: 'tx-1',
    userId: 'user-1',
    accountId: 'acc-1',
    origin: 'IMPORTED',
    fitId: 'FIT-1',
    date: '2026-10-05',
    amountInCents: -2550,
    descriptionDigest: DIGEST_CONTINENTE,
    categoryId: 'cat-alimentacao',
    status: 'CONFIRMED',
    settled: true,
    invoiceId: null,
    goalId: null,
    transferGroupId: null,
    recurrenceId: null,
    referencedByInvoicePayment: false,
    ...overrides,
  };
}

function plan(
  expected: readonly RevertExpectedRow[],
  candidates: readonly RevertCandidateRow[],
): ReturnType<typeof planRevert> {
  return planRevert({ expected, candidates, ...CONTEXT });
}

describe('planRevert — o que nunca é apagado', () => {
  it('não toca num movimento de outra importação, mesmo com o mesmo conteúdo', () => {
    // O movimento da outra importação é idêntico em tudo menos no identificador:
    // é o caso que uma comparação por conteúdo (em vez de por identificador)
    // apagaria por engano.
    const outraImportacao = candidateRow({ id: 'tx-outra', fitId: 'FIT-9' });
    const resultado = plan([expectedRow()], [candidateRow(), outraImportacao]);

    expect(resultado.toDelete).toEqual(['tx-1']);
    expect(resultado.toDelete).not.toContain('tx-outra');
  });

  it('recusa um movimento que está noutra conta', () => {
    const resultado = plan([expectedRow()], [candidateRow({ accountId: 'acc-2' })]);

    expect(resultado.toDelete).toEqual([]);
    expect(resultado.skipped).toEqual([
      { transactionId: 'tx-1', reason: 'O movimento está noutra conta.' },
    ]);
  });

  it('recusa um movimento de outro utilizador', () => {
    const resultado = plan([expectedRow()], [candidateRow({ userId: 'user-2' })]);

    expect(resultado.toDelete).toEqual([]);
    expect(resultado.skipped[0]?.reason).toBe('O movimento pertence a outro utilizador.');
  });

  it('ignora movimentos que ninguém pediu para apagar', () => {
    // Nenhum deles está em `expected`: a lista de candidatos pode ser larga, mas a
    // decisão é guiada pelos identificadores da importação.
    const resultado = plan(
      [expectedRow()],
      [
        candidateRow(),
        candidateRow({ id: 'tx-manual', origin: 'MANUAL', fitId: null }),
        candidateRow({ id: 'tx-trimestre', accountId: 'acc-9' }),
      ],
    );

    expect(resultado.toDelete).toEqual(['tx-1']);
    expect(resultado.skipped).toEqual([]);
  });
});

describe('planRevert — alterações depois da importação', () => {
  it('recusa um movimento com o valor alterado', () => {
    const resultado = plan([expectedRow()], [candidateRow({ amountInCents: -2551 })]);

    expect(resultado.toDelete).toEqual([]);
    expect(resultado.skipped[0]?.reason).toBe('O movimento foi alterado depois da importação.');
  });

  it('recusa um movimento com a descrição, a data, a categoria ou o fitId alterados', () => {
    const casos = [
      candidateRow({ descriptionDigest: DIGEST_OUTRA }),
      candidateRow({ date: '2026-10-06' }),
      candidateRow({ categoryId: 'cat-lazer' }),
      candidateRow({ fitId: 'FIT-OUTRO' }),
    ];

    for (const candidato of casos) {
      const resultado = plan([expectedRow()], [candidato]);

      expect(resultado.toDelete).toEqual([]);
      expect(resultado.skipped[0]?.reason).toBe('O movimento foi alterado depois da importação.');
    }
  });

  it('recusa um movimento cujo estado ou liquidação foi mexido', () => {
    const ignorado = plan([expectedRow()], [candidateRow({ status: 'IGNORED' })]);
    const porLiquidar = plan([expectedRow()], [candidateRow({ settled: false })]);

    expect(ignorado.skipped[0]?.reason).toBe(
      'O estado do movimento foi alterado depois da importação.',
    );
    expect(porLiquidar.skipped[0]?.reason).toBe(
      'O movimento deixou de estar liquidado depois da importação.',
    );
  });

  it('recusa um movimento que já não veio de uma importação', () => {
    const resultado = plan([expectedRow()], [candidateRow({ origin: 'MANUAL' })]);

    expect(resultado.skipped[0]?.reason).toBe('O movimento não foi criado por uma importação.');
  });
});

describe('planRevert — guardas de ligações', () => {
  it('recusa um movimento ligado a uma fatura de cartão', () => {
    const resultado = plan([expectedRow()], [candidateRow({ invoiceId: 'inv-1' })]);

    expect(resultado.toDelete).toEqual([]);
    expect(resultado.skipped[0]?.reason).toContain('fatura de cartão');
  });

  it('recusa um movimento referenciado por um pagamento de fatura', () => {
    const resultado = plan([expectedRow()], [candidateRow({ referencedByInvoicePayment: true })]);

    expect(resultado.toDelete).toEqual([]);
    expect(resultado.skipped[0]?.reason).toContain('pagamento de uma');
  });

  it('recusa um movimento ligado a um objetivo, a uma transferência ou a uma recorrência', () => {
    const objetivo = plan([expectedRow()], [candidateRow({ goalId: 'goal-1' })]);
    const transferencia = plan([expectedRow()], [candidateRow({ transferGroupId: 'transf-1' })]);
    const recorrencia = plan([expectedRow()], [candidateRow({ recurrenceId: 'rec-1' })]);

    expect(objetivo.skipped[0]?.reason).toContain('objetivo');
    expect(transferencia.skipped[0]?.reason).toContain('transferência');
    expect(recorrencia.skipped[0]?.reason).toContain('recorrência');
  });
});

describe('planRevert — o caminho normal', () => {
  it('apaga um movimento que continua exatamente como a importação o escreveu', () => {
    const resultado = plan([expectedRow()], [candidateRow()]);

    expect(resultado.toDelete).toEqual(['tx-1']);
    expect(resultado.skipped).toEqual([]);
    expect(resultado.missing).toEqual([]);
  });

  it('apaga duas linhas iguais da mesma importação, porque são as duas dela', () => {
    const primeira = expectedRow();
    const segunda = expectedRow({ transactionId: 'tx-2' });
    const resultado = plan([primeira, segunda], [candidateRow(), candidateRow({ id: 'tx-2' })]);

    expect(resultado.toDelete).toEqual(['tx-1', 'tx-2']);
  });

  it('reporta como em falta o que já não existe, em vez de o contar como recusado', () => {
    // Segunda tentativa sobre uma importação já desfeita: nada a apagar, e a
    // interface tem de o poder dizer sem anunciar sucesso.
    const resultado = plan([expectedRow(), expectedRow({ transactionId: 'tx-2' })], []);

    expect(resultado.toDelete).toEqual([]);
    expect(resultado.skipped).toEqual([]);
    expect(resultado.missing).toEqual(['tx-1', 'tx-2']);
  });

  it('é determinístico: a mesma entrada dá o mesmo plano', () => {
    const candidatos = [candidateRow(), candidateRow({ id: 'tx-2', amountInCents: -999 })];
    const esperado = [expectedRow(), expectedRow({ transactionId: 'tx-2' })];

    expect(plan(esperado, candidatos)).toEqual(plan(esperado, candidatos));
  });
});

describe('evaluateRevertCandidate', () => {
  it('aceita o movimento intacto e devolve o motivo em português quando recusa', () => {
    expect(
      evaluateRevertCandidate({ candidate: candidateRow(), expected: expectedRow(), ...CONTEXT }),
    ).toEqual({ deletable: true });

    expect(
      evaluateRevertCandidate({
        candidate: candidateRow({ accountId: 'acc-2' }),
        expected: expectedRow(),
        ...CONTEXT,
      }),
    ).toEqual({ deletable: false, reason: 'O movimento está noutra conta.' });
  });
});

describe('revertImportSchema', () => {
  it('exige a conta e pelo menos uma linha', () => {
    expect(revertImportSchema.safeParse({ accountId: 'acc-1', expected: [] }).success).toBe(false);
    expect(
      revertImportSchema.safeParse({ accountId: 'acc-1', expected: [expectedRow()] }).success,
    ).toBe(true);
  });

  it('recusa uma data que não é uma data de calendário real', () => {
    const resultado = revertImportSchema.safeParse({
      accountId: 'acc-1',
      expected: [expectedRow({ date: '2026-02-30' })],
    });

    expect(resultado.success).toBe(false);
  });
});

describe('limite de linhas em português', () => {
  it('a mensagem do limite de importação está em português, não na do Zod', () => {
    // Registo do Lead depois da task-21: o limite existia sem mensagem traduzida.
    const linhas = Array.from({ length: 2_001 }, () => ({
      date: '2026-10-05',
      description: 'Compra',
      amountInCents: -100,
      fitId: null,
      categoryId: null,
    }));

    const resultado = confirmImportSchema.safeParse({ accountId: 'acc-1', rows: linhas });

    expect(resultado.success).toBe(false);

    if (!resultado.success) {
      expect(resultado.error.issues[0]?.message).toBe(
        'Uma importação não pode passar de 2000 linhas.',
      );
    }
  });
});
