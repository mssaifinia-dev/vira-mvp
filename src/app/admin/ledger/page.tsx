'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { adminRpc, adminFetch } from '@/lib/adminRpc';
import { can } from '@/lib/permissions';
import { useMyPerms } from '@/lib/useMyPerms';
import { Field, Modal, ReasonModal, badge, btn, downloadCsv, fmtDate, inputStyle, useToast } from '@/components/admin/ui';

const money = (n: number | string | null | undefined) => Number(n || 0).toLocaleString('fa-IR');
const compLabel: Record<string, string> = {
  company_commission: 'پورسانت شرکت', intermediary_commission: 'پورسانت واسطه', partner_commission: 'سهم شریک تجاری', insurance: 'بیمه', tax: 'مالیات',
  vat_remit: 'ارزش افزوده', fee: 'سایر کارمزد', remainder_share: 'سهم از مانده', payee_net: 'مانده‌ی ذی‌نفع', reversal: 'سند برگشتی',
};
const kindLabel: Record<string, string> = { company: 'شرکت', technician: 'تکنسین', seller: 'فروشنده', intermediary: 'واسطه', partner: 'شریک', insurance: 'بیمه', tax_authority: 'مالیات', other: 'سایر' };
const statusInfo: Record<string, [string, string, string]> = {
  pending: ['در انتظار شرایط', '#fef3c7', '#d97706'],
  payable: ['آماده‌ی پرداخت', '#dbeafe', '#1d4ed8'],
  retained: ['درآمد شرکت', '#ede9fe', '#6d28d9'],
  paid: ['پرداخت‌شده', '#d1fae5', '#065f46'],
  void: ['باطل', '#e5e7eb', '#4b5563'],
};
const srcLabel: Record<string, string> = { service_invoice: 'فاکتور خدمات', shop_order: 'سفارش فروشگاه' };

type Tab = 'entries' | 'payouts' | 'tax';

export default function LedgerPage() {
  const toast = useToast();
  const mine = useMyPerms();
  const [tab, setTab] = useState<Tab>('entries');
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [entries, setEntries] = useState<any[]>([]);
  const [parties, setParties] = useState<Record<string, any>>({});
  const [payouts, setPayouts] = useState<any[]>([]);

  const [statusF, setStatusF] = useState('all');
  const [partyF, setPartyF] = useState('all');
  const [srcF, setSrcF] = useState('all');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [picked, setPicked] = useState<string[]>([]);

  const [payOpen, setPayOpen] = useState(false);
  const [autoBusy, setAutoBusy] = useState(false);
  const [payRef, setPayRef] = useState('');
  const [payNote, setPayNote] = useState('');
  const [payKey, setPayKey] = useState('');
  const [payErr, setPayErr] = useState('');
  const [payBusy, setPayBusy] = useState(false);
  const [dest, setDest] = useState<any | null>(null);
  const [revTarget, setRevTarget] = useState<any | null>(null);

  // گزارش مالیاتی
  const today = new Date().toISOString().slice(0, 10);
  const [tFrom, setTFrom] = useState(today.slice(0, 8) + '01');
  const [tTo, setTTo] = useState(today);
  const [report, setReport] = useState<any | null>(null);
  const [repBusy, setRepBusy] = useState(false);
  const [snapOpen, setSnapOpen] = useState(false);
  const [snapTitle, setSnapTitle] = useState('');
  const [snapNotes, setSnapNotes] = useState('');
  const [snaps, setSnaps] = useState<any[]>([]);
  const [snapView, setSnapView] = useState<any | null>(null);

  const canApprove = can(mine.perms, 'finance', 'approve');
  const canEdit = can(mine.perms, 'finance', 'edit');
  const canReport = can(mine.perms, 'finance', 'report');
  const canBank = can(mine.perms, 'bank', 'view');

  const load = useCallback(async () => {
    await supabase.rpc('finance_refresh_pending');
    const [e, p, po, sn] = await Promise.all([
      supabase.from('settlement_entries').select('*').order('source_date', { ascending: false }).order('created_at', { ascending: false }).limit(1500),
      supabase.from('settlement_parties').select('id,name,kind,technician_id'),
      supabase.from('settlement_payouts').select('*').order('requested_at', { ascending: false }).limit(300),
      supabase.from('tax_report_snapshots').select('id,title,period_from,period_to,row_count,totals,checksum,created_at,notes').order('created_at', { ascending: false }).limit(60),
    ]);
    if (e.error && /settlement_entries|schema cache|relation/i.test(e.error.message)) setMissing(true);
    setEntries((e.data as any[]) || []);
    const pm: Record<string, any> = {};
    ((p.data as any[]) || []).forEach((x) => (pm[x.id] = x));
    setParties(pm);
    setPayouts((po.data as any[]) || []);
    setSnaps((sn.data as any[]) || []);
    setLoading(false);
    setPicked([]);
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

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const from = fromDate ? new Date(fromDate + 'T00:00:00').getTime() : 0;
    const to = toDate ? new Date(toDate + 'T23:59:59').getTime() : Infinity;
    return entries.filter((e) => {
      if (statusF !== 'all' && e.status !== statusF) return false;
      if (partyF !== 'all' && e.party_id !== partyF) return false;
      if (srcF !== 'all' && e.source_kind !== srcF) return false;
      const ts = new Date(e.source_date).getTime();
      if (ts < from || ts > to) return false;
      if (!term) return true;
      return String(e.source_ref || '').toLowerCase().includes(term) || (e.label || '').toLowerCase().includes(term) || (e.party_name || '').toLowerCase().includes(term);
    });
  }, [entries, statusF, partyF, srcF, search, fromDate, toDate]);

  const summary = useMemo(() => {
    const m: Record<string, { name: string; kind: string; payable: number; paid: number; pending: number; retained: number }> = {};
    entries.forEach((e) => {
      if (e.status === 'void') return;
      const s = (m[e.party_id] = m[e.party_id] || { name: e.party_name, kind: e.party_kind, payable: 0, paid: 0, pending: 0, retained: 0 });
      const a = Number(e.amount) || 0;
      if (e.status === 'payable') s.payable += a; else if (e.status === 'paid') s.paid += a; else if (e.status === 'pending') s.pending += a; else if (e.status === 'retained') s.retained += a;
    });
    return Object.entries(m).sort((a, b) => b[1].payable - a[1].payable);
  }, [entries]);

  const pickedRows = entries.filter((e) => picked.includes(e.id));
  const pickedParty = pickedRows.length ? pickedRows[0].party_id : null;
  const pickedTotal = pickedRows.reduce((a, e) => a + Number(e.amount), 0);
  const mixed = pickedRows.some((e) => e.party_id !== pickedParty);

  function toggle(e: any) {
    if (e.status !== 'payable' || e.payout_id) return;
    setPicked((p) => (p.includes(e.id) ? p.filter((x) => x !== e.id) : [...p, e.id]));
  }
  function pickAllForParty(partyId: string) {
    setPicked(entries.filter((e) => e.party_id === partyId && e.status === 'payable' && !e.payout_id).map((e) => e.id));
  }

  async function openPay() {
    setPayRef(''); setPayNote(''); setPayErr(''); setDest(null);
    setPayKey(typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now()) + Math.random());
    setPayOpen(true);
    if (canBank && pickedParty) {
      const p = parties[pickedParty];
      const q = p?.technician_id
        ? await supabase.from('technician_bank_accounts').select('*').eq('technician_id', p.technician_id).maybeSingle()
        : await supabase.from('settlement_party_accounts').select('*').eq('party_id', pickedParty).maybeSingle();
      setDest(q.data || null);
    }
  }

  async function submitPay() {
    if (!pickedParty) return;
    if (mixed) { setPayErr('فقط ردیف‌های یک ذی‌نفع را هم‌زمان می‌توان پرداخت کرد'); return; }
    if (payRef.trim().length < 4) { setPayErr('شماره پیگیری پرداخت را وارد کنید'); return; }
    setPayBusy(true); setPayErr('');
    const res = await supabase.rpc('finance_create_payout', { p_party: pickedParty, p_entry_ids: picked, p_method: 'manual', p_ref: payRef.trim(), p_note: payNote.trim() || null, p_key: payKey });
    setPayBusy(false);
    if (res.error) { setPayErr(res.error.message); return; }
    toast.show('ok', res.data?.duplicate ? 'این پرداخت قبلاً ثبت شده بود (تکراری ثبت نشد).' : 'پرداخت ثبت شد: ' + money(res.data?.total) + ' تومان');
    setPayOpen(false);
    load();
  }

  async function submitAutoPay() {
    if (!pickedParty) return;
    if (mixed) { setPayErr('فقط ردیف‌های یک ذی‌نفع را هم‌زمان می‌توان پرداخت کرد'); return; }
    if (!window.confirm('مبلغ ' + money(pickedTotal) + ' تومان از موجودی پنل زرین‌پال به شبای «' + (parties[pickedParty]?.name || '') + '» واریز و در دفتر تسویه ثبت شود؟\nاین کار برگشت‌پذیر نیست.')) return;
    setAutoBusy(true); setPayErr('');
    const r = await adminFetch('/api/admin/payouts/zarinpal', { party: pickedParty, entry_ids: picked, key: payKey, note: payNote.trim() });
    setAutoBusy(false);
    if (!r.ok) { setPayErr(r.error || 'ناموفق'); return; }
    if (r.data?.dry_run) { setPayErr(''); toast.show('ok', r.data.message || 'حالت آزمایشی: واریزی انجام نشد.'); return; }
    toast.show('ok', r.data?.duplicate ? 'این پرداخت قبلاً ثبت شده بود.' : 'واریز انجام و ثبت شد. شماره پیگیری: ' + (r.data?.ref || ''));
    setPayOpen(false);
    load();
  }

  async function doReverse(reason: string) {
    if (!revTarget) return;
    const r = await adminRpc('finance_reverse_entry', { p_entry: revTarget.id, p_reason: reason });
    if (!r.ok) { toast.show('err', r.error || 'ناموفق'); return; }
    toast.show('ok', 'سند برگشتی ثبت شد (با پرداخت‌های بعدی همین ذی‌نفع تهاتر می‌شود).');
    load();
  }

  function exportEntries() {
    const rows: (string | number)[][] = [['تاریخ', 'منبع', 'شماره', 'مبلغ درآمد', 'عنوان', 'نوع', 'ذی‌نفع', 'نوع ذی‌نفع', 'کد ملی', 'کد اقتصادی', 'درصد', 'مبنا', 'مبلغ سهم', 'وضعیت', 'شماره پیگیری', 'تاریخ پرداخت']];
    const refByPayout: Record<string, string> = {};
    payouts.forEach((p) => (refByPayout[p.id] = p.ref));
    filtered.forEach((e) => rows.push([e.source_date, srcLabel[e.source_kind] || e.source_kind, e.source_ref || '', e.gross_amount, e.label, compLabel[e.component] || e.component, e.party_name, kindLabel[e.party_kind] || e.party_kind, e.national_id || '', e.economic_code || '', e.rate_percent ?? '', e.basis_amount ?? '', e.amount, (statusInfo[e.status] || [e.status])[0], e.payout_id ? refByPayout[e.payout_id] || '' : '', e.paid_at ? fmtDate(e.paid_at) : '']));
    downloadCsv('vira-settlement-ledger.csv', rows);
  }

  async function runReport() {
    setRepBusy(true); setReport(null);
    const r = await supabase.rpc('finance_tax_report', { p_from: tFrom, p_to: tTo });
    setRepBusy(false);
    if (r.error) { toast.show('err', r.error.message); return; }
    setReport(r.data);
  }

  const entryRows = (list: any[]): (string | number)[][] => [
    ['تاریخ', 'منبع', 'شماره', 'مبلغ درآمد', 'عنوان', 'نوع', 'ذی‌نفع', 'نوع ذی‌نفع', 'کد ملی', 'کد اقتصادی', 'درصد', 'مبنا', 'مبلغ سهم', 'وضعیت', 'شماره پیگیری', 'تاریخ پرداخت'],
    ...list.map((e) => [e.source_date, srcLabel[e.source_kind] || e.source_kind, e.source_ref || '', e.gross_amount, e.label, compLabel[e.component] || e.component, e.party_name, kindLabel[e.party_kind] || e.party_kind, e.national_id || '', e.economic_code || '', e.rate_percent ?? '', e.basis_amount ?? '', e.amount, (statusInfo[e.status] || [e.status])[0], e.payout_ref || '', e.paid_at ? fmtDate(e.paid_at) : '']),
  ];
  const summaryRows = (list: any[]): (string | number)[][] => [
    ['ذی‌نفع', 'نوع', 'کد ملی', 'کد اقتصادی', 'نوع سهم', 'تعداد', 'جمع', 'پرداخت‌شده', 'آماده‌ی پرداخت', 'در انتظار شرایط', 'درآمد شرکت'],
    ...list.map((s) => [s.party_name, kindLabel[s.party_kind] || s.party_kind, s.national_id || '', s.economic_code || '', compLabel[s.component] || s.component, s.entries, s.total_amount, s.paid_amount, s.payable_amount, s.pending_amount, s.retained_amount]),
  ];

  async function saveSnapshot() {
    if (!snapTitle.trim()) { toast.show('err', 'عنوان گزارش را بنویسید'); return; }
    const r = await supabase.rpc('finance_generate_tax_snapshot', { p_from: tFrom, p_to: tTo, p_title: snapTitle.trim(), p_notes: snapNotes.trim() || null });
    if (r.error) { toast.show('err', r.error.message); return; }
    toast.show('ok', 'نسخه‌ی ثابت در آرشیو مالیاتی ذخیره شد (غیرقابل تغییر).');
    setSnapOpen(false); setSnapTitle(''); setSnapNotes(''); load();
  }

  async function openSnap(s: any) {
    const full = await supabase.from('tax_report_snapshots').select('*').eq('id', s.id).maybeSingle();
    if (full.error || !full.data) { toast.show('err', full.error?.message || 'یافت نشد'); return; }
    setSnapView(full.data);
  }

  const th = { padding: '10px' } as const;
  const td = { padding: '8px 10px' } as const;
  const partyList = Object.values(parties) as any[];
  const hasEntriesPending = entries.some((e) => e.status === 'pending');

  return (
    <main style={{ minHeight: '100vh', background: '#f3f4f6', padding: '32px 16px' }} dir="rtl">
      {toast.node}
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 'bold', color: '#1e3a8a' }}>دفتر تسویه و آرشیو مالیاتی</h1>
          <div style={{ display: 'flex', gap: 14 }}>
            <a href="/admin/settlement" style={{ color: '#1e3a8a', fontSize: 14 }}>تنظیم قالب‌ها و ذی‌نفعان ←</a>
            <a href="/admin" style={{ color: '#6b7280', fontSize: 14, textDecoration: 'none' }}>← پنل اصلی</a>
          </div>
        </div>
        {missing && <div style={{ background: '#fef3c7', color: '#92400e', borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 14 }}>این بخش هنوز فعال نشده است. فایل 09_stage8_revenue_sharing.sql را اجرا کنید.</div>}

        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {([['entries', 'دفتر تسویه'], ['payouts', 'پرداخت‌ها'], ['tax', 'گزارش و آرشیو مالیاتی']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 'bold', background: tab === k ? '#1e3a8a' : 'white', color: tab === k ? 'white' : '#1e3a8a' }}>{l}</button>
          ))}
        </div>
        {loading && <p style={{ color: '#6b7280' }}>در حال بارگذاری...</p>}

        {/* ------------ دفتر تسویه ------------ */}
        {!loading && tab === 'entries' && (
          <>
            <div style={{ background: 'white', borderRadius: 12, overflowX: 'auto', marginBottom: 14 }}>
              <div style={{ padding: 12, fontWeight: 'bold', fontSize: 14 }}>مانده‌ی هر ذی‌نفع</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', minWidth: 680 }}>
                <thead style={{ background: '#f3f4f6' }}><tr><th style={th}>ذی‌نفع</th><th style={th}>نوع</th><th style={th}>آماده‌ی پرداخت</th><th style={th}>در انتظار شرایط</th><th style={th}>پرداخت‌شده</th><th style={th}>درآمد شرکت</th><th style={th} /></tr></thead>
                <tbody>
                  {summary.length === 0 ? <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>هنوز سهمی ثبت نشده است</td></tr> : summary.map(([id, s]) => (
                    <tr key={id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ ...td, fontWeight: 'bold' }}>{s.name}</td><td style={td}>{kindLabel[s.kind] || s.kind}</td>
                      <td style={{ ...td, color: '#1d4ed8', fontWeight: 'bold' }}>{money(s.payable)}</td><td style={{ ...td, color: '#d97706' }}>{money(s.pending)}</td>
                      <td style={{ ...td, color: '#065f46' }}>{money(s.paid)}</td><td style={{ ...td, color: '#6d28d9' }}>{money(s.retained)}</td>
                      <td style={td}>{canApprove && s.payable > 0 && <button onClick={() => pickAllForParty(id)} style={btn('#e0e7ff', '#1e3a8a')}>انتخاب همه‌ی آماده</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ background: 'white', borderRadius: 12, padding: 14, marginBottom: 12, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جستجو شماره، عنوان یا ذی‌نفع..." style={{ ...inputStyle, flex: 1, minWidth: 180, width: 'auto' }} />
              <select value={statusF} onChange={(e) => setStatusF(e.target.value)} style={{ ...inputStyle, width: 'auto' }}><option value="all">همه وضعیت‌ها</option>{Object.keys(statusInfo).map((k) => <option key={k} value={k}>{statusInfo[k][0]}</option>)}</select>
              <select value={partyF} onChange={(e) => setPartyF(e.target.value)} style={{ ...inputStyle, width: 'auto' }}><option value="all">همه ذی‌نفعان</option>{partyList.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              <select value={srcF} onChange={(e) => setSrcF(e.target.value)} style={{ ...inputStyle, width: 'auto' }}><option value="all">همه منابع</option><option value="service_invoice">فاکتور خدمات</option><option value="shop_order">سفارش فروشگاه</option></select>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={{ ...inputStyle, width: 'auto' }} aria-label="از تاریخ" />
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={{ ...inputStyle, width: 'auto' }} aria-label="تا تاریخ" />
              <button onClick={exportEntries} style={{ ...btn('#16a34a'), padding: '9px 16px', fontSize: 13 }}>خروجی CSV</button>
            </div>
            {hasEntriesPending && <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>«در انتظار شرایط»: تا تأیید مشتری، دریافت تأییدشده‌ی وجه، رضایت‌سنجی و تأیید مالی (طبق تنظیمات) قابل پرداخت نیست.</p>}

            {picked.length > 0 && (
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: 12, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: 14 }}>{picked.length} ردیف انتخاب‌شده {mixed ? <b style={{ color: '#dc2626' }}> — ردیف‌های ذی‌نفعان مختلف است</b> : <>برای <b>{parties[pickedParty!]?.name}</b> · جمع <b>{money(pickedTotal)}</b> تومان</>}</span>
                {canApprove && <button onClick={openPay} disabled={mixed} style={{ ...btn('#16a34a'), padding: '8px 16px', fontSize: 13, opacity: mixed ? 0.5 : 1 }}>ثبت پرداخت</button>}
              </div>
            )}

            <div style={{ background: 'white', borderRadius: 12, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', minWidth: 980 }}>
                <thead style={{ background: '#1e3a8a', color: 'white' }}><tr><th style={th} /><th style={th}>تاریخ</th><th style={th}>منبع</th><th style={th}>عنوان</th><th style={th}>ذی‌نفع</th><th style={th}>درصد</th><th style={th}>مبلغ سهم</th><th style={th}>وضعیت</th><th style={th} /></tr></thead>
                <tbody>
                  {filtered.length === 0 ? <tr><td colSpan={9} style={{ padding: 28, textAlign: 'center', color: '#9ca3af' }}>ردیفی یافت نشد</td></tr> : filtered.slice(0, 600).map((e) => {
                    const [lbl, bg, fg] = statusInfo[e.status] || [e.status, '#f3f4f6', '#6b7280'];
                    const selectable = e.status === 'payable' && !e.payout_id;
                    return (
                      <tr key={e.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={td}>{selectable && canApprove && <input type="checkbox" checked={picked.includes(e.id)} onChange={() => toggle(e)} />}</td>
                        <td style={{ ...td, fontSize: 12, color: '#6b7280' }}>{e.source_date}</td>
                        <td style={{ ...td, fontSize: 12 }}>{srcLabel[e.source_kind]} #{e.source_ref}</td>
                        <td style={td}>{e.label}<div style={{ fontSize: 11, color: '#9ca3af' }}>{compLabel[e.component] || e.component}</div></td>
                        <td style={td}>{e.party_name}<div style={{ fontSize: 11, color: '#9ca3af' }}>{kindLabel[e.party_kind]}</div></td>
                        <td style={td}>{e.rate_percent != null ? money(e.rate_percent) + '٪' : ''}</td>
                        <td style={{ ...td, fontWeight: 'bold', color: Number(e.amount) < 0 ? '#dc2626' : undefined }}>{money(e.amount)}</td>
                        <td style={td}><span style={badge(bg, fg)}>{lbl}</span></td>
                        <td style={td}>{canEdit && (e.status === 'paid' || e.status === 'payable') && !e.reverses_entry && <button onClick={() => setRevTarget(e)} style={btn('#f3e8ff', '#7e22ce')}>سند برگشتی</button>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length > 600 && <p style={{ padding: 10, fontSize: 12, color: '#6b7280' }}>۶۰۰ ردیف اول نمایش داده شد؛ فیلتر کنید یا CSV بگیرید.</p>}
            </div>
          </>
        )}

        {/* ------------ پرداخت‌ها ------------ */}
        {!loading && tab === 'payouts' && (
          <>
            <div style={{ background: '#fff7ed', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 13, color: '#9a3412', lineHeight: 2 }}>
              پرداخت فعلاً «ثبت دستی» است: ابتدا واریز واقعی را از بانک/پنل انجام دهید و بعد شماره پیگیری را اینجا ثبت کنید. اتصال خودکار به زرین‌پال هنوز فعال نیست؛ تغییر وضعیت در پنل به‌تنهایی واریز نیست.
            </div>
            <div style={{ background: 'white', borderRadius: 12, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', minWidth: 760 }}>
                <thead style={{ background: '#1e3a8a', color: 'white' }}><tr><th style={th}>تاریخ</th><th style={th}>ذی‌نفع</th><th style={th}>مبلغ</th><th style={th}>ردیف‌ها</th><th style={th}>شبا</th><th style={th}>شماره پیگیری</th><th style={th}>روش</th></tr></thead>
                <tbody>
                  {payouts.length === 0 ? <tr><td colSpan={7} style={{ padding: 28, textAlign: 'center', color: '#9ca3af' }}>پرداختی ثبت نشده است</td></tr> : payouts.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ ...td, fontSize: 12 }}>{fmtDate(p.paid_at || p.requested_at)}</td><td style={{ ...td, fontWeight: 'bold' }}>{parties[p.party_id]?.name || '—'}</td>
                      <td style={{ ...td, color: '#16a34a', fontWeight: 'bold' }}>{money(p.total_amount)}</td><td style={td}>{p.entry_count}</td>
                      <td style={{ ...td, fontSize: 12 }}>{p.destination_last4 ? '••••' + p.destination_last4 + ' ' + (p.destination_holder || '') : '—'}</td>
                      <td style={{ ...td, fontSize: 12 }}>{p.ref || '—'}</td><td style={td}>{p.method === 'manual' ? 'دستی' : 'زرین‌پال'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ------------ مالیاتی ------------ */}
        {!loading && tab === 'tax' && (
          <>
            <div style={{ background: 'white', borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 13 }}>از</span><input type="date" value={tFrom} onChange={(e) => setTFrom(e.target.value)} style={{ ...inputStyle, width: 'auto' }} />
                <span style={{ fontSize: 13 }}>تا</span><input type="date" value={tTo} onChange={(e) => setTTo(e.target.value)} style={{ ...inputStyle, width: 'auto' }} />
                {canReport && <button onClick={runReport} disabled={repBusy} style={{ ...btn('#1e3a8a'), padding: '9px 16px', fontSize: 13 }}>{repBusy ? '...' : 'تهیه‌ی گزارش'}</button>}
              </div>
              <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8, lineHeight: 1.9 }}>گزارش نشان می‌دهد از هر درآمد چقدر پورسانت، بیمه، مالیات و ... به چه کسانی (با کد ملی/اقتصادی) تقسیم شده و چه مقدار پرداخت و با چه شماره پیگیری واریز شده است. برای ارائه به اداره‌ی مالیات، «ذخیره‌ی نسخه‌ی ثابت» بزنید؛ نسخه‌ی ذخیره‌شده تغییرناپذیر و دارای checksum است. برای تأیید قالب و مبنای قانونی با حسابدار یا مشاور مالیاتی هماهنگ کنید.</p>
            </div>

            {report && (
              <div style={{ background: 'white', borderRadius: 12, padding: 14, marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                  {[['تعداد درآمد (فاکتور/سفارش)', report.totals?.sources], ['جمع درآمد ثبت‌شده', report.totals?.gross_total], ['جمع واریزشده به ذی‌نفعان', report.totals?.paid_total]].map(([l, v]) => (
                    <div key={l as string} style={{ flex: 1, minWidth: 180, background: '#f9fafb', borderRadius: 10, padding: 10, textAlign: 'center' }}>
                      <div style={{ fontWeight: 'bold', color: '#1e3a8a' }}>{money(v as number)}</div><div style={{ fontSize: 12, color: '#6b7280' }}>{l as string}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 13, marginBottom: 8 }}>جمع هر نوع سهم: {Object.entries(report.totals?.by_component || {}).map(([k, v]) => <span key={k} style={{ marginLeft: 12 }}>{compLabel[k] || k}: <b>{money(v as number)}</b></span>)}</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: 13, minWidth: 760 }}>
                    <thead style={{ background: '#f3f4f6' }}><tr><th style={th}>ذی‌نفع</th><th style={th}>نوع سهم</th><th style={th}>تعداد</th><th style={th}>جمع</th><th style={th}>پرداخت‌شده</th><th style={th}>آماده‌ی پرداخت</th><th style={th}>در انتظار</th></tr></thead>
                    <tbody>{(report.party_summary || []).map((s: any, i: number) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}><td style={td}>{s.party_name}<div style={{ fontSize: 11, color: '#9ca3af' }}>{s.national_id || ''} {s.economic_code ? '· ' + s.economic_code : ''}</div></td><td style={td}>{compLabel[s.component] || s.component}</td><td style={td}>{s.entries}</td><td style={td}>{money(s.total_amount)}</td><td style={td}>{money(s.paid_amount)}</td><td style={td}>{money(s.payable_amount)}</td><td style={td}>{money(s.pending_amount)}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                  <button onClick={() => downloadCsv('vira-tax-entries-' + tFrom + '_' + tTo + '.csv', entryRows(report.entries || []))} style={btn('#16a34a')}>CSV ریز تراکنش‌ها</button>
                  <button onClick={() => downloadCsv('vira-tax-party-summary-' + tFrom + '_' + tTo + '.csv', summaryRows(report.party_summary || []))} style={btn('#16a34a')}>CSV خلاصه‌ی ذی‌نفعان</button>
                  {canReport && <button onClick={() => { setSnapTitle('گزارش ' + tFrom + ' تا ' + tTo); setSnapOpen(true); }} style={btn('#7e22ce')}>ذخیره‌ی نسخه‌ی ثابت در آرشیو</button>}
                </div>
              </div>
            )}

            <div style={{ background: 'white', borderRadius: 12, overflowX: 'auto' }}>
              <div style={{ padding: 12, fontWeight: 'bold', fontSize: 14 }}>آرشیو نسخه‌های ثابت</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', minWidth: 700 }}>
                <thead style={{ background: '#f3f4f6' }}><tr><th style={th}>عنوان</th><th style={th}>بازه</th><th style={th}>ردیف‌ها</th><th style={th}>جمع درآمد</th><th style={th}>ایجاد</th><th style={th}>checksum</th><th style={th} /></tr></thead>
                <tbody>
                  {snaps.length === 0 ? <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>نسخه‌ای ذخیره نشده است</td></tr> : snaps.map((s) => (
                    <tr key={s.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ ...td, fontWeight: 'bold' }}>{s.title}</td><td style={{ ...td, fontSize: 12 }}>{s.period_from} تا {s.period_to}</td><td style={td}>{s.row_count}</td>
                      <td style={td}>{money(s.totals?.gross_total)}</td><td style={{ ...td, fontSize: 12 }}>{fmtDate(s.created_at)}</td>
                      <td style={{ ...td, fontSize: 11, fontFamily: 'monospace' }} dir="ltr">{String(s.checksum).slice(0, 12)}…</td>
                      <td style={td}><button onClick={() => openSnap(s)} style={btn('#e0e7ff', '#1e3a8a')}>مشاهده / خروجی</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {payOpen && pickedParty && (
        <Modal title={'ثبت پرداخت به ' + (parties[pickedParty]?.name || '')} onClose={() => !payBusy && setPayOpen(false)} width={480}>
          <p style={{ fontSize: 14 }}>{picked.length} ردیف · جمع <b>{money(pickedTotal)}</b> تومان</p>
          {canBank ? (dest ? <p style={{ fontSize: 13, direction: 'ltr', textAlign: 'right', background: '#f9fafb', borderRadius: 8, padding: 8 }}>{dest.holder_name} · {dest.bank_name || ''} · {dest.iban}</p> : <p style={{ fontSize: 13, color: '#b91c1c' }}>شبای معتبر ثبت نشده است (برای مالیات/بیمه لازم نیست).</p>) : <p style={{ fontSize: 12, color: '#9ca3af' }}>برای دیدن شبا به مجوز «حساب‌های بانکی» نیاز دارید.</p>}
          <p style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.9 }}>«واریز خودکار» فقط وقتی کار می‌کند که اتصال زرین‌پال روی سرور فعال شده باشد؛ در غیر این صورت: ابتدا واریز واقعی را انجام دهید، سپس شماره پیگیری را ثبت کنید. ثبت دوباره‌ی همین پرداخت (کلیک تکراری) ثبت دوباره‌ای ایجاد نمی‌کند.</p>
          <Field label="شماره پیگیری پرداخت *"><input dir="ltr" value={payRef} onChange={(e) => { setPayRef(e.target.value); setPayErr(''); }} style={inputStyle} /></Field>
          <Field label="یادداشت"><input value={payNote} onChange={(e) => setPayNote(e.target.value)} style={inputStyle} /></Field>
          {payErr && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{payErr}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button onClick={() => setPayOpen(false)} disabled={payBusy} style={{ ...btn('#e5e7eb', '#374151'), padding: '8px 18px', fontSize: 13 }}>انصراف</button>
            {canApprove && canBank && (
              <button onClick={submitAutoPay} disabled={payBusy || autoBusy} style={{ ...btn('#7e22ce'), padding: '8px 18px', fontSize: 13, opacity: payBusy || autoBusy ? 0.6 : 1 }}>{autoBusy ? 'در حال واریز...' : 'واریز خودکار (زرین‌پال)'}</button>
            )}
            <button onClick={submitPay} disabled={payBusy || autoBusy} style={{ ...btn('#16a34a'), padding: '8px 18px', fontSize: 13, opacity: payBusy || autoBusy ? 0.6 : 1 }}>{payBusy ? 'در حال ثبت...' : 'ثبت دستی پرداخت'}</button>
          </div>
        </Modal>
      )}

      {snapOpen && (
        <Modal title="ذخیره‌ی نسخه‌ی ثابت" onClose={() => setSnapOpen(false)} width={460}>
          <Field label="عنوان *"><input value={snapTitle} onChange={(e) => setSnapTitle(e.target.value)} style={inputStyle} /></Field>
          <Field label="توضیح"><input value={snapNotes} onChange={(e) => setSnapNotes(e.target.value)} style={inputStyle} /></Field>
          <p style={{ fontSize: 12, color: '#9a3412', marginTop: 8, lineHeight: 1.9 }}>پس از ذخیره، این نسخه قابل ویرایش یا حذف نیست و فاکتورهای این بازه دیگر قابل حذف/ویرایش نخواهند بود (فقط سند اصلاحی).</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button onClick={() => setSnapOpen(false)} style={{ ...btn('#e5e7eb', '#374151'), padding: '8px 18px', fontSize: 13 }}>انصراف</button>
            <button onClick={saveSnapshot} style={{ ...btn('#7e22ce'), padding: '8px 18px', fontSize: 13 }}>ذخیره</button>
          </div>
        </Modal>
      )}

      {snapView && (
        <Modal title={snapView.title} onClose={() => setSnapView(null)} width={860}>
          <p style={{ fontSize: 13, color: '#374151' }}>بازه: {snapView.period_from} تا {snapView.period_to} · {snapView.row_count} ردیف · ایجاد {fmtDate(snapView.created_at)}</p>
          <p style={{ fontSize: 11, fontFamily: 'monospace', direction: 'ltr', textAlign: 'right', color: '#6b7280', wordBreak: 'break-all' }}>checksum: {snapView.checksum}</p>
          <div style={{ fontSize: 13, margin: '8px 0' }}>جمع درآمد: <b>{money(snapView.totals?.gross_total)}</b> · واریزشده: <b>{money(snapView.totals?.paid_total)}</b></div>
          <div style={{ overflowX: 'auto', maxHeight: 320 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'right' }}>
              <thead style={{ background: '#f3f4f6' }}><tr><th style={th}>ذی‌نفع</th><th style={th}>نوع سهم</th><th style={th}>جمع</th><th style={th}>پرداخت‌شده</th></tr></thead>
              <tbody>{(snapView.party_summary || []).map((s: any, i: number) => <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}><td style={td}>{s.party_name}</td><td style={td}>{compLabel[s.component] || s.component}</td><td style={td}>{money(s.total_amount)}</td><td style={td}>{money(s.paid_amount)}</td></tr>)}</tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={() => downloadCsv('vira-tax-archive-entries-' + snapView.period_from + '_' + snapView.period_to + '.csv', entryRows(snapView.entries || []))} style={btn('#16a34a')}>CSV ریز تراکنش‌ها</button>
            <button onClick={() => downloadCsv('vira-tax-archive-parties-' + snapView.period_from + '_' + snapView.period_to + '.csv', summaryRows(snapView.party_summary || []))} style={btn('#16a34a')}>CSV خلاصه‌ی ذی‌نفعان</button>
          </div>
        </Modal>
      )}

      {revTarget && <ReasonModal title="ثبت سند برگشتی" description={'برای «' + revTarget.label + '» (' + revTarget.party_name + ') یک سند منفی ثبت می‌شود و با پرداخت‌های بعدی همین ذی‌نفع تهاتر می‌شود. ردیف اصلی تغییر نمی‌کند.'} confirmLabel="ثبت سند" danger onConfirm={(r) => doReverse(r)} onClose={() => setRevTarget(null)} />}
    </main>
  );
}
