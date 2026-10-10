import type {
  AccountingBasis,
  CategoryKind,
  FinanceAccount,
  FinanceCategory,
  FinanceInvoice,
  FinanceInvoicePayment,
  FinanceTransaction,
  TransactionKind,
  TransactionStatus,
} from './types';

/**
 * Conversão de registos persistidos para os tipos do motor financeiro.
 *
 * Estas funções são **puras** de propósito: são a fronteira onde a convenção de
 * sinal e os enums de armazenamento passam a fazer parte do domínio. Um erro
 * aqui contamina todos os cálculos, por isso é a camada com mais testes por
 * linha de código. Não conhecem Prisma nem base de dados — recebem os campos
 * que precisam, e nada mais.
 */

const TRANSACTION_KINDS: readonly TransactionKind[] = [
  'expense',
  'income',
  'transfer',
  'invoice_payment',
  'goal_deposit',
  'goal_withdrawal',
  'balance_adjust',
];

const TRANSACTION_STATUSES: readonly TransactionStatus[] = ['pending', 'confirmed', 'ignored'];

/** Data de calendário `YYYY-MM-DD`. O armazenamento guarda `date` à meia-noite UTC. */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Converte o tipo de transação.
 *
 * Lança em vez de adivinhar: um tipo desconhecido significa que o armazenamento
 * e o motor divergiram, e continuar com um valor por omissão esconderia o
 * problema somando dinheiro no sítio errado.
 */
export function toTransactionKind(value: string): TransactionKind {
  const kind = value.toLowerCase() as TransactionKind;

  if (!TRANSACTION_KINDS.includes(kind)) {
    throw new Error(`Tipo de transação desconhecido: "${value}".`);
  }

  return kind;
}

/** Converte o estado de um lançamento, com a mesma exigência da função acima. */
export function toTransactionStatus(value: string): TransactionStatus {
  const status = value.toLowerCase() as TransactionStatus;

  if (!TRANSACTION_STATUSES.includes(status)) {
    throw new Error(`Estado de transação desconhecido: "${value}".`);
  }

  return status;
}

/** Converte o regime de contabilização. Qualquer valor diferente de compêndio é caixa. */
export function toAccountingBasis(value: string): AccountingBasis {
  return value === 'ACCRUAL' ? 'accrual' : 'cash';
}

/** Converte o tipo de categoria. */
export function toCategoryKind(value: string): CategoryKind {
  return value === 'INCOME' ? 'income' : 'expense';
}

/** Campos de uma transação que o motor precisa. */
export interface TransactionRow {
  readonly id: string;
  readonly kind: string;
  readonly status: string;
  readonly amountInCents: number;
  readonly date: Date;
  readonly description: string | null;
  readonly financialAccountId: string | null;
  readonly categoryId: string | null;
  readonly invoiceId: string | null;
  readonly goalId: string | null;
  readonly transferGroupId: string | null;
  readonly settled: boolean;
  readonly installmentPlanId?: string | null;
  readonly installmentNumber?: number | null;
  readonly installmentCount?: number | null;
  readonly installmentAmountInCents?: number | null;
}

/**
 * Converte uma transação.
 *
 * Uma transação sem conta (a conta foi apagada e a relação ficou sem valor)
 * recebe um identificador vazio: continua a contar para o resultado e para os
 * relatórios — a história não se apaga — mas não pertence a nenhum saldo.
 */
export function toFinanceTransaction(row: TransactionRow): FinanceTransaction {
  return {
    id: row.id,
    kind: toTransactionKind(row.kind),
    status: toTransactionStatus(row.status),
    amountInCents: row.amountInCents,
    date: toIsoDate(row.date),
    description: row.description ?? undefined,
    accountId: row.financialAccountId ?? '',
    categoryId: row.categoryId ?? undefined,
    invoiceId: row.invoiceId ?? undefined,
    settled: row.settled,
    goalId: row.goalId ?? undefined,
    transferGroupId: row.transferGroupId ?? undefined,
    installmentPlanId: row.installmentPlanId ?? undefined,
    installmentNumber: row.installmentNumber ?? undefined,
    installmentCount: row.installmentCount ?? undefined,
    installmentAmountInCents: row.installmentAmountInCents ?? undefined,
  };
}

/** Campos de uma categoria que o motor precisa. */
export interface CategoryRow {
  readonly id: string;
  readonly kind: string;
  readonly parentId: string | null;
  readonly isInternal: boolean;
}

/** Converte uma categoria. */
export function toFinanceCategory(row: CategoryRow): FinanceCategory {
  return {
    id: row.id,
    kind: toCategoryKind(row.kind),
    parentId: row.parentId ?? undefined,
    internal: row.isInternal,
  };
}

/** Campos de uma conta que o motor precisa. */
export interface AccountRow {
  readonly id: string;
  readonly openingBalanceInCents: number;
  readonly archivedAt: Date | null;
}

/** Converte uma conta. Arquivada é ter `archivedAt` preenchido. */
export function toFinanceAccount(row: AccountRow): FinanceAccount {
  return {
    id: row.id,
    openingBalanceInCents: row.openingBalanceInCents,
    archived: row.archivedAt !== null,
  };
}

/** Campos de uma fatura que o motor precisa. */
export interface InvoiceRow {
  readonly id: string;
  readonly cardId: string;
  readonly closingDate: Date;
  readonly dueDate: Date;
}

/**
 * Converte uma fatura.
 *
 * O valor transitado **não** vem da base de dados: a cadeia de faturas
 * calcula-o. Ler a coluna guardada aqui seria confiar numa cache que pode estar
 * desatualizada — e é isso que a Fase 4 veio corrigir.
 */
export function toFinanceInvoice(row: InvoiceRow): FinanceInvoice {
  return {
    id: row.id,
    cardId: row.cardId,
    closingDate: toIsoDate(row.closingDate),
    dueDate: toIsoDate(row.dueDate),
  };
}

/** Campos de um pagamento de fatura que o motor precisa. */
export interface InvoicePaymentRow {
  readonly invoiceId: string;
  readonly amountInCents: number;
  readonly date: Date;
  readonly transactionId: string | null;
}

/** Converte um pagamento de fatura. */
export function toFinancePayment(row: InvoicePaymentRow): FinanceInvoicePayment {
  return {
    invoiceId: row.invoiceId,
    amountInCents: row.amountInCents,
    date: toIsoDate(row.date),
    // `undefined` e não `null`: o tipo do domínio usa opcional, e o motor
    // compara com `undefined` para decidir se o pagamento já está contado.
    ...(row.transactionId !== null ? { transactionId: row.transactionId } : {}),
  };
}
