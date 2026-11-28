'use client';

import { useState } from 'react';
import { adminFetch } from '@/lib/adminRpc';
import { badge, btn, fmtDate, inputStyle, Modal, ReasonModal, useToast } from '@/components/admin/ui';

export default function UsersAccessPage() {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [blockTarget, setBlockTarget] = useState<any | null>(null);
  const [impLink, setImpLink] = useState<{ who: string; url: string } | null>(null);

  async function search() {
    setBusy(true); setInfo('');
    const r = await adminFetch('/api/admin/users', { action: 'search', q });
    setBusy(false);
    if (!r.ok) { setUsers([]); setInfo(r.error || 'ناموفق'); return; }
    setUsers(r.data.users || []);
    setInfo((r.data.users || []).length === 0 ? 'کاربری یافت نشد' : r.data.more ? 'فقط ۳۰ مورد اول نمایش داده شد؛ جست‌وجو را دقیق‌تر کنید' : '');
  }

  async function listBlocked() {
    setBusy(true); setInfo('');
    const r = await adminFetch('/api/admin/users', { action: 'blocked' });
    setBusy(false);
    if (!r.ok) { setUsers([]); setInfo(r.error || 'ناموفق'); return; }
    setUsers(r.data.users || []);
    setInfo((r.data.users || []).length === 0 ? 'کاربر مسدودی وجود ندارد' : '');
  }

  async function doBlock(u: any, reason: string) {
    const r = await adminFetch('/api/admin/users', { action: 'block', user_id: u.id, reason });
    if (!r.ok) { toast.show('err', r.error || 'ناموفق'); return; }
    toast.show('ok', 'ورود این کاربر مسدود شد.');
    setUsers((p) => p.map((x) => (x.id === u.id ? { ...x, banned: true, block_reason: reason } : x)));
  }

  async function impersonate(u: any) {
    const r = await adminFetch('/api/admin/users', { action: 'impersonate', user_id: u.id });
    if (!r.ok) { toast.show('err', r.error || 'ناموفق'); return; }
    setImpLink({ who: u.phone || u.email, url: r.data.url });
  }

  async function unblock(u: any) {
    if (!window.confirm('ورود این کاربر دوباره آزاد شود؟')) return;
    const r = await adminFetch('/api/admin/users', { action: 'unblock', user_id: u.id });
    if (!r.ok) { toast.show('err', r.error || 'ناموفق'); return; }
    toast.show('ok', 'مسدودیت برداشته شد.');
    setUsers((p) => p.map((x) => (x.id === u.id ? { ...x, banned: false } : x)));
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f3f4f6', padding: '32px 16px' }} dir="rtl">
      {toast.node}
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 'bold', color: '#1e3a8a' }}>مسدودسازی ورود کاربران</h1>
          <a href="/admin" style={{ color: '#1e3a8a', fontSize: 14, textDecoration: 'none' }}>← بازگشت به پنل اصلی</a>
        </div>

        <div style={{ background: 'white', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.9, marginBottom: 10 }}>
            شماره‌ی موبایل (یا بخشی از آن) یا ایمیل کاربر را بنویسید. کاربر مسدودشده دیگر نمی‌تواند وارد شود (نشستی که از قبل باز بوده ممکن است تا حدود یک ساعت بماند). مسدودسازی اطلاعات و سوابق کاربر را پاک نمی‌کند و هر زمان قابل برگشت است.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') search(); }} placeholder="مثلاً 0912 یا ایمیل" style={{ ...inputStyle, flex: 1, minWidth: 220, width: 'auto', direction: 'ltr' }} />
            <button onClick={search} disabled={busy || q.trim().length < 3} style={{ ...btn('#1e3a8a'), padding: '8px 20px', opacity: busy || q.trim().length < 3 ? 0.5 : 1 }}>جست‌وجو</button>
            <button onClick={listBlocked} disabled={busy} style={{ ...btn('#7f1d1d'), padding: '8px 20px' }}>فهرست مسدودشده‌ها</button>
          </div>
          {info && <p style={{ fontSize: 13, color: '#92400e', marginTop: 10 }}>{info}</p>}
        </div>

        {users.length > 0 && (
          <div style={{ background: 'white', borderRadius: 12, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', minWidth: 760 }}>
              <thead>
                <tr style={{ background: '#f9fafb', fontSize: 13, color: '#6b7280' }}>
                  <th style={{ padding: 12 }}>کاربر</th><th style={{ padding: 12 }}>نقش‌ها</th><th style={{ padding: 12 }}>آخرین ورود</th><th style={{ padding: 12 }}>وضعیت</th><th style={{ padding: 12 }}></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
                    <td style={{ padding: 10, direction: 'ltr', textAlign: 'right' }}>{u.phone || u.email}</td>
                    <td style={{ padding: 10 }}>{u.roles.length ? u.roles.join('، ') : 'مشتری'}</td>
                    <td style={{ padding: 10, color: '#6b7280' }}>{u.last_sign_in_at ? fmtDate(u.last_sign_in_at) : '—'}</td>
                    <td style={{ padding: 10 }}>
                      {u.banned ? <span style={badge('#fee2e2', '#991b1b')}>مسدود</span> : <span style={badge('#d1fae5', '#065f46')}>فعال</span>}
                      {u.block_reason && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>{u.block_reason}</div>}
                    </td>
                    <td style={{ padding: 10 }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {!u.banned && <button onClick={() => impersonate(u)} style={btn('#0891b2')}>ورود به‌جای او (تست)</button>}
                        {u.banned
                          ? <button onClick={() => unblock(u)} style={btn('#16a34a')}>رفع مسدودیت</button>
                          : <button onClick={() => setBlockTarget(u)} style={btn('#dc2626')}>مسدودسازی ورود</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {impLink && (
        <Modal title={'ورود آزمایشی به‌جای ' + impLink.who} onClose={() => setImpLink(null)} width={560}>
          <div style={{ background: '#fef3c7', color: '#92400e', borderRadius: 10, padding: 12, fontSize: 13, lineHeight: 1.9 }}>
            این لینک را فقط در یک پنجره‌ی <b>ناشناس (Incognito)</b> یا مرورگر دیگر باز کنید. اگر در همین مرورگر باز شود، از حساب ادمین خارج می‌شوید.
            لینک یک‌بارمصرف است و تا حدود یک ساعت اعتبار دارد. این ورود در تاریخچه ثبت می‌شود.
          </div>
          <textarea readOnly rows={4} value={impLink.url} onFocus={(e) => e.target.select()} style={{ ...inputStyle, direction: 'ltr', marginTop: 12, fontSize: 12 }} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <button onClick={() => { navigator.clipboard.writeText(impLink.url); toast.show('ok', 'لینک کپی شد.'); }} style={{ ...btn('#1e3a8a'), padding: '8px 18px', fontSize: 13 }}>کپی لینک</button>
            <button onClick={() => setImpLink(null)} style={{ ...btn('#e5e7eb', '#374151'), padding: '8px 18px', fontSize: 13 }}>بستن</button>
          </div>
        </Modal>
      )}

      {blockTarget && (
        <ReasonModal
          title={'مسدودسازی ورود ' + (blockTarget.phone || blockTarget.email)}
          description="کاربر دیگر نمی‌تواند وارد سایت شود. هر زمان می‌توانید مسدودیت را بردارید."
          confirmLabel="مسدودسازی"
          danger
          onConfirm={(reason) => doBlock(blockTarget, reason)}
          onClose={() => setBlockTarget(null)}
        />
      )}
    </main>
  );
}
