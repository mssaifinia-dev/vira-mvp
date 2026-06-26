'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
};

export default function AdminInventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  const [editValues, setEditValues] = useState<Record<string, { price: string; stock: string }>>({});

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

    fetchProducts();
  }

  async function fetchProducts() {
    const res = await supabase
      .from('products')
      .select('id, name, category, price, stock')
      .order('name', { ascending: true });

    setProducts(res.data || []);

    const initEdit: Record<string, { price: string; stock: string }> = {};
    for (let i = 0; i < (res.data || []).length; i++) {
      const p = res.data![i];
      initEdit[p.id] = { price: String(p.price), stock: String(p.stock) };
    }
    setEditValues(initEdit);

    setLoading(false);
  }

  async function saveOneProduct(id: string) {
    const edit = editValues[id];
    if (!edit) return;

    const newPrice = Number(edit.price);
    const newStock = Number(edit.stock);

    if (isNaN(newPrice) || isNaN(newStock)) {
      setError('مقادیر باید عددی باشند');
      return;
    }

    await supabase.from('products').update({ price: newPrice, stock: newStock }).eq('id', id);
    setMessage('محصول بروزرسانی شد');
    setTimeout(() => setMessage(''), 2000);
    fetchProducts();
  }

  function downloadTemplate() {
    let csv = 'نام محصول,قیمت جدید,موجودی جدید\n';
    for (let i = 0; i < products.length; i++) {
      csv += products[i].name + ',' + products[i].price + ',' + products[i].stock + '\n';
    }

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'vira-inventory-template.csv';
    link.click();
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');
    setMessage('');

    const text = await file.text();
    const lines = text.split('\n').filter(l => l.trim() !== '');

    if (lines.length < 2) {
      setError('فایل خالی است یا فرمت آن درست نیست');
      setUploading(false);
      return;
    }

    let updatedCount = 0;
    let notFoundCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      if (cols.length < 3) continue;

      const productName = cols[0].trim().replace(/^\uFEFF/, '');
      const newPrice = Number(cols[1].trim());
      const newStock = Number(cols[2].trim());

      if (!productName || isNaN(newPrice) || isNaN(newStock)) continue;

      const matchingProduct = products.find(p => p.name.trim() === productName);

      if (matchingProduct) {
        await supabase.from('products').update({ price: newPrice, stock: newStock }).eq('id', matchingProduct.id);
        updatedCount++;
      } else {
        notFoundCount++;
      }
    }

    setMessage(updatedCount + ' محصول بروزرسانی شد' + (notFoundCount > 0 ? '، ' + notFoundCount + ' مورد یافت نشد' : ''));
    setUploading(false);
    fetchProducts();
    e.target.value = '';
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
      <div style={{maxWidth:"900px", margin:"0 auto"}}>

        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"24px"}}>
          <h1 style={{fontSize:"22px", fontWeight:"bold", color:"#1e3a8a"}}>مدیریت انبار و قیمت‌ها</h1>
          <a href="/admin" style={{color:"#1e3a8a", fontSize:"14px", textDecoration:"none"}}>← بازگشت به پنل اصلی</a>
        </div>

        <div style={{background:"white", borderRadius:"12px", padding:"20px", marginBottom:"24px"}}>
          <p style={{fontWeight:"bold", marginBottom:"12px", fontSize:"14px"}}>بروزرسانی گروهی با فایل اکسل (CSV)</p>
          <p style={{color:"#6b7280", fontSize:"13px", marginBottom:"16px"}}>
            ابتدا فایل نمونه را دانلود کن، قیمت و موجودی را در اکسل ویرایش کن، ذخیره کن (با فرمت CSV)، و دوباره آپلود کن.
          </p>

          <div style={{display:"flex", gap:"12px", flexWrap:"wrap", alignItems:"center"}}>
            <button
              onClick={downloadTemplate}
              style={{background:"#16a34a", color:"white", border:"none", borderRadius:"8px", padding:"10px 20px", cursor:"pointer", fontSize:"13px"}}
            >
              دانلود فایل نمونه (با محصولات فعلی)
            </button>

            <label style={{background:"#1e3a8a", color:"white", borderRadius:"8px", padding:"10px 20px", cursor:"pointer", fontSize:"13px"}}>
              {uploading ? 'در حال آپلود...' : 'آپلود فایل CSV'}
              <input type="file" accept=".csv" onChange={handleFileUpload} disabled={uploading} style={{display:"none"}} />
            </label>
          </div>

          {message ? <p style={{color:"#16a34a", fontSize:"13px", marginTop:"12px"}}>{message}</p> : null}
          {error ? <p style={{color:"red", fontSize:"13px", marginTop:"12px"}}>{error}</p> : null}
        </div>

        <div style={{background:"white", borderRadius:"12px", overflow:"hidden"}}>
          <p style={{fontWeight:"bold", padding:"16px", fontSize:"14px", borderBottom:"1px solid #f3f4f6"}}>ویرایش دستی تک‌محصول</p>
          <table style={{width:"100%", borderCollapse:"collapse", textAlign:"right"}}>
            <thead style={{background:"#1e3a8a", color:"white"}}>
              <tr>
                <th style={{padding:"12px"}}>نام محصول</th>
                <th style={{padding:"12px"}}>دسته</th>
                <th style={{padding:"12px"}}>قیمت</th>
                <th style={{padding:"12px"}}>موجودی</th>
                <th style={{padding:"12px"}}>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} style={{borderBottom:"1px solid #f3f4f6"}}>
                  <td style={{padding:"12px"}}>{p.name}</td>
                  <td style={{padding:"12px", color:"#6b7280", fontSize:"13px"}}>{p.category}</td>
                  <td style={{padding:"8px"}}>
                    <input
                      type="number"
                      value={editValues[p.id]?.price || ''}
                      onChange={(e) => setEditValues({ ...editValues, [p.id]: { ...editValues[p.id], price: e.target.value } })}
                      style={{width:"100px", border:"1px solid #d1d5db", borderRadius:"6px", padding:"6px", fontSize:"13px"}}
                    />
                  </td>
                  <td style={{padding:"8px"}}>
                    <input
                      type="number"
                      value={editValues[p.id]?.stock || ''}
                      onChange={(e) => setEditValues({ ...editValues, [p.id]: { ...editValues[p.id], stock: e.target.value } })}
                      style={{width:"70px", border:"1px solid #d1d5db", borderRadius:"6px", padding:"6px", fontSize:"13px"}}
                    />
                  </td>
                  <td style={{padding:"8px"}}>
                    <button
                      onClick={() => saveOneProduct(p.id)}
                      style={{background:"#16a34a", color:"white", border:"none", borderRadius:"6px", padding:"6px 14px", cursor:"pointer", fontSize:"12px"}}
                    >
                      ذخیره
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