/**
 * Âmbito do painel: carteira toda, uma conta ou um cartão.
 *
 * Módulo **puro**, sem Prisma e sem React: recebe o que a base de dados devolveu
 * (as contas e os cartões do utilizador, com id e nome) e a intenção que veio no
 * URL, e diz qual é o âmbito efetivo e se a escolha foi recusada.
 *
 * A validação vive aqui, e não na interface, por uma razão de segurança: um
 * `?id=` de outra pessoa não pode revelar nada nem provocar um erro 500. Quem
 * pergunta só recebe o que é **seu** — e o que não é cai no âmbito unificado com
 * uma explicação curta, que é a mesma resposta para «não existe» e «não é teu».
 * Distingui-las diria a quem tentasse um id alheio se ele existe.
 */

/** Vista que o utilizador pediu no URL. */
export type DashboardView = 'tudo' | 'conta' | 'cartao';

/** Parâmetro de URL de cada vista. */
export const DASHBOARD_VIEW_PARAMS: Readonly<Record<DashboardView, string>> = {
  tudo: 'tudo',
  conta: 'conta',
  cartao: 'cartao',
};

/** Uma conta ou um cartão do utilizador, reduzido ao que o seletor precisa. */
export interface DashboardScopeEntity {
  readonly id: string;
  readonly name: string;
}

/** O que o seletor tem para oferecer. Vem da base, já filtrado por `userId`. */
export interface DashboardScopeChoices {
  readonly accounts: readonly DashboardScopeEntity[];
  readonly cards: readonly DashboardScopeEntity[];
}

/** Âmbito efetivo sobre o qual os números do painel são calculados. */
export interface DashboardScope {
  readonly kind: DashboardView;
  /** `null` no âmbito unificado. */
  readonly id: string | null;
  /** Nome da conta ou do cartão; `null` no âmbito unificado. */
  readonly name: string | null;
  /**
   * `true` quando o âmbito pedido **não** pôde ser aplicado (id alheio ou
   * inexistente): o painel mostra a carteira toda, como se não houvesse âmbito.
   */
  readonly rejected: boolean;
  /** Explicação curta da recusa, em pt-PT; `null` quando não há nada a dizer. */
  readonly notice: string | null;
}

/** Âmbito unificado: o painel como sempre foi. */
export function unifiedDashboardScope(): DashboardScope {
  return { kind: 'tudo', id: null, name: null, rejected: false, notice: null };
}

/** `true` se o valor é um dos três parâmetros de vista que conhecemos. */
export function isDashboardViewParam(value: string): value is DashboardView {
  return value === 'tudo' || value === 'conta' || value === 'cartao';
}

/**
 * Lê o parâmetro `vista`.
 *
 * Sem parâmetro, é a carteira toda — é isso que torna a receita `?vista=conta`
 * opcional e mantém os links antigos do painel a funcionar.
 */
export function dashboardViewFromParam(value: string | undefined | null): DashboardView {
  return value !== undefined && value !== null && isDashboardViewParam(value) ? value : 'tudo';
}

/**
 * Explicação da recusa, com o vocabulário do ecrã.
 *
 * Recebe o id que veio no URL para o citar; a mensagem é a mesma quer o
 * identificador não exista, seja de outra pessoa ou nem seja um identificador.
 */
export function scopeRejectionNotice(view: DashboardView, id: string | null): string {
  if (id === null || id.trim() === '') {
    return 'O endereço não trazia nenhum identificador de conta ou cartão. Estás a ver a carteira toda.';
  }

  return view === 'cartao'
    ? 'O cartão do endereço não existe ou não é teu. Estás a ver a carteira toda.'
    : 'A conta do endereço não existe ou não é tua. Estás a ver a carteira toda.';
}

function ownedEntity(
  entities: readonly DashboardScopeEntity[],
  id: string,
): DashboardScopeEntity | null {
  return entities.find((entity) => entity.id === id) ?? null;
}

/**
 * Resolve a intenção do URL contra o que o utilizador tem.
 *
 * `'tudo'` devolve o âmbito unificado. `'conta'` e `'cartao'` exigem um `id`
 * **existente na lista desse utilizador**: sem isso, devolve o âmbito unificado
 * marcado como recusado, para a interface o poder dizer sem esconder nada.
 */
export function resolveDashboardScope(input: {
  readonly view: DashboardView;
  readonly id: string | null;
  readonly choices: DashboardScopeChoices;
}): DashboardScope {
  if (input.view === 'tudo') {
    return unifiedDashboardScope();
  }

  const entity =
    input.id === null
      ? null
      : ownedEntity(
          input.view === 'cartao' ? input.choices.cards : input.choices.accounts,
          input.id,
        );

  if (entity === null) {
    return {
      ...unifiedDashboardScope(),
      rejected: true,
      notice: scopeRejectionNotice(input.view, input.id),
    };
  }

  return {
    kind: input.view,
    id: entity.id,
    name: entity.name,
    rejected: false,
    notice: null,
  };
}
