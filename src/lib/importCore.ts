/**
 * منطق مشترک ورود گروهی با اکسل (هم مرورگر برای قالب/پیش‌نمایش، هم سرور برای ثبت).
 */

export type ImportKind = 'centers' | 'technicians' | 'supervisors' | 'streets';

/** نرمال‌سازی برای مقایسه‌ی نام‌ها: ی/ک عربی، ارقام فارسی/عربی، نیم‌فاصله، اعراب، فاصله‌های تکراری */
export function key(s: unknown): string {
  return String(s ?? '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/ۀ/g, 'ه').replace(/ة/g, 'ه')
    .replace(/[\u200c\u200d\u200e\u200f\u064b-\u065f\u0640]/g, ' ')
    .replace(/[()\[\]{}"'«»]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function normPhone(p: unknown): string | null {
  const d = key(p).replace(/\D/g, '');
  let x = d;
  if (x.startsWith('98') && x.length === 12) x = '0' + x.slice(2);
  if (x.length === 10 && x.startsWith('9')) x = '0' + x;
  return /^09[0-9]{9}$/.test(x) ? x : null;
}

/** تقسیم یک سلول چندمقداری (با ، ; ؛ , / خط جدید) */
export function splitList(s: unknown): string[] {
  return String(s ?? '')
    .split(/[،;؛,\n\r|]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export const SPECIALTIES: Record<string, string> = {
  copper_repair: 'رفع خرابی تلفن مسی',
  fiber_repair: 'رفع خرابی فیبر نوری',
  fusion: 'فیوژن‌کار',
  smart_home: 'خانه هوشمند',
  electric_building: 'برقکار ساختمانی',
  electric_industrial: 'برقکار صنعتی',
  modem_config: 'کانفیگ و نصب مودم',
  appliance_repair: 'تعمیرکار لوازم خانگی',
};

export function specialtyKey(v: unknown): string | null {
  const k = key(v);
  if (!k) return null;
  for (const [code, label] of Object.entries(SPECIALTIES)) {
    if (key(code) === k || key(label) === k) return code;
  }
  return null;
}

export type ColumnDef = { field: string; title: string; aliases: string[]; required?: boolean; example: string; help: string };

export const COLUMNS: Record<ImportKind, ColumnDef[]> = {
  centers: [
    { field: 'name', title: 'نام مرکز', aliases: ['نام', 'name', 'center'], required: true, example: 'مرکز تست ۱', help: 'الزامی؛ نام یکتا' },
    { field: 'district', title: 'منطقه مخابراتی', aliases: ['منطقه', 'district', 'region'], example: 'منطقه تست', help: 'نام منطقه؛ مرکزهای هم‌منطقه یک نام دقیقاً یکسان می‌گیرند' },
    { field: 'address', title: 'آدرس', aliases: ['نشانی', 'address'], example: 'تهران، خیابان تست', help: 'برای مرکز تأییدشده الزامی است' },
    { field: 'province', title: 'استان', aliases: ['province'], example: 'تهران', help: 'خالی = تهران' },
    { field: 'city', title: 'شهر', aliases: ['شهر یا شهرستان', 'شهرستان', 'city'], example: 'تهران', help: 'اختیاری' },
    { field: 'covered_areas', title: 'محله‌های تحت پوشش', aliases: ['محله', 'covered_areas'], example: '', help: 'اختیاری' },
    { field: 'verified', title: 'تأییدشده', aliases: ['وضعیت تأیید', 'وضعیت تایید', 'verified'], example: 'بله', help: 'بله/خیر؛ خالی = بله (مرکز تأییدشده در فرم درخواست دیده می‌شود)' },
    { field: 'active', title: 'فعال', aliases: ['active', 'is_active'], example: 'بله', help: 'بله/خیر؛ خالی = بله' },
  ],
  technicians: [
    { field: 'full_name', title: 'نام و نام خانوادگی', aliases: ['نام', 'نام تکنسین', 'full_name', 'name'], required: true, example: 'علی رضایی', help: 'الزامی' },
    { field: 'phone', title: 'موبایل', aliases: ['شماره موبایل', 'تلفن همراه', 'همراه', 'phone', 'mobile'], required: true, example: '09121234567', help: 'الزامی؛ همان شماره‌ای که تکنسین با آن وارد می‌شود' },
    { field: 'city', title: 'شهر', aliases: ['city'], required: true, example: 'تهران', help: 'الزامی' },
    { field: 'specialty', title: 'تخصص', aliases: ['تخصص اصلی', 'specialty'], required: true, example: 'رفع خرابی تلفن مسی', help: 'یکی از: ' + Object.values(SPECIALTIES).join(' / ') },
    { field: 'national_id', title: 'کد ملی', aliases: ['national_id', 'کدملی'], example: '0012345678', help: 'اختیاری' },
    { field: 'experience', title: 'توضیحات', aliases: ['سابقه', 'توضیح', 'experience'], example: '۵ سال سابقه', help: 'اختیاری' },
    { field: 'centers', title: 'مراکز', aliases: ['مرکز', 'مراکز مخابراتی', 'مرکز مخابراتی', 'centers', 'center'], example: 'مرکز ولیعصر', help: 'نام مرکز(ها) دقیقاً مثل ثبت‌شده در سامانه؛ چند مرکز را با ، جدا کنید' },
    { field: 'streets', title: 'خیابان‌ها', aliases: ['خیابان', 'محدوده', 'streets'], example: 'بهار، مطهری', help: 'خالی = کل مرکز؛ وگرنه فقط همین خیابان‌ها (با ، جدا کنید)' },
    { field: 'services', title: 'خدمات', aliases: ['خدمت', 'دسته خدمت', 'دسته‌های خدمت', 'services'], example: 'رفع خرابی تلفن', help: 'نام دسته‌های خدمت ثبت‌شده؛ با ، جدا کنید' },
  ],
  supervisors: [
    { field: 'phone', title: 'موبایل', aliases: ['شماره موبایل', 'تلفن همراه', 'phone', 'mobile'], required: true, example: '09121234567', help: 'الزامی؛ اگر حساب ندارد ساخته می‌شود و با کد پیامکی وارد می‌شود' },
    { field: 'full_name', title: 'نام', aliases: ['نام سرپرست', 'نام و نام خانوادگی', 'name'], example: 'محمد احمدی', help: 'اختیاری (فقط برای گزارش)' },
    { field: 'centers', title: 'مراکز', aliases: ['مرکز', 'مراکز مخابراتی', 'centers', 'center'], example: 'مرکز ولیعصر، مرکز شریعتی', help: 'مرکز(هایی) که سرپرست آن‌هاست؛ با ، جدا کنید' },
    { field: 'district', title: 'منطقه', aliases: ['منطقه مخابراتی', 'منطقه‌ی مخابراتی', 'district', 'region'], example: 'منطقه ۱', help: 'اختیاری؛ سرپرست همه‌ی مراکزِ این منطقه می‌شود (برای سرپرست منطقه)' },
  ],
  streets: [
    { field: 'center', title: 'مرکز', aliases: ['مرکز مخابراتی', 'نام مرکز', 'center', 'centers'], required: true, example: 'مرکز ولیعصر', help: 'الزامی؛ نام دقیق مرکز' },
    { field: 'streets', title: 'خیابان‌ها', aliases: ['خیابان', 'نام خیابان', 'streets', 'street'], required: true, example: 'بهار، مطهری، شریعتی', help: 'الزامی؛ چند خیابان را با ، جدا کنید یا در چند ردیف بنویسید' },
  ],
};

/** سطر خام اکسل (با هر عنوان ستون) → فیلدهای استاندارد */
export function canonicalRow(kind: ImportKind, raw: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  const map = new Map<string, string>();
  for (const c of COLUMNS[kind]) {
    map.set(key(c.title), c.field);
    map.set(key(c.field), c.field);
    for (const a of c.aliases) map.set(key(a), c.field);
  }
  for (const [h, v] of Object.entries(raw)) {
    const f = map.get(key(h));
    if (f && v !== undefined && v !== null && String(v).trim() !== '') out[f] = String(v).trim();
  }
  return out;
}

export type RowResult = { row: number; status: 'ok' | 'updated' | 'skipped' | 'error'; message: string };
