import {
  ArrowLeftRight,
  ChartColumn,
  CreditCard,
  FileUp,
  Landmark,
  Layers,
  LayoutDashboard,
  ListFilter,
  PiggyBank,
  Receipt,
  Repeat,
  Settings,
  Tags,
  Target,
  Wallet,
} from 'lucide-react';
import type { ComponentType } from 'react';

/**
 * Configuração de navegação — fonte única de verdade.
 *
 * A barra lateral, a navegação inferior do telemóvel e a paleta de comandos
 * leem todos daqui. Assim não há o risco clássico de acrescentar um ecrã e
 * esquecer-se de o ligar num dos sítios.
 */

export interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly description: string;
  readonly icon: ComponentType<{ className?: string }>;
}

export interface NavSection {
  readonly title: string;
  readonly items: readonly NavItem[];
}

const PAINEL: NavItem = {
  href: '/',
  label: 'Painel',
  description: 'Resumo do mês, património e próximos dias',
  icon: LayoutDashboard,
};
const TRANSACOES: NavItem = {
  href: '/transacoes',
  label: 'Transações',
  description: 'Lançamentos, filtros e edição',
  icon: ArrowLeftRight,
};
const CONTAS: NavItem = {
  href: '/contas',
  label: 'Contas',
  description: 'Saldos, arquivo e ajuste de saldo',
  icon: Wallet,
};
const CONTAS_A_PAGAR_RECEBER: NavItem = {
  href: '/contas-pagar-receber',
  label: 'Contas a pagar/receber',
  description: 'O que tens de pagar e de receber, com data',
  icon: Receipt,
};
const CONSOLIDACAO: NavItem = {
  href: '/consolidacao-contas',
  label: 'Consolidação',
  description: 'Saldos agrupados por finalidade',
  icon: Layers,
};
const PATRIMONIO: NavItem = {
  href: '/patrimonio',
  label: 'Património',
  description: 'Bens e dívidas que compõem o teu património líquido',
  icon: Landmark,
};
const CARTOES: NavItem = {
  href: '/cartoes',
  label: 'Cartões',
  description: 'Faturas, limites e parcelamentos',
  icon: CreditCard,
};
const ORCAMENTO: NavItem = {
  href: '/orcamento',
  label: 'Orçamento',
  description: 'Limites por categoria e alertas',
  icon: PiggyBank,
};
const OBJETIVOS: NavItem = {
  href: '/objetivos',
  label: 'Objetivos',
  description: 'Metas, aportes e progresso',
  icon: Target,
};
const RECORRENCIAS: NavItem = {
  href: '/recorrencias',
  label: 'Recorrências',
  description: 'Contas fixas e lançamentos automáticos',
  icon: Repeat,
};
const REGRAS: NavItem = {
  href: '/regras',
  label: 'Regras',
  description: 'Categorização automática',
  icon: ListFilter,
};
const CATEGORIAS: NavItem = {
  href: '/categorias',
  label: 'Categorias',
  description: 'Organizar gastos e ganhos por tipo',
  icon: Tags,
};
const RELATORIOS: NavItem = {
  href: '/relatorios',
  label: 'Relatórios',
  description: 'Extrato, evolução e comparações',
  icon: ChartColumn,
};
const IMPORTAR: NavItem = {
  href: '/importar',
  label: 'Importar',
  description: 'Extratos OFX e CSV, exportações e cópias',
  icon: FileUp,
};
const DEFINICOES: NavItem = {
  href: '/definicoes',
  label: 'Definições',
  description: 'Moeda, início do mês e preferências',
  icon: Settings,
};

/**
 * Todos os ecrãs, uma vez cada.
 *
 * As listas abaixo referenciam **chaves deste objecto**: um ecrã novo entra
 * aqui uma vez e a paleta deriva-o. Era esta a duplicação que não se podia
 * vigiar com testes (não há runner de testes em `apps/web`).
 */
const NAV = {
  /*
   * A **ordem deste objecto é a ordem da paleta de comandos**: `ALL_NAV_ITEMS`
   * sai de `Object.values(NAV)`, que mantém a inserção. Mover uma chave muda a
   * ordem do `Ctrl+K` em silêncio — a intenção é que mude, mas convém saber.
   */
  painel: PAINEL,
  transacoes: TRANSACOES,
  contas: CONTAS,
  contasAPagarReceber: CONTAS_A_PAGAR_RECEBER,
  consolidacao: CONSOLIDACAO,
  cartoes: CARTOES,
  patrimonio: PATRIMONIO,
  orcamento: ORCAMENTO,
  objetivos: OBJETIVOS,
  recorrencias: RECORRENCIAS,
  regras: REGRAS,
  categorias: CATEGORIAS,
  relatorios: RELATORIOS,
  importar: IMPORTAR,
  definicoes: DEFINICOES,
} as const;

/**
 * Barra lateral: **oito** destinos em três grupos (decisão D7).
 *
 * Os sete que saíram continuam a existir como ecrãs, com outra porta — ver
 * `ACCOUNT_SECTION_ITEMS`, `TRANSACTION_MENU_ITEMS` e `PROFILE_MENU_ITEMS`.
 * As rotas não mudaram: um favorito antigo abre o mesmo sítio.
 */
export const NAV_SECTIONS: readonly NavSection[] = [
  {
    title: 'Dia a dia',
    items: [NAV.painel, NAV.transacoes, NAV.contas, NAV.contasAPagarReceber],
  },
  { title: 'Planeamento', items: [NAV.orcamento, NAV.objetivos, NAV.patrimonio] },
  { title: 'Análise', items: [NAV.relatorios] },
];

/**
 * Sub-navegação de contas: a própria Contas, Cartões e Consolidação.
 *
 * Aparece nas **três** páginas: quem entra em Cartões por um favorito antigo
 * tem de conseguir voltar, e não pode ficar num beco sem saída.
 */
export const ACCOUNT_SECTION_ITEMS: readonly NavItem[] = [
  NAV.contas,
  NAV.cartoes,
  NAV.consolidacao,
];

/** Rotas onde a barra de secções de contas aparece. */
export const ACCOUNT_SECTION_ROUTES: readonly string[] = [
  '/contas',
  '/cartoes',
  '/consolidacao-contas',
];

/** Menu «Mais» do extrato: os quatro ecrãs que vivem ao lado das transações. */
export const TRANSACTION_MENU_ITEMS: readonly NavItem[] = [
  NAV.recorrencias,
  NAV.regras,
  NAV.categorias,
  NAV.importar,
];

/** Rotas onde o menu «Mais» aparece — as quatro portas e a própria transações. */
export const TRANSACTION_MENU_ROUTES: readonly string[] = [
  '/transacoes',
  '/recorrencias',
  '/regras',
  '/categorias',
  '/importar',
];

/** Rodapé do utilizador (barra lateral): definições da conta. */
export const PROFILE_MENU_ITEMS: readonly NavItem[] = [NAV.definicoes];

/**
 * Navegação inferior do telemóvel: cinco destinos, os que se usam a olhar para
 * o telemóvel na fila do supermercado.
 */
export const MOBILE_NAV: readonly NavItem[] = [
  NAV.painel,
  NAV.transacoes,
  NAV.orcamento,
  NAV.objetivos,
  NAV.contas,
];

/**
 * Todos os destinos, para a paleta de comandos.
 *
 * A paleta **não** lê a barra lateral: se lesse, encolher a barra encolhia o
 * `Ctrl+K` e a simplificação passava a ser esconderijo.
 */
export const ALL_NAV_ITEMS: readonly NavItem[] = Object.values(NAV);

/**
 * Um destino está ativo na sua rota ou numa sub-rota dela.
 *
 * Raiz exata **mais** prefixo com barra: `startsWith('/contas')` apanharia
 * `/contas-pagar-receber`, que é outro destino.
 */
export function isActiveRoute(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

/** A rota pertence a alguma das secções (raiz exata ou sub-rota). */
export function matchesAnyRoute(pathname: string, routes: readonly string[]): boolean {
  return routes.some((route) => isActiveRoute(pathname, route));
}

/**
 * Destaque na barra lateral.
 *
 * «Contas» representa a secção toda — Cartões e Consolidação incluídos —, por
 * isso fica ativa nas três rotas; os separadores dizem qual está aberta.
 */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (isActiveRoute(pathname, href)) {
    return true;
  }

  return href === '/contas' && matchesAnyRoute(pathname, ACCOUNT_SECTION_ROUTES);
}
