import { MAX_AMOUNT_IN_CENTS } from '../schemas/domain/primitives';
import { parseAmountToCents } from '../import/cents';

/**
 * Filtro por valor do extrato.
 *
 * O critério é o **módulo** do valor (decisão D19): «acima de 25 €» apanha a
 * compra de −5 000 cêntimos. Sobre o valor assinado devolveria só rendimentos —
 * o contrário do que quem procura despesas grandes quer.
 *
 * A conversão de euros para cêntimos é a do importador (`parseAmountToCents`) e
 * não uma segunda: dois parsers de dinheiro a divergir é a classe de erro que
 * este projeto já pagou.
 *
 * A cláusula que filtra vive **aqui**, ao lado da leitura do URL, e não no
 * servidor: uma regra em dois sítios (um testado, outro a correr) é uma prova
 * falsa. O objeto devolvido é o que o Prisma consome; este pacote não importa
 * o Prisma — a forma é estrutural.
 */

/** Operadores, na ordem em que a barra os mostra. */
export type AmountOperator = 'gt' | 'lt' | 'eq';

const OPERATORS: readonly AmountOperator[] = ['gt', 'lt', 'eq'];

/** Filtro já validado: operador conhecido e limite em cêntimos, nunca negativo. */
export interface AmountFilter {
  readonly operator: AmountOperator;
  readonly amountInCents: number;
}

/** Comparação sobre uma coluna em cêntimos, na forma que o Prisma entende. */
export interface AmountComparison {
  readonly gt?: number;
  readonly lt?: number;
  readonly not?: number;
}

export interface AmountCondition {
  readonly amountInCents: number | AmountComparison;
}

export interface AmountWhereClause {
  readonly amountInCents?: number | AmountComparison;
  readonly OR?: AmountCondition[];
  readonly AND?: AmountCondition[];
}

function isAmountOperator(value: unknown): value is AmountOperator {
  return typeof value === 'string' && (OPERATORS as readonly string[]).includes(value);
}

/**
 * Lê o par `valor`/`valorOp` do URL.
 *
 * Devolve `null` — filtro ausente — quando falta um dos dois, quando o operador
 * não é conhecido, quando o valor não é um montante ou quando passa o maior
 * inteiro que a coluna aceita (`Int`, 21 474 836,47 €). Um URL mal escrito não
 * pode dar erro nem zeros silenciosos: dá a página sem este filtro.
 */
export function parseAmountFilter(input: {
  readonly valor?: string | null;
  readonly valorOp?: string | null;
}): AmountFilter | null {
  const valor = input.valor?.trim() ?? '';
  const valorOp = input.valorOp?.trim() ?? '';

  if (valor === '' || !isAmountOperator(valorOp)) {
    return null;
  }

  const cents = parseAmountToCents(valor);

  if (cents === null || Math.abs(cents) > MAX_AMOUNT_IN_CENTS) {
    return null;
  }

  return { operator: valorOp, amountInCents: Math.abs(cents) };
}

/**
 * O outro lado da comparação.
 *
 * Com zero devolve `0` e não `-0`: em SQL é o mesmo, mas `-0` num objeto de
 * cláusula faz quem lê desconfiar de um erro de sinal.
 */
function opposite(cents: number): number {
  return cents === 0 ? 0 : -cents;
}

/**
 * A cláusula: o módulo em `OR`/`AND`, sem `abs()` no SQL.
 *
 * O `$queryRaw` resolveria isto numa linha e partiria o `count` e o `aggregate`
 * do rodapé, que têm de ver exatamente o mesmo conjunto. Limites estritos:
 * `gt`/`lt` não incluem o valor.
 */
export function amountWhereClause(filter: AmountFilter): AmountWhereClause {
  const cents = Math.abs(filter.amountInCents);

  switch (filter.operator) {
    case 'gt':
      // Com zero não há par de sinais: «acima de 0» é simplesmente «não é zero».
      return cents === 0
        ? { amountInCents: { not: 0 } }
        : { OR: [{ amountInCents: { gt: cents } }, { amountInCents: { lt: opposite(cents) } }] };
    case 'lt':
      return {
        AND: [{ amountInCents: { lt: cents } }, { amountInCents: { gt: opposite(cents) } }],
      };
    case 'eq':
      return { OR: [{ amountInCents: cents }, { amountInCents: opposite(cents) }] };
  }
}
