'use server';

import { prisma } from '@repo/db/client';
import {
  type ImportFormat,
  centsSchema,
  confirmImportSchema,
  previewImportSchema,
} from '@repo/shared';
import { revalidatePath } from 'next/cache';

import { isUniqueViolation } from './errors';
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
}

/**
 * Grava as linhas escolhidas.
 *
 * Todas numa transação: uma importação a meio deixaria o saldo a refletir metade
 * de um extrato, sem forma de saber onde parou. O `fitId` é escrito em cada
 * lançamento, para que reimportar o mesmo ficheiro não duplique nada — a
 * restrição única da base de dados garante-o mesmo com dois pedidos simultâneos.
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

  let created = 0;
  let skipped = 0;

  try {
    await prisma.$transaction(async (tx) => {
      for (const row of rows) {
        const amountCheck = centsSchema.safeParse(row.amountInCents);

        if (row.date === null || !amountCheck.success || amountCheck.data === 0) {
          skipped += 1;
          continue;
        }

        const amountInCents = amountCheck.data;
        const date = new Date(`${row.date}T00:00:00.000Z`);

        try {
          await tx.transaction.create({
            data: {
              userId: user.id,
              // O sinal decide o tipo: uma saída é um gasto, uma entrada é um
              // ganho. O extrato não traz mais informação do que isto, e inventar
              // um tipo a partir do texto seria adivinhar.
              kind: amountInCents < 0 ? 'EXPENSE' : 'INCOME',
              status: 'CONFIRMED',
              amountInCents,
              date,
              description: row.description === '' ? null : row.description,
              financialAccountId: account.id,
              categoryId:
                row.categoryId !== null &&
                row.categoryId !== undefined &&
                ownedCategories.has(row.categoryId)
                  ? row.categoryId
                  : null,
              // Um movimento de extrato é algo que já aconteceu no banco.
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
        } catch (error) {
          /*
           * Violação de `(financialAccountId, fitId)`: a linha já existe. Não é
           * um erro para mostrar — é uma linha a menos a criar, e diz-se.
           */
          if (isUniqueViolation(error)) {
            skipped += 1;
            continue;
          }

          throw error;
        }
      }
    });
  } catch (error) {
    console.error('[importação] falhou a gravar:', error);

    return fail('Não consegui gravar a importação. Tenta outra vez.');
  }

  revalidatePath('/transacoes');
  revalidatePath('/contas');
  revalidatePath('/importar');

  return ok({ created, skipped });
}
