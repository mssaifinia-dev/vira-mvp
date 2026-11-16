/*
 * Vira Service Worker  (v3)
 *
 * سیاست کش:
 *  - فقط ریشه‌ی هم‌مبدأ (same-origin) و فقط GET دست‌کاری می‌شود. Supabase، فونت‌ها، ویدئو، تصویر تبلیغات و هر دامنه‌ی بیرونی
 *    اصلاً از SW عبور نمی‌کند.
 *  - هرگز کش نمی‌شود: /api، مسیرهای ادمین، احراز هویت، RSC/داده‌ی Next (?_rsc، هدر RSC، /_next/data)، /_next/image،
 *    درخواست‌های Range (ویدئو)، و هر چیز مربوط به HMR/توسعه. صفحه‌ها (HTML) همیشه از شبکه خوانده می‌شوند.
 *  - کش می‌شود: /_next/static/* (نام‌فایل‌ها هش‌دار و تغییرناپذیر؛ cache-first) و تصویرهای عمومی (آیکون/لوگو/تصویر استاتیک؛
 *    stale-while-revalidate تا نسخه‌ی تازه از دور خارج نماند).
 *  - تنها «نسخه‌ی آفلاین صفحه‌ی اول» ذخیره می‌شود و با هر ورود موفق به «/» تازه می‌شود.
 *  - روی localhost هیچ‌وقت فعال نمی‌شود؛ اگر نسخه‌ی قبلی آنجا ثبت شده باشد، خودش را پاک و حذف می‌کند.
 */
const VERSION = 'v3';
const STATIC_CACHE = 'vira-static-' + VERSION;
const ASSET_CACHE = 'vira-assets-' + VERSION;
const PAGE_CACHE = 'vira-pages-' + VERSION;
const KNOWN_CACHES = [STATIC_CACHE, ASSET_CACHE, PAGE_CACHE];

const OFFLINE_URL = '/';
const PRECACHE = ['/', '/manifest.json', '/icons/icon-192x192.png', '/icons/icon-512x512.png'];
const MAX_STATIC_ENTRIES = 250;
const MAX_ASSET_ENTRIES = 80;

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]', '::1'];
const IS_LOCAL = LOCAL_HOSTS.indexOf(self.location.hostname) !== -1 || self.location.hostname.endsWith('.localhost');

if (IS_LOCAL) {
  // ---- localhost: SW فعال نمی‌شود و بقایای نسخه‌های قبلی پاک می‌شود (بدون fetch handler = همه‌چیز مستقیم از شبکه) ----
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', (event) => {
    event.waitUntil(
      (async () => {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
        await self.registration.unregister();
        const clients = await self.clients.matchAll({ type: 'window' });
        clients.forEach((c) => c.navigate(c.url)); // صفحه دیگر زیر کنترل SW نباشد
      })()
    );
  });
} else {
  // ------------------------------ Production ------------------------------
  self.addEventListener('install', (event) => {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(PAGE_CACHE);
        // کمبود یک فایل نباید نصب را خراب کند (cache.addAll همه یا هیچ است)
        await Promise.allSettled(
          PRECACHE.map(async (path) => {
            const res = await fetch(path, { cache: 'reload' });
            if (res.ok) await cache.put(path, res);
          })
        );
      })()
    );
    self.skipWaiting();
  });

  self.addEventListener('activate', (event) => {
    event.waitUntil(
      (async () => {
        // همه‌ی کش‌های نسخه‌های قبلی (از جمله vira-cache-v2 که RSC و صفحه‌های قدیمی داشت) حذف می‌شود
        const keys = await caches.keys();
        await Promise.all(keys.filter((k) => KNOWN_CACHES.indexOf(k) === -1).map((k) => caches.delete(k)));
        // سرعت: درخواست صفحه هم‌زمان با بالا آمدن SW از شبکه شروع شود
        if (self.registration.navigationPreload) {
          try { await self.registration.navigationPreload.enable(); } catch (e) { /* ignore */ }
        }
        await self.clients.claim();
      })()
    );
  });

  self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING') self.skipWaiting();
    if (event.data === 'CLEAR_CACHES') event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))));
  });

  function shouldBypass(request, url) {
    const p = url.pathname;
    if (request.method !== 'GET') return true;
    if (url.origin !== self.location.origin) return true;                       // Supabase، فونت، ویدئو، تصویر خارجی، ...
    if (p.startsWith('/api')) return true;                                      // API
    if (p.startsWith('/admin')) return true;                                    // پنل مدیریت
    if (p.startsWith('/auth')) return true;                                     // احراز هویت
    if (p.startsWith('/_next/data') || p.startsWith('/_next/image')) return true; // داده/تصویر بهینه‌شده‌ی Next
    if (p.indexOf('/_next/webpack-hmr') !== -1 || p.startsWith('/__nextjs') || p.indexOf('hot-update') !== -1) return true;
    if (url.searchParams.has('_rsc')) return true;                              // RSC
    const h = request.headers;
    if (h.get('RSC') || h.get('Next-Router-State-Tree') || h.get('Next-Router-Prefetch') || h.get('Next-Action') || h.get('Next-Url')) return true;
    if (h.get('Range')) return true;                                            // ویدئو/صوت
    if ((h.get('Accept') || '').indexOf('text/event-stream') !== -1) return true;
    return false;
  }

  function isPublicAsset(url) {
    const p = url.pathname;
    if (p.startsWith('/icons/') || p.startsWith('/images/') || p.startsWith('/abouts/')) return true;
    return p === '/manifest.json' || /^\/[^/]+\.(png|jpe?g|svg|webp|gif|ico)$/i.test(p);
  }

  async function trim(cacheName, max) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
  }

  async function cacheFirst(request, cacheName, max) {
    const cache = await caches.open(cacheName);
    const hit = await cache.match(request);
    if (hit) return hit;
    const res = await fetch(request);
    if (res && res.status === 200 && res.type === 'basic') {
      await cache.put(request, res.clone());
      trim(cacheName, max);
    }
    return res;
  }

  async function staleWhileRevalidate(event, cacheName, max) {
    const cache = await caches.open(cacheName);
    const hit = await cache.match(event.request);
    const refresh = fetch(event.request)
      .then(async (res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          await cache.put(event.request, res.clone());
          trim(cacheName, max);
        }
        return res;
      })
      .catch(() => null);
    if (hit) { event.waitUntil(refresh); return hit; }
    return (await refresh) || Response.error();
  }

  function rememberHome(event, response) {
    if (new URL(event.request.url).pathname === OFFLINE_URL && response.ok && response.type === 'basic' && !response.redirected) {
      event.waitUntil(caches.open(PAGE_CACHE).then((c) => c.put(OFFLINE_URL, response)));
    }
  }

  async function handleNavigation(event) {
    try {
      const preload = await event.preloadResponse;
      const response = preload || (await fetch(event.request));
      rememberHome(event, response.clone());
      return response; // صفحه همیشه از شبکه؛ هیچ‌وقت HTML قدیمی برنمی‌گردد
    } catch (err) {
      const cache = await caches.open(PAGE_CACHE);
      const fallback = await cache.match(OFFLINE_URL);
      return fallback || new Response('آفلاین هستید. اتصال اینترنت را بررسی کنید.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  }

  self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);

    if (request.mode === 'navigate') {
      if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api')) return;
      event.respondWith(handleNavigation(event));
      return;
    }
    if (shouldBypass(request, url)) return;                                     // مستقیم به شبکه؛ SW دخالت نمی‌کند

    if (url.pathname.startsWith('/_next/static/')) { event.respondWith(cacheFirst(request, STATIC_CACHE, MAX_STATIC_ENTRIES)); return; }
    if (isPublicAsset(url)) { event.respondWith(staleWhileRevalidate(event, ASSET_CACHE, MAX_ASSET_ENTRIES)); return; }
    // هر چیز دیگر: مدیریت نمی‌شود (کش HTTP خود مرورگر)
  });
}
