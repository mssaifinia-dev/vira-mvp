'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArticleRow, CourseCard, Empty, FileRow, Grid, PageFrame, Section, VideoCard } from '@/components/academy/AcademyCards';

export default function AcademyCategoryPage() {
  const params = useParams();
  const slug = String(params.slug || '');
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState<any>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  const [articles, setArticles] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const c = await supabase.from('academy_categories').select('*').eq('slug', slug).maybeSingle();
      setCat(c.data);
      if (c.data) {
        const name = c.data.name;
        const [cou, vid, art, fil] = await Promise.all([
          supabase.from('academy_courses').select('*').eq('category', name).order('created_at', { ascending: false }),
          supabase.from('academy_videos').select('*').eq('category', name).order('created_at', { ascending: false }),
          supabase.from('academy_articles').select('*').eq('category', name).order('created_at', { ascending: false }),
          supabase.from('academy_files').select('*').eq('category', name).order('created_at', { ascending: false }),
        ]);
        setCourses(cou.data || []);
        setVideos(vid.data || []);
        setArticles(art.data || []);
        setFiles(fil.data || []);
      }
      setLoading(false);
    })();
  }, [slug]);

  if (loading) return <PageFrame><Empty text="در حال بارگذاری..." /></PageFrame>;
  if (!cat) return <PageFrame><Empty text="این دسته‌بندی پیدا نشد." /></PageFrame>;

  const empty = !courses.length && !videos.length && !articles.length && !files.length;

  return (
    <PageFrame back={{ href: '/academy', label: 'بازگشت به آکادمی' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1e3a8a' }}>{cat.name}</h1>
      {cat.description && <p style={{ color: '#6b7280', marginTop: '6px' }}>{cat.description}</p>}
      {empty && <Empty text="هنوز محتوایی در این دسته ثبت نشده است." />}
      {courses.length > 0 && <Section title="دوره‌ها" count={courses.length}><Grid>{courses.map((c) => <CourseCard key={c.id} c={c} />)}</Grid></Section>}
      {videos.length > 0 && <Section title="ویدئوها" count={videos.length}><Grid>{videos.map((v) => <VideoCard key={v.id} v={v} />)}</Grid></Section>}
      {files.length > 0 && <Section title="فایل‌ها" count={files.length}>{files.map((f) => <FileRow key={f.id} f={f} />)}</Section>}
      {articles.length > 0 && <Section title="مقالات" count={articles.length}>{articles.map((a) => <ArticleRow key={a.id} a={a} />)}</Section>}
    </PageFrame>
  );
}
