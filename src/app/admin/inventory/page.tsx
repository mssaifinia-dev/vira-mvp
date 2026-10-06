'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';

type Product = {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  original_price: number | null;
  is_special_offer: boolean;
  stock: number;
  image: string | null;
  seller_id: string | null;
};

type SellerInfo = {
  id: string;
  shop_name: string;
};

const categories = [
  { value: 'ftth', label: 'تجهیزات FTTH' },
  { value: 'smart-home', label: 'خانه هوشمند' },
  { value: 'car-parts', label: 'قطعات خودرو' },
  { value: 'battery', label: 'باطری شارژی' },
  { value: 'stock', label: 'استوک' },
];

export default function AdminInventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sellers, setSellers] = useState<SellerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [excelUploading, setExcelUploading] = useState(false);
  const [sellerFilter, setSellerFilter] = useState('all');

  const [editValues, setEditValues] = useState<Record<string, { price: string; stock: string }>>({});

  // فرم افزودن/ویرایش تک‌محصول
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formOriginalPrice, setFormOriginalPrice] = useState('');
  const [formIsSpecialOffer, setFormIsSpecialOffer] = useState(false);
  const [formCategory, setFormCategory] = useState('ftth');
  const [formStock, setFormStock] = useState('');
  const [formSellerId, setFormSellerId] = useState(''); // '' یعنی محصول خودِ ویرا
  const [formImageFile, setFormImageFile] = useState<File | null>(null);
  const [formExistingImage, setFormExistingImage] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [savingProduct, setSavingProduct] = useState(false);

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

    fetchSellers();
    fetchProducts();
  }

  async function fetchSellers() {
    const res = await supabase.from('sellers').select('id, shop_name').order('shop_name', { ascending: true });
    setSellers(res.data || []);
  }

  async function fetchProducts() {
    const res = await supabase
      .from('products')
      .select('id, name, description, category, price, original_price, is_special_offer, stock, image, seller_id')
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

  function getSellerName(sellerId: string | null): string {
    if (!sellerId) return 'ویرا (خودمون)';
    const s = sellers.find(s => s.id === sellerId);
    return s ? s.shop_name : 'فروشنده نامشخص';
  }

  const filteredProducts = products.filter(p => {
    if (sellerFilter === 'all') return true;
    if (sellerFilter === 'vira') return !p.seller_id;
    return p.seller_id === sellerFilter;
  });

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

  function resetForm() {
    setFormName('');
    setFormDescription('');
    setFormPrice('');
    setFormOriginalPrice('');
    setFormIsSpecialOffer(false);
    setFormCategory('ftth');
    setFormStock('');
    setFormSellerId('');
    setFormImageFile(null);
    setFormExistingImage(null);
    setEditingId(null);
    setFormError('');
  }

  function startEditProduct(p: Product) {
    setEditingId(p.id);
    setFormName(p.name);
    setFormDescription(p.description || '');
    setFormPrice(String(p.price));
    setFormOriginalPrice(p.original_price ? String(p.original_price) : '');
    setFormIsSpecialOffer(p.is_special_offer);
    setFormCategory(p.category || 'ftth');
    setFormStock(String(p.stock));
    setFormSellerId(p.seller_id || '');
    setFormExistingImage(p.image);
    setFormImageFile(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSaveProductForm() {
    setFormError('');

    if (!formName || !formPrice || !formStock) {
      setFormError('نام، قیمت و موجودی الزامی است');
      return;
    }

    if (formOriginalPrice && Number(formOriginalPrice) <= Number(formPrice)) {
      setFormError('قیمت اصلی باید بیشتر از قیمت فروش باشد');
      return;
    }

    setSavingProduct(true);

    let imageUrl = formExistingImage;

    if (formImageFile) {
      const fileExt = formImageFile.name.split('.').pop();
      const fileName = Date.now() + '.' + fileExt;

      const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(fileName, formImageFile);

      if (uploadError) {
        setFormError('خطا در آپلود تصویر: ' + uploadError.message);
        setSavingProduct(false);
        return;
      }

      const { data } = supabase.storage.from('products').getPublicUrl(fileName);
      imageUrl = data.publicUrl;
    }

    const payload = {
      name: formName,
      description: formDescription,
      price: Number(formPrice),
      original_price: formOriginalPrice ? Number(formOriginalPrice) : null,
      is_special_offer: formIsSpecialOffer,
      category: formCategory,
      stock: Number(formStock),
      seller_id: formSellerId || null,
      image: imageUrl,
    };

    let saveError;
    if (editingId) {
      const { error: updateError } = await supabase.from('products').update(payload).eq('id', editingId);
      saveError = updateError;
    } else {
      const { error: insertError } = await supabase.from('products').insert(payload);
      saveError = insertError;
    }

    setSavingProduct(false);

    if (saveError) {
      setFormError(saveError.message);
      return;
    }

    setMessage(editingId ? 'محصول ویرایش شد' : 'محصول جدید ثبت شد');
    setTimeout(() => setMessage(''), 2500);
    resetForm();
    setShowForm(false);
    fetchProducts();
  }

  async function handleDeleteProduct(id: string) {
    await supabase.from('products').delete().eq('id', id);
    fetchProducts();
  }

  function downloadTemplate() {
    const data = products.map(p => ({
      'نام محصول': p.name,
      'قیمت جدید': p.price,
      'موجودی جدید': p.stock,
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'محصولات');
    XLSX.writeFile(workbook, 'vira-inventory-template.xlsx');
  }

  function downloadNewProductTemplate() {
    const data = [{
      name: 'نمونه محصول',
      category: 'دسته‌بندی',
      description: 'توضیحات محصول',
      price: 150000,
      stock: 10,
      image: '',
    }];
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'محصولات جدید');
    XLSX.writeFile(workbook, 'vira-new-products-template.xlsx');
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');
    setMessage('');

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any>(sheet);

      if (rows.length === 0) {
        setError('فایل خالی است یا فرمت آن درست نیست');
        setUploading(false);
        return;
      }

      let updatedCount = 0;
      let notFoundCount = 0;

      for (const row of rows) {
        const productName = String(row['نام محصول'] || '').trim();
        const newPrice = Number(row['قیمت جدید']);
        const newStock = Number(row['موجودی جدید']);

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
      fetchProducts();

    } catch {
      setError('خواندن فایل مشکل داشت');
    }

    setUploading(false);
    e.target.value = '';
  }

  async function handleExcelImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelUploading(true);
    setError('');
    setMessage('');

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer);

      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any>(sheet);

      let success = 0;
      let failed = 0;

      for (const row of rows) {
        if (!row.name || !row.price) {
          failed++;
          continue;
        }

        // محصولاتی که از این فرم اکسل وارد میشن، چون فروشنده‌ای مشخص نشده، همیشه مال خودِ ویرا هستن (seller_id = null)
        const { error } = await supabase
          .from('products')
          .insert({
            name: row.name,
            category: row.category || 'other',
            description: row.description || '',
            price: Number(row.price),
            stock: Number(row.stock || 0),
            image: row.image || '',
            seller_id: null,
          });

        if (error) {
          failed++;
        } else {
          success++;
        }
      }

      setMessage(`${success} محصول جدید ثبت شد${failed ? `، ${failed} مورد خطا داشت` : ''}`);
      fetchProducts();

    } catch {
      setError('خواندن فایل اکسل مشکل داشت');
    }

    setExcelUploading(false);
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
      <div style={{maxWidth:"1000px", margin:"0 auto"}}>

        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"24px"}}>
          <h1 style={{fontSize:"22px", fontWeight:"bold", color:"#1e3a8a"}}>مدیریت انبار و قیمت‌ها</h1>
          <a href="/admin" style={{color:"#1e3a8a", fontSize:"14px", textDecoration:"none"}}>← بازگشت به پنل اصلی</a>
        </div>

        {message ? <p style={{color:"#16a34a", background:"#f0fdf4", padding:"10px 16px", borderRadius:"8px", fontSize:"13px", marginBottom:"16px"}}>{message}</p> : null}
        {error ? <p style={{color:"#dc2626", background:"#fef2f2", padding:"10px 16px", borderRadius:"8px", fontSize:"13px", marginBottom:"16px"}}>{error}</p> : null}

        {/* افزودن/ویرایش تک‌محصول */}
        <div style={{background:"white", borderRadius:"12px", padding:"20px", marginBottom:"16px"}}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: showForm ? "16px" : "0"}}>
            <p style={{fontWeight:"bold", fontSize:"14px"}}>۱. افزودن یا ویرایش تک‌محصول</p>
            <button
              onClick={() => { if (showForm) { resetForm(); } setShowForm(!showForm); }}
              style={{background:"#1e3a8a", color:"white", border:"none", borderRadius:"8px", padding:"8px 18px", cursor:"pointer", fontSize:"13px", fontWeight:"bold"}}
            >
              {showForm ? 'انصراف' : '+ افزودن محصول جدید'}
            </button>
          </div>

          {showForm ? (
            <div style={{borderTop:"1px solid #f3f4f6", paddingTop:"16px"}}>
              <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"14px"}}>

                <div>
                  <label style={{display:"block", fontSize:"13px", color:"#374151", marginBottom:"4px"}}>نام محصول *</label>
                  <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)}
                    style={{width:"100%", border:"1px solid #d1d5db", borderRadius:"8px", padding:"8px 12px", boxSizing:"border-box"}} />
                </div>

                <div>
                  <label style={{display:"block", fontSize:"13px", color:"#374151", marginBottom:"4px"}}>دسته‌بندی</label>
                  <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)}
                    style={{width:"100%", border:"1px solid #d1d5db", borderRadius:"8px", padding:"8px 12px", boxSizing:"border-box"}}>
                    {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{display:"block", fontSize:"13px", color:"#374151", marginBottom:"4px"}}>قیمت فروش (تومان) *</label>
                  <input type="number" value={formPrice} onChange={(e) => setFormPrice(e.target.value)}
                    style={{width:"100%", border:"1px solid #d1d5db", borderRadius:"8px", padding:"8px 12px", boxSizing:"border-box"}} />
                </div>

                <div>
                  <label style={{display:"block", fontSize:"13px", color:"#374151", marginBottom:"4px"}}>موجودی *</label>
                  <input type="number" value={formStock} onChange={(e) => setFormStock(e.target.value)}
                    style={{width:"100%", border:"1px solid #d1d5db", borderRadius:"8px", padding:"8px 12px", boxSizing:"border-box"}} />
                </div>

                <div>
                  <label style={{display:"block", fontSize:"13px", color:"#374151", marginBottom:"4px"}}>قیمت اصلی - قبل تخفیف (اختیاری)</label>
                  <input type="number" value={formOriginalPrice} onChange={(e) => setFormOriginalPrice(e.target.value)}
                    placeholder="اگر تخفیف ندارد خالی بگذارید"
                    style={{width:"100%", border:"1px solid #d1d5db", borderRadius:"8px", padding:"8px 12px", boxSizing:"border-box"}} />
                </div>

                <div>
                  <label style={{display:"block", fontSize:"13px", color:"#374151", marginBottom:"4px"}}>این محصول متعلق به:</label>
                  <select value={formSellerId} onChange={(e) => setFormSellerId(e.target.value)}
                    style={{width:"100%", border:"1px solid #d1d5db", borderRadius:"8px", padding:"8px 12px", boxSizing:"border-box"}}>
                    <option value="">ویرا (خودمون)</option>
                    {sellers.map(s => <option key={s.id} value={s.id}>{s.shop_name}</option>)}
                  </select>
                </div>

                <div style={{display:"flex", alignItems:"center"}}>
                  <label style={{display:"flex", alignItems:"center", gap:"8px", fontSize:"13px", color:"#374151", cursor:"pointer", marginTop:"22px"}}>
                    <input type="checkbox" checked={formIsSpecialOffer} onChange={(e) => setFormIsSpecialOffer(e.target.checked)} />
                    پیشنهاد شگفت‌انگیز باشد
                  </label>
                </div>

                <div style={{gridColumn:"1 / -1"}}>
                  <label style={{display:"block", fontSize:"13px", color:"#374151", marginBottom:"4px"}}>تصویر محصول</label>
                  {formExistingImage && !formImageFile ? (
                    <img src={formExistingImage} alt={formName} style={{width:"70px", height:"70px", objectFit:"cover", borderRadius:"8px", marginBottom:"8px", border:"1px solid #e5e7eb"}} />
                  ) : null}
                  <input type="file" accept="image/*" onChange={(e) => setFormImageFile(e.target.files?.[0] || null)}
                    style={{width:"100%", border:"1px solid #d1d5db", borderRadius:"8px", padding:"8px 12px", boxSizing:"border-box", marginBottom:"12px"}} />

                  <label style={{display:"block", fontSize:"13px", color:"#374151", marginBottom:"4px"}}>توضیحات</label>
                  <textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={3}
                    style={{width:"100%", border:"1px solid #d1d5db", borderRadius:"8px", padding:"8px 12px", boxSizing:"border-box"}} />
                </div>

              </div>

              {formError ? <p style={{color:"#dc2626", fontSize:"13px", marginTop:"12px"}}>{formError}</p> : null}

              <button
                onClick={handleSaveProductForm}
                disabled={savingProduct}
                style={{marginTop:"16px", background:"#16a34a", color:"white", border:"none", borderRadius:"8px", padding:"10px 24px", cursor:"pointer", fontSize:"14px", fontWeight:"bold"}}
              >
                {savingProduct ? 'در حال ذخیره...' : (editingId ? 'ذخیره تغییرات' : 'ثبت محصول')}
              </button>
            </div>
          ) : null}
        </div>

        {/* بروزرسانی گروهی قیمت/موجودی */}
        <div style={{background:"white", borderRadius:"12px", padding:"20px", marginBottom:"16px"}}>
          <p style={{fontWeight:"bold", marginBottom:"12px", fontSize:"14px"}}>۲. بروزرسانی گروهی قیمت/موجودی (محصولات موجود)</p>
          <p style={{color:"#6b7280", fontSize:"13px", marginBottom:"16px"}}>
            ابتدا فایل نمونه را دانلود کن، قیمت و موجودی را در اکسل ویرایش کن و دوباره همون فایل اکسل رو آپلود کن (بدون نیاز به تبدیل فرمت).
          </p>

          <div style={{display:"flex", gap:"12px", flexWrap:"wrap", alignItems:"center"}}>
            <button
              onClick={downloadTemplate}
              style={{background:"#16a34a", color:"white", border:"none", borderRadius:"8px", padding:"10px 20px", cursor:"pointer", fontSize:"13px"}}
            >
              دانلود فایل نمونه (با محصولات فعلی)
            </button>

            <label style={{background:"#1e3a8a", color:"white", borderRadius:"8px", padding:"10px 20px", cursor:"pointer", fontSize:"13px"}}>
              {uploading ? 'در حال آپلود...' : 'آپلود فایل اکسل'}
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} disabled={uploading} style={{display:"none"}} />
            </label>
          </div>
        </div>

        {/* ورود محصولات جدید با اکسل (گروهی) */}
        <div style={{background:"white", borderRadius:"12px", padding:"20px", marginBottom:"24px"}}>
          <p style={{fontWeight:"bold", marginBottom:"12px", fontSize:"14px"}}>۳. افزودن گروهی محصولات جدید (Excel)</p>
          <p style={{color:"#6b7280", fontSize:"13px", marginBottom:"16px"}}>
            فایل اکسل باید ستون‌های name، category، description، price، stock، image داشته باشد. محصولاتی که از این راه اضافه می‌شوند، همیشه به‌عنوان محصول خودِ ویرا ثبت می‌شوند.
          </p>

          <div style={{display:"flex", gap:"12px", flexWrap:"wrap", alignItems:"center"}}>
            <button
              onClick={downloadNewProductTemplate}
              style={{background:"#16a34a", color:"white", border:"none", borderRadius:"8px", padding:"10px 20px", cursor:"pointer", fontSize:"13px"}}
            >
              دانلود فایل نمونه (محصول جدید)
            </button>

            <label style={{background:"#7c3aed", color:"white", borderRadius:"8px", padding:"10px 20px", cursor:"pointer", fontSize:"13px"}}>
              {excelUploading ? 'در حال ثبت...' : 'ورود محصولات جدید (Excel)'}
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleExcelImport}
                disabled={excelUploading}
                style={{display:"none"}}
              />
            </label>
          </div>
        </div>

        {/* جدول محصولات با فیلتر فروشنده */}
        <div style={{background:"white", borderRadius:"12px", overflow:"hidden"}}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", padding:"16px", borderBottom:"1px solid #f3f4f6", flexWrap:"wrap", gap:"12px"}}>
            <p style={{fontWeight:"bold", fontSize:"14px"}}>لیست محصولات ({filteredProducts.length})</p>
            <select
              value={sellerFilter}
              onChange={(e) => setSellerFilter(e.target.value)}
              style={{border:"1px solid #d1d5db", borderRadius:"8px", padding:"8px 12px", fontSize:"13px"}}
            >
              <option value="all">همه محصولات</option>
              <option value="vira">فقط محصولات ویرا</option>
              {sellers.map(s => <option key={s.id} value={s.id}>{s.shop_name}</option>)}
            </select>
          </div>

          <table style={{width:"100%", borderCollapse:"collapse", textAlign:"right"}}>
            <thead style={{background:"#1e3a8a", color:"white"}}>
              <tr>
                <th style={{padding:"12px"}}>نام محصول</th>
                <th style={{padding:"12px"}}>فروشنده</th>
                <th style={{padding:"12px"}}>دسته</th>
                <th style={{padding:"12px"}}>قیمت</th>
                <th style={{padding:"12px"}}>موجودی</th>
                <th style={{padding:"12px"}}>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((p) => (
                <tr key={p.id} style={{borderBottom:"1px solid #f3f4f6"}}>
                  <td style={{padding:"12px"}}>{p.name}</td>
                  <td style={{padding:"12px"}}>
                    <span style={{
                      fontSize:"11px", fontWeight:"bold", padding:"3px 10px", borderRadius:"6px",
                      background: p.seller_id ? "#f0fdf4" : "#eff6ff",
                      color: p.seller_id ? "#15803d" : "#1e3a8a",
                    }}>
                      {getSellerName(p.seller_id)}
                    </span>
                  </td>
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
                    <div style={{display:"flex", gap:"6px", flexWrap:"wrap"}}>
                      <button
                        onClick={() => saveOneProduct(p.id)}
                        style={{background:"#16a34a", color:"white", border:"none", borderRadius:"6px", padding:"6px 14px", cursor:"pointer", fontSize:"12px"}}
                      >
                        ذخیره قیمت/موجودی
                      </button>
                      <button
                        onClick={() => startEditProduct(p)}
                        style={{background:"#1e3a8a", color:"white", border:"none", borderRadius:"6px", padding:"6px 14px", cursor:"pointer", fontSize:"12px"}}
                      >
                        ویرایش کامل
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(p.id)}
                        style={{background:"#fee2e2", color:"#dc2626", border:"none", borderRadius:"6px", padding:"6px 14px", cursor:"pointer", fontSize:"12px"}}
                      >
                        حذف
                      </button>
                    </div>
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
