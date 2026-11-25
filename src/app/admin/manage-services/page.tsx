'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import CrudManager from '@/components/admin/CrudManager';
import TechnicianScopesManager from '@/components/admin/TechnicianScopesManager';
import TelecomCentersManager from '@/components/admin/TelecomCentersManager';

const KINDS = [
  { value: 'telecom', label: 'مخابراتی (نیازمند مرکز)' },
  { value: 'appliance', label: 'لوازم برقی' },
  { value: 'other', label: 'سایر' },
];
const FIELD_TYPES = [
  { value: 'text', label: 'متن کوتاه' },
  { value: 'textarea', label: 'متن بلند' },
  { value: 'number', label: 'عدد' },
  { value: 'phone', label: 'شماره تلفن' },
  { value: 'select', label: 'لیست انتخابی' },
];

const categoryOpt = { table: 'service_categories', select: 'id,name', label: (r: any) => r.name };
const centerOpt = { table: 'telecom_centers', select: 'id,name', label: (r: any) => r.name, filter: { deleted_at: null } };
const personLabel = (r: any) => (r.full_name || 'بدون نام') + (r.phone ? ' — ' + r.phone : '');

const TABS = [
  { key: 'centers', label: '🏢 مدیریت مراکز مخابراتی' },
  { key: 'streets', label: '🛣️ خیابان‌ها' },
  { key: 'supervisors', label: '👤 مسئول هر مرکز' },
  { key: 'scopes', label: '🔧 محدوده و خدمات تکنسین‌ها' },
  { key: 'categories', label: '📂 دسته‌های خدمت' },
  { key: 'faults', label: '⚠️ انواع خرابی' },
  { key: 'fields', label: '📝 فیلدهای فرم' },
];

export default function ManageServicesPage() {
  const [allowed, setAllowed] = useState(false);
  const [tab, setTab] = useState('centers');

  useEffect(() => {
    (async () => {
      const userRes = await supabase.auth.getUser();
      const user = userRes.data.user;
      if (!user) { window.location.href = '/auth'; return; }
      const adminRes = await supabase.from('admins').select('id').eq('user_id', user.id).maybeSingle();
      if (!adminRes.data) { window.location.href = '/'; return; }
      setAllowed(true);
    })();
  }, []);

  if (!allowed) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#1e3a8a' }}>در حال بررسی...</p>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f3f4f6', padding: '32px 16px' }} dir="rtl">
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <Link href="/admin" style={{ color: '#1e3a8a', fontSize: '14px', textDecoration: 'none', marginBottom: '16px', display: 'inline-block' }}>
          ← بازگشت به پنل ادمین
        </Link>

        <div style={{ background: '#1e3a8a', color: 'white', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold' }}>🛠️ مدیریت خدمات و مراکز مخابراتی</h1>
          <p style={{ fontSize: '14px', marginTop: '8px', color: 'rgba(255,255,255,0.8)' }}>
            مراکز، خیابان‌ها، مسئول هر مرکز، محدوده‌ی تکنسین‌ها، انواع خرابی و فیلدهای فرم را بدون کدنویسی تغییر دهید.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '10px 18px', borderRadius: '8px', border: 'none', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer',
                background: tab === t.key ? '#1e3a8a' : '#e5e7eb',
                color: tab === t.key ? 'white' : '#374151',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'centers' && <TelecomCentersManager />}

        {tab === 'streets' && (
          <>
            <BulkStreets />
            <CrudManager
              table="center_streets"
              title="فهرست خیابان‌ها"
              orderBy="name"
              fields={[
                { name: 'name', label: 'نام خیابان', type: 'text', required: true },
                { name: 'center_id', label: 'مرکز مخابراتی', type: 'select', required: true, optionsFrom: centerOpt },
                { name: 'is_active', label: 'فعال', type: 'boolean' },
              ]}
            />
          </>
        )}

        {tab === 'supervisors' && (
          <CrudManager
            table="center_supervisors"
            title="مسئول (ثبت‌کننده و ارجاع‌دهنده) هر مرکز"
            fields={[
              {
                name: 'user_id', label: 'کاربر', type: 'select', required: true,
                optionsFrom: { rpc: 'admin_list_users', label: personLabel },
                hint: 'کاربر باید قبلاً در سایت ثبت‌نام کرده باشد. بعد از افزودن، در منوی بالا «پنل مرکز مخابراتی» برایش ظاهر می‌شود.',
              },
              { name: 'center_id', label: 'مرکز مخابراتی', type: 'select', required: true, optionsFrom: centerOpt },
            ]}
          />
        )}

        {tab === 'scopes' && <TechnicianScopesManager />}

        {tab === 'categories' && (
          <CrudManager
            table="service_categories"
            title="دسته‌های خدمت"
            orderBy="sort_order"
            fields={[
              { name: 'name', label: 'نام', type: 'text', required: true },
              { name: 'code', label: 'کد انگلیسی یکتا', type: 'text', required: true, placeholder: 'copper_phone' },
              { name: 'kind', label: 'نوع', type: 'select', required: true, options: KINDS },
              { name: 'requires_center', label: 'انتخاب مرکز مخابراتی اجباری باشد', type: 'boolean' },
              { name: 'requires_ftth_number', label: 'ثبت «شماره مجازی FTTH» اجباری باشد (برای خدمات FTTH)', type: 'boolean' },
              { name: 'description', label: 'توضیح', type: 'textarea' },
              { name: 'sort_order', label: 'ترتیب', type: 'number' },
              { name: 'is_active', label: 'فعال', type: 'boolean' },
            ]}
          />
        )}

        {tab === 'faults' && (
          <CrudManager
            table="service_fault_types"
            title="انواع خرابی هر دسته"
            orderBy="sort_order"
            fields={[
              { name: 'name', label: 'عنوان خرابی', type: 'text', required: true },
              { name: 'category_id', label: 'دسته خدمت', type: 'select', required: true, optionsFrom: categoryOpt },
              { name: 'sort_order', label: 'ترتیب', type: 'number' },
              { name: 'is_active', label: 'فعال', type: 'boolean' },
            ]}
          />
        )}

        {tab === 'fields' && (
          <CrudManager
            table="service_form_fields"
            title="فیلدهای اضافه‌ی فرم هر دسته (برند، مدل، شماره تلفن، ...)"
            orderBy="sort_order"
            fields={[
              { name: 'label', label: 'عنوان فیلد', type: 'text', required: true },
              { name: 'category_id', label: 'دسته خدمت', type: 'select', required: true, optionsFrom: categoryOpt },
              { name: 'key', label: 'کلید انگلیسی یکتا در دسته', type: 'text', required: true, placeholder: 'brand' },
              { name: 'field_type', label: 'نوع فیلد', type: 'select', required: true, options: FIELD_TYPES },
              { name: 'options', label: 'گزینه‌ها (فقط برای لیست انتخابی)', type: 'list', hideInList: true, hint: 'با ویرگول جدا کنید: تلویزیون، ماکروفر، یخچال' },
              { name: 'placeholder', label: 'متن راهنما', type: 'text', hideInList: true },
              { name: 'is_required', label: 'الزامی باشد', type: 'boolean' },
              { name: 'sort_order', label: 'ترتیب', type: 'number' },
              { name: 'is_active', label: 'فعال', type: 'boolean' },
            ]}
          />
        )}
      </div>
    </main>
  );
}

function BulkStreets() {
  const [centers, setCenters] = useState<any[]>([]);
  const [centerId, setCenterId] = useState('');
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    supabase.from('telecom_centers').select('id,name').is('deleted_at', null).order('name').then(async (res) => {
      if (res.error) res = await supabase.from('telecom_centers').select('id,name').order('name');
      setCenters(res.data || []);
    });
  }, []);

  async function submit() {
    setMsg('');
    const names = Array.from(new Set(text.split(/\n|،|,/).map((s) => s.trim()).filter(Boolean)));
    if (!centerId || names.length === 0) {
      setMsg('مرکز را انتخاب کنید و حداقل یک خیابان بنویسید.');
      return;
    }
    const res = await supabase
      .from('center_streets')
      .upsert(names.map((name) => ({ center_id: centerId, name })), { onConflict: 'center_id,name', ignoreDuplicates: true });
    if (res.error) {
      setMsg(res.error.message);
      return;
    }
    setMsg('✓ ' + names.length + ' خیابان ثبت شد. برای دیدن در فهرست، صفحه را تازه کنید.');
    setText('');
  }

  const input = { padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', width: '100%', boxSizing: 'border-box' as const };

  return (
    <div style={{ background: 'white', borderRadius: '12px', padding: '24px', marginBottom: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
      <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e3a8a', marginBottom: '8px' }}>افزودن گروهی خیابان‌ها</h2>
      <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '12px' }}>هر خیابان را در یک خط بنویسید (یا با ویرگول جدا کنید) تا یکجا برای یک مرکز ثبت شود.</p>
      <div style={{ display: 'grid', gap: '12px' }}>
        <select style={input} value={centerId} onChange={(e) => setCenterId(e.target.value)}>
          <option value="">انتخاب مرکز مخابراتی...</option>
          {centers.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <textarea style={{ ...input, minHeight: '130px' }} placeholder={'خیابان ایثار\nخیابان شهید بهشتی\nکوچه گل‌ها'} value={text} onChange={(e) => setText(e.target.value)} />
        {msg && <p style={{ fontSize: '13px' }}>{msg}</p>}
        <button onClick={submit} style={{ background: '#16a34a', color: 'white', border: 'none', borderRadius: '8px', padding: '10px', cursor: 'pointer', fontWeight: 'bold' }}>
          ثبت خیابان‌ها
        </button>
      </div>
    </div>
  );
}
