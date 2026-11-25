'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { validateFtth, type FtthRule } from '@/lib/ftth';
import { can } from '@/lib/permissions';
import { useMyPerms } from '@/lib/useMyPerms';
import { Field, Modal, ReasonModal, badge, btn, inputStyle, useToast } from '@/components/admin/ui';

type Row = FtthRule & { id: string };

export default function FtthRulesPage() {
  const toast = useToast();
  const mine = useMyPerms();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [open, setOpen] = useState<null | 'add' | 'edit'>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState({ area_code: '', city_name: '', subscriber_digits: '8', total_length: '11', error_message: '' });
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [delTarget, setDelTarget] = useState<Row | null>(null);
  const [testValue, setTestValue] = useState('');

  const load = useCallback(async () => {
    const res = await supabase.from('ftth_city_rules').select('*').order('area_code');
    if (res.error) setMissing(true);
    setRows((res.data as Row[]) || []);
    setLoading(false);
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

  function openAdd() {
    setForm({ area_code: '', city_name: '', subscriber_digits: '8', total_length: '11', error_message: '' });
    setEditing(null); setErr(''); setOpen('add');
  }
  function openEdit(r: Row) {
    setForm({ area_code: r.area_code, city_name: r.city_name || '', subscriber_digits: String(r.subscriber_digits), total_length: String(r.total_length), error_message: r.error_message || '' });
    setEditing(r); setErr(''); setOpen('edit');
  }

  async function save() {
    const code = form.area_code.trim();
    if (open === 'add' && code !== '*' && !/^0[0-9]{1,3}$/.test(code)) { setErr('کد شهر باید با صفر شروع شود (مثلاً 021) یا * برای قاعده‌ی عمومی'); return; }
    const digits = Number(form.subscriber_digits), total = Number(form.total_length);
    if (!Number.isInteger(digits) || digits < 4 || digits > 12) { setErr('تعداد رقم مشترک باید بین ۴ تا ۱۲ باشد'); return; }
    if (!Number.isInteger(total) || total < 5 || total > 16) { setErr('طول کل باید بین ۵ تا ۱۶ باشد'); return; }
    setSaving(true); setErr('');
    const base = { city_name: form.city_name.trim() || null, subscriber_digits: digits, total_length: total, error_message: form.error_message.trim() || null };
    const res = open === 'add'
      ? await supabase.from('ftth_city_rules').insert({ ...base, area_code: code }).select('id')
      : await supabase.from('ftth_city_rules').update(base).eq('id', editing!.id).select('id');
    setSaving(false);
    if (res.error) { setErr(/duplicate|unique/i.test(res.error.message) ? 'برای این کد شهر قبلاً قاعده ثبت شده است' : res.error.message); return; }
    if (!res.data || res.data.length === 0) { setErr('ذخیره انجام نشد (دسترسی وجود ندارد)'); return; }
    toast.show('ok', 'قاعده ذخیره شد.');
    setOpen(null); load();
  }

  async function toggle(r: Row) {
    const res = await supabase.from('ftth_city_rules').update({ is_active: !r.is_active }).eq('id', r.id).select('id');
    if (res.error || !res.data || res.data.length === 0) { toast.show('err', res.error?.message || 'دسترسی وجود ندارد'); return; }
    toast.show('ok', r.is_active ? 'قاعده غیرفعال شد.' : 'قاعده فعال شد.');
    load();
  }

  async function doDelete(r: Row) {
    const res = await supabase.from('ftth_city_rules').delete().eq('id', r.id).select('id');
    if (res.error || !res.data || res.data.length === 0) { toast.show('err', res.error?.message || 'حذف انجام نشد'); return; }
    toast.show('ok', 'قاعده حذف شد.');
    load();
  }

  const canEdit = can(mine.perms, 'services', 'edit');
  const testMsg = testValue ? validateFtth(testValue, rows.filter((r) => r.is_active)) : null;

  return (
    <main style={{ minHeight: '100vh', background: '#f3f4f6', padding: '32px 16px' }} dir="rtl">
      {toast.node}
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 'bold', color: '#1e3a8a' }}>قواعد شماره مجازی FTTH</h1>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {can(mine.perms, 'services', 'create') && !missing && <button onClick={openAdd} style={{ ...btn('#1e3a8a'), padding: '9px 16px', fontSize: 13 }}>+ قاعده‌ی شهر جدید</button>}
            <a href="/admin" style={{ color: '#1e3a8a', fontSize: 14, textDecoration: 'none' }}>← بازگشت به پنل اصلی</a>
          </div>
        </div>

        {missing && <div style={{ background: '#fef3c7', color: '#92400e', borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 14 }}>جدول قواعد هنوز ساخته نشده است. فایل 08_stage7_ftth_links.sql را اجرا کنید.</div>}

        <div style={{ background: '#eef2ff', borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 13, color: '#3730a3', lineHeight: 2 }}>
          شماره‌ی FTTH بر اساس کد شهر سنجیده می‌شود (طولانی‌ترین کد منطبق). برای تهران کد 021 با ۱۱ رقم تعریف شده است. اگر کد شهر شماره در فهرست نباشد، «قاعده‌ی عمومی (*)» اعمال می‌شود؛ برای سخت‌گیری کامل (فقط شهرهای تعریف‌شده) آن را غیرفعال کنید. خدمت FTTH را از «مدیریت خدمات» با گزینه‌ی «شماره مجازی FTTH اجباری باشد» مشخص کنید.
        </div>

        <div style={{ background: 'white', borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <label style={{ fontSize: 13, color: '#374151' }}>آزمایش یک شماره با قواعد فعلی</label>
          <input dir="ltr" value={testValue} onChange={(e) => setTestValue(e.target.value)} placeholder="02199162496" style={{ ...inputStyle, marginTop: 6 }} />
          {testValue && (
            <p style={{ fontSize: 13, marginTop: 8, color: testMsg ? '#b91c1c' : '#065f46' }}>{testMsg || '✓ شماره معتبر است'}</p>
          )}
        </div>

        <div style={{ background: 'white', borderRadius: 12, overflow: 'hidden' }}>
          {loading ? <p style={{ padding: 32, textAlign: 'center', color: '#6b7280' }}>در حال بارگذاری...</p> : rows.length === 0 ? (
            <p style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>قاعده‌ای ثبت نشده است</p>
          ) : rows.map((r) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '12px 14px', borderBottom: '1px solid #f3f4f6', opacity: r.is_active ? 1 : 0.6 }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <b dir="ltr">{r.area_code === '*' ? '* (قاعده‌ی عمومی)' : r.area_code}</b>
                <span style={{ marginRight: 8 }}>{r.city_name}</span>
                {!r.is_active && <span style={badge('#fee2e2', '#dc2626')}>غیرفعال</span>}
                <div style={{ fontSize: 12, color: '#6b7280' }}>طول کل {r.total_length} رقم · {r.subscriber_digits} رقم بعد از کد شهر</div>
              </div>
              {canEdit && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => openEdit(r)} style={btn('#dbeafe', '#1d4ed8')}>ویرایش</button>
                  <button onClick={() => toggle(r)} style={btn(r.is_active ? '#fef3c7' : '#d1fae5', r.is_active ? '#d97706' : '#065f46')}>{r.is_active ? 'غیرفعال‌سازی' : 'فعال‌سازی'}</button>
                  {can(mine.perms, 'services', 'delete') && <button onClick={() => setDelTarget(r)} style={btn('#fee2e2', '#dc2626')}>حذف</button>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {open && (
        <Modal title={open === 'add' ? 'قاعده‌ی شهر جدید' : 'ویرایش قاعده'} onClose={() => !saving && setOpen(null)} width={460}>
          <Field label="کد شهر (مثلاً 021)"><input dir="ltr" value={form.area_code} disabled={open === 'edit'} onChange={(e) => setForm({ ...form, area_code: e.target.value })} style={inputStyle} /></Field>
          <Field label="نام شهر"><input value={form.city_name} onChange={(e) => setForm({ ...form, city_name: e.target.value })} style={inputStyle} /></Field>
          <Field label="تعداد رقم بعد از کد شهر"><input inputMode="numeric" value={form.subscriber_digits} onChange={(e) => setForm({ ...form, subscriber_digits: e.target.value })} style={inputStyle} /></Field>
          <Field label="طول کل شماره (کد شهر + مشترک)"><input inputMode="numeric" value={form.total_length} onChange={(e) => setForm({ ...form, total_length: e.target.value })} style={inputStyle} /></Field>
          <Field label="پیام خطا (اختیاری)"><input value={form.error_message} onChange={(e) => setForm({ ...form, error_message: e.target.value })} style={inputStyle} /></Field>
          {err && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 10 }}>{err}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button onClick={() => setOpen(null)} disabled={saving} style={{ ...btn('#e5e7eb', '#374151'), padding: '8px 18px', fontSize: 13 }}>انصراف</button>
            <button onClick={save} disabled={saving} style={{ ...btn('#1e3a8a'), padding: '8px 18px', fontSize: 13, opacity: saving ? 0.6 : 1 }}>{saving ? 'در حال ذخیره...' : 'ذخیره'}</button>
          </div>
        </Modal>
      )}

      {delTarget && (
        <ReasonModal title="حذف قاعده" description="با حذف این قاعده، شماره‌های این کد شهر با قاعده‌ی عمومی (در صورت فعال بودن) سنجیده می‌شوند." confirmLabel="حذف" danger requireReason={false}
          onConfirm={() => doDelete(delTarget)} onClose={() => setDelTarget(null)} />
      )}
    </main>
  );
}
