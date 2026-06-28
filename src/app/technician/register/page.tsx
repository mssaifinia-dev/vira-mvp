'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { strings } from '@/lib/strings';

const iranCities = [
  'تهران', 'مشهد', 'اصفهان', 'کرج', 'شیراز', 'تبریز', 'قم', 'اهواز',
  'کرمانشاه', 'رشت', 'ارومیه', 'زاهدان', 'کرمان', 'همدان', 'یزد',
  'اردبیل', 'بندرعباس', 'اراک', 'ساری', 'سنندج', 'گرگان', 'قزوین',
  'خرم‌آباد', 'زنجان', 'شهرکرد', 'بیرجند', 'بجنورد', 'ایلام', 'بوشهر',
  'سمنان', 'یاسوج',
];

export default function TechnicianRegister() {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('تهران');
  const [nationalId, setNationalId] = useState('');
  const [specialty, setSpecialty] = useState('copper_repair');
  const [experience, setExperience] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const specialties = [
    { value: 'copper_repair', label: 'رفع خرابی تلفن مسی' },
    { value: 'fiber_repair', label: 'رفع خرابی فیبر نوری' },
    { value: 'fusion', label: 'فیوژن‌کار' },
    { value: 'smart_home', label: 'خانه هوشمند' },
    { value: 'electric_building', label: 'برقکار ساختمانی' },
    { value: 'electric_industrial', label: 'برقکار صنعتی' },
    { value: 'modem_config', label: 'کانفیگ و نصب مودم' },
    { value: 'appliance_repair', label: 'تعمیرکار لوازم خانگی' },
  ];

  function handlePhone(val: string) {
    setPhone(val.replace(/[^0-9]/g, '').substring(0, 11));
  }

  function handleNationalId(val: string) {
    setNationalId(val.replace(/[^0-9]/g, '').substring(0, 10));
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError('');

    if (!fullName || !phone || !city || !nationalId) {
      setError(strings.required_error);
      setSubmitting(false);
      return;
    }

    if (phone.length !== 11 || phone.substring(0, 2) !== '09') {
      setError(strings.phone_error);
      setSubmitting(false);
      return;
    }

    if (nationalId.length !== 10) {
      setError(strings.national_id_error);
      setSubmitting(false);
      return;
    }

    if (!photoFile) {
      setError('لطفاً عکس خود را آپلود کنید');
      setSubmitting(false);
      return;
    }

    const userRes = await supabase.auth.getUser();
    const user = userRes.data.user;
    if (!user) { window.location.href = '/auth'; return; }

    const fileExt = photoFile.name.split('.').pop();
    const filePath = user.id + '-' + Date.now() + '.' + fileExt;

    const uploadRes = await supabase.storage.from('technician-photos').upload(filePath, photoFile);

    if (uploadRes.error) {
      setError('خطا در آپلود عکس: ' + uploadRes.error.message);
      setSubmitting(false);
      return;
    }

    const urlRes = supabase.storage.from('technician-photos').getPublicUrl(filePath);
    const photoUrl = urlRes.data.publicUrl;

    const insertRes = await supabase.from('technicians').insert({
      user_id: user.id,
      full_name: fullName,
      phone: phone,
      city: city,
      specialty: specialty,
      national_id: nationalId,
      experience: experience,
      photo_url: photoUrl,
    });

    if (insertRes.error) {
      setError(insertRes.error.message);
    } else {
      setDone(true);
    }

    setSubmitting(false);
  }

  if (done) {
    return (
      <main dir="rtl" style={{minHeight:'100vh', background:'#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center'}}>
        <div style={{background:'white', padding:'32px', borderRadius:'16px', textAlign:'center', maxWidth:'400px'}}>
          <p style={{fontSize:'48px'}}>✅</p>
          <h2 style={{color:'#16a34a', fontWeight:'bold', marginTop:'16px'}}>{strings.register_done}</h2>
          <p style={{color:'#6b7280', fontSize:'14px', marginTop:'8px'}}>{strings.waiting_approval}</p>
          <button
            onClick={() => { window.location.href = '/'; }}
            style={{marginTop:'20px', background:'#1e3a8a', color:'white', padding:'10px 24px', border:'none', borderRadius:'8px', cursor:'pointer'}}
          >
            {strings.back_home}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" style={{minHeight:'100vh', background:'#f3f4f6', padding:'32px 16px'}}>
      <div style={{maxWidth:'500px', margin:'0 auto', background:'white', borderRadius:'16px', padding:'24px'}}>
        <h1 style={{color:'#1e3a8a', marginBottom:'24px', fontWeight:'bold', fontSize:'22px'}}>
          {strings.register_technician}
        </h1>

        <div style={{marginBottom:'16px', textAlign:'center'}}>
          <label style={{display:'block', marginBottom:'8px', fontSize:'14px', color:'#6b7280'}}>
            عکس پروفایل * (مشتری شما را با این عکس می‌شناسد)
          </label>
          <div style={{width:'100px', height:'100px', borderRadius:'50%', background:'#f3f4f6', margin:'0 auto 8px', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', border:'2px solid #d1d5db'}}>
            {photoPreview ? (
              <img src={photoPreview} alt="پیش‌نمایش" style={{width:'100%', height:'100%', objectFit:'cover'}} />
            ) : (
              <span style={{fontSize:'32px'}}>👤</span>
            )}
          </div>
          <label style={{display:'inline-block', background:'#1e3a8a', color:'white', padding:'8px 20px', borderRadius:'8px', cursor:'pointer', fontSize:'13px'}}>
            انتخاب عکس
            <input type="file" accept="image/*" onChange={handlePhotoChange} style={{display:'none'}} />
          </label>
        </div>

        <div style={{marginBottom:'16px'}}>
          <label style={{display:'block', marginBottom:'4px', fontSize:'14px', color:'#6b7280'}}>
            {strings.name_label} *
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            style={{width:'100%', border:'1px solid #d1d5db', borderRadius:'8px', padding:'10px', boxSizing:'border-box'}}
          />
        </div>

        <div style={{marginBottom:'16px'}}>
          <label style={{display:'block', marginBottom:'4px', fontSize:'14px', color:'#6b7280'}}>
            {strings.phone_label} * (09xxxxxxxxx)
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={phone}
            onChange={(e) => handlePhone(e.target.value)}
            style={{width:'100%', border:'1px solid #d1d5db', borderRadius:'8px', padding:'10px', boxSizing:'border-box'}}
          />
          <small style={{color:'#9ca3af'}}>{phone.length}/11</small>
        </div>

        <div style={{marginBottom:'16px'}}>
          <label style={{display:'block', marginBottom:'4px', fontSize:'14px', color:'#6b7280'}}>
            {strings.national_id_label} *
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={nationalId}
            onChange={(e) => handleNationalId(e.target.value)}
            style={{width:'100%', border:'1px solid #d1d5db', borderRadius:'8px', padding:'10px', boxSizing:'border-box'}}
          />
          <small style={{color:'#9ca3af'}}>{nationalId.length}/10</small>
        </div>

        <div style={{marginBottom:'16px'}}>
          <label style={{display:'block', marginBottom:'4px', fontSize:'14px', color:'#6b7280'}}>
            {strings.city_label} *
          </label>
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            style={{width:'100%', border:'1px solid #d1d5db', borderRadius:'8px', padding:'10px', boxSizing:'border-box'}}
          >
            {iranCities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div style={{marginBottom:'16px'}}>
          <label style={{display:'block', marginBottom:'4px', fontSize:'14px', color:'#6b7280'}}>
            {strings.specialty_label}
          </label>
          <select
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            style={{width:'100%', border:'1px solid #d1d5db', borderRadius:'8px', padding:'10px', boxSizing:'border-box'}}
          >
            {specialties.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div style={{marginBottom:'20px'}}>
          <label style={{display:'block', marginBottom:'4px', fontSize:'14px', color:'#6b7280'}}>
            {strings.experience_label}
          </label>
          <input
            type="text"
            value={experience}
            onChange={(e) => setExperience(e.target.value)}
            style={{width:'100%', border:'1px solid #d1d5db', borderRadius:'8px', padding:'10px', boxSizing:'border-box'}}
          />
        </div>

        {error ? (
          <p style={{color:'red', marginBottom:'12px', fontSize:'14px'}}>{error}</p>
        ) : null}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{width:'100%', background:'#1e3a8a', color:'white', padding:'14px', border:'none', borderRadius:'10px', cursor:'pointer', fontWeight:'bold', fontSize:'16px', opacity: submitting ? 0.5 : 1}}
        >
          {submitting ? '...' : strings.register_technician}
        </button>
      </div>
    </main>
  );
}