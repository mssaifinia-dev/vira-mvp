'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Tech = { id: string; full_name: string | null; phone: string | null; city: string | null };

const box = { background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' } as const;
const chipBase = { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', border: '1px solid #d1d5db', userSelect: 'none' as const };

/** مدیریت محدوده (چند مرکز / چند خیابان) و خدمات (چند نوع خدمت) هر تکنسین؛ هر کلیک جداگانه ذخیره می‌شود. */
export default function TechnicianScopesManager() {
  const [techs, setTechs] = useState<Tech[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [centers, setCenters] = useState<any[]>([]);
  const [streets, setStreets] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, { areas: number; services: number }>>({});
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [areas, setAreas] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [draftCenters, setDraftCenters] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadCounts = useCallback(async () => {
    const [a, s] = await Promise.all([
      supabase.from('technician_areas').select('technician_id'),
      supabase.from('technician_services').select('technician_id'),
    ]);
    const map: Record<string, { areas: number; services: number }> = {};
    (a.data || []).forEach((r: any) => {
      map[r.technician_id] = map[r.technician_id] || { areas: 0, services: 0 };
      map[r.technician_id].areas++;
    });
    (s.data || []).forEach((r: any) => {
      map[r.technician_id] = map[r.technician_id] || { areas: 0, services: 0 };
      map[r.technician_id].services++;
    });
    setCounts(map);
  }, []);

  const loadSelected = useCallback(async (tid: string) => {
    const [a, s] = await Promise.all([
      supabase.from('technician_areas').select('*').eq('technician_id', tid),
      supabase.from('technician_services').select('*').eq('technician_id', tid),
    ]);
    if (a.error || s.error) setError((a.error || s.error)!.message);
    setAreas(a.data || []);
    setServices(s.data || []);
  }, []);

  useEffect(() => {
    (async () => {
      const [t, c, ce, st] = await Promise.all([
        supabase.from('technicians').select('id, full_name, phone, city').eq('is_approved', true).is('deleted_at', null).order('full_name'),
        supabase.from('service_categories').select('id, name, is_active').order('sort_order'),
        supabase.from('telecom_centers').select('id, name, is_active').is('deleted_at', null).order('name'),
        supabase.from('center_streets').select('id, center_id, name, is_active').order('name'),
      ]);
      let centerRows = ce.data;
      if (ce.error) {
        // قبل از اجرای مهاجرت 0010 ستون deleted_at وجود ندارد
        centerRows = (await supabase.from('telecom_centers').select('id, name, is_active').order('name')).data;
      }
      const firstError = t.error || c.error || st.error;
      if (firstError) setError(firstError.message);
      setTechs(t.data || []);
      setCategories(c.data || []);
      setCenters(centerRows || []);
      setStreets(st.data || []);
      await loadCounts();
      setLoading(false);
    })();
  }, [loadCounts]);

  async function selectTech(id: string) {
    setSelected(id);
    setDraftCenters([]);
    setError('');
    await loadSelected(id);
  }

  async function refresh() {
    if (selected) await loadSelected(selected);
    await loadCounts();
  }

  async function run(op: PromiseLike<{ error: { message: string } | null }>) {
    setError('');
    const res = await op;
    if (res.error) setError(res.error.message);
    await refresh();
  }

  // ---------- خدمات ----------
  function toggleService(categoryId: string) {
    if (!selected) return;
    const existing = services.find((s) => s.category_id === categoryId);
    return run(
      existing
        ? supabase.from('technician_services').delete().eq('id', existing.id)
        : supabase.from('technician_services').insert({ technician_id: selected, category_id: categoryId })
    );
  }

  // ---------- محدوده ----------
  const wholeRow = (centerId: string) => areas.find((a) => a.center_id === centerId && !a.street_id);
  const streetRow = (centerId: string, streetId: string) => areas.find((a) => a.center_id === centerId && a.street_id === streetId);

  async function toggleWholeCenter(centerId: string) {
    if (!selected) return;
    const whole = wholeRow(centerId);
    if (whole) {
      await run(supabase.from('technician_areas').delete().eq('id', whole.id));
      return;
    }
    // «کل مرکز» همه‌ی خیابان‌های جداگانه‌ی همان مرکز را شامل می‌شود
    const del = await supabase.from('technician_areas').delete().eq('technician_id', selected).eq('center_id', centerId);
    if (del.error) { setError(del.error.message); return; }
    await run(supabase.from('technician_areas').insert({ technician_id: selected, center_id: centerId, street_id: null }));
  }

  function toggleStreet(centerId: string, streetId: string) {
    if (!selected) return;
    const existing = streetRow(centerId, streetId);
    return run(
      existing
        ? supabase.from('technician_areas').delete().eq('id', existing.id)
        : supabase.from('technician_areas').insert({ technician_id: selected, center_id: centerId, street_id: streetId })
    );
  }

  async function removeCenter(centerId: string) {
    if (!selected) return;
    if (!confirm('همه‌ی محدوده‌های این مرکز از تکنسین حذف شود؟')) return;
    setDraftCenters((d) => d.filter((x) => x !== centerId));
    await run(supabase.from('technician_areas').delete().eq('technician_id', selected).eq('center_id', centerId));
  }

  const tech = techs.find((t) => t.id === selected) || null;
  const centerIdsOfTech = Array.from(new Set([...areas.map((a) => a.center_id), ...draftCenters]));
  const addableCenters = centers.filter((c) => !centerIdsOfTech.includes(c.id));
  const filtered = techs.filter((t) => {
    const q = search.trim();
    return !q || (t.full_name || '').includes(q) || (t.phone || '').includes(q) || (t.city || '').includes(q);
  });

  const streetCount = areas.filter((a) => a.street_id).length;
  const wholeCount = areas.filter((a) => !a.street_id).length;

  if (loading) return <p style={{ textAlign: 'center', color: '#6b7280', padding: '24px' }}>در حال بارگذاری...</p>;

  return (
    <div>
      <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '12px', lineHeight: 1.9 }}>
        برای هر تکنسین چند مرکز، چند خیابان و چند نوع خدمت انتخاب کنید؛ هر کلیک همان لحظه ذخیره می‌شود.
        تکنسین فقط درخواستی را می‌بیند که <b>هم محدوده</b> و <b>هم نوع خدمتش</b> در انتخاب‌های او باشد.
        اگر بخشی (محدوده یا خدمت) را خالی بگذارید، همان بخش محدودیت ندارد.
        تکنسینی که هیچ‌چیز ندارد مثل قبل همه‌ی درخواست‌ها را می‌بیند.
      </p>

      {error && <p style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', padding: '10px', fontSize: '13px', marginBottom: '12px' }}>{error}</p>}

      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* فهرست تکنسین‌ها */}
        <div style={{ ...box, flex: '1 1 260px', maxWidth: '340px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e3a8a', marginBottom: '10px' }}>تکنسین‌های تأییدشده ({techs.length})</h3>
          <input
            placeholder="جستجوی نام، تلفن یا شهر..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', marginBottom: '10px' }}
          />
          <div style={{ maxHeight: '520px', overflowY: 'auto' }}>
            {filtered.length === 0 && <p style={{ color: '#9ca3af', textAlign: 'center', padding: '16px' }}>تکنسینی پیدا نشد</p>}
            {filtered.map((t) => {
              const c = counts[t.id];
              const active = selected === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => selectTech(t.id)}
                  style={{ display: 'block', width: '100%', textAlign: 'right', padding: '10px 12px', marginBottom: '6px', borderRadius: '8px', cursor: 'pointer', border: active ? '2px solid #1e3a8a' : '1px solid #e5e7eb', background: active ? '#eff6ff' : '#f9fafb' }}
                >
                  <span style={{ fontWeight: 'bold', color: '#111827', fontSize: '14px' }}>{t.full_name || 'بدون نام'}</span>
                  <span style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                    {t.phone}{t.city ? ' · ' + t.city : ''}
                  </span>
                  <span style={{ display: 'block', fontSize: '11px', marginTop: '4px', color: c ? '#0f766e' : '#9ca3af' }}>
                    {c ? `${c.areas.toLocaleString('fa-IR')} محدوده · ${c.services.toLocaleString('fa-IR')} خدمت` : 'بدون محدودیت (همه‌ی درخواست‌ها)'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* جزئیات تکنسین انتخاب‌شده */}
        <div style={{ flex: '3 1 420px', minWidth: 0 }}>
          {!tech && (
            <div style={{ ...box, textAlign: 'center', color: '#9ca3af' }}>یک تکنسین را از فهرست انتخاب کنید</div>
          )}

          {tech && (
            <>
              <div style={{ ...box, marginBottom: '16px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e3a8a' }}>{tech.full_name}</h2>
                <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
                  {areas.length === 0 && services.length === 0
                    ? 'هنوز محدوده یا خدمتی تعریف نشده؛ این تکنسین همه‌ی درخواست‌های جدید را می‌بیند.'
                    : `${wholeCount.toLocaleString('fa-IR')} مرکز کامل، ${streetCount.toLocaleString('fa-IR')} خیابان، ${services.length.toLocaleString('fa-IR')} نوع خدمت`}
                </p>
              </div>

              {/* خدمات */}
              <div style={{ ...box, marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e3a8a', marginBottom: '4px' }}>🔧 انواع خدمت</h3>
                <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '12px' }}>هر تعداد که لازم است انتخاب کنید. خالی = همه‌ی خدمت‌ها.</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {categories.map((c) => {
                    const on = services.some((s) => s.category_id === c.id);
                    return (
                      <label key={c.id} style={{ ...chipBase, background: on ? '#dbeafe' : 'white', borderColor: on ? '#1e3a8a' : '#d1d5db', opacity: c.is_active ? 1 : 0.6 }}>
                        <input type="checkbox" checked={on} onChange={() => toggleService(c.id)} />
                        {c.name}{c.is_active ? '' : ' (غیرفعال)'}
                      </label>
                    );
                  })}
                  {categories.length === 0 && <span style={{ color: '#9ca3af', fontSize: '13px' }}>دسته‌ی خدمتی تعریف نشده است.</span>}
                </div>
              </div>

              {/* محدوده */}
              <div style={box}>
                <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e3a8a', marginBottom: '4px' }}>📍 محدوده‌ی فعالیت</h3>
                <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '12px' }}>
                  چند مرکز اضافه کنید و برای هر مرکز، «کل مرکز» یا چند خیابان را انتخاب کنید. خالی = همه‌ی محدوده‌ها.
                </p>

                {centerIdsOfTech.map((cid) => {
                  const center = centers.find((c) => c.id === cid);
                  if (!center) return null;
                  const whole = !!wholeRow(cid);
                  const centerStreets = streets.filter((s) => s.center_id === cid);
                  return (
                    <div key={cid} style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '14px', marginBottom: '12px', background: '#f9fafb' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                        <strong style={{ color: '#111827' }}>🏢 {center.name}</strong>
                        <button onClick={() => removeCenter(cid)} style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}>
                          حذف این مرکز
                        </button>
                      </div>

                      <label style={{ ...chipBase, background: whole ? '#dcfce7' : 'white', borderColor: whole ? '#16a34a' : '#d1d5db', marginBottom: '10px' }}>
                        <input type="checkbox" checked={whole} onChange={() => toggleWholeCenter(cid)} />
                        کل مرکز (همه‌ی خیابان‌ها، حتی خیابان‌هایی که بعداً اضافه شوند)
                      </label>

                      {!whole && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {centerStreets.length === 0 && <span style={{ color: '#9ca3af', fontSize: '13px' }}>برای این مرکز خیابانی ثبت نشده است.</span>}
                          {centerStreets.map((st) => {
                            const on = !!streetRow(cid, st.id);
                            return (
                              <label key={st.id} style={{ ...chipBase, background: on ? '#dbeafe' : 'white', borderColor: on ? '#1e3a8a' : '#d1d5db', opacity: st.is_active ? 1 : 0.6 }}>
                                <input type="checkbox" checked={on} onChange={() => toggleStreet(cid, st.id)} />
                                {st.name}
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {centerIdsOfTech.length === 0 && (
                  <p style={{ color: '#9ca3af', fontSize: '13px', marginBottom: '12px' }}>هنوز مرکزی اضافه نشده است.</p>
                )}

                {addableCenters.length > 0 && (
                  <select
                    value=""
                    onChange={(e) => e.target.value && setDraftCenters((d) => [...d, e.target.value])}
                    style={{ padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', width: '100%', boxSizing: 'border-box', background: 'white' }}
                  >
                    <option value="">+ افزودن مرکز مخابراتی...</option>
                    {addableCenters.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
