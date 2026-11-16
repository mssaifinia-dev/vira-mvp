'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Empty, PageFrame } from '@/components/academy/AcademyCards';

export default function ArticlePage() {
  const params = useParams();
  const id = String(params.id || '');
  const [loading, setLoading] = useState(true);
  const [article, setArticle] = useState<any>(null);

  useEffect(() => {
    supabase.from('academy_articles').select('*').eq('id', id).maybeSingle().then((res) => {
      setArticle(res.data);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <PageFrame><Empty text="در حال بارگذاری..." /></PageFrame>;
  if (!article) return <PageFrame><Empty text="این مقاله پیدا نشد." /></PageFrame>;

  return (
    <PageFrame back={{ href: '/academy', label: 'بازگشت به آکادمی' }}>
      {article.category && <span style={{ background: '#dbeafe', color: '#1d4ed8', borderRadius: '6px', padding: '2px 10px', fontSize: '12px' }}>{article.category}</span>}
      <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1e3a8a', margin: '8px 0 16px' }}>{article.title}</h1>
      {article.cover_image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={article.cover_image_url} alt={article.title} style={{ width: '100%', borderRadius: '12px', marginBottom: '16px' }} />
      )}
      <article style={{ color: '#374151', lineHeight: 2.1, whiteSpace: 'pre-wrap' }}>{article.content}</article>
    </PageFrame>
  );
}
