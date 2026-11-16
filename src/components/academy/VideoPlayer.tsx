'use client';

import { useState } from 'react';
import { resolveVideoSource } from '@/lib/media';

const note = { marginTop: '10px', fontSize: '13px', color: '#6b7280', lineHeight: 1.9 } as const;
const openBtn = { display: 'inline-block', background: '#1e3a8a', color: 'white', padding: '10px 20px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '14px' } as const;

function Message({ text, href, tone = 'warn' }: { text: string; href?: string; tone?: 'warn' | 'error' }) {
  return (
    <div style={{ background: tone === 'error' ? '#fee2e2' : '#fef3c7', color: tone === 'error' ? '#b91c1c' : '#92400e', borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
      <p style={{ lineHeight: 2, marginBottom: href ? '14px' : 0 }}>{text}</p>
      {href && (
        <a href={href} target="_blank" rel="noopener noreferrer" style={openBtn}>
          باز کردن در تب جدید
        </a>
      )}
    </div>
  );
}

/** پخش ویدئو بر اساس نوع منبع: یوتیوب، آپارات، Vimeo، لینک Embed یا فایل مستقیم. */
export default function VideoPlayer({ videoUrl, fileUrl, poster }: { videoUrl?: string | null; fileUrl?: string | null; poster?: string | null }) {
  const [failed, setFailed] = useState(false);

  const source = fileUrl ? resolveVideoSource(fileUrl, { uploaded: true }) : resolveVideoSource(videoUrl);

  if (source.kind === 'invalid') return <Message text={source.message} tone="error" />;
  if (source.kind === 'link') return <Message text={source.message} href={source.href} />;

  if (source.kind === 'iframe') {
    const sandbox = source.provider === 'embed' ? 'allow-scripts allow-same-origin allow-presentation allow-popups allow-forms' : undefined;
    return (
      <div>
        <div style={{ position: 'relative', width: '100%', paddingBottom: '56.25%', height: 0, borderRadius: '12px', overflow: 'hidden', background: '#000' }}>
          <iframe
            src={source.src}
            title="ویدئوی آموزشی"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox={sandbox}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
          />
        </div>
        <p style={note}>
          اگر ویدئو پخش نشد،{' '}
          <a href={source.openHref} target="_blank" rel="noopener noreferrer" style={{ color: '#1e3a8a', fontWeight: 'bold' }}>
            آن را در تب جدید باز کنید
          </a>
          {source.provider === 'youtube' ? ' (یوتیوب در برخی شبکه‌ها فیلتر است).' : '.'}
        </p>
      </div>
    );
  }

  // فایل مستقیم
  if (failed) {
    return <Message text="فایل ویدئو بارگذاری نشد. ممکن است آدرس درست نباشد یا فرمت آن در مرورگر پشتیبانی نشود." href={source.openHref} tone="error" />;
  }
  return (
    <video
      src={source.src}
      poster={poster || undefined}
      controls
      playsInline
      preload="metadata"
      onError={() => setFailed(true)}
      style={{ width: '100%', maxHeight: '75vh', borderRadius: '12px', background: '#000', display: 'block' }}
    />
  );
}
