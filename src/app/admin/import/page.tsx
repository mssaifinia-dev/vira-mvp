'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useMyPerms } from '@/lib/useMyPerms';
import { adminFetch } from '@/lib/adminRpc';
import { COLUMNS, ImportKind, RowResult } from '@/lib/importCore';
import { badge, btn, useToast } from '@/components/admin/ui';

const KINDS: { kind: ImportKind; title: string; desc: string }[] = [
  { kind: 'centers', title: 'مراکز مخابراتی', desc: 'افزودن مرکز با منطقه‌ی مخابراتی. مرکزی که از قبل با همین نام هست رد می‌شود. مرکزهای هم‌منطقه باید نام منطقه‌شان دقیقاً یکسان باشد.' },
  { kind: 'technicians', title: 'تکنسین‌ها', desc: 'حساب تکنسین (تأییدشده) با مرکز، خیابان‌ها و خدمات هر نفر. اگر تکنسین از قبل باشد، مراکز/خیابان‌ها/خدماتِ جدید به او اضافه می‌شود.' },
  { kind: 'supervisors', title: 'سرپرستان مراکز و مناطق', desc: 'سرپرست (ثبت‌کننده و ارجاع‌دهنده) هر مرکز. برای سرپرست منطقه، ستون «منطقه» را پر کنید تا سرپرست همه‌ی مراکز آن منطقه شود.' },
  { kind: 'streets', title: 'خیابان‌های مراکز', desc: 'افزودن خیابان‌های هر مرکز (بدون تکرار). مراکز را از بخش «مراکز مخابراتی» هم می‌توانید با فایل وارد کنید.' },
];

const STATUS: Record<string, [string, string, string]> = {
  ok: ['#d1fae5', '#065f46', 'انجام شد'],
  updated: ['#dbeafe', '#1e40af', 'به‌روزرسانی شد'],
  skipped: ['#e5e7eb', '#374151', 'ردشد (تکراری)'],
  error: ['#fee2e2', '#991b1b', 'خطا'],
};

type Parsed = { n: number; data: Record<string, unknown> };

export default function ImportPage() {
  const toast = useToast();
  const [kind, setKind] = useState<ImportKind>('technicians');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<Parsed[]>([]);
  const [results, setResults] = useState<RowResult[]>([]);
  const [mode, setMode] = useState<'check' | 'run' | null>(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [createStreets, setCreateStreets] = useState(false);
  const [allServices, setAllServices] = useState(false);
  const myPerms = useMyPerms();
  const isSuper = !!myPerms.perms?.super;
  // پاک‌سازی منطقه
  const [districts, setDistricts] = useState<{ district: string; centers: number }[]>([]);
  const [purgeDistrict, setPurgeDistrict] = useState('');
  const [summary, setSummary] = useState<any | null>(null);
  const [purgePeople, setPurgePeople] = useState(true);
  const [purgeRequests, setPurgeRequests] = useState(false);
  const [purgeReason, setPurgeReason] = useState('');
  const [purgeConfirm, setPurgeConfirm] = useState('');
  const [purgeBusy, setPurgeBusy] = useState(false);
  const [purgeMsg, setPurgeMsg] = useState('');
  const [purgeResult, setPurgeResult] = useState<any | null>(null);

  async function loadDistricts() {
    const r = await supabase.rpc('admin_list_districts');
    if (r.error) { setPurgeMsg(r.error.message); return; }
    setDistricts((r.data as any[]) || []);
    setPurgeMsg('');
  }
  async function showSummary() {
    setSummary(null); setPurgeResult(null); setPurgeMsg('');
    if (!purgeDistrict) return;
    const r = await supabase.rpc('admin_region_summary', { p_district: purgeDistrict });
    if (r.error) { setPurgeMsg(r.error.message); return; }
    setSummary(r.data);
  }
  async function doPurge() {
    if (!purgeDistrict || purgeConfirm.trim() !== purgeDistrict) { setPurgeMsg('برای تأیید، نام منطقه را دقیقاً در کادر تأیید بنویسید'); return; }
    if (!purgeReason.trim()) { setPurgeMsg('ثبت دلیل الزامی است'); return; }
    setPurgeBusy(true); setPurgeMsg('');
    const r = await supabase.rpc('admin_purge_region', { p_district: purgeDistrict, p_delete_people: purgePeople, p_delete_requests: purgeRequests, p_reason: purgeReason.trim() });
    setPurgeBusy(false);
    if (r.error) { setPurgeMsg(r.error.message); return; }
    setPurgeResult(r.data); setSummary(null); setPurgeConfirm(''); setPurgeDistrict('');
    loadDistricts();
  }
  const [err, setErr] = useState('');

  function reset(k: ImportKind) {
    setKind(k); setFileName(''); setRows([]); setResults([]); setMode(null); setProgress(0); setErr('');
  }

  async function downloadTemplate() {
    const XLSX: any = await import('xlsx');
    const cols = COLUMNS[kind];
    const ws = XLSX.utils.aoa_to_sheet([cols.map((c) => c.title), cols.map((c) => c.example)]);
    ws['!cols'] = cols.map(() => ({ wch: 24 }));
    const help = XLSX.utils.aoa_to_sheet([['ستون', 'الزامی؟', 'توضیح'], ...cols.map((c) => [c.title, c.required ? 'بله' : 'خیر', c.help])]);
    help['!cols'] = [{ wch: 22 }, { wch: 10 }, { wch: 90 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'داده‌ها');
    XLSX.utils.book_append_sheet(wb, help, 'راهنما');
    XLSX.writeFile(wb, 'vira-' + kind + '-template.xlsx');
  }

  async function onFile(f: File | null) {
    setResults([]); setMode(null); setErr('');
    if (!f) { setRows([]); setFileName(''); return; }
    try {
      const XLSX: any = await import('xlsx');
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
      const parsed: Parsed[] = [];
      json.forEach((r, i) => {
        if (Object.values(r).some((v) => String(v).trim() !== '')) parsed.push({ n: i + 2, data: r });
      });
      if (parsed.length === 0) { setErr('فایل ردیف داده‌ای ندارد (ردیف اول باید عنوان ستون‌ها باشد)'); setRows([]); setFileName(f.name); return; }
      if (parsed.length > 5000) { setErr('حداکثر ۵۰۰۰ ردیف در هر فایل. فایل را بخش‌بندی کنید.'); setRows([]); setFileName(f.name); return; }
      setRows(parsed); setFileName(f.name);
    } catch {
      setErr('فایل خوانده نشد؛ باید xlsx یا csv معتبر باشد');
      setRows([]); setFileName(f.name);
    }
  }

  async function process(dry: boolean) {
    if (rows.length === 0) return;
    if (!dry && !window.confirm(rows.length.toLocaleString('fa-IR') + ' ردیف ثبت شود؟ (تکنسین و سرپرستِ جدید حساب هم می‌گیرند)')) return;
    setBusy(true); setErr(''); setResults([]); setMode(dry ? 'check' : 'run'); setProgress(0);
    const size = dry ? 50 : 20;
    const all: RowResult[] = [];
    for (let i = 0; i < rows.length; i += size) {
      const chunk = rows.slice(i, i + size);
      const r = await adminFetch('/api/admin/import', { kind, rows: chunk, dry_run: dry, options: { create_missing_streets: createStreets, all_services_if_empty: allServices } });
      if (!r.ok) {
        chunk.forEach((x) => all.push({ row: x.n, status: 'error', message: r.error || 'خطای ارتباط با سرور' }));
      } else {
        all.push(...(r.data.results as RowResult[]));
      }
      setResults([...all]);
      setProgress(Math.min(100, Math.round(((i + chunk.length) / rows.length) * 100)));
    }
    if (!dry) {
      await adminFetch('/api/admin/import', {
        kind,
        log: { file: fileName, total: all.length, ok: all.filter((x) => x.status === 'ok').length, updated: all.filter((x) => x.status === 'updated').length, skipped: all.filter((x) => x.status === 'skipped').length, error: all.filter((x) => x.status === 'error').length },
      });
      toast.show('ok', 'ورود تمام شد.');
    }
    setBusy(false);
  }

  async function downloadReport() {
    const XLSX: any = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([['ردیف در فایل', 'وضعیت', 'پیام'], ...results.map((r) => [r.row, STATUS[r.status]?.[2] || r.status, r.message])]);
    ws['!cols'] = [{ wch: 14 }, { wch: 18 }, { wch: 100 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'گزارش');
    XLSX.writeFile(wb, 'vira-import-report.xlsx');
  }

  const count = (s: string) => results.filter((r) => r.status === s).length;
  const shown = results.filter((r) => !onlyErrors || r.status === 'error');
  const info = KINDS.find((k) => k.kind === kind)!;

  return (
    <main style={{ minHeight: '100vh', background: '#f3f4f6', padding: '32px 16px' }} dir="rtl">
      {toast.node}
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 'bold', color: '#1e3a8a' }}>ورود گروهی با فایل اکسل</h1>
          <a href="/admin" style={{ color: '#1e3a8a', fontSize: 14, textDecoration: 'none' }}>← بازگشت به پنل اصلی</a>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {KINDS.map((k) => (
            <button key={k.kind} onClick={() => !busy && reset(k.kind)} style={{ ...btn(kind === k.kind ? '#1e3a8a' : '#e5e7eb', kind === k.kind ? 'white' : '#374151'), padding: '8px 18px', fontSize: 13 }}>{k.title}</button>
          ))}
        </div>

        <div style={{ background: 'white', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.9, marginBottom: 10 }}>{info.desc}</p>
          <p style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.9, marginBottom: 12 }}>
            ترتیب پیشنهادی برای راه‌اندازی: ۱) مراکز (از بخش مراکز مخابراتی) ← ۲) خیابان‌های مراکز ← ۳) سرپرستان ← ۴) تکنسین‌ها. نام مراکز و خدمات باید دقیقاً مثل ثبت‌شده در سامانه باشد.
            هر ردیف مستقل ثبت می‌شود و اجرای دوباره‌ی همان فایل، مورد تکراری نمی‌سازد.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={downloadTemplate} style={{ ...btn('#0891b2'), padding: '8px 18px', fontSize: 13 }}>دانلود فایل نمونه (xlsx)</button>
            <input type="file" accept=".xlsx,.xls,.csv" disabled={busy} onChange={(e) => onFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)} style={{ fontSize: 13 }} />
          </div>
          {kind === 'technicians' && (
            <>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginTop: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={createStreets} onChange={(e) => setCreateStreets(e.target.checked)} />
                خیابانِ ناموجود (وقتی تکنسین فقط یک مرکز دارد) خودکار ساخته شود
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginTop: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={allServices} onChange={(e) => setAllServices(e.target.checked)} />
                اگر ستون «خدمات» خالی بود، همه‌ی خدمت‌های فعال به تکنسین داده شود
              </label>
            </>
          )}
          {err && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 10 }}>{err}</p>}
          {rows.length > 0 && (
            <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 13 }}>«{fileName}»: <b>{rows.length.toLocaleString('fa-IR')}</b> ردیف</span>
              <button onClick={() => process(true)} disabled={busy} style={{ ...btn('#d97706'), padding: '8px 18px', fontSize: 13, opacity: busy ? 0.6 : 1 }}>بررسی (بدون ثبت)</button>
              <button onClick={() => process(false)} disabled={busy} style={{ ...btn('#16a34a'), padding: '8px 18px', fontSize: 13, opacity: busy ? 0.6 : 1 }}>ثبت نهایی</button>
            </div>
          )}
          {busy && <div style={{ marginTop: 12, background: '#e5e7eb', borderRadius: 8, height: 10 }}><div style={{ width: progress + '%', background: '#1e3a8a', height: 10, borderRadius: 8, transition: 'width .3s' }} /></div>}
        </div>

        {results.length > 0 && (
          <div style={{ background: 'white', borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12, fontSize: 13 }}>
              <b>{mode === 'check' ? 'نتیجه‌ی بررسی (چیزی ثبت نشده)' : 'نتیجه‌ی ثبت'}:</b>
              <span>انجام‌شدنی/شده: {(count('ok') + count('updated')).toLocaleString('fa-IR')}</span>
              <span>ردشده: {count('skipped').toLocaleString('fa-IR')}</span>
              <span style={{ color: count('error') ? '#b91c1c' : undefined }}>خطا: {count('error').toLocaleString('fa-IR')}</span>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}><input type="checkbox" checked={onlyErrors} onChange={(e) => setOnlyErrors(e.target.checked)} />فقط خطاها</label>
              <button onClick={downloadReport} style={{ ...btn('#1e3a8a'), marginRight: 'auto' }}>دانلود گزارش (xlsx)</button>
            </div>
            <div style={{ overflowX: 'auto', maxHeight: 460, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', minWidth: 640 }}>
                <thead>
                  <tr style={{ background: '#f9fafb', fontSize: 13, color: '#6b7280' }}>
                    <th style={{ padding: 10 }}>ردیف فایل</th><th style={{ padding: 10 }}>وضعیت</th><th style={{ padding: 10 }}>پیام</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r, i) => {
                    const st = STATUS[r.status] || STATUS.error;
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
                        <td style={{ padding: 8 }}>{r.row.toLocaleString('fa-IR')}</td>
                        <td style={{ padding: 8 }}><span style={badge(st[0], st[1])}>{st[2]}</span></td>
                        <td style={{ padding: 8 }}>{r.message}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {isSuper && (
          <div style={{ background: 'white', borderRadius: 12, padding: 16, border: '1px solid #fecaca' }}>
            <h2 style={{ fontSize: 16, fontWeight: 'bold', color: '#991b1b', marginBottom: 8 }}>پاک‌سازی یک منطقه (مثلاً داده‌ی آزمایشی)</h2>
            <p style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.9, marginBottom: 12 }}>
              همه‌ی مراکز آن منطقه با خیابان‌ها، سرپرست‌ها و محدوده‌ی تکنسین‌ها حذف می‌شود. اگر بخواهید، تکنسین‌ها و سرپرست‌هایی که فقط در همین منطقه کار می‌کنند (و حساب‌هایی که با شماره‌ی موبایل ساخته شده‌اند و نقش دیگری ندارند) هم پاک می‌شوند.
              اگر در منطقه درخواست ثبت شده باشد، فقط با تیک حذف درخواست‌ها ادامه می‌دهد. این کار برگشت‌پذیر نیست.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <button onClick={loadDistricts} style={{ ...btn('#e5e7eb', '#374151'), padding: '8px 16px', fontSize: 13 }}>بارگذاری فهرست مناطق</button>
              <select value={purgeDistrict} onChange={(e) => { setPurgeDistrict(e.target.value); setSummary(null); setPurgeResult(null); setPurgeMsg(''); }} style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, minWidth: 200 }}>
                <option value="">— منطقه را انتخاب کنید —</option>
                {districts.map((d) => <option key={d.district} value={d.district}>{d.district} ({d.centers.toLocaleString('fa-IR')} مرکز)</option>)}
              </select>
              <button onClick={showSummary} disabled={!purgeDistrict} style={{ ...btn('#d97706'), padding: '8px 16px', fontSize: 13, opacity: purgeDistrict ? 1 : 0.5 }}>نمایش خلاصه</button>
            </div>

            {summary && (
              <div style={{ marginTop: 14, fontSize: 13, lineHeight: 2 }}>
                <div style={{ background: '#f9fafb', borderRadius: 10, padding: 12 }}>
                  مراکز: <b>{summary.centers}</b> · خیابان‌ها: <b>{summary.streets}</b> · سرپرست‌ها (پیوند): <b>{summary.supervisors}</b> · محدوده‌های تکنسین: <b>{summary.areas}</b><br />
                  تکنسین‌های فقط-این-منطقه: <b>{summary.technicians_only_here}</b> · سرپرست‌های فقط-این-منطقه: <b>{summary.supervisors_only_here}</b><br />
                  درخواست‌های ثبت‌شده: <b style={{ color: summary.requests > 0 ? '#b91c1c' : undefined }}>{summary.requests}</b> · فاکتورها: <b>{summary.invoices}</b>
                </div>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={purgePeople} onChange={(e) => setPurgePeople(e.target.checked)} />
                  تکنسین‌ها و سرپرست‌های فقط-این-منطقه (و حساب‌شان) هم حذف شوند
                </label>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={purgeRequests} onChange={(e) => setPurgeRequests(e.target.checked)} />
                  درخواست‌های ثبت‌شده در این منطقه (با فاکتورشان) هم حذف شوند
                </label>
                <textarea rows={2} value={purgeReason} onChange={(e) => setPurgeReason(e.target.value)} placeholder="دلیل پاک‌سازی *" style={{ width: '100%', boxSizing: 'border-box', marginTop: 10, padding: 8, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }} />
                <input value={purgeConfirm} onChange={(e) => setPurgeConfirm(e.target.value)} placeholder={'برای تأیید بنویسید: ' + purgeDistrict} style={{ width: '100%', boxSizing: 'border-box', marginTop: 8, padding: 8, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }} />
                <button onClick={doPurge} disabled={purgeBusy} style={{ ...btn('#dc2626'), padding: '8px 20px', fontSize: 13, marginTop: 10, opacity: purgeBusy ? 0.6 : 1 }}>{purgeBusy ? 'در حال پاک‌سازی...' : 'پاک‌سازی قطعی منطقه'}</button>
              </div>
            )}

            {purgeMsg && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 10 }}>{purgeMsg}</p>}
            {purgeResult && (
              <div style={{ marginTop: 12, background: '#f0fdf4', borderRadius: 10, padding: 12, fontSize: 13, lineHeight: 2 }}>
                انجام شد: مرکز حذف‌شده <b>{purgeResult.centers_deleted}</b> (بایگانی‌شده: {purgeResult.centers_archived}) · خیابان <b>{purgeResult.streets}</b> · تکنسین <b>{purgeResult.technicians}</b> · حساب <b>{purgeResult.users}</b> · درخواست <b>{purgeResult.requests}</b>
                {(purgeResult.skipped || []).length > 0 && (
                  <div style={{ color: '#92400e' }}>
                    موارد ردشده: {(purgeResult.skipped as any[]).map((x, i) => <div key={i}>• {x.type}: {x.message}</div>)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
