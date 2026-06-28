'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Notif = {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  link: string | null;
  created_at: string;
};

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifs();
  }, []);

  async function fetchNotifs() {
    const userRes = await supabase.auth.getUser();
    const user = userRes.data.user;
    if (!user) { window.location.href = '/auth'; return; }

    const res = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    setNotifs(res.data || []);
    setLoading(false);

    const unreadIds = (res.data || []).filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length > 0) {
      await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds);
    }
  }

  function timeAgo(dateStr: string) {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'همین الان';
    if (diffMin < 60) return diffMin + ' دقیقه پیش';
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return diffHour + ' ساعت پیش';
    const diffDay = Math.floor(diffHour / 24);
    return diffDay + ' روز پیش';
  }

  if (loading) {
    return (
      <main style={{minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center"}}>
        <p style={{color:"#1e3a8a"}}>در حال بارگذاری...</p>
      </main>
    );
  }

  return (
    <main style={{minHeight:"100vh", background:"#f3f4f6", padding:"32px 16px"}} dir="rtl">
      <div style={{maxWidth:"600px", margin:"0 auto"}}>

        <h1 style={{fontSize:"22px", fontWeight:"bold", color:"#1e3a8a", marginBottom:"24px"}}>
          اعلان‌ها
        </h1>

        {notifs.length === 0 ? (
          <div style={{background:"white", borderRadius:"12px", padding:"32px", textAlign:"center", color:"#9ca3af"}}>
            هیچ اعلانی ندارید
          </div>
        ) : (
          notifs.map((n) => {
            const content = (
              <div style={{background: n.is_read ? "white" : "#eff6ff", borderRadius:"12px", padding:"16px", marginBottom:"12px", border: n.is_read ? "1px solid #f3f4f6" : "1px solid #bfdbfe"}}>
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"6px"}}>
                  <p style={{fontWeight:"bold"}}>{n.title}</p>
                  <span style={{fontSize:"12px", color:"#9ca3af"}}>{timeAgo(n.created_at)}</span>
                </div>
                <p style={{color:"#6b7280", fontSize:"14px"}}>{n.message}</p>
              </div>
            );

            if (n.link) {
              return (
                <a key={n.id} href={n.link} style={{textDecoration:"none", display:"block"}}>
                  {content}
                </a>
              );
            }
            return <div key={n.id}>{content}</div>;
          })
        )}

      </div>
    </main>
  );
}