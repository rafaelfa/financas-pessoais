import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { expect, test, type CDPSession, type Page } from '@playwright/test';

import { abrirRota } from './support/ui';

/**
 * Orçamentos de desempenho **medidos**, não metas inventadas.
 *
 * Metodologia, para o número ser reproduzível e interpretável:
 * - o servidor é o `next dev` levantado pelo `playwright.config.ts` (nesta
 *   máquina o `next build` está bloqueado por `spawn EPERM`). **Os números são
 *   um limite superior**: em `dev` o JavaScript vai por módulos, sem minificação
 *   nem *tree shaking*, e o primeiro acesso a cada rota compila-a. A primeira
 *   navegação de cada rota é descartada como aquecimento;
 * - a cache do browser é desligada por CDP (`Network.setCacheDisabled`), para
 *   medir transferência de rede a frio;
 * - mede-se `responseStart` (TTFB), `domContentLoadedEventEnd` e `loadEventEnd`
 *   da `PerformanceNavigationTiming`, mais os pedidos e os bytes de *script* que
 *   o CDP contabiliza;
 * - o p95 é o **posto mais próximo** (`ceil(0,95 × n)`) e o `n` de cada rota vai
 *   no artefacto: com n = 5, o p95 é o máximo observado.
 *
 * O resultado fica em `e2e/.results/desempenho.json` e é o que o relatório
 * `docs/spec/T8.4-e2e-e-desempenho.md` cita.
 */

interface Amostra {
  readonly ttfbMs: number;
  readonly domContentLoadedMs: number;
  readonly loadMs: number;
  readonly pedidos: number;
  readonly bytesDeScript: number;
  readonly bytesTotais: number;
}

interface ResumoDaPagina {
  readonly rota: string;
  readonly amostras: number;
  readonly ttfbP95Ms: number;
  readonly domContentLoadedP95Ms: number;
  readonly loadP95Ms: number;
  readonly loadMaxMs: number;
  readonly pedidosMedios: number;
  readonly pedidosMax: number;
  readonly scriptMedioKb: number;
  readonly totalMedioKb: number;
}

const PAGINAS: readonly { readonly rota: string; readonly amostras: number }[] = [
  { rota: '/', amostras: 10 },
  { rota: '/transacoes', amostras: 10 },
  { rota: '/contas', amostras: 10 },
  { rota: '/importar', amostras: 10 },
  { rota: '/orcamento', amostras: 5 },
  { rota: '/objetivos', amostras: 5 },
  { rota: '/relatorios', amostras: 5 },
];

/** p95 pelo posto mais próximo, sobre uma lista de números. */
function p95(valores: readonly number[]): number {
  const ordenados = [...valores].sort((a, b) => a - b);
  const posto = Math.max(0, Math.ceil(0.95 * ordenados.length) - 1);

  return ordenados[posto] ?? 0;
}

function media(valores: readonly number[]): number {
  if (valores.length === 0) {
    return 0;
  }

  return Math.round(valores.reduce((total, valor) => total + valor, 0) / valores.length);
}

/** Contadores de rede de uma navegação, alimentados pelo CDP. */
interface Contadores {
  pedidos: number;
  bytesTotais: number;
  bytesDeScript: number;
  readonly scripts: Set<string>;
}

async function umaNavegacao(page: Page, rota: string, contadores: Contadores): Promise<Amostra> {
  contadores.pedidos = 0;
  contadores.bytesTotais = 0;
  contadores.bytesDeScript = 0;
  contadores.scripts.clear();

  const resposta = await page.goto(rota, { waitUntil: 'load' });
  const estado = resposta?.status() ?? 0;

  expect(estado, `A rota ${rota} respondeu ${estado}.`).toBeLessThan(500);

  // Os eventos `loadingFinished` do CDP chegam depois do `load` do browser.
  await page.waitForTimeout(400);

  const tempo = await page.evaluate(() => {
    const navegacao = performance.getEntriesByType('navigation')[0] as
      PerformanceNavigationTiming | undefined;

    return {
      ttfbMs: Math.round(navegacao?.responseStart ?? 0),
      domContentLoadedMs: Math.round(navegacao?.domContentLoadedEventEnd ?? 0),
      loadMs: Math.round(navegacao?.loadEventEnd ?? 0),
    };
  });

  return {
    ...tempo,
    pedidos: contadores.pedidos,
    bytesDeScript: contadores.bytesDeScript,
    bytesTotais: contadores.bytesTotais,
  };
}

test.describe.configure({ timeout: 900_000 });

test.describe('Desempenho — páginas principais', () => {
  test('mede o carregamento, o bundle inicial e o número de pedidos', async ({ page, context }) => {
    const cdp: CDPSession = await context.newCDPSession(page);

    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });

    const contadores: Contadores = {
      pedidos: 0,
      bytesTotais: 0,
      bytesDeScript: 0,
      scripts: new Set<string>(),
    };

    cdp.on('Network.requestWillBeSent', () => {
      contadores.pedidos += 1;
    });

    cdp.on('Network.responseReceived', (evento) => {
      if (evento.type === 'Script') {
        contadores.scripts.add(evento.requestId);
      }
    });

    cdp.on('Network.loadingFinished', (evento) => {
      contadores.bytesTotais += evento.encodedDataLength;

      if (contadores.scripts.has(evento.requestId)) {
        contadores.bytesDeScript += evento.encodedDataLength;
      }
    });

    const paginas: ResumoDaPagina[] = [];
    let bundleInicial: Amostra | undefined;

    for (const { rota, amostras } of PAGINAS) {
      // Aquecimento: em `dev`, a primeira visita compila a rota.
      await abrirRota(page, rota);

      const medidas: Amostra[] = [];

      for (let i = 0; i < amostras; i += 1) {
        const medida = await umaNavegacao(page, rota, contadores);

        medidas.push(medida);

        if (rota === '/' && i === 0) {
          bundleInicial = medida;
        }
      }

      const resumo: ResumoDaPagina = {
        rota,
        amostras: medidas.length,
        ttfbP95Ms: p95(medidas.map((medida) => medida.ttfbMs)),
        domContentLoadedP95Ms: p95(medidas.map((medida) => medida.domContentLoadedMs)),
        loadP95Ms: p95(medidas.map((medida) => medida.loadMs)),
        loadMaxMs: Math.max(...medidas.map((medida) => medida.loadMs)),
        pedidosMedios: media(medidas.map((medida) => medida.pedidos)),
        pedidosMax: Math.max(...medidas.map((medida) => medida.pedidos)),
        scriptMedioKb: Math.round(media(medidas.map((medida) => medida.bytesDeScript)) / 1024),
        totalMedioKb: Math.round(media(medidas.map((medida) => medida.bytesTotais)) / 1024),
      };

      paginas.push(resumo);

      console.log(
        `[desempenho] ${rota} (n=${String(resumo.amostras)}): load p95 ${String(resumo.loadP95Ms)} ms, ` +
          `${String(resumo.pedidosMedios)} pedidos, ${String(resumo.scriptMedioKb)} kB de script`,
      );
    }

    const artefacto = {
      quando: new Date().toISOString(),
      baseUrl: page.url().startsWith('http') ? new URL(page.url()).origin : 'http://localhost:3000',
      servidor: 'next dev (Playwright webServer) — limites superiores, ver o cabeçalho do spec',
      cacheDoBrowser: 'desligada por CDP',
      paginas,
      bundleInicial:
        bundleInicial === undefined
          ? null
          : {
              rota: '/',
              pedidos: bundleInicial.pedidos,
              scriptKb: Math.round(bundleInicial.bytesDeScript / 1024),
              totalKb: Math.round(bundleInicial.bytesTotais / 1024),
            },
    };

    const pasta = resolve(process.cwd(), 'e2e', '.results');

    mkdirSync(pasta, { recursive: true });
    writeFileSync(
      resolve(pasta, 'desempenho.json'),
      `${JSON.stringify(artefacto, null, 2)}\n`,
      'utf8',
    );

    expect(paginas).toHaveLength(PAGINAS.length);
  });
});
