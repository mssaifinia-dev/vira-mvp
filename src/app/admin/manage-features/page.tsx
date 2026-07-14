'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function ManageFeaturesPage() {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState('academy');

  // آکادمی
  const [courses, setCourses] = useState<any[]>([]);
  const [newCourse, setNewCourse] = useState({ title: '', category: '', description: '' });

  // AI
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
    loadData();
  }

  async function loadData() {
    const coursesRes = await supabase.from('academy_courses').select('*');
    if (coursesRes.data) setCourses(coursesRes.data);

    const faqsRes = await supabase.from('vira_faqs').select('*');
    if (faqsRes.data) setFaqs(faqsRes.data);
  }

  async function addCourse() {
    if (!newCourse.title || !newCourse.category) return;
    await supabase.from('academy_courses').insert([newCourse]);
    setNewCourse({ title: '', category: '', description: '' });
    loadData();
  }

  async function deleteCourse(id: string) {
    await supabase.from('academy_courses').delete().eq('id', id);
    loadData();
  }

  async function addFaq() {
    if (!newFaq.question || !newFaq.answer) return;
    await supabase.from('vira_faqs').insert([newFaq]);
    setNewFaq({ question: '', answer: '' });
    loadData();
  }

  async function deleteFaq(id: string) {
    await supabase.from('vira_faqs').delete().eq('id', id);
    loadData();
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f3f4f6', padding: '32px 16px' }} dir="rtl">
      
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        <Link href="/admin" style={{ color: '#1e3a8a', fontSize: '14px', textDecoration: 'none', marginBottom: '24px', display: 'inline-block' }}>
          ← بازگشت
        </Link>

        <div style={{ background: '#1e3a8a', color: 'white', borderRadius: '12px', padding: '24px', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold' }}>⚙️ مدیریت فیچرها</h1>
          <p style={{ fontSize: '14px', marginTop: '8px', color: 'rgba(255,255,255,0.8)' }}>کنترل آکادمی و Vira AI</p>
        </div>

        {/* تب‌ها */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
          <button
            onClick={() => setActiveTab('academy')}
            style={{
              padding: '12px 24px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              background: activeTab === 'academy' ? '#1e3a8a' : '#e5e7eb',
              color: activeTab === 'academy' ? 'white' : '#374151'
            }}
          >
            📚 آکادمی
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            style={{
              padding: '12px 24px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              background: activeTab === 'ai' ? '#1e3a8a' : '#e5e7eb',
              color: activeTab === 'ai' ? 'white' : '#374151'
            }}
          >
            🤖 Vira AI
          </button>
        </div>

        {/* بخش آکادمی */}
        {activeTab === 'academy' && (
          <div>
            <div style={{ background: 'white', borderRadius: '12px', padding: '24px', marginBottom: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e3a8a', marginBottom: '16px' }}>دوره جدید</h2>
              <div style={{ display: 'grid', gap: '12px', marginBottom: '16px' }}>
                <input
                  type="text"
                  placeholder="عنوان"
                  value={newCourse.title}
                  onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                  style={{ padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px' }}
                />
                <input
                  type="text"
                  placeholder="دسته"
                  value={newCourse.category}
                  onChange={(e) => setNewCourse({ ...newCourse, category: e.target.value })}
                  style={{ padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px' }}
                />
                <textarea
                  placeholder="توضیحات"
                  value={newCourse.description}
                  onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                  style={{ padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', minHeight: '80px' }}
                />
                <button
                  onClick={addCourse}
                  style={{ background: '#16a34a', color: 'white', border: 'none', borderRadius: '8px', padding: '10px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  + اضافه کردن
                </button>
              </div>
            </div>

            <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e3a8a', marginBottom: '16px' }}>دوره‌ها ({courses.length})</h2>
              {courses.length === 0 ? (
                <p style={{ color: '#6b7280', textAlign: 'center' }}>هیچ دوره‌ای نیست</p>
              ) : (
                courses.map(c => (
                  <div key={c.id} style={{ background: '#f9fafb', borderRadius: '8px', padding: '12px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                    <div><p style={{ fontWeight: 'bold', color: '#1e3a8a' }}>{c.title}</p><p style={{ fontSize: '12px', color: '#6b7280' }}>{c.category}</p></div>
                    <button onClick={() => deleteCourse(c.id)} style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer' }}>حذف</button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* بخش AI */}
        {activeTab === 'ai' && (
          <div>
            <div style={{ background: 'white', borderRadius: '12px', padding: '24px', marginBottom: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e3a8a', marginBottom: '16px' }}>سوال جدید</h2>
              <div style={{ display: 'grid', gap: '12px', marginBottom: '16px' }}>
                <input
                  type="text"
                  placeholder="سوال"
                  value={newFaq.question}
                  onChange={(e) => setNewFaq({ ...newFaq, question: e.target.value })}
                  style={{ padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px' }}
                />
                <textarea
                  placeholder="جواب"
                  value={newFaq.answer}
                  onChange={(e) => setNewFaq({ ...newFaq, answer: e.target.value })}
                  style={{ padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', minHeight: '100px' }}
                />
                <button
                  onClick={addFaq}
                  style={{ background: '#16a34a', color: 'white', border: 'none', borderRadius: '8px', padding: '10px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  + اضافه کردن
                </button>
              </div>
            </div>

            <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e3a8a', marginBottom: '16px' }}>سوالات ({faqs.length})</h2>
              {faqs.length === 0 ? (
                <p style={{ color: '#6b7280', textAlign: 'center' }}>هیچ سوالی نیست</p>
              ) : (
                faqs.map(f => (
                  <div key={f.id} style={{ background: '#f9fafb', borderRadius: '8px', padding: '12px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                    <div><p style={{ fontWeight: 'bold', color: '#1e3a8a' }}>{f.question}</p><p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>{f.answer}</p></div>
                    <button onClick={() => deleteFaq(f.id)} style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', marginLeft: '12px' }}>حذف</button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>

    </main>
  );
}