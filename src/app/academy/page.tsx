'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ArticleRow, CourseCard, Empty, FileRow, Grid, Section, VideoCard } from '@/components/academy/AcademyCards';

type TabId = 'courses' | 'categories' | 'tv' | 'knowledge' | 'community';

const TABS: { id: TabId; title: string }[] = [
  { id: 'courses', title: '📚 آموزش' },
  { id: 'categories', title: '🏷️ دسته‌بندی‌ها' },
  { id: 'tv', title: '📺 Vira TV' },
  { id: 'knowledge', title: '📖 بانک دانش' },
  { id: 'community', title: '👥 انجمن' },
];

export default function AcademyPage() {
  const [activeTab, setActiveTab] = useState<TabId>('courses');
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  const [articles, setArticles] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [cat, cou, vid, art, fil, pos] = await Promise.all([
        supabase.from('academy_categories').select('id,slug,name,description').eq('is_active', true).order('sort_order'),
        supabase.from('academy_courses').select('*').order('created_at', { ascending: false }),
        supabase.from('academy_videos').select('*').order('created_at', { ascending: false }),
        supabase.from('academy_articles').select('*').order('created_at', { ascending: false }),
        supabase.from('academy_files').select('*').order('created_at', { ascending: false }),
        supabase.from('academy_community_posts').select('*').order('created_at', { ascending: false }),
      ]);
      setCategories(cat.data || []);
      setCourses(cou.data || []);
      setVideos(vid.data || []);
      setArticles(art.data || []);
      setFiles(fil.data || []);
      setPosts(pos.data || []);
      setLoading(false);
    })();
  }, []);

  const countByCategory: Record<string, number> = {};
  [courses, videos, articles, files].forEach((set) =>
    set.forEach((r: any) => {
      if (r.category) countByCategory[r.category] = (countByCategory[r.category] || 0) + 1;
    })
  );

  const stats = [
    { n: courses.length, label: 'دوره آموزشی', color: '#1e3a8a' },
    { n: videos.length, label: 'ویدئو آموزشی', color: '#16a34a' },
    { n: articles.length + files.length, label: 'مقاله و فایل', color: '#0284c7' },
    { n: categories.length, label: 'دسته‌بندی تخصصی', color: '#8b5cf6' },
  ];

  return (
    <main style={{ minHeight: '100vh', background: '#f3f4f6', padding: '32px 16px' }} dir="rtl">
      <div style={{ maxWidth: '1200px', margin: '0 auto', marginBottom: '48px' }}>
        <Link href="/" style={{ color: '#1e3a8a', fontSize: '14px', textDecoration: 'none', marginBottom: '24px', display: 'inline-block' }}>
          ← بازگشت به صفحه اول
        </Link>

        <div style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)', borderRadius: '16px', padding: '48px 24px', color: 'white', textAlign: 'center', marginBottom: '40px' }}>
          <h1 style={{ fontSize: '48px', fontWeight: 'bold', marginBottom: '16px' }}>🎓 آکادمی ویرا</h1>
          <p style={{ fontSize: '18px', color: 'rgba(255,255,255,0.8)' }}>مرجع جامع آموزش فناوری ارتباطات، تجهیزات و خدمات ایران</p>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '32px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: '12px 20px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px',
                background: activeTab === t.id ? '#1e3a8a' : '#e5e7eb',
                color: activeTab === t.id ? 'white' : '#374151',
              }}
            >
              {t.title}
            </button>
          ))}
        </div>

        <div style={{ background: 'white', borderRadius: '16px', padding: '32px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          {loading && <Empty text="در حال بارگذاری..." />}

          {!loading && activeTab === 'courses' && (
            courses.length === 0 ? <Empty text="هنوز دوره‌ای منتشر نشده است." /> : <Grid>{courses.map((c) => <CourseCard key={c.id} c={c} />)}</Grid>
          )}

          {!loading && activeTab === 'categories' && (
            categories.length === 0 ? <Empty text="هنوز دسته‌بندی‌ای تعریف نشده است." /> : (
              <Grid>
                {categories.map((c) => (
                  <Link key={c.id} href={'/academy/category/' + c.slug} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', textDecoration: 'none', color: 'inherit', display: 'block' }}>
                    <p style={{ fontWeight: 'bold', color: '#1e3a8a', fontSize: '17px' }}>{c.name}</p>
                    {c.description && <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>{c.description}</p>}
                    <p style={{ fontSize: '12px', color: '#0284c7', marginTop: '10px' }}>{(countByCategory[c.name] || 0).toLocaleString('fa-IR')} مورد ←</p>
                  </Link>
                ))}
              </Grid>
            )
          )}

          {!loading && activeTab === 'tv' && (
            videos.length === 0 ? <Empty text="هنوز ویدئویی منتشر نشده است." /> : <Grid>{videos.map((v) => <VideoCard key={v.id} v={v} />)}</Grid>
          )}

          {!loading && activeTab === 'knowledge' && (
            <>
              <Section title="مقالات" count={articles.length}>
                {articles.length === 0 ? <Empty text="هنوز مقاله‌ای منتشر نشده است." /> : articles.map((a) => <ArticleRow key={a.id} a={a} />)}
              </Section>
              <Section title="فایل‌های قابل دانلود" count={files.length}>
                {files.length === 0 ? <Empty text="هنوز فایلی بارگذاری نشده است." /> : files.map((f) => <FileRow key={f.id} f={f} />)}
              </Section>
            </>
          )}

          {!loading && activeTab === 'community' && (
            posts.length === 0 ? <Empty text="هنوز موضوعی در انجمن ثبت نشده است." /> : (
              posts.map((p) => (
                <div key={p.id} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', marginBottom: '10px' }}>
                  <p style={{ fontWeight: 'bold', color: '#111827' }}>{p.title}</p>
                  {p.description && <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '6px', whiteSpace: 'pre-wrap' }}>{p.description}</p>}
                </div>
              ))
            )
          )}
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', marginTop: '64px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
          {stats.map((s) => (
            <div key={s.label} style={{ background: 'white', borderRadius: '12px', padding: '24px', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
              <p style={{ fontSize: '28px', fontWeight: 'bold', color: s.color }}>{s.n.toLocaleString('fa-IR')}</p>
              <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '8px' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
