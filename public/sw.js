// Service Worker برای PWA ویرا
// نکته: این SW عمداً محتاطانه طراحی شده تا با API ها، پنل ادمین و داده‌های زنده Supabase تداخل نکنه.

const CACHE_NAME = 'vira-cache-v1';
const OFFLINE_URL = '/';

const PRECACHE_ASSETS = [
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// نصب: کش کردن حداقل فایل‌های لازم (app shell)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting();
});

// فعال‌سازی: پاک کردن کش‌های نسخه‌ی قدیمی
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// درخواست‌ها: هرگز API، ادمین، و درخواست‌های غیر-GET رو دست‌کاری نکن
function shouldBypass(request, url) {
  if (request.method !== 'GET') return true;
  if (url.pathname.startsWith('/api/')) return true;
  if (url.pathname.startsWith('/admin')) return true;
  if (url.origin.includes('supabase.co')) return true;
  return false;
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (shouldBypass(event.request, url)) {
    return; // بذار مرورگر عادی هندلش کنه، SW دخالت نمی‌کنه
  }

  // برای صفحات (navigation): اول شبکه، اگه آفلاین بود از کش/صفحه اصلی استفاده کن
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(OFFLINE_URL).then((res) => res || caches.match(event.request))
      )
    );
    return;
  }

  // برای فایل‌های استاتیک (عکس، آیکون، فونت): اول کش، بعد شبکه
  if (
    event.request.destination === 'image' ||
    event.request.destination === 'font' ||
    url.pathname.startsWith('/icons/')
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        });
      })
    );
  }
});
