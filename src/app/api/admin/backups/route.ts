import { NextRequest, NextResponse } from 'next/server';
import { requirePerm } from '@/lib/serverAuth';
import { createBackup, restoreBackup, signedDownloadUrl, verifyAdminPassword, verifyBackup } from '@/lib/backupCore';
import { BACKUP_MODULES } from '@/lib/backupModules';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * عملیات پشتیبان‌گیری (فقط مدیر):
 *  create   : تهیه‌ی پشتیبان (manual | pre_change | module)
 *  download : لینک دانلود موقت (۲ دقیقه)
 *  verify   : آزمایش بازیابی بدون هیچ تغییری روی اطلاعات اصلی
 *  restore  : بازیابی ادغامی با تأیید چندمرحله‌ای (عبارت تأیید + رمز مدیر)
 */
export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return fail('درخواست نامعتبر است'); }
  const action = String(body.action || '');

  const permFor: Record<string, string> = { create: 'create', download: 'report', verify: 'view', restore: 'restore' };
  if (!permFor[action]) return fail('عملیات نامعتبر است');
  const admin = await requirePerm(req, 'backups', permFor[action]);
  if (!admin) return fail('دسترسی ندارید', 403);

  try {
    if (action === 'create') {
      const kind = body.kind === 'pre_change' ? 'pre_change' : body.kind === 'module' ? 'module' : 'manual';
      let scope = 'all';
      if (kind === 'module') {
        scope = String(body.scope || '');
        if (!BACKUP_MODULES.some((m) => m.key === scope)) return fail('ماژول نامعتبر است');
      }
      const note = typeof body.note === 'string' ? body.note.trim().slice(0, 300) : '';
      if (kind === 'pre_change' && !note) return fail('برای پشتیبان قبل از تغییر، توضیح تغییر مورد نظر را بنویسید');
      const r = await createBackup({ kind, scope, userId: admin.userId, note });
      return NextResponse.json({ ok: true, id: r.id, size: r.size, encrypted: r.encrypted });
    }

    const id = String(body.id || '');
    if (!/^[0-9a-f-]{36}$/i.test(id)) return fail('شناسه‌ی پشتیبان نامعتبر است');

    if (action === 'download') {
      const d = await signedDownloadUrl(id);
      return NextResponse.json({ ok: true, ...d });
    }

    if (action === 'verify') {
      const r = await verifyBackup(id, admin.userId);
      return NextResponse.json({ ok: true, ...r });
    }

    if (action === 'restore') {
      if (!admin.isSuper) return fail('بازیابی فقط توسط ادمین اصلی مجاز است', 403);
      const tables = Array.isArray(body.tables) ? body.tables.map(String) : [];
      if (tables.length === 0) return fail('حداقل یک جدول را برای بازیابی انتخاب کنید');
      if (body.confirm !== 'RESTORE') return fail('عبارت تأیید نادرست است (باید دقیقاً RESTORE تایپ شود)');
      const okPass = await verifyAdminPassword(admin.email, typeof body.password === 'string' ? body.password : '');
      if (!okPass) return fail('رمز عبور مدیر نادرست است', 403);
      const r = await restoreBackup(id, tables, admin.userId);
      return NextResponse.json({ ok: true, ...r });
    }

    return fail('عملیات نامعتبر است');
  } catch (e: any) {
    return fail(e?.message || 'خطای سرور', 500);
  }
}
