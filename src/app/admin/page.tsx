'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { strings } from '@/lib/strings';
import ZoomableImage from '@/components/ZoomableImage';
import { useMyPerms } from '@/lib/useMyPerms';
import { can } from '@/lib/permissions';
import { Modal, Field, inputStyle, btn as uiBtn } from '@/components/admin/ui';

type Seller = { id: string; shop_name: string; phone: string; city: string; is_approved: boolean; };
type Product = { id: string; name: string; category: string; price: number; stock: number; };
type Order = { id: string; full_name: string; phone: string; quantity: number; total_price: number; status: string; created_at: string; payment_method: string; };
type Technician = { id: string; full_name: string; phone: string; city: string; specialty: string; national_id: string; experience: string; is_approved: boolean; created_at: string; photo_url: string | null; deleted_at?: string | null; delete_reason?: string | null; };
type ServiceRequest = { id: string; issue_type: string; description: string; address: string; phone: string; status: string; created_at: string; technician_id: string | null; };

const statusMap: Record<string, string> = {
  pending: strings.status_pending,
  confirmed: strings.status_confirmed,
  delivered: strings.status_delivered,
  cancelled: strings.status_cancelled,
  accepted: strings.status_accepted,
  assigned: 'ارجاع‌شده',
  in_progress: strings.status_in_progress,
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

const managementLinks = [
  { href: '/admin/reports', icon: '📊', title: 'گزارش‌های کلی', color: '#16a34a', module: 'reports' },
  { href: '/admin/support', icon: '💬', title: 'پیام‌های پشتیبانی', color: '#1e3a8a', module: 'support' },
  { href: '/admin/sellers', icon: '🏪', title: 'مدیریت فروشندگان', color: '#0ea5e9', module: 'sellers' },
  { href: '/admin/requests', icon: '🧰', title: 'مدیریت درخواست‌های تکنسین', color: '#ea580c', module: 'requests' },
  { href: '/admin/customers', icon: '🗂️', title: 'بایگانی مشتریان', color: '#8b5cf6', module: 'customers' },
  { href: '/admin/history', icon: '🕘', title: 'تاریخچه تغییرات و بازگردانی', color: '#7c3aed', module: 'history' },
  { href: '/admin/import', icon: '📥', title: 'ورود گروهی با اکسل', color: '#0f766e', module: 'import' },
  { href: '/admin/users-access', icon: '🚫', title: 'مسدودسازی ورود کاربران', color: '#7f1d1d', module: 'admins' },
  { href: '/admin/risk', icon: '🛡', title: 'ریسک فاکتورها و بازبینی', color: '#b45309', module: 'finance' },
  { href: '/admin/sms', icon: '📱', title: 'پیامک‌ها و اعلان‌ها', color: '#0891b2', module: 'sms' },
  { href: '/admin/backups', icon: '💾', title: 'پشتیبان‌گیری و بازیابی', color: '#0f766e', module: 'backups' },
  { href: '/admin/discounts', icon: '🎟️', title: 'کدهای تخفیف', color: '#dc2626', module: 'discounts' },
  { href: '/admin/finance', icon: '💰', title: 'سود و زیان', color: '#7c3aed', module: 'finance' },
  { href: '/admin/inventory', icon: '📦', title: 'مدیریت انبار', color: '#f59e0b', module: 'inventory' },
  { href: '/admin/advertisements', icon: '📢', title: 'تبلیغات', color: '#f59e0b', module: 'advertisements' },
  { href: '/admin/about', icon: 'ℹ️', title: 'درباره ما', color: '#0891b2', module: 'content' },
  { href: '/admin/manage-academy', icon: '📚', title: 'آکادمی ویرا', color: '#0d9488', module: 'academy' },
  { href: '/admin/manage-ai', icon: '🤖', title: 'Vira AI', color: '#4f46e5', module: 'content' },
  { href: '/admin/manage-services', icon: '🛠️', title: 'خدمات و مراکز مخابراتی', color: '#0f766e', module: 'services' },
  { href: '/admin/categories', icon: '🗃️', title: 'دسته‌بندی‌های فروشگاه و انبار', color: '#d97706', module: 'categories' },
  { href: '/admin/finance-invoices', icon: '🧾', title: 'فاکتورهای خدمات و تسویه تکنسین‌ها', color: '#0d9488', module: 'finance' },
  { href: '/admin/ftth-rules', icon: '📶', title: 'قواعد شماره مجازی FTTH', color: '#0369a1', module: 'services' },
  { href: '/admin/settlement', icon: '🤝', title: 'تقسیم درآمد و ذی‌نفعان (پورسانت، شرکا)', color: '#b45309', module: 'finance' },
  { href: '/admin/ledger', icon: '📒', title: 'دفتر تسویه و آرشیو مالیاتی', color: '#4338ca', module: 'finance' },
  { href: '/admin/technician-penalties', icon: '⚖️', title: 'عملکرد و امتیاز تکنسین‌ها', color: '#be123c', module: 'technicians' },
  { href: '/admin/admins', icon: '🛡️', title: 'مدیران و سطح دسترسی', color: '#111827', module: 'admins' },
];

export default function AdminPanel() {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [archivedTechs, setArchivedTechs] = useState<Technician[]>([]);
  const [showArchivedTech, setShowArchivedTech] = useState(false);
  const [editTech, setEditTech] = useState<Technician | null>(null);
  // حذف سفارش (فقط ادمین اصلی)
  const [selOrders, setSelOrders] = useState<string[]>([]);
  const [delOrders, setDelOrders] = useState<string[] | null>(null);
  const [delReason, setDelReason] = useState('');
  const [delRestock, setDelRestock] = useState(true);
  const [delForce, setDelForce] = useState(false);
  const [delBusy, setDelBusy] = useState(false);
  const [delMsg, setDelMsg] = useState('');
  const [editForm, setEditForm] = useState({ full_name: '', phone: '', city: '', specialty: '', national_id: '', experience: '' });
  const [editErr, setEditErr] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'orders' | 'sellers' | 'products' | 'technicians' | 'service'>('orders');
  const [loading, setLoading] = useState(true);
  const myPerms = useMyPerms();

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
      supabase.from('products').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('technicians').select('*').order('created_at', { ascending: false }),
      supabase.from('service_requests').select('*').order('created_at', { ascending: false }),
    ]);
    setSellers((s.data || []).filter((x: any) => !x.deleted_at));
    setProducts(p.data || []);
    setOrders(o.data || []);
    setTechnicians((t.data || []).filter((x: any) => !x.deleted_at));
    setArchivedTechs((t.data || []).filter((x: any) => !!x.deleted_at));
    setServiceRequests(sr.data || []);
    setLoading(false);
  }

  async function approveSeller(id: string) {
    const upd = await supabase.from('sellers').update({ is_approved: true }).eq('id', id).select('id');
    if (upd.error || !upd.data || upd.data.length === 0) {
      alert('تأیید فروشنده انجام نشد: ' + (upd.error?.message || 'دسترسی لازم وجود ندارد (فایل‌های SQL مرحله ۱ اجرا شده‌اند؟)'));
      return;
    }
    // پیامک تأیید را تریگر دیتابیس در صف ارسال می‌گذارد
    fetchData();
  }
  async function deleteSeller(id: string) {
    const reason = window.prompt('دلیل حذف فروشنده را بنویسید.\nفروشنده بایگانی می‌شود و در «مدیریت فروشندگان» قابل بازیابی است:');
    if (!reason || !reason.trim()) return;
    const res = await supabase.rpc('admin_archive_seller', { p_id: id, p_reason: reason.trim() });
    if (res.error) { alert('حذف انجام نشد: ' + res.error.message); return; }
    fetchData();
  }
  async function deleteProduct(id: string) {
    const reason = window.prompt('دلیل حذف محصول را بنویسید (محصول بایگانی می‌شود):');
    if (!reason || !reason.trim()) return;
    const res = await supabase.rpc('archive_product', { p_id: id, p_reason: reason.trim() });
    if (res.error) { alert('حذف انجام نشد: ' + res.error.message); return; }
    fetchData();
  }

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
        // پیامک تغییر وضعیت سفارش را تریگر دیتابیس در صف ارسال می‌گذارد
      }
    }

    fetchData();
  }

  async function approveTechnician(id: string) {
    const upd = await supabase.from('technicians').update({ is_approved: true }).eq('id', id).select('id');
    if (upd.error || !upd.data || upd.data.length === 0) {
      alert('تأیید تکنسین انجام نشد: ' + (upd.error?.message || 'دسترسی لازم وجود ندارد'));
      return;
    }
    // پیامک تأیید را تریگر دیتابیس در صف ارسال می‌گذارد
    fetchData();
  }
  async function deleteTechnician(id: string) {
    const reason = window.prompt('دلیل حذف تکنسین را بنویسید.\nتکنسین بایگانی می‌شود و سوابق او حفظ می‌شود:');
    if (!reason || !reason.trim()) return;
    const res = await supabase.rpc('admin_archive_technician', { p_id: id, p_reason: reason.trim() });
    if (res.error) { alert('حذف انجام نشد: ' + res.error.message); return; }
    fetchData();
  }

  async function confirmDeleteOrders() {
    if (!delOrders) return;
    if (!delReason.trim()) { setDelMsg('ثبت دلیل حذف الزامی است'); return; }
    setDelBusy(true); setDelMsg('');
    const res = await supabase.rpc('admin_delete_orders', { p_ids: delOrders, p_reason: delReason.trim(), p_restock: delRestock, p_force: delForce });
    setDelBusy(false);
    if (res.error) { setDelMsg(res.error.message); return; }
    const d: any = res.data || {};
    const fails = ((d.results as any[]) || []).filter((x) => !x.ok);
    setSelOrders([]);
    fetchData();
    if (fails.length === 0) {
      setDelOrders(null); setDelReason('');
      alert(Number(d.ok_count || 0) + ' سفارش حذف شد.');
    } else {
      setDelOrders(fails.map((x) => x.id));
      setDelMsg(Number(d.ok_count || 0) + ' سفارش حذف شد؛ ' + fails.length + ' مورد انجام نشد: ' + fails[0].message + (fails.length > 1 ? ' (و موارد مشابه)' : ''));
    }
  }

  function openEditTech(t: Technician) {
    setEditTech(t);
    setEditErr('');
    setEditForm({
      full_name: t.full_name || '', phone: t.phone || '', city: t.city || '',
      specialty: t.specialty || '', national_id: t.national_id || '', experience: t.experience || '',
    });
  }
  async function saveEditTech() {
    if (!editTech) return;
    const f = editForm;
    if (!f.full_name.trim() || !f.city.trim()) { setEditErr('نام و شهر الزامی است'); return; }
    if (!/^09[0-9]{9}$/.test(f.phone.trim())) { setEditErr('شماره موبایل باید 11 رقم و با 09 شروع شود'); return; }
    setEditBusy(true); setEditErr('');
    const patch = {
      full_name: f.full_name.trim(), phone: f.phone.trim(), city: f.city.trim(),
      specialty: f.specialty, national_id: f.national_id.trim(), experience: f.experience.trim(),
    };
    const res = await supabase.from('technicians').update(patch).eq('id', editTech.id).select('id');
    setEditBusy(false);
    if (res.error || !res.data || res.data.length === 0) {
      setEditErr('ذخیره انجام نشد: ' + (res.error?.message || 'دسترسی لازم وجود ندارد'));
      return;
    }
    setEditTech(null);
    fetchData();
  }

  async function restoreTechnician(id: string) {
    if (!window.confirm('این تکنسین از بایگانی بازیابی و دوباره فعال شود؟')) return;
    const res = await supabase.rpc('admin_restore_technician', { p_id: id });
    if (res.error) { alert('بازیابی انجام نشد: ' + res.error.message); return; }
    fetchData();
  }
  async function purgeTechnician(id: string, name: string) {
    if (!window.confirm('حذف قطعی «' + name + '» برگشت‌پذیر نیست.\nفقط تکنسینی که هیچ درخواست، فاکتور، انصراف یا امتیاز منفی ندارد حذف می‌شود. ادامه می‌دهید؟')) return;
    const res = await supabase.rpc('admin_purge_technician', { p_id: id });
    if (res.error) { alert('حذف قطعی انجام نشد: ' + res.error.message); return; }
    fetchData();
  }

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

  const tabModule: Record<string, string> = { orders: 'orders', technicians: 'technicians', service: 'requests', sellers: 'sellers', products: 'inventory' };
  const visibleTabs = tabs.filter((t) => can(myPerms.perms, tabModule[t.key], 'view'));
  const currentTab = visibleTabs.some((t) => t.key === activeTab) ? activeTab : ((visibleTabs[0]?.key || activeTab) as typeof activeTab);

  const techCities = iranCitiesList;
  const techSpecialties = Object.keys(specialtyMap);

  const filteredTechnicians = (showArchivedTech ? archivedTechs : technicians).filter(t => {
    const cityMatch = techCityFilter === 'all' || t.city === techCityFilter;
    const specialtyMatch = techSpecialtyFilter === 'all' || t.specialty === techSpecialtyFilter;
    return cityMatch && specialtyMatch;
  });

  return (
    <main style={{minHeight:"100vh", background:"#f3f4f6", padding:"32px 16px"}} dir="rtl">
      <div style={{maxWidth:"1100px", margin:"0 auto"}}>

        <h1 style={{fontSize:"24px", fontWeight:"bold", color:"#1e3a8a", marginBottom:"24px"}}>{strings.admin_panel}</h1>

        {/* کارت‌های مدیریتی */}
        <div style={{
          display:"grid",
          gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))",
          gap:"16px",
          marginBottom:"32px"
        }}>
          {managementLinks.filter((l) => can(myPerms.perms, l.module, 'view')).map((link, i) => (
            <a key={i} href={link.href} style={{textDecoration:"none"}}>
              <div style={{
                background:"white",
                borderRadius:"14px",
                padding:"20px",
                textAlign:"center",
                boxShadow:"0 2px 8px rgba(0,0,0,0.08)",
                borderTop: `4px solid ${link.color}`,
                cursor:"pointer",
                height:"100%"
              }}>
                <p style={{fontSize:"28px", marginBottom:"8px"}}>{link.icon}</p>
                <p style={{fontSize:"14px", fontWeight:"bold", color:"#1f2937"}}>{link.title}</p>
              </div>
            </a>
          ))}
        </div>

        {/* آمار سریع */}
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
          {visibleTabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
              style={{padding:"8px 16px", borderRadius:"8px", border:"none", cursor:"pointer", fontWeight:"bold",
                background: currentTab === tab.key ? "#1e3a8a" : "white",
                color: currentTab === tab.key ? "white" : "#1e3a8a"
              }}>
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{background:"white", borderRadius:"12px", overflow:"hidden", boxShadow:"0 1px 3px rgba(0,0,0,0.1)"}}>

          {currentTab === 'orders' && (
            <div>
            {myPerms.perms?.super && selOrders.length > 0 && (
              <div style={{background:"#fee2e2", padding:"12px 16px", display:"flex", gap:"10px", alignItems:"center", flexWrap:"wrap"}}>
                <span style={{fontSize:"14px", color:"#991b1b", fontWeight:"bold"}}>{selOrders.length} سفارش انتخاب شده</span>
                <button onClick={() => { setDelOrders(selOrders); setDelMsg(''); }} style={{background:"#dc2626", color:"white", border:"none", borderRadius:"6px", padding:"6px 14px", cursor:"pointer", fontSize:"13px"}}>حذف انتخاب‌شده‌ها</button>
                <button onClick={() => setSelOrders([])} style={{background:"#e5e7eb", color:"#374151", border:"none", borderRadius:"6px", padding:"6px 14px", cursor:"pointer", fontSize:"13px"}}>لغو انتخاب</button>
              </div>
            )}
            <table style={{width:"100%", borderCollapse:"collapse", textAlign:"right"}}>
              <thead style={{background:"#1e3a8a", color:"white"}}>
                <tr>
                  {myPerms.perms?.super && (
                    <th style={{padding:"12px"}}>
                      <input type="checkbox" aria-label="انتخاب همه"
                        checked={orders.length > 0 && orders.every(o => selOrders.includes(o.id))}
                        onChange={e => setSelOrders(e.target.checked ? orders.map(o => o.id) : [])} />
                    </th>
                  )}
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
                  <tr><td colSpan={8} style={{padding:"32px", textAlign:"center", color:"#9ca3af"}}>{strings.no_data_orders}</td></tr>
                ) : orders.map(o => (
                  <tr key={o.id} style={{borderBottom:"1px solid #f3f4f6"}}>
                    {myPerms.perms?.super && (
                      <td style={{padding:"12px"}}>
                        <input type="checkbox" aria-label="انتخاب" checked={selOrders.includes(o.id)}
                          onChange={() => setSelOrders(p => p.includes(o.id) ? p.filter(x => x !== o.id) : [...p, o.id])} />
                      </td>
                    )}
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
                      {myPerms.perms?.super && (
                        <button onClick={() => { setDelOrders([o.id]); setDelMsg(''); }}
                          style={{marginRight:"8px", background:"#7f1d1d", color:"white", border:"none", borderRadius:"6px", padding:"4px 10px", cursor:"pointer", fontSize:"12px"}}>
                          حذف
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}

          {currentTab === 'technicians' && (
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
                {can(myPerms.perms, 'technicians', 'view_archive') && (
                  <label style={{fontSize:"13px", color:"#374151", alignSelf:"center", display:"flex", gap:"6px", alignItems:"center", cursor:"pointer"}}>
                    <input type="checkbox" checked={showArchivedTech} onChange={e => setShowArchivedTech(e.target.checked)} />
                    نمایش بایگانی‌شده‌ها ({archivedTechs.length})
                  </label>
                )}
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
                        }}>{t.deleted_at ? 'بایگانی‌شده' : (t.is_approved ? strings.status_approved : strings.status_pending)}</span>
                      </td>
                      <td style={{padding:"12px", display:"flex", gap:"8px"}}>
                        {can(myPerms.perms, 'technicians', 'edit') && (
                          <button onClick={() => openEditTech(t)}
                            style={{background:"#0ea5e9", color:"white", border:"none", borderRadius:"6px", padding:"4px 12px", cursor:"pointer", fontSize:"12px"}}>
                            ویرایش
                          </button>
                        )}
                        {t.deleted_at ? (
                          <>
                            {can(myPerms.perms, 'technicians', 'restore') && (
                              <button onClick={() => restoreTechnician(t.id)}
                                style={{background:"#16a34a", color:"white", border:"none", borderRadius:"6px", padding:"4px 12px", cursor:"pointer", fontSize:"12px"}}>
                                بازیابی
                              </button>
                            )}
                            {can(myPerms.perms, 'technicians', 'delete') && (
                              <button onClick={() => purgeTechnician(t.id, t.full_name)}
                                style={{background:"#7f1d1d", color:"white", border:"none", borderRadius:"6px", padding:"4px 12px", cursor:"pointer", fontSize:"12px"}}>
                                حذف قطعی
                              </button>
                            )}
                          </>
                        ) : (<>
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
                        </>)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {currentTab === 'service' && (
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

          {currentTab === 'sellers' && (
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

          {currentTab === 'products' && (
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
      {delOrders && (
        <Modal title={delOrders.length > 1 ? 'حذف قطعی ' + delOrders.length + ' سفارش' : 'حذف قطعی سفارش'} onClose={() => !delBusy && setDelOrders(null)} width={520}>
          <div style={{ background: '#fee2e2', color: '#991b1b', borderRadius: 10, padding: 12, fontSize: 13, lineHeight: 1.9 }}>
            این کار برگشت‌پذیر نیست. قبل از حذف، یک نسخه‌ی کامل از سفارش در تاریخچه‌ی غیرقابل‌تغییر ثبت می‌شود.
          </div>
          <Field label="دلیل حذف *"><textarea rows={3} value={delReason} onChange={e => { setDelReason(e.target.value); setDelMsg(''); }} style={inputStyle} /></Field>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginTop: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={delRestock} onChange={e => setDelRestock(e.target.checked)} />
            موجودی محصول به انبار برگردانده شود (برای سفارش‌های لغوشده قبلاً برگشته و دوباره اضافه نمی‌شود)
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginTop: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={delForce} onChange={e => setDelForce(e.target.checked)} />
            حذف حتی سفارش‌های پرداخت‌شده
          </label>
          {delMsg && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 10 }}>{delMsg}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button onClick={() => setDelOrders(null)} disabled={delBusy} style={{ ...uiBtn('#e5e7eb', '#374151'), padding: '8px 18px', fontSize: 13 }}>انصراف</button>
            <button onClick={confirmDeleteOrders} disabled={delBusy} style={{ ...uiBtn('#dc2626'), padding: '8px 18px', fontSize: 13, opacity: delBusy ? 0.6 : 1 }}>{delBusy ? 'در حال حذف...' : 'حذف قطعی'}</button>
          </div>
        </Modal>
      )}
      {editTech && (
        <Modal title={'ویرایش تکنسین: ' + editTech.full_name} onClose={() => !editBusy && setEditTech(null)} width={520}>
          <Field label="نام و نام خانوادگی *"><input value={editForm.full_name} onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} style={inputStyle} /></Field>
          <Field label="موبایل *"><input value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value.replace(/\D/g, '').slice(0, 11) })} style={{ ...inputStyle, direction: 'ltr' }} /></Field>
          <Field label="شهر *"><input value={editForm.city} onChange={e => setEditForm({ ...editForm, city: e.target.value })} style={inputStyle} /></Field>
          <Field label="تخصص">
            <select value={editForm.specialty} onChange={e => setEditForm({ ...editForm, specialty: e.target.value })} style={inputStyle}>
              {!techSpecialties.includes(editForm.specialty) && <option value={editForm.specialty}>{editForm.specialty || '—'}</option>}
              {techSpecialties.map(k => <option key={k} value={k}>{specialtyMap[k]}</option>)}
            </select>
          </Field>
          <Field label="کد ملی"><input value={editForm.national_id} onChange={e => setEditForm({ ...editForm, national_id: e.target.value.replace(/\D/g, '').slice(0, 10) })} style={{ ...inputStyle, direction: 'ltr' }} /></Field>
          <Field label="سابقه / توضیحات"><textarea rows={3} value={editForm.experience} onChange={e => setEditForm({ ...editForm, experience: e.target.value })} style={inputStyle} /></Field>
          {editErr && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 10 }}>{editErr}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button onClick={() => setEditTech(null)} disabled={editBusy} style={{ ...uiBtn('#e5e7eb', '#374151'), padding: '8px 18px', fontSize: 13 }}>انصراف</button>
            <button onClick={saveEditTech} disabled={editBusy} style={{ ...uiBtn('#16a34a'), padding: '8px 18px', fontSize: 13, opacity: editBusy ? 0.6 : 1 }}>{editBusy ? 'در حال ذخیره...' : 'ذخیره'}</button>
          </div>
        </Modal>
      )}
    </main>
  );
}
