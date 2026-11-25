import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * ارسال پیامک اطلاع‌رسانی با کاوه‌نگار.
 * متغیرهای محیطی: KAVENEGAR_API_KEY (الزامی)، KAVENEGAR_SENDER (اختیاری: شماره‌ی خط)
 *
 * امنیت: فقط کاربر واردشده؛ و گیرنده باید مجاز باشد:
 *  - مدیر فعال: هر شماره
 *  - تکنسین: فقط شماره‌ی مشتریِ درخواستی که به خودش ارجاع شده
 * محدودیت تعداد (در حافظه‌ی همین سرور؛ روی سرورلس فقط حدودی است).
 */

const PHONE = /^09[0-9]{9}$/;
const hits = new Map<string, number[]>();

function limited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) { hits.set(key, arr); return true; }
  arr.push(now);
  hits.set(key, arr);
  return false;
}

function normalize(m: string): string {
  const digits = m.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/\D/g, '');
  if (digits.startsWith('98') && digits.length === 12) return '0' + digits.slice(2);
  if (digits.length === 10 && digits.startsWith('9')) return '0' + digits;
  return digits;
}

export async function POST(req: NextRequest) {
  const header = req.headers.get('authorization') || '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!token) return NextResponse.json({ error: 'ابتدا وارد شوید' }, { status: 401 });

  const u = await supabaseAdmin.auth.getUser(token);
  if (u.error || !u.data.user) return NextResponse.json({ error: 'نشست نامعتبر است' }, { status: 401 });
  const uid = u.data.user.id;

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'درخواست نامعتبر است' }, { status: 400 }); }
  const mobile = normalize(String(body.mobile || ''));
  const message = String(body.message || '').trim();
  if (!PHONE.test(mobile)) return NextResponse.json({ error: 'شماره موبایل معتبر نیست' }, { status: 400 });
  if (!message || message.length > 400) return NextResponse.json({ error: 'متن پیامک خالی یا بیش از حد طولانی است' }, { status: 400 });

  // ---- مجاز بودن گیرنده ----
  let allowed = false;
  const adm = await supabaseAdmin.from('admins').select('id, is_active').eq('user_id', uid).maybeSingle();
  if (adm.data && adm.data.is_active !== false) allowed = true;
  if (!allowed) {
    const tech = await supabaseAdmin.from('technicians').select('id').eq('user_id', uid).is('deleted_at', null).maybeSingle();
    if (tech.data) {
      const r = await supabaseAdmin.from('service_requests').select('id').eq('technician_id', tech.data.id).eq('phone', mobile).limit(1);
      if (r.data && r.data.length > 0) allowed = true;
    }
  }
  if (!allowed) return NextResponse.json({ error: 'اجازه‌ی ارسال پیامک به این شماره را ندارید' }, { status: 403 });

  if (limited('u:' + uid, 40, 10 * 60 * 1000) || limited('m:' + mobile, 6, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'تعداد پیامک بیش از حد مجاز است؛ چند دقیقه بعد تلاش کنید' }, { status: 429 });
  }

  const apiKey = process.env.KAVENEGAR_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'سرویس پیامک تنظیم نشده است (KAVENEGAR_API_KEY)' }, { status: 503 });

  const params = new URLSearchParams();
  params.append('receptor', mobile);
  params.append('message', message);
  if (process.env.KAVENEGAR_SENDER) params.append('sender', process.env.KAVENEGAR_SENDER);

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15000);
  try {
    const res = await fetch('https://api.kavenegar.com/v1/' + apiKey + '/sms/send.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: ctl.signal,
    });
    const data: any = await res.json().catch(() => ({}));
    const status = data && data.return ? data.return.status : undefined;
    if (status !== 200) {
      const msg = (data && data.return && data.return.message) || 'ارسال ناموفق (کد ' + res.status + ')';
      console.error('Kavenegar SMS failed:', status, msg);
      return NextResponse.json({ error: msg }, { status: 502 });
    }
    return NextResponse.json({ success: true });
  } catch (e: any) {
    const timeout = e && e.name === 'AbortError';
    console.error('Kavenegar SMS error:', e && e.message);
    return NextResponse.json({ error: timeout ? 'ارتباط با کاوه‌نگار زمان‌بر شد (timeout)' : 'ارتباط با کاوه‌نگار برقرار نشد' }, { status: 504 });
  } finally {
    clearTimeout(timer);
  }
}
