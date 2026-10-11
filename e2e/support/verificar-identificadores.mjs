/**
 * Verificação pura do ciclo exportar → reimportar, sem browser e sem base de dados.
 *
 * Existe por uma razão concreta: os testes ponta a ponta provam o percurso, mas
 * precisam de um servidor (`next dev`) e de um browser. Nesta máquina o
 * `next dev` falha com `spawn EPERM`, e uma decisão de identidade de dados não
 * pode ficar à espera disso — a função que decide o estado de cada linha
 * (`buildPreview`) é **pura** e pode ser chamada diretamente.
 *
 * O que faz: reproduz o que a exportação escreveria na coluna `Id`
 * (`apps/web/src/server/export.ts:109-124`) para o conteúdo da conta e passa
 * esse ficheiro pela pré-visualização (`buildPreview`), como faria o importador.
 * Se alguma linha sair com estado `new` quando o movimento já existe, o ciclo
 * exportar → reimportar não fecha.
 *
 * Uso (na raiz):
 *   node --experimental-transform-types e2e/support/verificar-identificadores.mjs
 */

import { register } from 'node:module';

register('./hooks.mjs', import.meta.url);

const { buildPreview, fingerprintOf } = await import('../../packages/shared/src/import/preview.ts');

/** A conta de destino: sem saldo de referência, como uma carteira nova. */
const CONTA = {
  id: 'conta-de-teste',
  name: 'Carteira principal',
  openingBalanceInCents: 0,
  balanceInCents: null,
};

/** Sem regras: a sugestão de categoria não interfere no estado das linhas. */
const SEM_REGRAS = { rules: [], categoryNames: new Map() };

/**
 * Reprodução literal de `exportIdentifiers` (`export.ts:109-124`): o `fitId` da
 * base quando existe, a impressão digital quando não existe, e o sufixo `:N` na
 * repetição — com o corte a 80 caracteres no fim.
 */
function identificadoresExportados(linhas) {
  const contagens = new Map();

  return linhas.map((linha, indice) => {
    const base =
      linha.fitId !== null && linha.fitId !== ''
        ? linha.fitId
        : (fingerprintOf(linha.date, linha.amountInCents, linha.description) ??
          `exp-sem-id:${String(indice + 1)}`);

    const ocorrencia = (contagens.get(base) ?? 0) + 1;

    contagens.set(base, ocorrencia);

    return ocorrencia === 1 ? base.slice(0, 80) : `${base}:${String(ocorrencia)}`.slice(0, 80);
  });
}

/** Linhas cruas do ficheiro, com o `Id` que a exportação lhes deu. */
function linhasDoFicheiro(linhas, identificadores) {
  return linhas.map((linha, indice) => ({
    date: linha.date,
    description: linha.description,
    amountInCents: linha.amountInCents,
    fitId: identificadores[indice] ?? null,
    sourceLine: indice + 2,
    parserIssue: null,
  }));
}

/** Movimentos como a base os devolve (manuais: sem `fitId`). */
function existentesNaBase(linhas) {
  return linhas.map((linha) => ({
    fitId: linha.fitId ?? null,
    date: new Date(`${linha.date}T00:00:00.000Z`),
    amountInCents: linha.amountInCents,
    description: linha.description,
  }));
}

/**
 * O que fica na base **depois** de uma importação ter gravado os identificadores
 * do ficheiro: é o estado da segunda volta do ciclo (e o caso que a correção de
 * `indexExisting` cobre).
 */
function existentesDepoisDeImportar(linhas) {
  const identificadores = identificadoresExportados(linhas);

  return linhas.map((linha, indice) => ({
    fitId: identificadores[indice] ?? null,
    date: new Date(`${linha.date}T00:00:00.000Z`),
    amountInCents: linha.amountInCents,
    description: linha.description,
  }));
}

/**
 * Conta com **menos** movimentos do que o ficheiro: um café na conta e dois no
 * ficheiro. É o contra-exemplo que impede a correção de ser boa demais — se
 * contar ocorrências virasse «descartar repetições», o segundo café (que é
 * mesmo novo) nunca entraria, e isso seria o I4 da T7.5 outra vez.
 */
function existentesParciais(quantidade) {
  return (linhas) => existentesNaBase(linhas.slice(0, quantidade));
}

function analisar(nome, linhas, existentes = existentesNaBase) {
  const identificadores = identificadoresExportados(linhas);
  const resultado = buildPreview({
    account: CONTA,
    raw: linhasDoFicheiro(linhas, identificadores),
    existing: existentes(linhas),
    rules: SEM_REGRAS,
    statedEndBalanceInCents: null,
    warnings: [],
  });

  const resumo = {
    caso: nome,
    movimentosNaConta: linhas.length,
    identificadoresExportados: identificadores,
    estadoNaPrevisualizacao: resultado.rows.map((linha) => linha.status),
    motivos: resultado.rows.map((linha) => linha.reason),
    linhasNovas: resultado.newCount,
    selecionadasParaImportar: resultado.rows.filter((linha) => linha.selected).length,
  };

  console.log(`\n${nome}`);
  console.log(`  identificadores: ${identificadores.join(' | ')}`);
  console.log(`  estados: ${resumo.estadoNaPrevisualizacao.join(', ')}`);
  console.log(
    `  novas: ${String(resumo.linhasNovas)} (selecionadas: ${String(resumo.selecionadasParaImportar)})`,
  );

  return resumo;
}

const DATA = '2026-10-05';
const IDENTICOS = [
  { date: DATA, description: 'E2E café', amountInCents: -1230, fitId: null },
  { date: DATA, description: 'E2E café', amountInCents: -1230, fitId: null },
];

const DISTINTOS = [
  { date: DATA, description: 'E2E café', amountInCents: -1230, fitId: null },
  { date: DATA, description: 'E2E pão', amountInCents: -230, fitId: null },
];

const resultado = {
  casoControlo: analisar('Controlo — dois movimentos distintos (o ciclo normal)', DISTINTOS),
  casoI11PrimeiraVolta: analisar(
    'I11a — dois movimentos idênticos, lançados à mão (sem fitId na base): exportar e reimportar',
    IDENTICOS,
  ),
  casoI11SegundaVolta: analisar(
    'I11b — os mesmos movimentos depois de já terem sido importados (fitId gravado com sufixo)',
    IDENTICOS,
    existentesDepoisDeImportar,
  ),
  casoNaoDescartarDemais: analisar(
    'Contra-exemplo — um café na conta e dois no ficheiro: o segundo é mesmo novo',
    IDENTICOS,
    existentesParciais(1),
  ),
};

console.log(`\nRESULTADO_JSON_INICIO\n${JSON.stringify(resultado, null, 2)}\nRESULTADO_JSON_FIM`);

const primeiraVoltaFechada = resultado.casoI11PrimeiraVolta.linhasNovas === 0;
const segundaVoltaFechada = resultado.casoI11SegundaVolta.linhasNovas === 0;
const naoDescartaDemais =
  resultado.casoNaoDescartarDemais.linhasNovas === 1 &&
  resultado.casoNaoDescartarDemais.linhasNovas + 1 ===
    resultado.casoNaoDescartarDemais.estadoNaPrevisualizacao.length;

process.exitCode = primeiraVoltaFechada && segundaVoltaFechada && naoDescartaDemais ? 0 : 1;
