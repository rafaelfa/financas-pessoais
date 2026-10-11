/**
 * Conversão de texto em euros para cêntimos.
 *
 * Os ecrãs mostram dinheiro com `Intl.NumberFormat('pt-PT', …)`: `1 234,56 €`,
 * com espaço inquebrável (U+00A0) como separador de milhares e antes do símbolo.
 * Comparar cadeias de texto seria uma armadilha (o espaço não é o mesmo
 * caractere); os testes leem o número e comparam cêntimos inteiros, que é a
 * unidade do domínio.
 */

/** `«1 234,56 €»` → `123456`. Rebenta se o texto não for um montante. */
export function eurosParaCentimos(texto: string): number {
  const limpo = texto.replace(/[\s\u00a0\u202f\u2009€]/g, '').trim();
  const match = /^(-?)(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{1,2}))?$/.exec(limpo);

  if (match === null) {
    throw new Error(`Não consegui ler «${texto}» como um montante em euros.`);
  }

  const [, sinal = '', inteiros = '0', decimais = ''] = match;
  const centimos = Number.parseInt(inteiros.replace(/\./g, ''), 10) * 100;
  const parteDecimal = Number.parseInt((decimais ?? '').padEnd(2, '0') || '0', 10);
  const total = centimos + parteDecimal;

  return sinal === '-' ? -total : total;
}

/** Cêntimos no formato que os ecrãs mostram, para mensagens de erro legíveis. */
export function centimosParaEuros(centimos: number): string {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(
    centimos / 100,
  );
}
