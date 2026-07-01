import fs from 'fs';
import path from 'path';
import { supabase } from '@/lib/supabase';

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

export default async function AboutPage() {
  const { data: content } = await supabase.from('about_content').select('*').single();
  const { data: dynamicImages } = await supabase
    .from('about_images')
    .select('*')
    .order('sort_order');

  const staticImages = getStaticImages();
  const textPosition = content?.text_position === 'bottom' ? 'bottom' : 'top';

  const introBlock = (
    <p style={{ fontSize: '17px', lineHeight: '2', color: '#333', marginBottom: '40px', textAlign: 'center' }}>
      {content?.intro_text}
    </p>
  );

  const galleryBlock = (staticImages.length > 0 || (dynamicImages && dynamicImages.length > 0)) && (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
      {dynamicImages?.map((img) => (
        <div key={img.id}>
          <img src={img.image_url} alt={img.caption || ''} style={{ width: '100%', borderRadius: '10px' }} />
          {img.caption && (
            <p style={{ marginTop: '8px', fontSize: '14px', color: '#666', textAlign: 'center' }}>
              {img.caption}
            </p>
          )}
        </div>
      ))}

      {staticImages.map((src) => (
        <div key={src}>
          <img src={src} alt="درباره ما" style={{ width: '100%', borderRadius: '10px' }} />
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 20px', direction: 'rtl' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '20px', textAlign: 'center' }}>
        درباره ما
      </h1>

      {textPosition === 'top' ? (
        <>
          {introBlock}
          {galleryBlock}
        </>
      ) : (
        <>
          {galleryBlock}
          {introBlock}
        </>
      )}
    </div>
  );
}
