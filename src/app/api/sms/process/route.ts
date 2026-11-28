import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendNotifySms } from '@/lib/smsServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * خالی‌کردن صف پیامک (sms_outbox). متن و گیرنده را دیتابیس تعیین کرده؛ این مسیر فقط می‌فرستد،
 * پس فراخوانی اضافه هیچ خطری ندارد (هر ردیف فقط یک‌بار ارسال می‌شود).
 *
 * چه کسی می‌تواند صدا بزند:
 *  - دیتابیس (pg_net) و ابزارهای زمان‌بندی با  Authorization: Bearer <SMS_PROCESS_SECRET>
 *  - کرون Vercel با Bearer <CRON_SECRET>
 *  - هر کاربر واردشده (مرورگر هر چند دقیقه یک‌بار برای اطمینان صدا می‌زند)
 */

function same(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function authorized(req: NextRequest): Promise<boolean> {
  const h = req.headers.get('authorization') || '';
  const token = h.toLowerCase().startsWith('bearer ') ? h.slice(7).trim() : '';
  if (!token) return false;
  if (process.env.SMS_PROCESS_SECRET && same(token, process.env.SMS_PROCESS_SECRET)) return true;
  if (process.env.CRON_SECRET && same(token, process.env.CRON_SECRET)) return true;
  const u = await supabaseAdmin.auth.getUser(token);
  return !u.error && !!u.data.user;
}

async function run(req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ error: 'دسترسی ندارید' }, { status: 401 });
  if (!process.env.KAVENEGAR_API_KEY) return NextResponse.json({ error: 'KAVENEGAR_API_KEY تنظیم نشده است' }, { status: 503 });

  const started = Date.now();
  let sent = 0, failed = 0, retry = 0;

  while (Date.now() - started < 40000) {
    const claim = await supabaseAdmin.rpc('sms_claim_batch', { p_limit: 20 });
    if (claim.error) {
      if (/sms_claim_batch|schema cache|does not exist/i.test(claim.error.message)) {
        return NextResponse.json({ error: 'ابتدا فایل 13_stage9_sms_system.sql را اجرا کنید' }, { status: 503 });
      }
      return NextResponse.json({ error: claim.error.message }, { status: 500 });
    }
    const rows: any[] = claim.data || [];
    if (rows.length === 0) break;

    // پنج‌تا پنج‌تا هم‌زمان
    for (let i = 0; i < rows.length; i += 5) {
      await Promise.all(rows.slice(i, i + 5).map(async (row) => {
        const r = await sendNotifySms(row.phone, row.message, row.event);
        await supabaseAdmin.rpc('sms_mark', {
          p_id: row.id, p_ok: r.ok, p_provider_id: r.providerId ?? null, p_error: r.error ?? null, p_permanent: !!r.permanent,
        });
        if (r.ok) sent++;
        else if (r.permanent) failed++;
        else retry++;
      }));
    }
    if (rows.length < 20) break;
  }
  return NextResponse.json({ ok: true, sent, failed, will_retry: retry });
}

export const POST = run;
export const GET = run;
