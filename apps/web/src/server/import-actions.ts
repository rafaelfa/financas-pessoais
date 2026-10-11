'use server';

import { prisma } from '@repo/db/client';
import {
  type ImportFormat,
  descriptionDigest,
  planRevert,
  previewImportSchema,
  toIsoDate,
  confirmImportSchema,
  type RevertCandidateRow,
  type RevertExpectedRow,
} from '@repo/shared';
import { runConfirm, type ImportedTransactionRef, type SkippedImportRow } from './import-confirm';
import { revertImportSchema } from '@repo/shared/schemas/domain';
import { revalidatePath } from 'next/cache';

/**
 * Reexporta os tipos do recibo da importação.
 *
 * Vivem em `import-confirm.ts` (o núcleo testável), mas quem os consome — o ecrã
 * que guarda o recibo e oferece desfazer — importa-os daqui, pela mesma porta das
 * ações. Reexportar evita que a interface tenha de conhecer a divisão interna
 * entre o núcleo e a ação.
 */
export type { ImportedTransactionRef, SkippedImportRow } from './import-confirm';

import {
  buildImportPreview,
  resolveFormat,
  toPreviewRules,
  type ExistingTransaction,
  type ImportPreview,
  type PreviewAccount,
  type RuleRow,
} from './import';
import { fail, fromZodError, ok, type ActionResult } from './result';
import { requireUser } from './session';

/**
 * Importação de extratos bancários: pré-visualizar e só depois gravar.
 *
 * -----------------------------------------------------------------------------
 * PORQUE DUAS FASES
 * -----------------------------------------------------------------------------
 * Um extrato é o documento de onde saem todos os saldos do mês. Importar sem ver
 * é aceitar cegamente o que o parser percebeu — e o parser trabalha com um
 * ficheiro que não escrevemos nós. A pré-visualização mostra, linha a linha, o
 * que seria criado, o que já existe e o que é suspeito, e **nada é gravado**
 * enquanto a pessoa não confirmar.
 *
 * As sugestões de categoria saem do motor de regras que já existe
 * (`classifyTransaction`, em `@repo/shared`): duas implementações da mesma ideia
 * divergem sempre, e a página de regras passaria a mentir sobre o que faz.
 *
 * A importação **nunca** cria contas nem categorias.
 */

/**
 * Lê um extrato e devolve o que **seria** criado.
 *
 * Não escreve nada. As idas à base de dados servem só para saber o que já existe
 * na conta — é isso que decide o estado de cada linha — e para trazer as regras
 * de categorização.
 */
export async function previewImport(input: unknown): Promise<ActionResult<ImportPreview>> {
  const user = await requireUser();
  const parsed = previewImportSchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const { accountId, content } = parsed.data;
  const format: ImportFormat = resolveFormat(content, parsed.data.format);

  /*
   * A conta tem de ser do utilizador da sessão. Um identificador de outra pessoa
   * daria uma pré-visualização com os duplicados dela — e, como a confirmação
   * repete esta verificação, nenhum lançamento pode acabar na conta errada.
   */
  const account = await prisma.financialAccount.findFirst({
    where: { id: accountId, userId: user.id },
    select: { id: true, name: true, openingBalanceInCents: true, balanceInCents: true },
  });

  if (account === null) {
    return fail('Conta não encontrada.', { accountId: ['Escolhe uma conta tua.'] });
  }

  /*
   * O que já existe na conta: o `fitId` (a chave `@@unique([financialAccountId,
   * fitId])` da base de dados) e a data, valor e descrição, que reconhecem um
   * duplicado quando o ficheiro não traz identificador — o caso dos CSV.
   */
  const [existing, rules, categories] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId: user.id, financialAccountId: account.id },
      select: { fitId: true, date: true, amountInCents: true, description: true },
      take: 20_000,
      orderBy: { date: 'desc' },
    }),
    prisma.transactionRule.findMany({ where: { userId: user.id, enabled: true } }),
    prisma.category.findMany({ where: { userId: user.id }, select: { id: true, name: true } }),
  ]);

  const previewRules = toPreviewRules(rules as readonly RuleRow[], categories);

  const preview = buildImportPreview({
    format,
    content,
    account: account satisfies PreviewAccount,
    existing: existing satisfies readonly ExistingTransaction[],
    rules: previewRules.rules,
    categoryNames: previewRules.categoryNames,
  });

  return ok({
    accountId: account.id,
    accountName: account.name,
    ...preview,
  });
}

export interface ConfirmImportResult {
  readonly created: number;
  readonly skipped: number;
  /**
   * O que a importação escreveu, linha a linha.
   *
   * É o recibo que a reversão precisa: sem ele não há como distinguir um
   * movimento intacto de um que foi editado depois da importação — e é essa
   * distinção que decide o que pode ser apagado.
   */
  readonly imported: readonly ImportedTransactionRef[];
  /**
   * Linhas que já existiam na conta (o mesmo identificador). Contadas à parte de
   * `skipped`, que também inclui as recusadas: `created + alreadyExists +
   * skippedRows.length === rows.length`.
   */
  readonly alreadyExists: number;
  /** Linhas recusadas por serem inválidas, cada uma com o motivo. */
  readonly skippedRows: readonly SkippedImportRow[];
}

/**
 * Impressão digital de uma descrição — a versão partilhada.
 *
 * O recibo da importação é guardado no `localStorage` do browser, e descrições de
 * extratos são texto financeiro legível num sítio que não é nosso; a comparação
 * da reversão continua exata porque o servidor calcula a impressão digital do que
 * está na base e compara as duas. Vive em `@repo/shared` (`import/digest.ts`) para
 * não haver duas implementações de `sha256` que possam divergir — e porque a
 * interface também precisa de a calcular.
 */
/**
 * Grava as linhas escolhidas.
 *
 * -----------------------------------------------------------------------------
 * PORQUE SE LÊ ANTES DE ESCREVER (I1 e I2 da verificação T7.5)
 * -----------------------------------------------------------------------------
 * Em PostgreSQL, um `INSERT` que viola a restrição única **aborta a transação**.
 * A versão anterior apanhava esse erro por linha com um `continue`, e o resultado
 * era silenciosamente errado das duas maneiras possíveis: com o duplicado na
 * última linha, o COMMIT de uma transação abortada é um ROLLBACK e a ação dizia
 * `created: 1` sem ter gravado nada; com o duplicado na primeira, tudo o resto
 * falhava e perdiam-se as linhas novas válidas.
 *
 * A correção não é tratar o erro melhor: é não o provocar. Esta função lê o que
 * já existe **dentro da mesma transação**, filtra as linhas que já lá estão e só
 * depois insere. O `P2002` deixa de ser caminho normal.
 *
 * O segundo lado da mesma falha (I2) era a corrida entre dois pedidos: um CSV sem
 * `Id` não tinha nada que a restrição única pudesse proteger, porque o
 * identificador só era calculado na pré-visualização. Agora toda a linha leva um
 * identificador derivado (`withImportIdentifiers`), gravado em `fitId` — quem
 * decide um empate passa a ser a base de dados, e o segundo pedido insere zero.
 *
 * Devolve também os identificadores criados e o conteúdo escrito em cada um, que
 * é o que permite desfazer a importação sem adivinhar (ver `revertImport`).
 */
export async function confirmImport(input: unknown): Promise<ActionResult<ConfirmImportResult>> {
  const user = await requireUser();
  const parsed = confirmImportSchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const { accountId, rows } = parsed.data;
  const account = await prisma.financialAccount.findFirst({
    where: { id: accountId, userId: user.id },
    select: { id: true },
  });

  if (account === null) {
    return fail('Conta não encontrada.', { accountId: ['Escolhe uma conta tua.'] });
  }

  /*
   * As categorias vêm do cliente: é preciso confirmar que são do utilizador, e
   * só as de gasto/ganho — uma categoria interna (transferência, fatura de
   * cartão) não se aplica a um movimento de extrato.
   *
   * Uma categoria que não seja do utilizador faz a linha ser **recusada**, e não
   * gravada sem categoria: o I9 da verificação mostrou que o `categoryId: null`
   * silencioso deixava o movimento entrar classificado de forma diferente da que
   * o utilizador escolheu.
   */
  const requestedCategoryIds = [
    ...new Set(
      rows
        .map((row) => row.categoryId)
        .filter((id): id is string => typeof id === 'string' && id !== ''),
    ),
  ];
  const ownedCategories =
    requestedCategoryIds.length === 0
      ? new Set<string>()
      : new Set(
          (
            await prisma.category.findMany({
              where: { userId: user.id, id: { in: requestedCategoryIds }, isInternal: false },
              select: { id: true },
            })
          ).map((category) => category.id),
        );

  /*
   * O núcleo está em `import-confirm.ts`: recebe o cliente da transação, valida
   * linha a linha, lê o que já existe **dentro** da transação e só depois insere.
   * Vive fora daqui para poder ser testado contra um duplo que imita o
   * PostgreSQL — sem isso, o defeito I1 (um duplicado a abortar a transação e a
   * ação a dizer que gravou) não era reproduzível em teste.
   */
  try {
    const outcome = await prisma.$transaction((tx) =>
      runConfirm({
        tx,
        userId: user.id,
        accountId: account.id,
        rows,
        ownedCategories,
      }),
    );

    revalidatePath('/transacoes');
    revalidatePath('/contas');
    revalidatePath('/importar');

    return ok({
      created: outcome.created,
      skipped: outcome.alreadyExists + outcome.skippedRows.length,
      imported: outcome.imported,
      alreadyExists: outcome.alreadyExists,
      skippedRows: outcome.skippedRows,
    });
  } catch (error) {
    /*
     * Chegar aqui significa que a leitura dentro da transação não viu um
     * duplicado que a base de dados recusou — a janela existe, é pequena (outro
     * pedido a escrever exatamente o mesmo, em simultâneo). Como a transação
     * aborta, **nada** foi gravado: a ação diz isso, em vez de devolver contagens
     * de um trabalho que não aconteceu.
     */
    console.error('[importação] falhou a gravar:', error);

    return fail(
      'Não consegui gravar a importação e nada foi criado. Tenta outra vez — se acontecer ' +
        'outra vez, confirma se o extrato já tinha sido importado.',
    );
  }
}

export interface RevertImportResult {
  readonly deleted: number;
  /** Movimentos que ficaram de pé, cada um com o motivo. */
  readonly skipped: readonly { readonly transactionId: string; readonly reason: string }[];
  /** Movimentos que já não existem: a importação já tinha sido desfeita. */
  readonly missing: readonly string[];
}

/**
 * Desfaz uma importação confirmada.
 *
 * **Porque por identificadores e não pela conta.** Apagar tudo o que é
 * `origin: 'IMPORTED'` de uma conta seria a versão de dano máximo: levaria
 * importações antigas que ninguém pediu para desfazer. Esta ação recebe os
 * identificadores que `confirmImport` devolveu e apaga **só** esses, e só os que
 * continuarem exatamente iguais ao que a importação escreveu.
 *
 * A decisão de apagar é da função pura `planRevert` (`@repo/shared`), testada sem
 * base de dados: movimentos de outra importação, de outra conta ou de outro
 * utilizador nunca entram na lista, e um movimento alterado depois (valor, data,
 * descrição, categoria, estado, liquidação) ou ligado a uma fatura, objetivo,
 * transferência ou recorrência **sobrevive com o motivo escrito**. Recusar a mais
 * é sempre preferível a apagar a mais.
 */
export async function revertImport(input: unknown): Promise<ActionResult<RevertImportResult>> {
  const user = await requireUser();
  const parsed = revertImportSchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const { accountId, expected } = parsed.data;

  /*
   * Normaliza os opcionais do schema (`null | undefined`) para `null`: a função
   * pura compara valores exatos, e `undefined` e `null` descrevem o mesmo «não
   * há nada aqui» — mas não são iguais entre si.
   *
   * A descrição já chega como **impressão digital** do recibo — o texto nunca
   * esteve no `localStorage`, que não é nosso (ver `digest.ts`).
   */
  const expectedRows: RevertExpectedRow[] = expected.map((row) => ({
    transactionId: row.transactionId,
    fitId: row.fitId ?? null,
    date: row.date,
    amountInCents: row.amountInCents,
    descriptionDigest: row.descriptionDigest,
    categoryId: row.categoryId ?? null,
  }));
  const account = await prisma.financialAccount.findFirst({
    where: { id: accountId, userId: user.id },
    select: { id: true },
  });

  if (account === null) {
    return fail('Conta não encontrada.', { accountId: ['Escolhe uma conta tua.'] });
  }

  const rows = await prisma.transaction.findMany({
    where: { id: { in: expectedRows.map((row) => row.transactionId) }, userId: user.id },
    select: {
      id: true,
      userId: true,
      financialAccountId: true,
      origin: true,
      fitId: true,
      date: true,
      amountInCents: true,
      description: true,
      categoryId: true,
      status: true,
      settled: true,
      invoiceId: true,
      goalId: true,
      transferGroupId: true,
      recurrenceId: true,
      invoicePayment: { select: { id: true } },
    },
  });

  const candidates: RevertCandidateRow[] = await Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      userId: row.userId,
      accountId: row.financialAccountId,
      origin: row.origin,
      fitId: row.fitId,
      date: toIsoDate(row.date),
      amountInCents: row.amountInCents,
      descriptionDigest: descriptionDigest(row.description),
      categoryId: row.categoryId,
      status: row.status,
      settled: row.settled,
      invoiceId: row.invoiceId,
      goalId: row.goalId,
      transferGroupId: row.transferGroupId,
      recurrenceId: row.recurrenceId,
      referencedByInvoicePayment: row.invoicePayment !== null,
    })),
  );

  const plan = planRevert({
    expected: expectedRows,
    candidates,
    accountId: account.id,
    userId: user.id,
  });

  if (plan.toDelete.length === 0) {
    // Nada apagado: a interface diz o motivo de cada linha, ou que já não existem.
    return ok({ deleted: 0, skipped: plan.skipped, missing: plan.missing });
  }

  try {
    await prisma.$transaction(async (tx) => {
      /*
       * A condição repete a conta e o utilizador: a lista já vem decidida pela
       * função pura, mas um `deleteMany` com o âmbito errado é o pior sítio para
       * confiar numa verificação feita noutro lado.
       */
      await tx.transaction.deleteMany({
        where: {
          id: { in: [...plan.toDelete] },
          userId: user.id,
          financialAccountId: account.id,
        },
      });
    });
  } catch (error) {
    console.error('[importação] falhou a reversão:', error);

    return fail('Não consegui desfazer a importação. Nada foi apagado.');
  }

  revalidatePath('/transacoes');
  revalidatePath('/contas');
  revalidatePath('/importar');

  return ok({ deleted: plan.toDelete.length, skipped: plan.skipped, missing: plan.missing });
}
