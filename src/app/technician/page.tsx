'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function TechnicianRequest() {
  const [checking, setChecking] = useState(true);

  const [issueType, setIssueType] = useState('ftth');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    checkTechnician();
  }, []);

  async function checkTechnician() {
    const userRes = await supabase.auth.getUser();
    const user = userRes.data.user;

    if (!user) {
      window.location.href = '/auth';
      return;
    }

    const techRes = await supabase
      .from('technicians')
      .select('id,is_approved')
      .eq('user_id', user.id)
      .maybeSingle();

    if (techRes.data?.is_approved) {
      window.location.href = '/technician/dashboard';
      return;
    }

    setChecking(false);
  }

  const issueTypes = [
    { value: 'ftth', label: 'قطعی اینترنت / فیبر نوری' },
    { value: 'smart-home', label: 'مشکل خانه هوشمند' },
    { value: 'electric', label: 'مشکل برق' },
    { value: 'network', label: 'مشکل شبکه' },
    { value: 'cctv', label: 'مشکل دوربین مداربسته' },
  ];

  function handlePhone(val: string) {
    const cleaned = val.replace(/[^0-9]/g, '').substring(0, 11);
    setPhone(cleaned);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError('');

    if (!description || !address || !phone) {
      setError('همه فیلدها الزامی است');
      setSubmitting(false);
      return;
    }

    if (phone.length !== 11 || !phone.startsWith('09')) {
      setError('شماره موبایل باید 11 رقم و با 09 شروع شود');
      setSubmitting(false);
      return;
    }

    const userRes = await supabase.auth.getUser();
    const user = userRes.data.user;

    if (!user) {
      window.location.href = '/auth';
      return;
    }

    const insertRes = await supabase
      .from('service_requests')
      .insert({
        customer_id: user.id,
        issue_type: issueType,
        description,
        address,
        phone,
        status: 'pending',
      })
      .select()
      .single();

    if (insertRes.error) {
      setError(insertRes.error.message);
      setSubmitting(false);
      return;
    }

    window.location.href = '/technician/track/' + insertRes.data.id;
  }

  if (checking) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <h3>در حال بررسی...</h3>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f3f4f6',
        padding: '32px 16px',
      }}
      dir="rtl"
    >
      <div style={{ maxWidth: '500px', margin: '0 auto' }}>
        <h1
          style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#1e3a8a',
            textAlign: 'center',
            marginBottom: '8px',
          }}
        >
          درخواست تکنسین
        </h1>

        <p
          style={{
            color: '#6b7280',
            textAlign: 'center',
            marginBottom: '24px',
          }}
        >
          نزدیک‌ترین تکنسین به محل شما اعزام می‌شود.
        </p>

        <div
          style={{
            background: 'white',
            borderRadius: '16px',
            padding: '24px',
          }}
        >
          <label>نوع مشکل</label>

          <select
            value={issueType}
            onChange={(e) => setIssueType(e.target.value)}
            style={{
              width: '100%',
              marginTop: 6,
              marginBottom: 16,
              padding: 10,
            }}
          >
            {issueTypes.map((i) => (
              <option key={i.value} value={i.value}>
                {i.label}
              </option>
            ))}
          </select>

          <label>توضیح مشکل</label>

          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{
              width: '100%',
              marginTop: 6,
              marginBottom: 16,
              padding: 10,
            }}
          />

          <label>آدرس</label>

          <textarea
            rows={2}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            style={{
              width: '100%',
              marginTop: 6,
              marginBottom: 16,
              padding: 10,
            }}
          />

          <label>شماره تماس</label>

          <input
            type="text"
            value={phone}
            onChange={(e) => handlePhone(e.target.value)}
            style={{
              width: '100%',
              marginTop: 6,
              marginBottom: 16,
              padding: 10,
            }}
          />

          {error && (
            <p style={{ color: 'red', marginBottom: 16 }}>{error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              width: '100%',
              padding: 14,
              background: '#1e3a8a',
              color: 'white',
              border: 'none',
              borderRadius: 10,
              cursor: 'pointer',
            }}
          >
            {submitting ? 'در حال ثبت...' : 'ثبت درخواست'}
          </button>
        </div>
      </div>
    </main>
  );
}