'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

/** ورود آزمایشی ادمین اصلی به‌جای یک کاربر (لینک یک‌بارمصرف از /admin/users-access) */
export default function ImpersonatePage() {
  const [msg, setMsg] = useState('در حال ورود...');

  useEffect(() => {
    async function run() {
      const th = new URLSearchParams(window.location.search).get('th');
      if (!th) { setMsg('لینک نامعتبر است'); return; }
      let res = await supabase.auth.verifyOtp({ token_hash: th, type: 'magiclink' });
      if (res.error) res = await supabase.auth.verifyOtp({ token_hash: th, type: 'email' });
      if (res.error) { setMsg('ورود ناموفق بود (لینک منقضی یا قبلاً استفاده شده): ' + res.error.message); return; }
      window.location.href = '/';
    }
    run();
  }, []);

  return (
    <main dir="rtl" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6' }}>
      <p style={{ fontSize: 15, color: '#374151' }}>{msg}</p>
    </main>
  );
}
