'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { searchCenters, nameKey, type CenterRow } from '@/lib/fa';
import { parseCsv, toCsv } from '@/lib/csv';
import { recordsFromRows, planImport, TEMPLATE_HEADERS, type ImportPlan } from '@/lib/centersImport';

const card = { background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' } as const;
const input = { padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', width: '100%', boxSizing: 'border-box' as const, background: 'white' };
const btn = (bg: string, color = 'white') => ({ background: bg, color, border: 'none', borderRadius: '8px', padding: '9px 16px', cursor: 'pointer', fontWeight: 'bold' as const, fontSize: '13px' });
const smallBtn = (bg: string, color = 'white') => ({ background: bg, color, border: 'none', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontSize: '12px', marginLeft: '6px' });
const badge = (bg: string, color: string) => ({ display: 'inline-block', background: bg, color, borderRadius: '6px', padding: '2px 8px', fontSize: '11px', fontWeight: 'bold' as const, marginRight: '6px' });

const ACTION_LABELS: Record<string, string> = {
  create: 'ایجاد', update: 'ویرایش', delete: 'حذف منطقی', restore: 'بازگردانی', activate: 'فعال‌سازی',
  deactivate: 'غیرفعال‌سازی', verify: 'تأیید اطلاعات', unverify: 'بازگشت به نیازمند بررسی', purge: 'حذف فیزیکی',
};
const FIELD_LABELS: Record<string, string> = {
  name: 'نام', address: 'آدرس', province: 'استان', city: 'شهر', district: 'منطقه', covered_areas: 'محله‌ها',
  is_active: 'فعال', verification_status: 'وضعیت تأیید', deleted_at: 'حذف', source_note: 'منبع',
};
const STATUS_TEXT: Record<string, string> = { verified: 'تأییدشده', needs_review: 'نیازمند بررسی' };

const EMPTY_FORM = { name: '', address: '', province: 'تهران', city: '', district: '', covered_areas: '', verification_status: 'needs_review', is_active: true, source_note: '' };

const short = (v: unknown) => {
  const s = v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v);
  return s.length > 60 ? s.slice(0, 60) + '…' : s;
};

async function readTextSmart(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('windows-1256').decode(buf); // CSV ذخیره‌شده از اکسل فارسی (ویندوز)
  }
}

function download(name: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function TelecomCentersManager() {
  const [centers, setCenters] = useState<CenterRow[]>([]);
  const [schemaReady, setSchemaReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [view, setView] = useState<'list' | 'audit'>('list');

  // فیلترها
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [status, setStatus] = useState<'all' | 'verified' | 'needs_review'>('all');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [incomplete, setIncomplete] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [groupBy, setGroupBy] = useState<'city' | 'district' | 'none'>('city');
  const [selected, setSelected] = useState<string[]>([]);

  // فرم
  const [editingId, setEditingId] = useState<string | null>(null); // 'new' | id
  const [form, setForm] = useState<Record<string, any>>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);

  // ورود گروهی
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [importing, setImporting] = useState(false);

  // گزارش فعالیت
  const [audit, setAudit] = useState<any[]>([]);
  const [actors, setActors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await supabase.from('telecom_centers').select('*').order('name').limit(2000);
    if (res.error) setError(res.error.message);
    const rows = (res.data || []) as CenterRow[];
    setSchemaReady(rows.length === 0 || 'verification_status' in rows[0]);
    setCenters(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const loadAudit = useCallback(async () => {
    const res = await supabase.from('telecom_center_audit').select('*').order('created_at', { ascending: false }).limit(300);
    if (res.error) setError(res.error.message);
    setAudit(res.data || []);
    const users = await supabase.rpc('admin_list_users');
    const map: Record<string, string> = {};
    ((users.data || []) as any[]).forEach((u) => (map[u.id] = u.full_name || u.phone || u.id.slice(0, 8)));
    setActors(map);
  }, []);

  useEffect(() => {
    if (view === 'audit') loadAudit();
  }, [view, loadAudit]);

  // ---------- مشتقات ----------
  const dupKeys = useMemo(() => {
    const m = new Map<string, number>();
    centers.filter((c) => !c.deleted_at).forEach((c) => m.set(nameKey(c.name), (m.get(nameKey(c.name)) || 0) + 1));
    return new Set(Array.from(m.entries()).filter(([, n]) => n > 1).map(([k]) => k));
  }, [centers]);

  const live = centers.filter((c) => !c.deleted_at);
  const stats = {
    total: live.length,
    verified: live.filter((c) => c.verification_status === 'verified').length,
    review: live.filter((c) => c.verification_status !== 'verified').length,
    inactive: live.filter((c) => c.is_active === false).length,
    noAddress: live.filter((c) => !c.address).length,
    deleted: centers.length - live.length,
    dups: dupKeys.size,
  };
  const cities = Array.from(new Set(centers.map((c) => c.city || '').filter(Boolean))).sort((a, b) => a.localeCompare(b, 'fa'));
  const districts = Array.from(new Set(centers.map((c) => c.district || '').filter(Boolean))).sort((a, b) => a.localeCompare(b, 'fa'));

  const filtered = useMemo(() => {
    let list = centers;
    if (!showDeleted) list = list.filter((c) => !c.deleted_at);
    if (city) list = list.filter((c) => (c.city || '') === city);
    if (district) list = list.filter((c) => (c.district || '') === district);
    if (status !== 'all') list = list.filter((c) => c.verification_status === status);
    if (activeFilter === 'active') list = list.filter((c) => c.is_active !== false && !c.deleted_at);
    if (activeFilter === 'inactive') list = list.filter((c) => c.is_active === false);
    if (incomplete) list = list.filter((c) => !c.address);
    return searchCenters(list, q).map((h) => h.center);
  }, [centers, q, city, district, status, activeFilter, incomplete, showDeleted]);

  const groups = useMemo(() => {
    if (groupBy === 'none') return [{ title: '', items: filtered }];
    const key = (c: CenterRow) => (groupBy === 'city' ? c.city : c.district) || (groupBy === 'city' ? 'بدون شهر/شهرستان' : 'بدون منطقه');
    const map = new Map<string, CenterRow[]>();
    filtered.forEach((c) => map.set(key(c), [...(map.get(key(c)) || []), c]));
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'fa')).map(([title, items]) => ({ title, items }));
  }, [filtered, groupBy]);

  // ---------- عملیات ----------
  async function patch(ids: string[], values: Partial<CenterRow>, okMsg: string) {
    setError(''); setMsg('');
    const res = await supabase.from('telecom_centers').update(values).in('id', ids);
    if (res.error) { setError(res.error.message); return; }
    setMsg(okMsg);
    setSelected((s) => s.filter((x) => !ids.includes(x)));
    await load();
  }

  const verifyOne = (c: CenterRow) => {
    if (c.verification_status !== 'verified' && !c.address) { setError('برای تأییدِ مرکز، ابتدا آدرس آن را کامل کنید.'); return; }
    return patch([c.id], { verification_status: c.verification_status === 'verified' ? 'needs_review' : 'verified' }, c.verification_status === 'verified' ? 'مرکز به «نیازمند بررسی» برگشت و از فرم مشتری حذف شد.' : 'مرکز تأیید شد و در فرم مشتری نمایش داده می‌شود.');
  };
  const toggleActive = (c: CenterRow) => patch([c.id], { is_active: c.is_active === false }, c.is_active === false ? 'مرکز دوباره فعال شد.' : 'مرکز موقتاً غیرفعال شد.');
  const softDelete = (c: CenterRow) => confirm(`«${c.name}» حذف منطقی شود؟\nدرخواست‌های قبلی و اطلاعات مرکز در آن‌ها دست‌نخورده می‌ماند؛ فقط از فهرست انتخاب مشتری برداشته می‌شود و بعداً قابل بازگردانی است.`) && patch([c.id], { deleted_at: new Date().toISOString(), is_active: false }, 'مرکز حذف منطقی شد.');
  const restore = (c: CenterRow) => patch([c.id], { deleted_at: null, is_active: true }, 'مرکز بازگردانی شد.');

  function startNew() { setForm(EMPTY_FORM); setEditingId('new'); setError(''); setMsg(''); }
  function startEdit(c: CenterRow) {
    setForm({ name: c.name || '', address: c.address || '', province: c.province || 'تهران', city: c.city || '', district: c.district || '', covered_areas: c.covered_areas || '', verification_status: c.verification_status || 'verified', is_active: c.is_active !== false, source_note: c.source_note || '' });
    setEditingId(c.id); setError(''); setMsg('');
  }

  async function save() {
    setError(''); setMsg('');
    const name = String(form.name || '').trim();
    if (!name) return setError('نام مرکز الزامی است.');
    const clash = centers.find((c) => !c.deleted_at && c.id !== editingId && nameKey(c.name) === nameKey(name));
    if (clash) return setError(`مرکزی با همین نام (یا نام مشابه) از قبل ثبت شده است: «${clash.name}». برای جلوگیری از تکرار، همان را ویرایش کنید.`);
    if (form.verification_status === 'verified' && !String(form.address || '').trim()) return setError('مرکزِ «تأییدشده» باید آدرس داشته باشد.');

    const payload = {
      name,
      address: String(form.address || '').trim() || null,
      province: String(form.province || '').trim() || null,
      city: String(form.city || '').trim() || null,
      district: String(form.district || '').trim() || null,
      covered_areas: String(form.covered_areas || '').trim() || null,
      verification_status: form.verification_status,
      is_active: !!form.is_active,
      source_note: String(form.source_note || '').trim() || null,
    };
    setBusy(true);
    const res = editingId === 'new' ? await supabase.from('telecom_centers').insert(payload) : await supabase.from('telecom_centers').update(payload).eq('id', editingId as string);
    setBusy(false);
    if (res.error) return setError(res.error.message);
    setMsg(editingId === 'new' ? 'مرکز جدید افزوده شد.' : 'تغییرات ذخیره شد.');
    setEditingId(null);
    await load();
  }

  // ---------- ورود/خروج گروهی ----------
  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(''); setMsg(''); setPlan(null);
    try {
      let rows: any[][];
      if (/\.xlsx$/i.test(file.name)) {
        const { default: readXlsxFile } = await import('read-excel-file');
        rows = (await readXlsxFile(file)) as any[][];
      } else {
        rows = parseCsv(await readTextSmart(file));
      }
      const { records, invalid } = recordsFromRows(rows);
      setPlan(planImport(records, centers, invalid));
    } catch (e: any) {
      setError('خواندن فایل ممکن نشد: ' + (e?.message || e) + ' — فایل باید .xlsx یا .csv باشد.');
    }
  }

  async function applyImport() {
    if (!plan) return;
    setImporting(true); setError(''); setMsg('');
    let inserted = 0, updated = 0, downgraded = 0;
    try {
      const rows = plan.toInsert.map((r) => {
        let st = r.verification_status ?? 'needs_review';
        if (st === 'verified' && !r.address) { st = 'needs_review'; downgraded++; }
        return { name: r.name, address: r.address || null, province: r.province || 'تهران', city: r.city || null, district: r.district || null, covered_areas: r.covered_areas || null, verification_status: st, is_active: r.is_active ?? true, source_note: r.source_note || 'ورود گروهی از فایل' };
      });
      for (let i = 0; i < rows.length; i += 100) {
        const res = await supabase.from('telecom_centers').insert(rows.slice(i, i + 100));
        if (res.error) throw new Error(res.error.message);
        inserted += Math.min(100, rows.length - i);
      }
      for (const u of plan.toUpdate) {
        const r = u.record;
        const values: Record<string, any> = {};
        if (r.address) values.address = r.address;
        if (r.city) values.city = r.city;
        if (r.district) values.district = r.district;
        if (r.covered_areas) values.covered_areas = r.covered_areas;
        if (r.province) values.province = r.province;
        if (r.source_note) values.source_note = r.source_note;
        if (r.is_active !== undefined) values.is_active = r.is_active;
        if (r.verification_status) values.verification_status = r.verification_status;
        if (Object.keys(values).length === 0) continue;
        const res = await supabase.from('telecom_centers').update(values).eq('id', u.id);
        if (res.error) throw new Error(`«${u.existingName}»: ${res.error.message}`);
        updated++;
      }
      setMsg(`ورود گروهی انجام شد: ${inserted} مرکز جدید، ${updated} به‌روزرسانی${downgraded ? `، ${downgraded} مرکزِ «تأییدشده» بدون آدرس به «نیازمند بررسی» تبدیل شد` : ''}.`);
      setPlan(null);
    } catch (e: any) {
      setError(`ورود گروهی در میانه متوقف شد (${inserted} افزوده، ${updated} به‌روزرسانی شده است): ${e?.message || e}`);
    }
    setImporting(false);
    await load();
  }

  function exportCsv() {
    const rows = [TEMPLATE_HEADERS, ...filtered.map((c) => [c.name, c.address, c.province, c.city, c.district, c.covered_areas, c.verification_status === 'verified' ? 'تأییدشده' : 'نیازمند بررسی', c.is_active === false ? 'خیر' : 'بله', c.source_note])];
    download('telecom-centers.csv', toCsv(rows), 'text/csv;charset=utf-8');
  }
  function downloadTemplate() {
    download('telecom-centers-template.csv', toCsv([TEMPLATE_HEADERS, ['مرکز مخابرات نمونه', 'خیابان نمونه، پلاک ۱', 'تهران', 'تهران', 'منطقه ۲', 'محله الف، محله ب', 'نیازمند بررسی', 'بله', 'منبع اطلاعات']]), 'text/csv;charset=utf-8');
  }

  // ---------- نمایش ----------
  if (loading) return <p style={{ textAlign: 'center', color: '#6b7280', padding: 24 }}>در حال بارگذاری...</p>;

  if (!schemaReady) {
    return (
      <div style={{ ...card, background: '#fef3c7', color: '#92400e', lineHeight: 2 }}>
        ساختار بانک مراکز هنوز به‌روز نشده است. ابتدا فایل <b>0010_telecom_centers_directory.sql</b> (و بعد <b>0011_telecom_centers_seed.sql</b> برای داده‌ی اولیه) را در SQL Editor سوپابیس اجرا کنید.
      </div>
    );
  }

  const allVisibleSelected = filtered.length > 0 && filtered.every((c) => selected.includes(c.id));

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {(['list', 'audit'] as const).map((v) => (
          <button key={v} onClick={() => setView(v)} style={{ ...btn(view === v ? '#1e3a8a' : '#e5e7eb', view === v ? 'white' : '#374151') }}>
            {v === 'list' ? '🏢 فهرست مراکز' : '📋 گزارش تغییرات'}
          </button>
        ))}
      </div>

      {error && <p style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 8, padding: 10, fontSize: 13, marginBottom: 12, lineHeight: 1.9 }}>{error}</p>}
      {msg && <p style={{ background: '#d1fae5', color: '#065f46', borderRadius: 8, padding: 10, fontSize: 13, marginBottom: 12, lineHeight: 1.9 }}>{msg}</p>}

      {view === 'audit' && (
        <div style={card}>
          <h3 style={{ fontSize: 17, fontWeight: 'bold', color: '#1e3a8a', marginBottom: 12 }}>گزارش تغییرات مراکز ({audit.length.toLocaleString('fa-IR')} مورد اخیر)</h3>
          {audit.length === 0 && <p style={{ color: '#9ca3af', textAlign: 'center', padding: 16 }}>هنوز تغییری ثبت نشده است.</p>}
          {audit.map((a) => (
            <div key={a.id} style={{ borderBottom: '1px solid #f3f4f6', padding: '10px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <span><b>{ACTION_LABELS[a.action] || a.action}</b> — {a.center_name}</span>
                <span style={{ fontSize: 12, color: '#6b7280' }}>{new Date(a.created_at).toLocaleString('fa-IR')} · {a.actor_id ? actors[a.actor_id] || a.actor_id.slice(0, 8) : 'سیستم/SQL'}</span>
              </div>
              {a.changes && a.action !== 'create' && (
                <p style={{ fontSize: 12, color: '#4b5563', marginTop: 4, lineHeight: 1.9 }}>
                  {Object.entries(a.changes as Record<string, any>).map(([k, v]) => `${FIELD_LABELS[k] || k}: «${short(v?.old)}» ← «${short(v?.new)}»`).join(' | ')}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {view === 'list' && (
        <>
          <div style={{ ...card, display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 13 }}>
            <span style={badge('#dbeafe', '#1d4ed8')}>کل: {stats.total.toLocaleString('fa-IR')}</span>
            <span style={badge('#d1fae5', '#065f46')}>تأییدشده: {stats.verified.toLocaleString('fa-IR')}</span>
            <span style={badge('#fef3c7', '#92400e')}>نیازمند بررسی: {stats.review.toLocaleString('fa-IR')}</span>
            <span style={badge('#fee2e2', '#b91c1c')}>بدون آدرس: {stats.noAddress.toLocaleString('fa-IR')}</span>
            <span style={badge('#f3f4f6', '#374151')}>غیرفعال: {stats.inactive.toLocaleString('fa-IR')}</span>
            <span style={badge('#f3f4f6', '#374151')}>حذف‌شده: {stats.deleted.toLocaleString('fa-IR')}</span>
            {stats.dups > 0 && <span style={badge('#fee2e2', '#b91c1c')}>نام تکراری: {stats.dups.toLocaleString('fa-IR')}</span>}
            <span style={{ color: '#6b7280' }}>فقط مراکزِ «تأییدشده + فعال» در فرم مشتری دیده می‌شوند.</span>
          </div>

          {/* فرم افزودن/ویرایش */}
          {editingId !== null && (
            <div style={{ ...card, background: '#f9fafb' }}>
              <h3 style={{ fontSize: 17, fontWeight: 'bold', color: '#1e3a8a', marginBottom: 12 }}>{editingId === 'new' ? 'افزودن مرکز جدید' : 'ویرایش مرکز'}</h3>
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
                <label>نام مرکز *<input style={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثلاً مرکز مخابرات شهید قدوسی" /></label>
                <label>شهر یا شهرستان<input style={input} list="vira-cities" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label>
                <label>استان<input style={input} value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} /></label>
                <label>منطقه مخابراتی (اختیاری)<input style={input} list="vira-districts" value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} placeholder="مثلاً منطقه ۲" /></label>
              </div>
              <datalist id="vira-cities">{cities.map((c) => <option key={c} value={c} />)}</datalist>
              <datalist id="vira-districts">{districts.map((c) => <option key={c} value={c} />)}</datalist>
              <label style={{ display: 'block', marginTop: 12 }}>آدرس کامل
                <textarea style={{ ...input, minHeight: 70 }} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="خیابان شریعتی، خیابان ..." />
              </label>
              <label style={{ display: 'block', marginTop: 12 }}>محله‌ها و مناطق تحت پوشش (با ویرگول جدا کنید؛ برای جست‌وجوی مشتری)
                <textarea style={{ ...input, minHeight: 60 }} value={form.covered_areas} onChange={(e) => setForm({ ...form, covered_areas: e.target.value })} placeholder="ونک، شیخ‌بهایی، ملاصدرا" />
              </label>
              <label style={{ display: 'block', marginTop: 12 }}>منبع / توضیح راستی‌آزمایی
                <textarea style={{ ...input, minHeight: 50 }} value={form.source_note} onChange={(e) => setForm({ ...form, source_note: e.target.value })} />
              </label>
              <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <label>وضعیت تأیید:{' '}
                  <select style={{ ...input, width: 'auto' }} value={form.verification_status} onChange={(e) => setForm({ ...form, verification_status: e.target.value })}>
                    <option value="needs_review">نیازمند بررسی (برای مشتری نمایش داده نمی‌شود)</option>
                    <option value="verified">تأییدشده (برای مشتری نمایش داده می‌شود)</option>
                  </select>
                </label>
                <label><input type="checkbox" checked={!!form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> فعال</label>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button onClick={save} disabled={busy} style={{ ...btn('#1e3a8a'), opacity: busy ? 0.6 : 1 }}>{busy ? 'در حال ذخیره...' : 'ذخیره'}</button>
                <button onClick={() => setEditingId(null)} style={btn('#e5e7eb', '#374151')}>انصراف</button>
              </div>
            </div>
          )}

          {/* جست‌وجو، فیلتر، ابزارها */}
          <div style={card}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              <button onClick={startNew} style={btn('#16a34a')}>+ افزودن مرکز</button>
              <button onClick={exportCsv} style={btn('#0f766e')}>خروجی CSV</button>
              <button onClick={downloadTemplate} style={btn('#e5e7eb', '#374151')}>دانلود قالب ورود گروهی</button>
              <label style={{ ...btn('#1e3a8a'), display: 'inline-block' }}>
                ورود گروهی (Excel/CSV)
                <input type="file" accept=".xlsx,.csv,.txt" style={{ display: 'none' }} onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
              </label>
            </div>
            <input style={{ ...input, marginBottom: 10 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="جست‌وجو در نام، آدرس، محله، شهر یا منطقه..." />
            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
              <select style={input} value={city} onChange={(e) => setCity(e.target.value)}><option value="">همه شهرها/شهرستان‌ها</option>{cities.map((c) => <option key={c} value={c}>{c}</option>)}</select>
              <select style={input} value={district} onChange={(e) => setDistrict(e.target.value)}><option value="">همه مناطق</option>{districts.map((c) => <option key={c} value={c}>{c}</option>)}</select>
              <select style={input} value={status} onChange={(e) => setStatus(e.target.value as any)}><option value="all">همه وضعیت‌های تأیید</option><option value="verified">تأییدشده</option><option value="needs_review">نیازمند بررسی</option></select>
              <select style={input} value={activeFilter} onChange={(e) => setActiveFilter(e.target.value as any)}><option value="all">فعال و غیرفعال</option><option value="active">فقط فعال</option><option value="inactive">فقط غیرفعال</option></select>
              <select style={input} value={groupBy} onChange={(e) => setGroupBy(e.target.value as any)}><option value="city">گروه‌بندی: شهر/شهرستان</option><option value="district">گروه‌بندی: منطقه</option><option value="none">بدون گروه‌بندی</option></select>
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 13, flexWrap: 'wrap' }}>
              <label><input type="checkbox" checked={incomplete} onChange={(e) => setIncomplete(e.target.checked)} /> فقط مراکز ناقص (بدون آدرس)</label>
              <label><input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} /> نمایش حذف‌شده‌ها</label>
              <span style={{ color: '#6b7280' }}>{filtered.length.toLocaleString('fa-IR')} مرکز نمایش داده می‌شود</span>
            </div>
          </div>

          {/* پیش‌نمایش ورود گروهی */}
          {plan && (
            <div style={{ ...card, border: '2px solid #1e3a8a' }}>
              <h3 style={{ fontSize: 17, fontWeight: 'bold', color: '#1e3a8a', marginBottom: 10 }}>پیش‌نمایش ورود گروهی ({plan.total.toLocaleString('fa-IR')} ردیف)</h3>
              <p style={{ fontSize: 13, lineHeight: 2 }}>
                <span style={badge('#d1fae5', '#065f46')}>جدید: {plan.toInsert.length}</span>
                <span style={badge('#dbeafe', '#1d4ed8')}>به‌روزرسانی: {plan.toUpdate.length}</span>
                <span style={badge('#fef3c7', '#92400e')}>تکراری در فایل (نادیده): {plan.duplicatesInFile.length}</span>
                <span style={badge('#fee2e2', '#b91c1c')}>نامعتبر: {plan.invalid.length}</span>
              </p>
              <p style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.9 }}>مراکز جدید پیش‌فرض «نیازمند بررسی» ثبت می‌شوند مگر در ستون «وضعیت تأیید» چیز دیگری نوشته باشید. در به‌روزرسانی، فقط ستون‌های پُر در فایل اعمال می‌شود و داده‌های موجودِ بقیه‌ی ستون‌ها دست‌نخورده می‌ماند.</p>
              {plan.toInsert.length > 0 && <p style={{ fontSize: 12, marginTop: 8 }}><b>جدید:</b> {plan.toInsert.slice(0, 8).map((r) => r.name).join('، ')}{plan.toInsert.length > 8 ? ' …' : ''}</p>}
              {plan.toUpdate.length > 0 && <p style={{ fontSize: 12, marginTop: 4 }}><b>به‌روزرسانی:</b> {plan.toUpdate.slice(0, 8).map((u) => u.existingName).join('، ')}{plan.toUpdate.length > 8 ? ' …' : ''}</p>}
              {plan.duplicatesInFile.length > 0 && <p style={{ fontSize: 12, marginTop: 4, color: '#92400e' }}><b>تکراری:</b> {plan.duplicatesInFile.slice(0, 6).map((d) => `سطر ${d.line} (= سطر ${d.sameAsLine})`).join('، ')}</p>}
              {plan.invalid.length > 0 && <p style={{ fontSize: 12, marginTop: 4, color: '#b91c1c' }}><b>نامعتبر:</b> {plan.invalid.slice(0, 6).map((d) => `سطر ${d.line}: ${d.reason}`).join('، ')}</p>}
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button onClick={applyImport} disabled={importing || (plan.toInsert.length + plan.toUpdate.length === 0)} style={{ ...btn('#16a34a'), opacity: importing || plan.toInsert.length + plan.toUpdate.length === 0 ? 0.5 : 1 }}>{importing ? 'در حال ثبت...' : 'اعمال ورود گروهی'}</button>
                <button onClick={() => setPlan(null)} style={btn('#e5e7eb', '#374151')}>انصراف</button>
              </div>
            </div>
          )}

          {/* عملیات گروهی */}
          {selected.length > 0 && (
            <div style={{ ...card, background: '#eff6ff', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <b>{selected.length.toLocaleString('fa-IR')} مرکز انتخاب شده:</b>
              <button style={btn('#16a34a')} onClick={() => {
                const noAddr = centers.filter((c) => selected.includes(c.id) && !c.address);
                if (noAddr.length) { setError(`${noAddr.length} مرکز انتخاب‌شده آدرس ندارد و تأیید نمی‌شود؛ ابتدا آدرس را کامل کنید یا انتخابشان را بردارید. (${noAddr.slice(0, 3).map((c) => c.name).join('، ')} ...)`); return; }
                patch(selected, { verification_status: 'verified' }, 'مراکز انتخاب‌شده تأیید شدند.');
              }}>تأیید گروهی</button>
              <button style={btn('#d97706')} onClick={() => patch(selected, { verification_status: 'needs_review' }, 'مراکز انتخاب‌شده به «نیازمند بررسی» برگشتند.')}>بازگشت به نیازمند بررسی</button>
              <button style={btn('#6b7280')} onClick={() => patch(selected, { is_active: false }, 'مراکز انتخاب‌شده غیرفعال شدند.')}>غیرفعال‌سازی</button>
              <button style={btn('#e5e7eb', '#374151')} onClick={() => setSelected([])}>لغو انتخاب</button>
            </div>
          )}

          {/* فهرست */}
          <div style={card}>
            {filtered.length > 0 && (
              <label style={{ fontSize: 13, display: 'block', marginBottom: 10 }}>
                <input type="checkbox" checked={allVisibleSelected} onChange={(e) => setSelected(e.target.checked ? Array.from(new Set([...selected, ...filtered.map((c) => c.id)])) : selected.filter((id) => !filtered.some((c) => c.id === id)))} /> انتخاب همه‌ی موارد نمایش‌داده‌شده
              </label>
            )}
            {filtered.length === 0 && <p style={{ textAlign: 'center', color: '#9ca3af', padding: 24 }}>مرکزی با این فیلتر پیدا نشد.</p>}
            {groups.map((g) => (
              <div key={g.title || 'all'} style={{ marginBottom: 18 }}>
                {g.title && <h4 style={{ fontSize: 15, fontWeight: 'bold', color: '#1e3a8a', margin: '6px 0 8px' }}>{g.title} <span style={{ color: '#9ca3af', fontWeight: 'normal', fontSize: 12 }}>({g.items.length.toLocaleString('fa-IR')})</span></h4>}
                {g.items.map((c) => {
                  const deleted = !!c.deleted_at;
                  return (
                    <div key={c.id} style={{ background: deleted ? '#f3f4f6' : '#f9fafb', opacity: deleted ? 0.7 : 1, borderRadius: 8, padding: 12, marginBottom: 8, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <input type="checkbox" checked={selected.includes(c.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, c.id] : selected.filter((x) => x !== c.id))} style={{ marginTop: 4 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ marginBottom: 4 }}>
                          <b style={{ color: '#1e3a8a' }}>{c.name}</b>{' '}
                          {c.verification_status === 'verified' ? <span style={badge('#d1fae5', '#065f46')}>تأییدشده</span> : <span style={badge('#fef3c7', '#92400e')}>نیازمند بررسی</span>}
                          {c.is_active === false && <span style={badge('#e5e7eb', '#374151')}>غیرفعال</span>}
                          {deleted && <span style={badge('#fee2e2', '#b91c1c')}>حذف‌شده</span>}
                          {!c.address && <span style={badge('#fee2e2', '#b91c1c')}>آدرس ناقص</span>}
                          {!deleted && dupKeys.has(nameKey(c.name)) && <span style={badge('#fee2e2', '#b91c1c')}>نام تکراری</span>}
                        </div>
                        {c.address && <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.8 }}>آدرس: {c.address}</p>}
                        <p style={{ fontSize: 12, color: '#6b7280' }}>{[c.city, c.district].filter(Boolean).join(' · ') || 'شهر/منطقه ثبت نشده'}</p>
                        {c.covered_areas && <p style={{ fontSize: 12, color: '#0f766e', lineHeight: 1.8 }}>محله‌ها: {c.covered_areas}</p>}
                        {c.source_note && <p style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.8 }}>{c.source_note}</p>}
                      </div>
                      <div style={{ whiteSpace: 'nowrap', display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-end', maxWidth: 260 }}>
                        {!deleted && <button style={smallBtn('#1e3a8a')} onClick={() => startEdit(c)}>ویرایش</button>}
                        {!deleted && <button style={smallBtn(c.verification_status === 'verified' ? '#d97706' : '#16a34a')} onClick={() => verifyOne(c)}>{c.verification_status === 'verified' ? 'لغو تأیید' : 'تأیید'}</button>}
                        {!deleted && <button style={smallBtn('#6b7280')} onClick={() => toggleActive(c)}>{c.is_active === false ? 'فعال‌سازی' : 'غیرفعال‌سازی'}</button>}
                        {!deleted ? <button style={smallBtn('#dc2626')} onClick={() => softDelete(c)}>حذف</button> : <button style={smallBtn('#16a34a')} onClick={() => restore(c)}>بازگردانی</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
