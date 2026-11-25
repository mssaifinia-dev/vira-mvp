import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requirePerm, userClient } from '@/lib/serverAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PHONE_RE = /^09[0-9]{9}$/;
const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

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

/**
 * مدیریت حساب مدیران. کنترل نهایی دسترسی داخل توابع دیتابیس انجام می‌شود
 * (با هویت خود مدیر)؛ این مسیر فقط کارهایی را انجام می‌دهد که نیاز به service_role دارند.
 */
export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return fail('درخواست نامعتبر است'); }
  const action = String(body.action || '');

  const modulePerm: Record<string, string> = {
    create: 'create',
    set_permissions: 'edit',
    set_active: 'edit',
    revoke_sessions: 'edit',
    reset_password: 'edit',
    set_super: 'edit',
  };
  if (!modulePerm[action]) return fail('عملیات نامعتبر است');
  const admin = await requirePerm(req, 'admins', modulePerm[action]);
  if (!admin) return fail('دسترسی ندارید', 403);

  const db = userClient(admin.token);

  try {
    if (action === 'create') {
      const phone = String(body.phone || '').trim();
      const password = String(body.password || '');
      const fullName = String(body.full_name || '').trim().slice(0, 120);
      const notes = String(body.notes || '').trim().slice(0, 500);
      const isSuper = body.is_super === true;
      if (!PHONE_RE.test(phone)) return fail('شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد');
      if (!fullName) return fail('نام مدیر الزامی است');
      if (isSuper && !admin.isSuper) return fail('فقط ادمین اصلی می‌تواند ادمین اصلی بسازد', 403);

      const email = ('vira' + phone + '@gmail.com').toLowerCase();
      let userId = await findUserIdByEmail(email);
      let created = false;
      if (!userId) {
        if (password.length < 8) return fail('رمز عبور مدیر باید حداقل ۸ کاراکتر باشد');
        const c = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
        if (c.error || !c.data.user) return fail('ساخت حساب کاربری ناموفق بود: ' + (c.error?.message || ''), 500);
        userId = c.data.user.id;
        created = true;
      }

      const rpc = await db.rpc('admin_create_admin', {
        p_user: userId,
        p_full_name: fullName,
        p_notes: notes,
        p_is_super: isSuper,
        p_perms: body.perms || {},
      });
      if (rpc.error) {
        if (created && userId) await supabaseAdmin.auth.admin.deleteUser(userId);
        return fail(rpc.error.message, 400);
      }
      return NextResponse.json({ ok: true, id: rpc.data, linkedExistingAccount: !created });
    }

    const adminId = String(body.admin_id || '');
    if (!/^[0-9a-f-]{36}$/i.test(adminId)) return fail('شناسه‌ی مدیر نامعتبر است');

    if (action === 'set_permissions') {
      const r = await db.rpc('admin_set_permissions', { p_admin: adminId, p_perms: body.perms || {} });
      if (r.error) return fail(r.error.message);
      return NextResponse.json({ ok: true });
    }
    if (action === 'set_active') {
      const r = await db.rpc('admin_set_admin_active', { p_admin: adminId, p_active: body.active === true });
      if (r.error) return fail(r.error.message);
      return NextResponse.json({ ok: true });
    }
    if (action === 'revoke_sessions') {
      const r = await db.rpc('admin_revoke_sessions', { p_admin: adminId });
      if (r.error) return fail(r.error.message);
      return NextResponse.json({ ok: true });
    }
    if (action === 'set_super') {
      if (!admin.isSuper) return fail('فقط ادمین اصلی مجاز است', 403);
      const r = await db.rpc('admin_set_super', { p_admin: adminId, p_super: body.super === true });
      if (r.error) return fail(r.error.message);
      return NextResponse.json({ ok: true });
    }
    if (action === 'reset_password') {
      const password = String(body.password || '');
      if (password.length < 8) return fail('رمز عبور باید حداقل ۸ کاراکتر باشد');
      const t = await supabaseAdmin.from('admins').select('user_id, is_super').eq('id', adminId).maybeSingle();
      if (!t.data || !t.data.user_id) return fail('مدیر یافت نشد', 404);
      if (t.data.user_id === admin.userId) return fail('رمز خودتان را از بخش حساب کاربری تغییر دهید');
      if (t.data.is_super && !admin.isSuper) return fail('فقط ادمین اصلی می‌تواند رمز ادمین اصلی را تغییر دهد', 403);
      const u = await supabaseAdmin.auth.admin.updateUserById(t.data.user_id, { password });
      if (u.error) return fail('تغییر رمز ناموفق بود: ' + u.error.message, 500);
      await db.rpc('admin_revoke_sessions', { p_admin: adminId }); // نشست‌های قبلی ابطال شود
      await supabaseAdmin.from('audit_log').insert({
        module: 'admins', table_name: 'admins', record_id: adminId, action: 'update',
        new_data: { password_reset: true }, changed_fields: ['password'], actor_id: admin.userId, reason: 'بازنشانی رمز عبور مدیر',
      });
      return NextResponse.json({ ok: true });
    }
    return fail('عملیات نامعتبر است');
  } catch (e: any) {
    return fail(e?.message || 'خطای سرور', 500);
  }
}
