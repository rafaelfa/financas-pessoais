import {
  addDays,
  addMonths,
  periodOf,
  type FinanceAccount,
  type FinanceBudgetLimit,
  type FinanceCategory,
  type FinanceGoal,
  type FinanceGoalMovement,
  type FinanceTransaction,
} from '@repo/shared';

/**
 * Dados de exemplo para a revisão visual da Fase 2.
 *
 * **Não são dados reais e não vêm de nenhuma base de dados.** Existem apenas
 * para que o painel, os orçamentos e os objetivos possam ser avaliados com
 * números plausíveis antes de a camada de dados existir (Fase 3). A interface
 * mostra sempre um aviso enquanto estiverem em uso, e este ficheiro desaparece
 * quando os dados verdadeiros chegarem.
 *
 * Os valores são gerados a partir da data de hoje, para que o painel pareça
 * vivo independentemente do dia em que é aberto.
 */

const CATEGORIES: readonly FinanceCategory[] = [
  { id: 'cat-casa', kind: 'expense' },
  { id: 'cat-alimentacao', kind: 'expense' },
  { id: 'cat-transportes', kind: 'expense' },
  { id: 'cat-saude', kind: 'expense' },
  { id: 'cat-lazer', kind: 'expense' },
  { id: 'cat-subscricoes', kind: 'expense' },
  { id: 'cat-rendas', kind: 'expense' },
  { id: 'cat-fatura', kind: 'expense', internal: true },
  { id: 'cat-salario', kind: 'income' },
  { id: 'cat-extra', kind: 'income' },
];

const ACCOUNTS: readonly FinanceAccount[] = [
  { id: 'acc-ordem', openingBalanceInCents: 215_000 },
  { id: 'acc-poupanca', openingBalanceInCents: 3_400_000 },
];

/** Nomes legíveis das categorias de exemplo, para rótulos de gráficos. */
export const DEMO_CATEGORY_NAMES: Readonly<Record<string, string>> = {
  'cat-casa': 'Casa',
  'cat-alimentacao': 'Alimentação',
  'cat-transportes': 'Transportes',
  'cat-saude': 'Saúde',
  'cat-lazer': 'Lazer',
  'cat-subscricoes': 'Subscrições',
  'cat-rendas': 'Água, luz e gás',
  'cat-fatura': 'Fatura do cartão',
  'cat-salario': 'Salário',
  'cat-extra': 'Trabalho extra',
};

/** Nome legível de uma categoria de exemplo, com recurso se não existir. */
export function demoCategoryName(categoryId: string): string {
  return DEMO_CATEGORY_NAMES[categoryId] ?? 'Sem categoria';
}

/** Movimentos fixos de cada mês, como fração do dia do mês. */
const RECURRING: ReadonlyArray<{
  readonly day: number;
  readonly kind: FinanceTransaction['kind'];
  readonly categoryId: string;
  readonly amountInCents: number;
  readonly description: string;
  readonly accountId: string;
  readonly settled: boolean;
  readonly invoiceId?: string;
}> = [
  {
    day: 1,
    kind: 'income',
    categoryId: 'cat-salario',
    amountInCents: 215_000,
    description: 'Vencimento',
    accountId: 'acc-ordem',
    settled: true,
  },
  {
    day: 3,
    kind: 'expense',
    categoryId: 'cat-casa',
    amountInCents: -85_000,
    description: 'Renda da casa',
    accountId: 'acc-ordem',
    settled: true,
  },
  {
    day: 5,
    kind: 'expense',
    categoryId: 'cat-rendas',
    amountInCents: -9_235,
    description: 'EDP — eletricidade',
    accountId: 'acc-ordem',
    settled: true,
  },
  {
    day: 8,
    kind: 'expense',
    categoryId: 'cat-subscricoes',
    amountInCents: -1_799,
    description: 'Subscrições digitais',
    accountId: 'acc-ordem',
    settled: true,
  },
  {
    day: 12,
    kind: 'expense',
    categoryId: 'cat-alimentacao',
    amountInCents: -21_450,
    description: 'Compra do mês no Continente',
    accountId: 'acc-ordem',
    settled: false,
    invoiceId: 'inv-atual',
  },
  {
    day: 18,
    kind: 'expense',
    categoryId: 'cat-transportes',
    amountInCents: -6_000,
    description: 'Passe de transportes',
    accountId: 'acc-ordem',
    settled: true,
  },
  {
    day: 20,
    kind: 'expense',
    categoryId: 'cat-lazer',
    amountInCents: -4_500,
    description: 'Jantar fora',
    accountId: 'acc-ordem',
    settled: false,
    invoiceId: 'inv-atual',
  },
  {
    day: 26,
    kind: 'expense',
    categoryId: 'cat-saude',
    amountInCents: -3_200,
    description: 'Farmácia',
    accountId: 'acc-ordem',
    settled: true,
  },
];

const BUDGET_LIMITS: readonly FinanceBudgetLimit[] = [
  {
    categoryId: 'cat-alimentacao',
    amountInCents: 45_000,
    alertThresholdPct: 80,
    alertsEnabled: true,
  },
  {
    categoryId: 'cat-transportes',
    amountInCents: 20_000,
    alertThresholdPct: 80,
    alertsEnabled: true,
  },
  { categoryId: 'cat-lazer', amountInCents: 10_000, alertThresholdPct: 80, alertsEnabled: true },
  { categoryId: 'cat-casa', amountInCents: 90_000, alertThresholdPct: 90, alertsEnabled: true },
];

const GOALS: readonly FinanceGoal[] = [
  {
    id: 'goal-ferias',
    targetAmountInCents: 200_000,
    initialReservedInCents: 40_000,
    targetDate: addMonths(todayOrFallback(), 7).slice(0, 8) + '01',
    contributionFrequency: 'monthly',
  },
  {
    id: 'goal-emergencia',
    targetAmountInCents: 900_000,
    initialReservedInCents: 120_000,
    targetDate: addMonths(todayOrFallback(), 18).slice(0, 8) + '01',
    contributionFrequency: 'monthly',
  },
];

/** Reserva para o caso de `buildDemoData` ser chamado sem data. */
function todayOrFallback(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Lisbon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export interface DemoData {
  readonly categories: readonly FinanceCategory[];
  readonly accounts: readonly FinanceAccount[];
  readonly transactions: readonly FinanceTransaction[];
  readonly budgetLimits: readonly FinanceBudgetLimit[];
  readonly goals: readonly FinanceGoal[];
  readonly goalMovements: readonly FinanceGoalMovement[];
  /** Mês de competência das compras de cartão dos dados de exemplo. */
  readonly invoiceId: string;
}

/** Constrói os dados de exemplo relativos à data indicada. */
export function buildDemoData(today: string): DemoData {
  const transactions: FinanceTransaction[] = [];
  const thisMonthStart = periodOf(today).start;

  // Seis meses de histórico, do mais antigo para o mais recente.
  const monthStarts = [5, 4, 3, 2, 1, 0].map((offset) => addMonths(thisMonthStart, -offset));

  monthStarts.forEach((monthStart, monthIndex) => {
    const isCurrentMonth = monthIndex === monthStarts.length - 1;

    for (const recurring of RECURRING) {
      const date = addDays(monthStart, recurring.day - 1);

      // O que ainda não aconteceu este mês fica por liquidar, para o painel
      // mostrar que distingue o previsto do realizado.
      const isFuture = isCurrentMonth && date > today;

      transactions.push({
        id: `${recurring.description}-${monthIndex}`.replace(/\s+/g, '-').toLowerCase(),
        kind: recurring.kind,
        status: isFuture ? 'pending' : 'confirmed',
        amountInCents: recurring.amountInCents,
        date,
        description: recurring.description,
        accountId: recurring.accountId,
        categoryId: recurring.categoryId,
        invoiceId: recurring.invoiceId,
        settled: isFuture ? false : recurring.settled,
      });
    }

    // Um gasto variável por mês, para a série não ser uma linha reta.
    const variableAmounts = [-3_400, -6_780, -2_150, -9_900, -4_620, -1_250];
    const variable = variableAmounts[monthIndex] ?? -3_000;

    transactions.push({
      id: `extra-${monthIndex}`,
      kind: 'expense',
      status: 'confirmed',
      amountInCents: variable,
      date: addDays(monthStart, 22),
      description: 'Gasolina',
      accountId: 'acc-ordem',
      categoryId: 'cat-transportes',
      settled: true,
    });

    if (monthIndex % 2 === 0) {
      transactions.push({
        id: `extra-receita-${monthIndex}`,
        kind: 'income',
        status: 'confirmed',
        amountInCents: 32_500,
        date: addDays(monthStart, 15),
        description: 'Trabalho extra',
        accountId: 'acc-ordem',
        categoryId: 'cat-extra',
        settled: true,
      });
    }
  });

  // Aporte mensal nos objetivos, para haver progresso para mostrar.
  const goalMovements: FinanceGoalMovement[] = [];
  for (const monthStart of monthStarts) {
    goalMovements.push({
      goalId: 'goal-ferias',
      type: 'deposit',
      amountInCents: 10_000,
      date: addDays(monthStart, 4),
    });
    goalMovements.push({
      goalId: 'goal-emergencia',
      type: 'deposit',
      amountInCents: 15_000,
      date: addDays(monthStart, 4),
    });
  }

  return {
    categories: CATEGORIES,
    accounts: ACCOUNTS,
    transactions,
    budgetLimits: BUDGET_LIMITS,
    goals: GOALS,
    goalMovements,
    invoiceId: 'inv-atual',
  };
}
