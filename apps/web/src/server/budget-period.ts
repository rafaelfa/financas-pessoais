/**
 * Reexporta a construção do período de orçamento a partir do domínio.
 *
 * A implementação mudou para `@repo/shared` (é pura e usa só aritmética de
 * datas) por uma razão concreta: o defeito do gate G6 estava **na construção do
 * período**, e a camada de servidor não tem testes — nenhum teste alcançava o
 * código onde o erro vivia. Aqui fica o caminho local, para os importadores
 * existentes não mudarem.
 */
export {
  currentPeriod,
  dayBefore,
  monthPeriodFor,
  periodByKey,
  periodStartFor,
  singleMonthPeriod,
  type BudgetPeriod,
} from '@repo/shared';
