import { cleanUrlInput, resolveLink } from '@/lib/url';

export type VideoSource =
  | { kind: 'iframe'; provider: 'youtube' | 'aparat' | 'vimeo' | 'embed'; src: string; openHref: string }
  | { kind: 'file'; src: string; openHref: string }
  | { kind: 'link'; href: string; message: string }
  | { kind: 'invalid'; message: string };

const MSG_EMPTY = 'آدرس ویدئو ثبت نشده است.';
const MSG_INVALID = 'آدرس ویدئو ناقص یا نامعتبر است. لینک کامل را (با https://) وارد کنید.';
const MSG_UNSAFE = 'این نوع لینک برای پخش مجاز نیست.';
const MSG_NOT_EMBEDDABLE = 'این لینک مستقیماً داخل سایت قابل پخش نیست. برای تماشا آن را در تب جدید باز کنید.';

const FILE_EXT = /\.(mp4|webm|ogg|ogv|mov|m4v)$/i;
const YT_ID = /^[A-Za-z0-9_-]{6,20}$/;

/** اگر کاربر کد <iframe ...> را چسبانده باشد، فقط آدرس src آن را برمی‌گرداند. */
export function extractIframeSrc(input: string): string {
  const m = input.match(/<iframe[^>]*\ssrc\s*=\s*["']([^"']+)["']/i);
  return m ? m[1].replace(/&amp;/g, '&') : input;
}

/** ورودی ادمین را تمیز و کامل می‌کند (حذف نویسه‌های نامرئی، گرفتن src از iframe، افزودن https://). */
export function normalizeVideoInput(raw: unknown): { value: string; error: string | null } {
  const cleaned = cleanUrlInput(extractIframeSrc(cleanUrlInput(raw)));
  if (!cleaned) return { value: '', error: null };
  const r = resolveVideoSource(cleaned);
  if (r.kind === 'invalid') return { value: cleaned, error: r.message };
  const link = resolveLink(cleaned);
  return { value: link.valid ? link.href : cleaned, error: null };
}

export function resolveVideoSource(input: string | null | undefined, opts: { uploaded?: boolean } = {}): VideoSource {
  let s = cleanUrlInput(extractIframeSrc(cleanUrlInput(input)));
  if (!s) return { kind: 'invalid', message: MSG_EMPTY };

  // فایل آپلودشده در فضای ذخیره‌سازی ویرا
  if (opts.uploaded) {
    const f = resolveLink(s);
    if (f.valid) return { kind: 'file', src: f.href, openHref: f.href };
  }

  const link = resolveLink(s);
  if (!link.valid) {
    return { kind: 'invalid', message: link.reason === 'unsafe-scheme' ? MSG_UNSAFE : MSG_INVALID };
  }

  // مسیر داخلی سایت (مثلاً فایل داخل پوشه‌ی public)
  if (!link.external) {
    if (FILE_EXT.test(link.href.split(/[?#]/)[0])) return { kind: 'file', src: link.href, openHref: link.href };
    return { kind: 'invalid', message: MSG_INVALID };
  }

  let u: URL;
  try {
    u = new URL(link.href);
  } catch {
    return { kind: 'invalid', message: MSG_INVALID };
  }
  const host = u.hostname.toLowerCase().replace(/^(www|m)\./, '');
  const parts = u.pathname.split('/').filter(Boolean);
  const open = link.href;

  // ---- YouTube ----
  if (host === 'youtu.be' || host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'music.youtube.com') {
    let id = '';
    if (host === 'youtu.be') id = parts[0] || '';
    else if (parts[0] === 'watch') id = u.searchParams.get('v') || '';
    else if (['embed', 'shorts', 'live', 'v'].includes(parts[0] || '')) id = parts[1] || '';
    if (YT_ID.test(id)) {
      return { kind: 'iframe', provider: 'youtube', src: 'https://www.youtube.com/embed/' + id, openHref: open };
    }
    const list = u.searchParams.get('list');
    if (list && /^[A-Za-z0-9_-]+$/.test(list)) {
      return { kind: 'iframe', provider: 'youtube', src: 'https://www.youtube.com/embed/videoseries?list=' + list, openHref: open };
    }
    return { kind: 'invalid', message: 'لینک یوتیوب کامل نیست؛ آدرس خود ویدئو (watch?v=... یا youtu.be/...) را وارد کنید.' };
  }

  // ---- آپارات ----
  if (host === 'aparat.com') {
    const m = u.pathname.match(/\/v\/([A-Za-z0-9]+)/) || u.pathname.match(/videohash\/([A-Za-z0-9]+)/);
    if (m) {
      return { kind: 'iframe', provider: 'aparat', src: 'https://www.aparat.com/video/video/embed/videohash/' + m[1] + '/vt/frame', openHref: open };
    }
    return { kind: 'invalid', message: 'لینک آپارات کامل نیست؛ آدرس خود ویدئو (aparat.com/v/...) را وارد کنید.' };
  }

  // ---- Vimeo ----
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = parts.find((p) => /^\d+$/.test(p));
    if (id) return { kind: 'iframe', provider: 'vimeo', src: 'https://player.vimeo.com/video/' + id, openHref: open };
    return { kind: 'invalid', message: 'لینک Vimeo کامل نیست.' };
  }

  // ---- فایل ویدئویی مستقیم ----
  if (FILE_EXT.test(u.pathname) || u.pathname.includes('/storage/v1/object/public/')) {
    // سایت روی https است؛ فایل http توسط مرورگر مسدود می‌شود، پس به https ارتقا می‌یابد
    return { kind: 'file', src: link.href.replace(/^http:\/\//i, 'https://'), openHref: link.href };
  }
  if (/\.m3u8$/i.test(u.pathname)) {
    return { kind: 'link', href: link.href, message: 'پخش‌زنده‌ی HLS (m3u8) داخل سایت پشتیبانی نمی‌شود. آن را در تب جدید باز کنید.' };
  }

  // ---- سایر لینک‌های Embed ----
  if (u.protocol === 'https:' && (u.pathname.toLowerCase().includes('/embed') || host.startsWith('player.'))) {
    return { kind: 'iframe', provider: 'embed', src: link.href, openHref: open };
  }

  return { kind: 'link', href: link.href, message: MSG_NOT_EMBEDDABLE };
}
