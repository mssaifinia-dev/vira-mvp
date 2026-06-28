'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function TechnicianRequest() {
  const [issueType, setIssueType] = useState('ftth');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const issueTypes = [
    { value: 'ftth', label: 'قطعی اینترنت / فیبر نوری' },
    { value: 'smart-home', label: 'مشکل خانه هوشمند' },
    { value: 'electric', label: 'مشکل برق' },
    { value: 'network', label: 'مشکل شبکه' },
    { value: 'cctv', label: 'مشکل دوربین مداربسته' },
  ];

  function handlePhone(val: string) {
    const cleaned = val.replace(/[^0-9]/g, '').substring(0, 11);
    setPhone(cleaned);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError('');

    if (!description || !address || !phone) {
      setError('همه فیلدها الزامی است');
      setSubmitting(false);
      return;
    }

    if (phone.length !== 11 || phone.substring(0, 2) !== '09') {
      setError('شماره موبایل باید 11 رقم و با 09 شروع شود');
      setSubmitting(false);
      return;
    }

    const userRes = await supabase.auth.getUser();
    const user = userRes.data.user;
    if (!user) { window.location.href = '/auth'; return; }

    const insertRes = await supabase
      .from('service_requests')
      .insert({
        customer_id: user.id,
        issue_type: issueType,
        description: description,
        address: address,
        phone: phone,
      })
      .select()
      .single();

    if (insertRes.error) {
      setError('خطا در ثبت درخواست: ' + insertRes.error.message);
      setSubmitting(false);
      return;
    }

    window.location.href = '/technician/track/' + insertRes.data.id;
  }

  return (
    <main style={{minHeight:"100vh", background:"#f3f4f6", padding:"32px 16px"}} dir="rtl">
      <div style={{maxWidth:"500px", margin:"0 auto"}}>

        <h1 style={{fontSize:"24px", fontWeight:"bold", color:"#1e3a8a", textAlign:"center", marginBottom:"8px"}}>
          درخواست تکنسین
        </h1>
        <p style={{color:"#6b7280", textAlign:"center", fontSize:"14px", marginBottom:"24px"}}>
          نزدیک‌ترین تکنسین به محل شما اعزام می‌شود
        </p>

        <div style={{background:"white", borderRadius:"16px", padding:"24px"}}>

          <div style={{marginBottom:"16px"}}>
            <label style={{display:"block", fontSize:"14px", color:"#6b7280", marginBottom:"4px"}}>نوع مشکل</label>
            <select
              value={issueType}
              onChange={(e) => setIssueType(e.target.value)}
              style={{width:"100%", border:"1px solid #d1d5db", borderRadius:"8px", padding:"10px 12px", boxSizing:"border-box"}}
            >
              {issueTypes.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div style={{marginBottom:"16px"}}>
            <label style={{display:"block", fontSize:"14px", color:"#6b7280", marginBottom:"4px"}}>توضیح مشکل *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="مثلاً: اینترنت از صبح قطع شده"
              style={{width:"100%", border:"1px solid #d1d5db", borderRadius:"8px", padding:"10px 12px", boxSizing:"border-box"}}
            />
          </div>

          <div style={{marginBottom:"16px"}}>
            <label style={{display:"block", fontSize:"14px", color:"#6b7280", marginBottom:"4px"}}>آدرس دقیق *</label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
              placeholder="تهران، خیابان..."
              style={{width:"100%", border:"1px solid #d1d5db", borderRadius:"8px", padding:"10px 12px", boxSizing:"border-box"}}
            />
          </div>

          <div style={{marginBottom:"20px"}}>
            <label style={{display:"block", fontSize:"14px", color:"#6b7280", marginBottom:"4px"}}>شماره تماس * (11 رقم، با 09)</label>
            <input
              type="text"
              inputMode="numeric"
              value={phone}
              onChange={(e) => handlePhone(e.target.value)}
              placeholder="09xxxxxxxxx"
              style={{width:"100%", border:"1px solid #d1d5db", borderRadius:"8px", padding:"10px 12px", boxSizing:"border-box"}}
            />
            <p style={{fontSize:"12px", color:"#9ca3af", marginTop:"4px"}}>{phone.length}/11</p>
          </div>

          {error && <p style={{color:"red", fontSize:"14px", marginBottom:"12px"}}>{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{width:"100%", background:"#1e3a8a", color:"white", padding:"14px", borderRadius:"10px", border:"none", cursor:"pointer", fontSize:"16px", fontWeight:"bold", opacity: submitting ? 0.5 : 1}}
          >
            {submitting ? 'در حال ثبت...' : 'ثبت درخواست و یافتن تکنسین'}
          </button>

        </div>
      </div>
    </main>
  );
}