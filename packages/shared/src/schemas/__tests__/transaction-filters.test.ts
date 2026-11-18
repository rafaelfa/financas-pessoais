import { describe, expect, it } from 'vitest';

import { transactionFiltersSchema } from '../domain/transactions';

/**
 * Os filtros do extrato são validados por este schema, e o resultado do
 * `safeParse` é o que a consulta usa. Uma chave que exista no URL mas não aqui é
 * uma chave que **desaparece em silêncio** (o objecto não é `.strict()`) — e o
 * dia em que alguém o tornar estrito, o `safeParse` falha, o `value` cai para
 * `{ limit, offset }` e o extrato perde todos os filtros sem mostrar um erro.
 *
 * Estes testes existem para essa armadilha ficar desarmada: `semCategoria` está
 * declarado no schema e continua a ser aceite por uma cópia estrita dele.
 */

describe('filtros do extrato — chaves fora do URL', () => {
  it('`semCategoria` é aceite e chega ao valor validado', () => {
    const parsed = transactionFiltersSchema.safeParse({ semCategoria: '1' });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.semCategoria).toBe('1');
  });

  it('só o valor `1` é aceite — o resto é recusado, não ignorado', () => {
    expect(transactionFiltersSchema.safeParse({ semCategoria: '0' }).success).toBe(false);
    expect(transactionFiltersSchema.safeParse({ semCategoria: 'true' }).success).toBe(false);
  });

  it('um clone estrito do schema aceita o objecto **completo** que a página constrói', () => {
    /*
     * O teste da armadilha, com todas as chaves que `transacoes/page.tsx` põe no
     * objecto — não duas: um caso estrito com apenas `semCategoria` e `search`
     * deixou passar `valor`/`valorOp` durante uma volta inteira.
     *
     * `strict()` é exatamente o que se faria um dia «para apanhar erros nos
     * filtros». Se alguma destas chaves não estivesse declarada, este `safeParse`
     * falhava — e o extrato perdia todos os filtros, sem um único erro à vista.
     */
    const estrito = transactionFiltersSchema.strict();

    const parsed = estrito.safeParse({
      from: '2026-11-01',
      to: '2026-11-30',
      accountId: '8b0d6f2a-4a1c-4e2f-9d3a-5f6e7c8b9a01',
      categoryId: '1f2e3d4c-5b6a-4798-8a9b-0c1d2e3f4a5b',
      kind: 'expense',
      status: 'pending',
      search: 'mercado',
      semCategoria: '1',
      valor: '100',
      valorOp: 'gt',
      limit: 25,
      offset: 50,
    });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.semCategoria).toBe('1');
    expect(parsed.success && parsed.data.valor).toBe('100');
    expect(parsed.success && parsed.data.valorOp).toBe('gt');
  });

  it('e o clone estrito recusa uma chave que não existe, com `unrecognized_keys`', () => {
    /*
     * Controlo: prova que o `strict()` do teste acima é mesmo estrito, e que a
     * recusa é por **chave desconhecida** — não por outro erro qualquer que
     * também desse `success: false`.
     */
    const estrito = transactionFiltersSchema.strict();
    const parsed = estrito.safeParse({ filtroInventado: '1' });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues.map((issue) => issue.code)).toContain('unrecognized_keys');
  });
});
