import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { consumeOtp, findUserByEmail, loginEmailFor } from '@/lib/otpCore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** ثبت‌نام با رمز عبور؛ فقط بعد از تأیید شماره‌ی موبایل با کد پیامکی. */
export async function POST(req: NextRequest) {
  try {
    const { phone, code, password } = await req.json();
    if (typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: 'رمز عبور باید حداقل 6 کاراکتر باشد' }, { status: 400 });
    }

    const email = loginEmailFor(String(phone || ''));
    // قبل از مصرف کد بررسی می‌کنیم تا کد بی‌دلیل نسوزد
    if (await findUserByEmail(email)) {
      return NextResponse.json({ error: 'این شماره قبلاً ثبت‌نام کرده است. وارد شوید یا از «کد پیامکی» استفاده کنید' }, { status: 409 });
    }

    const check = await consumeOtp(String(phone || ''), String(code || ''));
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

    const cr = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
    if (cr.error) {
      return NextResponse.json({ error: 'ساخت حساب ناموفق بود: ' + cr.error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true, email });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'خطای سرور' }, { status: 500 });
  }
}
