'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { MyPerms } from '@/lib/permissions';

/**
 * دسترسی‌های مدیر جاری را از دیتابیس می‌خواند.
 * اگر تابع my_permissions هنوز ساخته نشده باشد (فایل 04 اجرا نشده)،
 * برای سازگاری با نسخه‌ی قبل، هر مدیر موجود ادمین اصلی فرض می‌شود.
 */
export function useMyPerms(): { perms: MyPerms | null; loading: boolean } {
  const [perms, setPerms] = useState<MyPerms | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await supabase.rpc('my_permissions');
      if (!alive) return;
      if (res.error) {
        if (/function|schema cache|does not exist/i.test(res.error.message)) {
          const userRes = await supabase.auth.getUser();
          const u = userRes.data.user;
          const a = u ? await supabase.from('admins').select('id').eq('user_id', u.id).maybeSingle() : null;
          setPerms(a && a.data ? { admin: true, super: true, perms: {} } : { admin: false, super: false, perms: {} });
        } else {
          setPerms({ admin: false, super: false, perms: {} });
        }
      } else {
        setPerms(res.data as MyPerms);
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  return { perms, loading };
}
