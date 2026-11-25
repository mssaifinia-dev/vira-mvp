'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useMyPerms } from '@/lib/useMyPerms';
import { Field, Modal, badge, btn, fmtDate, inputStyle, labelStyle, useToast, type AuditRow } from '@/components/admin/ui';

type LogRow = AuditRow & { module: string; table_name: string; record_id: string | null };

const PAGE = 100;

const moduleLabels: Record<string, string> = {
  sellers: 'فروشندگان',
  technicians: 'تکنسین‌ها',
  customers: 'مشتریان',
  requests: 'درخواست‌ها',
  admins: 'مدیران',
  orders: 'سفارش‌ها',
  inventory: 'انبار و محصولات',
  finance: 'مالی',
  discounts: 'تخفیف‌ها',
  advertisements: 'تبلیغات',
  academy: 'آکادمی',
  about: 'درباره ما',
  ai: 'Vira AI',
  services: 'خدمات و محدوده‌ها',
  audit: 'تاریخچه',
};

const actionLabels: Record<string, string> = {
  create: 'ایجاد',
  create_by_admin: 'ایجاد توسط مدیر',
  update: 'ویرایش',
  archive: 'حذف / بایگانی',
  restore: 'بازیابی',
  delete: 'حذف قطعی',
  cancel: 'لغو',
  undo: 'بازگردانی',
  delete_by_admin: 'حذف درخواست توسط ادمین اصلی',
  audit_purge: 'پاک‌سازی تاریخچه',
};

const actionColor: Record<string, [string, string]> = {
  create: ['#d1fae5', '#065f46'],
  create_by_admin: ['#d1fae5', '#065f46'],
  update: ['#dbeafe', '#1d4ed8'],
  archive: ['#fee2e2', '#dc2626'],
  delete: ['#fee2e2', '#7f1d1d'],
  restore: ['#e0e7ff', '#3730a3'],
  cancel: ['#fef3c7', '#d97706'],
  undo: ['#f3e8ff', '#7e22ce'],
  delete_by_admin: ['#fee2e2', '#7f1d1d'],
  audit_purge: ['#e5e7eb', '#374151'],
};

const UNDOABLE = ['update', 'archive', 'restore', 'create', 'delete'];

function show(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return s.length > 160 ? s.slice(0, 160) + '…' : s;
}

export default function AdminHistoryPage() {
  const toast = useToast();
  const [rows, setRows] = useState<LogRow[]>([]);
  const [undone, setUndone] = useState<Record<number, boolean>>({});
  const [actors, setActors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [tableMissing, setTableMissing] = useState(false);

  const [moduleF, setModuleF] = useState('all');
  const [actionF, setActionF] = useState('all');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [actorF, setActorF] = useState('');

  const [detail, setDetail] = useState<LogRow | null>(null);
  const [undoRow, setUndoRow] = useState<LogRow | null>(null);
  const [undoPlan, setUndoPlan] = useState<any | null>(null);
  const [undoLoading, setUndoLoading] = useState(false);
  const [undoReason, setUndoReason] = useState('');
  const [undoErr, setUndoErr] = useState('');
  const [undoBusy, setUndoBusy] = useState(false);

  // پاک‌سازی تاریخچه (فقط ادمین اصلی)
  const myPerms = useMyPerms();
  const isSuper = !!myPerms.perms?.super;
  const [selected, setSelected] = useState<number[]>([]);
  const [purgeMode, setPurgeMode] = useState<null | 'selected' | 'before'>(null);
  const [purgeReason, setPurgeReason] = useState('');
  const [purgeBefore, setPurgeBefore] = useState('');
  const [purgeTrace, setPurgeTrace] = useState(true);
  const [purgeErr, setPurgeErr] = useState('');
  const [purgeBusy, setPurgeBusy] = useState(false);

  const fetchPage = useCallback(
    async (offset: number) => {
      let q: any = supabase.from('audit_log').select('*');
      if (moduleF !== 'all') q = q.eq('module', moduleF);
      if (actionF === 'removed') q = q.in('action', ['archive', 'delete']);
      else if (actionF !== 'all') q = q.eq('action', actionF);
      if (fromDate) q = q.gte('created_at', new Date(fromDate + 'T00:00:00').toISOString());
      if (toDate) q = q.lte('created_at', new Date(toDate + 'T23:59:59').toISOString());
      if (actorF) q = q.eq('actor_id', actorF);
      const term = search.replace(/[,()%*\\]/g, ' ').trim();
      if (term) q = q.or('record_id.ilike.%' + term + '%,table_name.ilike.%' + term + '%,reason.ilike.%' + term + '%');
      const res = await q.order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + PAGE - 1);
      if (res.error) {
        if (/audit_log|relation|schema cache/i.test(res.error.message)) setTableMissing(true);
        else toast.show('err', res.error.message);
        return [] as LogRow[];
      }
      const list = (res.data || []) as LogRow[];
      if (list.length) {
        const u = await supabase.from('audit_undos').select('audit_id').in('audit_id', list.map((r) => r.id));
        if (u.data) {
          setUndone((prev) => {
            const next = { ...prev };
            (u.data as any[]).forEach((x) => (next[x.audit_id] = true));
            return next;
          });
        }
      }
      setHasMore(list.length === PAGE);
      return list;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [moduleF, actionF, fromDate, toDate, search, actorF]
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setRows(await fetchPage(0));
    setLoading(false);
  }, [fetchPage]);

  useEffect(() => {
    (async () => {
      const userRes = await supabase.auth.getUser();
      const user = userRes.data.user;
      if (!user) { window.location.href = '/auth'; return; }
      const adminRes = await supabase.from('admins').select('id').eq('user_id', user.id).maybeSingle();
      if (!adminRes.data) { window.location.href = '/'; return; }
      const qs = new URLSearchParams(window.location.search);
      const m = qs.get('module');
      if (m && moduleLabels[m]) setModuleF(m);
      const actor = qs.get('actor');
      if (actor && /^[0-9a-f-]{36}$/i.test(actor)) setActorF(actor);
      const users = await supabase.rpc('admin_list_users');
      if (users.data) {
        const map: Record<string, string> = {};
        (users.data as any[]).forEach((u) => (map[u.id] = u.full_name || u.phone || u.id.slice(0, 6)));
        setActors(map);
      }
    })();
  }, []);

  useEffect(() => {
    const t = setTimeout(reload, 250);
    return () => clearTimeout(t);
  }, [reload]);

  async function loadMore() {
    setLoadingMore(true);
    const more = await fetchPage(rows.length);
    setRows((prev) => [...prev, ...more]);
    setLoadingMore(false);
  }

  // ---------- بازگردانی ----------
  async function openUndo(r: LogRow) {
    setUndoRow(r);
    setUndoPlan(null);
    setUndoReason('');
    setUndoErr('');
    setUndoLoading(true);
    const res = await supabase.rpc('audit_undo_plan', { p_audit_id: r.id });
    setUndoLoading(false);
    if (res.error) setUndoPlan({ ok: false, message: res.error.message });
    else setUndoPlan(res.data);
  }

  async function confirmUndo() {
    if (!undoRow) return;
    if (!undoReason.trim()) { setUndoErr('ثبت دلیل بازگردانی الزامی است'); return; }
    setUndoBusy(true);
    const res = await supabase.rpc('admin_undo_audit', { p_audit_id: undoRow.id, p_reason: undoReason.trim() });
    setUndoBusy(false);
    if (res.error) { setUndoErr(res.error.message); return; }
    toast.show('ok', 'تغییر بازگردانده شد و در تاریخچه ثبت گردید.');
    setUndoRow(null);
    reload();
  }

  function openPurge(mode: 'selected' | 'before') {
    setPurgeMode(mode); setPurgeReason(''); setPurgeErr(''); setPurgeTrace(true);
    if (mode === 'before') setPurgeBefore('');
  }

  async function confirmPurge() {
    if (!purgeMode) return;
    if (!purgeReason.trim()) { setPurgeErr('ثبت دلیل پاک‌سازی الزامی است'); return; }
    setPurgeBusy(true); setPurgeErr('');
    let res: any;
    if (purgeMode === 'selected') {
      res = await supabase.rpc('admin_delete_audit_entries', { p_ids: selected, p_reason: purgeReason.trim(), p_leave_trace: purgeTrace });
    } else {
      if (!purgeBefore) { setPurgeBusy(false); setPurgeErr('تاریخ را مشخص کنید'); return; }
      res = await supabase.rpc('admin_delete_audit_before', { p_before: new Date(purgeBefore + 'T00:00:00').toISOString(), p_reason: purgeReason.trim(), p_leave_trace: purgeTrace });
    }
    setPurgeBusy(false);
    if (res.error) { setPurgeErr(res.error.message); return; }
    toast.show('ok', Number(res.data?.deleted || 0).toLocaleString('fa-IR') + ' ردیف از تاریخچه پاک شد.');
    setPurgeMode(null);
    setSelected([]);
    reload();
  }

  const allSelected = rows.length > 0 && rows.every((r) => selected.includes(r.id));
  function toggleAll() {
    setSelected(allSelected ? selected.filter((id) => !rows.some((r) => r.id === id)) : Array.from(new Set([...selected, ...rows.map((r) => r.id)])));
  }
  function toggleOne(id: number) {
    setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  const th = { padding: '12px' } as const;
  const td = { padding: '10px 12px' } as const;

  return (
    <main style={{ minHeight: '100vh', background: '#f3f4f6', padding: '32px 16px' }} dir="rtl">
      {toast.node}
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 'bold', color: '#1e3a8a' }}>تاریخچه تغییرات و بازگردانی</h1>
          <a href="/admin" style={{ color: '#1e3a8a', fontSize: 14, textDecoration: 'none' }}>← بازگشت به پنل اصلی</a>
        </div>

        {tableMissing && (
          <div style={{ background: '#fef3c7', color: '#92400e', borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 14 }}>
            جدول تاریخچه هنوز ساخته نشده است. فایل‌های 02_stage1 و 03_stage2 را در Supabase اجرا کنید.
          </div>
        )}

        <div style={{ background: 'white', borderRadius: 12, padding: 16, marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جستجو شناسه رکورد، جدول یا دلیل..." style={{ ...inputStyle, flex: 1, minWidth: 200, width: 'auto' }} />
          <select value={moduleF} onChange={(e) => setModuleF(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
            <option value="all">همه ماژول‌ها</option>
            {Object.keys(moduleLabels).map((k) => <option key={k} value={k}>{moduleLabels[k]}</option>)}
          </select>
          <select value={actionF} onChange={(e) => setActionF(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
            <option value="all">همه عملیات</option>
            <option value="removed">حذف‌شده‌ها و بایگانی‌ها (قابل بازیابی)</option>
            {Object.keys(actionLabels).map((k) => <option key={k} value={k}>{actionLabels[k]}</option>)}
          </select>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={{ ...inputStyle, width: 'auto' }} aria-label="از تاریخ" />
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={{ ...inputStyle, width: 'auto' }} aria-label="تا تاریخ" />
        </div>

        {actorF && (
          <div style={{ background: '#fef3c7', color: '#92400e', borderRadius: 10, padding: 10, marginBottom: 12, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>فقط فعالیت‌های «{actors[actorF] || actorF.slice(0, 6)}» نمایش داده می‌شود.</span>
            <button onClick={() => setActorF('')} style={btn('#fde68a', '#92400e')}>نمایش همه ✕</button>
          </div>
        )}
        <div style={{ background: '#eef2ff', borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 13, color: '#3730a3', lineHeight: 1.9 }}>
          بازگردانی فقط وقتی انجام می‌شود که رکورد پس از آن تغییر دوباره ویرایش نشده باشد. سوابق مالی (سفارش، فاکتور، پرداخت، حساب بانکی) و دسترسی مدیران با بازگردانی تغییر نمی‌کنند؛ برای اصلاح آن‌ها سند اصلاحی ثبت می‌شود. خود بازگردانی هم همیشه در همین تاریخچه ثبت می‌شود.
        </div>

        {isSuper && (
          <div style={{ background: '#fff7ed', borderRadius: 10, padding: 10, marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: '#9a3412' }}>پاک‌سازی تاریخچه (فقط ادمین اصلی):</span>
            <button onClick={() => openPurge('selected')} disabled={selected.length === 0} style={{ ...btn('#dc2626'), opacity: selected.length === 0 ? 0.5 : 1 }}>
              پاک‌کردن انتخاب‌شده‌ها ({selected.length.toLocaleString('fa-IR')})
            </button>
            <button onClick={() => openPurge('before')} style={btn('#7f1d1d')}>پاک‌کردن ردیف‌های قدیمی‌تر از تاریخ...</button>
            {selected.length > 0 && <button onClick={() => setSelected([])} style={btn('#e5e7eb', '#374151')}>لغو انتخاب</button>}
          </div>
        )}

        <div style={{ background: 'white', borderRadius: 12, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', minWidth: 900 }}>
            <thead style={{ background: '#1e3a8a', color: 'white' }}>
              <tr>
                {isSuper && <th style={th}><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="انتخاب همه" /></th>}
                <th style={th}>زمان</th>
                <th style={th}>ماژول</th>
                <th style={th}>عملیات</th>
                <th style={th}>رکورد</th>
                <th style={th}>انجام‌دهنده</th>
                <th style={th}>دلیل</th>
                <th style={th}>اقدام</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={isSuper ? 8 : 7} style={{ padding: 32, textAlign: 'center', color: '#6b7280' }}>در حال بارگذاری...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={isSuper ? 8 : 7} style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>سابقه‌ای یافت نشد</td></tr>
              ) : rows.map((r) => {
                const [bg, fg] = actionColor[r.action] || ['#f3f4f6', '#6b7280'];
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    {isSuper && <td style={td}><input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggleOne(r.id)} aria-label="انتخاب" /></td>}
                    <td style={{ ...td, fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtDate(r.created_at)}</td>
                    <td style={td}>{moduleLabels[r.module] || r.module}</td>
                    <td style={td}>
                      <span style={badge(bg, fg)}>{actionLabels[r.action] || r.action}</span>
                      {undone[r.id] && <span style={badge('#f3e8ff', '#7e22ce')}>بازگردانده شد</span>}
                    </td>
                    <td style={{ ...td, fontSize: 12, color: '#6b7280' }}>{r.table_name} · {r.record_id ? r.record_id.slice(0, 8) : '—'}</td>
                    <td style={{ ...td, fontSize: 13 }}>{r.actor_id ? actors[r.actor_id] || r.actor_id.slice(0, 6) : 'سیستم'}</td>
                    <td style={{ ...td, fontSize: 13, color: '#374151', maxWidth: 220 }}>{r.reason || '—'}</td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => setDetail(r)} style={btn('#e0e7ff', '#1e3a8a')}>جزئیات</button>
                        {UNDOABLE.includes(r.action) && !undone[r.id] && (
                          <button onClick={() => openUndo(r)} style={btn('#f3e8ff', '#7e22ce')}>بازگردانی</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {hasMore && !loading && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button onClick={loadMore} disabled={loadingMore} style={{ ...btn('#1e3a8a'), padding: '10px 24px', fontSize: 14 }}>
              {loadingMore ? 'در حال بارگذاری...' : 'نمایش موارد بیشتر'}
            </button>
          </div>
        )}
      </div>

      {/* جزئیات */}
      {detail && (
        <Modal title="جزئیات تغییر" onClose={() => setDetail(null)} width={680}>
          <div style={{ fontSize: 14, color: '#374151', lineHeight: 2 }}>
            <div>ماژول: {moduleLabels[detail.module] || detail.module} · جدول: {detail.table_name}</div>
            <div>شناسه رکورد: <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{detail.record_id || '—'}</span></div>
            <div>عملیات: {actionLabels[detail.action] || detail.action}</div>
            <div>زمان: {fmtDate(detail.created_at)}</div>
            <div>انجام‌دهنده: {detail.actor_id ? actors[detail.actor_id] || detail.actor_id : 'سیستم'}</div>
            {detail.reason && <div>دلیل: {detail.reason}</div>}
          </div>

          {detail.action === 'update' && (detail.changed_fields || []).length > 0 && (
            <div style={{ overflowX: 'auto', marginTop: 12 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'right' }}>
                <thead>
                  <tr style={{ background: '#f3f4f6' }}>
                    <th style={{ padding: 8 }}>فیلد</th>
                    <th style={{ padding: 8 }}>مقدار قبلی</th>
                    <th style={{ padding: 8 }}>مقدار جدید</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.changed_fields || []).filter((f) => f !== 'updated_at').map((f) => (
                    <tr key={f} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: 8, fontWeight: 'bold' }}>{f}</td>
                      <td style={{ padding: 8, color: '#b91c1c', wordBreak: 'break-word' }}>{show(detail.old_data?.[f])}</td>
                      <td style={{ padding: 8, color: '#065f46', wordBreak: 'break-word' }}>{show(detail.new_data?.[f])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {detail.action !== 'update' && (detail.old_data || detail.new_data) && (
            <div style={{ marginTop: 12 }}>
              <label style={labelStyle}>{detail.new_data ? 'اطلاعات رکورد' : 'اطلاعات رکورد پیش از حذف'}</label>
              <pre dir="ltr" style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 10, fontSize: 12, maxHeight: 260, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {JSON.stringify(detail.new_data || detail.old_data, null, 2).slice(0, 4000)}
              </pre>
            </div>
          )}
        </Modal>
      )}

      {/* پاک‌سازی تاریخچه */}
      {purgeMode && (
        <Modal title="پاک‌سازی تاریخچه" onClose={() => !purgeBusy && setPurgeMode(null)} width={560}>
          <div style={{ background: '#fee2e2', color: '#991b1b', borderRadius: 10, padding: 12, fontSize: 13, lineHeight: 1.9 }}>
            {purgeMode === 'selected'
              ? selected.length.toLocaleString('fa-IR') + ' ردیف انتخاب‌شده برای همیشه پاک می‌شود.'
              : 'همه‌ی ردیف‌های قدیمی‌تر از تاریخ انتخابی برای همیشه پاک می‌شود.'}
            {' '}این کار برگشت‌پذیر نیست؛ ردیف‌های پاک‌شده دیگر قابل بازگردانی نیستند و ردیف‌های «حذف درخواست توسط ادمین اصلی» که پاک شوند، نسخه‌ی پشتیبان آن درخواست‌ها هم از بین می‌رود.
          </div>
          {purgeMode === 'before' && (
            <Field label="پاک‌کردن ردیف‌های قبل از این تاریخ *">
              <input type="date" value={purgeBefore} onChange={(e) => { setPurgeBefore(e.target.value); setPurgeErr(''); }} style={inputStyle} />
            </Field>
          )}
          <Field label="دلیل پاک‌سازی *">
            <textarea rows={3} value={purgeReason} onChange={(e) => { setPurgeReason(e.target.value); setPurgeErr(''); }} style={inputStyle} />
          </Field>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: '#374151', marginTop: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={purgeTrace} onChange={(e) => setPurgeTrace(e.target.checked)} />
            یک ردیف خلاصه از این پاک‌سازی (تعداد، بازه‌ی زمانی و دلیل) در تاریخچه بماند
          </label>
          {purgeErr && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 10 }}>{purgeErr}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button onClick={() => setPurgeMode(null)} disabled={purgeBusy} style={{ ...btn('#e5e7eb', '#374151'), padding: '8px 18px', fontSize: 13 }}>انصراف</button>
            <button onClick={confirmPurge} disabled={purgeBusy} style={{ ...btn('#dc2626'), padding: '8px 18px', fontSize: 13, opacity: purgeBusy ? 0.6 : 1 }}>
              {purgeBusy ? 'در حال پاک‌سازی...' : 'پاک‌سازی قطعی'}
            </button>
          </div>
        </Modal>
      )}

      {/* بازگردانی */}
      {undoRow && (
        <Modal title="بازگردانی تغییر" onClose={() => !undoBusy && setUndoRow(null)} width={560}>
          <p style={{ fontSize: 13, color: '#6b7280' }}>
            {moduleLabels[undoRow.module] || undoRow.module} · {actionLabels[undoRow.action] || undoRow.action} · {fmtDate(undoRow.created_at)}
          </p>

          {undoLoading && <p style={{ fontSize: 14, color: '#6b7280', marginTop: 12 }}>در حال بررسی امکان بازگردانی...</p>}

          {!undoLoading && undoPlan && !undoPlan.ok && (
            <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 10, padding: 12, marginTop: 12, fontSize: 14, lineHeight: 1.9 }}>
              {undoPlan.message || 'این تغییر قابل بازگردانی نیست'}
            </div>
          )}

          {!undoLoading && undoPlan && undoPlan.ok && (
            <>
              <div style={{ background: '#f0fdf4', borderRadius: 10, padding: 12, marginTop: 12, fontSize: 14 }}>
                {undoPlan.kind === 'update' && 'این فیلدها به مقدار قبلی برمی‌گردند:'}
                {undoPlan.kind === 'restore' && 'رکورد از بایگانی بازیابی می‌شود.'}
                {undoPlan.kind === 'archive' && 'رکورد دوباره بایگانی می‌شود.'}
                {undoPlan.kind === 'delete' && 'رکورد ایجادشده حذف می‌شود.'}
                {undoPlan.kind === 'insert' && 'رکورد حذف‌شده دوباره ساخته می‌شود.'}
                {Array.isArray(undoPlan.fields) && undoPlan.fields.length > 0 && (
                  <ul style={{ margin: '8px 0 0', paddingRight: 18 }}>
                    {undoPlan.fields.map((f: any) => (
                      <li key={f.field}>
                        {f.field}: <span style={{ color: '#b91c1c' }}>{show(f.current)}</span> ← <span style={{ color: '#065f46' }}>{show(f.restore_to)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {undoPlan.warning && (
                <div style={{ background: '#fef3c7', color: '#92400e', borderRadius: 10, padding: 12, marginTop: 10, fontSize: 13, lineHeight: 1.9 }}>
                  هشدار: {undoPlan.warning}
                </div>
              )}
              <Field label="دلیل بازگردانی *">
                <textarea rows={3} value={undoReason} onChange={(e) => { setUndoReason(e.target.value); setUndoErr(''); }} style={inputStyle} />
              </Field>
            </>
          )}

          {undoErr && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 10 }}>{undoErr}</p>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button onClick={() => setUndoRow(null)} disabled={undoBusy} style={{ ...btn('#e5e7eb', '#374151'), padding: '8px 18px', fontSize: 13 }}>
              {undoPlan && undoPlan.ok ? 'انصراف' : 'بستن'}
            </button>
            {undoPlan && undoPlan.ok && (
              <button onClick={confirmUndo} disabled={undoBusy} style={{ ...btn('#7e22ce'), padding: '8px 18px', fontSize: 13, opacity: undoBusy ? 0.6 : 1 }}>
                {undoBusy ? 'در حال انجام...' : 'بازگردانی'}
              </button>
            )}
          </div>
        </Modal>
      )}
    </main>
  );
}
