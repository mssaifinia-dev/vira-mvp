'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { adminRpc } from '@/lib/adminRpc';
import { can } from '@/lib/permissions';
import { useMyPerms } from '@/lib/useMyPerms';
import { Field, Modal, ReasonModal, badge, btn, inputStyle, useToast } from '@/components/admin/ui';

const money = (n: number | string | null | undefined) => Number(n || 0).toLocaleString('fa-IR');
const kindLabel: Record<string, string> = { company: 'شرکت', technician: 'تکنسین', seller: 'فروشنده', intermediary: 'واسطه', partner: 'شریک تجاری', insurance: 'بیمه', tax_authority: 'سازمان مالیاتی', other: 'سایر' };
const compLabel: Record<string, string> = {
  company_commission: 'پورسانت شرکت', intermediary_commission: 'پورسانت واسطه', partner_commission: 'سهم شریک تجاری', insurance: 'بیمه', tax: 'مالیات',
  vat_remit: 'ارزش افزوده (واریز به مالیات)', fee: 'سایر کارمزد/هزینه', remainder_share: 'سهم از مانده', payee_net: 'مانده‌ی ذی‌نفع اصلی',
};
const roleLabel: Record<string, string> = { company: 'شرکت', technician: 'تکنسین', seller: 'فروشنده', intermediary: 'واسطه‌ی همان تکنسین/فروشنده', partner: 'شریک همان تکنسین/فروشنده', insurance: 'بیمه', tax_authority: 'سازمان مالیاتی', fixed: 'ذی‌نفع ثابت (انتخابی)' };
const basisLabel: Record<string, string> = { subtotal: 'جمع ردیف‌ها (قبل از ارزش افزوده)', vat_amount: 'مبلغ ارزش افزوده', total_with_vat: 'مبلغ نهایی (با ارزش افزوده)', remaining: 'مانده (بعد از همه‌ی کسورات)' };
const appliesLabel: Record<string, string> = { service_invoice: 'فاکتور خدمات تکنسین', shop_order: 'سفارش فروشگاه' };

type Tab = 'parties' | 'links' | 'templates' | 'settings';

export default function SettlementConfigPage() {
  const toast = useToast();
  const mine = useMyPerms();
  const [tab, setTab] = useState<Tab>('templates');
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  const [parties, setParties] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<Record<string, any>>({});
  const [links, setLinks] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [lines, setLines] = useState<any[]>([]);
  const [techs, setTechs] = useState<any[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [svcCats, setSvcCats] = useState<any[]>([]);
  const [prodCats, setProdCats] = useState<any[]>([]);
  const [settings, setSettings] = useState({ require_customer_payment: true, require_customer_rating: true, require_finance_approval: true, hold_days: '0' });

  const canCreate = can(mine.perms, 'finance', 'create');
  const canEdit = can(mine.perms, 'finance', 'edit');
  const canDelete = can(mine.perms, 'finance', 'delete');
  const canManage = can(mine.perms, 'finance', 'manage');
  const canBank = can(mine.perms, 'bank', 'edit');

  const load = useCallback(async () => {
    const [p, a, l, t, tl, te, se, sc, pc, st] = await Promise.all([
      supabase.from('settlement_parties').select('*').order('kind').order('name'),
      supabase.from('settlement_party_accounts').select('*'),
      supabase.from('settlement_links').select('*').order('created_at', { ascending: false }),
      supabase.from('split_templates').select('*').order('applies_to').order('priority', { ascending: false }),
      supabase.from('split_template_lines').select('*').order('sort_order'),
      supabase.from('technicians').select('id,full_name,deleted_at'),
      supabase.from('sellers').select('id,shop_name,deleted_at'),
      supabase.from('service_categories').select('id,name'),
      supabase.from('product_categories').select('id,name'),
      supabase.from('settlement_settings').select('*').eq('id', 1).maybeSingle(),
    ]);
    if (p.error && /settlement_parties|schema cache|relation/i.test(p.error.message)) setMissing(true);
    setParties((p.data as any[]) || []);
    const am: Record<string, any> = {};
    ((a.data as any[]) || []).forEach((x) => (am[x.party_id] = x));
    setAccounts(am);
    setLinks((l.data as any[]) || []);
    setTemplates((t.data as any[]) || []);
    setLines((tl.data as any[]) || []);
    setTechs((te.data as any[]) || []);
    setSellers((se.data as any[]) || []);
    setSvcCats((sc.data as any[]) || []);
    setProdCats((pc.data as any[]) || []);
    if (st.data) { const d = st.data as any; setSettings({ require_customer_payment: d.require_customer_payment, require_customer_rating: d.require_customer_rating, require_finance_approval: d.require_finance_approval, hold_days: String(d.hold_days) }); }
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

  const partyName = (id: string | null) => parties.find((x) => x.id === id)?.name || '—';
  const subjectName = (k: string, id: string) => (k === 'technician' ? techs.find((x) => x.id === id)?.full_name : sellers.find((x) => x.id === id)?.shop_name) || '—';

  // ---------- ذی‌نفعان ----------
  const [partyOpen, setPartyOpen] = useState<null | 'add' | 'edit'>(null);
  const [partyEdit, setPartyEdit] = useState<any | null>(null);
  const [partyForm, setPartyForm] = useState({ kind: 'intermediary', name: '', national_id: '', economic_code: '', notes: '' });
  const [partyErr, setPartyErr] = useState('');
  const [acctParty, setAcctParty] = useState<any | null>(null);
  const [acctForm, setAcctForm] = useState({ iban: '', holder_name: '', bank_name: '', provider_account_id: '' });
  const [acctErr, setAcctErr] = useState('');

  async function saveParty() {
    if (!partyForm.name.trim()) { setPartyErr('نام الزامی است'); return; }
    const body = { name: partyForm.name.trim(), national_id: partyForm.national_id.trim() || null, economic_code: partyForm.economic_code.trim() || null, notes: partyForm.notes.trim() || null };
    const res = partyOpen === 'add'
      ? await supabase.from('settlement_parties').insert({ ...body, kind: partyForm.kind }).select('id')
      : await supabase.from('settlement_parties').update(body).eq('id', partyEdit.id).select('id');
    if (res.error) { setPartyErr(res.error.message); return; }
    if (!res.data?.length) { setPartyErr('ذخیره انجام نشد (دسترسی وجود ندارد)'); return; }
    toast.show('ok', 'ذخیره شد.'); setPartyOpen(null); load();
  }
  async function toggleParty(p: any) {
    const res = await supabase.from('settlement_parties').update({ is_active: !p.is_active }).eq('id', p.id).select('id');
    if (res.error || !res.data?.length) { toast.show('err', res.error?.message || 'دسترسی وجود ندارد'); return; }
    load();
  }
  async function saveAccount() {
    if (!acctParty) return;
    const r = await adminRpc('admin_set_party_account', { p_party: acctParty.id, p_iban: acctForm.iban.trim(), p_holder: acctForm.holder_name.trim(), p_bank: acctForm.bank_name.trim() || null, p_provider: acctForm.provider_account_id.trim() || null });
    if (!r.ok) { setAcctErr(r.error || 'ناموفق'); return; }
    toast.show('ok', 'حساب ذخیره شد.'); setAcctParty(null); load();
  }

  // ---------- واسطه‌ها ----------
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkForm, setLinkForm] = useState({ subject_kind: 'technician', subject_id: '', role: 'intermediary', party_id: '', rate_percent: '' });
  const [linkErr, setLinkErr] = useState('');
  const [linkDel, setLinkDel] = useState<any | null>(null);
  async function saveLink() {
    if (!linkForm.subject_id || !linkForm.party_id) { setLinkErr('تکنسین/فروشنده و ذی‌نفع را انتخاب کنید'); return; }
    const rate = linkForm.rate_percent.trim() === '' ? null : Number(linkForm.rate_percent);
    if (rate !== null && (!Number.isFinite(rate) || rate < 0 || rate > 100)) { setLinkErr('درصد باید بین ۰ تا ۱۰۰ باشد'); return; }
    const res = await supabase.from('settlement_links').insert({ subject_kind: linkForm.subject_kind, subject_id: linkForm.subject_id, role: linkForm.role, party_id: linkForm.party_id, rate_percent: rate }).select('id');
    if (res.error) { setLinkErr(/duplicate|unique/i.test(res.error.message) ? 'این اتصال قبلاً ثبت شده است' : res.error.message); return; }
    toast.show('ok', 'اتصال ثبت شد.'); setLinkOpen(false); load();
  }
  async function toggleLink(l: any) {
    const res = await supabase.from('settlement_links').update({ is_active: !l.is_active }).eq('id', l.id).select('id');
    if (res.error || !res.data?.length) { toast.show('err', res.error?.message || 'دسترسی وجود ندارد'); return; }
    load();
  }
  async function delLink(l: any) {
    const res = await supabase.from('settlement_links').delete().eq('id', l.id).select('id');
    if (res.error || !res.data?.length) { toast.show('err', res.error?.message || 'حذف انجام نشد'); return; }
    toast.show('ok', 'حذف شد.'); load();
  }

  // ---------- قالب‌ها ----------
  const [selTpl, setSelTpl] = useState<string>('');
  const [problems, setProblems] = useState<string[]>([]);
  const [tplOpen, setTplOpen] = useState<null | 'add' | 'edit'>(null);
  const [tplForm, setTplForm] = useState({ name: '', applies_to: 'service_invoice', scope: 'default', scope_id: '', priority: '0', is_active: true });
  const [tplErr, setTplErr] = useState('');
  const [lineOpen, setLineOpen] = useState<null | 'add' | 'edit'>(null);
  const [lineEdit, setLineEdit] = useState<any | null>(null);
  const [lineForm, setLineForm] = useState({ sort_order: '10', component: 'company_commission', label: '', party_role: 'company', fixed_party_id: '', rate_percent: '', rate_source: 'fixed', basis: 'total_with_vat', if_missing: 'skip', show_to_payee: true });
  const [lineErr, setLineErr] = useState('');
  const [delTarget, setDelTarget] = useState<{ type: 'tpl' | 'line'; row: any } | null>(null);
  const [pv, setPv] = useState({ subtotal: '1000000', vat: '100000', subject: '', category: '' });
  const [pvRes, setPvRes] = useState<any | null>(null);
  const [pvErr, setPvErr] = useState('');

  const tpl = templates.find((t) => t.id === selTpl) || null;
  const tplLines = useMemo(() => lines.filter((l) => l.template_id === selTpl).sort((a, b) => a.sort_order - b.sort_order), [lines, selTpl]);

  useEffect(() => {
    if (!selTpl && templates.length) setSelTpl(templates[0].id);
  }, [templates, selTpl]);

  useEffect(() => {
    if (!selTpl) { setProblems([]); return; }
    supabase.rpc('finance_validate_template', { p_template: selTpl }).then((r) => setProblems(r.error ? [] : ((r.data as string[]) || [])));
  }, [selTpl, lines]);

  function openTpl(row: any | null) {
    if (row) {
      const scope = row.party_id ? 'party' : row.service_category_id ? 'service_category' : row.product_category_id ? 'product_category' : row.is_default ? 'default' : 'default';
      setTplForm({ name: row.name, applies_to: row.applies_to, scope, scope_id: row.party_id || row.service_category_id || row.product_category_id || '', priority: String(row.priority), is_active: row.is_active });
    } else setTplForm({ name: '', applies_to: 'service_invoice', scope: 'default', scope_id: '', priority: '0', is_active: true });
    setTplErr(''); setTplOpen(row ? 'edit' : 'add');
  }
  async function saveTpl() {
    if (!tplForm.name.trim()) { setTplErr('نام الزامی است'); return; }
    if (tplForm.scope !== 'default' && !tplForm.scope_id) { setTplErr('محدوده‌ی قالب را انتخاب کنید'); return; }
    const body: any = {
      name: tplForm.name.trim(), applies_to: tplForm.applies_to, priority: Number(tplForm.priority) || 0, is_active: tplForm.is_active,
      is_default: tplForm.scope === 'default', service_category_id: tplForm.scope === 'service_category' ? tplForm.scope_id : null,
      product_category_id: tplForm.scope === 'product_category' ? tplForm.scope_id : null, party_id: tplForm.scope === 'party' ? tplForm.scope_id : null,
    };
    const res = tplOpen === 'add' ? await supabase.from('split_templates').insert(body).select('id') : await supabase.from('split_templates').update(body).eq('id', tpl!.id).select('id');
    if (res.error) { setTplErr(/uq_split_templates_default|duplicate/i.test(res.error.message) ? 'برای این نوع درآمد قبلاً یک قالب پیش‌فرض فعال وجود دارد' : res.error.message); return; }
    if (!res.data?.length) { setTplErr('ذخیره انجام نشد (دسترسی وجود ندارد)'); return; }
    toast.show('ok', 'قالب ذخیره شد. فقط برای درآمدهای جدید اعمال می‌شود.');
    setTplOpen(null); await load(); if (tplOpen === 'add' && res.data[0]) setSelTpl((res.data[0] as any).id);
  }
  function openLine(row: any | null) {
    setLineForm(row ? { sort_order: String(row.sort_order), component: row.component, label: row.label, party_role: row.party_role, fixed_party_id: row.fixed_party_id || '', rate_percent: String(row.rate_percent), rate_source: row.rate_source, basis: row.basis, if_missing: row.if_missing, show_to_payee: row.show_to_payee }
      : { sort_order: String((tplLines.length + 1) * 10), component: 'company_commission', label: '', party_role: 'company', fixed_party_id: '', rate_percent: '', rate_source: 'fixed', basis: 'total_with_vat', if_missing: 'skip', show_to_payee: true });
    setLineEdit(row); setLineErr(''); setLineOpen(row ? 'edit' : 'add');
  }
  async function saveLine() {
    const rate = Number(lineForm.rate_percent === '' ? 0 : lineForm.rate_percent);
    if (!lineForm.label.trim()) { setLineErr('عنوان الزامی است'); return; }
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) { setLineErr('درصد باید بین ۰ تا ۱۰۰ باشد'); return; }
    if (lineForm.party_role === 'fixed' && !lineForm.fixed_party_id) { setLineErr('ذی‌نفع ثابت را انتخاب کنید'); return; }
    const body: any = {
      template_id: selTpl, sort_order: Number(lineForm.sort_order) || 0, component: lineForm.component, label: lineForm.label.trim(), party_role: lineForm.party_role,
      fixed_party_id: ['fixed', 'insurance', 'tax_authority'].includes(lineForm.party_role) && lineForm.fixed_party_id ? lineForm.fixed_party_id : null,
      rate_percent: rate, rate_source: lineForm.rate_source, basis: lineForm.basis, if_missing: lineForm.if_missing, show_to_payee: lineForm.show_to_payee,
    };
    const res = lineOpen === 'add' ? await supabase.from('split_template_lines').insert(body).select('id') : await supabase.from('split_template_lines').update(body).eq('id', lineEdit.id).select('id');
    if (res.error) { setLineErr(res.error.message); return; }
    if (!res.data?.length) { setLineErr('ذخیره انجام نشد (دسترسی وجود ندارد)'); return; }
    toast.show('ok', 'خط ذخیره شد.'); setLineOpen(null); load();
  }
  async function doDelete() {
    if (!delTarget) return;
    const table = delTarget.type === 'tpl' ? 'split_templates' : 'split_template_lines';
    const res = await supabase.from(table).delete().eq('id', delTarget.row.id).select('id');
    if (res.error || !res.data?.length) { toast.show('err', res.error?.message || 'حذف انجام نشد'); return; }
    toast.show('ok', 'حذف شد.');
    if (delTarget.type === 'tpl') setSelTpl('');
    load();
  }
  async function runPreview() {
    if (!tpl) return;
    setPvErr(''); setPvRes(null);
    const r = await supabase.rpc('finance_preview_split', { p_kind: tpl.applies_to, p_subtotal: Number(pv.subtotal), p_vat: Number(pv.vat) || 0, p_subject_id: pv.subject || null, p_category_id: pv.category || null });
    if (r.error) { setPvErr(r.error.message); return; }
    setPvRes(r.data);
  }

  async function saveSettings() {
    const r = await adminRpc('admin_update_settlement_settings', { p_payment: settings.require_customer_payment, p_rating: settings.require_customer_rating, p_finance: settings.require_finance_approval, p_hold: Number(settings.hold_days) });
    if (!r.ok) { toast.show('err', r.error || 'ناموفق'); return; }
    toast.show('ok', 'شرایط پرداخت ذخیره شد.'); load();
  }

  const th = { padding: '10px' } as const;
  const td = { padding: '9px 10px' } as const;
  const linkableParties = parties.filter((p) => ['intermediary', 'partner', 'other'].includes(p.kind));

  return (
    <main style={{ minHeight: '100vh', background: '#f3f4f6', padding: '32px 16px' }} dir="rtl">
      {toast.node}
      <div style={{ maxWidth: 1150, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 'bold', color: '#1e3a8a' }}>تقسیم درآمد و ذی‌نفعان</h1>
          <div style={{ display: 'flex', gap: 14 }}>
            <a href="/admin/ledger" style={{ color: '#1e3a8a', fontSize: 14 }}>دفتر تسویه و آرشیو مالیاتی ←</a>
            <a href="/admin" style={{ color: '#6b7280', fontSize: 14, textDecoration: 'none' }}>← پنل اصلی</a>
          </div>
        </div>
        {missing && <div style={{ background: '#fef3c7', color: '#92400e', borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 14 }}>این بخش هنوز فعال نشده است. فایل 09_stage8_revenue_sharing.sql را اجرا کنید.</div>}

        <div style={{ background: '#eef2ff', borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 13, color: '#3730a3', lineHeight: 2 }}>
          برای هر درآمد (فاکتور خدمات یا سفارش فروشگاه)، «قالب تقسیم» مشخص می‌کند چند درصد پورسانت، بیمه، مالیات و سهم واسطه/شریک کم شود و «مانده» بین چه کسانی و با چه سهمی تقسیم شود. سهم هر ذی‌نفع هنگام ثبت درآمد در دفتر تسویه ذخیره می‌شود؛ تغییر قالب فقط برای درآمدهای جدید اعمال می‌شود.
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {([['templates', 'قالب‌های تقسیم'], ['parties', 'ذی‌نفعان و حساب‌ها'], ['links', 'واسطه‌ها و شرکا'], ['settings', 'شرایط آزادسازی پرداخت']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 'bold', background: tab === k ? '#1e3a8a' : 'white', color: tab === k ? 'white' : '#1e3a8a' }}>{l}</button>
          ))}
        </div>
        {loading && <p style={{ color: '#6b7280' }}>در حال بارگذاری...</p>}

        {/* ---------------- قالب‌ها ---------------- */}
        {!loading && tab === 'templates' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 280px) 1fr', gap: 16, alignItems: 'start' }}>
            <div style={{ background: 'white', borderRadius: 12, padding: 10 }}>
              {canCreate && <button onClick={() => openTpl(null)} style={{ ...btn('#1e3a8a'), width: '100%', padding: '9px', fontSize: 13, marginBottom: 8 }}>+ قالب جدید</button>}
              {templates.map((t) => (
                <div key={t.id} onClick={() => { setSelTpl(t.id); setPvRes(null); }} style={{ padding: '10px', borderRadius: 8, cursor: 'pointer', background: selTpl === t.id ? '#e0e7ff' : undefined, opacity: t.is_active ? 1 : 0.55, borderBottom: '1px solid #f3f4f6' }}>
                  <div style={{ fontWeight: 'bold', fontSize: 14 }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>{appliesLabel[t.applies_to]}{t.is_default ? ' · پیش‌فرض' : t.party_id ? ' · اختصاصی ' + partyName(t.party_id) : t.service_category_id ? ' · ' + (svcCats.find((c) => c.id === t.service_category_id)?.name || '') : t.product_category_id ? ' · ' + (prodCats.find((c) => c.id === t.product_category_id)?.name || '') : ''}</div>
                </div>
              ))}
            </div>

            {tpl ? (
              <div>
                <div style={{ background: 'white', borderRadius: 12, padding: 14, marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div><b>{tpl.name}</b> <span style={{ fontSize: 12, color: '#6b7280' }}>({appliesLabel[tpl.applies_to]}) {!tpl.is_active && <span style={badge('#fee2e2', '#dc2626')}>غیرفعال</span>}</span></div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {canEdit && <button onClick={() => openTpl(tpl)} style={btn('#dbeafe', '#1d4ed8')}>ویرایش قالب</button>}
                      {canDelete && !tpl.is_default && <button onClick={() => setDelTarget({ type: 'tpl', row: tpl })} style={btn('#fee2e2', '#dc2626')}>حذف قالب</button>}
                    </div>
                  </div>
                  {problems.length > 0 && <ul style={{ margin: '10px 0 0', paddingRight: 18, fontSize: 12, color: '#b45309', lineHeight: 1.9 }}>{problems.map((p, i) => <li key={i}>{p}</li>)}</ul>}
                </div>

                <div style={{ background: 'white', borderRadius: 12, overflowX: 'auto', marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12 }}>
                    <b style={{ fontSize: 14 }}>خطوط تقسیم (به ترتیب)</b>
                    {canCreate && <button onClick={() => openLine(null)} style={btn('#1e3a8a')}>+ خط جدید</button>}
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', minWidth: 760 }}>
                    <thead style={{ background: '#1e3a8a', color: 'white' }}><tr><th style={th}>ترتیب</th><th style={th}>عنوان</th><th style={th}>نوع</th><th style={th}>ذی‌نفع</th><th style={th}>درصد</th><th style={th}>مبنا</th><th style={th} /></tr></thead>
                    <tbody>
                      {tplLines.length === 0 ? <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>خطی تعریف نشده است</td></tr> : tplLines.map((l) => (
                        <tr key={l.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={td}>{l.sort_order}</td>
                          <td style={{ ...td, fontWeight: 'bold' }}>{l.label}{!l.show_to_payee && <span style={badge('#f3f4f6', '#6b7280')}>پنهان از تکنسین</span>}</td>
                          <td style={td}>{compLabel[l.component] || l.component}</td>
                          <td style={td}>{l.party_role === 'fixed' ? partyName(l.fixed_party_id) : roleLabel[l.party_role]}{l.party_role !== 'fixed' && l.fixed_party_id ? ' · ' + partyName(l.fixed_party_id) : ''}</td>
                          <td style={td}>{l.rate_source === 'category_commission' ? 'طبق درصد هر دسته' : money(l.rate_percent) + '٪'}</td>
                          <td style={{ ...td, fontSize: 12 }}>{basisLabel[l.basis]}</td>
                          <td style={td}><div style={{ display: 'flex', gap: 6 }}>
                            {canEdit && <button onClick={() => openLine(l)} style={btn('#dbeafe', '#1d4ed8')}>ویرایش</button>}
                            {canDelete && <button onClick={() => setDelTarget({ type: 'line', row: l })} style={btn('#fee2e2', '#dc2626')}>حذف</button>}
                          </div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ background: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: 12, padding: 14 }}>
                  <b style={{ fontSize: 14 }}>ماشین‌حساب (پیش‌نمایش با قالب‌های فعلی)</b>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                    <input inputMode="numeric" value={pv.subtotal} onChange={(e) => setPv({ ...pv, subtotal: e.target.value.replace(/[^0-9]/g, '') })} placeholder="جمع ردیف‌ها" style={{ ...inputStyle, width: 140 }} />
                    <input inputMode="numeric" value={pv.vat} onChange={(e) => setPv({ ...pv, vat: e.target.value.replace(/[^0-9]/g, '') })} placeholder="ارزش افزوده" style={{ ...inputStyle, width: 130 }} />
                    <select value={pv.subject} onChange={(e) => setPv({ ...pv, subject: e.target.value })} style={{ ...inputStyle, width: 'auto' }}>
                      <option value="">{tpl.applies_to === 'service_invoice' ? 'تکنسین...' : 'فروشنده...'}</option>
                      {(tpl.applies_to === 'service_invoice' ? techs.filter((t) => !t.deleted_at).map((t) => ({ id: t.id, n: t.full_name })) : sellers.filter((s) => !s.deleted_at).map((s) => ({ id: s.id, n: s.shop_name }))).map((o) => <option key={o.id} value={o.id}>{o.n}</option>)}
                    </select>
                    <select value={pv.category} onChange={(e) => setPv({ ...pv, category: e.target.value })} style={{ ...inputStyle, width: 'auto' }}>
                      <option value="">دسته (اختیاری)</option>
                      {(tpl.applies_to === 'service_invoice' ? svcCats : prodCats).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <button onClick={runPreview} style={{ ...btn('#7e22ce'), padding: '9px 16px', fontSize: 13 }}>محاسبه</button>
                  </div>
                  {pvErr && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{pvErr}</p>}
                  {pvRes && (
                    <div style={{ marginTop: 10, fontSize: 13, lineHeight: 2 }}>
                      <div style={{ color: '#6b7280' }}>قالب اعمال‌شده: {pvRes.template_name}</div>
                      {(pvRes.allocations || []).map((a: any) => (
                        <div key={a.line_no} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e5e7eb' }}>
                          <span>{a.label} <span style={{ color: '#9ca3af' }}>→ {a.party_name} ({kindLabel[a.party_kind] || a.party_kind})</span></span>
                          <b>{money(a.amount)}</b>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : <p style={{ color: '#9ca3af' }}>قالبی انتخاب نشده است.</p>}
          </div>
        )}

        {/* ---------------- ذی‌نفعان ---------------- */}
        {!loading && tab === 'parties' && (
          <>
            {canCreate && <button onClick={() => { setPartyForm({ kind: 'intermediary', name: '', national_id: '', economic_code: '', notes: '' }); setPartyEdit(null); setPartyErr(''); setPartyOpen('add'); }} style={{ ...btn('#1e3a8a'), padding: '9px 16px', fontSize: 13, marginBottom: 12 }}>+ ذی‌نفع جدید (واسطه، شریک، بیمه...)</button>}
            <div style={{ background: 'white', borderRadius: 12, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', minWidth: 760 }}>
                <thead style={{ background: '#1e3a8a', color: 'white' }}><tr><th style={th}>نام</th><th style={th}>نوع</th><th style={th}>کد ملی / کد اقتصادی</th><th style={th}>حساب بانکی</th><th style={th}>وضعیت</th><th style={th} /></tr></thead>
                <tbody>
                  {parties.map((p) => {
                    const acct = accounts[p.id];
                    const auto = p.kind === 'technician' || p.kind === 'seller';
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6', opacity: p.is_active ? 1 : 0.55 }}>
                        <td style={{ ...td, fontWeight: 'bold' }}>{p.name}</td>
                        <td style={td}>{kindLabel[p.kind]}</td>
                        <td style={{ ...td, fontSize: 12 }}>{p.national_id || '—'} / {p.economic_code || '—'}</td>
                        <td style={{ ...td, fontSize: 12 }}>{p.kind === 'technician' ? 'توسط خود تکنسین' : acct ? acct.holder_name + ' · ••••' + String(acct.iban).slice(-4) : (canBank || p.kind === 'tax_authority' || p.kind === 'insurance') ? 'ثبت نشده' : '—'}</td>
                        <td style={td}>{p.is_active ? <span style={badge('#d1fae5', '#065f46')}>فعال</span> : <span style={badge('#e5e7eb', '#4b5563')}>غیرفعال</span>}</td>
                        <td style={td}><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {canEdit && !auto && <button onClick={() => { setPartyForm({ kind: p.kind, name: p.name, national_id: p.national_id || '', economic_code: p.economic_code || '', notes: p.notes || '' }); setPartyEdit(p); setPartyErr(''); setPartyOpen('edit'); }} style={btn('#dbeafe', '#1d4ed8')}>ویرایش</button>}
                          {canBank && p.kind !== 'technician' && <button onClick={() => { setAcctForm({ iban: '', holder_name: acct?.holder_name || p.name, bank_name: acct?.bank_name || '', provider_account_id: acct?.provider_account_id || '' }); setAcctErr(''); setAcctParty(p); }} style={btn('#ccfbf1', '#0f766e')}>حساب بانکی</button>}
                          {canEdit && p.kind !== 'company' && <button onClick={() => toggleParty(p)} style={btn(p.is_active ? '#fef3c7' : '#d1fae5', p.is_active ? '#d97706' : '#065f46')}>{p.is_active ? 'غیرفعال' : 'فعال'}</button>}
                        </div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>ذی‌نفع «تکنسین» و «فروشنده» هنگام اولین درآمد خودکار ساخته می‌شود. شبای تکنسین را خود او در «گزارش مالی و تسویه» وارد می‌کند.</p>
          </>
        )}

        {/* ---------------- واسطه‌ها ---------------- */}
        {!loading && tab === 'links' && (
          <>
            <div style={{ background: '#fff7ed', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 13, color: '#9a3412', lineHeight: 2 }}>
              اینجا مشخص می‌کنید هر تکنسین یا فروشنده چه واسطه یا شریکی دارد. خط‌های قالب با نقش «واسطه/شریک همان تکنسین» درآمد را به همین ذی‌نفع می‌دهند؛ اگر درصد اختصاصی بگذارید، به‌جای درصد قالب اعمال می‌شود.
            </div>
            {canCreate && <button onClick={() => { setLinkForm({ subject_kind: 'technician', subject_id: '', role: 'intermediary', party_id: '', rate_percent: '' }); setLinkErr(''); setLinkOpen(true); }} style={{ ...btn('#1e3a8a'), padding: '9px 16px', fontSize: 13, marginBottom: 12 }}>+ اتصال جدید</button>}
            <div style={{ background: 'white', borderRadius: 12, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', minWidth: 640 }}>
                <thead style={{ background: '#1e3a8a', color: 'white' }}><tr><th style={th}>تکنسین / فروشنده</th><th style={th}>نقش</th><th style={th}>ذی‌نفع</th><th style={th}>درصد اختصاصی</th><th style={th} /></tr></thead>
                <tbody>
                  {links.length === 0 ? <tr><td colSpan={5} style={{ padding: 28, textAlign: 'center', color: '#9ca3af' }}>اتصالی ثبت نشده است</td></tr> : links.map((l) => (
                    <tr key={l.id} style={{ borderBottom: '1px solid #f3f4f6', opacity: l.is_active ? 1 : 0.55 }}>
                      <td style={td}>{l.subject_kind === 'technician' ? 'تکنسین' : 'فروشنده'}: <b>{subjectName(l.subject_kind, l.subject_id)}</b></td>
                      <td style={td}>{kindLabel[l.role]}</td>
                      <td style={td}>{partyName(l.party_id)}</td>
                      <td style={td}>{l.rate_percent != null ? money(l.rate_percent) + '٪' : 'طبق قالب'}</td>
                      <td style={td}><div style={{ display: 'flex', gap: 6 }}>
                        {canEdit && <button onClick={() => toggleLink(l)} style={btn(l.is_active ? '#fef3c7' : '#d1fae5', l.is_active ? '#d97706' : '#065f46')}>{l.is_active ? 'غیرفعال' : 'فعال'}</button>}
                        {canDelete && <button onClick={() => setLinkDel(l)} style={btn('#fee2e2', '#dc2626')}>حذف</button>}
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ---------------- شرایط ---------------- */}
        {!loading && tab === 'settings' && (
          <div style={{ background: 'white', borderRadius: 12, padding: 20, maxWidth: 560 }}>
            <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.9 }}>سهم ذی‌نفعان فقط وقتی «آماده‌ی پرداخت» می‌شود که همه‌ی شرایط فعال زیر برقرار باشد (و مشتری فاکتور را تأیید کرده باشد).</p>
            {([['require_customer_payment', 'پرداخت مشتری «تأییدشده» باشد (آنلاین از درگاه یا تأیید دستی مدیر مالی)'], ['require_customer_rating', 'رضایت‌سنجی مشتری ثبت شده باشد'], ['require_finance_approval', 'تأیید مدیر مالی انجام شده باشد']] as const).map(([k, l]) => (
              <label key={k} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 14, marginTop: 12, lineHeight: 1.8 }}>
                <input type="checkbox" checked={(settings as any)[k]} onChange={(e) => setSettings({ ...settings, [k]: e.target.checked })} style={{ marginTop: 4 }} /> {l}
              </label>
            ))}
            <Field label="تعداد روز نگهداری بعد از پرداخت مشتری (۰ = بدون نگهداری)"><input inputMode="numeric" value={settings.hold_days} onChange={(e) => setSettings({ ...settings, hold_days: e.target.value.replace(/[^0-9]/g, '') })} style={{ ...inputStyle, width: 120 }} /></Field>
            {canManage ? <button onClick={saveSettings} style={{ ...btn('#1e3a8a'), padding: '9px 20px', fontSize: 13, marginTop: 16 }}>ذخیره</button> : <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 12 }}>تغییر این شرایط نیاز به «مدیریت کامل» بخش مالی دارد.</p>}
          </div>
        )}
      </div>

      {partyOpen && (
        <Modal title={partyOpen === 'add' ? 'ذی‌نفع جدید' : 'ویرایش ذی‌نفع'} onClose={() => setPartyOpen(null)} width={460}>
          {partyOpen === 'add' && <Field label="نوع"><select value={partyForm.kind} onChange={(e) => setPartyForm({ ...partyForm, kind: e.target.value })} style={inputStyle}>{['intermediary', 'partner', 'insurance', 'tax_authority', 'other', 'company'].map((k) => <option key={k} value={k}>{kindLabel[k]}</option>)}</select></Field>}
          <Field label="نام *"><input value={partyForm.name} onChange={(e) => setPartyForm({ ...partyForm, name: e.target.value })} style={inputStyle} /></Field>
          <Field label="کد ملی / شناسه ملی"><input inputMode="numeric" value={partyForm.national_id} onChange={(e) => setPartyForm({ ...partyForm, national_id: e.target.value })} style={inputStyle} /></Field>
          <Field label="کد اقتصادی (برای گزارش مالیاتی)"><input inputMode="numeric" value={partyForm.economic_code} onChange={(e) => setPartyForm({ ...partyForm, economic_code: e.target.value })} style={inputStyle} /></Field>
          <Field label="یادداشت"><input value={partyForm.notes} onChange={(e) => setPartyForm({ ...partyForm, notes: e.target.value })} style={inputStyle} /></Field>
          {partyErr && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{partyErr}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button onClick={() => setPartyOpen(null)} style={{ ...btn('#e5e7eb', '#374151'), padding: '8px 18px', fontSize: 13 }}>انصراف</button>
            <button onClick={saveParty} style={{ ...btn('#1e3a8a'), padding: '8px 18px', fontSize: 13 }}>ذخیره</button>
          </div>
        </Modal>
      )}

      {acctParty && (
        <Modal title={'حساب بانکی — ' + acctParty.name} onClose={() => setAcctParty(null)} width={460}>
          <Field label="شماره شبا (IR…)"><input dir="ltr" value={acctForm.iban} onChange={(e) => setAcctForm({ ...acctForm, iban: e.target.value })} style={inputStyle} placeholder="IR000000000000000000000000" /></Field>
          <Field label="نام صاحب حساب *"><input value={acctForm.holder_name} onChange={(e) => setAcctForm({ ...acctForm, holder_name: e.target.value })} style={inputStyle} /></Field>
          <Field label="نام بانک"><input value={acctForm.bank_name} onChange={(e) => setAcctForm({ ...acctForm, bank_name: e.target.value })} style={inputStyle} /></Field>
          <Field label="شناسه‌ی حساب در زرین‌پال (برای اتصال بعدی، اختیاری)"><input dir="ltr" value={acctForm.provider_account_id} onChange={(e) => setAcctForm({ ...acctForm, provider_account_id: e.target.value })} style={inputStyle} /></Field>
          {acctErr && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{acctErr}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button onClick={() => setAcctParty(null)} style={{ ...btn('#e5e7eb', '#374151'), padding: '8px 18px', fontSize: 13 }}>انصراف</button>
            <button onClick={saveAccount} style={{ ...btn('#1e3a8a'), padding: '8px 18px', fontSize: 13 }}>ذخیره</button>
          </div>
        </Modal>
      )}

      {linkOpen && (
        <Modal title="اتصال واسطه/شریک" onClose={() => setLinkOpen(false)} width={460}>
          <Field label="مربوط به"><select value={linkForm.subject_kind} onChange={(e) => setLinkForm({ ...linkForm, subject_kind: e.target.value, subject_id: '' })} style={inputStyle}><option value="technician">تکنسین</option><option value="seller">فروشنده</option></select></Field>
          <Field label={linkForm.subject_kind === 'technician' ? 'تکنسین *' : 'فروشنده *'}>
            <select value={linkForm.subject_id} onChange={(e) => setLinkForm({ ...linkForm, subject_id: e.target.value })} style={inputStyle}>
              <option value="">انتخاب کنید...</option>
              {(linkForm.subject_kind === 'technician' ? techs.filter((t) => !t.deleted_at).map((t) => ({ id: t.id, n: t.full_name })) : sellers.filter((s) => !s.deleted_at).map((s) => ({ id: s.id, n: s.shop_name }))).map((o) => <option key={o.id} value={o.id}>{o.n}</option>)}
            </select>
          </Field>
          <Field label="نقش"><select value={linkForm.role} onChange={(e) => setLinkForm({ ...linkForm, role: e.target.value })} style={inputStyle}><option value="intermediary">واسطه</option><option value="partner">شریک تجاری</option></select></Field>
          <Field label="ذی‌نفع *"><select value={linkForm.party_id} onChange={(e) => setLinkForm({ ...linkForm, party_id: e.target.value })} style={inputStyle}><option value="">انتخاب کنید...</option>{linkableParties.map((p) => <option key={p.id} value={p.id}>{p.name} ({kindLabel[p.kind]})</option>)}</select></Field>
          <Field label="درصد اختصاصی (اختیاری؛ خالی = طبق قالب)"><input inputMode="decimal" value={linkForm.rate_percent} onChange={(e) => setLinkForm({ ...linkForm, rate_percent: e.target.value })} style={inputStyle} /></Field>
          {linkErr && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{linkErr}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button onClick={() => setLinkOpen(false)} style={{ ...btn('#e5e7eb', '#374151'), padding: '8px 18px', fontSize: 13 }}>انصراف</button>
            <button onClick={saveLink} style={{ ...btn('#1e3a8a'), padding: '8px 18px', fontSize: 13 }}>ذخیره</button>
          </div>
        </Modal>
      )}

      {tplOpen && (
        <Modal title={tplOpen === 'add' ? 'قالب تقسیم جدید' : 'ویرایش قالب'} onClose={() => setTplOpen(null)} width={500}>
          <Field label="نام قالب *"><input value={tplForm.name} onChange={(e) => setTplForm({ ...tplForm, name: e.target.value })} style={inputStyle} /></Field>
          <Field label="برای"><select value={tplForm.applies_to} onChange={(e) => setTplForm({ ...tplForm, applies_to: e.target.value, scope: 'default', scope_id: '' })} style={inputStyle}><option value="service_invoice">فاکتور خدمات تکنسین</option><option value="shop_order">سفارش فروشگاه</option></select></Field>
          <Field label="محدوده"><select value={tplForm.scope} onChange={(e) => setTplForm({ ...tplForm, scope: e.target.value, scope_id: '' })} style={inputStyle}>
            <option value="default">پیش‌فرض (برای همه)</option>
            <option value={tplForm.applies_to === 'service_invoice' ? 'service_category' : 'product_category'}>{tplForm.applies_to === 'service_invoice' ? 'یک نوع خدمت' : 'یک دسته‌ی کالا (و زیرمجموعه‌ها)'}</option>
            <option value="party">اختصاصی یک تکنسین/فروشنده/شریک</option>
          </select></Field>
          {tplForm.scope !== 'default' && (
            <Field label="انتخاب"><select value={tplForm.scope_id} onChange={(e) => setTplForm({ ...tplForm, scope_id: e.target.value })} style={inputStyle}>
              <option value="">انتخاب کنید...</option>
              {(tplForm.scope === 'service_category' ? svcCats : tplForm.scope === 'product_category' ? prodCats : parties.filter((p) => ['technician', 'seller'].includes(p.kind))).map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select></Field>
          )}
          <Field label="اولویت (عدد بزرگ‌تر مقدم)"><input inputMode="numeric" value={tplForm.priority} onChange={(e) => setTplForm({ ...tplForm, priority: e.target.value })} style={inputStyle} /></Field>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, marginTop: 10 }}><input type="checkbox" checked={tplForm.is_active} onChange={(e) => setTplForm({ ...tplForm, is_active: e.target.checked })} /> فعال</label>
          {tplErr && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{tplErr}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button onClick={() => setTplOpen(null)} style={{ ...btn('#e5e7eb', '#374151'), padding: '8px 18px', fontSize: 13 }}>انصراف</button>
            <button onClick={saveTpl} style={{ ...btn('#1e3a8a'), padding: '8px 18px', fontSize: 13 }}>ذخیره</button>
          </div>
        </Modal>
      )}

      {lineOpen && tpl && (
        <Modal title={lineOpen === 'add' ? 'خط جدید در «' + tpl.name + '»' : 'ویرایش خط'} onClose={() => setLineOpen(null)} width={540}>
          <Field label="عنوان (روی فاکتور/گزارش نمایش داده می‌شود) *"><input value={lineForm.label} onChange={(e) => setLineForm({ ...lineForm, label: e.target.value })} style={inputStyle} /></Field>
          <Field label="نوع"><select value={lineForm.component} onChange={(e) => setLineForm({ ...lineForm, component: e.target.value })} style={inputStyle}>{Object.keys(compLabel).filter((k) => k !== 'payee_net').map((k) => <option key={k} value={k}>{compLabel[k]}</option>)}</select></Field>
          <Field label="به چه کسی برود؟"><select value={lineForm.party_role} onChange={(e) => setLineForm({ ...lineForm, party_role: e.target.value })} style={inputStyle}>{Object.keys(roleLabel).map((k) => <option key={k} value={k}>{roleLabel[k]}</option>)}</select></Field>
          {['fixed', 'insurance', 'tax_authority'].includes(lineForm.party_role) && (
            <Field label={lineForm.party_role === 'fixed' ? 'ذی‌نفع ثابت *' : 'ذی‌نفع مشخص (اختیاری؛ خالی = پیش‌فرض همان نوع)'}>
              <select value={lineForm.fixed_party_id} onChange={(e) => setLineForm({ ...lineForm, fixed_party_id: e.target.value })} style={inputStyle}>
                <option value="">—</option>{parties.map((p) => <option key={p.id} value={p.id}>{p.name} ({kindLabel[p.kind]})</option>)}
              </select>
            </Field>
          )}
          <Field label="مبنای محاسبه"><select value={lineForm.basis} onChange={(e) => setLineForm({ ...lineForm, basis: e.target.value })} style={inputStyle}>{Object.keys(basisLabel).map((k) => <option key={k} value={k}>{basisLabel[k]}</option>)}</select></Field>
          {tpl.applies_to === 'shop_order' && lineForm.basis !== 'remaining' && (
            <Field label="منبع درصد"><select value={lineForm.rate_source} onChange={(e) => setLineForm({ ...lineForm, rate_source: e.target.value })} style={inputStyle}><option value="fixed">درصد ثابت همین خط</option><option value="category_commission">درصد کمیسیون هر دسته (از بخش مالی)</option></select></Field>
          )}
          {lineForm.rate_source === 'fixed' && <Field label={lineForm.basis === 'remaining' ? 'سهم از مانده (٪) — مجموع سهم‌های مانده باید ۱۰۰ شود' : 'درصد *'}><input inputMode="decimal" value={lineForm.rate_percent} onChange={(e) => setLineForm({ ...lineForm, rate_percent: e.target.value })} style={inputStyle} /></Field>}
          {['intermediary', 'partner'].includes(lineForm.party_role) && (
            <Field label="اگر واسطه/شریکی برای آن تکنسین/فروشنده ثبت نشده بود"><select value={lineForm.if_missing} onChange={(e) => setLineForm({ ...lineForm, if_missing: e.target.value })} style={inputStyle}><option value="skip">این خط محاسبه نشود</option><option value="company">به شرکت برسد</option></select></Field>
          )}
          <Field label="ترتیب"><input inputMode="numeric" value={lineForm.sort_order} onChange={(e) => setLineForm({ ...lineForm, sort_order: e.target.value })} style={inputStyle} /></Field>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginTop: 10 }}><input type="checkbox" checked={lineForm.show_to_payee} onChange={(e) => setLineForm({ ...lineForm, show_to_payee: e.target.checked })} /> مبلغ این خط روی فاکتور تکنسین/فروشنده نمایش داده شود (در غیر این صورت در «سایر کسورات» ادغام می‌شود)</label>
          {lineErr && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{lineErr}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button onClick={() => setLineOpen(null)} style={{ ...btn('#e5e7eb', '#374151'), padding: '8px 18px', fontSize: 13 }}>انصراف</button>
            <button onClick={saveLine} style={{ ...btn('#1e3a8a'), padding: '8px 18px', fontSize: 13 }}>ذخیره</button>
          </div>
        </Modal>
      )}

      {linkDel && <ReasonModal title="حذف اتصال" description="این اتصال حذف می‌شود؛ درآمدهای قبلی تغییر نمی‌کنند." confirmLabel="حذف" danger requireReason={false} onConfirm={() => delLink(linkDel)} onClose={() => setLinkDel(null)} />}
      {delTarget && <ReasonModal title={delTarget.type === 'tpl' ? 'حذف قالب' : 'حذف خط'} description="درآمدهای قبلی تغییر نمی‌کنند (سهم‌ها هنگام ثبت ذخیره شده‌اند)." confirmLabel="حذف" danger requireReason={false} onConfirm={doDelete} onClose={() => setDelTarget(null)} />}
    </main>
  );
}
