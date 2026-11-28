'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { loadCatalogMaps, type CatalogMaps } from '@/lib/serviceCatalog';
import RequestDetails from '@/components/RequestDetails';

type Technician = {
  id: string;
  full_name: string;
  is_approved: boolean;
  restricted_until?: string | null;
  restriction_reason?: string | null;
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
  category_id?: string | null;
  fault_type_id?: string | null;
  center_id?: string | null;
  street_id?: string | null;
  street_text?: string | null;
  details?: Record<string, any> | null;
  priority?: string | null;
  customer_name?: string | null;
};

const issueLabels: Record<string, string> = {
  ftth: 'قطعی اینترنت / فیبر نوری',
  'smart-home': 'خانه هوشمند',
  electric: 'برق',
  network: 'شبکه',
  cctv: 'دوربین مداربسته',
};

const statusLabels: Record<string, string> = {
  pending: 'در انتظار',
  assigned: 'ارجاع‌شده',
  accepted: 'پذیرفته‌شده',
  in_progress: 'در حال انجام',
  completed: 'انجام‌شده',
  cancelled: 'لغوشده',
};

export default function TechnicianDashboard() {
  const [technician, setTechnician] = useState<Technician | null>(null);
  const [pendingRequests, setPendingRequests] = useState<ServiceRequest[]>([]);
  const [myRequests, setMyRequests] = useState<ServiceRequest[]>([]);
  const [historyRequests, setHistoryRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [etaInput, setEtaInput] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'new' | 'active' | 'history'>('active');
  const [totalEarned, setTotalEarned] = useState(0);
  const [penaltyPoints, setPenaltyPoints] = useState(0);
  const [releaseTarget, setReleaseTarget] = useState<ServiceRequest | null>(null);
  const [releaseReason, setReleaseReason] = useState('');
  const [releaseJustified, setReleaseJustified] = useState(false);
  const [releaseBusy, setReleaseBusy] = useState(false);
  const [releaseErr, setReleaseErr] = useState('');
  const [maps, setMaps] = useState<CatalogMaps | null>(null);

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
      .select('id, full_name, is_approved, restricted_until, restriction_reason')
      .eq('user_id', user.id)
      .single();

    if (!techRes.data) {
      window.location.href = '/technician/register';
      return;
    }

    setTechnician(techRes.data);
    const pen = await supabase.from('technician_penalties').select('points').eq('technician_id', techRes.data.id).eq('status', 'active');
    if (pen.data) setPenaltyPoints((pen.data as any[]).reduce((a, x) => a + (x.points || 0), 0));
    loadCatalogMaps().then(setMaps);
    await fetchRequests(techRes.data.id);
    await fetchEarnings(techRes.data.id);
    setLoading(false);
  }

  async function fetchEarnings(techId?: string) {
    const id = techId || technician?.id;
    if (!id) return;

    const invoicesRes = await supabase
      .from('invoices')
      .select('technician_payout')
      .eq('technician_id', id);

    const sum = (invoicesRes.data || []).reduce((s: number, i: any) => s + (i.technician_payout || 0), 0);
    setTotalEarned(sum);
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
      .in('status', ['assigned', 'accepted', 'in_progress'])
      .order('created_at', { ascending: false });

    const historyRes = await supabase
      .from('service_requests')
      .select('*')
      .eq('technician_id', id)
      .in('status', ['completed', 'cancelled'])
      .order('created_at', { ascending: false })
      .limit(100);

    setPendingRequests(pendingRes.data || []);
    setMyRequests(mineRes.data || []);
    setHistoryRequests(historyRes.data || []);
  }

  async function acceptRequest(requestId: string) {
    const eta = parseInt(etaInput[requestId] || '20');
    // پذیرش اتمیک در دیتابیس: هم‌زمانی دو تکنسین و دو کار فعال همزمان غیرممکن است
    const res = await supabase.rpc('technician_accept_request', { p_request: requestId, p_eta: eta });
    if (res.error) {
      alert(res.error.message);
      fetchRequests();
      return;
    }
    setActiveTab('active');
    fetchRequests();
  }

  async function startWork(requestId: string) {
    const res = await supabase.rpc('technician_start_request', { p_request: requestId });
    if (res.error) {
      alert(res.error.message);
      fetchRequests();
      return;
    }
    fetchRequests();
  }

  function openRelease(r: ServiceRequest) {
    setReleaseTarget(r);
    setReleaseReason('');
    setReleaseJustified(false);
    setReleaseErr('');
  }

  async function submitRelease() {
    if (!releaseTarget) return;
    if (releaseReason.trim().length < 5) { setReleaseErr('علت را (حداقل ۵ کاراکتر) بنویسید'); return; }
    setReleaseBusy(true);
    const res = await supabase.rpc('technician_release_request', {
      p_request: releaseTarget.id,
      p_reason: releaseReason.trim(),
      p_justified: releaseJustified,
    });
    setReleaseBusy(false);
    if (res.error) { setReleaseErr(res.error.message); return; }
    setReleaseTarget(null);
    if (res.data && res.data.penalty_points > 0) {
      alert('درخواست آزاد شد. ' + res.data.penalty_points + ' امتیاز منفی ثبت شد' + (res.data.appeal_pending ? ' (درخواست بررسی شما برای مدیر ارسال شد).' : '.') + (res.data.restricted ? '\nبه‌دلیل تکرار انصراف، پذیرش درخواست جدید موقتاً محدود شد.' : ''));
    }
    const { data: techRow } = await supabase.from('technicians').select('id, full_name, is_approved, restricted_until, restriction_reason').eq('id', technician!.id).single();
    if (techRow) setTechnician(techRow);
    const pen = await supabase.from('technician_penalties').select('points').eq('technician_id', technician!.id).eq('status', 'active');
    if (pen.data) setPenaltyPoints((pen.data as any[]).reduce((acc, x) => acc + (x.points || 0), 0));
    fetchRequests();
  }

  async function completeWork(requestId: string) {
    window.location.href = '/technician/invoice/' + requestId;
  }

  function formatDate(dateStr: string) {
    try {
      return new Date(dateStr).toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return dateStr;
    }
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

  const completedCount = historyRequests.filter(r => r.status === 'completed').length;

  const tabs = [
    { key: 'active', label: `کارهای فعال (${myRequests.length})` },
    { key: 'new', label: `درخواست‌های جدید (${pendingRequests.length})` },
    { key: 'history', label: `تاریخچه (${historyRequests.length})` },
  ];

  return (
    <main style={{minHeight:"100vh", background:"#f3f4f6", padding:"32px 16px"}} dir="rtl">
      <div style={{maxWidth:"700px", margin:"0 auto"}}>

        <h1 style={{fontSize:"22px", fontWeight:"bold", color:"#1e3a8a", marginBottom:"4px"}}>
          سلام {technician?.full_name} 👋
        </h1>
        <p style={{color:"#6b7280", fontSize:"14px", marginBottom:"20px"}}>پنل تکنسین</p>

        <div style={{marginBottom:"12px"}}>
          <a href="/technician/finance" style={{color:"#1e3a8a", fontSize:"14px", textDecoration:"none"}}>گزارش مالی و تسویه‌ی من ←</a>
        </div>

        {technician?.restricted_until && new Date(technician.restricted_until) > new Date() && (
          <div style={{background:"#fee2e2", color:"#b91c1c", borderRadius:"12px", padding:"12px 16px", marginBottom:"16px", fontSize:"14px", lineHeight:1.9}}>
            پذیرش درخواست جدید برای شما تا {new Date(technician.restricted_until).toLocaleString('fa-IR')} محدود شده است
            {technician.restriction_reason ? ' (' + technician.restriction_reason + ')' : ''}.
          </div>
        )}
        {penaltyPoints > 0 && (
          <div style={{background:"#fef3c7", color:"#92400e", borderRadius:"12px", padding:"10px 16px", marginBottom:"16px", fontSize:"13px"}}>
            امتیاز منفی فعال شما: {penaltyPoints.toLocaleString('fa-IR')} — اگر انصراف شما موجه بوده، هنگام ثبت انصراف «درخواست بررسی» را فعال کنید تا مدیر بررسی کند.
          </div>
        )}

        {/* آمار خلاصه */}
        <div style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:"12px", marginBottom:"24px"}}>
          <div style={{background:"white", borderRadius:"12px", padding:"16px", textAlign:"center", boxShadow:"0 1px 3px rgba(0,0,0,0.08)"}}>
            <p style={{fontSize:"20px", fontWeight:"bold", color:"#16a34a"}}>{completedCount}</p>
            <p style={{fontSize:"12px", color:"#6b7280", marginTop:"4px"}}>کار انجام‌شده</p>
          </div>
          <div style={{background:"white", borderRadius:"12px", padding:"16px", textAlign:"center", boxShadow:"0 1px 3px rgba(0,0,0,0.08)"}}>
            <p style={{fontSize:"20px", fontWeight:"bold", color:"#1e3a8a"}}>{myRequests.length}</p>
            <p style={{fontSize:"12px", color:"#6b7280", marginTop:"4px"}}>در حال انجام</p>
          </div>
          <div style={{background:"white", borderRadius:"12px", padding:"16px", textAlign:"center", boxShadow:"0 1px 3px rgba(0,0,0,0.08)"}}>
            <p style={{fontSize:"16px", fontWeight:"bold", color:"#7c3aed"}}>{totalEarned.toLocaleString('fa-IR')}</p>
            <p style={{fontSize:"12px", color:"#6b7280", marginTop:"4px"}}>تومان درآمد کل</p>
          </div>
        </div>

        {/* تب‌ها */}
        <div style={{display:"flex", gap:"8px", marginBottom:"16px", flexWrap:"wrap"}}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                padding:"8px 16px", borderRadius:"8px", border:"none", cursor:"pointer", fontWeight:"bold", fontSize:"13px",
                background: activeTab === tab.key ? "#1e3a8a" : "white",
                color: activeTab === tab.key ? "white" : "#1e3a8a",
                boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* کارهای فعال */}
        {activeTab === 'active' && (
          myRequests.length === 0 ? (
            <div style={{background:"white", borderRadius:"12px", padding:"32px", textAlign:"center", color:"#9ca3af"}}>
              در حال حاضر کار فعالی ندارید
            </div>
          ) : (
            myRequests.map((r) => (
              <div key={r.id} style={{background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:"12px", padding:"16px", marginBottom:"12px"}}>
                <p style={{fontWeight:"bold"}}>{issueLabels[r.issue_type] || r.issue_type}</p>
                <p style={{fontSize:"14px", color:"#6b7280", marginTop:"4px"}}>{r.description}</p>
                <RequestDetails r={r} maps={maps} />
                <p style={{fontSize:"14px", color:"#6b7280", marginTop:"4px"}}>📍 {r.address}</p>
                <p style={{fontSize:"14px", color:"#6b7280", marginTop:"4px"}}>📞 {r.phone}</p>

                <div style={{marginTop:"12px"}}>
                  {r.status === 'assigned' && (
                    <div style={{display:"flex", gap:"8px", alignItems:"center"}}>
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
                  )}
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
                  <button
                    onClick={() => openRelease(r)}
                    style={{marginRight:"8px", background:"#fee2e2", color:"#b91c1c", padding:"8px 16px", borderRadius:"8px", border:"none", cursor:"pointer", fontSize:"13px"}}
                  >
                    {r.status === 'assigned' ? 'رد درخواست' : 'انصراف از کار'}
                  </button>
                </div>
              </div>
            ))
          )
        )}

        {/* درخواست‌های جدید */}
        {activeTab === 'new' && (
          pendingRequests.length === 0 ? (
            <div style={{background:"white", borderRadius:"12px", padding:"32px", textAlign:"center", color:"#9ca3af"}}>
              درخواست جدیدی نیست
            </div>
          ) : (
            pendingRequests.map((r) => (
              <div key={r.id} style={{background:"white", borderRadius:"12px", padding:"16px", marginBottom:"12px", boxShadow:"0 1px 3px rgba(0,0,0,0.1)"}}>
                <p style={{fontWeight:"bold"}}>{issueLabels[r.issue_type] || r.issue_type}</p>
                <p style={{fontSize:"14px", color:"#6b7280", marginTop:"4px"}}>{r.description}</p>
                <RequestDetails r={r} maps={maps} />
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
          )
        )}

        {/* تاریخچه (انجام‌شده / لغوشده) */}
        {activeTab === 'history' && (
          historyRequests.length === 0 ? (
            <div style={{background:"white", borderRadius:"12px", padding:"32px", textAlign:"center", color:"#9ca3af"}}>
              هنوز کاری در تاریخچه ثبت نشده
            </div>
          ) : (
            historyRequests.map((r) => (
              <div key={r.id} style={{background:"white", borderRadius:"12px", padding:"16px", marginBottom:"12px", boxShadow:"0 1px 3px rgba(0,0,0,0.08)"}}>
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start"}}>
                  <div>
                    <p style={{fontWeight:"bold"}}>{issueLabels[r.issue_type] || r.issue_type}</p>
                    <p style={{fontSize:"13px", color:"#6b7280", marginTop:"4px"}}>{r.description}</p>
                    <RequestDetails r={r} maps={maps} />
                    <p style={{fontSize:"13px", color:"#6b7280", marginTop:"4px"}}>📍 {r.address}</p>
                    <p style={{fontSize:"12px", color:"#9ca3af", marginTop:"6px"}}>{formatDate(r.created_at)}</p>
                  </div>
                  <span style={{
                    padding:"4px 10px", borderRadius:"6px", fontSize:"12px", fontWeight:"bold", whiteSpace:"nowrap",
                    background: r.status === 'completed' ? "#d1fae5" : "#fee2e2",
                    color: r.status === 'completed' ? "#065f46" : "#dc2626",
                  }}>
                    {statusLabels[r.status] || r.status}
                  </span>
                </div>
                {r.status === 'completed' && (
                  <button
                    onClick={() => window.location.href = '/technician/invoice/' + r.id}
                    style={{marginTop:"12px", background:"#f3f4f6", color:"#1e3a8a", padding:"6px 14px", borderRadius:"8px", border:"1px solid #d1d5db", cursor:"pointer", fontSize:"12px"}}
                  >
                    مشاهده فاکتور
                  </button>
                )}
              </div>
            ))
          )
        )}

      </div>
      {releaseTarget && (
        <div onClick={() => !releaseBusy && setReleaseTarget(null)} style={{position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:"16px"}}>
          <div dir="rtl" onClick={(e) => e.stopPropagation()} style={{background:"white", borderRadius:"14px", padding:"20px", width:"100%", maxWidth:"440px"}}>
            <h2 style={{fontSize:"17px", fontWeight:"bold", color:"#b91c1c", margin:0}}>{releaseTarget.status === 'assigned' ? 'رد درخواست' : 'انصراف از کار'}</h2>
            <p style={{fontSize:"13px", color:"#6b7280", lineHeight:1.9, marginTop:"8px"}}>
              {releaseTarget.status === 'assigned'
                ? 'درخواست به حالت آزاد برمی‌گردد و جریمه‌ای ندارد.'
                : 'درخواست حذف نمی‌شود و به حالت آزاد برمی‌گردد تا تکنسین دیگری آن را بپذیرد؛ مشتری مطلع می‌شود. انصراف پس از پذیرش امتیاز منفی دارد و تکرار آن باعث محدودیت موقت می‌شود.'}
            </p>
            <label style={{display:"block", fontSize:"13px", marginTop:"12px", marginBottom:"4px"}}>علت *</label>
            <textarea rows={3} value={releaseReason} onChange={(e) => { setReleaseReason(e.target.value); setReleaseErr(''); }} style={{width:"100%", boxSizing:"border-box", border:"1px solid #d1d5db", borderRadius:"8px", padding:"8px", fontSize:"14px"}} />
            {releaseTarget.status !== 'assigned' && (
              <label style={{display:"flex", gap:"8px", alignItems:"flex-start", fontSize:"13px", marginTop:"10px", lineHeight:1.8}}>
                <input type="checkbox" checked={releaseJustified} onChange={(e) => setReleaseJustified(e.target.checked)} style={{marginTop:"4px"}} />
                دلیل انصراف موجه است (شرایط اضطراری، مشکل مشتری، اطلاعات اشتباه یا خارج از محدوده‌ی خدمت) و درخواست بررسی توسط مدیر دارم
              </label>
            )}
            {releaseErr && <p style={{color:"#dc2626", fontSize:"13px", marginTop:"8px"}}>{releaseErr}</p>}
            <div style={{display:"flex", gap:"8px", justifyContent:"flex-end", marginTop:"16px"}}>
              <button onClick={() => setReleaseTarget(null)} disabled={releaseBusy} style={{background:"#e5e7eb", color:"#374151", padding:"8px 18px", borderRadius:"8px", border:"none", cursor:"pointer"}}>انصراف</button>
              <button onClick={submitRelease} disabled={releaseBusy} style={{background:"#dc2626", color:"white", padding:"8px 18px", borderRadius:"8px", border:"none", cursor:"pointer", opacity: releaseBusy ? 0.6 : 1}}>{releaseBusy ? 'در حال ثبت...' : 'تأیید'}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
