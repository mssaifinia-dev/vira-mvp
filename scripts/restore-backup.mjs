#!/usr/bin/env node
/**
 * بازیابی فایل پشتیبان ویرا در یک پروژه‌ی Supabase دلخواه (ترجیحاً پروژه‌ی آزمایشی)
 * تا بدون ریسک برای اطلاعات اصلی، سالم بودن و قابل بازیابی بودن پشتیبان آزمایش شود.
 *
 * استفاده (از ریشه‌ی پروژه):
 *   set TARGET_SUPABASE_URL=https://xxxx.supabase.co
 *   set TARGET_SERVICE_ROLE_KEY=...            (کلید service_role پروژه‌ی مقصد، نه Production)
 *   set BACKUP_ENCRYPTION_KEY=...              (فقط اگر فایل رمزنگاری شده است)
 *   node scripts/restore-backup.mjs C:\path\vira-backup-all-2026-01-01-ab12cd34.json.enc
 *
 * گزینه‌ها:
 *   --dry-run          فقط شمارش و بررسی، بدون نوشتن
 *   --tables=a,b,c     فقط همین جدول‌ها
 *   --yes              بدون پرسش تأیید
 *
 * نکته: ساختار جدول‌ها (SQL فایل‌های 01 تا 03 و جدول‌های اصلی) باید قبلاً در پروژه‌ی مقصد ساخته شده باشد.
 * این اسکریپت فقط داده را در جدول‌های public وارد می‌کند و ردیفی را حذف نمی‌کند.
 * حساب‌های کاربری (auth.users) در پشتیبان نیستند؛ ردیف‌هایی که به کاربر وابسته‌اند ممکن است خطای کلید خارجی بدهند.
 */
import { readFileSync } from 'node:fs';
import { createDecipheriv } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { createClient } from '@supabase/supabase-js';

const NEVER_RESTORE = ['audit_log', 'audit_undos', 'admins'];
const PRIMARY_KEY = { vira_migration_log: 'name' };
const ORDER = [
  'telecom_centers', 'center_streets', 'service_categories', 'service_fault_types', 'service_form_fields',
  'technicians', 'technician_areas', 'technician_services', 'technician_scopes', 'center_supervisors',
  'sellers', 'products', 'category_commissions', 'discount_codes', 'customer_archive',
  'service_requests', 'service_request_events', 'invoices', 'invoice_items', 'orders', 'cart_items',
  'seller_payouts', 'bank_accounts', 'business_expenses', 'daily_revenue',
  'academy_categories', 'academy_courses', 'academy_videos', 'academy_articles', 'academy_files', 'academy_community_posts',
  'advertisements', 'about_content', 'about_images', 'vira_faqs',
  'support_tickets', 'notifications', 'technician_requests', 'telecom_center_audit', 'vira_migration_log',
];

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const dry = args.includes('--dry-run');
const yes = args.includes('--yes');
const onlyArg = args.find((a) => a.startsWith('--tables='));
const only = onlyArg ? onlyArg.slice(9).split(',').map((s) => s.trim()).filter(Boolean) : null;

if (!file) { console.error('مسیر فایل پشتیبان را بدهید.'); process.exit(1); }
const url = process.env.TARGET_SUPABASE_URL;
const key = process.env.TARGET_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('TARGET_SUPABASE_URL و TARGET_SERVICE_ROLE_KEY را تنظیم کنید.'); process.exit(1); }

let buf = readFileSync(file);
if (buf.subarray(0, 4).toString() === 'VBK1') {
  const raw = (process.env.BACKUP_ENCRYPTION_KEY || '').trim();
  if (!raw) { console.error('فایل رمزنگاری شده است؛ BACKUP_ENCRYPTION_KEY را تنظیم کنید.'); process.exit(1); }
  const k = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  const d = createDecipheriv('aes-256-gcm', k, buf.subarray(4, 16));
  d.setAuthTag(buf.subarray(16, 32));
  try { buf = Buffer.concat([d.update(buf.subarray(32)), d.final()]); }
  catch { console.error('رمزگشایی ناموفق: کلید اشتباه است یا فایل آسیب دیده است.'); process.exit(1); }
}
const backup = JSON.parse(buf.toString('utf-8'));
if (backup.format !== 'vira-backup-v1') { console.error('قالب فایل نامعتبر است.'); process.exit(1); }

const tables = ORDER.filter((t) => backup.tables[t] && !NEVER_RESTORE.includes(t) && (!only || only.includes(t)));
console.log('\nفایل پشتیبان:', backup.created_at, '| نوع:', backup.kind, '| محدوده:', backup.scope);
console.log('مقصد:', new URL(url).host);
console.log('جدول‌ها:');
for (const t of tables) console.log('  ', t.padEnd(28), backup.tables[t].length, 'ردیف');
if (dry) { console.log('\n--dry-run: هیچ داده‌ای نوشته نشد.'); process.exit(0); }

if (!yes) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ans = await rl.question('\nاین داده‌ها در ' + new URL(url).host + ' نوشته می‌شوند. برای ادامه yes بنویسید: ');
  rl.close();
  if (ans.trim().toLowerCase() !== 'yes') { console.log('لغو شد.'); process.exit(0); }
}

const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
let totalOk = 0, totalFail = 0;
for (const t of tables) {
  const pk = PRIMARY_KEY[t] || 'id';
  const rows = backup.tables[t];
  let ok = 0, failed = 0; const errs = [];
  const upsert = async (batch) => {
    let r = await sb.from(t).upsert(batch, { onConflict: pk });
    if (r.error && /generated|identity/i.test(r.error.message) && batch.some((x) => 'request_no' in x)) {
      r = await sb.from(t).upsert(batch.map(({ request_no, ...rest }) => rest), { onConflict: pk });
    }
    return r.error;
  };
  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200);
    const err = await upsert(batch);
    if (!err) { ok += batch.length; continue; }
    for (const row of batch) {
      const e2 = await upsert([row]);
      if (e2) { failed++; if (errs.length < 3) errs.push(String(row[pk]).slice(0, 8) + ': ' + e2.message); } else ok++;
    }
  }
  totalOk += ok; totalFail += failed;
  console.log(t.padEnd(28), 'موفق:', ok, ' ناموفق:', failed);
  errs.forEach((e) => console.log('      ↳', e));
}
console.log('\nپایان. موفق:', totalOk, '| ناموفق:', totalFail);
process.exit(totalFail > 0 ? 2 : 0);
