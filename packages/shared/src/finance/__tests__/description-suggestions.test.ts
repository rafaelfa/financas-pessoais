import { describe, expect, it } from 'vitest';

import {
  DESCRIPTION_SUGGESTION_LIMIT,
  filterDescriptionSuggestions,
  rankDescriptionSuggestions,
  type DescriptionUsage,
} from '../description-suggestions';

const HISTORICO: DescriptionUsage[] = [
  { description: 'Continente', uses: 9 },
  { description: 'continente', uses: 2 },
  { description: 'Pingo Doce', uses: 4 },
  { description: 'Padaria', uses: 4 },
];

describe('sugestões de descrição — filtro', () => {
  it('apanha as variantes de maiúsculas sem mudar a ordem recebida', () => {
    expect(filterDescriptionSuggestions(HISTORICO, 'cont').map((e) => e.description)).toEqual([
      'Continente',
      'continente',
    ]);
  });

  it('texto vazio devolve tudo', () => {
    expect(filterDescriptionSuggestions(HISTORICO, '')).toHaveLength(4);
    expect(filterDescriptionSuggestions(HISTORICO, '   ')).toHaveLength(4);
  });

  it('sem correspondência devolve vazio, e não tudo', () => {
    expect(filterDescriptionSuggestions(HISTORICO, 'zzz')).toEqual([]);
  });

  it('não promete insensibilidade a acentos', () => {
    const comAcento: DescriptionUsage[] = [{ description: 'Café', uses: 1 }];

    expect(filterDescriptionSuggestions(comAcento, 'cafe')).toEqual([]);
    expect(filterDescriptionSuggestions(comAcento, 'caf')).toHaveLength(1);
  });
});

describe('sugestões de descrição — ordem', () => {
  it('mais usadas primeiro e, em empate, alfabética', () => {
    expect(rankDescriptionSuggestions(HISTORICO).map((e) => e.description)).toEqual([
      'Continente',
      'Padaria',
      'Pingo Doce',
      'continente',
    ]);
  });

  it('duas leituras seguidas dão a mesma ordem', () => {
    const primeira = rankDescriptionSuggestions(HISTORICO);
    const segunda = rankDescriptionSuggestions([...HISTORICO].reverse());

    expect(segunda).toEqual(primeira);
  });

  it('corta em 50 por omissão e aceita outro limite', () => {
    const muitos: DescriptionUsage[] = Array.from({ length: 60 }, (_, i) => ({
      description: `Compra ${String(i).padStart(2, '0')}`,
      uses: 1,
    }));

    const cortado = rankDescriptionSuggestions(muitos);

    expect(cortado).toHaveLength(DESCRIPTION_SUGGESTION_LIMIT);
    expect(cortado[0]?.description).toBe('Compra 00');
    expect(cortado[49]?.description).toBe('Compra 49');
    expect(rankDescriptionSuggestions(muitos, { limit: 3 })).toHaveLength(3);
  });

  it('descarta descrições vazias ou só com espaços', () => {
    const comBrancos: DescriptionUsage[] = [
      { description: '', uses: 9 },
      { description: '   ', uses: 8 },
      { description: 'Continente', uses: 1 },
    ];

    expect(rankDescriptionSuggestions(comBrancos)).toEqual([
      { description: 'Continente', uses: 1 },
    ]);
  });

  it('lista vazia devolve vazio', () => {
    expect(rankDescriptionSuggestions([])).toEqual([]);
  });
});
