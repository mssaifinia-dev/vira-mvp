import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

function isPhoneNumber(val: string) {
  return /^09[0-9]{9}$/.test(val);
}

function randomPassword() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + 'Aa1!';
}

export async function POST(req: NextRequest) {
  try {
    const { phone, code } = await req.json();

    if (!phone || !isPhoneNumber(phone) || !code) {
      return NextResponse.json({ error: 'اطلاعات ناقص است' }, { status: 400 });
    }

    const otpRes = await supabaseAdmin
      .from('otp_codes')
      .select('*')
      .eq('phone', phone)
      .eq('code', code)
      .eq('used', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!otpRes.data) {
      return NextResponse.json({ error: 'کد وارد شده اشتباه است' }, { status: 400 });
    }

    if (new Date(otpRes.data.expires_at) < new Date()) {
      return NextResponse.json({ error: 'کد منقضی شده است. کد جدید بگیرید' }, { status: 400 });
    }

    // علامت‌گذاری کد به‌عنوان استفاده‌شده تا دوباره قابل استفاده نباشد
    await supabaseAdmin.from('otp_codes').update({ used: true }).eq('id', otpRes.data.id);

    const email = 'vira' + phone + '@gmail.com';
    const tempPassword = randomPassword();

    // بررسی اینکه آیا این شماره قبلاً حساب داشته یا کاربر جدید است
    const { data: usersList } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = usersList?.users.find((u) => u.email === email);

    if (existingUser) {
      await supabaseAdmin.auth.admin.updateUserById(existingUser.id, { password: tempPassword });
    } else {
      await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
      });
    }

    return NextResponse.json({ email, password: tempPassword });

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'خطای سرور' }, { status: 500 });
  }
}
