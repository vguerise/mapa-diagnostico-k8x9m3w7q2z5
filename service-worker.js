const CACHE_NAME = 'mapa-perfumes-v1';
const BASE_PATH = '/mapa-diagnostico-k8x9m3w7q2z5';
const urlsToCache = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/index.html`,
  `${BASE_PATH}/manifest.json`,
  `${BASE_PATH}/icons/icon-192x192.png`,
  `${BASE_PATH}/icons/icon-512x512.png`
];

// Instalar service worker e fazer cache dos assets
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[ServiceWorker] Cache aberto');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[ServiceWorker] Instalado com sucesso');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[ServiceWorker] Erro ao cachear:', error);
      })
  );
});

// Ativar service worker e limpar caches antigos
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

// Estratégia: Network First com fallback para cache
self.addEventListener('fetch', (event) => {
  // Ignora requisições que não são GET
  if (event.request.method !== 'GET') {
    return;
  }

  // Ignora requisições para APIs externas (Anthropic, Supabase, etc)
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    // Para APIs externas, sempre tenta rede primeiro
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Se a resposta é válida, clona e salva no cache
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });
        }
        return response;
      })
      .catch(() => {
        // Se falhar (offline), tenta buscar do cache
        return caches.match(event.request)
          .then((response) => {
            if (response) {
              console.log('[ServiceWorker] Servindo do cache:', event.request.url);
              return response;
            }
            
            // Se não tem no cache e é uma navegação, retorna página offline
            if (event.request.mode === 'navigate') {
              return caches.match(`${BASE_PATH}/`);
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

// Listener para mensagens do cliente
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

// Sync em background (quando voltar online)
self.addEventListener('sync', (event) => {
  console.log('[ServiceWorker] Sync:', event.tag);
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

async function syncData() {
  // Aqui você pode implementar sincronização de dados
  // quando o usuário voltar online
  console.log('[ServiceWorker] Sincronizando dados...');
}

// Notificações push (futuro)
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'Nova atualização disponível!',
    icon: `${BASE_PATH}/icons/icon-192x192.png`,
    badge: `${BASE_PATH}/icons/icon-72x72.png`,
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };

  event.waitUntil(
    self.registration.showNotification('Mapa da Coleção Perfeita', options)
  );
});

// Click em notificação
self.addEventListener('notificationclick', (event) => {
  console.log('[ServiceWorker] Notificação clicada');
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow(`${BASE_PATH}/`)
  );
});
