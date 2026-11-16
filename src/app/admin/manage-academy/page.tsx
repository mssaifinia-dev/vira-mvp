'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import CrudManager, { type FieldDef } from '@/components/admin/CrudManager';
import { normalizeVideoInput } from '@/lib/media';

const BUCKET = 'academy-media';

const categoryField: FieldDef = {
  name: 'category',
  label: 'دسته‌بندی',
  type: 'select',
  required: true,
  optionsFrom: { table: 'academy_categories', select: 'name', label: (r: any) => r.name, valueKey: 'name' },
};

const courseField: FieldDef = {
  name: 'course_id',
  label: 'متعلق به دوره (اختیاری)',
  type: 'select',
  optionsFrom: { table: 'academy_courses', select: 'id,title', label: (r: any) => r.title },
};

const TABS = [
  { key: 'courses', label: '📚 دوره‌ها' },
  { key: 'videos', label: '🎬 ویدئوها (Vira TV)' },
  { key: 'files', label: '📎 فایل‌ها' },
  { key: 'articles', label: '📰 مقالات' },
  { key: 'categories', label: '🏷️ دسته‌بندی‌ها' },
  { key: 'community', label: '👥 انجمن' },
];

export default function ManageAcademyPage() {
  const [allowed, setAllowed] = useState(false);
  const [activeTab, setActiveTab] = useState('courses');

  useEffect(() => {
    (async () => {
      const userRes = await supabase.auth.getUser();
      const currentUser = userRes.data.user;
      if (!currentUser) { window.location.href = '/auth'; return; }
      const adminRes = await supabase.from('admins').select('id').eq('user_id', currentUser.id).maybeSingle();
      if (!adminRes.data) { window.location.href = '/'; return; }
      setAllowed(true);
    })();
  }, []);

  if (!allowed) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#1e3a8a' }}>در حال بررسی...</p>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f3f4f6', padding: '32px 16px' }} dir="rtl">
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <Link href="/admin" style={{ color: '#1e3a8a', fontSize: '14px', textDecoration: 'none', marginBottom: '16px', display: 'inline-block' }}>
          ← بازگشت به پنل ادمین
        </Link>

        <div style={{ background: '#1e3a8a', color: 'white', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold' }}>📚 مدیریت آکادمی ویرا</h1>
          <p style={{ fontSize: '14px', marginTop: '8px', color: 'rgba(255,255,255,0.8)' }}>
            دوره، ویدئو، فایل، مقاله، دسته‌بندی و انجمن را اضافه، ویرایش یا حذف کنید؛ ویدئو و فایل را مستقیم آپلود کنید.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                padding: '10px 18px', borderRadius: '8px', border: 'none', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer',
                background: activeTab === t.key ? '#1e3a8a' : '#e5e7eb',
                color: activeTab === t.key ? 'white' : '#374151',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'courses' && (
          <CrudManager
            table="academy_courses"
            title="دوره‌ها"
            ascending={false}
            fields={[
              { name: 'title', label: 'عنوان دوره', type: 'text', required: true },
              categoryField,
              { name: 'description', label: 'توضیحات', type: 'textarea' },
              { name: 'cover_image_url', label: 'تصویر کاور', type: 'file', bucket: BUCKET, pathPrefix: 'covers/', publicUrl: true, accept: 'image/*', hideInList: true },
              { name: 'sort_order', label: 'ترتیب', type: 'number', hideInList: true },
            ]}
          />
        )}

        {activeTab === 'videos' && (
          <CrudManager
            table="academy_videos"
            title="ویدئوها"
            ascending={false}
            beforeSave={(p) => {
              const r = normalizeVideoInput(p.video_url);
              if (r.error) return r.error;
              p.video_url = r.value || null;
              if (!p.video_url && !p.file_url) return 'لینک ویدئو را وارد کنید یا فایل ویدئو را آپلود کنید.';
              return null;
            }}
            fields={[
              { name: 'title', label: 'عنوان ویدئو', type: 'text', required: true },
              categoryField,
              courseField,
              { name: 'video_url', label: 'لینک ویدئو (آپارات / یوتیوب / لینک مستقیم)', type: 'text', hideInList: true, placeholder: 'https://www.aparat.com/v/xxxxx', hint: 'لینک یوتیوب، آپارات، Vimeo، کد iframe/Embed یا لینک مستقیم فایل (mp4/webm). یا به‌جای لینک، پایین‌تر خود فایل را آپلود کنید.' },
              { name: 'file_url', label: 'آپلود فایل ویدئو', type: 'file', bucket: BUCKET, pathPrefix: 'videos/', publicUrl: true, accept: 'video/*', hideInList: true, hint: 'برای ویدئوهای حجیم که از سقف مجاز فضای ذخیره‌سازی بیشترند، از لینک آپارات استفاده کنید.' },
              { name: 'thumbnail_url', label: 'تصویر بندانگشتی', type: 'file', bucket: BUCKET, pathPrefix: 'thumbs/', publicUrl: true, accept: 'image/*', hideInList: true },
              { name: 'description', label: 'توضیحات', type: 'textarea' },
              { name: 'sort_order', label: 'ترتیب', type: 'number', hideInList: true },
            ]}
          />
        )}

        {activeTab === 'files' && (
          <CrudManager
            table="academy_files"
            title="فایل‌های قابل دانلود (PDF، Word، Excel، زیپ و ...)"
            ascending={false}
            fields={[
              { name: 'title', label: 'عنوان فایل', type: 'text', required: true },
              categoryField,
              courseField,
              { name: 'file_url', label: 'آپلود فایل', type: 'file', bucket: BUCKET, pathPrefix: 'files/', publicUrl: true, required: true, hideInList: true },
              { name: 'description', label: 'توضیحات', type: 'textarea' },
              { name: 'sort_order', label: 'ترتیب', type: 'number', hideInList: true },
            ]}
          />
        )}

        {activeTab === 'articles' && (
          <CrudManager
            table="academy_articles"
            title="مقالات"
            ascending={false}
            fields={[
              { name: 'title', label: 'عنوان مقاله', type: 'text', required: true },
              categoryField,
              { name: 'content', label: 'متن مقاله', type: 'textarea' },
              { name: 'cover_image_url', label: 'تصویر مقاله', type: 'file', bucket: BUCKET, pathPrefix: 'articles/', publicUrl: true, accept: 'image/*', hideInList: true },
            ]}
          />
        )}

        {activeTab === 'categories' && (
          <CrudManager
            table="academy_categories"
            title="دسته‌بندی‌های آکادمی"
            orderBy="sort_order"
            fields={[
              { name: 'name', label: 'نام دسته', type: 'text', required: true, hint: 'با تغییر نام، همه‌ی محتوای آن دسته هم خودکار هماهنگ می‌شود.' },
              { name: 'slug', label: 'نشانی (انگلیسی، بدون فاصله)', type: 'text', hint: 'خالی بگذارید تا خودکار ساخته شود. مثال: ftth' },
              { name: 'description', label: 'توضیح', type: 'textarea' },
              { name: 'sort_order', label: 'ترتیب', type: 'number' },
              { name: 'is_active', label: 'نمایش داده شود', type: 'boolean' },
            ]}
          />
        )}

        {activeTab === 'community' && (
          <CrudManager
            table="academy_community_posts"
            title="موضوعات انجمن"
            ascending={false}
            fields={[
              { name: 'title', label: 'عنوان', type: 'text', required: true },
              { name: 'description', label: 'توضیحات', type: 'textarea' },
            ]}
          />
        )}
      </div>
    </main>
  );
}
