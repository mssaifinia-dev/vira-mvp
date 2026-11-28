import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const isPhoneNumber = (val: string) => /^09[0-9]{9}$/.test(val);
export const loginEmailFor = (phone: string) => 'vira' + phone + '@gmail.com';

const attempts = new Map<string, number[]>();

/**
 * زمان ذخیره‌شده در دیتابیس → میلی‌ثانیه.
 * اگر ستون «بدون منطقه‌ی زمانی» باشد، مقدار بدون Z/افست برمی‌گردد؛ ما همیشه UTC ذخیره می‌کنیم،
 * پس بدون نشانه‌ی منطقه، UTC در نظر می‌گیریم (وگرنه مرورگر/سرور آن را به‌وقت محلی می‌خواند و ساعت جابه‌جا می‌شود).
 */
export function parseDbTime(v: unknown): number {
  let t = String(v ?? '').trim();
  if (!t) return NaN;
  t = t.replace(' ', 'T');
  if (!/(Z|[+-][0-9]{2}(:?[0-9]{2})?)$/.test(t)) t += 'Z';
  return new Date(t).getTime();
}

/** محدودیت تلاش اشتباه برای حدس‌زدن کد (در حافظه‌ی همین سرور؛ روی سرورلس فقط حدودی است) */
function tooManyAttempts(phone: string): boolean {
  const now = Date.now();
  const arr = (attempts.get(phone) || []).filter((t) => now - t < 10 * 60 * 1000);
  attempts.set(phone, arr);
  return arr.length >= 8;
}
function noteFailure(phone: string) {
  const arr = attempts.get(phone) || [];
  arr.push(Date.now());
  attempts.set(phone, arr);
}

export type OtpCheck = { ok: true } | { ok: false; error: string; status: number };

/** کد را بررسی و «مصرف» می‌کند (یک‌بارمصرف). */
export async function consumeOtp(phoneIn: string, codeIn: string): Promise<OtpCheck> {
  const fix = (v: string) => String(v || '').replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).trim();
  const phone = fix(phoneIn);
  const code = fix(codeIn);
  if (!phone || !isPhoneNumber(phone) || !code || !/^[0-9]{6}$/.test(code)) {
    return { ok: false, error: 'اطلاعات ناقص است', status: 400 };
  }
  if (tooManyAttempts(phone)) {
    return { ok: false, error: 'تلاش‌های اشتباه زیاد بود؛ چند دقیقه بعد دوباره امتحان کنید', status: 429 };
  }
  // آخرین کدهای این شماره را می‌گیریم و مقایسه را در کد انجام می‌دهیم
  // (به نوع ستون code و خالی بودن ستون used وابسته نباشیم)
  let rowsRes: any = await supabaseAdmin.from('otp_codes').select('*').eq('phone', phone).order('created_at', { ascending: false }).limit(10);
  if (rowsRes.error) {
    rowsRes = await supabaseAdmin.from('otp_codes').select('*').eq('phone', phone).limit(50);
  }
  if (rowsRes.error) {
    console.error('OTP lookup failed:', rowsRes.error.message);
    return { ok: false, error: 'خطا در بررسی کد؛ دوباره تلاش کنید', status: 500 };
  }
  const rows: any[] = (rowsRes.data || []).slice().sort((a: any, b: any) => String(b.created_at || b.expires_at || '').localeCompare(String(a.created_at || a.expires_at || '')));
  const hit = rows.find((r) => String(r.code).trim() === code);

  if (!hit) {
    console.error('OTP mismatch: phone=' + phone + ' rows_for_phone=' + rows.length);
    noteFailure(phone);
    return { ok: false, error: 'کد وارد شده اشتباه است', status: 400 };
  }
  if (hit.used === true) {
    return { ok: false, error: 'این کد قبلاً استفاده شده است. کد جدید بگیرید', status: 400 };
  }
  if (parseDbTime(hit.expires_at) < Date.now()) {
    return { ok: false, error: 'کد منقضی شده است. کد جدید بگیرید', status: 400 };
  }
  const upd = await supabaseAdmin.from('otp_codes').update({ used: true }).eq('id', hit.id);
  if (upd.error) console.error('OTP mark used failed:', upd.error.message);
  return { ok: true };
}

/** پیداکردن کاربر با ایمیل؛ همه‌ی صفحه‌ها را می‌گردد (listUsers پیش‌فرض فقط ۵۰ نفر اول را می‌دهد). */
export async function findUserByEmail(email: string) {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email === email);
    if (hit) return hit;
    if (data.users.length < 1000) return null;
  }
  return null;
}
