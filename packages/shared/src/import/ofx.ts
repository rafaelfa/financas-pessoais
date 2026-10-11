/**
 * Parser próprio de OFX 1.x SGML.
 *
 * -----------------------------------------------------------------------------
 * PORQUE NÃO SE USA UMA BIBLIOTECA
 * -----------------------------------------------------------------------------
 * A investigação da Fase 0 (`docs/spec/T0.8-smoke-tests.md` §5) provou que tanto
 * o `ofx-js` como o `ofx-data-extractor` tratam o SGML **como os bancos o
 * exportam** (tags de bloco fechadas, tags de valor abertas), mas que ambos
 * falham na variante sem **nenhuma** tag de fecho: o `ofx-js` lança
 * `Missing closing tag for LEDGERBAL` e o `ofx-data-extractor` procura
 * literalmente `</STMTTRN>`.
 *
 * A Fase 7 decidiu substituí-las por este parser, porque (a) um extrato que
 * rebenta com uma exceção não é uma mensagem que se possa mostrar a alguém e
 * (b) um parser de ~200 linhas, sem dependências, é mais fácil de manter do que
 * uma biblioteca que trata metade do formato. O teste
 * `import-smoke.test.ts` continua a registar o que as bibliotecas faziam, como
 * contraprova documental do comportamento que este ficheiro tem de igualar.
 *
 * -----------------------------------------------------------------------------
 * COMO FUNCIONA
 * -----------------------------------------------------------------------------
 * 1. O cabeçalho (`CHAVE:VALOR`, uma por linha) é lido até à linha que contém
 *    `<OFX>`; os comentários `<!-- -->` e as linhas vazias não contam.
 * 2. O corpo é tokenizado em tags `<NAME>` / `</NAME>`. Um valor sem fecho
 *    termina no `<` seguinte (a característica do SGML que as bibliotecas não
 *    tratam), pelo que o lexer sabe sempre onde acaba o valor.
 * 3. Os blocos usam uma **pilha**: um fecho que não corresponde ao bloco aberto
 *    desenrola a pilha até encontrar o seu par, e um fecho sem par aberto é
 *    ignorado. É isto que faz com que um ficheiro sem nenhuma tag de fecho
 *    produza **dados corretos** em vez de uma exceção — o `<LEDGERBAL>` sem
 *    fecho, por exemplo, contribui com os seus dois valores e o
 *    `</STMTRS>` seguinte fecha-o.
 * 4. O que não puder ser interpretado é **declarado** (`issues`), com a linha e
 *    o campo. Nenhuma função deste módulo lança por causa do conteúdo do
 *    ficheiro: um extrato malformado é um resultado, não uma exceção.
 */

import { parseAmountToCents } from './cents';
import { type ImportIssue, toIsoCalendarDate } from './issue';

/** Nó do documento: texto simples nas folhas, lista de nós nos blocos. */
export interface OfxNode {
  readonly name: string;
  readonly line: number;
  readonly value?: string;
  readonly children?: readonly OfxNode[];
}

export interface OfxStatementTransaction {
  /** `TRNTYPE` em bruto (`DEBIT`, `CREDIT`, `PAYMENT`, …). */
  readonly type: string;
  /** Data de calendário `YYYY-MM-DD`, já sem hora e sem fuso. */
  readonly date: string | null;
  /** `DTPOSTED` em bruto, para diagnóstico. */
  readonly postedAt: string;
  /** Efeito assinado na conta, em cêntimos. `null` se o campo não for legível. */
  readonly amountInCents: number | null;
  /** `TRNAMT` em bruto, para diagnóstico. */
  readonly amountRaw: string;
  readonly fitId: string | null;
  readonly memo: string | null;
  readonly name: string | null;
  readonly checkNumber: string | null;
  readonly refNumber: string | null;
  /** Linha do ficheiro onde o `<STMTTRN>` foi aberto. */
  readonly line: number;
}

export interface OfxStatement {
  /** Pares `CHAVE:VALOR` do cabeçalho, pela ordem do ficheiro. */
  readonly header: Readonly<Record<string, string>>;
  readonly currency: string | null;
  readonly bankId: string | null;
  readonly branchId: string | null;
  readonly accountId: string | null;
  readonly accountType: string | null;
  readonly startDate: string | null;
  readonly endDate: string | null;
  /** `LEDGERBAL.BALAMT` em cêntimos. `null` quando o ficheiro não o traz. */
  readonly ledgerBalanceInCents: number | null;
  readonly ledgerBalanceRaw: string | null;
  /** Data do saldo (`DTASOF`), quando existe. */
  readonly ledgerBalanceDate: string | null;
  readonly transactions: readonly OfxStatementTransaction[];
  /** Tudo o que não foi possível interpretar, com linha e motivo. */
  readonly issues: readonly ImportIssue[];
}

const CONTAINER_BRACKETS = /^<([A-Za-z0-9.]+)>$/;
const CLOSER_BRACKETS = /^<\/([A-Za-z0-9.]+)>$/;

interface Token {
  readonly kind: 'open' | 'close' | 'text';
  readonly name?: string;
  readonly text?: string;
  readonly line: number;
}

/** Divide o corpo em tokens, ignorando comentários e ruído entre tags. */
function tokenize(body: string, skipLines: ReadonlySet<number> = new Set()): Token[] {
  const tokens: Token[] = [];
  const lines = body.split('\n');

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;

    if (skipLines.has(lineNumber)) {
      continue;
    }

    const line = lines[index] ?? '';
    let position = 0;

    while (position < line.length) {
      const open = line.indexOf('<', position);

      if (open === -1) {
        pushText(tokens, line.slice(position), lineNumber);
        break;
      }

      if (open > position) {
        pushText(tokens, line.slice(position, open), lineNumber);
      }

      if (line.startsWith('<!--', open)) {
        const commentEnd = line.indexOf('-->', open);

        if (commentEnd === -1) {
          break;
        }

        position = commentEnd + 3;
        continue;
      }

      const close = line.indexOf('>', open);

      if (close === -1) {
        // `<` sem `>`: resto da linha é texto (um extrato com um `<` solto).
        pushText(tokens, line.slice(open), lineNumber);
        break;
      }

      const tag = line.slice(open, close + 1);
      const opening = CONTAINER_BRACKETS.exec(tag);
      const closing = CLOSER_BRACKETS.exec(tag);
      const name = opening?.[1] ?? closing?.[1];

      if (name !== undefined) {
        tokens.push({
          kind: opening !== null ? 'open' : 'close',
          name,
          line: lineNumber,
        });
      } else {
        // Instrução de processamento (`<?xml ?>`) ou tag exótica: ignorada.
        pushText(tokens, tag, lineNumber);
      }

      position = close + 1;
    }
  }

  return tokens;
}

function pushText(tokens: Token[], raw: string, line: number): void {
  const text = raw.trim();

  if (text !== '') {
    tokens.push({ kind: 'text', text, line });
  }
}

/**
 * Tags que são **folhas**: contêm um valor e nunca outros blocos.
 *
 * É a tabela que o plano da Fase 0 já previa («só o ponto 2 — esquema de tags —
 * exige uma tabela de hierarquia OFX mantida à mão»). Sem ela, um `<STATUS>`
 * vazio num ficheiro sem tags de fecho engole todos os irmãos seguintes e os
 * movimentos ficam sem valor nenhum.
 *
 * Qualquer tag desconhecida é tratada como folha: perder a hierarquia de uma tag
 * exótica não estraga nada, mas engolir irmãos estraga tudo.
 */
const LEAF_TAGS: ReadonlySet<string> = new Set([
  'CODE',
  'SEVERITY',
  'MESSAGE',
  'DTSERVER',
  'LANGUAGE',
  'DTPROFUP',
  'DTACCTUP',
  'ORG',
  'FID',
  'INTU.BID',
  'INTU.USERID',
  'TRNUID',
  'CLTCOOKIE',
  'TAN',
  'CURDEF',
  'BANKID',
  'BRANCHID',
  'ACCTID',
  'ACCTKEY',
  'ACCTTYPE',
  'ACCTSUBTYPE',
  'NAME',
  'DESC',
  'PHONE',
  'CITY',
  'STATE',
  'POSTALCODE',
  'COUNTRY',
  'EMAIL',
  'DTSTART',
  'DTEND',
  'TRNTYPE',
  'DTPOSTED',
  'DTUSER',
  'DTAVAIL',
  'TRNAMT',
  'FITID',
  'CHECKNUM',
  'REFNUM',
  'SIC',
  'PAYEEID',
  'PAYEENAME',
  'MEMO',
  'BALAMT',
  'DTASOF',
  'AVAILAMT',
  'CREDITLIMIT',
  'CASHADVANCELIMIT',
  'BALAMT',
  'LOANID',
  'LOANACCTID',
  'LOANSTARTDATE',
  'LOANMATURITYDATE',
  'VERSION',
  'TOKEN',
]);

/**
 * Constrói a árvore a partir dos tokens.
 *
 * O algoritmo usa a tabela de tags acima em vez de fechar blocos por heurística:
 * um `<LEDGERBAL>` sem fecho nunca é "adivinhado" — o que acontece é que ao
 * aparecer uma tag **folha** depois de um valor, o bloco anterior fecha sozinho.
 * É isto que faz a variante sem nenhuma tag de fecho produzir dados corretos.
 */
function buildTree(tokens: readonly Token[]): { nodes: OfxNode[]; issues: ImportIssue[] } {
  const roots: OfxNode[] = [];
  const issues: ImportIssue[] = [];

  interface Builder {
    readonly name: string;
    readonly line: number;
    readonly children: OfxNode[];
    /**
     * Valor, quando o bloco é uma folha. Preenchido pelo `leafValue` e nunca
     * junto com `children`: uma folha tem um valor, um contentor tem filhos.
     */
    value?: string;
  }

  const stack: Builder[] = [];
  /** Folha aberta à espera do valor: `<MEMO>` sem fecho, por exemplo. */
  let pendingLeaf: Builder | null = null;

  const closeBuilder = (builder: Builder): void => {
    const parent = stack[stack.length - 1];
    const built: OfxNode = {
      name: builder.name,
      line: builder.line,
      ...(builder.value !== undefined ? { value: builder.value } : {}),
      ...(builder.children.length > 0 ? { children: builder.children } : {}),
    };

    if (parent === undefined) {
      roots.push(built);
    } else {
      parent.children.push(built);
    }
  };

  const finishLeaf = (): void => {
    if (pendingLeaf === null) {
      return;
    }

    const leaf = pendingLeaf;
    pendingLeaf = null;
    closeBuilder(leaf);
  };

  for (const token of tokens) {
    if (token.kind === 'open' && token.name !== undefined) {
      finishLeaf();

      /*
       * Fecha os blocos que não podem conter esta tag.
       *
       * Num ficheiro bem formado não há nada a fechar: as tags de fecho tratam
       * disso. Num ficheiro **sem** tags de fecho é isto que mantém a estrutura
       * certa: ao ver `<STMTTRN>` já dentro de um `<STMTTRN>`, o anterior fecha
       * (depois de guardar os valores que tinha) e o novo passa a ser irmão.
       * Sem este passo, dez movimentos ficavam aninhados uns dentro dos outros e
       * o parser declarava nove deles abandonados.
       *
       * Só tags contentoras conhecidas provocam fechos (`isSibling`), porque uma
       * tag exótica tratada como irmã fecharia blocos a mais — e fechar a mais
       * perde valores, enquanto fechar a menos só perde hierarquia.
       */
      while (
        stack.length > 0 &&
        isSibling(
          token.name,
          stack.map((builder) => builder.name),
        )
      ) {
        const abandoned = stack.pop();

        if (abandoned === undefined) {
          break;
        }

        if (abandoned.children.length > 0) {
          issues.push({
            line: abandoned.line,
            field: abandoned.name,
            message: `O bloco <${abandoned.name}> nunca foi fechado; o ficheiro pode estar truncado.`,
          });
        }

        closeBuilder(abandoned);
      }

      const opened: Builder = { name: token.name, line: token.line, children: [] };

      if (LEAF_TAGS.has(token.name)) {
        // Folha: fica à espera do valor que vem a seguir.
        pendingLeaf = opened;
      } else {
        stack.push(opened);
      }

      continue;
    }

    if (token.kind === 'text' && token.text !== undefined) {
      /*
       * Uma folha aberta (`<MEMO>`, ou qualquer tag sem fecho) recebe o valor
       * **diretamente**. A versão anterior acrescentava-lhe um filho com o mesmo
       * nome, e a árvore ficava `CODE > CODE = "0"`: os valores existiam, mas
       * aninhados um nível abaixo do que `childValue` procura — e era daí que
       * vinham os movimentos sem valor nenhum.
       */
      if (pendingLeaf !== null) {
        if (pendingLeaf.value !== undefined) {
          issues.push({
            line: token.line,
            field: pendingLeaf.name,
            message: `O bloco <${pendingLeaf.name}> tem mais do que um valor; o ficheiro pode estar truncado.`,
          });
        }

        pendingLeaf.value = token.text;
        continue;
      }

      const top = stack[stack.length - 1];

      if (top === undefined) {
        continue;
      }

      /*
       * Texto num contentor sem folha aberta. Num ficheiro bem formado acontece
       * quando o banco escreve a folha e o valor em linhas diferentes:
       * `<LEDGERBAL>` não se põe, mas uma tag exótica do banco sim. Nestes casos
       * o valor pertence à folha **anterior**, que ainda espera o fecho.
       */
      const previous = top.children[top.children.length - 1];

      if (previous !== undefined && previous.value === undefined) {
        top.children[top.children.length - 1] = { ...previous, value: token.text };
        continue;
      }

      issues.push({
        line: token.line,
        field: top.name,
        message: `Não sei a que campo pertence o valor ${JSON.stringify(token.text)}.`,
      });
    }

    if (token.kind === 'close' && token.name !== undefined) {
      const target = token.name;
      let matched = false;

      if (pendingLeaf !== null && pendingLeaf.name === target) {
        finishLeaf();
        matched = true;
      } else {
        finishLeaf();

        while (stack.length > 0) {
          const top = stack.pop();

          if (top === undefined) {
            break;
          }

          if (top.name === target) {
            closeBuilder(top);
            matched = true;
            break;
          }

          // Blocos vazios pelo caminho (num ficheiro sem fechos) não geram
          // aviso: não tinham nada para perder. Só quem tinha conteúdo o gera.
          if (top.children.length === 0) {
            continue;
          }

          issues.push({
            line: top.line,
            field: top.name,
            message: `O bloco <${top.name}> nunca foi fechado; o ficheiro pode estar truncado.`,
          });
          closeBuilder(top);
        }
      }

      if (!matched) {
        issues.push({
          line: token.line,
          field: target,
          message: `Tag de fecho </${target}> sem abertura correspondente; foi ignorada.`,
        });
      }
    }
  }

  finishLeaf();

  while (stack.length > 0) {
    const top = stack.pop();

    if (top === undefined) {
      break;
    }

    if (top.children.length > 0) {
      issues.push({
        line: top.line,
        field: top.name,
        message: `O bloco <${top.name}> nunca foi fechado; o ficheiro pode estar truncado.`,
      });
    }

    closeBuilder(top);
  }

  return { nodes: roots, issues };
}

/**
 * Que tags podem estar **dentro** de cada tag.
 *
 * É a segunda metade da tabela de hierarquia do OFX (a primeira é `LEAF_TAGS`) e
 * serve para uma coisa só: decidir se uma tag que aparece a seguir a um valor
 * ainda pertence ao bloco aberto ou é já um irmão. Sem isto, num ficheiro sem
 * tags de fecho cada movimento novo era tratado como "filho" do anterior, o
 * anterior acabava por ser abandonado com um aviso de truncamento — e o valor
 * que ele já tinha perdia-se.
 *
 * As entradas são as que os bancos portugueses e os ficheiros de teste usam. Uma
 * tag que não esteja aqui nunca provoca o fecho de um bloco: é tratada como
 * conteúdo, que é o comportamento seguro (perder hierarquia não estraga dados;
 * fechar a mais, sim).
 */
const CHILDREN_OF: Readonly<Record<string, readonly string[]>> = {
  OFX: [
    'SIGNONMSGSRSV1',
    'SIGNUPMSGSRSV1',
    'BANKMSGSRSV1',
    'CREDITCARDMSGSRSV1',
    'INVSTMTMSGSRSV1',
    'INTERXFERMSGSRSV1',
    'WIREMSGSRSV1',
    'BILLPAYMSGSRSV1',
    'PROFMSGSRSV1',
    'SECLISTMSGSRSV1',
  ],
  SIGNONMSGSRSV1: ['SONRS'],
  SONRS: ['STATUS', 'DTSERVER', 'LANGUAGE', 'DTPROFUP', 'DTACCTUP', 'FI', 'SESSCOOKIE'],
  SIGNUPMSGSRSV1: ['SIGNUPTRNRS'],
  BANKMSGSRSV1: ['STMTTRNRS'],
  CREDITCARDMSGSRSV1: ['CCSTMTTRNRS'],
  INVSTMTMSGSRSV1: ['INVSTMTTRNRS'],
  STMTTRNRS: ['TRNUID', 'STATUS', 'STMTRS'],
  CCSTMTTRNRS: ['TRNUID', 'STATUS', 'CCSTMTRS'],
  STMTRS: ['CURDEF', 'BANKACCTFROM', 'BANKTRANLIST', 'LEDGERBAL', 'AVAILBAL'],
  CCSTMTRS: ['CURDEF', 'CCACCTFROM', 'BANKTRANLIST', 'LEDGERBAL', 'AVAILBAL'],
  BANKACCTFROM: ['BANKID', 'BRANCHID', 'ACCTID', 'ACCTTYPE', 'ACCTKEY', 'NAME'],
  CCACCTFROM: ['ACCTID', 'ACCTKEY'],
  BANKTRANLIST: ['DTSTART', 'DTEND', 'STMTTRN'],
  STMTTRN: [
    'TRNTYPE',
    'DTPOSTED',
    'DTUSER',
    'DTAVAIL',
    'TRNAMT',
    'FITID',
    'CHECKNUM',
    'REFNUM',
    'SIC',
    'PAYEEID',
    'NAME',
    'MEMO',
  ],
  LEDGERBAL: ['BALAMT', 'DTASOF'],
  AVAILBAL: ['BALAMT', 'DTASOF'],
  STATUS: ['CODE', 'SEVERITY', 'MESSAGE'],
  FI: ['ORG', 'FID'],
};

/**
 * `true` quando `name` **pode** estar dentro do bloco aberto mais próximo.
 *
 * Uma tag que não seja contentora conhecida é tratada como pertencente ao bloco
 * aberto (nunca o fecha), e uma tag que seja contentora conhecida fecha os
 * blocos abertos até encontrar um que a possa conter.
 */
function isSibling(name: string, ancestors: readonly string[]): boolean {
  if (CHILDREN_OF[name] === undefined) {
    return false;
  }

  return !ancestors.some((ancestor) => CHILDREN_OF[ancestor]?.includes(name) === true);
}

/** Descodifica as entidades que aparecem em extratos reais. */
export function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_match, code: string) => {
      const parsed = Number.parseInt(code, 10);

      return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : _match;
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, code: string) => {
      const parsed = Number.parseInt(code, 16);

      return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : _match;
    })
    .replace(/&amp;/g, '&');
}

function childValue(node: OfxNode | undefined, name: string): string | undefined {
  if (node?.children === undefined) {
    return undefined;
  }

  for (const child of node.children) {
    if (child.name === name && child.value !== undefined) {
      return decodeEntities(child.value);
    }
  }

  return undefined;
}

/** Procura, em profundidade, todos os nós com um nome — pela ordem do ficheiro. */
function findAll(node: OfxNode | undefined, name: string, found: OfxNode[] = []): OfxNode[] {
  if (node?.children === undefined) {
    return found;
  }

  for (const child of node.children) {
    if (child.name === name) {
      found.push(child);
    }

    findAll(child, name, found);
  }

  return found;
}

/**
 * Junta os avisos de blocos por fechar num só.
 *
 * Modifica a lista no sítio, pela ordem original: o primeiro aviso mantém-se (é
 * a linha concreta a que a pré-visualização pode apontar) e os seguintes são
 * substituídos por uma contagem. Nada é escondido — o número total aparece.
 */
function condenseTruncationIssues(issues: ImportIssue[]): void {
  const firstIndex = issues.findIndex((issue) => issue.message.includes('nunca foi fechado'));

  if (firstIndex === -1) {
    return;
  }

  const total = issues.filter((issue) => issue.message.includes('nunca foi fechado')).length;

  if (total < 3) {
    return;
  }

  const kept = issues[firstIndex];

  if (kept === undefined) {
    return;
  }

  const remaining: ImportIssue[] = issues.filter(
    (issue, index) => index === firstIndex || !issue.message.includes('nunca foi fechado'),
  );

  remaining.push({
    line: kept.line,
    field: kept.field,
    message:
      `${String(total)} blocos ficaram sem tag de fecho (o primeiro é <${kept.field}> na linha ` +
      `${String(kept.line)}). É o estilo de alguns extratos SGML antigos; os dados foram lidos na ` +
      'mesma, mas confirma a pré-visualização antes de importar.',
  });

  issues.length = 0;
  issues.push(...remaining);
}

/**
 * Converte `DTPOSTED` (`YYYYMMDDHHMMSS`, `YYYYMMDD`, com ou sem `[fuso]`) numa
 * data de calendário.
 *
 * A hora e o fuso são **descartados de propósito**: a data de um lançamento é
 * uma data de calendário, e somar um deslocamento de fuso é precisamente a
 * maneira de a deslocar um dia. Se o ficheiro disser `20260930235959`, o
 * lançamento é de **30 de setembro**, mesmo que em UTC já seja dia 1.
 */
export function parseOfxDate(raw: string | undefined): string | null {
  if (raw === undefined) {
    return null;
  }

  const digits = raw.trim().split(/[[\s+-]/)[0] ?? '';

  if (!/^\d{8}(\d{6})?$/.test(digits)) {
    return null;
  }

  const year = digits.slice(0, 4);
  const month = digits.slice(4, 6);
  const day = digits.slice(6, 8);

  return toIsoCalendarDate(year, month, day);
}

/**
 * Interpreta um extrato OFX 1.x SGML (ou 2.x XML: a tokenização de tags com
 * fecho não é prejudicada por esta via).
 *
 * Nunca lança por causa do conteúdo: um ficheiro vazio, truncado ou sem tags de
 * fecho devolve um documento com o que conseguiu ler e os problemas em `issues`.
 */
export function parseOfxDocument(content: string): OfxStatement {
  const issues: ImportIssue[] = [];

  if (typeof content !== 'string' || content.trim() === '') {
    return {
      header: {},
      currency: null,
      bankId: null,
      branchId: null,
      accountId: null,
      accountType: null,
      startDate: null,
      endDate: null,
      ledgerBalanceInCents: null,
      ledgerBalanceRaw: null,
      ledgerBalanceDate: null,
      transactions: [],
      issues: [{ line: 1, field: 'documento', message: 'O ficheiro está vazio.' }],
    };
  }

  const text = content.replace(/^\uFEFF/, '');
  const lines = text.split('\n');
  const header: Record<string, string> = {};
  const skipLines = new Set<number>();

  for (let index = 0; index < lines.length; index += 1) {
    const line = (lines[index] ?? '').trim();

    if (line.includes('<OFX>')) {
      break;
    }

    if (line === '' || line.startsWith('<!--')) {
      continue;
    }

    const match = /^([A-Za-z0-9_]+):(.*)$/.exec(line);

    if (match?.[1] !== undefined && match[2] !== undefined) {
      header[match[1]] = match[2].trim();
      // O cabeçalho SGML não é corpo: os seus `CHAVE:VALOR` seriam lidos como
      // texto de nós inexistentes. Marcado para o lexer o saltar, mantendo os
      // números de linha do ficheiro original.
      skipLines.add(index + 1);
    }
  }

  if (!lines.some((line) => line.includes('<OFX>'))) {
    issues.push({
      line: 1,
      field: 'OFX',
      message: 'Não encontrei a tag <OFX>; o ficheiro não parece um extrato OFX.',
    });

    return {
      header,
      currency: null,
      bankId: null,
      branchId: null,
      accountId: null,
      accountType: null,
      startDate: null,
      endDate: null,
      ledgerBalanceInCents: null,
      ledgerBalanceRaw: null,
      ledgerBalanceDate: null,
      transactions: [],
      issues,
    };
  }

  const { nodes, issues: treeIssues } = buildTree(tokenize(text, skipLines));
  issues.push(...treeIssues);

  const root = nodes.find((node) => node.name === 'OFX') ?? nodes[0];
  const transactionNodes = findAll(root, 'STMTTRN');

  /*
   * Um extrato com centenas de movimentos e sem uma única tag de fecho gera um
   * aviso por movimento ("nunca foi fechado"). Duzentas linhas de aviso são
   * ruído: ninguém as lê e a pré-visualização deixa de servir. Juntam-se num só,
   * com a contagem, mantendo o primeiro exemplo para ter uma linha concreta a
   * que apontar.
   */
  condenseTruncationIssues(issues);

  const transactions: OfxStatementTransaction[] = transactionNodes.map((node) => {
    const amountRaw = childValue(node, 'TRNAMT') ?? '';
    const postedAt = childValue(node, 'DTPOSTED') ?? '';
    const fitId = childValue(node, 'FITID')?.trim() ?? '';
    const amountInCents = amountRaw === '' ? null : parseAmountToCents(amountRaw);
    const date = parseOfxDate(postedAt);

    if (amountRaw !== '' && amountInCents === null) {
      issues.push({
        line: node.line,
        field: 'TRNAMT',
        message: `Valor ilegível num movimento: "${amountRaw}".`,
      });
    } else if (amountRaw === '') {
      issues.push({
        line: node.line,
        field: 'TRNAMT',
        message: 'Movimento sem valor (TRNAMT).',
      });
    }

    if (postedAt !== '' && date === null) {
      issues.push({
        line: node.line,
        field: 'DTPOSTED',
        message: `Data ilegível num movimento: "${postedAt}".`,
      });
    } else if (postedAt === '') {
      issues.push({
        line: node.line,
        field: 'DTPOSTED',
        message: 'Movimento sem data (DTPOSTED).',
      });
    }

    if (fitId === '') {
      issues.push({
        line: node.line,
        field: 'FITID',
        message: 'Movimento sem FITID: não há como o reconhecer numa reimportação.',
      });
    }

    return {
      type: childValue(node, 'TRNTYPE') ?? '',
      date,
      postedAt,
      amountInCents,
      amountRaw,
      fitId: fitId === '' ? null : fitId,
      memo: childValue(node, 'MEMO') ?? null,
      name: childValue(node, 'NAME') ?? null,
      checkNumber: childValue(node, 'CHECKNUM') ?? null,
      refNumber: childValue(node, 'REFNUM') ?? null,
      line: node.line,
    };
  });

  /*
   * O nó do extrato procura-se em profundidade, e não pelo caminho exato da
   * hierarquia.
   *
   * Num ficheiro sem tags de fecho a árvore fica mais **plana** do que o normal:
   * `BANKACCTFROM` e `LEDGERBAL` passam a ser irmãos dos movimentos em vez de
   * filhos de `STMTRS`, porque o contentor que os continha nunca fechou. Procurar
   * pelo caminho exato (`root > BANKMSGSRSV1 > STMTTRNRS > STMTRS`) funcionava no
   * extrato bem formado e devolvia `undefined` no outro — e sem nó de extrato não
   * havia moeda, conta nem saldo. Uma procura em profundidade encontra-o nas duas
   * formas.
   */
  const statementNode = findAll(root, 'STMTRS')[0] ?? findAll(root, 'CCSTMTRS')[0];
  const accountFrom = findAll(root, 'BANKACCTFROM')[0] ?? findAll(root, 'CCACCTFROM')[0];
  const ledger = findAll(root, 'LEDGERBAL')[0] ?? findAll(root, 'AVAILBAL')[0];
  const transactionList = findAll(root, 'BANKTRANLIST')[0];

  if (statementNode === undefined && transactionNodes.length === 0) {
    issues.push({
      line: root?.line ?? 1,
      field: 'STMTRS',
      message: 'Não encontrei um extrato de conta (STMTRS) neste ficheiro.',
    });
  }

  const ledgerBalanceRaw = childValue(ledger, 'BALAMT') ?? null;
  const ledgerBalanceInCents =
    ledgerBalanceRaw === null ? null : parseAmountToCents(ledgerBalanceRaw);

  if (ledgerBalanceRaw !== null && ledgerBalanceInCents === null) {
    issues.push({
      line: ledger?.line ?? root?.line ?? 1,
      field: 'BALAMT',
      message: `Saldo do extrato ilegível: "${ledgerBalanceRaw}".`,
    });
  }

  return {
    header,
    currency: childValue(statementNode, 'CURDEF') ?? null,
    bankId: childValue(accountFrom, 'BANKID') ?? null,
    branchId: childValue(accountFrom, 'BRANCHID') ?? null,
    accountId: childValue(accountFrom, 'ACCTID') ?? null,
    accountType: childValue(accountFrom, 'ACCTTYPE') ?? null,
    startDate: parseOfxDate(childValue(transactionList, 'DTSTART')),
    endDate: parseOfxDate(childValue(transactionList, 'DTEND')),
    ledgerBalanceInCents,
    ledgerBalanceRaw,
    ledgerBalanceDate: parseOfxDate(childValue(ledger, 'DTASOF')),
    transactions,
    issues,
  };
}

/**
 * Formato do conteúdo: `ofx` quando há cabeçalho SGML ou uma tag `<OFX>`,
 * `csv` caso contrário. Serve para o utilizador não ter de escolher o formato à
 * mão — e para a interface poder detetar o engano antes de tentar interpretar.
 */
export function detectFormat(content: string): 'ofx' | 'csv' {
  const head = content.slice(0, 4_000).replace(/^\uFEFF/, '');

  if (/^\s*(OFXHEADER|DATA)\s*:/im.test(head) || /<OFX>/i.test(head)) {
    return 'ofx';
  }

  if (/<\?xml/i.test(head) || /<OFX\b/i.test(head)) {
    return 'ofx';
  }

  return 'csv';
}
