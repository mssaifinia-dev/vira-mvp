'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { adminRpc } from '@/lib/adminRpc';
import { can } from '@/lib/permissions';
import { useMyPerms } from '@/lib/useMyPerms';
import { Field, Modal, ReasonModal, badge, btn, downloadCsv, fmtDate, inputStyle, useToast } from '@/components/admin/ui';
import { CreateInvoiceModal, DeleteInvoiceModal, EditInvoiceModal } from '@/components/admin/InvoiceAdminModals';

const money = (n: number | string | null | undefined) => Number(n || 0).toLocaleString('fa-IR');
const statusInfo: Record<string, [string, string, string]> = {
  issued: ['در انتظار تأیید مشتری', '#fef3c7', '#d97706'],
  customer_approved: ['در انتظار بررسی مالی', '#dbeafe', '#1d4ed8'],
  finance_approved: ['تأیید مالی · در انتظار پرداخت', '#e0e7ff', '#3730a3'],
  paid: ['تسویه‌شده', '#d1fae5', '#065f46'],
  void: ['باطل', '#e5e7eb', '#4b5563'],
};
const kindLabel: Record<string, string> = { company_share: 'سهم شرکت', insurance: 'بیمه', tax: 'مالیات', vat: 'ارزش افزوده', other: 'سایر' };
const basisLabel: Record<string, string> = { subtotal: 'جمع ردیف‌ها (قبل از ارزش افزوده)', vat_amount: 'مبلغ ارزش افزوده', total_with_vat: 'مبلغ نهایی (با ارزش افزوده)' };
const adjLabel: Record<string, string> = { credit_note: 'سند بستانکار (کاهش)', debit_note: 'سند بدهکار (افزایش)', payout_reversal: 'برگشت پرداخت' };

type Tab = 'invoices' | 'prices' | 'rules';

export default function FinanceInvoicesPage() {
  const toast = useToast();
  const mine = useMyPerms();
  const [tab, setTab] = useState<Tab>('invoices');
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  const [invoices, setInvoices] = useState<any[]>([]);
  const [techs, setTechs] = useState<Record<string, any>>({});
  const [reqs, setReqs] = useState<Record<string, any>>({});
  const [reqsAll, setReqsAll] = useState<Record<string, any>>({});
  const [prices, setPrices] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [vat, setVat] = useState('10');

  const [statusF, setStatusF] = useState('all');
  const [payoutF, setPayoutF] = useState('all');
  const [techF, setTechF] = useState('all');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // جزئیات فاکتور
  const [detail, setDetail] = useState<any | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [bank, setBank] = useState<any | null>(null);
  const [fNote, setFNote] = useState('');
  const [fOverride, setFOverride] = useState(false);
  const [payRef, setPayRef] = useState('');
  const [payNote, setPayNote] = useState('');
  const [payKey, setPayKey] = useState('');
  const [adjKind, setAdjKind] = useState('credit_note');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjReason, setAdjReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [dErr, setDErr] = useState('');
  const [failTarget, setFailTarget] = useState<any | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState<any | null>(null);
  const [payConfirmTarget, setPayConfirmTarget] = useState<any | null>(null);

  // فهرست بها
  const [priceOpen, setPriceOpen] = useState<null | 'add' | 'edit'>(null);
  const [priceEdit, setPriceEdit] = useState<any | null>(null);
  const [priceForm, setPriceForm] = useState({ code: '', title: '', unit: 'مورد', unit_price: '', sort_order: '0' });
  const [priceErr, setPriceErr] = useState('');
  // قواعد
  const [ruleOpen, setRuleOpen] = useState<null | 'add' | 'edit'>(null);
  const [ruleEdit, setRuleEdit] = useState<any | null>(null);
  const [ruleForm, setRuleForm] = useState({ name: '', kind: 'company_share', basis: 'total_with_vat', rate_percent: '', sort_order: '10' });
  const [ruleErr, setRuleErr] = useState('');
  const [delTarget, setDelTarget] = useState<{ type: 'price' | 'rule'; row: any } | null>(null);

  const canApprove = can(mine.perms, 'finance', 'approve');
  const canEdit = can(mine.perms, 'finance', 'edit');
  const canCreate = can(mine.perms, 'finance', 'create');
  const canDelete = can(mine.perms, 'finance', 'delete');
  const canManage = can(mine.perms, 'finance', 'manage');
  const canBank = can(mine.perms, 'bank', 'view');

  const load = useCallback(async () => {
    const [inv, t, p, r, s] = await Promise.all([
      supabase.from('invoices').select('*').order('created_at', { ascending: false }).limit(400),
      supabase.from('technicians').select('id,full_name,phone,deleted_at'),
      supabase.from('service_price_items').select('*').order('sort_order').order('title'),
      supabase.from('deduction_rules').select('*').order('sort_order'),
      supabase.from('finance_settings').select('*').eq('id', 1).maybeSingle(),
    ]);
    if (inv.error && /invoice_no|status|schema cache|column/i.test(inv.error.message)) setMissing(true);
    if (p.error && /service_price_items|schema cache|relation/i.test(p.error.message)) setMissing(true);
    const list = (inv.data as any[]) || [];
    setInvoices(list);
    const tm: Record<string, any> = {};
    ((t.data as any[]) || []).forEach((x) => (tm[x.id] = x));
    setTechs(tm);
    setPrices((p.data as any[]) || []);
    setRules((r.data as any[]) || []);
    if (s.data) setVat(String((s.data as any).vat_percent));
    const allRq = await supabase.from('service_requests').select('id,request_no,customer_name,phone,status,technician_id').order('created_at', { ascending: false }).limit(400);
    const am: Record<string, any> = {};
    ((allRq.data as any[]) || []).forEach((x) => (am[x.id] = x));
    setReqsAll(am);
    if (list.length) {
      const rq = await supabase.from('service_requests').select('id,request_no,customer_name,phone').in('id', list.map((x) => x.request_id));
      const m: Record<string, any> = {};
      ((rq.data as any[]) || []).forEach((x) => (m[x.id] = x));
      setReqs(m);
    }
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

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const from = fromDate ? new Date(fromDate + 'T00:00:00').getTime() : 0;
    const to = toDate ? new Date(toDate + 'T23:59:59').getTime() : Infinity;
    return invoices.filter((i) => {
      if (statusF !== 'all' && i.status !== statusF) return false;
      if (payoutF !== 'all' && i.payout_status !== payoutF) return false;
      if (techF !== 'all' && i.technician_id !== techF) return false;
      const ts = new Date(i.issued_at || i.created_at).getTime();
      if (ts < from || ts > to) return false;
      if (!term) return true;
      const t = techs[i.technician_id];
      const rq = reqs[i.request_id];
      return String(i.invoice_no || '').includes(term) || (t?.full_name || '').toLowerCase().includes(term) || (t?.phone || '').includes(term)
        || (rq?.customer_name || '').toLowerCase().includes(term) || (rq?.phone || '').includes(term) || (i.payout_ref || '').toLowerCase().includes(term);
    });
  }, [invoices, statusF, payoutF, techF, search, fromDate, toDate, techs, reqs]);

  const totals = useMemo(() => filtered.reduce((a, i) => {
    a.total += Number(i.total_amount || 0); a.net += Number(i.net_payable ?? i.technician_payout ?? 0);
    a.share += Number(i.commission_amount || 0);
    if (i.status === 'finance_approved') a.pending += Number(i.net_payable ?? i.technician_payout ?? 0);
    if (i.status === 'paid') a.paid += Number(i.net_payable ?? i.technician_payout ?? 0);
    return a;
  }, { total: 0, net: 0, share: 0, pending: 0, paid: 0 }), [filtered]);

  async function openDetail(inv: any) {
    setDetail(inv); setItems([]); setAdjustments([]); setBank(null);
    setFNote(''); setFOverride(false); setPayRef(''); setPayNote(''); setDErr('');
    setPayKey(typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now()) + Math.random());
    setAdjKind('credit_note'); setAdjAmount(''); setAdjReason('');
    const [it, ad, bk] = await Promise.all([
      supabase.from('invoice_items').select('*').eq('invoice_id', inv.id),
      supabase.from('invoice_adjustments').select('*').eq('invoice_id', inv.id).order('created_at', { ascending: false }),
      canBank ? supabase.from('technician_bank_accounts').select('*').eq('technician_id', inv.technician_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    setItems((it.data as any[]) || []);
    setAdjustments((ad.data as any[]) || []);
    setBank((bk as any).data || null);
  }

  async function refreshDetail(id: string) {
    await load();
    const fresh = await supabase.from('invoices').select('*').eq('id', id).maybeSingle();
    if (fresh.data) {
      setDetail(fresh.data);
      const it = await supabase.from('invoice_items').select('*').eq('invoice_id', id);
      setItems((it.data as any[]) || []);
    }
  }

  async function approve() {
    if (!detail) return;
    setBusy(true); setDErr('');
    const r = await adminRpc('finance_approve_invoice', { p_invoice: detail.id, p_note: fNote.trim() || null, p_override: fOverride });
    setBusy(false);
    if (!r.ok) { setDErr(r.error || 'ناموفق'); return; }
    toast.show('ok', 'تأیید مالی ثبت شد.');
    refreshDetail(detail.id);
  }

  async function payout() {
    if (!detail) return;
    setBusy(true); setDErr('');
    const r = await adminRpc('record_invoice_payout', { p_invoice: detail.id, p_method: 'manual', p_ref: payRef.trim(), p_note: payNote.trim() || null, p_key: payKey });
    setBusy(false);
    if (!r.ok) { setDErr(r.error || 'ناموفق'); return; }
    toast.show('ok', 'پرداخت با شماره پیگیری ثبت شد.');
    refreshDetail(detail.id);
  }

  async function markFailed(note: string) {
    if (!failTarget) return;
    const r = await adminRpc('mark_payout_failed', { p_invoice: failTarget.id, p_note: note });
    if (!r.ok) { toast.show('err', r.error || 'ناموفق'); return; }
    toast.show('ok', 'شکست پرداخت ثبت شد؛ می‌توانید دوباره تلاش کنید.');
    refreshDetail(failTarget.id);
  }

  async function addAdjustment() {
    if (!detail) return;
    const amount = Number(adjAmount);
    if (!Number.isFinite(amount) || amount <= 0) { setDErr('مبلغ سند را درست وارد کنید'); return; }
    if (!adjReason.trim()) { setDErr('ثبت علت الزامی است'); return; }
    setBusy(true); setDErr('');
    const r = await adminRpc('finance_create_adjustment', { p_invoice: detail.id, p_kind: adjKind, p_amount: amount, p_reason: adjReason.trim() });
    setBusy(false);
    if (!r.ok) { setDErr(r.error || 'ناموفق'); return; }
    toast.show('ok', 'سند اصلاحی ثبت شد (فاکتور اصلی تغییر نکرد).');
    setAdjAmount(''); setAdjReason('');
    const ad = await supabase.from('invoice_adjustments').select('*').eq('invoice_id', detail.id).order('created_at', { ascending: false });
    setAdjustments((ad.data as any[]) || []);
  }

  async function doVoid(reason: string) {
    if (!voidTarget) return;
    const r = await adminRpc('admin_void_invoice', { p_invoice: voidTarget.id, p_reason: reason });
    if (!r.ok) { toast.show('err', r.error || 'ناموفق'); return; }
    toast.show('ok', 'فاکتور باطل شد (سوابق حفظ می‌شود).');
    setDetail(null);
    load();
  }
  async function doConfirmPayment(note: string) {
    if (!payConfirmTarget) return;
    const r = await adminRpc('finance_confirm_invoice_payment', { p_invoice: payConfirmTarget.id, p_note: note });
    if (!r.ok) { toast.show('err', r.error || 'ناموفق'); return; }
    toast.show('ok', 'دریافت وجه تأیید شد.');
    refreshDetail(payConfirmTarget.id);
  }

  function exportCsv() {
    const rows: (string | number)[][] = [['شماره فاکتور', 'تاریخ', 'تکنسین', 'مشتری', 'جمع ردیف‌ها', 'ارزش افزوده', 'مبلغ نهایی', 'کسورات', 'خالص', 'وضعیت', 'وضعیت پرداخت', 'شماره پیگیری', 'تاریخ پرداخت']];
    filtered.forEach((i) => rows.push([
      i.invoice_no || '', fmtDate(i.issued_at || i.created_at), techs[i.technician_id]?.full_name || '', reqs[i.request_id]?.customer_name || reqs[i.request_id]?.phone || '',
      i.subtotal ?? '', i.vat_amount ?? '', i.total_amount, Number(i.total_amount) - Number(i.net_payable ?? i.technician_payout ?? 0), i.net_payable ?? i.technician_payout ?? '',
      (statusInfo[i.status] || [i.status])[0], i.payout_status, i.payout_ref || '', i.payout_at ? fmtDate(i.payout_at) : '',
    ]));
    downloadCsv('vira-service-invoices.csv', rows);
    toast.show('ok', filtered.length + ' فاکتور خروجی گرفته شد.');
  }

  // ---------- فهرست بها ----------
  function openPrice(row: any | null) {
    setPriceForm(row ? { code: row.code || '', title: row.title, unit: row.unit, unit_price: String(row.unit_price), sort_order: String(row.sort_order) } : { code: '', title: '', unit: 'مورد', unit_price: '', sort_order: '0' });
    setPriceEdit(row); setPriceErr(''); setPriceOpen(row ? 'edit' : 'add');
  }
  async function savePrice() {
    const price = Number(priceForm.unit_price);
    if (!priceForm.title.trim()) { setPriceErr('عنوان خدمت الزامی است'); return; }
    if (!Number.isFinite(price) || price < 0) { setPriceErr('قیمت واحد را درست وارد کنید'); return; }
    const body = { code: priceForm.code.trim() || null, title: priceForm.title.trim(), unit: priceForm.unit.trim() || 'مورد', unit_price: Math.round(price), sort_order: Number(priceForm.sort_order) || 0 };
    const res = priceOpen === 'add'
      ? await supabase.from('service_price_items').insert(body).select('id')
      : await supabase.from('service_price_items').update(body).eq('id', priceEdit.id).select('id');
    if (res.error) { setPriceErr(/duplicate|unique/i.test(res.error.message) ? 'این کد قبلاً استفاده شده است' : res.error.message); return; }
    if (!res.data || res.data.length === 0) { setPriceErr('ذخیره انجام نشد (دسترسی وجود ندارد)'); return; }
    toast.show('ok', 'ذخیره شد. فقط فاکتورهای جدید با این قیمت صادر می‌شوند؛ فاکتورهای قبلی ثابت می‌مانند.');
    setPriceOpen(null); load();
  }
  async function togglePrice(row: any) {
    const res = await supabase.from('service_price_items').update({ is_active: !row.is_active }).eq('id', row.id).select('id');
    if (res.error || !res.data?.length) { toast.show('err', res.error?.message || 'دسترسی وجود ندارد'); return; }
    load();
  }

  // ---------- قواعد کسورات ----------
  function openRule(row: any | null) {
    setRuleForm(row ? { name: row.name, kind: row.kind, basis: row.basis, rate_percent: String(row.rate_percent), sort_order: String(row.sort_order) } : { name: '', kind: 'insurance', basis: 'subtotal', rate_percent: '', sort_order: '20' });
    setRuleEdit(row); setRuleErr(''); setRuleOpen(row ? 'edit' : 'add');
  }
  async function saveRule() {
    const rate = Number(ruleForm.rate_percent);
    if (!ruleForm.name.trim()) { setRuleErr('نام الزامی است'); return; }
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) { setRuleErr('درصد باید بین ۰ تا ۱۰۰ باشد'); return; }
    const body = { name: ruleForm.name.trim(), kind: ruleForm.kind, basis: ruleForm.basis, rate_percent: rate, sort_order: Number(ruleForm.sort_order) || 0 };
    const res = ruleOpen === 'add'
      ? await supabase.from('deduction_rules').insert(body).select('id')
      : await supabase.from('deduction_rules').update(body).eq('id', ruleEdit.id).select('id');
    if (res.error) { setRuleErr(res.error.message); return; }
    if (!res.data || res.data.length === 0) { setRuleErr('ذخیره انجام نشد (دسترسی وجود ندارد)'); return; }
    toast.show('ok', 'قاعده ذخیره شد. فقط فاکتورهای جدید را تحت تأثیر قرار می‌دهد.');
    setRuleOpen(null); load();
  }
  async function toggleRule(row: any) {
    const res = await supabase.from('deduction_rules').update({ is_active: !row.is_active }).eq('id', row.id).select('id');
    if (res.error || !res.data?.length) { toast.show('err', res.error?.message || 'دسترسی وجود ندارد'); return; }
    load();
  }
  async function saveVat() {
    const r = await adminRpc('admin_update_finance_settings', { p_vat: Number(vat) });
    if (!r.ok) { toast.show('err', r.error || 'ناموفق'); return; }
    toast.show('ok', 'نرخ ارزش افزوده ذخیره شد (برای فاکتورهای جدید).');
    load();
  }
  async function doDelete() {
    if (!delTarget) return;
    const table = delTarget.type === 'price' ? 'service_price_items' : 'deduction_rules';
    const res = await supabase.from(table).delete().eq('id', delTarget.row.id).select('id');
    if (res.error || !res.data?.length) { toast.show('err', res.error?.message || 'حذف انجام نشد'); return; }
    toast.show('ok', 'حذف شد (فاکتورهای قبلی تغییر نمی‌کنند).');
    load();
  }

  // نمونه‌ی محاسبه‌ی نمایشی برای مدیر (همان فرمول سرور)
  const sample = useMemo(() => {
    const subtotal = 1000000; const v = Math.round(subtotal * Number(vat || 0) / 100); const total = subtotal + v;
    const ded = rules.filter((r) => r.is_active).map((r) => {
      const base = r.basis === 'subtotal' ? subtotal : r.basis === 'vat_amount' ? v : total;
      return { name: r.name, amount: Math.round(base * Number(r.rate_percent) / 100) };
    });
    const dsum = ded.reduce((a, d) => a + d.amount, 0);
    return { subtotal, v, total, ded, net: total - dsum };
  }, [vat, rules]);

  const th = { padding: '12px' } as const;
  const td = { padding: '10px 12px' } as const;
  const sb = (s: string) => { const [l, bg, fg] = statusInfo[s] || [s, '#f3f4f6', '#6b7280']; return <span style={badge(bg, fg)}>{l}</span>; };

  return (
    <main style={{ minHeight: '100vh', background: '#f3f4f6', padding: '32px 16px' }} dir="rtl">
      {toast.node}
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 'bold', color: '#1e3a8a' }}>فاکتورهای خدمات و تسویه تکنسین‌ها</h1>
          <a href="/admin" style={{ color: '#1e3a8a', fontSize: 14, textDecoration: 'none' }}>← بازگشت به پنل اصلی</a>
        </div>

        {missing && <div style={{ background: '#fef3c7', color: '#92400e', borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 14 }}>بخش مالی هنوز فعال نشده است. فایل 07_stage6_finance.sql را در Supabase اجرا کنید.</div>}

        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {([['invoices', 'فاکتورها و تسویه'], ['prices', 'فهرست بهای خدمات'], ['rules', 'ارزش افزوده و کسورات']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 'bold', background: tab === k ? '#1e3a8a' : 'white', color: tab === k ? 'white' : '#1e3a8a' }}>{l}</button>
          ))}
        </div>

        {/* ------------ فاکتورها ------------ */}
        {tab === 'invoices' && (
          <>
            <div style={{ background: 'white', borderRadius: 12, padding: 14, marginBottom: 12, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جستجو شماره فاکتور، تکنسین، مشتری، پیگیری..." style={{ ...inputStyle, flex: 1, minWidth: 200, width: 'auto' }} />
              <select value={statusF} onChange={(e) => setStatusF(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
                <option value="all">همه وضعیت‌ها</option>
                {Object.keys(statusInfo).map((k) => <option key={k} value={k}>{statusInfo[k][0]}</option>)}
              </select>
              <select value={payoutF} onChange={(e) => setPayoutF(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
                <option value="all">همه تسویه‌ها</option><option value="pending">پرداخت‌نشده</option><option value="paid">پرداخت‌شده</option><option value="failed">ناموفق</option>
              </select>
              <select value={techF} onChange={(e) => setTechF(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
                <option value="all">همه تکنسین‌ها</option>
                {Object.values(techs).map((t: any) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </select>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={{ ...inputStyle, width: 'auto' }} aria-label="از تاریخ" />
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={{ ...inputStyle, width: 'auto' }} aria-label="تا تاریخ" />
              <button onClick={exportCsv} style={{ ...btn('#16a34a'), padding: '9px 16px', fontSize: 13 }}>خروجی CSV</button>
              {canCreate && <button onClick={() => setCreateOpen(true)} style={{ ...btn('#1e3a8a'), padding: '9px 16px', fontSize: 13 }}>+ افزودن فاکتور</button>}
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              {[['مبلغ فاکتورها', totals.total, '#1e3a8a'], ['سهم شرکت', totals.share, '#7e22ce'], ['خالص تکنسین‌ها', totals.net, '#16a34a'], ['در انتظار پرداخت', totals.pending, '#d97706'], ['پرداخت‌شده', totals.paid, '#065f46']].map(([l, v, c]) => (
                <div key={l as string} style={{ flex: 1, minWidth: 150, background: 'white', borderRadius: 12, padding: 12, textAlign: 'center' }}>
                  <div style={{ fontWeight: 'bold', color: c as string }}>{money(v as number)} <span style={{ fontSize: 11 }}>تومان</span></div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{l as string}</div>
                </div>
              ))}
            </div>

            <div style={{ background: 'white', borderRadius: 12, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', minWidth: 940 }}>
                <thead style={{ background: '#1e3a8a', color: 'white' }}>
                  <tr><th style={th}>شماره</th><th style={th}>تاریخ</th><th style={th}>تکنسین</th><th style={th}>مبلغ نهایی</th><th style={th}>خالص</th><th style={th}>وضعیت</th><th style={th}>پرداخت مشتری</th><th style={th}>اقدام</th></tr>
                </thead>
                <tbody>
                  {loading ? <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#6b7280' }}>در حال بارگذاری...</td></tr> : filtered.length === 0 ? (
                    <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>فاکتوری یافت نشد</td></tr>
                  ) : filtered.map((i) => (
                    <tr key={i.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ ...td, fontWeight: 'bold' }}>{i.invoice_no ? '#' + Number(i.invoice_no).toLocaleString('fa-IR') : '—'}</td>
                      <td style={{ ...td, fontSize: 12, color: '#6b7280' }}>{fmtDate(i.issued_at || i.created_at)}</td>
                      <td style={td}>{techs[i.technician_id]?.full_name || '—'}</td>
                      <td style={td}>{money(i.total_amount)}</td>
                      <td style={{ ...td, color: '#16a34a', fontWeight: 'bold' }}>{money(i.net_payable ?? i.technician_payout)}</td>
                      <td style={td}>{sb(i.status)}{i.payout_status === 'failed' && <span style={badge('#fee2e2', '#dc2626')}>پرداخت ناموفق</span>}</td>
                      <td style={td}>{i.payment_status === 'paid' ? <span style={badge('#d1fae5', '#065f46')}>پرداخت شده</span> : <span style={badge('#f3f4f6', '#6b7280')}>ثبت نشده</span>}</td>
                      <td style={td}><button onClick={() => openDetail(i)} style={btn('#e0e7ff', '#1e3a8a')}>جزئیات</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ------------ فهرست بها ------------ */}
        {tab === 'prices' && (
          <>
            <div style={{ background: '#eef2ff', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 13, color: '#3730a3', lineHeight: 2 }}>
              تکنسین فقط از همین فهرست خدمت انتخاب می‌کند و قیمت را از همین‌جا می‌گیرد. قیمت هر فاکتور هنگام صدور داخل خودش ثبت می‌شود؛ تغییر قیمت فاکتورهای قبلی را عوض نمی‌کند.
            </div>
            {canCreate && <button onClick={() => openPrice(null)} style={{ ...btn('#1e3a8a'), padding: '9px 16px', fontSize: 13, marginBottom: 12 }}>+ خدمت جدید</button>}
            <div style={{ background: 'white', borderRadius: 12, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', minWidth: 620 }}>
                <thead style={{ background: '#1e3a8a', color: 'white' }}><tr><th style={th}>کد</th><th style={th}>عنوان</th><th style={th}>واحد</th><th style={th}>قیمت واحد (تومان)</th><th style={th}>وضعیت</th><th style={th}>اقدام</th></tr></thead>
                <tbody>
                  {prices.length === 0 ? <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>خدمتی تعریف نشده است</td></tr> : prices.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6', opacity: p.is_active ? 1 : 0.6 }}>
                      <td style={{ ...td, color: '#6b7280' }}>{p.code || '—'}</td>
                      <td style={{ ...td, fontWeight: 'bold' }}>{p.title}</td>
                      <td style={td}>{p.unit}</td>
                      <td style={td}>{money(p.unit_price)}</td>
                      <td style={td}>{p.is_active ? <span style={badge('#d1fae5', '#065f46')}>فعال</span> : <span style={badge('#fee2e2', '#dc2626')}>غیرفعال</span>}</td>
                      <td style={td}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {canEdit && <button onClick={() => openPrice(p)} style={btn('#dbeafe', '#1d4ed8')}>ویرایش</button>}
                          {canEdit && <button onClick={() => togglePrice(p)} style={btn(p.is_active ? '#fef3c7' : '#d1fae5', p.is_active ? '#d97706' : '#065f46')}>{p.is_active ? 'غیرفعال' : 'فعال'}</button>}
                          {canDelete && <button onClick={() => setDelTarget({ type: 'price', row: p })} style={btn('#fee2e2', '#dc2626')}>حذف</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ------------ ارزش افزوده و قالب تقسیم ------------ */}
        {tab === 'rules' && (
          <>
            <div style={{ background: 'white', borderRadius: 12, padding: 16, marginBottom: 12 }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>نرخ ارزش افزوده</h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input inputMode="decimal" value={vat} onChange={(e) => setVat(e.target.value)} style={{ ...inputStyle, width: 100 }} /> <span>درصد (پیش‌فرض ۱۰)</span>
                {canManage ? <button onClick={saveVat} style={{ ...btn('#1e3a8a'), padding: '8px 16px', fontSize: 13 }}>ذخیره</button> : <span style={{ fontSize: 12, color: '#9ca3af' }}>تغییر نرخ نیاز به «مدیریت کامل» بخش مالی دارد</span>}
              </div>
            </div>
            <div style={{ background: '#eef2ff', borderRadius: 12, padding: 16, fontSize: 14, lineHeight: 2 }}>
              پورسانت شرکت، سهم واسطه و شرکای تجاری، بیمه، مالیات و تقسیم «مانده» بین ذی‌نفعان از بخش
              {' '}<a href="/admin/settlement" style={{ color: '#1e3a8a', fontWeight: 'bold' }}>تقسیم درآمد و ذی‌نفعان</a>{' '}
              مدیریت می‌شود (قالب‌های تقسیم برای خدمات و فروشگاه). تغییر آن‌ها فقط برای فاکتورهای جدید اعمال می‌شود.
            </div>
          </>
        )}
      </div>

      {/* ------------ جزئیات فاکتور ------------ */}
      {detail && (
        <Modal title={'فاکتور ' + (detail.invoice_no ? '#' + Number(detail.invoice_no).toLocaleString('fa-IR') : '')} onClose={() => !busy && setDetail(null)} width={760}>
          <div style={{ marginBottom: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {sb(detail.status)}
            {detail.payment_verified ? <span style={badge('#d1fae5', '#065f46')}>دریافت وجه تأییدشده</span> : <span style={badge('#fef3c7', '#d97706')}>دریافت وجه تأیید نشده</span>}
            {detail.status !== 'void' && canEdit && <button onClick={() => setEditOpen(true)} style={btn('#dbeafe', '#1d4ed8')}>ویرایش ردیف‌ها</button>}
            {detail.status !== 'void' && canApprove && !detail.payment_verified && <button onClick={() => setPayConfirmTarget(detail)} style={btn('#ccfbf1', '#0f766e')}>تأیید دریافت وجه</button>}
            {detail.status !== 'void' && canDelete && <button onClick={() => setVoidTarget(detail)} style={btn('#fef3c7', '#d97706')}>ابطال</button>}
            {canDelete && <button onClick={() => setDelOpen(true)} style={btn('#fee2e2', '#dc2626')}>حذف</button>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 6, fontSize: 13, color: '#374151' }}>
            <div>تکنسین: {techs[detail.technician_id]?.full_name || '—'}</div>
            <div>مشتری: {reqs[detail.request_id]?.customer_name || reqs[detail.request_id]?.phone || '—'}</div>
            <div>درخواست: {reqs[detail.request_id]?.request_no ? '#' + reqs[detail.request_id].request_no : '—'}</div>
            <div>صدور: {fmtDate(detail.issued_at || detail.created_at)}</div>
            <div>تأیید مشتری: {fmtDate(detail.customer_approved_at)}</div>
            <div>پرداخت مشتری: {detail.payment_status === 'paid' ? 'ثبت شده · ' + fmtDate(detail.customer_paid_at) : 'ثبت نشده'}</div>
            <div>رضایت‌سنجی: {detail.rating ? detail.rating + ' از ۵' : '—'}{detail.feedback ? ' · ' + detail.feedback : ''}</div>
            <div>تأیید مالی: {fmtDate(detail.finance_approved_at)}</div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'right', marginTop: 12 }}>
            <thead><tr style={{ background: '#f3f4f6' }}><th style={{ padding: 6 }}>شرح</th><th style={{ padding: 6 }}>تعداد</th><th style={{ padding: 6 }}>قیمت واحد</th><th style={{ padding: 6 }}>مبلغ</th></tr></thead>
            <tbody>{items.map((it) => (
              <tr key={it.id} style={{ borderBottom: '1px solid #f3f4f6' }}><td style={{ padding: 6 }}>{it.item_name}{it.is_custom && <span style={{ fontSize: 11, color: '#9ca3af' }}> (قطعه/سایر)</span>}</td><td style={{ padding: 6 }}>{money(it.quantity)}</td><td style={{ padding: 6 }}>{it.unit_price != null ? money(it.unit_price) : '—'}</td><td style={{ padding: 6 }}>{money(it.price)}</td></tr>
            ))}</tbody>
          </table>

          <div style={{ marginTop: 10, fontSize: 13, lineHeight: 2 }}>
            <div>جمع ردیف‌ها: {money(detail.subtotal)} · ارزش افزوده{detail.vat_percent != null ? ' (' + money(detail.vat_percent) + '٪)' : ''}: {money(detail.vat_amount)}</div>
            <div style={{ fontWeight: 'bold' }}>مبلغ نهایی: {money(detail.total_amount)} تومان</div>
            {(Array.isArray(detail.deductions) ? detail.deductions : []).map((d: any, i: number) => (
              <div key={i} style={{ color: '#dc2626' }}>{d.name} ({money(d.rate_percent)}٪ از {basisLabel[d.basis] || d.basis}): − {money(d.amount)}</div>
            ))}
            <div style={{ color: '#16a34a', fontWeight: 'bold' }}>خالص قابل پرداخت: {money(detail.net_payable ?? detail.technician_payout)} تومان</div>
            {detail.payout_status === 'paid' && <div>پرداخت‌شده: {fmtDate(detail.payout_at)} · شماره پیگیری {detail.payout_ref} · شبا ••••{detail.payout_iban_last4}</div>}
            {detail.payout_note && <div style={{ color: '#6b7280' }}>یادداشت پرداخت: {detail.payout_note}</div>}
            {detail.finance_note && <div style={{ color: '#6b7280' }}>یادداشت مالی: {detail.finance_note}</div>}
          </div>

          {/* تأیید مالی */}
          {canApprove && (detail.status === 'issued' || detail.status === 'customer_approved') && (
            <div style={{ border: '1px solid #bfdbfe', borderRadius: 10, padding: 12, marginTop: 12, background: '#eff6ff' }}>
              <b style={{ fontSize: 13 }}>تأیید مالی</b>
              {(detail.status === 'issued' || detail.payment_status !== 'paid') && (
                <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, marginTop: 6, color: '#92400e', lineHeight: 1.8 }}>
                  <input type="checkbox" checked={fOverride} onChange={(e) => setFOverride(e.target.checked)} style={{ marginTop: 4 }} />
                  تأیید مشتری یا پرداخت مشتری هنوز کامل نیست؛ تأیید استثنایی (توضیح الزامی)
                </label>
              )}
              <Field label="توضیح"><input value={fNote} onChange={(e) => setFNote(e.target.value)} style={inputStyle} /></Field>
              <button onClick={approve} disabled={busy} style={{ ...btn('#1e3a8a'), padding: '8px 16px', fontSize: 13, marginTop: 10 }}>{busy ? '...' : 'ثبت تأیید مالی'}</button>
            </div>
          )}

          {/* پرداخت و تسویه: از دفتر تسویه */}
          <div style={{ border: '1px solid #c7d2fe', borderRadius: 10, padding: 12, marginTop: 12, background: '#eef2ff', fontSize: 13, lineHeight: 1.9 }}>
            سهم همه‌ی ذی‌نفعان (تکنسین، شرکت، واسطه/شریک، بیمه، مالیات) از این فاکتور در <a href="/admin/ledger" style={{ color: '#1e3a8a', fontWeight: 'bold' }}>دفتر تسویه</a> ثبت می‌شود و پرداخت‌ها و گزارش مالیاتی از همان‌جاست.
            {detail.payout_status === 'paid' && <div style={{ marginTop: 4, color: '#065f46' }}>تسویه‌شده · شماره پیگیری {detail.payout_ref} · شبا ••••{detail.payout_iban_last4}</div>}
          </div>

          {/* اسناد اصلاحی */}
          <h4 style={{ fontSize: 14, margin: '14px 0 6px' }}>اسناد اصلاحی</h4>
          {adjustments.length === 0 ? <p style={{ fontSize: 12, color: '#9ca3af' }}>سند اصلاحی ثبت نشده است.</p> : adjustments.map((a) => (
            <div key={a.id} style={{ fontSize: 13, borderBottom: '1px solid #f3f4f6', padding: '4px 0' }}>{adjLabel[a.kind]}: {money(a.amount)} تومان — {a.reason} <span style={{ color: '#9ca3af' }}>({fmtDate(a.created_at)})</span></div>
          ))}
          {canEdit && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
              <select value={adjKind} onChange={(e) => setAdjKind(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>{Object.keys(adjLabel).map((k) => <option key={k} value={k}>{adjLabel[k]}</option>)}</select>
              <input inputMode="numeric" value={adjAmount} onChange={(e) => setAdjAmount(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="مبلغ" style={{ ...inputStyle, width: 110 }} />
              <input value={adjReason} onChange={(e) => setAdjReason(e.target.value)} placeholder="علت" style={{ ...inputStyle, flex: 1, minWidth: 140, width: 'auto' }} />
              <button onClick={addAdjustment} disabled={busy} style={{ ...btn('#7e22ce'), padding: '8px 14px', fontSize: 13 }}>ثبت سند</button>
            </div>
          )}
          <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>فاکتور و پرداخت ثبت‌شده قابل حذف یا ویرایش نیست؛ هرگونه اصلاح با سند اصلاحی انجام می‌شود.</p>
          {dErr && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 10 }}>{dErr}</p>}
        </Modal>
      )}


      {createOpen && (
        <CreateInvoiceModal
          requests={Object.values(reqsAll).filter((r: any) => !invoices.some((i) => i.request_id === r.id))}
          techs={Object.values(techs).filter((x: any) => !x.deleted_at)}
          prices={prices}
          onClose={() => setCreateOpen(false)}
          onDone={(m) => { setCreateOpen(false); toast.show('ok', m); load(); }}
        />
      )}
      {editOpen && detail && (
        <EditInvoiceModal invoice={detail} items={items} prices={prices} isSuper={!!mine.perms?.super}
          onClose={() => setEditOpen(false)}
          onDone={(m) => { setEditOpen(false); toast.show('ok', m); refreshDetail(detail.id); }} />
      )}
      {delOpen && detail && (
        <DeleteInvoiceModal invoice={detail} isSuper={!!mine.perms?.super}
          onClose={() => setDelOpen(false)}
          onDone={(m) => { setDelOpen(false); setDetail(null); toast.show('ok', m); load(); }} />
      )}
      {voidTarget && (
        <ReasonModal title="ابطال فاکتور" description="فاکتور باطل می‌شود ولی سوابق و سهم‌ها برای حسابرسی حفظ می‌شود. فاکتور تسویه‌شده قابل ابطال نیست." confirmLabel="ابطال" danger
          onConfirm={(r) => doVoid(r)} onClose={() => setVoidTarget(null)} />
      )}
      {payConfirmTarget && (
        <ReasonModal title="تأیید دریافت وجه" description="تأیید می‌کنید که مبلغ این فاکتور (مثلاً نقدی یا کارت‌به‌کارت) واقعاً دریافت شده است؟ پس از آن سهم‌ها بعد از سایر شرایط آماده‌ی پرداخت می‌شوند." confirmLabel="تأیید دریافت"
          onConfirm={(n) => doConfirmPayment(n)} onClose={() => setPayConfirmTarget(null)} />
      )}

      {priceOpen && (
        <Modal title={priceOpen === 'add' ? 'خدمت جدید' : 'ویرایش خدمت'} onClose={() => setPriceOpen(null)} width={460}>
          <Field label="عنوان خدمت *"><input value={priceForm.title} onChange={(e) => setPriceForm({ ...priceForm, title: e.target.value })} style={inputStyle} /></Field>
          <Field label="کد (اختیاری)"><input dir="ltr" value={priceForm.code} onChange={(e) => setPriceForm({ ...priceForm, code: e.target.value })} style={inputStyle} /></Field>
          <Field label="واحد اندازه‌گیری"><input value={priceForm.unit} onChange={(e) => setPriceForm({ ...priceForm, unit: e.target.value })} style={inputStyle} /></Field>
          <Field label="قیمت واحد (تومان) *"><input inputMode="numeric" value={priceForm.unit_price} onChange={(e) => setPriceForm({ ...priceForm, unit_price: e.target.value.replace(/[^0-9]/g, '') })} style={inputStyle} /></Field>
          <Field label="ترتیب نمایش"><input inputMode="numeric" value={priceForm.sort_order} onChange={(e) => setPriceForm({ ...priceForm, sort_order: e.target.value })} style={inputStyle} /></Field>
          {priceErr && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 10 }}>{priceErr}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button onClick={() => setPriceOpen(null)} style={{ ...btn('#e5e7eb', '#374151'), padding: '8px 18px', fontSize: 13 }}>انصراف</button>
            <button onClick={savePrice} style={{ ...btn('#1e3a8a'), padding: '8px 18px', fontSize: 13 }}>ذخیره</button>
          </div>
        </Modal>
      )}

      {ruleOpen && (
        <Modal title={ruleOpen === 'add' ? 'قاعده‌ی کسورات جدید' : 'ویرایش قاعده'} onClose={() => setRuleOpen(null)} width={460}>
          <Field label="نام *"><input value={ruleForm.name} onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })} style={inputStyle} /></Field>
          <Field label="نوع"><select value={ruleForm.kind} onChange={(e) => setRuleForm({ ...ruleForm, kind: e.target.value })} style={inputStyle}>{Object.keys(kindLabel).map((k) => <option key={k} value={k}>{kindLabel[k]}</option>)}</select></Field>
          <Field label="مبنای محاسبه"><select value={ruleForm.basis} onChange={(e) => setRuleForm({ ...ruleForm, basis: e.target.value })} style={inputStyle}>{Object.keys(basisLabel).map((k) => <option key={k} value={k}>{basisLabel[k]}</option>)}</select></Field>
          <Field label="درصد *"><input inputMode="decimal" value={ruleForm.rate_percent} onChange={(e) => setRuleForm({ ...ruleForm, rate_percent: e.target.value })} style={inputStyle} /></Field>
          <Field label="ترتیب"><input inputMode="numeric" value={ruleForm.sort_order} onChange={(e) => setRuleForm({ ...ruleForm, sort_order: e.target.value })} style={inputStyle} /></Field>
          {ruleErr && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 10 }}>{ruleErr}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button onClick={() => setRuleOpen(null)} style={{ ...btn('#e5e7eb', '#374151'), padding: '8px 18px', fontSize: 13 }}>انصراف</button>
            <button onClick={saveRule} style={{ ...btn('#1e3a8a'), padding: '8px 18px', fontSize: 13 }}>ذخیره</button>
          </div>
        </Modal>
      )}

      {delTarget && (
        <ReasonModal title="حذف" description="حذف انجام می‌شود؛ فاکتورهای قبلی تغییر نمی‌کنند (نرخ‌ها داخل هر فاکتور ثبت شده است). برای کنار گذاشتن موقت، «غیرفعال» را ترجیح دهید." confirmLabel="حذف" danger requireReason={false}
          onConfirm={doDelete} onClose={() => setDelTarget(null)} />
      )}
    </main>
  );
}
