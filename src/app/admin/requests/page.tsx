'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { adminRpc } from '@/lib/adminRpc';
import { loadCatalogMaps, type CatalogMaps } from '@/lib/serviceCatalog';
import RequestDetails from '@/components/RequestDetails';
import RequestForm from '@/components/RequestForm';
import { useMyPerms } from '@/lib/useMyPerms';
import {
  AuditTimeline,
  Field,
  Modal,
  ReasonModal,
  badge,
  btn,
  downloadCsv,
  fmtDate,
  inputStyle,
  useToast,
  type AuditRow,
} from '@/components/admin/ui';

const statusLabels: Record<string, string> = {
  pending: 'منتظر ارجاع',
  assigned: 'ارجاع‌شده',
  accepted: 'پذیرفته‌شده',
  in_progress: 'در حال انجام',
  completed: 'انجام‌شده',
  cancelled: 'لغوشده',
};
const statusColor: Record<string, [string, string]> = {
  pending: ['#fef3c7', '#d97706'],
  assigned: ['#e0e7ff', '#3730a3'],
  accepted: ['#dbeafe', '#1d4ed8'],
  in_progress: ['#cffafe', '#0e7490'],
  completed: ['#d1fae5', '#065f46'],
  cancelled: ['#fee2e2', '#dc2626'],
};
const OPEN = ['pending', 'assigned', 'accepted', 'in_progress'];
const eventLabels: Record<string, string> = {
  assigned: 'ارجاع به تکنسین',
  unassigned: 'پس‌گرفتن از تکنسین',
  cancelled: 'لغو درخواست',
  edited: 'ویرایش اطلاعات',
  status_changed: 'تغییر وضعیت',
  archived: 'بایگانی',
  restored: 'بازیابی از بایگانی',
};

type ArchiveFilter = 'live' | 'archived' | 'all';
type Tech = { id: string; full_name: string; phone: string };

export default function AdminRequestsPage() {
  const toast = useToast();
  const myPerms = useMyPerms();
  const isSuper = !!myPerms.perms?.super;
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'list' | 'new'>('list');
  const [requests, setRequests] = useState<any[]>([]);
  const [maps, setMaps] = useState<CatalogMaps | null>(null);
  const [techs, setTechs] = useState<Record<string, Tech>>({});
  const [actors, setActors] = useState<Record<string, string>>({});

  const [statusFilter, setStatusFilter] = useState('open');
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>('live');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [detail, setDetail] = useState<any | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [auditNote, setAuditNote] = useState('');

  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ description: '', address: '', phone: '', customer_name: '', street_text: '', priority: 'normal', ftth_number: '' });
  const [ftthCats, setFtthCats] = useState<string[]>([]);
  const [editReason, setEditReason] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState('');

  const [assignTarget, setAssignTarget] = useState<any | null>(null);
  const [assignOptions, setAssignOptions] = useState<any[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignPick, setAssignPick] = useState('');
  const [assignError, setAssignError] = useState('');
  const [assignBusy, setAssignBusy] = useState(false);

  const [statusTarget, setStatusTarget] = useState<any | null>(null);
  const [newStatus, setNewStatus] = useState('pending');
  const [statusReason, setStatusReason] = useState('');
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [cancelTarget, setCancelTarget] = useState<any | null>(null);
  const [unassignTarget, setUnassignTarget] = useState<any | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<any | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<any | null>(null);
  // حذف قطعی (فقط ادمین اصلی)
  const [selected, setSelected] = useState<string[]>([]);
  const [deleteTargets, setDeleteTargets] = useState<any[] | null>(null);
  const [deleteReport, setDeleteReport] = useState<{ ok: number; fail: number; items: { no: string; ok: boolean; message?: string }[] } | null>(null);

  const load = useCallback(async () => {
    const [r, t] = await Promise.all([
      supabase.from('service_requests').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('technicians').select('id,full_name,phone'),
    ]);
    if (r.error) toast.show('err', 'خواندن درخواست‌ها ناموفق بود: ' + r.error.message);
    setRequests(r.data || []);
    const m: Record<string, Tech> = {};
    (t.data || []).forEach((x: any) => (m[x.id] = x));
    setTechs(m);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      const userRes = await supabase.auth.getUser();
      const user = userRes.data.user;
      if (!user) { window.location.href = '/auth'; return; }
      const adminRes = await supabase.from('admins').select('id').eq('user_id', user.id).maybeSingle();
      if (!adminRes.data) { window.location.href = '/'; return; }
      setMaps(await loadCatalogMaps());
      const fc = await supabase.from('service_categories').select('id').eq('requires_ftth_number', true);
      if (fc.data) setFtthCats((fc.data as any[]).map((x) => x.id));
      load();
    })();
  }, [load]);

  async function ensureActors() {
    if (Object.keys(actors).length) return;
    const users = await supabase.rpc('admin_list_users');
    if (users.data) {
      const m: Record<string, string> = {};
      (users.data as any[]).forEach((u) => (m[u.id] = u.full_name || u.phone || u.id.slice(0, 6)));
      setActors(m);
    }
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const from = fromDate ? new Date(fromDate + 'T00:00:00').getTime() : 0;
    const to = toDate ? new Date(toDate + 'T23:59:59').getTime() : Infinity;
    return requests.filter((r) => {
      const archived = !!r.archived_at;
      if (archiveFilter === 'live' && archived) return false;
      if (archiveFilter === 'archived' && !archived) return false;
      if (statusFilter === 'open' && !OPEN.includes(r.status)) return false;
      if (statusFilter !== 'open' && statusFilter !== 'all' && r.status !== statusFilter) return false;
      const ts = new Date(r.created_at).getTime();
      if (ts < from || ts > to) return false;
      if (!term) return true;
      return (
        String(r.request_no || '').includes(term) ||
        (r.phone || '').includes(term) ||
        (r.ftth_number || '').includes(term) ||
        (r.address || '').toLowerCase().includes(term) ||
        (r.customer_name || '').toLowerCase().includes(term) ||
        (r.issue_type || '').toLowerCase().includes(term) ||
        (r.description || '').toLowerCase().includes(term)
      );
    });
  }, [requests, statusFilter, archiveFilter, search, fromDate, toDate]);

  const allSelected = filtered.length > 0 && filtered.every((r) => selected.includes(r.id));
  function toggleAll() {
    setSelected(allSelected ? selected.filter((id) => !filtered.some((r) => r.id === id)) : Array.from(new Set([...selected, ...filtered.map((r) => r.id)])));
  }
  function toggleOne(id: string) {
    setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  function statusBadge(r: any) {
    const [bg, fg] = statusColor[r.status] || ['#f3f4f6', '#6b7280'];
    return (
      <>
        <span style={badge(bg, fg)}>{statusLabels[r.status] || r.status}</span>
        {r.archived_at && <span style={badge('#e5e7eb', '#4b5563')}>بایگانی</span>}
        {r.priority === 'urgent' && <span style={badge('#fee2e2', '#dc2626')}>فوری</span>}
      </>
    );
  }

  const techName = (id: string | null) => (id ? techs[id]?.full_name || 'تکنسین' : '—');

  // ---------- جزئیات ----------
  async function openDetail(r: any) {
    setDetail(r);
    setEvents([]); setAudit([]); setAuditNote('');
    ensureActors();
    const [ev, au] = await Promise.all([
      supabase.from('service_request_events').select('*').eq('request_id', r.id).order('created_at', { ascending: false }),
      supabase.from('audit_log').select('*').eq('table_name', 'service_requests').eq('record_id', r.id).order('created_at', { ascending: false }).limit(40),
    ]);
    setEvents(ev.data || []);
    if (au.error) setAuditNote('ثبت تغییرات در دسترس نیست (فایل 02_stage1 اجرا شده است؟)');
    else setAudit((au.data as AuditRow[]) || []);
  }

  // ---------- ویرایش ----------
  function openEdit(r: any) {
    setEditForm({
      description: r.description || '',
      address: r.address || '',
      phone: r.phone || '',
      customer_name: r.customer_name || '',
      street_text: r.street_text || '',
      priority: r.priority || 'normal',
      ftth_number: r.ftth_number || '',
    });
    setEditReason('');
    setEditError('');
    setEditTarget(r);
  }
  async function submitEdit() {
    if (!editTarget) return;
    if (!editForm.address.trim()) { setEditError('آدرس نمی‌تواند خالی باشد'); return; }
    if (!editForm.phone.trim()) { setEditError('شماره تماس نمی‌تواند خالی باشد'); return; }
    if (!editReason.trim()) { setEditError('ثبت دلیل ویرایش الزامی است'); return; }
    const patch: Record<string, string> = {};
    (Object.keys(editForm) as (keyof typeof editForm)[]).forEach((k) => {
      const before = String(editTarget[k] ?? (k === 'priority' ? 'normal' : ''));
      if (editForm[k] !== before) patch[k] = editForm[k];
    });
    if (Object.keys(patch).length === 0) { setEditError('تغییری ایجاد نشده است'); return; }
    setEditBusy(true);
    const r = await adminRpc('admin_update_service_request', { p_id: editTarget.id, p_patch: patch, p_reason: editReason.trim() });
    setEditBusy(false);
    if (!r.ok) { setEditError(r.error || 'ناموفق'); return; }
    toast.show('ok', 'درخواست ویرایش شد و در تاریخچه ثبت گردید.');
    setEditTarget(null);
    load();
  }

  // ---------- ارجاع / انتقال ----------
  async function openAssign(r: any) {
    setAssignTarget(r);
    setAssignOptions([]);
    setAssignPick('');
    setAssignError('');
    setAssignLoading(true);
    const res = await supabase.rpc('eligible_technicians', { p_request: r.id });
    setAssignLoading(false);
    if (res.error) { setAssignError(res.error.message); return; }
    setAssignOptions(res.data || []);
  }
  async function submitAssign() {
    if (!assignTarget || !assignPick) { setAssignError('یک تکنسین انتخاب کنید'); return; }
    setAssignBusy(true);
    const r = await adminRpc('assign_service_request', { p_request: assignTarget.id, p_technician: assignPick });
    setAssignBusy(false);
    if (!r.ok) { setAssignError(r.error || 'ناموفق'); return; }
    toast.show('ok', assignTarget.technician_id ? 'درخواست به تکنسین جدید منتقل شد.' : 'درخواست ارجاع شد.');
    setAssignTarget(null);
    load();
  }
  async function doUnassign(r: any) {
    const res = await adminRpc('assign_service_request', { p_request: r.id, p_technician: null });
    if (!res.ok) { toast.show('err', res.error || 'ناموفق'); return; }
    toast.show('ok', 'درخواست از تکنسین پس گرفته شد و به حالت «منتظر ارجاع» برگشت.');
    load();
  }

  // ---------- وضعیت / لغو / بایگانی ----------
  function openStatus(r: any) {
    setNewStatus(r.status === 'pending' ? 'cancelled' : 'pending');
    setStatusReason('');
    setStatusError('');
    setStatusTarget(r);
  }
  async function submitStatus() {
    if (!statusTarget) return;
    if (!statusReason.trim()) { setStatusError('ثبت دلیل تغییر وضعیت الزامی است'); return; }
    setStatusBusy(true);
    const res = await adminRpc('admin_set_request_status', { p_id: statusTarget.id, p_status: newStatus, p_reason: statusReason.trim() });
    setStatusBusy(false);
    if (!res.ok) { setStatusError(res.error || 'ناموفق'); return; }
    toast.show('ok', 'وضعیت به «' + (statusLabels[newStatus] || newStatus) + '» تغییر کرد.');
    setStatusTarget(null);
    load();
  }
  async function doCancel(r: any, reason: string) {
    const res = await adminRpc('cancel_service_request', { p_request: r.id, p_note: reason });
    if (!res.ok) { toast.show('err', res.error || 'ناموفق'); return; }
    toast.show('ok', 'درخواست لغو شد.');
    load();
  }
  async function doArchive(r: any, reason: string) {
    const res = await adminRpc('admin_archive_request', { p_id: r.id, p_reason: reason });
    if (!res.ok) { toast.show('err', res.error || 'ناموفق'); return; }
    toast.show('ok', 'درخواست بایگانی شد.');
    load();
  }
  async function doRestore(r: any) {
    const res = await adminRpc('admin_restore_request', { p_id: r.id });
    if (!res.ok) { toast.show('err', res.error || 'ناموفق'); return; }
    toast.show('ok', 'درخواست از بایگانی بازیابی شد.');
    load();
  }

  async function doDelete(targets: any[], reason: string) {
    const ids = targets.map((t) => t.id);
    const res = await supabase.rpc('admin_delete_requests', { p_ids: ids, p_reason: reason });
    if (res.error) {
      setDeleteReport({ ok: 0, fail: ids.length, items: [{ no: 'همه', ok: false, message: res.error.message }] });
      return;
    }
    const d: any = res.data || {};
    const items = ((d.results as any[]) || []).map((x) => ({
      no: x.request_no ? '#' + Number(x.request_no).toLocaleString('fa-IR') : String(x.id).slice(0, 6),
      ok: !!x.ok,
      message: x.message as string | undefined,
    }));
    setSelected([]);
    setDeleteReport({ ok: Number(d.ok_count || 0), fail: Number(d.fail_count || 0), items });
    load();
  }

  function exportCsv() {
    const rows: (string | number | null)[][] = [['شماره', 'نوع', 'مشتری', 'موبایل', 'آدرس', 'وضعیت', 'تکنسین', 'مرکز', 'ثبت', 'بایگانی']];
    filtered.forEach((r) => {
      rows.push([
        r.request_no || '',
        r.issue_type,
        r.customer_name || '',
        r.phone,
        r.address,
        statusLabels[r.status] || r.status,
        r.technician_id ? techName(r.technician_id) : '',
        r.center_id && maps ? maps.centers[r.center_id] || '' : '',
        fmtDate(r.created_at),
        r.archived_at ? 'بله' : 'خیر',
      ]);
    });
    downloadCsv('vira-requests.csv', rows);
    toast.show('ok', 'گزارش ' + filtered.length + ' درخواست دانلود شد.');
  }

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#1e3a8a' }}>در حال بارگذاری...</p>
      </main>
    );
  }

  const th = { padding: '12px' } as const;
  const td = { padding: '12px' } as const;
  const counts = {
    open: requests.filter((r) => !r.archived_at && OPEN.includes(r.status)).length,
    pending: requests.filter((r) => !r.archived_at && r.status === 'pending').length,
  };

  return (
    <main style={{ minHeight: '100vh', background: '#f3f4f6', padding: '32px 16px' }} dir="rtl">
      {toast.node}
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 'bold', color: '#1e3a8a' }}>مدیریت درخواست‌های تکنسین</h1>
          <a href="/admin" style={{ color: '#1e3a8a', fontSize: 14, textDecoration: 'none' }}>← بازگشت به پنل اصلی</a>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {([['list', 'فهرست درخواست‌ها'], ['new', '+ ثبت درخواست جدید']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 'bold', background: tab === k ? '#1e3a8a' : 'white', color: tab === k ? 'white' : '#1e3a8a' }}>{l}</button>
          ))}
          <span style={{ alignSelf: 'center', fontSize: 13, color: '#6b7280' }}>
            {counts.open.toLocaleString('fa-IR')} باز · {counts.pending.toLocaleString('fa-IR')} منتظر ارجاع
          </span>
        </div>

        {tab === 'new' && (
          <div style={{ background: 'white', borderRadius: 12, padding: 20, maxWidth: 640 }}>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>درخواست از طرف مشتری، توسط مدیر ثبت می‌شود (منبع: پشتیبانی).</p>
            <RequestForm mode="support" allowedCenterIds={null} onCreated={() => { load(); toast.show('ok', 'درخواست جدید ثبت شد.'); }} />
          </div>
        )}

        {tab === 'list' && (
          <>
            <div style={{ background: 'white', borderRadius: 12, padding: 16, marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جستجو شماره، موبایل، آدرس، نام..." style={{ ...inputStyle, flex: 1, minWidth: 200, width: 'auto' }} />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
                <option value="open">در جریان</option>
                <option value="all">همه وضعیت‌ها</option>
                {Object.keys(statusLabels).map((k) => <option key={k} value={k}>{statusLabels[k]}</option>)}
              </select>
              <select value={archiveFilter} onChange={(e) => setArchiveFilter(e.target.value as ArchiveFilter)} style={{ ...inputStyle, width: 'auto' }}>
                <option value="live">بدون بایگانی</option>
                <option value="archived">بایگانی‌شده</option>
                <option value="all">همه</option>
              </select>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={{ ...inputStyle, width: 'auto' }} aria-label="از تاریخ" />
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={{ ...inputStyle, width: 'auto' }} aria-label="تا تاریخ" />
              <button onClick={exportCsv} style={{ ...btn('#16a34a'), padding: '9px 16px', fontSize: 13 }}>گزارش (CSV)</button>
            </div>

            <div style={{ background: 'white', borderRadius: 12, padding: 12, marginBottom: 16, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
              {filtered.length.toLocaleString('fa-IR')} درخواست یافت شد{requests.length >= 500 ? ' (۵۰۰ مورد آخر)' : ''}
            </div>

            {isSuper && selected.length > 0 && (
              <div style={{ background: '#fee2e2', borderRadius: 12, padding: 12, marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 14, color: '#991b1b', fontWeight: 'bold' }}>{selected.length.toLocaleString('fa-IR')} درخواست انتخاب شده</span>
                <button onClick={() => setDeleteTargets(requests.filter((r) => selected.includes(r.id)))} style={btn('#dc2626')}>حذف انتخاب‌شده‌ها</button>
                <button onClick={() => setSelected([])} style={btn('#e5e7eb', '#374151')}>لغو انتخاب</button>
              </div>
            )}

            <div style={{ background: 'white', borderRadius: 12, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', minWidth: 980 }}>
                <thead style={{ background: '#1e3a8a', color: 'white' }}>
                  <tr>
                    {isSuper && <th style={th}><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="انتخاب همه" /></th>}
                    <th style={th}>شماره</th>
                    <th style={th}>نوع / مرکز</th>
                    <th style={th}>مشتری</th>
                    <th style={th}>وضعیت</th>
                    <th style={th}>تکنسین</th>
                    <th style={th}>ثبت</th>
                    <th style={th}>عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={isSuper ? 8 : 7} style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>درخواستی یافت نشد</td></tr>
                  ) : filtered.map((r) => {
                    const archived = !!r.archived_at;
                    const closed = r.status === 'completed' || r.status === 'cancelled';
                    return (
                      <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6', opacity: archived ? 0.7 : 1 }}>
                        {isSuper && <td style={td}><input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggleOne(r.id)} aria-label="انتخاب" /></td>}
                        <td style={{ ...td, fontWeight: 'bold' }}>{r.request_no ? '#' + Number(r.request_no).toLocaleString('fa-IR') : '—'}</td>
                        <td style={td}>
                          <div style={{ fontWeight: 'bold' }}>{r.category_id && maps ? maps.categories[r.category_id] || r.issue_type : r.issue_type}</div>
                          {r.center_id && maps && <div style={{ fontSize: 12, color: '#6b7280' }}>{maps.centers[r.center_id]}</div>}
                        </td>
                        <td style={td}>
                          <div>{r.customer_name || '—'}</div>
                          <div style={{ fontSize: 12, color: '#6b7280' }}>{r.phone}</div>
                        </td>
                        <td style={td}>{statusBadge(r)}</td>
                        <td style={{ ...td, color: '#374151' }}>{techName(r.technician_id)}</td>
                        <td style={{ ...td, fontSize: 12, color: '#6b7280' }}>{fmtDate(r.created_at)}</td>
                        <td style={td}>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button onClick={() => openDetail(r)} style={btn('#e0e7ff', '#1e3a8a')}>جزئیات</button>
                            {!archived && <button onClick={() => openEdit(r)} style={btn('#dbeafe', '#1d4ed8')}>ویرایش</button>}
                            {!archived && ['pending', 'assigned', 'accepted'].includes(r.status) && (
                              <button onClick={() => openAssign(r)} style={btn('#16a34a')}>{r.technician_id ? 'انتقال' : 'ارجاع'}</button>
                            )}
                            {!archived && r.technician_id && ['assigned', 'accepted'].includes(r.status) && (
                              <button onClick={() => setUnassignTarget(r)} style={btn('#fef3c7', '#d97706')}>پس‌گرفتن</button>
                            )}
                            {!archived && <button onClick={() => openStatus(r)} style={btn('#f3e8ff', '#7e22ce')}>وضعیت</button>}
                            {!archived && !closed && <button onClick={() => setCancelTarget(r)} style={btn('#fee2e2', '#dc2626')}>لغو</button>}
                            {!archived && closed && <button onClick={() => setArchiveTarget(r)} style={btn('#e5e7eb', '#374151')}>بایگانی</button>}
                            {archived && <button onClick={() => setRestoreTarget(r)} style={btn('#16a34a')}>بازیابی</button>}
                            {isSuper && <button onClick={() => setDeleteTargets([r])} style={btn('#7f1d1d')}>حذف</button>}
                            {r.status === 'completed' && <a href={'/technician/invoice/' + r.id} style={{ ...btn('#1e3a8a'), textDecoration: 'none', display: 'inline-block' }}>فاکتور</a>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* جزئیات */}
      {detail && (
        <Modal title={'درخواست ' + (detail.request_no ? '#' + Number(detail.request_no).toLocaleString('fa-IR') : '')} onClose={() => setDetail(null)} width={720}>
          <div style={{ marginBottom: 8 }}>{statusBadge(detail)}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 8, fontSize: 14, color: '#374151' }}>
            <div>نوع: {detail.issue_type}</div>
            <div>موبایل: {detail.phone}</div>
            <div>تکنسین: {techName(detail.technician_id)}</div>
            <div>منبع: {detail.source === 'support' ? 'پشتیبانی/مدیر' : 'مشتری'}</div>
            <div>ثبت: {fmtDate(detail.created_at)}</div>
            <div>ارجاع: {fmtDate(detail.assigned_at)}</div>
            <div>پذیرش: {fmtDate(detail.accepted_at)}</div>
            <div>تکمیل: {fmtDate(detail.completed_at)}</div>
          </div>
          <p style={{ fontSize: 14, marginTop: 8 }}>آدرس: {detail.address}</p>
          {detail.description && <p style={{ fontSize: 14, marginTop: 4 }}>شرح: {detail.description}</p>}
          <RequestDetails r={detail} maps={maps} />
          {detail.cancel_reason && <p style={{ fontSize: 14, color: '#b91c1c', marginTop: 8 }}>دلیل لغو: {detail.cancel_reason}</p>}
          {detail.archived_at && <p style={{ fontSize: 14, color: '#4b5563', marginTop: 8 }}>بایگانی‌شده در {fmtDate(detail.archived_at)}{detail.archive_reason ? ' — ' + detail.archive_reason : ''}</p>}

          <h3 style={{ fontSize: 14, fontWeight: 'bold', margin: '16px 0 6px' }}>مراحل درخواست</h3>
          {events.length === 0 ? <p style={{ fontSize: 13, color: '#9ca3af' }}>رویدادی ثبت نشده است.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {events.map((e) => (
                <div key={e.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 10px', fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <b style={{ color: '#1e3a8a' }}>{eventLabels[e.event_type] || e.event_type}</b>
                    <span style={{ color: '#6b7280' }}>{fmtDate(e.created_at)}</span>
                  </div>
                  <div style={{ color: '#6b7280' }}>توسط: {e.actor_id ? actors[e.actor_id] || 'مدیر (' + String(e.actor_id).slice(0, 6) + ')' : 'سیستم'}</div>
                  {e.note && <div style={{ marginTop: 2 }}>{e.note}</div>}
                </div>
              ))}
            </div>
          )}

          <h3 style={{ fontSize: 14, fontWeight: 'bold', margin: '16px 0 6px' }}>ثبت تغییرات (مقدار قبل و بعد)</h3>
          {auditNote ? <p style={{ fontSize: 13, color: '#9ca3af' }}>{auditNote}</p> : <AuditTimeline rows={audit} actors={actors} />}
        </Modal>
      )}

      {/* ویرایش */}
      {editTarget && (
        <Modal title="ویرایش درخواست" onClose={() => !editBusy && setEditTarget(null)}>
          <Field label="نام مشتری"><input value={editForm.customer_name} onChange={(e) => setEditForm({ ...editForm, customer_name: e.target.value })} style={inputStyle} /></Field>
          <Field label="شماره تماس *"><input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} style={inputStyle} /></Field>
          <Field label="آدرس *"><textarea rows={2} value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} style={inputStyle} /></Field>
          <Field label="خیابان / نشانی تکمیلی"><input value={editForm.street_text} onChange={(e) => setEditForm({ ...editForm, street_text: e.target.value })} style={inputStyle} /></Field>
          {editTarget.category_id && ftthCats.includes(editTarget.category_id) && (
            <Field label="شماره مجازی FTTH"><input dir="ltr" inputMode="numeric" value={editForm.ftth_number} onChange={(e) => setEditForm({ ...editForm, ftth_number: e.target.value.replace(/[^0-9۰-۹]/g, '') })} style={inputStyle} placeholder="02199162496" /></Field>
          )}
          <Field label="شرح مشکل"><textarea rows={3} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} style={inputStyle} /></Field>
          <Field label="اولویت">
            <select value={editForm.priority} onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })} style={inputStyle}>
              <option value="normal">عادی</option>
              <option value="urgent">فوری</option>
            </select>
          </Field>
          <Field label="دلیل ویرایش *"><textarea rows={2} value={editReason} onChange={(e) => { setEditReason(e.target.value); setEditError(''); }} style={inputStyle} /></Field>
          {editError && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 10 }}>{editError}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button onClick={() => setEditTarget(null)} disabled={editBusy} style={{ ...btn('#e5e7eb', '#374151'), padding: '8px 18px', fontSize: 13 }}>انصراف</button>
            <button onClick={submitEdit} disabled={editBusy} style={{ ...btn('#1e3a8a'), padding: '8px 18px', fontSize: 13, opacity: editBusy ? 0.6 : 1 }}>{editBusy ? 'در حال ذخیره...' : 'ذخیره'}</button>
          </div>
        </Modal>
      )}

      {/* ارجاع / انتقال */}
      {assignTarget && (
        <Modal title={assignTarget.technician_id ? 'انتقال به تکنسین دیگر' : 'ارجاع به تکنسین'} onClose={() => !assignBusy && setAssignTarget(null)} width={480}>
          {assignTarget.technician_id && <p style={{ fontSize: 13, color: '#6b7280' }}>تکنسین فعلی: {techName(assignTarget.technician_id)}</p>}
          {assignLoading ? <p style={{ fontSize: 13, color: '#6b7280' }}>در حال بارگذاری تکنسین‌های مجاز...</p> : assignOptions.length === 0 ? (
            <p style={{ fontSize: 13, color: '#b45309', lineHeight: 1.9, marginTop: 8 }}>
              هیچ تکنسین تأییدشده‌ای با مرکز، خیابان و نوع خدمت این درخواست پیدا نشد. محدوده‌ی تکنسین‌ها را در «خدمات و مراکز مخابراتی» تعریف کنید.
            </p>
          ) : (
            <>
              <label style={{ display: 'block', fontSize: 13, marginTop: 8, marginBottom: 4 }}>تکنسین *</label>
              <select value={assignPick} onChange={(e) => { setAssignPick(e.target.value); setAssignError(''); }} style={inputStyle}>
                <option value="">انتخاب کنید...</option>
                {assignOptions.filter((o) => o.id !== assignTarget.technician_id).map((o) => (
                  <option key={o.id} value={o.id}>{o.full_name} — {o.city}</option>
                ))}
              </select>
            </>
          )}
          {assignError && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 10 }}>{assignError}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button onClick={() => setAssignTarget(null)} disabled={assignBusy} style={{ ...btn('#e5e7eb', '#374151'), padding: '8px 18px', fontSize: 13 }}>انصراف</button>
            <button onClick={submitAssign} disabled={assignBusy || assignLoading || assignOptions.length === 0} style={{ ...btn('#16a34a'), padding: '8px 18px', fontSize: 13, opacity: assignBusy ? 0.6 : 1 }}>{assignBusy ? 'در حال انجام...' : 'تأیید'}</button>
          </div>
        </Modal>
      )}

      {/* تغییر وضعیت */}
      {statusTarget && (
        <Modal title="تغییر وضعیت درخواست" onClose={() => !statusBusy && setStatusTarget(null)} width={460}>
          <p style={{ fontSize: 13, color: '#6b7280' }}>وضعیت فعلی: {statusLabels[statusTarget.status] || statusTarget.status}</p>
          <Field label="وضعیت جدید *">
            <select value={newStatus} onChange={(e) => { setNewStatus(e.target.value); setStatusError(''); }} style={inputStyle}>
              {['pending', 'accepted', 'in_progress', 'completed', 'cancelled'].filter((x) => x !== statusTarget.status).map((x) => (
                <option key={x} value={x}>{statusLabels[x]}</option>
              ))}
            </select>
          </Field>
          <p style={{ fontSize: 12, color: '#6b7280', marginTop: 6, lineHeight: 1.8 }}>
            «منتظر ارجاع» تکنسین فعلی را هم پس می‌گیرد. برای ارجاع از دکمه‌ی «ارجاع/انتقال» استفاده کنید. وضعیت‌های پذیرفته/در حال انجام/انجام‌شده فقط برای درخواست دارای تکنسین ممکن است.
          </p>
          <Field label="دلیل تغییر *"><textarea rows={3} value={statusReason} onChange={(e) => { setStatusReason(e.target.value); setStatusError(''); }} style={inputStyle} /></Field>
          {statusError && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 10 }}>{statusError}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button onClick={() => setStatusTarget(null)} disabled={statusBusy} style={{ ...btn('#e5e7eb', '#374151'), padding: '8px 18px', fontSize: 13 }}>انصراف</button>
            <button onClick={submitStatus} disabled={statusBusy} style={{ ...btn('#7e22ce'), padding: '8px 18px', fontSize: 13, opacity: statusBusy ? 0.6 : 1 }}>{statusBusy ? 'در حال انجام...' : 'تغییر وضعیت'}</button>
          </div>
        </Modal>
      )}

      {cancelTarget && (
        <ReasonModal
          title="لغو درخواست"
          description="درخواست لغو می‌شود و دلیل آن در تاریخچه ثبت می‌گردد."
          confirmLabel="لغو درخواست"
          danger
          onConfirm={(reason) => doCancel(cancelTarget, reason)}
          onClose={() => setCancelTarget(null)}
        />
      )}
      {unassignTarget && (
        <ReasonModal
          title="پس‌گرفتن درخواست از تکنسین"
          description={'درخواست از «' + techName(unassignTarget.technician_id) + '» پس گرفته می‌شود و به حالت «منتظر ارجاع» برمی‌گردد.'}
          confirmLabel="پس‌گرفتن"
          requireReason={false}
          onConfirm={() => doUnassign(unassignTarget)}
          onClose={() => setUnassignTarget(null)}
        />
      )}
      {archiveTarget && (
        <ReasonModal
          title="بایگانی درخواست"
          description="درخواست از فهرست اصلی خارج می‌شود ولی همه‌ی سوابق و فاکتورها حفظ می‌شوند و هر زمان قابل بازیابی است."
          confirmLabel="بایگانی"
          onConfirm={(reason) => doArchive(archiveTarget, reason)}
          onClose={() => setArchiveTarget(null)}
        />
      )}
      {restoreTarget && (
        <ReasonModal
          title="بازیابی درخواست"
          description="درخواست به فهرست اصلی برمی‌گردد."
          confirmLabel="بازیابی"
          requireReason={false}
          onConfirm={() => doRestore(restoreTarget)}
          onClose={() => setRestoreTarget(null)}
        />
      )}
      {deleteTargets && (
        <ReasonModal
          title={deleteTargets.length > 1 ? 'حذف قطعی ' + deleteTargets.length.toLocaleString('fa-IR') + ' درخواست' : 'حذف قطعی درخواست'}
          description="این کار برگشت‌پذیر نیست. قبل از حذف، یک نسخه‌ی کامل از درخواست، مراحل آن و (در صورت وجود) فاکتورش در تاریخچه‌ی غیرقابل‌تغییر ثبت می‌شود. درخواست‌هایی که فاکتورِ پرداخت‌شده دارند حذف نمی‌شوند."
          confirmLabel="حذف قطعی"
          danger
          onConfirm={(reason) => doDelete(deleteTargets, reason)}
          onClose={() => setDeleteTargets(null)}
        />
      )}
      {deleteReport && (
        <Modal title="نتیجه‌ی حذف" onClose={() => setDeleteReport(null)} width={520}>
          <p style={{ fontSize: 14, marginBottom: 8 }}>
            <b style={{ color: '#065f46' }}>{deleteReport.ok.toLocaleString('fa-IR')} حذف شد</b>
            {deleteReport.fail > 0 && <b style={{ color: '#b91c1c' }}> · {deleteReport.fail.toLocaleString('fa-IR')} انجام نشد</b>}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
            {deleteReport.items.map((it, i) => (
              <div key={i} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 10px', fontSize: 13, background: it.ok ? '#f0fdf4' : '#fef2f2' }}>
                <b>{it.no}</b> — {it.ok ? 'حذف شد' : it.message || 'ناموفق'}
              </div>
            ))}
          </div>
        </Modal>
      )}
    </main>
  );
}
