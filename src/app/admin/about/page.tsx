'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type AboutImage = { id: string; image_url: string; caption: string; sort_order: number };

export default function AdminAboutPage() {
  const [checking, setChecking] = useState(true);
  const [introText, setIntroText] = useState('');
  const [textPosition, setTextPosition] = useState<'top' | 'bottom'>('top');
  const [images, setImages] = useState<AboutImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  useEffect(() => {
    checkAdmin();
  }, []);

  async function checkAdmin() {
    const userRes = await supabase.auth.getUser();
    const user = userRes.data.user;
    if (!user) { window.location.href = '/auth'; return; }
    const adminRes = await supabase.from('admins').select('id').eq('user_id', user.id).single();
    if (!adminRes.data) { window.location.href = '/'; return; }
    setChecking(false);
    loadData();
  }

  async function loadData() {
    const { data: content } = await supabase.from('about_content').select('*').single();
    if (content) {
      setIntroText(content.intro_text);
      setTextPosition(content.text_position === 'bottom' ? 'bottom' : 'top');
    }

    const { data: imgs } = await supabase.from('about_images').select('*').order('sort_order');
    if (imgs) setImages(imgs);
  }

  async function saveText() {
    setSaving(true);
    await supabase
      .from('about_content')
      .update({ intro_text: introText, text_position: textPosition, updated_at: new Date().toISOString() })
      .eq('id', 1);
    setSaving(false);
    alert('ذخیره شد');
  }

  async function uploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    const fileName = `${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from('about').upload(fileName, file);

    if (uploadError) {
      alert('خطا در آپلود: ' + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('about').getPublicUrl(fileName);

    await supabase.from('about_images').insert({
      image_url: urlData.publicUrl,
      caption: '',
      sort_order: images.length,
    });

    await loadData();
    setUploading(false);
    e.target.value = '';
  }

  function updateCaption(id: string, caption: string) {
    setImages(images.map(img => img.id === id ? { ...img, caption } : img));
  }

  async function saveCaption(id: string, caption: string) {
    await supabase.from('about_images').update({ caption }).eq('id', id);
  }

  async function deleteImage(id: string, imageUrl: string) {
    if (!confirm('این عکس حذف شود؟')) return;
    const fileName = imageUrl.split('/').pop();
    if (fileName) await supabase.storage.from('about').remove([fileName]);
    await supabase.from('about_images').delete().eq('id', id);
    await loadData();
  }

  function handleDragStart(index: number) {
    setDragIndex(index);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;

    const reordered = [...images];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(index, 0, moved);
    setDragIndex(index);
    setImages(reordered);
  }

  async function handleDragEnd() {
    setDragIndex(null);
    const updates = images.map((img, i) =>
      supabase.from('about_images').update({ sort_order: i }).eq('id', img.id)
    );
    await Promise.all(updates);
  }

  if (checking) {
    return (
      <main style={{minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center"}} dir="rtl">
        <p style={{color:"#1e3a8a"}}>در حال بررسی دسترسی...</p>
      </main>
    );
  }

  return (
    <main style={{minHeight:"100vh", background:"#f3f4f6", padding:"32px 16px"}} dir="rtl">
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>

        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"24px"}}>
          <h1 style={{ fontSize: '22px', fontWeight: 'bold', color: '#1e3a8a' }}>مدیریت صفحه درباره ما</h1>
          <a href="/admin" style={{background:"#6b7280", color:"white", textDecoration:"none", padding:"8px 16px", borderRadius:"8px", fontSize:"14px"}}>
            بازگشت به پنل
          </a>
        </div>

        <section style={{ marginBottom: '24px', background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px', color: '#1e3a8a' }}>متن معرفی</h2>
          <textarea
            value={introText}
            onChange={(e) => setIntroText(e.target.value)}
            rows={6}
            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '15px', lineHeight: '1.8', marginBottom: '14px' }}
          />

          <div style={{ marginBottom: '14px' }}>
            <p style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#374151' }}>موقعیت متن نسبت به عکس‌ها:</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setTextPosition('top')}
                style={{
                  padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px',
                  border: textPosition === 'top' ? '2px solid #2563eb' : '1px solid #d1d5db',
                  background: textPosition === 'top' ? '#eff6ff' : '#fff',
                  color: textPosition === 'top' ? '#2563eb' : '#374151',
                  fontWeight: textPosition === 'top' ? 'bold' : 'normal',
                }}
              >
                ⬆️ بالای عکس‌ها
              </button>
              <button
                onClick={() => setTextPosition('bottom')}
                style={{
                  padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px',
                  border: textPosition === 'bottom' ? '2px solid #2563eb' : '1px solid #d1d5db',
                  background: textPosition === 'bottom' ? '#eff6ff' : '#fff',
                  color: textPosition === 'bottom' ? '#2563eb' : '#374151',
                  fontWeight: textPosition === 'bottom' ? 'bold' : 'normal',
                }}
              >
                ⬇️ پایین عکس‌ها
              </button>
            </div>
          </div>

          <button
            onClick={saveText}
            disabled={saving}
            style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
          >
            {saving ? 'در حال ذخیره...' : 'ذخیره متن و موقعیت'}
          </button>
        </section>

        <section style={{ background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '6px', color: '#1e3a8a' }}>گالری تصاویر</h2>
          <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '14px' }}>
            برای تغییر ترتیب عکس‌ها، آن‌ها را بگیرید و جابه‌جا کنید (درگ کنید).
          </p>
          <label style={{
            display: 'inline-block', padding: '10px 20px', background: '#16a34a', color: '#fff',
            borderRadius: '8px', cursor: 'pointer', marginBottom: '20px'
          }}>
            {uploading ? 'در حال آپلود...' : '+ افزودن عکس جدید'}
            <input type="file" accept="image/*" onChange={uploadImage} disabled={uploading} style={{ display: 'none' }} />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
            {images.map((img, index) => (
              <div
                key={img.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                style={{
                  border: dragIndex === index ? '2px dashed #2563eb' : '1px solid #eee',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  cursor: 'grab',
                  opacity: dragIndex === index ? 0.5 : 1,
                  background: '#fff',
                }}
              >
                <div style={{ padding: '6px 10px', background: '#f9fafb', fontSize: '12px', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>⠿</span> برای جابه‌جایی بکشید
                </div>
                <img src={img.image_url} alt="" style={{ width: '100%', height: '150px', objectFit: 'cover', pointerEvents: 'none' }} />
                <div style={{ padding: '10px' }}>
                  <input
                    type="text"
                    placeholder="توضیح کوتاه عکس..."
                    value={img.caption}
                    onChange={(e) => updateCaption(img.id, e.target.value)}
                    onBlur={(e) => saveCaption(img.id, e.target.value)}
                    style={{ width: '100%', padding: '6px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '6px', marginBottom: '8px' }}
                  />
                  <button
                    onClick={() => deleteImage(img.id, img.image_url)}
                    style={{ fontSize: '13px', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    حذف عکس
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </main>
  );
}
