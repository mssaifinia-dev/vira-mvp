'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { strings } from '@/lib/strings';
import ZoomableImage from '@/components/ZoomableImage';
import { sendSms } from '@/lib/sms';

type Seller = { id: string; shop_name: string; phone: string; city: string; is_approved: boolean; };
type Product = { id: string; name: string; category: string; price: number; stock: number; };
type Order = { id: string; full_name: string; phone: string; quantity: number; total_price: number; status: string; created_at: string; payment_method: string; };
type Technician = { id: string; full_name: string; phone: string; city: string; specialty: string; national_id: string; experience: string; is_approved: boolean; created_at: string; photo_url: string | null; };
type ServiceRequest = { id: string; issue_type: string; description: string; address: string; phone: string; status: string; created_at: string; technician_id: string | null; };

const statusMap: Record<string, string> = {
  pending: strings.status_pending,
  confirmed: strings.status_confirmed,
  delivered: strings.status_delivered,
  cancelled: strings.status_cancelled,
  accepted: strings.status_accepted,
  completed: strings.status_completed,
};

const specialtyMap: Record<string, string> = {
  copper_repair: 'رفع خرابی تلفن مسی',
  fiber_repair: 'رفع خرابی فیبر نوری',
  fusion: 'فیوژن‌کار',
  smart_home: 'خانه هوشمند',
  electric_building: 'برقکار ساختمانی',
  electric_industrial: 'برقکار صنعتی',
  modem_config: 'کانفیگ و نصب مودم',
  appliance_repair: 'تعمیرکار لوازم خانگی',
};

const iranCitiesList = [
  'تهران', 'مشهد', 'اصفهان', 'کرج', 'شیراز', 'تبریز', 'قم', 'اهواز',
  'کرمانشاه', 'رشت', 'ارومیه', 'زاهدان', 'کرمان', 'همدان', 'یزد',
  'اردبیل', 'بندرعباس', 'اراک', 'ساری', 'سنندج', 'گرگان', 'قزوین',
  'خرم‌آباد', 'زنجان', 'شهرکرد', 'بیرجند', 'بجنورد', 'ایلام', 'بوشهر',
  'سمنان', 'یاسوج',
];

export default function AdminPanel() {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'orders' | 'sellers' | 'products' | 'technicians' | 'service'>('orders');
  const [loading, setLoading] = useState(true);

  const [techCityFilter, setTechCityFilter] = useState('all');
  const [techSpecialtyFilter, setTechSpecialtyFilter] = useState('all');

  useEffect(() => { checkAdmin(); }, []);

  async function checkAdmin() {
    const userRes = await supabase.auth.getUser();
    const user = userRes.data.user;
    if (!user) { window.location.href = '/auth'; return; }
    const adminRes = await supabase.from('admins').select('id').eq('user_id', user.id).single();
    if (!adminRes.data) { window.location.href = '/'; return; }
    fetchData();
  }

  async function fetchData() {
    const [s, p, o, t, sr] = await Promise.all([
      supabase.from('sellers').select('*').order('created_at', { ascending: false }),
      supabase.from('products').select('*').order('created_at', { ascending: false }),
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('technicians').select('*').order('created_at', { ascending: false }),
      supabase.from('service_requests').select('*').order('created_at', { ascending: false }),
    ]);
    setSellers(s.data || []);
    setProducts(p.data || []);
    setOrders(o.data || []);
    setTechnicians(t.data || []);
    setServiceRequests(sr.data || []);
    setLoading(false);
  }

  async function approveSeller(id: string) {
    await supabase.from('sellers').update({ is_approved: true }).eq('id', id);
    const sellerRes = await supabase.from('sellers').select('phone').eq('id', id).single();
    if (sellerRes.data?.phone) {
      sendSms(sellerRes.data.phone, 'ویرا: حساب فروشندگی شما تایید شد. اکنون می‌توانید محصولات خود را ثبت کنید.');
    }
    fetchData();
  }
  async function deleteSeller(id: string) { await supabase.from('sellers').delete().eq('id', id); fetchData(); }
  async function deleteProduct(id: string) { await supabase.from('products').delete().eq('id', id); fetchData(); }

  async function updateOrderStatus(id: string, status: string) {
    const orderRes = await supabase.from('orders').select('user_id, full_name, phone').eq('id', id).single();
    await supabase.from('orders').update({ status }).eq('id', id);

    if (orderRes.data) {
      const statusText = statusMap[status] || status;

      await supabase.from('notifications').insert({
        user_id: orderRes.data.user_id,
        title: 'وضعیت سفارش تغییر کرد',
        message: 'وضعیت سفارش شما به "' + statusText + '" تغییر یافت',
        link: '/my-requests',
      });

      if (orderRes.data.phone) {
        try {
          await fetch('/api/sms/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mobile: orderRes.data.phone,
              message: 'ویرا: وضعیت سفارش شما به "' + statusText + '" تغییر یافت.',
            }),
          });
        } catch (e) {
          console.log('SMS send failed', e);
        }
      }
    }

    fetchData();
  }

  async function approveTechnician(id: string) {
    await supabase.from('technicians').update({ is_approved: true }).eq('id', id);
    const techRes = await supabase.from('technicians').select('phone').eq('id', id).single();
    if (techRes.data?.phone) {
      sendSms(techRes.data.phone, 'ویرا: حساب تکنسینی شما تایید شد. اکنون می‌توانید درخواست‌های سرویس را دریافت کنید.');
    }
    fetchData();
  }
  async function deleteTechnician(id: string) { await supabase.from('technicians').delete().eq('id', id); fetchData(); }

  if (loading) return (
    <main style={{minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center"}}>
      <p style={{color:"#1e3a8a"}}>{strings.loading}</p>
    </main>
  );

  const tabs = [
    { key: 'orders', label: strings.tab_orders + ' (' + orders.length + ')' },
    { key: 'technicians', label: strings.tab_technicians + ' (' + technicians.length + ')' },
    { key: 'service', label: strings.tab_service + ' (' + serviceRequests.length + ')' },
    { key: 'sellers', label: strings.tab_sellers + ' (' + sellers.length + ')' },
    { key: 'products', label: strings.tab_products + ' (' + products.length + ')' },
  ];

  const techCities = iranCitiesList;
  const techSpecialties = Object.keys(specialtyMap);

  const filteredTechnicians = technicians.filter(t => {
    const cityMatch = techCityFilter === 'all' || t.city === techCityFilter;
    const specialtyMatch = techSpecialtyFilter === 'all' || t.specialty === techSpecialtyFilter;
    return cityMatch && specialtyMatch;
  });

  return (
    <main style={{minHeight:"100vh", background:"#f3f4f6", padding:"32px 16px"}} dir="rtl">
      <div style={{maxWidth:"1000px", margin:"0 auto"}}>

        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"24px", flexWrap:"wrap", gap:"12px"}}>
          <h1 style={{fontSize:"22px", fontWeight:"bold", color:"#1e3a8a"}}>{strings.admin_panel}</h1>
          <div style={{display:"flex", gap:"8px", flexWrap:"wrap"}}>
            <a href="/admin/reports" style={{background:"#16a34a", color:"white", textDecoration:"none", padding:"8px 16px", borderRadius:"8px", fontSize:"14px"}}>
              گزارش‌های کلی
            </a>
            <a href="/admin/support" style={{background:"#1e3a8a", color:"white", textDecoration:"none", padding:"8px 16px", borderRadius:"8px", fontSize:"14px"}}>
              پیام‌های پشتیبانی
            </a>
            <a href="/admin/customers" style={{background:"#8b5cf6", color:"white", textDecoration:"none", padding:"8px 16px", borderRadius:"8px", fontSize:"14px"}}>
              بایگانی مشتریان
            </a>
            <a href="/admin/discounts" style={{background:"#dc2626", color:"white", textDecoration:"none", padding:"8px 16px", borderRadius:"8px", fontSize:"14px"}}>
              کدهای تخفیف
            </a>
            <a href="/admin/finance" style={{background:"#7c3aed", color:"white", textDecoration:"none", padding:"8px 16px", borderRadius:"8px", fontSize:"14px"}}>
              سود و زیان
            </a>
            <a href="/admin/inventory" style={{background:"#f59e0b", color:"white", textDecoration:"none", padding:"8px 16px", borderRadius:"8px", fontSize:"14px"}}>
              مدیریت انبار
            </a>
            <a href="/admin/advertisements" style={{background:"#f59e0b", color:"white", textDecoration:"none", padding:"8px 16px", borderRadius:"8px", fontSize:"14px"}}>
              تبلیغات
            </a>
            <a href="/admin/about" style={{background:"#0891b2", color:"white", textDecoration:"none", padding:"8px 16px", borderRadius:"8px", fontSize:"14px"}}>
              درباره ما
            </a>
            <a href="/admin/manage-features" style={{background:"#1e3a8a", color:"white", textDecoration:"none", padding:"8px 16px", borderRadius:"8px", fontSize:"14px", border:"2px solid #fbbf24"}}>
              ⚙️ مدیریت فیچرها
            </a>
            <a href="/admin/manage-academy" style={{background:"#0d9488", color:"white", textDecoration:"none", padding:"8px 16px", borderRadius:"8px", fontSize:"14px"}}>
              📚 آکادمی
            </a>
            <a href="/admin/manage-ai" style={{background:"#4f46e5", color:"white", textDecoration:"none", padding:"8px 16px", borderRadius:"8px", fontSize:"14px"}}>
              🤖 Vira AI
            </a>
          </div>
        </div>

        <div style={{display:"grid", gridTemplateColumns:"repeat(5, 1fr)", gap:"12px", marginBottom:"24px"}}>
          {[
            { label: strings.tab_orders, value: String(orders.length), color: "#1e3a8a" },
            { label: strings.tab_technicians, value: technicians.filter(t => !t.is_approved).length + ' ' + strings.stat_pending_label, color: "#f59e0b" },
            { label: strings.tab_service, value: serviceRequests.filter(r => r.status === 'pending').length + ' ' + strings.stat_pending_label, color: "#8b5cf6" },
            { label: strings.tab_sellers, value: sellers.filter(s => !s.is_approved).length + ' ' + strings.stat_pending_label, color: "#f59e0b" },
            { label: strings.tab_products, value: String(products.length), color: "#16a34a" },
          ].map((stat, i) => (
            <div key={i} style={{background:"white", borderRadius:"12px", padding:"16px", textAlign:"center", boxShadow:"0 1px 3px rgba(0,0,0,0.1)"}}>
              <p style={{fontSize:"16px", fontWeight:"bold", color:stat.color}}>{stat.value}</p>
              <p style={{fontSize:"12px", color:"#6b7280", marginTop:"4px"}}>{stat.label}</p>
            </div>
          ))}
        </div>

        <div style={{display:"flex", gap:"8px", marginBottom:"16px", flexWrap:"wrap"}}>
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
              style={{padding:"8px 16px", borderRadius:"8px", border:"none", cursor:"pointer", fontWeight:"bold",
                background: activeTab === tab.key ? "#1e3a8a" : "white",
                color: activeTab === tab.key ? "white" : "#1e3a8a"
              }}>
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{background:"white", borderRadius:"12px", overflow:"hidden", boxShadow:"0 1px 3px rgba(0,0,0,0.1)"}}>

          {activeTab === 'orders' && (
            <table style={{width:"100%", borderCollapse:"collapse", textAlign:"right"}}>
              <thead style={{background:"#1e3a8a", color:"white"}}>
                <tr>
                  <th style={{padding:"12px"}}>{strings.col_name}</th>
                  <th style={{padding:"12px"}}>{strings.col_phone}</th>
                  <th style={{padding:"12px"}}>{strings.col_qty}</th>
                  <th style={{padding:"12px"}}>{strings.col_amount}</th>
                  <th style={{padding:"12px"}}>{strings.col_status}</th>
                  <th style={{padding:"12px"}}>پرداخت</th>
                  <th style={{padding:"12px"}}>{strings.col_action}</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr><td colSpan={7} style={{padding:"32px", textAlign:"center", color:"#9ca3af"}}>{strings.no_data_orders}</td></tr>
                ) : orders.map(o => (
                  <tr key={o.id} style={{borderBottom:"1px solid #f3f4f6"}}>
                    <td style={{padding:"12px"}}>{o.full_name}</td>
                    <td style={{padding:"12px", color:"#6b7280"}}>{o.phone}</td>
                    <td style={{padding:"12px"}}>{o.quantity}</td>
                    <td style={{padding:"12px"}}>{o.total_price.toLocaleString('fa-IR')} {strings.toman}</td>
                    <td style={{padding:"12px"}}>
                      <span style={{padding:"4px 8px", borderRadius:"6px", fontSize:"12px", fontWeight:"bold",
                        background: o.status === 'pending' ? "#fef3c7" : o.status === 'confirmed' ? "#dbeafe" : o.status === 'delivered' ? "#d1fae5" : "#fee2e2",
                        color: o.status === 'pending' ? "#d97706" : o.status === 'confirmed' ? "#1d4ed8" : o.status === 'delivered' ? "#065f46" : "#dc2626"
                      }}>{statusMap[o.status] || o.status}</span>
                    </td>
                    <td style={{padding:"12px"}}>
                      <span style={{padding:"4px 8px", borderRadius:"6px", fontSize:"12px",
                        background: o.payment_method === 'cash_on_delivery' ? "#fef3c7" : "#dbeafe",
                        color: o.payment_method === 'cash_on_delivery' ? "#d97706" : "#1d4ed8"}}>
                        {o.payment_method === 'cash_on_delivery' ? 'در محل' : 'آنلاین'}
                      </span>
                    </td>
                    <td style={{padding:"12px"}}>
                      <select value={o.status} onChange={e => updateOrderStatus(o.id, e.target.value)}
                        style={{fontSize:"12px", border:"1px solid #d1d5db", borderRadius:"6px", padding:"4px"}}>
                        <option value="pending">{strings.status_pending}</option>
                        <option value="confirmed">{strings.status_confirmed}</option>
                        <option value="delivered">{strings.status_delivered}</option>
                        <option value="cancelled">{strings.status_cancelled}</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'technicians' && (
            <div>
              <div style={{display:"flex", gap:"8px", padding:"16px", borderBottom:"1px solid #f3f4f6", flexWrap:"wrap"}}>
                <select value={techCityFilter} onChange={e => setTechCityFilter(e.target.value)}
                  style={{fontSize:"13px", border:"1px solid #d1d5db", borderRadius:"6px", padding:"6px 10px"}}>
                  <option value="all">همه شهرها</option>
                  {techCities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={techSpecialtyFilter} onChange={e => setTechSpecialtyFilter(e.target.value)}
                  style={{fontSize:"13px", border:"1px solid #d1d5db", borderRadius:"6px", padding:"6px 10px"}}>
                  <option value="all">همه تخصص‌ها</option>
                  {techSpecialties.map(s => <option key={s} value={s}>{specialtyMap[s] || s}</option>)}
                </select>
                <span style={{fontSize:"13px", color:"#6b7280", alignSelf:"center"}}>
                  {filteredTechnicians.length} نتیجه
                </span>
              </div>

              <table style={{width:"100%", borderCollapse:"collapse", textAlign:"right"}}>
                <thead style={{background:"#1e3a8a", color:"white"}}>
                  <tr>
                    <th style={{padding:"12px"}}></th>
                    <th style={{padding:"12px"}}>{strings.col_name}</th>
                    <th style={{padding:"12px"}}>{strings.col_phone}</th>
                    <th style={{padding:"12px"}}>{strings.col_city}</th>
                    <th style={{padding:"12px"}}>{strings.col_specialty}</th>
                    <th style={{padding:"12px"}}>{strings.col_national_id}</th>
                    <th style={{padding:"12px"}}>{strings.col_status}</th>
                    <th style={{padding:"12px"}}>{strings.col_action}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTechnicians.length === 0 ? (
                    <tr><td colSpan={8} style={{padding:"32px", textAlign:"center", color:"#9ca3af"}}>{strings.no_data_technicians}</td></tr>
                  ) : filteredTechnicians.map(t => (
                    <tr key={t.id} style={{borderBottom:"1px solid #f3f4f6"}}>
                      <td style={{padding:"12px"}}>
                        {t.photo_url ? (
                          <ZoomableImage src={t.photo_url} alt={t.full_name} size={40} />
                        ) : (
                          <div style={{width:"40px", height:"40px", borderRadius:"50%", background:"#e0e7ff", color:"#1e3a8a", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:"bold", fontSize:"14px"}}>
                            {t.full_name?.charAt(0) || '?'}
                          </div>
                        )}
                      </td>
                      <td style={{padding:"12px", fontWeight:"bold"}}>{t.full_name}</td>
                      <td style={{padding:"12px", color:"#6b7280"}}>{t.phone}</td>
                      <td style={{padding:"12px", color:"#6b7280"}}>{t.city}</td>
                      <td style={{padding:"12px", color:"#6b7280"}}>{specialtyMap[t.specialty] || t.specialty}</td>
                      <td style={{padding:"12px", color:"#6b7280"}}>{t.national_id}</td>
                      <td style={{padding:"12px"}}>
                        <span style={{padding:"4px 8px", borderRadius:"6px", fontSize:"12px", fontWeight:"bold",
                          background: t.is_approved ? "#d1fae5" : "#fef3c7",
                          color: t.is_approved ? "#065f46" : "#d97706"
                        }}>{t.is_approved ? strings.status_approved : strings.status_pending}</span>
                      </td>
                      <td style={{padding:"12px", display:"flex", gap:"8px"}}>
                        {!t.is_approved && (
                          <button onClick={() => approveTechnician(t.id)}
                            style={{background:"#16a34a", color:"white", border:"none", borderRadius:"6px", padding:"4px 12px", cursor:"pointer", fontSize:"12px"}}>
                            {strings.btn_approve}
                          </button>
                        )}
                        <button onClick={() => deleteTechnician(t.id)}
                          style={{background:"#fee2e2", color:"#dc2626", border:"none", borderRadius:"6px", padding:"4px 12px", cursor:"pointer", fontSize:"12px"}}>
                          {strings.btn_delete}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'service' && (
            <table style={{width:"100%", borderCollapse:"collapse", textAlign:"right"}}>
              <thead style={{background:"#1e3a8a", color:"white"}}>
                <tr>
                  <th style={{padding:"12px"}}>{strings.col_issue}</th>
                  <th style={{padding:"12px"}}>{strings.col_description}</th>
                  <th style={{padding:"12px"}}>{strings.col_address}</th>
                  <th style={{padding:"12px"}}>{strings.col_phone}</th>
                  <th style={{padding:"12px"}}>{strings.col_status}</th>
                  <th style={{padding:"12px"}}>{strings.col_action}</th>
                </tr>
              </thead>
              <tbody>
                {serviceRequests.length === 0 ? (
                  <tr><td colSpan={6} style={{padding:"32px", textAlign:"center", color:"#9ca3af"}}>{strings.no_data_service}</td></tr>
                ) : serviceRequests.map(r => (
                  <tr key={r.id} style={{borderBottom:"1px solid #f3f4f6"}}>
                    <td style={{padding:"12px", fontWeight:"bold"}}>{specialtyMap[r.issue_type] || r.issue_type}</td>
                    <td style={{padding:"12px", color:"#6b7280", fontSize:"13px"}}>{r.description}</td>
                    <td style={{padding:"12px", color:"#6b7280", fontSize:"13px"}}>{r.address}</td>
                    <td style={{padding:"12px", color:"#6b7280"}}>{r.phone}</td>
                    <td style={{padding:"12px"}}>
                      <span style={{padding:"4px 8px", borderRadius:"6px", fontSize:"12px", fontWeight:"bold",
                        background: r.status === 'pending' ? "#fef3c7" : r.status === 'accepted' ? "#dbeafe" : r.status === 'completed' ? "#d1fae5" : "#f3f4f6",
                        color: r.status === 'pending' ? "#d97706" : r.status === 'accepted' ? "#1d4ed8" : r.status === 'completed' ? "#065f46" : "#6b7280"
                      }}>{statusMap[r.status] || r.status}</span>
                    </td>
                    <td style={{padding:"12px"}}>
                      {r.status === 'completed' && (
                        <button
                          onClick={() => window.location.href = '/technician/invoice/' + r.id}
                          style={{background:"#1e3a8a", color:"white", border:"none", borderRadius:"6px", padding:"4px 12px", cursor:"pointer", fontSize:"12px"}}
                        >
                          {strings.invoice_title}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'sellers' && (
            <table style={{width:"100%", borderCollapse:"collapse", textAlign:"right"}}>
              <thead style={{background:"#1e3a8a", color:"white"}}>
                <tr>
                  <th style={{padding:"12px"}}>{strings.col_shop}</th>
                  <th style={{padding:"12px"}}>{strings.col_phone}</th>
                  <th style={{padding:"12px"}}>{strings.col_city}</th>
                  <th style={{padding:"12px"}}>{strings.col_status}</th>
                  <th style={{padding:"12px"}}>{strings.col_action}</th>
                </tr>
              </thead>
              <tbody>
                {sellers.length === 0 ? (
                  <tr><td colSpan={5} style={{padding:"32px", textAlign:"center", color:"#9ca3af"}}>{strings.no_data_sellers}</td></tr>
                ) : sellers.map(s => (
                  <tr key={s.id} style={{borderBottom:"1px solid #f3f4f6"}}>
                    <td style={{padding:"12px", fontWeight:"bold"}}>{s.shop_name}</td>
                    <td style={{padding:"12px", color:"#6b7280"}}>{s.phone}</td>
                    <td style={{padding:"12px", color:"#6b7280"}}>{s.city}</td>
                    <td style={{padding:"12px"}}>
                      <span style={{padding:"4px 8px", borderRadius:"6px", fontSize:"12px", fontWeight:"bold",
                        background: s.is_approved ? "#d1fae5" : "#fef3c7",
                        color: s.is_approved ? "#065f46" : "#d97706"
                      }}>{s.is_approved ? strings.status_approved : strings.status_pending}</span>
                    </td>
                    <td style={{padding:"12px", display:"flex", gap:"8px"}}>
                      {!s.is_approved && (
                        <button onClick={() => approveSeller(s.id)}
                          style={{background:"#16a34a", color:"white", border:"none", borderRadius:"6px", padding:"4px 12px", cursor:"pointer", fontSize:"12px"}}>
                          {strings.btn_approve}
                        </button>
                      )}
                      <button onClick={() => deleteSeller(s.id)}
                        style={{background:"#fee2e2", color:"#dc2626", border:"none", borderRadius:"6px", padding:"4px 12px", cursor:"pointer", fontSize:"12px"}}>
                        {strings.btn_delete}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'products' && (
            <table style={{width:"100%", borderCollapse:"collapse", textAlign:"right"}}>
              <thead style={{background:"#1e3a8a", color:"white"}}>
                <tr>
                  <th style={{padding:"12px"}}>{strings.col_name}</th>
                  <th style={{padding:"12px"}}>{strings.col_category}</th>
                  <th style={{padding:"12px"}}>{strings.col_price}</th>
                  <th style={{padding:"12px"}}>{strings.col_stock}</th>
                  <th style={{padding:"12px"}}>{strings.col_action}</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id} style={{borderBottom:"1px solid #f3f4f6"}}>
                    <td style={{padding:"12px"}}>{p.name}</td>
                    <td style={{padding:"12px", color:"#6b7280"}}>{p.category}</td>
                    <td style={{padding:"12px"}}>{p.price.toLocaleString('fa-IR')} {strings.toman}</td>
                    <td style={{padding:"12px"}}>{p.stock}</td>
                    <td style={{padding:"12px"}}>
                      <button onClick={() => deleteProduct(p.id)}
                        style={{background:"#fee2e2", color:"#dc2626", border:"none", borderRadius:"6px", padding:"4px 12px", cursor:"pointer", fontSize:"12px"}}>
                        {strings.btn_delete}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

        </div>
      </div>
    </main>
  );
}
