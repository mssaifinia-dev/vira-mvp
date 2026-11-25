import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { ALL_TABLES, BACKUP_MODULES, PRIMARY_KEY, RESTORE_ORDER, isRestorable } from '@/lib/backupModules';

export const BACKUP_BUCKET = 'vira-backups';
const PAGE = 1000;
const MAGIC = Buffer.from('VBK1');

export type BackupKind = 'manual' | 'pre_change' | 'scheduled' | 'module' | 'pre_restore';

type Row = Record<string, unknown>;
export type BackupFile = {
  format: 'vira-backup-v1';
  created_at: string;
  kind: string;
  scope: string;
  tables: Record<string, Row[]>;
  storage_manifest?: Record<string, string[]>;
};

// ---------------------------------------------------------------- رمزنگاری (اختیاری ولی توصیه‌شده)
function getKey(): Buffer | null {
  const raw = (process.env.BACKUP_ENCRYPTION_KEY || '').trim();
  if (!raw) return null;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  const b = Buffer.from(raw, 'base64');
  if (b.length === 32) return b;
  throw new Error('BACKUP_ENCRYPTION_KEY باید ۶۴ کاراکتر هگز یا base64 معتبر ۳۲ بایتی باشد');
}

function encrypt(plain: Buffer, key: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), ct]);
}

function decrypt(data: Buffer, key: Buffer): Buffer {
  const iv = data.subarray(4, 16);
  const tag = data.subarray(16, 32);
  const ct = data.subarray(32);
  const d = createDecipheriv('aes-256-gcm', key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]);
}

const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex');

// ---------------------------------------------------------------- خواندن جدول‌ها
async function readTable(table: string): Promise<Row[]> {
  const pk = PRIMARY_KEY[table] || 'id';
  const out: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabaseAdmin.from(table).select('*').order(pk, { ascending: true }).range(from, from + PAGE - 1);
    if (error) throw new Error(table + ': ' + error.message);
    const rows = (data || []) as Row[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

async function storageManifest(): Promise<Record<string, string[]>> {
  const manifest: Record<string, string[]> = {};
  const buckets = await supabaseAdmin.storage.listBuckets();
  for (const b of buckets.data || []) {
    if (b.id === BACKUP_BUCKET) continue;
    const files: string[] = [];
    const walk = async (prefix: string, depth: number) => {
      for (let offset = 0; files.length < 5000; offset += 1000) {
        const { data, error } = await supabaseAdmin.storage.from(b.id).list(prefix, { limit: 1000, offset });
        if (error || !data || data.length === 0) break;
        for (const item of data) {
          const path = prefix ? prefix + '/' + item.name : item.name;
          if (item.id === null && depth < 3) await walk(path, depth + 1); // پوشه
          else if (item.id !== null) files.push(path);
        }
        if (data.length < 1000) break;
      }
    };
    try { await walk('', 0); } catch { /* نادیده */ }
    manifest[b.id] = files;
  }
  return manifest;
}

// ---------------------------------------------------------------- ساخت پشتیبان
export async function createBackup(opts: {
  kind: BackupKind;
  scope?: string; // 'all' یا کلید ماژول
  tables?: string[];
  userId: string | null;
  note?: string;
}) {
  const scope = opts.scope || 'all';
  let tables = opts.tables;
  if (!tables) {
    if (scope === 'all') tables = ALL_TABLES;
    else tables = BACKUP_MODULES.find((m) => m.key === scope)?.tables;
  }
  if (!tables || tables.length === 0) throw new Error('ماژول یا جدول نامعتبر است');
  tables = tables.filter((t) => ALL_TABLES.includes(t));

  const ins = await supabaseAdmin
    .from('backup_runs')
    .insert({ kind: opts.kind, scope, tables, created_by: opts.userId, note: opts.note || null, status: 'running' })
    .select('id')
    .single();
  if (ins.error || !ins.data) throw new Error('ثبت پشتیبان ناموفق بود (فایل 03_stage2 اجرا شده است؟): ' + (ins.error?.message || ''));
  const runId = ins.data.id as string;

  try {
    const file: BackupFile = { format: 'vira-backup-v1', created_at: new Date().toISOString(), kind: opts.kind, scope, tables: {} };
    const counts: Record<string, number> = {};
    for (const t of tables) {
      const rows = await readTable(t);
      file.tables[t] = rows;
      counts[t] = rows.length;
    }
    if (scope === 'all') file.storage_manifest = await storageManifest();

    let payload = Buffer.from(JSON.stringify(file), 'utf-8');
    const key = getKey();
    const encrypted = !!key;
    if (key) payload = encrypt(payload, key);

    const d = new Date();
    const path = d.getUTCFullYear() + '/' + String(d.getUTCMonth() + 1).padStart(2, '0') + '/' + runId + (encrypted ? '.json.enc' : '.json');
    const up = await supabaseAdmin.storage.from(BACKUP_BUCKET).upload(path, payload, {
      contentType: encrypted ? 'application/octet-stream' : 'application/json',
      upsert: false,
    });
    if (up.error) throw new Error('ذخیره‌ی فایل در Storage ناموفق بود (پوشه‌ی vira-backups ساخته شده است؟): ' + up.error.message);

    await supabaseAdmin
      .from('backup_runs')
      .update({
        status: 'success',
        finished_at: new Date().toISOString(),
        row_counts: counts,
        size_bytes: payload.length,
        storage_path: path,
        checksum: sha256(payload),
        encrypted,
      })
      .eq('id', runId);

    if (opts.kind === 'scheduled') await applyRetention().catch(() => undefined);
    return { id: runId, size: payload.length, counts, encrypted };
  } catch (e: any) {
    await supabaseAdmin
      .from('backup_runs')
      .update({ status: 'failed', finished_at: new Date().toISOString(), error: String(e?.message || e).slice(0, 1000) })
      .eq('id', runId);
    throw e;
  }
}

// نگهداری فقط N پشتیبان زمان‌بندی‌شده‌ی آخر (پیش‌فرض ۱۴)
async function applyRetention() {
  const keep = Math.max(3, Number(process.env.BACKUP_KEEP) || 14);
  const { data } = await supabaseAdmin
    .from('backup_runs')
    .select('id,storage_path')
    .eq('kind', 'scheduled')
    .eq('status', 'success')
    .not('storage_path', 'is', null)
    .order('created_at', { ascending: false });
  const old = (data || []).slice(keep);
  for (const r of old) {
    await supabaseAdmin.storage.from(BACKUP_BUCKET).remove([r.storage_path as string]);
    await supabaseAdmin.from('backup_runs').update({ storage_path: null, note: 'فایل طبق سیاست نگهداری حذف شد' }).eq('id', r.id);
  }
}

// ---------------------------------------------------------------- خواندن و اعتبارسنجی فایل
export async function loadBackup(runId: string): Promise<{ file: BackupFile; run: any }> {
  const { data: run, error } = await supabaseAdmin.from('backup_runs').select('*').eq('id', runId).single();
  if (error || !run) throw new Error('پشتیبان یافت نشد');
  if (run.status !== 'success' || !run.storage_path) throw new Error('فایل این پشتیبان در دسترس نیست');

  const dl = await supabaseAdmin.storage.from(BACKUP_BUCKET).download(run.storage_path);
  if (dl.error || !dl.data) throw new Error('دانلود فایل پشتیبان ناموفق بود: ' + (dl.error?.message || ''));
  let buf: Buffer = Buffer.from(await dl.data.arrayBuffer());

  if (run.checksum && sha256(buf) !== run.checksum) {
    throw new Error('اعتبارسنجی ناموفق: checksum فایل با مقدار ثبت‌شده مطابقت ندارد (فایل آسیب دیده یا تغییر کرده است)');
  }
  if (buf.subarray(0, 4).equals(MAGIC)) {
    const key = getKey();
    if (!key) throw new Error('فایل رمزنگاری شده است ولی BACKUP_ENCRYPTION_KEY تنظیم نشده است');
    try { buf = decrypt(buf, key); } catch { throw new Error('رمزگشایی ناموفق: کلید رمزنگاری اشتباه است یا فایل آسیب دیده است'); }
  }
  const file = JSON.parse(buf.toString('utf-8')) as BackupFile;
  if (file.format !== 'vira-backup-v1' || typeof file.tables !== 'object') throw new Error('قالب فایل پشتیبان نامعتبر است');
  return { file, run };
}

// ---------------------------------------------------------------- آزمایش بازیابی (بدون هیچ نوشتنی)
const canon = (r: Row) => JSON.stringify(Object.keys(r).sort().map((k) => [k, r[k]]));

export type TableDiff = { table: string; inBackup: number; inDb: number; toInsert: number; toUpdate: number; unchanged: number; onlyInDb: number; restorable: boolean };

export async function verifyBackup(runId: string, userId: string | null) {
  const { file, run } = await loadBackup(runId);
  const diffs: TableDiff[] = [];
  for (const table of Object.keys(file.tables)) {
    const pk = PRIMARY_KEY[table] || 'id';
    const backupRows = file.tables[table];
    const current = await readTable(table);
    const curMap = new Map<string, string>();
    current.forEach((r) => curMap.set(String(r[pk]), canon(r)));
    let toInsert = 0, toUpdate = 0, unchanged = 0;
    const seen = new Set<string>();
    for (const r of backupRows) {
      const id = String(r[pk]);
      seen.add(id);
      const c = curMap.get(id);
      if (c === undefined) toInsert++;
      else if (c === canon(r)) unchanged++;
      else toUpdate++;
    }
    let onlyInDb = 0;
    curMap.forEach((_v, id) => { if (!seen.has(id)) onlyInDb++; });
    diffs.push({ table, inBackup: backupRows.length, inDb: current.length, toInsert, toUpdate, unchanged, onlyInDb, restorable: isRestorable(table) });
  }
  await supabaseAdmin.from('restore_runs').insert({
    backup_id: runId, performed_by: userId, mode: 'dry_run', tables: diffs.map((d) => d.table), status: 'success', result: { diffs },
  });
  return { backupCreatedAt: file.created_at, kind: run.kind, encrypted: run.encrypted, diffs };
}

// ---------------------------------------------------------------- بازیابی (ادغام؛ هرگز ردیفی حذف نمی‌شود)
export type RestoreTableResult = { table: string; attempted: number; ok: number; failed: number; errors: string[] };

export async function restoreBackup(runId: string, tables: string[], userId: string) {
  const { file } = await loadBackup(runId);
  const selected = RESTORE_ORDER.filter((t) => tables.includes(t) && file.tables[t] && isRestorable(t));
  if (selected.length === 0) throw new Error('هیچ جدول قابل بازیابی انتخاب نشده است');

  // پشتیبان خودکار قبل از بازیابی؛ اگر ساخته نشد، بازیابی انجام نمی‌شود
  const pre = await createBackup({ kind: 'pre_restore', scope: 'pre_restore', tables: selected, userId, note: 'خودکار، قبل از بازیابی ' + runId });

  const results: RestoreTableResult[] = [];
  for (const table of selected) {
    const pk = PRIMARY_KEY[table] || 'id';
    const rows = file.tables[table];
    const res: RestoreTableResult = { table, attempted: rows.length, ok: 0, failed: 0, errors: [] };

    const upsert = async (batch: Row[]) => {
      let r = await supabaseAdmin.from(table).upsert(batch, { onConflict: pk });
      if (r.error && /generated|identity/i.test(r.error.message) && batch.some((x) => 'request_no' in x)) {
        const stripped = batch.map((x) => { const { request_no: _omit, ...rest } = x; return rest; });
        r = await supabaseAdmin.from(table).upsert(stripped, { onConflict: pk });
      }
      return r.error;
    };

    for (let i = 0; i < rows.length; i += 200) {
      const batch = rows.slice(i, i + 200);
      const err = await upsert(batch);
      if (!err) { res.ok += batch.length; continue; }
      // جداسازی ردیف‌های مشکل‌دار
      for (const row of batch) {
        const e2 = await upsert([row]);
        if (e2) { res.failed++; if (res.errors.length < 3) res.errors.push(String(row[pk]).slice(0, 8) + ': ' + e2.message); }
        else res.ok++;
      }
    }
    results.push(res);
  }

  const failed = results.reduce((a, r) => a + r.failed, 0);
  const okTotal = results.reduce((a, r) => a + r.ok, 0);
  const status = failed === 0 ? 'success' : okTotal > 0 ? 'partial' : 'failed';
  await supabaseAdmin.from('restore_runs').insert({
    backup_id: runId, performed_by: userId, mode: 'merge', tables: selected, status, result: { results, pre_restore_backup: pre.id },
  });
  return { status, results, preRestoreBackupId: pre.id };
}

// ---------------------------------------------------------------- تأیید مجدد رمز ادمین
export async function verifyAdminPassword(email: string | null, password: string): Promise<boolean> {
  if (!email || !password) return false;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return false;
  const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  return !error;
}

export async function signedDownloadUrl(runId: string): Promise<{ url: string; filename: string }> {
  const { data: run } = await supabaseAdmin.from('backup_runs').select('*').eq('id', runId).single();
  if (!run || run.status !== 'success' || !run.storage_path) throw new Error('فایل این پشتیبان در دسترس نیست');
  const day = String(run.created_at).slice(0, 10);
  const filename = 'vira-backup-' + run.scope + '-' + day + '-' + String(run.id).slice(0, 8) + (run.encrypted ? '.json.enc' : '.json');
  const s = await supabaseAdmin.storage.from(BACKUP_BUCKET).createSignedUrl(run.storage_path, 120, { download: filename });
  if (s.error || !s.data) throw new Error('ساخت لینک دانلود ناموفق بود: ' + (s.error?.message || ''));
  return { url: s.data.signedUrl, filename };
}
