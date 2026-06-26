'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Customer = {
  id: string;
  full_name: string | null;
  phone: string | null;
  city: string | null;
  total_orders: number;
  total_spent: number;
  last_order_at: string | null;
};

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('total_spent');

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

    fetchCustomers();
  }

  async function fetchCustomers() {
    const res = await supabase
      .from('customer_archive')
      .select('*')
      .order('total_spent', { ascending: false });

    setCustomers(res.data || []);
    setLoading(false);
  }

  function exportToCsv() {
    let csv = 'نام,موبایل,شهر,تعداد سفارش,جمع خرید,آخرین خرید\n';
    for (let i = 0; i < filteredCustomers.length; i++) {
      const c = filteredCustomers[i];
      csv += (c.full_name || '') + ',' + (c.phone || '') + ',' + (c.city || '') + ',' + c.total_orders + ',' + c.total_spent + ',' + (c.last_order_at || '') + '\n';
    }

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'vira-customers.csv';
    link.click();
  }

  let filteredCustomers = customers.filter((c) => {
    const term = search.toLowerCase();
    const nameMatch = (c.full_name || '').toLowerCase().includes(term);
    const phoneMatch = (c.phone || '').includes(term);
    return term === '' || nameMatch || phoneMatch;
  });

  if (sortBy === 'orders') {
    filteredCustomers = filteredCustomers.slice().sort((a, b) => b.total_orders - a.total_orders);
  } else if (sortBy === 'recent') {
    filteredCustomers = filteredCustomers.slice().sort((a, b) => {
      const aTime = a.last_order_at ? new Date(a.last_order_at).getTime() : 0;
      const bTime = b.last_order_at ? new Date(b.last_order_at).getTime() : 0;
      return bTime - aTime;
    });
  } else {
    filteredCustomers = filteredCustomers.slice().sort((a, b) => b.total_spent - a.total_spent);
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
      <div style={{maxWidth:"1000px", margin:"0 auto"}}>

        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"24px", flexWrap:"wrap", gap:"12px"}}>
          <h1 style={{fontSize:"22px", fontWeight:"bold", color:"#1e3a8a"}}>بایگانی مشتریان</h1>
          <a href="/admin" style={{color:"#1e3a8a", fontSize:"14px", textDecoration:"none"}}>← بازگشت به پنل اصلی</a>
        </div>

        <div style={{background:"white", borderRadius:"12px", padding:"16px", marginBottom:"16px", display:"flex", gap:"12px", flexWrap:"wrap", alignItems:"center"}}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجو نام یا موبایل..."
            style={{flex:"1", minWidth:"200px", border:"1px solid #d1d5db", borderRadius:"8px", padding:"8px 12px", boxSizing:"border-box"}}
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{border:"1px solid #d1d5db", borderRadius:"8px", padding:"8px 12px"}}
          >
            <option value="total_spent">بیشترین خرید</option>
            <option value="orders">بیشترین تعداد سفارش</option>
            <option value="recent">آخرین خرید</option>
          </select>
          <button
            onClick={exportToCsv}
            style={{background:"#16a34a", color:"white", border:"none", borderRadius:"8px", padding:"8px 16px", cursor:"pointer", fontSize:"13px"}}
          >
            خروجی اکسل (CSV)
          </button>
        </div>

        <div style={{background:"white", borderRadius:"12px", padding:"12px", marginBottom:"16px", textAlign:"center", color:"#6b7280", fontSize:"13px"}}>
          {filteredCustomers.length} مشتری یافت شد
        </div>

        <div style={{background:"white", borderRadius:"12px", overflow:"hidden"}}>
          <table style={{width:"100%", borderCollapse:"collapse", textAlign:"right"}}>
            <thead style={{background:"#1e3a8a", color:"white"}}>
              <tr>
                <th style={{padding:"12px"}}>نام</th>
                <th style={{padding:"12px"}}>موبایل</th>
                <th style={{padding:"12px"}}>تعداد سفارش</th>
                <th style={{padding:"12px"}}>جمع خرید</th>
                <th style={{padding:"12px"}}>آخرین خرید</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.length === 0 ? (
                <tr><td colSpan={5} style={{padding:"32px", textAlign:"center", color:"#9ca3af"}}>مشتری‌ای یافت نشد</td></tr>
              ) : filteredCustomers.map((c) => (
                <tr key={c.id} style={{borderBottom:"1px solid #f3f4f6"}}>
                  <td style={{padding:"12px", fontWeight:"bold"}}>{c.full_name || '—'}</td>
                  <td style={{padding:"12px", color:"#6b7280"}}>{c.phone || '—'}</td>
                  <td style={{padding:"12px"}}>{c.total_orders}</td>
                  <td style={{padding:"12px", color:"#16a34a", fontWeight:"bold"}}>{c.total_spent.toLocaleString('fa-IR')} تومان</td>
                  <td style={{padding:"12px", color:"#6b7280", fontSize:"13px"}}>
                    {c.last_order_at ? new Date(c.last_order_at).toLocaleDateString('fa-IR') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </main>
  );
}