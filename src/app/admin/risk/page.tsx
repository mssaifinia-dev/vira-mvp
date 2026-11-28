'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { badge, btn, fmtDate, inputStyle, useToast } from '@/components/admin/ui';

const FLAGS: Record<string, string> = {
  phone_is_technician: 'شماره = تکنسین', phone_is_staff: 'شماره = کارمند/سرپرست', phone_unregistered: 'شماره‌ی جدید',
  phone_repeat_technician: 'شماره‌ی تکراری برای تکنسین', phone_invalid: 'شماره نامعتبر',
};

export default function RiskPage() {
  const toast = useToast();
  const [days, setDays] = useState(90);
  const [report, setReport] = useState<any | null>(null);
  const [err, setErr] = useState('');
  const [percent, setPercent] = useState(10);
  const [sampleDays, setSampleDays] = useState(30);
  const [sample, setSample] = useState<any[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const loadReport = useCallback(async () => {
    setErr('');
    const r = await supabase.rpc('admin_fraud_report', { p_days: days });
    if (r.error) { setErr(r.error.message); setReport(null); return; }
    setReport(r.data);
  }, [days]);

  useEffect(() => { loadReport(); }, [loadReport]);

  async function makeSample() {
    const r = await supabase.rpc('admin_audit_sample', { p_percent: percent, p_days: sampleDays });
    if (r.error) { toast.show('err', r.error.message); return; }
    setSample((r.data as any[]) || []);
    if (((r.data as any[]) || []).length === 0) toast.show('ok', 'فاکتوری برای بازبینی در این بازه نیست.');
  }

  async function mark(id: string, result: string) {
    const r = await supabase.rpc('admin_audit_mark', { p_invoice: id, p_result: result, p_note: notes[id] || null });
    if (r.error) { toast.show('err', r.error.message); return; }
    setSample((p) => p.filter((x) => x.invoice_id !== id));
    toast.show('ok', 'نتیجه‌ی بازبینی ثبت شد.');
    loadReport();
  }

  const th = { padding: 10 } as const;
  return (
    <main style={{ minHeight: '100vh', background: '#f3f4f6', padding: '32px 16px' }} dir="rtl">
      {toast.node}
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 'bold', color: '#1e3a8a' }}>ریسک فاکتورها و بازبینی نمونه‌ای</h1>
          <a href="/admin" style={{ color: '#1e3a8a', fontSize: 14, textDecoration: 'none' }}>← بازگشت به پنل اصلی</a>
        </div>

        {err && <div style={{ background: '#fee2e2', color: '#991b1b', borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 14 }}>{err}</div>}

        <div style={{ background: 'white', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
            <b style={{ fontSize: 15 }}>گزارش ناهنجاری تکنسین‌ها</b>
            <span style={{ fontSize: 13 }}>بازه:</span>
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} style={{ ...inputStyle, width: 'auto' }}>
              {[30, 60, 90, 180, 365].map((d) => <option key={d} value={d}>{d} روز اخیر</option>)}
            </select>
          </div>
          <p style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.9, marginBottom: 10 }}>
            امتیاز خطر = (تعداد تأیید استثنایی × ۲) + (فاکتورهای علامت‌دار) + (بازبینی‌های مشکوک × ۵). امتیاز بالا یعنی «باید بررسی شود»، نه اینکه تقلبی ثابت شده است.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', minWidth: 760 }}>
              <thead><tr style={{ background: '#f9fafb', fontSize: 13, color: '#6b7280' }}>
                <th style={th}>تکنسین</th><th style={th}>فاکتور</th><th style={th}>استثنایی</th><th style={th}>٪ استثنایی</th><th style={th}>میانگین امتیاز</th><th style={th}>٪ پنج‌ستاره</th><th style={th}>علامت‌دار</th><th style={th}>مشکوک (بازبینی)</th><th style={th}>امتیاز خطر</th>
              </tr></thead>
              <tbody>
                {(report?.technicians || []).length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>داده‌ای نیست</td></tr>}
                {(report?.technicians || []).map((t: any) => (
                  <tr key={t.technician_id} style={{ borderBottom: '1px solid #f3f4f6', fontSize: 13, background: Number(t.score) >= 6 ? '#fff7ed' : undefined }}>
                    <td style={th}>{t.name}</td><td style={th}>{t.invoices}</td><td style={th}>{t.exceptions}</td>
                    <td style={th}>{t.exception_pct ?? '—'}</td><td style={th}>{t.avg_rating ?? '—'}</td><td style={th}>{t.five_star_pct ?? '—'}</td>
                    <td style={th}>{t.flagged}</td><td style={th}>{t.suspicious_audits}</td>
                    <td style={th}><span style={badge(Number(t.score) >= 6 ? '#fee2e2' : '#e5e7eb', Number(t.score) >= 6 ? '#991b1b' : '#374151')}>{t.score}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(report?.pairs || []).length > 0 && (
            <div style={{ marginTop: 14, fontSize: 13 }}>
              <b>جفت‌های سرپرست و تکنسین با تأیید استثنایی تکراری (۲ بار یا بیشتر):</b>
              {(report.pairs as any[]).map((p, i) => <div key={i}>• سرپرست {p.phone || '—'} ↔ {p.technician}: {p.exceptions} بار</div>)}
            </div>
          )}
          {(report?.approvers || []).length > 0 && (
            <div style={{ marginTop: 10, fontSize: 13 }}>
              <b>ثبت‌کنندگان تأیید استثنایی:</b>
              {(report.approvers as any[]).map((a, i) => <div key={i}>• {a.phone || a.user_id}: {a.exceptions} بار</div>)}
            </div>
          )}
        </div>

        <div style={{ background: 'white', borderRadius: 12, padding: 16 }}>
          <b style={{ fontSize: 15 }}>بازبینی نمونه‌ای (تماس مجدد با مشتری)</b>
          <p style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.9, margin: '6px 0 10px' }}>
            چند درصد از فاکتورهای تأییدشده به‌صورت تصادفی انتخاب می‌شود (فاکتورهای استثنایی و علامت‌دار اولویت دارند). با مشتری تماس بگیرید و نتیجه را ثبت کنید.
            اگر شماره‌ی ثبت‌شده مشکوک بود، با تلفن ثابتِ اشتراک یا آدرس مشتری هم تماس بگیرید.
          </p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
            <span style={{ fontSize: 13 }}>درصد نمونه:</span>
            <input type="number" min={1} max={100} value={percent} onChange={(e) => setPercent(Number(e.target.value))} style={{ ...inputStyle, width: 80 }} />
            <span style={{ fontSize: 13 }}>از فاکتورهای</span>
            <select value={sampleDays} onChange={(e) => setSampleDays(Number(e.target.value))} style={{ ...inputStyle, width: 'auto' }}>
              {[7, 30, 60, 90].map((d) => <option key={d} value={d}>{d} روز اخیر</option>)}
            </select>
            <button onClick={makeSample} style={{ ...btn('#1e3a8a'), padding: '8px 18px', fontSize: 13 }}>ساخت نمونه</button>
          </div>
          {sample.map((s) => (
            <div key={s.invoice_id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, marginBottom: 10, fontSize: 13, lineHeight: 2 }}>
              <div>
                درخواست <b>#{s.request_no}</b> · مشتری: {s.customer_name || '—'} · موبایل: <b dir="ltr">{s.phone}</b> · تکنسین: {s.technician} · مبلغ: {Number(s.total_amount).toLocaleString('fa-IR')} تومان · {fmtDate(s.issued)}
              </div>
              <div>
                روش تأیید: <b>{s.approved_via === 'sms_code' ? 'کد پیامکی' : s.approved_via === 'exception' ? 'استثنایی' : s.approved_via || 'خود مشتری'}</b> · امتیاز: {s.rating ?? '—'}
                {(s.risk_flags || []).map((f: string) => <span key={f} style={{ ...badge('#fef3c7', '#92400e'), marginRight: 6 }}>{FLAGS[f] || f}</span>)}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <input placeholder="یادداشت تماس" value={notes[s.invoice_id] || ''} onChange={(e) => setNotes({ ...notes, [s.invoice_id]: e.target.value })} style={{ ...inputStyle, flex: 1, minWidth: 200, width: 'auto' }} />
                <button onClick={() => mark(s.invoice_id, 'ok')} style={btn('#16a34a')}>تأیید شد</button>
                <button onClick={() => mark(s.invoice_id, 'suspicious')} style={btn('#dc2626')}>مشکوک</button>
                <button onClick={() => mark(s.invoice_id, 'unreachable')} style={btn('#6b7280')}>در دسترس نبود</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
