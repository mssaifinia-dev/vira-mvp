'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import RequestForm from '@/components/RequestForm';

export default function TechnicianRequest() {
  const [checking, setChecking] = useState(true);


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
          <RequestForm mode="customer" />
        </div>
      </div>
    </main>
  );
}