// ابزار مشترک برای پاک‌سازی و اعتبارسنجی آدرس‌ها (تبلیغات، ویدئو، ...).

// نویسه‌های نامرئی که هنگام کپی از متن راست‌به‌چپ یا پیام‌رسان‌ها به ابتدای لینک می‌چسبند
// (و باعث می‌شوند مرورگر «https://» را پروتکل نشناسد و لینک را نسبت به دامنه‌ی خودمان بسازد)
const HIDDEN_CHARS = /[\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\u00AD\uFEFF]/g;

const SITE_HOSTS = ['tamin-vira.ir', 'www.tamin-vira.ir'];
const UNSAFE_SCHEME = /^(javascript|data|vbscript|file|blob|about|ftp|mailto|tel|sms|intent|chrome|view-source):/i;
const DOMAIN_LIKE = /^(?:[a-z0-9\u0600-\u06ff](?:[a-z0-9\u0600-\u06ff-]*[a-z0-9\u0600-\u06ff])?\.)+[a-z\u0600-\u06ff]{2,}(?::\d{2,5})?(?:[\/?#].*)?$/i;

export type LinkInfo = {
  href: string;        // آدرس نهایی که باید در href قرار بگیرد
  external: boolean;   // true = دامنه‌ی بیرونی (تب جدید + noopener noreferrer)
  valid: boolean;
  reason?: string;
};

export function cleanUrlInput(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(HIDDEN_CHARS, '').replace(/\s+/g, (m) => (m.includes('\n') ? ' ' : m)).trim();
}

const invalid = (reason: string): LinkInfo => ({ href: '#', external: false, valid: false, reason });

function parseExternal(s: string): LinkInfo {
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return invalid('invalid-url');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return invalid('unsafe-scheme');
  if (!u.hostname || /\s/.test(u.hostname)) return invalid('invalid-host');
  // آدرسی که به خود سایت ویرا اشاره می‌کند، لینک داخلی است
  if (SITE_HOSTS.includes(u.hostname.toLowerCase())) {
    return { href: (u.pathname || '/') + u.search + u.hash, external: false, valid: true };
  }
  return { href: s, external: true, valid: true }; // بدون تغییر در آدرس واردشده
}

/**
 * تشخیص نوع لینک:
 *  - http:// و https://            → خارجی، بدون تغییر
 *  - //example.com                 → خارجی (https)
 *  - example.com / www.x.ir/path   → خارجی (https:// به ابتدایش اضافه می‌شود)
 *  - /مسیر-داخلی  یا  #بخش        → داخلی
 *  - tamin-vira.ir/... یا آدرس کامل خود ویرا → داخلی (به مسیر تبدیل می‌شود)
 *  - javascript:، data: و ...      → نامعتبر
 */
export function resolveLink(raw: unknown): LinkInfo {
  let s = cleanUrlInput(raw);
  if (!s) return invalid('empty');

  s = s.replace(/\\/g, '/');                         // /\evil.com → //evil.com
  s = s.replace(/^(https?):\/(?!\/)/i, '$1://');     // https:/example.com → https://example.com

  if (UNSAFE_SCHEME.test(s)) return invalid('unsafe-scheme');
  if (/^https?:\/\//i.test(s)) return parseExternal(s);
  if (s.startsWith('//')) return parseExternal('https:' + s);
  if (s.startsWith('#')) return { href: s, external: false, valid: true };
  if (s.startsWith('/')) return { href: s, external: false, valid: true };

  if (DOMAIN_LIKE.test(s)) {
    const host = s.split(/[\/?#]/)[0].replace(/:\d+$/, '').toLowerCase();
    if (SITE_HOSTS.includes(host)) {
      const rest = s.slice(s.search(/[\/?#]|$/));
      return { href: rest.startsWith('/') ? rest : '/' + rest, external: false, valid: true };
    }
    return parseExternal('https://' + s);
  }

  // مسیر داخلی بدون اسلش ابتدایی (مثل marketplace یا academy/categories)
  if (/^[a-z0-9\-_~]+(?:\/[^\s]*)?$/i.test(s)) return { href: '/' + s, external: false, valid: true };

  return invalid('invalid-url');
}

/** مقداری که باید در دیتابیس ذخیره شود (تمیز و کامل)؛ برای لینک نامعتبر رشته‌ی خالی. */
export function linkForStorage(raw: unknown): string {
  const r = resolveLink(raw);
  return r.valid ? r.href : '';
}
