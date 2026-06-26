'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  original_price: number | null;
  is_special_offer: boolean;
  stock: number;
  category: string;
  seller_id: string | null;
};

export default function OrderPage() {
  const { id } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchProduct() {
      const userRes = await supabase.auth.getUser();
      const user = userRes.data.user;
      if (!user) { window.location.href = '/auth'; return; }

      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();

      setProduct(data);
    }
    fetchProduct();
  }, [id]);

  function handlePhone(val: string) {
    const cleaned = val.replace(/[^0-9]/g, '').substring(0, 11);
    setPhone(cleaned);
  }

  async function getCommissionPercent(category: string): Promise<number> {
    const res = await supabase
      .from('category_commissions')
      .select('commission_percent')
      .eq('category', category)
      .maybeSingle();

    if (res.data && res.data.commission_percent !== null) {
      return res.data.commission_percent;
    }
    return 5;
  }

  async function handleOrder() {
    setSubmitting(true);
    setError('');

    if (!fullName || !phone || !address) {
      setError('همه فیلدها الزامی است');
      setSubmitting(false);
      return;
    }

    if (phone.length !== 11 || phone.substring(0, 2) !== '09') {
      setError('شماره موبایل باید 11 رقم و با 09 شروع شود');
      setSubmitting(false);
      return;
    }

    const userRes = await supabase.auth.getUser();
    const user = userRes.data.user;

    const totalPrice = product!.price * quantity;
    let commissionAmount = 0;
    let sellerPayout = 0;
    let sellerId: string | null = null;

    if (product!.seller_id) {
      sellerId = product!.seller_id;
      const commissionPercent = await getCommissionPercent(product!.category);
      commissionAmount = Math.round(totalPrice * (commissionPercent / 100));
      sellerPayout = totalPrice - commissionAmount;
    }

    const discountAmountTotal = product!.original_price ? (product!.original_price - product!.price) * quantity : 0;

    const { error } = await supabase.from('orders').insert({
      user_id: user!.id,
      product_id: product!.id,
      quantity: quantity,
      total_price: totalPrice,
      full_name: fullName,
      phone: phone,
      address: address,
      seller_id: sellerId,
      commission_amount: commissionAmount,
      seller_payout: sellerPayout,
      discount_amount: discountAmountTotal,
    });

    if (error) setError('خطا در ثبت سفارش: ' + error.message);
    else setDone(true);

    setSubmitting(false);
  }

  if (done) return (
    <main style={{minHeight:"100vh", background:"#f3f4f6", display:"flex", alignItems:"center", justifyContent:"center"}} dir="rtl">
      <div style={{background:"white", borderRadius:"16px", padding:"32px", textAlign:"center", maxWidth:"400px"}}>
        <div style={{fontSize:"48px"}}>✅</div>
        <h2 style={{color:"#16a34a", marginTop:"16px", fontWeight:"bold"}}>سفارش ثبت شد!</h2>
        <button
          onClick={() => { window.location.href = '/marketplace'; }}
          style={{marginTop:"16px", background:"#1e3a8a", color:"white", padding:"10px 24px", borderRadius:"8px", border:"none", cursor:"pointer"}}
        >
          ادامه خرید
        </button>
      </div>
    </main>
  );

  if (!product) return (
    <main style={{minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center"}}>
      <p>در حال بارگذاری...</p>
    </main>
  );

  const hasDiscount = product.original_price && product.original_price > product.price;
  const discountPercent = hasDiscount ? Math.round(((product.original_price! - product.price) / product.original_price!) * 100) : 0;
  const itemTotal = product.price * quantity;
  const originalTotal = hasDiscount ? product.original_price! * quantity : itemTotal;
  const userSaving = hasDiscount ? originalTotal - itemTotal : 0;

  return (
    <main style={{minHeight:"100vh", background:"#f3f4f6", padding:"32px"}} dir="rtl">
      <div style={{maxWidth:"600px", margin:"0 auto"}}>
        <h1 style={{fontSize:"24px", fontWeight:"bold", color:"#1e3a8a", marginBottom:"24px"}}>ثبت سفارش</h1>

        <div style={{background:"white", borderRadius:"12px", padding:"24px", marginBottom:"24px", position:"relative"}}>
          {hasDiscount ? (
            <span style={{position:"absolute", top:"16px", left:"16px", background:"#dc2626", color:"white", fontSize:"12px", fontWeight:"bold", padding:"4px 10px", borderRadius:"6px"}}>
              {product.is_special_offer ? 'پیشنهاد شگفت‌انگیز' : (discountPercent + '٪ تخفیف')}
            </span>
          ) : null}

          <h2 style={{fontWeight:"bold"}}>{product.name}</h2>
          <p style={{color:"#6b7280", fontSize:"14px", marginTop:"4px"}}>{product.description}</p>

          {hasDiscount ? (
            <div style={{marginTop:"12px"}}>
              <span style={{textDecoration:"line-through", color:"#9ca3af", fontSize:"14px", marginLeft:"8px"}}>
                {product.original_price!.toLocaleString('fa-IR')} تومان
              </span>
              <span style={{color:"#dc2626", fontWeight:"bold", fontSize:"20px"}}>
                {product.price.toLocaleString('fa-IR')} تومان
              </span>
            </div>
          ) : (
            <p style={{color:"green", fontWeight:"bold", marginTop:"12px"}}>
              {product.price.toLocaleString('fa-IR')} تومان
            </p>
          )}
        </div>

        <div style={{background:"white", borderRadius:"12px", padding:"24px"}}>
          <div style={{marginBottom:"16px"}}>
            <label style={{display:"block", fontSize:"14px", color:"#6b7280", marginBottom:"4px"}}>نام و نام خانوادگی</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              style={{width:"100%", border:"1px solid #d1d5db", borderRadius:"8px", padding:"8px 12px", boxSizing:"border-box"}}
            />
          </div>

          <div style={{marginBottom:"16px"}}>
            <label style={{display:"block", fontSize:"14px", color:"#6b7280", marginBottom:"4px"}}>شماره تماس (11 رقم، با 09)</label>
            <input
              type="text"
              inputMode="numeric"
              value={phone}
              onChange={(e) => handlePhone(e.target.value)}
              style={{width:"100%", border:"1px solid #d1d5db", borderRadius:"8px", padding:"8px 12px", boxSizing:"border-box"}}
            />
            <p style={{fontSize:"12px", color:"#9ca3af", marginTop:"4px"}}>{phone.length}/11</p>
          </div>

          <div style={{marginBottom:"16px"}}>
            <label style={{display:"block", fontSize:"14px", color:"#6b7280", marginBottom:"4px"}}>آدرس</label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
              style={{width:"100%", border:"1px solid #d1d5db", borderRadius:"8px", padding:"8px 12px", boxSizing:"border-box"}}
            />
          </div>

          <div style={{display:"flex", alignItems:"center", gap:"12px", marginBottom:"16px"}}>
            <button onClick={() => setQuantity(Math.max(1, quantity - 1))} style={{width:"32px", height:"32px", background:"#f3f4f6", borderRadius:"8px", border:"none", cursor:"pointer"}}>-</button>
            <span style={{fontWeight:"bold"}}>{quantity}</span>
            <button onClick={() => setQuantity(Math.min(product.stock, quantity + 1))} style={{width:"32px", height:"32px", background:"#f3f4f6", borderRadius:"8px", border:"none", cursor:"pointer"}}>+</button>
          </div>

          {userSaving > 0 ? (
            <div style={{background:"#fef2f2", border:"1px solid #fecaca", borderRadius:"8px", padding:"12px 16px", marginBottom:"16px", textAlign:"center"}}>
              <p style={{color:"#dc2626", fontWeight:"bold", fontSize:"15px"}}>
                🎉 سود شما از این خرید: {userSaving.toLocaleString('fa-IR')} تومان
              </p>
            </div>
          ) : null}

          <div style={{background:"#f9fafb", borderRadius:"8px", padding:"16px", display:"flex", justifyContent:"space-between", marginBottom:"16px"}}>
            <span>مبلغ کل:</span>
            <span style={{fontWeight:"bold", color:"#1e3a8a"}}>
              {itemTotal.toLocaleString('fa-IR')} تومان
            </span>
          </div>

          {error && <p style={{color:"red", fontSize:"14px", marginBottom:"12px"}}>{error}</p>}

          <button
            onClick={handleOrder}
            disabled={submitting}
            style={{width:"100%", background:"#1e3a8a", color:"white", padding:"12px", borderRadius:"8px", border:"none", cursor:"pointer", fontSize:"16px", fontWeight:"bold", opacity: submitting ? 0.5 : 1}}
          >
            {submitting ? 'در حال ثبت...' : 'ثبت سفارش'}
          </button>
        </div>
      </div>
    </main>
  );
}