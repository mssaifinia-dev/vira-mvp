'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { downloadCsv } from '@/components/admin/ui';

type Summary = {
  invoice_count: number; gross_total: number; subtotal_total: number; vat_total: number; company_share_total: number;
  net_total: number; confirmed_total: number; awaiting_customer: number; awaiting_finance: number; pending_payout: number; paid_total: number;
};

const money = (n: number | string | null | undefined) => Number(n || 0).toLocaleString('fa-IR');
const statusLabel: Record<string, [string, string, string]> = {
  issued: ['در انتظار تأیید مشتری', '#fef3c7', '#d97706'],
  customer_approved: ['در انتظار بررسی مالی', '#dbeafe', '#1d4ed8'],
  finance_approved: ['تأیید مالی · در انتظار پرداخت', '#e0e7ff', '#3730a3'],
  paid: ['تسویه‌شده', '#d1fae5', '#065f46'],
  void: ['باطل', '#e5e7eb', '#4b5563'],
};
const card = { background: 'white', borderRadius: '14px', padding: '18px', marginBottom: '16px' } as const;
const input = { width: '100%', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: '8px', padding: '8px 10px', fontSize: '14px' } as const;

export default function TechnicianFinancePage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [bank, setBank] = useState<any | null>(null);
  const [iban, setIban] = useState('');
  const [holder, setHolder] = useState('');
  const [bankName, setBankName] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    const userRes = await supabase.auth.getUser();
    const user = userRes.data.user;
    if (!user) { window.location.href = '/auth'; return; }
    const [s, inv, b] = await Promise.all([
      supabase.rpc('technician_finance_summary'),
      supabase.from('invoices').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('technician_bank_accounts').select('*').maybeSingle(),
    ]);
    if (s.error) { if (/function|schema cache/i.test(s.error.message)) setMissing(true); else setMsg({ ok: false, text: s.error.message }); }
    else setSummary(s.data as Summary);
    setInvoices(((inv.data as any[]) || []).filter((x) => true));
    if (b.data) { setBank(b.data); setHolder(b.data.holder_name || ''); setBankName(b.data.bank_name || ''); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function requestPayout() {
    setMsg(null);
    const res = await supabase.rpc('technician_request_payout');
    if (res.error) { setMsg({ ok: false, text: res.error.message }); return; }
    setMsg({ ok: true, text: 'درخواست دریافت وجه برای ' + Number(res.data || 0).toLocaleString('fa-IR') + ' فاکتور ثبت شد و در صف مالی قرار گرفت.' });
    load();
  }

  async function saveBank() {
    setMsg(null);
    const res = await supabase.rpc('technician_set_bank_account', { p_iban: iban.trim(), p_holder: holder.trim(), p_bank: bankName.trim() || null });
    if (res.error) { setMsg({ ok: false, text: res.error.message }); return; }
    setMsg({ ok: true, text: 'اطلاعات حساب ذخیره شد.' });
    setIban('');
    load();
  }

  function exportCsv() {
    const rows: (string | number)[][] = [['شماره فاکتور', 'تاریخ', 'جمع ردیف‌ها', 'ارزش افزوده', 'مبلغ نهایی', 'کسورات', 'خالص', 'وضعیت', 'پیگیری پرداخت']];
    invoices.forEach((i) => rows.push([i.invoice_no || '', new Date(i.issued_at || i.created_at).toLocaleDateString('fa-IR'), i.subtotal ?? '', i.vat_amount ?? '', i.total_amount, (Number(i.total_amount) - Number(i.net_payable ?? i.technician_payout)), i.net_payable ?? i.technician_payout, (statusLabel[i.status] || [i.status])[0], i.payout_ref || '']));
    downloadCsv('vira-technician-settlements.csv', rows);
  }

  const stat = (label: string, value: number | undefined, color = '#1e3a8a') => (
    <div style={{ flex: 1, minWidth: 150, background: '#f9fafb', borderRadius: 12, padding: 12, textAlign: 'center' }}>
      <div style={{ fontWeight: 'bold', color, fontSize: 15 }}>{money(value)} <span style={{ fontSize: 11 }}>تومان</span></div>
      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{label}</div>
    </div>
  );

  return (
    <main style={{ minHeight: '100vh', background: '#f3f4f6', padding: '32px 16px' }} dir="rtl">
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <h1 style={{ fontSize: 22, fontWeight: 'bold', color: '#1e3a8a', margin: 0 }}>گزارش مالی و تسویه</h1>
          <a href="/technician/dashboard" style={{ color: '#1e3a8a', fontSize: 14 }}>← بازگشت به داشبورد</a>
        </div>

        {missing && <div style={{ background: '#fef3c7', color: '#92400e', borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 14 }}>بخش مالی هنوز فعال نشده است (فایل 07_stage6_finance.sql).</div>}
        {msg && <div style={{ background: msg.ok ? '#d1fae5' : '#fee2e2', color: msg.ok ? '#065f46' : '#b91c1c', borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 14 }}>{msg.text}</div>}

        {summary && (
          <div style={card}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {stat('درآمد کل (مبلغ فاکتورها)', summary.gross_total)}
              {stat('فاکتورهای تأییدشده', summary.confirmed_total)}
              {stat('کسورات و سهم شرکت', Number(summary.gross_total) - Number(summary.net_total), '#dc2626')}
              {stat('خالص کل', summary.net_total, '#16a34a')}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
              {stat('در انتظار تأیید مشتری', summary.awaiting_customer, '#d97706')}
              {stat('در انتظار بررسی مالی', summary.awaiting_finance, '#1d4ed8')}
              {stat('در انتظار پرداخت', summary.pending_payout, '#3730a3')}
              {stat('پرداخت‌شده', summary.paid_total, '#065f46')}
            </div>
            <p style={{ fontSize: 12, color: '#6b7280', marginTop: 10 }}>سهم شرکت: {money(summary.company_share_total)} تومان · ارزش افزوده‌ی فاکتورها: {money(summary.vat_total)} تومان</p>
            {invoices.some((x: any) => x.status === 'finance_approved' && x.payout_status === 'pending') && (
              <div style={{ marginTop: 12 }}>
                {invoices.some((x: any) => x.status === 'finance_approved' && x.payout_status === 'pending' && !x.payout_requested_at) ? (
                  <button onClick={requestPayout} style={{ background: '#16a34a', color: 'white', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontSize: 14 }}>درخواست دریافت وجه</button>
                ) : (
                  <span style={{ fontSize: 13, color: '#92400e' }}>درخواست دریافت وجه شما ثبت شده و در انتظار واریز توسط مالی است.</span>
                )}
              </div>
            )}
          </div>
        )}

        <div style={card}>
          <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>حساب بانکی برای واریز</h3>
          {bank ? (
            <p style={{ fontSize: 13, color: '#065f46', marginBottom: 10 }}>شبای ثبت‌شده: IR••••••••••••••••••••{String(bank.iban).slice(-4)} · {bank.holder_name}{bank.bank_name ? ' · ' + bank.bank_name : ''}</p>
          ) : (
            <p style={{ fontSize: 13, color: '#b45309', marginBottom: 10 }}>هنوز شبا ثبت نشده است؛ بدون آن پرداخت انجام نمی‌شود.</p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
            <input dir="ltr" value={iban} onChange={(e) => setIban(e.target.value)} placeholder="IR000000000000000000000000" style={input} />
            <input value={holder} onChange={(e) => setHolder(e.target.value)} placeholder="نام صاحب حساب" style={input} />
            <input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="نام بانک (اختیاری)" style={input} />
          </div>
          <button onClick={saveBank} style={{ marginTop: 10, background: '#1e3a8a', color: 'white', border: 'none', borderRadius: 8, padding: '9px 18px', cursor: 'pointer', fontSize: 13 }}>ذخیره‌ی حساب</button>
          <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>اطلاعات بانکی فقط برای شما و مدیر مالی مجاز قابل مشاهده است.</p>
        </div>

        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>تاریخچه‌ی فاکتورها و تسویه</h3>
            <button onClick={exportCsv} style={{ background: '#16a34a', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}>CSV</button>
          </div>
          {loading ? <p style={{ color: '#6b7280' }}>در حال بارگذاری...</p> : invoices.length === 0 ? <p style={{ color: '#9ca3af', fontSize: 13 }}>فاکتوری ثبت نشده است.</p> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'right', minWidth: 640 }}>
                <thead><tr style={{ background: '#f3f4f6' }}><th style={{ padding: 8 }}>شماره</th><th style={{ padding: 8 }}>تاریخ</th><th style={{ padding: 8 }}>مبلغ نهایی</th><th style={{ padding: 8 }}>خالص</th><th style={{ padding: 8 }}>وضعیت</th><th style={{ padding: 8 }}>پیگیری</th><th style={{ padding: 8 }} /></tr></thead>
                <tbody>
                  {invoices.map((i) => {
                    const [lbl, bg, fg] = statusLabel[i.status] || [i.status, '#f3f4f6', '#6b7280'];
                    return (
                      <tr key={i.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: 8 }}>{i.invoice_no ? '#' + Number(i.invoice_no).toLocaleString('fa-IR') : '—'}</td>
                        <td style={{ padding: 8 }}>{new Date(i.issued_at || i.created_at).toLocaleDateString('fa-IR')}</td>
                        <td style={{ padding: 8 }}>{money(i.total_amount)}</td>
                        <td style={{ padding: 8, color: '#16a34a', fontWeight: 'bold' }}>{money(i.net_payable ?? i.technician_payout)}</td>
                        <td style={{ padding: 8 }}><span style={{ background: bg, color: fg, borderRadius: 6, padding: '3px 8px', fontSize: 12 }}>{lbl}</span></td>
                        <td style={{ padding: 8, fontSize: 12 }}>{i.payout_ref || '—'}</td>
                        <td style={{ padding: 8 }}><a href={'/technician/invoice/' + i.request_id} style={{ color: '#1e3a8a' }}>مشاهده</a></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
