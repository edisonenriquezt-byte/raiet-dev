const CACHE_NAME = 'raiet-suite-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// 1. Instalación: Descarga y guarda en caché la aplicación completa
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('📦 [Service Worker] Guardando archivos base en caché local...');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// 2. Activación: Limpia versiones antiguas si se actualiza el Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('🧹 [Service Worker] Eliminando caché antigua:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Estrategia de respuesta: Network First con fallback a Caché
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Ignorar llamadas directas a la API de Supabase (las maneja la cola outbox de index.html)
  if (url.includes('.supabase.co/rest/v1/')) {
    return;
  }

  // Para navegación y archivos estáticos de la aplicación
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Si hay internet, actualizamos la copia en caché en segundo plano
        if (event.request.method === 'GET' && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      })
      .catch(() => {
        // Si NO hay internet (Modo Avión / Sin datos), servimos desde la memoria local
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Si es una petición de navegación (abrir la app), devolvemos index.html
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html') || caches.match('./');
          }
        });
      })
  );
});
