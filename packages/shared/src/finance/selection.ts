/**
 * A seleção do extrato, contada como o utilizador a vê.
 *
 * Uma transferência são **duas** linhas na base e **uma** operação para quem a
 * escolheu. A regra vive aqui porque a contagem é mostrada em dois sítios que
 * têm de dizer o mesmo número da mesma seleção: o texto do botão da barra de
 * ações (componente cliente) e o resultado das ações em massa (camada de
 * servidor). Escrita duas vezes, ficou uma vez certa e uma vez errada ao primeiro
 * changemente de regra — é essa a razão de existir um módulo para três linhas.
 */

/** O único campo que a contagem precisa de cada linha selecionada. */
export interface SelectableRow {
  readonly transferGroupId: string | null;
}

/** Quantas operações a seleção representa: o par de uma transferência conta como uma. */
export function logicalCount(rows: readonly SelectableRow[]): number {
  const groups = new Set(
    rows.flatMap((row) => (row.transferGroupId === null ? [] : [row.transferGroupId])),
  );

  return groups.size + rows.filter((row) => row.transferGroupId === null).length;
}
