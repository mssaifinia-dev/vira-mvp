'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

function gregorianToJalali(gy: number, gm: number, gd: number) {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy;
  if (gy <= 1600) {
    jy = 0;
    gy -= 621;
  } else {
    jy = 979;
    gy -= 1600;
  }
  const gy2 = (gm > 2) ? (gy + 1) : gy;
  let days = (365 * gy) + (Math.floor((gy2 + 3) / 4)) - (Math.floor((gy2 + 99) / 100)) + (Math.floor((gy2 + 399) / 400)) - 80 + gd + g_d_m[gm - 1];
  jy += 33 * (Math.floor(days / 12053));
  days %= 12053;
  jy += 4 * (Math.floor(days / 1461));
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let jm, jd;
  if (days < 186) {
    jm = 1 + Math.floor(days / 31);
    jd = 1 + (days % 31);
  } else {
    jm = 7 + Math.floor((days - 186) / 30);
    jd = 1 + ((days - 186) % 30);
  }
  return [jy, jm, jd];
}

function jalaliToGregorian(jy: number, jm: number, jd: number) {
  let gy;
  if (jy <= 979) {
    gy = 621;
    jy += 0;
  } else {
    gy = 1600;
    jy -= 979;
  }
  let days = (365 * jy) + (Math.floor(jy / 33) * 8) + Math.floor(((jy % 33) + 3) / 4) + 78 + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
  gy += 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  const sal_a = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  for (gm = 1; gm <= 12 && gd > sal_a[gm]; gm++) {
    gd -= sal_a[gm];
  }
  return [gy, gm, gd];
}

function pad(n: number) {
  return n < 10 ? '0' + n : String(n);
}

const jalaliMonths = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const COLORS = ['#1e3a8a', '#16a34a', '#f59e0b', '#dc2626', '#8b5cf6', '#0284c7'];

export default function AdminReportsPage() {
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const [nowJy, nowJm] = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());

  const [fromJYear, setFromJYear] = useState(nowJy);
  const [fromJMonth, setFromJMonth] = useState(1);
  const [fromJDay, setFromJDay] = useState(1);

  const [toJYear, setToJYear] = useState(nowJy);
  const [toJMonth, setToJMonth] = useState(nowJm);
  const [toJDay, setToJDay] = useState(31);

  const [filterActive, setFilterActive] = useState(false);

  const [totalOrders, setTotalOrders] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [totalSellerCommission, setTotalSellerCommission] = useState(0);
  const [totalSellerPayout, setTotalSellerPayout] = useState(0);

  const [totalServiceRequests, setTotalServiceRequests] = useState(0);
  const [totalCompletedServices, setTotalCompletedServices] = useState(0);
  const [totalTechCommission, setTotalTechCommission] = useState(0);
  const [totalTechPayout, setTotalTechPayout] = useState(0);

  const [topSellers, setTopSellers] = useState<any[]>([]);
  const [topTechnicians, setTopTechnicians] = useState<any[]>([]);
  
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [sellerPayouts, setSellerPayouts] = useState<any[]>([]);

  const [avgRating, setAvgRating] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);
  const [lowRatingPercent, setLowRatingPercent] = useState(0);

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

    fetchReports();
  }

  function getGregorianRange() {
    if (!filterActive) return { from: null, to: null };
    const [fgy, fgm, fgd] = jalaliToGregorian(fromJYear, fromJMonth, fromJDay);
    const [tgy, tgm, tgd] = jalaliToGregorian(toJYear, toJMonth, toJDay);
    const fromStr = fgy + '-' + pad(fgm) + '-' + pad(fgd);
    const toStr = tgy + '-' + pad(tgm) + '-' + pad(tgd);
    return { from: fromStr, to: toStr };
  }

  function buildDateFilter(query: any) {
    const range = getGregorianRange();
    let q = query;
    if (range.from) {
      q = q.gte('created_at', range.from + 'T00:00:00');
    }
    if (range.to) {
      q = q.lte('created_at', range.to + 'T23:59:59');
    }
    return q;
  }

  async function fetchReports() {
    setLoading(true);

    let ordersQuery = supabase
      .from('orders')
      .select('total_price, commission_amount, seller_payout, seller_id, created_at');
    ordersQuery = buildDateFilter(ordersQuery);
    const ordersRes = await ordersQuery;

    const orders = ordersRes.data || [];
    setTotalOrders(orders.length);

    let salesSum = 0;
    let commSum = 0;
    let payoutSum = 0;
    const sellerMap: Record<string, { total: number; commission: number; payout: number; earned: number }> = {};
    const dailyMap: Record<string, { sales: number; commission: number; tech: number }> = {};

    for (let i = 0; i < orders.length; i++) {
      const o = orders[i];
      salesSum += o.total_price;
      commSum += o.commission_amount || 0;
      payoutSum += o.seller_payout || 0;

      // جمع درآمد روزانه
      const dateKey = o.created_at.substring(0, 10);
      if (!dailyMap[dateKey]) {
        dailyMap[dateKey] = { sales: 0, commission: 0, tech: 0 };
      }
      dailyMap[dateKey].sales += o.total_price;
      dailyMap[dateKey].commission += o.commission_amount || 0;

      if (o.seller_id) {
        if (!sellerMap[o.seller_id]) {
          sellerMap[o.seller_id] = { total: 0, commission: 0, payout: 0, earned: 0 };
        }
        sellerMap[o.seller_id].total += o.total_price;
        sellerMap[o.seller_id].commission += o.commission_amount || 0;
        sellerMap[o.seller_id].payout += o.seller_payout || 0;
        sellerMap[o.seller_id].earned += o.seller_payout || 0;
      }
    }

    setTotalSales(salesSum);
    setTotalSellerCommission(commSum);
    setTotalSellerPayout(payoutSum);

    const sellerIds = Object.keys(sellerMap);
    if (sellerIds.length > 0) {
      const sellersRes = await supabase
        .from('sellers')
        .select('id, shop_name')
        .in('id', sellerIds);

      const sellersData = sellersRes.data || [];
      const topSellersList = sellersData.map((s) => ({
        name: s.shop_name,
        total: sellerMap[s.id]?.total || 0,
      })).sort((a, b) => b.total - a.total).slice(0, 5);

      setTopSellers(topSellersList);

      // درآمد معلق فروشندگان
      const payoutsList = sellersData
        .map(s => ({
          name: s.shop_name,
          earned: sellerMap[s.id]?.earned || 0,
          paid: 0, // موقتاً 0، می‌تونید با paid_amount از جدول seller_payouts update کنید
        }))
        .filter(p => p.earned > 0)
        .sort((a, b) => b.earned - a.earned)
        .slice(0, 10);

      setSellerPayouts(payoutsList);
    } else {
      setTopSellers([]);
      setSellerPayouts([]);
    }

    // چارت درآمد روزانه
    const dailyChartData = Object.entries(dailyMap)
      .map(([date, data]) => ({
        date: date.substring(5),
        درآمد: Math.round(data.sales),
        پورسانت: Math.round(data.commission),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    setDailyData(dailyChartData);

    let serviceQuery = supabase
      .from('service_requests')
      .select('id, status, created_at');
    serviceQuery = buildDateFilter(serviceQuery);
    const serviceRes = await serviceQuery;

    const services = serviceRes.data || [];
    setTotalServiceRequests(services.length);
    setTotalCompletedServices(services.filter(s => s.status === 'completed').length);

    let invoicesQuery = supabase
      .from('invoices')
      .select('total_amount, commission_amount, technician_payout, technician_id, rating, created_at');
    invoicesQuery = buildDateFilter(invoicesQuery);
    const invoicesRes = await invoicesQuery;

    const invoices = invoicesRes.data || [];
    let techCommSum = 0;
    let techPayoutSum = 0;
    const techMap: Record<string, { total: number }> = {};

    let ratingSum = 0;
    let ratingNum = 0;
    let lowRatingNum = 0;

    for (let i = 0; i < invoices.length; i++) {
      const inv = invoices[i];
      techCommSum += inv.commission_amount || 0;
      techPayoutSum += inv.technician_payout || 0;

      if (inv.technician_id) {
        if (!techMap[inv.technician_id]) {
          techMap[inv.technician_id] = { total: 0 };
        }
        techMap[inv.technician_id].total += inv.total_amount || 0;
      }

      if (inv.rating !== null && inv.rating !== undefined) {
        ratingSum += inv.rating;
        ratingNum += 1;
        if (inv.rating <= 2) {
          lowRatingNum += 1;
        }
      }

      // اضافه کردن به درآمد روزانه
      const dateKey = inv.created_at.substring(0, 10);
      if (!dailyMap[dateKey]) {
        dailyMap[dateKey] = { sales: 0, commission: 0, tech: 0 };
      }
      dailyMap[dateKey].tech += inv.total_amount || 0;
    }

    setTotalTechCommission(techCommSum);
    setTotalTechPayout(techPayoutSum);

    setRatingCount(ratingNum);
    setAvgRating(ratingNum > 0 ? Math.round((ratingSum / ratingNum) * 10) / 10 : 0);
    setLowRatingPercent(ratingNum > 0 ? Math.round((lowRatingNum / ratingNum) * 100) : 0);

    const techIds = Object.keys(techMap);
    if (techIds.length > 0) {
      const techsRes = await supabase
        .from('technicians')
        .select('id, full_name')
        .in('id', techIds);

      const techsData = techsRes.data || [];
      const topTechList = techsData.map((t) => ({
        name: t.full_name,
        total: techMap[t.id]?.total || 0,
      })).sort((a, b) => b.total - a.total).slice(0, 5);

      setTopTechnicians(topTechList);
    } else {
      setTopTechnicians([]);
    }

    setLoading(false);
  }

  function applyFilter() {
    setFilterActive(true);
  }

  function clearFilter() {
    setFilterActive(false);
  }

  useEffect(() => {
    if (!loading) {
      fetchReports();
    }
  }, [filterActive]);

  const totalViraRevenue = totalSellerCommission + totalTechCommission;
  const totalPending = sellerPayouts.reduce((sum, p) => sum + (p.earned - p.paid), 0);

  const yearOptions = [];
  for (let y = nowJy - 3; y <= nowJy + 1; y++) {
    yearOptions.push(y);
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
      <div style={{maxWidth:"1200px", margin:"0 auto"}}>

        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"24px"}}>
          <h1 style={{fontSize:"22px", fontWeight:"bold", color:"#1e3a8a"}}>📊 گزارش‌های تفصیلی ویرا</h1>
          <a href="/admin" style={{color:"#1e3a8a", fontSize:"14px", textDecoration:"none"}}>← بازگشت</a>
        </div>

        <div style={{background:"white", borderRadius:"12px", padding:"16px", marginBottom:"24px"}}>
          <p style={{fontSize:"13px", fontWeight:"bold", color:"#374151", marginBottom:"10px"}}>بازه زمانی گزارش (تاریخ شمسی)</p>

          <div style={{display:"flex", gap:"16px", flexWrap:"wrap", alignItems:"flex-end"}}>

            <div>
              <p style={{fontSize:"12px", color:"#6b7280", marginBottom:"4px"}}>از روز</p>
              <div style={{display:"flex", gap:"6px"}}>
                <select value={fromJDay} onChange={(e) => setFromJDay(Number(e.target.value))} style={{border:"1px solid #d1d5db", borderRadius:"6px", padding:"6px", fontSize:"13px"}}>
                  {Array.from({length:31}, (_, i) => i+1).map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <select value={fromJMonth} onChange={(e) => setFromJMonth(Number(e.target.value))} style={{border:"1px solid #d1d5db", borderRadius:"6px", padding:"6px", fontSize:"13px"}}>
                  {jalaliMonths.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                </select>
                <select value={fromJYear} onChange={(e) => setFromJYear(Number(e.target.value))} style={{border:"1px solid #d1d5db", borderRadius:"6px", padding:"6px", fontSize:"13px"}}>
                  {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            <div>
              <p style={{fontSize:"12px", color:"#6b7280", marginBottom:"4px"}}>تا روز</p>
              <div style={{display:"flex", gap:"6px"}}>
                <select value={toJDay} onChange={(e) => setToJDay(Number(e.target.value))} style={{border:"1px solid #d1d5db", borderRadius:"6px", padding:"6px", fontSize:"13px"}}>
                  {Array.from({length:31}, (_, i) => i+1).map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <select value={toJMonth} onChange={(e) => setToJMonth(Number(e.target.value))} style={{border:"1px solid #d1d5db", borderRadius:"6px", padding:"6px", fontSize:"13px"}}>
                  {jalaliMonths.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                </select>
                <select value={toJYear} onChange={(e) => setToJYear(Number(e.target.value))} style={{border:"1px solid #d1d5db", borderRadius:"6px", padding:"6px", fontSize:"13px"}}>
                  {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            <button onClick={applyFilter} style={{background:"#1e3a8a", color:"white", border:"none", borderRadius:"6px", padding:"8px 20px", cursor:"pointer", fontSize:"13px"}}>
              اعمال فیلتر
            </button>
            {filterActive ? (
              <button onClick={clearFilter} style={{background:"#f3f4f6", color:"#6b7280", border:"none", borderRadius:"6px", padding:"8px 20px", cursor:"pointer", fontSize:"13px"}}>
                حذف فیلتر
              </button>
            ) : null}
          </div>
        </div>

        <div style={{background:"#1e3a8a", borderRadius:"16px", padding:"24px", marginBottom:"24px", textAlign:"center"}}>
          <p style={{color:"rgba(255,255,255,0.7)", fontSize:"14px", marginBottom:"8px"}}>کل پورسانت دریافتی ویرا</p>
          <p style={{color:"white", fontSize:"32px", fontWeight:"bold"}}>{totalViraRevenue.toLocaleString('fa-IR')} تومان</p>
        </div>

        {/* درآمد روزانه - چارت */}
        {dailyData.length > 0 && (
          <div style={{background:"white", borderRadius:"16px", padding:"24px", marginBottom:"24px"}}>
            <h2 style={{fontWeight:"bold", color:"#1e3a8a", marginBottom:"16px", fontSize:"16px"}}>📈 تجزیه درآمد روزانه</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(v) => v.toLocaleString('fa-IR')} />
                <Legend />
                <Line type="monotone" dataKey="درآمد" stroke="#16a34a" strokeWidth={2} />
                <Line type="monotone" dataKey="پورسانت" stroke="#f59e0b" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* درآمد معلق فروشندگان */}
        {sellerPayouts.length > 0 && (
          <div style={{background:"white", borderRadius:"16px", padding:"24px", marginBottom:"24px"}}>
            <h2 style={{fontWeight:"bold", color:"#1e3a8a", marginBottom:"16px", fontSize:"16px"}}>💰 درآمد معلق فروشندگان</h2>
            
            <div style={{background:"#fef3c7", borderRadius:"12px", padding:"16px", marginBottom:"16px"}}>
              <p style={{color:"#92400e", fontWeight:"bold", fontSize:"14px"}}>
                💼 کل درآمد معلق: {totalPending.toLocaleString('fa-IR')} تومان
              </p>
            </div>

            <table style={{width:"100%", borderCollapse:"collapse"}}>
              <thead>
                <tr style={{background:"#f3f4f6"}}>
                  <th style={{padding:"12px", textAlign:"right", fontSize:"14px", fontWeight:"bold"}}>نام فروشنده</th>
                  <th style={{padding:"12px", textAlign:"right", fontSize:"14px", fontWeight:"bold"}}>درآمد کسب‌شده</th>
                  <th style={{padding:"12px", textAlign:"right", fontSize:"14px", fontWeight:"bold"}}>پرداخت‌شده</th>
                  <th style={{padding:"12px", textAlign:"right", fontSize:"14px", fontWeight:"bold"}}>معلق</th>
                </tr>
              </thead>
              <tbody>
                {sellerPayouts.map((p, i) => (
                  <tr key={i} style={{borderBottom:"1px solid #e5e7eb"}}>
                    <td style={{padding:"12px", fontSize:"14px"}}>{p.name}</td>
                    <td style={{padding:"12px", fontSize:"14px", color:"#16a34a", fontWeight:"bold"}}>{p.earned.toLocaleString('fa-IR')} تومان</td>
                    <td style={{padding:"12px", fontSize:"14px", color:"#0284c7"}}>{p.paid.toLocaleString('fa-IR')} تومان</td>
                    <td style={{padding:"12px", fontSize:"14px", color:"#dc2626", fontWeight:"bold"}}>{(p.earned - p.paid).toLocaleString('fa-IR')} تومان</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h2 style={{fontWeight:"bold", color:"#1e3a8a", marginBottom:"12px", fontSize:"18px"}}>⭐ رضایتمندی مشتریان</h2>
        <div style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:"12px", marginBottom:"24px"}}>
          <div style={{background:"white", borderRadius:"12px", padding:"16px", textAlign:"center"}}>
            <p style={{fontSize:"18px", fontWeight:"bold", color: avgRating >= 4 ? "#16a34a" : avgRating >= 3 ? "#f59e0b" : "#dc2626"}}>
              {avgRating > 0 ? avgRating : '—'} / 5
            </p>
            <p style={{fontSize:"12px", color:"#6b7280", marginTop:"4px"}}>میانگین امتیاز</p>
          </div>
          <div style={{background:"white", borderRadius:"12px", padding:"16px", textAlign:"center"}}>
            <p style={{fontSize:"18px", fontWeight:"bold", color:"#1e3a8a"}}>{ratingCount}</p>
            <p style={{fontSize:"12px", color:"#6b7280", marginTop:"4px"}}>تعداد نظرسنجی</p>
          </div>
          <div style={{background:"white", borderRadius:"12px", padding:"16px", textAlign:"center", border: lowRatingPercent > 20 ? "2px solid #dc2626" : "none"}}>
            <p style={{fontSize:"18px", fontWeight:"bold", color: lowRatingPercent > 20 ? "#dc2626" : "#8b5cf6"}}>
              {lowRatingPercent}%
            </p>
            <p style={{fontSize:"12px", color:"#6b7280", marginTop:"4px"}}>نارضایتی</p>
          </div>
        </div>

        {lowRatingPercent > 20 && ratingCount >= 3 && (
          <div style={{background:"#fef2f2", border:"1px solid #fecaca", borderRadius:"12px", padding:"16px", marginBottom:"24px"}}>
            <p style={{color:"#dc2626", fontWeight:"bold", fontSize:"14px"}}>
              ⚠️ هشدار: نرخ نارضایتی بالاست
            </p>
          </div>
        )}

        <h2 style={{fontWeight:"bold", color:"#1e3a8a", marginBottom:"12px", fontSize:"18px"}}>📦 فروشگاه</h2>
        <div style={{display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:"12px", marginBottom:"24px"}}>
          <div style={{background:"white", borderRadius:"12px", padding:"16px", textAlign:"center"}}>
            <p style={{fontSize:"18px", fontWeight:"bold", color:"#1e3a8a"}}>{totalOrders}</p>
            <p style={{fontSize:"12px", color:"#6b7280", marginTop:"4px"}}>تعداد سفارش</p>
          </div>
          <div style={{background:"white", borderRadius:"12px", padding:"16px", textAlign:"center"}}>
            <p style={{fontSize:"18px", fontWeight:"bold", color:"#16a34a"}}>{totalSales.toLocaleString('fa-IR')}</p>
            <p style={{fontSize:"12px", color:"#6b7280", marginTop:"4px"}}>جمع فروش</p>
          </div>
          <div style={{background:"white", borderRadius:"12px", padding:"16px", textAlign:"center"}}>
            <p style={{fontSize:"18px", fontWeight:"bold", color:"#f59e0b"}}>{totalSellerCommission.toLocaleString('fa-IR')}</p>
            <p style={{fontSize:"12px", color:"#6b7280", marginTop:"4px"}}>پورسانت ویرا</p>
          </div>
          <div style={{background:"white", borderRadius:"12px", padding:"16px", textAlign:"center"}}>
            <p style={{fontSize:"18px", fontWeight:"bold", color:"#8b5cf6"}}>{totalSellerPayout.toLocaleString('fa-IR')}</p>
            <p style={{fontSize:"12px", color:"#6b7280", marginTop:"4px"}}>سهم فروشندگان</p>
          </div>
        </div>

        {topSellers.length > 0 && (
          <div style={{background:"white", borderRadius:"12px", padding:"16px", marginBottom:"24px"}}>
            <p style={{fontWeight:"bold", marginBottom:"12px", fontSize:"14px"}}>🌟 برترین فروشندگان</p>
            {topSellers.map((s, i) => (
              <div key={i} style={{display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom: i < topSellers.length - 1 ? "1px solid #f3f4f6" : "none"}}>
                <span style={{fontSize:"14px"}}>{i+1}. {s.name}</span>
                <span style={{fontSize:"14px", fontWeight:"bold", color:"#16a34a"}}>{s.total.toLocaleString('fa-IR')} تومان</span>
              </div>
            ))}
          </div>
        )}

        <h2 style={{fontWeight:"bold", color:"#1e3a8a", marginBottom:"12px", fontSize:"18px"}}>🔧 خدمات تکنسین</h2>
        <div style={{display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:"12px", marginBottom:"24px"}}>
          <div style={{background:"white", borderRadius:"12px", padding:"16px", textAlign:"center"}}>
            <p style={{fontSize:"18px", fontWeight:"bold", color:"#1e3a8a"}}>{totalServiceRequests}</p>
            <p style={{fontSize:"12px", color:"#6b7280", marginTop:"4px"}}>کل درخواست‌ها</p>
          </div>
          <div style={{background:"white", borderRadius:"12px", padding:"16px", textAlign:"center"}}>
            <p style={{fontSize:"18px", fontWeight:"bold", color:"#16a34a"}}>{totalCompletedServices}</p>
            <p style={{fontSize:"12px", color:"#6b7280", marginTop:"4px"}}>تکمیل‌شده</p>
          </div>
          <div style={{background:"white", borderRadius:"12px", padding:"16px", textAlign:"center"}}>
            <p style={{fontSize:"18px", fontWeight:"bold", color:"#f59e0b"}}>{totalTechCommission.toLocaleString('fa-IR')}</p>
            <p style={{fontSize:"12px", color:"#6b7280", marginTop:"4px"}}>پورسانت ویرا</p>
          </div>
          <div style={{background:"white", borderRadius:"12px", padding:"16px", textAlign:"center"}}>
            <p style={{fontSize:"18px", fontWeight:"bold", color:"#8b5cf6"}}>{totalTechPayout.toLocaleString('fa-IR')}</p>
            <p style={{fontSize:"12px", color:"#6b7280", marginTop:"4px"}}>سهم تکنسین‌ها</p>
          </div>
        </div>

        {topTechnicians.length > 0 && (
          <div style={{background:"white", borderRadius:"12px", padding:"16px"}}>
            <p style={{fontWeight:"bold", marginBottom:"12px", fontSize:"14px"}}>🌟 برترین تکنسین‌ها</p>
            {topTechnicians.map((t, i) => (
              <div key={i} style={{display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom: i < topTechnicians.length - 1 ? "1px solid #f3f4f6" : "none"}}>
                <span style={{fontSize:"14px"}}>{i+1}. {t.name}</span>
                <span style={{fontSize:"14px", fontWeight:"bold", color:"#16a34a"}}>{t.total.toLocaleString('fa-IR')} تومان</span>
              </div>
            ))}
          </div>
        )}

      </div>
    </main>
  );
}
