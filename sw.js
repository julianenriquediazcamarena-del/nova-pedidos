// Guarda los archivos de la app para que abra aunque no haya internet.
// Al publicar cambios, sube el número de VERSION para que los dispositivos tomen la versión nueva.
const VERSION = 'nova-pedidos-v15';
const ARCHIVOS = [
  './', 'index.html', 'css/app.css', 'manifest.webmanifest',
  'js/config.js', 'js/util.js', 'js/db.js', 'js/sync.js', 'js/precios.js', 'js/kpis.js', 'js/costos.js', 'js/comisiones.js', 'js/adjuntos.js', 'js/factura.js', 'js/graficas.js', 'js/playeras.js', 'js/lineas.js', 'js/nota-imagen.js', 'js/app.js',
  'js/vistas/panel.js', 'js/vistas/catalogo.js', 'js/vistas/calculadora.js', 'js/vistas/cotizaciones.js',
  'js/vistas/pedidos.js', 'js/vistas/contactos.js', 'js/vistas/ajustes.js', 'js/vistas/desempeno.js', 'js/vistas/comisiones.js',
  'img/wordmark.png', 'img/isotipo.png', 'icons/icono-192.png', 'icons/icono-512.png',
  'fonts/inter-latin-400-normal.woff2', 'fonts/inter-latin-600-normal.woff2', 'fonts/poppins-latin-700-normal.woff2',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(claves => Promise.all(claves.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Archivos propios: primero la red (para ver cambios), si no hay internet, la copia guardada.
// Las peticiones a Supabase no pasan por aquí.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then(r => { const copia = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copia)); return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
