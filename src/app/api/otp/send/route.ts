import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

function isPhoneNumber(val: string) {
  return /^09[0-9]{9}$/.test(val);
}

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();

    if (!phone || !isPhoneNumber(phone)) {
      return NextResponse.json({ error: 'شماره موبایل معتبر نیست' }, { status: 400 });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000);

    await supabaseAdmin.from('otp_codes').insert({
      phone,
      code,
      expires_at: expiresAt.toISOString(),
    });

    const apiKey = process.env.KAVENEGAR_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'سرویس پیامک تنظیم نشده' }, { status: 500 });
    }

    const message = `کد ورود: ${code}`;
    const url = `https://api.kavenegar.com/v1/${apiKey}/sms/send.json`;

    const params = new URLSearchParams();
    params.append('receptor', phone);
    params.append('message', message);

    const response = await fetch(`${url}?${params.toString()}`, { method: 'POST' });
    const smsData = await response.json();

    if (!smsData.return || smsData.return.status !== 200) {
      return NextResponse.json({ error: smsData.return.message || 'ارسال ناموفق' }, { status: 400 });
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error('OTP Error:', err);
    return NextResponse.json({ error: 'خطا در ارسال کد' }, { status: 500 });
  }
}