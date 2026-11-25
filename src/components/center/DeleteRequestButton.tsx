'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useMyPerms } from '@/lib/useMyPerms';

/**
 * دکمه‌ی «حذف» درخواست برای پنل مرکز مخابرات (تب بسته‌شده‌ها).
 * فقط برای ادمین اصلی دیده می‌شود؛ سرپرست مرکز و مدیر محدود آن را نمی‌بینند
 * (و حتی اگر ببینند، تابع دیتابیس رد می‌کند).
 */
export default function DeleteRequestButton({
  requestId,
  requestNo,
  onDeleted,
}: {
  requestId: string;
  requestNo?: number | string | null;
  onDeleted?: () => void;
}) {
  const { perms } = useMyPerms();
  const [busy, setBusy] = useState(false);

  if (!perms || !perms.super) return null;

  async function handleDelete() {
    const label = requestNo ? ' شماره ' + requestNo : '';
    const reason = window.prompt('حذف قطعی درخواست' + label + '\nاین کار برگشت‌پذیر نیست. دلیل حذف را بنویسید:');
    if (!reason || !reason.trim()) return;
    setBusy(true);
    const res = await supabase.rpc('admin_delete_request', { p_id: requestId, p_reason: reason.trim() });
    setBusy(false);
    if (res.error) {
      alert('حذف انجام نشد: ' + res.error.message);
      return;
    }
    if (onDeleted) onDeleted();
  }

  return (
    <button
      onClick={handleDelete}
      disabled={busy}
      style={{ background: '#7f1d1d', color: 'white', border: 'none', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 12, opacity: busy ? 0.6 : 1 }}
    >
      {busy ? 'در حال حذف...' : 'حذف'}
    </button>
  );
}
