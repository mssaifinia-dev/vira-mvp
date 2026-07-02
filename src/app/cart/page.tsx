'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { strings } from '@/lib/strings';

type CartItem = {
  id: string;
  quantity: number;
  product_id: string;
  products: {
    id: string;
    name: string;
    price: number;
    image: string | null;
    stock: number;
    category: string;
    seller_id: string | null;
  };
};

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('online');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const [discountInput, setDiscountInput] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; percent: number; id: string } | null>(null);
  const [discountError, setDiscountError] = useState('');
  const [checkingDiscount, setCheckingDiscount] = useState(false);

  useEffect(() => {
    fetchCart();

    // نمایش پیام در صورت برگشت ناموفق از درگاه پرداخت
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'failed') {
      setError('پرداخت انجام نشد یا لغو شد. لطفاً دوباره تلاش کنید.');
    }
  }, []);

  function handlePhone(val: string) {
    const cleaned = val.replace(/[^0-9]/g, '').substring(0, 11);
    setPhone(cleaned);
  }

  async function fetchCart() {
    const userRes = await supabase.auth.getUser();
    const user = userRes.data.user;
    if (!user) { window.location.href = '/auth'; return; }

    const cartRes = await supabase
      .from('cart_items')
      .select('id, quantity, product_id, products(id, name, price, image, stock, category, seller_id)')
      .eq('user_id', user.id);

    setItems((cartRes.data as any) || []);
    setLoading(false);
  }

  async function updateQuantity(itemId: string, newQty: number) {
    if (newQty < 1) return;
    await supabase.from('cart_items').update({ quantity: newQty }).eq('id', itemId);
    fetchCart();
  }

  async function removeItem(itemId: string) {
    await supabase.from('cart_items').delete().eq('id', itemId);
    fetchCart();
  }

  let subtotal = 0;
  for (let i = 0; i < items.length; i++) {
    subtotal = subtotal + items[i].products.price * items[i].quantity;
  }

  const discountAmount = appliedDiscount ? Math.round(subtotal * (appliedDiscount.percent / 100)) : 0;
  const total = subtotal - discountAmount;

  async function applyDiscount() {
    setDiscountError('');
    setCheckingDiscount(true);

    if (!discountInput) {
      setCheckingDiscount(false);
      return;
    }

    const codeRes = await supabase
      .from('discount_codes')
      .select('*')
      .eq('code', discountInput.toUpperCase().trim())
      .eq('is_active', true)
      .maybeSingle();

    if (!codeRes.data) {
      setDiscountError('کد تخفیف معتبر نیست');
      setAppliedDiscount(null);
      setCheckingDiscount(false);
      return;
    }

    const discountData = codeRes.data;

    if (discountData.expires_at && new Date(discountData.expires_at) < new Date()) {
      setDiscountError('این کد تخفیف منقضی شده است');
      setAppliedDiscount(null);
      setCheckingDiscount(false);
      return;
    }

    if (discountData.max_uses !== null && discountData.used_count >= discountData.max_uses) {
      setDiscountError('سقف استفاده از این کد تمام شده است');
      setAppliedDiscount(null);
      setCheckingDiscount(false);
      return;
    }

    setAppliedDiscount({ code: discountData.code, percent: discountData.discount_percent, id: discountData.id });
    setCheckingDiscount(false);
  }

  function removeDiscount() {
    setAppliedDiscount(null);
    setDiscountInput('');
    setDiscountError('');
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

  async function handleCheckout() {
    setSubmitting(true);
    setError('');

    if (!fullName || !phone || !address) {
      setError(strings.required_error);
      setSubmitting(false);
      return;
    }

    if (phone.length !== 11 || phone.substring(0, 2) !== '09') {
      setError(strings.phone_error);
      setSubmitting(false);
      return;
    }

    const userRes = await supabase.auth.getUser();
    const user = userRes.data.user;

    const discountRatio = appliedDiscount ? (1 - appliedDiscount.percent / 100) : 1;

    const orderRows = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemTotalBeforeDiscount = item.products.price * item.quantity;
      const itemTotal = Math.round(itemTotalBeforeDiscount * discountRatio);
      const itemDiscountAmount = itemTotalBeforeDiscount - itemTotal;

      let commissionAmount = 0;
      let sellerPayout = 0;
      let sellerId: string | null = null;

      if (item.products.seller_id) {
        sellerId = item.products.seller_id;
        const commissionPercent = await getCommissionPercent(item.products.category);
        commissionAmount = Math.round(itemTotal * (commissionPercent / 100));
        sellerPayout = itemTotal - commissionAmount;
      }

      orderRows.push({
        user_id: user!.id,
        product_id: item.products.id,
        quantity: item.quantity,
        total_price: itemTotal,
        full_name: fullName,
        phone: phone,
        address: address,
        seller_id: sellerId,
        commission_amount: commissionAmount,
        seller_payout: sellerPayout,
        discount_code: appliedDiscount ? appliedDiscount.code : null,
        discount_amount: itemDiscountAmount,
        payment_method: paymentMethod,
        payment_status: paymentMethod === 'online' ? 'unpaid' : 'not_applicable',
      });
    }

    const insertRes = await supabase.from('orders').insert(orderRows).select('id');

    if (insertRes.error) {
      setError(insertRes.error.message);
      setSubmitting(false);
      return;
    }

    if (appliedDiscount) {
      const currentCodeRes = await supabase
        .from('discount_codes')
        .select('used_count')
        .eq('id', appliedDiscount.id)
        .single();

      if (currentCodeRes.data) {
        await supabase
          .from('discount_codes')
          .update({ used_count: currentCodeRes.data.used_count + 1 })
          .eq('id', appliedDiscount.id);
      }
    }

    // پرداخت آنلاین: کاربر را به درگاه زرین‌پال هدایت می‌کنیم
    if (paymentMethod === 'online') {
      const orderIds = (insertRes.data || []).map((o: any) => o.id);

      try {
        const payRes = await fetch('/api/payment/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderIds,
            amountToman: total,
            mobile: phone,
            description: `پرداخت سفارش ویرا - ${fullName}`,
          }),
        });

        const payData = await payRes.json();

        if (payData.url) {
          // توجه: سبد خرید عمداً اینجا پاک نمی‌شود؛ بعد از تایید موفق پرداخت پاک می‌شود
          window.location.href = payData.url;
          return;
        }

        setError(payData.error || 'خطا در اتصال به درگاه پرداخت');
        setSubmitting(false);
        return;

      } catch (err) {
        setError('خطا در اتصال به درگاه پرداخت. لطفاً دوباره تلاش کنید.');
        setSubmitting(false);
        return;
      }
    }

    // پرداخت در محل: همینجا سفارش را نهایی می‌کنیم
    await supabase.from('cart_items').delete().eq('user_id', user!.id);
    setDone(true);
    setSubmitting(false);
  }

  if (loading) {
    return (
      <main style={{minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center"}}>
        <p style={{color:"#1e3a8a"}}>{strings.loading}</p>
      </main>
    );
  }

  if (done) {
    return (
      <main style={{minHeight:"100vh", background:"#f3f4f6", display:"flex", alignItems:"center", justifyContent:"center"}} dir="rtl">
        <div style={{background:"white", borderRadius:"16px", padding:"32px", textAlign:"center", maxWidth:"400px"}}>
          <div style={{fontSize:"48px"}}>✅</div>
          <h2 style={{color:"#16a34a", marginTop:"16px", fontWeight:"bold", fontSize:"20px"}}>{strings.order_placed}</h2>
          {paymentMethod === 'cash_on_delivery' ? (
            <p style={{color:"#6b7280", fontSize:"14px", marginTop:"8px"}}>هنگام تحویل، مبلغ را نقدی پرداخت کنید</p>
          ) : null}
          <button
            onClick={() => { window.location.href = '/marketplace'; }}
            style={{marginTop:"20px", background:"#1e3a8a", color:"white", padding:"10px 28px", borderRadius:"10px", border:"none", cursor:"pointer", fontWeight:"bold"}}
          >
            {strings.continue_shopping}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={{minHeight:"100vh", background:"#f3f4f6", padding:"32px 16px"}} dir="rtl">
      <div style={{maxWidth:"800px", margin:"0 auto"}}>

        <h1 style={{fontSize:"24px", fontWeight:"bold", color:"#1e3a8a", marginBottom:"24px"}}>
          {strings.cart_title}
        </h1>

        {items.length === 0 ? (
          <div style={{background:"white", borderRadius:"16px", padding:"48px", textAlign:"center"}}>
            <p style={{color:"#9ca3af", fontSize:"16px"}}>{strings.cart_empty}</p>
            <a href="/marketplace" style={{display:"inline-block", marginTop:"16px", color:"#1e3a8a", fontWeight:"bold", textDecoration:"none"}}>
              ← {strings.go_to_shop}
            </a>
          </div>
        ) : (
          <div>
            <div style={{background:"white", borderRadius:"16px", padding:"16px", marginBottom:"24px"}}>
              {items.map((item) => (
                <div key={item.id} style={{display:"flex", alignItems:"center", gap:"16px", padding:"16px 0", borderBottom:"1px solid #f3f4f6"}}>

                  {item.products.image ? (
                    <img src={item.products.image} alt={item.products.name} style={{width:"64px", height:"64px", objectFit:"cover", borderRadius:"8px"}} />
                  ) : (
                    <div style={{width:"64px", height:"64px", background:"#f3f4f6", borderRadius:"8px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"24px"}}>📦</div>
                  )}

                  <div style={{flex:1}}>
                    <p style={{fontWeight:"bold", color:"#111827"}}>{item.products.name}</p>
                    <p style={{color:"#16a34a", fontSize:"14px", marginTop:"4px"}}>
                      {item.products.price.toLocaleString('fa-IR')} {strings.toman}
                    </p>
                  </div>

                  <div style={{display:"flex", alignItems:"center", gap:"8px"}}>
                    <button onClick={() => updateQuantity(item.id, item.quantity - 1)} style={{width:"28px", height:"28px", background:"#f3f4f6", border:"none", borderRadius:"6px", cursor:"pointer"}}>−</button>
                    <span style={{minWidth:"20px", textAlign:"center", fontWeight:"bold"}}>{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, item.quantity + 1)} style={{width:"28px", height:"28px", background:"#f3f4f6", border:"none", borderRadius:"6px", cursor:"pointer"}}>+</button>
                  </div>

                  <button onClick={() => removeItem(item.id)} style={{color:"#dc2626", border:"none", background:"none", cursor:"pointer", fontSize:"13px"}}>
                    {strings.remove_btn}
                  </button>
                </div>
              ))}

              <div style={{paddingTop:"16px"}}>
                {!appliedDiscount ? (
                  <div style={{display:"flex", gap:"8px"}}>
                    <input
                      type="text"
                      value={discountInput}
                      onChange={(e) => setDiscountInput(e.target.value)}
                      placeholder="کد تخفیف دارید؟"
                      style={{flex:1, border:"1px solid #d1d5db", borderRadius:"8px", padding:"8px 12px", boxSizing:"border-box"}}
                    />
                    <button
                      onClick={applyDiscount}
                      disabled={checkingDiscount}
                      style={{background:"#1e3a8a", color:"white", border:"none", borderRadius:"8px", padding:"8px 20px", cursor:"pointer", fontSize:"13px"}}
                    >
                      {checkingDiscount ? '...' : 'اعمال کد'}
                    </button>
                  </div>
                ) : (
                  <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", background:"#d1fae5", borderRadius:"8px", padding:"10px 14px"}}>
                    <span style={{color:"#065f46", fontSize:"13px", fontWeight:"bold"}}>
                      ✓ کد "{appliedDiscount.code}" ({appliedDiscount.percent}٪ تخفیف) اعمال شد
                    </span>
                    <button onClick={removeDiscount} style={{color:"#dc2626", border:"none", background:"none", cursor:"pointer", fontSize:"12px"}}>
                      حذف
                    </button>
                  </div>
                )}
                {discountError ? <p style={{color:"red", fontSize:"12px", marginTop:"6px"}}>{discountError}</p> : null}
              </div>

              <div style={{paddingTop:"16px"}}>
                <div style={{display:"flex", justifyContent:"space-between", fontSize:"14px", color:"#6b7280", marginBottom:"4px"}}>
                  <span>جمع جزء:</span>
                  <span>{subtotal.toLocaleString('fa-IR')} {strings.toman}</span>
                </div>
                {appliedDiscount ? (
                  <div style={{display:"flex", justifyContent:"space-between", fontSize:"14px", color:"#16a34a", marginBottom:"4px"}}>
                    <span>تخفیف:</span>
                    <span>− {discountAmount.toLocaleString('fa-IR')} {strings.toman}</span>
                  </div>
                ) : null}
                <div style={{display:"flex", justifyContent:"space-between", fontSize:"18px", fontWeight:"bold", marginTop:"8px"}}>
                  <span>{strings.cart_total}:</span>
                  <span style={{color:"#1e3a8a"}}>{total.toLocaleString('fa-IR')} {strings.toman}</span>
                </div>
              </div>
            </div>

            <div style={{background:"white", borderRadius:"16px", padding:"24px"}}>
              <h3 style={{fontWeight:"bold", marginBottom:"16px"}}>{strings.delivery_info}</h3>

              <div style={{marginBottom:"16px"}}>
                <label style={{display:"block", fontSize:"14px", color:"#6b7280", marginBottom:"4px"}}>{strings.full_name_label}</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  style={{width:"100%", border:"1px solid #d1d5db", borderRadius:"8px", padding:"10px 12px", boxSizing:"border-box"}}
                />
              </div>

              <div style={{marginBottom:"16px"}}>
                <label style={{display:"block", fontSize:"14px", color:"#6b7280", marginBottom:"4px"}}>{strings.phone_label} (11 رقم، با 09)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => handlePhone(e.target.value)}
                  style={{width:"100%", border:"1px solid #d1d5db", borderRadius:"8px", padding:"10px 12px", boxSizing:"border-box"}}
                />
                <p style={{fontSize:"12px", color:"#9ca3af", marginTop:"4px"}}>{phone.length}/11</p>
              </div>

              <div style={{marginBottom:"20px"}}>
                <label style={{display:"block", fontSize:"14px", color:"#6b7280", marginBottom:"4px"}}>{strings.address_input_label}</label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={3}
                  style={{width:"100%", border:"1px solid #d1d5db", borderRadius:"8px", padding:"10px 12px", boxSizing:"border-box"}}
                />
              </div>

              <div style={{marginBottom:"20px"}}>
                <label style={{display:"block", fontSize:"14px", color:"#6b7280", marginBottom:"8px"}}>روش پرداخت</label>
                <div style={{display:"flex", gap:"12px"}}>
                  <button
                    onClick={() => setPaymentMethod('online')}
                    style={{
                      flex:1, padding:"12px", borderRadius:"10px", border: paymentMethod === 'online' ? "2px solid #1e3a8a" : "1px solid #d1d5db",
                      background: paymentMethod === 'online' ? "#eff6ff" : "white", cursor:"pointer", fontSize:"14px", fontWeight: paymentMethod === 'online' ? "bold" : "normal"
                    }}
                  >
                    💳 پرداخت آنلاین
                  </button>
                  <button
                    onClick={() => setPaymentMethod('cash_on_delivery')}
                    style={{
                      flex:1, padding:"12px", borderRadius:"10px", border: paymentMethod === 'cash_on_delivery' ? "2px solid #1e3a8a" : "1px solid #d1d5db",
                      background: paymentMethod === 'cash_on_delivery' ? "#eff6ff" : "white", cursor:"pointer", fontSize:"14px", fontWeight: paymentMethod === 'cash_on_delivery' ? "bold" : "normal"
                    }}
                  >
                    💵 پرداخت در محل
                  </button>
                </div>
              </div>

              {error && <p style={{color:"red", fontSize:"14px", marginBottom:"12px"}}>{error}</p>}

              <button
                onClick={handleCheckout}
                disabled={submitting}
                style={{width:"100%", background:"#16a34a", color:"white", padding:"14px", borderRadius:"10px", border:"none", cursor:"pointer", fontSize:"16px", fontWeight:"bold", opacity: submitting ? 0.5 : 1}}
              >
                {submitting ? strings.submitting_label : (paymentMethod === 'online' ? 'پرداخت و ثبت سفارش' : strings.checkout_btn)}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
