import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { findUserByEmail, loginEmailFor, parseDbTime } from '@/lib/otpCore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isPhoneNumber(val: string) {
  return /^09[0-9]{9}$/.test(val);
}

/**
 * ارسال کد ورود با کاوه‌نگار.
 * پیش‌فرض: ارسال با «قالب تأییدشده» (verify/lookup) به نام otp که در آن %token کد است.
 * متغیرها: KAVENEGAR_API_KEY (الزامی)، KAVENEGAR_OTP_TEMPLATE (پیش‌فرض otp)،
 * فقط اگر خط اختصاصی ایرانی دارید: KAVENEGAR_OTP_TEMPLATE=plain و KAVENEGAR_SENDER را بگذارید.
 */
export async function POST(req: NextRequest) {
  try {
    const { phone, purpose } = await req.json();

    if (!phone || !isPhoneNumber(phone)) {
      return NextResponse.json({ error: 'شماره موبایل معتبر نیست' }, { status: 400 });
    }

    const apiKey = process.env.KAVENEGAR_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'سرویس پیامک تنظیم نشده' }, { status: 500 });
    }

    // ثبت‌نام: اگر این شماره قبلاً حساب دارد، پیامک بی‌دلیل نمی‌فرستیم
    if (purpose === 'register' && (await findUserByEmail(loginEmailFor(phone)))) {
      return NextResponse.json({ error: 'این شماره قبلاً ثبت‌نام کرده است. وارد شوید یا از «کد پیامکی» استفاده کنید' }, { status: 409 });
    }

    // جلوگیری از ارسال پشت‌سرهم (حداقل ۶۰ ثانیه بین دو کد)
    const last = await supabaseAdmin
      .from('otp_codes')
      .select('created_at')
      .eq('phone', phone)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (last.data && last.data.created_at && Date.now() - parseDbTime(last.data.created_at) < 60 * 1000) {
      return NextResponse.json({ error: 'کد قبلی تازه ارسال شده است؛ یک دقیقه بعد دوباره تلاش کنید' }, { status: 429 });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000);

    const ins = await supabaseAdmin
      .from('otp_codes')
      .insert({ phone, code, expires_at: expiresAt.toISOString() })
      .select('id')
      .single();
    if (ins.error || !ins.data) {
      return NextResponse.json({ error: 'خطا در ایجاد کد' }, { status: 500 });
    }

    let template = process.env.KAVENEGAR_OTP_TEMPLATE || 'otp';
    if (template === 'plain' && !process.env.KAVENEGAR_SENDER) template = 'otp';
    const params = new URLSearchParams();
    params.append('receptor', phone);
    let endpoint: string;
    if (template === 'plain' && process.env.KAVENEGAR_SENDER) {
      endpoint = 'sms/send.json';
      params.append('message', 'کد ورود ویرا: ' + code);
      if (process.env.KAVENEGAR_SENDER) params.append('sender', process.env.KAVENEGAR_SENDER);
    } else {
      endpoint = 'verify/lookup.json';
      params.append('token', code);
      params.append('template', template);
    }

    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 15000);
    let smsData: any = {};
    let httpStatus = 0;
    try {
      const response = await fetch('https://api.kavenegar.com/v1/' + apiKey + '/' + endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
        signal: ctl.signal,
      });
      httpStatus = response.status;
      smsData = await response.json().catch(() => ({}));
    } catch (e: any) {
      await supabaseAdmin.from('otp_codes').delete().eq('id', ins.data.id);
      const timeout = e && e.name === 'AbortError';
      console.error('OTP Kavenegar error:', e && e.message);
      return NextResponse.json({ error: timeout ? 'ارتباط با سرویس پیامک زمان‌بر شد؛ دوباره تلاش کنید' : 'ارتباط با سرویس پیامک برقرار نشد' }, { status: 504 });
    } finally {
      clearTimeout(timer);
    }

    const status = smsData && smsData.return ? smsData.return.status : undefined;
    if (status !== 200) {
      await supabaseAdmin.from('otp_codes').delete().eq('id', ins.data.id);
      const msg = (smsData && smsData.return && smsData.return.message) || 'ارسال ناموفق (کد ' + httpStatus + ')';
      console.error('OTP Kavenegar failed:', status, msg);
      return NextResponse.json({ error: 'ارسال پیامک ناموفق بود: ' + msg }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('OTP Error:', err);
    return NextResponse.json({ error: 'خطا در ارسال کد' }, { status: 500 });
  }
}
