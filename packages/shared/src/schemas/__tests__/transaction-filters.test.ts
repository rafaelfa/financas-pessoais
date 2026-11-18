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

  it('só o valor `1` vale como filtro; o resto cai sem rebentar o resto', () => {
    /*
     * Muda em relação à T64: antes este teste exigia que `'0'` e `'true'` fossem
     * **recusados** (o `safeParse` falhava). Com a degradação por campo (T66), o
     * que acontece é o que se quer de um filtro vindo do URL: o valor inválido é
     * ignorado — como a normalização da página já fazia — em vez de derrubar tudo.
     */
    for (const invalido of ['0', 'true']) {
      const parsed = transactionFiltersSchema.safeParse({ semCategoria: invalido });

      expect(parsed.success).toBe(true);
      expect(parsed.success && parsed.data.semCategoria).toBeUndefined();
    }

    const valido = transactionFiltersSchema.safeParse({ semCategoria: '1' });

    expect(valido.success && valido.data.semCategoria).toBe('1');
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

describe('um valor inválido cai só ele', () => {
  /*
   * O sintoma que isto impede: `?semCategoria=true&search=mercado` devolvia a
   * lista sem filtro nenhum, porque o `safeParse` do objecto inteiro falhava e
   * quem chamava caía para `{ limit, offset }`. O campo inválido tem de cair
   * sozinho e os válidos têm de seguir.
   */

  it('`semCategoria` inválido não leva o `search` com ele', () => {
    const parsed = transactionFiltersSchema.safeParse({
      semCategoria: 'true',
      search: 'mercado',
    });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.search).toBe('mercado');
    expect(parsed.success && parsed.data.semCategoria).toBeUndefined();
  });

  it('`semCategoria` inválido e sozinho dá o resto por omissão', () => {
    const parsed = transactionFiltersSchema.safeParse({ semCategoria: 'true' });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.semCategoria).toBeUndefined();
    expect(parsed.success && parsed.data.limit).toBe(50);
  });

  it('`limit` inválido não derruba os outros filtros', () => {
    const parsed = transactionFiltersSchema.safeParse({ limit: 'abc', search: 'mercado' });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.limit).toBe(50);
    expect(parsed.success && parsed.data.search).toBe('mercado');
  });

  it('`kind` inválido não leva o `status` com ele', () => {
    const parsed = transactionFiltersSchema.safeParse({ kind: 'inventado', status: 'pending' });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.kind).toBeUndefined();
    expect(parsed.success && parsed.data.status).toBe('pending');
  });

  it('vários inválidos ao mesmo tempo: cai cada um, os válidos ficam', () => {
    const parsed = transactionFiltersSchema.safeParse({
      from: '2026-13-45',
      limit: 'muitos',
      search: 'mercado',
      semCategoria: 'sim',
    });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.from).toBeUndefined();
    expect(parsed.success && parsed.data.limit).toBe(50);
    expect(parsed.success && parsed.data.search).toBe('mercado');
    expect(parsed.success && parsed.data.semCategoria).toBeUndefined();
  });
});
