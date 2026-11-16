'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

const card = { background: '#f9fafb', borderRadius: '12px', overflow: 'hidden', textDecoration: 'none', color: 'inherit', border: '1px solid #e5e7eb', display: 'block' } as const;
const chip = { display: 'inline-block', background: '#dbeafe', color: '#1d4ed8', borderRadius: '6px', padding: '2px 8px', fontSize: '11px', marginBottom: '6px' } as const;

export function Grid({ children }: { children: ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>{children}</div>;
}

export function Empty({ text }: { text: string }) {
  return <p style={{ textAlign: 'center', color: '#9ca3af', padding: '32px' }}>{text}</p>;
}

export function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <div style={{ marginTop: '32px' }}>
      <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e3a8a', marginBottom: '16px' }}>
        {title}
        {typeof count === 'number' && <span style={{ fontSize: '14px', fontWeight: 'normal', color: '#9ca3af' }}> ({count.toLocaleString('fa-IR')})</span>}
      </h2>
      {children}
    </div>
  );
}

export function CourseCard({ c }: { c: any }) {
  return (
    <Link href={'/academy/course/' + c.id} style={card}>
      <div style={{ height: '110px', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px' }}>
        {c.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.cover_image_url} alt={c.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : '🎓'}
      </div>
      <div style={{ padding: '14px' }}>
        {c.category && <span style={chip}>{c.category}</span>}
        <p style={{ fontWeight: 'bold', color: '#111827' }}>{c.title}</p>
        {c.description && (
          <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.description}</p>
        )}
      </div>
    </Link>
  );
}

export function VideoCard({ v }: { v: any }) {
  return (
    <Link href={'/academy/video/' + v.id} style={card}>
      <div style={{ height: '110px', background: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px', color: 'white' }}>
        {v.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={v.thumbnail_url} alt={v.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : '▶'}
      </div>
      <div style={{ padding: '14px' }}>
        {v.category && <span style={chip}>{v.category}</span>}
        <p style={{ fontWeight: 'bold', color: '#111827' }}>{v.title}</p>
        {v.description && (
          <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{v.description}</p>
        )}
      </div>
    </Link>
  );
}

export function ArticleRow({ a }: { a: any }) {
  return (
    <Link href={'/academy/article/' + a.id} style={{ ...card, padding: '14px 16px', marginBottom: '10px' }}>
      <span style={{ marginLeft: '8px' }}>📰</span>
      <span style={{ fontWeight: 'bold', color: '#111827' }}>{a.title}</span>
      {a.category && <span style={{ ...chip, marginRight: '10px', marginBottom: 0 }}>{a.category}</span>}
    </Link>
  );
}

export function FileRow({ f }: { f: any }) {
  return (
    <a href={f.file_url} target="_blank" rel="noreferrer" style={{ ...card, padding: '14px 16px', marginBottom: '10px' }}>
      <span style={{ marginLeft: '8px' }}>📎</span>
      <span style={{ fontWeight: 'bold', color: '#111827' }}>{f.title}</span>
      <span style={{ float: 'left', color: '#1e3a8a', fontSize: '13px' }}>دانلود ↓</span>
      {f.description && <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>{f.description}</p>}
    </a>
  );
}

export function PageFrame({ children, back }: { children: ReactNode; back?: { href: string; label: string } }) {
  return (
    <main style={{ minHeight: '100vh', background: '#f3f4f6', padding: '32px 16px' }} dir="rtl">
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <Link href={back?.href || '/academy'} style={{ color: '#1e3a8a', fontSize: '14px', textDecoration: 'none', display: 'inline-block', marginBottom: '16px' }}>
          ← {back?.label || 'بازگشت به آکادمی'}
        </Link>
        <div style={{ background: 'white', borderRadius: '16px', padding: '32px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>{children}</div>
      </div>
    </main>
  );
}
