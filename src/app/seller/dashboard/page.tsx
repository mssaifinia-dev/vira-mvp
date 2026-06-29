'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

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

type SalesReportRow = {
  total_price: number;
  commission_amount: number;
  seller_payout: number;
  status: string;
};

export default function SellerDashboard() {
   const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [sales, setSales] = useState<SalesReportRow[]>([]);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [isSpecialOffer, setIsSpecialOffer] = useState(false);
  const [category, setCategory] = useState('ftth');
  const [stock, setStock] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);

  const categories = [
    { value: 'ftth', label: 'تجهیزات FTTH' },
    { value: 'smart-home', label: 'خانه هوشمند' },
    { value: 'car-parts', label: 'قطعات خودرو' },
    { value: 'battery', label: 'باطری شارژی' },
    { value: 'stock', label: 'استوک' },
  ];

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
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (sellerRes.data) {
      setSellerId(sellerRes.data.id);
      fetchMyProducts(sellerRes.data.id);
      fetchSales(sellerRes.data.id);
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

  async function fetchSales(sid: string) {
    const { data } = await supabase
      .from('orders')
      .select('total_price, commission_amount, seller_payout, status')
      .eq('seller_id', sid);

    setSales(data || []);
  }

 async function handleAddProduct() {
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

  let imageUrl = null;

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

    const { data } = supabase.storage
      .from('products')
      .getPublicUrl(fileName);

    imageUrl = data.publicUrl;
  }

  const { error } = await supabase.from('products').insert({
    name,
    description,
    price: Number(price),
    original_price: originalPrice ? Number(originalPrice) : null,
    is_special_offer: isSpecialOffer,
    category,
    stock: Number(stock),
    seller_id: sellerId,
    image: imageUrl,
  });

  if (error) {
    setError(error.message);
    return;
  }

  setName('');
  setDescription('');
  setPrice('');
  setOriginalPrice('');
  setCategory('');
  setStock('');
  setImageFile(null);

  fetchMyProducts(sellerId);
}
   
  async function handleDelete(id: string) {
    await supabase.from('products').delete().eq('id', id);
    if (sellerId) fetchMyProducts(sellerId);
  }

  let totalSales = 0;
  let totalCommission = 0;
  let totalPayout = 0;
  for (let i = 0; i < sales.length; i++) {
    totalSales = totalSales + sales[i].total_price;
    totalCommission = totalCommission + sales[i].commission_amount;
    totalPayout = totalPayout + sales[i].seller_payout;
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

  return (
    <main className="min-h-screen bg-gray-100 p-8" dir="rtl">
      <div className="max-w-5xl mx-auto">

        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-blue-900">داشبورد فروشنده</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-900 text-white px-5 py-2 rounded-lg hover:bg-blue-800 transition"
          >
            {showForm ? 'انصراف' : '+ افزودن محصول'}
          </button>
        </div>

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

        {message && (
          <p className="text-green-600 bg-green-50 p-3 rounded-lg mb-4">{message}</p>
        )}

        {showForm && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h2 className="text-lg font-bold text-blue-900 mb-4">محصول جدید</h2>
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
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e)=>setImageFile(e.target.files?.[0] || null)}
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
              onClick={handleAddProduct}
              className="mt-4 bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition"
            >
              ثبت محصول
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
                  <td colSpan={5} className="p-8 text-center text-gray-400">
                    هنوز محصولی ثبت نکردی
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className="border-t hover:bg-gray-50">
                    <td className="p-4">
                      {p.name}
                      {p.is_special_offer ? <span className="mr-2 text-xs bg-red-100 text-red-600 px-2 py-1 rounded">شگفت‌انگیز</span> : null}
                    </td>
                    <td className="p-4 text-sm text-gray-500">{p.category}</td>
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
                    <td className="p-4">
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

      </div>
    </main>
  );
}