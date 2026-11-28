import { NextRequest, NextResponse } from 'next/server';
import { requirePerm, userClient } from '@/lib/serverAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { key } from '@/lib/importCore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * جست‌وجو و مسدودسازی/رفع مسدودیت ورود کاربران (فقط ادمین اصلی یا مدیر با مجوز «مدیران ویرایش»).
 * body: { action: 'search', q } | { action: 'blocked' } | { action: 'block', user_id, reason } | { action: 'unblock', user_id } | { action: 'impersonate', user_id }
 * مسدودسازی با ban کاربر در Supabase Auth انجام می‌شود: از همان لحظه نمی‌تواند وارد شود یا نشست را نو کند
 * (نشستی که از قبل باز است تا حداکثر حدود یک ساعت، تا انقضای توکنش، ممکن است باقی بماند).
 */

const phoneOf = (email?: string | null) => {
  const m = String(email || '').match(/^vira(09[0-9]{9})@gmail\.com$/);
  return m ? m[1] : null;
};

async function allUsers() {
  const out: any[] = [];
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    out.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return out;
}

async function rolesFor(ids: string[]) {
  const roles = new Map<string, string[]>();
  const add = (id: string, r: string) => roles.set(id, [...(roles.get(id) || []), r]);
  if (ids.length === 0) return roles;
  const [adm, tech, sell, sup] = await Promise.all([
    supabaseAdmin.from('admins').select('user_id, is_super').in('user_id', ids),
    supabaseAdmin.from('technicians').select('user_id').in('user_id', ids),
    supabaseAdmin.from('sellers').select('user_id').in('user_id', ids),
    supabaseAdmin.from('center_supervisors').select('user_id').in('user_id', ids),
  ]);
  (adm.data || []).forEach((x: any) => add(x.user_id, x.is_super ? 'ادمین اصلی' : 'مدیر'));
  (tech.data || []).forEach((x: any) => add(x.user_id, 'تکنسین'));
  (sell.data || []).forEach((x: any) => add(x.user_id, 'فروشنده'));
  (sup.data || []).forEach((x: any) => add(x.user_id, 'سرپرست مرکز'));
  return roles;
}

function shape(u: any, roles: Map<string, string[]>) {
  const banned = !!u.banned_until && new Date(u.banned_until) > new Date();
  return { id: u.id, phone: phoneOf(u.email), email: u.email, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at, banned, roles: roles.get(u.id) || [] };
}

export async function POST(req: NextRequest) {
  const admin = await requirePerm(req, 'admins', 'edit');
  if (!admin) return NextResponse.json({ error: 'دسترسی ندارید' }, { status: 403 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'درخواست نامعتبر است' }, { status: 400 }); }
  const action = String(body.action || '');

  try {
    if (action === 'search') {
      const q = key(body.q);
      if (q.length < 3) return NextResponse.json({ error: 'حداقل ۳ نویسه از شماره یا ایمیل را وارد کنید' }, { status: 400 });
      const users = (await allUsers()).filter((u) => key(u.email).includes(q) || (phoneOf(u.email) || '').includes(q.replace(/\D/g, '') || '@@@'));
      const top = users.slice(0, 30);
      const roles = await rolesFor(top.map((u) => u.id));
      return NextResponse.json({ users: top.map((u) => shape(u, roles)), more: users.length > top.length });
    }

    if (action === 'blocked') {
      const b = await supabaseAdmin.from('blocked_users').select('user_id, reason, blocked_at').is('unblocked_at', null).order('blocked_at', { ascending: false }).limit(200);
      if (b.error) return NextResponse.json({ error: 'ابتدا فایل 14_stage10_orders_block_import_log.sql را اجرا کنید' }, { status: 503 });
      const ids = (b.data || []).map((x: any) => x.user_id);
      const byId = new Map<string, any>();
      for (const id of ids) {
        const r = await supabaseAdmin.auth.admin.getUserById(id);
        if (r.data && r.data.user) byId.set(id, r.data.user);
      }
      const roles = await rolesFor(ids);
      return NextResponse.json({
        users: (b.data || []).filter((x: any) => byId.has(x.user_id)).map((x: any) => ({ ...shape(byId.get(x.user_id), roles), block_reason: x.reason, blocked_at: x.blocked_at })),
      });
    }

    if (action === 'block' || action === 'unblock') {
      const id = String(body.user_id || '');
      const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
      if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'شناسه کاربر نامعتبر است' }, { status: 400 });
      if (action === 'block') {
        if (!reason) return NextResponse.json({ error: 'ثبت دلیل مسدودسازی الزامی است' }, { status: 400 });
        if (id === admin.userId) return NextResponse.json({ error: 'نمی‌توانید خودتان را مسدود کنید' }, { status: 400 });
        const sa = await supabaseAdmin.from('admins').select('is_super').eq('user_id', id).maybeSingle();
        if (sa.data && sa.data.is_super) return NextResponse.json({ error: 'ادمین اصلی را نمی‌توان مسدود کرد' }, { status: 400 });
      }
      const target = await supabaseAdmin.auth.admin.getUserById(id);
      if (target.error || !target.data.user) return NextResponse.json({ error: 'کاربر یافت نشد' }, { status: 404 });

      const upd = await supabaseAdmin.auth.admin.updateUserById(id, { ban_duration: action === 'block' ? '876000h' : 'none' } as any);
      if (upd.error) return NextResponse.json({ error: 'انجام نشد: ' + upd.error.message }, { status: 500 });

      if (action === 'block') {
        await supabaseAdmin.from('blocked_users').upsert({ user_id: id, reason, blocked_by: admin.userId, blocked_at: new Date().toISOString(), unblocked_at: null });
      } else {
        await supabaseAdmin.from('blocked_users').update({ unblocked_at: new Date().toISOString() }).eq('user_id', id);
      }
      const uc = userClient(admin.token);
      await uc.rpc('admin_log_event', {
        p_action: action === 'block' ? 'block_user' : 'unblock_user', p_record: id,
        p_summary: { phone: phoneOf(target.data.user.email), email: target.data.user.email }, p_reason: reason || null,
      });
      return NextResponse.json({ ok: true });
    }

    if (action === 'impersonate') {
      if (!admin.isSuper) return NextResponse.json({ error: 'فقط ادمین اصلی می‌تواند به‌جای کاربر وارد شود' }, { status: 403 });
      const id = String(body.user_id || '');
      if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'شناسه کاربر نامعتبر است' }, { status: 400 });
      const target = await supabaseAdmin.auth.admin.getUserById(id);
      if (target.error || !target.data.user || !target.data.user.email) return NextResponse.json({ error: 'کاربر یافت نشد' }, { status: 404 });
      const gl = await supabaseAdmin.auth.admin.generateLink({ type: 'magiclink', email: target.data.user.email });
      const th = gl.data && gl.data.properties ? gl.data.properties.hashed_token : null;
      if (gl.error || !th) return NextResponse.json({ error: 'ساخت لینک ورود ناموفق بود: ' + (gl.error ? gl.error.message : '') }, { status: 500 });
      const proto = req.headers.get('x-forwarded-proto') || ((req.headers.get('host') || '').startsWith('localhost') ? 'http' : 'https');
      const origin = req.headers.get('origin') || (proto + '://' + req.headers.get('host'));
      const uc = userClient(admin.token);
      await uc.rpc('admin_log_event', {
        p_action: 'impersonate', p_record: id,
        p_summary: { phone: phoneOf(target.data.user.email), email: target.data.user.email }, p_reason: 'ورود آزمایشی به‌جای کاربر',
      });
      return NextResponse.json({ url: origin + '/auth/impersonate?th=' + encodeURIComponent(th) });
    }

    return NextResponse.json({ error: 'عملیات نامعتبر است' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: String((e && e.message) || 'خطای سرور') }, { status: 500 });
  }
}
