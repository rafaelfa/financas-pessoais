/**
 * Service worker da aplicação.
 *
 * REGRA INEGOCIÁVEL: **nunca se guarda em cache uma resposta com dados do
 * utilizador.** Um saldo desatualizado mostrado como atual é pior do que um ecrã
 * a dizer «sem ligação» — numa aplicação de finanças é assim que se perde a
 * confiança. Por isso não entram em cache páginas autenticadas, pedidos RSC
 * (`?_rsc=`, cabeçalho `RSC`), respostas de API nem nada de `/api/auth/**`.
 *
 * O que este ficheiro faz, e onde:
 *
 * 1. `install` — pré-cacheia só o que é estático e público: a página offline, os
 *    ícones e o manifest. **Não** chama `skipWaiting()`: a versão nova fica à
 *    espera e é o utilizador que decide quando a aplicar (aviso de nova versão).
 * 2. `fetch` — três caminhos, por ordem:
 *    - **navegações** (documentos HTML): rede primeiro. Se a rede falhar,
 *      responde com `offline.html` (503, `no-store`). O HTML da aplicação nunca
 *      é guardado: vem com dados do utilizador lá dentro;
 *    - **estáticos** (`/_next/static/**`, ícones, manifest, `offline.html`):
 *      cache primeiro. São imutáveis por construção (têm hash no nome) e não
 *      contêm dados de ninguém;
 *    - **todo o resto**: segue direto para a rede, sem `respondWith` e sem
 *      cache. É aqui que ficam os dados do utilizador.
 * 3. `activate` — apaga as caches de versões anteriores.
 * 4. `message` — `SKIP_WAITING` aplica a versão nova, quando o utilizador
 *    carrega em «Atualizar» no aviso.
 *
 * Consequência assumida e deliberada: **as páginas da aplicação não funcionam
 * offline**. Sem rede aparece a página offline, com instruções — nunca números
 * possivelmente velhos.
 */

/* Ao mudar o conteúdo do shell, subir a versão: é o que invalida a cache antiga. */
const VERSION = '1';
const SHELL_CACHE = `financas-shell-v${VERSION}`;

/**
 * Pré-cache: apenas ficheiros públicos e estáticos.
 *
 * Os pedaços de JavaScript e CSS do Next (`/_next/static/**`) não estão aqui
 * porque têm hash no nome e só se conhecem quando a página os pede; entram em
 * cache na primeira visita, no caminho de cache do `fetch`.
 */
const SHELL_ASSETS = [
  '/offline.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
];

/**
 * Caminhos que podem ser guardados em cache.
 *
 * Lista branca, não lista negra: o que não está aqui nunca é guardado. Uma lista
 * negra deixaria escapar qualquer rota nova que alguém acrescentasse — e nessa
 * rota podem estar os dados de alguém.
 */
const CACHEABLE_PREFIXES = ['/_next/static/', '/icons/'];

const CACHEABLE_EXACT = ['/offline.html', '/manifest.webmanifest'];

/** Estático, público e imutável? (nunca contém dados do utilizador) */
function isCacheableStatic(pathname) {
  if (CACHEABLE_EXACT.includes(pathname)) {
    return true;
  }

  return CACHEABLE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/** Pedido de dados do utilizador? (nunca pode ser guardado) */
function isUserDataRequest(request, url) {
  if (url.searchParams.has('_rsc') || request.headers.get('RSC') === '1') {
    return true;
  }

  return (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/entrar') ||
    url.pathname.startsWith('/registar')
  );
}

/**
 * Página offline guardada em cache.
 *
 * Se por alguma razão o `offline.html` não estiver em cache (instalação
 * interrompida), devolve uma resposta mínima mas legível em vez de deixar o
 * browser mostrar o seu próprio ecrã de erro.
 */
async function offlineResponse() {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match('/offline.html');

  if (cached !== undefined) {
    return cached;
  }

  return new Response(
    '<!doctype html><html lang="pt-PT"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sem ligação</title><body style="font-family:system-ui,sans-serif;margin:2rem;line-height:1.5"><h1>Sem ligação</h1><p>A aplicação precisa de internet para mostrar os teus números. Não mostramos saldos guardados de propósito: um valor desatualizado é pior do que este aviso.</p><p><button onclick="location.reload()">Tentar outra vez</button></p></body></html>',
    {
      status: 503,
      statusText: 'Offline',
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    },
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);

      /*
       * Um `addAll` falharia por inteiro se um único ficheiro faltasse; com
       * pedidos individuais, um ícone em falta não impede a página offline de
       * ficar guardada.
       */
      await Promise.all(
        SHELL_ASSETS.map(async (asset) => {
          try {
            await cache.add(new Request(asset, { cache: 'reload' }));
          } catch (error) {
            console.warn('[sw] não consegui pré-cachear', asset, error);
          }
        }),
      );

      // Sem `skipWaiting()` de propósito: a versão nova fica à espera e só é
      // aplicada quando o utilizador carrega em «Atualizar».
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();

      await Promise.all(
        names
          .filter((name) => name.startsWith('financas-shell-') && name !== SHELL_CACHE)
          .map((name) => caches.delete(name)),
      );

      // Assume já as páginas abertas: é o que faz o aviso de nova versão surtir
      // efeito sem obrigar a fechar a aplicação.
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data !== null && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Escritas nunca passam pelo service worker.
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Outras origens (fontes, por exemplo): deixa o browser tratar.
  if (url.origin !== self.location.origin) {
    return;
  }

  /*
   * Dados do utilizador: **sem `respondWith`** — o pedido vai direto à rede e
   * não há sequer oportunidade de o guardar. Offline, falha como falharia sem
   * service worker, e a aplicação mostra o seu próprio erro.
   */
  if (isUserDataRequest(request, url)) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          return offlineResponse();
        }
      })(),
    );

    return;
  }

  if (!isCacheableStatic(url.pathname)) {
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      const cached = await cache.match(request);

      if (cached !== undefined) {
        return cached;
      }

      try {
        const response = await fetch(request);

        // Só respostas completas e bem-sucedidas entram em cache: uma resposta
        // opaca ou parcial (206) não serve para reutilizar.
        if (response.ok && response.status === 200 && response.type === 'basic') {
          cache.put(request, response.clone());
        }

        return response;
      } catch (error) {
        // Estático em falta e sem rede: não há nada a fazer além de falhar.
        throw error;
      }
    })(),
  );
});
