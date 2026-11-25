'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { adminFetch } from '@/lib/adminRpc';
import { PERM_MODULES, PERM_TYPES, can, type MyPerms } from '@/lib/permissions';
import { useMyPerms } from '@/lib/useMyPerms';
import { Field, Modal, ReasonModal, badge, btn, fmtDate, inputStyle, useToast } from '@/components/admin/ui';

type AdminRow = {
  id: string;
  user_id: string | null;
  is_super: boolean;
  is_active: boolean;
  full_name: string | null;
  notes: string | null;
  created_at: string | null;
};
type PermMap = Record<string, string[]>;

/** ماتریس دسترسی: ردیف = ماژول، ستون = نوع دسترسی */
function PermMatrix({ value, onChange, mine }: { value: PermMap; onChange: (v: PermMap) => void; mine: MyPerms | null }) {
  const has = (m: string, p: string) => (value[m] || []).includes(p);
  const allowed = (m: string, p: string) => !mine || mine.super || can(mine, m, p);

  function toggle(m: string, p: string, on: boolean) {
    const cur = new Set(value[m] || []);
    if (on) {
      cur.add(p);
      if (p !== 'view' && p !== 'manage') cur.add('view');
    } else {
      cur.delete(p);
      if (p === 'view') { cur.clear(); }
      if (p === 'manage') { /* فقط خود «مدیریت کامل» برداشته می‌شود */ }
    }
    const next = { ...value };
    if (cur.size === 0) delete next[m]; else next[m] = Array.from(cur);
    onChange(next);
  }

  function setColumn(p: string, on: boolean) {
    let next = { ...value };
    PERM_MODULES.forEach((mod) => {
      if (!allowed(mod.key, p)) return;
      const cur = new Set(next[mod.key] || []);
      if (on) { cur.add(p); if (p !== 'view' && p !== 'manage') cur.add('view'); }
      else { cur.delete(p); if (p === 'view') cur.clear(); }
      if (cur.size === 0) { const { [mod.key]: _x, ...rest } = next; next = rest; } else next[mod.key] = Array.from(cur);
    });
    onChange(next);
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <button type="button" onClick={() => onChange({})} style={btn('#e5e7eb', '#374151')}>هیچ دسترسی</button>
        <button type="button" onClick={() => setColumn('view', true)} style={btn('#dbeafe', '#1d4ed8')}>مشاهده‌ی همه‌ی بخش‌ها</button>
      </div>
      <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'center', minWidth: 760 }}>
          <thead>
            <tr style={{ background: '#f3f4f6' }}>
              <th style={{ padding: 8, textAlign: 'right' }}>بخش</th>
              {PERM_TYPES.map((p) => (
                <th key={p.key} style={{ padding: 6 }}>
                  <div>{p.label}</div>
                  <input type="checkbox" aria-label={'انتخاب ستون ' + p.label}
                    checked={PERM_MODULES.every((m) => has(m.key, p.key) || !allowed(m.key, p.key)) && PERM_MODULES.some((m) => has(m.key, p.key))}
                    onChange={(e) => setColumn(p.key, e.target.checked)} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERM_MODULES.map((m) => (
              <tr key={m.key} style={{ borderTop: '1px solid #f3f4f6', background: (value[m.key] || []).length ? '#f0f9ff' : undefined }}>
                <td style={{ padding: 8, textAlign: 'right', fontWeight: 'bold' }}>{m.label}</td>
                {PERM_TYPES.map((p) => (
                  <td key={p.key} style={{ padding: 6 }}>
                    <input type="checkbox" disabled={!allowed(m.key, p.key)} checked={has(m.key, p.key) || (has(m.key, 'manage') && p.key !== 'manage')}
                      onChange={(e) => toggle(m.key, p.key, e.target.checked)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 12, color: '#6b7280', marginTop: 6, lineHeight: 1.9 }}>
        «مدیریت کامل» همه‌ی دسترسی‌های همان بخش را می‌دهد. هر دسترسی دیگر خودکار «مشاهده» را هم فعال می‌کند. اگر مجوزی غیرفعال (خاکستری) است، یعنی خودتان آن را ندارید و نمی‌توانید به دیگری بدهید.
      </p>
    </div>
  );
}

export default function AdminAdminsPage() {
  const toast = useToast();
  const mine = useMyPerms();
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [perms, setPerms] = useState<Record<string, PermMap>>({});
  const [phones, setPhones] = useState<Record<string, string>>({});
  const [myUserId, setMyUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ phone: '', full_name: '', password: '', notes: '', is_super: false });
  const [formPerms, setFormPerms] = useState<PermMap>({});
  const [formErr, setFormErr] = useState('');
  const [busy, setBusy] = useState(false);

  const [editTarget, setEditTarget] = useState<AdminRow | null>(null);
  const [editPerms, setEditPerms] = useState<PermMap>({});
  const [resetTarget, setResetTarget] = useState<AdminRow | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetErr, setResetErr] = useState('');
  const [revokeTarget, setRevokeTarget] = useState<AdminRow | null>(null);

  const load = useCallback(async () => {
    const [a, p, u] = await Promise.all([
      supabase.from('admins').select('*').order('created_at', { ascending: false }),
      supabase.from('admin_permissions').select('admin_id,module,perm'),
      supabase.rpc('admin_list_users'),
    ]);
    if (a.error) {
      if (/is_super|admin_permissions|column|schema cache/i.test(a.error.message)) setMissing(true);
      else toast.show('err', a.error.message);
    }
    if (p.error && /admin_permissions|schema cache/i.test(p.error.message)) setMissing(true);
    setRows((a.data as AdminRow[]) || []);
    const map: Record<string, PermMap> = {};
    ((p.data as any[]) || []).forEach((x) => {
      map[x.admin_id] = map[x.admin_id] || {};
      (map[x.admin_id][x.module] = map[x.admin_id][x.module] || []).push(x.perm);
    });
    setPerms(map);
    const ph: Record<string, string> = {};
    ((u.data as any[]) || []).forEach((x) => (ph[x.id] = x.phone));
    setPhones(ph);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      const userRes = await supabase.auth.getUser();
      const user = userRes.data.user;
      if (!user) { window.location.href = '/auth'; return; }
      setMyUserId(user.id);
      const adminRes = await supabase.from('admins').select('id').eq('user_id', user.id).maybeSingle();
      if (!adminRes.data) { window.location.href = '/'; return; }
      load();
    })();
  }, [load]);

  const moduleCount = (id: string) => Object.keys(perms[id] || {}).length;
  const isSuperViewer = !!mine.perms?.super;

  async function call(payload: Record<string, unknown>, okMsg: string): Promise<boolean> {
    const res = await adminFetch('/api/admin/admins', payload);
    if (!res.ok) { toast.show('err', res.error || 'ناموفق'); return false; }
    toast.show('ok', okMsg);
    load();
    return true;
  }

  async function submitCreate() {
    setFormErr('');
    if (!/^09[0-9]{9}$/.test(form.phone.trim())) { setFormErr('شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد'); return; }
    if (!form.full_name.trim()) { setFormErr('نام مدیر الزامی است'); return; }
    setBusy(true);
    const res = await adminFetch('/api/admin/admins', {
      action: 'create', phone: form.phone.trim(), full_name: form.full_name.trim(), password: form.password,
      notes: form.notes.trim(), is_super: form.is_super, perms: form.is_super ? {} : formPerms,
    });
    setBusy(false);
    if (!res.ok) { setFormErr(res.error || 'ناموفق'); return; }
    toast.show('ok', res.data?.linkedExistingAccount ? 'مدیر به حساب موجود همین شماره متصل شد.' : 'مدیر جدید ساخته شد. رمز اولیه را به او اطلاع دهید.');
    setCreateOpen(false);
    load();
  }

  async function saveEdit() {
    if (!editTarget) return;
    setBusy(true);
    const ok = await call({ action: 'set_permissions', admin_id: editTarget.id, perms: editPerms }, 'دسترسی‌ها ذخیره شد و همین حالا اعمال می‌شود.');
    setBusy(false);
    if (ok) setEditTarget(null);
  }

  async function submitReset() {
    if (!resetTarget) return;
    if (newPassword.length < 8) { setResetErr('رمز عبور حداقل ۸ کاراکتر باشد'); return; }
    setBusy(true);
    const ok = await call({ action: 'reset_password', admin_id: resetTarget.id, password: newPassword }, 'رمز تغییر کرد و نشست‌های قبلی ابطال شد.');
    setBusy(false);
    setNewPassword('');
    if (ok) setResetTarget(null); else setResetErr('تغییر رمز انجام نشد');
  }

  const th = { padding: '12px' } as const;
  const td = { padding: '10px 12px' } as const;

  const rowsSorted = useMemo(() => rows.slice().sort((a, b) => Number(b.is_super) - Number(a.is_super)), [rows]);

  return (
    <main style={{ minHeight: '100vh', background: '#f3f4f6', padding: '32px 16px' }} dir="rtl">
      {toast.node}
      <div style={{ maxWidth: 1150, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 'bold', color: '#1e3a8a' }}>مدیران و سطح دسترسی</h1>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {can(mine.perms, 'admins', 'create') && (
              <button onClick={() => { setForm({ phone: '', full_name: '', password: '', notes: '', is_super: false }); setFormPerms({}); setFormErr(''); setCreateOpen(true); }}
                style={{ ...btn('#1e3a8a'), padding: '9px 16px', fontSize: 13 }}>+ مدیر جدید</button>
            )}
            <a href="/admin" style={{ color: '#1e3a8a', fontSize: 14, textDecoration: 'none' }}>← بازگشت به پنل اصلی</a>
          </div>
        </div>

        {missing && (
          <div style={{ background: '#fef3c7', color: '#92400e', borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 14 }}>
            سیستم مجوزها هنوز فعال نشده است. فایل 04_stage3_permissions_security.sql را در Supabase اجرا کنید.
          </div>
        )}

        <div style={{ background: '#eef2ff', borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 13, color: '#3730a3', lineHeight: 2 }}>
          دسترسی‌ها در دیتابیس و API اعمال می‌شوند، نه فقط در منوها؛ تغییر دسترسی همین حالا اثر می‌کند. «ادمین اصلی» دسترسی کامل دارد. مدیر عادی نمی‌تواند دسترسی خودش یا دیگران را بیشتر از آنچه دارد ارتقا دهد.
        </div>

        <div style={{ background: 'white', borderRadius: 12, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', minWidth: 880 }}>
            <thead style={{ background: '#1e3a8a', color: 'white' }}>
              <tr>
                <th style={th}>نام</th>
                <th style={th}>موبایل</th>
                <th style={th}>نقش</th>
                <th style={th}>بخش‌های دارای دسترسی</th>
                <th style={th}>ایجاد</th>
                <th style={th}>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#6b7280' }}>در حال بارگذاری...</td></tr>
              ) : rowsSorted.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>مدیری یافت نشد</td></tr>
              ) : rowsSorted.map((r) => {
                const self = r.user_id === myUserId;
                const locked = self || (r.is_super && !isSuperViewer);
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6', opacity: r.is_active ? 1 : 0.6 }}>
                    <td style={{ ...td, fontWeight: 'bold' }}>{r.full_name || '—'}{self && <span style={badge('#e0e7ff', '#3730a3')}>شما</span>}</td>
                    <td style={{ ...td, color: '#6b7280' }}>{r.user_id ? phones[r.user_id] || '—' : '—'}</td>
                    <td style={td}>
                      {r.is_super ? <span style={badge('#fef3c7', '#b45309')}>ادمین اصلی</span> : <span style={badge('#dbeafe', '#1d4ed8')}>مدیر محدود</span>}
                      {!r.is_active && <span style={badge('#fee2e2', '#dc2626')}>غیرفعال</span>}
                    </td>
                    <td style={td}>{r.is_super ? 'همه' : moduleCount(r.id).toLocaleString('fa-IR') + ' بخش'}</td>
                    <td style={{ ...td, fontSize: 12, color: '#6b7280' }}>{fmtDate(r.created_at)}</td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {!r.is_super && can(mine.perms, 'admins', 'edit') && !locked && (
                          <button onClick={() => { setEditPerms(perms[r.id] || {}); setEditTarget(r); }} style={btn('#dbeafe', '#1d4ed8')}>دسترسی‌ها</button>
                        )}
                        {can(mine.perms, 'admins', 'edit') && !locked && (
                          <button onClick={() => call({ action: 'set_active', admin_id: r.id, active: !r.is_active }, r.is_active ? 'مدیر غیرفعال شد.' : 'مدیر فعال شد.')}
                            style={btn(r.is_active ? '#fef3c7' : '#d1fae5', r.is_active ? '#d97706' : '#065f46')}>{r.is_active ? 'غیرفعال‌سازی' : 'فعال‌سازی'}</button>
                        )}
                        {can(mine.perms, 'admins', 'edit') && !locked && <button onClick={() => setRevokeTarget(r)} style={btn('#fee2e2', '#dc2626')}>ابطال نشست‌ها</button>}
                        {can(mine.perms, 'admins', 'edit') && !locked && <button onClick={() => { setNewPassword(''); setResetErr(''); setResetTarget(r); }} style={btn('#f3e8ff', '#7e22ce')}>رمز جدید</button>}
                        {isSuperViewer && !self && (
                          <button onClick={() => call({ action: 'set_super', admin_id: r.id, super: !r.is_super }, r.is_super ? 'به مدیر محدود تبدیل شد.' : 'به ادمین اصلی ارتقا یافت.')}
                            style={btn('#e5e7eb', '#374151')}>{r.is_super ? 'تنزل نقش' : 'ارتقا به ادمین اصلی'}</button>
                        )}
                        {r.user_id && <a href={'/admin/history?actor=' + r.user_id} style={{ ...btn('#e0e7ff', '#1e3a8a'), textDecoration: 'none', display: 'inline-block' }}>سوابق فعالیت</a>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {createOpen && (
        <Modal title="مدیر جدید" onClose={() => !busy && setCreateOpen(false)} width={860}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <Field label="نام و نام خانوادگی *"><input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} style={inputStyle} /></Field>
            <Field label="موبایل (نام کاربری ورود) *"><input inputMode="numeric" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={inputStyle} placeholder="09123456789" /></Field>
            <Field label="رمز عبور اولیه (حداقل ۸ کاراکتر؛ اگر این شماره حساب دارد خالی بگذارید)">
              <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} style={inputStyle} />
            </Field>
          </div>
          <Field label="یادداشت"><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={inputStyle} /></Field>
          {isSuperViewer && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 14 }}>
              <input type="checkbox" checked={form.is_super} onChange={(e) => setForm({ ...form, is_super: e.target.checked })} />
              ادمین اصلی (دسترسی کامل به همه‌ی بخش‌ها)
            </label>
          )}
          {!form.is_super && (
            <div style={{ marginTop: 14 }}>
              <PermMatrix value={formPerms} onChange={setFormPerms} mine={mine.perms} />
            </div>
          )}
          {formErr && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 10 }}>{formErr}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button onClick={() => setCreateOpen(false)} disabled={busy} style={{ ...btn('#e5e7eb', '#374151'), padding: '8px 18px', fontSize: 13 }}>انصراف</button>
            <button onClick={submitCreate} disabled={busy} style={{ ...btn('#1e3a8a'), padding: '8px 18px', fontSize: 13, opacity: busy ? 0.6 : 1 }}>{busy ? 'در حال ساخت...' : 'ساخت مدیر'}</button>
          </div>
        </Modal>
      )}

      {editTarget && (
        <Modal title={'دسترسی‌های ' + (editTarget.full_name || 'مدیر')} onClose={() => !busy && setEditTarget(null)} width={860}>
          <PermMatrix value={editPerms} onChange={setEditPerms} mine={mine.perms} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button onClick={() => setEditTarget(null)} disabled={busy} style={{ ...btn('#e5e7eb', '#374151'), padding: '8px 18px', fontSize: 13 }}>انصراف</button>
            <button onClick={saveEdit} disabled={busy} style={{ ...btn('#1e3a8a'), padding: '8px 18px', fontSize: 13, opacity: busy ? 0.6 : 1 }}>{busy ? 'در حال ذخیره...' : 'ذخیره‌ی دسترسی‌ها'}</button>
          </div>
        </Modal>
      )}

      {resetTarget && (
        <Modal title={'رمز جدید برای ' + (resetTarget.full_name || 'مدیر')} onClose={() => !busy && setResetTarget(null)} width={440}>
          <Field label="رمز عبور جدید (حداقل ۸ کاراکتر)"><input value={newPassword} onChange={(e) => { setNewPassword(e.target.value); setResetErr(''); }} style={inputStyle} /></Field>
          <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>با تغییر رمز، همه‌ی نشست‌های فعال این مدیر ابطال می‌شود.</p>
          {resetErr && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{resetErr}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button onClick={() => setResetTarget(null)} disabled={busy} style={{ ...btn('#e5e7eb', '#374151'), padding: '8px 18px', fontSize: 13 }}>انصراف</button>
            <button onClick={submitReset} disabled={busy} style={{ ...btn('#7e22ce'), padding: '8px 18px', fontSize: 13 }}>{busy ? 'در حال انجام...' : 'تغییر رمز'}</button>
          </div>
        </Modal>
      )}

      {revokeTarget && (
        <ReasonModal
          title={'ابطال نشست‌های ' + (revokeTarget.full_name || 'مدیر')}
          description="همه‌ی دستگاه‌هایی که این مدیر با آن‌ها وارد شده خارج می‌شوند و دسترسی مدیریتی‌شان فوراً قطع می‌شود."
          confirmLabel="ابطال نشست‌ها"
          danger
          requireReason={false}
          onConfirm={async () => { await call({ action: 'revoke_sessions', admin_id: revokeTarget.id }, 'نشست‌های مدیر ابطال شد.'); }}
          onClose={() => setRevokeTarget(null)}
        />
      )}
    </main>
  );
}
