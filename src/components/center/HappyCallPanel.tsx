'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Modal, Field, inputStyle, btn } from '@/components/admin/ui';

const money = (n: any) => Number(n || 0).toLocaleString('fa-IR');

/**
 * هپی‌کال: سرپرست مرکز (یا ادمین/مالی) بعد از تماس با مشتری، تأیید فاکتور، امتیاز رضایت و
 * دریافت مبلغ را به‌جای مشتری ثبت می‌کند. برای درخواست‌هایی است که مشتری حساب کاربری ندارد.
 */
export default function HappyCallPanel({ requestId, requestNo, onDone }: { requestId: string; requestNo?: number | string | null; onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  const [inv, setInv] = useState<any | null | undefined>(undefined);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [approved, setApproved] = useState(false);
  const [code, setCode] = useState('');
  const [rating, setRating] = useState('');
  const [feedback, setFeedback] = useState('');
  const [paid, setPaid] = useState(false);
  const [note, setNote] = useState('');

  async function openModal() {
    setOpen(true); setErr(''); setInv(undefined);
    const r = await supabase.rpc('center_invoice_view', { p_request: requestId });
    if (r.error) { setErr(r.error.message); setInv(null); return; }
    setInv(r.data || null);
    setApproved(false); setCode(''); setRating(''); setFeedback(''); setPaid(false); setNote('');
  }

  async function save() {
    setBusy(true); setErr('');
    const r = await supabase.rpc('center_record_happy_call', {
      p_request: requestId, p_approved: approved, p_rating: rating ? Number(rating) : null,
      p_feedback: feedback.trim() || null, p_paid: paid, p_note: note.trim() || null, p_code: code.trim() || null,
    });
    setBusy(false);
    if (r.error) { setErr(r.error.message); return; }
    const d: any = r.data || {};
    if (d.ok === false) { setErr(d.message || 'ناموفق'); return; }
    setOpen(false);
    if (onDone) onDone();
    alert('نتیجه‌ی هپی‌کال ثبت شد.');
  }

  async function resend() {
    if (!inv) return;
    setBusy(true); setErr('');
    const r = await supabase.rpc('invoice_resend_code', { p_invoice: inv.id });
    setBusy(false);
    if (r.error) { setErr(r.error.message); return; }
    const d: any = r.data || {};
    if (d.ok === false) { setErr(d.message || 'ناموفق'); return; }
    alert('کد جدید به شماره‌ی مشتری پیامک شد.');
  }

  const FLAGS: Record<string, string> = {
    phone_is_technician: 'شماره‌ی مشتری با شماره‌ی یک تکنسین یکی است',
    phone_is_staff: 'شماره‌ی مشتری با شماره‌ی سرپرست/ادمین/فروشنده یکی است',
    phone_unregistered: 'شماره‌ی مشتری در سامانه سابقه ندارد',
    phone_repeat_technician: 'این شماره چند بار برای همین تکنسین ثبت شده',
    phone_invalid: 'شماره‌ی مشتری نامعتبر است',
  };
  const flags: string[] = (inv && inv.risk_flags) || [];
  const issued = inv && inv.status === 'issued';
  const hasRating = inv && inv.rating !== null && inv.rating !== undefined;

  return (
    <>
      <button onClick={openModal} style={btn('#0d9488')}>هپی‌کال / فاکتور</button>
      {open && (
        <Modal title={'هپی‌کال درخواست ' + (requestNo ? '#' + requestNo : '')} onClose={() => !busy && setOpen(false)} width={520}>
          {inv === undefined && <p style={{ fontSize: 13 }}>در حال بارگذاری...</p>}
          {inv === null && !err && <p style={{ fontSize: 13, color: '#92400e' }}>برای این درخواست هنوز فاکتوری صادر نشده است.</p>}
          {inv && (
            <>
              <div style={{ background: '#f9fafb', borderRadius: 10, padding: 12, fontSize: 13, lineHeight: 2 }}>
                مبلغ کل: <b>{money(inv.total_amount)}</b> تومان (قطعات {money(inv.parts_cost)} · دستمزد {money(inv.labor_cost)} · ایاب‌وذهاب {money(inv.transport_cost)})<br />
                وضعیت: <b>{issued ? 'در انتظار تأیید مشتری' : inv.status === 'customer_approved' ? 'تأیید شده توسط مشتری' : inv.status}</b>
                {' · '}پرداخت مشتری: <b>{inv.payment_status === 'paid' ? 'انجام شده' : 'ثبت نشده'}</b>
                {hasRating && <> · امتیاز: <b>{inv.rating} از ۵</b></>}
              </div>
              {flags.length > 0 && (
                <div style={{ background: '#fef3c7', color: '#92400e', borderRadius: 10, padding: 10, fontSize: 12, lineHeight: 1.9, marginTop: 10 }}>
                  {flags.map((f) => <div key={f}>⚠ {FLAGS[f] || f}</div>)}
                </div>
              )}
              {inv.approved_via === 'exception' && <p style={{ fontSize: 12, color: '#92400e', marginTop: 8 }}>این فاکتور با تأیید استثنایی (بدون کد مشتری) ثبت شده است.</p>}
              {issued && (
                <div style={{ marginTop: 12, border: '1px solid #bfdbfe', borderRadius: 10, padding: 12 }}>
                  <b style={{ fontSize: 13, color: '#1e3a8a' }}>تأیید مشتری</b>
                  <p style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.9, margin: '4px 0 8px' }}>
                    یک کد ۶ رقمی به شماره‌ی مشتری پیامک شده است. در تماس، کد را از خود مشتری بپرسید و وارد کنید.
                    {inv.confirmation && inv.confirmation.test_code && <b style={{ color: '#0f766e' }}> (شماره‌ی آزمایشی؛ کد: {inv.confirmation.test_code})</b>}
                  </p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input value={code} onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} placeholder="کد مشتری" inputMode="numeric" style={{ ...inputStyle, width: 140, textAlign: 'center', letterSpacing: 3 }} />
                    <button onClick={resend} disabled={busy} style={btn('#e5e7eb', '#374151')}>ارسال مجدد کد</button>
                  </div>
                  {!code && (
                    <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, marginTop: 10, cursor: 'pointer', color: '#92400e' }}>
                      <input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} />
                      تأیید استثنایی بدون کد (فقط در موارد خاص؛ ثبت دلیل در «یادداشت تماس» الزامی است و برای مالی علامت می‌خورد)
                    </label>
                  )}
                </div>
              )}
              {!hasRating && (
                <>
                  <Field label="امتیاز رضایت مشتری">
                    <select value={rating} onChange={(e) => setRating(e.target.value)} style={inputStyle}>
                      <option value="">— ثبت نشود —</option>
                      {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} از ۵</option>)}
                    </select>
                  </Field>
                  <Field label="نظر مشتری"><textarea rows={2} value={feedback} onChange={(e) => setFeedback(e.target.value)} style={inputStyle} /></Field>
                </>
              )}
              {inv.payment_status !== 'paid' && (
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginTop: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
                  مبلغ از مشتری دریافت شد
                </label>
              )}
              <Field label={issued && !code && approved ? 'دلیل تأیید استثنایی *' : 'یادداشت تماس'}><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثلاً: با مشتری تماس گرفتم و راضی بود" style={inputStyle} /></Field>
            </>
          )}
          {err && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 10 }}>{err}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button onClick={() => setOpen(false)} disabled={busy} style={{ ...btn('#e5e7eb', '#374151'), padding: '8px 18px', fontSize: 13 }}>بستن</button>
            {inv && <button onClick={save} disabled={busy} style={{ ...btn('#16a34a'), padding: '8px 18px', fontSize: 13, opacity: busy ? 0.6 : 1 }}>{busy ? 'در حال ثبت...' : 'ثبت نتیجه'}</button>}
          </div>
        </Modal>
      )}
    </>
  );
}
