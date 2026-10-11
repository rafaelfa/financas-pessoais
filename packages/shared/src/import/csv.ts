/**
 * Parser próprio de CSV de extratos bancários.
 *
 * -----------------------------------------------------------------------------
 * PORQUE NÃO SE USA O `csv-parse`
 * -----------------------------------------------------------------------------
 * O `csv-parse@7` está instalado e foi provado na Fase 0 (`docs/spec/T0.8-smoke-tests.md`
 * §7), mas faz metade do trabalho que aqui é preciso: lê o ficheiro, e mais
 * nada. O que falta — descobrir o separador, reconhecer cabeçalhos em português,
 * aceitar `1.234,56` e `1,234.56`, distinguir `dd/mm/aaaa` de `aaaa-mm-dd` e
 * declarar linha a linha o que não foi possível interpretar — seria código nosso
 * na mesma. Um parser de ~150 linhas sem dependências faz as duas metade e é
 * testável linha a linha. O smoke test da Fase 0 fica como contraprova do
 * dialeto original.
 *
 * -----------------------------------------------------------------------------
 * O QUE ACEITA
 * -----------------------------------------------------------------------------
 * - Separador `;` (o do Excel em pt-PT) ou `,`, detetado pela linha de cabeçalho;
 * - campos entre aspas, com `;` e mudanças de linha lá dentro, e `""` como aspa
 *   escapada;
 * - cabeçalhos em português (`Data`, `Descrição`, `Valor`, `Saldo`, `ID`) e em
 *   inglês (`Date`, `Description`, `Amount`, `Balance`, `Id`);
 * - datas `dd/mm/aaaa`, `dd-mm-aaaa`, `aaaa-mm-dd`, `dd.mm.aaaa`;
 * - valores `1.234,56` (pt-PT), `1,234.56` (en-US), `-64,37`, `(64,37)` e
 *   `+1 250,00`;
 * - linhas de comentário a começar por `#` e linhas vazias;
 * - marca de ordem de bytes (`\uFEFF`) no início do ficheiro.
 *
 * O que **não** conseguiu ser lido sai em `issues`, com o número da linha e o
 * motivo. Nada é lançado por causa do conteúdo do ficheiro.
 */

import { parseAmountToCents } from './cents';
import { type ImportIssue, toIsoCalendarDate } from './issue';

export type CsvSeparator = ';' | ',';

export interface CsvStatementRow {
  /** Data de calendário `YYYY-MM-DD`, ou `null` se não for legível. */
  readonly date: string | null;
  /** Data em bruto, para diagnóstico e para a pré-visualização. */
  readonly dateRaw: string;
  readonly description: string;
  /** Efeito assinado na conta, em cêntimos. `null` se não for legível. */
  readonly amountInCents: number | null;
  readonly amountRaw: string;
  /** Coluna `Saldo`, quando existe. */
  readonly balanceInCents: number | null;
  readonly fitId: string | null;
  /** Linha do ficheiro (1-based) de onde veio. */
  readonly line: number;
}

export interface CsvStatement {
  readonly separator: CsvSeparator;
  /** Nomes das colunas tal como estavam no ficheiro. */
  readonly headers: readonly string[];
  readonly rows: readonly CsvStatementRow[];
  /** Saldo da última linha com coluna `Saldo`, quando existe. */
  readonly lastBalanceInCents: number | null;
  readonly issues: readonly ImportIssue[];
}

/** Nomes de coluna aceites, sem acentos e em minúsculas, por campo lógico. */
const HEADER_ALIASES: Readonly<Record<string, readonly string[]>> = {
  date: ['data', 'date', 'data movimento', 'data lancamento', 'data valor', 'data operacao'],
  description: [
    'descricao',
    'description',
    'descricao do movimento',
    'historico',
    'detalhe',
    'memo',
    'movimento',
  ],
  amount: ['valor', 'amount', 'valor eur', 'montante', 'importancia', 'value'],
  balance: ['saldo', 'balance', 'saldo contabilistico', 'saldo disponivel'],
  fitId: ['id', 'fitid', 'identificador', 'referencia', 'ref', 'n documento', 'documento'],
};

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function aliasField(name: string): keyof typeof HEADER_ALIASES | null {
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(name)) {
      return field as keyof typeof HEADER_ALIASES;
    }
  }

  return null;
}

/**
 * Descobre o separador a partir do cabeçalho: o que produzir mais campos.
 *
 * Contar os campos por tokenização real (e não por `count` de caracteres) evita
 * a armadilha de uma descrição com vírgulas: `Data,Descrição,Valor` e
 * `Data;Descrição;Valor` empatavam numa contagem ingénua.
 */
export function detectSeparator(content: string): CsvSeparator {
  const headerLine = content
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .find((line) => line.trim() !== '' && !line.trimStart().startsWith('#'));

  if (headerLine === undefined) {
    return ';';
  }

  const semicolons = parseDelimited(headerLine, ';')[0]?.fields.length ?? 0;
  const commas = parseDelimited(headerLine, ',')[0]?.fields.length ?? 0;

  if (semicolons === commas) {
    // Empate: o dialeto português é o caso normal desta aplicação.
    return ';';
  }

  return semicolons > commas ? ';' : ',';
}

interface DelimitedLine {
  readonly fields: string[];
  /** Linha física onde o registo começou (o campo pode ter mudado de linha). */
  readonly startLine: number;
  /** Linha física onde o registo terminou. */
  readonly endLine: number;
}

/**
 * Tokeniza o conteúdo num separador fixo.
 *
 * Implementa o subconjunto do RFC 4180 que os extratos usam: aspas a delimitar
 * campos, `""` como aspa literal e `\n` dentro de aspas a fazer parte do campo.
 */
export function parseDelimited(content: string, separator: CsvSeparator): DelimitedLine[] {
  const text = content
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
  const lines: DelimitedLine[] = [];
  let fields: string[] = [];
  let field = '';
  let inQuotes = false;
  let startLine = 1;
  let lineNumber = 1;
  let sawContent = false;

  const commitField = (): void => {
    fields.push(field);
    field = '';
  };

  const commitLine = (): void => {
    commitField();
    lines.push({ fields, startLine, endLine: lineNumber });
    fields = [];
    startLine = lineNumber;
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index] ?? '';

    if (!inQuotes && !sawContent && (char === ' ' || char === '\t')) {
      // Espaço antes do primeiro caracter do campo é ruído de formatação.
      continue;
    }

    if (char === '"') {
      if (inQuotes && text[index + 1] === '"') {
        field += '"';
        index += 1;
        sawContent = true;
        continue;
      }

      inQuotes = !inQuotes;
      sawContent = true;
      continue;
    }

    if (char === '\n') {
      lineNumber += 1;

      if (inQuotes) {
        field += '\n';
        continue;
      }

      commitLine();
      sawContent = false;
      continue;
    }

    if (char === separator && !inQuotes) {
      commitField();
      sawContent = false;
      continue;
    }

    field += char;
    sawContent = true;
  }

  // Último registo, quando o ficheiro não termina em mudança de linha.
  if (field !== '' || fields.length > 0) {
    commitLine();
  }

  return lines;
}

/**
 * Interpreta uma data de extrato em qualquer dos formatos que os bancos usam.
 *
 * A ordem é a portuguesa (`dia/mês/ano`) porque é o dialeto desta aplicação:
 * `05/10/2026` é 5 de outubro. Quando o primeiro número passa de 12 a
 * ambiguidade desaparece por si.
 */
export function parseStatementDate(raw: string): string | null {
  const text = raw.trim().split(/[ T]/)[0] ?? '';

  if (text === '') {
    return null;
  }

  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(text);

  if (iso?.[1] !== undefined && iso[2] !== undefined && iso[3] !== undefined) {
    return toIsoCalendarDate(iso[1], iso[2], iso[3]);
  }

  const local = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/.exec(text);

  if (local?.[1] === undefined || local[2] === undefined || local[3] === undefined) {
    return null;
  }

  const year = local[3].length === 2 ? `20${local[3]}` : local[3];

  return toIsoCalendarDate(year, local[2], local[1]);
}

function pick(
  fields: readonly string[],
  index: ReadonlyMap<keyof typeof HEADER_ALIASES, number>,
  field: keyof typeof HEADER_ALIASES,
): string {
  const position = index.get(field);

  return position === undefined ? '' : (fields[position] ?? '').trim();
}

/**
 * Interpreta um extrato CSV.
 *
 * Quando não reconhece um cabeçalho, cai no posicional (`Data`, `Descrição`,
 * `Valor`, `Saldo`) e **di-lo** em `issues`: assumir colunas em silêncio é a
 * maneira mais rápida de trocar datas com valores.
 */
export function parseCsvDocument(content: string): CsvStatement {
  const issues: ImportIssue[] = [];

  if (typeof content !== 'string' || content.trim() === '') {
    return {
      separator: ';',
      headers: [],
      rows: [],
      lastBalanceInCents: null,
      issues: [{ line: 1, field: 'documento', message: 'O ficheiro está vazio.' }],
    };
  }

  const separator = detectSeparator(content);
  const lines = parseDelimited(content, separator);

  // Comentários e linhas vazias não contam como registos.
  const records = lines.filter((line) => {
    const first = (line.fields[0] ?? '').trim();

    return first !== '' || line.fields.length > 1;
  });

  const dataRecords = records.filter((line) => !(line.fields[0] ?? '').trimStart().startsWith('#'));

  if (dataRecords.length === 0) {
    return {
      separator,
      headers: [],
      rows: [],
      lastBalanceInCents: null,
      issues: [{ line: 1, field: 'documento', message: 'O ficheiro não tem linhas de dados.' }],
    };
  }

  const headerRecord = dataRecords[0];

  if (headerRecord === undefined) {
    return {
      separator,
      headers: [],
      rows: [],
      lastBalanceInCents: null,
      issues: [{ line: 1, field: 'documento', message: 'O ficheiro não tem linhas de dados.' }],
    };
  }

  const headers = headerRecord.fields.map((value) => value.trim());
  const columnIndex = new Map<keyof typeof HEADER_ALIASES, number>();

  headers.forEach((header, position) => {
    const field = aliasField(normalizeHeader(header));

    if (field !== null && !columnIndex.has(field)) {
      columnIndex.set(field, position);
    }
  });

  const hasNamedAmount = columnIndex.has('amount');
  const hasNamedDate = columnIndex.has('date');
  const positionFallback = !hasNamedDate || !hasNamedAmount;

  if (positionFallback) {
    columnIndex.clear();
    columnIndex.set('date', 0);
    columnIndex.set('description', 1);
    columnIndex.set('amount', 2);
    columnIndex.set('balance', 3);

    issues.push({
      line: headerRecord.startLine,
      field: 'cabeçalho',
      message:
        `Não reconheci todas as colunas em "${headers.join(separator)}"; ` +
        'assumi a ordem Data, Descrição, Valor, Saldo. Confirma a pré-visualização.',
    });
  }

  const rows: CsvStatementRow[] = [];

  for (const record of dataRecords.slice(1)) {
    const dateRaw = pick(record.fields, columnIndex, 'date');
    const amountRaw = pick(record.fields, columnIndex, 'amount');
    const balanceRaw = pick(record.fields, columnIndex, 'balance');
    const fitIdRaw = pick(record.fields, columnIndex, 'fitId');
    const descriptionParts = [
      pick(record.fields, columnIndex, 'description'),
      ...(positionFallback ? [] : extraDescriptionFields(record.fields, columnIndex)),
    ].filter((part) => part !== '');

    const date = parseStatementDate(dateRaw);
    const amountInCents = amountRaw === '' ? null : parseAmountToCents(amountRaw);
    const balanceInCents = balanceRaw === '' ? null : parseAmountToCents(balanceRaw);

    if (dateRaw === '') {
      issues.push({
        line: record.startLine,
        field: 'Data',
        message: 'Linha sem data.',
      });
    } else if (date === null) {
      issues.push({
        line: record.startLine,
        field: 'Data',
        message: `Data ilegível: "${dateRaw}".`,
      });
    }

    if (amountRaw === '') {
      issues.push({
        line: record.startLine,
        field: 'Valor',
        message: 'Linha sem valor.',
      });
    } else if (amountInCents === null) {
      issues.push({
        line: record.startLine,
        field: 'Valor',
        message: `Valor ilegível: "${amountRaw}".`,
      });
    }

    if (balanceRaw !== '' && balanceInCents === null) {
      issues.push({
        line: record.startLine,
        field: 'Saldo',
        message: `Saldo ilegível: "${balanceRaw}".`,
      });
    }

    rows.push({
      date,
      dateRaw,
      // Sem descrição não se inventa uma: o lançamento fica com texto vazio e a
      // pré-visualização mostra-o como uma linha a rever.
      description: descriptionParts.join(' — '),
      amountInCents,
      amountRaw,
      balanceInCents,
      fitId: fitIdRaw === '' ? null : fitIdRaw,
      line: record.startLine,
    });
  }

  const lastWithBalance = [...rows].reverse().find((row) => row.balanceInCents !== null);

  return {
    separator,
    headers,
    rows,
    lastBalanceInCents: lastWithBalance?.balanceInCents ?? null,
    issues,
  };
}

/**
 * Colunas extra entre a descrição e o valor: alguns bancos partem a descrição em
 * duas (`Descrição` + `Histórico`). Concatenam-se em vez de se perderem, porque
 * é a descrição que as regras de categorização procuram.
 */
function extraDescriptionFields(
  fields: readonly string[],
  columnIndex: ReadonlyMap<keyof typeof HEADER_ALIASES, number>,
): string[] {
  const known = new Set(columnIndex.values());
  const amountPosition = columnIndex.get('amount') ?? fields.length;
  const descriptionPosition = columnIndex.get('description') ?? 1;
  const extras: string[] = [];

  for (let position = descriptionPosition + 1; position < amountPosition; position += 1) {
    if (known.has(position)) {
      continue;
    }

    const value = (fields[position] ?? '').trim();

    if (value !== '') {
      extras.push(value);
    }
  }

  return extras;
}

/**
 * Formato do CSV de exportação/importação, documentado num sítio só.
 *
 * O separador é `;` porque é o que o Excel em pt-PT espera, e o cabeçalho tem os
 * nomes que o parser reconhece — é isto que garante que exportar e reimportar
 * fecha o ciclo, incluindo o `Id` (que vira `fitId` e impede duplicados).
 */
export const CSV_EXPORT_HEADERS = ['Data', 'Descrição', 'Valor', 'Saldo', 'Id'] as const;

/** Escapa uma célula: aspas quando o texto tem separador, aspas ou mudança de linha. */
export function escapeCsvCell(value: string): string {
  return /[";\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/**
 * Junta linhas de CSV com o separador `;`, terminando cada uma com `\r\n` e
 * começando com marca de ordem de bytes — sem ela, o Excel em pt-PT mostra
 * "DescriÃ§Ã£o".
 */
export function serializeCsv(rows: readonly (readonly string[])[], withBom = true): string {
  const body = rows.map((row) => row.map(escapeCsvCell).join(';')).join('\r\n');

  return `${withBom ? '\uFEFF' : ''}${body}\r\n`;
}
