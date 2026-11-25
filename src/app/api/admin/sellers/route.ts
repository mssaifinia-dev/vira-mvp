import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requirePerm } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

const PHONE_RE = /^09[0-9]{9}$/;
const NATIONAL_ID_RE = /^[0-9]{10}$/;

function clean(v: unknown, max = 300): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

async function findUserIdByEmail(email: string): Promise<string | null> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    const hit = data.users.find((u) => (u.email || '').toLowerCase() === email);
    if (hit) return hit.id;
    if (data.users.length < 1000) break;
  }
  return null;
}

/** ایجاد فروشنده توسط مدیر: حساب کاربری + ردیف فروشنده (تأییدشده) */
export async function POST(req: NextRequest) {
  const admin = await requirePerm(req, 'sellers', 'create');
  if (!admin) return NextResponse.json({ error: 'دسترسی ندارید' }, { status: 403 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است' }, { status: 400 });
  }

  const phone = clean(body.phone, 11);
  const password = typeof body.password === 'string' ? body.password : '';
  const shopName = clean(body.shop_name, 120);
  const city = clean(body.city, 60);
  const description = clean(body.description, 1000);
  const shopAddress = clean(body.shop_address, 400);
  const shopMobile = clean(body.shop_mobile, 11);
  const nationalId = clean(body.national_id, 10);

  if (!PHONE_RE.test(phone)) return NextResponse.json({ error: 'شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد' }, { status: 400 });
  if (!shopName) return NextResponse.json({ error: 'نام فروشگاه الزامی است' }, { status: 400 });
  if (nationalId && !NATIONAL_ID_RE.test(nationalId)) return NextResponse.json({ error: 'کد ملی باید ۱۰ رقم باشد' }, { status: 400 });
  if (shopMobile && !PHONE_RE.test(shopMobile)) return NextResponse.json({ error: 'موبایل فروشگاه نامعتبر است' }, { status: 400 });

  const email = ('vira' + phone + '@gmail.com').toLowerCase();

  try {
    let userId = await findUserIdByEmail(email);
    let createdNewUser = false;

    if (userId) {
      // حساب از قبل وجود دارد (مثلاً مشتری): رمز عوض نمی‌شود، فقط نقش فروشندگی اضافه می‌شود
      const existing = await supabaseAdmin.from('sellers').select('id').eq('user_id', userId).maybeSingle();
      if (existing.data) {
        return NextResponse.json({ error: 'این شماره قبلاً به‌عنوان فروشنده ثبت شده است' }, { status: 409 });
      }
    } else {
      if (password.length < 6) {
        return NextResponse.json({ error: 'رمز عبور اولیه باید حداقل ۶ کاراکتر باشد' }, { status: 400 });
      }
      const created = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
      if (created.error || !created.data.user) {
        return NextResponse.json({ error: 'ساخت حساب کاربری ناموفق بود: ' + (created.error?.message || '') }, { status: 500 });
      }
      userId = created.data.user.id;
      createdNewUser = true;
    }

    const row = {
      user_id: userId,
      shop_name: shopName,
      phone,
      city: city || null,
      description: description || null,
      shop_address: shopAddress || null,
      shop_mobile: shopMobile || null,
      national_id: nationalId || null,
      is_approved: true,
      is_active: true,
    };

    const ins = await supabaseAdmin.from('sellers').insert(row).select('id').single();
    if (ins.error || !ins.data) {
      if (createdNewUser && userId) await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: 'ثبت فروشنده ناموفق بود: ' + (ins.error?.message || '') }, { status: 500 });
    }

    // ثبت انجام‌دهنده در ممیزی (تریگر عمومی چون با service_role اجرا می‌شود، انجام‌دهنده را نمی‌داند)
    await supabaseAdmin.from('audit_log').insert({
      module: 'sellers',
      table_name: 'sellers',
      record_id: ins.data.id,
      action: 'create_by_admin',
      new_data: { ...row, linked_existing_account: !createdNewUser },
      actor_id: admin.userId,
      reason: 'ایجاد فروشنده توسط مدیر',
    });

    return NextResponse.json({ id: ins.data.id, linkedExistingAccount: !createdNewUser });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'خطای سرور' }, { status: 500 });
  }
}
