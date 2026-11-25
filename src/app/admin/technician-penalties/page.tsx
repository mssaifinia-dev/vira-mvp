'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { adminRpc } from '@/lib/adminRpc';
import { can } from '@/lib/permissions';
import { useMyPerms } from '@/lib/useMyPerms';
import { Field, Modal, ReasonModal, badge, btn, fmtDate, inputStyle, useToast } from '@/components/admin/ui';

type Tech = { id: string; full_name: string; phone: string; city: string; restricted_until: string | null; restriction_reason: string | null; is_active: boolean | null; deleted_at?: string | null };
type Release = { id: string; request_id: string; technician_id: string; from_status: string; reason: string; claims_justified: boolean; review_status: 'none' | 'pending' | 'justified' | 'unjustified'; review_note: string | null; created_at: string };
type Penalty = { id: string; technician_id: string; release_id: string | null; points: number; reason: string; status: 'active' | 'annulled'; created_at: string; annul_reason: string | null };
type Policy = { penalty_points: number; restrict_after: number; window_days: number; restrict_hours: number };

const reviewLabel: Record<string, [string, string, string]> = {
  none: ['بدون درخواست بررسی', '#f3f4f6', '#6b7280'],
  pending: ['در انتظار بررسی مدیر', '#fef3c7', '#d97706'],
  justified: ['موجه شناخته شد', '#d1fae5', '#065f46'],
  unjustified: ['غیرموجه شناخته شد', '#fee2e2', '#dc2626'],
};

export default function TechnicianPenaltiesPage() {
  const toast = useToast();
  const mine = useMyPerms();
  const [tab, setTab] = useState<'techs' | 'releases' | 'penalties' | 'policy'>('releases');
  const [techs, setTechs] = useState<Tech[]>([]);
  const [releases, setReleases] = useState<Release[]>([]);
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [policyForm, setPolicyForm] = useState({ penalty_points: '5', restrict_after: '3', window_days: '30', restrict_hours: '48' });
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [onlyPending, setOnlyPending] = useState(true);

  const [reviewTarget, setReviewTarget] = useState<Release | null>(null);
  const [reviewJustified, setReviewJustified] = useState(true);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewErr, setReviewErr] = useState('');
  const [annulTarget, setAnnulTarget] = useState<Penalty | null>(null);
  const [restrictTarget, setRestrictTarget] = useState<Tech | null>(null);
  const [restrictHours, setRestrictHours] = useState('48');
  const [restrictReason, setRestrictReason] = useState('');
  const [restrictErr, setRestrictErr] = useState('');
  const [clearTarget, setClearTarget] = useState<Tech | null>(null);

  const load = useCallback(async () => {
    const [t, r, p, pol] = await Promise.all([
      supabase.from('technicians').select('id,full_name,phone,city,restricted_until,restriction_reason,is_active,deleted_at').order('full_name'),
      supabase.from('technician_releases').select('*').order('created_at', { ascending: false }).limit(300),
      supabase.from('technician_penalties').select('*').order('created_at', { ascending: false }).limit(400),
      supabase.from('technician_policy').select('*').eq('id', 1).maybeSingle(),
    ]);
    if (r.error || pol.error) {
      if (/technician_releases|technician_policy|restricted_until|schema cache|relation|column/i.test((r.error || pol.error)!.message)) setMissing(true);
    }
    setTechs(((t.data as Tech[]) || []).filter((x) => !x.deleted_at));
    setReleases((r.data as Release[]) || []);
    setPenalties((p.data as Penalty[]) || []);
    if (pol.data) {
      const d = pol.data as Policy;
      setPolicy(d);
      setPolicyForm({ penalty_points: String(d.penalty_points), restrict_after: String(d.restrict_after), window_days: String(d.window_days), restrict_hours: String(d.restrict_hours) });
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

  const techName = useMemo(() => { const m: Record<string, string> = {}; techs.forEach((t) => (m[t.id] = t.full_name)); return m; }, [techs]);
  const stats = useMemo(() => {
    const m: Record<string, { releases: number; afterAccept: number; points: number; pending: number }> = {};
    const get = (id: string) => (m[id] = m[id] || { releases: 0, afterAccept: 0, points: 0, pending: 0 });
    releases.forEach((r) => {
      const s = get(r.technician_id);
      s.releases++;
      if (r.from_status !== 'assigned') s.afterAccept++;
      if (r.review_status === 'pending') s.pending++;
    });
    penalties.forEach((p) => { if (p.status === 'active') get(p.technician_id).points += p.points; });
    return m;
  }, [releases, penalties]);

  const pendingCount = releases.filter((r) => r.review_status === 'pending').length;
  const canApprove = can(mine.perms, 'technicians', 'approve');
  const canEdit = can(mine.perms, 'technicians', 'edit');
  const canManage = can(mine.perms, 'technicians', 'manage');

  async function submitReview() {
    if (!reviewTarget) return;
    if (!reviewNote.trim()) { setReviewErr('ثبت توضیح بررسی الزامی است'); return; }
    const r = await adminRpc('admin_review_release', { p_release: reviewTarget.id, p_justified: reviewJustified, p_note: reviewNote.trim() });
    if (!r.ok) { setReviewErr(r.error || 'ناموفق'); return; }
    toast.show('ok', reviewJustified ? 'انصراف موجه شناخته شد و امتیاز منفی آن لغو شد.' : 'انصراف غیرموجه شناخته شد و امتیاز منفی باقی ماند.');
    setReviewTarget(null);
    load();
  }

  async function doAnnul(p: Penalty, reason: string) {
    const r = await adminRpc('admin_annul_penalty', { p_penalty: p.id, p_reason: reason });
    if (!r.ok) { toast.show('err', r.error || 'ناموفق'); return; }
    toast.show('ok', 'امتیاز منفی لغو شد.');
    load();
  }

  async function submitRestrict() {
    if (!restrictTarget) return;
    const h = Number(restrictHours);
    if (!Number.isFinite(h) || h < 1) { setRestrictErr('مدت را به ساعت (عدد مثبت) وارد کنید'); return; }
    if (!restrictReason.trim()) { setRestrictErr('ثبت دلیل الزامی است'); return; }
    const until = new Date(Date.now() + h * 3600 * 1000).toISOString();
    const r = await adminRpc('admin_set_technician_restriction', { p_tech: restrictTarget.id, p_until: until, p_reason: restrictReason.trim() });
    if (!r.ok) { setRestrictErr(r.error || 'ناموفق'); return; }
    toast.show('ok', 'محدودیت پذیرش درخواست اعمال شد.');
    setRestrictTarget(null);
    load();
  }

  async function doClear(t: Tech) {
    const r = await adminRpc('admin_set_technician_restriction', { p_tech: t.id, p_until: null, p_reason: null });
    if (!r.ok) { toast.show('err', r.error || 'ناموفق'); return; }
    toast.show('ok', 'محدودیت برداشته شد.');
    load();
  }

  async function savePolicy() {
    const r = await adminRpc('admin_update_technician_policy', {
      p_points: Number(policyForm.penalty_points), p_restrict_after: Number(policyForm.restrict_after),
      p_window_days: Number(policyForm.window_days), p_restrict_hours: Number(policyForm.restrict_hours),
    });
    if (!r.ok) { toast.show('err', r.error || 'ناموفق'); return; }
    toast.show('ok', 'قواعد ذخیره شد (برای انصراف‌های بعدی اعمال می‌شود).');
    load();
  }

  const th = { padding: '12px' } as const;
  const td = { padding: '10px 12px' } as const;
  const shownReleases = releases.filter((r) => !onlyPending || r.review_status === 'pending');

  return (
    <main style={{ minHeight: '100vh', background: '#f3f4f6', padding: '32px 16px' }} dir="rtl">
      {toast.node}
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 'bold', color: '#1e3a8a' }}>عملکرد و امتیاز تکنسین‌ها</h1>
          <a href="/admin" style={{ color: '#1e3a8a', fontSize: 14, textDecoration: 'none' }}>← بازگشت به پنل اصلی</a>
        </div>

        {missing && (
          <div style={{ background: '#fef3c7', color: '#92400e', borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 14 }}>
            جدول‌های این بخش هنوز ساخته نشده‌اند. فایل 06_stage5_technician_workflow.sql را در Supabase اجرا کنید.
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {([['releases', 'بررسی انصراف‌ها' + (pendingCount ? ' (' + pendingCount + ')' : '')], ['techs', 'عملکرد تکنسین‌ها'], ['penalties', 'امتیازهای منفی'], ['policy', 'قواعد']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 'bold', background: tab === k ? '#1e3a8a' : 'white', color: tab === k ? 'white' : '#1e3a8a' }}>{l}</button>
          ))}
        </div>

        {loading && <p style={{ color: '#6b7280' }}>در حال بارگذاری...</p>}

        {!loading && tab === 'releases' && (
          <>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, fontSize: 14 }}>
              <input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} /> فقط موارد در انتظار بررسی
            </label>
            <div style={{ background: 'white', borderRadius: 12, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', minWidth: 800 }}>
                <thead style={{ background: '#1e3a8a', color: 'white' }}>
                  <tr><th style={th}>زمان</th><th style={th}>تکنسین</th><th style={th}>مرحله</th><th style={th}>علت</th><th style={th}>وضعیت بررسی</th><th style={th}>اقدام</th></tr>
                </thead>
                <tbody>
                  {shownReleases.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>موردی یافت نشد</td></tr>
                  ) : shownReleases.map((r) => {
                    const [lbl, bg, fg] = reviewLabel[r.review_status];
                    return (
                      <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ ...td, fontSize: 12, color: '#6b7280' }}>{fmtDate(r.created_at)}</td>
                        <td style={{ ...td, fontWeight: 'bold' }}>{techName[r.technician_id] || '—'}</td>
                        <td style={td}>{r.from_status === 'assigned' ? 'رد ارجاع' : r.from_status === 'accepted' ? 'پس از پذیرش' : 'حین کار'}</td>
                        <td style={{ ...td, maxWidth: 260, fontSize: 13 }}>{r.reason}{r.review_note && <div style={{ color: '#6b7280', fontSize: 12 }}>بررسی: {r.review_note}</div>}</td>
                        <td style={td}><span style={badge(bg, fg)}>{lbl}</span></td>
                        <td style={td}>
                          {canApprove && r.from_status !== 'assigned' && (
                            <button onClick={() => { setReviewTarget(r); setReviewJustified(true); setReviewNote(''); setReviewErr(''); }} style={btn('#e0e7ff', '#1e3a8a')}>بررسی</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!loading && tab === 'techs' && (
          <div style={{ background: 'white', borderRadius: 12, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', minWidth: 760 }}>
              <thead style={{ background: '#1e3a8a', color: 'white' }}>
                <tr><th style={th}>تکنسین</th><th style={th}>انصراف پس از پذیرش</th><th style={th}>امتیاز منفی فعال</th><th style={th}>وضعیت پذیرش</th><th style={th}>اقدام</th></tr>
              </thead>
              <tbody>
                {techs.map((t) => {
                  const s = stats[t.id] || { releases: 0, afterAccept: 0, points: 0, pending: 0 };
                  const restricted = t.restricted_until && new Date(t.restricted_until) > new Date();
                  return (
                    <tr key={t.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={td}><b>{t.full_name}</b><div style={{ fontSize: 12, color: '#6b7280' }}>{t.phone} · {t.city}</div></td>
                      <td style={td}>{s.afterAccept.toLocaleString('fa-IR')}{s.pending > 0 && <span style={badge('#fef3c7', '#d97706')}>{s.pending} در انتظار بررسی</span>}</td>
                      <td style={{ ...td, color: s.points ? '#b91c1c' : undefined, fontWeight: 'bold' }}>{s.points.toLocaleString('fa-IR')}</td>
                      <td style={td}>
                        {restricted ? <span style={badge('#fee2e2', '#dc2626')}>محدود تا {fmtDate(t.restricted_until)}</span> : <span style={badge('#d1fae5', '#065f46')}>آزاد</span>}
                        {restricted && t.restriction_reason && <div style={{ fontSize: 12, color: '#6b7280' }}>{t.restriction_reason}</div>}
                      </td>
                      <td style={td}>
                        {canEdit && (restricted
                          ? <button onClick={() => setClearTarget(t)} style={btn('#16a34a')}>برداشتن محدودیت</button>
                          : <button onClick={() => { setRestrictTarget(t); setRestrictHours('48'); setRestrictReason(''); setRestrictErr(''); }} style={btn('#fee2e2', '#dc2626')}>اعمال محدودیت</button>)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && tab === 'penalties' && (
          <div style={{ background: 'white', borderRadius: 12, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', minWidth: 760 }}>
              <thead style={{ background: '#1e3a8a', color: 'white' }}>
                <tr><th style={th}>زمان</th><th style={th}>تکنسین</th><th style={th}>امتیاز</th><th style={th}>دلیل</th><th style={th}>وضعیت</th><th style={th}>اقدام</th></tr>
              </thead>
              <tbody>
                {penalties.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>امتیاز منفی‌ای ثبت نشده است</td></tr>
                ) : penalties.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6', opacity: p.status === 'annulled' ? 0.6 : 1 }}>
                    <td style={{ ...td, fontSize: 12, color: '#6b7280' }}>{fmtDate(p.created_at)}</td>
                    <td style={{ ...td, fontWeight: 'bold' }}>{techName[p.technician_id] || '—'}</td>
                    <td style={td}>{p.points.toLocaleString('fa-IR')}</td>
                    <td style={{ ...td, fontSize: 13, maxWidth: 300 }}>{p.reason}{p.annul_reason && <div style={{ color: '#6b7280', fontSize: 12 }}>لغو: {p.annul_reason}</div>}</td>
                    <td style={td}>{p.status === 'active' ? <span style={badge('#fee2e2', '#dc2626')}>فعال</span> : <span style={badge('#e5e7eb', '#4b5563')}>لغوشده</span>}</td>
                    <td style={td}>{canEdit && p.status === 'active' && <button onClick={() => setAnnulTarget(p)} style={btn('#fef3c7', '#d97706')}>لغو امتیاز</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && tab === 'policy' && (
          <div style={{ background: 'white', borderRadius: 12, padding: 20, maxWidth: 520 }}>
            <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.9 }}>
              با هر انصراف پس از پذیرش، امتیاز منفی ثبت می‌شود. اگر در بازه‌ی مشخص تعداد انصراف‌ها به حد تعیین‌شده برسد، پذیرش درخواست جدید برای مدت مشخص محدود می‌شود. رد کردن ارجاع قبل از پذیرش جریمه ندارد.
            </p>
            <Field label="امتیاز منفی هر انصراف"><input inputMode="numeric" value={policyForm.penalty_points} onChange={(e) => setPolicyForm({ ...policyForm, penalty_points: e.target.value })} style={inputStyle} /></Field>
            <Field label="تعداد انصراف برای اعمال محدودیت"><input inputMode="numeric" value={policyForm.restrict_after} onChange={(e) => setPolicyForm({ ...policyForm, restrict_after: e.target.value })} style={inputStyle} /></Field>
            <Field label="بازه‌ی شمارش (روز)"><input inputMode="numeric" value={policyForm.window_days} onChange={(e) => setPolicyForm({ ...policyForm, window_days: e.target.value })} style={inputStyle} /></Field>
            <Field label="مدت محدودیت (ساعت)"><input inputMode="numeric" value={policyForm.restrict_hours} onChange={(e) => setPolicyForm({ ...policyForm, restrict_hours: e.target.value })} style={inputStyle} /></Field>
            {canManage ? (
              <button onClick={savePolicy} style={{ ...btn('#1e3a8a'), padding: '9px 20px', fontSize: 13, marginTop: 16 }}>ذخیره‌ی قواعد</button>
            ) : <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 12 }}>تغییر قواعد نیاز به «مدیریت کامل» بخش تکنسین‌ها دارد.</p>}
            {policy && <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>قاعده‌ی فعلی: {policy.penalty_points} امتیاز · {policy.restrict_after} انصراف در {policy.window_days} روز ← {policy.restrict_hours} ساعت محدودیت</p>}
          </div>
        )}
      </div>

      {reviewTarget && (
        <Modal title="بررسی انصراف تکنسین" onClose={() => setReviewTarget(null)} width={480}>
          <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.9 }}>{techName[reviewTarget.technician_id]}: «{reviewTarget.reason}»</p>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, fontSize: 14 }}>
            <input type="radio" checked={reviewJustified} onChange={() => setReviewJustified(true)} /> موجه است (امتیاز منفی لغو می‌شود)
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, fontSize: 14 }}>
            <input type="radio" checked={!reviewJustified} onChange={() => setReviewJustified(false)} /> غیرموجه است (امتیاز منفی باقی می‌ماند)
          </label>
          <Field label="توضیح بررسی *"><textarea rows={3} value={reviewNote} onChange={(e) => { setReviewNote(e.target.value); setReviewErr(''); }} style={inputStyle} /></Field>
          {reviewErr && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{reviewErr}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button onClick={() => setReviewTarget(null)} style={{ ...btn('#e5e7eb', '#374151'), padding: '8px 18px', fontSize: 13 }}>انصراف</button>
            <button onClick={submitReview} style={{ ...btn('#1e3a8a'), padding: '8px 18px', fontSize: 13 }}>ثبت نتیجه</button>
          </div>
        </Modal>
      )}

      {restrictTarget && (
        <Modal title={'محدودیت پذیرش درخواست — ' + restrictTarget.full_name} onClose={() => setRestrictTarget(null)} width={440}>
          <Field label="مدت (ساعت)"><input inputMode="numeric" value={restrictHours} onChange={(e) => setRestrictHours(e.target.value)} style={inputStyle} /></Field>
          <Field label="دلیل *"><textarea rows={3} value={restrictReason} onChange={(e) => { setRestrictReason(e.target.value); setRestrictErr(''); }} style={inputStyle} /></Field>
          {restrictErr && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{restrictErr}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button onClick={() => setRestrictTarget(null)} style={{ ...btn('#e5e7eb', '#374151'), padding: '8px 18px', fontSize: 13 }}>انصراف</button>
            <button onClick={submitRestrict} style={{ ...btn('#dc2626'), padding: '8px 18px', fontSize: 13 }}>اعمال محدودیت</button>
          </div>
        </Modal>
      )}

      {annulTarget && (
        <ReasonModal title="لغو امتیاز منفی" description="امتیاز منفی لغو می‌شود و در تاریخچه با دلیل ثبت می‌ماند." confirmLabel="لغو امتیاز"
          onConfirm={(reason) => doAnnul(annulTarget, reason)} onClose={() => setAnnulTarget(null)} />
      )}
      {clearTarget && (
        <ReasonModal title={'برداشتن محدودیت ' + clearTarget.full_name} description="تکنسین دوباره می‌تواند درخواست بپذیرد." confirmLabel="برداشتن محدودیت" requireReason={false}
          onConfirm={() => doClear(clearTarget)} onClose={() => setClearTarget(null)} />
      )}
    </main>
  );
}
