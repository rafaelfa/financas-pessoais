import { describe, expect, it } from 'vitest';

/**
 * Mapa de cores de categoria (T107, vol. 6).
 *
 * O helper vive em `apps/web/src/lib/category-colour.ts` e é importado pelo
 * alias do `vitest.config.ts`, como o `import-confirm.test.ts`: o `tsc` deste
 * pacote não segue o caminho (`rootDir`), mas o Vitest resolve-o e o
 * `typecheck` de `apps/web` verifica o ficheiro. A interface abaixo é
 * estrutural, para o teste não depender do tipo que o `tsc` não vê.
 *
 * Os testes chamam `categoryColourMap` — a função que os quatro ecrãs usam. Um
 * teste sobre a base da cor não apanhava a regressão que interessa: se a
 * resolução de colisões voltasse a devolver a base tomada, o donut repetia cores
 * e a suite continuava verde.
 */
const MODULE_PATH = '@/lib/category-colour';

interface CategoryColourModule {
  readonly CATEGORY_COLOURS: readonly string[];
  categoryColourMap(
    paintedNames: Iterable<string>,
    orderedNames: readonly string[],
  ): Readonly<Record<string, string>>;
  isUncategorised(name: string): boolean;
}

const { CATEGORY_COLOURS, categoryColourMap, isUncategorised } = (await import(
  MODULE_PATH
)) as CategoryColourModule;

/** A lista canónica real: despesas por `sortOrder`/nome e depois os ganhos. */
const NAMES = [
  'Habitação',
  'Alimentação',
  'Restauração',
  'Transportes',
  'Combustível',
  'Água, luz e gás',
  'Telecomunicações',
  'Saúde',
  'Educação',
  'Lazer',
  'Subscrições',
  'Seguros',
  'Impostos',
  'Vestuário',
  'Casa',
  'Animais',
  'Outros',
  'Transferência',
  'Fatura de cartão',
  'Ajuste de saldo',
  'Investimento',
  'Salário',
  'Rendimento variável',
  'Rendimento de investimentos',
  'Prendas',
  'Prémios',
  'Reembolsos',
  'Cashback',
  'Outras entradas',
];

const at = (positions: readonly number[]) => positions.map((position) => NAMES[position]!);
const distinct = (map: Readonly<Record<string, string>>) => new Set(Object.values(map)).size;

describe('mapa de cores por ecrã', () => {
  it('a cor sai da posição canónica, e a mesma categoria muda de cor com outra posição', () => {
    const map = categoryColourMap(at([1, 3]), NAMES);
    const withoutFirst = NAMES.filter((name) => name !== 'Habitação');
    const moved = categoryColourMap(['Alimentação'], withoutFirst);

    expect(map['Alimentação']).toBe(CATEGORY_COLOURS[1]);
    expect(map['Transportes']).toBe(CATEGORY_COLOURS[3]);
    expect(moved['Alimentação']).toBe(CATEGORY_COLOURS[0]);
  });

  it('acima de oito nomes repete: a nona fica na base da primeira cor', () => {
    const map = categoryColourMap(at([0, 1, 2, 3, 4, 5, 6, 7, 8]), NAMES);

    expect(NAMES).toHaveLength(29);
    expect(distinct(map)).toBe(8);
    expect(new Set(CATEGORY_COLOURS).size).toBe(8);
    expect(map['Educação']).toBe(map['Habitação']);
    expect(map['Educação']).toBe(CATEGORY_COLOURS[0]);
  });

  it('uma colisão resolve para a próxima cor livre', () => {
    const positions = [0, 1, 3, 7, 8, 9, 13, 15];
    const map = categoryColourMap(at(positions), NAMES);

    /* É o cenário do QA: oito fatias com as oito primeiras posições diferentes. */
    expect(distinct(map)).toBe(8);
    expect(map['Habitação']).not.toBe(map['Educação']);
  });

  it('o mapa não depende da ordem da entrada', () => {
    const positions = [0, 1, 3, 7, 8, 9, 13, 15];
    const ordered = categoryColourMap(at(positions), NAMES);
    const shuffled = categoryColourMap(at([...positions].reverse()), NAMES);

    expect(shuffled).toEqual(ordered);
  });

  it('um nome fora da lista entra na mesma resolução de colisões', () => {
    const withoutArchived = NAMES.filter((name) => name !== 'Animais');
    const map = categoryColourMap([...at([0, 1, 3, 7, 8, 9, 13]), 'Animais'], withoutArchived);

    /* Animais cai no hash, cuja base é a de Saúde; tem de desviar, não repetir. */
    expect(map['Animais']).toBeDefined();
    expect(map['Animais']).not.toBe(map['Saúde']);
    expect(distinct(map)).toBe(8);
  });

  it('«Sem categoria» é reconhecida e não ocupa cor', () => {
    const map = categoryColourMap([...at([0, 1]), 'Sem categoria'], NAMES);

    expect(isUncategorised('Sem categoria')).toBe(true);
    expect(isUncategorised('Habitação')).toBe(false);
    expect(Object.keys(map)).not.toContain('Sem categoria');
    expect(distinct(map)).toBe(2);
  });
});
