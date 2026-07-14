'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function ManageAcademyPage() {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [courses, setCourses] = useState<any[]>([]);
  const [newCourse, setNewCourse] = useState({ title: '', category: '', description: '' });

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
    loadCourses();
  }

  async function loadCourses() {
    const res = await supabase.from('academy_courses').select('*');
    if (res.data) setCourses(res.data);
  }

  async function addCourse() {
    if (!newCourse.title || !newCourse.category) return;

    await supabase.from('academy_courses').insert([newCourse]);
    setNewCourse({ title: '', category: '', description: '' });
    loadCourses();
  }

  async function deleteCourse(id: string) {
    await supabase.from('academy_courses').delete().eq('id', id);
    loadCourses();
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f3f4f6', padding: '32px 16px' }} dir="rtl">
      
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        
        <Link href="/admin" style={{ color: '#1e3a8a', fontSize: '14px', textDecoration: 'none', marginBottom: '24px', display: 'inline-block' }}>
          ← بازگشت
        </Link>

        <div style={{ background: '#1e3a8a', color: 'white', borderRadius: '12px', padding: '24px', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold' }}>📚 مدیریت آکادمی ویرا</h1>
          <p style={{ fontSize: '14px', marginTop: '8px', color: 'rgba(255,255,255,0.8)' }}>اضافه کردن و مدیریت دوره‌های آموزشی</p>
        </div>

        {/* فرم اضافه کردن */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', marginBottom: '32px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e3a8a', marginBottom: '16px' }}>دوره جدید</h2>

          <div style={{ display: 'grid', gap: '12px', marginBottom: '16px' }}>
            <input
              type="text"
              placeholder="عنوان دوره"
              value={newCourse.title}
              onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
              style={{ padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }}
            />
            <input
              type="text"
              placeholder="دسته‌بندی (مثل: FTTH, Cisco, Network)"
              value={newCourse.category}
              onChange={(e) => setNewCourse({ ...newCourse, category: e.target.value })}
              style={{ padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }}
            />
            <textarea
              placeholder="توضیحات"
              value={newCourse.description}
              onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
              style={{ padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', minHeight: '80px' }}
            />
          </div>

          <button
            onClick={addCourse}
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
            + اضافه کردن دوره
          </button>

        </div>

        {/* لیست دوره‌ها */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e3a8a', marginBottom: '16px' }}>
            دوره‌های موجود ({courses.length})
          </h2>

          {courses.length === 0 ? (
            <p style={{ color: '#6b7280', textAlign: 'center', padding: '40px 0' }}>هیچ دوره‌ای ثبت نشده است</p>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {courses.map((course) => (
                <div key={course.id} style={{ background: '#f9fafb', borderRadius: '8px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontWeight: 'bold', color: '#1e3a8a', marginBottom: '4px' }}>{course.title}</p>
                    <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>دسته: {course.category}</p>
                    <p style={{ fontSize: '12px', color: '#9ca3af' }}>{course.description}</p>
                  </div>
                  <button
                    onClick={() => deleteCourse(course.id)}
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