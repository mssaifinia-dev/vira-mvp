import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export type AuthedAdmin = { userId: string; email: string | null; isSuper: boolean; token: string };

function bearer(req: NextRequest): string {
  const header = req.headers.get('authorization') || '';
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
}

/** کلاینتی که با هویت خود مدیر به دیتابیس وصل می‌شود (auth.uid() = مدیر) */
export function userClient(token: string) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: 'Bearer ' + token } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * بررسی سمت سرور: توکن معتبر + مدیر فعال + داشتن مجوز مشخص در ماژول.
 * اگر ماژول/مجوز داده نشود، فقط «مدیر فعال بودن» بررسی می‌شود.
 */
export async function requirePerm(req: NextRequest, module?: string, perm: string = 'view'): Promise<AuthedAdmin | null> {
  const token = bearer(req);
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;

  const row = await supabaseAdmin.from('admins').select('id, is_super, is_active').eq('user_id', data.user.id).maybeSingle();
  if (!row.data) return null;
  // سازگاری: قبل از اجرای فایل 04 ستون‌های is_super/is_active وجود ندارند
  const legacy = row.error || row.data.is_super === undefined;
  const isSuper = legacy ? true : !!row.data.is_super;
  if (!legacy && row.data.is_active === false) return null;

  if (module && !legacy && !isSuper) {
    const ok = await supabaseAdmin.rpc('has_perm_for', { p_user: data.user.id, p_module: module, p_perm: perm });
    if (ok.error || ok.data !== true) return null;
  }
  return { userId: data.user.id, email: data.user.email ?? null, isSuper, token };
}

/** سازگاری با مرحله‌ی ۱ و ۲: فقط مدیر فعال */
export const requireAdmin = (req: NextRequest) => requirePerm(req);
