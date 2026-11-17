/**
 * Sugestões de descrição a partir do histórico.
 *
 * A descrição é texto livre: a lista **sugere**, não restringe. Por isso o
 * filtro é `includes` sem distinguir maiúsculas de minúsculas — e nada mais.
 * Não se promete insensibilidade a acentos: «cafe» não encontra «café», e é
 * melhor dizê-lo do que fingir que funciona.
 *
 * A ordem é determinística: mais usadas primeiro e, em empate, alfabética. Sem
 * o desempate, duas leituras iguais davam listas diferentes e ninguém saberia
 * porquê.
 */

/** Uma descrição e quantas vezes foi usada na janela considerada. */
export interface DescriptionUsage {
  readonly description: string;
  readonly uses: number;
}

/** Quantas sugestões se enviam para o ecrã. */
export const DESCRIPTION_SUGGESTION_LIMIT = 50;

/** Ordena por usos (descendente) e, em empate, alfabeticamente. */
export function rankDescriptionSuggestions(
  entries: readonly DescriptionUsage[],
  options: { readonly limit?: number } = {},
): DescriptionUsage[] {
  const limit = options.limit ?? DESCRIPTION_SUGGESTION_LIMIT;

  return (
    [...entries]
      // Uma descrição só com espaços (ou vazia) não é uma sugestão: gastava um
      // dos 50 lugares e aparecia como uma linha em branco.
      .filter((entry) => entry.description.trim() !== '')
      .sort(
        (a, b) =>
          b.uses - a.uses || a.description.localeCompare(b.description, 'pt-PT', { numeric: true }),
      )
      .slice(0, limit)
  );
}

/** Filtra pelo que está escrito, mantendo a ordem recebida. */
export function filterDescriptionSuggestions(
  entries: readonly DescriptionUsage[],
  query: string,
): DescriptionUsage[] {
  const term = query.trim().toLowerCase();

  return term === ''
    ? [...entries]
    : entries.filter((entry) => entry.description.toLowerCase().includes(term));
}
