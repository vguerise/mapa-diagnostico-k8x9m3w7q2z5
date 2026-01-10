const CACHE_NAME = 'mapa-perfumes-v2';
const BASE_PATH = '/mapa-diagnostico-k8x9m3w7q2z5';

// Instalar service worker SEM cachear na instalação
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Instalando...');
  event.waitUntil(
    Promise.resolve()
      .then(() => {
        console.log('[ServiceWorker] Instalado com sucesso (sem cache inicial)');
        return self.skipWaiting();
      })
  );
});

// Ativar service worker
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Ativando...');
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
      console.log('[ServiceWorker] Ativado');
      return self.clients.claim();
    })
  );
});

// Cache dinâmico: cacheia conforme usa
self.addEventListener('fetch', (event) => {
  // Ignora requisições que não são GET
  if (event.request.method !== 'GET') {
    return;
  }

  // Ignora requisições para APIs externas
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cacheia dinamicamente recursos estáticos
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
              console.log('[ServiceWorker] Cacheado:', event.request.url);
            });
        }
        return response;
      })
      .catch(() => {
        // Se offline, tenta buscar do cache
        return caches.match(event.request)
          .then((response) => {
            if (response) {
              console.log('[ServiceWorker] Servindo do cache:', event.request.url);
              return response;
            }
            
            if (event.request.mode === 'navigate') {
              return caches.match`${BASE_PATH}/`);
            }
            
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
