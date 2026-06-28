'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

function jalaliToGregorian(jy: number, jm: number, jd: number) {
  let gy;
  if (jy <= 979) {
    gy = 621;
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

function pad(n: number) {
  return n < 10 ? '0' + n : String(n);
}

const jalaliMonths = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

type DiscountCode = {
  id: string;
  code: string;
  discount_percent: number;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
};

export default function AdminDiscountsPage() {
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const [nowJy] = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());

  const [newCode, setNewCode] = useState('');
  const [newPercent, setNewPercent] = useState('');
  const [newMaxUses, setNewMaxUses] = useState('');

  const [hasExpiry, setHasExpiry] = useState(false);
  const [expJYear, setExpJYear] = useState(nowJy);
  const [expJMonth, setExpJMonth] = useState(1);
  const [expJDay, setExpJDay] = useState(1);

  const [error, setError] = useState('');

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

    fetchCodes();
  }

  async function fetchCodes() {
    const res = await supabase
      .from('discount_codes')
      .select('*')
      .order('created_at', { ascending: false });

    setCodes(res.data || []);
    setLoading(false);
  }

  async function handleCreate() {
    setError('');

    if (!newCode || !newPercent) {
      setError('کد و درصد تخفیف الزامی است');
      return;
    }

    let expiresAt = null;
    if (hasExpiry) {
      const [gy, gm, gd] = jalaliToGregorian(expJYear, expJMonth, expJDay);
      expiresAt = gy + '-' + pad(gm) + '-' + pad(gd) + 'T23:59:59';
    }

    const insertRes = await supabase.from('discount_codes').insert({
      code: newCode.toUpperCase().trim(),
      discount_percent: Number(newPercent),
      max_uses: newMaxUses ? Number(newMaxUses) : null,
      expires_at: expiresAt,
    });

    if (insertRes.error) {
      setError('خطا: ' + insertRes.error.message);
    } else {
      setNewCode('');
      setNewPercent('');
      setNewMaxUses('');
      setHasExpiry(false);
      fetchCodes();
    }
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from('discount_codes').update({ is_active: !current }).eq('id', id);
    fetchCodes();
  }

  async function deleteCode(id: string) {
    await supabase.from('discount_codes').delete().eq('id', id);
    fetchCodes();
  }

  function formatExpiry(dateStr: string | null) {
    if (!dateStr) return 'بدون انقضا';
    const d = new Date(dateStr);
    const [jy, jm, jd] = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
    return jd + ' ' + jalaliMonths[jm - 1] + ' ' + jy;
  }

  const yearOptions = [];
  for (let y = nowJy; y <= nowJy + 3; y++) {
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
      <div style={{maxWidth:"800px", margin:"0 auto"}}>

        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"24px"}}>
          <h1 style={{fontSize:"22px", fontWeight:"bold", color:"#1e3a8a"}}>کدهای تخفیف</h1>
          <a href="/admin" style={{color:"#1e3a8a", fontSize:"14px", textDecoration:"none"}}>← بازگشت به پنل اصلی</a>
        </div>

        <div style={{background:"white", borderRadius:"12px", padding:"20px", marginBottom:"24px"}}>
          <p style={{fontWeight:"bold", marginBottom:"16px"}}>ایجاد کد تخفیف جدید</p>

          <div style={{display:"grid", gridTemplateColumns:"repeat(2, 1fr)", gap:"12px", marginBottom:"16px"}}>
            <div>
              <label style={{fontSize:"12px", color:"#6b7280", display:"block", marginBottom:"4px"}}>کد تخفیف</label>
              <input
                type="text"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="مثلاً VIRA20"
                style={{width:"100%", border:"1px solid #d1d5db", borderRadius:"8px", padding:"8px 10px", boxSizing:"border-box"}}
              />
            </div>
            <div>
              <label style={{fontSize:"12px", color:"#6b7280", display:"block", marginBottom:"4px"}}>درصد تخفیف</label>
              <input
                type="number"
                value={newPercent}
                onChange={(e) => setNewPercent(e.target.value)}
                placeholder="20"
                style={{width:"100%", border:"1px solid #d1d5db", borderRadius:"8px", padding:"8px 10px", boxSizing:"border-box"}}
              />
            </div>
            <div>
              <label style={{fontSize:"12px", color:"#6b7280", display:"block", marginBottom:"4px"}}>سقف تعداد استفاده (اختیاری)</label>
              <input
                type="number"
                value={newMaxUses}
                onChange={(e) => setNewMaxUses(e.target.value)}
                placeholder="بدون محدودیت"
                style={{width:"100%", border:"1px solid #d1d5db", borderRadius:"8px", padding:"8px 10px", boxSizing:"border-box"}}
              />
            </div>
          </div>

          <div style={{marginBottom:"16px"}}>
            <label style={{display:"flex", alignItems:"center", gap:"8px", fontSize:"13px", color:"#374151", marginBottom:"8px", cursor:"pointer"}}>
              <input type="checkbox" checked={hasExpiry} onChange={(e) => setHasExpiry(e.target.checked)} />
              این کد تاریخ انقضا داشته باشد
            </label>

            {hasExpiry ? (
              <div style={{display:"flex", gap:"6px"}}>
                <select value={expJDay} onChange={(e) => setExpJDay(Number(e.target.value))} style={{border:"1px solid #d1d5db", borderRadius:"6px", padding:"6px", fontSize:"13px"}}>
                  {Array.from({length:31}, (_, i) => i+1).map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <select value={expJMonth} onChange={(e) => setExpJMonth(Number(e.target.value))} style={{border:"1px solid #d1d5db", borderRadius:"6px", padding:"6px", fontSize:"13px"}}>
                  {jalaliMonths.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                </select>
                <select value={expJYear} onChange={(e) => setExpJYear(Number(e.target.value))} style={{border:"1px solid #d1d5db", borderRadius:"6px", padding:"6px", fontSize:"13px"}}>
                  {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            ) : null}
          </div>

          {error && <p style={{color:"red", fontSize:"13px", marginBottom:"12px"}}>{error}</p>}

          <button
            onClick={handleCreate}
            style={{background:"#16a34a", color:"white", border:"none", borderRadius:"8px", padding:"10px 24px", cursor:"pointer", fontSize:"14px", fontWeight:"bold"}}
          >
            ایجاد کد
          </button>
        </div>

        <div style={{background:"white", borderRadius:"12px", overflow:"hidden"}}>
          <table style={{width:"100%", borderCollapse:"collapse", textAlign:"right"}}>
            <thead style={{background:"#1e3a8a", color:"white"}}>
              <tr>
                <th style={{padding:"12px"}}>کد</th>
                <th style={{padding:"12px"}}>درصد</th>
                <th style={{padding:"12px"}}>استفاده‌شده</th>
                <th style={{padding:"12px"}}>سقف</th>
                <th style={{padding:"12px"}}>انقضا</th>
                <th style={{padding:"12px"}}>وضعیت</th>
                <th style={{padding:"12px"}}>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {codes.length === 0 ? (
                <tr><td colSpan={7} style={{padding:"32px", textAlign:"center", color:"#9ca3af"}}>هیچ کدی ثبت نشده</td></tr>
              ) : codes.map((c) => (
                <tr key={c.id} style={{borderBottom:"1px solid #f3f4f6"}}>
                  <td style={{padding:"12px", fontWeight:"bold"}}>{c.code}</td>
                  <td style={{padding:"12px"}}>{c.discount_percent}٪</td>
                  <td style={{padding:"12px"}}>{c.used_count}</td>
                  <td style={{padding:"12px", color:"#6b7280"}}>{c.max_uses ?? 'نامحدود'}</td>
                  <td style={{padding:"12px", color:"#6b7280", fontSize:"13px"}}>{formatExpiry(c.expires_at)}</td>
                  <td style={{padding:"12px"}}>
                    <span style={{padding:"4px 8px", borderRadius:"6px", fontSize:"12px", fontWeight:"bold",
                      background: c.is_active ? "#d1fae5" : "#fee2e2",
                      color: c.is_active ? "#065f46" : "#dc2626"
                    }}>{c.is_active ? 'فعال' : 'غیرفعال'}</span>
                  </td>
                  <td style={{padding:"12px", display:"flex", gap:"6px"}}>
                    <button onClick={() => toggleActive(c.id, c.is_active)}
                      style={{background:"#f3f4f6", color:"#1e3a8a", border:"none", borderRadius:"6px", padding:"4px 10px", cursor:"pointer", fontSize:"12px"}}>
                      {c.is_active ? 'غیرفعال کن' : 'فعال کن'}
                    </button>
                    <button onClick={() => deleteCode(c.id)}
                      style={{background:"#fee2e2", color:"#dc2626", border:"none", borderRadius:"6px", padding:"4px 10px", cursor:"pointer", fontSize:"12px"}}>
                      حذف
                    </button>
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