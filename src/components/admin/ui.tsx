'use client';

import { useCallback, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

export const inputStyle: CSSProperties = {
  width: '100%',
  border: '1px solid #d1d5db',
  borderRadius: 8,
  padding: '8px 12px',
  boxSizing: 'border-box',
  fontSize: 14,
  background: 'white',
};

export const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 13,
  color: '#374151',
  marginBottom: 4,
  marginTop: 12,
};

export function btn(bg: string, color = 'white'): CSSProperties {
  return {
    background: bg,
    color,
    border: 'none',
    borderRadius: 6,
    padding: '4px 12px',
    cursor: 'pointer',
    fontSize: 12,
  };
}

export const badge = (bg: string, color: string): CSSProperties => ({
  display: 'inline-block',
  padding: '3px 8px',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 'bold',
  background: bg,
  color,
  marginLeft: 4,
});

/** پیام موفقیت/خطا که نتیجه‌ی هر عملیات را به مدیر نشان می‌دهد */
export function useToast() {
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((type: 'ok' | 'err', text: string) => {
    setToast({ type, text });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), type === 'err' ? 9000 : 4500);
  }, []);

  const node = toast ? (
    <div
      role="status"
      onClick={() => setToast(null)}
      style={{
        position: 'fixed',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 2000,
        maxWidth: '90vw',
        padding: '12px 20px',
        borderRadius: 10,
        fontSize: 14,
        fontWeight: 'bold',
        cursor: 'pointer',
        boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
        background: toast.type === 'ok' ? '#d1fae5' : '#fee2e2',
        color: toast.type === 'ok' ? '#065f46' : '#b91c1c',
      }}
    >
      {toast.type === 'ok' ? '✓ ' : '✕ '}
      {toast.text}
    </div>
  ) : null;

  return { show, node };
}

export function Modal({
  title,
  onClose,
  children,
  width = 560,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        overflowY: 'auto',
        padding: '32px 12px',
      }}
    >
      <div
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'white', borderRadius: 14, width: '100%', maxWidth: width, padding: 20, boxShadow: '0 10px 30px rgba(0,0,0,0.25)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h2 style={{ fontSize: 17, fontWeight: 'bold', color: '#1e3a8a', margin: 0 }}>{title}</h2>
          <button onClick={onClose} aria-label="بستن" style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280' }}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** پنجره‌ی تأیید عملیات حساس؛ در صورت نیاز دلیل را می‌گیرد */
export function ReasonModal({
  title,
  description,
  confirmLabel = 'تأیید',
  danger = false,
  requireReason = true,
  onConfirm,
  onClose,
}: {
  title: string;
  description?: string;
  confirmLabel?: string;
  danger?: boolean;
  requireReason?: boolean;
  onConfirm: (reason: string) => Promise<void> | void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit() {
    if (requireReason && !reason.trim()) {
      setErr('ثبت دلیل الزامی است');
      return;
    }
    setBusy(true);
    await onConfirm(reason.trim());
    setBusy(false);
    onClose();
  }

  return (
    <Modal title={title} onClose={busy ? () => {} : onClose} width={460}>
      {description && <p style={{ fontSize: 14, color: '#4b5563', lineHeight: 1.8 }}>{description}</p>}
      {requireReason && (
        <>
          <label style={labelStyle}>دلیل *</label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setErr('');
            }}
            style={inputStyle}
          />
        </>
      )}
      {err && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{err}</p>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
        <button onClick={onClose} disabled={busy} style={{ ...btn('#e5e7eb', '#374151'), padding: '8px 18px', fontSize: 13 }}>
          انصراف
        </button>
        <button onClick={submit} disabled={busy} style={{ ...btn(danger ? '#dc2626' : '#1e3a8a'), padding: '8px 18px', fontSize: 13, opacity: busy ? 0.6 : 1 }}>
          {busy ? 'در حال انجام...' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

export function fmtDate(v: string | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fa-IR') + ' ' + d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
}

/** خروجی CSV سازگار با اکسل (BOM + escape صحیح) */
export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? '' : String(v);
    // جلوگیری از اجرای فرمول در اکسل
    const safe = /^[=+\-@]/.test(s) ? "'" + s : s;
    return '"' + safe.replace(/"/g, '""') + '"';
  };
  const csv = rows.map((r) => r.map(esc).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const ACTION_LABEL: Record<string, string> = {
  create: 'ایجاد',
  create_by_admin: 'ایجاد توسط مدیر',
  update: 'ویرایش',
  archive: 'حذف / بایگانی',
  restore: 'بازیابی',
  delete: 'حذف قطعی',
  cancel: 'لغو',
};

function short(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return s.length > 40 ? s.slice(0, 40) + '…' : s;
}

export type AuditRow = {
  id: number;
  created_at: string;
  action: string;
  actor_id: string | null;
  reason: string | null;
  changed_fields: string[] | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
};

/** نمایش تاریخچه‌ی تغییرات یک رکورد: چه کسی، چه زمانی، چه چیزی (مقدار قبل و بعد) */
export function AuditTimeline({ rows, actors }: { rows: AuditRow[]; actors: Record<string, string> }) {
  if (rows.length === 0) {
    return <p style={{ fontSize: 13, color: '#9ca3af' }}>سابقه‌ای ثبت نشده است.</p>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((r) => {
        const fields = (r.changed_fields || []).filter((f) => f !== 'updated_at');
        return (
          <div key={r.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <b style={{ color: '#1e3a8a' }}>{ACTION_LABEL[r.action] || r.action}</b>
              <span style={{ color: '#6b7280' }}>{fmtDate(r.created_at)}</span>
            </div>
            <div style={{ color: '#6b7280', marginTop: 2 }}>
              توسط: {r.actor_id ? actors[r.actor_id] || 'مدیر (' + r.actor_id.slice(0, 6) + ')' : 'سیستم'}
            </div>
            {r.reason && <div style={{ marginTop: 2 }}>دلیل: {r.reason}</div>}
            {r.action === 'update' && fields.length > 0 && (
              <ul style={{ margin: '6px 0 0', paddingRight: 18, color: '#374151' }}>
                {fields.slice(0, 8).map((f) => (
                  <li key={f}>
                    {f}: <span style={{ color: '#b91c1c' }}>{short(r.old_data?.[f])}</span> ← <span style={{ color: '#065f46' }}>{short(r.new_data?.[f])}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
