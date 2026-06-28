'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Advertisement = {
  id: string;
  title: string;
  image_url: string;
  link_url: string;
  position: string;
  active: boolean;
  created_at: string;
};

export default function AdminAdvertisementsPage() {

  const [ads, setAds] = useState<Advertisement[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [position, setPosition] = useState('home_top');

  const [message, setMessage] = useState('');

  useEffect(() => {
    checkAdmin();
  }, []);


  async function checkAdmin() {

    const userRes = await supabase.auth.getUser();
    const user = userRes.data.user;

    if (!user) {
      window.location.href='/auth';
      return;
    }

    const adminRes = await supabase
      .from('admins')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!adminRes.data) {
      window.location.href='/';
      return;
    }

    fetchAds();
  }


  async function fetchAds(){

    const {data,error}=await supabase
      .from('advertisements')
      .select('*')
      .order('created_at',{ascending:false});


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


    const {error}=await supabase
      .from('advertisements')
      .insert({
        title,
        image_url:imageUrl,
        link_url:linkUrl,
        position,
        active:true
      });


    if(error){

      console.log(error);
      setMessage('خطا: '+error.message);
      return;

    }


    setTitle('');
    setImageUrl('');
    setLinkUrl('');

    setMessage('تبلیغ ثبت شد');

    fetchAds();

  }
    async function toggleActive(id:string, active:boolean){

    const {error}=await supabase
      .from('advertisements')
      .update({active:!active})
      .eq('id',id);

    if(error){
      setMessage('خطا: '+error.message);
      return;
    }

    fetchAds();
  }



  async function deleteAd(id:string){

    const {error}=await supabase
      .from('advertisements')
      .delete()
      .eq('id',id);


    if(error){
      setMessage('خطا: '+error.message);
      return;
    }


    fetchAds();

  }



  if(loading){

    return(
      <main style={{padding:"40px",textAlign:"center"}}>
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

      <div style={{maxWidth:"900px",margin:"auto"}}>


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


          <a href="/admin" style={{color:"#1e3a8a"}}>
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
            placeholder="آدرس تصویر بنر"
            value={imageUrl}
            onChange={e=>setImageUrl(e.target.value)}
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
            style={{
              background:"#16a34a",
              color:"white",
              border:"none",
              padding:"10px 25px",
              borderRadius:"8px",
              cursor:"pointer"
            }}
          >
            ثبت تبلیغ
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
                <div style={{
          background:"white",
          borderRadius:"12px",
          overflow:"hidden"
        }}>

          <table style={{
            width:"100%",
            borderCollapse:"collapse"
          }}>

            <thead style={{
              background:"#1e3a8a",
              color:"white"
            }}>

              <tr>
                <th style={th}>عنوان</th>
                <th style={th}>جایگاه</th>
                <th style={th}>وضعیت</th>
                <th style={th}>عملیات</th>
              </tr>

            </thead>


            <tbody>

              {ads.length === 0 ? (

                <tr>
                  <td
                    colSpan={4}
                    style={{
                      padding:"20px",
                      textAlign:"center",
                      color:"#999"
                    }}
                  >
                    تبلیغی ثبت نشده است
                  </td>
                </tr>

              ) : (

                ads.map(ad=>(

                  <tr key={ad.id}>

                    <td style={td}>
                      {ad.title}
                    </td>


                    <td style={td}>
                      {ad.position}
                    </td>


                    <td style={td}>
                      {ad.active ? 'فعال' : 'غیرفعال'}
                    </td>


                    <td style={td}>


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


                    </td>


                  </tr>

                ))

              )}

            </tbody>


          </table>

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



const th = {

  padding:"12px"

};



const td = {

  padding:"12px",
  borderBottom:"1px solid #eee"

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