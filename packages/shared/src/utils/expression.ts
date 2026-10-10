/**
 * Avaliação de expressões monetárias escritas pelo utilizador.
 *
 * Quem lança despesas escreve coisas como `12,5 + 3,20` ou `(45 + 15) / 3` no
 * campo do valor. Isto é resolvido por um analisador próprio, com recursão
 * descendente, e **nunca** com `eval` nem `new Function` — avaliar texto do
 * utilizador com `eval` é uma porta aberta a execução de código arbitrário.
 *
 * Separadores: aceita `1.234,56` (português), `1234.56` (internacional),
 * `1 234,56` (com espaço) e `1.234.567,89`.
 */

type TokenKind = 'number' | 'operator' | 'open' | 'close';

interface Token {
  readonly kind: TokenKind;
  readonly value: string;
  readonly position: number;
}

/** Um literal numérico no início de `input`, ou `null`. */
function readNumberToken(input: string, start: number): Token | null {
  const match = /^\d[\d.,\s]*/.exec(input.slice(start));

  if (!match) {
    return null;
  }

  // Um literal não pode acabar em separador nem em espaço: `12, + 3` → `12`.
  const raw = match[0].replace(/[\s.,]+$/, '');

  return { kind: 'number', value: raw, position: start };
}

function tokenize(input: string): Token[] | null {
  const tokens: Token[] = [];
  let index = 0;

  while (index < input.length) {
    const character = input[index] as string;

    if (character === ' ') {
      index += 1;
      continue;
    }

    if ('+-*/'.includes(character)) {
      tokens.push({ kind: 'operator', value: character, position: index });
      index += 1;
      continue;
    }

    if (character === '(') {
      tokens.push({ kind: 'open', value: character, position: index });
      index += 1;
      continue;
    }

    if (character === ')') {
      tokens.push({ kind: 'close', value: character, position: index });
      index += 1;
      continue;
    }

    const numberToken = readNumberToken(input, index);

    if (numberToken === null) {
      return null;
    }

    tokens.push(numberToken);
    index = numberToken.position + numberToken.value.length;

    // Saltar espaços que ficaram entre o número e o resto.
    while (input[index] === ' ') {
      index += 1;
    }
  }

  return tokens;
}

/**
 * Converte um literal em número decimal, decidindo se o ponto é separador de
 * milhares ou decimal.
 */
export function parseDecimalLiteral(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, '');

  if (cleaned === '') {
    return null;
  }

  let normalized: string;

  if (cleaned.includes(',')) {
    // Formato português: os pontos são milhares, a vírgula é decimal.
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    // Só pontos, agrupados de três em três: são milhares (`1.234`).
    normalized = cleaned.replace(/\./g, '');
  } else {
    normalized = cleaned;
  }

  // Só pode haver um ponto decimal depois da normalização.
  if ((normalized.match(/\./g) ?? []).length > 1) {
    return null;
  }

  const value = Number(normalized);

  return Number.isFinite(value) ? value : null;
}

class Parser {
  private index = 0;

  constructor(private readonly tokens: readonly Token[]) {}

  parse(): number | null {
    const value = this.parseExpression();

    if (value === null || this.index !== this.tokens.length) {
      return null;
    }

    return value;
  }

  private peek(): Token | undefined {
    return this.tokens[this.index];
  }

  private parseExpression(): number | null {
    let left = this.parseTerm();

    if (left === null) {
      return null;
    }

    while (this.peek()?.kind === 'operator' && '+-'.includes(this.peek()?.value as string)) {
      const operator = this.tokens[this.index]?.value as string;
      this.index += 1;

      const right = this.parseTerm();

      if (right === null) {
        return null;
      }

      left = operator === '+' ? left + right : left - right;
    }

    return left;
  }

  private parseTerm(): number | null {
    let left = this.parseFactor();

    if (left === null) {
      return null;
    }

    while (this.peek()?.kind === 'operator' && '*/'.includes(this.peek()?.value as string)) {
      const operator = this.tokens[this.index]?.value as string;
      this.index += 1;

      const right = this.parseFactor();

      if (right === null || (operator === '/' && right === 0)) {
        return null;
      }

      left = operator === '*' ? left * right : left / right;
    }

    return left;
  }

  private parseFactor(): number | null {
    const token = this.peek();

    if (token === undefined) {
      return null;
    }

    if (token.kind === 'operator' && '+-'.includes(token.value)) {
      this.index += 1;
      const value = this.parseFactor();

      if (value === null) {
        return null;
      }

      return token.value === '-' ? -value : value;
    }

    if (token.kind === 'number') {
      this.index += 1;

      return parseDecimalLiteral(token.value);
    }

    if (token.kind === 'open') {
      this.index += 1;
      const value = this.parseExpression();

      if (value === null || this.peek()?.kind !== 'close') {
        return null;
      }

      this.index += 1;

      return value;
    }

    return null;
  }
}

/**
 * Avalia uma expressão e devolve o valor em cêntimos inteiros.
 * Devolve `null` quando a expressão é inválida, divide por zero ou o resultado
 * não é finito — o chamador decide a mensagem a mostrar.
 */
export function evaluateAmountExpression(input: string): number | null {
  const trimmed = input.trim();

  if (trimmed === '') {
    return null;
  }

  const tokens = tokenize(trimmed);

  if (tokens === null || tokens.length === 0) {
    return null;
  }

  const value = new Parser(tokens).parse();

  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  return Math.round(value * 100);
}

/** Indica se a expressão contém operadores, ou seja, se é um cálculo. */
export function isCalculation(input: string): boolean {
  return /[+\-*/()]/.test(input.replace(/^-/, ''));
}
