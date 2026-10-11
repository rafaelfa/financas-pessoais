/**
 * Tipos do domínio financeiro.
 *
 * Este módulo é **puro**: não conhece Prisma, base de dados nem React. O motor
 * financeiro trabalha exclusivamente com estes tipos, o que permite testá-lo
 * sem infraestrutura nenhuma e reutilizá-lo no servidor e no cliente.
 *
 * Regra absoluta: dinheiro é sempre um **inteiro de cêntimos**. Nunca `float`,
 * nunca `Decimal`. Toda a aritmética deste pacote é inteira.
 */

/** Natureza da operação. Determina o efeito nos totais, não o sinal. */
export type TransactionKind =
  | 'expense'
  | 'income'
  | 'transfer'
  | 'invoice_payment'
  | 'goal_deposit'
  | 'goal_withdrawal'
  | 'balance_adjust';

/** Estado de confirmação de um lançamento. */
export type TransactionStatus = 'pending' | 'confirmed' | 'ignored';

/**
 * Regime de contabilização:
 * - `cash` (caixa): conta quando o dinheiro se move de facto.
 * - `accrual` (competência): conta quando a obrigação nasce, mesmo sem pagamento.
 */
export type AccountingBasis = 'cash' | 'accrual';

/** Natureza de uma categoria. As listas de gasto e de ganho são distintas. */
export type CategoryKind = 'expense' | 'income';

/** Conta onde o dinheiro está. */
export interface FinanceAccount {
  readonly id: string;
  /** Saldo no momento em que a conta foi criada, em cêntimos. */
  readonly openingBalanceInCents: number;
  /** Contas arquivadas saem dos saldos e do extrato. */
  readonly archived?: boolean;
}

/** Categoria, potencialmente interna. */
export interface FinanceCategory {
  readonly id: string;
  readonly kind: CategoryKind;
  /**
   * Categoria-mãe, quando esta é uma subcategoria. Os limites de orçamento são
   * definidos na categoria-mãe e o consumo das subcategorias soma para lá.
   */
  readonly parentId?: string;
  /**
   * Categoria interna (transferência, fatura de cartão, ajuste de saldo,
   * investimento): aparece no extrato mas **nunca** conta como ganho ou gasto.
   */
  readonly internal?: boolean;
}

/**
 * Um lançamento.
 *
 * `amountInCents` é o **efeito assinado na conta**: negativo quando o dinheiro
 * sai, positivo quando entra. O sinal não se deduz do `kind` — uma transferência
 * tem sempre duas linhas, uma com cada sinal, ligadas por `transferGroupId`.
 */
export interface FinanceTransaction {
  readonly id: string;
  readonly kind: TransactionKind;
  readonly status: TransactionStatus;
  /** Efeito assinado na conta, em cêntimos. Nunca zero. */
  readonly amountInCents: number;
  /** Data de calendário no formato `YYYY-MM-DD`. */
  readonly date: string;
  /** Descrição livre. É o texto que as regras de categorização procuram. */
  readonly description?: string;
  /** Contraparte (NIF/NIPC ou nome), também usada pelas regras. */
  readonly counterparty?: string;
  readonly accountId: string;
  readonly categoryId?: string;
  /**
   * Preenchido quando o gasto foi feito a crédito. É isto que faz a diferença
   * entre os regimes: em caixa só conta quando a fatura é paga; em competência
   * conta na data da compra.
   */
  readonly invoiceId?: string;
  /**
   * Parcelamento de uma compra de cartão: o plano e a posição desta parcela.
   * Uma compra em 12 parcelas gera 12 lançamentos, um por fatura.
   */
  readonly installmentPlanId?: string;
  readonly installmentNumber?: number;
  readonly installmentCount?: number;
  readonly installmentAmountInCents?: number;
  /** "Já paguei" / "já recebi". Só o que está liquidado move o saldo. */
  readonly settled: boolean;
  readonly goalId?: string;
  readonly transferGroupId?: string;
}

/** Fatura de cartão de crédito. */
export interface FinanceInvoice {
  readonly id: string;
  readonly cardId: string;
  /** Data em que a fatura fecha. */
  readonly closingDate: string;
  /** Data em que a fatura vence. */
  readonly dueDate: string;
  /** Valor transitado da fatura anterior, em cêntimos. */
  readonly carriedOverInCents?: number;
}

/** Pagamento aplicado a uma fatura. */
export interface FinanceInvoicePayment {
  readonly invoiceId: string;
  readonly amountInCents: number;
  readonly date: string;
  /**
   * Transação que materializou este pagamento, quando existe.
   *
   * Serve para o motor não contar o mesmo pagamento duas vezes: se um pagamento
   * tiver este campo, a transação correspondente é ignorada na soma. Sem esta
   * ligação, pagar a fatura por transação deixaria a fatura em dívida para
   * sempre.
   */
  readonly transactionId?: string;
}

/** Limite de orçamento de uma categoria num período. */
export interface FinanceBudgetLimit {
  readonly categoryId: string;
  readonly amountInCents: number;
  /** Percentagem a partir da qual se avisa o utilizador (ex.: 80). */
  readonly alertThresholdPct?: number;
  readonly alertsEnabled?: boolean;
}

/** Objetivo de poupança. */
export interface FinanceGoal {
  readonly id: string;
  readonly targetAmountInCents: number;
  /** Valor já reservado à data de criação do objetivo. */
  readonly initialReservedInCents?: number;
  readonly targetDate: string;
  readonly contributionFrequency: RecurrenceFrequency;
}

/** Movimento de um objetivo. */
export interface FinanceGoalMovement {
  readonly goalId: string;
  readonly type: GoalMovementType;
  readonly amountInCents: number;
  readonly date: string;
}

/** Passivo manual (empréstimo, financiamento) — substitui o módulo do original. */
export interface FinanceLiability {
  readonly id: string;
  readonly outstandingInCents: number;
}

/** Bem patrimonial. */
export interface FinanceAsset {
  readonly id: string;
  readonly valueInCents: number;
}

/**
 * Frequência de repetição, usada em recorrências e em objetivos.
 *
 * **Não há `yearly`.** A base de dados admitia o valor e o motor não o sabia
 * cumprir: quatro sítios convertiam-no em mensal em silêncio, e o gerador criava
 * doze ocorrências por ano. O valor foi retirado do tipo, e a tradução do enum da
 * base vive agora numa função só — `toRecurrenceFrequency` — que **falha alto**
 * em vez de adivinhar. Um valor a menos é uma fonte a menos de erros.
 */
export type RecurrenceFrequency = 'weekly' | 'monthly' | 'quarterly';

/** Tipo de movimento de um objetivo. */
export type GoalMovementType = 'deposit' | 'withdrawal' | 'yield';

/** Regra de categorização automática. */
export interface FinanceTransactionRule {
  readonly id: string;
  readonly name: string;
  /** Ordem de avaliação: a primeira regra que corresponder ganha. */
  readonly priority: number;
  readonly kind: CategoryKind;
  /** Correspondência por texto contido na descrição (sem distinção de maiúsculas). */
  readonly descriptionContains?: string;
  /** Correspondência por contraparte (NIF/NIPC). */
  readonly counterparty?: string;
  readonly amountMinInCents?: number;
  readonly amountMaxInCents?: number;
  /** Intervalo de dias do mês, inclusive, ex.: 1 a 5. */
  readonly dayMin?: number;
  readonly dayMax?: number;
  readonly accountId?: string;
  readonly targetCategoryId: string;
}

/**
 * Período mensal com início configurável.
 *
 * O sistema original fixa o mês no dia 1; quem recebe a meio do mês não é
 * servido. Aqui o início é configurável (melhoria M2 do plano).
 * `end` é **exclusivo**.
 */
export interface FinancePeriod {
  readonly start: string;
  readonly end: string;
  /** Chave estável do período, no formato `YYYY-MM` do mês de início. */
  readonly key: string;
}
