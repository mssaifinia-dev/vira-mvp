'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type Alignment = 'right' | 'left' | 'center' | 'full';
type Block =
  | { type: 'text'; id: 'text'; content: string; sort_order: number; alignment: Alignment }
  | { type: 'image'; id: string; image_url: string; caption: string; sort_order: number; alignment: Alignment };

const alignLabels: Record<Alignment, string> = {
  right: '➡️ راست',
  left: '⬅️ چپ',
  center: '⏺ وسط',
  full: '⬛ تمام عرض',
};

export default function AdminAboutPage() {
  const [checking, setChecking] = useState(true);
  const [blocks, setBlocks] = useState<Block[]>([]);
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
    const { data: imgs } = await supabase.from('about_images').select('*').order('sort_order');

    const textBlock: Block = {
      type: 'text',
      id: 'text',
      content: content?.intro_text || '',
      sort_order: content?.sort_order ?? 0,
      alignment: (content?.alignment as Alignment) || 'full',
    };

    const imageBlocks: Block[] = (imgs || []).map((img) => ({
      type: 'image',
      id: img.id,
      image_url: img.image_url,
      caption: img.caption || '',
      sort_order: img.sort_order ?? 0,
      alignment: (img.alignment as Alignment) || 'full',
    }));

    const merged = [textBlock, ...imageBlocks].sort((a, b) => a.sort_order - b.sort_order);
    setBlocks(merged);
  }

  function updateTextContent(value: string) {
    setBlocks(blocks.map((b) => (b.type === 'text' ? { ...b, content: value } : b)));
  }

  async function saveTextContent() {
    const textBlock = blocks.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') return;
    setSaving(true);
    await supabase.from('about_content').update({ intro_text: textBlock.content, updated_at: new Date().toISOString() }).eq('id', 1);
    setSaving(false);
    alert('متن ذخیره شد');
  }

  async function setAlignment(id: string, alignment: Alignment) {
    setBlocks(blocks.map((b) => (b.id === id ? { ...b, alignment } : b)));
    const block = blocks.find((b) => b.id === id);
    if (!block) return;
    if (block.type === 'text') {
      await supabase.from('about_content').update({ alignment }).eq('id', 1);
    } else {
      await supabase.from('about_images').update({ alignment }).eq('id', id);
    }
  }

  async function updateCaption(id: string, caption: string) {
    setBlocks(blocks.map((b) => (b.id === id && b.type === 'image' ? { ...b, caption } : b)));
  }

  async function saveCaption(id: string, caption: string) {
    await supabase.from('about_images').update({ caption }).eq('id', id);
  }

  async function uploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    const extMatch = file.name.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
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
      sort_order: blocks.length,
      alignment: 'full',
    });

    await loadData();
    setUploading(false);
    e.target.value = '';
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
    const reordered = [...blocks];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(index, 0, moved);
    setDragIndex(index);
    setBlocks(reordered);
  }

  async function handleDragEnd() {
    setDragIndex(null);
    const updates = blocks.map((b, i) => {
      if (b.type === 'text') {
        return supabase.from('about_content').update({ sort_order: i }).eq('id', 1);
      }
      return supabase.from('about_images').update({ sort_order: i }).eq('id', b.id);
    });
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

        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '14px', marginBottom: '20px', fontSize: '13px', color: '#1e40af' }}>
          هر بلوک (متن یا عکس) رو از نوار بالاش بگیرید و بالا/پایین بکشید تا ترتیب صفحه عوض بشه.
          با دکمه‌های راست/چپ/وسط/تمام‌عرض هم می‌تونید کنار هم یا تنها بذاریدشون.
        </div>

        <label style={{
          display: 'inline-block', padding: '10px 20px', background: '#16a34a', color: '#fff',
          borderRadius: '8px', cursor: 'pointer', marginBottom: '20px'
        }}>
          {uploading ? 'در حال آپلود...' : '+ افزودن عکس جدید'}
          <input type="file" accept="image/*" onChange={uploadImage} disabled={uploading} style={{ display: 'none' }} />
        </label>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {blocks.map((block, index) => (
            <div
              key={block.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              style={{
                border: dragIndex === index ? '2px dashed #2563eb' : '1px solid #e5e7eb',
                borderRadius: '10px',
                overflow: 'hidden',
                background: '#fff',
                opacity: dragIndex === index ? 0.5 : 1,
              }}
            >
              <div style={{
                padding: '8px 12px', background: '#f9fafb', fontSize: '12px', color: '#6b7280',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'grab',
              }}>
                <span>⠿ {block.type === 'text' ? 'متن معرفی' : 'عکس'} — برای جابه‌جایی بکشید</span>
              </div>

              <div style={{ padding: '14px' }}>
                {block.type === 'text' ? (
                  <textarea
                    value={block.content}
                    onChange={(e) => updateTextContent(e.target.value)}
                    onBlur={saveTextContent}
                    rows={5}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', lineHeight: '1.8' }}
                  />
                ) : (
                  <div>
                    <img src={block.image_url} alt="" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '8px', marginBottom: '10px' }} />
                    <input
                      type="text"
                      placeholder="توضیح کوتاه عکس..."
                      value={block.caption}
                      onChange={(e) => updateCaption(block.id, e.target.value)}
                      onBlur={(e) => saveCaption(block.id, e.target.value)}
                      style={{ width: '100%', padding: '6px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '6px', marginBottom: '10px' }}
                    />
                    <button
                      onClick={() => deleteImage(block.id, block.image_url)}
                      style={{ fontSize: '13px', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      حذف عکس
                    </button>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '6px', marginTop: '12px', flexWrap: 'wrap' }}>
                  {(['right', 'left', 'center', 'full'] as Alignment[]).map((a) => (
                    <button
                      key={a}
                      onClick={() => setAlignment(block.id, a)}
                      style={{
                        padding: '5px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
                        border: block.alignment === a ? '2px solid #2563eb' : '1px solid #d1d5db',
                        background: block.alignment === a ? '#eff6ff' : '#fff',
                        color: block.alignment === a ? '#2563eb' : '#6b7280',
                        fontWeight: block.alignment === a ? 'bold' : 'normal',
                      }}
                    >
                      {alignLabels[a]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </main>
  );
}
