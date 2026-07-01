'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Alignment = 'right' | 'left' | 'center' | 'full';

type Advertisement = {
  id: string;
  title: string;
  image_url: string;
  link_url: string;
  position: string;
  active: boolean;
  created_at: string;
  sort_order: number;
  alignment: Alignment;
};

const alignLabels: Record<Alignment, string> = {
  right: '➡️ راست',
  left: '⬅️ چپ',
  center: '⏺ وسط',
  full: '⬛ تمام عرض',
};

export default function AdminAdvertisementsPage() {

  const [ads, setAds] = useState<Advertisement[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [position, setPosition] = useState('home_top');

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [message, setMessage] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);


  useEffect(() => {
    checkAdmin();
  }, []);


  async function checkAdmin() {

    const userRes = await supabase.auth.getUser();
    const user = userRes.data.user;

    if (!user) {
      window.location.href = '/auth';
      return;
    }


    const adminRes = await supabase
      .from('admins')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();


    if (!adminRes.data) {
      window.location.href = '/';
      return;
    }


    fetchAds();

  }



  async function fetchAds(){

    const {data,error} = await supabase
      .from('advertisements')
      .select('*')
      .order('sort_order',{ascending:true});


    if(error){
      console.log(error);
    }


    setAds(data || []);
    setLoading(false);

  }



  async function addAd(){

    if(!title){

      setMessage('عنوان تبلیغ الزامی است');
      return;

    }


    setUploading(true);
    setMessage('');


    let imageUrl = '';



    if(imageFile){


      const fileExt = imageFile.name.match(/\.([a-zA-Z0-9]+)$/);
      const ext = fileExt ? fileExt[1].toLowerCase() : 'jpg';
      const fileName = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;

      const {error: uploadError} =
        await supabase.storage
        .from('advertisements')
        .upload(fileName,imageFile);



      if(uploadError){

        setMessage(
          'خطا در آپلود تصویر: ' + uploadError.message
        );

        setUploading(false);
        return;

      }



      const {data} =
        supabase.storage
        .from('advertisements')
        .getPublicUrl(fileName);



      imageUrl = data.publicUrl;


    }

    const {error} = await supabase
      .from('advertisements')
      .insert({

        title,
        image_url:imageUrl,
        link_url:linkUrl,
        position,
        active:true,
        sort_order: ads.length,
        alignment: 'full',

      });



    if(error){

      setMessage('خطا: ' + error.message);
      setUploading(false);
      return;

    }



    setTitle('');
    setLinkUrl('');
    setImageFile(null);

    setMessage('تبلیغ با موفقیت ثبت شد');

    setUploading(false);

    fetchAds();

  }





  async function toggleActive(id:string,active:boolean){

    const {error} = await supabase
      .from('advertisements')
      .update({
        active:!active
      })
      .eq('id',id);



    if(error){

      setMessage('خطا: ' + error.message);
      return;

    }


    fetchAds();

  }



  async function setAlignment(id: string, alignment: Alignment) {
    setAds(ads.map(a => a.id === id ? { ...a, alignment } : a));
    await supabase.from('advertisements').update({ alignment }).eq('id', id);
  }



  function handleDragStart(index: number) {
    setDragIndex(index);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const reordered = [...ads];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(index, 0, moved);
    setDragIndex(index);
    setAds(reordered);
  }

  async function handleDragEnd() {
    setDragIndex(null);
    const updates = ads.map((ad, i) =>
      supabase.from('advertisements').update({ sort_order: i }).eq('id', ad.id)
    );
    await Promise.all(updates);
  }



  async function deleteAd(id:string){


    const {error} = await supabase
      .from('advertisements')
      .delete()
      .eq('id',id);



    if(error){

      setMessage('خطا: ' + error.message);
      return;

    }


    fetchAds();

  }




  if(loading){

    return(

      <main style={{
        padding:"40px",
        textAlign:"center"
      }}>

        در حال بارگذاری...

      </main>

    );

  }



  return(

    <main
      dir="rtl"
      style={{
        minHeight:"100vh",
        background:"#f3f4f6",
        padding:"32px 16px"
      }}
    >

      <div style={{
        maxWidth:"900px",
        margin:"auto"
      }}>


        <div style={{
          display:"flex",
          justifyContent:"space-between",
          marginBottom:"24px"
        }}>


          <h1 style={{
            fontSize:"24px",
            fontWeight:"bold",
            color:"#1e3a8a"
          }}>

            مدیریت تبلیغات

          </h1>


          <a href="/admin" style={{
            color:"#1e3a8a"
          }}>

            بازگشت

          </a>


        </div>



        <div style={{
          background:"white",
          padding:"20px",
          borderRadius:"12px",
          marginBottom:"20px"
        }}>


          <h2 style={{
            fontWeight:"bold",
            marginBottom:"15px"
          }}>

            ثبت تبلیغ جدید

          </h2>



          <input
            placeholder="عنوان تبلیغ"
            value={title}
            onChange={e=>setTitle(e.target.value)}
            style={inputStyle}
          />



          <input
            type="file"
            accept="image/*"
            onChange={
              e=>setImageFile(
                e.target.files?.[0] || null
              )
            }
            style={inputStyle}
          />



          <input
            placeholder="لینک مقصد"
            value={linkUrl}
            onChange={e=>setLinkUrl(e.target.value)}
            style={inputStyle}
          />



          <select
            value={position}
            onChange={e=>setPosition(e.target.value)}
            style={inputStyle}
          >

            <option value="home_top">
              صفحه اصلی بالا
            </option>


            <option value="marketplace_top">
              فروشگاه
            </option>


          </select>
                    <button
            onClick={addAd}
            disabled={uploading}
            style={{
              background:"#16a34a",
              color:"white",
              border:"none",
              padding:"10px 25px",
              borderRadius:"8px",
              cursor:"pointer"
            }}
          >

            {uploading ? 'در حال آپلود...' : 'ثبت تبلیغ'}

          </button>



          {message &&

            <p style={{
              color:"#16a34a",
              marginTop:"10px"
            }}>

              {message}

            </p>

          }


        </div>



        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '14px', marginBottom: '20px', fontSize: '13px', color: '#1e40af' }}>
          هر تبلیغ رو از نوار بالاش بگیرید و بالا/پایین بکشید تا ترتیب نمایششون توی صفحه اصلی عوض بشه.
          با دکمه‌های راست/چپ/وسط/تمام‌عرض هم چیدمانشون رو تعیین کنید.
        </div>


        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {ads.length === 0 ? (

            <p style={{ textAlign: 'center', color: '#9ca3af', padding: '20px' }}>
              تبلیغی ثبت نشده است
            </p>

          ) : (

            ads.map((ad, index) => (

              <div
                key={ad.id}
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
                  <span>⠿ {ad.title} — برای جابه‌جایی بکشید</span>
                  <span>{ad.position === 'home_top' ? 'صفحه اصلی' : 'فروشگاه'}</span>
                </div>

                <div style={{ padding: '14px' }}>
                  {ad.image_url && (
                    <img src={ad.image_url} alt={ad.title} style={{ width: '100%', maxHeight: '180px', objectFit: 'contain', background: '#f9fafb', borderRadius: '8px', marginBottom: '10px' }} />
                  )}

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{
                      fontSize: '12px', padding: '3px 10px', borderRadius: '6px',
                      background: ad.active ? '#d1fae5' : '#fee2e2',
                      color: ad.active ? '#065f46' : '#dc2626',
                    }}>
                      {ad.active ? 'فعال' : 'غیرفعال'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
                    {(['right', 'left', 'center', 'full'] as Alignment[]).map((a) => (
                      <button
                        key={a}
                        onClick={() => setAlignment(ad.id, a)}
                        style={{
                          padding: '5px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
                          border: ad.alignment === a ? '2px solid #2563eb' : '1px solid #d1d5db',
                          background: ad.alignment === a ? '#eff6ff' : '#fff',
                          color: ad.alignment === a ? '#2563eb' : '#6b7280',
                          fontWeight: ad.alignment === a ? 'bold' : 'normal',
                        }}
                      >
                        {alignLabels[a]}
                      </button>
                    ))}
                  </div>

                  <div>
                    <button
                      onClick={()=>toggleActive(ad.id,ad.active)}
                      style={btnBlue}
                    >
                      تغییر وضعیت
                    </button>

                    <button
                      onClick={()=>deleteAd(ad.id)}
                      style={btnRed}
                    >
                      حذف
                    </button>
                  </div>
                </div>
              </div>

            ))

          )}

        </div>


      </div>


    </main>


  );


}



const inputStyle = {

  width:"100%",
  padding:"10px",
  marginBottom:"10px",
  border:"1px solid #d1d5db",
  borderRadius:"8px"

};



const btnBlue = {

  background:"#2563eb",
  color:"white",
  border:"none",
  padding:"6px 10px",
  borderRadius:"6px",
  marginLeft:"5px",
  cursor:"pointer"

};



const btnRed = {

  background:"#dc2626",
  color:"white",
  border:"none",
  padding:"6px 10px",
  borderRadius:"6px",
  cursor:"pointer"

};
