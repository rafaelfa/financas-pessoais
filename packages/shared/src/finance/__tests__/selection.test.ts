import { describe, expect, it } from 'vitest';

import { logicalCount, type SelectableRow } from '../selection';

/**
 * Testes da contagem da seleção.
 *
 * É a regra que decide o que o utilizador lê no botão — «apagar 1 lançamento»
 * quando a seleção tem duas linhas, porque são as duas pernas de uma
 * transferência. Escrita duas vezes no `apps/web`, uma em cada lado do ecrã,
 * basta que uma delas esqueça o agrupamento para o botão e a acção dizerem
 * números diferentes da mesma seleção.
 */

function linha(transferGroupId: string | null): SelectableRow {
  return { transferGroupId };
}

describe('logicalCount', () => {
  it('conta um par de transferência como uma operação', () => {
    expect(logicalCount([linha('g1'), linha('g1')])).toBe(1);
  });

  it('conta dois pares como duas operações', () => {
    expect(logicalCount([linha('g1'), linha('g1'), linha('g2'), linha('g2')])).toBe(2);
  });

  it('conta três linhas soltas como três', () => {
    expect(logicalCount([linha(null), linha(null), linha(null)])).toBe(3);
  });

  it('mistura: um par e uma solta são duas operações', () => {
    expect(logicalCount([linha('g1'), linha('g1'), linha(null)])).toBe(2);
  });

  it('um grupo com três linhas continua a ser uma operação', () => {
    // Acontece num parcelamento: as pernas de uma transferência partilham grupo.
    expect(logicalCount([linha('g1'), linha('g1'), linha('g1')])).toBe(1);
  });

  it('a seleção vazia é zero, não uma linha fantasma', () => {
    expect(logicalCount([])).toBe(0);
  });

  it('grupos diferentes nunca se somam entre si', () => {
    expect(logicalCount([linha('g1'), linha('g2'), linha(null)])).toBe(3);
  });
});
