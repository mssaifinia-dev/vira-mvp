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
  user_id: string;
};

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    checkAdminAndFetch();
  }, []);

  async function checkAdminAndFetch() {
    const userRes = await supabase.auth.getUser();
    const user = userRes.data.user;
    if (!user) { window.location.href = '/auth'; return; }

    const adminRes = await supabase
      .from('admins')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!adminRes.data) { window.location.href = '/'; return; }

    fetchTickets();
  }

  async function fetchTickets() {
    const ticketsRes = await supabase
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false });

    setTickets(ticketsRes.data || []);
    setLoading(false);
  }

  async function sendReply(ticketId: string, userId: string) {
    const reply = replyInputs[ticketId];
    if (!reply) return;

    await supabase
      .from('support_tickets')
      .update({ admin_reply: reply, status: 'answered' })
      .eq('id', ticketId);

    await supabase.from('notifications').insert({
      user_id: userId,
      title: 'پاسخ پشتیبانی',
      message: 'تیم ویرا به پیام شما پاسخ داد',
      link: '/support',
    });

    fetchTickets();
  }

  async function closeTicket(ticketId: string) {
    await supabase
      .from('support_tickets')
      .update({ status: 'closed' })
      .eq('id', ticketId);
    fetchTickets();
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
      <div style={{maxWidth:"800px", margin:"0 auto"}}>

        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"24px"}}>
          <h1 style={{fontSize:"22px", fontWeight:"bold", color:"#1e3a8a"}}>پیام‌های پشتیبانی</h1>
          <a href="/admin" style={{color:"#1e3a8a", fontSize:"14px", textDecoration:"none"}}>← بازگشت به پنل اصلی</a>
        </div>

        {tickets.length === 0 ? (
          <div style={{background:"white", borderRadius:"12px", padding:"32px", textAlign:"center", color:"#9ca3af"}}>
            هیچ پیامی ثبت نشده
          </div>
        ) : (
          tickets.map((t) => {
            const statusInfo = statusLabels[t.status] || statusLabels.open;
            return (
              <div key={t.id} style={{background:"white", borderRadius:"12px", padding:"20px", marginBottom:"16px"}}>

                <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"8px"}}>
                  <p style={{fontWeight:"bold"}}>{t.subject}</p>
                  <span style={{background: statusInfo.bg, color: statusInfo.color, fontSize:"12px", padding:"4px 10px", borderRadius:"6px", fontWeight:"bold"}}>
                    {statusInfo.label}
                  </span>
                </div>

                <p style={{color:"#374151", fontSize:"14px", marginBottom:"12px"}}>{t.message}</p>

                {t.admin_reply && (
                  <div style={{background:"#eff6ff", borderRadius:"8px", padding:"12px", marginBottom:"12px"}}>
                    <p style={{fontSize:"12px", color:"#1e3a8a", fontWeight:"bold", marginBottom:"4px"}}>پاسخ ارسال‌شده:</p>
                    <p style={{fontSize:"14px"}}>{t.admin_reply}</p>
                  </div>
                )}

                {t.status !== 'closed' && (
                  <div>
                    <textarea
                      value={replyInputs[t.id] || ''}
                      onChange={(e) => setReplyInputs({ ...replyInputs, [t.id]: e.target.value })}
                      placeholder="پاسخ خود را بنویسید..."
                      rows={2}
                      style={{width:"100%", border:"1px solid #d1d5db", borderRadius:"8px", padding:"8px 10px", boxSizing:"border-box", marginBottom:"8px", fontSize:"13px"}}
                    />
                    <div style={{display:"flex", gap:"8px"}}>
                      <button
                        onClick={() => sendReply(t.id, t.user_id)}
                        style={{background:"#1e3a8a", color:"white", border:"none", borderRadius:"6px", padding:"6px 16px", cursor:"pointer", fontSize:"13px"}}
                      >
                        ارسال پاسخ
                      </button>
                      <button
                        onClick={() => closeTicket(t.id)}
                        style={{background:"#f3f4f6", color:"#6b7280", border:"none", borderRadius:"6px", padding:"6px 16px", cursor:"pointer", fontSize:"13px"}}
                      >
                        بستن تیکت
                      </button>
                    </div>
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