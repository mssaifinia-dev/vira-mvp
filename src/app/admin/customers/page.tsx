'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { adminRpc } from '@/lib/adminRpc';
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

type Customer = {
  id: string;
  user_id: string | null;
  full_name: string | null;
  phone: string | null;
  city: string | null;
  total_orders: number | null;
  total_spent: number | null;
  last_order_at: string | null;
  source: string | null;
  created_at: string | null;
  is_active?: boolean | null;
  deleted_at?: string | null;
  delete_reason?: string | null;
  notes?: string | null;
};

type StatusFilter = 'live' | 'active' | 'archived' | 'all';

const PHONE_RE = /^09[0-9]{9}$/;
const orderStatus: Record<string, string> = { pending: 'در انتظار', confirmed: 'تأیید شده', delivered: 'تحویل شده', cancelled: 'لغو شده' };
const reqStatus: Record<string, string> = { pending: 'منتظر ارجاع', assigned: 'ارجاع‌شده', accepted: 'پذیرفته‌شده', in_progress: 'در حال انجام', completed: 'انجام‌شده', cancelled: 'لغوشده' };
const payLabel: Record<string, string> = { paid: 'پرداخت‌شده', unpaid: 'پرداخت‌نشده' };
const emptyForm = { full_name: '', phone: '', city: '', notes: '' };

export default function AdminCustomersPage() {
  const toast = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('total_spent');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('live');
  const [cityFilter, setCityFilter] = useState('all');

  const [formMode, setFormMode] = useState<null | 'add' | 'edit'>(null);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [archiveTarget, setArchiveTarget] = useState<Customer | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<Customer | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<Customer | null>(null);

  const [detail, setDetail] = useState<Customer | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [dOrders, setDOrders] = useState<any[]>([]);
  const [dRequests, setDRequests] = useState<any[]>([]);
  const [dInvoices, setDInvoices] = useState<any[]>([]);
  const [dAudit, setDAudit] = useState<AuditRow[]>([]);
  const [dAuditNote, setDAuditNote] = useState('');
  const [actors, setActors] = useState<Record<string, string>>({});

  const fetchCustomers = useCallback(async () => {
    const res = await supabase.from('customer_archive').select('*').order('total_spent', { ascending: false });
    if (res.error) toast.show('err', 'خواندن مشتریان ناموفق بود: ' + res.error.message);
    setCustomers((res.data as Customer[]) || []);
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
      fetchCustomers();
    })();
  }, [fetchCustomers]);

  const cities = useMemo(() => Array.from(new Set(customers.map((c) => c.city).filter(Boolean) as string[])).sort(), [customers]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = customers.filter((c) => {
      const archived = !!c.deleted_at;
      if (statusFilter === 'live' && archived) return false;
      if (statusFilter === 'active' && (archived || c.is_active === false)) return false;
      if (statusFilter === 'archived' && !archived) return false;
      if (cityFilter !== 'all' && c.city !== cityFilter) return false;
      if (!term) return true;
      return (c.full_name || '').toLowerCase().includes(term) || (c.phone || '').includes(term);
    });
    if (sortBy === 'orders') list = list.slice().sort((a, b) => (b.total_orders || 0) - (a.total_orders || 0));
    else if (sortBy === 'recent') list = list.slice().sort((a, b) => (b.last_order_at ? new Date(b.last_order_at).getTime() : 0) - (a.last_order_at ? new Date(a.last_order_at).getTime() : 0));
    else list = list.slice().sort((a, b) => (b.total_spent || 0) - (a.total_spent || 0));
    return list;
  }, [customers, search, statusFilter, cityFilter, sortBy]);

  // ---------- افزودن / ویرایش ----------
  function openAdd() { setForm(emptyForm); setEditing(null); setFormError(''); setFormMode('add'); }
  function openEdit(c: Customer) {
    setForm({ full_name: c.full_name || '', phone: c.phone || '', city: c.city || '', notes: c.notes || '' });
    setEditing(c); setFormError(''); setFormMode('edit');
  }

  async function submitForm() {
    if (!form.full_name.trim()) { setFormError('نام مشتری الزامی است'); return; }
    if (!PHONE_RE.test(form.phone.trim())) { setFormError('شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد'); return; }
    setSaving(true);
    setFormError('');

    const dup = await supabase.from('customer_archive').select('id').eq('phone', form.phone.trim()).limit(2);
    const dupOther = (dup.data || []).filter((r: any) => !editing || r.id !== editing.id);
    if (dupOther.length > 0) {
      setSaving(false);
      setFormError('مشتری دیگری با این شماره موبایل ثبت شده است');
      return;
    }

    const base = {
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      city: form.city.trim() || null,
      notes: form.notes.trim() || null,
    };

    if (formMode === 'add') {
      const res = await supabase.from('customer_archive').insert({ ...base, source: 'admin' }).select('id');
      setSaving(false);
      if (res.error) { setFormError(res.error.message); return; }
      toast.show('ok', 'مشتری جدید ثبت شد.');
    } else if (editing) {
      const res = await supabase.from('customer_archive').update({ ...base, updated_at: new Date().toISOString() }).eq('id', editing.id).select('id');
      setSaving(false);
      if (res.error) { setFormError(res.error.message); return; }
      if (!res.data || res.data.length === 0) { setFormError('ذخیره انجام نشد (دسترسی ویرایش وجود ندارد)'); return; }
      toast.show('ok', 'اطلاعات مشتری ذخیره شد.');
    }
    setFormMode(null);
    fetchCustomers();
  }

  // ---------- بایگانی / بازیابی / حذف قطعی ----------
  async function doArchive(c: Customer, reason: string) {
    const r = await adminRpc('admin_archive_customer', { p_id: c.id, p_reason: reason });
    if (!r.ok) { toast.show('err', r.error || 'ناموفق'); return; }
    toast.show('ok', 'مشتری بایگانی شد. سوابق سفارش و مالی او حفظ می‌شود.');
    fetchCustomers();
  }
  async function doRestore(c: Customer) {
    const r = await adminRpc('admin_restore_customer', { p_id: c.id });
    if (!r.ok) { toast.show('err', r.error || 'ناموفق'); return; }
    toast.show('ok', 'مشتری بازیابی شد.');
    fetchCustomers();
  }
  async function doPurge(c: Customer) {
    const r = await adminRpc('admin_purge_customer', { p_id: c.id });
    if (!r.ok) { toast.show('err', r.error || 'ناموفق'); return; }
    toast.show('ok', 'مشتری برای همیشه حذف شد.');
    fetchCustomers();
  }

  // ---------- جزئیات و سوابق ----------
  async function openDetail(c: Customer) {
    setDetail(c);
    setDetailBusy(true);
    setDOrders([]); setDRequests([]); setDInvoices([]); setDAudit([]); setDAuditNote('');

    const auditQ = supabase.from('audit_log').select('*').eq('table_name', 'customer_archive').eq('record_id', c.id).order('created_at', { ascending: false }).limit(40);
    const usersQ = Object.keys(actors).length ? Promise.resolve(null) : supabase.rpc('admin_list_users');

    if (c.user_id) {
      const [o, r, a, users] = await Promise.all([
        supabase.from('orders').select('id,total_price,status,payment_status,payment_method,created_at,quantity').eq('user_id', c.user_id).order('created_at', { ascending: false }).limit(50),
        supabase.from('service_requests').select('id,request_no,issue_type,status,created_at').eq('customer_id', c.user_id).order('created_at', { ascending: false }).limit(50),
        auditQ,
        usersQ,
      ]);
      const reqs = r.data || [];
      setDOrders(o.data || []);
      setDRequests(reqs);
      if (reqs.length) {
        const inv = await supabase.from('invoices').select('id,request_id,total_amount,payment_status,created_at').in('request_id', reqs.map((x: any) => x.id));
        setDInvoices(inv.data || []);
      }
      if (a.error) setDAuditNote('تاریخچه در دسترس نیست (فایل 02_stage1 اجرا شده است؟)'); else setDAudit((a.data as AuditRow[]) || []);
      if (users && users.data) {
        const m: Record<string, string> = {};
        (users.data as any[]).forEach((u) => (m[u.id] = u.full_name || u.phone || u.id.slice(0, 6)));
        setActors(m);
      }
    } else {
      const [a, users] = await Promise.all([auditQ, usersQ]);
      if (a.error) setDAuditNote('تاریخچه در دسترس نیست (فایل 02_stage1 اجرا شده است؟)'); else setDAudit((a.data as AuditRow[]) || []);
      if (users && users.data) {
        const m: Record<string, string> = {};
        (users.data as any[]).forEach((u) => (m[u.id] = u.full_name || u.phone || u.id.slice(0, 6)));
        setActors(m);
      }
    }
    setDetailBusy(false);
  }

  function exportToCsv() {
    const rows: (string | number | null)[][] = [['نام', 'موبایل', 'شهر', 'منبع', 'وضعیت', 'تعداد سفارش', 'جمع خرید', 'آخرین خرید']];
    filtered.forEach((c) => {
      rows.push([c.full_name, c.phone, c.city, c.source === 'admin' ? 'ثبت دستی' : 'فروشگاه', c.deleted_at ? 'بایگانی‌شده' : c.is_active === false ? 'غیرفعال' : 'فعال', c.total_orders || 0, c.total_spent || 0, c.last_order_at ? fmtDate(c.last_order_at) : '']);
    });
    downloadCsv('vira-customers.csv', rows);
    toast.show('ok', 'گزارش ' + filtered.length + ' مشتری دانلود شد.');
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

  return (
    <main style={{ minHeight: '100vh', background: '#f3f4f6', padding: '32px 16px' }} dir="rtl">
      {toast.node}
      <div style={{ maxWidth: 1050, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 'bold', color: '#1e3a8a' }}>بایگانی مشتریان</h1>
          <a href="/admin" style={{ color: '#1e3a8a', fontSize: 14, textDecoration: 'none' }}>← بازگشت به پنل اصلی</a>
        </div>

        <div style={{ background: 'white', borderRadius: 12, padding: 16, marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جستجو نام یا موبایل..." style={{ ...inputStyle, flex: 1, minWidth: 200, width: 'auto' }} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} style={{ ...inputStyle, width: 'auto' }}>
            <option value="live">همه (بدون بایگانی)</option>
            <option value="active">فعال</option>
            <option value="archived">بایگانی‌شده</option>
            <option value="all">همه (با بایگانی)</option>
          </select>
          <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
            <option value="all">همه شهرها</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
            <option value="total_spent">بیشترین خرید</option>
            <option value="orders">بیشترین تعداد سفارش</option>
            <option value="recent">آخرین خرید</option>
          </select>
          <button onClick={exportToCsv} style={{ ...btn('#16a34a'), padding: '9px 16px', fontSize: 13 }}>گزارش (CSV)</button>
          <button onClick={openAdd} style={{ ...btn('#1e3a8a'), padding: '9px 16px', fontSize: 13 }}>+ مشتری جدید</button>
        </div>

        <div style={{ background: 'white', borderRadius: 12, padding: 12, marginBottom: 16, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
          {filtered.length} مشتری یافت شد
        </div>

        <div style={{ background: 'white', borderRadius: 12, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', minWidth: 760 }}>
            <thead style={{ background: '#1e3a8a', color: 'white' }}>
              <tr>
                <th style={th}>نام</th>
                <th style={th}>موبایل</th>
                <th style={th}>وضعیت</th>
                <th style={th}>تعداد سفارش</th>
                <th style={th}>جمع خرید</th>
                <th style={th}>آخرین خرید</th>
                <th style={th}>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>مشتری‌ای یافت نشد</td></tr>
              ) : filtered.map((c) => {
                const archived = !!c.deleted_at;
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6', opacity: archived ? 0.7 : 1 }}>
                    <td style={{ ...td, fontWeight: 'bold' }}>{c.full_name || '—'}</td>
                    <td style={{ ...td, color: '#6b7280' }}>{c.phone || '—'}</td>
                    <td style={td}>
                      {archived ? <span style={badge('#e5e7eb', '#4b5563')}>بایگانی‌شده</span> : <span style={badge('#d1fae5', '#065f46')}>فعال</span>}
                      {c.source === 'admin' && <span style={badge('#e0e7ff', '#3730a3')}>ثبت دستی</span>}
                    </td>
                    <td style={td}>{(c.total_orders || 0).toLocaleString('fa-IR')}</td>
                    <td style={{ ...td, color: '#16a34a', fontWeight: 'bold' }}>{(c.total_spent || 0).toLocaleString('fa-IR')} تومان</td>
                    <td style={{ ...td, color: '#6b7280', fontSize: 13 }}>{c.last_order_at ? new Date(c.last_order_at).toLocaleDateString('fa-IR') : '—'}</td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button onClick={() => openDetail(c)} style={btn('#e0e7ff', '#1e3a8a')}>سوابق</button>
                        {!archived && <button onClick={() => openEdit(c)} style={btn('#dbeafe', '#1d4ed8')}>ویرایش</button>}
                        {!archived && <button onClick={() => setArchiveTarget(c)} style={btn('#fee2e2', '#dc2626')}>بایگانی</button>}
                        {archived && <button onClick={() => setRestoreTarget(c)} style={btn('#16a34a')}>بازیابی</button>}
                        {archived && !c.user_id && <button onClick={() => setPurgeTarget(c)} style={btn('#7f1d1d')}>حذف قطعی</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {formMode && (
        <Modal title={formMode === 'add' ? 'مشتری جدید' : 'ویرایش مشتری'} onClose={() => !saving && setFormMode(null)}>
          <Field label="نام و نام خانوادگی *"><input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} style={inputStyle} /></Field>
          <Field label="موبایل *"><input inputMode="numeric" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={inputStyle} placeholder="09123456789" /></Field>
          <Field label="شهر"><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} style={inputStyle} /></Field>
          <Field label="یادداشت مدیر"><textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={inputStyle} /></Field>
          {formMode === 'add' && <p style={{ fontSize: 12, color: '#6b7280', marginTop: 10 }}>مشتری دستی حساب کاربری ندارد؛ فقط در بایگانی ثبت می‌شود.</p>}
          {formError && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 10 }}>{formError}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button onClick={() => setFormMode(null)} disabled={saving} style={{ ...btn('#e5e7eb', '#374151'), padding: '8px 18px', fontSize: 13 }}>انصراف</button>
            <button onClick={submitForm} disabled={saving} style={{ ...btn('#1e3a8a'), padding: '8px 18px', fontSize: 13, opacity: saving ? 0.6 : 1 }}>{saving ? 'در حال ذخیره...' : 'ذخیره'}</button>
          </div>
        </Modal>
      )}

      {detail && (
        <Modal title={'سوابق: ' + (detail.full_name || detail.phone || 'مشتری')} onClose={() => setDetail(null)} width={720}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, fontSize: 14, color: '#374151' }}>
            <div>موبایل: {detail.phone || '—'}</div>
            <div>شهر: {detail.city || '—'}</div>
            <div>تعداد سفارش فروشگاه: {(detail.total_orders || 0).toLocaleString('fa-IR')}</div>
            <div>جمع خرید: {(detail.total_spent || 0).toLocaleString('fa-IR')} تومان</div>
            <div>حساب کاربری: {detail.user_id ? 'دارد' : 'ندارد (ثبت دستی)'}</div>
            <div>ثبت در بایگانی: {fmtDate(detail.created_at)}</div>
          </div>
          {detail.notes && <p style={{ fontSize: 14, marginTop: 8 }}>یادداشت: {detail.notes}</p>}
          {detail.deleted_at && <p style={{ fontSize: 14, color: '#b91c1c', marginTop: 8 }}>بایگانی‌شده در {fmtDate(detail.deleted_at)}{detail.delete_reason ? ' — دلیل: ' + detail.delete_reason : ''}</p>}

          {detailBusy ? <p style={{ fontSize: 13, color: '#6b7280', marginTop: 12 }}>در حال بارگذاری سوابق...</p> : (
            <>
              <h3 style={{ fontSize: 14, fontWeight: 'bold', margin: '14px 0 6px' }}>سفارش‌های فروشگاه ({dOrders.length})</h3>
              {dOrders.length === 0 ? <p style={{ fontSize: 13, color: '#9ca3af' }}>سفارشی یافت نشد.</p> : (
                <div style={{ maxHeight: 170, overflowY: 'auto', fontSize: 13 }}>
                  {dOrders.map((o) => (
                    <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', padding: '4px 0', gap: 8, flexWrap: 'wrap' }}>
                      <span>{fmtDate(o.created_at)} · تعداد {o.quantity}</span>
                      <span style={{ color: '#6b7280' }}>{Number(o.total_price).toLocaleString('fa-IR')} تومان · {orderStatus[o.status] || o.status} · {payLabel[o.payment_status] || o.payment_status}</span>
                    </div>
                  ))}
                </div>
              )}

              <h3 style={{ fontSize: 14, fontWeight: 'bold', margin: '14px 0 6px' }}>درخواست‌های خدمات ({dRequests.length})</h3>
              {dRequests.length === 0 ? <p style={{ fontSize: 13, color: '#9ca3af' }}>درخواستی یافت نشد.</p> : (
                <div style={{ maxHeight: 170, overflowY: 'auto', fontSize: 13 }}>
                  {dRequests.map((r) => {
                    const inv = dInvoices.find((i) => i.request_id === r.id);
                    return (
                      <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', padding: '4px 0', gap: 8, flexWrap: 'wrap' }}>
                        <span>{r.request_no ? '#' + Number(r.request_no).toLocaleString('fa-IR') + ' · ' : ''}{r.issue_type} · {fmtDate(r.created_at)}</span>
                        <span style={{ color: '#6b7280' }}>
                          {reqStatus[r.status] || r.status}
                          {inv ? ' · فاکتور ' + Number(inv.total_amount).toLocaleString('fa-IR') + ' تومان (' + (payLabel[inv.payment_status] || inv.payment_status) + ')' : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          <h3 style={{ fontSize: 14, fontWeight: 'bold', margin: '14px 0 6px' }}>تاریخچه تغییرات رکورد</h3>
          {dAuditNote ? <p style={{ fontSize: 13, color: '#9ca3af' }}>{dAuditNote}</p> : <AuditTimeline rows={dAudit} actors={actors} />}
        </Modal>
      )}

      {archiveTarget && (
        <ReasonModal
          title={'بایگانی «' + (archiveTarget.full_name || archiveTarget.phone || 'مشتری') + '»'}
          description="مشتری بایگانی می‌شود (حذف منطقی). سوابق سفارش، درخواست و پرداخت او حفظ می‌شود و هر زمان قابل بازیابی است. توجه: این کار ورود او به سایت را مسدود نمی‌کند."
          confirmLabel="بایگانی"
          danger
          onConfirm={(reason) => doArchive(archiveTarget, reason)}
          onClose={() => setArchiveTarget(null)}
        />
      )}
      {restoreTarget && (
        <ReasonModal
          title={'بازیابی «' + (restoreTarget.full_name || restoreTarget.phone || 'مشتری') + '»'}
          description="مشتری از بایگانی خارج و دوباره فعال می‌شود."
          confirmLabel="بازیابی"
          requireReason={false}
          onConfirm={() => doRestore(restoreTarget)}
          onClose={() => setRestoreTarget(null)}
        />
      )}
      {purgeTarget && (
        <ReasonModal
          title={'حذف قطعی «' + (purgeTarget.full_name || purgeTarget.phone || 'مشتری') + '»'}
          description="این عملیات غیرقابل برگشت است و فقط برای مشتری دستی بدون حساب کاربری مجاز است."
          confirmLabel="حذف قطعی"
          danger
          requireReason={false}
          onConfirm={() => doPurge(purgeTarget)}
          onClose={() => setPurgeTarget(null)}
        />
      )}
    </main>
  );
}
