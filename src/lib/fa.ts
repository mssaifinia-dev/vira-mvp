// نرمال‌سازی متن فارسی و جست‌وجوی مراکز مخابراتی.
// نرمال‌سازی و کلید نام باید دقیقاً هم‌ارز توابع vira_norm_fa و vira_name_key در دیتابیس (0010) باشد.

export type CenterRow = {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  district?: string | null;
  covered_areas?: string | null;
  verification_status?: string | null;
  is_active?: boolean | null;
  deleted_at?: string | null;
  source_note?: string | null;
  sort_order?: number | null;
  updated_at?: string | null;
  created_at?: string | null;
};

const LETTERS: Record<string, string> = { 'ي': 'ی', 'ى': 'ی', 'ك': 'ک', 'ة': 'ه', 'ۀ': 'ه', 'أ': 'ا', 'إ': 'ا', 'ؤ': 'و', 'ئ': 'ی' };

export function normalizeFa(input: unknown): string {
  let s = String(input ?? '').toLowerCase();
  s = s.replace(/[يىكةۀأإؤئ]/g, (m) => LETTERS[m]);
  s = s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
  s = s.replace(/[\u200c\u200d\u200e\u200f\u064b-\u065f\u0670\u0640\u00ad\ufeff]/g, '');
  s = s.replace(/[!-\/:-@\[-`{-~،؛؟«»–—ـ]+|\s+/g, ' ');
  return s.trim();
}

/** کلید یکتایی نام: بدون «مرکز مخابرات»/«اداره مخابرات»/«مرکز» و «شهید» در ابتدا و بدون فاصله. */
export function nameKey(name: unknown): string {
  let s = normalizeFa(name);
  s = s.replace(/^(مرکز مخابرات|اداره مخابرات|مرکز) +/, '');
  s = s.replace(/^شهید +/, '');
  return s.replace(/ +/g, '');
}

type Prepared = { name: string; address: string; city: string; district: string; areas: string; compact: Record<string, string> };
const cache = new WeakMap<object, Prepared>();

function prepare(c: CenterRow): Prepared {
  let p = cache.get(c);
  if (!p) {
    const name = normalizeFa(c.name);
    const address = normalizeFa(c.address);
    const city = normalizeFa(c.city);
    const district = normalizeFa(c.district);
    const areas = normalizeFa(c.covered_areas);
    p = {
      name, address, city, district, areas,
      compact: { name: name.replace(/ /g, ''), address: address.replace(/ /g, ''), city: city.replace(/ /g, ''), district: district.replace(/ /g, ''), areas: areas.replace(/ /g, '') },
    };
    cache.set(c, p);
  }
  return p;
}

export type MatchField = 'name' | 'address' | 'area' | 'city';
export type CenterHit = { center: CenterRow; score: number; matched: MatchField[] };

function has(p: Prepared, field: 'name' | 'address' | 'city' | 'district' | 'areas', token: string): boolean {
  return p[field].includes(token) || p.compact[field].includes(token);
}

/**
 * جست‌وجو بر اساس نام مرکز، خیابان/آدرس، محله‌های تحت پوشش، شهر و منطقه.
 * همه‌ی کلمه‌های جست‌وجو باید (در هر کدام از این فیلدها) پیدا شوند. نتیجه بر اساس امتیاز مرتب است.
 */
export function searchCenters(centers: CenterRow[], query: string): CenterHit[] {
  const q = normalizeFa(query);
  if (!q) {
    return [...centers]
      .sort((a, b) => (a.city || '').localeCompare(b.city || '', 'fa') || a.name.localeCompare(b.name, 'fa'))
      .map((center) => ({ center, score: 0, matched: [] }));
  }
  const tokens = q.split(' ').filter(Boolean);
  const hits: CenterHit[] = [];
  for (const center of centers) {
    const p = prepare(center);
    let score = 0;
    const matched = new Set<MatchField>();
    let ok = true;
    for (const t of tokens) {
      let found = false;
      if (has(p, 'name', t)) { score += p.name.split(' ').some((w) => w.startsWith(t)) ? 15 : 10; matched.add('name'); found = true; }
      if (has(p, 'address', t)) { score += 6; matched.add('address'); found = true; }
      if (has(p, 'areas', t)) { score += 5; matched.add('area'); found = true; }
      if (has(p, 'city', t) || has(p, 'district', t)) { score += 2; matched.add('city'); found = true; }
      if (!found) { ok = false; break; }
    }
    if (!ok) continue;
    if (nameKey(center.name) === nameKey(query)) score += 50;
    hits.push({ center, score, matched: Array.from(matched) });
  }
  return hits.sort((a, b) => b.score - a.score || a.center.name.localeCompare(b.center.name, 'fa'));
}
