import { supabase } from '@/lib/supabase';

export type RpcResult = { ok: boolean; error?: string };

/** اجرای تابع امن دیتابیس؛ پیام خطای فارسی تابع را برمی‌گرداند. */
export async function adminRpc(name: string, args: Record<string, unknown>): Promise<RpcResult> {
  const { error } = await supabase.rpc(name, args);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** فراخوانی API سمت سرور با توکن نشست فعلی مدیر. */
export async function adminFetch(url: string, body: unknown): Promise<{ ok: boolean; error?: string; data?: any }> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, error: 'نشست شما منقضی شده است؛ دوباره وارد شوید' };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: json.error || 'خطای سرور (' + res.status + ')' };
    return { ok: true, data: json };
  } catch {
    return { ok: false, error: 'ارتباط با سرور برقرار نشد' };
  }
}
