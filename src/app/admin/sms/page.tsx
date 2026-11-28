'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useMyPerms } from '@/lib/useMyPerms';
import { badge, btn, fmtDate, inputStyle, useToast } from '@/components/admin/ui';

const EVENTS: { key: string; label: string; hint?: string }[] = [
  { key: 'request_created', label: 'ثبت درخواست تکنسین (به مشتری)' },
  { key: 'request_assigned_tech', label: 'ارجاع درخواست به تکنسین (به تکنسین)' },
  { key: 'request_accepted', label: 'قبول کار توسط تکنسین (به مشتری)' },
  { key: 'request_started', label: 'شروع کار (به مشتری)' },
  { key: 'request_completed', label: 'پایان کار (به مشتری)' },
  { key: 'request_cancelled', label: 'لغو درخواست (به مشتری و تکنسین)' },
  { key: 'request_tech_released', label: 'انصراف تکنسین (به مشتری)' },
  { key: 'new_request_broadcast', label: 'درخواست جدید در محدوده (به تکنسین‌های مجاز)', hint: 'پیش‌فرض خاموش؛ هزینه‌ی پیامک را بالا می‌برد' },
  { key: 'invoice_confirm_code', label: 'کد تأیید فاکتور (به مشتری)' },
  { key: 'invoice_customer_approved', label: 'تأیید فاکتور توسط مشتری (به تکنسین)' },
  { key: 'invoice_paid_out', label: 'واریز مبلغ فاکتور (به تکنسین)' },
  { key: 'order_created_customer', label: 'ثبت سفارش فروشگاه (به خریدار)' },
  { key: 'order_created_seller', label: 'سفارش جدید (به فروشنده)' },
  { key: 'order_status', label: 'تغییر وضعیت سفارش (به خریدار)' },
  { key: 'order_paid', label: 'پرداخت سفارش (به خریدار و فروشنده)' },
  { key: 'tech_registered', label: 'دریافت ثبت‌نام تکنسین' },
  { key: 'tech_approved', label: 'تأیید تکنسین' },
  { key: 'tech_added_by_admin', label: 'ساخت حساب تکنسین توسط ادمین (خوش‌آمد)' },
  { key: 'tech_rejected', label: 'رد ثبت‌نام تکنسین' },
  { key: 'seller_registered', label: 'دریافت ثبت‌نام فروشنده' },
  { key: 'seller_approved', label: 'تأیید فروشنده' },
  { key: 'seller_rejected', label: 'رد ثبت‌نام فروشنده' },
  { key: 'support_reply', label: 'پاسخ پشتیبانی (به کاربر)' },
  { key: 'release_reviewed', label: 'نتیجه‌ی بررسی انصراف (به تکنسین)' },
];
const evLabel = (k: string) => EVENTS.find((e) => e.key === k)?.label || (k === 'test' ? 'آزمایشی' : k);

const statusStyle: Record<string, [string, string, string]> = {
  pending: ['#fef3c7', '#92400e', 'در صف'],
  sending: ['#dbeafe', '#1e40af', 'در حال ارسال'],
  sent: ['#d1fae5', '#065f46', 'ارسال شد'],
  failed: ['#fee2e2', '#991b1b', 'ناموفق'],
};

export default function AdminSmsPage() {
  const toast = useToast();
  const myPerms = useMyPerms();
  const isSuper = !!myPerms.perms?.super;

  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [disabled, setDisabled] = useState<string[]>([]);
  const [processUrl, setProcessUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [statusF, setStatusF] = useState('all');
  const [testPhone, setTestPhone] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const s = await supabase.from('sms_settings').select('*').eq('id', 1).maybeSingle();
    if (s.error) { setMissing(true); setLoading(false); return; }
    if (s.data) {
      setEnabled(!!s.data.enabled);
      setDisabled((s.data.disabled_events as string[]) || []);
      setProcessUrl(s.data.process_url || '');
    }
    const o = await supabase.from('sms_outbox').select('*').order('id', { ascending: false }).limit(150);
    setRows(o.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { if (isSuper) load(); else if (!myPerms.loading) setLoading(false); }, [isSuper, myPerms.loading, load]);

  async function saveSettings() {
    setBusy(true);
    const r = await supabase.rpc('admin_sms_update_settings', { p_enabled: enabled, p_disabled: disabled, p_process_url: processUrl.trim() });
    if (r.error) { setBusy(false); toast.show('err', r.error.message); return; }
    if (secret.trim()) {
      const r2 = await supabase.rpc('admin_sms_set_secret', { p_secret: secret.trim() });
      if (r2.error) { setBusy(false); toast.show('err', r2.error.message); return; }
      setSecret('');
    }
    setBusy(false);
    toast.show('ok', 'تنظیمات ذخیره شد.');
    load();
  }

  async function processNow() {
    setBusy(true);
    const { data } = await supabase.auth.getSession();
    const res = await fetch('/api/sms/process', { method: 'POST', headers: { Authorization: 'Bearer ' + (data.session?.access_token || '') } });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { toast.show('err', j.error || 'ناموفق'); return; }
    toast.show('ok', 'ارسال شد: ' + (j.sent || 0) + ' | ناموفق دائمی: ' + (j.failed || 0) + ' | تلاش مجدد: ' + (j.will_retry || 0));
    load();
  }

  async function retryFailed() {
    const r = await supabase.rpc('admin_sms_retry', { p_ids: null });
    if (r.error) { toast.show('err', r.error.message); return; }
    toast.show('ok', Number(r.data || 0) + ' پیامک ناموفق دوباره در صف قرار گرفت.');
    load();
  }

  async function sendTest() {
    const r = await supabase.rpc('admin_sms_send_test', { p_phone: testPhone });
    if (r.error) { toast.show('err', r.error.message); return; }
    toast.show('ok', 'پیامک آزمایشی در صف قرار گرفت؛ «ارسال همین حالا» را بزنید.');
    load();
  }

  function toggle(k: string) {
    setDisabled((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  }

  const shown = rows.filter((r) => statusF === 'all' || r.status === statusF);
  const pending = rows.filter((r) => r.status === 'pending' || r.status === 'sending').length;
  const failed = rows.filter((r) => r.status === 'failed').length;

  if (loading) return <main style={{ padding: 40, textAlign: 'center' }} dir="rtl">در حال بارگذاری...</main>;
  if (!isSuper) return <main style={{ padding: 40, textAlign: 'center' }} dir="rtl">این بخش فقط برای ادمین اصلی است.</main>;

  return (
    <main style={{ minHeight: '100vh', background: '#f3f4f6', padding: '32px 16px' }} dir="rtl">
      {toast.node}
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 'bold', color: '#1e3a8a' }}>پیامک‌ها و اعلان‌ها</h1>
          <a href="/admin" style={{ color: '#1e3a8a', fontSize: 14, textDecoration: 'none' }}>← بازگشت به پنل اصلی</a>
        </div>

        {missing && (
          <div style={{ background: '#fef3c7', color: '#92400e', borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 14 }}>
            سیستم پیامک هنوز ساخته نشده است. فایل 13_stage9_sms_system.sql را در Supabase اجرا کنید.
          </div>
        )}

        {!missing && (
          <>
            <div style={{ background: 'white', borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 'bold', fontSize: 15, cursor: 'pointer' }}>
                <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
                ارسال پیامک‌های روند کار فعال باشد
              </label>
              <p style={{ fontSize: 12, color: '#6b7280', margin: '6px 0 12px' }}>کد ورود و ثبت‌نام همیشه ارسال می‌شود و به این تنظیمات وابسته نیست.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 6 }}>
                {EVENTS.map((e) => (
                  <label key={e.key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, cursor: 'pointer', padding: '4px 0' }}>
                    <input type="checkbox" checked={!disabled.includes(e.key)} onChange={() => toggle(e.key)} style={{ marginTop: 3 }} />
                    <span>{e.label}{e.hint && <small style={{ display: 'block', color: '#9ca3af' }}>{e.hint}</small>}</span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ background: 'white', borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <h2 style={{ fontSize: 15, fontWeight: 'bold', marginBottom: 8 }}>ارسال فوری (اختیاری ولی توصیه‌شده)</h2>
              <p style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.9, marginBottom: 10 }}>
                برای اینکه پیامک‌ها بلافاصله بروند، دیتابیس باید بتواند سرور را صدا بزند. نشانی سایت (مثلاً https://tamin-vira.ir/api/sms/process) و یک رمز دلخواه حداقل ۱۶ نویسه‌ای وارد کنید،
                و همین رمز را در Vercel با نام SMS_PROCESS_SECRET هم بگذارید. اگر خالی بماند، پیامک‌ها با دکمه‌ی «ارسال همین حالا»، با باز بودن سایت توسط کاربران و با کرون روزانه ارسال می‌شوند.
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <input value={processUrl} onChange={(e) => setProcessUrl(e.target.value)} placeholder="https://.../api/sms/process" style={{ ...inputStyle, flex: 2, minWidth: 240, width: 'auto', direction: 'ltr' }} />
                <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="رمز جدید (فقط برای تغییر)" style={{ ...inputStyle, flex: 1, minWidth: 180, width: 'auto', direction: 'ltr' }} />
              </div>
              <div style={{ marginTop: 12 }}>
                <button onClick={saveSettings} disabled={busy} style={{ ...btn('#16a34a'), padding: '8px 20px', fontSize: 13, opacity: busy ? 0.6 : 1 }}>ذخیره‌ی تنظیمات</button>
              </div>
            </div>

            <div style={{ background: 'white', borderRadius: 12, padding: 16, marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 13 }}>در صف: <b>{pending}</b> · ناموفق: <b style={{ color: failed ? '#b91c1c' : undefined }}>{failed}</b></span>
              <button onClick={processNow} disabled={busy} style={{ ...btn('#1e3a8a'), opacity: busy ? 0.6 : 1 }}>ارسال همین حالا</button>
              <button onClick={retryFailed} disabled={failed === 0} style={{ ...btn('#d97706'), opacity: failed === 0 ? 0.5 : 1 }}>تلاش دوباره برای ناموفق‌ها</button>
              <input value={testPhone} onChange={(e) => setTestPhone(e.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="09xxxxxxxxx" style={{ ...inputStyle, width: 150, direction: 'ltr' }} />
              <button onClick={sendTest} disabled={testPhone.length !== 11} style={{ ...btn('#0891b2'), opacity: testPhone.length !== 11 ? 0.5 : 1 }}>پیامک آزمایشی</button>
              <select value={statusF} onChange={(e) => setStatusF(e.target.value)} style={{ ...inputStyle, width: 'auto', marginRight: 'auto' }}>
                <option value="all">همه وضعیت‌ها</option>
                <option value="pending">در صف</option>
                <option value="sent">ارسال‌شده</option>
                <option value="failed">ناموفق</option>
              </select>
            </div>

            <div style={{ background: 'white', borderRadius: 12, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', minWidth: 800 }}>
                <thead>
                  <tr style={{ background: '#f9fafb', fontSize: 13, color: '#6b7280' }}>
                    <th style={{ padding: 12 }}>زمان</th><th style={{ padding: 12 }}>رویداد</th><th style={{ padding: 12 }}>گیرنده</th>
                    <th style={{ padding: 12 }}>متن</th><th style={{ padding: 12 }}>وضعیت</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.length === 0 && <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>پیامکی ثبت نشده است</td></tr>}
                  {shown.map((r) => {
                    const st = statusStyle[r.status] || ['#e5e7eb', '#374151', r.status];
                    return (
                      <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
                        <td style={{ padding: 10, whiteSpace: 'nowrap', color: '#6b7280' }}>{fmtDate(r.created_at)}</td>
                        <td style={{ padding: 10 }}>{evLabel(r.event)}</td>
                        <td style={{ padding: 10, direction: 'ltr', textAlign: 'right' }}>{r.phone}</td>
                        <td style={{ padding: 10, maxWidth: 360 }}>{r.event === 'invoice_confirm_code' ? 'ویرا: کد تأیید فاکتور ****** (مخفی)' : r.message}</td>
                        <td style={{ padding: 10 }}>
                          <span style={badge(st[0], st[1])}>{st[2]}</span>
                          {r.error && <div style={{ color: '#b91c1c', fontSize: 11, marginTop: 4 }}>{r.error}</div>}
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
    </main>
  );
}
