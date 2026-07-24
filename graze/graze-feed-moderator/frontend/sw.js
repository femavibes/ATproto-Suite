const CACHE_VERSION = 'v1'
const CACHE_NAME = `modmaster-pwa-${CACHE_VERSION}`

// Only cache essential files, not build assets
const urlsToCache = [
  '/',
  '/manifest.json',
  '/icon-192.svg',
  '/icon-512.svg'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName)
          }
        })
      )
    }).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  // Only cache GET requests
  if (event.request.method !== 'GET') {
    return
  }
  
  // Don't cache build assets (they have hashes)
  if (event.request.url.includes('/assets/')) {
    return
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request)
      })
  )
})

// Push notification handling
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json()
    const options = {
      body: data.body,
      icon: '/icon-192.svg',
      badge: '/icon-192.svg',
      data: data.data
    }
    
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    )
  }
})

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  )
})