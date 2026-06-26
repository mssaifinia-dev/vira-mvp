'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Technician = {
  id: string;
  full_name: string;
  is_approved: boolean;
};

type ServiceRequest = {
  id: string;
  issue_type: string;
  description: string;
  address: string;
  phone: string;
  status: string;
  eta_minutes: number | null;
  created_at: string;
  customer_id: string;
};

const issueLabels: Record<string, string> = {
  ftth: 'قطعی اینترنت / فیبر نوری',
  'smart-home': 'خانه هوشمند',
  electric: 'برق',
  network: 'شبکه',
  cctv: 'دوربین مداربسته',
};

export default function TechnicianDashboard() {
  const [technician, setTechnician] = useState<Technician | null>(null);
  const [pendingRequests, setPendingRequests] = useState<ServiceRequest[]>([]);
  const [myRequests, setMyRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [etaInput, setEtaInput] = useState<Record<string, string>>({});

  useEffect(() => {
    init();
    const interval = setInterval(() => fetchRequests(), 5000);
    return () => clearInterval(interval);
  }, []);

  async function init() {
    const userRes = await supabase.auth.getUser();
    const user = userRes.data.user;
    if (!user) { window.location.href = '/auth'; return; }

    const techRes = await supabase
      .from('technicians')
      .select('id, full_name, is_approved')
      .eq('user_id', user.id)
      .single();

    if (!techRes.data) {
      window.location.href = '/technician/register';
      return;
    }

    setTechnician(techRes.data);
    await fetchRequests(techRes.data.id);
    setLoading(false);
  }

  async function fetchRequests(techId?: string) {
    const id = techId || technician?.id;
    if (!id) return;

    const pendingRes = await supabase
      .from('service_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    const mineRes = await supabase
      .from('service_requests')
      .select('*')
      .eq('technician_id', id)
      .in('status', ['accepted', 'in_progress'])
      .order('created_at', { ascending: false });

    setPendingRequests(pendingRes.data || []);
    setMyRequests(mineRes.data || []);
  }

  async function acceptRequest(requestId: string) {
    const eta = parseInt(etaInput[requestId] || '20');

    const reqInfo = await supabase
      .from('service_requests')
      .select('customer_id')
      .eq('id', requestId)
      .single();

    await supabase
      .from('service_requests')
      .update({
        technician_id: technician!.id,
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        eta_minutes: eta,
      })
      .eq('id', requestId);

    if (reqInfo.data) {
      await supabase.from('notifications').insert({
        user_id: reqInfo.data.customer_id,
        title: 'تکنسین یافت شد',
        message: technician!.full_name + ' درخواست شما را قبول کرد و تا ' + eta + ' دقیقه دیگر می‌رسد',
        link: '/technician/track/' + requestId,
      });
    }

    fetchRequests();
  }

  async function startWork(requestId: string) {
    const reqInfo = await supabase
      .from('service_requests')
      .select('customer_id')
      .eq('id', requestId)
      .single();

    await supabase
      .from('service_requests')
      .update({ status: 'in_progress' })
      .eq('id', requestId);

    if (reqInfo.data) {
      await supabase.from('notifications').insert({
        user_id: reqInfo.data.customer_id,
        title: 'شروع کار',
        message: 'تکنسین کار روی درخواست شما را شروع کرد',
        link: '/technician/track/' + requestId,
      });
    }

    fetchRequests();
  }

  async function completeWork(requestId: string) {
    window.location.href = '/technician/invoice/' + requestId;
  }

  if (loading) return (
    <main style={{minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center"}}>
      <p style={{color:"#1e3a8a"}}>در حال بارگذاری...</p>
    </main>
  );

  if (technician && !technician.is_approved) return (
    <main style={{minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:"16px"}} dir="rtl">
      <div style={{background:"white", borderRadius:"16px", padding:"32px", textAlign:"center", maxWidth:"400px"}}>
        <div style={{fontSize:"48px"}}>⏳</div>
        <h2 style={{fontWeight:"bold", marginTop:"16px"}}>در انتظار تایید مدیر</h2>
        <p style={{color:"#6b7280", fontSize:"14px", marginTop:"8px"}}>
          حساب شما هنوز تایید نشده. پس از بررسی مدارک، می‌توانید درخواست‌ها را ببینید.
        </p>
      </div>
    </main>
  );

  return (
    <main style={{minHeight:"100vh", background:"#f3f4f6", padding:"32px 16px"}} dir="rtl">
      <div style={{maxWidth:"700px", margin:"0 auto"}}>

        <h1 style={{fontSize:"22px", fontWeight:"bold", color:"#1e3a8a", marginBottom:"4px"}}>
          سلام {technician?.full_name} 👋
        </h1>
        <p style={{color:"#6b7280", fontSize:"14px", marginBottom:"24px"}}>پنل تکنسین</p>

        {myRequests.length > 0 && (
          <div style={{marginBottom:"24px"}}>
            <h2 style={{fontWeight:"bold", color:"#111827", marginBottom:"12px"}}>کارهای فعال من</h2>
            {myRequests.map((r) => (
              <div key={r.id} style={{background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:"12px", padding:"16px", marginBottom:"12px"}}>
                <p style={{fontWeight:"bold"}}>{issueLabels[r.issue_type] || r.issue_type}</p>
                <p style={{fontSize:"14px", color:"#6b7280", marginTop:"4px"}}>{r.description}</p>
                <p style={{fontSize:"14px", color:"#6b7280", marginTop:"4px"}}>📍 {r.address}</p>
                <p style={{fontSize:"14px", color:"#6b7280", marginTop:"4px"}}>📞 {r.phone}</p>

                <div style={{marginTop:"12px"}}>
                  {r.status === 'accepted' && (
                    <button
                      onClick={() => startWork(r.id)}
                      style={{background:"#f59e0b", color:"white", padding:"8px 16px", borderRadius:"8px", border:"none", cursor:"pointer", fontSize:"14px"}}
                    >
                      شروع کار
                    </button>
                  )}
                  {r.status === 'in_progress' && (
                    <button
                      onClick={() => completeWork(r.id)}
                      style={{background:"#16a34a", color:"white", padding:"8px 16px", borderRadius:"8px", border:"none", cursor:"pointer", fontSize:"14px"}}
                    >
                      اتمام کار و صدور فاکتور
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <h2 style={{fontWeight:"bold", color:"#111827", marginBottom:"12px"}}>درخواست‌های جدید</h2>

        {pendingRequests.length === 0 ? (
          <div style={{background:"white", borderRadius:"12px", padding:"32px", textAlign:"center", color:"#9ca3af"}}>
            درخواست جدیدی نیست
          </div>
        ) : (
          pendingRequests.map((r) => (
            <div key={r.id} style={{background:"white", borderRadius:"12px", padding:"16px", marginBottom:"12px", boxShadow:"0 1px 3px rgba(0,0,0,0.1)"}}>
              <p style={{fontWeight:"bold"}}>{issueLabels[r.issue_type] || r.issue_type}</p>
              <p style={{fontSize:"14px", color:"#6b7280", marginTop:"4px"}}>{r.description}</p>
              <p style={{fontSize:"14px", color:"#6b7280", marginTop:"4px"}}>📍 {r.address}</p>

              <div style={{display:"flex", gap:"8px", marginTop:"12px", alignItems:"center"}}>
                <input
                  type="number"
                  placeholder="زمان رسیدن (دقیقه)"
                  value={etaInput[r.id] || ''}
                  onChange={(e) => setEtaInput({ ...etaInput, [r.id]: e.target.value })}
                  style={{flex:1, border:"1px solid #d1d5db", borderRadius:"8px", padding:"8px", fontSize:"13px"}}
                />
                <button
                  onClick={() => acceptRequest(r.id)}
                  style={{background:"#1e3a8a", color:"white", padding:"8px 20px", borderRadius:"8px", border:"none", cursor:"pointer", fontSize:"14px", fontWeight:"bold"}}
                >
                  قبول کار
                </button>
              </div>
            </div>
          ))
        )}

      </div>
    </main>
  );
}