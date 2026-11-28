/**
 * ارسال پیامک با کاوه‌نگار (فقط سمت سرور).
 * متغیرهای محیطی:
 *   KAVENEGAR_API_KEY          الزامی
 *   KAVENEGAR_SENDER           اختیاری؛ شماره‌ی خط ارسال (برای پیامک ساده)
 *   KAVENEGAR_TPL_SERVICE / KAVENEGAR_TPL_ORDER / KAVENEGAR_TPL_ACCOUNT
 *                              نام سه الگوی اطلاع‌رسانی (هرکدام با یک متغیر %token10)؛ پیش‌فرض:
 *                              vira-service / vira-order / vira-account
 *   KAVENEGAR_NOTIFY_TEMPLATE  اختیاری؛ یک الگوی واحد برای همه‌ی رویدادها (اگر سه الگوی بالا را ندارید)
 *   KAVENEGAR_SENDER           فقط اگر خط اختصاصی دارید و می‌خواهید پیامک ساده بفرستید
 *
 * ارسال با الگو (LOOKUP) از خطوط خدماتی کاوه‌نگار انجام می‌شود و خط اختصاصی نمی‌خواهد.
 */

export type SmsResult = { ok: boolean; providerId?: string; error?: string; permanent?: boolean };

// خطاهایی که تکرارشان فایده ندارد (شماره/خط/قالب نامعتبر)
const PERMANENT = new Set([411, 412, 413, 414, 431, 432, 433]);

export async function kavenegarCall(endpoint: string, params: URLSearchParams): Promise<{ status?: number; message?: string; entries?: any[]; httpStatus: number }> {
  const apiKey = process.env.KAVENEGAR_API_KEY;
  if (!apiKey) throw new Error('KAVENEGAR_API_KEY تنظیم نشده است');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15000);
  try {
    const res = await fetch('https://api.kavenegar.com/v1/' + apiKey + '/' + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: ctl.signal,
    });
    const data: any = await res.json().catch(() => ({}));
    return { status: data?.return?.status, message: data?.return?.message, entries: data?.entries, httpStatus: res.status };
  } finally {
    clearTimeout(timer);
  }
}

type Category = 'SERVICE' | 'ORDER' | 'ACCOUNT';

const CATEGORY: Record<string, Category> = {
  order_created_customer: 'ORDER', order_created_seller: 'ORDER', order_status: 'ORDER', order_paid: 'ORDER',
  invoice_confirm_code: 'SERVICE',
  tech_registered: 'ACCOUNT', tech_approved: 'ACCOUNT', tech_rejected: 'ACCOUNT', tech_added_by_admin: 'ACCOUNT',
  seller_registered: 'ACCOUNT', seller_approved: 'ACCOUNT', seller_rejected: 'ACCOUNT',
  support_reply: 'ACCOUNT', test: 'ACCOUNT',
};
const DEFAULT_TPL: Record<Category, string> = { SERVICE: 'vira-service', ORDER: 'vira-order', ACCOUNT: 'vira-account' };

function templateFor(event?: string): string {
  const cat: Category = (event && CATEGORY[event]) || 'SERVICE';
  return process.env['KAVENEGAR_TPL_' + cat] || process.env.KAVENEGAR_NOTIFY_TEMPLATE || DEFAULT_TPL[cat];
}

/** متن برای متغیر token10: بدون نام برند (الگو دارد)، بدون خط جدید، حداکثر ۱۰۰ نویسه */
function toToken10(message: string): string {
  let t = message.replace(/^ویرا:\s*/, '').replace(/\s+/g, ' ').trim();
  if (t.length > 100) t = t.slice(0, 97).trimEnd() + '...';
  return t;
}

export async function sendNotifySms(phone: string, message: string, event?: string): Promise<SmsResult> {
  const params = new URLSearchParams();
  params.append('receptor', phone);
  let endpoint: string;
  if (event === 'invoice_confirm_code') {
    // الگوی «کد تأیید فاکتور»: %token = کد، %token2 = مبلغ (بدون فاصله و جداکننده)
    const m = message.match(/([0-9]{6})[^0-9]+([0-9]+)\s*تومان/);
    if (!m) return { ok: false, error: 'قالب پیام کد تأیید نامعتبر است', permanent: true };
    endpoint = 'verify/lookup.json';
    params.append('template', process.env.KAVENEGAR_TPL_CONFIRM || 'vira-confirm');
    params.append('token', m[1]);
    params.append('token2', m[2]);
  } else if (process.env.KAVENEGAR_SENDER && process.env.KAVENEGAR_USE_PLAIN === '1') {
    // حالت پیامک ساده (فقط با خط اختصاصی ایرانی)
    endpoint = 'sms/send.json';
    params.append('message', message);
    params.append('sender', process.env.KAVENEGAR_SENDER);
  } else {
    endpoint = 'verify/lookup.json';
    params.append('template', templateFor(event));
    params.append('token10', toToken10(message));
  }
  try {
    const r = await kavenegarCall(endpoint, params);
    if (r.status === 200) {
      const id = r.entries && r.entries[0] && r.entries[0].messageid;
      return { ok: true, providerId: id !== undefined ? String(id) : undefined };
    }
    const code = r.status ?? r.httpStatus;
    return { ok: false, error: '[' + code + '] ' + (r.message || 'ارسال ناموفق'), permanent: typeof r.status === 'number' && PERMANENT.has(r.status) };
  } catch (e: any) {
    const timeout = e && e.name === 'AbortError';
    return { ok: false, error: timeout ? 'timeout در ارتباط با کاوه‌نگار' : String((e && e.message) || 'ارتباط برقرار نشد') };
  }
}
