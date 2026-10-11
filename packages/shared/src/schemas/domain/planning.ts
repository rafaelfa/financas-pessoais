import { z } from 'zod';

import {
  calendarDateSchema,
  descriptionSchema,
  entityIdSchema,
  nonNegativeCentsSchema,
  positiveCentsSchema,
  shortNameSchema,
} from './primitives';

/**
 * Planeamento: orçamentos, objetivos, recorrências e regras.
 *
 * Duas convenções transversais, para não haver surpresas a quem lê os
 * formulários:
 *
 * 1. **Os valores são magnitudes positivas.** O sinal de um movimento vem da
 *    natureza (`kind`: gasto ou ganho), nunca do campo do valor. Quem escreve
 *    `-25` num formulário de despesa está a duplicar a informação, e um dia os
 *    dois discordam.
 * 2. **O período do orçamento é derivado, não enviado.** O formulário manda o
 *    nome, o total e o âmbito; a ação calcula as datas a partir do dia de início
 *    do mês do utilizador. Deixar o cliente escolher o período permitiria um
 *    orçamento que não corresponde a nenhum mês real.
 */

// =============================================================================
// Orçamentos
// =============================================================================

/**
 * Âmbito do orçamento.
 *
 * `monthly_default` é o orçamento do dia a dia: define-se uma vez e vale para
 * todos os meses, sempre com o mês de início definido pelo utilizador.
 * `single_month` é um orçamento de um mês concreto (férias, um mês atípico).
 */
export const budgetScopeSchema = z.enum(['single_month', 'monthly_default']);

const budgetShape = z.object({
  name: shortNameSchema,
  totalAmountInCents: positiveCentsSchema,
  scope: budgetScopeSchema.default('monthly_default'),
  /** Só para `single_month`: primeiro dia do mês. */
  periodStart: calendarDateSchema.optional(),
  alertsEnabled: z.boolean().default(true),
});

export const createBudgetSchema = budgetShape;

export const updateBudgetSchema = budgetShape.partial().extend({ id: entityIdSchema });

/** Definir (ou alterar) o limite de uma categoria: é um `upsert`. */
export const setBudgetLimitSchema = z.object({
  budgetId: entityIdSchema,
  categoryId: entityIdSchema,
  amountInCents: positiveCentsSchema,
  alertThresholdPct: z
    .number()
    .int('A percentagem tem de ser um número inteiro.')
    .min(0, 'A percentagem tem de estar entre 0 e 100.')
    .max(100, 'A percentagem tem de estar entre 0 e 100.')
    .nullish(),
  alertsEnabled: z.boolean().optional(),
});

/**
 * Remover um limite.
 *
 * Leva o par `(budgetId, categoryId)` e não o `id` do limite: é o que a
 * interface tem à mão quando o utilizador clica em remover, e evita uma consulta
 * só para descobrir um identificador interno.
 */
export const removeBudgetLimitSchema = z.object({
  budgetId: entityIdSchema,
  categoryId: entityIdSchema,
});

// =============================================================================
// Objetivos
// =============================================================================

export const recurrenceFrequencySchema = z.enum(['weekly', 'monthly', 'quarterly']);

const goalShape = z.object({
  name: shortNameSchema,
  description: descriptionSchema.optional(),
  targetAmountInCents: positiveCentsSchema,
  targetDate: calendarDateSchema,
  contributionFrequency: recurrenceFrequencySchema.default('monthly'),
  /** Objetivo sugerido pela aplicação em vez de criado pelo utilizador. */
  isPreset: z.boolean().default(false),
  /** Valor já reservado à data de criação. */
  initialReservedInCents: nonNegativeCentsSchema.default(0),
});

export const createGoalSchema = goalShape;

export const updateGoalSchema = goalShape.partial().extend({ id: entityIdSchema });

export const goalMovementTypeSchema = z.enum(['deposit', 'withdrawal']);

export const addGoalMovementSchema = z.object({
  goalId: entityIdSchema,
  type: goalMovementTypeSchema,
  amountInCents: positiveCentsSchema,
  date: calendarDateSchema,
  note: z.string().trim().max(200).nullish(),
  /**
   * Conta de onde o dinheiro sai (depósito) ou entra (levantamento). Sem conta, o
   * movimento é só uma marca de progresso: nada se move.
   */
  accountId: entityIdSchema.nullish(),
});

export const setGoalCompletedSchema = z.object({
  id: entityIdSchema,
  completed: z.boolean(),
});

// =============================================================================
// Recorrências
// =============================================================================

const recurrenceShape = z.object({
  name: shortNameSchema,
  kind: z.enum(['expense', 'income']),
  /** Magnitude de cada ocorrência; o sinal vem do `kind`. */
  amountInCents: positiveCentsSchema,
  description: descriptionSchema.nullish(),
  frequency: recurrenceFrequencySchema,
  /** Repetição a cada N períodos (2 + mensal = bimestral). */
  interval: z.number().int().min(1).max(24).default(1),
  dayOfMonth: z.number().int().min(1).max(31).nullish(),
  startDate: calendarDateSchema,
  endDate: calendarDateSchema.nullish(),
  accountId: entityIdSchema,
  categoryId: entityIdSchema.nullish(),
});

export const createRecurrenceSchema = recurrenceShape.superRefine((value, ctx) => {
  if (value.endDate !== undefined && value.endDate !== null && value.endDate < value.startDate) {
    ctx.addIssue({
      code: 'custom',
      path: ['endDate'],
      message: 'O fim da série não pode ser antes do início.',
    });
  }
});

/**
 * Alteração de uma série.
 *
 * Parcial e **sem** a validação de fim-de-série: a ação verifica-a contra os
 * valores já gravados, porque o formulário pode enviar só o fim.
 */
export const updateRecurrenceSchema = recurrenceShape.partial().extend({ id: entityIdSchema });

/** Ligar ou desligar uma série. */
export const setActiveSchema = z.object({
  id: entityIdSchema,
  active: z.boolean(),
});

// =============================================================================
// Regras de categorização
// =============================================================================

/**
 * O que uma regra faz.
 *
 * Nesta fase só `set_category` está implementado; as outras três são aceites
 * pelo schema mas recusadas pela ação, com uma mensagem honesta, para o modelo
 * já as comportar quando forem construídas.
 */
export const ruleActionSchema = z.enum([
  'set_category',
  'set_tags',
  'set_description',
  'mark_ignored',
]);

const ruleShape = z.object({
  name: shortNameSchema,
  kind: z.enum(['expense', 'income']),
  /** Menor primeiro; a primeira regra que corresponder ganha. */
  priority: z.number().int().min(0).max(9_999).default(100),
  enabled: z.boolean().default(true),
  descriptionContains: z.string().trim().max(120).nullish(),
  counterparty: z.string().trim().max(120).nullish(),
  amountMinInCents: positiveCentsSchema.nullish(),
  amountMaxInCents: positiveCentsSchema.nullish(),
  dayMin: z.number().int().min(1).max(31).nullish(),
  dayMax: z.number().int().min(1).max(31).nullish(),
  accountId: entityIdSchema.nullish(),
  cardId: entityIdSchema.nullish(),
  targetCategoryId: entityIdSchema,
  action: ruleActionSchema.default('set_category'),
});

/** As condições preenchidas combinam-se por conjunção; pelo menos uma é obrigatória. */
function refineRule(value: z.infer<typeof ruleShape>, ctx: z.RefinementCtx): void {
  const hasCondition =
    (value.descriptionContains ?? '').trim().length > 0 ||
    (value.counterparty ?? '').trim().length > 0 ||
    value.amountMinInCents != null ||
    value.amountMaxInCents != null ||
    value.dayMin != null ||
    value.dayMax != null ||
    value.accountId != null ||
    value.cardId != null;

  if (!hasCondition) {
    ctx.addIssue({
      code: 'custom',
      path: ['descriptionContains'],
      message: 'Uma regra precisa de pelo menos uma condição, senão categoriza tudo.',
    });
  }

  if (
    value.amountMinInCents != null &&
    value.amountMaxInCents != null &&
    value.amountMinInCents > value.amountMaxInCents
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['amountMaxInCents'],
      message: 'O valor máximo tem de ser maior ou igual ao mínimo.',
    });
  }

  if (value.dayMin != null && value.dayMax != null && value.dayMin > value.dayMax) {
    ctx.addIssue({
      code: 'custom',
      path: ['dayMax'],
      message: 'O dia final tem de ser maior ou igual ao inicial.',
    });
  }
}

export const createRuleSchema = ruleShape.superRefine(refineRule);

export const updateRuleSchema = ruleShape.partial().extend({ id: entityIdSchema });

/** Ligar ou desligar uma regra. */
export const setEnabledSchema = z.object({
  id: entityIdSchema,
  enabled: z.boolean(),
});

/** Apagar por identificador (regras, recorrências, orçamentos). */
export const deleteByIdSchema = z.object({ id: entityIdSchema });

export type BudgetScopeInput = z.infer<typeof budgetScopeSchema>;
export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;
export type SetBudgetLimitInput = z.infer<typeof setBudgetLimitSchema>;
export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
export type AddGoalMovementInput = z.infer<typeof addGoalMovementSchema>;
export type CreateRecurrenceInput = z.infer<typeof createRecurrenceSchema>;
export type UpdateRecurrenceInput = z.infer<typeof updateRecurrenceSchema>;
export type CreateRuleInput = z.infer<typeof createRuleSchema>;
export type UpdateRuleInput = z.infer<typeof updateRuleSchema>;
export type RuleActionInput = z.infer<typeof ruleActionSchema>;
