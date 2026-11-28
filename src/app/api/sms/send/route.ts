import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendNotifySms } from '@/lib/smsServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * ارسال پیامک دستی (فقط مدیر فعال). پیامک‌های روند کار (سفارش، درخواست، تأیید ...) از این مسیر
 * نمی‌روند؛ آن‌ها را تریگرهای دیتابیس در صف می‌گذارند و /api/sms/process می‌فرستد.
 */
const PHONE = /^09[0-9]{9}$/;
const hits = new Map<string, number[]>();

function limited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) { hits.set(key, arr); return true; }
  arr.push(now);
  hits.set(key, arr);
  return false;
}

export async function POST(req: NextRequest) {
  const header = req.headers.get('authorization') || '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!token) return NextResponse.json({ error: 'ابتدا وارد شوید' }, { status: 401 });
  const u = await supabaseAdmin.auth.getUser(token);
  if (u.error || !u.data.user) return NextResponse.json({ error: 'نشست نامعتبر است' }, { status: 401 });
  const adm = await supabaseAdmin.from('admins').select('id, is_active').eq('user_id', u.data.user.id).maybeSingle();
  if (!adm.data || adm.data.is_active === false) return NextResponse.json({ error: 'دسترسی ندارید' }, { status: 403 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'درخواست نامعتبر است' }, { status: 400 }); }
  const mobile = String(body.mobile || '').replace(/\D/g, '');
  const message = String(body.message || '').trim();
  if (!PHONE.test(mobile)) return NextResponse.json({ error: 'شماره موبایل معتبر نیست' }, { status: 400 });
  if (!message || message.length > 400) return NextResponse.json({ error: 'متن پیامک خالی یا بیش از حد طولانی است' }, { status: 400 });
  if (limited('u:' + u.data.user.id, 40, 10 * 60 * 1000)) return NextResponse.json({ error: 'تعداد پیامک بیش از حد مجاز است' }, { status: 429 });
  if (!process.env.KAVENEGAR_API_KEY) return NextResponse.json({ error: 'سرویس پیامک تنظیم نشده است (KAVENEGAR_API_KEY)' }, { status: 503 });

  const r = await sendNotifySms(mobile, message, 'test');
  if (!r.ok) return NextResponse.json({ error: r.error || 'ارسال ناموفق' }, { status: 502 });
  return NextResponse.json({ success: true });
}
