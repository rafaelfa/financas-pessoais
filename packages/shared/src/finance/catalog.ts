import type { CategoryKind } from './types';

/**
 * Catálogo de categorias por omissão.
 *
 * Vive no domínio, e não no script de seed, porque é preciso em dois sítios: no
 * seed da base de dados e no **aprovisionamento de um utilizador novo**. Sem
 * isto, quem se registasse entrava numa aplicação sem categorias e não
 * conseguia lançar nada.
 *
 * Os nomes são de Portugal e a lista foi pensada para cobrir o orçamento de uma
 * casa portuguesa sem obrigar a criar categorias no primeiro dia. As categorias
 * internas ficam assinaladas: aparecem no extrato mas nunca contam como ganho
 * nem gasto.
 */

export interface DefaultCategory {
  readonly name: string;
  readonly kind: CategoryKind;
  readonly internal?: boolean;
  /** Categoria-mãe, pelo nome, quando é uma subcategoria por omissão. */
  readonly parent?: string;
  readonly color?: string;
}

/** As 17 categorias de gasto. */
const EXPENSE_CATEGORIES: readonly DefaultCategory[] = [
  { name: 'Habitação', kind: 'expense', color: '#0f766e' },
  { name: 'Alimentação', kind: 'expense', color: '#15803d' },
  { name: 'Restauração', kind: 'expense', color: '#b45309' },
  { name: 'Transportes', kind: 'expense', color: '#1d4ed8' },
  { name: 'Combustível', kind: 'expense', color: '#7c3aed', parent: 'Transportes' },
  { name: 'Água, luz e gás', kind: 'expense', color: '#0369a1' },
  { name: 'Telecomunicações', kind: 'expense', color: '#0e7490' },
  { name: 'Saúde', kind: 'expense', color: '#be123c' },
  { name: 'Educação', kind: 'expense', color: '#4338ca' },
  { name: 'Lazer', kind: 'expense', color: '#a21caf' },
  { name: 'Subscrições', kind: 'expense', color: '#9333ea' },
  { name: 'Seguros', kind: 'expense', color: '#475569' },
  { name: 'Impostos', kind: 'expense', color: '#78716c' },
  { name: 'Vestuário', kind: 'expense', color: '#c2410c' },
  { name: 'Casa', kind: 'expense', color: '#65a30d' },
  { name: 'Animais', kind: 'expense', color: '#ca8a04' },
  { name: 'Outros', kind: 'expense', color: '#525252' },
];

/** As 8 categorias de ganho. */
const INCOME_CATEGORIES: readonly DefaultCategory[] = [
  { name: 'Salário', kind: 'income', color: '#15803d' },
  { name: 'Rendimento variável', kind: 'income', color: '#16a34a' },
  { name: 'Rendimento de investimentos', kind: 'income', color: '#0d9488' },
  { name: 'Prendas', kind: 'income', color: '#db2777' },
  { name: 'Prémios', kind: 'income', color: '#d97706' },
  { name: 'Reembolsos', kind: 'income', color: '#0891b2' },
  { name: 'Cashback', kind: 'income', color: '#7c3aed' },
  { name: 'Outras entradas', kind: 'income', color: '#64748b' },
];

/** As 4 categorias internas: aparecem no extrato, nunca nos totais. */
const INTERNAL_CATEGORIES: readonly DefaultCategory[] = [
  { name: 'Transferência', kind: 'expense', internal: true, color: '#64748b' },
  { name: 'Fatura de cartão', kind: 'expense', internal: true, color: '#64748b' },
  { name: 'Ajuste de saldo', kind: 'expense', internal: true, color: '#64748b' },
  { name: 'Investimento', kind: 'expense', internal: true, color: '#64748b' },
];

/** Todas as categorias criadas para um utilizador novo, por ordem de apresentação. */
export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
  ...EXPENSE_CATEGORIES,
  ...INCOME_CATEGORIES,
  ...INTERNAL_CATEGORIES,
];

/** Nome da carteira criada por omissão no registo. */
export const DEFAULT_PRIMARY_ACCOUNT_NAME = 'Carteira principal';
