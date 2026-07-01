import fs from 'fs';
import path from 'path';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Alignment = 'right' | 'left' | 'center' | 'full';
type Block =
  | { type: 'text'; id: string; content: string; sort_order: number; alignment: Alignment }
  | { type: 'image'; id: string; image_url: string; caption: string; sort_order: number; alignment: Alignment };

function getStaticImages() {
  const dir = path.join(process.cwd(), 'public', 'abouts');
  try {
    const files = fs.readdirSync(dir);
    return files
      .filter((f) => /\.(jpg|jpeg|png|webp|gif)$/i.test(f))
      .map((f) => `/abouts/${f}`);
  } catch {
    return [];
  }
}

function renderBlock(block: Block) {
  if (block.type === 'text') {
    return (
      <p style={{ fontSize: '16px', lineHeight: '2', color: '#333' }}>
        {block.content}
      </p>
    );
  }
  return (
    <div>
      <img src={block.image_url} alt={block.caption || ''} style={{ width: '100%', borderRadius: '10px', display: 'block' }} />
      {block.caption && (
        <p style={{ marginTop: '8px', fontSize: '14px', color: '#666', textAlign: 'center' }}>{block.caption}</p>
      )}
    </div>
  );
}

export default async function AboutPage() {
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

  const blocks = [textBlock, ...imageBlocks].sort((a, b) => a.sort_order - b.sort_order);
  const staticImages = getStaticImages();

  // چیدمان: بلوک‌های راست/چپ متوالی کنار هم قرار می‌گیرن، بقیه تمام‌عرض یا وسط
  const rows: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < blocks.length) {
    const current = blocks[i];

    if (current.alignment === 'right' || current.alignment === 'left') {
      const next = blocks[i + 1];
      const pairs =
        next && (next.alignment === 'right' || next.alignment === 'left') && next.alignment !== current.alignment
          ? [current, next]
          : [current];

      // ترتیب نمایش طوری که سمت راست/چپ درست باشه (در RTL، اولین فرزند سمت راست است)
      pairs.sort((a, b) => (a.alignment === 'right' ? -1 : 1));

      const isSolo = pairs.length === 1;
      const soloAlignment = isSolo ? pairs[0].alignment : null;
      rows.push(
        <div
          key={key++}
          style={{
            display: 'flex',
            gap: '24px',
            flexWrap: 'wrap',
            marginBottom: '24px',
            justifyContent: isSolo
              ? soloAlignment === 'right'
                ? 'flex-start' // در RTL یعنی چسبیدن به سمت راست
                : 'flex-end'   // در RTL یعنی چسبیدن به سمت چپ
              : 'space-between',
            width: '100%',
          }}
        >
          {pairs.map((b) => (
            <div
              key={b.id}
              style={
                isSolo
                  ? { flex: '0 1 46%', minWidth: '250px' }
                  : { flex: '1 1 280px', minWidth: '250px' }
              }
            >
              {renderBlock(b)}
            </div>
          ))}
        </div>
      );
      i += pairs.length;
    } else if (current.alignment === 'center') {
      rows.push(
        <div key={key++} style={{ maxWidth: '500px', margin: '0 auto 24px auto' }}>
          {renderBlock(current)}
        </div>
      );
      i += 1;
    } else {
      rows.push(
        <div key={key++} style={{ maxWidth: '900px', margin: '0 auto 24px auto' }}>
          {renderBlock(current)}
        </div>
      );
      i += 1;
    }
  }

  return (
    <div style={{ width: '100%', padding: '40px 24px', direction: 'rtl', boxSizing: 'border-box' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '30px', textAlign: 'center' }}>
        درباره ما
      </h1>

      {rows}

      {staticImages.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginTop: '24px' }}>
          {staticImages.map((src) => (
            <div key={src}>
              <img src={src} alt="درباره ما" style={{ width: '100%', borderRadius: '10px' }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
