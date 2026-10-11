'use server';

import { prisma, TransactionKind, TransactionStatus } from '@repo/db/client';
import {
  addMonths,
  createTransactionSchema,
  createTransferSchema,
  splitInstallments,
} from '@repo/shared';
import { z } from 'zod';

import { todayInLisbon } from '@/lib/today';

import { failFromWriteError } from './errors';
import { ensureInvoiceForDate, refreshInvoiceCache } from './invoice-writes';
import { revalidateCardViews, revalidateTransactionViews } from './revalidate';
import { fail, fromZodError, ok, type ActionResult } from './result';
import { requireUser } from './session';

/**
 * Ações de lançamentos.
 *
 * Todas confirmam que a conta e a categoria pertencem ao utilizador da sessão:
 * o formulário envia identificadores e nenhum deles é de confiança.
 */

const KIND_BY_INPUT: Record<string, TransactionKind> = {
  expense: TransactionKind.EXPENSE,
  income: TransactionKind.INCOME,
  transfer: TransactionKind.TRANSFER,
  invoice_payment: TransactionKind.INVOICE_PAYMENT,
  goal_deposit: TransactionKind.GOAL_DEPOSIT,
  goal_withdrawal: TransactionKind.GOAL_WITHDRAWAL,
  balance_adjust: TransactionKind.BALANCE_ADJUST,
};

const STATUS_BY_INPUT: Record<string, TransactionStatus> = {
  pending: TransactionStatus.PENDING,
  confirmed: TransactionStatus.CONFIRMED,
  ignored: TransactionStatus.IGNORED,
};

/** Confirma que a conta existe e é do utilizador. */
async function ownsAccount(userId: string, accountId: string): Promise<boolean> {
  const account = await prisma.financialAccount.findFirst({
    where: { id: accountId, userId },
    select: { id: true },
  });

  return account !== null;
}

/** Confirma que a categoria existe e é do utilizador. */
async function ownsCategory(userId: string, categoryId: string): Promise<boolean> {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId },
    select: { id: true },
  });

  return category !== null;
}

/**
 * Confirma a propriedade de uma referência opcional (fatura, cartão, objetivo).
 *
 * Uma chave estrangeira prova que o registo existe; não prova que é teu. É por
 * isso que cada referência vinda do cliente passa por aqui antes de ser gravada —
 * foi a verificação adversarial da Fase 3 que mostrou o que acontece sem isto.
 */
async function ownsReference(
  model: 'invoice' | 'creditCard' | 'goal',
  userId: string,
  id: string,
): Promise<boolean> {
  const where = { id, userId };

  const found =
    model === 'invoice'
      ? await prisma.invoice.findFirst({ where, select: { id: true } })
      : model === 'creditCard'
        ? await prisma.creditCard.findFirst({ where, select: { id: true } })
        : await prisma.goal.findFirst({ where, select: { id: true } });

  return found !== null;
}

function ownsInvoice(userId: string, id: string): Promise<boolean> {
  return ownsReference('invoice', userId, id);
}

function ownsCard(userId: string, id: string): Promise<boolean> {
  return ownsReference('creditCard', userId, id);
}

function ownsGoal(userId: string, id: string): Promise<boolean> {
  return ownsReference('goal', userId, id);
}

/** Cria um lançamento simples (gasto, ganho, pagamento de fatura ou movimento de objetivo). */
export async function createTransaction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = createTransactionSchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const value = parsed.data;

  // As recorrências continuam na fase seguinte: precisam do gerador de
  // ocorrências, e não de um lançamento isolado.
  if (value.paymentCondition === 'recurring') {
    return fail('As recorrências chegam na fase seguinte. Por agora cria o lançamento simples.');
  }

  if (value.kind === 'transfer') {
    return fail('Usa a transferência entre contas para mover dinheiro.');
  }

  // Um ajuste de saldo só nasce de "travar saldo", que grava o registo de
  // auditoria (`LockedBalance`). Aceitá-lo aqui permitiria criar o lançamento
  // sem o registo — e o ajuste deixaria de ser auditável.
  if (value.kind === 'balance_adjust') {
    return fail('Os ajustes de saldo fazem-se em Contas, com "travar saldo".');
  }

  // O par de uma transferência é criado por `createTransfer`, que escreve as
  // duas pernas. Um `transferGroupId` vindo do cliente permitiria agrupar
  // lançamentos arbitrários e depois apagá-los ou ignorá-los em bloco.
  if (value.transferGroupId != null) {
    return fail('Uma transferência cria-se no formulário de transferência.');
  }

  if (!(await ownsAccount(user.id, value.accountId))) {
    return fail('Conta não encontrada.', { accountId: ['Escolhe uma conta tua.'] });
  }

  if (value.categoryId != null && !(await ownsCategory(user.id, value.categoryId))) {
    return fail('Categoria não encontrada.', { categoryId: ['Escolhe uma categoria tua.'] });
  }

  /*
   * As restantes referências (fatura, cartão, objetivo) também vêm do cliente.
   * As chaves estrangeiras garantem que existem — não que são **tuas**. Sem esta
   * verificação, usar o identificador da fatura de outra pessoa fazia essa
   * fatura aparecer paga, com um lançamento pertencente a outra conta.
   */
  if (value.invoiceId != null && !(await ownsInvoice(user.id, value.invoiceId))) {
    return fail('Fatura não encontrada.', { invoiceId: ['Escolhe uma fatura tua.'] });
  }

  if (value.cardId != null && !(await ownsCard(user.id, value.cardId))) {
    return fail('Cartão não encontrado.', { cardId: ['Escolhe um cartão teu.'] });
  }

  if (value.goalId != null && !(await ownsGoal(user.id, value.goalId))) {
    return fail('Objetivo não encontrado.', { goalId: ['Escolhe um objetivo teu.'] });
  }

  /*
   * Compras a crédito e parceladas: o cartão manda.
   *
   * É a regra de fecho e vencimento do cartão que decide **em que fatura** a
   * compra cai, e a fatura é criada na hora se ainda não existir. O cliente não
   * escolhe a fatura — se escolhesse, uma compra de outubro podia acabar na
   * fatura de dezembro e os totais deixariam de corresponder ao extrato do banco.
   */
  const usesCard = value.paymentMethod === 'credit' || value.paymentCondition === 'installment';
  const card = value.cardId == null ? null : await loadOwnedCard(user.id, value.cardId);

  if (value.cardId != null && card === null) {
    return fail('Cartão não encontrado.', { cardId: ['Escolhe um cartão teu.'] });
  }

  if (usesCard && card === null) {
    return fail('Escolhe o cartão desta compra.', {
      cardId: ['Escolhe o cartão desta compra.'],
    });
  }

  if (value.paymentCondition === 'installment' && card !== null) {
    return createInstallmentPurchase({
      userId: user.id,
      value,
      card,
      categoryId: value.categoryId ?? null,
    });
  }

  // Compra a crédito simples: resolve (ou cria) a fatura do ciclo da data.
  const resolvedInvoiceId =
    value.invoiceId ??
    (card === null
      ? null
      : (
          await ensureInvoiceForDate({
            userId: user.id,
            cardId: card.id,
            purchaseDate: value.date,
            closingDay: card.closingDay,
            dueDay: card.dueDay,
          })
        ).id);

  // Uma compra a crédito só fica liquidada quando a fatura é paga: deixar o
  // cliente dizer que está liquidada punha dinheiro em caixa que nunca entrou.
  const settled = card === null ? value.settled : false;

  let created: { id: string } | undefined;

  try {
    created = await prisma.transaction.create({
      data: {
        userId: user.id,
        kind: KIND_BY_INPUT[value.kind] ?? TransactionKind.EXPENSE,
        status: STATUS_BY_INPUT[value.status] ?? TransactionStatus.CONFIRMED,
        amountInCents: value.amountInCents,
        date: new Date(value.date),
        description: value.description ?? null,
        financialAccountId: value.accountId,
        categoryId: value.categoryId ?? null,
        invoiceId: resolvedInvoiceId,
        cardId: value.cardId ?? null,
        goalId: value.goalId ?? null,
        transferGroupId: null,
        paymentMethod: value.paymentMethod === 'credit' ? 'CREDIT' : 'DEBIT',
        paymentCondition: 'SINGLE',
        settled,
        settledOn: settled ? new Date(value.date) : null,
        fitId: value.fitId ?? null,
      },
      select: { id: true },
    });
  } catch (error) {
    return failFromWriteError(error, {
      fallback: 'Não consegui guardar o lançamento. Tenta outra vez.',
      unique: 'Este movimento já foi importado antes.',
    });
  }

  if (!created) {
    return fail('Não consegui guardar o lançamento. Tenta outra vez.');
  }

  if (card !== null) {
    await refreshInvoiceCache({ userId: user.id, cardId: card.id, today: todayInLisbon() });
    revalidateCardViews();
  }

  revalidateTransactionViews();

  return ok({ id: created.id });
}

interface OwnedCard {
  readonly id: string;
  readonly closingDay: number;
  readonly dueDay: number;
  readonly paymentAccountId: string | null;
}

/** Cartão do utilizador, com os dias que decidem em que fatura cai a compra. */
async function loadOwnedCard(userId: string, cardId: string): Promise<OwnedCard | null> {
  const card = await prisma.creditCard.findFirst({
    where: { id: cardId, userId },
    select: { id: true, closingDay: true, dueDay: true, paymentAccountId: true },
  });

  return card;
}

/**
 * Cria uma compra em parcelas: N lançamentos, um por fatura.
 *
 * As parcelas distribuem o valor **exatamente** (`splitInstallments` põe o resto
 * nos primeiros cêntimos), cada uma cai na fatura do mês respetivo pela regra de
 * fecho do cartão, e todas partilham um `installmentPlanId` — que é o que
 * permite depois editar ou eliminar o plano como um todo.
 */
async function createInstallmentPurchase(args: {
  readonly userId: string;
  readonly value: z.infer<typeof createTransactionSchema>;
  readonly card: OwnedCard;
  readonly categoryId: string | null;
}): Promise<ActionResult<{ id: string }>> {
  const { userId, value, card } = args;
  const count = value.installmentCount ?? 0;

  if (count < 2) {
    return fail('Um parcelamento precisa de pelo menos duas parcelas.', {
      installmentCount: ['Diz em quantas parcelas fica a compra.'],
    });
  }

  const magnitudes = splitInstallments(value.amountInCents, count);
  // O sinal do movimento é o do valor original: um estorno parcelado continua a
  // ser uma entrada.
  const sign = value.amountInCents < 0 ? -1 : 1;
  const installmentPlanId = crypto.randomUUID();

  let firstId: string | undefined;

  try {
    firstId = await prisma.$transaction(async (tx) => {
      let createdId: string | undefined;

      for (const [index, magnitude] of magnitudes.entries()) {
        const installmentDate = addMonths(value.date, index);
        const invoice = await ensureInvoiceForDate({
          userId,
          cardId: card.id,
          purchaseDate: installmentDate,
          closingDay: card.closingDay,
          dueDay: card.dueDay,
          db: tx,
        });

        const created = await tx.transaction.create({
          data: {
            userId,
            kind: KIND_BY_INPUT[value.kind] ?? TransactionKind.EXPENSE,
            status: STATUS_BY_INPUT[value.status] ?? TransactionStatus.CONFIRMED,
            amountInCents: sign * magnitude,
            date: new Date(`${installmentDate}T00:00:00.000Z`),
            description: value.description ?? null,
            financialAccountId: value.accountId,
            categoryId: args.categoryId,
            cardId: card.id,
            invoiceId: invoice.id,
            paymentMethod: 'CREDIT',
            paymentCondition: 'INSTALLMENT',
            // Uma compra a crédito só fica liquidada quando a fatura é paga.
            settled: false,
            settledOn: null,
            installmentPlanId,
            installmentNumber: index + 1,
            installmentCount: count,
            installmentAmountInCents: magnitude,
          },
          select: { id: true },
        });

        createdId ??= created.id;
      }

      return createdId;
    });
  } catch (error) {
    return failFromWriteError(error, {
      fallback: 'Não consegui criar o parcelamento. Tenta outra vez.',
    });
  }

  if (firstId === undefined) {
    return fail('Não consegui criar o parcelamento. Tenta outra vez.');
  }

  await refreshInvoiceCache({ userId, cardId: card.id, today: todayInLisbon() });
  revalidateCardViews();
  revalidateTransactionViews();

  return ok({ id: firstId });
}

/**
 * Cria uma transferência.
 *
 * As duas pernas nascem na mesma transação de base de dados e ficam ligadas
 * uma à outra: se uma falhar, não fica meia transferência a mexer num saldo.
 */
export async function createTransfer(
  input: unknown,
): Promise<ActionResult<{ transferGroupId: string }>> {
  const user = await requireUser();
  const parsed = createTransferSchema.safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const value = parsed.data;

  const [ownsFrom, ownsTo] = await Promise.all([
    ownsAccount(user.id, value.fromAccountId),
    ownsAccount(user.id, value.toAccountId),
  ]);

  if (!ownsFrom) {
    return fail('Conta de origem não encontrada.', { fromAccountId: ['Escolhe uma conta tua.'] });
  }

  if (!ownsTo) {
    return fail('Conta de destino não encontrada.', { toAccountId: ['Escolhe uma conta tua.'] });
  }

  const transferGroupId = crypto.randomUUID();

  await prisma.$transaction(async (tx) => {
    const outgoing = await tx.transaction.create({
      data: {
        userId: user.id,
        kind: TransactionKind.TRANSFER,
        status: TransactionStatus.CONFIRMED,
        amountInCents: -Math.abs(value.amountInCents),
        date: new Date(value.date),
        description: value.description ?? 'Transferência',
        financialAccountId: value.fromAccountId,
        transferGroupId,
        settled: value.settled,
        settledOn: value.settled ? new Date(value.date) : null,
      },
      select: { id: true },
    });

    const incoming = await tx.transaction.create({
      data: {
        userId: user.id,
        kind: TransactionKind.TRANSFER,
        status: TransactionStatus.CONFIRMED,
        amountInCents: Math.abs(value.amountInCents),
        date: new Date(value.date),
        description: value.description ?? 'Transferência',
        financialAccountId: value.toAccountId,
        transferGroupId,
        counterpartTransactionId: outgoing.id,
        settled: value.settled,
        settledOn: value.settled ? new Date(value.date) : null,
      },
      select: { id: true },
    });

    await tx.transaction.update({
      where: { id: outgoing.id },
      data: { counterpartTransactionId: incoming.id },
    });
  });

  revalidateTransactionViews();

  return ok({ transferGroupId });
}

/** Altera um lançamento. Numa transferência, o valor é espelhado no par. */
export async function updateTransaction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = createTransactionSchema
    .partial()
    .extend({ id: z.string().min(1) })
    .safeParse(input);

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const value = parsed.data;
  const existing = await prisma.transaction.findFirst({
    where: { id: value.id, userId: user.id },
    select: {
      id: true,
      kind: true,
      counterpartTransactionId: true,
      date: true,
      installmentPlanId: true,
    },
  });

  if (!existing) {
    return fail('Lançamento não encontrado.');
  }

  /*
   * Uma parcela não se edita sozinha.
   *
   * As parcelas dividem um valor contratado: mudar o valor ou a data de uma só
   * faz a soma das parcelas deixar de corresponder ao que foi comprado, e o
   * parcelamento passa a mentir sem que nada avise. Quem quer alterar edita o
   * plano inteiro, em Cartões, onde o novo plano é calculado e pré-visualizado.
   * Descrição e categoria continuam a poder corrigir-se aqui: não afetam a soma.
   */
  if (
    existing.installmentPlanId !== null &&
    (value.amountInCents !== undefined || value.date !== undefined)
  ) {
    return fail(
      'Esta é uma parcela de um parcelamento. O valor e a data alteram-se no plano, em Cartões — editar só esta parcela desalinharia a soma do que compraste.',
    );
  }

  if (value.accountId !== undefined && !(await ownsAccount(user.id, value.accountId))) {
    return fail('Conta não encontrada.', { accountId: ['Escolhe uma conta tua.'] });
  }

  if (value.categoryId != null && !(await ownsCategory(user.id, value.categoryId))) {
    return fail('Categoria não encontrada.', { categoryId: ['Escolhe uma categoria tua.'] });
  }

  /*
   * Numa transferência, as duas pernas descrevem a **mesma** operação: os campos
   * comuns têm de ser aplicados aos dois lados. A primeira versão espelhava
   * apenas o valor, e editar só o estado de uma perna (por exemplo marcar como
   * não liquidada) fazia o saldo total subir pelo valor da transferência — a
   * perna de saída desaparecia do saldo e a de entrada continuava lá.
   */
  const isTransfer = existing.kind === TransactionKind.TRANSFER;
  const counterpartId = existing.counterpartTransactionId;

  if (isTransfer && (value.accountId !== undefined || value.categoryId !== undefined)) {
    return fail(
      'Numa transferência não podes mudar a conta nem a categoria. Elimina-a e cria outra.',
    );
  }

  const settledData =
    value.settled === undefined
      ? {}
      : {
          settled: value.settled,
          // A data de liquidação acompanha a data do lançamento: usar "hoje"
          // quando o lançamento é de outro dia faria a visão de caixa mostrar o
          // movimento no dia errado.
          settledOn: value.settled ? new Date(value.date ?? existing.date) : null,
        };

  const statusData =
    value.status === undefined
      ? {}
      : { status: STATUS_BY_INPUT[value.status] ?? TransactionStatus.CONFIRMED };

  await prisma.$transaction(async (tx) => {
    await tx.transaction.update({
      where: { id: value.id },
      data: {
        ...(value.amountInCents !== undefined ? { amountInCents: value.amountInCents } : {}),
        ...(value.date !== undefined ? { date: new Date(value.date) } : {}),
        ...(value.description !== undefined ? { description: value.description } : {}),
        ...(value.accountId !== undefined ? { financialAccountId: value.accountId } : {}),
        ...(value.categoryId !== undefined ? { categoryId: value.categoryId } : {}),
        ...statusData,
        ...settledData,
      },
    });

    // O par recebe os mesmos campos, com o valor negado e o `userId` no filtro
    // por defesa em profundidade.
    if (isTransfer && counterpartId !== null) {
      await tx.transaction.updateMany({
        where: { id: counterpartId, userId: user.id },
        data: {
          ...(value.amountInCents !== undefined ? { amountInCents: -value.amountInCents } : {}),
          ...(value.date !== undefined ? { date: new Date(value.date) } : {}),
          ...(value.description !== undefined ? { description: value.description } : {}),
          ...statusData,
          ...settledData,
        },
      });
    }
  });

  revalidateTransactionViews();

  return ok({ id: value.id });
}

/**
 * Marca um lançamento como confirmado, pendente ou ignorado.
 *
 * Numa transferência o estado aplica-se aos dois lados: ignorar só uma perna
 * faria o dinheiro desaparecer de uma conta e aparecer na outra.
 */
export async function setTransactionStatus(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const id = typeof input === 'object' && input !== null && 'id' in input ? String(input.id) : '';
  const statusInput =
    typeof input === 'object' && input !== null && 'status' in input ? String(input.status) : '';

  const status = STATUS_BY_INPUT[statusInput];

  if (id === '') {
    return fail('Falta o identificador do lançamento.');
  }

  if (status === undefined) {
    return fail('Estado inválido.');
  }

  const existing = await prisma.transaction.findFirst({
    where: { id, userId: user.id },
    select: { id: true, transferGroupId: true },
  });

  if (!existing) {
    return fail('Lançamento não encontrado.');
  }

  await prisma.$transaction(async (tx) => {
    if (existing.transferGroupId !== null) {
      await tx.transaction.updateMany({
        where: { userId: user.id, transferGroupId: existing.transferGroupId },
        data: { status },
      });

      return;
    }

    await tx.transaction.update({ where: { id }, data: { status } });
  });

  revalidateTransactionViews();

  return ok(undefined);
}

/** Apaga um lançamento. Numa transferência, apaga o par inteiro. */
export async function deleteTransaction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const id = typeof input === 'object' && input !== null && 'id' in input ? String(input.id) : '';

  if (id === '') {
    return fail('Falta o identificador do lançamento.');
  }

  const existing = await prisma.transaction.findFirst({
    where: { id, userId: user.id },
    select: { id: true, transferGroupId: true },
  });

  if (!existing) {
    return fail('Lançamento não encontrado.');
  }

  await prisma.$transaction(async (tx) => {
    if (existing.transferGroupId !== null) {
      await tx.transaction.deleteMany({
        where: { userId: user.id, transferGroupId: existing.transferGroupId },
      });

      return;
    }

    await tx.transaction.delete({ where: { id } });
  });

  revalidateTransactionViews();

  return ok(undefined);
}
