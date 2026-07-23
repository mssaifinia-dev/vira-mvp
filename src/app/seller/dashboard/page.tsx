'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';

type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  original_price: number | null;
  is_special_offer: boolean;
  category: string;
  stock: number;
  image: string | null;
};

type OrderRow = {
  id: string;
  full_name: string;
  phone: string;
  quantity: number;
  total_price: number;
  commission_amount: number;
  seller_payout: number;
  status: string;
  payment_method: string;
  created_at: string;
};

type SellerProfile = {
  id: string;
  shop_name: string;
  phone: string;
  city: string;
  is_approved: boolean;
};

const statusLabels: Record<string, string> = {
  pending: 'در انتظار',
  confirmed: 'تایید شده',
  delivered: 'تحویل‌شده',
  cancelled: 'لغوشده',
};

const categories = [
  { value: 'ftth', label: 'تجهیزات FTTH' },
  { value: 'smart-home', label: 'خانه هوشمند' },
  { value: 'car-parts', label: 'قطعات خودرو' },
  { value: 'battery', label: 'باطری شارژی' },
  { value: 'stock', label: 'استوک' },
];

export default function SellerDashboard() {
  const [activeTab, setActiveTab] = useState<'products' | 'orders' | 'earnings' | 'profile'>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [sales, setSales] = useState<OrderRow[]>([]);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [isSpecialOffer, setIsSpecialOffer] = useState(false);
  const [category, setCategory] = useState('ftth');
  const [stock, setStock] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [existingImage, setExistingImage] = useState<string | null>(null);

  // فرم پروفایل
  const [profileShopName, setProfileShopName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileCity, setProfileCity] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [excelUploading, setExcelUploading] = useState(false);
  const [excelMessage, setExcelMessage] = useState<string | null>(null);

  useEffect(() => {
    init();
  }, []);

  async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = '/auth';
      return;
    }

    const sellerRes = await supabase
      .from('sellers')
      .select('id, shop_name, phone, city, is_approved')
      .eq('user_id', user.id)
      .maybeSingle();

    if (sellerRes.data) {
      setSellerId(sellerRes.data.id);
      setProfile(sellerRes.data);
      setProfileShopName(sellerRes.data.shop_name || '');
      setProfilePhone(sellerRes.data.phone || '');
      setProfileCity(sellerRes.data.city || '');
      fetchMyProducts(sellerRes.data.id);
      fetchOrders(sellerRes.data.id);
    } else {
      setLoading(false);
    }
  }

  async function fetchMyProducts(sid: string) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('seller_id', sid)
      .order('created_at', { ascending: false });

    if (!error) setProducts(data || []);
    setLoading(false);
  }

  async function fetchOrders(sid: string) {
    const { data } = await supabase
      .from('orders')
      .select('id, full_name, phone, quantity, total_price, commission_amount, seller_payout, status, payment_method, created_at')
      .eq('seller_id', sid)
      .order('created_at', { ascending: false });

    setOrders(data || []);
    setSales(data || []);
  }

  function resetForm() {
    setName('');
    setDescription('');
    setPrice('');
    setOriginalPrice('');
    setIsSpecialOffer(false);
    setCategory('ftth');
    setStock('');
    setImageFile(null);
    setExistingImage(null);
    setEditingId(null);
    setError(null);
  }

  function startEdit(p: Product) {
    setEditingId(p.id);
    setName(p.name);
    setDescription(p.description || '');
    setPrice(String(p.price));
    setOriginalPrice(p.original_price ? String(p.original_price) : '');
    setIsSpecialOffer(p.is_special_offer);
    setCategory(p.category || 'ftth');
    setStock(String(p.stock));
    setExistingImage(p.image);
    setImageFile(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSaveProduct() {
    setError(null);

    if (!name || !price || !stock) {
      setError('نام، قیمت و موجودی الزامی است');
      return;
    }

    if (!sellerId) {
      setError('حساب فروشندگی شما هنوز ثبت یا تایید نشده است');
      return;
    }

    if (originalPrice && Number(originalPrice) <= Number(price)) {
      setError('قیمت اصلی باید بیشتر از قیمت فروش باشد');
      return;
    }

    let imageUrl = existingImage;

    if (imageFile) {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = Date.now() + '.' + fileExt;

      const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(fileName, imageFile);

      if (uploadError) {
        setError('خطا در آپلود تصویر: ' + uploadError.message);
        return;
      }

      const { data } = supabase.storage.from('products').getPublicUrl(fileName);
      imageUrl = data.publicUrl;
    }

    const payload = {
      name,
      description,
      price: Number(price),
      original_price: originalPrice ? Number(originalPrice) : null,
      is_special_offer: isSpecialOffer,
      category,
      stock: Number(stock),
      seller_id: sellerId,
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

    if (saveError) {
      setError(saveError.message);
      return;
    }

    setMessage(editingId ? 'محصول ویرایش شد' : 'محصول ثبت شد');
    setTimeout(() => setMessage(null), 2500);
    resetForm();
    setShowForm(false);
    fetchMyProducts(sellerId);
  }

  async function handleDelete(id: string) {
    await supabase.from('products').delete().eq('id', id);
    if (sellerId) fetchMyProducts(sellerId);
  }

  function downloadProductTemplate() {
    const data = [{
      name: 'نمونه محصول',
      category: 'ftth',
      description: 'توضیحات محصول',
      price: 150000,
      stock: 10,
      image_url: 'https://example.com/photo.jpg',
    }];
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'محصولات');
    XLSX.writeFile(workbook, 'vira-seller-products-template.xlsx');
  }

  async function handleExcelImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !sellerId) return;

    setExcelUploading(true);
    setExcelMessage(null);
    setError(null);

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

        const { error } = await supabase.from('products').insert({
          name: row.name,
          category: row.category || 'ftth',
          description: row.description || '',
          price: Number(row.price),
          stock: Number(row.stock || 0),
          image: row.image_url || null,
          seller_id: sellerId,
        });

        if (error) failed++; else success++;
      }

      setExcelMessage(`${success} محصول ثبت شد${failed ? `، ${failed} مورد خطا داشت` : ''}`);
      fetchMyProducts(sellerId);
    } catch {
      setError('خواندن فایل اکسل مشکل داشت');
    }

    setExcelUploading(false);
    e.target.value = '';
  }

  async function saveProfile() {
    if (!sellerId) return;
    setSavingProfile(true);

    const { error } = await supabase
      .from('sellers')
      .update({
        shop_name: profileShopName,
        phone: profilePhone,
        city: profileCity,
      })
      .eq('id', sellerId);

    if (!error) {
      setMessage('پروفایل فروشگاه بروزرسانی شد');
      setTimeout(() => setMessage(null), 2500);
      setProfile(prev => prev ? { ...prev, shop_name: profileShopName, phone: profilePhone, city: profileCity } : prev);
    } else {
      setError(error.message);
    }
    setSavingProfile(false);
  }

  function formatDate(dateStr: string) {
    try {
      return new Date(dateStr).toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  let totalSales = 0;
  let totalCommission = 0;
  let totalPayout = 0;
  for (let i = 0; i < sales.length; i++) {
    totalSales += sales[i].total_price || 0;
    totalCommission += sales[i].commission_amount || 0;
    totalPayout += sales[i].seller_payout || 0;
  }

  if (loading) return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center">
      <p className="text-blue-900 text-xl">در حال بارگذاری...</p>
    </main>
  );

  if (!sellerId) return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center" dir="rtl">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
        <p className="text-gray-600">حساب فروشندگی شما هنوز ثبت یا تایید نشده است.</p>
        <a href="/seller/register" className="text-blue-900 font-bold mt-4 inline-block">
          ثبت‌نام فروشنده
        </a>
      </div>
    </main>
  );

  const tabs = [
    { key: 'products', label: `📦 محصولات (${products.length})` },
    { key: 'orders', label: `🛒 سفارش‌ها (${orders.length})` },
    { key: 'earnings', label: '💰 درآمد و تسویه' },
    { key: 'profile', label: '👤 پروفایل فروشگاه' },
  ];

  return (
    <main className="min-h-screen bg-gray-100 p-8" dir="rtl">
      <div className="max-w-5xl mx-auto">

        <div className="flex justify-between items-center mb-2">
          <h1 className="text-2xl font-bold text-blue-900">داشبورد فروشنده</h1>
        </div>
        <p className="text-gray-500 text-sm mb-6">{profile?.shop_name}</p>

        {message && (
          <p className="text-green-600 bg-green-50 p-3 rounded-lg mb-4">{message}</p>
        )}

        {/* تب‌ها */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-2 rounded-lg text-sm font-bold shadow-sm ${
                activeTab === tab.key ? 'bg-blue-900 text-white' : 'bg-white text-blue-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* تب محصولات */}
        {activeTab === 'products' && (
          <>
            <div className="bg-white rounded-xl shadow-lg p-5 mb-4">
              <p className="font-bold text-blue-900 mb-2 text-sm">افزودن گروهی محصولات با اکسل</p>
              <p className="text-gray-500 text-xs mb-3">
                فایل نمونه را دانلود کنید، اطلاعات محصولات را وارد کنید (برای عکس، لینک تصویر را در ستون image_url بگذارید) و دوباره آپلود کنید.
              </p>
              <div className="flex gap-3 flex-wrap items-center">
                <button
                  onClick={downloadProductTemplate}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-bold"
                >
                  دانلود فایل نمونه
                </button>
                <label className="bg-purple-700 text-white px-4 py-2 rounded-lg text-xs font-bold cursor-pointer">
                  {excelUploading ? 'در حال ثبت...' : 'آپلود فایل اکسل'}
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleExcelImport}
                    disabled={excelUploading}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
              {excelMessage && <p className="text-green-600 text-xs mt-2">{excelMessage}</p>}
            </div>

            <div className="flex justify-end mb-4">
              <button
                onClick={() => { if (showForm) { resetForm(); } setShowForm(!showForm); }}
                className="bg-blue-900 text-white px-5 py-2 rounded-lg hover:bg-blue-800 transition"
              >
                {showForm ? 'انصراف' : '+ افزودن محصول'}
              </button>
            </div>

            {showForm && (
              <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
                <h2 className="text-lg font-bold text-blue-900 mb-4">
                  {editingId ? 'ویرایش محصول' : 'محصول جدید'}
                </h2>
                <div className="grid md:grid-cols-2 gap-4">

                  <div>
                    <label className="block text-sm text-gray-600 mb-1">نام محصول *</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-600 mb-1">دسته‌بندی</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-900"
                    >
                      {categories.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-600 mb-1">قیمت فروش - تومان *</label>
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-600 mb-1">موجودی *</label>
                    <input
                      type="number"
                      value={stock}
                      onChange={(e) => setStock(e.target.value)}
                      className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-600 mb-1">قیمت اصلی - قبل تخفیف (اختیاری)</label>
                    <input
                      type="number"
                      value={originalPrice}
                      onChange={(e) => setOriginalPrice(e.target.value)}
                      placeholder="اگر تخفیف ندارد خالی بگذارید"
                      className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-900"
                    />
                  </div>

                  <div className="flex items-center">
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer mt-6">
                      <input
                        type="checkbox"
                        checked={isSpecialOffer}
                        onChange={(e) => setIsSpecialOffer(e.target.checked)}
                      />
                      پیشنهاد شگفت‌انگیز باشد
                    </label>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm text-gray-600 mb-1">تصویر محصول</label>
                    {existingImage && !imageFile && (
                      <img src={existingImage} alt={name} className="w-20 h-20 object-cover rounded-lg mb-2 border" />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                      className="w-full border rounded-lg px-4 py-2 mb-4"
                    />

                    <label className="block text-sm text-gray-600 mb-1">توضیحات</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-900"
                      rows={3}
                    />
                  </div>

                </div>

                {error && <p className="text-red-600 text-sm mt-3">{error}</p>}

                <button
                  onClick={handleSaveProduct}
                  className="mt-4 bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition"
                >
                  {editingId ? 'ذخیره تغییرات' : 'ثبت محصول'}
                </button>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <table className="w-full text-right">
                <thead className="bg-blue-900 text-white">
                  <tr>
                    <th className="p-4">تصویر</th>
                    <th className="p-4">نام محصول</th>
                    <th className="p-4">دسته‌بندی</th>
                    <th className="p-4">قیمت</th>
                    <th className="p-4">موجودی</th>
                    <th className="p-4">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-gray-400">
                        هنوز محصولی ثبت نکردی
                      </td>
                    </tr>
                  ) : (
                    products.map((p) => (
                      <tr key={p.id} className="border-t hover:bg-gray-50">
                        <td className="p-4">
                          {p.image ? (
                            <img src={p.image} alt={p.name} className="w-12 h-12 object-cover rounded-lg border" />
                          ) : (
                            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-xs">
                              بدون عکس
                            </div>
                          )}
                        </td>
                        <td className="p-4">
                          {p.name}
                          {p.is_special_offer ? <span className="mr-2 text-xs bg-red-100 text-red-600 px-2 py-1 rounded">شگفت‌انگیز</span> : null}
                        </td>
                        <td className="p-4 text-sm text-gray-500">
                          {categories.find(c => c.value === p.category)?.label || p.category}
                        </td>
                        <td className="p-4">
                          {p.original_price ? (
                            <>
                              <span className="line-through text-gray-400 text-sm ml-2">{p.original_price.toLocaleString('fa-IR')}</span>
                              <span className="text-red-600 font-bold">{p.price.toLocaleString('fa-IR')} تومان</span>
                            </>
                          ) : (
                            <span>{p.price.toLocaleString('fa-IR')} تومان</span>
                          )}
                        </td>
                        <td className="p-4">{p.stock}</td>
                        <td className="p-4 flex gap-3">
                          <button
                            onClick={() => startEdit(p)}
                            className="text-blue-700 hover:text-blue-900 text-sm"
                          >
                            ویرایش
                          </button>
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="text-red-500 hover:text-red-700 text-sm"
                          >
                            حذف
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* تب سفارش‌ها */}
        {activeTab === 'orders' && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <table className="w-full text-right">
              <thead className="bg-blue-900 text-white">
                <tr>
                  <th className="p-4">مشتری</th>
                  <th className="p-4">تلفن</th>
                  <th className="p-4">تعداد</th>
                  <th className="p-4">مبلغ کل</th>
                  <th className="p-4">سهم شما</th>
                  <th className="p-4">وضعیت</th>
                  <th className="p-4">تاریخ</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-400">هنوز سفارشی ثبت نشده</td>
                  </tr>
                ) : (
                  orders.map(o => (
                    <tr key={o.id} className="border-t hover:bg-gray-50">
                      <td className="p-4">{o.full_name}</td>
                      <td className="p-4 text-gray-500">{o.phone}</td>
                      <td className="p-4">{o.quantity}</td>
                      <td className="p-4">{o.total_price?.toLocaleString('fa-IR')} تومان</td>
                      <td className="p-4 text-green-600 font-bold">{o.seller_payout?.toLocaleString('fa-IR')} تومان</td>
                      <td className="p-4">
                        <span className={`text-xs px-2 py-1 rounded font-bold ${
                          o.status === 'delivered' ? 'bg-green-100 text-green-700' :
                          o.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {statusLabels[o.status] || o.status}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-gray-400">{formatDate(o.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* تب درآمد و تسویه */}
        {activeTab === 'earnings' && (
          <div>
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-white rounded-xl shadow p-5 text-center">
                <p className="text-2xl font-bold text-blue-900">{totalSales.toLocaleString('fa-IR')}</p>
                <p className="text-gray-500 mt-1 text-sm">جمع فروش (تومان)</p>
              </div>
              <div className="bg-white rounded-xl shadow p-5 text-center">
                <p className="text-2xl font-bold text-orange-500">{totalCommission.toLocaleString('fa-IR')}</p>
                <p className="text-gray-500 mt-1 text-sm">پورسانت ویرا (تومان)</p>
              </div>
              <div className="bg-white rounded-xl shadow p-5 text-center">
                <p className="text-2xl font-bold text-green-600">{totalPayout.toLocaleString('fa-IR')}</p>
                <p className="text-gray-500 mt-1 text-sm">سهم شما (تومان)</p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <p className="font-bold p-4 border-b text-blue-900">جزئیات تراکنش‌ها</p>
              <table className="w-full text-right">
                <thead className="bg-gray-50 text-gray-600 text-sm">
                  <tr>
                    <th className="p-3">مبلغ کل سفارش</th>
                    <th className="p-3">کمیسیون ویرا</th>
                    <th className="p-3">سهم شما</th>
                    <th className="p-3">وضعیت</th>
                    <th className="p-3">تاریخ</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.length === 0 ? (
                    <tr><td colSpan={5} className="p-8 text-center text-gray-400">هنوز تراکنشی ثبت نشده</td></tr>
                  ) : (
                    sales.map(s => (
                      <tr key={s.id} className="border-t text-sm">
                        <td className="p-3">{s.total_price?.toLocaleString('fa-IR')}</td>
                        <td className="p-3 text-orange-500">{s.commission_amount?.toLocaleString('fa-IR')}</td>
                        <td className="p-3 text-green-600 font-bold">{s.seller_payout?.toLocaleString('fa-IR')}</td>
                        <td className="p-3">{statusLabels[s.status] || s.status}</td>
                        <td className="p-3 text-xs text-gray-400">{formatDate(s.created_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* تب پروفایل فروشگاه */}
        {activeTab === 'profile' && (
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-lg">
            <h2 className="text-lg font-bold text-blue-900 mb-4">اطلاعات فروشگاه</h2>

            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-1">نام فروشگاه</label>
              <input
                type="text"
                value={profileShopName}
                onChange={(e) => setProfileShopName(e.target.value)}
                className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-900"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-1">شماره تماس</label>
              <input
                type="text"
                value={profilePhone}
                onChange={(e) => setProfilePhone(e.target.value)}
                className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-900"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm text-gray-600 mb-1">شهر</label>
              <input
                type="text"
                value={profileCity}
                onChange={(e) => setProfileCity(e.target.value)}
                className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-900"
              />
            </div>

            <div className="mb-4">
              <span className={`text-xs px-3 py-1 rounded-full font-bold ${
                profile?.is_approved ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
              }`}>
                {profile?.is_approved ? 'حساب تایید شده ✓' : 'در انتظار تایید ادمین'}
              </span>
            </div>

            {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

            <button
              onClick={saveProfile}
              disabled={savingProfile}
              className="bg-blue-900 text-white px-6 py-2 rounded-lg hover:bg-blue-800 transition disabled:opacity-50"
            >
              {savingProfile ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
            </button>
          </div>
        )}

      </div>
    </main>
  );
}
