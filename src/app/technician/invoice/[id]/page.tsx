'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type Req = { id: string; description: string | null; address: string; technician_id: string | null; status: string; request_no?: number | null };
type PriceItem = { id: string; code: string | null; title: string; unit: string; unit_price: number };
type Line = { key: number; service_item_id: string; name: string; unit_price: string; quantity: string };
type Calc = {
  lines: { title: string; unit: string; quantity: number; unit_price: number; line_total: number; is_custom: boolean }[];
  subtotal: number; vat_percent: number; vat_amount: number; total: number;
  deductions: { name: string; kind: string; rate_percent: number; basis: string; amount: number }[];
  deductions_total: number; net_payable: number;
};

const money = (n: number | string | null | undefined) => Number(n || 0).toLocaleString('fa-IR');
const basisLabel: Record<string, string> = { subtotal: 'جمع ردیف‌ها', vat_amount: 'ارزش افزوده', total_with_vat: 'مبلغ نهایی' };
const statusLabel: Record<string, string> = {
  issued: 'در انتظار تأیید مشتری',
  customer_approved: 'تأیید مشتری · در انتظار بررسی مالی',
  finance_approved: 'تأیید مالی · در انتظار پرداخت',
  paid: 'تسویه‌شده',
  void: 'باطل',
};
const card = { background: 'white', borderRadius: '16px', padding: '24px', marginBottom: '16px' } as const;
const input = { width: '100%', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: '8px', padding: '8px 10px', fontSize: '14px' } as const;

let keySeq = 1;
const newLine = (): Line => ({ key: keySeq++, service_item_id: '', name: '', unit_price: '', quantity: '1' });

export default function InvoicePage() {
  const { id } = useParams();
  const [request, setRequest] = useState<Req | null>(null);
  const [prices, setPrices] = useState<PriceItem[]>([]);
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [customKeys, setCustomKeys] = useState<number[]>([]);
  const [calc, setCalc] = useState<Calc | null>(null);
  const [calcError, setCalcError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [existing, setExisting] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showPayout, setShowPayout] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    (async () => {
      const [req, inv, pr] = await Promise.all([
        supabase.from('service_requests').select('*').eq('id', id).single(),
        supabase.from('invoices').select('*').eq('request_id', id).maybeSingle(),
        supabase.from('service_price_items').select('id,code,title,unit,unit_price').eq('is_active', true).order('sort_order').order('title'),
      ]);
      setRequest(req.data as Req);
      setPrices((pr.data as PriceItem[]) || []);
      if (inv.data) {
        const mineId = await supabase.rpc('my_technician_id');
        setShowPayout(!!mineId.data && mineId.data === inv.data.technician_id);
        setExisting(inv.data);
        const it = await supabase.from('invoice_items').select('*').eq('invoice_id', inv.data.id);
        setItems(it.data || []);
      }
      setLoaded(true);
    })();
  }, [id]);

  const payloadLines = useMemo(
    () =>
      lines
        .filter((l) => (customKeys.includes(l.key) ? l.name.trim() && Number(l.unit_price) > 0 : !!l.service_item_id))
        .map((l) =>
          customKeys.includes(l.key)
            ? { name: l.name.trim(), unit_price: Number(l.unit_price), quantity: Number(l.quantity) || 1 }
            : { service_item_id: l.service_item_id, quantity: Number(l.quantity) || 1 }
        ),
    [lines, customKeys]
  );

  // پیش‌نمایش با محاسبه‌ی خود سرور (همان فرمول نهایی)
  useEffect(() => {
    if (existing || payloadLines.length === 0) { setCalc(null); setCalcError(''); return; }
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      const res = await supabase.rpc('technician_preview_invoice', { p_lines: payloadLines, p_request: id });
      if (mine !== seq.current) return;
      if (res.error) { setCalc(null); setCalcError(res.error.message); } else { setCalc(res.data as Calc); setCalcError(''); }
    }, 350);
    return () => clearTimeout(t);
  }, [payloadLines, existing]);

  function addLine(kind: 'service' | 'custom') {
    const l = newLine();
    setLines((p) => [...p, l]);
    if (kind === 'custom') setCustomKeys((p) => [...p, l.key]);
  }
  function removeLine(key: number) {
    setLines((p) => (p.length > 1 ? p.filter((l) => l.key !== key) : p));
    setCustomKeys((p) => p.filter((k) => k !== key));
  }
  const patchLine = (key: number, patch: Partial<Line>) => setLines((p) => p.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  async function submit() {
    setError('');
    if (payloadLines.length === 0) return setError('حداقل یک ردیف خدمت یا قطعه‌ی کامل وارد کنید');
    if (calcError) return setError(calcError);
    if (!confirm('فاکتور صادر و کار تکمیل می‌شود و بعد از آن قابل ویرایش نیست. ادامه می‌دهید؟')) return;
    setSubmitting(true);
    const res = await supabase.rpc('technician_issue_invoice', { p_request: id, p_lines: payloadLines });
    setSubmitting(false);
    if (res.error) { setError(res.error.message); return; }
    window.location.reload();
  }

  if (!loaded || !request) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#1e3a8a' }}>در حال بارگذاری...</p>
      </main>
    );
  }

  // ---------- فاکتور صادرشده (فقط‌خواندنی) ----------
  if (existing) {
    const ded: any[] = Array.isArray(existing.deductions) ? existing.deductions : [];
    return (
      <main style={{ minHeight: '100vh', background: '#f3f4f6', padding: '32px 16px' }} dir="rtl">
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #1e3a8a', paddingBottom: 12, marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, color: '#1e3a8a', fontSize: 18 }}>فاکتور خدمات {existing.invoice_no ? '#' + Number(existing.invoice_no).toLocaleString('fa-IR') : ''}</h2>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>{new Date(existing.issued_at || existing.created_at).toLocaleDateString('fa-IR')}</p>
              </div>
              <span style={{ background: '#e0e7ff', color: '#3730a3', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 'bold' }}>{statusLabel[existing.status] || existing.status}</span>
            </div>

            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse', textAlign: 'right' }}>
              <thead><tr style={{ background: '#f3f4f6' }}><th style={{ padding: 6 }}>شرح</th><th style={{ padding: 6 }}>تعداد</th><th style={{ padding: 6 }}>قیمت واحد</th><th style={{ padding: 6 }}>مبلغ</th></tr></thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: 6 }}>{it.item_name}</td>
                    <td style={{ padding: 6 }}>{money(it.quantity)}</td>
                    <td style={{ padding: 6 }}>{it.unit_price != null ? money(it.unit_price) : '—'}</td>
                    <td style={{ padding: 6 }}>{money(it.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: 14, fontSize: 14, lineHeight: 2 }}>
              <Row l="جمع ردیف‌ها" v={money(existing.subtotal ?? (Number(existing.parts_cost || 0) + Number(existing.labor_cost || 0) + Number(existing.transport_cost || 0)))} />
              <Row l={'ارزش افزوده' + (existing.vat_percent != null ? ' (' + money(existing.vat_percent) + '٪)' : '')} v={money(existing.vat_amount)} />
              <Row l="مبلغ نهایی فاکتور" v={money(existing.total_amount)} bold />
              {showPayout && (ded.length > 0 ? ded.map((d, i) => (
                <Row key={i} l={d.name + ' (' + money(d.rate_percent) + '٪ از ' + (basisLabel[d.basis] || d.basis) + ')'} v={'− ' + money(d.amount)} color="#dc2626" />
              )) : <Row l="سهم شرکت" v={'− ' + money(existing.commission_amount)} color="#dc2626" />)}
              {showPayout && <Row l="خالص قابل پرداخت به شما" v={money(existing.net_payable ?? existing.technician_payout) + ' تومان'} bold color="#16a34a" />}
              {showPayout && <Row l="وضعیت پرداخت به شما" v={existing.payout_status === 'paid' ? 'پرداخت شد · پیگیری ' + (existing.payout_ref || '') : existing.payout_status === 'failed' ? 'پرداخت ناموفق؛ در حال بررسی' : 'در انتظار تسویه'} />}
            </div>
            <p style={{ fontSize: 12, color: '#6b7280', marginTop: 12 }}>نرخ‌ها هنگام صدور فاکتور ثبت شده‌اند و تغییر بعدی نرخ‌ها روی این فاکتور اثری ندارد.</p>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <a href="/technician/dashboard" style={{ color: '#1e3a8a', fontSize: 14 }}>← بازگشت به داشبورد</a>
            <a href="/technician/finance" style={{ color: '#1e3a8a', fontSize: 14 }}>گزارش مالی و تسویه ←</a>
          </div>
        </div>
      </main>
    );
  }

  // ---------- فرم صدور ----------
  const notIssuable = request.status !== 'accepted' && request.status !== 'in_progress';
  return (
    <main style={{ minHeight: '100vh', background: '#f3f4f6', padding: '32px 16px' }} dir="rtl">
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={card}>
          <h1 style={{ margin: 0, color: '#1e3a8a', fontSize: 20 }}>صدور فاکتور</h1>
          <p style={{ color: '#6b7280', fontSize: 13, marginTop: 8 }}>{request.description || 'بدون توضیح'} — {request.address}</p>
          {notIssuable && <p style={{ color: '#b91c1c', fontSize: 13 }}>این درخواست در وضعیت قابل صدور فاکتور نیست.</p>}
        </div>

        <div style={card}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>خدمات انجام‌شده و قطعات</h3>
          {prices.length === 0 && <p style={{ fontSize: 13, color: '#b45309' }}>فهرست بهای خدمات هنوز توسط مدیر تعریف نشده است؛ فقط ردیف قطعه/سایر ثبت می‌شود.</p>}
          {lines.map((l) => {
            const custom = customKeys.includes(l.key);
            return (
              <div key={l.key} style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px dashed #e5e7eb', paddingBottom: 10 }}>
                {custom ? (
                  <>
                    <input value={l.name} onChange={(e) => patchLine(l.key, { name: e.target.value })} placeholder="نام قطعه / مورد" style={{ ...input, flex: 2, minWidth: 140, width: 'auto' }} />
                    <input inputMode="numeric" value={l.unit_price} onChange={(e) => patchLine(l.key, { unit_price: e.target.value.replace(/[^0-9]/g, '') })} placeholder="قیمت واحد (تومان)" style={{ ...input, flex: 1, minWidth: 110, width: 'auto' }} />
                  </>
                ) : (
                  <select value={l.service_item_id} onChange={(e) => patchLine(l.key, { service_item_id: e.target.value })} style={{ ...input, flex: 3, minWidth: 200, width: 'auto' }}>
                    <option value="">انتخاب خدمت از فهرست بها...</option>
                    {prices.map((p) => <option key={p.id} value={p.id}>{p.title} — {money(p.unit_price)} تومان / {p.unit}</option>)}
                  </select>
                )}
                <input inputMode="decimal" value={l.quantity} onChange={(e) => patchLine(l.key, { quantity: e.target.value.replace(/[^0-9.]/g, '') })} style={{ ...input, width: 70 }} aria-label="تعداد" />
                <button onClick={() => removeLine(l.key)} disabled={lines.length === 1} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>✕</button>
              </div>
            );
          })}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => addLine('service')} style={{ background: '#e0e7ff', color: '#1e3a8a', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13 }}>+ خدمت</button>
            <button onClick={() => addLine('custom')} style={{ background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13 }}>+ قطعه / سایر</button>
          </div>
        </div>

        <div style={card}>
          <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>خلاصه‌ی محاسبه (محاسبه‌ی سرور)</h3>
          {calcError && <p style={{ color: '#dc2626', fontSize: 13 }}>{calcError}</p>}
          {!calc && !calcError && <p style={{ fontSize: 13, color: '#9ca3af' }}>ردیف‌ها را کامل کنید تا مبالغ نمایش داده شود.</p>}
          {calc && (
            <div style={{ fontSize: 14, lineHeight: 2 }}>
              <Row l="جمع ردیف‌ها" v={money(calc.subtotal)} />
              <Row l={'ارزش افزوده (' + money(calc.vat_percent) + '٪)'} v={money(calc.vat_amount)} />
              <Row l="مبلغ نهایی فاکتور" v={money(calc.total)} bold />
              {calc.deductions.map((d, i) => <Row key={i} l={d.name + ' (' + money(d.rate_percent) + '٪ از ' + (basisLabel[d.basis] || d.basis) + ')'} v={'− ' + money(d.amount)} color="#dc2626" />)}
              <Row l="خالص قابل پرداخت به شما" v={money(calc.net_payable) + ' تومان'} bold color="#16a34a" />
            </div>
          )}
        </div>

        {error && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 8 }}>{error}</p>}
        <button onClick={submit} disabled={submitting || !calc || notIssuable} style={{ width: '100%', background: '#1e3a8a', color: 'white', border: 'none', borderRadius: 12, padding: 14, fontSize: 15, fontWeight: 'bold', cursor: 'pointer', opacity: submitting || !calc || notIssuable ? 0.5 : 1 }}>
          {submitting ? 'در حال صدور...' : 'صدور فاکتور و تکمیل کار'}
        </button>
        <p style={{ textAlign: 'center', marginTop: 12 }}><a href="/technician/dashboard" style={{ color: '#6b7280', fontSize: 13 }}>انصراف و بازگشت</a></p>
      </div>
    </main>
  );
}

function Row({ l, v, bold, color }: { l: string; v: string; bold?: boolean; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontWeight: bold ? 'bold' : 'normal', color: color || '#374151' }}>
      <span>{l}</span>
      <span>{v}</span>
    </div>
  );
}
