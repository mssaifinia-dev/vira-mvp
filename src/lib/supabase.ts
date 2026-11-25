import { createClient } from '@supabase/supabase-js';

/**
 * نشست ورود به‌صورت «کوکی نشست» (Session Cookie) نگه‌داری می‌شود:
 *  - بدون تاریخ انقضا؛ با بستن کامل مرورگر پاک می‌شود.
 *  - بین تب‌ها مشترک است؛ جابه‌جایی بین صفحات و تب‌ها باعث خروج نمی‌شود.
 *  - برای عبور از محدودیت ۴ کیلوبایتی کوکی، مقدار به تکه‌های ۳۰۰۰ کاراکتری تقسیم می‌شود.
 * (توجه: کاربرانی که قبلاً با نسخه‌ی قبلی وارد شده‌اند، یک بار باید دوباره وارد شوند.)
 */
const CHUNK = 3000;

const enc = (s: string) =>
  btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const dec = (s: string) => {
  const b = s.replace(/-/g, '+').replace(/_/g, '/');
  return decodeURIComponent(escape(atob(b + '==='.slice((b.length + 3) % 4))));
};

function getCookie(name: string): string | null {
  const hit = document.cookie.split('; ').find((c) => c.startsWith(name + '='));
  return hit ? hit.slice(name.length + 1) : null;
}
function setCookie(name: string, value: string) {
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  // عمداً Max-Age/Expires ندارد => کوکی نشست
  document.cookie = name + '=' + value + '; Path=/; SameSite=Lax' + secure;
}
function delCookie(name: string) {
  document.cookie = name + '=; Path=/; Max-Age=0; SameSite=Lax';
}

const sessionCookieStorage = {
  getItem(key: string): string | null {
    if (typeof document === 'undefined') return null;
    const n = Number(getCookie(key + '.n'));
    if (!n) return null;
    let out = '';
    for (let i = 0; i < n; i++) {
      const part = getCookie(key + '.' + i);
      if (part === null) return null;
      out += part;
    }
    try { return dec(out); } catch { return null; }
  },
  setItem(key: string, value: string): void {
    if (typeof document === 'undefined') return;
    const data = enc(value);
    const n = Math.ceil(data.length / CHUNK);
    const old = Number(getCookie(key + '.n')) || 0;
    for (let i = 0; i < n; i++) setCookie(key + '.' + i, data.slice(i * CHUNK, (i + 1) * CHUNK));
    for (let i = n; i < old; i++) delCookie(key + '.' + i);
    setCookie(key + '.n', String(n));
  },
  removeItem(key: string): void {
    if (typeof document === 'undefined') return;
    const old = Number(getCookie(key + '.n')) || 0;
    for (let i = 0; i < old; i++) delCookie(key + '.' + i);
    delCookie(key + '.n');
  },
};

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: sessionCookieStorage,
      storageKey: 'vira-auth',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
