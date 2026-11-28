'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * هر چند دقیقه یک‌بار (برای کاربر واردشده) صف پیامک را خالی می‌کند تا اگر ارسال فوری
 * دیتابیس تنظیم نشده بود، پیامک‌ها معطل نمانند. تماس اضافه هیچ ضرری ندارد.
 */
export default function SmsPoker() {
  useEffect(() => {
    let stopped = false;
    async function poke() {
      try {
        const last = Number(localStorage.getItem('vira_sms_poke') || '0');
        if (Date.now() - last < 100000) return;
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token || stopped) return;
        localStorage.setItem('vira_sms_poke', String(Date.now()));
        await fetch('/api/sms/process', { method: 'POST', headers: { Authorization: 'Bearer ' + token } });
      } catch {
        /* بی‌صدا */
      }
    }
    const first = setTimeout(poke, 8000);
    const iv = setInterval(poke, 120000);
    return () => { stopped = true; clearTimeout(first); clearInterval(iv); };
  }, []);
  return null;
}
