// اعتبارسنجی «شماره مجازی FTTH» بر اساس قواعد هر شهر (کد شهر).
// قواعد از جدول ftth_city_rules خوانده می‌شود؛ همین منطق در دیتابیس (تریگر) هم اجرا می‌شود.

export type FtthRule = {
  area_code: string;            // مثل 021، یا * برای قاعده‌ی عمومی سایر شهرها
  city_name: string | null;
  subscriber_digits: number;    // تعداد رقم بعد از کد شهر (برای تهران: ۸)
  total_length: number;         // طول کل شماره (کد شهر + مشترک)
  error_message: string | null;
  is_active: boolean;
};

export const FTTH_REQUIRED_MESSAGE = 'شماره مجازی FTTH الزامی است.';

/** فقط ارقام انگلیسی/فارسی/عربی را به ارقام انگلیسی تبدیل می‌کند و بقیه را حذف نمی‌کند (تا خطا نشان داده شود). */
export function normalizeDigits(s: string): string {
  return s
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .trim();
}

/** قاعده‌ی مربوط به شماره: طولانی‌ترین کد شهر منطبق؛ در نبود آن قاعده‌ی عمومی (*). */
export function findRule(value: string, rules: FtthRule[]): FtthRule | null {
  const active = rules.filter((r) => r.is_active);
  let best: FtthRule | null = null;
  for (const r of active) {
    if (r.area_code === '*') continue;
    if (value.startsWith(r.area_code) && (!best || r.area_code.length > best.area_code.length)) best = r;
  }
  return best || active.find((r) => r.area_code === '*') || null;
}

/** null = معتبر؛ در غیر این صورت پیام خطا (فارسی). */
export function validateFtth(raw: string | null | undefined, rules: FtthRule[]): string | null {
  const value = normalizeDigits(raw || '');
  if (!value) return FTTH_REQUIRED_MESSAGE;
  if (!/^[0-9]+$/.test(value)) return 'در شماره مجازی FTTH فقط ارقام مجاز است.';
  if (!value.startsWith('0')) return 'شماره مجازی FTTH باید با صفر ابتدای کد شهر شروع شود (مثلاً 02199162496).';
  const rule = findRule(value, rules);
  if (!rule) return 'برای کد شهر این شماره قاعده‌ای تعریف نشده است؛ با پشتیبانی تماس بگیرید.';
  if (value.length !== rule.total_length) {
    return rule.error_message || 'شماره مجازی FTTH باید دقیقاً ' + rule.total_length + ' رقم باشد.';
  }
  return null;
}
