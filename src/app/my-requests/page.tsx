'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { strings } from '@/lib/strings';

type Order = {
  id: string;
  full_name: string;
  quantity: number;
  total_price: number;
  status: string;
  created_at: string;
};

type ServiceRequest = {
  id: string;
  issue_type: string;
  description: string;
  status: string;
  created_at: string;
};

const orderStatusMap: Record<string, string> = {
  pending: strings.status_pending,
  confirmed: strings.status_confirmed,
  delivered: strings.status_delivered,
  cancelled: strings.status_cancelled,
};

const serviceStatusMap: Record<string, string> = {
  pending: strings.status_pending,
  accepted: strings.status_accepted,
  in_progress: strings.status_in_progress,
  completed: strings.status_completed,
  cancelled: strings.status_cancelled,
};

export default function MyRequestsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'orders' | 'service'>('service');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const userRes = await supabase.auth.getUser();
    const user = userRes.data.user;
    if (!user) { window.location.href = '/auth'; return; }

    const ordersRes = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    const serviceRes = await supabase
      .from('service_requests')
      .select('*')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false });

    setOrders(ordersRes.data || []);
    setServiceRequests(serviceRes.data || []);
    setLoading(false);
  }

  if (loading) {
    return (
      <main style={{minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center"}}>
        <p style={{color:"#1e3a8a"}}>{strings.loading}</p>
      </main>
    );
  }

  return (
    <main style={{minHeight:"100vh", background:"#f3f4f6", padding:"32px 16px"}} dir="rtl">
      <div style={{maxWidth:"600px", margin:"0 auto"}}>

        <h1 style={{fontSize:"22px", fontWeight:"bold", color:"#1e3a8a", marginBottom:"24px", textAlign:"center"}}>
          {strings.my_requests_title}
        </h1>

        {/* تب‌ها */}
        <div style={{display:"flex", gap:"8px", marginBottom:"16px"}}>
          <button
            onClick={() => setActiveTab('service')}
            style={{
              flex:1, padding:"10px", borderRadius:"10px", border:"none", cursor:"pointer", fontWeight:"bold",
              background: activeTab === 'service' ? "#1e3a8a" : "white",
              color: activeTab === 'service' ? "white" : "#1e3a8a"
            }}
          >
            {strings.tab_service} ({serviceRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            style={{
              flex:1, padding:"10px", borderRadius:"10px", border:"none", cursor:"pointer", fontWeight:"bold",
              background: activeTab === 'orders' ? "#1e3a8a" : "white",
              color: activeTab === 'orders' ? "white" : "#1e3a8a"
            }}
          >
            {strings.tab_orders} ({orders.length})
          </button>
        </div>

        {/* درخواست‌های تکنسین */}
        {activeTab === 'service' && (
          <div>
            {serviceRequests.length === 0 ? (
              <div style={{background:"white", borderRadius:"16px", padding:"32px", textAlign:"center", color:"#9ca3af"}}>
                {strings.no_data_service}
              </div>
            ) : (
              serviceRequests.map((r) => (
                <div
                  key={r.id}
                  onClick={() => { window.location.href = '/technician/track/' + r.id; }}
                  style={{background:"white", borderRadius:"12px", padding:"16px", marginBottom:"12px", cursor:"pointer", boxShadow:"0 1px 3px rgba(0,0,0,0.1)"}}
                >
                  <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                    <p style={{fontWeight:"bold"}}>{r.description}</p>
                    <span style={{padding:"4px 10px", borderRadius:"6px", fontSize:"12px", fontWeight:"bold",
                      background: r.status === 'pending' ? "#fef3c7" : r.status === 'completed' ? "#d1fae5" : "#dbeafe",
                      color: r.status === 'pending' ? "#d97706" : r.status === 'completed' ? "#065f46" : "#1d4ed8"
                    }}>
                      {serviceStatusMap[r.status] || r.status}
                    </span>
                  </div>
                  <p style={{color:"#9ca3af", fontSize:"12px", marginTop:"8px"}}>
                    {strings.click_to_view}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        {/* سفارشات فروشگاه */}
        {activeTab === 'orders' && (
          <div>
            {orders.length === 0 ? (
              <div style={{background:"white", borderRadius:"16px", padding:"32px", textAlign:"center", color:"#9ca3af"}}>
                {strings.no_data_orders}
              </div>
            ) : (
              orders.map((o) => (
                <div key={o.id} style={{background:"white", borderRadius:"12px", padding:"16px", marginBottom:"12px", boxShadow:"0 1px 3px rgba(0,0,0,0.1)"}}>
                  <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                    <p style={{fontWeight:"bold"}}>{o.total_price.toLocaleString('fa-IR')} {strings.toman}</p>
                    <span style={{padding:"4px 10px", borderRadius:"6px", fontSize:"12px", fontWeight:"bold",
                      background: o.status === 'pending' ? "#fef3c7" : o.status === 'delivered' ? "#d1fae5" : "#dbeafe",
                      color: o.status === 'pending' ? "#d97706" : o.status === 'delivered' ? "#065f46" : "#1d4ed8"
                    }}>
                      {orderStatusMap[o.status] || o.status}
                    </span>
                  </div>
                  <p style={{color:"#6b7280", fontSize:"13px", marginTop:"8px"}}>
                    {strings.col_qty}: {o.quantity}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

      </div>
    </main>
  );
}