'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { sendSms } from '@/lib/sms';
import { adminFetch, adminRpc } from '@/lib/adminRpc';
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

type Seller = {
  id: string;
  user_id: string | null;
  shop_name: string;
  phone: string | null;
  city: string | null;
  description: string | null;
  is_approved: boolean | null;
  is_active: boolean | null;
  created_at: string;
  national_id: string | null;
  shop_address: string | null;
  shop_mobile: string | null;
  deleted_at: string | null;
  delete_reason: string | null;
  doc_national_id_url: string | null;
  doc_license_url: string | null;
  doc_extra_url: string | null;
  doc_commitment_url: string | null;
  commitment_signed_name: string | null;
};
type ProductRow = { id: string; name: string; price: number | null; stock: number | null; seller_id: string | null; category: string | null };
type OrderRow = { id: string; seller_id: string | null; total_price: number; status: string | null; created_at: string; full_name: string; quantity: number };

type StatusFilter = 'live' | 'active' | 'inactive' | 'pending' | 'archived' | 'all';

const PHONE_RE = /^09[0-9]{9}$/;
const orderStatus: Record<string, string> = { pending: 'در انتظار', confirmed: 'تأیید شده', delivered: 'تحویل شده', cancelled: 'لغو شده' };

function sellerState(s: Seller): 'archived' | 'pending' | 'inactive' | 'active' {
  if (s.deleted_at) return 'archived';
  if (!s.is_approved) return 'pending';
  if (s.is_active === false) return 'inactive';
  return 'active';
}

const emptyForm = { shop_name: '', phone: '', city: '', description: '', shop_address: '', shop_mobile: '', national_id: '', password: '' };

export default function AdminSellersPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [actors, setActors] = useState<Record<string, string>>({});

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('live');
  const [cityFilter, setCityFilter] = useState('all');

  const [formMode, setFormMode] = useState<null | 'add' | 'edit'>(null);
  const [editing, setEditing] = useState<Seller | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [detail, setDetail] = useState<Seller | null>(null);
  const [detailAudit, setDetailAudit] = useState<AuditRow[]>([]);
  const [detailAuditNote, setDetailAuditNote] = useState('');

  const [archiveTarget, setArchiveTarget] = useState<Seller | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<Seller | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<Seller | null>(null);

  const load = useCallback(async () => {
    const [s, p, o] = await Promise.all([
      supabase.from('sellers').select('*').order('created_at', { ascending: false }),
      supabase.from('products').select('id,name,price,stock,seller_id,category'),
      supabase.from('orders').select('id,seller_id,total_price,status,created_at,full_name,quantity').not('seller_id', 'is', null),
    ]);
    if (s.error) toast.show('err', 'خواندن فروشندگان ناموفق بود: ' + s.error.message);
    setSellers((s.data as Seller[]) || []);
    setProducts((p.data as ProductRow[]) || []);
    setOrders((o.data as OrderRow[]) || []);
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
      load();
    })();
  }, [load]);

  const stats = useMemo(() => {
    const map: Record<string, { products: number; orders: number; sales: number; lastOrder: string | null }> = {};
    const get = (id: string) => (map[id] = map[id] || { products: 0, orders: 0, sales: 0, lastOrder: null });
    products.forEach((p) => { if (p.seller_id) get(p.seller_id).products++; });
    orders.forEach((o) => {
      if (!o.seller_id) return;
      const m = get(o.seller_id);
      m.orders++;
      if (o.status !== 'cancelled') m.sales += Number(o.total_price) || 0;
      if (!m.lastOrder || o.created_at > m.lastOrder) m.lastOrder = o.created_at;
    });
    return map;
  }, [products, orders]);

  const cities = useMemo(() => Array.from(new Set(sellers.map((s) => s.city).filter(Boolean) as string[])).sort(), [sellers]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sellers.filter((s) => {
      const st = sellerState(s);
      if (statusFilter === 'live' && st === 'archived') return false;
      if (statusFilter !== 'live' && statusFilter !== 'all' && st !== statusFilter) return false;
      if (cityFilter !== 'all' && s.city !== cityFilter) return false;
      if (!term) return true;
      return (
        (s.shop_name || '').toLowerCase().includes(term) ||
        (s.phone || '').includes(term) ||
        (s.shop_mobile || '').includes(term) ||
        (s.city || '').toLowerCase().includes(term) ||
        (s.national_id || '').includes(term)
      );
    });
  }, [sellers, search, statusFilter, cityFilter]);

  function stateBadge(s: Seller) {
    const st = sellerState(s);
    if (st === 'archived') return <span style={badge('#e5e7eb', '#4b5563')}>بایگانی‌شده</span>;
    if (st === 'pending') return <span style={badge('#fef3c7', '#d97706')}>در انتظار تأیید</span>;
    if (st === 'inactive') return <span style={badge('#fee2e2', '#dc2626')}>غیرفعال</span>;
    return <span style={badge('#d1fae5', '#065f46')}>فعال</span>;
  }

  // ---------- فرم افزودن / ویرایش ----------
  function openAdd() {
    setForm(emptyForm);
    setEditing(null);
    setFormError('');
    setFormMode('add');
  }
  function openEdit(s: Seller) {
    setForm({
      shop_name: s.shop_name || '',
      phone: s.phone || '',
      city: s.city || '',
      description: s.description || '',
      shop_address: s.shop_address || '',
      shop_mobile: s.shop_mobile || '',
      national_id: s.national_id || '',
      password: '',
    });
    setEditing(s);
    setFormError('');
    setFormMode('edit');
  }

  function validate(): string {
    if (!form.shop_name.trim()) return 'نام فروشگاه الزامی است';
    if (!PHONE_RE.test(form.phone.trim())) return 'شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد';
    if (form.shop_mobile.trim() && !PHONE_RE.test(form.shop_mobile.trim())) return 'موبایل فروشگاه نامعتبر است';
    if (form.national_id.trim() && !/^[0-9]{10}$/.test(form.national_id.trim())) return 'کد ملی باید ۱۰ رقم باشد';
    if (formMode === 'add' && form.password.length > 0 && form.password.length < 6) return 'رمز عبور حداقل ۶ کاراکتر باشد';
    return '';
  }

  async function submitForm() {
    const v = validate();
    if (v) { setFormError(v); return; }
    setSaving(true);
    setFormError('');

    if (formMode === 'add') {
      const res = await adminFetch('/api/admin/sellers', {
        phone: form.phone.trim(),
        password: form.password,
        shop_name: form.shop_name.trim(),
        city: form.city.trim(),
        description: form.description.trim(),
        shop_address: form.shop_address.trim(),
        shop_mobile: form.shop_mobile.trim(),
        national_id: form.national_id.trim(),
      });
      setSaving(false);
      if (!res.ok) { setFormError(res.error || 'ثبت ناموفق بود'); return; }
      toast.show('ok', res.data?.linkedExistingAccount
        ? 'فروشنده ثبت شد و به حساب کاربری موجود همین شماره متصل شد.'
        : 'فروشنده با موفقیت ثبت شد. رمز اولیه را به او اطلاع دهید.');
    } else if (editing) {
      const patch = {
        shop_name: form.shop_name.trim(),
        phone: form.phone.trim(),
        city: form.city.trim() || null,
        description: form.description.trim() || null,
        shop_address: form.shop_address.trim() || null,
        shop_mobile: form.shop_mobile.trim() || null,
        national_id: form.national_id.trim() || null,
      };
      const res = await supabase.from('sellers').update(patch).eq('id', editing.id).select('id');
      setSaving(false);
      if (res.error) { setFormError(res.error.message); return; }
      if (!res.data || res.data.length === 0) {
        setFormError('ذخیره انجام نشد: دسترسی ویرایش وجود ندارد (فایل 01_hotfix اجرا شده است؟)');
        return;
      }
      toast.show('ok', 'اطلاعات فروشنده ذخیره شد.');
    }
    setFormMode(null);
    load();
  }

  // ---------- عملیات ----------
  async function approve(s: Seller) {
    const res = await supabase.from('sellers').update({ is_approved: true }).eq('id', s.id).select('id');
    if (res.error) { toast.show('err', res.error.message); return; }
    if (!res.data || res.data.length === 0) { toast.show('err', 'تأیید انجام نشد: دسترسی وجود ندارد (فایل 01_hotfix اجرا شده است؟)'); return; }
    if (s.phone) sendSms(s.phone, 'ویرا: حساب فروشندگی شما تایید شد. اکنون می‌توانید محصولات خود را ثبت کنید.');
    toast.show('ok', 'فروشنده تأیید شد.');
    load();
  }

  async function toggleActive(s: Seller) {
    const next = s.is_active === false;
    const r = await adminRpc('admin_set_seller_active', { p_id: s.id, p_active: next });
    if (!r.ok) { toast.show('err', r.error || 'ناموفق'); return; }
    toast.show('ok', next ? 'فروشنده فعال شد.' : 'فروشنده غیرفعال شد.');
    load();
  }

  async function doArchive(s: Seller, reason: string) {
    const r = await adminRpc('admin_archive_seller', { p_id: s.id, p_reason: reason });
    if (!r.ok) { toast.show('err', r.error || 'ناموفق'); return; }
    toast.show('ok', 'فروشنده بایگانی شد و در صورت نیاز قابل بازیابی است.');
    load();
  }
  async function doRestore(s: Seller) {
    const r = await adminRpc('admin_restore_seller', { p_id: s.id });
    if (!r.ok) { toast.show('err', r.error || 'ناموفق'); return; }
    toast.show('ok', 'فروشنده بازیابی شد.');
    load();
  }
  async function doPurge(s: Seller) {
    const r = await adminRpc('admin_purge_seller', { p_id: s.id });
    if (!r.ok) { toast.show('err', r.error || 'ناموفق'); return; }
    toast.show('ok', 'فروشنده برای همیشه حذف شد.');
    load();
  }

  // ---------- جزئیات ----------
  async function openDetail(s: Seller) {
    setDetail(s);
    setDetailAudit([]);
    setDetailAuditNote('');
    const [a, users] = await Promise.all([
      supabase.from('audit_log').select('*').eq('table_name', 'sellers').eq('record_id', s.id).order('created_at', { ascending: false }).limit(40),
      Object.keys(actors).length ? Promise.resolve(null) : supabase.rpc('admin_list_users'),
    ]);
    if (a.error) setDetailAuditNote('تاریخچه در دسترس نیست (فایل 02_stage1 اجرا شده است؟)');
    else setDetailAudit((a.data as AuditRow[]) || []);
    if (users && users.data) {
      const m: Record<string, string> = {};
      (users.data as any[]).forEach((u) => (m[u.id] = u.full_name || u.phone || u.id.slice(0, 6)));
      setActors(m);
    }
  }

  // مدارک در پوشه‌ی خصوصی هستند؛ برای مشاهده لینک موقت (۵ دقیقه) ساخته می‌شود
  async function openDoc(url: string) {
    const m = url.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/technician-documents\/([^?]+)/);
    const path = m ? decodeURIComponent(m[1]) : url;
    const res = await supabase.storage.from('technician-documents').createSignedUrl(path, 300);
    if (res.error || !res.data) { toast.show('err', 'باز کردن مدرک ناموفق بود: ' + (res.error?.message || '')); return; }
    window.open(res.data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  function exportReport() {
    const rows: (string | number | null)[][] = [['نام فروشگاه', 'موبایل', 'شهر', 'وضعیت', 'تعداد محصول', 'تعداد سفارش', 'جمع فروش (تومان)', 'آخرین سفارش', 'تاریخ ثبت']];
    const label = { archived: 'بایگانی‌شده', pending: 'در انتظار تأیید', inactive: 'غیرفعال', active: 'فعال' } as const;
    filtered.forEach((s) => {
      const m = stats[s.id] || { products: 0, orders: 0, sales: 0, lastOrder: null };
      rows.push([s.shop_name, s.phone, s.city, label[sellerState(s)], m.products, m.orders, m.sales, m.lastOrder ? fmtDate(m.lastOrder) : '', fmtDate(s.created_at)]);
    });
    downloadCsv('vira-sellers-report.csv', rows);
    toast.show('ok', 'گزارش ' + filtered.length + ' فروشنده دانلود شد.');
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

  const detailStats = detail ? stats[detail.id] || { products: 0, orders: 0, sales: 0, lastOrder: null } : null;
  const detailProducts = detail ? products.filter((p) => p.seller_id === detail.id) : [];
  const detailOrders = detail ? orders.filter((o) => o.seller_id === detail.id).sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 10) : [];

  return (
    <main style={{ minHeight: '100vh', background: '#f3f4f6', padding: '32px 16px' }} dir="rtl">
      {toast.node}
      <div style={{ maxWidth: 1150, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 'bold', color: '#1e3a8a' }}>مدیریت فروشندگان</h1>
          <a href="/admin" style={{ color: '#1e3a8a', fontSize: 14, textDecoration: 'none' }}>← بازگشت به پنل اصلی</a>
        </div>

        <div style={{ background: 'white', borderRadius: 12, padding: 16, marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جستجو نام فروشگاه، موبایل، شهر یا کد ملی..." style={{ ...inputStyle, flex: 1, minWidth: 220, width: 'auto' }} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} style={{ ...inputStyle, width: 'auto' }}>
            <option value="live">همه (بدون بایگانی)</option>
            <option value="active">فعال</option>
            <option value="inactive">غیرفعال</option>
            <option value="pending">در انتظار تأیید</option>
            <option value="archived">بایگانی‌شده</option>
            <option value="all">همه (با بایگانی)</option>
          </select>
          <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
            <option value="all">همه شهرها</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button onClick={exportReport} style={{ ...btn('#16a34a'), padding: '9px 16px', fontSize: 13 }}>گزارش (CSV)</button>
          <button onClick={openAdd} style={{ ...btn('#1e3a8a'), padding: '9px 16px', fontSize: 13 }}>+ فروشنده جدید</button>
        </div>

        <div style={{ background: 'white', borderRadius: 12, padding: 12, marginBottom: 16, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
          {filtered.length} فروشنده یافت شد
        </div>

        <div style={{ background: 'white', borderRadius: 12, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', minWidth: 900 }}>
            <thead style={{ background: '#1e3a8a', color: 'white' }}>
              <tr>
                <th style={th}>فروشگاه</th>
                <th style={th}>موبایل</th>
                <th style={th}>شهر</th>
                <th style={th}>وضعیت</th>
                <th style={th}>محصولات</th>
                <th style={th}>سفارش‌ها</th>
                <th style={th}>جمع فروش</th>
                <th style={th}>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>فروشنده‌ای یافت نشد</td></tr>
              ) : filtered.map((s) => {
                const m = stats[s.id] || { products: 0, orders: 0, sales: 0, lastOrder: null };
                const st = sellerState(s);
                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid #f3f4f6', opacity: st === 'archived' ? 0.7 : 1 }}>
                    <td style={{ ...td, fontWeight: 'bold' }}>{s.shop_name}</td>
                    <td style={{ ...td, color: '#6b7280' }}>{s.phone || '—'}</td>
                    <td style={{ ...td, color: '#6b7280' }}>{s.city || '—'}</td>
                    <td style={td}>{stateBadge(s)}</td>
                    <td style={td}>{m.products.toLocaleString('fa-IR')}</td>
                    <td style={td}>{m.orders.toLocaleString('fa-IR')}</td>
                    <td style={{ ...td, color: '#16a34a', fontWeight: 'bold' }}>{m.sales.toLocaleString('fa-IR')} تومان</td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button onClick={() => openDetail(s)} style={btn('#e0e7ff', '#1e3a8a')}>جزئیات</button>
                        {st !== 'archived' && <button onClick={() => openEdit(s)} style={btn('#dbeafe', '#1d4ed8')}>ویرایش</button>}
                        {st === 'pending' && <button onClick={() => approve(s)} style={btn('#16a34a')}>تأیید</button>}
                        {(st === 'active' || st === 'inactive') && (
                          <button onClick={() => toggleActive(s)} style={btn(st === 'active' ? '#fef3c7' : '#d1fae5', st === 'active' ? '#d97706' : '#065f46')}>
                            {st === 'active' ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                          </button>
                        )}
                        {st !== 'archived' && <button onClick={() => setArchiveTarget(s)} style={btn('#fee2e2', '#dc2626')}>حذف</button>}
                        {st === 'archived' && <button onClick={() => setRestoreTarget(s)} style={btn('#16a34a')}>بازیابی</button>}
                        {st === 'archived' && <button onClick={() => setPurgeTarget(s)} style={btn('#7f1d1d')}>حذف قطعی</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* افزودن / ویرایش */}
      {formMode && (
        <Modal title={formMode === 'add' ? 'فروشنده جدید' : 'ویرایش فروشنده'} onClose={() => !saving && setFormMode(null)}>
          <Field label="نام فروشگاه *"><input value={form.shop_name} onChange={(e) => setForm({ ...form, shop_name: e.target.value })} style={inputStyle} /></Field>
          <Field label="موبایل (نام کاربری ورود) *"><input inputMode="numeric" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={inputStyle} placeholder="09123456789" /></Field>
          {formMode === 'add' && (
            <Field label="رمز عبور اولیه (اگر این شماره قبلاً حساب دارد، خالی بگذارید)">
              <input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} style={inputStyle} placeholder="حداقل ۶ کاراکتر" />
            </Field>
          )}
          <Field label="شهر"><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} style={inputStyle} /></Field>
          <Field label="آدرس فروشگاه"><input value={form.shop_address} onChange={(e) => setForm({ ...form, shop_address: e.target.value })} style={inputStyle} /></Field>
          <Field label="موبایل فروشگاه"><input inputMode="numeric" value={form.shop_mobile} onChange={(e) => setForm({ ...form, shop_mobile: e.target.value })} style={inputStyle} /></Field>
          <Field label="کد ملی"><input inputMode="numeric" value={form.national_id} onChange={(e) => setForm({ ...form, national_id: e.target.value })} style={inputStyle} /></Field>
          <Field label="توضیحات"><textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={inputStyle} /></Field>
          {formError && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 10 }}>{formError}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button onClick={() => setFormMode(null)} disabled={saving} style={{ ...btn('#e5e7eb', '#374151'), padding: '8px 18px', fontSize: 13 }}>انصراف</button>
            <button onClick={submitForm} disabled={saving} style={{ ...btn('#1e3a8a'), padding: '8px 18px', fontSize: 13, opacity: saving ? 0.6 : 1 }}>{saving ? 'در حال ذخیره...' : 'ذخیره'}</button>
          </div>
        </Modal>
      )}

      {/* جزئیات */}
      {detail && detailStats && (
        <Modal title={'فروشنده: ' + detail.shop_name} onClose={() => setDetail(null)} width={720}>
          <div style={{ marginBottom: 8 }}>{stateBadge(detail)}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, fontSize: 14, color: '#374151' }}>
            <div>موبایل: {detail.phone || '—'}</div>
            <div>موبایل فروشگاه: {detail.shop_mobile || '—'}</div>
            <div>شهر: {detail.city || '—'}</div>
            <div>کد ملی: {detail.national_id || '—'}</div>
            <div>تاریخ ثبت: {fmtDate(detail.created_at)}</div>
            <div>امضای تعهدنامه: {detail.commitment_signed_name || '—'}</div>
          </div>
          {detail.shop_address && <p style={{ fontSize: 14, color: '#374151', marginTop: 8 }}>آدرس: {detail.shop_address}</p>}
          {detail.description && <p style={{ fontSize: 14, color: '#374151', marginTop: 4 }}>توضیحات: {detail.description}</p>}
          {detail.deleted_at && (
            <p style={{ fontSize: 14, color: '#b91c1c', marginTop: 8 }}>
              بایگانی‌شده در {fmtDate(detail.deleted_at)}{detail.delete_reason ? ' — دلیل: ' + detail.delete_reason : ''}
            </p>
          )}

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '14px 0' }}>
            {[
              { l: 'محصولات', v: detailStats.products.toLocaleString('fa-IR') },
              { l: 'سفارش‌ها', v: detailStats.orders.toLocaleString('fa-IR') },
              { l: 'جمع فروش', v: detailStats.sales.toLocaleString('fa-IR') + ' تومان' },
              { l: 'آخرین سفارش', v: detailStats.lastOrder ? fmtDate(detailStats.lastOrder) : '—' },
            ].map((x) => (
              <div key={x.l} style={{ flex: 1, minWidth: 130, background: '#f3f4f6', borderRadius: 10, padding: 10, textAlign: 'center' }}>
                <div style={{ fontWeight: 'bold', color: '#1e3a8a', fontSize: 14 }}>{x.v}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{x.l}</div>
              </div>
            ))}
          </div>

          {[
            ['کارت ملی', detail.doc_national_id_url],
            ['مجوز کسب‌وکار', detail.doc_license_url],
            ['مدرک تکمیلی', detail.doc_extra_url],
            ['تعهدنامه', detail.doc_commitment_url],
          ].some(([, u]) => u) && (
            <div style={{ marginBottom: 12, fontSize: 13 }}>
              <b>مدارک: </b>
              {[
                ['کارت ملی', detail.doc_national_id_url],
                ['مجوز کسب‌وکار', detail.doc_license_url],
                ['مدرک تکمیلی', detail.doc_extra_url],
                ['تعهدنامه', detail.doc_commitment_url],
              ].filter(([, u]) => u).map(([l, u]) => (
                <button key={l as string} onClick={() => openDoc(u as string)} style={{ ...btn('#e0e7ff', '#1d4ed8'), marginLeft: 8 }}>{l}</button>
              ))}
            </div>
          )}

          <h3 style={{ fontSize: 14, fontWeight: 'bold', margin: '12px 0 6px' }}>محصولات ({detailProducts.length})</h3>
          {detailProducts.length === 0 ? <p style={{ fontSize: 13, color: '#9ca3af' }}>محصولی ثبت نشده است.</p> : (
            <div style={{ maxHeight: 160, overflowY: 'auto', fontSize: 13 }}>
              {detailProducts.map((p) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', padding: '4px 0' }}>
                  <span>{p.name}</span>
                  <span style={{ color: '#6b7280' }}>{(p.price || 0).toLocaleString('fa-IR')} تومان · موجودی {p.stock ?? 0}</span>
                </div>
              ))}
            </div>
          )}

          <h3 style={{ fontSize: 14, fontWeight: 'bold', margin: '12px 0 6px' }}>آخرین سفارش‌ها</h3>
          {detailOrders.length === 0 ? <p style={{ fontSize: 13, color: '#9ca3af' }}>سفارشی ثبت نشده است.</p> : (
            <div style={{ fontSize: 13 }}>
              {detailOrders.map((o) => (
                <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', padding: '4px 0', gap: 8, flexWrap: 'wrap' }}>
                  <span>{o.full_name} × {o.quantity}</span>
                  <span style={{ color: '#6b7280' }}>{Number(o.total_price).toLocaleString('fa-IR')} تومان · {orderStatus[o.status || ''] || o.status} · {fmtDate(o.created_at)}</span>
                </div>
              ))}
            </div>
          )}

          <h3 style={{ fontSize: 14, fontWeight: 'bold', margin: '14px 0 6px' }}>تاریخچه تغییرات</h3>
          {detailAuditNote ? <p style={{ fontSize: 13, color: '#9ca3af' }}>{detailAuditNote}</p> : <AuditTimeline rows={detailAudit} actors={actors} />}
        </Modal>
      )}

      {archiveTarget && (
        <ReasonModal
          title={'حذف فروشنده «' + archiveTarget.shop_name + '»'}
          description="فروشنده بایگانی می‌شود (حذف منطقی). محصولات و سفارش‌های او حفظ می‌شوند و هر زمان قابل بازیابی است."
          confirmLabel="حذف (بایگانی)"
          danger
          onConfirm={(reason) => doArchive(archiveTarget, reason)}
          onClose={() => setArchiveTarget(null)}
        />
      )}
      {restoreTarget && (
        <ReasonModal
          title={'بازیابی «' + restoreTarget.shop_name + '»'}
          description="فروشنده دوباره فعال می‌شود."
          confirmLabel="بازیابی"
          requireReason={false}
          onConfirm={() => doRestore(restoreTarget)}
          onClose={() => setRestoreTarget(null)}
        />
      )}
      {purgeTarget && (
        <ReasonModal
          title={'حذف قطعی «' + purgeTarget.shop_name + '»'}
          description="این عملیات غیرقابل برگشت است. فقط فروشنده‌ای که هیچ محصول و سفارشی ندارد حذف می‌شود؛ در غیر این صورت سیستم اجازه نمی‌دهد."
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
