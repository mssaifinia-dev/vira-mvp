'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function SellerRegister() {
  const [shopName, setShopName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handlePhone(val: string) {
    const cleaned = val.replace(/[^0-9]/g, '').substring(0, 11);
    setPhone(cleaned);
  }

  async function handleSubmit() {
    setLoading(true);
    setError(null);

    if (!shopName || !phone || !city) {
      setError('لطفاً همه فیلدهای الزامی را پر کنید');
      setLoading(false);
      return;
    }

    if (phone.length !== 11 || phone.substring(0, 2) !== '09') {
      setError('شماره موبایل باید 11 رقم و با 09 شروع شود');
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError('ابتدا وارد حساب کاربری شو');
      setLoading(false);
      return;
    }

    const { error } = await supabase.from('sellers').insert({
      user_id: user.id,
      shop_name: shopName,
      phone,
      city,
      description,
    });

    if (error) setError('خطا در ثبت اطلاعات');
    else setMessage('درخواست فروشندگی ثبت شد! پس از تایید مدیر فعال می‌شود.');

    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center" dir="rtl">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-lg">

        <h1 className="text-2xl font-bold text-blue-900 text-center mb-2">
          ثبت‌نام فروشنده
        </h1>
        <p className="text-center text-gray-500 text-sm mb-6">
          پس از تایید مدیر، پنل فروش شما فعال می‌شود
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">نام فروشگاه *</label>
            <input
              type="text"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-900"
              placeholder="مثلاً: فروشگاه تجهیزات ارتباطی رضایی"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">شماره تماس * (11 رقم، با 09)</label>
            <input
              type="text"
              inputMode="numeric"
              value={phone}
              onChange={(e) => handlePhone(e.target.value)}
              className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-900"
              placeholder="09xxxxxxxxx"
            />
            <p className="text-xs text-gray-400 mt-1">{phone.length}/11</p>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">شهر *</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-900"
              placeholder="تهران"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">توضیحات فروشگاه</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-900"
              rows={3}
              placeholder="فروش تجهیزات فیبر نوری و مخابرات..."
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}
          {message && <p className="text-green-600 text-sm">{message}</p>}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-blue-900 text-white py-2 rounded-lg hover:bg-blue-800 transition disabled:opacity-50"
          >
            {loading ? 'در حال ثبت...' : 'ارسال درخواست'}
          </button>
        </div>

      </div>
    </main>
  );
}