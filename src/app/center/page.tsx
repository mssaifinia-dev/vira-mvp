'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { loadCatalogMaps, type CatalogMaps } from '@/lib/serviceCatalog';
import RequestDetails from '@/components/RequestDetails';
import RequestForm from '@/components/RequestForm';

const OPEN = ['pending', 'assigned', 'accepted', 'in_progress'];

const statusLabels: Record<string, string> = {
  pending: 'منتظر ارجاع',
  assigned: 'ارجاع‌شده',
  accepted: 'پذیرفته‌شده',
  in_progress: 'در حال انجام',
  completed: 'انجام‌شده',
  cancelled: 'لغوشده',
};

type Tab = 'pending' | 'active' | 'closed' | 'new';

export default function CenterPanel() {
  const [loading, setLoading] = useState(true);
  const [allowedCenterIds, setAllowedCenterIds] = useState<string[] | null>(null); // null = ادمین (همه)
  const [requests, setRequests] = useState<any[]>([]);
  const [maps, setMaps] = useState<CatalogMaps | null>(null);
  const [techNames, setTechNames] = useState<Record<string, string>>({});
  const [options, setOptions] = useState<Record<string, any[]>>({});
  const [pick, setPick] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<Tab>('pending');
  const [error, setError] = useState('');

  const loadRequests = useCallback(async () => {
    const res = await supabase
      .from('service_requests')
      .select('*')
      .not('center_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(300);
    if (res.error) setError(res.error.message);
    const list = res.data || [];
    setRequests(list);

    const ids = Array.from(new Set(list.map((r: any) => r.technician_id).filter(Boolean)));
    if (ids.length) {
      const t = await supabase.rpc('technician_names', { p_ids: ids });
      const nm: Record<string, string> = {};
      (t.data || []).forEach((x: any) => (nm[x.id] = x.full_name));
      setTechNames(nm);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const userRes = await supabase.auth.getUser();
      const user = userRes.data.user;
      if (!user) { window.location.href = '/auth'; return; }

      const adminRes = await supabase.from('admins').select('id').eq('user_id', user.id).maybeSingle();
      if (adminRes.data) {
        setAllowedCenterIds(null);
      } else {
        const sup = await supabase.from('center_supervisors').select('center_id').eq('user_id', user.id);
        if (!sup.data || sup.data.length === 0) { window.location.href = '/'; return; }
        setAllowedCenterIds(sup.data.map((s: any) => s.center_id));
      }

      loadCatalogMaps().then(setMaps);
      await loadRequests();
      setLoading(false);
    })();
    const interval = setInterval(() => loadRequests(), 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openAssign(r: any) {
    if (options[r.id]) return;
    const res = await supabase.rpc('eligible_technicians', { p_request: r.id });
    setOptions((prev) => ({ ...prev, [r.id]: res.data || [] }));
    if (res.error) setError(res.error.message);
  }

  async function assign(r: any, technicianId: string | null) {
    setError('');
    const res = await supabase.rpc('assign_service_request', { p_request: r.id, p_technician: technicianId });
    if (res.error) {
      setError(res.error.message);
      return;
    }
    setPick((p) => ({ ...p, [r.id]: '' }));
    await loadRequests();
  }

  async function cancel(r: any) {
    if (!confirm('درخواست لغو شود؟')) return;
    setError('');
    const res = await supabase.rpc('cancel_service_request', { p_request: r.id });
    if (res.error) setError(res.error.message);
    await loadRequests();
  }

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#1e3a8a' }}>در حال بارگذاری...</p>
      </main>
    );
  }

  const groups: Record<string, any[]> = {
    pending: requests.filter((r) => r.status === 'pending'),
    active: requests.filter((r) => ['assigned', 'accepted', 'in_progress'].includes(r.status)),
    closed: requests.filter((r) => !OPEN.includes(r.status)),
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'pending', label: 'منتظر ارجاع (' + groups.pending.length + ')' },
    { key: 'active', label: 'در حال انجام (' + groups.active.length + ')' },
    { key: 'closed', label: 'بسته‌شده (' + groups.closed.length + ')' },
    { key: 'new', label: '+ ثبت درخواست جدید' },
  ];

  const list = tab === 'new' ? [] : groups[tab];

  return (
    <main style={{ minHeight: '100vh', background: '#f3f4f6', padding: '32px 16px' }} dir="rtl">
      <div style={{ maxWidth: '700px', margin: '0 auto' }}>
        <Link href="/" style={{ color: '#1e3a8a', fontSize: '14px', textDecoration: 'none', display: 'inline-block', marginBottom: '12px' }}>
          ← بازگشت به صفحه اول
        </Link>
        <h1 style={{ fontSize: '22px', fontWeight: 'bold', color: '#1e3a8a', marginBottom: '4px' }}>پنل مرکز مخابراتی</h1>
        <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '20px' }}>
          درخواست‌های مرکز خود را ببینید، درخواست تلفنی ثبت کنید و به تکنسین‌های همان مرکز ارجاع دهید.
        </p>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px',
                background: tab === t.key ? '#1e3a8a' : 'white',
                color: tab === t.key ? 'white' : '#1e3a8a',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <p style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', padding: '10px', fontSize: '13px', marginBottom: '12px' }}>{error}</p>
        )}

        {tab === 'new' && (
          <div style={{ background: 'white', borderRadius: '16px', padding: '24px' }}>
            <RequestForm mode="support" allowedCenterIds={allowedCenterIds} onCreated={loadRequests} />
          </div>
        )}

        {tab !== 'new' && list.length === 0 && (
          <div style={{ background: 'white', borderRadius: '12px', padding: '32px', textAlign: 'center', color: '#9ca3af' }}>
            درخواستی در این بخش نیست
          </div>
        )}

        {tab !== 'new' &&
          list.map((r) => (
            <div key={r.id} style={{ background: 'white', borderRadius: '12px', padding: '16px', marginBottom: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                <p style={{ fontWeight: 'bold' }}>
                  {r.request_no ? '#' + Number(r.request_no).toLocaleString('fa-IR') + ' — ' : ''}
                  {r.issue_type}
                </p>
                <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap', background: r.status === 'completed' ? '#d1fae5' : r.status === 'cancelled' ? '#fee2e2' : '#dbeafe', color: r.status === 'completed' ? '#065f46' : r.status === 'cancelled' ? '#dc2626' : '#1d4ed8' }}>
                  {statusLabels[r.status] || r.status}
                </span>
              </div>
              {r.description && <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>{r.description}</p>}
              <RequestDetails r={r} maps={maps} />
              <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>📍 {r.address}</p>
              <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>📞 {r.phone}</p>
              {r.technician_id && <p style={{ fontSize: '14px', marginTop: '6px' }}>🔧 تکنسین: {techNames[r.technician_id] || '—'}</p>}

              {['pending', 'assigned', 'accepted'].includes(r.status) && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    value={pick[r.id] || ''}
                    onFocus={() => openAssign(r)}
                    onMouseEnter={() => openAssign(r)}
                    onChange={(e) => setPick({ ...pick, [r.id]: e.target.value })}
                    style={{ flex: 1, minWidth: '160px', border: '1px solid #d1d5db', borderRadius: '8px', padding: '8px', fontSize: '13px' }}
                  >
                    <option value="">انتخاب تکنسین...</option>
                    {(options[r.id] || []).map((t: any) => (
                      <option key={t.id} value={t.id}>{t.full_name}{t.phone ? ' — ' + t.phone : ''}</option>
                    ))}
                  </select>
                  <button
                    disabled={!pick[r.id]}
                    onClick={() => assign(r, pick[r.id])}
                    style={{ background: '#1e3a8a', color: 'white', padding: '8px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', opacity: pick[r.id] ? 1 : 0.5 }}
                  >
                    {r.technician_id ? 'تغییر تکنسین' : 'ارجاع'}
                  </button>
                  {r.technician_id && (
                    <button onClick={() => assign(r, null)} style={{ background: '#f3f4f6', color: '#1e3a8a', padding: '8px 14px', borderRadius: '8px', border: '1px solid #d1d5db', cursor: 'pointer', fontSize: '13px' }}>
                      لغو ارجاع
                    </button>
                  )}
                  <button onClick={() => cancel(r)} style={{ background: 'white', color: '#dc2626', padding: '8px 14px', borderRadius: '8px', border: '1px solid #fecaca', cursor: 'pointer', fontSize: '13px' }}>
                    لغو درخواست
                  </button>
                </div>
              )}
            </div>
          ))}
      </div>
    </main>
  );
}
