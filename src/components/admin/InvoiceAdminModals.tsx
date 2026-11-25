'use client';

import { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Field, Modal, btn, inputStyle } from '@/components/admin/ui';

export type PriceItem = { id: string; code: string | null; title: string; unit: string; unit_price: number; is_active: boolean };
export type EditorLine = { key: number; kind: 'service' | 'custom'; service_item_id: string; name: string; unit_price: string; quantity: string };

const money = (n: number | string | null | undefined) => Number(n || 0).toLocaleString('fa-IR');
let seq = 1000;
export const emptyLine = (kind: 'service' | 'custom' = 'service'): EditorLine => ({ key: seq++, kind, service_item_id: '', name: '', unit_price: '', quantity: '1' });

/** ردیف‌های فعلی فاکتور ← ردیف‌های قابل ویرایش */
export function linesFromItems(items: any[]): EditorLine[] {
  const out = items.map((it) => ({
    key: seq++,
    kind: (it.is_custom || !it.service_item_id ? 'custom' : 'service') as 'service' | 'custom',
    service_item_id: it.service_item_id || '',
    name: it.item_name || '',
    unit_price: it.unit_price != null ? String(it.unit_price) : String(it.price ?? ''),
    quantity: String(it.quantity ?? 1),
  }));
  return out.length ? out : [emptyLine()];
}

/** برای مدیر: قیمت واحد هر ردیف قابل تغییر است (اگر خالی بماند، قیمت فهرست بها) */
export function linesPayload(lines: EditorLine[]) {
  return lines
    .filter((l) => (l.kind === 'custom' ? l.name.trim() && Number(l.unit_price) > 0 : !!l.service_item_id))
    .map((l) =>
      l.kind === 'custom'
        ? { name: l.name.trim(), unit_price: Number(l.unit_price), quantity: Number(l.quantity) || 1 }
        : { service_item_id: l.service_item_id, quantity: Number(l.quantity) || 1, ...(l.unit_price.trim() ? { unit_price: Number(l.unit_price) } : {}) }
    );
}

export function LinesEditor({ lines, onChange, prices }: { lines: EditorLine[]; onChange: (l: EditorLine[]) => void; prices: PriceItem[] }) {
  const patch = (key: number, p: Partial<EditorLine>) => onChange(lines.map((l) => (l.key === key ? { ...l, ...p } : l)));
  return (
    <div>
      {lines.map((l) => (
        <div key={l.key} style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px dashed #e5e7eb', paddingBottom: 8 }}>
          {l.kind === 'custom' ? (
            <input value={l.name} onChange={(e) => patch(l.key, { name: e.target.value })} placeholder="نام قطعه / مورد" style={{ ...inputStyle, flex: 2, minWidth: 140, width: 'auto' }} />
          ) : (
            <select value={l.service_item_id} onChange={(e) => patch(l.key, { service_item_id: e.target.value })} style={{ ...inputStyle, flex: 2, minWidth: 180, width: 'auto' }}>
              <option value="">انتخاب خدمت...</option>
              {prices.map((p) => <option key={p.id} value={p.id}>{p.title}{p.is_active ? '' : ' (غیرفعال)'} — {money(p.unit_price)}</option>)}
            </select>
          )}
          <input inputMode="numeric" value={l.unit_price} onChange={(e) => patch(l.key, { unit_price: e.target.value.replace(/[^0-9]/g, '') })}
            placeholder={l.kind === 'custom' ? 'قیمت واحد' : 'قیمت (خالی = فهرست بها)'} style={{ ...inputStyle, width: 150 }} />
          <input inputMode="decimal" value={l.quantity} onChange={(e) => patch(l.key, { quantity: e.target.value.replace(/[^0-9.]/g, '') })} style={{ ...inputStyle, width: 70 }} aria-label="تعداد" />
          <button onClick={() => onChange(lines.length > 1 ? lines.filter((x) => x.key !== l.key) : lines)} disabled={lines.length === 1} style={btn('#fee2e2', '#dc2626')}>✕</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onChange([...lines, emptyLine('service')])} style={btn('#e0e7ff', '#1e3a8a')}>+ خدمت</button>
        <button onClick={() => onChange([...lines, emptyLine('custom')])} style={btn('#f3f4f6', '#374151')}>+ قطعه / سایر</button>
      </div>
    </div>
  );
}

/** افزودن فاکتور برای یک درخواست */
export function CreateInvoiceModal({ requests, techs, prices, onClose, onDone }: {
  requests: any[]; techs: any[]; prices: PriceItem[]; onClose: () => void; onDone: (msg: string) => void;
}) {
  const [reqId, setReqId] = useState('');
  const [search, setSearch] = useState('');
  const [techId, setTechId] = useState('');
  const [lines, setLines] = useState<EditorLine[]>([emptyLine()]);
  const [reason, setReason] = useState('');
  const [complete, setComplete] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const shown = useMemo(() => {
    const t = search.trim().toLowerCase();
    return requests.filter((r) => !t || String(r.request_no || '').includes(t) || (r.customer_name || '').toLowerCase().includes(t) || (r.phone || '').includes(t)).slice(0, 80);
  }, [requests, search]);
  const req = requests.find((r) => r.id === reqId);

  async function submit() {
    setErr('');
    if (!reqId) return setErr('یک درخواست انتخاب کنید');
    if (!req?.technician_id && !techId) return setErr('این درخواست تکنسین ندارد؛ یک تکنسین انتخاب کنید');
    const payload = linesPayload(lines);
    if (payload.length === 0) return setErr('حداقل یک ردیف کامل وارد کنید');
    if (!reason.trim()) return setErr('ثبت دلیل الزامی است');
    setBusy(true);
    const res = await supabase.rpc('admin_create_invoice', { p_request: reqId, p_lines: payload, p_reason: reason.trim(), p_technician: req?.technician_id ? null : techId, p_complete: complete });
    setBusy(false);
    if (res.error) return setErr(res.error.message);
    onDone('فاکتور شماره ' + (res.data?.invoice_no ?? '') + ' ثبت شد.');
  }

  return (
    <Modal title="افزودن فاکتور برای درخواست" onClose={() => !busy && onClose()} width={760}>
      <Field label="جستجوی درخواست (شماره، نام مشتری یا موبایل)"><input value={search} onChange={(e) => setSearch(e.target.value)} style={inputStyle} /></Field>
      <Field label="درخواست (فقط درخواست‌های بدون فاکتور) *">
        <select value={reqId} onChange={(e) => setReqId(e.target.value)} style={inputStyle} size={5}>
          {shown.map((r) => <option key={r.id} value={r.id}>#{r.request_no || '—'} · {r.customer_name || r.phone || ''} · {r.status}</option>)}
        </select>
      </Field>
      {req && !req.technician_id && (
        <Field label="تکنسین *">
          <select value={techId} onChange={(e) => setTechId(e.target.value)} style={inputStyle}>
            <option value="">انتخاب کنید...</option>
            {techs.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
          </select>
        </Field>
      )}
      <h4 style={{ fontSize: 14, margin: '14px 0 8px' }}>ردیف‌های فاکتور</h4>
      <LinesEditor lines={lines} onChange={setLines} prices={prices} />
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginTop: 12 }}>
        <input type="checkbox" checked={complete} onChange={(e) => setComplete(e.target.checked)} /> درخواست «انجام‌شده» شود
      </label>
      <Field label="دلیل ثبت *"><input value={reason} onChange={(e) => { setReason(e.target.value); setErr(''); }} style={inputStyle} /></Field>
      {err && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 10 }}>{err}</p>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
        <button onClick={onClose} disabled={busy} style={{ ...btn('#e5e7eb', '#374151'), padding: '8px 18px', fontSize: 13 }}>انصراف</button>
        <button onClick={submit} disabled={busy} style={{ ...btn('#1e3a8a'), padding: '8px 18px', fontSize: 13, opacity: busy ? 0.6 : 1 }}>{busy ? 'در حال ثبت...' : 'ثبت فاکتور'}</button>
      </div>
    </Modal>
  );
}

/** ویرایش ردیف‌های فاکتور */
export function EditInvoiceModal({ invoice, items, prices, isSuper, onClose, onDone }: {
  invoice: any; items: any[]; prices: PriceItem[]; isSuper: boolean; onClose: () => void; onDone: (msg: string) => void;
}) {
  const [lines, setLines] = useState<EditorLine[]>(() => linesFromItems(items));
  const [reason, setReason] = useState('');
  const [force, setForce] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit() {
    setErr('');
    const payload = linesPayload(lines);
    if (payload.length === 0) return setErr('حداقل یک ردیف کامل وارد کنید');
    if (!reason.trim()) return setErr('ثبت دلیل ویرایش الزامی است');
    setBusy(true);
    const res = await supabase.rpc('admin_update_invoice_lines', { p_invoice: invoice.id, p_lines: payload, p_reason: reason.trim(), p_force: force });
    setBusy(false);
    if (res.error) return setErr(res.error.message);
    onDone('فاکتور ویرایش شد. مبلغ جدید: ' + money(res.data?.total) + ' تومان (مشتری و مدیر مالی باید دوباره تأیید کنند).');
  }

  return (
    <Modal title={'ویرایش فاکتور #' + (invoice.invoice_no || '')} onClose={() => !busy && onClose()} width={760}>
      <p style={{ fontSize: 12, color: '#92400e', background: '#fef3c7', borderRadius: 8, padding: 10, lineHeight: 1.9 }}>
        با ذخیره، مبالغ و سهم‌ها دوباره محاسبه می‌شوند (با نرخ‌ها و قالب تقسیم فعلی) و تأیید مشتری و مدیر مالی از نو لازم می‌شود. اگر پرداخت یا تسویه ثبت شده باشد، ویرایش ممکن نیست و باید سند اصلاحی ثبت شود.
      </p>
      <LinesEditor lines={lines} onChange={setLines} prices={prices} />
      <Field label="دلیل ویرایش *"><input value={reason} onChange={(e) => { setReason(e.target.value); setErr(''); }} style={inputStyle} /></Field>
      {isSuper && (
        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, marginTop: 10, color: '#b91c1c', lineHeight: 1.8 }}>
          <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} style={{ marginTop: 4 }} />
          اجبار (فقط ادمین اصلی): ویرایش فاکتوری که پرداخت مشتری‌اش تأیید شده
        </label>
      )}
      {err && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 10 }}>{err}</p>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
        <button onClick={onClose} disabled={busy} style={{ ...btn('#e5e7eb', '#374151'), padding: '8px 18px', fontSize: 13 }}>انصراف</button>
        <button onClick={submit} disabled={busy} style={{ ...btn('#1e3a8a'), padding: '8px 18px', fontSize: 13, opacity: busy ? 0.6 : 1 }}>{busy ? 'در حال ذخیره...' : 'ذخیره‌ی تغییرات'}</button>
      </div>
    </Modal>
  );
}

/** حذف فاکتور */
export function DeleteInvoiceModal({ invoice, isSuper, onClose, onDone }: { invoice: any; isSuper: boolean; onClose: () => void; onDone: (msg: string) => void }) {
  const [reason, setReason] = useState('');
  const [force, setForce] = useState(false);
  const [reopen, setReopen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit() {
    setErr('');
    if (!reason.trim()) return setErr('ثبت دلیل حذف الزامی است');
    setBusy(true);
    const res = await supabase.rpc('admin_delete_invoice', { p_invoice: invoice.id, p_reason: reason.trim(), p_force: force, p_reopen_request: reopen });
    setBusy(false);
    if (res.error) return setErr(res.error.message);
    onDone('فاکتور حذف شد و در تاریخچه ثبت گردید.');
  }

  return (
    <Modal title={'حذف فاکتور #' + (invoice.invoice_no || '')} onClose={() => !busy && onClose()} width={500}>
      <p style={{ fontSize: 13, color: '#b91c1c', lineHeight: 1.9 }}>
        فاکتور و سهم‌های ثبت‌شده‌ی آن حذف می‌شود (غیرقابل برگشت از طریق Undo). اگر سهمی به ذی‌نفع پرداخت شده یا فاکتور در آرشیو مالیاتی ثبت شده باشد، حذف ممکن نیست؛ در آن صورت «ابطال» یا «سند اصلاحی» را استفاده کنید.
      </p>
      <Field label="دلیل حذف *"><input value={reason} onChange={(e) => { setReason(e.target.value); setErr(''); }} style={inputStyle} placeholder="مثلاً: فاکتور آزمایشی" /></Field>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginTop: 10 }}>
        <input type="checkbox" checked={reopen} onChange={(e) => setReopen(e.target.checked)} /> درخواست به «در حال انجام» برگردد (برای صدور دوباره‌ی فاکتور)
      </label>
      {isSuper && (
        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, marginTop: 8, color: '#b91c1c', lineHeight: 1.8 }}>
          <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} style={{ marginTop: 4 }} />
          اجبار (فقط ادمین اصلی): حذف فاکتور «پرداخت‌شده» (مثلاً داده‌ی آزمایشی)
        </label>
      )}
      {err && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 10 }}>{err}</p>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
        <button onClick={onClose} disabled={busy} style={{ ...btn('#e5e7eb', '#374151'), padding: '8px 18px', fontSize: 13 }}>انصراف</button>
        <button onClick={submit} disabled={busy} style={{ ...btn('#dc2626'), padding: '8px 18px', fontSize: 13, opacity: busy ? 0.6 : 1 }}>{busy ? 'در حال حذف...' : 'حذف فاکتور'}</button>
      </div>
    </Modal>
  );
}
