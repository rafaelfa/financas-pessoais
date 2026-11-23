/**
 * Cor de uma categoria, pela **posição** na lista canónica, sem colisões no ecrã
 * (T107, volta 6).
 *
 * A lista canónica é a das categorias não arquivadas, ordenada como em
 * `server/categories.ts` (`kind`, `sortOrder`, `name`). A posição na lista,
 * módulo oito, é a **base** da cor de cada categoria — a ordem em que o
 * utilizador vê as categorias, não o resultado de um hash.
 *
 * A base não chega: com 29 categorias, as oito que têm despesa num mês podem
 * calhar em posições cuja base repete (`8 % 8 = 0`, `9 % 8 = 1`, `15 % 8 = 7`),
 * e o donut mostrava cinco cores em oito fatias. Por isso quem pinta pede o
 * **mapa do ecrã**: `categoryColourMap(nomesPintados, nomesCanónicos)` processa
 * os nomes pintados por ordem canónica (os que não estão na lista, como uma
 * categoria arquivada ou «Outras (N)», no fim, por ordem alfabética), dá a cada
 * um a sua base e, se a base já estiver tomada, a primeira cor livre seguinte,
 * ciclicamente. O mesmo conjunto pintado dá sempre o mesmo mapa; arquivar uma
 * categoria desloca as posições seguintes, e com elas as cores.
 *
 * Nome fora da lista usa o hash do próprio nome como base; o nome entra na mesma
 * resolução de colisões, por isso nunca sai igual a uma cor já pintada no ecrã.
 * «Sem categoria» não é uma categoria: não leva ponto nem ocupa cor.
 *
 * Os valores são `var(--chart-N)` e não classes `bg-chart-N`: há oito séries no
 * tema, mas só as cinco primeiras estão no `@theme inline` — `bg-chart-6..8` não
 * existem como utilitários. Um valor CSS serve o ponto (por `style`) e a fatia
 * do donut (por `fill`) com o **mesmo** mapa, e sem tocar no tema.
 */
export const CATEGORY_COLOURS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
  'var(--chart-8)',
] as const;

/** Nome das fatias sem categoria: existe no extrato, não é uma categoria. */
export const UNCATEGORISED_NAME = 'Sem categoria';

export function isUncategorised(name: string): boolean {
  return name === UNCATEGORISED_NAME;
}

/**
 * Mapa `nome → var(--chart-N)` das categorias pintadas num ecrã, já sem colisões
 * enquanto houver cor livre (com mais de oito nomes, a nona repete).
 *
 * `paintedNames` são os nomes que aquele ecrã desenha — as linhas da tabela, os
 * limites, as fatias do donut. A ordem de entrada não influencia o resultado: os
 * nomes são ordenados pela posição canónica e, os de fora, alfabeticamente.
 */
export function categoryColourMap(
  paintedNames: Iterable<string>,
  orderedNames: readonly string[],
): Readonly<Record<string, string>> {
  const positionByName = new Map<string, number>();

  orderedNames.forEach((name, position) => {
    if (!positionByName.has(name)) {
      positionByName.set(name, position);
    }
  });

  const unique = new Set<string>();

  for (const name of paintedNames) {
    if (!isUncategorised(name)) {
      unique.add(name);
    }
  }

  const entries = [...unique].map((name) => ({
    name,
    position: positionByName.get(name) ?? null,
  }));

  entries.sort((left, right) => {
    if (left.position === null && right.position === null) {
      return compareNames(left.name, right.name);
    }

    if (left.position === null) {
      return 1;
    }

    if (right.position === null) {
      return -1;
    }

    return left.position - right.position;
  });

  const taken = new Set<number>();
  const colours: Record<string, string> = {};

  for (const entry of entries) {
    const base =
      entry.position === null
        ? hashColourIndex(entry.name)
        : entry.position % CATEGORY_COLOURS.length;
    const index = firstFreeIndex(base, taken);

    taken.add(index);
    colours[entry.name] = CATEGORY_COLOURS[index] ?? CATEGORY_COLOURS[0];
  }

  return colours;
}

/** Primeira cor livre a partir da base, ciclicamente; sem livre, fica a base. */
function firstFreeIndex(base: number, taken: ReadonlySet<number>): number {
  if (!taken.has(base)) {
    return base;
  }

  for (let offset = 1; offset < CATEGORY_COLOURS.length; offset += 1) {
    const candidate = (base + offset) % CATEGORY_COLOURS.length;

    if (!taken.has(candidate)) {
      return candidate;
    }
  }

  return base;
}

/**
 * Ordem alfabética por unidades de código.
 *
 * `localeCompare` depende do ICU da máquina e da versão do Node; a cor não pode
 * mudar entre o servidor e o browser por causa disso.
 */
function compareNames(left: string, right: string): number {
  if (left === right) {
    return 0;
  }

  return left < right ? -1 : 1;
}

/** Hash estável do nome, para os nomes que não estão na lista canónica. */
function hashColourIndex(name: string): number {
  let hash = 0;

  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) % 1_000_003;
  }

  return hash % CATEGORY_COLOURS.length;
}
