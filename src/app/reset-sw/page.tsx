'use client';

import { useState } from 'react';
import Link from 'next/link';

/** ابزار پاک‌سازی دستی: Service Worker و کش‌های ذخیره‌شده‌ی این سایت را روی همین مرورگر حذف می‌کند. */
export default function ResetServiceWorkerPage() {
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function reset() {
    setBusy(true);
    const lines: string[] = [];
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const r of regs) {
          await r.unregister();
          lines.push('Service Worker حذف شد: ' + r.scope);
        }
        if (regs.length === 0) lines.push('Service Worker ثبت‌شده‌ای وجود نداشت.');
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        for (const k of keys) {
          await caches.delete(k);
          lines.push('کش پاک شد: ' + k);
        }
        if (keys.length === 0) lines.push('کشی برای پاک‌کردن وجود نداشت.');
      }
      lines.push('✓ انجام شد. صفحه را یک‌بار تازه کنید (Ctrl+F5).');
    } catch (e: any) {
      lines.push('خطا: ' + (e?.message || e));
    }
    setLog(lines);
    setBusy(false);
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f3f4f6', padding: '32px 16px' }} dir="rtl">
      <div style={{ maxWidth: '520px', margin: '0 auto', background: 'white', borderRadius: '16px', padding: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 'bold', color: '#1e3a8a', marginBottom: '8px' }}>پاک‌سازی حافظه‌ی نهان سایت</h1>
        <p style={{ color: '#6b7280', fontSize: '14px', lineHeight: 1.9, marginBottom: '16px' }}>
          اگر سایت قدیمی یا کند نشان داده می‌شود، این دکمه Service Worker و کش‌های ذخیره‌شده‌ی ویرا را فقط روی همین مرورگر پاک می‌کند.
          اطلاعات حساب و سفارش‌ها دست نمی‌خورد.
        </p>
        <button
          onClick={reset}
          disabled={busy}
          style={{ width: '100%', padding: 14, background: '#1e3a8a', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', opacity: busy ? 0.7 : 1 }}
        >
          {busy ? 'در حال پاک‌سازی...' : 'پاک‌سازی Service Worker و کش'}
        </button>
        {log.length > 0 && (
          <ul style={{ marginTop: '16px', fontSize: '13px', color: '#374151', lineHeight: 2, paddingRight: '18px' }}>
            {log.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        )}
        <Link href="/" style={{ display: 'inline-block', marginTop: '16px', color: '#1e3a8a', fontSize: '14px' }}>
          ← بازگشت به صفحه اول
        </Link>
      </div>
    </main>
  );
}
