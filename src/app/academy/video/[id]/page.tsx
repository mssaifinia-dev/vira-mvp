'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Empty, PageFrame } from '@/components/academy/AcademyCards';
import VideoPlayer from '@/components/academy/VideoPlayer';

export default function VideoPage() {
  const params = useParams();
  const id = String(params.id || '');
  const [loading, setLoading] = useState(true);
  const [video, setVideo] = useState<any>(null);

  useEffect(() => {
    supabase.from('academy_videos').select('*').eq('id', id).maybeSingle().then((res) => {
      setVideo(res.data);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <PageFrame><Empty text="در حال بارگذاری..." /></PageFrame>;
  if (!video) return <PageFrame><Empty text="این ویدئو پیدا نشد." /></PageFrame>;

  const back = video.course_id ? { href: '/academy/course/' + video.course_id, label: 'بازگشت به دوره' } : { href: '/academy', label: 'بازگشت به آکادمی' };

  return (
    <PageFrame back={back}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e3a8a', marginBottom: '16px' }}>{video.title}</h1>
      <VideoPlayer videoUrl={video.video_url} fileUrl={video.file_url} poster={video.thumbnail_url} />
      {video.description && <p style={{ color: '#4b5563', marginTop: '16px', lineHeight: 2, whiteSpace: 'pre-wrap' }}>{video.description}</p>}
    </PageFrame>
  );
}
