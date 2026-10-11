/**
 * Conversão de valores monetários de extratos para cêntimos inteiros.
 *
 * Os extratos reais escrevem o mesmo montante de várias maneiras:
 *
 * | Texto        | Interpretação                    |
 * | ------------ | -------------------------------- |
 * | `-1345.67`   | pt/US: ponto decimal             |
 * | `2150,00`    | pt-PT: vírgula decimal           |
 * | `1.234,56`   | pt-PT: ponto de milhares         |
 * | `1,234.56`   | en-US: vírgula de milhares       |
 * | `(64,37)`    | parênteses = negativo            |
 * | `+1250.00`   | sinal explícito                  |
 * | `-` ou vazio | ilegível → `null`                |
 *
 * **Nunca se passa por `Number` decimal.** `Number.parseFloat('-1345.67') * 100`
 * dá `-134567.00000000001` e `Math.round` esconde o problema até ao dia em que
 * não esconde; aqui a parte inteira e a parte decimal são lidas como texto e
 * somadas como inteiros, pelo que o resultado é exato por construção.
 */

const NEGATIVE = -1;
const POSITIVE = 1;

/** `true` quando `text` é uma parte decimal válida: 1 ou 2 dígitos. */
function isDecimals(text: string): boolean {
  return /^\d{1,2}$/.test(text);
}

export type SeparatorRole = 'decimal' | 'group';

export interface SeparatorGuess {
  readonly decimal: '.' | ',';
  readonly group: '.' | ',' | null;
}

/**
 * Decide o papel de `.` e `,` num valor.
 *
 * A regra que resolve os casos ambíguos é a posição: o **último** separador é o
 * decimal, porque ninguém escreve milhares depois dos cêntimos. Se os dois
 * separadores existem, o último é decimal e o outro é de milhares. Se só existe
 * um, é decimal quando lhe seguem 1 ou 2 dígitos (`24,90` em pt-PT, `24.90` em
 * en-US) e de milhares quando lhe seguem exatamente 3 (`1.250`).
 */
export function guessSeparators(text: string): SeparatorGuess {
  const lastDot = text.lastIndexOf('.');
  const lastComma = text.lastIndexOf(',');

  if (lastDot !== -1 && lastComma !== -1) {
    return lastDot > lastComma ? { decimal: '.', group: ',' } : { decimal: ',', group: '.' };
  }

  const separator = lastDot !== -1 ? '.' : lastComma !== -1 ? ',' : null;

  if (separator === null) {
    return { decimal: '.', group: null };
  }

  const tail = text.slice(text.lastIndexOf(separator) + 1);
  const role: SeparatorRole = isDecimals(tail) ? 'decimal' : 'group';

  return role === 'decimal'
    ? { decimal: separator, group: separator === '.' ? ',' : '.' }
    : { decimal: separator === '.' ? ',' : '.', group: separator };
}

/**
 * Converte um valor monetário de extrato em cêntimos inteiros.
 *
 * Devolve `null` quando o texto não é um montante: uma linha ilegível tem de
 * aparecer como ilegível e não como zero euros.
 */
export function parseAmountToCents(raw: string): number | null {
  if (typeof raw !== 'string') {
    return null;
  }

  let text = raw.trim();

  if (text === '') {
    return null;
  }

  // Formato contabilístico: parênteses significam negativo.
  let sign = POSITIVE;

  if (/^\(.*\)$/.test(text)) {
    sign = NEGATIVE;
    text = text.slice(1, -1).trim();
  }

  // Sinal explícito, colado (`-12,50`) ou separado por espaço (`- 12,50`).
  while (text.startsWith('-') || text.startsWith('+')) {
    if (text.startsWith('-')) {
      sign = NEGATIVE;
    }

    text = text.slice(1).trim();
  }

  // Espaço não separável (U+00A0, U+202F) é ruído de formatação.
  text = text.replace(/[\s\u00a0\u202f]/g, '');

  if (text === '') {
    return null;
  }

  if (!/^[\d.,]+$/.test(text)) {
    return null;
  }

  const { decimal, group } = guessSeparators(text);
  const parts = text.split(decimal);

  if (parts.length > 2) {
    return null;
  }

  const integerText = parts[0] ?? '';
  const decimalText = parts[1] ?? '';

  if (integerText === '' && decimalText === '') {
    return null;
  }

  if (decimalText !== '' && !/^\d{1,2}$/.test(decimalText)) {
    return null;
  }

  let integerDigits: string;

  if (group !== null && integerText.includes(group)) {
    const groups = integerText.split(group);

    // Um grupo de milhares só é válido se o primeiro tiver 1 a 3 dígitos e todos
    // os seguintes exatamente 3. `1.23.456` não é um número.
    if (!groups.every((part) => /^\d+$/.test(part))) {
      return null;
    }

    if (groups.length > 1 && !groups.slice(1).every((part) => part.length === 3)) {
      return null;
    }

    const first = groups[0] ?? '';

    if (first.length > 3) {
      return null;
    }

    integerDigits = groups.join('');
  } else if (group === null || !integerText.includes(group)) {
    // Sem separador de milhares: tem de ser tudo dígitos (ou vazio, em `,50`).
    if (integerText !== '' && !/^\d+$/.test(integerText)) {
      return null;
    }

    integerDigits = integerText;
  } else {
    return null;
  }

  if (integerDigits === '') {
    integerDigits = '0';
  }

  const minorDigits = decimalText.padEnd(2, '0').slice(0, 2);
  const integerPart = Number.parseInt(integerDigits, 10);
  const minorPart = Number.parseInt(minorDigits, 10);

  if (!Number.isFinite(integerPart) || !Number.isFinite(minorPart)) {
    return null;
  }

  const magnitude = integerPart * 100 + minorPart;

  if (!Number.isSafeInteger(magnitude)) {
    return null;
  }

  return sign * magnitude;
}

/**
 * Formata cêntimos como valor de extrato em pt-PT: vírgula decimal, ponto de
 * milhares, sempre com sinal quando negativo. É o que a exportação escreve, e é
 * um formato que o importador lê de volta.
 */
export function formatCentsForCsv(amountInCents: number): string {
  const negative = amountInCents < 0;
  const magnitude = Math.abs(amountInCents);
  const integer = Math.floor(magnitude / 100);
  const decimals = magnitude % 100;
  const withGroups = String(integer).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return `${negative ? '-' : ''}${withGroups},${String(decimals).padStart(2, '0')}`;
}
