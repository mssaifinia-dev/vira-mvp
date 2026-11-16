'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Empty, FileRow, Grid, PageFrame, Section, VideoCard } from '@/components/academy/AcademyCards';

export default function CoursePage() {
  const params = useParams();
  const id = String(params.id || '');
  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<any>(null);
  const [videos, setVideos] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const c = await supabase.from('academy_courses').select('*').eq('id', id).maybeSingle();
      setCourse(c.data);
      if (c.data) {
        const [vid, fil] = await Promise.all([
          supabase.from('academy_videos').select('*').eq('course_id', id).order('sort_order').order('created_at'),
          supabase.from('academy_files').select('*').eq('course_id', id).order('sort_order').order('created_at'),
        ]);
        setVideos(vid.data || []);
        setFiles(fil.data || []);
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <PageFrame><Empty text="در حال بارگذاری..." /></PageFrame>;
  if (!course) return <PageFrame><Empty text="این دوره پیدا نشد." /></PageFrame>;

  return (
    <PageFrame back={{ href: '/academy', label: 'بازگشت به آکادمی' }}>
      {course.cover_image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={course.cover_image_url} alt={course.title} style={{ width: '100%', maxHeight: '260px', objectFit: 'cover', borderRadius: '12px', marginBottom: '16px' }} />
      )}
      {course.category && <span style={{ background: '#dbeafe', color: '#1d4ed8', borderRadius: '6px', padding: '2px 10px', fontSize: '12px' }}>{course.category}</span>}
      <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1e3a8a', marginTop: '8px' }}>{course.title}</h1>
      {course.description && <p style={{ color: '#4b5563', marginTop: '10px', lineHeight: 2, whiteSpace: 'pre-wrap' }}>{course.description}</p>}

      {videos.length === 0 && files.length === 0 && <Empty text="محتوای این دوره هنوز اضافه نشده است." />}
      {videos.length > 0 && <Section title="جلسات ویدئویی" count={videos.length}><Grid>{videos.map((v) => <VideoCard key={v.id} v={v} />)}</Grid></Section>}
      {files.length > 0 && <Section title="فایل‌های دوره" count={files.length}>{files.map((f) => <FileRow key={f.id} f={f} />)}</Section>}
    </PageFrame>
  );
}
