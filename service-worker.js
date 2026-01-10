const CACHE_NAME = 'mapa-perfumes-v3';
const BASE_PATH = '';

// Lista de arquivos essenciais para cachear
const ESSENTIAL_FILES = [
  './',
  './index.html',
  './manifest.json'
];

// Instalar service worker e cachear arquivos essenciais
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Instalando versão:', CACHE_NAME);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[ServiceWorker] Cacheando arquivos essenciais...');
        // Tenta cachear mas não falha se algum arquivo não existir
        return cache.addAll(ESSENTIAL_FILES).catch(err => {
          console.warn('[ServiceWorker] Alguns arquivos não foram cacheados:', err);
          return Promise.resolve();
        });
      })
      .then(() => {
        console.log('[ServiceWorker] Instalado com sucesso!');
        return self.skipWaiting();
      })
  );
});

// Ativar service worker e limpar caches antigos
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Ativando versão:', CACHE_NAME);
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[ServiceWorker] Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[ServiceWorker] Ativado!');
      return self.clients.claim();
    })
  );
});

// Estratégia: Network First (sempre tenta buscar online primeiro)
self.addEventListener('fetch', (event) => {
  // Ignora requisições que não são GET
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);
  
  // Ignora requisições para APIs externas
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Se conseguiu buscar, cacheia dinamicamente
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Se offline, busca do cache
        return caches.match(event.request).then((response) => {
          if (response) {
            console.log('[ServiceWorker] Servindo do cache:', event.request.url);
            return response;
          }
          
          // Se é uma navegação e não tem no cache, mostra a página principal
          if (event.request.mode === 'navigate') {
            return caches.match('./');
          }
          
          // Retorna resposta de offline
          return new Response('Offline - Conteúdo não disponível', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'text/plain; charset=utf-8'
            })
          });
        });
      })
  );
});

// Listener para mensagens
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      }).then(() => {
        console.log('[ServiceWorker] Cache limpo');
      })
    );
  }
});

console.log('[ServiceWorker] Script carregado - Versão:', CACHE_NAME);
