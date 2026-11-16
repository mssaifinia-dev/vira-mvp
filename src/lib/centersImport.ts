import { nameKey, normalizeFa, type CenterRow } from '@/lib/fa';

export type ImportRecord = {
  line: number;
  name: string;
  address: string;
  province: string;
  city: string;
  district: string;
  covered_areas: string;
  verification_status?: 'verified' | 'needs_review'; // خالی = در به‌روزرسانی تغییر نمی‌کند؛ در افزودن «نیازمند بررسی»
  is_active?: boolean;                               // خالی = در به‌روزرسانی تغییر نمی‌کند؛ در افزودن «فعال»
  source_note: string;
};

export type ImportPlan = {
  toInsert: ImportRecord[];
  toUpdate: { id: string; record: ImportRecord; existingName: string }[];
  duplicatesInFile: { line: number; name: string; sameAsLine: number }[];
  invalid: { line: number; reason: string }[];
  total: number;
};

export const TEMPLATE_HEADERS = ['نام مرکز', 'آدرس', 'استان', 'شهر یا شهرستان', 'منطقه مخابراتی', 'محله‌های تحت پوشش', 'وضعیت تأیید', 'فعال', 'منبع'];

// نام ستون‌ها (فارسی یا انگلیسی) → فیلد (کلیدها هنگام بارگذاری نرمال می‌شوند تا نیم‌فاصله/املای عربی مهم نباشد)
const RAW_HEADER_MAP: Record<string, keyof ImportRecord> = {
  'نام مرکز': 'name', 'نام': 'name', 'name': 'name',
  'آدرس': 'address', 'نشانی': 'address', 'آدرس کامل': 'address', 'address': 'address',
  'استان': 'province', 'province': 'province',
  'شهر': 'city', 'شهرستان': 'city', 'شهر یا شهرستان': 'city', 'city': 'city',
  'منطقه': 'district', 'منطقه مخابراتی': 'district', 'district': 'district',
  'محله ها': 'covered_areas', 'محله های تحت پوشش': 'covered_areas', 'محله': 'covered_areas', 'covered areas': 'covered_areas', 'covered_areas': 'covered_areas',
  'وضعیت تایید': 'verification_status', 'وضعیت': 'verification_status', 'status': 'verification_status', 'verification_status': 'verification_status',
  'فعال': 'is_active', 'active': 'is_active', 'is_active': 'is_active',
  'منبع': 'source_note', 'توضیح': 'source_note', 'source': 'source_note', 'source_note': 'source_note',
};
// مقایسه‌ی عنوان ستون بدون فاصله و نیم‌فاصله و با املای یکسان
const headerKey = (h: unknown) => normalizeFa(h).replace(/ /g, '');
const HEADER_MAP: Record<string, keyof ImportRecord> = Object.fromEntries(
  Object.entries(RAW_HEADER_MAP).map(([k, v]) => [headerKey(k), v])
);
const VERIFIED_WORDS = ['verified', 'تأیید شده', 'تاییدشده', 'تأیید', 'معتبر', 'بله', '1', 'true'].map((x) => normalizeFa(x));

function parseBool(v: string): boolean {
  const n = normalizeFa(v);
  return !(n === '0' || n === 'خیر' || n === 'false' || n === 'no' || n === 'غیرفعال');
}

function parseStatus(v: string): 'verified' | 'needs_review' {
  const n = normalizeFa(v);
  if (VERIFIED_WORDS.includes(n)) return 'verified';
  return 'needs_review'; // ناشناخته/خالی = ایمن‌ترین حالت
}

export function recordsFromRows(rows: (string | number | null | undefined)[][]): { records: ImportRecord[]; invalid: { line: number; reason: string }[] } {
  const invalid: { line: number; reason: string }[] = [];
  if (rows.length < 2) return { records: [], invalid: [{ line: 1, reason: 'فایل خالی است یا فقط سطر عنوان دارد' }] };
  const headers = rows[0].map((h) => HEADER_MAP[headerKey(h)] || null);
  if (!headers.includes('name')) return { records: [], invalid: [{ line: 1, reason: 'ستون «نام مرکز» پیدا نشد' }] };

  const records: ImportRecord[] = [];
  rows.slice(1).forEach((r, i) => {
    const line = i + 2;
    const raw: Record<string, string> = {};
    headers.forEach((h, idx) => { if (h) raw[h] = String(r[idx] ?? '').trim(); });
    if (!raw.name) { invalid.push({ line, reason: 'نام مرکز خالی است' }); return; }
    records.push({
      line,
      name: raw.name,
      address: raw.address || '',
      province: raw.province || 'تهران',
      city: raw.city || '',
      district: raw.district || '',
      covered_areas: raw.covered_areas || '',
      verification_status: raw.verification_status ? parseStatus(raw.verification_status) : undefined,
      is_active: raw.is_active === undefined || raw.is_active === '' ? undefined : parseBool(raw.is_active),
      source_note: raw.source_note || 'ورود گروهی از فایل',
    });
  });
  return { records, invalid };
}

/** پیش‌نمایش ورود گروهی: افزودن‌ها، به‌روزرسانی‌ها، تکراری‌های داخل فایل و ردیف‌های نامعتبر. */
export function planImport(records: ImportRecord[], existing: CenterRow[], invalid: { line: number; reason: string }[] = []): ImportPlan {
  const byKey = new Map<string, CenterRow>();
  existing.filter((c) => !c.deleted_at).forEach((c) => { if (!byKey.has(nameKey(c.name))) byKey.set(nameKey(c.name), c); });

  const seen = new Map<string, number>();
  const plan: ImportPlan = { toInsert: [], toUpdate: [], duplicatesInFile: [], invalid: [...invalid], total: records.length + invalid.length };
  for (const rec of records) {
    const k = nameKey(rec.name);
    if (!k) { plan.invalid.push({ line: rec.line, reason: 'نام مرکز نامعتبر است' }); continue; }
    if (seen.has(k)) { plan.duplicatesInFile.push({ line: rec.line, name: rec.name, sameAsLine: seen.get(k)! }); continue; }
    seen.set(k, rec.line);
    const ex = byKey.get(k);
    if (ex) plan.toUpdate.push({ id: ex.id, record: rec, existingName: ex.name });
    else plan.toInsert.push(rec);
  }
  return plan;
}
