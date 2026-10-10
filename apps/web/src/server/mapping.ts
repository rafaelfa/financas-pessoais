/**
 * Reexporta o mapeamento a partir do domínio partilhado.
 *
 * A implementação vive em `@repo/shared` porque é lógica pura e porque é lá que
 * os testes correm. Este ficheiro existe para a camada de servidor a importar
 * por um caminho local, sem duplicar o sítio onde os nomes são definidos.
 */
export {
  toAccountingBasis,
  toCategoryKind,
  toFinanceAccount,
  toFinanceCategory,
  toFinanceTransaction,
  toIsoDate,
  toTransactionKind,
  toTransactionStatus,
} from '@repo/shared';

export type { AccountRow, CategoryRow, TransactionRow } from '@repo/shared';
