/**
 * Pré-visualização de importação: transforma o que os parsers leram numa lista
 * de linhas com estado, **sem tocar na base de dados**.
 *
 * É aqui que vive a decisão mais importante da importação: nada é gravado antes
 * de a pessoa ver o que vai entrar. Um extrato errado propaga-se a todos os
 * saldos do mês, e desfazer uma importação a meio é pior do que a não fazer.
 *
 * Regras:
 * - `duplicate`: o `fitId` já existe nesta conta, ou (sem `fitId`) a impressão
 *   digital `data + valor + descrição` já existe. Desmarcado por omissão.
 * - `suspicious`: sem data ou sem valor legível. Desmarcado por omissão — não se
 *   grava um lançamento de valor desconhecido.
 * - `new`: tudo o resto, marcado. A sugestão de categoria vem do motor de regras
 *   (`classifyTransaction`), nunca de uma heurística nova.
 */

import { classifyTransaction } from '../finance/rules';
import type { FinanceTransaction, FinanceTransactionRule, TransactionKind } from '../finance/types';
import type { importFormatSchema, importRowStatusSchema } from '../schemas/domain/import';
import { type ImportIssue, normalizeForMatch } from './issue';
import type { OfxStatement, OfxStatementTransaction } from './ofx';
import type { CsvStatement, CsvStatementRow } from './csv';

/**
 * O formato e os estados são derivados do schema Zod partilhado, não literais
 * paralelos.
 *
 * Assim a interface (que valida pelo schema) e o parser (que produz estes
 * valores) não podem divergir: acrescentar um estado ao schema é imediatamente
 * visível aqui, e remover um faz o `typecheck` falhar em vez de deixar um valor
 * que nunca é produzido — ou, pior, um valor produzido que a validação rejeita.
 */
export type ImportFormat = ReturnType<typeof importFormatSchema.parse>;
export type ImportRowStatus = ReturnType<typeof importRowStatusSchema.parse>;

export interface ImportRow {
  /** Posição na lista, a começar em 0. É o que o cliente devolve ao confirmar. */
  readonly index: number;
  readonly date: string | null;
  readonly description: string;
  readonly amountInCents: number | null;
  readonly fitId: string | null;
  readonly status: ImportRowStatus;
  readonly reason: string | null;
  /** Por omissão só as linhas `new` vêm marcadas. */
  readonly selected: boolean;
  readonly suggestedCategoryId: string | null;
  readonly suggestedCategoryName: string | null;
  /** Linha do ficheiro de origem, para a pré-visualização apontar o problema. */
  readonly sourceLine: number;
}

export interface ImportPreviewBase {
  readonly rows: readonly ImportRow[];
  readonly newCount: number;
  readonly duplicateCount: number;
  readonly suspiciousCount: number;
  readonly totalDebitsInCents: number;
  readonly totalCreditsInCents: number;
  readonly impliedEndBalanceInCents: number | null;
  readonly warnings: readonly string[];
  readonly issues: readonly ImportIssue[];
}

export interface ExistingTransactionFingerprint {
  readonly fitId: string | null;
  readonly date: Date;
  readonly amountInCents: number;
  readonly description: string | null;
}

export interface PreviewAccount {
  readonly id: string;
  readonly openingBalanceInCents: number;
  readonly balanceInCents: number | null;
  readonly name: string;
}

export interface PreviewCategory {
  readonly id: string;
  readonly name: string;
  readonly isInternal: boolean;
}

export interface PreviewRules {
  readonly rules: readonly FinanceTransactionRule[];
  readonly categoryNames: ReadonlyMap<string, string>;
}

/** `YYYY-MM-DD` de um `Date` guardado à meia-noite UTC. */
function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Comprimento máximo de um identificador de importação.
 *
 * É o limite da coluna `fitId` e o contrato entre a pré-visualização, a
 * confirmação e a exportação: as três derivam o mesmo identificador para a mesma
 * linha, e um identificador cortado num sítio e não no outro faria a linha
 * voltar a entrar na reimportação.
 */
const MAX_IDENTIFIER_LENGTH = 80;

/**
 * Impressão digital de um lançamento.
 *
 * A chave é `data + valor + descrição normalizada`, a mesma tripla que o resto da
 * aplicação usa para reconhecer duplicados, com um prefixo de versão (`imp1|`).
 * O prefixo não é decorativo: esta cadeia é **gravada** como identificador de
 * importação (ver `importFitId`), e uma alteração à fórmula passaria a chocar com
 * os identificadores já gravados. Com a versão à frente, uma mudança futura usa
 * `imp2|` e convive com o que existe, em vez de reescrever o passado.
 *
 * O comprimento fica dentro do limite do identificador (80 caracteres), que é o
 * mesmo limite que `importFitId` aplica. O orçamento da descrição é **calculado**,
 * e não fixado: o prefixo já gasta `imp1|` mais a data (10) mais o valor, pelo
 * que uma descrição truncada a 60 dava 81 caracteres — o defeito que o teste
 * apanhou. A data e o valor ficam inteiros (são a parte que distingue dois
 * movimentos no mesmo dia); quem cede é a descrição.
 */
export function fingerprintOf(
  date: string | null,
  amountInCents: number | null,
  description: string,
): string | null {
  if (date === null || amountInCents === null) {
    return null;
  }

  const fixed = `imp1|${date}|${String(amountInCents)}|`;
  const budget = Math.max(0, MAX_IDENTIFIER_LENGTH - fixed.length);

  return `${fixed}${normalizeForMatch(description).slice(0, budget)}`;
}

/**
 * Identificador de importação de uma linha, para a coluna `fitId`.
 *
 * Quando o ficheiro traz o identificador do banco (`FITID` de OFX, coluna `Id` de
 * CSV), é esse que manda: é a identidade do movimento no banco, e é o que a
 * restrição única `@@unique([financialAccountId, fitId])` protege.
 *
 * Quando não traz — o caso comum de um CSV — deriva-se da impressão digital. Isto
 * não é cosmético: sem identificador, a única defesa contra duplicados era uma
 * **leitura** feita antes da escrita, e dois pedidos em paralelo passavam os dois.
 * Com identificador derivado, quem decide é a restrição única da base de dados, e
 * o segundo pedido é recusado em vez de duplicar o extrato.
 *
 * A repetição dentro do mesmo ficheiro recebe um sufixo (`:2`, `:3`, …): dois
 * cafés iguais no mesmo dia são dois movimentos e têm de poder coexistir, mas
 * continuam a ser reconhecidos como já importados quando o mesmo ficheiro volta.
 */
export function importFitId(
  fitId: string | null,
  date: string | null,
  amountInCents: number | null,
  description: string,
  occurrence = 1,
): string | null {
  const external = fitId?.trim() ?? '';

  if (external !== '') {
    return external.slice(0, MAX_IDENTIFIER_LENGTH);
  }

  const fingerprint = fingerprintOf(date, amountInCents, description);

  if (fingerprint === null) {
    return null;
  }

  return occurrence <= 1
    ? fingerprint
    : `${fingerprint}:${String(occurrence)}`.slice(0, MAX_IDENTIFIER_LENGTH);
}

/**
 * Calcula os identificadores de importação de uma lista de linhas.
 *
 * A numeração de repetição é feita **sobre a lista completa, pela ordem do
 * ficheiro**, e não linha a linha: é isso que faz com que a pré-visualização e a
 * confirmação cheguem ao mesmo identificador para a mesma linha. Se cada uma
 * numerasse por sua conta, a segunda passagem (após uma importação parcial) daria
 * identificadores diferentes e a linha voltaria a entrar.
 */
export function withImportIdentifiers<T extends ImportRowCandidate>(
  rows: readonly T[],
): (T & { readonly derivedFitId: string | null })[] {
  const counts = new Map<string, number>();

  return rows.map((row) => {
    const fingerprint = fingerprintOf(row.date, row.amountInCents, row.description);
    let occurrence = 1;

    if (fingerprint !== null) {
      occurrence = (counts.get(fingerprint) ?? 0) + 1;
      counts.set(fingerprint, occurrence);
    }

    return {
      ...row,
      derivedFitId: importFitId(
        row.fitId,
        row.date,
        row.amountInCents,
        row.description,
        occurrence,
      ),
    };
  });
}

/** O mínimo que uma linha precisa para receber um identificador. */
export interface ImportRowCandidate {
  readonly date: string | null;
  readonly amountInCents: number | null;
  readonly description: string;
  readonly fitId: string | null;
}

/**
 * Indexa o que já existe na conta, pelo identificador de importação.
 *
 * A chave é o `fitId` gravado. Para linhas gravadas **antes** desta versão (sem
 * `fitId`, ou de importações antigas), acrescenta-se a impressão digital como
 * chave alternativa: sem isso, os movimentos importados antes da correção
 * deixariam de ser reconhecidos e voltariam a entrar na primeira reimportação.
 *
 * **A ocorrência também é indexada — contando.** Duas linhas iguais no mesmo
 * ficheiro (dois cafés iguais no mesmo dia) recebem `impressão` e `impressão:2`, e
 * é isso que a exportação escreve na coluna `Id`. Indexar só a impressão base
 * deixava passar duas situações distintas, ambas medidas pelo `qa-verificador`:
 *
 * - o `:2` **gravado** (segunda volta do ciclo exportar → reimportar) — aqui a
 *   chave existe, mas nenhuma linha a usava como chave primária;
 * - o `:2` **do ficheiro** quando na conta há movimentos **manuais** iguais, sem
 *   `fitId` (primeira volta do ciclo) — aqui não havia nada com sufixo nenhum.
 *
 * Por isso conta-se quantos movimentos existem com a mesma impressão base e
 * indexa-se `impressão:1..impressão:N`. Uma conta com **um** café e um ficheiro
 * com dois continua a marcar o segundo como novo (é mesmo um movimento novo); uma
 * conta com dois cafés iguais marca os dois como já existentes. A contagem é a
 * mesma dos dois lados: `withImportIdentifiers` numera as ocorrências do ficheiro
 * pela mesma ordem.
 */
function indexExisting(existing: readonly ExistingTransactionFingerprint[]): {
  readonly fitIds: Set<string>;
  readonly rows: Map<string, ExistingTransactionFingerprint>;
} {
  const fitIds = new Set<string>();
  const rows = new Map<string, ExistingTransactionFingerprint>();
  const occurrences = new Map<string, number>();
  /** Linha representativa de cada impressão, para as chaves com sufixo. */
  const sample = new Map<string, ExistingTransactionFingerprint>();
  const counts = new Map<string, number>();

  for (const row of existing) {
    if (row.fitId !== null && row.fitId !== '') {
      fitIds.add(row.fitId);
      rows.set(row.fitId, row);
    }

    const derived = importFitId(null, isoDate(row.date), row.amountInCents, row.description ?? '');

    if (derived === null) {
      continue;
    }

    const occurrence = (counts.get(derived) ?? 0) + 1;
    counts.set(derived, occurrence);
    occurrences.set(derived, occurrence);

    /*
     * A chave base entra aqui, e não no segundo passo: uma impressão que aparece
     * **uma só vez** não tem sufixo nenhum, e o ciclo do segundo passo (que
     * começa em 2) nunca a acrescentaria. Sem esta linha, o duplicado simples —
     * o caso mais comum de todos — deixava de ser reconhecido.
     */
    fitIds.add(derived);

    if (!rows.has(derived)) {
      rows.set(derived, row);
    }

    if (!sample.has(derived)) {
      sample.set(derived, row);
    }
  }

  /*
   * Segundo passo, sobre a contagem final: acrescenta as ocorrências `:2..:N`. A
   * contagem só está completa no fim, por isso uma linha que apareça primeiro não
   * pode decidir o número de ocorrências por si.
   */
  for (const [derived, occurrence] of occurrences) {
    for (let index = 2; index <= occurrence; index += 1) {
      const id = `${derived}:${String(index)}`;

      fitIds.add(id);

      if (!rows.has(id)) {
        const representative = sample.get(derived);

        if (representative !== undefined) {
          rows.set(id, representative);
        }
      }
    }
  }

  return { fitIds, rows };
}

/**
 * Frase que explica que o identificador existe com outro valor, ou `null` quando
 * os valores coincidem.
 */
function divergenceOf(
  existing: ExistingTransactionFingerprint | undefined,
  raw: { readonly date: string | null; readonly amountInCents: number | null },
): string | null {
  if (existing === undefined || raw.amountInCents === null || raw.date === null) {
    return null;
  }

  const existingDate = isoDate(existing.date);
  const sameAmount = existing.amountInCents === raw.amountInCents;
  const sameDate = existingDate === raw.date;

  if (sameAmount && sameDate) {
    return null;
  }

  /*
   * Formatação só para leitura humana. Não usa `formatCurrency` de propósito:
   * aquele formata em `pt-PT` pelo `Intl` do runtime, e uma mensagem de aviso não
   * pode mudar de texto conforme o ambiente onde a pré-visualização corre — o
   * `Intl` do Node e o do browser dão separadores diferentes para o mesmo valor.
   */
  const format = (cents: number): string => {
    const magnitude = Math.abs(cents);
    const integer = String(Math.floor(magnitude / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const decimals = String(magnitude % 100).padStart(2, '0');

    return `${cents < 0 ? '-' : ''}${integer},${decimals} €`;
  };

  const differences: string[] = [];

  if (!sameAmount) {
    differences.push(
      `no ficheiro vem ${format(raw.amountInCents)} e na aplicação está ${format(existing.amountInCents)}`,
    );
  }

  if (!sameDate) {
    differences.push(`no ficheiro vem ${raw.date} e na aplicação está ${existingDate}`);
  }

  return (
    `Já existe nesta conta um movimento com o mesmo identificador do banco, mas ${differences.join('; ')}. ` +
    'Confirma qual é o certo antes de importar: este movimento não foi gravado.'
  );
}

/**
 * Sugere uma categoria para uma linha, usando **o mesmo** motor de regras que a
 * página de regras usa.
 *
 * O tipo da transação decide-se pelo sinal: uma saída é um gasto, uma entrada é
 * um ganho. As regras só se aplicam a esses dois tipos, portanto uma linha sem
 * categoria (ou com valor zero) não recebe sugestão.
 */
function suggest(
  row: {
    readonly date: string | null;
    readonly amountInCents: number | null;
    readonly description: string;
  },
  accountId: string,
  index: number,
  rules: PreviewRules,
): { readonly id: string; readonly name: string } | null {
  if (row.date === null || row.amountInCents === null || row.amountInCents === 0) {
    return null;
  }

  if (rules.rules.length === 0) {
    return null;
  }

  const kind: TransactionKind = row.amountInCents < 0 ? 'expense' : 'income';
  const transaction: FinanceTransaction = {
    id: `import-${String(index)}`,
    kind,
    status: 'confirmed',
    amountInCents: row.amountInCents,
    date: row.date,
    description: row.description,
    accountId,
    settled: false,
  };

  const match = classifyTransaction(transaction, rules.rules);

  if (match === null) {
    return null;
  }

  return {
    id: match.categoryId,
    name: rules.categoryNames.get(match.categoryId) ?? 'Categoria',
  };
}

interface RawRow {
  readonly date: string | null;
  readonly description: string;
  readonly amountInCents: number | null;
  readonly fitId: string | null;
  readonly sourceLine: number;
  /** Motivo de a linha ser suspeita, vindo do parser. */
  readonly parserIssue: string | null;
}

/** Campo interno: o identificador derivado, preenchido por `withImportIdentifiers`. */
type IdentifiedRawRow = RawRow & { readonly derivedFitId: string | null };

function fromOfx(statement: OfxStatement): RawRow[] {
  const byLine = new Map<number, string>();

  for (const issue of statement.issues) {
    if (!byLine.has(issue.line)) {
      byLine.set(issue.line, issue.message);
    }
  }

  return statement.transactions.map((transaction: OfxStatementTransaction) => ({
    date: transaction.date,
    description: describeOfx(transaction),
    amountInCents: transaction.amountInCents,
    fitId: transaction.fitId,
    sourceLine: transaction.line,
    parserIssue: byLine.get(transaction.line) ?? null,
  }));
}

/** Descrição de uma transação OFX: `MEMO` e, se faltar, `NAME`; nunca os dois. */
function describeOfx(transaction: OfxStatementTransaction): string {
  const memo = transaction.memo?.trim() ?? '';

  if (memo !== '') {
    return memo;
  }

  return transaction.name?.trim() ?? '';
}

function fromCsv(statement: CsvStatement): RawRow[] {
  const byLine = new Map<number, string>();

  for (const issue of statement.issues) {
    if (!byLine.has(issue.line)) {
      byLine.set(issue.line, issue.message);
    }
  }

  return statement.rows.map((row: CsvStatementRow) => ({
    date: row.date,
    description: row.description,
    amountInCents: row.amountInCents,
    fitId: row.fitId,
    sourceLine: row.line,
    parserIssue: byLine.get(row.line) ?? null,
  }));
}

export interface BuildPreviewInput {
  readonly account: PreviewAccount;
  readonly raw: readonly RawRow[];
  readonly existing: readonly ExistingTransactionFingerprint[];
  readonly rules: PreviewRules;
  /** Saldo final declarado pelo ficheiro, quando existe. */
  readonly statedEndBalanceInCents: number | null;
  readonly warnings: readonly string[];
  readonly issues: readonly ImportIssue[];
}

/**
 * Constrói a lista de linhas com estado. Função pura: recebe o que os parsers
 * leram e o que já existe na conta, e devolve o que a pré-visualização mostra.
 *
 * A identidade de cada linha passa a ser o **identificador derivado**
 * (`withImportIdentifiers`): é o mesmo valor que vai para a coluna `fitId` na
 * confirmação, pelo que a decisão tomada aqui e a decisão tomada lá são a mesma,
 * com a mesma chave. Sem isso, a pré-visualização usava `fitId` (do banco) e a
 * confirmação voltava a inventar, e um CSV importado duas vezes em paralelo
 * passava as duas vezes.
 */
export function buildPreview(input: BuildPreviewInput): ImportPreviewBase {
  const { fitIds, rows: existingRows } = indexExisting(input.existing);
  const identified: IdentifiedRawRow[] = withImportIdentifiers(input.raw);
  const seen = new Set<string>();
  const rows: ImportRow[] = [];

  for (const [index, raw] of identified.entries()) {
    const derivedFitId = raw.derivedFitId;
    let status: ImportRowStatus = 'new';
    let reason: string | null = null;

    if (raw.date === null || raw.amountInCents === null) {
      status = 'suspicious';
      reason = raw.parserIssue ?? (raw.date === null ? 'Sem data legível.' : 'Sem valor legível.');
    } else if (derivedFitId !== null && fitIds.has(derivedFitId)) {
      status = 'duplicate';

      /*
       * O identificador já existe — mas com o **mesmo valor**?
       *
       * Um `fitId` identifica o movimento no banco; se o valor divergir, uma das
       * duas coisas está errada: o banco corrigiu o movimento, ou o ficheiro é de
       * outro período e o identificador colidiu. Nos dois casos, descartar em
       * silêncio é a pior resposta: é exatamente o caso em que o utilizador mais
       * precisa de saber. Diz-se o valor do ficheiro e o que está na aplicação.
       */
      const existing = existingRows.get(derivedFitId);
      const divergence = divergenceOf(existing, raw);

      reason =
        divergence === null
          ? raw.fitId !== null && raw.fitId !== ''
            ? 'Já existe nesta conta (mesmo identificador do banco).'
            : 'Já existe nesta conta um movimento igual (data, valor e descrição).'
          : divergence;
    } else if (derivedFitId !== null && seen.has(derivedFitId)) {
      // Só acontece quando o ficheiro traz identificadores do banco repetidos
      // (FITID duplicado): sem identificador externo, a repetição recebe sufixo
      // e cada linha tem a sua própria identidade.
      status = 'duplicate';
      reason = 'Repetido dentro do próprio ficheiro.';
    }

    if (derivedFitId !== null) {
      seen.add(derivedFitId);
    }

    const suggestion = status === 'new' ? suggest(raw, input.account.id, index, input.rules) : null;

    rows.push({
      index,
      date: raw.date,
      description: raw.description,
      amountInCents: raw.amountInCents,
      // O identificador que será gravado — derivado quando o ficheiro não traz um.
      fitId: derivedFitId,
      status,
      reason,
      selected: status === 'new',
      suggestedCategoryId: suggestion?.id ?? null,
      suggestedCategoryName: suggestion?.name ?? null,
      sourceLine: raw.sourceLine,
    });
  }

  /*
   * Totais do que **seria importado**.
   *
   * Os duplicados ficam de fora: já existem na conta, portanto somá-los contaria
   * o mesmo movimento duas vezes no saldo implícito que a pré-visualização
   * mostra. Os suspeitos também, porque não se sabe o valor deles. Um teste da
   * verificação nativa apanhou isto: um movimento repetido dentro do próprio
   * ficheiro somava 1 700,00 € em vez de 850,00 €.
   */
  let totalDebitsInCents = 0;
  let totalCreditsInCents = 0;

  for (const row of rows) {
    if (row.status !== 'new' || row.amountInCents === null) {
      continue;
    }

    if (row.amountInCents < 0) {
      totalDebitsInCents += Math.abs(row.amountInCents);
    } else {
      totalCreditsInCents += row.amountInCents;
    }
  }

  const net = totalCreditsInCents - totalDebitsInCents;
  const warnings = [...input.warnings];

  /*
   * Saldo final implícito.
   *
   * Quando o ficheiro declara um saldo (OFX `LEDGERBAL`, CSV com coluna
   * `Saldo`), é esse o saldo — é o que o banco diz. Quando não declara, calcula-se
   * a partir do saldo atual da conta mais o líquido do que vai ser importado.
   *
   * Não é um saldo "real": é o que os **lançamentos lidos** implicam. Se o
   * utilizador desmarcar linhas na pré-visualização, o número deixa de
   * corresponder — e é por isso que a interface o mostra como estimativa.
   */
  let impliedEndBalanceInCents: number | null;

  if (input.statedEndBalanceInCents !== null) {
    impliedEndBalanceInCents = input.statedEndBalanceInCents;
  } else if (input.account.balanceInCents !== null) {
    // O saldo de referência da conta mais o líquido do que vai ser importado.
    // `balanceInCents` é o saldo **antes** desta importação (o formulário chama
    // `getAccountBalanceAtDate`), não o saldo depois.
    impliedEndBalanceInCents = input.account.balanceInCents + net;
  } else {
    impliedEndBalanceInCents = input.account.openingBalanceInCents + net;
  }

  if (input.account.balanceInCents !== null && input.statedEndBalanceInCents !== null) {
    const expected = input.account.balanceInCents + net;

    if (expected !== input.statedEndBalanceInCents) {
      warnings.push(
        `O saldo final do ficheiro (${String(input.statedEndBalanceInCents)} cêntimos) não ` +
          `corresponde ao saldo da conta mais os movimentos lidos (${String(expected)} cêntimos). ` +
          'Confirma se o extrato é da conta certa e se o período não tem movimentos a mais.',
      );
    }
  }

  return {
    rows,
    newCount: rows.filter((row) => row.status === 'new').length,
    duplicateCount: rows.filter((row) => row.status === 'duplicate').length,
    suspiciousCount: rows.filter((row) => row.status === 'suspicious').length,
    totalDebitsInCents,
    totalCreditsInCents,
    impliedEndBalanceInCents,
    warnings,
    issues: input.issues,
  };
}

/**
 * Junta o resultado dos parsers com o que já existe na conta.
 *
 * O `format` não muda a análise — muda só o que se declara na pré-visualização.
 */
export function previewFromOfx(args: {
  readonly account: PreviewAccount;
  readonly statement: OfxStatement;
  readonly existing: readonly ExistingTransactionFingerprint[];
  readonly rules: PreviewRules;
}): ImportPreviewBase {
  const warnings: string[] = [];

  /*
   * Um ficheiro com mais do que um extrato (conta à ordem + poupança) é uma forma
   * normal de um banco exportar, e é uma armadilha: só se importa **uma** conta.
   * O parser já isola os movimentos por extrato; aqui diz-se, com os valores, que
   * só o primeiro vai entrar — e que os outros precisam de uma segunda importação
   * para a conta deles. Desmarcar linhas não resolve: as que ficam são de outra
   * conta.
   */
  if (args.statement.statements.length > 1) {
    const [firstStatement, ...others] = args.statement.statements;
    const firstAccount =
      firstStatement?.accountId === null || firstStatement?.accountId === undefined
        ? ''
        : ` (conta ${firstStatement.accountId})`;
    const summary = others
      .map(
        (statement) =>
          `${statement.accountId ?? '(conta sem identificador)'} ` +
          `(${String(statement.transactions.length)} movimento(s))`,
      )
      .join(', ');

    warnings.push(
      `Este ficheiro traz ${String(args.statement.statements.length)} extratos. Só entra o ` +
        `primeiro${firstAccount}, com ${String(firstStatement?.transactions.length ?? 0)} ` +
        `movimento(s). Ficam de fora: ${summary}. Para importares esses, abre o ficheiro da ` +
        'conta respetiva.',
    );
  }

  if (
    args.statement.header['ENCODING'] !== undefined &&
    /USASCII|1252/i.test(args.statement.header['ENCODING'])
  ) {
    warnings.push(
      'O ficheiro diz que está em US-ASCII/Windows-1252. Se os acentos aparecerem trocados na ' +
        'pré-visualização, guarda o extrato em UTF-8 e importa outra vez.',
    );
  }

  const withoutFitId = args.statement.transactions.filter(
    (transaction) => transaction.fitId === null,
  ).length;

  if (withoutFitId > 0) {
    warnings.push(
      `${String(withoutFitId)} movimento(s) sem identificador do banco (FITID). Vão ser ` +
        'identificados pela data, valor e descrição — o que impede a reimportação de duplicar, ' +
        'mas torna dois movimentos **iguais no mesmo dia** (dois cafés, duas portagens) ' +
        'indistinguíveis. Se isso acontecer, confirma as linhas antes de importar.',
    );
  }

  return buildPreview({
    account: args.account,
    raw: fromOfx(args.statement),
    existing: args.existing,
    rules: args.rules,
    statedEndBalanceInCents: args.statement.ledgerBalanceInCents,
    warnings,
    issues: args.statement.issues,
  });
}

/** O mesmo, a partir de um extrato CSV. */
export function previewFromCsv(args: {
  readonly account: PreviewAccount;
  readonly statement: CsvStatement;
  readonly existing: readonly ExistingTransactionFingerprint[];
  readonly rules: PreviewRules;
}): ImportPreviewBase {
  const warnings: string[] = [];

  if (args.statement.separator === ',') {
    warnings.push(
      'O ficheiro usa vírgula como separador. Confirma as descrições na pré-visualização: um ' +
        'valor com vírgula decimal pode ter sido lido como duas colunas.',
    );
  }

  return buildPreview({
    account: args.account,
    raw: fromCsv(args.statement),
    existing: args.existing,
    rules: args.rules,
    statedEndBalanceInCents: args.statement.lastBalanceInCents,
    warnings,
    issues: args.statement.issues,
  });
}
