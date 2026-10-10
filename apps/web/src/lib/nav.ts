import {
  ArrowLeftRight,
  ChartColumn,
  CreditCard,
  FileUp,
  LayoutDashboard,
  ListFilter,
  PiggyBank,
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

/** Barra lateral, agrupada por intenção do utilizador. */
export const NAV_SECTIONS: readonly NavSection[] = [
  { title: 'Dia a dia', items: [PAINEL, TRANSACOES, CONTAS, CARTOES] },
  { title: 'Planeamento', items: [ORCAMENTO, OBJETIVOS, RECORRENCIAS, REGRAS] },
  { title: 'Análise', items: [CATEGORIAS, RELATORIOS, IMPORTAR, DEFINICOES] },
];

/**
 * Navegação inferior do telemóvel: cinco destinos, os que se usam a olhar para
 * o telemóvel na fila do supermercado.
 */
export const MOBILE_NAV: readonly NavItem[] = [PAINEL, TRANSACOES, ORCAMENTO, OBJETIVOS, CONTAS];

/** Todos os destinos, para a paleta de comandos. */
export const ALL_NAV_ITEMS: readonly NavItem[] = NAV_SECTIONS.flatMap((section) => section.items);
