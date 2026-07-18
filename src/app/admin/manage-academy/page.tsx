'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function ManageAcademyPage() {
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'courses' | 'videos' | 'articles' | 'community'>('courses');

  const [courses, setCourses] = useState<any[]>([]);
  const [newCourse, setNewCourse] = useState({ title: '', category: '', description: '' });

  const [videos, setVideos] = useState<any[]>([]);
  const [newVideo, setNewVideo] = useState({ title: '', category: '', video_url: '', description: '' });

  const [articles, setArticles] = useState<any[]>([]);
  const [newArticle, setNewArticle] = useState({ title: '', category: '', content: '' });

  const [posts, setPosts] = useState<any[]>([]);
  const [newPost, setNewPost] = useState({ title: '', description: '' });

  useEffect(() => { checkAdmin(); }, []);

  async function checkAdmin() {
    const userRes = await supabase.auth.getUser();
    const currentUser = userRes.data.user;
    setUser(currentUser);
    if (!currentUser) { window.location.href = '/auth'; return; }
    const adminRes = await supabase.from('admins').select('id').eq('user_id', currentUser.id).maybeSingle();
    if (!adminRes.data) { window.location.href = '/'; return; }
    loadAll();
  }

  async function loadAll() {
    const c = await supabase.from('academy_courses').select('*').order('created_at', { ascending: false });
    if (c.data) setCourses(c.data);
    const v = await supabase.from('academy_videos').select('*').order('created_at', { ascending: false });
    if (v.data) setVideos(v.data);
    const a = await supabase.from('academy_articles').select('*').order('created_at', { ascending: false });
    if (a.data) setArticles(a.data);
    const p = await supabase.from('academy_community_posts').select('*').order('created_at', { ascending: false });
    if (p.data) setPosts(p.data);
  }

  async function addCourse() {
    if (!newCourse.title) return;
    await supabase.from('academy_courses').insert([newCourse]);
    setNewCourse({ title: '', category: '', description: '' });
    loadAll();
  }
  async function deleteCourse(id: string) { await supabase.from('academy_courses').delete().eq('id', id); loadAll(); }

  async function addVideo() {
    if (!newVideo.title) return;
    await supabase.from('academy_videos').insert([newVideo]);
    setNewVideo({ title: '', category: '', video_url: '', description: '' });
    loadAll();
  }
  async function deleteVideo(id: string) { await supabase.from('academy_videos').delete().eq('id', id); loadAll(); }

  async function addArticle() {
    if (!newArticle.title) return;
    await supabase.from('academy_articles').insert([newArticle]);
    setNewArticle({ title: '', category: '', content: '' });
    loadAll();
  }
  async function deleteArticle(id: string) { await supabase.from('academy_articles').delete().eq('id', id); loadAll(); }

  async function addPost() {
    if (!newPost.title) return;
    await supabase.from('academy_community_posts').insert([newPost]);
    setNewPost({ title: '', description: '' });
    loadAll();
  }
  async function deletePost(id: string) { await supabase.from('academy_community_posts').delete().eq('id', id); loadAll(); }

  const tabs = [
    { key: 'courses', label: `📚 دوره‌ها (${courses.length})` },
    { key: 'videos', label: `🎥 Vira TV (${videos.length})` },
    { key: 'articles', label: `📖 مقالات (${articles.length})` },
    { key: 'community', label: `👥 انجمن (${posts.length})` },
  ];

  const inputStyle = { padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' };
  const btnAddStyle = { background: '#16a34a', color: 'white', border: 'none', borderRadius: '8px', padding: '10px', cursor: 'pointer', fontWeight: 'bold' as const };
  const btnDeleteStyle = { background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap' as const, marginLeft: '12px' };
  const cardStyle = { background: '#f9fafb', borderRadius: '8px', padding: '16px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' };

  return (
    <main style={{ minHeight: '100vh', background: '#f3f4f6', padding: '32px 16px' }} dir="rtl">
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>

        <Link href="/admin" style={{ color: '#1e3a8a', fontSize: '14px', textDecoration: 'none', marginBottom: '16px', display: 'inline-block' }}>
          ← بازگشت به پنل ادمین
        </Link>

        <div style={{ background: '#1e3a8a', color: 'white', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold' }}>📚 مدیریت آکادمی ویرا</h1>
          <p style={{ fontSize: '14px', marginTop: '8px', color: 'rgba(255,255,255,0.8)' }}>مدیریت دوره‌ها، ویدئوها، مقالات و انجمن</p>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as any)}
              style={{
                padding: '10px 18px', borderRadius: '8px', border: 'none', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer',
                background: activeTab === t.key ? '#1e3a8a' : '#e5e7eb',
                color: activeTab === t.key ? 'white' : '#374151'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* دوره‌ها */}
        {activeTab === 'courses' && (
          <div>
            <div style={{ background: 'white', borderRadius: '12px', padding: '24px', marginBottom: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e3a8a', marginBottom: '16px' }}>دوره جدید</h2>
              <div style={{ display: 'grid', gap: '12px' }}>
                <input type="text" placeholder="عنوان دوره" value={newCourse.title} onChange={e => setNewCourse({ ...newCourse, title: e.target.value })} style={inputStyle} />
                <input type="text" placeholder="دسته‌بندی (مثل: FTTH, Cisco)" value={newCourse.category} onChange={e => setNewCourse({ ...newCourse, category: e.target.value })} style={inputStyle} />
                <textarea placeholder="توضیحات" value={newCourse.description} onChange={e => setNewCourse({ ...newCourse, description: e.target.value })} style={{ ...inputStyle, minHeight: '80px' }} />
                <button onClick={addCourse} style={btnAddStyle}>+ اضافه کردن</button>
              </div>
            </div>
            <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e3a8a', marginBottom: '16px' }}>لیست دوره‌ها</h2>
              {courses.length === 0 ? <p style={{ color: '#6b7280', textAlign: 'center' }}>هیچ دوره‌ای ثبت نشده</p> : courses.map(c => (
                <div key={c.id} style={cardStyle}>
                  <div><p style={{ fontWeight: 'bold', color: '#1e3a8a' }}>{c.title}</p><p style={{ fontSize: '12px', color: '#6b7280' }}>دسته: {c.category}</p></div>
                  <button onClick={() => deleteCourse(c.id)} style={btnDeleteStyle}>حذف</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ویدئوها */}
        {activeTab === 'videos' && (
          <div>
            <div style={{ background: 'white', borderRadius: '12px', padding: '24px', marginBottom: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e3a8a', marginBottom: '16px' }}>ویدئو جدید (Vira TV)</h2>
              <div style={{ display: 'grid', gap: '12px' }}>
                <input type="text" placeholder="عنوان ویدئو" value={newVideo.title} onChange={e => setNewVideo({ ...newVideo, title: e.target.value })} style={inputStyle} />
                <input type="text" placeholder="دسته‌بندی (فیلم آموزشی/وبینار/مصاحبه/...)" value={newVideo.category} onChange={e => setNewVideo({ ...newVideo, category: e.target.value })} style={inputStyle} />
                <input type="text" placeholder="لینک ویدئو (URL)" value={newVideo.video_url} onChange={e => setNewVideo({ ...newVideo, video_url: e.target.value })} style={inputStyle} />
                <textarea placeholder="توضیحات" value={newVideo.description} onChange={e => setNewVideo({ ...newVideo, description: e.target.value })} style={{ ...inputStyle, minHeight: '80px' }} />
                <button onClick={addVideo} style={btnAddStyle}>+ اضافه کردن</button>
              </div>
            </div>
            <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e3a8a', marginBottom: '16px' }}>لیست ویدئوها</h2>
              {videos.length === 0 ? <p style={{ color: '#6b7280', textAlign: 'center' }}>هیچ ویدئویی ثبت نشده</p> : videos.map(v => (
                <div key={v.id} style={cardStyle}>
                  <div><p style={{ fontWeight: 'bold', color: '#1e3a8a' }}>{v.title}</p><p style={{ fontSize: '12px', color: '#6b7280' }}>دسته: {v.category}</p></div>
                  <button onClick={() => deleteVideo(v.id)} style={btnDeleteStyle}>حذف</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* مقالات */}
        {activeTab === 'articles' && (
          <div>
            <div style={{ background: 'white', borderRadius: '12px', padding: '24px', marginBottom: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e3a8a', marginBottom: '16px' }}>مقاله جدید (Knowledge Base)</h2>
              <div style={{ display: 'grid', gap: '12px' }}>
                <input type="text" placeholder="عنوان مقاله" value={newArticle.title} onChange={e => setNewArticle({ ...newArticle, title: e.target.value })} style={inputStyle} />
                <input type="text" placeholder="دسته‌بندی (اخبار/بررسی محصولات/راهنمای نصب/...)" value={newArticle.category} onChange={e => setNewArticle({ ...newArticle, category: e.target.value })} style={inputStyle} />
                <textarea placeholder="متن مقاله" value={newArticle.content} onChange={e => setNewArticle({ ...newArticle, content: e.target.value })} style={{ ...inputStyle, minHeight: '120px' }} />
                <button onClick={addArticle} style={btnAddStyle}>+ اضافه کردن</button>
              </div>
            </div>
            <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e3a8a', marginBottom: '16px' }}>لیست مقالات</h2>
              {articles.length === 0 ? <p style={{ color: '#6b7280', textAlign: 'center' }}>هیچ مقاله‌ای ثبت نشده</p> : articles.map(a => (
                <div key={a.id} style={cardStyle}>
                  <div><p style={{ fontWeight: 'bold', color: '#1e3a8a' }}>{a.title}</p><p style={{ fontSize: '12px', color: '#6b7280' }}>دسته: {a.category}</p></div>
                  <button onClick={() => deleteArticle(a.id)} style={btnDeleteStyle}>حذف</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* انجمن */}
        {activeTab === 'community' && (
          <div>
            <div style={{ background: 'white', borderRadius: '12px', padding: '24px', marginBottom: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e3a8a', marginBottom: '16px' }}>موضوع جدید (Community)</h2>
              <div style={{ display: 'grid', gap: '12px' }}>
                <input type="text" placeholder="عنوان موضوع" value={newPost.title} onChange={e => setNewPost({ ...newPost, title: e.target.value })} style={inputStyle} />
                <textarea placeholder="توضیحات" value={newPost.description} onChange={e => setNewPost({ ...newPost, description: e.target.value })} style={{ ...inputStyle, minHeight: '80px' }} />
                <button onClick={addPost} style={btnAddStyle}>+ اضافه کردن</button>
              </div>
            </div>
            <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e3a8a', marginBottom: '16px' }}>لیست موضوعات</h2>
              {posts.length === 0 ? <p style={{ color: '#6b7280', textAlign: 'center' }}>هیچ موضوعی ثبت نشده</p> : posts.map(p => (
                <div key={p.id} style={cardStyle}>
                  <div><p style={{ fontWeight: 'bold', color: '#1e3a8a' }}>{p.title}</p><p style={{ fontSize: '12px', color: '#6b7280' }}>{p.description}</p></div>
                  <button onClick={() => deletePost(p.id)} style={btnDeleteStyle}>حذف</button>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
