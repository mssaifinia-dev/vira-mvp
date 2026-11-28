import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { consumeOtp, findUserByEmail, loginEmailFor } from '@/lib/otpCore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function randomPassword() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + 'Aa1!';
}

/** ورود با کد پیامکی (برای شماره‌ی تازه، حساب هم ساخته می‌شود؛ چون مالکیت شماره با کد ثابت شده است) */
export async function POST(req: NextRequest) {
  try {
    const { phone, code } = await req.json();

    const check = await consumeOtp(String(phone || ''), String(code || ''));
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

    const email = loginEmailFor(phone);
    const tempPassword = randomPassword();

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      const upd = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, { password: tempPassword });
      if (upd.error) return NextResponse.json({ error: 'خطا در ورود. دوباره تلاش کنید' }, { status: 500 });
    } else {
      const cr = await supabaseAdmin.auth.admin.createUser({ email, password: tempPassword, email_confirm: true });
      if (cr.error) return NextResponse.json({ error: 'خطا در ساخت حساب. دوباره تلاش کنید' }, { status: 500 });
    }

    return NextResponse.json({ email, password: tempPassword });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'خطای سرور' }, { status: 500 });
  }
}
