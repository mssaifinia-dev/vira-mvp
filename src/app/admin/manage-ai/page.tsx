'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function ManageAIPage() {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [faqs, setFaqs] = useState<any[]>([]);
  const [newFaq, setNewFaq] = useState({ question: '', answer: '' });

  useEffect(() => {
    checkAdmin();
  }, []);

  async function checkAdmin() {
    const userRes = await supabase.auth.getUser();
    const currentUser = userRes.data.user;
    setUser(currentUser);

    if (!currentUser) {
      window.location.href = '/auth';
      return;
    }

    const adminRes = await supabase
      .from('admins')
      .select('id')
      .eq('user_id', currentUser.id)
      .maybeSingle();

    if (!adminRes.data) {
      window.location.href = '/';
      return;
    }

    setIsAdmin(true);
    loadFaqs();
  }

  async function loadFaqs() {
    const res = await supabase.from('vira_faqs').select('*');
    if (res.data) setFaqs(res.data);
  }

  async function addFaq() {
    if (!newFaq.question || !newFaq.answer) return;

    await supabase.from('vira_faqs').insert([newFaq]);
    setNewFaq({ question: '', answer: '' });
    loadFaqs();
  }

  async function deleteFaq(id: string) {
    await supabase.from('vira_faqs').delete().eq('id', id);
    loadFaqs();
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f3f4f6', padding: '32px 16px' }} dir="rtl">
      
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        
        <Link href="/admin" style={{ color: '#1e3a8a', fontSize: '14px', textDecoration: 'none', marginBottom: '24px', display: 'inline-block' }}>
          ← بازگشت
        </Link>

        <div style={{ background: '#1e3a8a', color: 'white', borderRadius: '12px', padding: '24px', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold' }}>🤖 مدیریت Vira AI</h1>
          <p style={{ fontSize: '14px', marginTop: '8px', color: 'rgba(255,255,255,0.8)' }}>اضافه کردن و مدیریت سوالات و پاسخ‌های دستیار هوشمند</p>
        </div>

        {/* فرم اضافه کردن */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', marginBottom: '32px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e3a8a', marginBottom: '16px' }}>سوال و جواب جدید</h2>

          <div style={{ display: 'grid', gap: '12px', marginBottom: '16px' }}>
            <input
              type="text"
              placeholder="سوال"
              value={newFaq.question}
              onChange={(e) => setNewFaq({ ...newFaq, question: e.target.value })}
              style={{ padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }}
            />
            <textarea
              placeholder="جواب"
              value={newFaq.answer}
              onChange={(e) => setNewFaq({ ...newFaq, answer: e.target.value })}
              style={{ padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', minHeight: '100px' }}
            />
          </div>

          <button
            onClick={addFaq}
            style={{
              background: '#16a34a',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 20px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            + اضافه کردن
          </button>

        </div>

        {/* لیست سوالات */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e3a8a', marginBottom: '16px' }}>
            سوالات موجود ({faqs.length})
          </h2>

          {faqs.length === 0 ? (
            <p style={{ color: '#6b7280', textAlign: 'center', padding: '40px 0' }}>هیچ سوالی ثبت نشده است</p>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {faqs.map((faq) => (
                <div key={faq.id} style={{ background: '#f9fafb', borderRadius: '8px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 'bold', color: '#1e3a8a', marginBottom: '8px' }}>❓ {faq.question}</p>
                    <p style={{ fontSize: '13px', color: '#6b7280', lineHeight: '1.5' }}>{faq.answer}</p>
                  </div>
                  <button
                    onClick={() => deleteFaq(faq.id)}
                    style={{
                      background: '#dc2626',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 16px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      whiteSpace: 'nowrap',
                      marginLeft: '12px'
                    }}
                  >
                    حذف
                  </button>
                </div>
              ))}
            </div>
          )}

        </div>

      </div>

    </main>
  );
}