/**
 * Planificador da reversão de uma importação.
 *
 * **Porque é uma função pura.** Apagar é mais perigoso do que criar, e a decisão
 * de apagar não pode depender de nada que não se possa verificar linha a linha. O
 * que fica aqui é a regra; a consulta e a transação ficam na camada de servidor.
 * Assim a regra é testável sem base de dados — e é a regra que tem de estar certa.
 *
 * **O critério.** Não se usa `updatedAt > createdAt`: o `updatedAt` é escrito pelo
 * Prisma na criação e pode diferir do `createdAt` por microssegundos (recusaria
 * tudo, inútil), e uma edição feita no mesmo segundo da importação passaria
 * despercebida (apagaria um movimento editado à mão). O critério é **igualdade de
 * conteúdo**: um movimento só é apagado se ainda tiver exatamente tudo o que a
 * importação escreveu. Basta um campo diferente para o movimento sobreviver, com o
 * motivo escrito — errar por omissão de apagar é a única direção aceitável.
 *
 * A comparação é **exata** de propósito, ao contrário da deteção de duplicados em
 * `preview.ts`, que normaliza acentos e espaços: aqui qualquer diferença é motivo
 * para não apagar, não para considerar igual.
 *
 * **A descrição viaja como impressão digital, nunca como texto.** O recibo da
 * importação fica no `localStorage` do browser — que não é nosso, pode ser
 * partilhado ou emprestado e sobrevive a um logout — e descrições de extratos são
 * texto financeiro legível. O que se guarda é o `sha256` da descrição: a
 * comparação continua exata (o servidor calcula a impressão digital do valor que
 * está na base e compara as duas) e o browser deixa de ter lá o texto.
 */

/** O que a importação escreveu numa linha, tal como o servidor o devolve. */
export interface RevertExpectedRow {
  readonly transactionId: string;
  readonly fitId: string | null;
  readonly date: string;
  readonly amountInCents: number;
  /** `sha256` da descrição escrita, não a descrição. */
  readonly descriptionDigest: string;
  readonly categoryId: string | null;
}

/** O movimento como ele está agora na base de dados. */
export interface RevertCandidateRow {
  readonly id: string;
  readonly userId: string;
  readonly accountId: string | null;
  readonly origin: string;
  readonly fitId: string | null;
  readonly date: string;
  readonly amountInCents: number;
  /** `sha256` da descrição atual, calculada pelo servidor. */
  readonly descriptionDigest: string;
  readonly categoryId: string | null;
  readonly status: string;
  readonly settled: boolean;
  readonly invoiceId: string | null;
  readonly goalId: string | null;
  readonly transferGroupId: string | null;
  readonly recurrenceId: string | null;
  /** Existe um pagamento de fatura a apontar para este movimento. */
  readonly referencedByInvoicePayment: boolean;
}

/** Decisão sobre uma linha, com o motivo em português quando é recusada. */
export type RevertVerdict =
  { readonly deletable: true } | { readonly deletable: false; readonly reason: string };

/**
 * Decide se um movimento pode ser apagado por esta reversão.
 *
 * A ordem das verificações vai da mais específica para a mais genérica, para o
 * motivo que aparece ao utilizador dizer o que se passa com *este* movimento em
 * vez de uma recusa genérica.
 */
export function evaluateRevertCandidate(args: {
  readonly candidate: RevertCandidateRow;
  readonly expected: RevertExpectedRow;
  /** Conta que a importação usou. */
  readonly accountId: string;
  /** Utilizador da sessão. */
  readonly userId: string;
}): RevertVerdict {
  const { candidate, expected, accountId, userId } = args;

  // Nunca de outra pessoa nem de outra conta, mesmo que o identificador venha de fora.
  if (candidate.userId !== userId) {
    return { deletable: false, reason: 'O movimento pertence a outro utilizador.' };
  }

  if (candidate.accountId !== accountId) {
    return { deletable: false, reason: 'O movimento está noutra conta.' };
  }

  if (candidate.id !== expected.transactionId) {
    return { deletable: false, reason: 'O movimento não corresponde ao que foi importado.' };
  }

  if (candidate.origin !== 'IMPORTED') {
    return { deletable: false, reason: 'O movimento não foi criado por uma importação.' };
  }

  // Guarda da fatura: um movimento de extrato nunca nasce com fatura ligada.
  if (candidate.invoiceId !== null || candidate.referencedByInvoicePayment) {
    return {
      deletable: false,
      reason: 'O movimento está ligado a uma fatura de cartão (ou ao pagamento de uma).',
    };
  }

  if (candidate.goalId !== null) {
    return { deletable: false, reason: 'O movimento está ligado a um objetivo.' };
  }

  if (candidate.transferGroupId !== null) {
    return { deletable: false, reason: 'O movimento faz parte de uma transferência.' };
  }

  if (candidate.recurrenceId !== null) {
    return { deletable: false, reason: 'O movimento foi gerado por uma recorrência.' };
  }

  if (candidate.status !== 'CONFIRMED') {
    return { deletable: false, reason: 'O estado do movimento foi alterado depois da importação.' };
  }

  if (!candidate.settled) {
    return {
      deletable: false,
      reason: 'O movimento deixou de estar liquidado depois da importação.',
    };
  }

  // Igualdade de conteúdo: qualquer campo diferente significa «mexeram nisto».
  // As descrições são comparadas por impressão digital — o servidor calcula a do
  // valor atual e a do que foi escrito; texto igual dá a mesma impressão digital.
  if (
    candidate.date !== expected.date ||
    candidate.amountInCents !== expected.amountInCents ||
    candidate.descriptionDigest !== expected.descriptionDigest ||
    candidate.categoryId !== expected.categoryId ||
    candidate.fitId !== expected.fitId
  ) {
    return { deletable: false, reason: 'O movimento foi alterado depois da importação.' };
  }

  return { deletable: true };
}

/** Plano da reversão: o que apagar, o que fica com motivo e o que já não existe. */
export interface RevertPlan {
  readonly toDelete: readonly string[];
  readonly skipped: readonly { readonly transactionId: string; readonly reason: string }[];
  /**
   * Identificadores que a importação criou e que já não existem na base.
   *
   * É o que distingue «já foi desfeita» de «recusei apagar»: um segundo clique
   * numa importação já revertida cai aqui, e a interface pode dizê-lo em vez de
   * anunciar zero movimentos apagados como se fosse sucesso.
   */
  readonly missing: readonly string[];
}

/**
 * Compara o que a importação criou com o que existe agora.
 *
 * Só os identificadores que a importação criou entram em conta: um movimento
 * parecido mas de outra importação (ou criado à mão com os mesmos dados) nunca é
 * considerado, porque a decisão é guiada pelos identificadores e não pelo
 * conteúdo.
 */
export function planRevert(args: {
  readonly expected: readonly RevertExpectedRow[];
  readonly candidates: readonly RevertCandidateRow[];
  readonly accountId: string;
  readonly userId: string;
}): RevertPlan {
  const candidateById = new Map(args.candidates.map((row) => [row.id, row]));
  const toDelete: string[] = [];
  const skipped: { transactionId: string; reason: string }[] = [];
  const missing: string[] = [];

  for (const expected of args.expected) {
    const candidate = candidateById.get(expected.transactionId);

    if (candidate === undefined) {
      missing.push(expected.transactionId);
      continue;
    }

    const verdict = evaluateRevertCandidate({
      candidate,
      expected,
      accountId: args.accountId,
      userId: args.userId,
    });

    if (verdict.deletable) {
      toDelete.push(candidate.id);
    } else {
      skipped.push({ transactionId: candidate.id, reason: verdict.reason });
    }
  }

  return { toDelete, skipped, missing };
}
