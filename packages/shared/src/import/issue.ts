/**
 * Peças comuns aos parsers de extratos.
 *
 * Um extrato é um ficheiro que vem de fora: pode estar truncado, ter uma linha
 * estragada, uma data impossível ou um valor com um formato que ninguém previu.
 * Nada disso pode ser uma exceção — tem de ser um **resultado**, com a linha e o
 * motivo, para que a pré-visualização possa dizer exatamente o que não
 * conseguiu interpretar em vez de importar dados errados em silêncio.
 */

export interface ImportIssue {
  /** Linha do ficheiro (1-based) onde o problema foi detetado. */
  readonly line: number;
  /** Campo ou zona do ficheiro: `TRNAMT`, `Data`, `documento`, … */
  readonly field: string;
  /** Mensagem em pt-PT, escrita para ser mostrada ao utilizador. */
  readonly message: string;
}

/**
 * Valida uma data de calendário a partir das suas partes e devolve
 * `YYYY-MM-DD`, ou `null` se não for uma data real.
 *
 * A validação é feita pelo calendário, e não por uma expressão regular: 31 de
 * fevereiro tem a forma certa e não existe — e uma data que não existe não pode
 * virar um lançamento com a data errada.
 */
export function toIsoCalendarDate(
  year: string | number,
  month: string | number,
  day: string | number,
): string | null {
  const y = typeof year === 'number' ? year : Number.parseInt(year, 10);
  const m = typeof month === 'number' ? month : Number.parseInt(month, 10);
  const d = typeof day === 'number' ? day : Number.parseInt(day, 10);

  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) {
    return null;
  }

  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1 || d > 31) {
    return null;
  }

  const probe = new Date(Date.UTC(y, m - 1, d));

  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
    return null;
  }

  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Normaliza um nome para comparar duplicados: sem acentos, minúsculas e com os
 * espaços colapsados.
 *
 * Serve para reconhecer como igual o mesmo movimento escrito de duas maneiras
 * ("PAGAMENTO  SERVIÇOS" e "pagamento servicos") quando o ficheiro não traz
 * `FITID` — que é o caso de todos os CSV.
 */
export function normalizeForMatch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}
