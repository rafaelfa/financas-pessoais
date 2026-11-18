import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

/**
 * Guarda os artefactos de uma corrida e2e falhada.
 *
 * O Playwright escreve `test-results/` e **limpa-o no arranque seguinte**, por isso
 * o `trace.zip` de um `flake` desaparece antes de alguém o poder ler — foi o que
 * aconteceu ao vermelho da T62, e é a razão de este ficheiro existir. O
 * `trace`/`screenshot` só são guardados em falha (`retain-on-failure`,
 * `only-on-failure`), portanto «há artefactos» é o mesmo que «houve falha».
 *
 * Os caminhos são ancorados a este ficheiro, não ao `cwd`: `node scripts/qa-e2e.mjs`
 * a partir de outra pasta tem de procurar `test-results/` no repositório e não no
 * sítio de onde foi chamado.
 */

const RAIZ = dirname(dirname(fileURLToPath(import.meta.url)));
const ORIGEM = join(RAIZ, 'test-results');
const DESTINO_BASE = join(RAIZ, 'relatorios', '.falhas');

/** Os três tipos que interessam: o trace, a captura da falha e o contexto do erro. */
const PADROES = [/^trace\.zip$/, /^test-failed-.*\.(png|jpe?g|webm)$/, /^error-context\.md$/];

function ehArtefacto(nome) {
  return PADROES.some((padrao) => padrao.test(nome));
}

/** Todos os ficheiros abaixo de uma pasta, recursivamente. */
function ficheirosEm(pasta) {
  const encontrados = [];

  for (const entrada of readdirSync(pasta, { withFileTypes: true })) {
    const caminho = join(pasta, entrada.name);

    if (entrada.isDirectory()) {
      encontrados.push(...ficheirosEm(caminho));
    } else if (ehArtefacto(entrada.name)) {
      encontrados.push(caminho);
    }
  }

  return encontrados;
}

/**
 * `2026-11-18T00-30-07` — ordenável e válido em qualquer sistema de ficheiros.
 *
 * No fuso de **Lisboa**, como o resto do projeto (`todayInLisbon`): em UTC, uma
 * corrida às 00:30 de Lisboa caía na pasta do dia anterior, e esta pasta é prova.
 */
export function marcaTemporal(data = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Lisbon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(data);
  const valor = (tipo) => partes.find((parte) => parte.type === tipo)?.value ?? '00';

  return `${valor('year')}-${valor('month')}-${valor('day')}T${valor('hour')}-${valor('minute')}-${valor('second')}`;
}

export function guardarArtefactos() {
  if (!existsSync(ORIGEM) || !statSync(ORIGEM).isDirectory()) {
    console.log(`[artefactos] nada a guardar: ${ORIGEM} não existe.`);
    return null;
  }

  const ficheiros = ficheirosEm(ORIGEM);

  if (ficheiros.length === 0) {
    console.log('[artefactos] nada a guardar: não há trace, captura nem contexto.');
    return null;
  }

  const destino = join(DESTINO_BASE, marcaTemporal());
  mkdirSync(destino, { recursive: true });

  for (const ficheiro of ficheiros) {
    const alvo = join(destino, relative(ORIGEM, ficheiro));
    mkdirSync(dirname(alvo), { recursive: true });
    copyFileSync(ficheiro, alvo);
  }

  console.log(`[artefactos] ${ficheiros.length} ficheiro(s) → ${destino}`);
  for (const ficheiro of ficheiros) {
    console.log(`  · ${relative(ORIGEM, ficheiro)}`);
  }

  return destino;
}

// Uso directo: `pnpm qa:artefactos` recupera o que ainda estiver em `test-results/`.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  guardarArtefactos();
}
