'use client';

import { useEffect } from 'react';

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]', '::1'];
const isLocalHost = (host: string) => LOCAL_HOSTS.includes(host) || host.endsWith('.localhost');

/** همه‌ی ثبت‌های Service Worker و کش‌های این مبدأ را پاک می‌کند. */
async function removeEverything(): Promise<boolean> {
  let removed = false;
  const regs = await navigator.serviceWorker.getRegistrations();
  for (const r of regs) if (await r.unregister()) removed = true;
  if ('caches' in window) {
    for (const key of await caches.keys()) {
      await caches.delete(key);
      removed = true;
    }
  }
  return removed;
}

export default function RegisterSW() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Development و localhost: ثبت/فعال‌سازی ممنوع؛ هر Service Worker و کشی که قبلاً ثبت شده باشد پاک می‌شود.
    const enabled = process.env.NODE_ENV === 'production' && !isLocalHost(window.location.hostname);
    if (!enabled) {
      const wasControlled = !!navigator.serviceWorker.controller;
      removeEverything()
        .then((removed) => {
          // همین صفحه هنوز از مسیر SW قبلی آمده؛ یک‌بار بارگذاری دوباره تا مستقیم از شبکه بیاید
          if (wasControlled && removed && !sessionStorage.getItem('vira-sw-cleaned')) {
            sessionStorage.setItem('vira-sw-cleaned', '1');
            window.location.reload();
          }
        })
        .catch(() => {});
      return;
    }

    // Production: ثبت بعد از اتمام بارگذاری صفحه تا با منابع صفحه رقابت نکند
    const register = () =>
      navigator.serviceWorker
        .register('/sw.js', { updateViaCache: 'none' })
        .then((reg) => reg.update().catch(() => {}))
        .catch((err) => console.error('SW registration failed:', err));

    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  return null;
}
