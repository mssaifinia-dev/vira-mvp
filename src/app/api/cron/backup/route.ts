import { NextRequest, NextResponse } from 'next/server';
import { createBackup } from '@/lib/backupCore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * پشتیبان‌گیری زمان‌بندی‌شده (Vercel Cron).
 * Vercel هنگام اجرای کرون، هدر Authorization: Bearer <CRON_SECRET> را می‌فرستد.
 * بدون تنظیم CRON_SECRET این مسیر کار نمی‌کند.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET تنظیم نشده است' }, { status: 500 });
  if (req.headers.get('authorization') !== 'Bearer ' + secret) {
    return NextResponse.json({ error: 'دسترسی ندارید' }, { status: 401 });
  }
  try {
    const r = await createBackup({ kind: 'scheduled', scope: 'all', userId: null, note: 'پشتیبان خودکار روزانه' });
    return NextResponse.json({ ok: true, id: r.id, size: r.size, encrypted: r.encrypted });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'خطا' }, { status: 500 });
  }
}
