'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import CenterPicker from '@/components/CenterPicker';
import type { CenterRow } from '@/lib/fa';
import { normalizeDigits, validateFtth, type FtthRule } from '@/lib/ftth';

const LEGACY_TYPES = [
  { value: 'ftth', label: 'قطعی اینترنت / فیبر نوری' },
  { value: 'smart-home', label: 'مشکل خانه هوشمند' },
  { value: 'electric', label: 'مشکل برق' },
  { value: 'network', label: 'مشکل شبکه' },
  { value: 'cctv', label: 'مشکل دوربین مداربسته' },
];

/** فقط مراکزِ فعال، حذف‌نشده و تأییدشده برای انتخاب مشتری. (اگر مهاجرت 0010 هنوز اجرا نشده باشد، روش قبلی.) */
async function loadSelectableCenters(): Promise<CenterRow[]> {
  const res = await supabase
    .from('telecom_centers')
    .select('id,name,address,city,province,district,covered_areas,verification_status,is_active,deleted_at')
    .eq('is_active', true)
    .is('deleted_at', null)
    .eq('verification_status', 'verified')
    .order('name');
  if (!res.error) return (res.data || []) as CenterRow[];
  const old = await supabase.from('telecom_centers').select('*').eq('is_active', true).order('name');
  return (old.data || []) as CenterRow[];
}

const field = { width: '100%', marginTop: 6, marginBottom: 16, padding: 10, boxSizing: 'border-box' as const, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 };

type Props = {
  mode: 'customer' | 'support';
  allowedCenterIds?: string[] | null; // برای مسئول مرکز: فقط مراکز خودش
  onCreated?: () => void;
};

export default function RequestForm({ mode, allowedCenterIds = null, onCreated }: Props) {
  const [categories, setCategories] = useState<any[]>([]);
  const [centers, setCenters] = useState<CenterRow[]>([]);
  const [faults, setFaults] = useState<any[]>([]);
  const [fields, setFields] = useState<any[]>([]);
  const [streets, setStreets] = useState<any[]>([]);
  const [legacy, setLegacy] = useState(false);
  const [ready, setReady] = useState(false);

  const [legacyType, setLegacyType] = useState('ftth');
  const [categoryId, setCategoryId] = useState('');
  const [faultId, setFaultId] = useState('');
  const [centerId, setCenterId] = useState('');
  const [streetId, setStreetId] = useState('');
  const [streetText, setStreetText] = useState('');
  const [details, setDetails] = useState<Record<string, string>>({});
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [ftthNumber, setFtthNumber] = useState('');
  const [ftthRules, setFtthRules] = useState<FtthRule[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [doneNo, setDoneNo] = useState<string | null>(null);

  const category = categories.find((c) => c.id === categoryId);

  useEffect(() => {
    (async () => {
      const [cats, cens] = await Promise.all([
        supabase.from('service_categories').select('*').eq('is_active', true).order('sort_order'),
        loadSelectableCenters(),
      ]);
      if (cats.error || !cats.data || cats.data.length === 0) {
        setLegacy(true);
      } else {
        setCategories(cats.data);
        setCenters(cens.filter((c) => !allowedCenterIds || allowedCenterIds.includes(c.id)));
      }
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setFaultId('');
    setDetails({});
    setFaults([]);
    setFields([]);
    if (!categoryId) return;
    (async () => {
      const [f, ff] = await Promise.all([
        supabase.from('service_fault_types').select('*').eq('category_id', categoryId).eq('is_active', true).order('sort_order'),
        supabase.from('service_form_fields').select('*').eq('category_id', categoryId).eq('is_active', true).order('sort_order'),
      ]);
      setFaults(f.data || []);
      setFields(ff.data || []);
    })();
  }, [categoryId]);

  useEffect(() => {
    setStreetId('');
    setStreets([]);
    if (!centerId) return;
    supabase.from('center_streets').select('*').eq('center_id', centerId).eq('is_active', true).order('name')
      .then((res) => setStreets(res.data || []));
  }, [centerId]);

  useEffect(() => {
    // قواعد شماره‌ی FTTH هر شهر (اگر جدول هنوز ساخته نشده باشد، فهرست خالی می‌ماند)
    supabase.from('ftth_city_rules').select('*').eq('is_active', true).then((res) => setFtthRules((res.data as FtthRule[]) || []));
  }, []);

  function handlePhone(val: string) {
    setPhone(val.replace(/[^0-9]/g, '').substring(0, 11));
  }

  function reset() {
    setDoneNo(null);
    setCategoryId('');
    setCenterId('');
    setStreetId('');
    setStreetText('');
    setDescription('');
    setAddress('');
    setPhone('');
    setCustomerName('');
    setDetails({});
    setUrgent(false);
    setFtthNumber('');
  }

  async function handleSubmit() {
    setError('');

    if (!address.trim() || !phone) return setError('آدرس و شماره تماس الزامی است');
    if (mode === 'customer' && (phone.length !== 11 || !phone.startsWith('09'))) {
      return setError('شماره موبایل باید 11 رقم و با 09 شروع شود');
    }
    if (mode === 'support') {
      if (!customerName.trim()) return setError('نام مشتری الزامی است');
      if (phone.length < 8) return setError('شماره تماس مشتری معتبر نیست');
    }

    if (legacy) {
      if (!description.trim()) return setError('توضیح مشکل الزامی است');
    } else {
      if (!categoryId) return setError('نوع خدمت را انتخاب کنید');
      if (category?.requires_center && !centerId) return setError('مرکز مخابراتی مربوطه را انتخاب کنید');
      if (mode === 'support' && !centerId) return setError('مرکز را انتخاب کنید');
      for (const f of fields) {
        if (f.is_required && !String(details[f.key] || '').trim()) return setError('«' + f.label + '» الزامی است');
      }
      if (category?.requires_ftth_number) {
        const ftthErr = validateFtth(ftthNumber, ftthRules);
        if (ftthErr) return setError(ftthErr);
      }
      if (faults.length > 0 && !faultId && !description.trim()) {
        return setError('نوع خرابی را انتخاب کنید یا توضیح بنویسید');
      }
    }

    setSubmitting(true);
    const userRes = await supabase.auth.getUser();
    const user = userRes.data.user;
    if (!user) {
      window.location.href = '/auth';
      return;
    }

    const base: any = {
      customer_id: mode === 'customer' ? user.id : null,
      description: description.trim() || null,
      address: address.trim(),
      phone,
      status: 'pending',
    };

    let payload: any;
    let selectCols = 'id';
    if (legacy) {
      payload = { ...base, issue_type: legacyType };
    } else {
      selectCols = 'id, request_no';
      payload = {
        ...base,
        issue_type: category.name,
        category_id: categoryId,
        fault_type_id: faultId || null,
        center_id: centerId || null,
        street_id: streetId && streetId !== 'other' ? streetId : null,
        street_text: streetId === 'other' ? streetText.trim() || null : null,
        details,
        ftth_number: category.requires_ftth_number ? normalizeDigits(ftthNumber) : null,
        customer_name: mode === 'support' ? customerName.trim() : null,
        priority: urgent ? 'urgent' : 'normal',
        source: mode,
        created_by: user.id,
      };
    }

    const res: any = await supabase.from('service_requests').insert(payload).select(selectCols).single();
    setSubmitting(false);

    if (res.error) {
      setError(res.error.message);
      return;
    }

    if (mode === 'customer') {
      window.location.href = '/technician/track/' + res.data.id;
      return;
    }
    setDoneNo(res.data.request_no ? String(res.data.request_no) : '');
    onCreated?.();
  }

  if (!ready) {
    return <p style={{ textAlign: 'center', color: '#6b7280', padding: 24 }}>در حال بارگذاری...</p>;
  }

  if (doneNo !== null) {
    return (
      <div style={{ background: '#d1fae5', borderRadius: 12, padding: 24, textAlign: 'center' }}>
        <p style={{ fontWeight: 'bold', color: '#065f46', fontSize: 18 }}>✓ درخواست ثبت شد</p>
        {doneNo && <p style={{ color: '#065f46', marginTop: 6 }}>شماره پیگیری: {Number(doneNo).toLocaleString('fa-IR')}</p>}
        <button onClick={reset} style={{ marginTop: 16, background: '#1e3a8a', color: 'white', border: 'none', borderRadius: 8, padding: '10px 24px', cursor: 'pointer', fontWeight: 'bold' }}>
          ثبت درخواست جدید
        </button>
      </div>
    );
  }

  return (
    <div>
      {mode === 'support' && (
        <>
          <label>نام مشتری</label>
          <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} style={field} />
        </>
      )}

      <label>نوع مشکل</label>
      {legacy ? (
        <select value={legacyType} onChange={(e) => setLegacyType(e.target.value)} style={field}>
          {LEGACY_TYPES.map((i) => (
            <option key={i.value} value={i.value}>{i.label}</option>
          ))}
        </select>
      ) : (
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={field}>
          <option value="">انتخاب کنید...</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      )}

      {!legacy && category && (
        <>
          {faults.length > 0 && (
            <>
              <label>نوع خرابی</label>
              <select value={faultId} onChange={(e) => setFaultId(e.target.value)} style={field}>
                <option value="">انتخاب کنید...</option>
                {faults.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </>
          )}

          {category.requires_ftth_number && (
            <div>
              <label>شماره مجازی FTTH *</label>
              <input
                type="text"
                inputMode="numeric"
                dir="ltr"
                autoComplete="off"
                value={ftthNumber}
                placeholder="02199162496"
                onChange={(e) => setFtthNumber(normalizeDigits(e.target.value).replace(/[^0-9]/g, '').slice(0, 16))}
                style={field}
              />
              <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>کد شهر به‌همراه ۸ رقم بعد از آن؛ مثلاً در تهران ۱۱ رقم و با صفر ابتدایی (02199162496).</p>
            </div>
          )}

          {fields.map((f) => (
            <div key={f.id}>
              <label>{f.label}{f.is_required ? ' *' : ''}</label>
              {f.field_type === 'select' ? (
                <select value={details[f.key] || ''} onChange={(e) => setDetails({ ...details, [f.key]: e.target.value })} style={field}>
                  <option value="">انتخاب کنید...</option>
                  {(f.options || []).map((o: string) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              ) : f.field_type === 'textarea' ? (
                <textarea rows={3} value={details[f.key] || ''} placeholder={f.placeholder || ''} onChange={(e) => setDetails({ ...details, [f.key]: e.target.value })} style={field} />
              ) : (
                <input
                  type={f.field_type === 'number' ? 'number' : 'text'}
                  value={details[f.key] || ''}
                  placeholder={f.placeholder || ''}
                  onChange={(e) => setDetails({ ...details, [f.key]: e.target.value })}
                  style={field}
                />
              )}
            </div>
          ))}

          {(category.requires_center || mode === 'support' || centers.length > 0) && (
            <>
              <label>مرکز مخابراتی{category.requires_center || mode === 'support' ? ' *' : ''}</label>
              <CenterPicker centers={centers} value={centerId} onChange={setCenterId} />
            </>
          )}

          {centerId && (
            <>
              <label>خیابان</label>
              <select value={streetId} onChange={(e) => setStreetId(e.target.value)} style={field}>
                <option value="">انتخاب کنید...</option>
                {streets.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
                <option value="other">خیابان من در فهرست نیست</option>
              </select>
              {streetId === 'other' && (
                <input type="text" placeholder="نام خیابان را بنویسید" value={streetText} onChange={(e) => setStreetText(e.target.value)} style={field} />
              )}
            </>
          )}
        </>
      )}

      <label>{legacy ? 'توضیح مشکل' : 'توضیحات بیشتر'}</label>
      <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} style={field} />

      <label>آدرس دقیق</label>
      <textarea rows={2} value={address} onChange={(e) => setAddress(e.target.value)} style={field} />

      <label>{mode === 'support' ? 'شماره تماس مشتری' : 'شماره تماس'}</label>
      <input type="text" value={phone} onChange={(e) => handlePhone(e.target.value)} style={field} />

      {!legacy && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: 14 }}>
          <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} />
          درخواست فوری است
        </label>
      )}

      {error && <p style={{ color: 'red', marginBottom: 16 }}>{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={submitting}
        style={{ width: '100%', padding: 14, background: '#1e3a8a', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', opacity: submitting ? 0.7 : 1 }}
      >
        {submitting ? 'در حال ثبت...' : 'ثبت درخواست'}
      </button>
    </div>
  );
}
