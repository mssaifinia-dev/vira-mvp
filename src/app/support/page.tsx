'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Ticket = {
  id: string;
  subject: string;
  message: string;
  status: string;
  admin_reply: string | null;
  created_at: string;
};

export default function SupportPage() {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [myTickets, setMyTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTickets();
  }, []);

  async function fetchTickets() {
    const userRes = await supabase.auth.getUser();
    const user = userRes.data.user;
    if (!user) { window.location.href = '/auth'; return; }

    const ticketsRes = await supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    setMyTickets(ticketsRes.data || []);
    setLoading(false);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError('');

    if (!subject || !message) {
      setError('موضوع و پیام الزامی است');
      setSubmitting(false);
      return;
    }

    const userRes = await supabase.auth.getUser();
    const user = userRes.data.user;

    const { error } = await supabase.from('support_tickets').insert({
      user_id: user!.id,
      subject: subject,
      message: message,
    });

    if (error) {
      setError('خطا در ثبت تیکت: ' + error.message);
    } else {
      setSubject('');
      setMessage('');
      setDone(true);
      fetchTickets();
      setTimeout(() => setDone(false), 3000);
    }

    setSubmitting(false);
  }

  const statusLabels: Record<string, { label: string; color: string; bg: string }> = {
    open: { label: 'در انتظار پاسخ', color: '#d97706', bg: '#fef3c7' },
    answered: { label: 'پاسخ داده شده', color: '#065f46', bg: '#d1fae5' },
    closed: { label: 'بسته شده', color: '#6b7280', bg: '#f3f4f6' },
  };

  if (loading) {
    return (
      <main style={{minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center"}}>
        <p style={{color:"#1e3a8a"}}>در حال بارگذاری...</p>
      </main>
    );
  }

  return (
    <main style={{minHeight:"100vh", background:"#f3f4f6", padding:"32px 16px"}} dir="rtl">
      <div style={{maxWidth:"700px", margin:"0 auto"}}>

        <h1 style={{fontSize:"24px", fontWeight:"bold", color:"#1e3a8a", marginBottom:"8px"}}>
          پشتیبانی و تماس با ما
        </h1>
        <p style={{color:"#6b7280", fontSize:"14px", marginBottom:"24px"}}>
          سوال یا مشکلی دارید؟ پیامتان را برای تیم ویرا ارسال کنید
        </p>

        <div style={{background:"white", borderRadius:"16px", padding:"24px", marginBottom:"24px"}}>
          <h2 style={{fontWeight:"bold", marginBottom:"16px"}}>ارسال پیام جدید</h2>

          <div style={{marginBottom:"16px"}}>
            <label style={{display:"block", fontSize:"14px", color:"#6b7280", marginBottom:"4px"}}>موضوع</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              style={{width:"100%", border:"1px solid #d1d5db", borderRadius:"8px", padding:"10px 12px", boxSizing:"border-box"}}
              placeholder="مثلاً: مشکل در ثبت سفارش"
            />
          </div>

          <div style={{marginBottom:"16px"}}>
            <label style={{display:"block", fontSize:"14px", color:"#6b7280", marginBottom:"4px"}}>پیام</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              style={{width:"100%", border:"1px solid #d1d5db", borderRadius:"8px", padding:"10px 12px", boxSizing:"border-box"}}
              placeholder="مشکل یا سوال خود را توضیح دهید..."
            />
          </div>

          {error && <p style={{color:"red", fontSize:"14px", marginBottom:"12px"}}>{error}</p>}
          {done && <p style={{color:"#16a34a", fontSize:"14px", marginBottom:"12px"}}>✅ پیام شما با موفقیت ارسال شد</p>}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{width:"100%", background:"#1e3a8a", color:"white", padding:"12px", borderRadius:"8px", border:"none", cursor:"pointer", fontSize:"15px", fontWeight:"bold", opacity: submitting ? 0.5 : 1}}
          >
            {submitting ? 'در حال ارسال...' : 'ارسال پیام'}
          </button>
        </div>

        <h2 style={{fontWeight:"bold", color:"#1e3a8a", marginBottom:"12px"}}>پیام‌های قبلی من</h2>

        {myTickets.length === 0 ? (
          <div style={{background:"white", borderRadius:"12px", padding:"24px", textAlign:"center", color:"#9ca3af"}}>
            هنوز پیامی ارسال نکرده‌اید
          </div>
        ) : (
          myTickets.map((t) => {
            const statusInfo = statusLabels[t.status] || statusLabels.open;
            return (
              <div key={t.id} style={{background:"white", borderRadius:"12px", padding:"16px", marginBottom:"12px"}}>
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"8px"}}>
                  <p style={{fontWeight:"bold"}}>{t.subject}</p>
                  <span style={{background: statusInfo.bg, color: statusInfo.color, fontSize:"12px", padding:"4px 10px", borderRadius:"6px", fontWeight:"bold"}}>
                    {statusInfo.label}
                  </span>
                </div>
                <p style={{color:"#6b7280", fontSize:"14px"}}>{t.message}</p>
                {t.admin_reply && (
                  <div style={{marginTop:"12px", background:"#eff6ff", borderRadius:"8px", padding:"12px"}}>
                    <p style={{fontSize:"12px", color:"#1e3a8a", fontWeight:"bold", marginBottom:"4px"}}>پاسخ ویرا:</p>
                    <p style={{fontSize:"14px", color:"#374151"}}>{t.admin_reply}</p>
                  </div>
                )}
              </div>
            );
          })
        )}

      </div>
    </main>
  );
}